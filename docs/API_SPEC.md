# API_SPEC

Kontrak route API Next.js (`web/app/api/`). Semua route berjalan di runtime Node.js, bukan edge, karena memakai modul `crypto` dan akses database.

## 1. Aturan umum

- Format: JSON, UTF-8.
- Rahasia hanya dibaca di server. Route tidak pernah mengembalikan kunci atau isi environment.
- Semua masukan divalidasi (tipe, rentang, panjang) sebelum dipakai. Gagal validasi memberi 400.
- Semua route penulisan (POST, PATCH) wajib menyertakan header `x-kode-akses` yang cocok dengan `DEMO_PASSCODE`. Tanpa itu, siapa pun yang tahu URL bisa menulis ke database. Ini pengaman sederhana, bukan autentikasi sungguhan.
- Pembatasan laju untuk route penulisan, misalnya jumlah permintaan per IP per menit. Pilih mekanisme yang tersedia di Vercel dan catat di `DECISIONS.md`.
- Format galat seragam:

```json
{ "galat": { "kode": "VALIDASI_GAGAL", "pesan": "nilai_pencairan harus bilangan bulat positif" } }
```

Kode galat: `VALIDASI_GAGAL` (400), `TIDAK_ADA_AKSES` (401), `TIDAK_DITEMUKAN` (404), `KONFLIK_LEDGER` (409), `TERLALU_BANYAK` (429), `GALAT_SERVER` (500).

## 2. `POST /api/periksa`

Memeriksa satu transaksi baru. Menjalankan tujuh aturan, menghitung skor jika lolos, dan opsional menyimpan.

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
  "hash_tercatat": "0123456789abcdef",
  "hash_dokumen_saat_ini": "0123456789abcdef",
  "simpan": false
}
```

`project_id` sengaja boleh diisi bebas supaya aturan R01 dapat didemonstrasikan. Jika `hash_*` kosong, server memakai pasangan yang sama (dianggap cocok). `simpan: false` hanya memeriksa tanpa menulis apa pun, dan tidak membutuhkan kode akses. `simpan: true` menyimpan transaksi, membuat peringatan jika perlu, dan menambah entri ledger, dan membutuhkan kode akses.

Server tidak menerima fitur turunan dari klien. Hari sejak pencairan sebelumnya, kumulatif, delta progres, dan fitur lain dihitung dari riwayat kontrak di database.

Respons 200:

```json
{
  "keputusan": "peringatan",
  "jenis_peringatan": "skor",
  "temuan_aturan": [],
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

`keputusan` bernilai `normal` atau `peringatan`. `tersimpan` null jika `simpan: false`. Angka di contoh hanya penanda bentuk.

Galat khusus: 404 jika `kontrak_id` tidak ada di registri. 409 jika penambahan ledger gagal karena konflik, dan klien boleh mencoba lagi.

## 3. `GET /api/peringatan`

Daftar peringatan.

Parameter: `status`, `jenis`, `kontrak_id`, `urut` (`skor` atau `waktu`, bawaan `waktu`), `halaman`, `per_halaman` (bawaan 25, maksimum 100).

Respons: `{ "total": 0, "halaman": 1, "data": [ { "id", "trx_id", "jenis", "kode_aturan", "skor", "status", "dibuat_pada" } ] }`.

## 4. `GET /api/peringatan/{id}`

Detail satu peringatan: data transaksi, daftar temuan aturan, skor dan ambang, pembanding dari riwayat kontrak, dan riwayat status dari ledger.

## 5. `PATCH /api/peringatan/{id}`

Mengubah status dan catatan. Butuh kode akses.

```json
{ "status": "perlu_klarifikasi", "catatan": "Mohon bukti progres bulan ini." }
```

Hanya perpindahan status yang sah (`DATABASE_SPEC.md` bagian 3) yang diterima, selain itu 400. Setiap perubahan menambah entri ledger jenis `status`.

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

## 11. Waktu proses

`waktu_proses_ms` diukur di server dari awal sampai akhir pemeriksaan. Angka ini dilaporkan sebagai bagian "waktu deteksi" di `EVALUATION.md`. Jelaskan di laporan bahwa angka Vercel dapat mencakup waktu mulai dingin (cold start) pada permintaan pertama.

## 12. Tes minimum

- Validasi: setiap kolom wajib, tipe salah, nilai negatif.
- `/api/periksa`: kasus normal, kasus melanggar satu aturan, kasus melanggar beberapa aturan, kontrak tidak ada, `simpan` tanpa kode akses.
- `/api/peringatan/{id}` PATCH: perpindahan sah dan tidak sah.
- Ledger: penambahan beruntun menghasilkan rantai valid. Perusakan lalu verifikasi gagal tepat di entri yang dirusak.
