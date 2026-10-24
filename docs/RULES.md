# RULES

Tujuh aturan deterministik. Aturan ini adalah versi prototipe dari logika smart contract pada rancangan GSTP: kondisi yang dapat dicek tanpa model statistik. Implementasi ada di dua tempat dan harus identik: `ml/gstp/aturan.py` dan `web/lib/aturan.ts`.

Parameter aturan disimpan di satu berkas bersama, `ml/artifacts/rules_config.json`, dan disalin ke `web/data/artifacts/`. Jangan menanam angka di kode. Dalam rancangan penuh, parameter semacam ini ditetapkan otoritas yang berwenang.

## 1. Daftar aturan

| Kode | Nama | Kondisi pelanggaran |
|---|---|---|
| `R01_ID_PROYEK` | ID proyek tidak valid | `project_id` tidak ada di `registri_proyek`, atau tidak sama dengan proyek milik `kontrak_id` di `registri_kontrak` |
| `R02_PAGU` | Melebihi pagu | `kumulatif_cair` (termasuk transaksi ini) lebih besar dari `pagu_alokasi_kontrak` |
| `R03_PERSETUJUAN` | Persetujuan kurang | `persetujuan_diperoleh` lebih kecil dari `persetujuan_wajib` |
| `R04_KATEGORI` | Kategori tidak memenuhi syarat | `kategori_hijau` tidak ada di daftar kategori sah |
| `R05_HASH` | Hash dokumen tidak cocok | `hash_tercatat` berbeda dari `hash_dokumen_saat_ini` |
| `R06_MILESTONE` | Milestone belum terverifikasi | `milestone_terverifikasi` salah dan `jenis_pembayaran` adalah `termin` |
| `R07_BUKTI` | Bukti tidak lengkap | `kelengkapan_bukti` lebih kecil dari ambang bukti (0,80) |

Satu transaksi dapat melanggar lebih dari satu aturan. Keluaran selalu mencantumkan semua kode yang terpicu.

## 2. Parameter di `rules_config.json`

```json
{
  "versi": 1,
  "ambang_persetujuan_rupiah": { "dua_mulai": 1000000000, "tiga_mulai": 5000000000 },
  "kategori_sah": [
    "Ketahanan terhadap perubahan iklim",
    "Transportasi berkelanjutan",
    "Pengelolaan air dan air limbah",
    "Energi terbarukan",
    "Efisiensi energi",
    "Bangunan hijau",
    "Pertanian berkelanjutan",
    "Pengelolaan sumber daya alam dan lahan"
  ],
  "ambang_bukti": 0.80
}
```

`persetujuan_wajib` dihitung dari nilai pencairan: di bawah Rp1 miliar butuh 1 persetujuan, di bawah Rp5 miliar butuh 2, selebihnya 3. Nilai ini asumsi penulis.

## 3. Keluaran

```json
{
  "lolos": false,
  "temuan": [
    { "kode": "R03_PERSETUJUAN", "pesan": "Persetujuan yang diperoleh 2, yang diwajibkan 3." }
  ]
}
```

Pesan ditulis dalam bahasa Indonesia yang lugas dan menyebut angka yang relevan. Pesan tidak memakai kata "fraud" atau "terbukti".

## 4. Urutan dan perilaku

1. Semua aturan dievaluasi untuk setiap transaksi. Tidak ada penghentian dini, supaya semua temuan tercatat.
2. `R02_PAGU` untuk transaksi baru memakai riwayat tersimpan ditambah nilai transaksi yang sedang diperiksa.
3. Transaksi yang melanggar minimal satu aturan masuk daftar peringatan (jenis `aturan`) dan tidak perlu dinilai Isolation Forest.
4. Transaksi yang lolos semua aturan diteruskan ke skor.

## 5. Yang sengaja tidak dicek aturan

Aturan ini tidak menangkap pola yang butuh konteks waktu atau perbandingan: lonjakan nilai tanpa kenaikan progres, pemecahan pencairan di bawah ambang persetujuan, progres stagnan sementara dana mengalir, dan pencairan setelah proyek selesai. Pola ini dibiarkan untuk lapisan skor anomali. Pembagian tugas ini adalah inti pengujian hybrid di `EVALUATION.md`.

## 6. Uji

Python dan TypeScript harus memberikan daftar kode yang sama untuk setiap kasus di `golden_cases.json`. Pada data simulasi seed 42:
- Baris `normal` dan `normal_tidak_lazim_sah` yang ditandai aturan: 0.
- Baris `anomali_aturan` yang tertangkap: semua.
- Baris `anomali_kontekstual` yang tertangkap: 0.

Jika angka ini berubah setelah modifikasi, cari penyebabnya sebelum melanjutkan.
