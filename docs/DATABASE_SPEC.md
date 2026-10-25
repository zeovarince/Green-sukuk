# DATABASE_SPEC

Skema Supabase Postgres untuk prototipe GSTP. Berkas SQL ada di `supabase/schema.sql`. Dokumen ini menjelaskan isi dan alasannya.

## 1. Prinsip

- Database hanya diakses dari server (route handler Next.js) dengan service role key. Browser tidak pernah berbicara langsung ke database.
- Row Level Security (RLS) aktif di semua tabel dan tidak ada kebijakan untuk peran publik. Dengan begitu kunci publik tidak bisa membaca atau menulis apa pun.
- Ledger bersifat append-only dari sisi aplikasi.
- Semua akses lewat `web/lib/store.ts` supaya penyedia database bisa diganti.

## 2. Tabel

### `registri_proyek`
| Kolom | Tipe | Catatan |
|---|---|---|
| `project_id` | text, kunci utama | contoh `PRJ-0001` |
| `nama_proyek` | text | |
| `kategori_hijau` | text | |
| `kementerian_pelaksana` | text | |
| `seri_penerbitan` | text | |
| `akad` | text | |
| `jenis_pembiayaan` | text | |
| `tanggal_mulai` | date | |
| `pagu_proyek` | bigint | |

### `registri_kontrak`
| Kolom | Tipe | Catatan |
|---|---|---|
| `kontrak_id` | text, kunci utama | |
| `project_id` | text, rujukan ke `registri_proyek` | |
| `nilai_kontrak_awal` | bigint | |
| `pagu_alokasi` | bigint | |
| `tanggal_mulai` | date | |
| `durasi_bulan` | integer | |
| `uang_muka_pct` | numeric | |
| `retensi_pct` | numeric | |

### `transaksi`
Semua kolom `transaksi_gstp.csv` (lihat `DATA_SPEC.md`), ditambah:

| Kolom | Tipe | Catatan |
|---|---|---|
| `sumber` | text | `simulasi` atau `live` |
| `dibuat_pada` | timestamptz | waktu penyimpanan |

Kolom label (`label_anomali`, `kelompok_kasus`, `subtipe_kasus`) dan `split` boleh null untuk transaksi `live`. `project_id` pada transaksi tidak memakai rujukan kunci asing, karena aturan R01 perlu bisa menerima ID yang tidak valid.

Indeks: `(kontrak_id, tanggal)` untuk mengambil riwayat, dan `(tanggal)`.

### `peringatan`
| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid, kunci utama | |
| `trx_id` | text, rujukan ke `transaksi` | |
| `jenis` | text | `aturan`, `skor`, atau `keduanya` |
| `kode_aturan` | text[] | daftar kode, kosong jika hanya skor |
| `skor` | numeric | null jika tidak dihitung |
| `ambang` | numeric | ambang saat itu |
| `versi_model` | text | |
| `status` | text | lihat bagian 3 |
| `catatan` | text | |
| `dibuat_pada` | timestamptz | |
| `diperbarui_pada` | timestamptz | |

Indeks: `(status, dibuat_pada)` dan `(trx_id)`.

### `ledger_entri`
| Kolom | Tipe | Catatan |
|---|---|---|
| `seq` | bigint, identity, kunci utama | urutan rantai |
| `jenis_entri` | text | `transaksi`, `peringatan`, `status`, `koreksi` |
| `trx_id` | text | boleh null |
| `payload_kanonik` | text | teks persis yang di-hash |
| `payload` | jsonb | salinan untuk dibaca manusia |
| `hash_payload` | text | 64 karakter |
| `hash_sebelumnya` | text | `GENESIS` untuk entri pertama |
| `hash_saat_ini` | text | 64 karakter |
| `dibuat_pada` | timestamptz | |

Rumus hash ada di `LEDGER_SPEC.md`.

### `meta_model`
| Kolom | Tipe | Catatan |
|---|---|---|
| `versi_model` | text, kunci utama | |
| `ambang` | numeric | |
| `dibuat_pada` | timestamptz | |

Tabel kecil ini mencatat model yang dipakai untuk peringatan live, supaya jejaknya bisa ditelusuri.

### `demo_pemulihan`
Cadangan sementara untuk endpoint demo yang sengaja mengubah `payload_kanonik`. Kunci `seq` merujuk ke `ledger_entri`; hanya satu cadangan aktif pada satu waktu. Tabel memakai RLS dan hanya tersedia untuk service role. Jika database sudah menjalankan skema versi lama, buat tabel ini dengan `supabase/phase8_demo_backup.sql` sebelum mengaktifkan `DEMO_MODE`.

