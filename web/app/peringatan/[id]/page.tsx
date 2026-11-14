"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import DoubleCurve, { type CurveRow } from "@/components/DoubleCurve";
import ScoreRuler from "@/components/ScoreRuler";
import PanelBukti, { type Bukti } from "@/components/PanelBukti";
import { labelPrinsip, prinsipUntuk } from "@/lib/aturan";
import { PERAN_LABEL, bolehKoreksi, bolehTransisi, type Peran } from "@/lib/akses";
import { api, formatAngka, formatRupiah, formatTanggal, formatRingkas } from "@/lib/format";
import FormKoreksi, { type HasilKoreksi, type TransaksiKoreksi } from "./FormKoreksi";

type TransaksiDetail = TransaksiKoreksi & {
  nilai_kontrak: number;
  kontrak_id: string;
  project_id: string;
  kategori_hijau: string;
  persetujuan_diperoleh: number;
  kelengkapan_bukti: number;
};
type Detail = {
  id: string; trx_id: string; jenis: string; kode_aturan: string[]; skor: number | null; ambang: number | null; versi_model: string | null; status: string; catatan: string; dibuat_pada: string;
  transaksi: TransaksiDetail;
  temuan_aturan: string[];
  bukti: Bukti;
  peran: Peran | null;
  pembanding: { median_pencairan_sebelumnya: number; jumlah_pencairan_7_hari: number; rata_rata_delta_progres: number };
  riwayat_status: { seq: number; jenis?: string; status_lama?: string; status_baru?: string; catatan?: string; waktu?: string; alasan?: string; trx_id_baru?: string; trx_id_lama?: string; seq_dikoreksi?: number; peran?: Peran }[];
};
type ContractResponse = { kontrak: { nilai_kontrak_awal: number }; riwayat: CurveRow[] };
const statusLabel: Record<string, string> = { baru: "Baru", ditelaah: "Ditelaah", perlu_klarifikasi: "Perlu klarifikasi", diklarifikasi: "Diklarifikasi", ditindaklanjuti: "Ditindaklanjuti", ditutup: "Ditutup" };
const nextSteps: Record<string, string[]> = { baru: ["ditelaah"], ditelaah: ["perlu_klarifikasi", "ditindaklanjuti"], perlu_klarifikasi: ["diklarifikasi"], diklarifikasi: ["ditindaklanjuti"], ditindaklanjuti: ["ditutup"], ditutup: [] };
const actionLabel: Record<string, string> = { ditelaah: "Telaah", perlu_klarifikasi: "Minta klarifikasi", diklarifikasi: "Tandai diklarifikasi", ditindaklanjuti: "Tetapkan tindak lanjut", ditutup: "Tutup kasus" };
const ruleDescriptions: Record<string, string> = {
  R01_ID_PROYEK: "ID proyek tidak valid atau tidak sesuai dengan registri kontrak.",
  R02_PAGU: "Kumulatif pencairan melampaui pagu alokasi kontrak.",
  R03_PERSETUJUAN: "Jumlah persetujuan yang diperoleh belum memenuhi ketentuan untuk nilai pencairan.",
  R04_KATEGORI: "Kategori proyek tidak termasuk kategori hijau yang memenuhi syarat.",
  R05_HASH: "Hash dokumen saat ini tidak cocok dengan hash yang tercatat.",
  R06_MILESTONE: "Milestone belum terverifikasi untuk pembayaran termin.",
  R07_BUKTI: "Kelengkapan bukti berada di bawah ambang batas minimal.",
};

