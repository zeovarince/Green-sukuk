# LIMITATIONS

Asumsi dan keterbatasan prototipe. Teks di bagian "Untuk esai" ditulis agar bisa dipindahkan ke bagian keterbatasan atau penutup esai dengan sedikit penyesuaian.

## 1. Data

- **Data simulasi.** Seluruh data dibuat generator. Nilai kontrak, pola pencairan, ambang persetujuan, kategori, dan parameter lain adalah asumsi penulis. Tidak ada data Kementerian Keuangan atau kementerian pelaksana.
- **Anomali disuntikkan.** Label anomali diketahui karena dibuat sendiri. Pada data riil, label tidak tersedia dan anomali tidak punya bentuk yang sebersih ini.
- **Rancangan membantu hybrid.** Anomali kontekstual dibuat lolos dari aturan, dan anomali aturan dibuat tertangkap aturan. Maka keunggulan hybrid atas aturan saja sebagian merupakan akibat rancangan, bukan temuan independen.
- **Proporsi anomali.** Sekitar 3 persen sengaja dipilih lebih tinggi dari proporsi di literatur (sekitar 0,17 sampai 0,6 persen) agar metrik stabil pada ukuran data ini.
- **Anomali lebih mudah dipisahkan.** Data buatan cenderung lebih rapi dari data riil, sehingga angka metrik kemungkinan lebih baik daripada yang akan terjadi di lapangan.
- **Sebaran antar split.** Anomali yang hanya muncul pada kontrak selesai lebih banyak di data awal. Jumlah per subtipe di data pengujian bisa kecil.

## 2. Model dan evaluasi

- **Fitur rancangan penulis.** Hasil bergantung pada fitur yang dipilih, termasuk tiga fitur konteks waktu. Fitur lain bisa memberi hasil berbeda.
- **Ambang.** Ditentukan dari satu cara (maksimum F1 dengan batas laju peringatan palsu) pada data validasi. Cara lain memberi kompromi precision dan recall yang berbeda.
- **Beberapa seed.** Hasil dilaporkan dengan beberapa seed, tetapi semuanya dari generator yang sama. Variasi antar seed tidak menggantikan variasi antar dunia nyata.
- **Perbandingan dengan paper lain.** Angka tidak setara karena data dan tugasnya berbeda.
- **Penjelasan skor.** Isolation Forest tidak menjelaskan sendiri sebab keganjilan. Pembanding di halaman detail adalah konteks, bukan penyebab.

## 3. Ledger

- **Bukan blockchain terdistribusi.** Ledger adalah hash-chain di satu database Postgres. Tidak ada banyak organisasi, konsensus, endorsement, atau kanal.
- **Terdeteksi, bukan tercegah.** Perubahan terdeteksi saat verifikasi, tetapi tidak dicegah. Pemegang akses penuh ke database bisa menghitung ulang seluruh rantai.
- **Perlu jangkar.** Untuk keamanan nyata, hash terakhir perlu dipublikasikan atau disimpan di pihak lain, atau ledger dipindahkan ke jaringan permissioned seperti Hyperledger Fabric.
- **Dokumen simulasi.** Tidak ada dokumen asli, enkripsi, atau hak akses. Yang ada hanya hash simulasi.

## 4. Sistem dan keamanan

- **Tanpa autentikasi sungguhan.** Penulisan hanya dijaga kode akses dan pembatasan laju. Tidak ada peran, identitas pengguna, atau jejak siapa melakukan apa.
- **Pemisahan peran tidak dibangun.** Pemisahan pengawasan BPK dan otoritas syariah dari persetujuan operasional hanya dijelaskan secara konsep.
- **Layanan gratis.** Database gratis dijeda saat tidak aktif dan tidak memiliki cadangan otomatis. Fungsi serverless memiliki batas waktu dan mulai dingin.
- **Dua implementasi logika.** Aturan dan skor ada di Python dan TypeScript. Tes kesesuaian mengurangi risiko perbedaan, tetapi tidak menghapusnya sepenuhnya.
- **Tidak ada pengujian beban atau keamanan formal.**

## 5. Cakupan

- Prototipe mencakup tahap awal rancangan, bukan implementasi lengkap lintas lembaga.
- Aspek kebijakan, tata kelola, dan integrasi dengan sistem pemerintah tidak diuji.
- Tidak ada validasi oleh auditor atau pihak berwenang sungguhan.

## 6. Untuk esai

Teks berikut dapat dipakai sebagai dasar:

> Prototipe diuji pada data simulasi yang dibuat penulis, dengan anomali yang disuntikkan. Hasilnya merupakan bukti awal bahwa kombinasi aturan dan skor anomali dapat memprioritaskan pemeriksaan pada skenario yang dirancang, bukan bukti kinerja pada data riil. Anomali kontekstual dirancang tidak tertangkap oleh aturan, sehingga keunggulan pendekatan gabungan sebagian mencerminkan rancangan skenario. Ledger pada prototipe berupa rantai hash di satu basis data. Ia membuat perubahan terdeteksi, tetapi belum memiliki sifat terdistribusi dan konsensus antar lembaga seperti pada jaringan permissioned. Validasi dengan data riil, pemisahan peran, dan jaringan permissioned sungguhan merupakan tahap pengembangan berikutnya.

Sesuaikan kalimat dengan angka hasil nyata dan dengan istilah yang dipakai di esai.
