# PERUBAHAN_revisi

Daftar revisi prototipe GSTP agar sejalan dengan esai (PDF "Green Sukuk Traceability Protocol Berbasis Blockchain dan Isolation Forest untuk Deteksi Anomali Alokasi Dana") dan PPT final (12 slide). Hanya prototipe yang berubah. Esai dan slide tetap seperti sekarang.

Status: draf 2026-11-13, menunggu persetujuan pemilik. Dasar pemeriksaan: repo `zeovarince/green-sukuk` pada commit `5bdaadb`.

Setiap berkas `*_revisi.md` adalah versi lengkap dari dokumen aslinya di folder yang sama. Berkas asli belum diganti. Setelah pemilik menyetujui, hapus sufiks `_revisi` dan timpa berkas asli.

## 1. Dasar revisi

Pemeriksaan naskah menemukan tiga kelompok selisih antara esai dan slide di satu sisi, dan prototipe di sisi lain:

1. Hal yang esai atau slide tulis sebagai pekerjaan sistem, tetapi tidak ada di kode: aturan akad, label amanah dan hifz al-mal, pencatatan pengusul dan verifikator, pembagian peran, alur koreksi, catatan bukti, dan status pemantauan berlanjut.
2. Hal yang esai tulis sebagai isi evaluasi, tetapi prototipe tidak mengerjakannya: fitur model (kelengkapan bukti, jenis dan tahap proyek, perubahan jadwal), pemisahan data menurut keterkaitan proyek, cakupan satu kategori dalam satu siklus anggaran, waktu deteksi, kelengkapan tautan, biaya, dan perbandingan dengan basis data berjejak audit.
3. Dokumen repo yang sudah usang, misalnya catatan "belum dideploy".

## 2. Daftar revisi

| ID | Revisi | Sumber di esai atau slide | Fase | Mengubah angka evaluasi lama |
|---|---|---|---|---|
| REV-01 | Aturan `R08_AKAD`: akad pada transaksi harus sama dengan akad terdaftar proyek | Esai hlm. 2 (smart contract memeriksa ketentuan akad, termasuk wakalah); slide 7 (hifz al-mal: kesesuaian dengan akad diperiksa) | R4 | Ya |
| REV-02 | Label prinsip amanah atau hifz al-mal pada tiap aturan, tampil di UI | Abstrak (kebaruan); esai hlm. 2; slide 4 dan 7 | R1 | Tidak |
| REV-03 | Tiga fitur Isolation Forest baru: kelengkapan bukti, rasio nilai terhadap median kategori dan tahap, deviasi jadwal | Abstrak (deviasi anggaran, perubahan jadwal); esai hlm. 3 (kelengkapan bukti, perbandingan menurut jenis dan tahap proyek) | R5 | Ya |
| REV-04 | Pemisahan data per proyek, urut menurut waktu mulai | Esai hlm. 4 (dipisahkan menurut waktu serta keterkaitan proyek) | R5 | Ya |
| REV-05 | Laporan irisan uji konsep: satu kategori, satu tahun anggaran | Esai hlm. 4 dan Lampiran 2 (satu kategori proyek, misalnya bendungan, satu siklus anggaran) | R6 | Tidak (laporan tambahan) |
| REV-06 | Metrik waktu deteksi pola beruntun dan kelengkapan tautan | Esai hlm. 4 (waktu deteksi; keterlacakan dinilai dari kelengkapan hubungan) | R3 | Tidak |
| REV-07 | Biaya komputasi, penyimpanan, pemeliharaan, dan latensi Vercel | Esai hlm. 4 | R3 dan R7 | Tidak |
| REV-08 | Uji perusakan: hash-chain dibandingkan tabel log biasa | Esai hlm. 4 (manfaat blockchain dibandingkan basis data berjejak audit; kesamaan catatan) | R3 | Tidak |
| REV-09 | Peran simulasi (auditor, pejabat berwenang, otoritas syariah) dan pencatatan pengusul serta verifikator | Esai hlm. 2; slide 4 dan 7 (pembagian peran) | R2 | Tidak |
| REV-10 | Telaah syariah atas temuan `R08_AKAD` oleh peran otoritas syariah | Esai hlm. 2 dan 5; slide 7 | R4 | Tidak |
| REV-11 | Alur koreksi: data dikoreksi, diperiksa ulang, versi baru dan riwayat tetap tertaut | Esai hlm. 3; Gambar 1; slide 6 | R2 | Tidak |
| REV-12 | Panel bukti dan status "pemantauan berlanjut" | Esai hlm. 2 (dasbor memuat tautan bukti); slide 5 (catat temuan dan bukti; skor di bawah ambang: pemantauan berlanjut) | R1 | Tidak |
| REV-13 | Keterangan "ledger simulasi" ditegaskan di halaman Ledger dan Periksa | Abstrak, slide 4 dan 12 (permissioned blockchain) | R1 | Tidak |
| REV-14 | Dokumen repo disinkronkan dengan kondisi terbaru | Seluruh dokumen | R7 | Tidak |

