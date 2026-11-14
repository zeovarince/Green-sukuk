# Usulan pembaruan untuk esai (revisi)

> Versi revisi 2026-11-14 setelah penyelesaian fase R6 dan R7. Menggantikan `ESSAY_UPDATE.md`. Angka di bawah ini mencerminkan evaluasi model revisi skema v2 (18 fitur dan pemisahan data per proyek D-017).

Angka dan keterbatasan di bawah ini telah diselaraskan dengan hasil evaluasi fase R6. Kolom Cocok pada docs/TRACEABILITY.md menandai kecocokan isi; berkas biner `docs/ESSAI_GSTP_REVISI.docx` sengaja dibiarkan utuh dan memuat tabel pra-revisi sebagai arsip rujukan, sehingga angka resmi evaluasi revisi merujuk pada dokumen ini dan `docs/EVALUATION.md`.

## Catatan revisi prototipe

Semua angka di berkas ini diperbarui dari hasil evaluasi fase R6 (seed 42 dan lima seed). Revisi mencakup penambahan aturan R08 (kesesuaian akad syariah), tiga fitur model (vektor 18 fitur), pemisahan data per proyek (D-017), dan peran simulasi lewat kode akses (D-015).

Esai PDF dan slide yang ada tidak memuat angka evaluasi kuantitatif, sehingga tidak bertentangan. `docs/ESSAI_GSTP_REVISI.docx` memuat Tabel 2 sampai 5 dengan angka pra-revisi dan dibaca bersama catatan pemutakhiran ini.

## Tabel hasil seed 42

| Pendekatan | Precision | Recall | F1 | Laju peringatan palsu | Peringatan per 1.000 transaksi |
|---|---:|---:|---:|---:|---:|
| Aturan saja | 1,0000 | 0,5590 | 0,7171 | 0,0000 | 15,56 |
| Isolation Forest saja | 0,0408 | 0,0062 | 0,0108 | 0,0042 | 4,23 |
| Hybrid | 0,5476 | 0,5714 | 0,5593 | 0,0135 | 29,04 |

Ambang hybrid 0,6251 ditentukan pada data validasi baris lolos aturan dengan batas laju peringatan palsu 2 persen (FAR validasi 1,48%, F1 validasi 0,0166). Ambang Isolation Forest saja 0,6464. Pada kelompok `normal_tidak_lazim_sah` (1.397 baris), laju peringatan palsu adalah 0,00% untuk aturan saja, 3,36% (47 baris) untuk Isolation Forest, dan 10,88% (152 baris) untuk hybrid.

## Kestabilan lima seed (42, 43, 44, 45, 46)

| Metrik hybrid | Rata-rata | Simpangan baku |
|---|---:|---:|
| F1 | 0,5727 | 0,0490 |
| Laju peringatan palsu | 0,0122 | 0,0050 |

Rata-rata laju peringatan palsu setara dengan 1,22 persen dengan simpangan baku 0,50 poin persentase. Lima seed berasal dari pemodelan pada data simulasi dengan pembagian per proyek.

## Usulan paragraf hasil

Pada data uji simulasi seed 42, pendekatan aturan memperoleh F1 0,7171 dengan laju peringatan palsu 0,00 persen dan recall 0,5590. Isolation Forest saja memperoleh F1 0,0108 dan recall 0,0062. Pendekatan hybrid memperoleh recall 0,5714 (menangkap 4 anomali kontekstual lonjakan tanpa progres yang lolos aturan), dengan precision 0,5476, F1 0,5593, dan laju peringatan palsu 1,35 persen. Hybrid menghasilkan 29,04 peringatan per 1.000 transaksi, dibanding 15,56 pada pendekatan aturan. Hasil dilaporkan apa adanya: hybrid memberikan tambahan cakupan recall anomali kontekstual dibanding aturan saja, namun F1-nya lebih rendah dari aturan deterministik murni akibat beban peringatan palsu tambahan. Pada lima seed, rata-rata F1 hybrid adalah 0,5727 (SD 0,0490) dan rata-rata laju peringatan palsunya 1,22 persen (SD 0,0050).

## Usulan paragraf keterbatasan

Data dan label pada penelitian ini dibuat dengan generator simulasi, bukan transaksi nyata kementerian. Model hybrid menangkap sebagian kecil anomali lonjakan progres (recall 0,0678), namun anomali kontekstual berupa pemecahan pencairan, progres stagnan, dan pencairan setelah selesai belum tertangkap pada data uji. Laju peringatan palsu hybrid pada kelompok transaksi sah yang tidak lazim adalah 10,88 persen.

Ledger prototipe merupakan hash-chain dalam satu basis data relasional. Uji perusakan 1.000 entri membuktikan hash-chain mendeteksi 100% modifikasi data, penghapusan baris, penyisipan, dan penukaran urutan entri (tabel log audit biasa mendeteksi 0%), namun sistem tidak mencegah pihak dengan kendali basis data penuh menghitung ulang seluruh rantai tanpa jangkar eksternal. Pemisahan peran disimulasikan lewat kode akses tanpa autentikasi pengguna individual. Peran otoritas syariah mencatat telaah kesesuaian akad atas temuan aturan R08.

## Angka yang belum boleh ditulis sebagai hasil

- Latensi Vercel belum diukur di lingkungan preview (nilai `0.0` pada artefak adalah penanda awal).
- Pengukuran kinerja pada data nyata pembiayaan proyek hijau.
- Skenario publik terhadap proyek Supabase live baru.

## Sumber angka

Angka diambil dari `ml/artifacts/hasil_evaluasi.json` dan dirangkum lengkap di `docs/EVALUATION.md`.
