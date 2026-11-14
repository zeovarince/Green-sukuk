# LIMITATIONS (revisi)

> Versi revisi 2026-11-13, draf menunggu persetujuan pemilik. Menggantikan `LIMITATIONS.md` setelah disetujui. Revisi: REV-03, REV-04, REV-09 sampai REV-11, REV-14 (batas baru, status deploy diperbarui). Rincian di `PERUBAHAN_revisi.md`.

Asumsi dan keterbatasan prototipe. Teks di bagian "Untuk esai" ditulis agar bisa dipindahkan ke bagian keterbatasan atau penutup esai dengan sedikit penyesuaian.

## 1. Data

- **Data simulasi.** Seluruh data dibuat generator. Nilai kontrak, pola pencairan, ambang persetujuan, kategori, dan parameter lain adalah asumsi penulis. Tidak ada data Kementerian Keuangan atau kementerian pelaksana.
- **Anomali disuntikkan.** Label anomali diketahui karena dibuat sendiri. Pada data riil, label tidak tersedia dan anomali tidak punya bentuk yang sebersih ini.
- **Rancangan membantu hybrid.** Anomali kontekstual dibuat lolos dari aturan, dan anomali aturan dibuat tertangkap aturan. Maka keunggulan hybrid atas aturan saja sebagian merupakan akibat rancangan, bukan temuan independen.
- **Proporsi anomali.** Sekitar 3 persen sengaja dipilih lebih tinggi dari proporsi di literatur (sekitar 0,17 sampai 0,6 persen) agar metrik stabil pada ukuran data ini.
- **Anomali lebih mudah dipisahkan.** Data buatan cenderung lebih rapi dari data riil, sehingga angka metrik kemungkinan lebih baik daripada yang akan terjadi di lapangan.
- **Sebaran antar split.** Anomali yang hanya muncul pada kontrak selesai lebih banyak di data awal. Jumlah per subtipe di data pengujian bisa kecil.
- **Pemisahan per proyek tidak bersih menurut waktu.** Split mengikuti proyek, bukan baris (D-017). Rentang tanggal antar split saling tumpang tindih, jadi sebagian transaksi latih lebih baru daripada sebagian transaksi uji milik proyek lain. Tidak ada kebocoran di dalam satu kontrak.
- **Akad hanya dua jenis.** Data memakai dua akad. R08 mencocokkan akad pada transaksi dengan registri dan tidak menilai kesesuaian syariah.

## 2. Model dan evaluasi

- **Fitur rancangan penulis.** Hasil bergantung pada 18 fitur yang dipilih, termasuk tiga fitur konteks waktu dan tiga fitur tambahan revisi. Fitur lain bisa memberi hasil berbeda.
- **Deviasi jadwal bersifat sirkular.** Jadwal rencana tidak ada pada data, jadi `deviasi_jadwal_pct` memakai kurva-S acuan yang berbentuk sama dengan kurva generator. Fitur ini lebih informatif pada data simulasi daripada pada data nyata. Perbaikan metrik yang berasal dari fitur ini tidak boleh dibaca sebagai bukti pada data riil.
- **Median kelompok dari data simulasi.** Tabel referensi kelompok dihitung dari data pengembangan simulasi. Pada data nyata, kelompok pembanding perlu bersumber dari data asli.
- **Irisan uji konsep kecil.** Irisan satu kategori dan satu tahun memiliki baris dan anomali jauh lebih sedikit, jadi metrik per subtipe tidak stabil.
- **Uji perusakan memakai pembanding sederhana.** Tabel log tanpa hash dibandingkan dengan hash-chain. Basis data berjejak audit dengan hash per baris akan setara. Skenario hitung ulang seluruh rantai tidak terdeteksi oleh keduanya.
- **Ambang.** Ditentukan dari satu cara (maksimum F1 dengan batas laju peringatan palsu) pada data validasi. Cara lain memberi kompromi precision dan recall yang berbeda.
- **Beberapa seed.** Hasil dilaporkan dengan beberapa seed, tetapi semuanya dari generator yang sama. Variasi antar seed tidak menggantikan variasi antar dunia nyata.
- **Perbandingan dengan paper lain.** Angka tidak setara karena data dan tugasnya berbeda.
- **Penjelasan skor.** Isolation Forest tidak menjelaskan sendiri sebab keganjilan. Pembanding di halaman detail adalah konteks, bukan penyebab.

## 3. Ledger

