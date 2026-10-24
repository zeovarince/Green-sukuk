# EVALUATION

Protokol evaluasi untuk membandingkan tiga pendekatan: aturan saja, Isolation Forest saja, dan hybrid. Dokumen ini adalah protokol. Angka hasil tidak ditulis di sini sebelum dijalankan. Setelah evaluasi selesai, salin angka dari `ml/artifacts/hasil_evaluasi.json` ke bagian 8.

## 1. Pertanyaan yang dijawab

1. Apakah hybrid menangkap anomali yang tidak tertangkap aturan saja, dan dengan beban peringatan palsu seperti apa?
2. Apakah aturan menangkap pelanggaran jelas yang terlewat oleh Isolation Forest saja?
3. Seberapa konsisten hasilnya pada beberapa seed data?

Evaluasi tidak menjawab: apakah sistem akan bekerja di data riil.

## 2. Unit penilaian

Satu baris transaksi adalah satu unit. Label benar adalah `label_anomali`. Peringatan adalah keluaran sistem: 1 jika transaksi ditandai, 0 jika tidak.

## 3. Data dan urutan penggunaan

1. Latih pada `pengembangan`.
2. Tentukan ambang pada `validasi` (`MODEL_SPEC.md`, bagian 6).
3. Laporkan metrik pada `pengujian`. Jangan mengubah model atau ambang setelah melihat hasil `pengujian`.
4. Metrik `validasi` ditampilkan sebagai pembanding, bukan hasil utama.

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

Definisi waktu deteksi dan kelengkapan tautan di atas adalah definisi prototipe. Cocokkan dengan rumusan di rancangan evaluasi esai dan samakan salah satunya.

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

## 8. Hasil

Belum dijalankan. Isi bagian ini dari `hasil_evaluasi.json` setelah Fase 4 di `TASKS.md`, termasuk tanggal dan versi data.

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
  "latensi_ms": { "lokal": 0.0, "vercel": 0.0 }
}
```

Angka di atas hanya penanda bentuk, bukan hasil.
