"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, formatAngka, formatTanggal } from "@/lib/format";

type Row = { id: string; trx_id: string; jenis: string; kode_aturan: string[]; skor: number | null; status: string; dibuat_pada: string; kontrak_id: string | null };
type Result = { total: number; halaman: number; data: Row[] };
const statusOptions = ["baru", "ditelaah", "perlu_klarifikasi", "diklarifikasi", "ditindaklanjuti", "ditutup"];
const statusLabel: Record<string, string> = { baru: "Baru", ditelaah: "Ditelaah", perlu_klarifikasi: "Perlu klarifikasi", diklarifikasi: "Diklarifikasi", ditindaklanjuti: "Ditindaklanjuti", ditutup: "Ditutup" };

export default function PeringatanPage() {
  const [status, setStatus] = useState("");
  const [jenis, setJenis] = useState("");
  const [kontrak, setKontrak] = useState("");
  const [urut, setUrut] = useState("waktu");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    setPending(true); setError("");
    const query = new URLSearchParams({ halaman: String(page), per_halaman: "25", urut });
    if (status) query.set("status", status);
    if (jenis) query.set("jenis", jenis);
    if (kontrak.trim()) query.set("kontrak_id", kontrak.trim());
    try { setData(await api<Result>(`/api/peringatan?${query}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Daftar peringatan tidak dapat dimuat."); }
    finally { setPending(false); }
  }, [page, status, jenis, kontrak, urut]);
  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <header className="page-heading"><div><p className="eyebrow">Antrean pemeriksaan</p><h1>Peringatan</h1><p>Peringatan membantu menentukan urutan pemeriksaan. Setiap keputusan tetap dicatat oleh petugas.</p></div></header>
      <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(); }}>
        <div className="filter-control"><label htmlFor="filter-status">Status</label><select id="filter-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Semua status</option>{statusOptions.map((value) => <option key={value} value={value}>{statusLabel[value]}</option>)}</select></div>
        <div className="filter-control"><label htmlFor="filter-kind">Jenis</label><select id="filter-kind" value={jenis} onChange={(event) => { setJenis(event.target.value); setPage(1); }}><option value="">Semua jenis</option><option value="aturan">Aturan</option><option value="skor">Skor</option><option value="keduanya">Aturan dan skor</option></select></div>
        <div className="filter-control"><label htmlFor="filter-contract">ID kontrak</label><input id="filter-contract" value={kontrak} onChange={(event) => setKontrak(event.target.value)} placeholder="PRJ-0001-K01" /></div>
        <div className="filter-control"><label htmlFor="filter-order">Urutkan</label><select id="filter-order" value={urut} onChange={(event) => { setUrut(event.target.value); setPage(1); }}><option value="waktu">Waktu terbaru</option><option value="skor">Skor tertinggi</option></select></div>
        <button className="button button-primary" type="submit" disabled={pending}>Terapkan filter</button>
      </form>
      {error && <p className="error-state" role="alert">{error} Periksa koneksi Supabase, lalu coba lagi.</p>}
      {pending && !data && <p className="loading-state">Memuat daftar peringatan.</p>}
      {data && data.data.length === 0 && <p className="empty-state">Belum ada peringatan yang sesuai. Ubah filter atau periksa transaksi baru.</p>}
      {data && data.data.length > 0 && <>
        <div className="table-scroll"><table><thead><tr><th scope="col">Waktu</th><th scope="col">Kontrak</th><th scope="col">Jenis</th><th scope="col">Ringkasan alasan</th><th scope="col" className="num">Skor</th><th scope="col">Status</th></tr></thead>
          <tbody>{data.data.map((row) => <tr className="flagged" key={row.id}>
            <td><Link className="table-link" href={`/peringatan/${row.id}`}>{formatTanggal(row.dibuat_pada)}</Link></td>
            <td><Link className="table-link mono" href={`/peringatan/${row.id}`}>{row.kontrak_id ?? row.trx_id}</Link></td>
            <td>{row.jenis}</td><td>{row.kode_aturan?.length ? row.kode_aturan.join(", ") : "Pola transaksi perlu ditinjau"}</td>
            <td className="num">{row.skor === null ? "Tidak dihitung" : formatAngka(row.skor, 4)}</td>
            <td><span className="status-flag" data-status={row.status}>{statusLabel[row.status] ?? row.status}</span></td>
          </tr>)}</tbody>
        </table></div>
        <div className="pagination"><span>{data.total.toLocaleString("id-ID")} peringatan, halaman {data.halaman}</span><div className="button-row"><button className="button button-small" disabled={page <= 1 || pending} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</button><button className="button button-small" disabled={page * 25 >= data.total || pending} onClick={() => setPage((value) => value + 1)}>Berikutnya</button></div></div>
      </>}
    </>
  );
}

