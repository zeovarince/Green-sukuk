# API_SPEC (revisi)

> Versi revisi 2026-11-13, draf menunggu persetujuan pemilik. Menggantikan `API_SPEC.md` setelah disetujui. Revisi: REV-01, REV-09 sampai REV-12 (peran, akad, bukti, telaah syariah, koreksi). Rincian di `PERUBAHAN_revisi.md`.

Kontrak route API Next.js (`web/app/api/`). Semua route berjalan di runtime Node.js, bukan edge, karena memakai modul `crypto` dan akses database.

## 1. Aturan umum

- Format: JSON, UTF-8.
- Rahasia hanya dibaca di server. Route tidak pernah mengembalikan kunci atau isi environment.
- Semua masukan divalidasi (tipe, rentang, panjang) sebelum dipakai. Gagal validasi memberi 400.
- Semua route penulisan (POST, PATCH) wajib menyertakan header `x-kode-akses`. Tanpa itu, siapa pun yang tahu URL bisa menulis ke database. Ini pengaman sederhana, bukan autentikasi sungguhan.
- Server menentukan peran dari kode yang cocok (perbandingan tetap timing-safe). Klien tidak pernah mengirim peran sendiri.

| Kode di header cocok dengan | Peran |
|---|---|
| `DEMO_PASSCODE` | `penyedia_data` |
| `KODE_AKSES_AUDITOR` | `auditor` |
| `KODE_AKSES_PEJABAT` | `pejabat_berwenang` |
| `KODE_AKSES_SYARIAH` | `otoritas_syariah` |

**Mode satu kode.** Bila ketiga variabel peran (`KODE_AKSES_AUDITOR`, `KODE_AKSES_PEJABAT`, `KODE_AKSES_SYARIAH`) tidak diisi, `DEMO_PASSCODE` berlaku untuk semua route penulisan dan perannya `umum`, tanpa pembatasan per peran. Ini perilaku sebelum revisi (D-015). Bila sebagian saja yang diisi, server menolak start dengan pesan galat konfigurasi, karena setengah pembagian peran menyesatkan.

Peran adalah simulasi. Tidak ada identitas pengguna, dan kode yang bocor memberi peran penuh pemiliknya.
- Pembatasan laju route penulisan: pemeriksaan/simpan maksimal 20 permintaan per IP per menit; route demo maksimal 5. Prototipe memakai jendela per instance Node.js; keterbatasannya dicatat di `DECISIONS.md`.
- Format galat seragam:

```json
{ "galat": { "kode": "VALIDASI_GAGAL", "pesan": "nilai_pencairan harus bilangan bulat positif" } }
```

Kode galat: `VALIDASI_GAGAL` (400), `TIDAK_ADA_AKSES` (401), `PERAN_TIDAK_SESUAI` (403), `TIDAK_DITEMUKAN` (404), `KONFLIK_LEDGER` (409), `TERLALU_BANYAK` (429), `GALAT_SERVER` (500).

## 2. `POST /api/periksa`

Memeriksa satu transaksi baru. Menjalankan delapan aturan, menghitung skor jika lolos, dan opsional menyimpan.

Permintaan:

```json
{
  "kontrak_id": "PRJ-0001-K01",
  "project_id": "PRJ-0001",
  "tanggal": "2026-09-15",
  "jenis_pembayaran": "termin",
  "nilai_pencairan": 4900000000,
  "progres_fisik_pct": 52.3,
  "milestone_terverifikasi": true,
  "persetujuan_diperoleh": 2,
  "kelengkapan_bukti": 1.0,
  "kategori_hijau": "Transportasi berkelanjutan",
  "akad": "Ijarah Asset to Be Leased",
  "hash_tercatat": "0123456789abcdef",
  "hash_dokumen_saat_ini": "0123456789abcdef",
  "pengusul": "Nama atau jabatan pengusul",
  "verifikator": "Nama atau jabatan verifikator",
  "simpan": false
}
```

