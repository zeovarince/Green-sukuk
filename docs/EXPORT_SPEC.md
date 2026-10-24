# EXPORT_SPEC

Kontrak berkas antara `ml/` (Python) dan `web/` (TypeScript), serta aturan tes kesesuaian. Karena logika aturan, fitur, dan skor ada di dua bahasa, dokumen ini yang menjaga keduanya tetap sama.

## 1. Berkas

Dihasilkan oleh `ml/export_artifacts.py` ke `ml/artifacts/`, lalu disalin ke `web/data/artifacts/`.

| Berkas | Isi | Dipakai oleh |
|---|---|---|
| `rules_config.json` | Parameter aturan | Python dan TypeScript |
| `model_if.json` | Pohon Isolation Forest, urutan fitur, ambang | `web/lib/iforest.ts` |
| `golden_cases.json` | Kasus uji dengan jawaban dari Python | Tes TypeScript |
| `hasil_evaluasi.json` | Hasil evaluasi | Halaman evaluasi |

Setiap berkas memuat `versi_skema` dan `dibuat_pada`. Web menolak memuat berkas dengan `versi_skema` yang tidak dikenal.

## 2. `model_if.json`

```json
{
  "versi_skema": 1,
  "dibuat_pada": "tanggal",
  "versi_model": "if-2026-10-a",
  "seed": 42,
  "versi_sklearn": "versi yang dipakai saat melatih",
  "fitur": ["log_nilai", "rasio_nilai_terhadap_kontrak", "..."],
  "n_estimators": 200,
  "max_samples": 256,
  "c_max_samples": 0.0,
  "ambang": 0.0,
  "pohon": [
    {
      "fitur": [3, -2, -2],
      "ambang": [0.5, -2.0, -2.0],
      "kiri": [1, -1, -1],
      "kanan": [2, -1, -1],
      "n_sampel": [256, 100, 156]
    }
  ]
}
```

Aturan struktur pohon (mengikuti scikit-learn):
- Simpul ke-i: jika `fitur[i] >= 0`, bandingkan `x[fitur[i]] <= ambang[i]` untuk memilih `kiri[i]`, selain itu `kanan[i]`.
- Daun ditandai `kiri[i] = -1` dan `fitur[i] = -2`.
- `n_sampel[i]` dipakai untuk koreksi panjang jalur di daun.
- Nilai desimal ditulis dengan presisi penuh (17 digit signifikan) agar perbandingan `<=` memberi hasil yang sama di Python dan JavaScript.

Rumus skor ada di `MODEL_SPEC.md` bagian 5. Ukuran: 200 pohon dengan `max_samples` 256 memberi berkas yang jauh lebih kecil dari batas ukuran fungsi Vercel. Cek ukuran aktual setelah ekspor.

## 3. `golden_cases.json`

Setiap kasus berisi masukan mentah, riwayat kontrak ringkas, dan jawaban Python.

```json
{
  "versi_skema": 1,
  "kasus": [
    {
      "id": "g-0001",
      "subtipe": "lonjakan_tanpa_progres",
      "kontrak_id": "PRJ-0001-K01",
      "masukan": {
        "project_id": "PRJ-0001",
        "tanggal": "2025-03-14",
        "jenis_pembayaran": "termin",
        "nilai_pencairan": 8000000000,
        "progres_fisik_pct": 41.5,
        "milestone_terverifikasi": true,
        "persetujuan_diperoleh": 3,
        "kelengkapan_bukti": 1.0,
        "kategori_hijau": "Transportasi berkelanjutan",
        "hash_tercatat": "0123456789abcdef",
        "hash_dokumen_saat_ini": "0123456789abcdef"
      },
      "riwayat": [
        { "tanggal": "2025-02-12", "nilai_pencairan": 1000000000, "progres_fisik_pct": 41.5 }
      ],
      "jawaban": {
        "fitur": { "log_nilai": 22.8, "...": 0.0 },
        "aturan": ["R02_PAGU"],
        "lolos_aturan": false,
        "skor": 0.0,
        "keputusan": "peringatan"
      }
    }
  ]
}
```

Isi kasus di atas hanya contoh bentuk. Angka nyata datang dari data hasil generator.

Pemilihan kasus:
- Stratifikasi: sedikitnya 20 kasus per subtipe, ditambah kasus normal biasa secara acak (minimal 200).
- Masukkan kasus pinggiran: nilai tepat di ambang persetujuan, kelengkapan bukti tepat 0,80, kumulatif tepat sama dengan pagu, riwayat kosong (transaksi pertama kontrak), dan riwayat satu baris.
- Riwayat disertakan secukupnya untuk menghitung fitur, bukan seluruh riwayat kontrak, kecuali fitur memang butuh semuanya (median riwayat memakai seluruh pencairan sebelumnya, jadi sertakan semuanya untuk kasus itu).

## 4. Tes kesesuaian

Tes Vitest di `web/tests/kesesuaian.test.ts` membaca `golden_cases.json` dan memeriksa tiga hal terpisah, supaya galat mudah dilacak:

| Tes | Yang dibandingkan | Toleransi |
|---|---|---|
| Fitur | Fitur dari `masukan` dan `riwayat` versus `jawaban.fitur` | Selisih relatif 1e-9 |
| Aturan | Daftar kode aturan terpicu versus `jawaban.aturan` | Harus sama persis, urutan tidak penting |
| Skor | Skor dari vektor fitur Python versus `jawaban.skor` | Selisih absolut 1e-9 |

Kegagalan tes fitur diperbaiki lebih dulu, karena skor yang salah sering hanya akibat fitur yang salah.

Tes sisi Python di `ml/tests/` memeriksa bahwa `golden_cases.json` memang dihasilkan dari kode Python yang sama dengan yang dipakai evaluasi, bukan dihitung dengan jalur terpisah.

## 5. Kapan ekspor diulang

Jalankan ulang ekspor dan tes kesesuaian jika:
- Aturan atau parameternya berubah.
- Fitur berubah.
- Model dilatih ulang, atau ambang berubah.
- Versi scikit-learn atau numpy berubah.

Jangan mengedit berkas artefak dengan tangan. Jika salah, perbaiki skrip ekspor dan jalankan ulang.

## 6. Kanonikalisasi untuk ledger

Fungsi pembuat `payload_kanonik` (urutan kunci, format angka) harus identik di Python (`ml/gstp/ledger.py`) dan TypeScript (`web/lib/ledger.ts`). Tambahkan sedikit kasus di `golden_cases.json` khusus untuk ini: masukan payload dan hash yang diharapkan. Lihat `LEDGER_SPEC.md` bagian 4.
