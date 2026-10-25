# WEB_SPEC

Spesifikasi landing statis dan halaman aplikasi GSTP. Landing berada di `web/public/`; halaman pemeriksaan dan komponen aplikasi berada di Next.js `web/app/`. Prioritas mengikuti `PRD.md`.

## 1. Prinsip

- Peringatan adalah prioritas pemeriksaan, bukan penetapan fraud. Kalimat ini tampil permanen di footer atau di dekat daftar peringatan.
- Setiap hasil menunjukkan alasannya: aturan mana yang terpicu, atau skor, ambang, dan pembanding.
- Data simulasi diberi tanda yang jelas di UI, misalnya lencana "Data simulasi" di header.
- Halaman tidak berbicara langsung ke database. Semua lewat route API.

## 2. Peta halaman

| Rute | Nama | Prioritas | Isi |
|---|---|---|---|
| `/` | Landing GSTP | P0 | Cerita scroll berbasis data simulasi; alur pencairan, penyaringan, rantai, evaluasi, dan CTA pemeriksaan |
| `/ringkasan` | Ringkasan | P0 | Kartu: total transaksi, peringatan baru, status verifikasi ledger, versi model dan ambang |
| `/periksa` | Periksa Transaksi | P0 | Form dan hasil |
| `/peringatan` | Daftar Peringatan | P0 | Tabel dengan filter dan urutan |
| `/peringatan/[id]` | Detail Peringatan | P0 | Alasan, pembanding, tindak lanjut |
| `/ledger` | Ledger | P0 | Daftar entri, tombol verifikasi, mode demo |
| `/evaluasi` | Evaluasi | P0 | Tabel tiga pendekatan dan recall per subtipe |
| `/kontrak/[id]` | Riwayat Kontrak | P1 | Ringkasan dan grafik progres vs pencairan |
| `/tentang` | Tentang | P2 | Arsitektur, Pentahelix, keterbatasan |

## 3. Halaman Periksa Transaksi

Form:
- Pilih kontrak (pencarian berdasarkan ID). Setelah dipilih, tampilkan ringkasan kontrak: nilai, pagu, kumulatif cair, progres terakhir, tanggal pencairan terakhir.
- Isi: tanggal, jenis pembayaran, nilai pencairan, progres fisik, milestone terverifikasi, persetujuan diperoleh, kelengkapan bukti, kategori hijau, `project_id`.
- Opsi "Simpan hasil ke ledger" (butuh kode akses). Bawaan mati, jadi pemeriksaan tidak menulis apa-apa.
- Tombol contoh cepat: isi form dengan skenario dari `DEMO_SCRIPT.md`.

Hasil:
- Kartu keputusan: "Tidak ada peringatan baru" atau "Perlu diperiksa".
- Daftar temuan aturan (kode dan pesan).
- Jika lolos aturan: skor, ambang, dan penanda posisi skor di atas atau di bawah ambang.
- Pembanding dari riwayat kontrak: median pencairan sebelumnya, jumlah pencairan 7 hari, delta progres.
- Waktu proses dalam milidetik.
- Jika disimpan: nomor entri ledger dan hash terakhir.

Keadaan khusus: memuat, galat validasi per kolom, kontrak tidak ditemukan, galat server dengan pesan ramah dan tombol coba lagi.

## 4. Halaman Daftar Peringatan

- Kolom: waktu, kontrak, jenis (aturan, skor, keduanya), ringkasan alasan, skor, status.
- Filter: status, jenis, kontrak. Urutan: skor tertinggi, waktu terbaru.
- Paginasi.
- Baris membuka halaman detail.

## 5. Halaman Detail Peringatan

- Data transaksi.
- Panel alasan: temuan aturan, atau skor dan ambang.
- Panel pembanding dari riwayat kontrak, dengan catatan singkat bahwa ini konteks, bukan penyebab pasti.
- Alur tindak lanjut: tombol sesuai status saat ini (telaah, minta klarifikasi, tandai diklarifikasi, tetapkan tindak lanjut, tutup) dengan kolom catatan wajib untuk keputusan.
- Riwayat status dari ledger.

## 6. Halaman Ledger

- Tabel entri terbaru dengan `seq`, jenis, waktu, dan hash terpotong (tampilkan penuh saat diarahkan).
- Tombol "Verifikasi rantai" untuk rentang atau penuh. Hasil: valid atau rusak di `seq` tertentu.
- Mode demo (tampil hanya jika `DEMO_MODE` aktif): pilih entri, rusak, verifikasi ulang, pulihkan.
- Penjelasan singkat bahwa ini ledger simulasi dan batasannya, dengan tautan ke halaman Tentang.

## 7. Halaman Evaluasi

- Tabel utama dan tabel recall per subtipe dari `/api/metrik`.
- Rata-rata dan simpangan baku beberapa seed.
- Catatan permanen: data simulasi, anomali disuntikkan, kelompok kontekstual dirancang lolos aturan.
- Tanggal dan versi data dari berkas hasil.

## 8. Halaman Riwayat Kontrak

- Ringkasan kontrak.
- Grafik progres fisik dan pencairan kumulatif dari waktu ke waktu.
- Tabel pencairan dengan penanda yang ditandai peringatan.

## 9. Halaman Tentang

- Alur GSTP (versi sederhana Gambar 1 esai).
- Pentahelix dengan fungsi pengawasan BPK dan otoritas syariah yang terpisah dari persetujuan operasional.
- Daftar keterbatasan dari `LIMITATIONS.md`.

## 10. Aturan teks UI

- Bahasa Indonesia yang lugas dan sopan.
- Jangan memakai kata "fraud", "terbukti", "pelanggar" untuk hasil sistem. Gunakan "peringatan", "temuan", "perlu diperiksa".
- Jangan memakai tanda pisah em dash di teks apa pun. Pakai titik, koma, atau titik dua.
- Hindari frasa klise ala AI ("mari kita", "dalam era digital ini", "solusi inovatif"). Tulis yang dikerjakan halaman itu, singkat.
- Angka rupiah memakai pemisah titik dan awalan Rp, dengan singkatan juta, miliar, dan triliun pada tampilan ringkas.
- Tanggal ditampilkan dengan nama bulan Indonesia.
- Pesan galat menyebut apa yang salah dan apa yang bisa dilakukan.

Contoh teks:
- Judul hasil: "Perlu diperiksa" atau "Tidak ada peringatan baru".
- Keterangan: "Peringatan ini menentukan urutan pemeriksaan. Keputusan tetap di tangan pejabat berwenang."
- Verifikasi gagal: "Rantai rusak pada entri 1.204. Entri sebelumnya masih konsisten."

## 11. Aksesibilitas dan tampilan

- Kontras warna memadai, status tidak hanya dibedakan dengan warna (tambahkan teks atau ikon).
- Tabel dapat digulir di layar sempit.
- Semua tombol dan kolom form punya label.
- Dapat dipakai di ponsel untuk demo, tetapi prioritas tampilan laptop.

## 12. Tes tampilan minimum

- Alur periksa transaksi normal dan transaksi bermasalah.
- Perubahan status peringatan.
- Verifikasi ledger valid dan rusak.
- Keadaan kosong dan galat tiap halaman utama.