## 3. Rincian

**REV-01.** `R08_AKAD` menandai transaksi bila `akad` pada transaksi berbeda dari `akad` proyek di `registri_proyek`. Aturan berjalan hanya bila `project_id` ada di registri, supaya transaksi dengan ID proyek tidak valid tidak terhitung ganda dengan R01. Pada data sekarang, seluruh 57.916 transaksi dengan proyek valid memiliki akad yang sama dengan registri, jadi R08 baru berfungsi setelah generator menambah subtipe anomali `akad_tidak_sesuai`. Aturan ini memeriksa konsistensi akad. Penilaian kesesuaian syariah tetap milik otoritas syariah, sesuai esai.

**REV-02.** Tiap aturan membawa satu tag prinsip. Pemetaan awal: amanah untuk R01, R03, R05, R06 (kejelasan pihak, persetujuan, riwayat dokumen, verifikasi); hifz al-mal untuk R02, R04, R07, R08 (batas alokasi, peruntukan, kelengkapan bukti, akad). Pemetaan ini usulan penulis dan perlu ditinjau tim. Tag tampil di halaman Tentang, Detail Peringatan, dan hasil Periksa.

**REV-03.** Tiga fitur baru menambah vektor fitur dari 15 menjadi 18. Rumus ada di `MODEL_SPEC_revisi.md`. Deviasi jadwal dihitung dari kurva-S acuan karena data tidak memuat jadwal rencana. Pada data simulasi, kurva acuan berbentuk sama dengan kurva yang dipakai generator, sehingga fitur ini lebih informatif daripada pada data nyata. Batas ini dicatat di `LIMITATIONS_revisi.md`.

**REV-04.** Satu proyek, beserta semua kontrak dan transaksinya, masuk ke satu split. Proyek diurutkan menurut tanggal transaksi pertamanya, lalu dipotong pada 60 persen dan 80 persen dari jumlah transaksi. Akibatnya rentang tanggal antar split saling tumpang tindih. Fitur memakai riwayat kontrak sendiri, jadi tidak ada kebocoran dari masa depan di dalam satu kontrak, tetapi urutan waktu antar proyek tidak lagi bersih. Pertukarannya dicatat di `DECISIONS_revisi.md` (D-017).

**REV-05.** Laporan tambahan pada baris split pengujian untuk kategori `Pengelolaan air dan air limbah` (padanan kelompok bendungan, danau, dan tampungan air di slide 2) dalam satu tahun anggaran. Data tidak memiliki subkategori bendungan. Tahun dipilih sebelum melihat metrik, berdasarkan jumlah baris.

**REV-06 sampai REV-08.** Definisi metrik ada di `EVALUATION_revisi.md` bagian 4A sampai 4F. Hasilnya dilaporkan apa adanya, termasuk bila waktu deteksi pola tidak terukur karena pola tidak tertangkap.

