# DATA_SPEC

Spesifikasi data simulasi GSTP. Sumber kebenaran angka dan definisi adalah `ml/generate_gstp_data.py` dan `ml/data_simulasi/metadata_simulasi.json`. Jika dokumen ini berbeda dengan skrip, skrip yang benar dan dokumen ini harus diperbarui.

Seluruh data bersifat ilustratif. Parameter adalah asumsi penulis, bukan data Kementerian Keuangan.

## 1. Berkas

| Berkas | Isi |
|---|---|
| `transaksi_gstp.csv` | Satu baris satu pencairan. Data utama untuk model |
| `registri_proyek.csv` | Master proyek (padanan register alokasi) |
| `registri_kontrak.csv` | Master kontrak, pagu alokasi, uang muka, retensi |
| `metadata_simulasi.json` | Parameter, jumlah, batas split, hasil uji kewarasan, rincian kasus |

## 2. Ukuran dengan seed 42 dan 800 proyek

| Hal | Jumlah |
|---|---|
| Proyek | 800 |
| Kontrak | 2.719 |
| Transaksi | 58.023 |
| Anomali | 1.790 (3,08%) |
| Normal biasa | 48.402 |
| Normal tidak lazim tetapi sah | 7.831 |
| Anomali aturan | 894 |
| Anomali kontekstual | 896 |

Angka ini harus sama pada dua kali jalan dengan parameter yang sama.

## 3. Cara data dibuat

- Empat seri penerbitan ilustratif (`SERI-2021` sampai `SERI-2024`), akad Ijarah Asset to Be Leased atau Wakalah.
- Delapan kategori hijau dengan kementerian pelaksana, proporsi diatur oleh bobot di skrip.
- Tiap proyek memiliki 2 sampai 5 kontrak. Nilai kontrak antara Rp20 miliar dan Rp1,5 triliun (sebaran log-seragam), durasi 10 sampai 30 bulan.
- Pagu alokasi kontrak = 110% nilai kontrak awal.
- Pencairan terdiri dari uang muka (10 sampai 25 persen), termin bulanan yang mengikuti kurva-S progres fisik, dan retensi 5 persen setelah selesai.
- Sebagian kontrak (sekitar 12%) mengalami addendum yang disetujui: nilai naik 3 sampai 8 persen, versi kontrak menjadi 2.
- Sebagian bulan November dan Desember mengalami percepatan progres yang sah.
- Data berakhir pada 30 September 2026. Kontrak yang belum selesai tidak memiliki retensi.

## 4. Kamus kolom `transaksi_gstp.csv`

Kolom "Peran": F = boleh jadi bahan fitur (setelah diolah sesuai `MODEL_SPEC.md`), M = metadata, L = label atau pembagi data (tidak boleh jadi fitur).

| Kolom | Tipe | Arti | Peran |
|---|---|---|---|
| `trx_id` | teks | ID urut kronologis, `TRX-000001` dan seterusnya | M |
| `tanggal` | tanggal | Tanggal pencairan | M |
| `seri_penerbitan` | teks | Seri penerbitan ilustratif | M |
| `akad` | teks | Ijarah Asset to Be Leased atau Wakalah | M |
| `jenis_pembiayaan` | teks | `pembiayaan_baru` atau `pembiayaan_kembali` | M |
| `project_id` | teks | ID proyek. Bisa tidak valid pada anomali | M |
| `kontrak_id` | teks | ID kontrak, contoh `PRJ-0001-K01` | M |
| `kementerian_pelaksana` | teks | Pelaksana proyek | M |
| `kategori_hijau` | teks | Kategori pada transaksi. Bisa tidak sah pada anomali | M |
| `jenis_pembayaran` | teks | `uang_muka`, `termin`, `retensi` | F |
| `bulan_ke` | bilangan bulat | Bulan sejak mulai kontrak (0 untuk uang muka) | F |
| `tahap_proyek` | teks | `persiapan`, `konstruksi`, `penyelesaian`, `pemeliharaan` | M |
| `nilai_pencairan` | bilangan bulat | Rupiah | F |
| `nilai_kontrak` | bilangan bulat | Nilai kontrak berlaku saat transaksi | F |
| `versi_kontrak` | bilangan bulat | 1 atau 2 | M |
| `status_addendum` | teks | `tidak_ada` atau `disetujui` | M |
| `pagu_alokasi_kontrak` | bilangan bulat | Batas alokasi kontrak | M |
| `progres_fisik_pct` | desimal | Progres yang dilaporkan, 0 sampai 100 | F |
| `milestone_terverifikasi` | boolean | Milestone sudah diverifikasi | M (dipakai aturan) |
| `persetujuan_wajib` | bilangan bulat | 1 sampai 3 menurut nilai | F |
| `persetujuan_diperoleh` | bilangan bulat | Persetujuan yang sudah ada | M (dipakai aturan) |
| `kelengkapan_bukti` | desimal | 0 sampai 1 | M (dipakai aturan) |
| `hash_tercatat` | teks | SHA-256 dipotong 16 heksadesimal, nilai saat dicatat | M |
| `hash_dokumen_saat_ini` | teks | Hash dokumen saat diperiksa | M (dipakai aturan) |
| `hari_sejak_pencairan_sebelumnya` | bilangan bulat | Selisih hari di kontrak yang sama | F |
| `delta_progres_pct` | desimal | Kenaikan progres dari pencairan sebelumnya | F |
| `kumulatif_cair` | bilangan bulat | Total cair kontrak sampai transaksi ini | M (dipakai aturan) |
| `rasio_kumulatif_pagu` | desimal | Kumulatif dibagi pagu | F |
| `rasio_kumulatif_kontrak` | desimal | Kumulatif dibagi nilai kontrak | F |
| `rasio_nilai_terhadap_kontrak` | desimal | Nilai dibagi nilai kontrak | F |
| `split` | teks | `pengembangan`, `validasi`, `pengujian` | L |
| `label_anomali` | 0 atau 1 | Anomali yang disuntikkan | L |
| `kelompok_kasus` | teks | Lihat bagian 5 | L |
| `subtipe_kasus` | teks | Lihat bagian 5 | L |