`project_id` sengaja boleh diisi bebas supaya aturan R01 dapat didemonstrasikan. Jika `hash_*` kosong, server memakai pasangan yang sama (dianggap cocok). `simpan: false` hanya memeriksa tanpa menulis apa pun, dan tidak membutuhkan kode akses. `simpan: true` menyimpan transaksi, membuat peringatan jika perlu, dan menambah entri ledger, dan membutuhkan kode akses. Peran yang boleh menyimpan: `penyedia_data` (atau `umum` dalam mode satu kode).

`akad` opsional. Bila kosong, server memakai akad terdaftar proyek, sehingga R08 tidak terpicu. Bila diisi, nilainya harus salah satu akad yang dikenal (`Ijarah Asset to Be Leased` atau `Wakalah`), selain itu 400. Aturan R08 hanya dievaluasi bila `project_id` ada di registri.

`pengusul` dan `verifikator` wajib (teks 3 sampai 80 karakter) bila `simpan: true`, dan diabaikan bila `simpan: false`. Keduanya dicatat di payload ledger (`LEDGER_SPEC.md` bagian 3B) sebagai pencatatan pihak, bukan identitas terverifikasi.

Server tidak menerima fitur turunan dari klien. Hari sejak pencairan sebelumnya, kumulatif, delta progres, dan fitur lain dihitung dari riwayat kontrak di database.

Respons 200:

```json
{
  "keputusan": "peringatan",
  "jenis_peringatan": "skor",
  "temuan_aturan": [],
  "tindak_lanjut": "telaah_auditor",
  "bukti": {
    "hash_tercatat": "0123456789abcdef",
    "hash_dokumen_saat_ini": "0123456789abcdef",
    "hash_cocok": true,
    "kelengkapan_bukti": 1.0,
    "ambang_bukti": 0.8,
    "dokumen_asli_tersedia": false
  },
  "skor": { "nilai": 0.0, "ambang": 0.0, "di_atas_ambang": true, "versi_model": "if-2026-10-a" },
  "fitur": { "rasio_nilai_vs_progres": 0.0 },
  "pembanding": {
    "median_pencairan_sebelumnya": 0,
    "jumlah_pencairan_7_hari": 0,
    "rata_rata_delta_progres": 0.0
  },
  "tersimpan": { "trx_id": "TRX-000000", "peringatan_id": "uuid", "seq_ledger": 0 },
  "waktu_proses_ms": 0
}
```

`keputusan` bernilai `normal` atau `peringatan`. `tersimpan` null jika `simpan: false`.

Tiap elemen `temuan_aturan` memuat `kode`, `pesan`, dan `prinsip` (`amanah` atau `hifz_al_mal`, `RULES.md` bagian 1A).

`tindak_lanjut` bernilai `pemantauan_berlanjut` bila keputusan `normal` (tidak ada temuan aturan dan skor di bawah ambang). Bila `peringatan`, nilainya `telaah_auditor`. Bila temuan memuat `R08_AKAD`, respons juga memuat `perlu_telaah_syariah: true`.

`bukti` mengembalikan isi yang dikirim dan hasil perbandingannya. `dokumen_asli_tersedia` selalu `false` pada prototipe, karena dokumen asli tidak disimpan (`LIMITATIONS.md`). Panel ini menampilkan hash dan kelengkapan, bukan dokumen. Angka di contoh hanya penanda bentuk.

Galat khusus: 404 jika `kontrak_id` tidak ada di registri. 409 jika penambahan ledger gagal karena konflik, dan klien boleh mencoba lagi.

## 3. `GET /api/peringatan`

Daftar peringatan.

Parameter: `status`, `jenis`, `kontrak_id`, `urut` (`skor` atau `waktu`, bawaan `waktu`), `halaman`, `per_halaman` (bawaan 25, maksimum 100).

Respons: `{ "total": 0, "halaman": 1, "data": [ { "id", "trx_id", "jenis", "kode_aturan", "skor", "status", "dibuat_pada" } ] }`.

## 4. `GET /api/peringatan/{id}`

