# DATABASE_SPEC (revisi)

> Versi revisi 2026-11-13, draf menunggu persetujuan pemilik. Menggantikan `DATABASE_SPEC.md` setelah disetujui. Revisi: REV-01, REV-11 (kolom koreksi, migrasi, isi ulang). Rincian di `PERUBAHAN_revisi.md`.

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
| `sumber` | text | `simulasi`, `live`, atau `koreksi` (tanpa CHECK, jadi nilai baru tidak butuh migrasi) |
| `dibuat_pada` | timestamptz | waktu penyimpanan |
| `digantikan_oleh` | text, null | `trx_id` transaksi koreksi yang menggantikan baris ini (REV-11) |
| `koreksi_dari` | text, null | `trx_id` transaksi lama yang dikoreksi oleh baris ini (REV-11) |

Kolom label (`label_anomali`, `kelompok_kasus`, `subtipe_kasus`) dan `split` boleh null untuk transaksi `live`. `project_id` pada transaksi tidak memakai rujukan kunci asing, karena aturan R01 perlu bisa menerima ID yang tidak valid.

Indeks: `(kontrak_id, tanggal)` untuk mengambil riwayat, dan `(tanggal)`. Indeks parsial `(kontrak_id, tanggal) where digantikan_oleh is null` melayani query riwayat. Query riwayat kontrak (kumulatif R02, fitur, grafik) selalu mengecualikan baris dengan `digantikan_oleh` terisi, supaya transaksi yang sudah dikoreksi tidak terhitung dua kali.

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

Dari `ditelaah` boleh langsung ke `ditindaklanjuti` jika tidak butuh klarifikasi. Pembagian perpindahan per peran ada di `API_SPEC.md` bagian 5. Koreksi memindahkan peringatan dari `perlu_klarifikasi` ke `diklarifikasi` (`API_SPEC.md` bagian 5A). Telaah syariah tidak mengubah status. Setiap perubahan status menambah entri ledger jenis `status`. Penetapan tindak lanjut menyebut pihak dan alasannya di catatan, mengikuti Gambar 1 esai.

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
- Data simulasi versi revisi berbeda dari versi lama (aturan R08, subtipe baru, split per proyek). Jangan mengimpor data baru ke proyek Supabase yang sudah berisi data lama. Pakai proyek Supabase baru (bagian 9).

## 6. Ukuran dan batas

Data simulasi berukuran puluhan MB, jauh di bawah 500 MB batas paket gratis per proyek menurut sumber pihak ketiga (cek halaman harga Supabase untuk angka terbaru). Proyek gratis dijeda setelah 7 hari tidak aktif. Lihat `DEPLOY.md`.

## 7. Cadangan

Paket gratis tidak menyediakan cadangan otomatis. Simpan CSV sumber dan skrip pembangun ledger di repo supaya database bisa dibangun ulang dalam beberapa menit.

## 8. Keamanan

- Service role key hanya di environment variable server.
- RLS aktif, tidak ada kebijakan publik.
- Tidak ada data pribadi di tabel mana pun.
- Endpoint penulisan dijaga kode akses dan pembatasan laju (`API_SPEC.md`).
- Kode akses peran (`KODE_AKSES_*`) hanya di environment variable server. Peran tidak disimpan di database kecuali sebagai bagian payload ledger.

## 9. Migrasi revisi dan isi ulang

`supabase/revisi_koreksi.sql` aman dijalankan berulang:

```sql
alter table transaksi add column if not exists digantikan_oleh text;
alter table transaksi add column if not exists koreksi_dari text;
create index if not exists idx_transaksi_kontrak_aktif
  on transaksi (kontrak_id, tanggal) where digantikan_oleh is null;
```

`supabase/schema.sql` untuk proyek baru memuat kolom dan indeks yang sama, jadi proyek baru tidak perlu menjalankan berkas migrasi.

Ledger lama tidak berubah oleh migrasi. Namun data simulasi versi revisi tidak kompatibel dengan data lama, karena generator, aturan, dan split berubah. Urutan yang disarankan:
1. Buat proyek Supabase baru, jalankan `schema.sql` (ekstensi `pgcrypto`, fungsi `tambah_ledger`, tabel `demo_pemulihan`).
2. Bangun ulang data dan ledger awal (bagian 5) dari data hasil generator baru.
3. Jalankan `python supabase/verify_ledger.py`. Hasil harus valid.
4. Uji `DEMO_SCRIPT.md` pada URL preview Vercel dengan variabel lingkungan proyek baru.
5. Setelah lolos, pindahkan variabel lingkungan produksi. Proyek lama tetap sebagai cadangan sampai pemilik memutuskan menghapusnya.

Proyek Supabase gratis dijeda setelah 7 hari tidak aktif, jadi cek status kedua proyek sebelum demo.