**REV-09.** Tiga kode akses peran, ditambah kode penyedia data yang sudah ada (`DEMO_PASSCODE`). Server menentukan peran dari kode yang cocok, jadi klien tidak mengirim peran sendiri. Ini simulasi peran. Tidak ada identitas pengguna, dan `LIMITATIONS_revisi.md` menyatakannya. Bila tiga kode peran tidak diisi di lingkungan, sistem memakai perilaku lama (satu kode untuk semua), supaya demo yang berjalan tidak rusak.

**REV-10.** Peran otoritas syariah dapat mencatat telaah atas peringatan yang memuat `R08_AKAD`: sesuai, tidak sesuai, atau perlu dokumen. Telaah tercatat di ledger dan tidak menghalangi perpindahan status.

**REV-11.** Koreksi hanya untuk peringatan berstatus `perlu_klarifikasi`. Penyedia data mengirim perubahan beserta alasan. Server membuat transaksi baru, memeriksanya ulang, menandai transaksi lama sebagai digantikan, dan menulis entri ledger `koreksi` yang menunjuk entri lama. Entri lama tidak diubah. Fitur ini membutuhkan satu migrasi SQL kecil (dua kolom, aman diulang).

**REV-12.** Hasil Periksa menampilkan `tindak_lanjut` (`pemantauan_berlanjut` atau `telaah_auditor`) dan panel bukti: hash tercatat dan hash saat ini beserta statusnya, serta kelengkapan bukti terhadap ambang. Panel diberi label bahwa dokumen asli tidak ada.

**REV-13.** Keterangan tetap di UI: "Ledger simulasi hash-chain di satu database. Rancangan penuh memakai permissioned blockchain antar lembaga."

## 4. Yang sengaja tidak diubah

Prototipe ini memakai data simulasi dan menguji tahap awal. Esai sendiri membedakan rancangan penuh dari uji konsep (Lampiran 2 dan Penutup). Karena itu hal berikut tetap berupa rancangan:

- Data riil Green Sukuk dan validasi pada data berizin.
- Jaringan permissioned blockchain sungguhan dan konsensus antar lembaga.
- Dokumen asli yang terenkripsi di luar rantai.
- Autentikasi pengguna dan identitas kriptografis.
- Aturan yang disahkan otoritas sungguhan, dan integrasi dengan Allocation Register.
- Uji keamanan formal dan uji beban.
- Pentahelix sebagai integrasi antar pihak.

Hasil evaluasi yang tidak menguntungkan hybrid bukan selisih dengan esai. Angka itu tetap dilaporkan apa adanya, termasuk setelah revisi.

## 5. Dampak

**Angka evaluasi.** REV-01, REV-03, dan REV-04 mengubah data dan model, sehingga seluruh angka di `ml/artifacts/hasil_evaluasi.json` dan `EVALUATION.md` berubah. Ambang tidak boleh disetel memakai data pengujian (D-011 tetap berlaku). Esai PDF dan slide tidak memuat angka evaluasi, jadi tidak bertabrakan. `docs/ESSAI_GSTP_REVISI.docx` memuat Tabel 2 sampai 5 dengan angka lama dan tidak diubah di sini. Pemilik perlu tahu bahwa tabel itu akan berbeda dari angka baru.

**Database.** Data simulasi dibuat ulang, jadi Supabase yang live perlu diisi ulang. Cara yang disarankan: siapkan proyek Supabase baru untuk versi revisi, uji di sana, lalu pindahkan variabel lingkungan Vercel setelah lolos `DEMO_SCRIPT_revisi.md`. Proyek lama tetap menjadi cadangan.

**Migrasi.** `supabase/revisi_koreksi.sql` menambah kolom `digantikan_oleh` dan `koreksi_dari` di `transaksi`.

**Variabel lingkungan baru.** `KODE_AKSES_AUDITOR`, `KODE_AKSES_PEJABAT`, `KODE_AKSES_SYARIAH`.

**Tes.** `pytest ml`, `npm test`, typecheck, dan build tetap menjadi syarat. Tes kesesuaian Python dan TypeScript diperluas ke R08 dan tiga fitur baru. Alur yang menulis ke Supabase hanya teruji lewat tes dengan penyimpanan tiruan. Pemilik perlu mengujinya di lingkungan live.

