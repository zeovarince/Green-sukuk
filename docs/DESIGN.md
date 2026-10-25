# DESIGN

Arahan desain visual untuk web GSTP (`web/`). Dokumen ini mengikat untuk semua halaman di `docs/WEB_SPEC.md`. Baca bagian 1 sampai 3 sebelum menulis UI apa pun. Kalau ada pilihan desain yang tidak diatur di sini, pilih yang paling dekat dengan konsep di bagian 2, jangan jatuh ke gaya bawaan.

Status: diterapkan pada halaman F1 sampai F6, Evaluasi, Riwayat Kontrak, dan Tentang. Typecheck, build produksi, dan 517 tes lulus pada 2026-10-25. Halaman menjawab HTTP 200 secara lokal; secret key server mendapat HTTP 401 saat uji baca langsung ke Supabase. Pemeriksaan visual lintas ukuran layar dan uji URL publik belum dilakukan.

## 1. Subjek, pengguna, tugas

- **Subjek:** alat pemeriksa alokasi dana Green Sukuk. Isinya pencairan proyek infrastruktur hijau (bendungan, transportasi, air), pagu, termin, progres fisik, dan catatan hash.
- **Pengguna:** auditor yang memutuskan transaksi mana diperiksa lebih dulu, dan juri atau pembaca esai yang mencoba demo.
- **Tugas utama halaman:** membuat orang cepat melihat apakah pencairan berjalan seiring dengan progres pekerjaan, dan mengapa suatu transaksi ditandai.
- **Bahasa visual yang diambil dari subjek:** lembar gambar proyek teknik (kurva-S, patok survei, garis ukur, kotak judul gambar). Bukan dari gaya "fintech" atau "AI".

## 2. Konsep: lembar gambar teknik

Seluruh sistem diperlakukan seperti lembar gambar proyek. Satu hal yang harus diingat orang setelah memakai web ini: **dua kurva-S, progres fisik dan pencairan kumulatif, dan selisihnya diukur dengan garis ukur.** Itulah sinyal yang dicari sistem, jadi itu pula yang menjadi gambar utama.

Perangkat visual dan fungsinya (tiap perangkat membawa informasi, bukan hiasan):

| Perangkat | Wujud | Informasi yang dibawa |
|---|---|---|
| Kurva-S ganda | Dua garis: progres fisik (tinta) dan pencairan (air) | Pencairan mengikuti atau mendahului progres |
| Garis ukur | Garis dengan panah dan angka di antara dua kurva | Besar selisih pada titik itu |
| Patok | Tiang kecil dengan bendera berwarna | Status peringatan dan posisi transaksi yang ditandai |
| Kotak judul | Blok informasi di kaki halaman, seperti kotak judul gambar teknik | Versi model, ambang, status rantai ledger, penanda data simulasi |
| Skala | Penggaris 0 sampai 1 dengan tanda ambang | Posisi skor anomali terhadap ambang |
| Rantai | Blok yang bertaut garis | Entri ledger dan hubungannya dengan entri sebelumnya |

Aturan keras: **boldness hanya di satu tempat**, yaitu kurva-S ganda beserta splash screen. Semua yang lain tenang dan disiplin.

## 3. Peninjauan terhadap pola umum

Rencana ini sudah diperiksa terhadap gaya yang sering muncul pada desain buatan AI. Yang ditolak dan penggantinya:

| Pola umum yang ditolak | Dipakai di sini |
|---|---|
| Latar krem hangat, serif display, aksen terakota | Latar abu-hijau dingin seperti beton dan kertas gambar, aksen teal air dan jingga patok |
| Hitam pekat dengan satu aksen hijau neon atau merah | Tema terang saja, tidak ada mode gelap pada prototipe |
| Tata letak koran dengan garis tipis dan sudut nol | Satu lembar kerja dengan kotak judul, sudut kecil bervariasi menurut peran |
| Kartu seragam, radius sama, bayangan abu, gradasi | Tidak ada kartu. Bagian dipisah oleh garis dan jarak. Tidak ada bayangan atau gradasi |
| Label huruf kapital berjarak di atas tiap judul | Judul langsung. Label memakai huruf kecil biasa |
| Teks meta digabung titik tengah, panah di akhir tautan, "KATA dash serpihan" | Tidak dipakai |
| Nomor 01, 02, 03 sebagai hiasan | Nomor hanya untuk urutan nyata (langkah alur di halaman Tentang) |
| Font mono untuk label kecil | Mono hanya untuk hash dan ID transaksi, karena itu memang data |
| Satu kata di judul diberi warna atau miring | Tidak dipakai |
| Muncul-geser-naik di setiap seksi, hover bergerak di setiap kartu | Gerak hanya di lima tempat (bagian 9) |

