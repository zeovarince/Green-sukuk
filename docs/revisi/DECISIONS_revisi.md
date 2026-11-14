# DECISIONS (revisi)

> Versi revisi 2026-11-13, draf menunggu persetujuan pemilik. Menggantikan `DECISIONS.md` setelah disetujui. Revisi: tambahan D-014 sampai D-021; D-005 dan D-012 diberi catatan. Rincian di `PERUBAHAN_revisi.md`.

Catatan keputusan teknis dan alasannya. Format: konteks, keputusan, alasan, konsekuensi, status. Tambahkan keputusan baru di bagian bawah dengan nomor berikutnya. Jangan menghapus keputusan lama. Jika berubah, tandai "Diganti oleh D-xxx".

## D-001: Memakai data simulasi buatan sendiri
- Konteks: data tingkat proyek, kontrak, dan pencairan Green Sukuk tidak tersedia publik. Dataset publik lain (misalnya transaksi kartu kredit) tidak memuat proyek, pagu, kontrak, atau persetujuan.
- Keputusan: data utama dibuat generator `ml/generate_gstp_data.py`.
- Alasan: aturan dan keterlacakan hanya bisa diuji pada data yang memiliki struktur alokasi. Esai juga sudah menyebut data simulasi dan anomali sintetis.
- Konsekuensi: hasil adalah bukti awal, bukan klaim pada data riil. Lihat `LIMITATIONS.md`.
- Status: berlaku.

## D-002: Ledger berupa hash-chain di Postgres, bukan Hyperledger Fabric
- Konteks: rancangan esai memakai permissioned blockchain.
- Keputusan: prototipe mensimulasikan ledger dengan rantai hash di tabel database.
- Alasan: menjalankan jaringan Fabric tidak realistis untuk prototipe kompetisi dan tidak perlu untuk membuktikan alur dan verifikasi integritas.
- Konsekuensi: harus disebut "ledger simulasi". Sifat terdistribusi dan konsensus tidak ada. Lihat `LEDGER_SPEC.md` bagian 10.
- Status: berlaku.

## D-003: Skor anomali dihitung di TypeScript, pelatihan di Python
- Konteks: demo harus live di Vercel.
- Keputusan: model dilatih di Python, diekspor sebagai JSON, dan skor dihitung di TypeScript pada route API.
- Alasan: hanya Node.js dan database yang perlu hidup di Vercel, menghindari risiko build campuran Python dan Next.js.
- Konsekuensi: dua implementasi aturan dan skor. Tes kesesuaian wajib (`EXPORT_SPEC.md`).
- Cadangan: fungsi Python di folder `api/` Vercel jika tes kesesuaian terus gagal.
- Status: berlaku.

## D-004: Database Supabase Postgres
- Konteks: demo live perlu menyimpan transaksi baru, status kasus, dan ledger agar tidak hilang saat browser ditutup.
- Keputusan: Supabase Postgres, diakses hanya dari server.
- Alasan: Postgres mudah dipakai, ada paket gratis, dan fungsi kunci penasihat cocok untuk rantai ledger.
- Konsekuensi: proyek gratis dijeda saat tidak aktif, dan tidak ada cadangan otomatis. Perlu daftar periksa di `DEPLOY.md`.
- Status: berlaku. Penyedia dapat diganti karena akses lewat `web/lib/store.ts`.

## D-005: Pembagian data berdasarkan waktu
- Konteks: data transaksi bersifat berurutan.
- Keputusan: 60 persen awal untuk pengembangan, 20 persen berikutnya untuk validasi, 20 persen terakhir untuk pengujian.
- Alasan: menghindari kebocoran informasi dari masa depan dan meniru penerapan nyata.
- Konsekuensi: jumlah anomali per subtipe bisa tidak merata antar split. Lihat `DATA_SPEC.md` bagian 6.
- Status: sebagian diganti oleh D-017. Pembagian 60, 20, 20 persen tetap berlaku, tetapi pemotongan dilakukan per proyek, bukan per baris.

## D-006: Isolation Forest hanya menilai transaksi yang lolos aturan
- Konteks: Gambar 1 esai menempatkan skor setelah pemeriksaan aturan.
- Keputusan: pelanggar aturan langsung masuk daftar peringatan. Skor dihitung hanya untuk yang lolos.
- Alasan: mengikuti rancangan esai dan menghemat beban peringatan ganda pada kasus yang sudah jelas.
- Konsekuensi: konfigurasi "Isolation Forest saja" pada evaluasi dihitung pada semua baris sebagai pembanding, dengan ambang sendiri.
- Status: berlaku.

## D-007: Peringatan bukan penetapan fraud
- Konteks: rancangan esai menyatakan peringatan menjadi prioritas pemeriksaan.
- Keputusan: seluruh teks sistem dan dokumen memakai "peringatan", "temuan", "perlu diperiksa".
- Alasan: skor anomali dan aturan administratif tidak membuktikan niat atau pelanggaran.
- Konsekuensi: aturan teks UI di `WEB_SPEC.md` bagian 10.
- Status: berlaku.

