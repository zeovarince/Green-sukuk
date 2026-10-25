# Landing Page Three.js GSTP

Spesifikasi landing page 3D untuk GSTP: Three.js, Next.js, dan scroll. Halaman ini menjadi `/` dan berakhir di tombol yang mengarah ke halaman pemeriksaan (`/periksa`). Dokumen ini melengkapi `docs/DESIGN.md` dan menjadi pengecualian tunggal untuk aturan gerak di dokumen itu (lihat bagian 12).

Status: diterapkan di `web/`. Typecheck dan build produksi lulus. Pemeriksaan visual lintas perangkat dan Lighthouse belum dilakukan.

## 1. Tujuan

1. Memperkenalkan GSTP dalam satu kali scroll: pencairan dibandingkan dengan progres, lalu aturan, skor, peringatan, dan ledger.
2. Membuat pengunjung (juri, pembaca esai) ingin mencoba sistem, lewat tombol "Periksa transaksi".
3. Menampilkan data nyata dari prototipe dalam bentuk 3D, bukan hiasan.

Bukan tujuan: mengganti dashboard, menjadi game, atau memamerkan efek.

## 2. Ringkasan keputusan

| Hal | Keputusan |
|---|---|
| Rute | Landing menjadi `/`. Dashboard Ringkasan yang sekarang pindah ke `/ringkasan` |
| Splash screen lama | Dinonaktifkan. Landing punya pembuka sendiri |
| Teknologi 3D | Three.js lewat React Three Fiber dan drei |
| Scroll | GSAP ScrollTrigger yang membaca kemajuan scroll. Scroll tidak dibajak |
| Data | Berkas JSON statis hasil ekspor Python, bukan query database |
| Aset | Tanpa model 3D atau tekstur eksternal. Semua geometri dibuat dengan kode |
| Cadangan | Versi statis tanpa WebGL untuk perangkat lemah, mode kurang gerak, atau pengguna yang mematikan 3D |
| Teks | Seluruh teks landing adalah HTML nyata, kanvas hanya pelengkap |

Alasan data statis: landing harus tetap tampil walau proyek Supabase sedang dijeda (paket gratis dijeda saat tidak aktif).

## 3. Konsep visual

Dunia 3D adalah **lembar gambar teknik yang hidup**, melanjutkan konsep di `DESIGN.md`. Kameranya ortografis atau berperspektif sangat sempit, miring seperti gambar isometrik. Semua objek berwarna datar dari token warna `DESIGN.md`, tanpa cahaya neon, tanpa bloom, tanpa partikel melayang acak.

Aturan keras:
- Setiap objek 3D mewakili satu data nyata. Kalau tidak mewakili data, jangan ada.
- Latar memakai `--lembar` (tema terang). Tidak ada mode gelap.
- Bahan: `MeshBasicMaterial` atau `MeshLambertMaterial` datar. Tidak ada tekstur, tidak ada peta bayangan.
- Warna jingga patok hanya untuk transaksi yang ditandai. Merah rusak hanya untuk tautan ledger yang putus.
- Satu hal mencolok per bab, dan hanya itu yang bergerak.

## 4. Alur halaman (bab saat scroll)

Panjang scroll sekitar enam sampai tujuh tinggi layar. Kemajuan scroll `p` berkisar 0 sampai 1.

| Bab | Rentang `p` | Judul (HTML) | Adegan 3D | Data |
|---|---|---|---|---|
| 0 | 0,00 sampai 0,14 | Pembuka | Dua kurva-S sebagai pita 3D yang naik berdampingan | `kurva_contoh.json` |
| 1 | 0,14 sampai 0,34 | Dua kurva | Pencairan melonjak mendahului progres, patok 3D tertancap, garis ukur selisih | `kurva_contoh.json` |
| 2 | 0,34 sampai 0,54 | Satu per satu transaksi | Awan transaksi (waktu, nilai, kontrak), kamera meluncur sepanjang sumbu waktu | `awan_transaksi.json` |
| 3 | 0,54 sampai 0,70 | Aturan lalu skor | Dua gerbang: titik yang melanggar aturan menyimpang di gerbang pertama, titik berskor tinggi terangkat melewati bidang ambang di gerbang kedua | `awan_transaksi.json` |
| 4 | 0,70 sampai 0,84 | Rantai | Blok ledger bertaut, satu tautan putus | `rantai_contoh.json` |
| 5 | 0,84 sampai 0,94 | Hasil | Kolom tiga pendekatan (aturan saja, Isolation Forest saja, hybrid) | `evaluasi.json` |
| 6 | 0,94 sampai 1,00 | Coba sendiri | Kamera berhenti di bingkai lembar dengan kotak judul, tombol CTA | tidak ada |

