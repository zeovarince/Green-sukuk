# DECISIONS

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
- Status: berlaku.

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
- Status: berlaku.

## D-013: Pembatas laju API demo per instance
- Konteks: endpoint tulis perlu menolak lonjakan permintaan tanpa menambah layanan atau kredensial eksternal.
- Keputusan: gunakan jendela tetap satu menit dalam memori proses Node.js; route transaksi membatasi 20 permintaan per alamat IP dan route demo membatasi 5.
- Alasan: cukup untuk demo satu instance dan tidak memerlukan komponen baru.
- Konsekuensi: hitungan tidak dibagi antar-instance serverless dan dapat kembali kosong saat cold start. Ini pengaman operasional ringan, bukan pertahanan DDoS. Untuk trafik publik, ganti dengan limiter terdistribusi.
- Status: berlaku untuk prototipe.
