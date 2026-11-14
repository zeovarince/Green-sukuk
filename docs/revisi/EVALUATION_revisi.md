# EVALUATION (revisi)

> Versi revisi 2026-11-13, draf menunggu persetujuan pemilik. Menggantikan `EVALUATION.md` setelah disetujui. Revisi: REV-05 (irisan uji konsep), REV-06 sampai REV-08 (metrik tambahan). Rincian di `PERUBAHAN_revisi.md`.

Protokol evaluasi untuk membandingkan tiga pendekatan: aturan saja, Isolation Forest saja, dan hybrid. Dokumen ini adalah protokol. Angka hasil tidak ditulis di sini sebelum dijalankan. Setelah evaluasi selesai, salin angka dari `ml/artifacts/hasil_evaluasi.json` ke bagian 8.

## 1. Pertanyaan yang dijawab

1. Apakah hybrid menangkap anomali yang tidak tertangkap aturan saja, dan dengan beban peringatan palsu seperti apa?
2. Apakah aturan menangkap pelanggaran jelas yang terlewat oleh Isolation Forest saja?
3. Seberapa konsisten hasilnya pada beberapa seed data?
4. Seberapa cepat pola beruntun tertangkap, dan seberapa lengkap tautan data? (bagian 4A dan 4B)
5. Apakah hash-chain mendeteksi perubahan yang tidak terdeteksi tabel log biasa? (bagian 4D)

Evaluasi tidak menjawab: apakah sistem akan bekerja di data riil.

## 2. Unit penilaian

Satu baris transaksi adalah satu unit. Label benar adalah `label_anomali`. Peringatan adalah keluaran sistem: 1 jika transaksi ditandai, 0 jika tidak.

## 3. Data dan urutan penggunaan

1. Latih pada `pengembangan`.
2. Tentukan ambang pada `validasi` (`MODEL_SPEC.md`, bagian 6).
3. Laporkan metrik pada `pengujian`. Jangan mengubah model atau ambang setelah melihat hasil `pengujian`.
4. Metrik `validasi` ditampilkan sebagai pembanding, bukan hasil utama.
5. Irisan uji konsep (bagian 4F) dihitung dari baris `pengujian` yang sama. Irisan itu tidak dipakai untuk memilih model, fitur, atau ambang.
6. Pemisahan data mengikuti proyek (`DATA_SPEC.md` bagian 6).

## 4. Metrik

Misalkan TP, FP, TN, FN dihitung menurut bagian 2.

| Metrik | Rumus | Catatan |
|---|---|---|
| Precision | TP / (TP + FP) | Dari semua peringatan, berapa yang benar |
| Recall | TP / (TP + FN) | Dari semua anomali, berapa yang tertangkap |
| F1 | 2PR / (P + R) | Ringkasan precision dan recall |
| Laju peringatan palsu (false alarm rate) | FP / (FP + TN) | Beban pada transaksi normal |
| Peringatan per 1.000 transaksi | 1000 x (TP + FP) / N | Beban kerja auditor |
| Recall per subtipe | Recall dihitung hanya pada baris subtipe tertentu | Menunjukkan apa yang ditangkap tiap pendekatan |
| Laju peringatan palsu pada `normal_tidak_lazim_sah` | Baris kelompok itu yang ditandai / jumlah baris kelompok | Seberapa sering kasus sah dianggap janggal |

Metrik tambahan untuk esai:

| Metrik | Definisi untuk prototipe |
|---|---|
| Waktu deteksi | (a) Latensi pemrosesan satu transaksi di route `/api/periksa`, dalam milidetik, diukur di lokal dan di Vercel. (b) Untuk pola beruntun (`pemecahan_pencairan`, `progres_stagnan_tapi_cair`), jumlah transaksi dalam pola sampai baris pertama ditandai |
| Kelengkapan tautan alokasi | Persentase transaksi yang tertaut penuh: `project_id` valid, kontrak ada, hash cocok, dan memiliki entri ledger |

Definisi waktu deteksi dan kelengkapan tautan di atas adalah definisi prototipe. Bagian 4A sampai 4F merinci cara menghitungnya. Cocokkan dengan rumusan di rancangan evaluasi esai dan samakan salah satunya.

### 4A. Waktu deteksi pola beruntun (REV-06)