## 4. Warna

Enam warna dasar, ditambah warna semantik. Kontras dihitung terhadap `--lembar`. Uji ulang dengan alat kontras sebelum finalisasi.

| Token | Hex | Peran | Kontras terhadap `--lembar` |
|---|---|---|---|
| `--beton` | `#E3E7E1` | Latar halaman di luar lembar | latar |
| `--lembar` | `#F7F8F5` | Permukaan baca utama (tabel, form, grafik) | latar |
| `--tinta` | `#12262A` | Teks utama, garis kurva progres, bingkai | sekitar 15 banding 1 |
| `--air` | `#0E5A5F` | Aksen utama: tombol utama, kurva pencairan, tautan, status valid | sekitar 7 banding 1 |
| `--patok` | `#B8450B` | Peringatan: transaksi perlu diperiksa, bendera patok | sekitar 5 banding 1 |
| `--kuning-patok` | `#E2B100` | Menunggu klarifikasi. Hanya sebagai isian, teksnya `--tinta` | isian |
| `--rusak` | `#A3191F` | Rantai ledger rusak. Dipakai jarang dan hanya untuk itu | sekitar 7 banding 1 |
| `--redup` | `#4B5E59` | Teks sekunder | sekitar 6 banding 1 |
| `--garis` | `#AEB8B1` | Garis pemisah dekoratif | tidak untuk batas kontrol |
| `--garis-tegas` | `#6C7B74` | Batas kolom isian dan tombol | sekitar 4 banding 1 |

Aturan pemakaian:
- Jingga patok hanya untuk peringatan. Jangan dipakai sebagai hiasan atau aksen umum.
- Merah rusak hanya untuk verifikasi ledger yang gagal.
- Status tidak boleh dibedakan hanya dengan warna. Selalu sertakan teks.
- Teks di atas `--air` atau `--patok` berwarna putih `#FFFFFF`. Teks di atas `--kuning-patok` berwarna `--tinta`.

## 5. Tipografi

Dua keluarga huruf utama dan satu keluarga untuk data.

| Peran | Keluarga | Catatan |
|---|---|---|
| Judul dan angka besar | Archivo (variabel, sumbu lebar) | Bobot 600 sampai 700, lebar sempit sampai sedang (`"wdth"` 78 sampai 90) agar terasa seperti huruf teknik |
| Isi, tabel, form | IBM Plex Sans | Bobot 400, 500, 600. Angka tabular untuk semua angka di tabel |
| Hash dan ID transaksi | IBM Plex Mono | Hanya untuk dua jenis data itu |

Skala (px): 13, 15, 16, 20, 28, 40, 64. Ukuran 64 hanya untuk judul splash. Isi 16 dengan tinggi baris 1,55. Tabel 15. Panjang baris teks bacaan di bawah 75 karakter.

Aturan:
- Aktifkan `font-variant-numeric: tabular-nums` pada tabel, kartu angka, dan sumbu grafik.
- Angka rupiah: titik sebagai pemisah ribuan, awalan "Rp". Pada ringkasan boleh "Rp4,9 miliar". Pada tabel tulis angka penuh rata kanan.
- Judul memakai sentence case. Tidak ada huruf kapital semua untuk label.
- Teks rata kiri di seluruh antarmuka.

## 6. Tata letak

Lebar maksimum 1200 px, grid 12 kolom, jarak dasar 4 px dengan langkah 4, 8, 12, 16, 24, 32, 48, 72. Halaman berupa satu lembar (`--lembar`) di atas `--beton`, dengan batas 1 px `--garis`. Tidak ada bayangan.

Sudut: kolom isian dan tombol 4 px. Lembar utama 0 px. Bendera patok berbentuk bendera (poligon), bukan kapsul. Tidak ada radius besar di mana pun.

Kotak judul selalu di kaki setiap halaman utama, dengan garis tegas 1,5 px `--tinta`, berisi: nama sistem, versi model, ambang, status rantai (valid sampai entri berapa), dan penanda "Data simulasi".

### Ringkasan (`/`)

