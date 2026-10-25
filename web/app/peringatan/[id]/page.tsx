"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import DoubleCurve, { type CurveRow } from "@/components/DoubleCurve";
import ScoreRuler from "@/components/ScoreRuler";
import { api, formatAngka, formatRupiah, formatTanggal, formatRingkas } from "@/lib/format";

type Detail = {
  id: string; trx_id: string; jenis: string; kode_aturan: string[]; skor: number | null; ambang: number | null; versi_model: string | null; status: string; catatan: string; dibuat_pada: string;
  transaksi: Record<string, unknown> & { trx_id: string; kontrak_id: string; project_id: string; tanggal: string; nilai_pencairan: number; nilai_kontrak: number; progres_fisik_pct: number; kategori_hijau: string; milestone_terverifikasi: boolean; persetujuan_diperoleh: number; kelengkapan_bukti: number };
  temuan_aturan: string[];
  pembanding: { median_pencairan_sebelumnya: number; jumlah_pencairan_7_hari: number; rata_rata_delta_progres: number };
  riwayat_status: { seq: number; status_lama: string; status_baru: string; catatan: string; waktu: string }[];
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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const markerRef = useRef<HTMLSpanElement>(null);
  useEffect(() => { void params.then((value) => setId(value.id)); }, [params]);
  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const item = await api<Detail>(`/api/peringatan/${encodeURIComponent(id)}`);
      setDetail(item); setNote(item.catatan ?? "");
      const contract = await api<ContractResponse>(`/api/kontrak/${encodeURIComponent(item.transaksi.kontrak_id)}`);
      setHistory(contract.riwayat);
    } catch (e) { setError(e instanceof Error ? e.message : "Detail peringatan tidak dapat dimuat."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useGSAP(() => { if (markerRef.current) gsap.fromTo(markerRef.current, { x: -8, autoAlpha: .5 }, { x: 0, autoAlpha: 1, duration: .2, ease: "power2.inOut" }); }, { scope: markerRef, dependencies: [detail?.status], revertOnUpdate: true });

  async function changeStatus(next: string) {
    if (!detail) return;
    if (!passcode) { setError("Masukkan kode akses untuk mencatat perubahan status."); return; }
    if (["perlu_klarifikasi", "diklarifikasi", "ditindaklanjuti", "ditutup"].includes(next) && note.trim().length < 8) { setError("Tambahkan catatan tindak lanjut, minimal 8 karakter."); return; }
    setPending(true); setError(""); setMessage("");
    try {
      await api(`/api/peringatan/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "x-kode-akses": passcode }, body: JSON.stringify({ status: next, catatan: note }) });
      setPasscode(""); setMessage(`Status diperbarui menjadi ${statusLabel[next]}. Perubahan dicatat di ledger.`); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Status belum dapat diperbarui."); }
    finally { setPending(false); }
  }

  if (error && !detail) return <><header className="page-heading"><div><p className="eyebrow">Detail kasus</p><h1>Peringatan</h1></div></header><p className="error-state" role="alert">{error} Periksa ID peringatan dan koneksi database.</p><Link className="button" href="/peringatan">Kembali ke daftar</Link></>;
  if (!detail) return <><header className="page-heading"><div><p className="eyebrow">Detail kasus</p><h1>Memuat peringatan</h1></div></header><p className="loading-state">Memuat catatan transaksi.</p></>;

  const transaction = detail.transaksi;
  const curveRows = [...history];
  const targetIndex = curveRows.findIndex((row) => row.trx_id === transaction.trx_id);
  return (
    <>
      <header className="page-heading"><div><p className="eyebrow">Detail kasus</p><h1>{transaction.kontrak_id}</h1><p>Transaksi <code>{transaction.trx_id}</code> pada {formatTanggal(transaction.tanggal)}.</p></div><span className="status-flag" data-status={detail.status} ref={markerRef}>{statusLabel[detail.status] ?? detail.status}</span></header>
      {error && <p className="error-state" role="alert">{error}</p>}{message && <p className="info-note" role="status">{message}</p>}
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
            {detail.kode_aturan.length > 0 ? <ul className="finding-list">{detail.kode_aturan.map((code) => <li key={code}><strong>{code}</strong>: {ruleDescriptions[code] ?? "Ketentuan memerlukan pemeriksaan lebih lanjut."}</li>)}</ul> : <><p>Skor {detail.skor === null ? "tidak tersedia" : formatAngka(detail.skor, 4)}. Ambang {detail.ambang === null ? "tidak tersedia" : formatAngka(detail.ambang, 4)}. Skor membantu memilih transaksi yang perlu ditinjau.</p><ScoreRuler score={detail.skor} threshold={Number(detail.ambang ?? .665)} /></>}
            <p className="provenance">Pembanding ini menunjukkan konteks riwayat, bukan penyebab pasti.</p>
          </section>
          <section className="section rule-top"><h2>Pembanding kontrak</h2><dl className="definition-list">
            <dt>Median pencairan</dt><dd>{formatRupiah(detail.pembanding.median_pencairan_sebelumnya)}</dd>
            <dt>Pencairan dalam 7 hari</dt><dd>{detail.pembanding.jumlah_pencairan_7_hari}</dd>
            <dt>Rata-rata delta progres</dt><dd>{formatAngka(detail.pembanding.rata_rata_delta_progres)} poin</dd>
          </dl></section>
          <section className="section rule-top"><h2>Tindak lanjut</h2><div className="field"><label htmlFor="decision-note">Catatan</label><textarea id="decision-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder="Catat klarifikasi atau keputusan pemeriksaan." /></div>
            <div className="field" style={{ marginTop: 12 }}><label htmlFor="status-passcode">Kode akses</label><input id="status-passcode" type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} autoComplete="current-password" /></div>
            <div className="status-actions">{(nextSteps[detail.status] ?? []).map((next) => <button className="button button-small" type="button" disabled={pending} key={next} onClick={() => void changeStatus(next)}>{pending ? "Menyimpan" : actionLabel[next]}</button>)}</div>
            {nextSteps[detail.status]?.length === 0 && <p className="empty-state">Kasus sudah ditutup. Riwayat perubahan tetap tersedia di ledger.</p>}
          </section>
        </aside>
      </div>
      <section className="section rule-top"><h2>Riwayat status pada ledger</h2>
        {detail.riwayat_status.length ? <ol className="timeline">{detail.riwayat_status.map((event) => <li key={event.seq}><span>{statusLabel[event.status_lama] ?? event.status_lama} menjadi {statusLabel[event.status_baru] ?? event.status_baru}</span><small>Entri {event.seq}, {formatTanggal(event.waktu)}</small>{event.catatan && <small>Catatan: {event.catatan}</small>}</li>)}</ol> : <p className="empty-state">Belum ada perubahan status setelah peringatan dibuat.</p>}
      </section>
    </>
  );
}