Aturan bab:
- Judul dan teks tiap bab berupa HTML yang menempel (sticky) di sisi kiri atau bawah, bukan teks di dalam kanvas.
- Angka yang tampil di teks (jumlah transaksi, anomali, ambang) diambil dari berkas JSON, bukan ditulis tangan.
- Bab 5 hanya tampil jika `evaluasi.json` berisi hasil nyata. Jika kosong, bab dilewati dan diganti satu kalimat.
- Rel kemajuan kecil di tepi kanan menunjukkan bab aktif (nomor bab karena memang urutan nyata). Bisa diklik untuk meloncat ke bab.

## 5. Adegan secara rinci

### Bab 0 dan 1: dua kurva
- Dua pita tipis: progres fisik (`--tinta`) dan pencairan kumulatif (`--air`). Bentuk berasal dari data kontrak contoh, memakai fungsi kurva yang sama dengan `web/lib/kurvaS.ts`.
- Lonjakan pencairan digambarkan sebagai anak tangga pada pita pencairan.
- Patok: tiang silinder tipis dan bendera segitiga `--patok`, ditancapkan dengan GSAP saat bab 1 aktif.
- Garis ukur: dua garis pendek dan satu garis tegak antara dua pita, dengan label HTML "selisih N poin" (N dari data).

### Bab 2: awan transaksi
- Satu `InstancedMesh` kubus kecil atau `Points`. Sumbu x: waktu, y: nilai (skala log), z: urutan kontrak.
- Warna: normal `--garis-tegas`, ditandai `--patok`. Bentuk tidak dibedakan, warna ditambah keterangan di HTML.
- Sampel berstrata dari seluruh data (lihat bagian 8). Keterangan di HTML wajib menyebut bahwa proporsi anomali pada sampel lebih tinggi dari data asli.
- Kamera bergerak pelan sepanjang sumbu waktu.

### Bab 3: aturan lalu skor
- Gerbang pertama: bingkai tipis. Titik dengan `aturan = 1` bergeser ke samping saat melewatinya.
- Gerbang kedua: bidang ambang tipis (garis tepi saja, tanpa isian tebal). Titik dengan skor di atas ambang naik melewati bidang. Label HTML menyebut nilai ambang dari data.
- Titik yang lolos kedua gerbang tetap di jalurnya.
- Gerak menggunakan interpolasi posisi di shader atau di `useFrame` dengan array terstruktur, bukan satu tween GSAP per titik.

### Bab 4: rantai
- 18 sampai 24 blok kecil bertaut garis. Satu tautan di tengah putus: garis putus-putus `--rusak`.
- Sapuan sorotan dari blok pertama ke blok yang rusak saat bab aktif (GSAP, maksimal 1,5 detik).
- Label HTML: "Rantai rusak pada entri N. Entri sebelumnya masih konsisten." (N dari data). Ini rantai contoh, bukan ledger sungguhan, dan harus disebut begitu.

### Bab 5: hasil
- Tiga kelompok kolom untuk pendekatan, masing-masing menampilkan metrik utama (misalnya F1 dan laju peringatan palsu).
- Grafik batang 3D sulit dibaca presisi. Karena itu setiap kolom diberi label angka HTML dan tabel ringkas muncul di bawah adegan.
- Teks keterbatasan wajib mengikuti hasil evaluasi: "Data simulasi. Anomali kontekstual dirancang lolos dari aturan. Pada seed ini hybrid tidak unggul secara keseluruhan."

### Bab 6: ajakan
- Kamera berhenti pada bingkai lembar dengan kotak judul (versi model, ambang, penanda data simulasi).
- Tombol utama "Periksa transaksi" ke `/periksa`. Tombol sekunder "Lihat ringkasan" ke `/ringkasan`.
- Footer di bawahnya (bagian 10).

## 6. Tombol CTA