## 3. Status peringatan

`baru` -> `ditelaah` -> `perlu_klarifikasi` -> `diklarifikasi` -> `ditindaklanjuti` -> `ditutup`

Dari `ditelaah` boleh langsung ke `ditindaklanjuti` jika tidak butuh klarifikasi. Setiap perubahan status menambah entri ledger jenis `status`. Penetapan tindak lanjut menyebut pihak dan alasannya di catatan, mengikuti Gambar 1 esai.

## 4. Fungsi `tambah_ledger`

Fungsi SQL yang menambah entri dengan kunci penasihat agar rantai tidak bercabang. Kerangkanya:

```sql
create or replace function tambah_ledger(
  p_jenis text, p_trx_id text, p_payload_kanonik text,
  p_payload jsonb, p_hash_payload text
) returns ledger_entri
language plpgsql security definer as $$
declare
  v_prev text;
  v_baru ledger_entri;
begin
  perform pg_advisory_xact_lock(727001);   -- kunci khusus ledger
  select hash_saat_ini into v_prev from ledger_entri order by seq desc limit 1;
  v_prev := coalesce(v_prev, 'GENESIS');
  insert into ledger_entri
    (jenis_entri, trx_id, payload_kanonik, payload, hash_payload, hash_sebelumnya, hash_saat_ini)
  values
    (p_jenis, p_trx_id, p_payload_kanonik, p_payload, p_hash_payload, v_prev,
     encode(digest(v_prev || '|' || p_hash_payload, 'sha256'), 'hex'))
  returning * into v_baru;
  return v_baru;
end $$;
```

Catatan:
- `digest` berasal dari ekstensi `pgcrypto`. Aktifkan ekstensi itu di skema sebelum membuat fungsi. Periksa di dashboard Supabase bahwa ekstensinya tersedia.
- Fungsi hanya boleh dipanggil oleh service role. Cabut hak eksekusi dari peran lain.
- `hash_payload` dihitung di aplikasi dari `payload_kanonik`. Fungsi tidak menghitung ulang `hash_payload`, tetapi verifikasi di `LEDGER_SPEC.md` melakukannya.
- Hash rantai dihitung di Postgres (`digest`) dan diverifikasi di aplikasi (SHA-256 Node.js). Keduanya harus menghasilkan nilai yang sama. Tambahkan tes di `web/tests/` dengan kasus tetap yang membandingkan hasil `tambah_ledger` dengan perhitungan di aplikasi.

## 5. Impor data simulasi

Urutan impor: `registri_proyek`, `registri_kontrak`, `transaksi`, `peringatan`, lalu `ledger_entri`. `meta_model` diimpor setelahnya.

- CSV registri dan transaksi diimpor dengan `\copy` melalui `psql` atau fitur impor CSV di dashboard (pilih yang berhasil untuk file 19 MB).
- `ml/build_initial_ledger.py` membangun satu entri ledger per transaksi dan entri peringatan untuk baris split pengujian yang ditandai oleh hybrid seed 42. Skrip menghasilkan `ledger_entri_awal.csv` dan `peringatan_awal.csv`.
- Pada database baru, `supabase/seed_supabase.py` mengimpor peringatan sebelum ledger. Ledger awal diimpor massal, bukan lewat `tambah_ledger` satu per satu.
- Untuk database yang sudah berisi transaksi dan ledger transaksi saja, `supabase/append_initial_alerts.py` menambahkan peringatan seed 42 dan entri ledger terkait tanpa menghapus data.
- Setelah impor, jalankan verifikasi penuh dengan `python supabase/verify_ledger.py`.
- Setelah impor, perbarui urutan identity `seq` agar entri baru melanjutkan nomor terakhir.

## 6. Ukuran dan batas

Data simulasi berukuran puluhan MB, jauh di bawah 500 MB batas paket gratis per proyek menurut sumber pihak ketiga (cek halaman harga Supabase untuk angka terbaru). Proyek gratis dijeda setelah 7 hari tidak aktif. Lihat `DEPLOY.md`.

## 7. Cadangan

Paket gratis tidak menyediakan cadangan otomatis. Simpan CSV sumber dan skrip pembangun ledger di repo supaya database bisa dibangun ulang dalam beberapa menit.

## 8. Keamanan

- Service role key hanya di environment variable server.
- RLS aktif, tidak ada kebijakan publik.
- Tidak ada data pribadi di tabel mana pun.
- Endpoint penulisan dijaga kode akses dan pembatasan laju (`API_SPEC.md`).
