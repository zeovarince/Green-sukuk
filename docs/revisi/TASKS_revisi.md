# TASKS_revisi

Fase kerja untuk revisi prototipe GSTP. Fase asli (1 sampai 11) ada di `TASKS.md` dan tidak diubah. Revisi dan alasannya ada di `PERUBAHAN_revisi.md`. Nomor REV mengacu ke dokumen itu.

Aturan kerja mengikuti `CLAUDE.md`: satu hal per commit, tes relevan lulus sebelum menyatakan selesai, angka hasil tidak disalin dari versi lama, dan ambang tidak disetel dari data pengujian.

Perintah standar:

```bash
python ml/generate_gstp_data.py --out-dir ml/data_simulasi
python ml/run_evaluasi.py
python ml/export_artifacts.py
pytest ml
cd web && npm test
cd web && npm run typecheck
cd web && npm run build
```

Fase R1 sampai R3 tidak mengubah model dan angka lama. Fase R4 sampai R6 mengubah data dan model, jadi mulai setelah pemilik memeriksa hasil R1 sampai R3.

## Fase R0: Spesifikasi revisi

Tujuan: semua perubahan tertulis sebelum kode diubah.

- [x] Tulis `PERUBAHAN_revisi.md` dan `TASKS_revisi.md`.
- [x] Tulis versi `_revisi` untuk dokumen yang terdampak (daftar di `PERUBAHAN_revisi.md` bagian 7).
- [x] Pemilik membaca dan mengonfirmasi enam nilai bawaan di `PERUBAHAN_revisi.md` bagian 6 (2026-11-14).
- [x] Pemilik menyetujui (2026-11-14). Penggantian nama berkas `_revisi` menjadi berkas asli dilakukan di fase R7 agar dokumen revisi tetap menjadi acuan selama R1 sampai R6.

Selesai bila: pemilik menyetujui dan tidak ada konflik antara spesifikasi dan kode yang belum dilaporkan.

## Fase R1: Label prinsip, bukti, pemantauan berlanjut, keterangan ledger

REV-02, REV-12, REV-13. Tidak mengubah model, data, atau skema database.

- [x] `ml/artifacts/rules_config.json` naik ke versi 2 dengan kunci `prinsip` untuk R01 sampai R07. `export_artifacts.py` menulis kunci itu dari satu sumber di `ml/gstp/aturan.py` (2026-11-14).
- [x] `web/lib/aturan.ts` membaca `prinsip` dan menyertakannya pada tiap temuan (2026-11-14).
- [x] `/api/periksa` mengembalikan `tindak_lanjut` dan `bukti` (`API_SPEC.md` bagian 2) (2026-11-14).
- [x] Halaman Periksa menampilkan "Pemantauan berlanjut", panel bukti, dan tag prinsip (2026-11-14).
- [x] Halaman Detail Peringatan menampilkan tag prinsip dan panel bukti (2026-11-14).
- [x] Halaman Tentang menampilkan tabel aturan dengan prinsipnya (2026-11-14).
- [x] Halaman Ledger dan Periksa menampilkan keterangan tetap bahwa ledger adalah simulasi hash-chain (2026-11-14).
- [x] Tes: temuan memuat prinsip yang benar; `tindak_lanjut` benar untuk kasus normal dan peringatan; panel bukti menandai hash yang tidak cocok (2026-11-14).

Selesai bila: `npm test`, `npm run typecheck`, dan `npm run build` lulus; `pytest ml` lulus; `hasil_evaluasi.json` tidak berubah.

Selesai 2026-11-14. Verifikasi: `pytest ml` 12 lulus, `npm test` 520 lulus, `npm run typecheck` bersih, `npm run build` lulus. `hasil_evaluasi.json` tidak berubah.

## Fase R2: Peran simulasi dan alur koreksi

REV-09, REV-11. Membutuhkan satu migrasi SQL kecil.

- [x] `supabase/revisi_koreksi.sql` dan `supabase/schema.sql` memuat kolom `digantikan_oleh` dan `koreksi_dari` di `transaksi`, serta indeks parsial (`DATABASE_SPEC.md` bagian 9) (2026-11-14).
- [x] `web/lib/http.ts` menentukan peran dari kode akses (`API_SPEC.md` bagian 1). Mode satu kode berlaku bila tiga kode peran kosong (2026-11-14).
- [x] `PATCH /api/peringatan/{id}` memakai tabel perpindahan per peran. Entri ledger `status` memuat `peran` (2026-11-14).
- [x] `POST /api/periksa` dengan `simpan: true` mewajibkan `pengusul` dan `verifikator`, lalu mencatatnya di payload ledger (2026-11-14).
- [x] `POST /api/peringatan/{id}/koreksi` (`API_SPEC.md` bagian 5A): transaksi baru, pemeriksaan ulang, penandaan transaksi lama, entri ledger `transaksi` dan `koreksi`, perubahan status peringatan lama (2026-11-14).
- [x] `web/lib/store.ts`: riwayat kontrak tidak memuat transaksi yang `digantikan_oleh` terisi (2026-11-14).
- [x] Halaman Detail Peringatan: tombol status sesuai peran, form koreksi untuk status `perlu_klarifikasi` (2026-11-14).
- [x] Tes: tiap perpindahan sah dan tidak sah per peran; mode satu kode; koreksi menghasilkan rantai ledger yang valid; kumulatif R02 tidak menghitung ganda transaksi yang digantikan; koreksi ditolak bila status bukan `perlu_klarifikasi` (2026-11-14).