```
+---------------------------------------------------------------------------+
| GSTP  Prototipe     Periksa  Peringatan  Kontrak  Ledger  Evaluasi        |
+---------------------------------------------------------------------------+
| PRJ-0123-K02                                    | Antrean peringatan      |
| Pencairan kumulatif dan progres fisik           | baris rapat, 8 teratas  |
|                                                 |                         |
|   [kurva-S ganda, patok, garis ukur]            |                         |
|                                                 |                         |
| nilai kontrak | pagu | kumulatif cair | progres |                         |
+---------------------------------------------------------------------------+
| Kotak judul: versi model | ambang | ledger valid sampai entri N | data sim |
+---------------------------------------------------------------------------+
```

Kurva-S mengisi 8 dari 12 kolom, antrean 4 kolom. Kontrak yang ditampilkan adalah kontrak dengan peringatan terbaru. Judul halaman adalah ID kontrak itu, bukan slogan.

### Periksa (`/periksa`)

Form di kiri (5 kolom), hasil di kanan (7 kolom). Hasil memuat kurva-S kontrak dengan titik transaksi baru, skala skor, dan daftar temuan aturan. Di layar sempit, hasil di bawah form.

### Detail peringatan

Kiri: kurva-S kontrak dengan transaksi yang ditandai dan garis ukur selisih. Kanan: alasan (temuan aturan atau skala skor), pembanding, dan alur tindak lanjut. Riwayat status di bawah, dalam bentuk rantai.

### Ledger

Daftar entri sebagai rantai vertikal: tiap entri berupa blok kecil, bertaut garis ke entri sebelumnya. Pada rantai rusak, garis di titik putus menjadi putus-putus berwarna `--rusak`.

## 7. Komponen

**Kurva-S ganda.** Dua garis 2,5 px: progres fisik (`--tinta`) dan pencairan kumulatif (`--air`). Sumbu tipis `--garis`. Tanpa legenda: beri label langsung di ujung garis ("Progres fisik", "Pencairan"). Titik transaksi yang ditandai berupa patok di atas kurva. Selisih diukur dengan garis ukur berpanah dan angka ("selisih 12 poin"). Bentuk kurva dibuat oleh fungsi di `web/lib/kurvaS.ts` supaya splash, grafik, dan kartu memakai bahasa visual yang sama.

**Patok status.** Tiang 2 px dan bendera poligon, diikuti teks status. Warna: baru (bingkai `--tinta`), ditelaah (`--air`), perlu klarifikasi (`--kuning-patok`), ditindaklanjuti (`--air` penuh), ditutup (`--redup`), peringatan aktif (`--patok`). Teks selalu ada.

**Kotak judul.** Lihat bagian 6.

**Skala skor.** Garis horizontal 0 sampai 1 dengan tanda setiap 0,1 seperti penggaris. Penanda skor (patok kecil) dan satu garis tegak untuk ambang, dengan angka keduanya. Bukan gauge setengah lingkaran.

**Tabel.** Tanpa belang-belang dan tanpa kartu. Kepala: teks 13 px bobot 600 `--redup`, garis bawah 2 px `--tinta`. Baris dipisah garis 1 px `--garis`. Angka rata kanan, tabular. Baris yang ditandai memiliki batang kiri 3 px `--patok`. Hover: latar `--air` dengan opasitas 6 persen. Kolom pertama menempel saat digulir di layar sempit.

**Hash.** IBM Plex Mono 13 px, dikelompokkan 4 karakter. Tampilan ringkas menunjukkan 8 karakter awal dan 8 akhir dengan elipsis. Atribut `title` dan tombol salin memuat nilai penuh.

**Form.** Label di atas kolom, sentence case, 14 px bobot 600. Kolom tinggi 40 px, latar putih, batas 1 px `--garis-tegas`, sudut 4 px. Awalan "Rp" di dalam kolom nilai. Pesan galat di bawah kolom dalam `--patok`, menyebut apa yang salah dan cara memperbaikinya.

**Tombol.** Utama: isian `--air`, teks putih, tinggi 40 px. Sekunder: bingkai 1,5 px `--tinta`. Tombol tindakan yang menulis ke ledger memakai teks "Simpan ke ledger". Fokus: kontur 2 px `--air` dengan jarak 2 px.

**Kondisi kosong dan galat.** Menjelaskan apa yang terjadi dan langkah berikutnya, tanpa maaf berlebihan dan tanpa ilustrasi.

## 8. Splash screen

Tujuan: satu momen terarah yang memperkenalkan ide inti (pencairan dibandingkan dengan progres) dalam kurang dari tiga detik. Splash bukan tempat memamerkan efek.

