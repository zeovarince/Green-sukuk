# GLOSSARY

Istilah yang dipakai di dokumen dan prototipe, ditulis ringkas agar tim punya pemahaman yang sama. Untuk istilah yang juga ada di esai, pakai definisi di esai jika berbeda dari catatan ini.

## Keuangan dan syariah

| Istilah | Arti singkat |
|---|---|
| SBSN | Surat Berharga Syariah Negara, sukuk yang diterbitkan pemerintah |
| Sukuk | Surat berharga syariah yang didukung aset atau proyek yang mendasarinya |
| Green Sukuk | Sukuk yang hasil penerbitannya dialokasikan untuk proyek hijau |
| DJPPR | Direktorat Jenderal Pengelolaan Pembiayaan dan Risiko, Kementerian Keuangan |
| BPK | Badan Pemeriksa Keuangan, lembaga pemeriksa independen |
| Akad | Perjanjian yang mendasari transaksi syariah |
| Ijarah Asset to Be Leased | Jenis akad sewa atas aset yang akan disewakan, dipakai pada beberapa penerbitan sukuk negara |
| Wakalah | Akad perwakilan, satu pihak bertindak atas nama pihak lain |
| Amanah | Kepercayaan atau titipan yang harus dijaga dan dipertanggungjawabkan |
| Hifz al-mal | Perlindungan harta, salah satu tujuan pokok syariah (maqasid) |
| Maqasid syariah | Tujuan-tujuan pokok syariah |
| Otoritas syariah | Pihak yang menelaah kesesuaian akad dan parameter dengan prinsip syariah |
| Register alokasi | Catatan yang menautkan seri penerbitan dengan proyek penerima alokasi (padanannya di prototipe: tabel registri) |

## Proyek dan kontrak

| Istilah | Arti singkat |
|---|---|
| Pagu alokasi | Batas dana yang boleh dicairkan untuk kontrak |
| Termin | Pembayaran bertahap sesuai kemajuan pekerjaan |
| Uang muka | Pembayaran di awal kontrak sebelum pekerjaan berjalan |
| Retensi | Bagian pembayaran yang ditahan dan dibayar setelah pekerjaan selesai |
| Addendum | Perubahan resmi pada kontrak, misalnya perubahan nilai |
| Milestone | Tonggak pekerjaan yang diverifikasi sebelum pembayaran |
| Kurva-S | Pola kemajuan proyek yang lambat di awal, cepat di tengah, melambat di akhir |
| Kategori hijau | Kelompok proyek yang memenuhi syarat sebagai proyek hijau |

## Teknologi

| Istilah | Arti singkat |
|---|---|
| Blockchain permissioned | Blockchain yang pesertanya terdaftar dan berizin |
| Hyperledger Fabric | Kerangka blockchain permissioned sumber terbuka |
| Smart contract atau chaincode | Program aturan yang berjalan di jaringan blockchain |
| On-chain dan off-chain | Disimpan di ledger blockchain dan disimpan di luar ledger |
| Hash | Sidik jari digital sebuah data, berubah jika datanya berubah |
| SHA-256 | Fungsi hash yang menghasilkan nilai 256 bit |
| Hash-chain | Rantai catatan yang setiap catatannya memuat hash catatan sebelumnya |
| Tamper-evident | Perubahan terdeteksi, belum tentu tercegah |
| Row Level Security (RLS) | Fitur Postgres untuk membatasi akses per baris |
| Service role key | Kunci Supabase dengan akses penuh, hanya untuk server |
| Serverless | Kode dijalankan sesuai permintaan tanpa mengelola server sendiri |
| Cold start | Keterlambatan pada permintaan pertama setelah fungsi lama tidak dipakai |

## Analitik dan evaluasi

| Istilah | Arti singkat |
|---|---|
| Isolation Forest | Metode deteksi anomali tanpa label yang mengisolasi data dengan pohon acak. Data ganjil lebih cepat terisolasi |
| Skor anomali | Angka 0 sampai 1, makin besar makin tidak lazim |
| Ambang | Batas skor untuk menandai peringatan |
| Fitur | Variabel masukan model |
| Unsupervised | Dilatih tanpa label |
| Precision | Dari semua peringatan, proporsi yang benar |
| Recall | Dari semua anomali, proporsi yang tertangkap |
| F1 | Rata-rata harmonik precision dan recall |
| Laju peringatan palsu | Proporsi transaksi normal yang ditandai |
| Split berdasarkan waktu | Data dibagi menurut urutan waktu, bukan acak |
| Kebocoran data (leakage) | Informasi yang tidak tersedia saat keputusan ikut dipakai di model |
| Kasus emas (golden case) | Kasus uji dengan jawaban dari implementasi acuan |
| Tes kesesuaian | Tes bahwa dua implementasi memberi hasil yang sama |
| Seed | Angka awal pembangkit acak agar hasil bisa diulang |

## Kerangka dan kelembagaan

| Istilah | Arti singkat |
|---|---|
| Pentahelix | Model kolaborasi lima unsur: pemerintah, akademisi, bisnis atau teknologi, komunitas, media |
| GSTP | Green Sukuk Traceability Protocol, protokol keterlacakan yang diusulkan di esai |
| PRD | Product Requirements Document, dokumen kebutuhan produk |
| ADR | Architecture Decision Record, catatan keputusan arsitektur (`DECISIONS.md`) |