Selesai bila: tes di atas lulus, `npm run build` lulus, dan tiga kode peran diuji manual di lingkungan lokal.

Selesai 2026-11-14. Verifikasi: `pytest ml` 12 lulus, `npm test` 541 lulus, `npm run typecheck` bersih, `npm run build` lulus. `hasil_evaluasi.json` tidak berubah. Uji lokal server dev dengan tiga kode peran: penyedia data lolos pemeriksaan akses, auditor/pejabat/syariah ditolak 403 pada route koreksi, kode salah dan tanpa kode 401. Uji koreksi sampai database memerlukan Supabase lokal berisi data dan dilakukan saat pengujian pemilik.

## Fase R3: Metrik tambahan

REV-06, REV-07, REV-08. Hasil ditambahkan ke `hasil_evaluasi.json`. Angka yang sudah ada tidak berubah.

- [x] `ml/run_evaluasi.py` menghitung waktu deteksi pola beruntun (`EVALUATION.md` bagian 4A) (2026-11-14).
- [x] Kelengkapan tautan dihitung (bagian 4B) (2026-11-14).
- [x] Biaya dihitung dari artefak dan ledger (bagian 4C) (2026-11-14).
- [x] Uji perusakan hash-chain melawan tabel log biasa (bagian 4D). Skrip memakai salinan ledger lokal (2026-11-14).
- [x] `ml/ukur_latensi.py` mengukur latensi lokal dan menerima URL publik sebagai parameter (bagian 4E). Pemilik menjalankannya terhadap URL Vercel (2026-11-14).
- [x] Halaman Evaluasi menampilkan tabel baru (2026-11-14).
- [x] Tes Python untuk tiap metrik pada data kecil buatan dengan jawaban yang diketahui (2026-11-14).

Selesai bila: `pytest ml` dan `npm test` lulus; `hasil_evaluasi.json` memuat kunci baru; nilai lama tidak berubah.

Selesai 2026-11-14. Verifikasi: `pytest ml` 28 lulus, `npm test` 541 lulus, `npm run typecheck` bersih, `npm run build` lulus. Empat kunci baru ditambahkan (`waktu_deteksi_pola`, `kelengkapan_tautan`, `biaya`, `uji_perusakan`); seluruh nilai klasifikasi lama identik dengan artefak sebelumnya, hanya `dibuat_pada` dan waktu pengukuran yang berubah. Angka R3: 36 pola beruntun pada split pengujian, kelengkapan tautan gabungan 0,9951, verifikasi rantai penuh 0,746 detik untuk 58.597 entri. Uji perusakan: ubah, hapus, sisip, dan tukar terdeteksi 100 persen dengan lokasi tepat 100 persen oleh hash-chain dan 0 persen oleh tabel log biasa; hitung ulang seluruh rantai tidak terdeteksi oleh keduanya. Pengukuran latensi route lokal belum dapat dijalankan karena host Supabase pada `.env.local` tidak lagi dapat diresolusi (DNS); skrip `ml/ukur_latensi.py` sudah diuji unit dan dijalankan pemilik setelah re-seed, sesuai langkah R7.

## Fase R4: Aturan R08 dan telaah syariah

REV-01, REV-10. Mengubah data dan angka.

- [ ] `ml/gstp/aturan.py` dan `web/lib/aturan.ts` menambah `R08_AKAD` (`RULES.md` bagian 1).
- [ ] `ml/generate_gstp_data.py` menambah subtipe `akad_tidak_sesuai` pada kelompok `anomali_aturan` (`DATA_SPEC.md` bagian 5). Tingkat anomali total tetap 3 persen.
- [ ] `/api/periksa` menerima `akad` opsional.
- [ ] `POST /api/peringatan/{id}/telaah-syariah` (`API_SPEC.md` bagian 5B) dan tampilan di Detail Peringatan.
- [ ] `golden_cases.json` memuat kasus R08 (`EXPORT_SPEC.md` bagian 3). Tes kesesuaian Python dan TypeScript lulus.
- [ ] Tes: R08 tidak menandai satu pun baris `normal`; R08 tidak berjalan pada proyek yang tidak ada di registri; semua baris `akad_tidak_sesuai` tertangkap R08.
- [ ] Tag prinsip R08 (hifz al-mal) ditambahkan.