Pola beruntun adalah rangkaian baris berlabel anomali dengan subtipe `pemecahan_pencairan` atau `progres_stagnan_tapi_cair` pada kontrak yang sama, berurutan menurut `trx_id`, tanpa baris non-anomali dari kontrak itu di antaranya.

Untuk tiap pola dan tiap pendekatan, catat posisi (1, 2, 3, dan seterusnya) baris pertama yang ditandai. Bila tidak ada baris yang ditandai, pola itu tidak terdeteksi. Laporkan jumlah pola, persentase pola yang terdeteksi, dan median posisi pada pola yang terdeteksi. Bila persentase terdeteksi nol, laporkan nol dan jangan mengganti definisi.

### 4B. Kelengkapan tautan (REV-06)

Persentase transaksi dengan keempat syarat berikut, dihitung pada split `pengujian` dan pada seluruh data:
1. `project_id` ada di `registri_proyek`.
2. `kontrak_id` ada di `registri_kontrak` dan milik `project_id` itu.
3. `hash_tercatat` sama dengan `hash_dokumen_saat_ini`.
4. Ada entri ledger jenis `transaksi` untuk `trx_id` itu.

Laporkan tiap syarat dan gabungannya. Pada data simulasi, angka ini mengukur kelengkapan data buatan dan bukan keterlacakan di dunia nyata.

### 4C. Biaya (REV-07)

Catat apa adanya, tanpa mengubahnya menjadi rupiah:
- Ukuran `model_if.json` dan waktu pelatihan.
- Waktu inferensi satu transaksi, lokal.
- Jumlah baris dan ukuran tabel `transaksi` dan `ledger_entri` (dari dashboard Supabase).
- Waktu verifikasi penuh rantai, lokal dan lewat API per rentang.
- Paket layanan yang dipakai (Vercel, Supabase), batasnya, dan tanggal pengecekan.

Pemeliharaan dicatat sebagai daftar pekerjaan berkala yang diketahui (isi ulang data bila generator berubah, ekspor ulang artefak, cek proyek yang dijeda), bukan sebagai angka.

### 4D. Uji perusakan hash-chain melawan tabel log biasa (REV-08)

Uji ini menjawab kalimat esai tentang perbandingan dengan basis data berjejak audit.

Salinan ledger lokal berisi 1.000 entri pertama. Lima skenario, masing-masing 200 kali dengan posisi acak (seed 42):
1. Ubah `payload_kanonik` satu entri.
2. Hapus satu entri.
3. Sisipkan satu entri palsu.
4. Tukar urutan dua entri bersebelahan.
5. Ubah satu entri, lalu hitung ulang seluruh rantai sesudahnya.

Dua sistem diuji: hash-chain prototipe, dan tabel log biasa (kolom data dan waktu, tanpa hash). Metrik: persentase percobaan yang terdeteksi, dan persentase yang `rusak_pada` menunjuk entri terdampak pertama.

Hasil yang diharapkan berdasarkan rancangan: hash-chain mendeteksi skenario 1 sampai 4, tabel log biasa tidak mendeteksi apa pun, dan skenario 5 tidak terdeteksi oleh keduanya tanpa hash jangkar di luar database. Skenario 5 dilaporkan sebagai batas yang sudah tercatat di `LEDGER_SPEC.md` bagian 10.

Batas uji: pembanding sengaja sederhana. Basis data berjejak audit dengan hash per baris akan setara dengan hash-chain. Uji ini memperlihatkan nilai penautan hash. Nilai konsensus antar lembaga tidak dapat diuji pada prototipe satu database.

### 4E. Latensi (REV-07)

Pada URL publik: 30 permintaan `simpan: false` berurutan ke `/api/periksa` pada satu kontrak, ditambah satu permintaan pertama setelah diam sedikitnya 10 menit untuk mulai dingin. Laporkan median dan persentil 95 untuk `waktu_proses_ms` (server) dan waktu total di sisi klien, bersama lokasi pengukur, tanggal, serta region Vercel dan Supabase. Satu lokasi dan satu hari tidak mewakili kondisi lain, dan laporan harus menyebut itu.

### 4F. Irisan uji konsep (REV-05)

Esai (hlm. 4 dan Lampiran 2) menyebut uji konsep pada satu kategori proyek dalam satu siklus anggaran. Irisan ini menjawabnya.