**Isi visual (SVG, tanpa gambar):**
1. Bingkai lembar gambar tergambar (garis `--tinta`).
2. Kurva progres fisik tergambar.
3. Kurva pencairan tergambar mengikuti, lalu melonjak mendahului progres.
4. Patok ditancapkan di titik lonjakan.
5. Garis ukur muncul di antara dua kurva.
6. Di kotak judul: "GSTP" naik dari bawah sebuah topeng, lalu teks "Prototipe pemeriksa alokasi Green Sukuk" dan "Data simulasi".
7. Panel splash terangkat ke atas dan menampilkan halaman. Tepi bawah panel diberi garis 2 px `--tinta`.

**Urutan dan waktu (total sekitar 2,6 detik):**

| Detik | Kejadian |
|---|---|
| 0,00 sampai 0,55 | Bingkai tergambar, berurutan |
| 0,25 sampai 1,05 | Kurva progres tergambar |
| 0,55 sampai 1,25 | Kurva pencairan tergambar |
| 1,15 sampai 1,40 | Patok jatuh dan tertancap |
| 1,30 sampai 1,55 | Garis ukur tumbuh dari tengah |
| 1,30 sampai 1,75 | "GSTP" naik dari topeng |
| 1,60 sampai 1,90 | Teks keterangan muncul |
| 1,90 sampai 2,10 | Jeda |
| 2,10 sampai 2,60 | Panel terangkat (`yPercent` 0 ke -100, `power3.inOut`) |

**Aturan perilaku:**
- Tampil sekali per sesi browser, hanya saat membuka `/`. Tautan langsung ke halaman lain tidak diganggu splash.
- Kunci `sessionStorage`: `gstp-splash-v1`.
- Bisa dilewati kapan saja: tombol "Lewati" (fokus pertama), tombol Esc, atau Enter. Saat dilewati, panel langsung terangkat dalam 0,25 detik.
- `prefers-reduced-motion: reduce`: tanpa gambar bertahap. Tampilkan bingkai, kurva, dan judul sudah jadi selama 0,6 detik, lalu pudar 0,2 detik.
- Selama splash, `#app` diberi `inert` supaya fokus keyboard tidak masuk ke konten yang tertutup. Dilepas saat selesai.
- Splash tidak boleh menahan hidrasi. Konten halaman sudah dirender di bawahnya.
- Tanpa JavaScript, splash disembunyikan lewat `<noscript>`.
- Tidak ada gambar atau font tambahan khusus splash. Semua SVG inline.
- Halaman Tentang punya tombol "Putar ulang intro" untuk keperluan demo. Tombol itu menghapus kunci sesi dan memuat ulang `/`.
- Tidak ada layout shift (CLS 0) dan tidak ada kedipan: elemen animasi disembunyikan lewat CSS sebelum hidrasi (lihat kode acuan).

## 9. Gerak dengan GSAP

GSAP dipakai di **lima tempat saja**. Tidak ada animasi muncul-geser-naik di setiap seksi, tidak ada animasi angka menghitung naik, dan ScrollTrigger tidak dipakai. Gerak lain hanya transisi CSS 120 sampai 180 ms untuk hover dan fokus.

| No | Tempat | Pemicu | Gerak | Durasi |
|---|---|---|---|---|
| 1 | Splash | Kunjungan pertama ke `/` | Lihat bagian 8 | sekitar 2,6 s |
| 2 | Hasil pemeriksaan | Pengguna menekan "Periksa transaksi" | Patok jatuh dan tertancap pada hasil, lalu temuan muncul berurutan (maksimal 5, jeda 40 ms) | 280 ms dan 40 ms per baris |
| 3 | Grafik kurva-S | Pengguna mengganti kontrak | Kurva digambar ulang dengan DrawSVG | 500 ms |
| 4 | Verifikasi ledger | Pengguna menekan "Verifikasi rantai" | Sorotan menyapu baris yang terlihat dari atas ke bawah, total maksimal 1,5 detik berapa pun jumlah baris. Berhenti dan menandai merah di entri rusak. Jika valid, berakhir dengan teks "Rantai valid" | maksimal 1,5 s |
| 5 | Status peringatan | Pengguna mengubah status | Bendera patok bergeser dan berganti warna | 200 ms |

