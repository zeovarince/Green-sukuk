# Landing Page Three.js GSTP

Spesifikasi landing page 3D GSTP mandiri dengan HTML, CSS, JavaScript, dan Three.js. Landing tampil di `/` sebelum pengunjung menuju aplikasi Next.js melalui `/periksa`, `/peringatan`, `/ledger`, `/evaluasi`, atau `/ringkasan`. Dokumen ini melengkapi `docs/DESIGN.md`.

Status: landing mandiri dengan palet terang GSTP diterapkan di `web/public/`. Next.js tetap dipakai untuk halaman aplikasi. Typecheck dan sintaks JavaScript lulus. Percobaan build terbaru tertahan oleh `EPERM` saat Next.js menghapus cache `.next` di folder OneDrive; pemeriksaan visual lintas perangkat dan Lighthouse belum dilakukan.

## 1. Tujuan

1. Memperkenalkan GSTP dalam satu kali scroll: pencairan dibandingkan dengan progres, lalu aturan, skor, peringatan, dan ledger.
2. Membuat pengunjung (juri, pembaca esai) ingin mencoba sistem, lewat tombol "Periksa transaksi".
3. Menampilkan data simulasi dan hasil evaluasi prototipe sebagai grafik yang membantu pengunjung memahami alurnya.

Bukan tujuan: mengganti dashboard, menjadi game, atau memamerkan efek.

## 2. Ringkasan keputusan

| Hal | Keputusan |
|---|---|
| Rute | Landing menjadi `/`. Dashboard Ringkasan yang sekarang pindah ke `/ringkasan` |
| Splash screen lama | Dinonaktifkan. Landing punya pembuka sendiri |
| Teknologi 3D | Three.js JavaScript module secara langsung, tanpa React Three Fiber |
| Halaman landing | `web/public/index.html`, `landing.css`, dan `landing.js`; tanpa React atau hidrasi Next.js |
| Hubungan rute | Next.js menyajikan rute aplikasi; `/` menampilkan berkas statis landing dari `public/` |
| Scroll | JavaScript biasa membaca posisi bab. Scroll tidak dibajak |
| Data | Berkas JSON statis hasil ekspor Python, bukan query database |
| Aset | Tanpa model 3D atau tekstur eksternal. Semua geometri dibuat dengan kode |
| Cadangan | Versi statis tanpa WebGL untuk perangkat lemah, mode kurang gerak, atau pengguna yang mematikan 3D |
| Teks | Seluruh teks landing adalah HTML nyata, kanvas hanya pelengkap |

Alasan data statis: landing harus tetap tampil walau proyek Supabase sedang dijeda (paket gratis dijeda saat tidak aktif).

## 3. Konsep visual

Dunia 3D memakai panggung terang seperti lembar `--lembar` dari `DESIGN.md`, dengan ruang kosong dan tipografi besar yang ringan. Bab pembuka menampilkan konstelasi tiga dimensi berbentuk dua belahan otak, dibuat dari titik dan lipatan garis hijau-teal. Bentuk itu hanya metafora untuk membaca pola, bukan diagram arsitektur Isolation Forest atau representasi literal data otak. Warna peringatan dan merah mengikuti aturan semantik GSTP. Bab selanjutnya memakai grafik kurva, awan transaksi, gerbang pemeriksaan, ledger, dan hasil evaluasi yang bersumber dari JSON simulasi. Referensi Dala memberi arah pada susunan panggung dan motif otak; latar hitam, ungu, isi, dan identitas visualnya tidak dipakai.

Aturan keras:
- Adegan otak dinyatakan jelas sebagai metafora visual. Grafik pada bab lain tetap menampilkan data prototipe.
- Latar terang `#F7F8F5`; teks utama `#12262A`; aksen utama hijau-teal `#0E5A5F`.
- Jingga `#B8450B` hanya untuk peringatan; merah `#A3191F` hanya untuk tautan ledger yang putus.
- Bentuk memakai geometri dan material sederhana dari kode lokal, tanpa model atau tekstur eksternal, bloom, atau warna ungu.
- Gerak lembut hanya pada bab yang aktif. Tidak ada scroll yang dikunci atau musik otomatis.

## 4. Alur halaman (bab saat scroll)

Panjang scroll sekitar enam sampai tujuh tinggi layar. Kemajuan scroll `p` berkisar 0 sampai 1.

| Bab | Rentang `p` | Judul (HTML) | Adegan 3D | Data |
|---|---|---|---|---|
| 0 | 0,00 sampai 0,14 | Pembuka | Konstelasi otak konseptual dari partikel dan garis lipatan | Tidak mewakili data model |
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

