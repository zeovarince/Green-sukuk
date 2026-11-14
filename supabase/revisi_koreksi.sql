-- ==============================================================================
-- Migrasi fase R2: tautan koreksi transaksi
-- Aman dijalankan berulang. Ledger lama tidak berubah.
-- Sesuai docs/revisi/DATABASE_SPEC_revisi.md bagian 9.
-- ==============================================================================

alter table transaksi add column if not exists digantikan_oleh text;
alter table transaksi add column if not exists koreksi_dari text;

create index if not exists idx_transaksi_kontrak_aktif
    on transaksi (kontrak_id, tanggal) where digantikan_oleh is null;