Aturan teknis:
- GSAP versi terbaru yang stabil. Seluruh GSAP, termasuk plugin seperti DrawSVG, gratis untuk dipakai termasuk komersial menurut lisensi "no charge" GreenSock. Baca lisensinya di gsap.com/standard-license sebelum rilis.
- Pasang paket `gsap` dan `@gsap/react`. Daftarkan plugin: `gsap.registerPlugin(useGSAP, DrawSVGPlugin)`.
- Selalu pakai `useGSAP` dengan opsi `scope`, supaya pembersihan otomatis dan selektor tidak bocor.
- Hormati `prefers-reduced-motion` lewat `gsap.matchMedia()`. Pada mode kurang gerak: tanpa pergerakan, hanya perubahan keadaan langsung atau pudar singkat.
- Hanya animasikan `transform`, `opacity`, dan properti garis SVG. Jangan animasikan properti tata letak.
- Easing: `power2.out` untuk masuk, `power2.inOut` untuk perpindahan, `power3.inOut` untuk panel splash. Tanpa elastis atau pantul.
- Konten harus tetap terbaca jika animasi gagal. Keadaan awal tersembunyi hanya diberlakukan lewat kelas yang dipasang skrip, bukan CSS permanen.
- Tidak ada animasi yang memblokir interaksi lebih dari 300 ms, kecuali splash (yang bisa dilewati).

## 10. Teks antarmuka

Aktif, sentence case, kata kerja biasa, tanpa tanda pisah em dash, tanpa frasa klise. Satu tindakan memakai satu nama di seluruh alur.

| Tempat | Teks |
|---|---|
| Tombol periksa | "Periksa transaksi" |
| Tombol simpan | "Simpan ke ledger". Konfirmasi: "Tersimpan ke ledger sebagai entri 58.024." |
| Hasil, ada peringatan | "Perlu diperiksa" |
| Hasil, tanpa peringatan | "Tidak ada peringatan baru" |
| Alasan aturan | "Persetujuan yang diperoleh 2, yang diwajibkan 3." |
| Keterangan skor | "Skor 0,81, ambang 0,74. Skor menunjukkan seberapa jauh pola transaksi ini dari pola umum. Skor bukan bukti pelanggaran." |
| Antrean kosong | "Belum ada peringatan. Periksa transaksi baru untuk memulai." |
| Kontrak tidak ketemu | "Kontrak tidak ditemukan. Periksa ID kontrak, contohnya PRJ-0001-K01." |
| Verifikasi valid | "Rantai valid. 58.023 entri diperiksa." |
| Verifikasi rusak | "Rantai rusak pada entri 1.204. Entri sebelumnya masih konsisten." |
| Tombol verifikasi | "Verifikasi rantai" |
| Tombol demo | "Rusak entri (demo)" dan "Pulihkan" |
| Tindak lanjut | "Telaah", "Minta klarifikasi", "Tandai diklarifikasi", "Tetapkan tindak lanjut", "Tutup kasus" |
| Penanda data | "Data simulasi" |
| Kaki halaman | "Peringatan anomali menjadi prioritas pemeriksaan, bukan penetapan fraud." |
| Keterangan splash | "Prototipe pemeriksa alokasi Green Sukuk" dan "Data simulasi" |
| Galat server | "Pemeriksaan gagal dijalankan. Coba lagi. Jika terus gagal, periksa apakah database aktif." |

Jangan menulis "fraud", "terbukti", atau "pelanggar" untuk hasil sistem. Jangan menulis kalimat penjual seperti "solusi inovatif" atau "didukung AI".

## 11. Aksesibilitas dan responsif

- Kontras teks minimal 4,5 banding 1, batas kontrol minimal 3 banding 1.
- Fokus keyboard selalu terlihat. Urutan fokus mengikuti urutan baca.
- Status tidak hanya dibedakan dengan warna. Selalu ada teks.
- Grafik kurva-S punya ringkasan teks yang bisa dibaca pembaca layar ("Progres 61 persen, pencairan 73 persen, selisih 12 poin") dan tabel data yang dapat dibuka.
- Tabel memakai elemen tabel semantik dan kepala kolom bertipe `th scope="col"`.
- Atribut `lang="id"` pada `html`.
- Ukuran target sentuh minimal 40 px.
- Breakpoint: 360, 768, 1024, 1280. Di bawah 768: kurva di atas, antrean di bawah, kotak judul menjadi dua kolom, navigasi menjadi daftar yang bisa digulir mendatar. Tabel digulir mendatar dengan kolom pertama menempel.
- Splash pada layar potret: kurva dan bingkai diskalakan ke lebar layar, judul "GSTP" tetap di kotak judul.