## D-008: Satu repo, tiga bagian
- Keputusan: `ml/`, `web/`, dan `supabase/` dalam satu repo. Vercel hanya men-deploy `web/`.
- Alasan: artefak ekspor, dokumen, dan skema berubah bersama.
- Status: berlaku.

## D-009: Seed 42 sebagai seed utama, evaluasi memakai minimal lima seed
- Keputusan: seed utama 42 untuk tabel di esai. Seed 42 sampai 46 untuk rata-rata dan simpangan baku.
- Alasan: satu seed tidak cukup mewakili variasi penyuntikan anomali.
- Status: berlaku.

## D-010: Dashboard memakai Next.js, bukan Streamlit
- Konteks: Streamlit sempat dipertimbangkan karena satu bahasa dengan model.
- Keputusan: web memakai Next.js dan di-deploy ke Vercel.
- Alasan: rencana deploy, tampilan yang bisa diatur, dan fitur live di satu platform.
- Konsekuensi: logika aturan dan skor ditulis ulang di TypeScript (D-003).
- Status: berlaku.

## D-011: Cara menentukan ambang
- Keputusan awal: ambang memaksimalkan F1 pada data validasi dengan batas laju peringatan palsu 2 persen.
- Alasan: kompromi sederhana yang bisa dijelaskan. Angka 2 persen adalah parameter.
- Konsekuensi: hasil bergantung pada pilihan ini. Catat ambang akhir di `hasil_evaluasi.json`.
- Status: sementara, ditinjau setelah evaluasi pertama. Jangan diubah setelah melihat hasil data pengujian.

## D-012: Kode akses dan pembatasan laju untuk penulisan
- Keputusan: route penulisan memakai header `x-kode-akses` dan pembatasan laju. Tidak ada autentikasi pengguna.
- Alasan: URL demo publik, tetapi sistem login penuh di luar cakupan prototipe.
- Konsekuensi: tidak ada jejak siapa melakukan apa. Dicatat di `LIMITATIONS.md`.
- Status: diperluas oleh D-015. Kode akses tetap, tetapi dapat dipetakan ke peran simulasi.

## D-013: Pembatas laju API demo per instance
- Konteks: endpoint tulis perlu menolak lonjakan permintaan tanpa menambah layanan atau kredensial eksternal.
- Keputusan: gunakan jendela tetap satu menit dalam memori proses Node.js; route transaksi membatasi 20 permintaan per alamat IP dan route demo membatasi 5.
- Alasan: cukup untuk demo satu instance dan tidak memerlukan komponen baru.
- Konsekuensi: hitungan tidak dibagi antar-instance serverless dan dapat kembali kosong saat cold start. Ini pengaman operasional ringan, bukan pertahanan DDoS. Untuk trafik publik, ganti dengan limiter terdistribusi.
- Status: berlaku untuk prototipe.

## D-014: Definisi pelanggaran akad (R08_AKAD)
- Konteks: esai (hlm. 2) dan slide 7 menyebut pemeriksaan ketentuan akad, termasuk wakalah. Prototipe belum memiliki aturan akad, dan seluruh transaksi dengan proyek valid memiliki akad yang sama dengan registri.
- Keputusan: R08 menandai transaksi bila `akad` pada transaksi berbeda dari `akad` terdaftar proyek, dan hanya dievaluasi bila `project_id` ada di registri. Generator menambah subtipe `akad_tidak_sesuai` pada kelompok `anomali_aturan`.
- Alasan: definisi paling sederhana yang dapat diuji dan konsisten dengan data. Mengecualikan proyek tidak valid mencegah penghitungan ganda dengan R01.
- Konsekuensi: R08 mengecek konsistensi akad, bukan kesesuaian syariah. Penilaian syariah dicatat oleh peran otoritas syariah (D-015). Hasil evaluasi lama tidak berlaku lagi.
- Status: berlaku (disetujui pemilik 2026-11-14).

## D-015: Peran simulasi lewat kode akses, dengan mode satu kode
- Konteks: esai dan slide 7 menyebut pembagian peran. Prototipe hanya memiliki satu kode (D-012).
- Keputusan: tiga variabel lingkungan baru (`KODE_AKSES_AUDITOR`, `KODE_AKSES_PEJABAT`, `KODE_AKSES_SYARIAH`). `DEMO_PASSCODE` menjadi peran `penyedia_data`. Server menentukan peran dari kode yang cocok. Bila ketiga variabel kosong, sistem memakai mode satu kode seperti sebelum revisi. Bila sebagian saja terisi, server menolak start.
- Alasan: menunjukkan pemisahan kewenangan tanpa membangun sistem akun. Mode satu kode menjaga demo yang sedang berjalan.
- Konsekuensi: peran tidak membuktikan identitas, dan kode yang bocor memberi peran penuh. Dicatat di `LIMITATIONS.md`. Slide 7 menyebut tiga peran, jadi penyedia data tidak diberi kode tersendiri.
- Status: berlaku (disetujui pemilik 2026-11-14).

