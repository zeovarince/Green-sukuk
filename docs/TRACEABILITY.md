# TRACEABILITY

Peta dari klaim dan komponen di esai ke bagian prototipe yang membuktikannya, beserta keterbatasan tiap pembuktian. Tujuannya agar esai dan prototipe tidak saling bertentangan.

Cara memakai: kolom "Klaim di esai" adalah parafrase. Cocokkan dengan kalimat asli di teks esai, lalu centang kolom Cocok. Kolom Hasil diisi setelah evaluasi dan demo dijalankan.

Status 2026-10-25: kolom Hasil di bawah mencatat implementasi lokal, hasil eksperimen, atau batas verifikasi yang diketahui. Naskah esai asli tidak ada di repo dan tidak ditemukan pada sesi dokumen tersambung. Karena itu kolom Cocok sengaja belum dicentang. Skenario publik juga belum dijalankan.

| No | Klaim atau komponen di esai (parafrase) | Bagian prototipe | Dokumen | Yang dibuktikan | Batas pembuktian | Cocok | Hasil |
|---|---|---|---|---|---|---|---|
| 1 | GSTP memeriksa keterlacakan alokasi Green Sukuk sejak pencairan, bukan hanya lewat laporan tahunan | Alur `/api/periksa` dan UI F1 | `ARCHITECTURE.md`, `WEB_SPEC.md` | Route dan halaman tersedia; build produksi berhasil. API belum berhasil membaca Supabase. | Data simulasi | [ ] | Halaman lokal menjawab HTTP 200; uji baca langsung Supabase mengembalikan 401 untuk secret key server. |
| 2 | Tiga lapis: integrasi data, ledger, analitik | Tabel registri dan transaksi, `ledger_entri`, library aturan dan skor | `ARCHITECTURE.md` | Komponen dan API ada | Nama lapis dicocokkan ke esai | [ ] | Komponen tersedia di repo; database berisi 800 proyek, 2.719 kontrak, 58.023 transaksi, dan 58.597 entri ledger menurut verifikasi fase 6. |
| 3 | Aturan deterministik setara logika smart contract | Rule engine tujuh aturan | `RULES.md` | Tes kasus emas TypeScript lulus | Bukan chaincode sungguhan | [ ] | 517 tes Vitest lulus; implementasi bukan smart contract atau chaincode. |
| 4 | Parameter aturan ditetapkan otoritas berwenang | `rules_config.json` bersama | `RULES.md`, `EXPORT_SPEC.md` | Parameter dipisah dari kode | Tidak ada mekanisme otoritas sungguhan | [ ] | Parameter terpisah; persetujuan otoritas tidak dibangun. |
| 5 | Isolation Forest memberi skor anomali pada transaksi yang lolos aturan | Model dan skor | `MODEL_SPEC.md` | Skor dihitung dan kasus emas diuji | Fitur dan data buatan sendiri | [ ] | Library TypeScript lulus tes kasus emas; metrik seed 42 tersedia pada `EVALUATION.md`. |
| 6 | Peringatan anomali adalah prioritas pemeriksaan, bukan keputusan pemeriksaan | Teks UI dan status kasus | `WEB_SPEC.md` bagian 1 dan 10 | Antarmuka memakai bahasa prioritas telaah | Tidak ada | [ ] | Catatan permanen tampil di footer dan alur peringatan. |
| 7 | Ledger mencatat metadata, hash, waktu, status verifikasi, jejak persetujuan dan perubahan | `ledger_entri`, verifikasi | `LEDGER_SPEC.md` | Rantai diverifikasi pada basis data | Hash-chain tunggal, bukan jaringan permissioned | [ ] | Verifikasi penuh sebelumnya valid untuk 58.597 entri; pengujian perusakan dari UI belum dilakukan. |
| 8 | Dokumen lengkap dan data sensitif disimpan off-chain, terenkripsi | Hash dokumen simulasi | `LEDGER_SPEC.md` bagian 2 | Baru pemisahan konsep dan hash simulasi | Tidak ada dokumen dan enkripsi nyata | [ ] | Penyimpanan dokumen dan enkripsi tidak dibangun. |
| 9 | Koreksi memperbarui versi data, riwayat tetap tertaut | Entri `koreksi` | `LEDGER_SPEC.md` bagian 3 | Belum dibuktikan oleh alur aplikasi | Fitur koreksi belum dibangun | [ ] | Tidak ada alur koreksi pada UI/API. |
| 10 | Pengawasan BPK dan otoritas syariah terpisah dari persetujuan operasional | Halaman Tentang | `WEB_SPEC.md` bagian 9 | Hanya penjelasan konsep | Tidak diimplementasikan sebagai peran | [ ] | Dijelaskan sebagai rancangan tata kelola, tanpa autentikasi atau pemisahan peran. |
| 11 | Pentahelix sebagai model kolaborasi | Halaman Tentang | `WEB_SPEC.md` bagian 9 | Hanya penjelasan konsep | Tidak diimplementasikan | [ ] | Tabel pihak dan fungsi ditampilkan; tidak ada integrasi antar pihak. |
| 12 | Implementasi bertahap dan evaluasi terukur | Prototipe tahap awal, protokol evaluasi | `PRD.md`, `EVALUATION.md` | Protokol berjalan pada data simulasi | Bukan data riil | [ ] | Evaluasi seed 42 dan lima seed ada; bukan data riil. |
| 13 | Metrik evaluasi: precision, recall, laju peringatan palsu, waktu deteksi, kelengkapan tautan | Evaluasi dan latensi | `EVALUATION.md` bagian 4 | Metrik klasifikasi dilaporkan; pengukuran lain belum lengkap | Waktu deteksi pola dan kelengkapan tautan tidak diukur; Vercel belum diukur | [ ] | Precision, recall, F1, FAR dan peringatan/1.000 tersedia. Latensi lokal 0,03 ms dari artefak; Vercel belum diukur. |
| 14 | Hybrid lebih baik daripada aturan saja atau model saja pada skenario simulasi | Perbandingan tiga pendekatan | `EVALUATION.md` | Klaim ini tidak didukung hasil seed 42 | Hybrid FAR lebih tinggi dan sebagian kelompok rancangan tidak terdeteksi | [ ] | Bertentangan: F1 aturan 0,6608, Isolation Forest 0,0748, hybrid 0,3950. FAR hybrid 0,0344, sedangkan aturan 0. |
| 15 | Data sensitif dilindungi sesuai UU Pelindungan Data Pribadi | Tidak ada data pribadi di prototipe | `ARCHITECTURE.md` bagian 6 | Dataset prototipe tidak berisi data pribadi | Mekanisme perlindungan tidak dibangun | [ ] | Naskah hanya dapat menyatakan prototipe memakai data simulasi dan tidak menguji kepatuhan hukum. |
| 16 | Hasil riset terdahulu pada Isolation Forest beragam (misalnya F1 dari rendah sampai tinggi) | Bagian pembahasan literatur esai | `DATA_SPEC.md` bagian 7 | Belum diverifikasi terhadap sumber pustaka dan kalimat asli | Data dan tugas penelitian berbeda | [ ] | Periksa sitasi dan kalimat pada naskah asli. |

## Setelah evaluasi dan demo

1. Isi kolom Hasil dengan angka atau status nyata (misalnya "F1 hybrid pada seed 42: ..." atau "skenario 3 berjalan").
2. Untuk klaim yang hasilnya lebih lemah dari yang tertulis di esai, ubah kalimat esai, bukan hasilnya.
3. Untuk klaim yang tidak diimplementasikan (nomor 8, 10, 11, 15), pastikan esai menyebutnya sebagai rancangan atau pengembangan lanjutan.

## Klaim yang tidak boleh ada di esai

- Prototipe memakai Hyperledger Fabric atau blockchain permissioned.
- Hasil evaluasi berlaku pada data riil Green Sukuk.
- Sistem membuktikan atau mendeteksi fraud.
- Ledger mencegah perubahan data oleh pengelola database.