Selesai bila: semua tes lulus dan data baru dihasilkan dengan seed 42. Angka evaluasi belum dilaporkan sebelum R6.

## Fase R5: Fitur model dan pemisahan data

REV-03, REV-04. Mengubah model dan angka.

- [ ] `ml/gstp/fitur.py` dan `web/lib/fitur.ts` menambah `kelengkapan_bukti`, `rasio_nilai_vs_median_kelompok`, dan `deviasi_jadwal_pct` (`MODEL_SPEC.md` bagian 3). Vektor menjadi 18 fitur.
- [ ] Tabel `referensi_kelompok` dihitung dari split pengembangan yang lolos aturan dan ditulis ke `model_if.json` (`EXPORT_SPEC.md` bagian 2).
- [ ] `web/lib/iforest.ts` membaca skema versi 2 dan menolak versi lain.
- [ ] Pemisahan data per proyek di generator dan metadata (`DATA_SPEC.md` bagian 6).
- [ ] Tes: tidak ada proyek yang muncul di lebih dari satu split; kolom terlarang tetap bukan fitur; fitur baru tidak memakai label; fallback referensi kelompok bekerja; kesesuaian Python dan TypeScript lulus pada kasus pinggiran (bulan melewati durasi, kelompok tidak ada).
- [ ] Ambang ditentukan dari data validasi saja.

Selesai bila: semua tes lulus dan model dilatih ulang dengan seed 42.

## Fase R6: Evaluasi ulang dan ekspor

REV-05.

- [ ] `ml/run_evaluasi.py` dijalankan untuk lima seed. Hasil seed 42 menjadi hasil utama.
- [ ] Laporan irisan uji konsep dihitung (`EVALUATION.md` bagian 4F). Tahun anggaran dipilih dari jumlah baris sebelum metrik dilihat dan dicatat di `DECISIONS.md` (D-019).
- [ ] `ml/export_artifacts.py` menulis ulang artefak. Salin ke `web/data/artifacts/`.
- [ ] `ml/artifacts/hasil_evaluasi.json` dan `EVALUATION.md` diperbarui. Angka lama dihapus, tidak disalin.
- [ ] Hasil dilaporkan apa adanya, termasuk bila hybrid tetap tidak lebih baik dari aturan saja.

Selesai bila: tes kesesuaian lulus, `EVALUATION.md` memuat angka baru dengan tanggal dan versi data, dan setiap kalimat tentang hasil mengacu ke angka di berkas itu.

## Fase R7: Sinkronisasi dokumen dan serah

REV-14.

- [ ] `TRACEABILITY.md`: baris 17 sampai 29 diisi dengan status terpenuhi, sebagian, atau rancangan. Baris lama diisi ulang dengan angka baru.
- [ ] `LIMITATIONS.md`, `ESSAY_UPDATE.md`, `DEMO_SCRIPT.md`, `DEPLOY.md`, `README.md`, `PRD.md`, `ARCHITECTURE.md`, `CLAUDE.md`, `GLOSSARY.md` mengikuti versi `_revisi`.
- [ ] `docs/ESSAI_GSTP_REVISI.docx` diberi catatan bahwa angkanya berasal dari versi sebelum revisi. Berkas itu tidak diubah isinya.
- [ ] `pytest ml`, `npm test`, `npm run typecheck`, dan `npm run build` lulus pada commit akhir.
- [ ] Tidak ada rahasia di repo.

Langkah pemilik di lingkungan live:

- [ ] Buat proyek Supabase baru untuk versi revisi. Jalankan `supabase/schema.sql`.
- [ ] Bangun ledger awal dan isi data sesuai `DATABASE_SPEC.md` bagian 5. Jalankan `python supabase/verify_ledger.py`.
- [ ] Isi variabel lingkungan baru (`DEPLOY.md` bagian 3). Deploy ke preview Vercel.
- [ ] Jalankan skenario 1 sampai 11 di `DEMO_SCRIPT.md` pada URL preview dan catat hasilnya.
- [ ] Jalankan `ml/ukur_latensi.py` terhadap URL preview dan catat hasilnya.
- [ ] Setelah semua lolos, pindahkan variabel lingkungan produksi ke proyek Supabase baru.

Selesai bila: seluruh centang di fase ini terpenuhi dan baris di `TRACEABILITY.md` tidak ada yang kosong.