## 6. Keputusan desain yang perlu dikonfirmasi pemilik

Draf ini memakai nilai bawaan berikut sampai pemilik mengubahnya.

1. Definisi pelanggaran akad: akad pada transaksi berbeda dari akad terdaftar proyek (D-014).
2. Penyedia data memakai `DEMO_PASSCODE` dan bukan peran keempat dengan kode sendiri. Slide 7 hanya menyebut tiga peran.
3. Mode satu kode tetap berlaku bila tiga kode peran tidak diisi (D-015).
4. Koreksi memakai migrasi dua kolom, bukan menandai transaksi lama lewat kolom yang sudah ada (D-016).
5. Pemisahan data memakai tingkat proyek, bukan tingkat kontrak (D-017).
6. Tahun anggaran irisan uji konsep ditentukan setelah jumlah baris per tahun diketahui (D-019).

## 7. Peta berkas

| Berkas asli | Berkas revisi | Isi perubahan |
|---|---|---|
| (baru) | `PERUBAHAN_revisi.md` | Dokumen ini |
| `TASKS.md` | `TASKS_revisi.md` | Fase R0 sampai R7 |
| `DECISIONS.md` | `DECISIONS_revisi.md` | D-014 sampai D-021 |
| `RULES.md` | `RULES_revisi.md` | R08 dan pemetaan prinsip |
| `MODEL_SPEC.md` | `MODEL_SPEC_revisi.md` | Tiga fitur baru |
| `DATA_SPEC.md` | `DATA_SPEC_revisi.md` | Subtipe baru dan pemisahan per proyek |
| `EVALUATION.md` | `EVALUATION_revisi.md` | Metrik tambahan dan irisan |
| `LEDGER_SPEC.md` | `LEDGER_SPEC_revisi.md` | Koreksi, peran, telaah syariah |
| `API_SPEC.md` | `API_SPEC_revisi.md` | Peran, koreksi, telaah, bukti |
| `WEB_SPEC.md` | `WEB_SPEC_revisi.md` | Panel dan form baru |
| `DATABASE_SPEC.md` | `DATABASE_SPEC_revisi.md` | Dua kolom, migrasi, isi ulang |
| `EXPORT_SPEC.md` | `EXPORT_SPEC_revisi.md` | Skema versi 2 dan golden cases |
| `DEMO_SCRIPT.md` | `DEMO_SCRIPT_revisi.md` | Skenario 9 sampai 11 |
| `LIMITATIONS.md` | `LIMITATIONS_revisi.md` | Batas baru dan status deploy |
| `TRACEABILITY.md` | `TRACEABILITY_revisi.md` | Baris 17 sampai 29 |
| `ESSAY_UPDATE.md` | `ESSAY_UPDATE_revisi.md` | Penanda angka berubah |
| `PRD.md` | `PRD_revisi.md` | Peran simulasi, fitur F10 sampai F12 |
| `ARCHITECTURE.md` | `ARCHITECTURE_revisi.md` | Alur dan komponen |
| `CLAUDE.md` | `CLAUDE_revisi.md` | Jumlah aturan dan pembagian data |
| `GLOSSARY.md` | `GLOSSARY_revisi.md` | Istilah baru |
| `DEPLOY.md` | `DEPLOY_revisi.md` | Variabel, migrasi, urutan penerapan |
| `../README.md` | `README_revisi.md` | Ringkasan |

Dokumen yang tidak berubah: `DESIGN.md` dan `landingpagethreejs.md`.

## 8. Cara menerapkan

1. Pemilik membaca dokumen ini dan `TASKS_revisi.md`, lalu mengubah nilai bawaan di bagian 6 bila perlu.
2. Fase R1 sampai R3 dikerjakan lebih dulu. Fase ini tidak mengubah model dan angka lama.
3. Fase R4 sampai R6 mengubah data dan model. Pemilik memeriksa hasil R1 sampai R3 sebelum fase ini dimulai.
4. Fase R7 menyinkronkan dokumen dan menyerahkan berkas beserta langkah isi ulang Supabase.
