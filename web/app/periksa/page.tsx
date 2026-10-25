"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import DoubleCurve, { type CurveRow } from "@/components/DoubleCurve";
import ScoreRuler from "@/components/ScoreRuler";
import { api, formatAngka, formatRupiah, formatRingkas, formatTanggal } from "@/lib/format";
import rules from "@/data/artifacts/rules_config.json";

type ContractResponse = {
  kontrak: { kontrak_id: string; project_id: string; nilai_kontrak_awal: number; pagu_alokasi: number; tanggal_mulai: string };
  proyek: { kategori_hijau: string } | null;
  riwayat: CurveRow[] & { kumulatif_cair?: number }[];
};
type CheckResult = {
  keputusan: "normal" | "peringatan";
  jenis_peringatan: string | null;
  temuan_aturan: { kode: string; pesan: string }[];
  skor: { nilai: number | null; ambang: number; di_atas_ambang: boolean; versi_model: string };
  fitur: Record<string, number>;
  pembanding: { median_pencairan_sebelumnya: number; jumlah_pencairan_7_hari: number; rata_rata_delta_progres: number };
  tersimpan: { trx_id: string; peringatan_id: string | null; seq_ledger: number | null } | null;
  waktu_proses_ms: number;
};

const today = new Date().toISOString().slice(0, 10);
const emptyForm = { project_id: "", tanggal: today, jenis_pembayaran: "termin", nilai_pencairan: "1000000000", progres_fisik_pct: "10", milestone_terverifikasi: true, persetujuan_diperoleh: "1", kelengkapan_bukti: "1", kategori_hijau: rules.kategori_sah[0], hash_tercatat: "", hash_dokumen_saat_ini: "" };