## 12. Daftar periksa anti-AI-slop

Sebelum menyatakan satu halaman selesai, jawab semua dengan ya:
- [ ] Tidak ada gradasi, bayangan lembut, kaca buram, atau kilau.
- [ ] Tidak ada kartu seragam berisi ikon dan judul pendek.
- [ ] Tidak ada ikon emoji atau ikon "bintang percikan" untuk AI.
- [ ] Tidak ada tanda pisah em dash di teks mana pun.
- [ ] Tidak ada label huruf kapital berjarak atau nomor hiasan.
- [ ] Jingga patok hanya muncul untuk peringatan.
- [ ] Setiap perangkat visual (patok, garis ukur, skala, kotak judul) membawa informasi nyata.
- [ ] Gerak hanya di lima tempat pada bagian 9.
- [ ] Teks menjelaskan apa yang terjadi, bukan menjual.
- [ ] Layar 360 px dan 1280 px sama-sama rapi.
- [ ] Mode kurang gerak diuji.
- [ ] Hanya satu hal yang mencolok di tiap halaman, dan itu kurva-S atau hasil pemeriksaan.

## 13. Kode acuan

Kode ini kerangka yang lengkap untuk dipakai, tetapi belum dijalankan. Uji di lingkungan nyata dan sesuaikan dengan versi Next.js dan GSAP yang terpasang.

### 13.1 `web/lib/kurvaS.ts`

```ts
export type OpsiKurva = {
  lebar: number;
  tinggi: number;
  x0: number;
  y0: number;
  kecuraman?: number;
  titik?: number;
  lonjakanDi?: number;
  selisih?: number;
};

const logistik = (u: number, k: number) => 1 / (1 + Math.exp(-k * (u - 0.5)));

export function nilaiKurva(u: number, k = 9): number {
  const a = logistik(0, k);
  const b = logistik(1, k);
  return (logistik(u, k) - a) / (b - a);
}

function nilaiDenganLonjakan(u: number, o: OpsiKurva): number {
  const k = o.kecuraman ?? 9;
  let v = nilaiKurva(u, k);
  if (o.lonjakanDi !== undefined && u >= o.lonjakanDi) {
    v = Math.min(1, v + (o.selisih ?? 0));
  }
  return v;
}

export function titikPada(o: OpsiKurva, u: number): { x: number; y: number } {
  const v = nilaiDenganLonjakan(u, o);
  return { x: o.x0 + u * o.lebar, y: o.y0 - v * o.tinggi };
}

export function pathKurva(o: OpsiKurva): string {
  const n = o.titik ?? 96;
  const bagian: string[] = [];
  for (let i = 0; i <= n; i++) {
    const { x, y } = titikPada(o, i / n);
    bagian.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return bagian.join(" ");
}
```

### 13.2 `web/app/globals.css` (token dan splash)

```css
:root {
  --beton: #e3e7e1;
  --lembar: #f7f8f5;
  --tinta: #12262a;
  --redup: #4b5e59;
  --air: #0e5a5f;
  --patok: #b8450b;
  --kuning-patok: #e2b100;
  --rusak: #a3191f;
  --garis: #aeb8b1;
  --garis-tegas: #6c7b74;

  --font-judul: "Archivo", system-ui, sans-serif;
  --font-isi: "IBM Plex Sans", system-ui, sans-serif;
  --font-data: "IBM Plex Mono", ui-monospace, monospace;
}

html {
  background: var(--beton);
  color: var(--tinta);
  font-family: var(--font-isi);
  font-size: 16px;
  line-height: 1.55;
}

h1, h2, h3 {
  font-family: var(--font-judul);
  font-weight: 650;
  font-variation-settings: "wdth" 84;
  line-height: 1.15;
}

table, .angka { font-variant-numeric: tabular-nums; }

:focus-visible { outline: 2px solid var(--air); outline-offset: 2px; }

#splash {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--lembar);
  border-bottom: 2px solid var(--tinta);
}
html[data-splash="lewati"] #splash { display: none; }
html[data-splash="aktif"] #splash [data-a] { visibility: hidden; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; }
}
```

### 13.3 `web/app/layout.tsx` (font, penanda splash, noscript)