### Bab 0: konstelasi otak konseptual
- Dua belahan organik dibentuk dari geometri, titik faceted, dan garis lipatan berwarna hijau-teal. Beberapa titik amber memberi aksen, bukan label anomali nyata.
- Catatan HTML menyatakan bentuk ini metafora visual, bukan arsitektur model GSTP.
- Adegan bergerak perlahan saat bab pembuka aktif; preferensi kurang gerak dan tombol 3D tetap dihormati.

### Bab 1: dua kurva
- Garis progres fisik (`--tinta`) dan pencairan kumulatif (`--air`) berasal dari data kontrak contoh.
- Penanda selisih memakai garis ukur dan kerucut kecil `--patok`; angka selisih ditampilkan sebagai HTML.
- Poster SVG statis diperbarui dari data kurva ketika JavaScript aktif.

### Bab 2: awan transaksi
- Titik `Points` dibentuk dari JSON; warna normal diredam dan transaksi yang ditandai memakai `--patok`.
- Keterangan HTML menyebut ukuran sampel dan bahwa proporsi anomali pada sampel lebih tinggi dari data sumber.

### Bab 3: aturan lalu skor
- Dua bingkai tipis mewakili gerbang aturan dan skor.
- Titik dari setiap tahap dikelompokkan pada sisi bingkai; jumlah transaksi dan ambang ditulis di HTML.

### Bab 4: rantai
- Blok ledger bertaut dengan satu garis putus-putus merah `--rusak`.
- Label HTML menyebut nomor entri dari data dan menjelaskan bahwa rantai ini hanya ilustrasi.

### Bab 5: hasil
- Tiga batang menunjukkan F1; tabel HTML menampilkan precision, recall, F1, FAR, dan peringatan per 1.000.
- Teks keterbatasan wajib mengikuti hasil evaluasi: "Data simulasi. Anomali kontekstual dirancang lolos dari aturan. Pada seed ini hybrid tidak unggul secara keseluruhan."

### Bab 6: ajakan
- Kamera berhenti pada bingkai lembar dengan kotak judul (versi model, ambang, penanda data simulasi).
- Tombol utama "Periksa transaksi" ke `/periksa`. Tombol sekunder "Lihat ringkasan" ke `/ringkasan`.
- Footer di bawahnya (bagian 10).

## 6. Tombol CTA

- CTA utama: "Periksa transaksi", tautan HTML ke `/periksa` pada bab terakhir.
- Navigasi header menuju Ringkasan. Landing dan aplikasi merupakan halaman berbeda.
- Satu aksi utama per layar. Tidak ada banyak tombol bersaing.
- Fokus keyboard terlihat. Tombol bisa dijangkau tanpa melewati seluruh halaman (lihat tautan lewati di bagian 9).

## 7. Teks landing

Bahasa Indonesia lugas, tanpa em dash, tanpa frasa klise. Angka dalam kurung kurawal diambil dari data.

| Tempat | Teks |
|---|---|
| H1 | "Telusuri jejak dana Green Sukuk hingga progres proyek." |
| Sub | "Kurva pencairan, aturan pemeriksaan, skor anomali, dan ledger membantu menyoroti transaksi yang perlu ditinjau." |
| Catatan visual | "Bentuk otak adalah metafora visual, bukan arsitektur model GSTP." |
| Bab 1 | "Kontrak contoh {kontrak_id} memiliki selisih {selisih} poin persentase pada titik yang ditandai." |
| Bab 2 | "{total} transaksi simulasi dibuat, termasuk {anomali} anomali sintetis." |
| Bab 3 | "Tujuh aturan dijalankan lebih dahulu. Transaksi yang lolos aturan dinilai dengan Isolation Forest. Ambang hybrid {ambang}." |
| Bab 4 | "Setiap kejadian dicatat dalam rantai hash. Jika satu catatan diubah, verifikasi menunjukkan di mana rantai rusak." |
| Bab 5 | "Tiga pendekatan diuji pada data pengujian. Hasil di bawah berlaku untuk data simulasi." |
| Bab 6 | "Lanjutkan ke pemeriksaan transaksi." |
| Tombol | "Periksa transaksi" dan "Lihat ringkasan" |
| Penanda | "Prototipe dengan data simulasi" (selalu terlihat di bagian pembuka) |
| Kaki halaman | "Peringatan anomali menjadi prioritas pemeriksaan, bukan penetapan fraud." |

## 8. Data

