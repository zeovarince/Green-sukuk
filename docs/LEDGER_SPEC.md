# LEDGER_SPEC

Spesifikasi ledger simulasi untuk prototipe GSTP. Ledger ini adalah hash-chain append-only di tabel Postgres. Ini bukan jaringan blockchain permissioned yang terdistribusi, dan tidak boleh disebut Hyperledger Fabric.

## 1. Tujuan

- Membuat setiap perubahan tercatat dengan urutan, waktu, dan hash yang saling mengunci.
- Memungkinkan verifikasi bahwa riwayat tidak diubah diam-diam.
- Menunjukkan prinsip esai: koreksi memperbarui versi data, sedangkan riwayat dan hasil pemeriksaan tetap tertaut.

## 2. Pembagian on-chain dan off-chain

| Dalam rancangan esai | Di prototipe |
|---|---|
| Dicatat on-chain: metadata, hash, waktu, status verifikasi, jejak persetujuan dan perubahan | Baris di `ledger_entri` |
| Disimpan off-chain: dokumen lengkap dan data sensitif, terenkripsi dengan hak akses | Tidak ada dokumen asli. Hash dokumen disimulasikan di kolom `hash_tercatat` dan `hash_dokumen_saat_ini` |

## 3. Jenis entri

| `jenis_entri` | Kapan dibuat | Isi payload (ringkas) |
|---|---|---|
| `transaksi` | Transaksi disimpan | `trx_id`, `kontrak_id`, `tanggal`, `nilai_pencairan`, `hash_tercatat`, hasil pemeriksaan |
| `peringatan` | Peringatan dibuat | `peringatan_id`, `trx_id`, kode aturan, skor, ambang, versi model |
| `status` | Status kasus berubah | `peringatan_id`, status lama dan baru, catatan, waktu |
| `koreksi` | Data dikoreksi | `seq_dikoreksi`, alasan, nilai baru |

Koreksi tidak mengubah entri lama. Koreksi adalah entri baru yang menunjuk ke entri yang dikoreksi.

## 4. Rumus hash

```
payload_kanonik = JSON dengan kunci diurutkan alfabet, tanpa spasi, UTF-8
hash_payload    = SHA-256( payload_kanonik )            heksadesimal huruf kecil, 64 karakter
hash_saat_ini   = SHA-256( hash_sebelumnya + "|" + hash_payload )
hash_sebelumnya = hash_saat_ini entri sebelumnya, atau "GENESIS" untuk entri pertama
```

Aturan penting:
- `payload_kanonik` disimpan sebagai teks di kolom `payload_kanonik`. Jangan menghitung ulang dari kolom `jsonb`, karena `jsonb` bisa mengubah urutan kunci dan format angka sehingga hash berbeda.
- Angka di payload ditulis sebagai bilangan bulat jika memang bilangan bulat. Desimal ditulis dengan jumlah digit tetap yang ditentukan di kode kanonikalisasi, dan fungsi itu dipakai bersama oleh pembuat dan verifikator.
- Hash di CSV simulasi (`hash_tercatat`) adalah SHA-256 yang dipotong 16 karakter untuk transaksi. Hash ledger memakai 64 karakter penuh. Keduanya berbeda tujuan, jangan dicampur.

## 5. Menambah entri

Penambahan dilakukan lewat fungsi database `tambah_ledger` (lihat `DATABASE_SPEC.md`) dalam satu transaksi dengan kunci, supaya dua permintaan bersamaan tidak membuat rantai bercabang:

1. Ambil kunci penasihat (advisory lock) khusus ledger.
2. Baca `hash_saat_ini` entri terakhir.
3. Hitung `hash_saat_ini` entri baru dengan rumus di bagian 4.
4. Sisipkan baris dengan `seq` berikutnya.
5. Lepas kunci saat transaksi selesai.

Kode aplikasi tidak boleh menyisipkan ke `ledger_entri` secara langsung. Tidak ada UPDATE atau DELETE pada tabel ini dari kode aplikasi.

## 6. Verifikasi

Algoritma yang sama dipakai di route verifikasi dan skrip Python:

1. Urutkan entri menurut `seq`.
2. Untuk tiap entri: hitung ulang `hash_payload` dari `payload_kanonik`, bandingkan dengan nilai tersimpan.
3. Cek `hash_sebelumnya` sama dengan `hash_saat_ini` entri sebelumnya (atau `GENESIS`).
4. Hitung ulang `hash_saat_ini`, bandingkan dengan nilai tersimpan.
5. Hentikan pada entri pertama yang tidak cocok dan laporkan `seq`-nya.

Keluaran: `valid` (true atau false), `entri_diperiksa`, `rusak_pada` (nomor `seq` atau null), dan hash entri terakhir.

Verifikasi rantai penuh (puluhan ribu entri) bisa lambat. Sediakan verifikasi per rentang `seq` dan verifikasi penuh sebagai tindakan terpisah.

## 7. Mode demo perusakan

Untuk menunjukkan bahwa perubahan terdeteksi, ada endpoint demo yang mengubah satu entri langsung di database. Syaratnya:
- Hanya aktif jika `DEMO_MODE=true`.
- Dijaga kode akses.
- Hanya mengubah `payload_kanonik` atau `hash_payload` entri yang dipilih, tidak memperbaiki entri sesudahnya.
- Ada tombol pemulihan demo yang mengembalikan nilai asli yang disimpan sebelum perusakan.

Setelah perusakan, verifikasi harus gagal tepat di entri yang diubah.

## 8. Ledger awal dari data simulasi

Transaksi simulasi diurutkan menurut `trx_id` (kronologis). Satu entri `transaksi` dibuat per baris, lalu satu entri `peringatan` untuk baris yang ditandai oleh hasil evaluasi pada seed 42. Rantai dibangun oleh skrip Python (`ml/gstp/ledger.py`) dan diimpor massal, bukan lewat route API satu per satu. Hasil impor harus lolos verifikasi penuh sebelum demo.

## 9. Analogi konseptual dengan Hyperledger Fabric

Analogi ini membantu menjelaskan, tetapi bukan klaim kesetaraan.

| Konsep Fabric | Padanan di prototipe |
|---|---|
| Ledger (rantai blok dan state) | Tabel `ledger_entri` dan tabel transaksi |
| Chaincode | Library aturan di `web/lib/aturan.ts` |
| Persetujuan endorser | Kolom `persetujuan_diperoleh` dan aturan R03 |
| Layanan pengurutan | Fungsi `tambah_ledger` dengan kunci |
| Channel dan organisasi | Tidak ada. Satu database, satu operator |

## 10. Yang tidak diberikan hash-chain ini

- Tidak mencegah perubahan. Hanya membuat perubahan terdeteksi, dan hanya jika pihak pemeriksa memegang hash terakhir yang terpercaya.
- Siapa pun yang punya akses penuh ke database dapat menghitung ulang seluruh rantai dari entri yang diubah. Pencegahan sebenarnya butuh banyak pihak yang menyimpan salinan dan hash jangkar yang dipublikasikan di luar database.
- Tidak ada konsensus antar organisasi.

Poin ini ada di `LIMITATIONS.md` dan harus tercermin di esai. Pengembangan lanjutan yang masuk akal: mempublikasikan hash terakhir secara berkala di tempat terpisah, atau memakai Hyperledger Fabric sungguhan.
