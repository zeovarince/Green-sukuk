"use client";

import { useEffect, useState } from "react";
import { api, formatAngka } from "@/lib/format";

type RingkasPola = { terdeteksi_pct: number; median_posisi: number | null };
type RingkasTautan = { n: number; proyek_valid: number; kontrak_milik_proyek: number; hash_cocok: number; entri_ledger: number; gabungan: number };
type HasilPerusakan = { terdeteksi_pct: number; lokasi_tepat_pct: number };

type IrisanUjiKonsep = {
  kategori: string;
  tahun: number;
  alasan_pemilihan_tahun: string;
  n: number;
  anomali_total: number;
  pengujian: Record<string, { precision: number; recall: number; f1: number; far: number; peringatan_per_1000: number }>;
  recall_per_subtipe: Record<string, { n: number; aturan_saja: number; iforest_saja: number; hybrid: number }>;
  catatan?: string;
};

type Metrics = {
  dibuat_pada: string;
  seed_utama: number;
  ambang: { nilai: number; cara: string; ambang_iforest_saja: number };
  pengujian: Record<string, { precision: number; recall: number; f1: number; far: number; peringatan_per_1000: number }>;
  recall_per_subtipe: Record<string, { n: number; aturan_saja: number; iforest_saja: number; hybrid: number }>;
  false_alarm_normal_tidak_lazim_sah: { n: number; aturan_saja: number; iforest_saja: number; hybrid: number };
  beberapa_seed: { seed: number[]; f1_hybrid_rerata: number; f1_hybrid_sd: number; far_hybrid_rerata: number; far_hybrid_sd: number };
  latensi_ms: { lokal: number; vercel: number };
  waktu_deteksi_pola?: { jumlah_pola: number; aturan_saja: RingkasPola; iforest_saja: RingkasPola; hybrid: RingkasPola };
  kelengkapan_tautan?: RingkasTautan & { seluruh_data: RingkasTautan };
  biaya?: {
    ukuran_model_kb: number; waktu_latih_detik: number; waktu_inferensi_ms: number; waktu_verifikasi_penuh_detik: number;
    baris_transaksi: number; ukuran_transaksi_csv_kb: number; baris_ledger: number; ukuran_ledger_csv_kb: number; catatan?: string;
  };
  uji_perusakan?: Record<string, { hash_chain: HasilPerusakan; tabel_log: HasilPerusakan }>;
  irisan_uji_konsep?: IrisanUjiKonsep;
};

const names: Record<string, string> = { aturan_saja: "Aturan saja", iforest_saja: "Isolation Forest saja", hybrid: "Hybrid" };
const pct = (value: number) => `${formatAngka(value * 100, 2)}%`;
const persen = (value: number) => `${formatAngka(value, 2)}%`;

const tautanLabel: Record<string, string> = {
  proyek_valid: "Proyek terdaftar",
  kontrak_milik_proyek: "Kontrak milik proyek",
  hash_cocok: "Hash dokumen cocok",
  entri_ledger: "Punya entri ledger",
  gabungan: "Keempat syarat terpenuhi",
};

const perusakanLabel: Record<string, string> = {
  ubah: "Ubah payload satu entri",
  hapus: "Hapus satu entri",
  sisip: "Sisipkan entri palsu",
  tukar: "Tukar isi dua entri",
  hitung_ulang: "Hitung ulang seluruh rantai",
};