- CTA utama: "Periksa transaksi", `next/link` ke `/periksa`.
- Tombol yang sama muncul di header mulai bab 2, supaya ajakan tidak hanya ada di ujung scroll.
- Satu aksi utama per layar. Tidak ada banyak tombol bersaing.
- Fokus keyboard terlihat. Tombol bisa dijangkau tanpa melewati seluruh halaman (lihat tautan lewati di bagian 9).

## 7. Teks landing

Bahasa Indonesia lugas, tanpa em dash, tanpa frasa klise. Angka dalam kurung kurawal diambil dari data.

| Tempat | Teks |
|---|---|
| H1 | "Memeriksa apakah dana Green Sukuk dicairkan sejalan dengan kemajuan proyek." |
| Sub | "GSTP membandingkan pencairan dengan progres fisik, menandai transaksi yang perlu ditinjau, dan mencatat setiap langkah dalam rantai yang bisa diverifikasi." |
| Bab 1 | "Pencairan yang mendahului progres adalah sinyal pertama. Pada kontrak contoh ini selisihnya {selisih} poin." |
| Bab 2 | "{total} transaksi simulasi. {anomali} di antaranya sengaja disuntikkan sebagai anomali untuk menguji sistem." |
| Bab 3 | "Tujuh aturan memeriksa hal yang pasti. Skor anomali menilai pola yang tidak lazim pada transaksi yang lolos. Ambang skor {ambang}." |
| Bab 4 | "Setiap kejadian dicatat dalam rantai hash. Jika satu catatan diubah, verifikasi menunjukkan di mana rantai rusak." |
| Bab 5 | "Tiga pendekatan diuji pada data pengujian. Hasil di bawah berlaku untuk data simulasi." |
| Bab 6 | "Coba periksa transaksi sendiri." |
| Tombol | "Periksa transaksi" dan "Lihat ringkasan" |
| Penanda | "Data simulasi" (selalu terlihat di header) |
| Kaki halaman | "Peringatan anomali menjadi prioritas pemeriksaan, bukan penetapan fraud." |

## 8. Data

Dihasilkan skrip baru `ml/export_landing_data.py` dari data simulasi dan hasil model. Hasilnya disalin ke `web/data/landing/`. Semua berkas memuat `dibuat_pada`, `seed`, dan `"simulasi": true`.

`kurva_contoh.json`
```json
{
  "simulasi": true, "seed": 42, "dibuat_pada": "tanggal",
  "kontrak_id": "PRJ-0000-K00",
  "titik": [{ "u": 0.0, "progres": 0.0, "pencairan": 0.0 }],
  "ditandai": { "u": 0.62, "selisih_poin": 0.0 }
}
```
Pilih kontrak yang memiliki satu transaksi `lonjakan_tanpa_progres` agar bab 1 memakai kasus nyata.

`awan_transaksi.json`
```json
{
  "simulasi": true, "seed": 42, "dibuat_pada": "tanggal",
  "total": 0, "anomali": 0, "ambang": 0.0,
  "catatan_sampel": "Sampel berstrata. Proporsi anomali lebih tinggi dari data asli.",
  "sampel": [{ "x": 0.0, "y": 0.0, "z": 0.0, "a": 0, "k": 0.0, "d": 0 }]
}
```
`a` = melanggar aturan (0 atau 1), `k` = skor anomali (0 sampai 1, kosong jika `a` = 1), `d` = ditandai oleh sistem (0 atau 1). Jumlah sampel maksimal 8.000. Ambil semua baris ditandai sampai batas, lalu lengkapi dengan sampel acak dari baris lain. Nilai `total` dan `anomali` adalah angka data asli, bukan jumlah sampel.

`rantai_contoh.json`
```json
{
  "simulasi": true, "dibuat_pada": "tanggal",
  "entri": [{ "seq": 1, "jenis": "transaksi", "hash": "ab12cd34" }],
  "rusak_pada": 12
}
```

`evaluasi.json`: salinan bagian `pengujian` dan `seed_utama` dari `ml/artifacts/hasil_evaluasi.json`, tanpa mengubah angka. Jika berkas hasil belum ada, tulis `{ "tersedia": false }`.

Aturan data:
- Ukuran total berkas landing di bawah 500 KB setelah kompresi. Ukur dan laporkan.
- Validasi skema saat build. Build gagal jika berkas rusak atau `simulasi` tidak bernilai true.
- Jangan membaca database untuk landing.

