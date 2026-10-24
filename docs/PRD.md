# PRD: Prototipe GSTP

Status: draf awal, Oktober 2026
Pemilik: tim penulis esai GSTP (Universitas Trunojoyo Madura)

## 1. Latar belakang

Green Sukuk dijanjikan membiayai proyek hijau, tetapi keterlacakan alokasi dana bergantung pada laporan yang disusun setelah dana dicairkan. Esai GSTP mengusulkan protokol yang memeriksa alokasi sejak pencairan terjadi dengan tiga unsur: aturan deterministik, skor anomali, dan catatan yang tertaut hash. Prototipe ini membuktikan bahwa alur tersebut dapat dibangun dan memberi bukti awal pada data simulasi.

## 2. Tujuan

1. Menunjukkan alur lengkap GSTP: data masuk, pemeriksaan aturan, skor anomali, daftar peringatan, tindak lanjut, dan catatan hash-chain.
2. Menghasilkan angka evaluasi untuk tiga pendekatan (aturan saja, Isolation Forest saja, hybrid) yang bisa dimasukkan ke esai.
3. Menyediakan demo web live di Vercel yang dapat dipakai juri untuk menguji transaksi baru.

## 3. Bukan tujuan

- Menjalankan jaringan Hyperledger Fabric sungguhan.
- Memakai data riil Kementerian Keuangan atau kementerian pelaksana.
- Menetapkan fraud. Sistem hanya memprioritaskan pemeriksaan.
- Autentikasi, peran pengguna, dan otorisasi tingkat produksi.
- Menyimpan dokumen asli. Prototipe hanya menyimpan hash sebagai pengganti dokumen.
- Mengklaim performa yang berlaku di data riil.

## 4. Pengguna dan skenario

| Peran | Kebutuhan | Fitur utama |
|---|---|---|
| Auditor | Melihat transaksi yang perlu diperiksa lebih dulu beserta alasannya | Daftar peringatan, detail, pembanding |
| Pengelola atau verifikator | Menjawab klarifikasi dan memperbarui bukti | Status kasus, catatan |
| Pejabat penetap tindak lanjut | Mencatat keputusan dengan jejak yang jelas | Status akhir, ledger |
| Juri atau pembaca esai | Mencoba sistem dan melihat hasil evaluasi | Form periksa, halaman evaluasi, verifikasi ledger |

Pada prototipe, semua peran dipakai oleh satu antarmuka tanpa login. Pemisahan peran ditampilkan sebagai konsep di halaman Tentang.

## 5. Fitur dan prioritas

| Kode | Fitur | Prioritas |
|---|---|---|
| F1 | Periksa transaksi baru (tujuh aturan dan skor) | P0 |
| F2 | Daftar peringatan dengan filter dan urutan prioritas | P0 |
| F3 | Detail peringatan dengan alasan aturan atau skor dan pembanding | P0 |
| F4 | Status kasus dan catatan tindak lanjut | P0 |
| F5 | Ledger hash-chain dengan verifikasi rantai | P0 |
| F6 | Halaman evaluasi tiga pendekatan | P0 |
| F7 | Riwayat kontrak dengan grafik progres dan pencairan | P1 |
| F8 | Mode demo perusakan entri untuk menunjukkan verifikasi gagal | P1 |
| F9 | Halaman Tentang (arsitektur, Pentahelix, keterbatasan) | P2 |

## 6. Kebutuhan fungsional

- FR-1: Sistem menghitung fitur turunan dari riwayat kontrak di database, bukan dari input pengguna.
- FR-2: Sistem menjalankan tujuh aturan di `docs/RULES.md` dan mengembalikan kode aturan beserta pesan.
- FR-3: Transaksi yang lolos aturan dinilai Isolation Forest. Transaksi yang melanggar aturan tetap masuk daftar peringatan tanpa perlu skor.
- FR-4: Setiap transaksi yang disimpan, setiap peringatan, dan setiap perubahan status menambah satu entri ledger.
- FR-5: Verifikasi ledger menghitung ulang rantai dan menyebut nomor entri pertama yang rusak.
- FR-6: Koreksi data dicatat sebagai entri baru. Entri lama tidak diubah.
- FR-7: Hasil evaluasi ditampilkan dari berkas hasil Python, bukan dihitung ulang di web.

## 7. Kebutuhan non-fungsional

- NFR-1: Berjalan di Vercel dengan Supabase. Tidak ada server lain yang harus dihidupkan.
- NFR-2: Satu pemeriksaan transaksi selesai dalam waktu yang nyaman untuk demo. Target awal 2 detik pada kondisi normal, diukur dan dilaporkan, bukan dijamin.
- NFR-3: Hasil TypeScript sama dengan Python pada `golden_cases.json` dalam toleransi `docs/EXPORT_SPEC.md`.
- NFR-4: Kunci rahasia tidak pernah sampai ke browser.
- NFR-5: Hasil eksperimen dapat diulang dengan seed yang sama.

## 8. Kriteria berhasil

1. Alur F1 sampai F6 berjalan di URL Vercel publik.
2. Tes kesesuaian Python dan TypeScript lulus.
3. Evaluasi tiga pendekatan dilaporkan lengkap dengan metrik di `docs/EVALUATION.md` pada data pengujian, termasuk recall per subtipe anomali dan hasil beberapa seed.
4. `docs/LIMITATIONS.md` memuat semua keterbatasan, dan esai menyebutnya.
5. Skenario di `docs/DEMO_SCRIPT.md` dapat dijalankan dari awal sampai akhir.

Tidak ada target angka recall atau precision yang ditetapkan lebih dulu. Angka dilaporkan apa adanya.

## 9. Risiko

| Risiko | Dampak | Penanganan |
|---|---|---|
| Proyek Supabase gratis dijeda saat tidak aktif | Demo gagal | Aktifkan dan uji sehari sebelumnya, lihat `docs/DEPLOY.md` |
| Perbedaan hasil Python dan TypeScript | Skor demo tidak sama dengan evaluasi | Tes kesesuaian wajib lulus |
| Anomali sintetis terlalu mudah | Hasil terlihat terlalu bagus | Sebut sebagai keterbatasan, jalankan beberapa seed |
| Waktu mepet | Fitur tidak selesai | Kerjakan sesuai prioritas P0 dulu |
| Siapa saja bisa menulis ke database lewat URL publik | Data demo rusak | Kode akses sederhana dan pembatasan laju, lihat `docs/API_SPEC.md` |

## 10. Asumsi

- Data simulasi dibuat oleh `ml/generate_gstp_data.py` dengan parameter di `docs/DATA_SPEC.md`.
- Ambang persetujuan dan daftar kategori sah adalah asumsi penulis.
- Dokumen asli tidak diperlukan karena pengecekan integritas memakai hash.
