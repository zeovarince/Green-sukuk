"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type { LandingData, MetricRow } from "@/lib/landing/data";
import LandingKanvas from "./LandingKanvas";
import { useKemajuanScroll } from "./PenggerakScroll";
import RelBab from "./RelBab";

function angka(value: number, digits = 2): string {
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function persen(value: number): string {
  return `${angka(value * 100, 2)}%`;
}

const BARIS_HASIL: { key: keyof LandingData["evaluation"]["pengujian"]; nama: string }[] = [
  { key: "aturan_saja", nama: "Aturan saja" },
  { key: "iforest_saja", nama: "Isolation Forest saja" },
  { key: "hybrid", nama: "Hybrid" },
];

function MetrikHasil({ row }: { row: MetricRow }) {
  return <><td className="num">{angka(row.precision, 4)}</td><td className="num">{angka(row.recall, 4)}</td><td className="num">{angka(row.f1, 4)}</td><td className="num">{persen(row.far)}</td><td className="num">{angka(row.peringatan_per_1000, 2)}</td></>;
}

export default function LandingStory({ data }: { data: LandingData }) {
  const story = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [activeChapter, setActiveChapter] = useState(0);
  const previousProgress = useRef(-1);
  const onProgress = useCallback((value: number) => {
    if (Math.abs(value - previousProgress.current) < 0.002) return;
    previousProgress.current = value;
    setProgress(value);
    const chapter = value < 0.14 ? 0 : value < 0.34 ? 1 : value < 0.54 ? 2 : value < 0.7 ? 3 : value < 0.84 ? 4 : value < 0.94 ? 5 : 6;
    setActiveChapter(chapter);
  }, []);
  useKemajuanScroll(story, onProgress);

  const evaluation = data.evaluation;
  const normalOdd = evaluation.false_alarm_normal_tidak_lazim_sah;
  const seeds = evaluation.beberapa_seed;

  return (
    <div className="landing-story" ref={story}>
      <div className="landing-stage-sticky">
        <LandingKanvas data={data} progress={progress} />
        <RelBab active={activeChapter} />
        <Link className={`landing-quick-cta${progress >= 0.34 && progress < 0.94 ? " is-visible" : ""}`} href="/periksa">Periksa transaksi</Link>
        <span className="landing-scene-caption">Gambar simulasi, seed {data.cloud.seed}</span>
      </div>

      <div className="landing-chapters">
        <section id="bab-0" className="landing-chapter">
          <div className="landing-copy landing-copy-wide">
            <p className="eyebrow">Green Sukuk Traceability Protocol</p>
            <h1>Memeriksa apakah dana Green Sukuk dicairkan sejalan dengan kemajuan proyek.</h1>
            <p>GSTP membandingkan pencairan dengan progres fisik, menandai transaksi yang perlu ditinjau, dan mencatat langkah pemeriksaan dalam rantai yang bisa diverifikasi.</p>
            <p className="landing-data-label"><span className="simulation-flag"><span aria-hidden="true" />Data simulasi</span> Prototipe lokal, bukan layanan audit resmi.</p>
          </div>
        </section>

        <section id="bab-1" className="landing-chapter">
          <div className="landing-copy">
            <p className="eyebrow">01 / Pencairan dan progres</p>
            <h2>Dua kurva menunjukkan selisih yang perlu dilihat.</h2>
            <p>Pada kontrak contoh {data.curve.kontrak_id}, pencairan kumulatif mendahului progres fisik {angka(data.curve.ditandai.selisih_poin, 2)} poin persentase di titik yang ditandai. Ini sinyal telaah, bukan bukti pelanggaran.</p>
            <div className="landing-key"><span className="key-progress">Progres fisik</span><span className="key-cash">Pencairan kumulatif</span><span className="key-flag">Titik contoh</span></div>
          </div>
        </section>

        <section id="bab-2" className="landing-chapter">
          <div className="landing-copy">
            <p className="eyebrow">02 / Transaksi simulasi</p>
            <h2>Setiap titik mewakili satu transaksi.</h2>
            <p>{data.cloud.total.toLocaleString("id-ID")} transaksi dibuat untuk simulasi, termasuk {data.cloud.anomali.toLocaleString("id-ID")} anomali sintetis. Awan di samping adalah sampel visual berstrata sebanyak {data.cloud.n_sampel.toLocaleString("id-ID")} titik.</p>
            <p className="info-note warning-note">Proporsi anomali dalam sampel visual lebih tinggi daripada data sumber agar pola terlihat. Sampel ini tidak menunjukkan proporsi kejadian nyata.</p>
            <p className="landing-legend"><span className="landing-dot" /> Perlu ditinjau <span className="landing-dot landing-dot-muted" /> Transaksi lain</p>
            <div className="table-scroll landing-small-table"><table><thead><tr><th scope="col">Ringkasan sampel</th><th scope="col" className="num">Jumlah / proporsi</th></tr></thead><tbody>
              <tr><th scope="row">Transaksi sumber</th><td className="num">{data.cloud.total.toLocaleString("id-ID")}</td></tr>
              <tr><th scope="row">Anomali sintetis di sumber</th><td className="num">{data.cloud.anomali.toLocaleString("id-ID")}</td></tr>
              <tr><th scope="row">Proporsi anomali sumber</th><td className="num">{persen(data.cloud.proporsi_anomali_sumber)}</td></tr>
              <tr><th scope="row">Proporsi anomali sampel visual</th><td className="num">{persen(data.cloud.proporsi_anomali_sampel)}</td></tr>
            </tbody></table></div>
          </div>
        </section>

        <section id="bab-3" className="landing-chapter">
          <div className="landing-copy">
            <p className="eyebrow">03 / Penyaringan dan skor</p>
            <h2>Aturan lebih dulu, skor memberi konteks tambahan.</h2>
            <p>Tujuh aturan deterministik memeriksa syarat yang pasti. Transaksi yang lolos aturan dinilai Isolation Forest. Ambang skor hybrid pada data validasi adalah <strong className="mono">{angka(data.cloud.ambang, 3)}</strong>.</p>
            <ol className="landing-gates"><li><strong>Gerbang aturan</strong><span>Ketidaksesuaian yang terdefinisi ditandai.</span></li><li><strong>Gerbang skor</strong><span>Pola tidak lazim menjadi prioritas telaah.</span></li></ol>
            <div className="table-scroll landing-small-table"><table><thead><tr><th scope="col">Tahap pada sampel</th><th scope="col" className="num">Transaksi</th></tr></thead><tbody>
              <tr><th scope="row">Ditandai aturan</th><td className="num">{data.cloud.peringatan_aturan_sampel.toLocaleString("id-ID")}</td></tr>
              <tr><th scope="row">Skor di atas ambang setelah aturan</th><td className="num">{data.cloud.peringatan_skor_sampel.toLocaleString("id-ID")}</td></tr>
              <tr><th scope="row">Ditandai hybrid</th><td className="num">{data.cloud.peringatan_hybrid_sampel.toLocaleString("id-ID")}</td></tr>
            </tbody></table></div>
            <p className="provenance">Skor anomali bukan bukti fraud dan tidak mengambil keputusan pemeriksaan.</p>
          </div>
        </section>

        <section id="bab-4" className="landing-chapter">
          <div className="landing-copy">
            <p className="eyebrow">04 / Rantai hash</p>
            <h2>Perubahan dapat diperiksa lewat hubungan antarentri.</h2>
            <p>Contoh ini menandai tautan yang sengaja diputus pada entri {data.chain.rusak_pada}. Entri ini dibuat untuk ilustrasi, bukan hasil manipulasi ledger produksi.</p>
            <p className="info-note danger-note">Ledger prototipe adalah hash-chain dalam satu basis data. Ia dapat menunjukkan perubahan pada rantai tersimpan, tetapi tidak mencegah pengelola menulis ulang seluruh rantai.</p>
          </div>
        </section>

        {evaluation.tersedia && <section id="bab-5" className="landing-chapter landing-chapter-results">
          <div className="landing-copy">
            <p className="eyebrow">05 / Hasil pengujian</p>
            <h2>Hasil simulasi menunjukkan kompromi antara tangkapan dan alarm.</h2>
            <p>Tiga pendekatan dibandingkan pada data uji seed {evaluation.seed_utama}. F1 hybrid {angka(evaluation.pengujian.hybrid.f1, 4)} lebih rendah daripada aturan {angka(evaluation.pengujian.aturan_saja.f1, 4)}, dengan laju peringatan palsu {persen(evaluation.pengujian.hybrid.far)}.</p>
            <div className="landing-results-table table-scroll">
              <table>
                <thead><tr><th scope="col">Pendekatan</th><th scope="col" className="num">Precision</th><th scope="col" className="num">Recall</th><th scope="col" className="num">F1</th><th scope="col" className="num">FAR</th><th scope="col" className="num">Peringatan / 1.000</th></tr></thead>
                <tbody>{BARIS_HASIL.map(({ key, nama }) => <tr key={key}><th scope="row">{nama}</th><MetrikHasil row={evaluation.pengujian[key]} /></tr>)}</tbody>
              </table>
            </div>
            <p className="provenance">Pada kelompok transaksi sah yang tampak tidak lazim (n={normalOdd.n.toLocaleString("id-ID")}), FAR hybrid mencapai {persen(normalOdd.hybrid)}. Data simulasi; anomali kontekstual dirancang lolos dari aturan. Pada seed ini hybrid tidak unggul secara keseluruhan.</p>
            <p className="provenance">Lima seed dari generator yang sama: F1 hybrid rata-rata {angka(seeds.f1_hybrid_rerata, 4)} (simpangan baku {angka(seeds.f1_hybrid_sd, 4)}); FAR rata-rata {persen(seeds.far_hybrid_rerata)}.</p>
          </div>
        </section>}

        <section id="bab-6" className="landing-chapter landing-chapter-end">
          <div className="landing-copy">
            <p className="eyebrow">06 / Coba sendiri</p>
            <h2>Periksa transaksi dengan data simulasi.</h2>
            <p>Masukkan nilai transaksi untuk melihat temuan aturan dan skor anomali. Hasil menjadi prioritas telaah, bukan penetapan fraud.</p>
            <div id="coba" className="button-row landing-actions">
              <Link className="button button-primary" href="/periksa">Periksa transaksi</Link>
              <Link className="button" href="/ringkasan">Lihat ringkasan</Link>
            </div>
            <p className="landing-model-note">Model {evaluation.versi_model} · ambang hybrid {angka(evaluation.ambang.nilai, 3)} · data simulasi</p>
          </div>
        </section>
      </div>
    </div>
  );
}