## 9. Performa, cadangan, aksesibilitas

### Tingkat kualitas
Ditentukan di klien setelah komponen terpasang (lihat `tier.ts` di bagian 14).

| Tingkat | Kondisi | DPR maksimal | Titik maksimal |
|---|---|---|---|
| tinggi | Desktop | 1,75 | 8.000 |
| sedang | Ponsel biasa | 1,5 | 4.000 |
| rendah | Ponsel dengan inti atau memori kecil | 1,25 | 2.000 |
| statis | Tanpa WebGL, mode kurang gerak, mode hemat data, atau 3D dimatikan pengguna | tidak ada | tidak ada |

### Anggaran dan aturan
- Kode Three.js dimuat lewat `dynamic(() => import(...), { ssr: false })` dan hanya untuk `/`. Halaman lain tidak boleh memuatnya.
- Tanpa pascaproses, tanpa peta bayangan, tanpa model atau tekstur eksternal.
- `frameloop="demand"` ketika kanvas tidak terlihat atau tab tersembunyi. Render kembali saat kemajuan scroll berubah.
- Bersihkan geometri dan material saat komponen dilepas.
- Target pengukuran, bukan janji: LCP teks utama kurang dari 2,5 detik pada jaringan 4G terukur, tanpa pergeseran tata letak. Gerak kamera berjalan mulus pada ponsel kelas menengah. Ukur dan catat hasilnya.

### Versi statis
- Poster SVG kurva-S ganda (memakai `kurvaS.ts`) menggantikan adegan 3D.
- Tabel ringkas untuk bab 2, 3, dan 5 menggantikan adegan.
- Teks, tombol, dan footer identik dengan versi 3D.
- Poster juga tampil sementara saat kanvas belum siap, lalu memudar (hanya opasitas) ke adegan 3D.

### Aksesibilitas
- Kanvas diberi `aria-hidden="true"`. Semua isi bermakna ada di HTML dalam urutan baca yang benar.
- Tautan "Lewati ke tombol periksa" sebagai fokus pertama.
- Tombol "Matikan animasi 3D" di header. Pilihan disimpan di `localStorage` dengan kunci `gstp-3d`.
- Mode kurang gerak otomatis memakai versi statis.
- Scroll tidak dibajak dan tidak diperlambat. Tidak ada pengunci zoom pada viewport.
- Status tidak hanya dibedakan dengan warna. Selalu ada teks.
- Kontras teks mengikuti `DESIGN.md` bagian 11.
- Rel bab bisa dioperasikan dengan keyboard.

## 10. Footer hak cipta

Teks:

```
Hak cipta 2026 [NAMA ANGGOTA 1], [NAMA ANGGOTA 2], [NAMA ANGGOTA 3].
Prototipe esai GSTP, Universitas Trunojoyo Madura. Data simulasi.
```

Aturan:
- Nama tim disimpan di satu berkas `web/lib/tim.ts` sebagai daftar, dan footer membacanya dari sana.
- **Agen tidak boleh mengarang nama.** Selama nama belum diisi, berkas itu berisi penanda `NAMA ANGGOTA` dan tes build harus gagal pada build produksi jika penanda masih ada.
- Tulis nama persis seperti yang diminta tim (dengan atau tanpa gelar, urutan sesuai kesepakatan).
- Periksa pedoman kompetisi. Jika penjurian dilakukan buta, nama di situs publik dapat membuka identitas tim. Dalam kasus itu, jangan tampilkan nama sampai penjurian selesai.
- Footer yang sama dipakai di semua halaman, bukan hanya landing.
- Tanda hak cipta di sini adalah pernyataan kepemilikan karya tim. Ini bukan nasihat hukum.

## 11. Struktur file

```
web/
  app/
    page.tsx                  landing, komponen server berisi HTML bab
    ringkasan/page.tsx        dashboard yang dulu di /
  components/
    landing/
      LandingKanvas.tsx       klien, dimuat dinamis, memegang <Canvas>
      PenggerakScroll.tsx     membaca kemajuan scroll
      Bab0Kurva.tsx ... Bab5Hasil.tsx   isi adegan per bab
      RelBab.tsx              rel kemajuan dan navigasi bab
      PosterStatis.tsx        versi tanpa 3D
      TombolMatikan3D.tsx
    Footer.tsx                dipakai semua halaman
  lib/
    landing/
      tier.ts                 deteksi kemampuan perangkat
      data.ts                 tipe, pemuat, dan validasi JSON
      palet.ts                nilai hex token untuk Three.js
      kamera.ts               keyframe kamera per bab
    tim.ts                    nama tim
  data/landing/*.json
ml/
  export_landing_data.py
```

