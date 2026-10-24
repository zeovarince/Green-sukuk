# TASKS

Urutan kerja dengan kriteria selesai (DoD) per fase. Centang kotak saat selesai. Jangan lompat ke fase berikutnya sebelum DoD fase sebelumnya terpenuhi, kecuali dicatat di `docs/DECISIONS.md`.

Tidak ada estimasi jam di sini. Urutan dan DoD lebih penting daripada tebakan waktu.

## Fase 0: Siapkan repo

- [x] Buat struktur folder `ml/`, `web/`, `supabase/`, `docs/`.
- [x] Salin dokumen `.md` ke tempatnya.
- [x] Buat `.gitignore` (termasuk `.env*`, `node_modules`, `ml/data_simulasi/*.csv` bila terlalu besar).
- [x] Buat `ml/requirements.txt` dengan versi scikit-learn yang dikunci.

DoD: repo bisa di-clone dan struktur sesuai `README.md`.

## Fase 1: Data simulasi

- [x] Jalankan `python ml/generate_gstp_data.py --out-dir ml/data_simulasi`.
- [x] Cek ringkasan di layar: 800 proyek, 2.719 kontrak, 58.023 transaksi, sekitar 3% anomali (dengan seed 42).
- [x] Cek uji kewarasan: normal ditandai aturan 0, anomali aturan tertangkap penuh, anomali kontekstual tertangkap 0.

DoD: tiga CSV dan `metadata_simulasi.json` ada, uji kewarasan sesuai, hasil identik pada dua kali jalan dengan seed yang sama.

## Fase 2: Rule engine (Python)

- [x] Tulis `ml/gstp/aturan.py` sesuai `docs/RULES.md` dan `ml/artifacts/rules_config.json`.
- [x] Tes: tiap aturan memiliki minimal satu kasus lolos dan satu kasus melanggar.

DoD: aturan menangkap seluruh baris `anomali_aturan`, tidak menandai satu pun baris `normal` dan `normal_tidak_lazim_sah`, dan `pytest ml` lulus.

## Fase 3: Fitur dan Isolation Forest

- [x] Tulis `ml/gstp/fitur.py` sesuai `docs/MODEL_SPEC.md`. Fitur hanya memakai informasi yang sudah ada saat transaksi.
- [x] Tulis `ml/gstp/model.py`: latih pada split `pengembangan`, baris lolos aturan, tanpa label.
- [x] Tentukan ambang dari split `validasi`.
- [x] Tes: tidak ada kolom label atau split di daftar fitur.

DoD: model tersimpan, ambang tercatat beserta cara menentukannya, tes kebocoran label lulus.

## Fase 4: Evaluasi

- [x] Tulis `ml/run_evaluasi.py` sesuai `docs/EVALUATION.md`: tiga pendekatan, metrik, recall per subtipe.
- [x] Jalankan dengan beberapa seed (minimal lima) dan catat rata-rata dan simpangan baku.
- [x] Hasilkan `ml/artifacts/hasil_evaluasi.json` dan tabel siap masuk esai.

DoD: tabel hasil lengkap untuk data pengujian, hasil beberapa seed ada, angka di `docs/EVALUATION.md` diperbarui dari berkas hasil.

## Fase 5: Ekspor artefak

- [x] Tulis `ml/export_artifacts.py` sesuai `docs/EXPORT_SPEC.md`: `model_if.json`, `rules_config.json`, `golden_cases.json`.
- [x] `golden_cases.json` memuat kasus dari semua subtipe.

DoD: berkas ada dan lolos validasi format. Ukuran berkas masuk akal untuk ikut ter-bundle di Vercel.

## Fase 6: Database

- [ ] Tulis `supabase/schema.sql` sesuai `docs/DATABASE_SPEC.md` (tabel, indeks, RLS, fungsi `tambah_ledger`).
- [ ] Buat proyek Supabase dan jalankan skema.
- [ ] Impor registri dan transaksi simulasi.
- [ ] Bangun ledger awal berurutan untuk semua transaksi simulasi dan impor.

DoD: jumlah baris sama dengan CSV, verifikasi rantai penuh menyatakan valid.

## Fase 7: Library TypeScript dan tes kesesuaian

- [ ] `web/lib/fitur.ts`, `aturan.ts`, `iforest.ts`, `ledger.ts`, `store.ts`.
- [ ] Tes Vitest terhadap `golden_cases.json`: fitur, aturan, skor.

DoD: semua kasus lulus dalam toleransi `docs/EXPORT_SPEC.md`.

## Fase 8: Route API

- [ ] Route sesuai `docs/API_SPEC.md`: periksa, peringatan, kontrak, ledger, metrik, dan demo.
- [ ] Validasi input, kode akses untuk penulisan, pembatasan laju.

DoD: tiap route punya tes dasar. Pemeriksaan satu transaksi menghasilkan hasil yang sama dengan Python pada kasus emas.

## Fase 9: Halaman web

- [ ] Halaman sesuai `docs/WEB_SPEC.md`, urut prioritas P0 ke P2.
- [ ] Teks UI mengikuti aturan penulisan di `docs/WEB_SPEC.md`.

DoD: alur F1 sampai F6 dapat dijalankan di lokal dari awal sampai akhir.

## Fase 10: Deploy dan uji

- [ ] Ikuti `docs/DEPLOY.md`.
- [ ] Jalankan daftar periksa sebelum demo.
- [ ] Jalankan seluruh skenario di `docs/DEMO_SCRIPT.md` di URL publik.

DoD: demo penuh berjalan di Vercel. Hasil nyata tiap skenario dicatat.

## Fase 11: Selaraskan dengan esai

- [ ] Isi `docs/TRACEABILITY.md` dengan hasil nyata dan cocokkan tiap klaim ke teks esai.
- [ ] Masukkan tabel hasil evaluasi dan keterbatasan ke esai.
- [ ] Periksa bahwa esai tidak mengklaim melebihi yang dibangun (terutama soal blockchain dan data riil).

DoD: tidak ada klaim esai yang bertentangan dengan `docs/LIMITATIONS.md`.

## Ringkasan prioritas jika waktu mepet

Kerjakan Fase 0 sampai 5 dulu karena menghasilkan angka untuk esai. Fase 6 sampai 10 membuat demo live. Fase 11 tidak boleh dilewati.
