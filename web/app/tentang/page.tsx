"use client";

import Link from "next/link";
import { labelPrinsip, prinsipUntuk } from "@/lib/aturan";

const flow = [
  ["Registri", "Data proyek, kategori hijau, pagu, dan kontrak."],
  ["Pemeriksaan", "Delapan aturan menilai syarat administratif, batas transaksi, dan kesesuaian akad syariah."],
  ["Skor", "Isolation Forest menilai pola transaksi yang lolos aturan."],
  ["Tindak lanjut", "Petugas menelaah peringatan, menambah catatan, dan menentukan langkah."],
  ["Ledger", "Hash-chain menyimpan transaksi dan perubahan status untuk diverifikasi."],
];

const aturanInfo: { kode: string; nama: string; kondisi: string }[] = [
  { kode: "R01_ID_PROYEK", nama: "ID proyek tidak valid", kondisi: "ID proyek tidak ada di registri atau tidak sesuai kontrak." },
  { kode: "R02_PAGU", nama: "Melebihi pagu", kondisi: "Pencairan kumulatif melebihi pagu alokasi kontrak." },
  { kode: "R03_PERSETUJUAN", nama: "Persetujuan kurang", kondisi: "Persetujuan yang diperoleh di bawah jumlah yang diwajibkan." },
  { kode: "R04_KATEGORI", nama: "Kategori tidak memenuhi syarat", kondisi: "Kategori hijau tidak ada di daftar kategori sah." },
  { kode: "R05_HASH", nama: "Hash dokumen tidak cocok", kondisi: "Hash saat ini berbeda dari hash yang tercatat." },
  { kode: "R06_MILESTONE", nama: "Milestone belum terverifikasi", kondisi: "Pembayaran termin diajukan tanpa milestone terverifikasi." },
  { kode: "R07_BUKTI", nama: "Bukti tidak lengkap", kondisi: "Kelengkapan bukti di bawah ambang 0,80." },
  { kode: "R08_AKAD", nama: "Akad tidak sesuai", kondisi: "Akad pencairan berbeda dari akad yang terdaftar pada registri proyek." },
];

export default function TentangPage() {
  return <>
    <header className="page-heading"><div><p className="eyebrow">Ruang lingkup prototipe</p><h1>Tentang GSTP</h1><p>Green Sukuk Traceability Protocol membantu mengurutkan transaksi yang perlu diperiksa dengan aturan, skor anomali, dan catatan perubahan.</p></div></header>
    <section className="section rule-top"><div className="section-heading"><h2>Alur data</h2><span className="provenance">Prototipe tahap awal</span></div><div className="workflow" aria-label="Alur pemeriksaan lima langkah">{flow.map(([title, description], index) => <div className="workflow-step" key={title}><span className="provenance">Langkah {index + 1}</span><strong>{title}</strong><p>{description}</p></div>)}</div><p className="info-note">Sistem membaca data melalui API. Skor membantu menentukan prioritas dan tidak menggantikan pemeriksaan pejabat berwenang.</p></section>
    <section className="section rule-top"><div className="section-heading"><h2>Aturan dan prinsipnya</h2><span className="provenance">Pemetaan usulan penulis</span></div><div className="table-scroll"><table><thead><tr><th scope="col">Kode</th><th scope="col">Aturan</th><th scope="col">Prinsip</th><th scope="col">Kondisi pelanggaran</th></tr></thead><tbody>
      {aturanInfo.map((aturan) => <tr key={aturan.kode}><th scope="row"><code>{aturan.kode}</code></th><td>{aturan.nama}</td><td><span className="principle-tag" data-prinsip={prinsipUntuk(aturan.kode)}>{labelPrinsip(prinsipUntuk(aturan.kode))}</span></td><td>{aturan.kondisi}</td></tr>)}
    </tbody></table></div><p className="provenance">Tag prinsip adalah label untuk membaca temuan, bukan penilaian syariah. Penilaian kesesuaian syariah berada pada otoritas syariah.</p></section>
    <section className="section rule-top"><div className="section-heading"><h2>Model kerja Pentahelix</h2><span className="provenance">Rancangan tata kelola, belum menjadi peran aplikasi</span></div><div className="table-scroll"><table><thead><tr><th scope="col">Pihak</th><th scope="col">Fungsi dalam rancangan</th><th scope="col">Status prototipe</th></tr></thead><tbody>
      <tr><th scope="row">Pemerintah dan pelaksana</th><td>Menetapkan program, pagu, kontrak, dan bukti pelaksanaan.</td><td>Data simulasi</td></tr>
      <tr><th scope="row">Akademisi</th><td>Mengkaji metode, metrik, dan rancangan evaluasi.</td><td>Dokumentasi dan eksperimen lokal</td></tr>
      <tr><th scope="row">Dunia usaha</th><td>Melaksanakan pekerjaan dan mengirimkan bukti serta progres.</td><td>Tidak terintegrasi</td></tr>
      <tr><th scope="row">Masyarakat</th><td>Memberi masukan dan menggunakan informasi yang dapat dibuka.</td><td>Tidak ada portal publik</td></tr>
      <tr><th scope="row">BPK dan otoritas syariah</th><td>Melakukan pengawasan sesuai kewenangan, terpisah dari persetujuan operasional.</td><td>Disimulasikan lewat kode akses: otoritas syariah menelaah temuan akad R08, auditor menelaah peringatan, pejabat berwenang menetapkan tindak lanjut (tanpa sistem akun pengguna individu)</td></tr>
    </tbody></table></div></section>
    <section className="section rule-top"><div className="section-heading"><h2>Keterbatasan</h2><span className="provenance">Ruang lingkup yang sudah dibangun</span></div><ul className="finding-list">
      <li>Semua data dan label anomali dibuat melalui generator. Tidak ada data transaksi pemerintah atau data pribadi.</li>
      <li>Anomali kontekstual dirancang lolos dari aturan. Hybrid pada seed utama tidak memiliki F1 tertinggi dan memberi peringatan palsu lebih banyak.</li>
      <li>Ledger berupa hash-chain di satu database Postgres. Perubahan dapat terdeteksi saat verifikasi, tetapi tidak dicegah dan tidak memiliki konsensus antar lembaga.</li>
      <li>Dokumen asli dan enkripsi dokumen belum dibangun. Pemisahan peran baru disimulasikan lewat kode akses tanpa pembuktian identitas login pengguna.</li>
      <li>Pembatasan laju API berada di memori tiap instance. Pengujian beban dan keamanan formal belum dilakukan.</li>
      <li>Latensi pada Vercel dan skenario demo di URL publik belum diukur.</li>
    </ul><p className="provenance">Rincian serta teks yang disiapkan untuk esai ada di <Link href="/ringkasan">ringkasan proyek</Link> dan dokumen <code>docs/LIMITATIONS.md</code>.</p></section>
  </>;
}