Perubahan pada bagian yang sudah ada:
- Navigasi: "Ringkasan" menunjuk ke `/ringkasan`. Logo GSTP menunjuk ke `/`.
- Komponen `Splash` dilepas dari `layout.tsx`, atau dinonaktifkan lewat satu penanda. Kunci `gstp-splash-v1` tidak dipakai lagi.
- Tautan lama ke `/` yang dimaksudkan untuk dashboard diganti ke `/ringkasan`.

## 12. Hubungan dengan DESIGN.md

Landing adalah pengecualian tunggal. Di luar `/`, semua aturan `DESIGN.md` tetap berlaku.

| Aturan di DESIGN.md | Di landing |
|---|---|
| GSAP hanya di lima tempat | Ditambah ScrollTrigger dan animasi bab di `/` saja |
| ScrollTrigger tidak dipakai | Boleh, hanya untuk membaca kemajuan scroll landing |
| Boldness hanya di kurva-S dan splash | Landing boleh lebih ekspresif, tetapi tetap memakai token dan konsep lembar gambar |
| Splash screen di `/` | Dinonaktifkan |
| Tidak ada gradasi, bayangan, kilau | Tetap berlaku, termasuk di dalam adegan 3D |
| Daftar periksa anti-AI-slop | Tetap berlaku (bagian 13 di sini menambahkan butir khusus 3D) |

## 13. Daftar periksa

Anti-AI-slop khusus landing 3D:
- [x] Tidak ada partikel hiasan, cahaya neon, bloom, atau gradasi ungu dan biru; titik-titik mewakili transaksi.
- [x] Tidak ada objek 3D yang tidak mewakili data.
- [x] Tidak ada teks di dalam kanvas. Semua teks adalah HTML.
- [x] Tidak ada teks hero berisi slogan kosong. H1 menjelaskan apa yang dilakukan sistem.
- [x] Teks tiap bab tetap terlihat tanpa bergantung pada adegan.
- [x] Tidak ada em dash pada teks landing.
- [x] Angka di teks berasal dari berkas data.

Fungsi dan perangkat:
- [x] Versi statis tersedia saat WebGL tidak tersedia, mode kurang gerak aktif, atau 3D dimatikan lewat tombol.
- [x] Three.js dimuat dinamis dari `/`; chunk Three.js tercatat pada manifest pemuatan dinamis halaman root saja.
- [x] CTA menuju `/periksa`, tombol sekunder menuju `/ringkasan`.
- [x] Footer memuat nama dan foto tim; build produksi gagal bila nama masih berupa penanda.
- [ ] Diuji di desktop, satu ponsel Android kelas menengah, dan satu ponsel iPhone bila tersedia.
- [ ] Diuji dengan Supabase dijeda: landing tetap tampil penuh.
- [ ] Lighthouse atau pengukuran serupa dijalankan dan hasilnya dicatat.

## 14. Kode acuan

Pola di bawah menjadi acuan implementasi. Kode yang berjalan dan sumber kebenaran ada di `web/components/landing/` dan `web/lib/landing/`.

### 14.1 `web/lib/landing/tier.ts`

```ts
export type Tier = "tinggi" | "sedang" | "rendah" | "statis";

export const BATAS = {
  tinggi: { dpr: 1.75, titik: 8000 },
  sedang: { dpr: 1.5, titik: 4000 },
  rendah: { dpr: 1.25, titik: 2000 },
  statis: { dpr: 1, titik: 0 },
} as const;

const KUNCI_MATI = "gstp-3d";

function adaWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function dimatikanPengguna(): boolean {
  try {
    return localStorage.getItem(KUNCI_MATI) === "mati";
  } catch {
    return false;
  }
}

export function setAnimasi3D(nyala: boolean) {
  try {
    if (nyala) localStorage.removeItem(KUNCI_MATI);
    else localStorage.setItem(KUNCI_MATI, "mati");
  } catch {}
}

export function tentukanTier(): Tier {
  if (typeof window === "undefined") return "statis";

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };

  const kurangGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hemat = nav.connection?.saveData === true;
  if (kurangGerak || hemat || dimatikanPengguna() || !adaWebGL()) return "statis";

  const ponsel = window.matchMedia("(pointer: coarse)").matches;
  const inti = navigator.hardwareConcurrency ?? 4;
  const memori = nav.deviceMemory ?? 4;

  if (ponsel && (inti <= 4 || memori <= 3)) return "rendah";
  if (ponsel) return "sedang";
  return "tinggi";
}
```