```tsx
import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Splash from "@/components/Splash";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-judul", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-isi", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-data", display: "swap" });

export const metadata: Metadata = {
  title: "GSTP",
  description: "Prototipe pemeriksa alokasi Green Sukuk. Data simulasi.",
};

const PENANDA = `try{var a=location.pathname==='/'&&!sessionStorage.getItem('gstp-splash-v1');document.documentElement.dataset.splash=a?'aktif':'lewati'}catch(e){document.documentElement.dataset.splash='lewati'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={`${archivo.variable} ${plex.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PENANDA }} />
        <noscript>
          <style>{`#splash{display:none}`}</style>
        </noscript>
      </head>
      <body>
        <Splash />
        <div id="app">{children}</div>
      </body>
    </html>
  );
}
```

Catatan: `axes: ["wdth"]` pada `next/font/google` perlu diperiksa terhadap dokumentasi Next.js versi yang dipakai. Jika tidak didukung, muat Archivo dengan `font-stretch` statis atau ganti dengan keluarga lain yang punya lebar sempit.

### 13.4 `web/components/Splash.tsx`

```tsx
"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useGSAP } from "@gsap/react";
import { pathKurva, titikPada } from "@/lib/kurvaS";

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

const KUNCI = "gstp-splash-v1";
const GEO = { lebar: 640, tinggi: 250, x0: 160, y0: 380 };
const PENCAIRAN = { ...GEO, lonjakanDi: 0.62, selisih: 0.2 };
const JALUR_PROGRES = pathKurva(GEO);
const JALUR_PENCAIRAN = pathKurva(PENCAIRAN);
const UJUNG = titikPada(PENCAIRAN, 0.62);
const UKUR_X = titikPada(GEO, 0.64).x;
const UKUR_ATAS = titikPada(PENCAIRAN, 0.64).y;
const UKUR_BAWAH = titikPada(GEO, 0.64).y;

