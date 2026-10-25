"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import Link from "next/link";
import { api, formatTanggal, pendekkanHash } from "@/lib/format";

type Entry = { seq: number; jenis_entri: string; trx_id: string | null; payload_kanonik: string; hash_payload: string; hash_sebelumnya: string; hash_saat_ini: string; dibuat_pada: string };
type VerifyResult = { valid: boolean; entri_diperiksa: number; rusak_pada: number | null; alasan?: string; hash_terakhir: string };
const kindLabel: Record<string, string> = { transaksi: "Transaksi", peringatan: "Peringatan", status: "Perubahan status", koreksi: "Koreksi" };

export default function LedgerPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [latest, setLatest] = useState(0);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoSeq, setDemoSeq] = useState("");
  const [damagedSeq, setDamagedSeq] = useState<number | null>(null);
  const [passcode, setPasscode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [listing, demo] = await Promise.all([
        api<{ data: Entry[] }>("/api/ledger?urut=terbaru&batas=40"),
        api<{ enabled: boolean }>("/api/demo/status"),
      ]);
      setEntries(listing.data); setDemoEnabled(demo.enabled);
      const tail = listing.data[0]?.seq ?? 0;
      setLatest(tail);
      if (!demoSeq && tail) setDemoSeq(String(tail));
    } catch (e) { setError(e instanceof Error ? e.message : "Ledger tidak dapat dimuat."); }
  }, [demoSeq]);
  useEffect(() => { void load(); }, [load]);

  useGSAP(() => {
    if (!result || !listRef.current) return;
    const rows = Array.from(listRef.current.querySelectorAll<HTMLElement>(".ledger-entry"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const limited = rows.slice(0, 40);
    const interval = Math.min(1.5 / Math.max(limited.length, 1), 0.05);
    limited.forEach((row, index) => {
      const seq = Number(row.dataset.seq);
      if (result.rusak_pada !== null && seq > result.rusak_pada) return;
      gsap.fromTo(row, { backgroundColor: "rgb(14 90 95 / 13%)" }, { backgroundColor: "transparent", duration: 0.3, delay: index * interval, ease: "power2.out" });
    });
  }, { scope: listRef, dependencies: [result], revertOnUpdate: true });

  async function verify(full = false) {
    setPending(true); setError(""); setMessage(""); setResult(null);
    try {
      const query = new URLSearchParams();
      if (!full) {
        if (from) query.set("dari_seq", from);
        if (to) query.set("sampai_seq", to);
        if (from && !to && latest) query.set("sampai_seq", String(latest));
      }
      const value = await api<VerifyResult>(`/api/ledger/verifikasi${query.size ? `?${query}` : ""}`);
      setResult(value);
      if (!value.valid) setMessage(`Rantai rusak pada entri ${value.rusak_pada?.toLocaleString("id-ID")}. Entri sebelumnya masih konsisten.`);
      else setMessage(`Rantai valid. ${value.entri_diperiksa.toLocaleString("id-ID")} entri diperiksa.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Verifikasi gagal dijalankan."); }
    finally { setPending(false); }
  }

  async function damage() {
    if (!passcode || !Number.isSafeInteger(Number(demoSeq)) || Number(demoSeq) < 1) { setError("Isi nomor seq dan kode akses untuk demo."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      await api("/api/demo/rusak-entri", { method: "POST", headers: { "x-kode-akses": passcode }, body: JSON.stringify({ seq: Number(demoSeq) }) });
      setDamagedSeq(Number(demoSeq)); setMessage(`Entri ${demoSeq} diubah untuk demo. Jalankan verifikasi rentang entri tersebut.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Entri tidak dapat diubah untuk demo."); }
    finally { setPending(false); }
  }

  async function restore() {
    if (!passcode) { setError("Masukkan kode akses untuk memulihkan entri."); return; }
    setPending(true); setError("");
    try {
      await api("/api/demo/pulihkan", { method: "POST", headers: { "x-kode-akses": passcode }, body: "{}" });
      setDamagedSeq(null); setPasscode(""); setMessage("Entri demo dipulihkan. Verifikasi ulang rentangnya."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Entri belum dapat dipulihkan."); }
    finally { setPending(false); }
  }

  return (
    <>
      <header className="page-heading"><div><p className="eyebrow">Catatan perubahan</p><h1>Ledger simulasi</h1><p>Setiap entri mengikat payload dengan hash sebelumnya. Verifikasi penuh dapat memerlukan waktu karena rantai memuat puluhan ribu entri.</p></div></header>
      {error && <p className="error-state" role="alert">{error} Periksa koneksi atau kode akses, lalu coba lagi.</p>}
      {message && <div ref={resultRef} className={`verify-result ${result?.valid === false ? "invalid" : ""}`} role="status">{message}</div>}
      <section className="section rule-top">
        <div className="section-heading"><h2>Verifikasi rantai</h2><span className="provenance">Entri terbaru: {latest ? latest.toLocaleString("id-ID") : "belum tersedia"}</span></div>
        <form className="verify-controls" onSubmit={(event) => { event.preventDefault(); void verify(false); }}>
          <div className="field"><label htmlFor="from-seq">Dari seq</label><input id="from-seq" type="number" min="1" value={from} onChange={(event) => setFrom(event.target.value)} placeholder="Rentang opsional" /></div>
          <div className="field"><label htmlFor="to-seq">Sampai seq</label><input id="to-seq" type="number" min="1" value={to} onChange={(event) => setTo(event.target.value)} placeholder="Rentang opsional" /></div>
          <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Memverifikasi" : "Verifikasi rantai"}</button>
        </form>
        <div className="button-row" style={{ marginTop: 12 }}><button className="button button-small" type="button" disabled={pending} onClick={() => void verify(true)}>Verifikasi penuh</button><span className="provenance">Verifikasi penuh memeriksa seluruh rantai dari awal.</span></div>
        {result && <p className="provenance">Hash terakhir yang diperiksa: <code className="ledger-hash" title={result.hash_terakhir}>{pendekkanHash(result.hash_terakhir, 8)}</code></p>}
      </section>

      <section className="section"><div className="section-heading"><h2>Entri terbaru</h2><span className="provenance">Rantai hash, append-only selain mode demo</span></div>
        {entries.length ? <ol className="ledger-list" ref={listRef}>{entries.map((entry) => <li key={entry.seq} className={`ledger-entry ${result?.rusak_pada === entry.seq ? "is-broken" : ""} ${damagedSeq === entry.seq ? "is-active" : ""}`} data-seq={entry.seq}>
          <strong>Seq {entry.seq.toLocaleString("id-ID")}</strong><span>{kindLabel[entry.jenis_entri] ?? entry.jenis_entri} · {formatTanggal(entry.dibuat_pada)}</span>
          <span className="ledger-hash mono" title={entry.hash_saat_ini}>{pendekkanHash(entry.hash_saat_ini, 8)}</span>
          {entry.trx_id && <Link className="provenance" href={`/peringatan?kontrak_id=${encodeURIComponent(entry.trx_id)}`}>Transaksi {entry.trx_id}</Link>}
        </li>)}</ol> : <p className="empty-state">Belum ada entri ledger yang dapat ditampilkan.</p>}
        {entries.length > 0 && <p className="provenance">Menampilkan {entries.length} entri terbaru dari {latest.toLocaleString("id-ID")} entri.</p>}
      </section>

      {demoEnabled && <section className="demo-panel"><div className="section-heading"><h2>Mode demo</h2><span className="status-flag" data-status="baru">Aktif</span></div>
        <p>Perubahan ini hanya menunjukkan bahwa verifikasi menemukan isi yang berbeda. Pulihkan entri sebelum melanjutkan demo.</p>
        <div className="verify-controls"><div className="field"><label htmlFor="damage-seq">Seq untuk demo</label><input id="damage-seq" type="number" min="1" value={demoSeq} onChange={(event) => setDemoSeq(event.target.value)} disabled={damagedSeq !== null} /></div><div className="field"><label htmlFor="demo-passcode">Kode akses</label><input id="demo-passcode" type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} autoComplete="current-password" /></div>{damagedSeq === null ? <button className="button button-warning" type="button" disabled={pending} onClick={() => void damage()}>Rusak entri (demo)</button> : <button className="button button-primary" type="button" disabled={pending} onClick={() => void restore()}>Pulihkan</button>}</div>
        {damagedSeq !== null && <p className="info-note">Entri {damagedSeq} menunggu dipulihkan. Verifikasi dari {damagedSeq} sampai {damagedSeq} untuk melihat perubahan.</p>}
      </section>}
      <p className="info-note">Ledger ini adalah hash-chain simulasi dalam satu database. Ia membantu mendeteksi perubahan saat diverifikasi, dan tidak mencegah pengelola database menulis ulang rantai. <Link href="/tentang">Baca keterbatasan</Link>.</p>
    </>
  );
}

