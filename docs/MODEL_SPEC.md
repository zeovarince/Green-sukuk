# MODEL_SPEC (revisi)

> Versi revisi 2026-11-13, draf menunggu persetujuan pemilik. Menggantikan `MODEL_SPEC.md` setelah disetujui. Revisi: REV-03 (tiga fitur baru), REV-04 (pemisahan per proyek). Rincian di `PERUBAHAN_revisi.md`.

Spesifikasi model anomali berbasis Isolation Forest. Dokumen ini mendahului implementasi di `ml/gstp/model.py`. Jika implementasi berbeda, perbarui dokumen ini dan catat alasannya di `DECISIONS.md`.

## 1. Peran model

Isolation Forest memberi skor kewajaran pada transaksi yang sudah lolos delapan aturan. Skor tinggi berarti transaksi lebih mudah "diisolasi", yaitu lebih tidak lazim dibanding transaksi lain. Skor bukan bukti pelanggaran. Hasilnya dipakai untuk memprioritaskan pemeriksaan.

## 2. Data

| Hal | Ketentuan |
|---|---|
| Data latih | Split `pengembangan`, hanya baris yang lolos aturan, tanpa memakai label |
| Penentuan ambang | Split `validasi`, baris yang lolos aturan |
| Pelaporan akhir | Split `pengujian` |
| Label | Hanya untuk evaluasi dan penentuan ambang. Tidak masuk fitur |

Data latih tidak dibersihkan dari anomali. Model unsupervised dan memang harus bekerja pada data yang sebagian kecilnya tidak lazim.

Pembagian split mengikuti proyek, bukan baris (`DATA_SPEC.md` bagian 6, D-017). Tabel median referensi kelompok (bagian 3) dihitung hanya dari split `pengembangan`.

## 3. Fitur

Semua fitur dihitung dari transaksi yang sedang diperiksa dan riwayat kontrak sebelum tanggal transaksi itu. Pohon tidak butuh normalisasi, tetapi nilai uang diberi transformasi log agar sebarannya tidak ekstrem.

| Fitur | Rumus atau sumber |
|---|---|
| `log_nilai` | `log1p(nilai_pencairan)` |
| `rasio_nilai_terhadap_kontrak` | kolom data |
| `rasio_kumulatif_pagu` | kolom data |
| `rasio_kumulatif_kontrak` | kolom data |
| `hari_sejak_pencairan_sebelumnya` | kolom data |
| `delta_progres_pct` | kolom data |
| `progres_fisik_pct` | kolom data |
| `bulan_ke` | kolom data |
| `persetujuan_wajib` | kolom data |
| `jenis_uang_muka`, `jenis_termin`, `jenis_retensi` | satu-panas dari `jenis_pembayaran` |
| `rasio_nilai_vs_progres` | `rasio_nilai_terhadap_kontrak / max(delta_progres_pct / 100, 0.005)` |
| `jumlah_pencairan_7_hari` | jumlah pencairan kontrak yang sama dalam 7 hari sebelum dan termasuk transaksi ini |
| `nilai_vs_median_kontrak` | `nilai_pencairan` dibagi median nilai pencairan sebelumnya di kontrak itu (1,0 jika belum ada riwayat) |
| `kelengkapan_bukti` | kolom data, 0 sampai 1 (REV-03) |
| `rasio_nilai_vs_median_kelompok` | `nilai_pencairan` dibagi median referensi pasangan `kategori_hijau` dan `tahap_proyek` (REV-03) |
| `deviasi_jadwal_pct` | `progres_fisik_pct` dikurangi progres jadwal acuan pada `bulan_ke` (REV-03) |

Vektor fitur berjumlah 18. Tiga fitur sebelum `kelengkapan_bukti` dirancang agar konteks waktu dan perbandingan tertangkap: lonjakan tanpa progres, pemecahan pencairan, dan progres stagnan.

### Tiga fitur baru

**`kelengkapan_bukti`.** Nilai kolom apa adanya. Aturan R07 sudah memakai ambang 0,80 pada kolom yang sama. Model melihat nilai di atas ambang yang tetap berbeda dari kebiasaan.

**`rasio_nilai_vs_median_kelompok`.** Nilai pencairan dibagi median referensi. Median referensi dihitung sekali dari baris split `pengembangan` yang lolos aturan, tanpa label, per pasangan `kategori_hijau` dan `tahap_proyek`. Bila pasangan tidak ada, pakai median per `tahap_proyek`. Bila tahap tidak ada, pakai median global. Kategori yang tidak dikenal (anomali R04) memakai median per tahap. Tabel disimpan di `model_if.json` (kunci `referensi_kelompok`), sehingga TypeScript tidak mengakses data lain. Fitur ini menjawab kalimat esai bahwa pola dibandingkan menurut jenis dan tahap proyek.

