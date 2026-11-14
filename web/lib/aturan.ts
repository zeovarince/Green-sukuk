import rules from "@/data/artifacts/rules_config.json";

export type Prinsip = "amanah" | "hifz_al_mal";

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
  akad?: string;
}

export interface KonteksAturan {
  projectIdSah: boolean;
  projectIdKontrak: string;
  paguAlokasiKontrak: number;
  kumulatifCairSebelumnya?: number;
  akadProyek?: string;
}

export interface TemuanAturan {
  kode: string;
  pesan: string;
  prinsip: Prinsip;
}

export const KODE_ATURAN = [
  "R01_ID_PROYEK",
  "R02_PAGU",
  "R03_PERSETUJUAN",
  "R04_KATEGORI",
  "R05_HASH",
  "R06_MILESTONE",
  "R07_BUKTI",
  "R08_AKAD",
] as const;

const PETA_PRINSIP = rules.prinsip as Record<string, Prinsip>;

export function prinsipUntuk(kode: string): Prinsip {
  const prinsip = PETA_PRINSIP[kode];
  if (prinsip !== "amanah" && prinsip !== "hifz_al_mal") {
    throw new Error(`Prinsip untuk aturan ${kode} belum dipetakan di rules_config.json.`);
  }
  return prinsip;
}

export function labelPrinsip(prinsip: Prinsip): string {
  return prinsip === "hifz_al_mal" ? "Hifz al-mal" : "Amanah";
}

export function ambangBukti(): number {
  return Number(rules.ambang_bukti);
}

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
  const catat = (kode: string, pesan: string): void => {
    temuan.push({ kode, pesan, prinsip: prinsipUntuk(kode) });
  };

  const currentProjectInvalid = !konteks.projectIdSah || transaksi.project_id !== konteks.projectIdKontrak;
  if (currentProjectInvalid) {
    catat("R01_ID_PROYEK", `ID proyek ${transaksi.project_id} tidak valid atau tidak sesuai dengan registri kontrak.`);
  }

  const kumulatif = Number(konteks.kumulatifCairSebelumnya ?? 0) + Number(transaksi.nilai_pencairan);
  if (kumulatif > Number(konteks.paguAlokasiKontrak)) {
    catat("R02_PAGU", `Kumulatif pencairan Rp${rupiah(kumulatif)} melebihi pagu alokasi kontrak Rp${rupiah(konteks.paguAlokasiKontrak)}.`);
  }

  const wajib = transaksi.persetujuan_wajib ?? hitungPersetujuanWajib(transaksi.nilai_pencairan);
  if (transaksi.persetujuan_diperoleh < wajib) {
    catat("R03_PERSETUJUAN", `Persetujuan yang diperoleh ${transaksi.persetujuan_diperoleh}, yang diwajibkan ${wajib}.`);
  }
  if (!(rules.kategori_sah as string[]).includes(transaksi.kategori_hijau)) {
    catat("R04_KATEGORI", `Kategori '${transaksi.kategori_hijau}' tidak termasuk dalam kategori hijau yang memenuhi syarat.`);
  }
  if (transaksi.hash_tercatat !== transaksi.hash_dokumen_saat_ini) {
    catat("R05_HASH", "Hash dokumen saat ini tidak cocok dengan hash yang tercatat.");
  }
  if (!transaksi.milestone_terverifikasi && transaksi.jenis_pembayaran.toLowerCase() === "termin") {
    catat("R06_MILESTONE", "Pembayaran termin diajukan namun verifikasi milestone belum terpenuhi.");
  }
  if (Number(Number(transaksi.kelengkapan_bukti).toFixed(4)) < Number(Number(rules.ambang_bukti).toFixed(4))) {
    catat("R07_BUKTI", `Kelengkapan bukti (${transaksi.kelengkapan_bukti.toFixed(2)}) di bawah ambang batas minimal (${rules.ambang_bukti.toFixed(2)}).`);
  }
  if (konteks.projectIdSah && konteks.akadProyek) {
    const akadTransaksi = transaksi.akad || konteks.akadProyek;
    if (akadTransaksi && akadTransaksi !== konteks.akadProyek) {
      catat("R08_AKAD", `Akad pada transaksi '${akadTransaksi}' berbeda dari akad terdaftar proyek '${konteks.akadProyek}'.`);
    }
  }
  return temuan;
}
