import rules from "@/data/artifacts/rules_config.json";

export interface TransaksiUntukAturan {
  project_id: string;
  kontrak_id: string;
  nilai_pencairan: number;
  persetujuan_diperoleh: number;
  persetujuan_wajib?: number;
  kategori_hijau: string;
  hash_tercatat: string;
  hash_dokumen_saat_ini: string;
  milestone_terverifikasi: boolean;
  jenis_pembayaran: string;
  kelengkapan_bukti: number;
  kumulatif_cair?: number;
}

export interface KonteksAturan {
  projectIdSah: boolean;
  projectIdKontrak: string;
  paguAlokasiKontrak: number;
  kumulatifCairSebelumnya?: number;
}

export interface TemuanAturan {
  kode: string;
  pesan: string;
}

export const KODE_ATURAN = [
  "R01_ID_PROYEK",
  "R02_PAGU",
  "R03_PERSETUJUAN",
  "R04_KATEGORI",
  "R05_HASH",
  "R06_MILESTONE",
  "R07_BUKTI",
] as const;

export function hitungPersetujuanWajib(nilaiPencairan: number): number {
  if (nilaiPencairan < rules.ambang_persetujuan_rupiah.dua_mulai) return 1;
  if (nilaiPencairan < rules.ambang_persetujuan_rupiah.tiga_mulai) return 2;
  return 3;
}

function rupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value);
}

export function periksaAturanTransaksi(
  transaksi: TransaksiUntukAturan,
  konteks: KonteksAturan,
): TemuanAturan[] {
  const temuan: TemuanAturan[] = [];
  const currentProjectInvalid = !konteks.projectIdSah || transaksi.project_id !== konteks.projectIdKontrak;
  if (currentProjectInvalid) {
    temuan.push({ kode: "R01_ID_PROYEK", pesan: `ID proyek ${transaksi.project_id} tidak valid atau tidak sesuai dengan registri kontrak.` });
  }

  const kumulatif = Number(konteks.kumulatifCairSebelumnya ?? 0) + Number(transaksi.nilai_pencairan);
  if (kumulatif > Number(konteks.paguAlokasiKontrak)) {
    temuan.push({ kode: "R02_PAGU", pesan: `Kumulatif pencairan Rp${rupiah(kumulatif)} melebihi pagu alokasi kontrak Rp${rupiah(konteks.paguAlokasiKontrak)}.` });
  }

  const wajib = transaksi.persetujuan_wajib ?? hitungPersetujuanWajib(transaksi.nilai_pencairan);
  if (transaksi.persetujuan_diperoleh < wajib) {
    temuan.push({ kode: "R03_PERSETUJUAN", pesan: `Persetujuan yang diperoleh ${transaksi.persetujuan_diperoleh}, yang diwajibkan ${wajib}.` });
  }
  if (!(rules.kategori_sah as string[]).includes(transaksi.kategori_hijau)) {
    temuan.push({ kode: "R04_KATEGORI", pesan: `Kategori '${transaksi.kategori_hijau}' tidak termasuk dalam kategori hijau yang memenuhi syarat.` });
  }
  if (transaksi.hash_tercatat !== transaksi.hash_dokumen_saat_ini) {
    temuan.push({ kode: "R05_HASH", pesan: "Hash dokumen saat ini tidak cocok dengan hash yang tercatat." });
  }
  if (!transaksi.milestone_terverifikasi && transaksi.jenis_pembayaran.toLowerCase() === "termin") {
    temuan.push({ kode: "R06_MILESTONE", pesan: "Pembayaran termin diajukan namun verifikasi milestone belum terpenuhi." });
  }
  if (Number(Number(transaksi.kelengkapan_bukti).toFixed(4)) < Number(Number(rules.ambang_bukti).toFixed(4))) {
    temuan.push({ kode: "R07_BUKTI", pesan: `Kelengkapan bukti (${transaksi.kelengkapan_bukti.toFixed(2)}) di bawah ambang batas minimal (${rules.ambang_bukti.toFixed(2)}).` });
  }
  return temuan;
}