- **Bukan blockchain terdistribusi.** Ledger adalah hash-chain di satu database Postgres. Tidak ada banyak organisasi, konsensus, endorsement, atau kanal.
- **Terdeteksi, bukan tercegah.** Perubahan terdeteksi saat verifikasi, tetapi tidak dicegah. Pemegang akses penuh ke database bisa menghitung ulang seluruh rantai.
- **Perlu jangkar.** Untuk keamanan nyata, hash terakhir perlu dipublikasikan atau disimpan di pihak lain, atau ledger dipindahkan ke jaringan permissioned seperti Hyperledger Fabric.
- **Dokumen simulasi.** Tidak ada dokumen asli, enkripsi, atau hak akses. Yang ada hanya hash simulasi. Panel bukti di UI menampilkan hash dan kelengkapan, bukan dokumen.
- **Koreksi menjaga riwayat, bukan mencegah perubahan.** Koreksi menambah entri baru dan tidak mengubah entri lama. Penanda `digantikan_oleh` pada tabel `transaksi` dapat diubah oleh pemegang akses database, dan ledger-lah yang menyimpan jejaknya.

## 4. Sistem dan keamanan

- **Tanpa autentikasi sungguhan.** Penulisan dijaga kode akses dan pembatasan laju. Tidak ada akun atau identitas pengguna.
- **Peran hanya simulasi.** Penyedia data, auditor, pejabat berwenang, dan otoritas syariah dibedakan oleh kode akses (D-015). Kode yang bocor memberi peran penuh pemiliknya. Field `peran`, `pengusul`, dan `verifikator` di ledger mencatat apa yang dikirim, bukan siapa orangnya. Dalam mode satu kode (tiga kode peran kosong), tidak ada pemisahan.
- **Telaah syariah hanya dicatat.** Peran otoritas syariah mencatat putusan atas temuan R08. Prototipe tidak menilai kesesuaian syariah dan tidak diuji oleh otoritas sungguhan.
- **Pengawasan BPK tetap konsep.** Pengawasan BPK dan integrasi dengan pihak lain (Pentahelix) tidak dibangun.
- **Layanan gratis.** Database gratis dijeda saat tidak aktif dan tidak memiliki cadangan otomatis. Fungsi serverless memiliki batas waktu dan mulai dingin.
- **Dua implementasi logika.** Aturan dan skor ada di Python dan TypeScript. Tes kesesuaian mengurangi risiko perbedaan, tetapi tidak menghapusnya sepenuhnya.
- **Tidak ada pengujian beban atau keamanan formal.**
- **Sudah live, belum diukur.** Prototipe versi sebelum revisi berjalan di https://green-sukuk.vercel.app. Latensi di Vercel dan skenario demo di URL publik belum diukur. Nilai Vercel `0.0` di artefak evaluasi adalah placeholder, bukan hasil. Pengukuran dijadwalkan pada fase R3 dan R7 (`TASKS_revisi.md`).
- **Status migrasi di database live tidak diverifikasi.** Penulis dokumen tidak dapat memeriksa apakah `supabase/phase8_demo_backup.sql` sudah dijalankan di proyek live. Pemilik perlu mengeceknya sebelum memakai mode perusakan demo. Versi revisi memakai proyek Supabase baru dengan skema lengkap (`DATABASE_SPEC.md` bagian 9).
- **Alur yang menulis ke Supabase hanya teruji dengan penyimpanan tiruan.** Alur koreksi, telaah syariah, dan perpindahan status per peran perlu diuji pemilik di lingkungan live (`DEMO_SCRIPT.md` skenario 9 sampai 11).

## 5. Cakupan

- Prototipe mencakup tahap awal rancangan, bukan implementasi lengkap lintas lembaga.
- Aspek kebijakan, tata kelola, dan integrasi dengan sistem pemerintah tidak diuji.
- Tidak ada validasi oleh auditor atau pihak berwenang sungguhan.

## 6. Untuk esai

Teks berikut dapat dipakai sebagai dasar, setelah angka dan batas di atas disertakan:

> Prototipe diuji pada data simulasi yang dibuat penulis, dengan anomali yang disuntikkan. Hasilnya merupakan bukti awal bahwa kombinasi aturan dan skor anomali dapat memprioritaskan pemeriksaan pada skenario yang dirancang, bukan bukti kinerja pada data riil. Anomali kontekstual dirancang tidak tertangkap oleh aturan, sehingga keunggulan pendekatan gabungan sebagian mencerminkan rancangan skenario. Ledger pada prototipe berupa rantai hash di satu basis data. Ia membuat perubahan terdeteksi, tetapi belum memiliki sifat terdistribusi dan konsensus antar lembaga seperti pada jaringan permissioned. Pemisahan peran pada prototipe hanya disimulasikan dengan kode akses. Validasi dengan data riil, autentikasi dan identitas pengguna, serta jaringan permissioned sungguhan merupakan tahap pengembangan berikutnya.

Sesuaikan kalimat dengan angka hasil nyata dan dengan istilah yang dipakai di esai.

Rangkuman angka dan usulan teks yang sudah disesuaikan dengan hasil tersedia di `docs/ESSAY_UPDATE.md`. Naskah esai sumber belum tersedia di repo atau sesi dokumen, jadi teks tersebut belum dimasukkan ke naskah asli.