Dihasilkan skrip baru `ml/export_landing_data.py` dari data simulasi dan hasil model. Hasilnya ditulis ke `web/public/landing-data/`. Semua berkas memuat `dibuat_pada`, `seed`, dan `"simulasi": true`.

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
Dipilih oleh JavaScript landing dari jenis input perangkat dan kemampuan WebGL.

| Tingkat | Kondisi | DPR maksimal | Titik maksimal |
|---|---|---|---|
| tinggi | Desktop | 1,5 | 6.000 |
| sedang | Ponsel biasa | 1,25 | 2.200 |
| statis | Tanpa WebGL, mode kurang gerak, mode hemat data, atau 3D dimatikan pengguna | tidak ada | tidak ada |

### Anggaran dan aturan
- Modul Three.js dimuat dengan `import()` browser langsung dari `public/vendor/three/`; halaman Next.js tidak mengimpor atau membundelnya.
- Tanpa pascaproses, tanpa peta bayangan, tanpa model atau tekstur eksternal.
- Render berjalan saat bab berganti, ukuran layar berubah, atau kamera masih bergerak menuju posisi bab.
- Tab tersembunyi menghentikan render. Gerak kamera memakai `requestAnimationFrame` hanya selama perpindahan.
- Target pengukuran, bukan janji: LCP teks utama kurang dari 2,5 detik pada jaringan 4G terukur, tanpa pergeseran tata letak. Gerak kamera berjalan mulus pada ponsel kelas menengah. Ukur dan catat hasilnya.

### Versi statis
- Poster SVG kurva-S ganda (memakai `kurvaS.ts`) menggantikan adegan 3D.
- HTML, tautan, tabel, dan kredit tim tetap tampil meski JavaScript atau WebGL tidak aktif.
- Poster SVG kurva menjadi pengganti visual saat adegan 3D tidak aktif. Jika JavaScript hidup, bentuk kurva poster diperbarui dari JSON lokal.
- Angka tabel diisi JavaScript dari JSON lokal; teks penjelas, navigasi bab, CTA, dan poster tetap tersedia tanpa Three.js.

### Aksesibilitas
- Kanvas diberi `aria-hidden="true"`. Semua isi bermakna ada di HTML dalam urutan baca yang benar.
- Tautan "Lewati ke tombol periksa" sebagai fokus pertama.
- Tombol "Matikan adegan 3D". Pilihan disimpan di `localStorage` dengan kunci `gstp-3d`.
- Mode kurang gerak otomatis memakai versi statis.
- Scroll tidak dibajak dan tidak diperlambat. Tidak ada pengunci zoom pada viewport.
- Status tidak hanya dibedakan dengan warna. Selalu ada teks.
- Kontras teks mengikuti `DESIGN.md` bagian 11.
- Rel bab bisa dioperasikan dengan keyboard.

## 10. Footer hak cipta

Teks:

```
© 2026 tim GSTP. Prototipe esai Universitas Trunojoyo Madura. Data simulasi.
M. Hendrik Purwanto · Nana Adelia Saputri · A. Choiril Anwar EL-Asfihani Risydan
```

Aturan:
- Nama ditulis sesuai daftar yang diberikan tim; landing statis mencantumkannya di `web/public/index.html`, footer aplikasi membacanya dari `web/lib/tim.ts`.
- Periksa pedoman kompetisi. Jika penjurian dilakukan buta, nama di situs publik dapat membuka identitas tim. Dalam kasus itu, jangan tampilkan nama sampai penjurian selesai.
- Nama dan foto tim yang sama tampil di landing statis dan footer aplikasi; footer aplikasi membacanya dari `web/lib/tim.ts`.
- Tanda hak cipta di sini adalah pernyataan kepemilikan karya tim. Ini bukan nasihat hukum.

## 11. Struktur file