- Baris: split `pengujian`, `kategori_hijau` sama dengan `Pengelolaan air dan air limbah` (padanan kelompok bendungan, danau, dan infrastruktur tampungan air pada slide 2; data tidak memiliki subkategori bendungan).
- Periode: satu tahun kalender (tahun anggaran). Pilih tahun penuh yang memiliki baris terbanyak pada irisan, sebelum melihat metrik. Catat tahun, alasan, dan jumlah baris (D-019).
- Metrik: sama dengan tabel utama, ditambah jumlah baris dan jumlah anomali per subtipe.
- Bila jumlah anomali per subtipe kecil, tulis bahwa metrik irisan tidak stabil.

## 5. Beberapa seed

Satu seed tidak cukup karena anomali disuntikkan secara acak.

1. Jalankan alur lengkap (generator, latih, ambang, evaluasi) untuk minimal lima seed, misalnya 42, 43, 44, 45, 46.
2. Laporkan rata-rata dan simpangan baku tiap metrik utama pada `pengujian`.
3. Tabel utama esai boleh memakai seed 42 asalkan rata-rata dan simpangan baku lima seed disertakan.

## 6. Hal yang wajib dilaporkan jujur

- Anomali kontekstual dirancang lolos dari aturan, jadi recall aturan saja pada kelompok itu adalah 0 menurut rancangan. Jangan menyajikan keunggulan hybrid sebagai temuan independen.
- Jumlah anomali per subtipe di `pengujian` bisa kecil. Sebutkan jumlahnya di tabel. Jika sangat sedikit, beri catatan bahwa recall subtipe tidak stabil.
- Data simulasi lebih mudah dipisahkan daripada data riil. Angka tidak untuk dibandingkan langsung dengan paper lain.
- Ambang ditentukan dengan cara tertentu (`MODEL_SPEC.md`). Sebutkan cara dan batasnya.

## 7. Format tabel hasil

Tabel utama (data `pengujian`, satu baris per pendekatan):

| Pendekatan | Precision | Recall | F1 | Laju peringatan palsu | Peringatan per 1.000 |
|---|---|---|---|---|---|
| Aturan saja | | | | | |
| Isolation Forest saja | | | | | |
| Hybrid | | | | | |

Tabel kedua: recall per subtipe, kolom per pendekatan, disertai jumlah baris subtipe di `pengujian`.

Tabel ketiga: rata-rata dan simpangan baku lima seed untuk F1 dan laju peringatan palsu.

Tabel keempat: waktu deteksi pola beruntun (bagian 4A) dan kelengkapan tautan (bagian 4B).

Tabel kelima: biaya (bagian 4C) dan latensi lokal serta Vercel (bagian 4E).

Tabel keenam: uji perusakan, satu baris per skenario dan per sistem (bagian 4D).

Tabel ketujuh: irisan uji konsep, format sama dengan tabel utama (bagian 4F).

## 8. Hasil

> Angka di bagian ini berasal dari sebelum revisi (seed 42, commit `5bdaadb`). Setelah fase R6 di `TASKS_revisi.md`, ganti seluruh bagian ini dengan hasil baru dan hapus angka lama. Jangan menyalin angka lama ke hasil baru.

Dihasilkan pada 2026-10-24 dengan seed utama 42 dari `ml/artifacts/hasil_evaluasi.json`.

Ambang hybrid: 0,6650 (cara: batas laju false alarm 2 persen pada baris lolos aturan di validasi). Ambang Isolation Forest saja: 0,7039.

### Tabel Utama (Data Pengujian)

| Pendekatan | Precision | Recall | F1 | Laju peringatan palsu | Peringatan per 1.000 |
|---|---|---|---|---|---|
| Aturan saja | 1,0000 | 0,4935 | 0,6608 | 0,0000 | 16,32 |
| Isolation Forest saja | 0,8333 | 0,0392 | 0,0748 | 0,0003 | 1,55 |
| Hybrid | 0,3293 | 0,4935 | 0,3950 | 0,0344 | 49,56 |

### Tabel Kedua: Recall per Subtipe Anomali (Data Pengujian)