Detail satu peringatan: data transaksi, daftar temuan aturan beserta prinsipnya, skor dan ambang, pembanding dari riwayat kontrak, panel `bukti` (bentuk sama dengan `/api/periksa`), telaah syariah bila ada, dan riwayat status dari ledger. Riwayat kontrak tidak memuat transaksi yang `digantikan_oleh` terisi.

## 5. `PATCH /api/peringatan/{id}`

Mengubah status dan catatan. Butuh kode akses.

```json
{ "status": "perlu_klarifikasi", "catatan": "Mohon bukti progres bulan ini." }
```

Hanya perpindahan status yang sah (`DATABASE_SPEC.md` bagian 3) yang diterima, selain itu 400. Catatan minimal 8 karakter wajib untuk status `perlu_klarifikasi`, `diklarifikasi`, `ditindaklanjuti`, dan `ditutup`. Setiap perubahan menambah entri ledger jenis `status`, dengan `peran` dan `jenis_catatan: perubahan_status`.

Dalam mode peran, tiap peran hanya boleh melakukan perpindahan berikut. Selain itu 403 `PERAN_TIDAK_SESUAI`.

| Peran | Perpindahan yang diizinkan |
|---|---|
| `auditor` | `baru` ke `ditelaah`; `ditelaah` ke `perlu_klarifikasi`; `perlu_klarifikasi` ke `diklarifikasi` |
| `pejabat_berwenang` | `ditelaah` ke `ditindaklanjuti`; `diklarifikasi` ke `ditindaklanjuti`; `ditindaklanjuti` ke `ditutup` |
| `penyedia_data` | tidak ada (hanya mengirim data dan koreksi) |
| `otoritas_syariah` | tidak ada (hanya telaah syariah, bagian 5B) |

Dalam mode satu kode, semua perpindahan sah menurut `DATABASE_SPEC.md` bagian 3 diizinkan.

## 5A. `POST /api/peringatan/{id}/koreksi`

Penyedia data mengoreksi transaksi yang diminta klarifikasinya. Butuh kode akses dengan peran `penyedia_data` (atau `umum`).

```json
{
  "alasan": "Progres fisik salah ketik pada laporan bulan ini.",
  "diajukan_oleh": "Nama atau jabatan pengusul",
  "perubahan": { "progres_fisik_pct": 48.2, "kelengkapan_bukti": 1.0 }
}
```

Aturan:
- Status peringatan harus `perlu_klarifikasi`. Selain itu 409 `STATUS_TIDAK_SESUAI`.
- `alasan` minimal 8 karakter. `diajukan_oleh` wajib.
- `perubahan` hanya boleh memuat kolom masukan yang sah (`/api/periksa`), tidak boleh memuat `kontrak_id`, `trx_id`, atau kolom label. Sedikitnya satu kolom berbeda dari nilai lama, selain itu 400.
- Server membuat transaksi baru (`TRX-LIVE-...`, `sumber = koreksi`, `koreksi_dari` = trx lama), memeriksanya ulang dengan riwayat kontrak tanpa transaksi lama, menandai transaksi lama dengan `digantikan_oleh`, lalu menulis ke ledger dengan urutan di `LEDGER_SPEC.md` bagian 3A.
- Peringatan lama berpindah ke `diklarifikasi`. Bila transaksi baru menghasilkan peringatan, peringatan itu dibuat dengan status `baru`.

Respons 200: `{ "trx_id_baru", "hasil": { ...bentuk respons /api/periksa... }, "peringatan_lama": { "id", "status": "diklarifikasi" }, "peringatan_baru": null atau { "id" }, "seq_ledger": [..] }`.

Entri ledger lama tidak diubah. Bila salah satu langkah gagal di tengah, 500 dengan pesan yang menyebut langkah terakhir yang berhasil. Karena `tambah_ledger` bersifat atomik per entri, tidak ada entri setengah jadi, tetapi rangkaian bisa terhenti. Verifikasi ledger tetap valid pada keadaan itu.

## 5B. `POST /api/peringatan/{id}/telaah-syariah`

Otoritas syariah mencatat telaahnya. Butuh kode akses dengan peran `otoritas_syariah`. Hanya untuk peringatan yang `kode_aturan`-nya memuat `R08_AKAD`, selain itu 400.

