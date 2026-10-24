# DEMO_SCRIPT

Skenario demo untuk presentasi atau video. Angka dan ID kontrak di bawah adalah penanda. Sebelum demo, pilih kontrak nyata dari data dan isi angka yang cocok, lalu jalankan skenario di URL publik dan catat hasil sebenarnya di kolom Hasil.

Skenario yang bergantung pada keluaran model (3, 4, 5) belum boleh dijanjikan di slide sampai diuji dengan model yang sudah jadi.

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
- Harapan: "Tidak ada peringatan baru". Tidak ada temuan aturan, skor di bawah ambang.
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
- Harapan: lolos tujuh aturan, skor di atas ambang, status "Perlu diperiksa". Pembanding menunjukkan nilai jauh di atas median.
- Catatan: pastikan nilai tidak membuat kumulatif melewati pagu, kalau tidak yang terpicu `R02_PAGU`.
- Hasil: ______

## Skenario 4: Kasus sah yang tampak janggal

- Tujuan: menunjukkan sistem tidak menganggap semua kejanggalan sebagai masalah.
- Kontrak: B. Isi nilai lebih besar dari biasanya tetapi dengan kenaikan progres yang sebanding (percepatan akhir tahun yang terverifikasi).
- Harapan: tidak ada peringatan, atau jika ada, jelaskan di demo mengapa (batas model). Catat apa pun yang terjadi.
- Hasil: ______

## Skenario 5: Pemecahan pencairan

- Tujuan: menunjukkan pola beruntun yang tidak terlihat pada satu transaksi.
- Kontrak: D. Simpan tiga pencairan berturut-turut dalam dua hari, masing-masing sedikit di bawah Rp5 miliar (misalnya Rp4,9 miliar), dengan persetujuan 2 sesuai nilai per transaksi dan progres tetap.
- Harapan: pencairan pertama mungkin tidak ditandai, pencairan kedua atau ketiga ditandai karena jumlah pencairan 7 hari dan nilai relatif terhadap progres. Catat pada pencairan ke berapa peringatan muncul. Angka itu bahan "waktu deteksi" di `EVALUATION.md`.
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
  2. Aktifkan mode demo dan rusak satu entri.
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
