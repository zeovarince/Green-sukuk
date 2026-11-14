# GSTP Prototype (revisi)

> Versi revisi 2026-11-13, draf menunggu persetujuan pemilik. Menggantikan `README.md` setelah disetujui. Revisi: REV-01, REV-14 (delapan aturan, penunjuk ke dokumen revisi). Rincian di `docs/PERUBAHAN_revisi.md`.

Prototipe Green Sukuk Traceability Protocol (GSTP): sistem pemeriksa alokasi dana Green Sukuk yang menggabungkan aturan deterministik, skor anomali Isolation Forest, dan catatan hash-chain yang tidak bisa diubah diam-diam.

Seluruh data adalah simulasi. Angka, kode seri, dan nama proyek bersifat ilustratif dan bukan data Kementerian Keuangan.

## Apa yang dilakukan prototipe ini

1. Menerima data pencairan baru lewat form web.
2. Memeriksa delapan aturan (identitas proyek, pagu, persetujuan, kategori, hash dokumen, milestone, kelengkapan bukti, kesesuaian akad).
3. Untuk transaksi yang lolos aturan, menghitung skor anomali Isolation Forest.
4. Menggabungkan temuan menjadi daftar peringatan untuk auditor. Peringatan adalah prioritas pemeriksaan, bukan penetapan fraud.
5. Mencatat setiap kejadian ke ledger hash-chain dan menyediakan verifikasi rantai.
6. Membandingkan tiga pendekatan (aturan saja, Isolation Forest saja, hybrid) pada data simulasi.
7. Membedakan peran penyedia data, auditor, pejabat berwenang, dan otoritas syariah lewat kode akses (simulasi), serta mencatat koreksi data sebagai entri baru.

## Struktur repo

```
gstp-prototype/
  README.md  CLAUDE.md  PRD.md  ARCHITECTURE.md  TASKS.md
  docs/                  spesifikasi teknis dan dokumen pendukung esai
  ml/                    Python offline: data, aturan, model, evaluasi, ekspor
    generate_gstp_data.py
    data_simulasi/       keluaran generator (CSV dan metadata)
    artifacts/           model_if.json, golden_cases.json, rules_config.json, hasil_evaluasi.json
  web/                   Landing Three.js statis dan aplikasi Next.js (TypeScript) untuk Vercel
  supabase/              schema.sql dan skrip seed
```

## Mulai cepat

```bash
# 1. Data simulasi (Python 3.9+, numpy, pandas)
python ml/generate_gstp_data.py --out-dir ml/data_simulasi

# 2. Model dan evaluasi (dibuat pada Fase 2 sampai 5 di TASKS.md)
python ml/run_evaluasi.py
python ml/export_artifacts.py

# 3. Web (dibuat pada Fase 7 sampai 9)
cd web && npm install && npm run dev
```

Urutan lengkap dan kriteria selesai ada di `TASKS.md`. Cara deploy ada di `docs/DEPLOY.md`.

## Revisi prototipe

Revisi menyelaraskan prototipe dengan esai dan slide. Esai dan slide tidak berubah. Setiap berkas `*_revisi.md` di `docs/` adalah versi lengkap dari berkas aslinya, dan berkas asli belum diganti. Mulai dari `docs/PERUBAHAN_revisi.md` (daftar revisi REV-01 sampai REV-14 dan nilai bawaan yang perlu dikonfirmasi), lalu `docs/TASKS_revisi.md` (fase R0 sampai R7). Setelah pemilik menyetujui, hapus sufiks `_revisi` dan timpa berkas asli. Kode belum diubah.

## Urutan baca dokumen

1. `PRD.md`: apa yang dibangun dan apa yang tidak.
2. `ARCHITECTURE.md`: bagaimana bagian-bagiannya terhubung.
3. `docs/DATA_SPEC.md`: bentuk data.
4. `TASKS.md`: urutan kerja.
5. Spesifikasi lain di `docs/` sesuai tugas yang sedang dikerjakan.

## Keterbatasan singkat

Hash-chain di database bukan jaringan permissioned yang terdistribusi, dan data adalah simulasi. Penjelasan lengkap ada di `docs/LIMITATIONS.md`.