```json
{ "putusan": "perlu_dokumen", "catatan": "Mohon dokumen akad pengganti untuk kontrak ini." }
```

`putusan`: `sesuai`, `tidak_sesuai`, atau `perlu_dokumen`. `catatan` minimal 8 karakter.

Telaah menambah entri ledger `status` dengan `jenis_catatan: telaah_syariah`, `putusan`, dan `peran`. Status peringatan tidak berubah, dan telaah tidak menghalangi perpindahan status oleh auditor atau pejabat. Detail peringatan menampilkan telaah syariah terbaru dan riwayatnya.

Prototipe hanya mencatat telaah. Prototipe tidak menilai kesesuaian syariah.

## 6. `GET /api/kontrak/{id}`

Ringkasan kontrak dan riwayat pencairan beserta progres, untuk grafik. Mengembalikan 404 jika kontrak tidak ada.

## 7. `GET /api/ledger`

Daftar entri ledger dengan `dari_seq`, `sampai_seq`, dan `batas` (maksimum 200).

## 8. `GET /api/ledger/verifikasi`

Memverifikasi rantai (`LEDGER_SPEC.md` bagian 6).

Parameter: `dari_seq`, `sampai_seq`. Tanpa parameter, verifikasi penuh (bisa lambat, beri peringatan di UI).

Respons: `{ "valid": true, "entri_diperiksa": 0, "rusak_pada": null, "hash_terakhir": "..." }`.

## 9. `GET /api/metrik`

Mengembalikan isi `hasil_evaluasi.json`. Tidak menghitung ulang apa pun.

## 10. Route demo (hanya jika `DEMO_MODE=true`)

- `POST /api/demo/rusak-entri` dengan `{ "seq": 123 }`: mengubah `payload_kanonik` entri itu dan menyimpan nilai asli di tempat terpisah.
- `POST /api/demo/pulihkan` : mengembalikan entri yang dirusak.

Kedua route butuh kode akses. Jika `DEMO_MODE` tidak `true`, route ini mengembalikan 404, seakan tidak ada.
Pada proyek Supabase yang skemanya sudah dibuat sebelum fase 8, jalankan `supabase/phase8_demo_backup.sql` sebelum mengaktifkan `DEMO_MODE`.

## 11. Waktu proses

`waktu_proses_ms` diukur di server dari awal sampai akhir pemeriksaan. Angka ini dilaporkan sebagai bagian "waktu deteksi" di `EVALUATION.md`. Jelaskan di laporan bahwa angka Vercel dapat mencakup waktu mulai dingin (cold start) pada permintaan pertama.

## 12. Tes minimum

- Validasi: setiap kolom wajib, tipe salah, nilai negatif.
- `/api/periksa`: kasus normal, kasus melanggar satu aturan, kasus melanggar beberapa aturan, kontrak tidak ada, `simpan` tanpa kode akses.
- `/api/peringatan/{id}` PATCH: perpindahan sah dan tidak sah, per peran (403) dan dalam mode satu kode.
- Konfigurasi peran sebagian (satu atau dua kode diisi) ditolak.
- `/api/periksa`: `akad` berbeda memicu R08, `akad` kosong tidak, proyek tidak valid tidak memicu R08, `simpan: true` tanpa `pengusul` atau `verifikator` ditolak, `tindak_lanjut` benar untuk kasus normal dan peringatan, `bukti.hash_cocok` salah bila hash berbeda.
- Koreksi: ditolak bila status bukan `perlu_klarifikasi`; menghasilkan transaksi baru, entri ledger `transaksi` dan `koreksi`, dan rantai valid; kumulatif R02 pada pemeriksaan ulang tidak menghitung transaksi yang digantikan; ditolak untuk peran selain penyedia data.
- Telaah syariah: ditolak bila peringatan tidak memuat R08 atau peran bukan otoritas syariah; menambah entri ledger tanpa mengubah status.
- Ledger: penambahan beruntun menghasilkan rantai valid. Perusakan lalu verifikasi gagal tepat di entri yang dirusak.