**`deviasi_jadwal_pct`.** Selisih progres fisik terhadap jadwal acuan.

```
u = min(bulan_ke / durasi_bulan, 1)
L(u) = 1 / (1 + exp(-8 * (u - 0.5)))
jadwal_acuan_pct = 100 * (L(u) - L(0)) / (L(1) - L(0))
deviasi_jadwal_pct = progres_fisik_pct - jadwal_acuan_pct
```

`durasi_bulan` berasal dari `registri_kontrak`. Angka 8 adalah tengah rentang 6 sampai 10 yang dipakai generator untuk kemiringan kurva-S tiap kontrak. Data tidak memuat jadwal rencana, jadi kurva ini menggantikannya. Pada data simulasi, kurva acuan berbentuk sama dengan kurva yang membangkitkan progres, sehingga fitur ini lebih informatif daripada pada data nyata, yang memiliki jadwal rencana kontrak. Batas ini dicatat di `LIMITATIONS.md`.

Kolom yang dilarang menjadi fitur: `label_anomali`, `kelompok_kasus`, `subtipe_kasus`, `split`. Tes kebocoran di `ml/tests/` harus memastikan hal ini.

Daftar fitur dan urutannya disimpan di `model_if.json` supaya TypeScript memakai urutan yang sama.

## 4. Parameter awal

| Parameter | Nilai awal |
|---|---|
| `n_estimators` | 200 |
| `max_samples` | 256 |
| `contamination` | `"auto"` |
| `max_features` | 1.0 |
| `random_state` | 42 |

Nilai ini titik awal, bukan hasil tuning. Jika diubah, catat alasan dan hasilnya. Jangan men-tuning parameter memakai data pengujian.

## 5. Skor

Skor anomali yang dilaporkan `s = -score_samples(X)` dari scikit-learn, bernilai antara 0 dan 1. Makin besar makin tidak lazim. Rumusnya:

```
s(x) = 2 ^ ( - E[h(x)] / c(max_samples) )
c(n) = 2 * (ln(n - 1) + 0.5772156649) - 2 * (n - 1) / n     untuk n > 2
c(2) = 1,  c(n) = 0 untuk n <= 1
h(x) = kedalaman daun + c(jumlah sampel di daun)
```

`E[h(x)]` adalah rata-rata h dari semua pohon. Rumus ini harus dipakai persis di TypeScript (`web/lib/iforest.ts`).

## 6. Ambang

Prosedur bawaan:
1. Hitung skor semua baris lolos aturan di `validasi`.
2. Cari ambang yang memaksimalkan F1 pada `validasi`, dengan batas laju false alarm 2 persen.
3. Simpan ambang, F1 validasi, dan laju false alarm di `hasil_evaluasi.json` dan `model_if.json`.

Setelah revisi fitur dan pemisahan data, model dilatih ulang dan ambang dihitung ulang dengan prosedur yang sama (D-011, D-020). Ambang lama tidak dibawa.

Batas 2 persen adalah parameter yang dapat diubah. Alternatifnya anggaran peringatan tetap (misalnya 1 persen skor tertinggi). Pilih satu cara, catat di `DECISIONS.md`, dan pakai konsisten untuk Isolation Forest saja maupun hybrid.

## 7. Tiga konfigurasi yang dibandingkan

| Konfigurasi | Definisi |
|---|---|
| Aturan saja | Peringatan jika ada aturan terpicu |
| Isolation Forest saja | Skor dihitung pada semua baris, ambang sendiri ditentukan di `validasi` |
| Hybrid | Peringatan jika ada aturan terpicu, atau skor di atas ambang pada baris yang lolos aturan |

Detail metrik dan pelaporan ada di `EVALUATION.md`.

## 8. Ekspor

`model_if.json` memuat struktur pohon, urutan fitur, tabel `referensi_kelompok`, ambang, `max_samples`, dan versi skema 2. Format ada di `EXPORT_SPEC.md`. Versi scikit-learn saat pelatihan dicatat di berkas itu.

## 9. Batasan yang harus dicatat

- Isolation Forest tidak menjelaskan sendiri mengapa suatu transaksi ganjil. Halaman detail peringatan menampilkan fitur yang menyimpang dibanding riwayat kontrak (rasio terhadap median, jumlah pencairan 7 hari) sebagai pembanding, tanpa mengklaim itu penyebab sebenarnya.
- Hasil bergantung pada fitur rekayasa dan pada data yang disimulasikan. Lihat `LIMITATIONS.md`.
- Deviasi jadwal dan median kelompok dihitung dari data simulasi. Pada data nyata, jadwal rencana dan kelompok pembanding perlu diganti dengan sumber aslinya.
- Penambahan fitur tidak menjamin hasil lebih baik. Hasil dilaporkan apa adanya setelah evaluasi ulang.
