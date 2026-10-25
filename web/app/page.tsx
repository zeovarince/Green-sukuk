"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DoubleCurve, { type CurveRow } from "@/components/DoubleCurve";
import { api, formatAngka, formatRingkas } from "@/lib/format";

type Summary = { total_transaksi: number; total_kontrak: number; peringatan_baru: number; entri_ledger_terakhir: { seq: number; hash_saat_ini: string } | null; model: { versi_model: string; ambang: number } };
type AlertItem = { id: string; trx_id: string; jenis: string; kode_aturan: string[]; skor: number | null; status: string; dibuat_pada: string; kontrak_id: string | null };
type Contract = { kontrak: { kontrak_id: string; nilai_kontrak_awal: number; pagu_alokasi: number }; riwayat: CurveRow[] };

export default function HomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [contract, setContract] = useState<Contract | null>(null);
  const [chain, setChain] = useState<{ valid: boolean; entri_diperiksa: number } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sum, queue] = await Promise.all([
          api<Summary>("/api/ringkasan"),
          api<{ data: AlertItem[] }>("/api/peringatan?status=baru&per_halaman=8&urut=waktu"),
        ]);
        if (cancelled) return;
        setSummary(sum); setAlerts(queue.data);
        if (sum.entri_ledger_terakhir) {
          api<{ valid: boolean; entri_diperiksa: number }>(`/api/ledger/verifikasi?dari_seq=${sum.entri_ledger_terakhir.seq}&sampai_seq=${sum.entri_ledger_terakhir.seq}`).then((value) => { if (!cancelled) setChain(value); });
        }
        const id = queue.data.find((item) => item.kontrak_id)?.kontrak_id;
        if (id) {
          const response = await api<Contract>(`/api/kontrak/${encodeURIComponent(id)}`);
          if (!cancelled) setContract(response);
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Ringkasan belum dapat dimuat."); }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const marked = alerts.map((item) => item.trx_id);
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Ringkasan pemantauan alokasi</p>
          <h1>{contract?.kontrak.kontrak_id ?? "Pencairan dan progres fisik"}</h1>
          <p>Pencairan kumulatif dibandingkan dengan progres pekerjaan pada kontrak yang memiliki peringatan terbaru.</p>
        </div>
        <Link className="button button-primary heading-action" href="/periksa">Periksa transaksi</Link>
      </header>

      {error && <p className="error-state" role="alert">{error} Periksa koneksi Supabase dan muat ulang halaman.</p>}
      <div className="metric-strip" aria-label="Angka ringkasan">
        <div className="metric"><span className="metric-label">Transaksi tercatat</span><strong className="metric-value">{summary ? new Intl.NumberFormat("id-ID").format(summary.total_transaksi) : "…"}</strong></div>
        <div className="metric"><span className="metric-label">Peringatan baru</span><strong className="metric-value">{summary ? new Intl.NumberFormat("id-ID").format(summary.peringatan_baru) : "…"}</strong></div>
        <div className="metric"><span className="metric-label">Kontrak terdaftar</span><strong className="metric-value">{summary ? new Intl.NumberFormat("id-ID").format(summary.total_kontrak) : "…"}</strong></div>
        <div className="metric"><span className="metric-label">Pemeriksaan ledger terakhir</span><strong className="metric-value" style={{ fontSize: 19 }}>{chain ? chain.valid ? `Seq ${summary?.entri_ledger_terakhir?.seq}: konsisten` : "Perlu ditinjau" : "Belum diperiksa"}</strong></div>
      </div>

      <div className="dashboard-grid">
        <section aria-labelledby="chart-title">
          <div className="section-heading"><h2 id="chart-title">Pencairan dan progres fisik</h2><span className="provenance">Kurva menggunakan riwayat kontrak</span></div>
          <DoubleCurve rows={contract?.riwayat ?? []} nilaiKontrak={Number(contract?.kontrak.nilai_kontrak_awal ?? 0)} flagged={marked} />
          {contract && <dl className="measure-list" style={{ marginTop: 16 }}>
            <div><span>Nilai kontrak</span><strong>{formatRingkas(contract.kontrak.nilai_kontrak_awal)}</strong></div>
            <div><span>Pagu alokasi</span><strong>{formatRingkas(contract.kontrak.pagu_alokasi)}</strong></div>
            <div><span>Pencairan kumulatif</span><strong>{formatRingkas(contract.riwayat.at(-1)?.kumulatif_cair)}</strong></div>
          </dl>}
          {summary && <p className="provenance" style={{ marginTop: 16 }}>Model {summary.model.versi_model}, ambang skor {formatAngka(summary.model.ambang, 4)}. Data berasal dari simulasi.</p>}
        </section>

        <aside aria-labelledby="queue-title">
          <div className="section-heading"><h2 id="queue-title">Antrean peringatan</h2><Link href="/peringatan">Semua peringatan</Link></div>
          {alerts.length ? <div className="alert-queue">
            {alerts.map((item) => <Link className="alert-row" href={`/peringatan/${item.id}`} key={item.id}>
              <strong>{item.kontrak_id ?? item.trx_id}</strong><span className="alert-score">{item.skor === null ? "Aturan" : formatAngka(item.skor, 3)}</span>
              <small>{item.kode_aturan?.length ? item.kode_aturan.join(", ") : item.jenis}</small><small>{item.status}</small>
            </Link>)}
          </div> : <p className="empty-state">Belum ada peringatan. Periksa transaksi baru untuk memulai.</p>}
          <div className="button-row" style={{ marginTop: 18 }}><Link className="button" href="/ledger">Buka ledger</Link><Link className="button" href="/evaluasi">Lihat evaluasi</Link></div>
        </aside>
      </div>

      <section className="section rule-top">
        <div className="section-heading"><h2>Alur pemeriksaan</h2><Link href="/tentang">Cara kerja GSTP</Link></div>
        <div className="workflow" aria-label="Alur kerja lima langkah">
          {["Registri", "Aturan", "Skor", "Peringatan", "Ledger"].map((label, index) => <div className="workflow-step" key={label}>
            <span className="provenance">Langkah {index + 1}</span><strong>{label}</strong>
            <p>{["Cocokkan proyek dan kontrak.", "Periksa tujuh ketentuan.", "Nilai transaksi yang lolos aturan.", "Urutkan transaksi yang perlu ditinjau.", "Catat perubahan dalam hash-chain."][index]}</p>
          </div>)}
        </div>
      </section>
    </>
  );
}

