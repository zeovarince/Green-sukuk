# CLAUDE.md (revisi)

> Versi revisi 2026-11-13, draf menunggu persetujuan pemilik. Menggantikan `CLAUDE.md` setelah disetujui. Revisi: REV-01, REV-04, REV-09 (delapan aturan, split per proyek, peran). Rincian di `PERUBAHAN_revisi.md`.

Instruksi untuk tool ngoding (Claude Code atau sejenisnya) pada repo ini. Baca file ini dulu di setiap sesi, lalu `PRD.md`, `ARCHITECTURE.md`, dan `TASKS.md`. Baca spesifikasi di `docs/` hanya yang relevan dengan tugas.

## Konteks singkat

GSTP adalah prototipe pemeriksa alokasi Green Sukuk untuk esai kompetisi. Komponen: rule engine (8 aturan), skor Isolation Forest, ledger hash-chain, dan web live di Vercel dengan database Supabase. Semua data adalah simulasi buatan generator di `ml/generate_gstp_data.py`.

## Stack

- `ml/`: Python 3.12, numpy, pandas, scikit-learn, pytest. Hanya dijalankan offline.
- `web/`: Next.js (App Router), TypeScript, Tailwind CSS, Vitest untuk tes.
- Database: Supabase Postgres, diakses hanya dari server (route handler).
- Deploy: Vercel, root directory `web`.

## Perintah standar

Perintah ini dibuat pada fase terkait di `TASKS.md`. Jangan mengarang perintah lain tanpa menambahkannya ke `package.json` atau `Makefile`.

```bash
python ml/generate_gstp_data.py --out-dir ml/data_simulasi
python ml/run_evaluasi.py
python ml/export_artifacts.py
pytest ml
cd web && npm run dev
cd web && npm test
cd web && npm run build
```

## Aturan wajib

1. Seed acak selalu 42 kecuali ada alasan tertulis di `docs/DECISIONS.md`.
2. Kolom `label_anomali`, `kelompok_kasus`, `subtipe_kasus`, dan `split` tidak boleh menjadi fitur model. Lihat `docs/DATA_SPEC.md`.
3. Pembagian data selalu per proyek, diurutkan menurut tanggal transaksi pertama (`docs/DATA_SPEC.md` bagian 6, D-017): pengembangan, validasi, pengujian. Ambang model hanya boleh ditentukan dari data validasi. Data pengujian dipakai sekali untuk laporan akhir.
4. Isolation Forest hanya menilai transaksi yang lolos delapan aturan. Lihat `docs/MODEL_SPEC.md`.
5. Logika aturan dan fitur ada di dua bahasa (Python dan TypeScript). Setiap perubahan di salah satunya wajib diikuti tes kesesuaian dengan `golden_cases.json`. Tes harus lulus sebelum commit. Lihat `docs/EXPORT_SPEC.md`.
6. Kunci `SUPABASE_SERVICE_ROLE_KEY` hanya boleh dibaca di kode server. Jangan pernah memakai prefiks `NEXT_PUBLIC_` untuk rahasia. Jangan commit file `.env`.
7. Ledger bersifat append-only. Tidak ada UPDATE atau DELETE pada `ledger_entri` di kode aplikasi. Koreksi dicatat sebagai entri baru. Satu-satunya pengecualian adalah endpoint demo perusakan yang dijaga `DEMO_MODE`. Lihat `docs/LEDGER_SPEC.md`.
8. Hasil sistem disebut "peringatan" atau "temuan", bukan "fraud" atau "pelanggaran terbukti". Ini berlaku di UI, komentar, dan dokumen.
9. Jangan mengklaim bahwa ledger adalah blockchain Hyperledger Fabric. Sebut "ledger simulasi hash-chain".
10. Peran (penyedia data, auditor, pejabat berwenang, otoritas syariah) ditentukan server dari kode akses, tidak pernah dari klien. Peran adalah simulasi, jangan disebut autentikasi. Bila tiga kode peran kosong, berlaku mode satu kode (D-015).
11. Koreksi tidak mengubah entri ledger lama. Koreksi membuat transaksi baru dan menandai yang lama dengan `digantikan_oleh`. Query riwayat kontrak selalu mengecualikan baris yang digantikan.
12. R08 hanya mencocokkan akad dengan registri. Jangan menulis bahwa sistem menilai kesesuaian syariah. Telaah syariah hanya dicatat oleh peran otoritas syariah.

## Gaya kerja

- Kalau diminta memperbarui kode, berikan file lengkap, bukan potongan.
- Ubah satu hal per commit. Jalankan tes yang relevan sebelum menyatakan selesai.
- Nama kolom dan istilah domain memakai bahasa Indonesia sesuai `docs/DATA_SPEC.md`. Nama fungsi dan variabel umum boleh bahasa Inggris, asalkan konsisten dalam satu berkas.
- Teks UI dan dokumen berbahasa Indonesia yang lugas. Jangan memakai tanda pisah em dash dan hindari frasa klise ala AI.
- Kalau spesifikasi di `docs/` bertentangan dengan kode, jangan diam-diam memilih salah satu. Laporkan konflik itu dan usulkan perubahan dokumen.
- Kalau angka hasil evaluasi berubah, perbarui `ml/artifacts/hasil_evaluasi.json` dan `docs/EVALUATION.md`, dan jangan menyalin angka lama.

## Definisi selesai untuk satu tugas

- Kode lengkap dan berjalan.
- Tes terkait lulus (`pytest ml` dan atau `npm test`).
- Tidak ada rahasia di repo.
- Dokumen yang terdampak sudah diperbarui.
- Kriteria selesai tugas di `TASKS.md` terpenuhi dan dicentang.
