# TRACEABILITY

Peta dari klaim dan komponen di esai ke bagian prototipe yang membuktikannya, beserta keterbatasan tiap pembuktian. Tujuannya agar esai dan prototipe tidak saling bertentangan.

Cara memakai: kolom "Klaim di esai" adalah parafrase. Cocokkan dengan kalimat asli di teks esai, lalu centang kolom Cocok. Kolom Hasil diisi setelah evaluasi dan demo dijalankan.

| No | Klaim atau komponen di esai (parafrase) | Bagian prototipe | Dokumen | Yang dibuktikan | Batas pembuktian | Cocok | Hasil |
|---|---|---|---|---|---|---|---|
| 1 | GSTP memeriksa keterlacakan alokasi Green Sukuk sejak pencairan, bukan hanya lewat laporan tahunan | Alur `/api/periksa` | `ARCHITECTURE.md` | Alur dapat dijalankan end to end | Data simulasi | [ ] | |
| 2 | Tiga lapis: integrasi data, ledger, analitik | Tabel registri dan transaksi, `ledger_entri`, library aturan dan skor | `ARCHITECTURE.md` | Pemetaan lapis ke komponen | Nama lapis dicocokkan ke esai | [ ] | |
| 3 | Aturan deterministik setara logika smart contract | Rule engine tujuh aturan | `RULES.md` | Aturan menangkap pelanggaran jelas | Bukan chaincode sungguhan | [ ] | |
| 4 | Parameter aturan ditetapkan otoritas berwenang | `rules_config.json` bersama | `RULES.md`, `EXPORT_SPEC.md` | Parameter terpisah dari kode | Tidak ada mekanisme otoritas sungguhan | [ ] | |
| 5 | Isolation Forest memberi skor anomali pada transaksi yang lolos aturan | Model dan skor | `MODEL_SPEC.md` | Skor dapat dihitung dan diuji | Fitur dan data buatan sendiri | [ ] | |
| 6 | Peringatan anomali adalah prioritas pemeriksaan, bukan penetapan fraud | Teks UI, status kasus | `WEB_SPEC.md` bagian 1 dan 10 | Bahasa sistem konsisten | Tidak ada | [ ] | |
| 7 | Ledger mencatat metadata, hash, waktu, status verifikasi, jejak persetujuan dan perubahan | `ledger_entri`, verifikasi | `LEDGER_SPEC.md` | Perubahan terdeteksi saat verifikasi | Hash-chain tunggal, bukan jaringan permissioned | [ ] | |
| 8 | Dokumen lengkap dan data sensitif disimpan off-chain, terenkripsi | Hash dokumen simulasi | `LEDGER_SPEC.md` bagian 2 | Pemisahan konsep | Tidak ada dokumen dan enkripsi nyata | [ ] | |
| 9 | Koreksi memperbarui versi data, riwayat tetap tertaut | Entri `koreksi` | `LEDGER_SPEC.md` bagian 3 | Riwayat tidak diubah | Tidak ada | [ ] | |
| 10 | Pengawasan BPK dan otoritas syariah terpisah dari persetujuan operasional | Halaman Tentang | `WEB_SPEC.md` bagian 9 | Hanya penjelasan konsep | Tidak diimplementasikan sebagai peran | [ ] | |
| 11 | Pentahelix sebagai model kolaborasi | Halaman Tentang | `WEB_SPEC.md` bagian 9 | Hanya penjelasan konsep | Tidak diimplementasikan | [ ] | |
| 12 | Implementasi bertahap dan evaluasi terukur | Prototipe tahap awal, protokol evaluasi | `PRD.md`, `EVALUATION.md` | Protokol berjalan pada data simulasi | Bukan data riil | [ ] | |
| 13 | Metrik evaluasi: precision, recall, laju peringatan palsu, waktu deteksi, kelengkapan tautan | Evaluasi dan latensi | `EVALUATION.md` bagian 4 | Angka dilaporkan untuk tiga pendekatan | Definisi waktu deteksi dan kelengkapan tautan perlu dicocokkan ke esai | [ ] | |
| 14 | Hybrid lebih baik daripada aturan saja atau model saja pada skenario simulasi | Perbandingan tiga pendekatan | `EVALUATION.md` | Bukti awal pada skenario dirancang penulis | Kelompok kontekstual sengaja lolos aturan, jadi sebagian akibat rancangan | [ ] | |
| 15 | Data sensitif dilindungi sesuai UU Pelindungan Data Pribadi | Tidak ada data pribadi di prototipe | `ARCHITECTURE.md` bagian 6 | Tidak ada pemrosesan data pribadi | Mekanisme perlindungan tidak dibangun | [ ] | |
| 16 | Hasil riset terdahulu pada Isolation Forest beragam (misalnya F1 dari rendah sampai tinggi) | Bagian pembahasan literatur esai | `DATA_SPEC.md` bagian 7 | Prototipe tidak membandingkan angka langsung | Data berbeda | [ ] | |

## Setelah evaluasi dan demo

1. Isi kolom Hasil dengan angka atau status nyata (misalnya "F1 hybrid pada seed 42: ..." atau "skenario 3 berjalan").
2. Untuk klaim yang hasilnya lebih lemah dari yang tertulis di esai, ubah kalimat esai, bukan hasilnya.
3. Untuk klaim yang tidak diimplementasikan (nomor 8, 10, 11, 15), pastikan esai menyebutnya sebagai rancangan atau pengembangan lanjutan.

## Klaim yang tidak boleh ada di esai

- Prototipe memakai Hyperledger Fabric atau blockchain permissioned.
- Hasil evaluasi berlaku pada data riil Green Sukuk.
- Sistem membuktikan atau mendeteksi fraud.
- Ledger mencegah perubahan data oleh pengelola database.
