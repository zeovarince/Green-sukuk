"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DoubleCurve, { type CurveRow } from "@/components/DoubleCurve";
import { api, formatAngka, formatRingkas, formatRupiah, formatTanggal } from "@/lib/format";

type ContractData = {
  kontrak: { kontrak_id: string; project_id: string; nilai_kontrak_awal: number; pagu_alokasi: number; tanggal_mulai: string; durasi_bulan: number; uang_muka_pct: number; retensi_pct: number };
  proyek: { nama_proyek: string; kategori_hijau: string; kementerian_pelaksana: string; seri_penerbitan: string; akad: string } | null;
  riwayat: (CurveRow & { jenis_pembayaran: string; kumulatif_cair: number })[];
};
type WarningResponse = { data: { id: string; trx_id: string; kode_aturan: string[]; skor: number | null; status: string }[] };
const statusLabel: Record<string, string> = { baru: "Baru", ditelaah: "Ditelaah", perlu_klarifikasi: "Perlu klarifikasi", diklarifikasi: "Diklarifikasi", ditindaklanjuti: "Ditindaklanjuti", ditutup: "Ditutup" };

export default function KontrakPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [data, setData] = useState<ContractData | null>(null);
  const [warnings, setWarnings] = useState<WarningResponse["data"]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void params.then(({ id: value }) => setId(value)); }, [params]);
  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([
      api<ContractData>(`/api/kontrak/${encodeURIComponent(id)}`),
      api<WarningResponse>(`/api/peringatan?kontrak_id=${encodeURIComponent(id)}&per_halaman=100&urut=waktu`),
    ]).then(([contract, alerts]) => { if (active) { setData(contract); setWarnings(alerts.data); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Riwayat kontrak tidak dapat dimuat."); });
    return () => { active = false; };
  }, [id]);

  if (error) return <><header className="page-heading"><div><p className="eyebrow">Riwayat pencairan</p><h1>Kontrak</h1></div></header><p className="error-state" role="alert">{error} Periksa ID kontrak dan koneksi database.</p><Link className="button" href="/periksa">Pilih kontrak di halaman pemeriksaan</Link></>;
  if (!data) return <><header className="page-heading"><div><p className="eyebrow">Riwayat pencairan</p><h1>Memuat kontrak</h1></div></header><p className="loading-state">Memuat data kontrak dan pencairan.</p></>;

  const flagged = new Set(warnings.map((item) => item.trx_id));
  const latest = data.riwayat.at(-1);
  return <>
    <header className="page-heading"><div><p className="eyebrow">Riwayat pencairan</p><h1>{data.kontrak.kontrak_id}</h1><p>{data.proyek?.nama_proyek ?? data.kontrak.project_id}. {data.proyek?.kementerian_pelaksana ?? "Pelaksana tidak tersedia"}.</p></div><Link className="button button-primary heading-action" href={`/periksa?kontrak=${encodeURIComponent(data.kontrak.kontrak_id)}`}>Periksa transaksi</Link></header>
    <dl className="measure-list"><div><span>Nilai kontrak</span><strong>{formatRingkas(data.kontrak.nilai_kontrak_awal)}</strong></div><div><span>Pagu alokasi</span><strong>{formatRingkas(data.kontrak.pagu_alokasi)}</strong></div><div><span>Kumulatif pencairan</span><strong>{formatRingkas(latest?.kumulatif_cair ?? 0)}</strong></div><div><span>Progres terakhir</span><strong>{latest ? `${formatAngka(latest.progres_fisik_pct)}%` : "Belum ada pencairan"}</strong></div></dl>
    <section className="section rule-top"><div className="section-heading"><h2>Pencairan dan progres</h2><span className="provenance">Nilai pencairan sebagai bagian dari nilai kontrak</span></div><DoubleCurve rows={data.riwayat} nilaiKontrak={Number(data.kontrak.nilai_kontrak_awal)} flagged={[...flagged]} /></section>
    <section className="section rule-top"><div className="section-heading"><h2>Daftar pencairan</h2><span className="provenance">{data.riwayat.length.toLocaleString("id-ID")} transaksi</span></div>
      {data.riwayat.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Tanggal</th><th scope="col">Jenis pembayaran</th><th scope="col" className="num">Pencairan</th><th scope="col" className="num">Progres</th><th scope="col" className="num">Kumulatif</th><th scope="col">Pemeriksaan</th></tr></thead><tbody>{data.riwayat.map((row) => {
        const alert = warnings.find((item) => item.trx_id === row.trx_id);
        return <tr key={row.trx_id} className={alert ? "flagged" : undefined}><td>{formatTanggal(row.tanggal)}</td><td>{row.jenis_pembayaran}</td><td className="num">{formatRupiah(row.nilai_pencairan)}</td><td className="num">{formatAngka(row.progres_fisik_pct)}%</td><td className="num">{formatRupiah(row.kumulatif_cair)}</td><td>{alert ? <Link href={`/peringatan/${alert.id}`}>Peringatan: {statusLabel[alert.status] ?? alert.status}</Link> : "Tidak ada peringatan"}</td></tr>;
      })}</tbody></table></div> : <p className="empty-state">Belum ada pencairan untuk kontrak ini.</p>}
    </section>
    <section className="section rule-top"><div className="section-heading"><h2>Informasi kontrak</h2><span className="provenance">Data simulasi</span></div><dl className="definition-list"><dt>Project ID</dt><dd>{data.kontrak.project_id}</dd><dt>Kategori hijau</dt><dd>{data.proyek?.kategori_hijau ?? "Tidak tersedia"}</dd><dt>Seri penerbitan</dt><dd>{data.proyek?.seri_penerbitan ?? "Tidak tersedia"}</dd><dt>Akad</dt><dd>{data.proyek?.akad ?? "Tidak tersedia"}</dd><dt>Tanggal mulai</dt><dd>{formatTanggal(data.kontrak.tanggal_mulai)}</dd><dt>Durasi</dt><dd>{data.kontrak.durasi_bulan} bulan</dd></dl></section>
  </>;
}