| Subtipe Anomali | n (pengujian) | Aturan saja | Isolation Forest saja | Hybrid |
|---|---|---|---|---|
| bukti_wajib_hilang | 26 | 1,0000 | 0,0000 | 1,0000 |
| hash_tidak_cocok | 32 | 1,0000 | 0,0000 | 1,0000 |
| id_proyek_tidak_valid | 25 | 1,0000 | 0,0000 | 1,0000 |
| kategori_tidak_memenuhi_syarat | 19 | 1,0000 | 0,0000 | 1,0000 |
| lonjakan_tanpa_progres | 55 | 0,0000 | 0,0000 | 0,0000 |
| melebihi_pagu | 26 | 1,0000 | 0,5769 | 1,0000 |
| milestone_belum_terverifikasi | 23 | 1,0000 | 0,0000 | 1,0000 |
| pemecahan_pencairan | 36 | 0,0000 | 0,0000 | 0,0000 |
| pencairan_setelah_selesai | 50 | 0,0000 | 0,0000 | 0,0000 |
| persetujuan_wajib_hilang | 38 | 1,0000 | 0,0000 | 1,0000 |
| progres_stagnan_tapi_cair | 53 | 0,0000 | 0,0000 | 0,0000 |

False alarm pada kelompok `normal_tidak_lazim_sah` (n = 1.401):
- Aturan saja: 0,0000 (0 / 1.401)
- Isolation Forest saja: 0,0021 (3 / 1.401)
- Hybrid: 0,2748 (385 / 1.401)

### Tabel Ketiga: Kestabilan pada 5 Seed (42, 43, 44, 45, 46)

| Metrik | Rata-rata | Simpangan Baku (SD) |
|---|---|---|
| F1 Hybrid | 0,3894 | 0,0049 |
| Laju Peringatan Palsu (FAR) Hybrid | 0,0356 | 0,0011 |

Latensi inferensi lokal: 0,03 ms per transaksi.

Latensi Vercel belum diukur. Nilai `0.0` pada kunci `latensi_ms.vercel` di artefak adalah nilai bawaan, bukan pengukuran. Waktu deteksi pola beruntun dan kelengkapan tautan alokasi juga belum tersedia.

## 9. Format `hasil_evaluasi.json`

```json
{
  "dibuat_pada": "tanggal",
  "seed_utama": 42,
  "ambang": { "nilai": 0.0, "cara": "maks F1 validasi dengan batas FAR 2 persen", "f1_validasi": 0.0 },
  "pengujian": {
    "aturan_saja": { "precision": 0.0, "recall": 0.0, "f1": 0.0, "far": 0.0, "peringatan_per_1000": 0.0 },
    "iforest_saja": { },
    "hybrid": { }
  },
  "recall_per_subtipe": { "lonjakan_tanpa_progres": { "n": 0, "aturan_saja": 0.0, "iforest_saja": 0.0, "hybrid": 0.0 } },
  "false_alarm_normal_tidak_lazim_sah": { "n": 0, "aturan_saja": 0.0, "iforest_saja": 0.0, "hybrid": 0.0 },
  "beberapa_seed": { "seed": [42, 43, 44, 45, 46], "f1_hybrid_rerata": 0.0, "f1_hybrid_sd": 0.0 },
  "latensi_ms": { "lokal": 0.0, "vercel": 0.0 },
  "waktu_deteksi_pola": { "jumlah_pola": 0, "aturan_saja": { "terdeteksi_pct": 0.0, "median_posisi": null }, "iforest_saja": { }, "hybrid": { } },
  "kelengkapan_tautan": { "proyek_valid": 0.0, "kontrak_milik_proyek": 0.0, "hash_cocok": 0.0, "entri_ledger": 0.0, "gabungan": 0.0 },
  "biaya": { "ukuran_model_kb": 0.0, "waktu_latih_detik": 0.0, "waktu_inferensi_ms": 0.0, "waktu_verifikasi_penuh_detik": 0.0 },
  "uji_perusakan": { "ubah": { "hash_chain": { "terdeteksi_pct": 0.0, "lokasi_tepat_pct": 0.0 }, "tabel_log": { "terdeteksi_pct": 0.0, "lokasi_tepat_pct": 0.0 } } },
  "irisan_uji_konsep": { "kategori": "Pengelolaan air dan air limbah", "tahun": 0, "n": 0, "pengujian": { } }
}
```

Angka di atas hanya penanda bentuk, bukan hasil.