Ada 34 kolom. Kolom turunan (`hari_sejak_pencairan_sebelumnya` sampai `rasio_nilai_terhadap_kontrak`) hanya memakai informasi yang sudah ada saat transaksi diperiksa, jadi aman dipakai. Yang tidak boleh menjadi fitur: `label_anomali`, `kelompok_kasus`, `subtipe_kasus`, `split`.

## 5. Jenis kasus

| Kelompok | Subtipe | Arti |
|---|---|---|
| `normal` | `biasa` | Termin biasa |
| `normal_tidak_lazim_sah` | `uang_muka`, `retensi`, `akhir_tahun_dipercepat`, `penyesuaian_addendum` | Tampak janggal tetapi sah |
| `anomali_aturan` | `id_proyek_tidak_valid`, `melebihi_pagu`, `persetujuan_wajib_hilang`, `kategori_tidak_memenuhi_syarat`, `hash_tidak_cocok`, `milestone_belum_terverifikasi`, `bukti_wajib_hilang` | Pelanggaran jelas, bisa dicek aturan |
| `anomali_kontekstual` | `lonjakan_tanpa_progres`, `pemecahan_pencairan`, `progres_stagnan_tapi_cair`, `pencairan_setelah_selesai` | Lolos aturan, tidak wajar secara konteks |

Kelompok kontekstual sengaja dirancang agar lolos tujuh aturan. Konsekuensinya, keunggulan pendekatan hybrid atas aturan saja sebagian merupakan akibat rancangan data. Ini harus disebut di esai dan di `LIMITATIONS.md`.

## 6. Pembagian data

Berdasarkan waktu menurut kuantil tanggal seluruh data: 60% pertama `pengembangan`, 20% berikutnya `validasi`, 20% terakhir `pengujian`. Batas tanggal tercatat di `metadata_simulasi.json`.

Konsekuensi yang perlu diingat:
- Jenis anomali yang hanya terjadi pada kontrak yang sudah selesai (`melebihi_pagu`, `pencairan_setelah_selesai`) lebih banyak di data awal. Cek jumlah per split di ringkasan generator sebelum menarik kesimpulan per subtipe.
- Kontrak yang sama dapat muncul di beberapa split karena transaksinya tersebar menurut waktu. Fitur hanya memakai riwayat sebelum transaksi sehingga tidak ada kebocoran dari masa depan.

## 7. Aturan penggunaan

1. Jangan memasukkan kolom berperan L ke fitur model.
2. Model dilatih hanya pada `pengembangan`. Ambang ditentukan dari `validasi`. `pengujian` dipakai untuk laporan akhir.
3. Jangan membandingkan angka prototipe langsung dengan angka di paper lain. Datanya berbeda dan anomalinya disuntikkan.
4. Proporsi anomali 3% sengaja lebih tinggi dari literatur (kisaran 0,17% sampai 0,6%) agar metrik stabil pada data berukuran ini.

## 8. Mengubah parameter

```bash
python ml/generate_gstp_data.py --n-proyek 1500 --seed 7 --tingkat-anomali 0.04 --out-dir ml/data_simulasi
```

Setelah mengubah parameter, jalankan ulang seluruh fase evaluasi dan perbarui angka di dokumen yang menyebutnya.
