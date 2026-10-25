export const DAFTAR_FITUR = [
  "log_nilai",
  "rasio_nilai_terhadap_kontrak",
  "rasio_kumulatif_pagu",
  "rasio_kumulatif_kontrak",
  "hari_sejak_pencairan_sebelumnya",
  "delta_progres_pct",
  "progres_fisik_pct",
  "bulan_ke",
  "persetujuan_wajib",
  "jenis_uang_muka",
  "jenis_termin",
  "jenis_retensi",
  "rasio_nilai_vs_progres",
  "jumlah_pencairan_7_hari",
  "nilai_vs_median_kontrak",
] as const;

export type NamaFitur = (typeof DAFTAR_FITUR)[number];
export type VektorFitur = Record<NamaFitur, number>;

export interface RiwayatTransaksi {
  tanggal: string;
  nilai_pencairan: number;
  progres_fisik_pct?: number;
}

export interface TransaksiUntukFitur extends RiwayatTransaksi {
  jenis_pembayaran: string;
  bulan_ke?: number;
  persetujuan_wajib?: number;
}

function hariDariTanggal(tanggal: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(tanggal);
  if (!match) throw new Error(`Tanggal tidak valid: ${tanggal}`);
  return Math.floor(Date.UTC(+match[1], +match[2] - 1, +match[3]) / 86_400_000);
}

function pembulatanPython(value: number, digit: number): number {
  // toFixed follows IEEE-754 decimal rounding, matching Python's rounded inputs
  // for the financial ratios used by this project (whole-rupiah amounts).
  return Number(value.toFixed(digit));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function hitungFiturSatuTransaksi(
  transaksi: TransaksiUntukFitur,
  riwayatKontrak: RiwayatTransaksi[],
  paguAlokasiKontrak: number,
  nilaiKontrak: number,
  tanggalMulaiKontrak?: string,
): VektorFitur {
  const currentDay = hariDariTanggal(transaksi.tanggal);
  const currentValue = Number(transaksi.nilai_pencairan);
  const currentProgress = Number(transaksi.progres_fisik_pct ?? 0);
  const orderedHistory = riwayatKontrak
    .map((row, index) => ({ ...row, _index: index, _day: hariDariTanggal(row.tanggal) }))
    .filter((row) => row._day <= currentDay)
    .sort((a, b) => a._day - b._day || a._index - b._index);
  const priorValues = orderedHistory.map((row) => Number(row.nilai_pencairan));

  let daysSincePrevious = tanggalMulaiKontrak
    ? currentDay - hariDariTanggal(tanggalMulaiKontrak)
    : 0;
  let progressDelta = currentProgress;
  if (orderedHistory.length) {
    const last = orderedHistory[orderedHistory.length - 1];
    daysSincePrevious = currentDay - last._day;
    progressDelta = pembulatanPython(currentProgress - Number(last.progres_fisik_pct ?? 0), 2);
  }

  const previousTotal = priorValues.reduce((sum, value) => sum + value, 0);
  const cumulative = previousTotal + currentValue;
  const ratioValueContract = nilaiKontrak > 0 ? pembulatanPython(currentValue / nilaiKontrak, 5) : 0;
  const ratioCumulativeAllocation = paguAlokasiKontrak > 0
    ? pembulatanPython(cumulative / paguAlokasiKontrak, 4)
    : 0;
  const ratioCumulativeContract = nilaiKontrak > 0
    ? pembulatanPython(cumulative / nilaiKontrak, 4)
    : 0;
  const medianPrevious = median(priorValues);
  const daysWindow = orderedHistory.filter((row) => row._day >= currentDay - 7).length + 1;
  const type = String(transaksi.jenis_pembayaran).toLowerCase();

  return {
    log_nilai: Math.log1p(currentValue),
    rasio_nilai_terhadap_kontrak: ratioValueContract,
    rasio_kumulatif_pagu: ratioCumulativeAllocation,
    rasio_kumulatif_kontrak: ratioCumulativeContract,
    hari_sejak_pencairan_sebelumnya: daysSincePrevious,
    delta_progres_pct: progressDelta,
    progres_fisik_pct: currentProgress,
    bulan_ke: Number(transaksi.bulan_ke ?? 1),
    persetujuan_wajib: Number(transaksi.persetujuan_wajib ?? 1),
    jenis_uang_muka: type === "uang_muka" ? 1 : 0,
    jenis_termin: type === "termin" ? 1 : 0,
    jenis_retensi: type === "retensi" ? 1 : 0,
    rasio_nilai_vs_progres: ratioValueContract / Math.max(progressDelta / 100, 0.005),
    jumlah_pencairan_7_hari: daysWindow,
    nilai_vs_median_kontrak: medianPrevious > 0 ? currentValue / medianPrevious : 1,
  };
}