```
web/
  public/
    index.html                landing HTML mandiri
    landing.css               gaya halaman landing
    landing.js                adegan Three.js langsung
    landing-data/*.json       data simulasi lokal
    tim/*.jpeg                foto anggota
    vendor/three/*.js         modul Three.js lokal
  app/                        halaman pemeriksaan dan aplikasi Next.js
    ringkasan/page.tsx        dashboard yang dulu di /
  components/Footer.tsx       footer halaman aplikasi
  lib/tim.ts                  nama tim untuk footer aplikasi
  data/artifacts/*.json
  next.config.ts              rewrite `/` ke berkas statis `/index.html`
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
| GSAP hanya di lima tempat | Landing mandiri memakai JavaScript biasa, tanpa GSAP |
| ScrollTrigger tidak dipakai | Tetap tidak dipakai; bab aktif dibaca dari posisi scroll |
| Boldness hanya di kurva-S dan splash | Landing boleh lebih ekspresif, tetapi tetap memakai token dan konsep lembar gambar |
| Splash screen di `/` | Dinonaktifkan; landing statis menjadi halaman pembuka |
| Gaya visual | Landing memakai panggung terang, tipografi lega, dan metafora otak; semua halaman mengikuti palet terang GSTP dari `DESIGN.md` |
| Daftar periksa anti-AI-slop | Tetap berlaku (bagian 13 di sini menambahkan butir khusus 3D) |

## 13. Daftar periksa

Anti-AI-slop khusus landing 3D:
- [x] Tidak ada cahaya neon, bloom, atau gradasi ungu.
- [x] Konstelasi otak dinyatakan sebagai metafora; visualisasi data pada bab lain memakai data simulasi lokal.
- [x] Tidak ada teks di dalam kanvas. Semua teks adalah HTML.
- [x] Tidak ada teks hero berisi slogan kosong. H1 menjelaskan apa yang dilakukan sistem.
- [x] Teks tiap bab tetap terlihat tanpa bergantung pada adegan.
- [x] Tidak ada em dash pada teks landing.
- [x] Angka di teks berasal dari berkas data.

Fungsi dan perangkat:
- [x] HTML dan isi halaman tetap terlihat saat JavaScript atau WebGL tidak tersedia.
- [x] Modul Three.js dimuat langsung dari `public/vendor/three/` hanya saat WebGL tersedia dan pengguna tidak meminta mode statis.
- [x] CTA menuju `/periksa`, tombol sekunder menuju `/ringkasan`.
- [x] Footer landing memuat nama dan foto tim.
- [x] Halaman aplikasi tetap dirender oleh Next.js pada rutenya masing-masing.
- [ ] Diuji di desktop, satu ponsel Android kelas menengah, dan satu ponsel iPhone bila tersedia.
- [ ] Diuji dengan Supabase dijeda: landing tetap tampil penuh.
- [ ] Lighthouse atau pengukuran serupa dijalankan dan hasilnya dicatat.

## 14. Batas teknologi

- Browser membuka / sebagai public/index.html, bukan halaman atau komponen React.
- next.config.ts menulis ulang / ke /index.html. Halaman aplikasi Next.js tetap berada pada rute seperti /periksa dan /ringkasan.
- public/landing.js mengambil JSON lokal dan memuat modul Three.js setelah pemeriksaan WebGL, mode hemat data, dan preferensi gerak.
- HTML, tabel, poster SVG, tautan, dan kredit tim tersedia sebelum adegan 3D aktif.
- three.module.js, three.core.js, dan lisensi disalin dari paket npm Three.js ke public/vendor/three/.

## 15. Urutan pengerjaan

Fase ini tercatat di docs/TASKS.md sebagai Fase 9b.

1. [x] Ekspor empat berkas JSON ke web/public/landing-data dan validasi ukuran.
2. [x] Sajikan landing dari HTML statis di /; aplikasi tetap memakai rute Next.js.
3. [x] Bangun HTML bab, poster SVG, tabel, CTA, dan footer agar tetap terbaca tanpa WebGL.
4. [x] Tambahkan pemeriksaan kemampuan perangkat, tombol 3D, dan pembaca scroll dengan JavaScript biasa.
5. [x] Bangun adegan kurva dan penanda selisih.
6. [x] Bangun awan transaksi dan dua gerbang penyaringan.
7. [x] Bangun contoh rantai ledger dan grafik evaluasi.
8. [x] Hubungkan CTA ke /periksa dan /ringkasan.
9. [x] Tambahkan nama dan foto tim pada landing statis dan footer aplikasi.
10. [ ] Periksa landing di perangkat desktop dan ponsel serta catat pengukuran Lighthouse.
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
- Halaman `/` berupa `public/index.html` dengan JavaScript dan Three.js langsung; dashboard Ringkasan tersedia di `/ringkasan`.
- HTML, poster SVG, tabel, dan tautan tetap tersedia dalam mode statis. Modul Three.js berasal dari berkas lokal.
- Landing memakai foto di `public/tim/`; footer aplikasi membaca nama dari `web/lib/tim.ts`.
- Gaya visual memakai panggung terang GSTP, konstelasi otak sebagai metafora pembuka, grafik data pada bab berikutnya, dan CTA akhir menuju `/periksa`.
- Pemeriksaan terakhir: `npm run typecheck` dan `npm run build` lulus. Visual desktop/ponsel dan Lighthouse belum diperiksa.