export default function Splash() {
  const akar = useRef<HTMLDivElement>(null);
  const lewatiRef = useRef<() => void>(() => {});

  useGSAP(
    () => {
      const html = document.documentElement;
      if (html.dataset.splash !== "aktif") return;

      const app = document.getElementById("app");
      app?.setAttribute("inert", "");

      const selesai = () => {
        try {
          sessionStorage.setItem(KUNCI, "1");
        } catch {}
        html.dataset.splash = "lewati";
        app?.removeAttribute("inert");
      };

      const keluar = (durasi: number) =>
        gsap.to(akar.current, {
          yPercent: -100,
          duration: durasi,
          ease: "power3.inOut",
          onComplete: selesai,
        });

      const garis = '[data-a="bingkai"],[data-a="progres"],[data-a="pencairan"]';
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set("[data-a]", { autoAlpha: 1 });
        gsap.set(garis, { drawSVG: "100%" });
        let pudar: gsap.core.Tween | undefined;
        const tunda = gsap.delayedCall(0.6, () => {
          pudar = gsap.to(akar.current, { autoAlpha: 0, duration: 0.2, onComplete: selesai });
        });
        lewatiRef.current = () => {
          tunda.kill();
          pudar?.kill();
          selesai();
        };
        return () => tunda.kill();
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set("[data-a]", { autoAlpha: 1 });
        gsap.set(garis, { drawSVG: "0%" });
        gsap.set('[data-a="patok"]', { y: -28, autoAlpha: 0 });
        gsap.set('[data-a="ukur"]', { scaleY: 0, transformOrigin: "50% 50%" });
        gsap.set('[data-a="judul"]', { yPercent: 100 });
        gsap.set('[data-a="sub"]', { autoAlpha: 0 });

        const tl = gsap.timeline({
          defaults: { ease: "power2.out" },
          onComplete: () => {
            keluar(0.5);
          },
        });

        tl.to('[data-a="bingkai"]', { drawSVG: "100%", duration: 0.55, stagger: 0.05, ease: "power2.inOut" }, 0)
          .to('[data-a="progres"]', { drawSVG: "100%", duration: 0.8, ease: "power2.inOut" }, 0.25)
          .to('[data-a="pencairan"]', { drawSVG: "100%", duration: 0.7, ease: "power2.inOut" }, 0.55)
          .to('[data-a="patok"]', { y: 0, autoAlpha: 1, duration: 0.25 }, 1.15)
          .to('[data-a="ukur"]', { scaleY: 1, autoAlpha: 1, duration: 0.25 }, 1.3)
          .to('[data-a="judul"]', { yPercent: 0, duration: 0.45 }, 1.3)
          .to('[data-a="sub"]', { autoAlpha: 1, duration: 0.3 }, 1.6)
          .to({}, { duration: 0.3 });

        lewatiRef.current = () => {
          tl.kill();
          keluar(0.25);
        };
        return () => tl.kill();
      });

      const tombol = (e: KeyboardEvent) => {
        if (e.key === "Escape" || e.key === "Enter") lewatiRef.current();
      };
      window.addEventListener("keydown", tombol);

      return () => {
        window.removeEventListener("keydown", tombol);
        mm.revert();
        app?.removeAttribute("inert");
      };
    },
    { scope: akar }
  );

  return (
    <div id="splash" ref={akar} role="dialog" aria-label="Pengantar GSTP">
      <button
        type="button"
        onClick={() => lewatiRef.current()}
        style={{
          position: "absolute", top: 16, right: 16, zIndex: 2, minHeight: 40, padding: "0 16px",
          background: "transparent", border: "1.5px solid var(--tinta)", borderRadius: 4,
          color: "var(--tinta)", font: "inherit", cursor: "pointer",
        }}
      >
        Lewati
      </button>

      <svg
        viewBox="0 0 960 540"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <g fill="none" stroke="var(--tinta)" strokeWidth="1.5">
          <rect data-a="bingkai" x="40" y="40" width="880" height="460" />
          <line data-a="bingkai" x1="560" y1="420" x2="920" y2="420" />
          <line data-a="bingkai" x1="560" y1="420" x2="560" y2="500" />
        </g>
        <path data-a="progres" d={JALUR_PROGRES} fill="none" stroke="var(--tinta)" strokeWidth="2.5" strokeLinejoin="round" />
        <path data-a="pencairan" d={JALUR_PENCAIRAN} fill="none" stroke="var(--air)" strokeWidth="2.5" strokeLinejoin="round" />
        <g data-a="ukur" stroke="var(--tinta)" strokeWidth="1.25" fill="none">
          <line x1={UKUR_X + 14} y1={UKUR_ATAS} x2={UKUR_X + 14} y2={UKUR_BAWAH} />
          <line x1={UKUR_X + 8} y1={UKUR_ATAS} x2={UKUR_X + 20} y2={UKUR_ATAS} />
          <line x1={UKUR_X + 8} y1={UKUR_BAWAH} x2={UKUR_X + 20} y2={UKUR_BAWAH} />
        </g>
        <g data-a="patok">
          <line x1={UJUNG.x} y1={UJUNG.y} x2={UJUNG.x} y2={UJUNG.y - 40} stroke="var(--tinta)" strokeWidth="2" />
          <polygon
            points={`${UJUNG.x},${UJUNG.y - 40} ${UJUNG.x + 26},${UJUNG.y - 33} ${UJUNG.x},${UJUNG.y - 24}`}
            fill="var(--patok)"
          />
        </g>
      </svg>

      <div style={{ position: "absolute", right: "7%", bottom: "9%", width: "34%", minWidth: 220 }}>
        <span style={{ display: "block", overflow: "hidden" }}>
          <span
            data-a="judul"
            style={{
              display: "block", fontFamily: "var(--font-judul)", fontWeight: 700,
              fontVariationSettings: '"wdth" 80', fontSize: "clamp(40px, 7vw, 64px)", lineHeight: 1.05,
            }}
          >
            GSTP
          </span>
        </span>
        <p data-a="sub" style={{ margin: "8px 0 0", fontSize: 15 }}>
          Prototipe pemeriksa alokasi Green Sukuk
          <br />
          <span style={{ color: "var(--redup)" }}>Data simulasi</span>
        </p>
      </div>
    </div>
  );
}
```

Catatan kode:
- Posisi kotak judul di SVG (garis di 560 sampai 920) dan teks HTML (kanan bawah) harus diselaraskan secara visual saat uji. Sesuaikan angka tanpa mengubah urutan animasi.
- Jika `gsap/DrawSVGPlugin` tidak ditemukan di versi yang terpasang, gunakan `strokeDasharray` dan `strokeDashoffset` dengan `getTotalLength()` sebagai pengganti.
- Teks "selisih" pada garis ukur ditambahkan sebagai elemen `text` di dalam grup `ukur` setelah ukuran dipastikan.

## 14. Dokumen terkait

- `docs/WEB_SPEC.md`: halaman, komponen, dan aturan teks.
- `CLAUDE.md`: aturan kerja dan larangan.
- `TASKS.md` Fase 9: urutan pengerjaan halaman.