### 14.2 `web/components/landing/PenggerakScroll.tsx`

```tsx
"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const kemajuan = { nilai: 0 };

export const BAB = [
  { id: 0, dari: 0.0, sampai: 0.14 },
  { id: 1, dari: 0.14, sampai: 0.34 },
  { id: 2, dari: 0.34, sampai: 0.54 },
  { id: 3, dari: 0.54, sampai: 0.7 },
  { id: 4, dari: 0.7, sampai: 0.84 },
  { id: 5, dari: 0.84, sampai: 0.94 },
  { id: 6, dari: 0.94, sampai: 1.0 },
] as const;

export function babAktif(p: number): number {
  const b = BAB.find((x) => p >= x.dari && p < x.sampai);
  return b ? b.id : BAB[BAB.length - 1].id;
}

export function useKemajuanScroll(pembungkus: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = pembungkus.current;
    if (!el) return;
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        kemajuan.nilai = self.progress;
      },
    });
    return () => st.kill();
  }, [pembungkus]);
}
```

Cara dipakai di adegan: di dalam `useFrame`, ambil `kemajuan.nilai`, haluskan dengan `THREE.MathUtils.damp(sekarang, kemajuan.nilai, 4, delta)`, lalu hitung posisi kamera dari keyframe di `kamera.ts` dan keadaan tiap bab dari `babAktif`. Jangan menggunakan `scrub` untuk menggerakkan objek 3D langsung. Pakai satu nilai kemajuan yang dibaca semua adegan.

### 14.3 Pemuatan dinamis di `web/app/page.tsx`

```tsx
import dynamic from "next/dynamic";
import PosterStatis from "@/components/landing/PosterStatis";

const LandingKanvas = dynamic(() => import("@/components/landing/LandingKanvas"), {
  ssr: false,
  loading: () => null,
});

export default function Landing() {
  return (
    <>
      <a href="#coba" className="lewati">Lewati ke tombol periksa</a>
      <PosterStatis />
      <LandingKanvas />
      {/* Bab-bab HTML, CTA dengan id="coba", dan Footer di sini */}
    </>
  );
}
```

`LandingKanvas` memanggil `tentukanTier()` setelah terpasang. Jika hasilnya `statis`, komponen tidak membuat `<Canvas>` sama sekali.

## 15. Urutan pengerjaan

Ditambahkan ke `TASKS.md` sebagai Fase 9b.

1. [x] Tulis `ml/export_landing_data.py`, hasilkan keempat JSON, dan validasi saat build.
2. [x] Pindahkan dashboard ke `/ringkasan`, perbarui navigasi, dan lepas splash.
3. [x] Bangun versi statis (HTML bab, poster SVG, tabel, CTA, footer) agar alur tetap terbaca tanpa 3D.
4. [x] Tambahkan `tier.ts`, `PenggerakScroll.tsx`, dan `LandingKanvas`.
5. [x] Bangun bab 0 dan 1 (dua kurva, patok, garis ukur); pemeriksaan rasa visual masih menunggu.
6. [x] Bangun bab 2 dan 3 (awan transaksi dan dua gerbang).
7. [x] Bangun bab 4 dan 5 (rantai dan hasil).
8. [x] Bangun bab 6 (CTA) dan rel bab.
9. [x] Isi `web/lib/tim.ts` dengan nama tim dan foto yang diberikan.
10. [ ] Jalankan daftar periksa perangkat di bagian 13 dan catat Lighthouse setelah tersedia.

## 16. Referensi Three.js

Empat situs berikut dijadikan acuan rasa dan pendekatan, bukan untuk disalin. Jangan menyalin kode, aset, tata letak, atau komposisi visual dari situs mana pun. Hormati hak cipta pembuatnya, dan tulis ulang gagasan dengan cara sendiri sesuai konsep GSTP.

