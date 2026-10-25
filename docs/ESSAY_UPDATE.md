# Usulan pembaruan untuk esai

Angka dan keterbatasan di bawah ini telah dimasukkan ke salinan revisi docs/ESSAI_GSTP_REVISI.docx setelah dicocokkan dengan naskah sumber yang diberikan. Naskah sumber di Downloads tidak diubah. Kolom Cocok pada docs/TRACEABILITY.md menandai kecocokan isi secara tekstual; verifikasi daftar pustaka masih diperlukan karena bagian daftar pustaka pada sumber kosong.

## Tabel hasil seed 42

| Pendekatan | Precision | Recall | F1 | Laju peringatan palsu | Peringatan per 1.000 transaksi |
|---|---:|---:|---:|---:|---:|
| Aturan saja | 1,0000 | 0,4935 | 0,6608 | 0,0000 | 16,32 |
| Isolation Forest saja | 0,8333 | 0,0392 | 0,0748 | 0,0003 | 1,55 |
| Hybrid | 0,3293 | 0,4935 | 0,3950 | 0,0344 | 49,56 |

Ambang hybrid 0,665 ditentukan pada data validasi dengan batas laju peringatan palsu 2 persen. Ambang Isolation Forest saja 0,7039. Pada kelompok `normal_tidak_lazim_sah` (1.401 baris), laju peringatan palsu adalah 0 persen untuk aturan, 0,21 persen untuk Isolation Forest, dan 27,48 persen untuk hybrid.

## Kestabilan lima seed

| Metrik hybrid | Rata-rata | Simpangan baku |
|---|---:|---:|
| F1 | 0,3894 | 0,0049 |
| Laju peringatan palsu | 0,0356 | 0,0011 |

Nilai terakhir setara dengan laju rata-rata 3,56 persen dan simpangan baku 0,11 poin persentase. Lima seed berasal dari generator yang sama, bukan lima populasi dunia nyata.

## Usulan paragraf hasil

Pada data uji simulasi seed 42, pendekatan aturan memperoleh F1 0,6608 dengan laju peringatan palsu 0 persen. Isolation Forest saja memperoleh F1 0,0748 dan recall 0,0392. Pendekatan hybrid memperoleh recall 0,4935, sama dengan pendekatan aturan, tetapi precision-nya 0,3293, F1 0,3950, dan laju peringatan palsu 3,44 persen. Hybrid menghasilkan 49,56 peringatan per 1.000 transaksi, dibanding 16,32 pada pendekatan aturan. Karena itu, hasil ini tidak menunjukkan bahwa hybrid lebih baik secara keseluruhan pada seed tersebut. Pada lima seed dari generator yang sama, rata-rata F1 hybrid adalah 0,3894 dengan simpangan baku 0,0049; rata-rata laju peringatan palsunya 3,56 persen dengan simpangan baku 0,11 poin persentase.

## Usulan paragraf keterbatasan

Data dan label pada penelitian ini dibuat dengan generator, bukan transaksi Green Sukuk yang sebenarnya. Beberapa anomali dirancang agar tertangkap aturan dan kelompok kontekstual dirancang lolos dari aturan. Pada seed 42, recall hybrid untuk `lonjakan_tanpa_progres`, `pemecahan_pencairan`, `pencairan_setelah_selesai`, dan `progres_stagnan_tapi_cair` adalah 0. Laju peringatan palsu hybrid pada kelompok transaksi sah yang tampak tidak lazim mencapai 27,48 persen. Hasil tersebut merupakan pengukuran pada skenario buatan dan belum membuktikan kemampuan pada data nyata.

Ledger prototipe merupakan hash-chain dalam satu basis data PostgreSQL. Verifikasi dapat menemukan perubahan pada rantai yang disimpan, tetapi sistem tidak mencegah pengelola basis data menulis ulang seluruh rantai. Prototipe belum memakai konsensus antar lembaga, dokumen asli terenkripsi, autentikasi pengguna, atau pemisahan peran. Pentahelix serta pengawasan BPK dan otoritas syariah masih berupa rancangan tata kelola.

## Angka yang belum boleh ditulis sebagai hasil

- Latensi Vercel belum diukur. Nilai `0.0` di artefak bukan hasil pengukuran.
- Waktu deteksi pola beruntun dan kelengkapan tautan alokasi belum diukur.
- Skenario demo belum dijalankan di URL publik.
- Prototipe belum memakai jaringan blockchain permissioned dan belum mencegah perubahan data.

## Sumber angka

Angka diambil dari `ml/artifacts/hasil_evaluasi.json` dan diringkas di `docs/EVALUATION.md`. Jika esai menggunakan definisi metrik yang berbeda, samakan definisinya sebelum menyalin angka.
