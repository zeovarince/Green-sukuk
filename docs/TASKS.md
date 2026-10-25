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

- [x] Tulis `supabase/schema.sql` sesuai `docs/DATABASE_SPEC.md` (tabel, indeks, RLS, fungsi `tambah_ledger`).
- [x] Buat proyek Supabase dan jalankan skema.
- [x] Impor registri dan transaksi simulasi.
- [x] Bangun dan impor ledger awal transaksi; verifikasi penuh valid untuk 58.023 entri.
- [x] Tambahkan entri ledger peringatan untuk transaksi yang ditandai pada evaluasi seed 42, sesuai `docs/LEDGER_SPEC.md` bagian 8.

DoD: jumlah baris sama dengan CSV, verifikasi rantai penuh menyatakan valid.

Status saat ini: tabel `registri_proyek` (800), `registri_kontrak` (2.719), dan `transaksi` (58.023) cocok dengan artefak lokal. Sebanyak 574 peringatan seed 42 sudah ditambahkan ke Supabase; verifikasi penuh berhasil untuk 58.597 entri ledger.

## Fase 7: Library TypeScript dan tes kesesuaian

- [x] `web/lib/fitur.ts`, `aturan.ts`, `iforest.ts`, `ledger.ts`, `store.ts`.
- [x] Tes Vitest terhadap `golden_cases.json`: fitur, aturan, skor.

DoD: semua kasus lulus dalam toleransi `docs/EXPORT_SPEC.md`.

## Fase 8: Route API

- [x] Route sesuai `docs/API_SPEC.md`: periksa, peringatan, kontrak, ledger, metrik, dan demo.
- [x] Validasi input, kode akses untuk penulisan, pembatasan laju.

DoD: tiap route punya tes dasar. Pemeriksaan satu transaksi menghasilkan hasil yang sama dengan Python pada kasus emas.

Catatan: route demo memerlukan migrasi `supabase/phase8_demo_backup.sql` bila proyek Supabase sudah menjalankan skema lama. Pembatas laju dalam memori berlaku per instance Node.js; lihat D-013.

## Fase 9: Halaman web

- [x] Halaman sesuai `docs/WEB_SPEC.md`, urut prioritas P0 ke P2.
- [x] Teks UI mengikuti aturan penulisan di `docs/WEB_SPEC.md`.

Status: rute F1 sampai F6 tersedia; typecheck, 517 tes, dan build produksi lulus. Pemeriksaan HTTP halaman menghasilkan 200. Panggilan API dari sandbox tidak dapat keluar; uji baca langsung yang diizinkan ke Supabase mengembalikan 401 untuk secret key server. DoD alur F1 sampai F6 end-to-end belum terkonfirmasi. Uji visual manual juga belum dijalankan.

## Fase 10: Deploy dan uji

- [ ] Deploy ke Vercel mengikuti `docs/DEPLOY.md`.
- [ ] Jalankan daftar periksa sebelum demo di lingkungan publik.
- [ ] Jalankan seluruh skenario di `docs/DEMO_SCRIPT.md` di URL publik dan catat hasilnya.

DoD: demo penuh berjalan di Vercel. Hasil nyata tiap skenario dicatat.

Status 2026-10-25: build siap, tetapi belum ada konfigurasi proyek atau token Vercel pada lingkungan ini. URL publik belum tersedia. Secret key server yang ada mendapat HTTP 401 saat uji baca langsung. Migrasi `supabase/phase8_demo_backup.sql` belum diterapkan, jadi mode demo dan uji tulis belum siap.

## Fase 11: Selaraskan dengan esai

- [x] Isi hasil implementasi dan evaluasi yang tersedia di `docs/TRACEABILITY.md`.
- [ ] Cocokkan setiap klaim dengan teks esai asli dan tandai kolom Cocok.
- [ ] Masukkan tabel evaluasi dan keterbatasan dari `docs/ESSAY_UPDATE.md` ke naskah esai asli.
- [x] Siapkan koreksi klaim yang melampaui hasil terukur di `docs/ESSAY_UPDATE.md`.

DoD: menunggu naskah esai asli. Dokumen sumber tidak ditemukan di repo atau sesi dokumen tersambung, jadi kecocokan dan penyisipan ke naskah belum dapat dikonfirmasi.

## Ringkasan prioritas jika waktu mepet

Kerjakan Fase 0 sampai 5 dulu karena menghasilkan angka untuk esai. Fase 6 sampai 10 membuat demo live. Fase 11 tidak boleh dilewati.
