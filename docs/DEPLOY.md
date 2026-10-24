# DEPLOY

Langkah menjalankan prototipe di Vercel dengan database Supabase, dan daftar periksa sebelum demo. Beberapa angka batas layanan berasal dari sumber pihak ketiga per Oktober 2026. Periksa halaman resmi Vercel dan Supabase sebelum bergantung padanya.

## 1. Prasyarat

- Akun GitHub dengan repo berisi struktur di `README.md`.
- Akun Vercel dan akun Supabase.
- Node.js versi LTS di laptop, Python 3.12 untuk `ml/`.
- Fase 1 sampai 5 di `TASKS.md` selesai, sehingga artefak ada di `ml/artifacts/`.

## 2. Siapkan Supabase

1. Buat proyek baru. Pilih region yang dekat dengan region fungsi Vercel yang akan dipakai (misalnya Singapura), supaya latensi kecil.
2. Aktifkan ekstensi `pgcrypto` (untuk fungsi `digest`).
3. Jalankan `supabase/schema.sql` di SQL Editor atau lewat `psql`.
4. Impor data sesuai `DATABASE_SPEC.md` bagian 5: registri, transaksi, lalu ledger awal.
5. Verifikasi: jumlah baris cocok dengan CSV, dan verifikasi ledger penuh menyatakan valid.
6. Catat dua nilai dari pengaturan API: URL proyek dan service role key. Service role key rahasia.

Batas yang perlu diingat (paket gratis, menurut sumber pihak ketiga): sekitar 500 MB database per proyek, dan proyek dijeda otomatis setelah 7 hari tidak aktif. Proyek yang dijeda harus diaktifkan lagi secara manual dari dashboard.

## 3. Variabel lingkungan

| Variabel | Isi | Catatan |
|---|---|---|
| `SUPABASE_URL` | URL proyek | Boleh publik, tetapi hanya dipakai server |
| `SUPABASE_SERVICE_ROLE_KEY` | Kunci service role | Rahasia. Jangan pakai awalan `NEXT_PUBLIC_` |
| `DEMO_PASSCODE` | Kode akses penulisan | Pilih acak dan panjang |
| `DEMO_MODE` | `true` atau `false` | `true` hanya di lingkungan demo |

Simpan di `web/.env.local` untuk lokal (jangan di-commit) dan di pengaturan Environment Variables Vercel untuk produksi.

## 4. Siapkan `web/`

- `next.config` menyertakan `data/artifacts/*.json` ke bundle fungsi lewat `outputFileTracingIncludes`, supaya berkas model terbaca di produksi. Uji di build produksi, bukan hanya di `npm run dev`.
- Route API memakai runtime Node.js (`export const runtime = "nodejs"`).
- Jangan menyertakan CSV besar (`transaksi_gstp.csv`) ke dalam `web/`.
- Salin artefak: `ml/artifacts/*.json` ke `web/data/artifacts/`.

## 5. Deploy ke Vercel

1. Impor repo GitHub di Vercel.
2. Atur Root Directory ke `web`.
3. Framework terdeteksi Next.js. Pakai pengaturan build bawaan.
4. Isi variabel lingkungan (bagian 3).
5. Pilih region fungsi yang dekat dengan region Supabase.
6. Deploy. Buka URL yang diberikan.

Setelah deploy:
- Buka `/api/metrik`, harus mengembalikan hasil evaluasi.
- Jalankan satu pemeriksaan dengan `simpan: false` dari halaman Periksa.
- Jalankan verifikasi ledger rentang kecil.

## 6. Batas waktu fungsi

Fungsi serverless punya batas waktu eksekusi yang bergantung pada paket Vercel. Verifikasi ledger penuh pada puluhan ribu entri bisa melewatinya. Karena itu:
- UI memanggil verifikasi per rentang (misalnya 5.000 entri per panggilan) dan menyatukan hasilnya.
- Verifikasi penuh juga tersedia lewat skrip Python di laptop.
Cek batas waktu aktual di dokumentasi Vercel dan ukur sebelum demo.

## 7. Daftar periksa sebelum demo (lakukan sehari sebelumnya, ulangi satu jam sebelumnya)

- [ ] Proyek Supabase aktif, tidak dalam status dijeda.
- [ ] URL Vercel terbuka dan halaman Ringkasan memuat data.
- [ ] `/api/metrik` mengembalikan hasil terbaru.
- [ ] Tes kesesuaian Python dan TypeScript lulus di commit yang dideploy.
- [ ] Verifikasi ledger penuh valid.
- [ ] Semua skenario `DEMO_SCRIPT.md` dijalankan di URL publik dan hasilnya dicatat.
- [ ] `DEMO_MODE=true` hanya di lingkungan yang dipakai demo, dan mode demo dipulihkan setelah latihan perusakan.
- [ ] Kode akses disimpan di tempat yang bisa dibuka cepat saat demo.
- [ ] Ada cadangan: rekaman layar demo dan tangkapan layar hasil evaluasi.
- [ ] Ada rencana jika internet bermasalah: jalankan `npm run dev` di laptop dengan database yang sama.

## 8. Keamanan dan kebersihan

- Pastikan `.env*` ada di `.gitignore` dan tidak pernah ter-commit. Jika kunci pernah ter-commit, putar (rotate) kuncinya di Supabase.
- Setelah kompetisi atau penjurian selesai, matikan `DEMO_MODE`, ganti `DEMO_PASSCODE`, dan pertimbangkan menjeda atau menghapus proyek jika tidak dipakai lagi.

## 9. Masalah umum

| Gejala | Kemungkinan sebab |
|---|---|
| Semua route galat 500 setelah beberapa hari | Proyek Supabase dijeda, aktifkan lagi |
| Skor di produksi berbeda dari lokal | Artefak lama ikut ter-bundle, atau versi `model_if.json` tidak sama. Jalankan ulang ekspor dan tes kesesuaian |
| Berkas artefak tidak ditemukan di produksi | `outputFileTracingIncludes` belum mencakup folder artefak |
| Verifikasi ledger gagal pada entri yang tidak dirusak | Kanonikalisasi payload berbeda antara pembuat dan verifikator, lihat `LEDGER_SPEC.md` bagian 4 |
| Galat saat memanggil `tambah_ledger` | Ekstensi `pgcrypto` belum aktif, atau hak eksekusi tidak sesuai |