export default function DetailPeringatanPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [history, setHistory] = useState<CurveRow[]>([]);
  const [note, setNote] = useState("");
  const [passcode, setPasscode] = useState("");
  const [applied, setApplied] = useState("");
  const [correction, setCorrection] = useState<HasilKoreksi | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const markerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => { void params.then((value) => setId(value.id)); }, [params]);
  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const item = await api<Detail>(
        `/api/peringatan/${encodeURIComponent(id)}`,
        applied ? { headers: { "x-kode-akses": applied } } : undefined,
      );
      setDetail(item); setNote(item.catatan ?? "");
      const contract = await api<ContractResponse>(`/api/kontrak/${encodeURIComponent(item.transaksi.kontrak_id)}`);
      setHistory(contract.riwayat);
    } catch (e) { setError(e instanceof Error ? e.message : "Detail peringatan tidak dapat dimuat."); }
  }, [id, applied]);
  useEffect(() => { void load(); }, [load]);
  useGSAP(() => { if (markerRef.current) gsap.fromTo(markerRef.current, { x: -8, autoAlpha: .5 }, { x: 0, autoAlpha: 1, duration: .2, ease: "power2.inOut" }); }, { scope: markerRef, dependencies: [detail?.status], revertOnUpdate: true });

  function applyPasscode() {
    setMessage(""); setError("");
    setApplied(passcode.trim());
  }

  async function changeStatus(next: string) {
    if (!detail) return;
    if (!applied) { setError("Terapkan kode akses untuk mencatat perubahan status."); return; }
    if (["perlu_klarifikasi", "diklarifikasi", "ditindaklanjuti", "ditutup"].includes(next) && note.trim().length < 8) { setError("Tambahkan catatan tindak lanjut, minimal 8 karakter."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      await api(`/api/peringatan/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "x-kode-akses": applied }, body: JSON.stringify({ status: next, catatan: note }) });
      setMessage(`Status diperbarui menjadi ${statusLabel[next]}. Perubahan dicatat di ledger.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Status belum dapat diperbarui."); }
    finally { setPending(false); }
  }

  if (error && !detail) return <><header className="page-heading"><div><p className="eyebrow">Detail kasus</p><h1>Peringatan</h1></div></header><p className="error-state" role="alert">{error} Periksa ID peringatan dan koneksi database.</p><Link className="button" href="/peringatan">Kembali ke daftar</Link></>;
  if (!detail) return <><header className="page-heading"><div><p className="eyebrow">Detail kasus</p><h1>Memuat peringatan</h1></div></header><p className="loading-state">Memuat catatan transaksi.</p></>;

  const transaction = detail.transaksi;
  const curveRows = [...history];
  const targetIndex = curveRows.findIndex((row) => row.trx_id === transaction.trx_id);
  const allowedNext = (nextSteps[detail.status] ?? []).filter((next) => bolehTransisi(detail.peran, detail.status, next));
  const hasTransitions = (nextSteps[detail.status]?.length ?? 0) > 0;
  return (
    <>
      <header className="page-heading"><div><p className="eyebrow">Detail kasus</p><h1>{transaction.kontrak_id}</h1><p>Transaksi <code>{transaction.trx_id}</code> pada {formatTanggal(transaction.tanggal)}.</p></div><span className="status-flag" data-status={detail.status} ref={markerRef}>{statusLabel[detail.status] ?? detail.status}</span></header>
      {error && <p className="error-state" role="alert">{error}</p>}{message && <p className="info-note" role="status">{message}</p>}
      {correction && <p className="info-note" role="status">Koreksi tersimpan sebagai transaksi <code>{correction.trx_id_baru}</code> dengan entri ledger {correction.seq_ledger.join(", ")}. Hasil pemeriksaan ulang: <strong>{correction.hasil.keputusan === "peringatan" ? "Perlu diperiksa" : "Tidak ada peringatan baru"}</strong>. <Link href={`/kontrak/${encodeURIComponent(transaction.kontrak_id)}`}>Lihat riwayat kontrak</Link>{correction.peringatan_baru && <>. <Link href={`/peringatan/${correction.peringatan_baru.id}`}>Buka peringatan baru</Link></>}.</p>}
      <div className="detail-grid">
        <section><DoubleCurve rows={curveRows} nilaiKontrak={Number(transaction.nilai_kontrak)} flagged={[transaction.trx_id]} title="Posisi transaksi pada riwayat kontrak" />
          {targetIndex < 0 && <p className="provenance">Transaksi peringatan ditampilkan di panel detail. Riwayat pada grafik memuat pencairan kontrak yang tersedia.</p>}
          <div className="section rule-top"><h2>Data transaksi</h2><dl className="definition-list">
            <dt>Tanggal</dt><dd>{formatTanggal(transaction.tanggal)}</dd>
            <dt>Nilai pencairan</dt><dd>{formatRupiah(transaction.nilai_pencairan)}</dd>
            <dt>Progres fisik</dt><dd>{formatAngka(transaction.progres_fisik_pct)}%</dd>
            <dt>Nilai kontrak</dt><dd>{formatRingkas(transaction.nilai_kontrak)}</dd>
            <dt>Proyek</dt><dd><Link href={`/kontrak/${encodeURIComponent(transaction.kontrak_id)}`}>{String(transaction.project_id)}</Link></dd>
            <dt>Kategori hijau</dt><dd>{String(transaction.kategori_hijau)}</dd>
            <dt>Persetujuan</dt><dd>{String(transaction.persetujuan_diperoleh)}</dd>
            <dt>Milestone</dt><dd>{transaction.milestone_terverifikasi ? "Terverifikasi" : "Belum terverifikasi"}</dd>
          </dl></div>
        </section>
        <aside>
          <section className="rule-top"><h2>Alasan peringatan</h2>
            {detail.kode_aturan.length > 0 ? <ul className="finding-list">{detail.kode_aturan.map((code) => <li key={code}><strong>{code}</strong>: {ruleDescriptions[code] ?? "Ketentuan memerlukan pemeriksaan lebih lanjut."} <span className="principle-tag" data-prinsip={prinsipUntuk(code)}>{labelPrinsip(prinsipUntuk(code))}</span></li>)}</ul> : <><p>Skor {detail.skor === null ? "tidak tersedia" : formatAngka(detail.skor, 4)}. Ambang {detail.ambang === null ? "tidak tersedia" : formatAngka(detail.ambang, 4)}. Skor membantu memilih transaksi yang perlu ditinjau.</p><ScoreRuler score={detail.skor} threshold={Number(detail.ambang ?? .665)} /></>}
            <p className="provenance">Pembanding ini menunjukkan konteks riwayat, bukan penyebab pasti.</p>
          </section>
          <section className="section rule-top"><PanelBukti bukti={detail.bukti} /></section>
          <section className="section rule-top"><h2>Pembanding kontrak</h2><dl className="definition-list">
            <dt>Median pencairan</dt><dd>{formatRupiah(detail.pembanding.median_pencairan_sebelumnya)}</dd>
            <dt>Pencairan dalam 7 hari</dt><dd>{detail.pembanding.jumlah_pencairan_7_hari}</dd>
            <dt>Rata-rata delta progres</dt><dd>{formatAngka(detail.pembanding.rata_rata_delta_progres)} poin</dd>
          </dl></section>
          <section className="section rule-top"><h2>Akses peran</h2>
            <div className="field"><label htmlFor="status-passcode">Kode akses</label><div className="access-row"><input id="status-passcode" type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} autoComplete="current-password" /><button className="button button-small" type="button" onClick={applyPasscode}>Terapkan</button></div></div>
            <p className="role-marker" data-peran={detail.peran ?? "none"} aria-live="polite">Peran aktif: <strong>{detail.peran ? PERAN_LABEL[detail.peran] : "belum ada kode akses"}</strong></p>
            {applied && detail.peran === null && <p className="field-error" role="alert">Kode akses tidak dikenali. Periksa kembali kode untuk peran ini.</p>}
            <p className="provenance">Peran ditentukan server dari kode akses. Prototipe tidak memakai akun pengguna.</p>
          </section>
          <section className="section rule-top"><h2>Tindak lanjut</h2><div className="field"><label htmlFor="decision-note">Catatan</label><textarea id="decision-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Catat klarifikasi atau keputusan pemeriksaan." /></div>
            <div className="status-actions">{allowedNext.map((next) => <button className="button button-small" type="button" disabled={pending} key={next} onClick={() => void changeStatus(next)}>{pending ? "Menyimpan" : actionLabel[next]}</button>)}</div>
            {!applied && hasTransitions && <p className="empty-state">Terapkan kode akses untuk menampilkan tombol sesuai peran.</p>}
            {applied && allowedNext.length === 0 && hasTransitions && <p className="empty-state">Peran {detail.peran ? PERAN_LABEL[detail.peran] : "ini"} tidak berwenang memindahkan status ini. Perpindahan dilakukan peran lain.</p>}
            {!hasTransitions && <p className="empty-state">Kasus sudah ditutup. Riwayat perubahan tetap tersedia di ledger.</p>}
          </section>
          {detail.status === "perlu_klarifikasi" && bolehKoreksi(detail.peran) && <section className="section rule-top"><h2>Koreksi transaksi</h2><FormKoreksi peringatanId={id} trx={transaction} passcode={applied} onDone={(result) => { setCorrection(result); setMessage("Koreksi dicatat. Transaksi lama tetap tersimpan sebagai riwayat."); void load(); }} /></section>}
          {detail.status === "perlu_klarifikasi" && !bolehKoreksi(detail.peran) && <p className="info-note">Koreksi transaksi hanya untuk peran penyedia data. Peringatan ini menunggu klarifikasi dari penyedia data.</p>}
        </aside>
      </div>
      <section className="section rule-top"><h2>Riwayat status pada ledger</h2>
        {detail.riwayat_status.length ? <ol className="timeline">{detail.riwayat_status.map((event) => <li key={`${event.jenis ?? "status"}-${event.seq}`}>{event.jenis === "koreksi" ? <><span>Koreksi transaksi dicatat</span><small>Entri {event.seq}{event.seq_dikoreksi ? `, menggantikan entri ${event.seq_dikoreksi}` : ""}</small>{event.alasan && <small>Alasan: {event.alasan}</small>}{event.trx_id_baru && <small>Transaksi baru: <code>{event.trx_id_baru}</code></small>}</> : <><span>{statusLabel[event.status_lama ?? ""] ?? event.status_lama} menjadi {statusLabel[event.status_baru ?? ""] ?? event.status_baru}</span><small>Entri {event.seq}{event.waktu ? `, ${formatTanggal(event.waktu)}` : ""}</small>{event.catatan && <small>Catatan: {event.catatan}</small>}</>}{event.peran && <small>Peran: {PERAN_LABEL[event.peran] ?? event.peran}</small>}</li>)}</ol> : <p className="empty-state">Belum ada perubahan status setelah peringatan dibuat.</p>}
      </section>
    </>
  );
}