export default function PeriksaPage() {
  const [contractId, setContractId] = useState("");
  const [contract, setContract] = useState<ContractResponse | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [save, setSave] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const resultRef = useRef<HTMLElement>(null);
  const runId = useRef(0);

  useEffect(() => {
    const initialContract = new URLSearchParams(window.location.search).get("kontrak");
    if (!initialContract) return;
    setContractId(initialContract);
    void loadContract(initialContract);
  }, []);

  useGSAP(() => {
    const marker = resultRef.current?.querySelector(".result-flag");
    const items = resultRef.current?.querySelectorAll(".finding-item");
    if (!marker) return;
    gsap.fromTo(marker, { y: -16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.28, ease: "power2.out" });
    if (items?.length) gsap.fromTo(items, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, stagger: 0.04, delay: 0.12 });
  }, { scope: resultRef, dependencies: [result], revertOnUpdate: true });

  async function loadContract(id = contractId) {
    const clean = id.trim();
    if (!clean) { setLookupError("Masukkan ID kontrak untuk memuat riwayat."); return; }
    setLoadingContract(true); setLookupError(""); setError("");
    try {
      const found = await api<ContractResponse>(`/api/kontrak/${encodeURIComponent(clean)}`);
      setContract(found);
      setForm((current) => ({ ...current, project_id: found.kontrak.project_id, kategori_hijau: found.proyek?.kategori_hijau ?? current.kategori_hijau }));
    } catch (e) {
      setContract(null);
      setLookupError(e instanceof Error ? e.message : "Kontrak tidak ditemukan. Periksa ID kontrak, contohnya PRJ-0001-K01.");
    } finally { setLoadingContract(false); }
  }

  function setField<K extends keyof typeof emptyForm>(name: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function quickExample(kind: "wajar" | "aturan" | "lonjakan" | "hash") {
    const baseline = contract?.riwayat.at(-1);
    const amount = Number(baseline?.nilai_pencairan ?? 1_000_000_000);
    const progress = Number(baseline?.progres_fisik_pct ?? 35);
    setForm((current) => ({
      ...current,
      project_id: contract?.kontrak.project_id ?? current.project_id,
      nilai_pencairan: String(kind === "lonjakan" ? Math.round(amount * 1.7) : kind === "aturan" ? 6_000_000_000 : amount),
      progres_fisik_pct: String(kind === "lonjakan" ? progress : Math.min(100, progress + 3)),
      milestone_terverifikasi: kind !== "aturan",
      persetujuan_diperoleh: kind === "aturan" ? "1" : String(Number(amount >= 5_000_000_000 ? 3 : amount >= 1_000_000_000 ? 2 : 1)),
      kelengkapan_bukti: "1",
      kategori_hijau: rules.kategori_sah[0],
      hash_tercatat: kind === "hash" ? "hash-asli-demo" : "",
      hash_dokumen_saat_ini: kind === "hash" ? "hash-berubah-demo" : "",
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setResult(null);
    if (!contract) { setError("Muat kontrak terlebih dahulu agar sistem dapat menghitung fitur dari riwayat."); return; }
    if (save && !passcode) { setError("Masukkan kode akses untuk menyimpan ke ledger."); return; }
    const value = Number(form.nilai_pencairan);
    const progress = Number(form.progres_fisik_pct);
    const approvals = Number(form.persetujuan_diperoleh);
    const proof = Number(form.kelengkapan_bukti);
    if (!Number.isSafeInteger(value) || value <= 0) { setError("Nilai pencairan harus bilangan rupiah positif."); return; }
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) { setError("Progres fisik harus berada pada rentang 0 sampai 100 persen."); return; }
    if (!Number.isInteger(approvals) || approvals < 0) { setError("Jumlah persetujuan harus bilangan bulat nol atau lebih."); return; }
    if (!Number.isFinite(proof) || proof < 0 || proof > 1) { setError("Kelengkapan bukti harus berada pada rentang 0 sampai 1."); return; }
    setPending(true);
    const thisRun = ++runId.current;
    try {
      const response = await api<CheckResult>("/api/periksa", {
        method: "POST",
        headers: save ? { "x-kode-akses": passcode } : undefined,
        body: JSON.stringify({
          kontrak_id: contract.kontrak.kontrak_id,
          project_id: form.project_id,
          tanggal: form.tanggal,
          jenis_pembayaran: form.jenis_pembayaran,
          nilai_pencairan: value,
          progres_fisik_pct: progress,
          milestone_terverifikasi: form.milestone_terverifikasi,
          persetujuan_diperoleh: approvals,
          kelengkapan_bukti: proof,
          kategori_hijau: form.kategori_hijau,
          hash_tercatat: form.hash_tercatat,
          hash_dokumen_saat_ini: form.hash_dokumen_saat_ini,
          simpan: save,
        }),
      });
      if (thisRun === runId.current) {
        setResult(response);
        if (response.tersimpan) { setPasscode(""); await loadContract(); }
      }
    } catch (e) { if (thisRun === runId.current) setError(e instanceof Error ? e.message : "Pemeriksaan gagal dijalankan. Coba lagi."); }
    finally { if (thisRun === runId.current) setPending(false); }
  }

  const preview: CurveRow | undefined = result && contract ? {
    tanggal: form.tanggal,
    trx_id: result.tersimpan?.trx_id,
    nilai_pencairan: Number(form.nilai_pencairan),
    progres_fisik_pct: Number(form.progres_fisik_pct),
  } : undefined;
  const flagged = useMemo(() => result?.keputusan === "peringatan" && result.tersimpan?.trx_id ? [result.tersimpan.trx_id] : [], [result]);

  return (
    <>
      <header className="page-heading"><div><p className="eyebrow">Pemeriksaan satu transaksi</p><h1>Periksa transaksi</h1><p>Fitur turunan dihitung dari riwayat kontrak yang tersimpan. Pemeriksaan tanpa simpan tidak mengubah database.</p></div></header>
      <div className="form-result-grid">
        <section className="form-panel" aria-labelledby="form-title">
          <div className="section-heading"><h2 id="form-title">Data pencairan</h2></div>
          <div className="field field-wide">
            <label htmlFor="contract-id">ID kontrak</label>
            <div className="contract-lookup"><input id="contract-id" value={contractId} placeholder="Contoh PRJ-0001-K01" onChange={(event) => setContractId(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void loadContract(); } }} /><button className="button button-small" type="button" disabled={loadingContract} onClick={() => void loadContract()}>{loadingContract ? "Memuat" : "Muat kontrak"}</button></div>
            {lookupError && <span className="field-error" role="alert">{lookupError} Periksa ID kontrak, contohnya PRJ-0001-K01.</span>}
          </div>

          {contract && <div className="contract-summary" aria-live="polite"><strong>{contract.kontrak.kontrak_id}</strong><div className="contract-summary-grid" style={{ marginTop: 8 }}>
            <div><span>Nilai kontrak</span><strong>{formatRingkas(contract.kontrak.nilai_kontrak_awal)}</strong></div>
            <div><span>Pagu alokasi</span><strong>{formatRingkas(contract.kontrak.pagu_alokasi)}</strong></div>
            <div><span>Pencairan kumulatif</span><strong>{formatRingkas(contract.riwayat.at(-1)?.kumulatif_cair)}</strong></div>
            <div><span>Progres terakhir</span><strong>{formatAngka(contract.riwayat.at(-1)?.progres_fisik_pct)}%</strong></div>
            <div><span>Tanggal pencairan terakhir</span><strong>{formatTanggal(contract.riwayat.at(-1)?.tanggal)}</strong></div>
          </div></div>}

          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="field"><label htmlFor="project-id">ID proyek</label><input id="project-id" value={form.project_id} maxLength={128} onChange={(event) => setField("project_id", event.target.value)} required /></div>
              <div className="field"><label htmlFor="date">Tanggal</label><input id="date" type="date" value={form.tanggal} onChange={(event) => setField("tanggal", event.target.value)} required /></div>
              <div className="field"><label htmlFor="payment-type">Jenis pembayaran</label><select id="payment-type" value={form.jenis_pembayaran} onChange={(event) => setField("jenis_pembayaran", event.target.value)}><option value="uang_muka">Uang muka</option><option value="termin">Termin</option><option value="retensi">Retensi</option></select></div>
              <div className="field"><label htmlFor="amount">Nilai pencairan</label><div className="field-prefix"><span>Rp</span><input id="amount" type="number" min="1" step="1" value={form.nilai_pencairan} onChange={(event) => setField("nilai_pencairan", event.target.value)} required /></div></div>
              <div className="field"><label htmlFor="progress">Progres fisik</label><input id="progress" type="number" min="0" max="100" step="0.01" value={form.progres_fisik_pct} onChange={(event) => setField("progres_fisik_pct", event.target.value)} required /></div>
              <div className="field"><label htmlFor="approvals">Persetujuan diperoleh</label><input id="approvals" type="number" min="0" max="100" step="1" value={form.persetujuan_diperoleh} onChange={(event) => setField("persetujuan_diperoleh", event.target.value)} required /></div>
              <div className="field"><label htmlFor="proof">Kelengkapan bukti</label><input id="proof" type="number" min="0" max="1" step="0.01" value={form.kelengkapan_bukti} onChange={(event) => setField("kelengkapan_bukti", event.target.value)} required /></div>
              <div className="field"><label htmlFor="category">Kategori hijau</label><select id="category" value={form.kategori_hijau} onChange={(event) => setField("kategori_hijau", event.target.value)}>{rules.kategori_sah.map((category) => <option key={category}>{category}</option>)}<option value="Kategori tidak sah">Kategori tidak sah, contoh aturan</option></select></div>
              <div className="field field-wide"><label><input type="checkbox" checked={form.milestone_terverifikasi} onChange={(event) => setField("milestone_terverifikasi", event.target.checked)} /> Milestone terverifikasi</label></div>
              <details className="field field-wide"><summary>Opsi hash dokumen</summary><div className="form-grid" style={{ marginTop: 12 }}><div className="field"><label htmlFor="recorded-hash">Hash tercatat</label><input id="recorded-hash" value={form.hash_tercatat} onChange={(event) => setField("hash_tercatat", event.target.value)} /></div><div className="field"><label htmlFor="current-hash">Hash dokumen saat ini</label><input id="current-hash" value={form.hash_dokumen_saat_ini} onChange={(event) => setField("hash_dokumen_saat_ini", event.target.value)} /></div></div></details>
            </div>

            <div className="quick-example" aria-label="Contoh cepat"><span className="field-label" style={{ width: "100%", marginBottom: 0 }}>Isi contoh cepat</span>
              <button type="button" onClick={() => quickExample("wajar")}>Transaksi wajar</button>
              <button type="button" onClick={() => quickExample("aturan")}>Persetujuan kurang</button>
              <button type="button" onClick={() => quickExample("lonjakan")}>Lonjakan nilai</button>
              <button type="button" onClick={() => quickExample("hash")}>Hash berbeda</button>
            </div>
            <label className="save-toggle"><input type="checkbox" checked={save} onChange={(event) => setSave(event.target.checked)} /><span><strong>Simpan hasil ke ledger</strong><br /><small>Perlu kode akses. Bawaan mati.</small></span></label>
            {save && <div className="field"><label htmlFor="passcode">Kode akses</label><input id="passcode" type="password" autoComplete="current-password" value={passcode} onChange={(event) => setPasscode(event.target.value)} required /></div>}
            {error && <p className="field-error" role="alert">{error}</p>}
            <div className="button-row" style={{ marginTop: 18 }}><button className="button button-primary" disabled={pending || !contract} type="submit">{pending ? "Memeriksa" : save ? "Simpan ke ledger" : "Periksa transaksi"}</button><button className="button" type="button" onClick={() => { setForm(emptyForm); setResult(null); setError(""); }}>Bersihkan</button></div>
          </form>
        </section>

        <section className="result-panel" ref={resultRef} aria-labelledby="result-title" aria-live="polite">
          <div className="section-heading"><h2 id="result-title">Hasil pemeriksaan</h2>{result && <span className="provenance">{formatAngka(result.waktu_proses_ms, 2)} ms</span>}</div>
          {!result && <p className="empty-state">Muat kontrak, lalu periksa transaksi untuk melihat temuan, skor, dan pembanding.</p>}
          {result && <>
            <div className="result-banner" data-warning={result.keputusan === "peringatan"}><span className="status-flag result-flag" data-status={result.keputusan === "peringatan" ? "baru" : "ditelaah"}>{result.keputusan === "peringatan" ? "Perlu diperiksa" : "Tidak ada peringatan baru"}</span></div>
            {result.temuan_aturan.length > 0 ? <div className="rule-top"><h3>Temuan aturan</h3><ul className="finding-list">{result.temuan_aturan.map((item) => <li className="finding-item" key={item.kode}><strong>{item.kode}</strong>: {item.pesan}</li>)}</ul></div> : <div className="rule-top"><h3>Skor anomali</h3>{result.skor.nilai === null ? <p>Skor tidak dihitung karena ada temuan aturan.</p> : <><p>Skor {formatAngka(result.skor.nilai, 4)}, ambang {formatAngka(result.skor.ambang, 4)}. Skor menunjukkan seberapa jauh pola transaksi ini dari pola umum. Skor bukan bukti pelanggaran.</p><ScoreRuler score={result.skor.nilai} threshold={result.skor.ambang} /></>}</div>}
            {contract && <div className="section"><DoubleCurve rows={contract.riwayat} nilaiKontrak={Number(contract.kontrak.nilai_kontrak_awal)} flagged={flagged} preview={preview} title="Riwayat kontrak dan transaksi ini" /></div>}
            <div className="section"><h3>Pembanding riwayat</h3><div className="measure-list"><div><span>Median pencairan sebelumnya</span><strong>{formatRupiah(result.pembanding.median_pencairan_sebelumnya)}</strong></div><div><span>Pencairan dalam 7 hari</span><strong>{result.pembanding.jumlah_pencairan_7_hari}</strong></div><div><span>Rata-rata delta progres</span><strong>{formatAngka(result.pembanding.rata_rata_delta_progres)} poin</strong></div></div></div>
            {result.tersimpan && <p className="info-note">Tersimpan ke ledger sebagai entri {result.tersimpan.seq_ledger}. ID transaksi: <code>{result.tersimpan.trx_id}</code>{result.tersimpan.peringatan_id && <>. <a href={`/peringatan/${result.tersimpan.peringatan_id}`}>Buka peringatan</a></>}</p>}
          </>}
        </section>
      </div>
      <p className="provenance" style={{ marginTop: 28 }}>Nilai aturan dan skor menggunakan artefak model {rules.versi}. Data simulasi. Peringatan menentukan urutan pemeriksaan.</p>
    </>
  );
}