export default function EvaluasiPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<Metrics>("/api/metrik").then((value) => { if (active) setMetrics(value); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Hasil evaluasi tidak dapat dimuat."); });
    return () => { active = false; };
  }, []);

  const pola = metrics?.waktu_deteksi_pola;
  const tautan = metrics?.kelengkapan_tautan;
  const biaya = metrics?.biaya;
  const perusakan = metrics?.uji_perusakan;

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
      {metrics.irisan_uji_konsep && <section className="section rule-top">
        <div className="section-heading"><h2>Irisan uji konsep (REV-05, D-019)</h2><span className="provenance">{metrics.irisan_uji_konsep.kategori} &bull; Tahun {metrics.irisan_uji_konsep.tahun} (n = {metrics.irisan_uji_konsep.n.toLocaleString("id-ID")})</span></div>
        <p className="provenance">{metrics.irisan_uji_konsep.alasan_pemilihan_tahun}. Total anomali: {metrics.irisan_uji_konsep.anomali_total} kasus.</p>
        <div className="table-scroll"><table><thead><tr><th scope="col">Pendekatan</th><th scope="col" className="num">Precision</th><th scope="col" className="num">Recall</th><th scope="col" className="num">F1</th><th scope="col" className="num">Laju peringatan palsu</th><th scope="col" className="num">Peringatan per 1.000</th></tr></thead>
          <tbody>{Object.entries(metrics.irisan_uji_konsep.pengujian).map(([key, row]) => <tr key={key}><th scope="row">{names[key] ?? key}</th><td className="num">{formatAngka(row.precision, 4)}</td><td className="num">{formatAngka(row.recall, 4)}</td><td className="num">{formatAngka(row.f1, 4)}</td><td className="num">{pct(row.far)}</td><td className="num">{formatAngka(row.peringatan_per_1000, 2)}</td></tr>)}</tbody>
        </table></div>
        {metrics.irisan_uji_konsep.recall_per_subtipe && Object.keys(metrics.irisan_uji_konsep.recall_per_subtipe).length > 0 && <div className="table-scroll" style={{ marginTop: "1rem" }}><table className="subtype-table"><thead><tr><th scope="col">Subtipe anomali pada irisan</th><th scope="col" className="num">n</th><th scope="col" className="num">Aturan</th><th scope="col" className="num">Isolation Forest</th><th scope="col" className="num">Hybrid</th></tr></thead>
          <tbody>{Object.entries(metrics.irisan_uji_konsep.recall_per_subtipe).map(([key, row]) => <tr key={key}><th scope="row">{key.replaceAll("_", " ")}</th><td className="num">{row.n}</td><td className="num">{pct(row.aturan_saja)}</td><td className="num">{pct(row.iforest_saja)}</td><td className="num">{pct(row.hybrid)}</td></tr>)}</tbody>
        </table></div>}
        {metrics.irisan_uji_konsep.catatan && <p className="provenance" style={{ marginTop: 8 }}>{metrics.irisan_uji_konsep.catatan}</p>}
      </section>}
      <section className="section rule-top"><div className="section-heading"><h2>Kestabilan hasil</h2><span className="provenance">Seed {metrics.beberapa_seed.seed.join(", ")}</span></div>
        <div className="table-scroll"><table><thead><tr><th scope="col">Metrik hybrid</th><th scope="col" className="num">Rata-rata</th><th scope="col" className="num">Simpangan baku</th></tr></thead><tbody>
          <tr><th scope="row">F1</th><td className="num">{formatAngka(metrics.beberapa_seed.f1_hybrid_rerata, 4)}</td><td className="num">{formatAngka(metrics.beberapa_seed.f1_hybrid_sd, 4)}</td></tr>
          <tr><th scope="row">Laju peringatan palsu</th><td className="num">{pct(metrics.beberapa_seed.far_hybrid_rerata)}</td><td className="num">{pct(metrics.beberapa_seed.far_hybrid_sd)}</td></tr>
        </tbody></table></div>
      </section>
      {pola && <section className="section rule-top"><div className="section-heading"><h2>Deteksi pola beruntun</h2><span className="provenance">{pola.jumlah_pola} pola pada data pengujian</span></div>
        <p className="provenance">Pola adalah baris anomali bersubtipe pemecahan pencairan atau progres stagnan yang tetap cair, berurutan pada kontrak yang sama menurut ID transaksi. Posisi menandakan baris ke berapa dalam pola saat pendekatan pertama kali memberi peringatan.</p>
        <div className="table-scroll"><table><thead><tr><th scope="col">Pendekatan</th><th scope="col" className="num">Pola terdeteksi</th><th scope="col" className="num">Median posisi</th></tr></thead>
          <tbody>{(["aturan_saja", "iforest_saja", "hybrid"] as const).map((key) => { const row = pola[key]; return <tr key={key}><th scope="row">{names[key]}</th><td className="num">{persen(row.terdeteksi_pct)}</td><td className="num">{row.median_posisi === null ? "—" : row.median_posisi}</td></tr>; })}</tbody>
        </table></div>
      </section>}
      {tautan && <section className="section rule-top"><div className="section-heading"><h2>Kelengkapan tautan</h2><span className="provenance">n pengujian = {tautan.n.toLocaleString("id-ID")}, seluruh data = {tautan.seluruh_data.n.toLocaleString("id-ID")}</span></div>
        <p className="provenance">Bagian transaksi yang memenuhi tiap syarat penautan. Angka ini mengukur kelengkapan data simulasi, bukan keterlacakan di dunia nyata.</p>
        <div className="table-scroll"><table><thead><tr><th scope="col">Syarat</th><th scope="col" className="num">Data pengujian</th><th scope="col" className="num">Seluruh data</th></tr></thead>
          <tbody>{(["proyek_valid", "kontrak_milik_proyek", "hash_cocok", "entri_ledger", "gabungan"] as const).map((key) => <tr key={key}><th scope="row">{tautanLabel[key]}</th><td className="num">{pct(tautan[key])}</td><td className="num">{pct(tautan.seluruh_data[key])}</td></tr>)}</tbody>
        </table></div>
      </section>}
      <section className="section rule-top"><div className="section-heading"><h2>Kasus sah yang tampak janggal</h2><span className="provenance">n = {metrics.false_alarm_normal_tidak_lazim_sah.n.toLocaleString("id-ID")}</span></div>
        <p>Bagian kelompok normal tidak lazim yang mendapat peringatan: aturan {pct(metrics.false_alarm_normal_tidak_lazim_sah.aturan_saja)}, Isolation Forest {pct(metrics.false_alarm_normal_tidak_lazim_sah.iforest_saja)}, hybrid {pct(metrics.false_alarm_normal_tidak_lazim_sah.hybrid)}. Angka ini menunjukkan beban telaah pada transaksi sah yang dirancang tampak tidak biasa.</p>
      </section>
      <section className="section rule-top"><div className="section-heading"><h2>Biaya dan latensi</h2><span className="provenance">Ukuran berkas dan waktu terukur</span></div>
        {biaya ? <div className="table-scroll"><table><thead><tr><th scope="col">Ukuran</th><th scope="col" className="num">Nilai</th></tr></thead><tbody>
          <tr><th scope="row">Ukuran model Isolation Forest</th><td className="num">{formatAngka(biaya.ukuran_model_kb, 2)} KB</td></tr>
          <tr><th scope="row">Waktu latih model</th><td className="num">{formatAngka(biaya.waktu_latih_detik, 3)} detik</td></tr>
          <tr><th scope="row">Latensi inferensi per transaksi</th><td className="num">{formatAngka(biaya.waktu_inferensi_ms, 3)} ms</td></tr>
          <tr><th scope="row">Waktu verifikasi rantai penuh</th><td className="num">{formatAngka(biaya.waktu_verifikasi_penuh_detik, 3)} detik</td></tr>
          <tr><th scope="row">Baris transaksi</th><td className="num">{biaya.baris_transaksi.toLocaleString("id-ID")}</td></tr>
          <tr><th scope="row">Ukuran CSV transaksi</th><td className="num">{formatAngka(biaya.ukuran_transaksi_csv_kb, 2)} KB</td></tr>
          <tr><th scope="row">Baris ledger</th><td className="num">{biaya.baris_ledger.toLocaleString("id-ID")}</td></tr>
          <tr><th scope="row">Ukuran CSV ledger</th><td className="num">{formatAngka(biaya.ukuran_ledger_csv_kb, 2)} KB</td></tr>
        </tbody></table></div> : <p className="provenance">Rincian biaya belum ada pada berkas hasil ini.</p>}
        <dl className="definition-list" style={{ marginTop: "1rem" }}><dt>Inferensi lokal</dt><dd>{formatAngka(metrics.latensi_ms.lokal, 2)} ms per transaksi, sesuai hasil eksperimen tersimpan.</dd><dt>Inferensi di Vercel</dt><dd>{metrics.latensi_ms.vercel > 0 ? `${formatAngka(metrics.latensi_ms.vercel, 2)} ms per transaksi` : "Belum diukur pada deployment publik."}</dd></dl>
        <p className="provenance">Latensi route <code>/api/periksa</code> (server dan total klien) diukur terpisah memakai <code>ml/ukur_latensi.py</code> terhadap URL publik. Pengukuran itu mencatat lokasi, tanggal, dan region, dan tidak diwakili oleh satu hari pengukuran. {biaya?.catatan ?? ""}</p>
      </section>
      {perusakan && <section className="section rule-top"><div className="section-heading"><h2>Uji perusakan ledger</h2><span className="provenance">Hash-chain dibanding tabel log biasa</span></div>
        <p className="provenance">Tiap skenario dijalankan berulang pada salinan ledger lokal. Tabel log biasa tidak memiliki hash, sehingga tidak mendeteksi perubahan apa pun. Hitung ulang seluruh rantai dan pemotongan entri terakhir tidak terdeteksi tanpa hash jangkar di luar basis data.</p>
        <div className="table-scroll"><table><thead><tr><th scope="col">Skenario</th><th scope="col" className="num">Hash-chain terdeteksi</th><th scope="col" className="num">Lokasi tepat</th><th scope="col" className="num">Tabel log terdeteksi</th></tr></thead>
          <tbody>{(["ubah", "hapus", "sisip", "tukar", "hitung_ulang"] as const).map((key) => { const row = perusakan[key]; return <tr key={key}><th scope="row">{perusakanLabel[key]}</th><td className="num">{persen(row.hash_chain.terdeteksi_pct)}</td><td className="num">{persen(row.hash_chain.lokasi_tepat_pct)}</td><td className="num">{persen(row.tabel_log.terdeteksi_pct)}</td></tr>; })}</tbody>
        </table></div>
      </section>}

      <p className="info-note">Hasil ini berasal dari generator dan skenario yang dirancang penulis. Hybrid tidak memiliki F1 tertinggi pada seed utama dan memberi laju peringatan palsu lebih besar. Angka ini belum membuktikan kinerja pada data riil.</p>
    </>}
  </>;
}
