# DEMO_SCRIPT

Skenario demo untuk presentasi atau video. Angka dan ID kontrak di bawah adalah penanda. Sebelum demo, pilih kontrak nyata dari data dan isi angka yang cocok, lalu jalankan skenario di URL publik dan catat hasil sebenarnya di kolom Hasil.

Skenario yang bergantung pada keluaran model (3, 4, 5) belum boleh dijanjikan di slide sampai diuji dengan model yang sudah jadi.

Status 2026-10-25: skenario di bawah belum dijalankan pada URL publik. Build lokal tersedia, tetapi Vercel belum dikonfigurasi dan migrasi tabel cadangan mode demo belum diterapkan. Halaman lokal memberi HTTP 200, tetapi secret key server mendapat HTTP 401 saat diuji terhadap Supabase. Kolom Hasil tetap kosong sampai pengujian benar-benar dilakukan.

## Persiapan

- [ ] Ikuti daftar periksa di `DEPLOY.md` bagian 7.
- [ ] Pilih empat kontrak dari halaman Riwayat Kontrak:
  - Kontrak A: sedang berjalan, riwayat termin cukup panjang (minimal 6 pencairan).
  - Kontrak B: sedang berjalan, nilai pencairan sedang, persetujuan 2 atau 3.
  - Kontrak C: sudah selesai.
  - Kontrak D: pencairan bulanan di kisaran Rp2 sampai Rp5 miliar (untuk skenario pemecahan).
- [ ] Siapkan kode akses.
- [ ] Catat `seq` ledger terakhir sebelum demo.

## Skenario 1: Transaksi normal

- Tujuan: menunjukkan sistem tidak berisik pada transaksi wajar.
- Kontrak: A. Isi nilai mendekati median termin kontrak, progres naik sewajarnya, persetujuan sesuai kebutuhan, bukti lengkap, hash cocok.
- Harapan awal: tidak ada temuan aturan. Hasil skor tetap harus dicatat karena kelompok transaksi sah yang tampak tidak lazim memiliki laju peringatan palsu hybrid 27,48 persen pada data pengujian.
- Hasil: ______

## Skenario 2: Pelanggaran aturan jelas

- Tujuan: menunjukkan lapisan aturan.
- Kontrak: B. Isi nilai di atas Rp5 miliar dengan persetujuan hanya 2.
- Harapan: temuan `R03_PERSETUJUAN` dengan pesan yang menyebut angkanya. Skor tidak dihitung karena sudah melanggar aturan.
- Variasi: ubah satu `hash_dokumen_saat_ini` agar berbeda untuk memicu `R05_HASH`.
- Hasil: ______

## Skenario 3: Lonjakan tanpa progres (lolos aturan, ditangkap skor)

- Tujuan: menunjukkan peran Isolation Forest.
- Kontrak: A. Isi nilai beberapa kali lipat median termin, progres tidak bertambah dari pencairan sebelumnya, semua kolom administratif benar (persetujuan sesuai, bukti lengkap, hash cocok, milestone terverifikasi).
- Uji ini belum terbukti tertangkap oleh model. Recall `lonjakan_tanpa_progres` pada ketiga pendekatan adalah 0 pada data pengujian seed 42. Jangan menjanjikan status "Perlu diperiksa" sebelum keluaran aktual dicatat.
- Catatan: pastikan nilai tidak membuat kumulatif melewati pagu, kalau tidak yang terpicu `R02_PAGU`.
- Hasil: ______

## Skenario 4: Kasus sah yang tampak janggal

- Tujuan: menunjukkan sistem tidak menganggap semua kejanggalan sebagai masalah.
- Kontrak: B. Isi nilai lebih besar dari biasanya tetapi dengan kenaikan progres yang sebanding (percepatan akhir tahun yang terverifikasi).
- Harapan: belum dapat ditentukan. Kasus sah yang tampak tidak lazim dapat mendapat peringatan; catat keluaran apa adanya.
- Hasil: ______

## Skenario 5: Pemecahan pencairan

- Tujuan: menunjukkan pola beruntun yang tidak terlihat pada satu transaksi.
- Kontrak: D. Simpan tiga pencairan berturut-turut dalam dua hari, masing-masing sedikit di bawah Rp5 miliar (misalnya Rp4,9 miliar), dengan persetujuan 2 sesuai nilai per transaksi dan progres tetap.
- Harapan belum terverifikasi. Recall `pemecahan_pencairan` adalah 0 untuk ketiga pendekatan pada data pengujian seed 42. Jangan menjanjikan deteksi; catat transaksi dan hasil aktual jika skenario diuji.
- Hasil: ______

## Skenario 6: Tindak lanjut peringatan

- Tujuan: menunjukkan alur auditor dan jejak ledger.
- Langkah: buka peringatan dari skenario 3 atau 5, ubah status ke "ditelaah", lalu "perlu klarifikasi" dengan catatan, lalu "diklarifikasi", lalu "ditindaklanjuti" dengan catatan keputusan dan pihak.
- Harapan: setiap perubahan menambah entri ledger. Halaman Ledger menampilkan entri `status` berurutan.
- Hasil: ______

## Skenario 7: Perubahan terdeteksi

- Tujuan: menunjukkan verifikasi ledger.
- Langkah:
  1. Buka halaman Ledger dan jalankan verifikasi pada rentang terbaru. Harapan: valid.
  2. Pastikan tabel `demo_pemulihan` tersedia dan mode demo aktif, lalu rusak satu entri.
  3. Jalankan verifikasi lagi. Harapan: tidak valid, `rusak_pada` menunjuk tepat entri tadi.
  4. Pulihkan entri dan verifikasi ulang. Harapan: valid.
- Pesan: perubahan terdeteksi, bukan tercegah. Sebutkan batasannya dari `LIMITATIONS.md` bagian 3.
- Hasil: ______

## Skenario 8: Halaman Evaluasi

- Tujuan: menunjukkan angka dan cara membacanya dengan jujur.
- Langkah: buka halaman Evaluasi, tunjukkan tabel tiga pendekatan, recall per subtipe, dan hasil beberapa seed.
- Pesan wajib: data simulasi, anomali disuntikkan, kelompok kontekstual dirancang lolos dari aturan.
- Hasil: ______

## Urutan yang disarankan untuk presentasi singkat

1 (normal), 2 (aturan), 3 (skor), 6 (tindak lanjut), 7 (perubahan terdeteksi), lalu 8 (evaluasi). Skenario 4 dan 5 dipakai jika waktu cukup atau ada pertanyaan juri.

## Jika sesuatu gagal saat demo

- Halaman tidak memuat: periksa apakah Supabase dijeda, aktifkan lagi, dan beralih ke rekaman layar bila perlu.
- Hasil model berbeda dari latihan: jelaskan bahwa skenario dipilih dari data simulasi dan tunjukkan pembanding. Jangan mengubah angka di tempat untuk mengejar hasil yang diharapkan.
- Verifikasi ledger gagal tanpa perusakan: hentikan, jangan lanjut ke skenario 7, dan gunakan rekaman.
