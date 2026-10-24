# GSTP Prototype

Prototipe Green Sukuk Traceability Protocol (GSTP): sistem pemeriksa alokasi dana Green Sukuk yang menggabungkan aturan deterministik, skor anomali Isolation Forest, dan catatan hash-chain yang tidak bisa diubah diam-diam.

Seluruh data adalah simulasi. Angka, kode seri, dan nama proyek bersifat ilustratif dan bukan data Kementerian Keuangan.

## Apa yang dilakukan prototipe ini

1. Menerima data pencairan baru lewat form web.
2. Memeriksa tujuh aturan (identitas proyek, pagu, persetujuan, kategori, hash dokumen, milestone, kelengkapan bukti).
3. Untuk transaksi yang lolos aturan, menghitung skor anomali Isolation Forest.
4. Menggabungkan temuan menjadi daftar peringatan untuk auditor. Peringatan adalah prioritas pemeriksaan, bukan penetapan fraud.
5. Mencatat setiap kejadian ke ledger hash-chain dan menyediakan verifikasi rantai.
6. Membandingkan tiga pendekatan (aturan saja, Isolation Forest saja, hybrid) pada data simulasi.

## Struktur repo

```
gstp-prototype/
  README.md  CLAUDE.md  PRD.md  ARCHITECTURE.md  TASKS.md
  docs/                  spesifikasi teknis dan dokumen pendukung esai
  ml/                    Python offline: data, aturan, model, evaluasi, ekspor
    generate_gstp_data.py
    data_simulasi/       keluaran generator (CSV dan metadata)
    artifacts/           model_if.json, golden_cases.json, rules_config.json, hasil_evaluasi.json
  web/                   Next.js (TypeScript) untuk Vercel
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

## Urutan baca dokumen

1. `PRD.md`: apa yang dibangun dan apa yang tidak.
2. `ARCHITECTURE.md`: bagaimana bagian-bagiannya terhubung.
3. `docs/DATA_SPEC.md`: bentuk data.
4. `TASKS.md`: urutan kerja.
5. Spesifikasi lain di `docs/` sesuai tugas yang sedang dikerjakan.

## Keterbatasan singkat

Hash-chain di database bukan jaringan permissioned yang terdistribusi, dan data adalah simulasi. Penjelasan lengkap ada di `docs/LIMITATIONS.md`.