Catatan kejujuran: saat menyusun dokumen ini, yang bisa dibaca dari tiap situs hanyalah teks dan metadata halaman, bukan tampilan 3D-nya. Kolom "Terverifikasi dari teks halaman" hanya memuat yang tertulis di halaman. Kolom "Amati sendiri" adalah daftar hal yang harus dilihat langsung di browser sebelum menjadi dasar keputusan desain.

| Situs | Terverifikasi dari teks halaman | Amati sendiri | Gagasan yang dipakai | Tidak dipakai |
|---|---|---|---|---|
| https://david-hckh.com/ | Portofolio pengembang web. Deskripsi menyebut pengalaman web 3D interaktif dengan WebGL, TypeScript, dan Node.js. Warna tema halaman krem hangat | Cara interaksi 3D menjadi isi utama halaman, bukan latar. Transisi antar bagian. Respons terhadap kursor. Kinerja di ponsel | 3D sebagai inti pengalaman, dengan interaksi yang terasa ringan | Palet krem. Gaya portofolio pribadi |
| https://chartogne-taillet.com/en | Situs kebun anggur. Teks pembuka menekankan petak-petak lahan yang dipetakan menurut asal geologis dan nama petak pada peta desa | Bagaimana peta atau petak digambarkan dan dijelajahi. Hubungan antara teks dan visual saat scroll. Nada visual yang tenang | Metafora peta dan petak sebagai cara menyajikan data berbasis lokasi atau kelompok | Nuansa produk anggur. Gaya mewah |
| https://tinyskies.vercel.app/ | Permainan eksplorasi: terbang mengelilingi dunia kecil, menyalakan lima tungku. Viewport dikunci (tanpa zoom) | Dunia kecil yang utuh dalam satu bingkai. Kontrol kamera. Cara dunia itu dimuat. Kinerja di ponsel | Dunia kecil sebagai satu bingkai yang bisa dilihat dari jauh. Kelembutan gerak kamera | Kontrol ala permainan. Pengunci zoom viewport (merugikan aksesibilitas) |
| https://pendereckisgarden.pl/en/the-maestros-manor | Situs bab-bab: tujuh bab bernomor, tiap bab menampilkan persentase yang sudah dijelajahi. Ada tautan lewati ke navigasi, isi, daftar putar, dan footer. Ada tombol mode kontras. Ada pergantian musim. Labirin dijelajahi dengan keyboard dan mouse. Ada pemberitahuan memakai headphone dan permintaan izin sensor gerak | Transisi antar bab. Cara kemajuan jelajah ditampilkan. Cara adegan 3D dan teks berbagi layar. Kinerja dan ukuran muat | Struktur bab dengan penanda kemajuan, navigasi bab, tautan lewati, dan opsi aksesibilitas yang jelas | Musik otomatis, izin sensor gerak, banner cookie (GSTP tidak memakai cookie), kontrol ala permainan |

Cara memakai tabel ini:
1. Buka keempat situs di desktop dan di ponsel.
2. Isi catatan singkat untuk setiap kolom "Amati sendiri" di bagian bawah dokumen ini atau di `DECISIONS.md`.
3. Jika pengamatan bertentangan dengan kolom "Gagasan yang dipakai", ubah kolom itu dan catat alasannya. Pengamatan langsung lebih benar daripada ringkasan di atas.

Catatan pengamatan (diisi tim):

- david-hckh.com: ______
- chartogne-taillet.com: ______
- tinyskies.vercel.app: ______
- pendereckisgarden.pl: ______


## 17. Implementasi yang berjalan

- Data landing dihasilkan dari CSV simulasi dan artefak evaluasi lokal oleh `ml/export_landing_data.py`.
- Halaman `/` berisi landing; dashboard Ringkasan tetap tersedia di `/ringkasan`.
- Three.js dimuat dinamis hanya untuk landing. Poster SVG dan isi HTML tetap tersedia pada mode statis.
- Footer memakai foto yang diberikan di `image/` dan nama yang tercatat di `web/lib/tim.ts`.
- Pemeriksaan terakhir: `npm run typecheck` dan `npm run build` lulus. Visual desktop/ponsel dan Lighthouse belum diperiksa.
