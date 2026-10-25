"use client";

import { useEffect, useState } from "react";
import { api, formatAngka } from "@/lib/format";

type Metrics = {
  dibuat_pada: string;
  seed_utama: number;
  ambang: { nilai: number; cara: string; ambang_iforest_saja: number };
  pengujian: Record<string, { precision: number; recall: number; f1: number; far: number; peringatan_per_1000: number }>;
  recall_per_subtipe: Record<string, { n: number; aturan_saja: number; iforest_saja: number; hybrid: number }>;
  false_alarm_normal_tidak_lazim_sah: { n: number; aturan_saja: number; iforest_saja: number; hybrid: number };
  beberapa_seed: { seed: number[]; f1_hybrid_rerata: number; f1_hybrid_sd: number; far_hybrid_rerata: number; far_hybrid_sd: number };
  latensi_ms: { lokal: number; vercel: number };
};

const names: Record<string, string> = { aturan_saja: "Aturan saja", iforest_saja: "Isolation Forest saja", hybrid: "Hybrid" };
const pct = (value: number) => `${formatAngka(value * 100, 2)}%`;

export default function EvaluasiPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<Metrics>("/api/metrik").then((value) => { if (active) setMetrics(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Hasil evaluasi tidak dapat dimuat."); });
    return () => { active = false; };
  }, []);

  return <>
    <header className="page-heading"><div><p className="eyebrow">Hasil pengujian</p><h1>Evaluasi</h1><p>Perbandingan dihitung pada data pengujian simulasi. Anomali disuntikkan, dan sebagian kelompok kontekstual dirancang lolos dari aturan.</p></div></header>
    {error && <p className="error-state" role="alert">{error} Muat ulang halaman setelah layanan tersedia.</p>}
    {!metrics && !error && <p className="loading-state">Memuat hasil evaluasi.</p>}
    {metrics && <>
      <div className="metric-strip" aria-label="Metadata evaluasi">
        <div className="metric"><span className="metric-label">Tanggal hasil</span><strong className="metric-value metric-value-small">{metrics.dibuat_pada}</strong></div>
        <div className="metric"><span className="metric-label">Seed utama</span><strong className="metric-value">{metrics.seed_utama}</strong></div>
        <div className="metric"><span className="metric-label">Ambang hybrid</span><strong className="metric-value">{formatAngka(metrics.ambang.nilai, 4)}</strong></div>
        <div className="metric"><span className="metric-label">Versi data</span><strong className="metric-value metric-value-small">Simulasi GSTP</strong></div>
      </div>
      <section className="section rule-top">
        <div className="section-heading"><h2>Metrik data pengujian</h2><span className="provenance">Ambang Isolation Forest: {formatAngka(metrics.ambang.ambang_iforest_saja, 4)}</span></div>
        <p className="provenance">Ambang hybrid ditentukan pada data validasi dengan batas laju peringatan palsu 2 persen. {metrics.ambang.cara}</p>
        <div className="table-scroll"><table><thead><tr><th scope="col">Pendekatan</th><th scope="col" className="num">Precision</th><th scope="col" className="num">Recall</th><th scope="col" className="num">F1</th><th scope="col" className="num">Laju peringatan palsu</th><th scope="col" className="num">Peringatan per 1.000</th></tr></thead>
          <tbody>{Object.entries(metrics.pengujian).map(([key, row]) => <tr key={key}><th scope="row">{names[key] ?? key}</th><td className="num">{formatAngka(row.precision, 4)}</td><td className="num">{formatAngka(row.recall, 4)}</td><td className="num">{formatAngka(row.f1, 4)}</td><td className="num">{pct(row.far)}</td><td className="num">{formatAngka(row.peringatan_per_1000, 2)}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section className="section rule-top"><div className="section-heading"><h2>Recall per subtipe</h2><span className="provenance">n adalah jumlah kasus pada data pengujian</span></div>
        <div className="table-scroll"><table className="subtype-table"><thead><tr><th scope="col">Subtipe</th><th scope="col" className="num">n</th><th scope="col" className="num">Aturan</th><th scope="col" className="num">Isolation Forest</th><th scope="col" className="num">Hybrid</th></tr></thead>
          <tbody>{Object.entries(metrics.recall_per_subtipe).map(([key, row]) => <tr key={key}><th scope="row">{key.replaceAll("_", " ")}</th><td className="num">{row.n}</td><td className="num">{pct(row.aturan_saja)}</td><td className="num">{pct(row.iforest_saja)}</td><td className="num">{pct(row.hybrid)}</td></tr>)}</tbody>
        </table></div>
      </section>
      <section className="section rule-top"><div className="section-heading"><h2>Kestabilan hasil</h2><span className="provenance">Seed {metrics.beberapa_seed.seed.join(", ")}</span></div>
        <div className="table-scroll"><table><thead><tr><th scope="col">Metrik hybrid</th><th scope="col" className="num">Rata-rata</th><th scope="col" className="num">Simpangan baku</th></tr></thead><tbody>
          <tr><th scope="row">F1</th><td className="num">{formatAngka(metrics.beberapa_seed.f1_hybrid_rerata, 4)}</td><td className="num">{formatAngka(metrics.beberapa_seed.f1_hybrid_sd, 4)}</td></tr>
          <tr><th scope="row">Laju peringatan palsu</th><td className="num">{pct(metrics.beberapa_seed.far_hybrid_rerata)}</td><td className="num">{pct(metrics.beberapa_seed.far_hybrid_sd)}</td></tr>
        </tbody></table></div>
      </section>
      <section className="section rule-top"><div className="section-heading"><h2>Kasus sah yang tampak janggal</h2><span className="provenance">n = {metrics.false_alarm_normal_tidak_lazim_sah.n.toLocaleString("id-ID")}</span></div>
        <p>Bagian kelompok normal tidak lazim yang mendapat peringatan: aturan {pct(metrics.false_alarm_normal_tidak_lazim_sah.aturan_saja)}, Isolation Forest {pct(metrics.false_alarm_normal_tidak_lazim_sah.iforest_saja)}, hybrid {pct(metrics.false_alarm_normal_tidak_lazim_sah.hybrid)}. Angka ini menunjukkan beban telaah pada transaksi sah yang dirancang tampak tidak biasa.</p>
      </section>
      <section className="section rule-top"><div className="section-heading"><h2>Waktu pemrosesan</h2><span className="provenance">Inferensi model satu transaksi</span></div>
        <dl className="definition-list"><dt>Pengukuran lokal</dt><dd>{formatAngka(metrics.latensi_ms.lokal, 2)} ms per transaksi, sesuai hasil eksperimen tersimpan.</dd><dt>Vercel</dt><dd>{metrics.latensi_ms.vercel > 0 ? `${formatAngka(metrics.latensi_ms.vercel, 2)} ms per transaksi` : "Belum diukur pada deployment publik."}</dd></dl>
      </section>
      <p className="info-note">Hasil ini berasal dari generator dan skenario yang dirancang penulis. Hybrid tidak memiliki F1 tertinggi pada seed utama dan memberi laju peringatan palsu lebih besar. Angka ini belum membuktikan kinerja pada data riil.</p>
    </>}
  </>;
}
