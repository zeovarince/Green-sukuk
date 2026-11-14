# WEB_SPEC (revisi)

> Versi revisi 2026-11-13, draf menunggu persetujuan pemilik. Menggantikan `WEB_SPEC.md` setelah disetujui. Revisi: REV-02, REV-09 sampai REV-13 (prinsip, peran, koreksi, bukti, keterangan ledger). Rincian di `PERUBAHAN_revisi.md`.

Spesifikasi landing statis dan halaman aplikasi GSTP. Landing berada di `web/public/`; halaman pemeriksaan dan komponen aplikasi berada di Next.js `web/app/`. Prioritas mengikuti `PRD.md`.

## 1. Prinsip

- Peringatan adalah prioritas pemeriksaan, bukan penetapan fraud. Kalimat ini tampil permanen di footer atau di dekat daftar peringatan.
- Setiap hasil menunjukkan alasannya: aturan mana yang terpicu, atau skor, ambang, dan pembanding.
- Data simulasi diberi tanda yang jelas di UI, misalnya lencana "Data simulasi" di header.
- Ledger selalu disebut simulasi. Halaman Ledger dan Periksa menampilkan keterangan tetap: "Ledger simulasi hash-chain di satu database. Rancangan penuh memakai permissioned blockchain antar lembaga."
- Aturan dan temuan menampilkan tag prinsip (Amanah atau Hifz al-mal) sebagai label teks, bukan hanya warna.
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
- Isi: tanggal, jenis pembayaran, nilai pencairan, progres fisik, milestone terverifikasi, persetujuan diperoleh, kelengkapan bukti, kategori hijau, akad (bawaan: akad terdaftar proyek), `project_id`.
- Bila "Simpan hasil ke ledger" dicentang, kolom Pengusul dan Verifikator muncul dan wajib.
- Opsi "Simpan hasil ke ledger" (butuh kode akses). Bawaan mati, jadi pemeriksaan tidak menulis apa-apa.
- Tombol contoh cepat: isi form dengan skenario dari `DEMO_SCRIPT.md`.

Hasil:
- Kartu keputusan: "Tidak ada peringatan baru" atau "Perlu diperiksa". Di bawahnya, status tindak lanjut: "Pemantauan berlanjut" atau "Telaah auditor".
- Daftar temuan aturan (kode, pesan, dan tag prinsip). Temuan `R08_AKAD` diberi keterangan bahwa telaah kesesuaian syariah dilakukan otoritas syariah.
- Jika lolos aturan: skor, ambang, dan penanda posisi skor di atas atau di bawah ambang.
- Pembanding dari riwayat kontrak: median pencairan sebelumnya, jumlah pencairan 7 hari, delta progres.
- Panel bukti: hash tercatat, hash dokumen saat ini, status cocok atau tidak, dan kelengkapan bukti terhadap ambang 0,80. Label tetap: "Dokumen asli tidak disimpan pada prototipe. Panel ini menampilkan hash dan kelengkapan."
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
- Panel bukti seperti di halaman Periksa.
- Alur tindak lanjut: tombol sesuai status saat ini dan sesuai peran (telaah, minta klarifikasi, tandai diklarifikasi, tetapkan tindak lanjut, tutup) dengan kolom catatan wajib untuk keputusan. Tombol di luar kewenangan peran tidak ditampilkan. Dalam mode satu kode, semua tombol sah tampil.
- Form koreksi, tampil untuk peran penyedia data bila status `perlu_klarifikasi`: kolom yang boleh diubah (terisi nilai lama), alasan, dan pengaju. Setelah dikirim, tampilkan hasil pemeriksaan ulang dan tautan ke transaksi baru.
- Bagian telaah syariah, tampil bila temuan memuat `R08_AKAD`: telaah terbaru dan riwayatnya. Peran otoritas syariah melihat form putusan (sesuai, tidak sesuai, perlu dokumen) dengan catatan.
- Riwayat status dari ledger, termasuk entri koreksi dan telaah syariah.
- Penanda peran aktif ditampilkan di dekat kolom kode akses, bersumber dari respons server, bukan dari pilihan pengguna.

## 6. Halaman Ledger

- Tabel entri terbaru dengan `seq`, jenis, waktu, dan hash terpotong (tampilkan penuh saat diarahkan).
- Tombol "Verifikasi rantai" untuk rentang atau penuh. Hasil: valid atau rusak di `seq` tertentu.
- Mode demo (tampil hanya jika `DEMO_MODE` aktif): pilih entri, rusak, verifikasi ulang, pulihkan.
- Keterangan tetap bahwa ini ledger simulasi hash-chain di satu database dan rancangan penuh memakai permissioned blockchain antar lembaga, dengan tautan ke halaman Tentang.
- Entri `koreksi` menampilkan tautan ke entri yang dikoreksi (`seq_dikoreksi`).

## 7. Halaman Evaluasi

- Tabel utama dan tabel recall per subtipe dari `/api/metrik`.
- Rata-rata dan simpangan baku beberapa seed.
- Catatan permanen: data simulasi, anomali disuntikkan, kelompok kontekstual dirancang lolos aturan.
- Tabel tambahan dari `/api/metrik`: waktu deteksi pola beruntun, kelengkapan tautan, biaya dan latensi, uji perusakan hash-chain melawan tabel log biasa, dan irisan uji konsep. Tiap tabel menyebut batasnya (`EVALUATION.md` bagian 4A sampai 4F).
- Tanggal dan versi data dari berkas hasil.

## 8. Halaman Riwayat Kontrak

- Ringkasan kontrak.
- Grafik progres fisik dan pencairan kumulatif dari waktu ke waktu.
- Tabel pencairan dengan penanda yang ditandai peringatan.

## 9. Halaman Tentang

- Alur GSTP (versi sederhana Gambar 1 esai).
- Tabel delapan aturan dengan prinsipnya (amanah, hifz al-mal).
- Pentahelix dengan fungsi pengawasan BPK dan otoritas syariah yang terpisah dari persetujuan operasional. Tabel menyebut bahwa prototipe memuat peran simulasi (penyedia data, auditor, pejabat berwenang, otoritas syariah) lewat kode akses, tanpa akun pengguna.
- Teks alur data menyebut delapan aturan.
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
- Perubahan status peringatan per peran, dan mode satu kode.
- Alur koreksi dan telaah syariah.
- Verifikasi ledger valid dan rusak.
- Keadaan kosong dan galat tiap halaman utama.