## D-016: Koreksi memakai dua kolom baru di `transaksi`
- Konteks: esai (hlm. 3) dan Gambar 1 menyebut koreksi yang memperbarui versi data dengan riwayat tertaut. Entri ledger `koreksi` sudah ada di skema tetapi belum dipakai.
- Keputusan: tambah kolom `digantikan_oleh` dan `koreksi_dari` lewat `supabase/revisi_koreksi.sql` (aman diulang). Query riwayat mengecualikan baris yang `digantikan_oleh` terisi.
- Alasan: tanpa penanda, kumulatif R02 menghitung transaksi lama dan baru sekaligus. Kolom `sumber` tidak cukup karena ia menandai asal baris, bukan status digantikan.
- Konsekuensi: satu migrasi kecil. Ledger tidak diubah.
- Status: berlaku (disetujui pemilik 2026-11-14).

## D-017: Pembagian data per proyek
- Konteks: esai (hlm. 4) menyebut data dipisahkan menurut waktu serta keterkaitan proyek. D-005 memotong per baris menurut waktu, sehingga satu kontrak bisa terbelah di beberapa split.
- Keputusan: satu proyek beserta semua kontrak dan transaksinya masuk ke satu split. Proyek diurutkan menurut tanggal transaksi pertama, lalu dipotong pada 60 persen dan 80 persen jumlah transaksi kumulatif.
- Alasan: model tidak melihat bagian lain dari kontrak yang sama saat pengujian.
- Konsekuensi: rentang tanggal antar split tumpang tindih, jadi urutan waktu antar proyek tidak lagi bersih. Fitur memakai riwayat kontrak sendiri, jadi tidak ada kebocoran dari masa depan di dalam satu kontrak. Pertukaran ini dicatat di `LIMITATIONS.md`. Jumlah anomali per subtipe per split dapat berubah.
- Status: berlaku (disetujui pemilik 2026-11-14). Mengganti sebagian D-005.

## D-018: Pemetaan prinsip syariah pada aturan
- Konteks: esai dan slide 4 dan 7 menyebut amanah dan hifz al-mal, tetapi aturan di prototipe belum diberi label.
- Keputusan: amanah untuk R01, R03, R05, R06. Hifz al-mal untuk R02, R04, R07, R08. Label tampil di UI dan tercatat pada temuan.
- Alasan: pemetaan paling dekat dengan uraian slide 7.
- Konsekuensi: pemetaan ini usulan penulis, bukan penilaian syariah. Tim perlu meninjaunya, dan otoritas syariah sungguhan dapat mengubahnya.
- Status: berlaku untuk prototipe (disetujui pemilik 2026-11-14). Tinjauan tim tetap terbuka.

## D-019: Irisan uji konsep dan pemilihan tahun
- Konteks: esai (hlm. 4 dan Lampiran 2) menyebut uji konsep pada satu kategori dalam satu siklus anggaran. Data tidak memiliki subkategori bendungan.
- Keputusan: laporan tambahan pada split pengujian untuk kategori `Pengelolaan air dan air limbah`, satu tahun kalender. Tahun penuh dengan baris terbanyak dipilih sebelum metrik dilihat, lalu dicatat di sini beserta jumlah barisnya.
- Alasan: menghindari pemilihan tahun yang menguntungkan hasil.
- Konsekuensi: irisan kecil, jadi metrik per subtipe bisa tidak stabil dan harus ditulis begitu.
- Tahun terpilih: 2025 (930 baris pada split pengujian, dipilih karena merupakan tahun kalender penuh dengan jumlah baris terbanyak sebelum metrik dihitung; dievaluasi pada fase R6 2026-11-14).
- Status: berlaku (disetujui pemilik 2026-11-14).

## D-020: Ambang dihitung ulang setelah perubahan fitur dan data
- Konteks: revisi mengubah data (R08, split) dan fitur (18).
- Keputusan: model dilatih ulang dan ambang dihitung ulang dengan prosedur D-011 pada data validasi baru. Ambang lama tidak dibawa. Data pengujian tidak dipakai untuk memilih fitur, model, atau ambang.
- Alasan: ambang lama tidak berlaku pada vektor fitur baru.
- Konsekuensi: semua angka di `EVALUATION.md` dan `hasil_evaluasi.json` berubah, dan hybrid bisa tetap tidak lebih baik dari aturan saja. Hasil dilaporkan apa adanya.
- Status: berlaku bersama revisi.

## D-021: Deviasi jadwal dari kurva-S acuan
- Konteks: esai (abstrak) menyebut perubahan jadwal sebagai fitur. Data tidak memuat jadwal rencana.
- Keputusan: `deviasi_jadwal_pct` dihitung dari progres fisik dikurangi kurva logistik acuan (kemiringan 8, dinormalisasi) pada `bulan_ke / durasi_bulan`.
- Alasan: pengganti jadwal rencana yang dapat dihitung dari kolom yang ada.
- Konsekuensi: kurva acuan berbentuk sama dengan kurva generator, jadi fitur ini lebih informatif pada data simulasi daripada pada data nyata. Hasil yang membaik karena fitur ini tidak boleh dibaca sebagai bukti pada data riil.
- Status: berlaku (disetujui pemilik 2026-11-14).
