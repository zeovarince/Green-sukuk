import { hitungFiturSatuTransaksi, type VektorFitur } from "@/lib/fitur";
import { hitungSkorIsolationForest, ambilInfoModel } from "@/lib/iforest";
import { hitungPersetujuanWajib, periksaAturanTransaksi, ambangBukti, type TemuanAturan } from "@/lib/aturan";
import type { KontrakRow, ProyekRow, TransaksiRow } from "@/lib/store";

export type InputPemeriksaan = {
  project_id: string;
  kontrak_id: string;
  tanggal: string;
  jenis_pembayaran: string;
  nilai_pencairan: number;
  progres_fisik_pct: number;
  milestone_terverifikasi: boolean;
  persetujuan_diperoleh: number;
  persetujuan_wajib: number;
  kelengkapan_bukti: number;
  kategori_hijau: string;
  hash_tercatat: string;
  hash_dokumen_saat_ini: string;
  bulan_ke: number;
  akad?: string;
};

export type HasilEvaluasi = {
  features: VektorFitur;
  findings: TemuanAturan[];
  skor: number | null;
  ambang: number;
  versiModel: string;
  diAtasAmbang: boolean;
  keputusan: "normal" | "peringatan";
  jenisPeringatan: "aturan" | "skor" | "keduanya" | null;
  tindakLanjut: "pemantauan_berlanjut" | "telaah_auditor";
  priorTotal: number;
  nilaiKontrakEfektif: number;
  medianPrevious: number;
  sevenDayCount: number;
  averageDelta: number;
};

export type Tersimpan = { trx_id: string; peringatan_id: string | null; seq_ledger: number | null } | null;

export function validasiPemeriksaan(body: Record<string, unknown>): string | null {
  const requiredStrings = ["kontrak_id", "project_id", "tanggal", "jenis_pembayaran", "kategori_hijau"];
  for (const name of requiredStrings) {
    if (typeof body[name] !== "string" || !String(body[name]).trim()) return `${name} wajib berupa teks.`;
  }
  const maximumLengths: Record<string, number> = { kontrak_id: 128, project_id: 128, tanggal: 10, jenis_pembayaran: 20, kategori_hijau: 256 };
  for (const [name, max] of Object.entries(maximumLengths)) if (String(body[name]).length > max) return `${name} maksimum ${max} karakter.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.tanggal)) || Number.isNaN(Date.parse(`${body.tanggal}T00:00:00Z`)) || new Date(`${body.tanggal}T00:00:00Z`).toISOString().slice(0, 10) !== body.tanggal) return "tanggal harus berformat YYYY-MM-DD.";
  if (!["uang_muka", "termin", "retensi"].includes(String(body.jenis_pembayaran).toLowerCase())) return "jenis_pembayaran harus uang_muka, termin, atau retensi.";
  for (const name of ["hash_tercatat", "hash_dokumen_saat_ini"]) {
    if (body[name] !== undefined && typeof body[name] !== "string") return `${name} harus berupa teks.`;
    if (typeof body[name] === "string" && body[name].length > 256) return `${name} maksimum 256 karakter.`;
  }
  if (!Number.isSafeInteger(body.nilai_pencairan) || Number(body.nilai_pencairan) <= 0) return "nilai_pencairan harus bilangan bulat positif.";
  if (typeof body.progres_fisik_pct !== "number" || !Number.isFinite(body.progres_fisik_pct) || body.progres_fisik_pct < 0 || body.progres_fisik_pct > 100) return "progres_fisik_pct harus berada pada rentang 0 sampai 100.";
  if (typeof body.milestone_terverifikasi !== "boolean") return "milestone_terverifikasi harus boolean.";
  if (!Number.isInteger(body.persetujuan_diperoleh) || Number(body.persetujuan_diperoleh) < 0 || Number(body.persetujuan_diperoleh) > 100) return "persetujuan_diperoleh harus bilangan bulat antara 0 sampai 100.";
  if (typeof body.kelengkapan_bukti !== "number" || !Number.isFinite(body.kelengkapan_bukti) || body.kelengkapan_bukti < 0 || body.kelengkapan_bukti > 1) return "kelengkapan_bukti harus berada pada rentang 0 sampai 1.";
  if (body.akad !== undefined && (typeof body.akad !== "string" || !["Ijarah Asset to Be Leased", "Wakalah"].includes(body.akad))) {
    return 'akad harus "Ijarah Asset to Be Leased" atau "Wakalah".';
  }
  if (body.simpan !== undefined && typeof body.simpan !== "boolean") return "simpan harus boolean.";
  return null;
}

export function validasiPengusulVerifikator(body: Record<string, unknown>): string | null {
  for (const name of ["pengusul", "verifikator"]) {
    if (typeof body[name] !== "string") return `${name} wajib berupa teks bila hasil disimpan.`;
    const length = String(body[name]).trim().length;
    if (length < 3 || length > 80) return `${name} harus 3 sampai 80 karakter bila hasil disimpan.`;
  }
  return null;
}

export function bulanKe(tanggal: string, tanggalMulai: string, jenis: string): number {
  if (jenis.toLowerCase() === "uang_muka") return 0;
  const [year, month] = tanggal.split("-").map(Number);
  const [startYear, startMonth] = tanggalMulai.split("-").map(Number);
  return Math.max(1, (year - startYear) * 12 + month - startMonth + 1);
}

export function tahapProyek(jenis: string, progres: number): string {
  if (jenis.toLowerCase() === "retensi") return "pemeliharaan";
  if (progres <= 10) return "persiapan";
  if (progres < 90) return "konstruksi";
  return "penyelesaian";
}

export function siapkanInput(body: Record<string, unknown>, contract: KontrakRow) {
  const type = String(body.jenis_pembayaran).toLowerCase();
  const month = bulanKe(String(body.tanggal), contract.tanggal_mulai, type);
  const approvalRequired = hitungPersetujuanWajib(Number(body.nilai_pencairan));
  const providedRecordedHash = typeof body.hash_tercatat === "string" ? body.hash_tercatat : "";
  const providedCurrentHash = typeof body.hash_dokumen_saat_ini === "string" ? body.hash_dokumen_saat_ini : "";
  const recordedHash = providedRecordedHash || providedCurrentHash || "hash-demo";
  const currentHash = providedCurrentHash || recordedHash;
  const input: InputPemeriksaan = {
    project_id: String(body.project_id), kontrak_id: String(contract.kontrak_id), tanggal: String(body.tanggal),
    jenis_pembayaran: type, nilai_pencairan: Number(body.nilai_pencairan),
    progres_fisik_pct: Number(body.progres_fisik_pct), milestone_terverifikasi: Boolean(body.milestone_terverifikasi),
    persetujuan_diperoleh: Number(body.persetujuan_diperoleh), persetujuan_wajib: approvalRequired,
    kelengkapan_bukti: Number(body.kelengkapan_bukti), kategori_hijau: String(body.kategori_hijau),
    hash_tercatat: recordedHash, hash_dokumen_saat_ini: currentHash, bulan_ke: month,
    ...(typeof body.akad === "string" ? { akad: body.akad } : {}),
  };
  return { input, recordedHash, currentHash, approvalRequired };
}

export function evaluasiTransaksi(
  input: InputPemeriksaan,
  konteks: { contract: KontrakRow; contractProject: ProyekRow; requestedProject: ProyekRow | null; history: TransaksiRow[] },
): HasilEvaluasi {
  const { contract, contractProject, requestedProject, history } = konteks;
  const priorTotal = history.reduce((total, row) => total + Number(row.nilai_pencairan), 0);
  const latestHistory = history[history.length - 1];
  const nilaiKontrakEfektif = Number(latestHistory?.nilai_kontrak ?? contract.nilai_kontrak_awal);
  const features = hitungFiturSatuTransaksi(
    input,
    history,
    Number(contract.pagu_alokasi),
    nilaiKontrakEfektif,
    contract.tanggal_mulai,
    {
      durasiBulan: Number(contract.durasi_bulan ?? 12),
      tahapProyek: tahapProyek(input.jenis_pembayaran, input.progres_fisik_pct),
    },
  );
  const findings = periksaAturanTransaksi(input, {
    projectIdSah: Boolean(requestedProject), projectIdKontrak: contractProject.project_id,
    paguAlokasiKontrak: Number(contract.pagu_alokasi), kumulatifCairSebelumnya: priorTotal,
    akadProyek: requestedProject ? requestedProject.akad : contractProject.akad,
  });
  const modelInfo = ambilInfoModel();
  const skor = findings.length === 0 ? hitungSkorIsolationForest(features) : null;
  const diAtasAmbang = skor !== null && skor >= modelInfo.ambang;
  const isWarning = findings.length > 0 || diAtasAmbang;
  const jenisPeringatan = findings.length && diAtasAmbang ? "keduanya" : findings.length ? "aturan" : diAtasAmbang ? "skor" : null;
  const sortedPriorValues = history.map((row) => Number(row.nilai_pencairan)).sort((a, b) => a - b);
  const medianPrevious = sortedPriorValues.length === 0 ? 0 : sortedPriorValues.length % 2
    ? sortedPriorValues[Math.floor(sortedPriorValues.length / 2)]
    : (sortedPriorValues[sortedPriorValues.length / 2 - 1] + sortedPriorValues[sortedPriorValues.length / 2]) / 2;
  const sevenDayCount = history.filter((row) => {
    const age = Date.parse(`${input.tanggal}T00:00:00Z`) - Date.parse(`${row.tanggal}T00:00:00Z`);
    return age >= 0 && age <= 7 * 86_400_000;
  }).length + 1;
  const averageDelta = history.length
    ? history.reduce((sum, row) => sum + Number(row.delta_progres_pct ?? 0), 0) / history.length
    : 0;
  return {
    features, findings, skor, ambang: modelInfo.ambang, versiModel: modelInfo.versi_model, diAtasAmbang,
    keputusan: isWarning ? "peringatan" : "normal", jenisPeringatan,
    tindakLanjut: isWarning ? "telaah_auditor" : "pemantauan_berlanjut",
    priorTotal, nilaiKontrakEfektif, medianPrevious, sevenDayCount, averageDelta,
  };
}

export function bangunBarisTransaksi(args: {
  input: InputPemeriksaan;
  contract: KontrakRow;
  contractProject: ProyekRow;
  features: VektorFitur;
  approvalRequired: number;
  priorTotal: number;
  trxId: string;
  sumber: "live" | "koreksi";
  nilaiKontrak: number;
  versiKontrak: number;
  statusAddendum: string;
  koreksiDari?: string | null;
}) {
  const { input, contract, contractProject, features, approvalRequired, priorTotal, trxId, sumber, nilaiKontrak, versiKontrak, statusAddendum, koreksiDari } = args;
  return {
    trx_id: trxId, tanggal: input.tanggal, seri_penerbitan: contractProject.seri_penerbitan,
    akad: input.akad ?? contractProject.akad, jenis_pembiayaan: contractProject.jenis_pembiayaan,
    project_id: input.project_id, kontrak_id: input.kontrak_id, kementerian_pelaksana: contractProject.kementerian_pelaksana,
    kategori_hijau: input.kategori_hijau, jenis_pembayaran: input.jenis_pembayaran, bulan_ke: input.bulan_ke,
    tahap_proyek: tahapProyek(input.jenis_pembayaran, input.progres_fisik_pct), nilai_pencairan: input.nilai_pencairan,
    nilai_kontrak: nilaiKontrak, versi_kontrak: versiKontrak, status_addendum: statusAddendum,
    pagu_alokasi_kontrak: Number(contract.pagu_alokasi),
    progres_fisik_pct: input.progres_fisik_pct, milestone_terverifikasi: input.milestone_terverifikasi,
    persetujuan_wajib: approvalRequired, persetujuan_diperoleh: input.persetujuan_diperoleh,
    kelengkapan_bukti: input.kelengkapan_bukti, hash_tercatat: input.hash_tercatat, hash_dokumen_saat_ini: input.hash_dokumen_saat_ini,
    hari_sejak_pencairan_sebelumnya: features.hari_sejak_pencairan_sebelumnya,
    delta_progres_pct: features.delta_progres_pct, kumulatif_cair: priorTotal + input.nilai_pencairan,
    rasio_kumulatif_pagu: features.rasio_kumulatif_pagu,
    rasio_kumulatif_kontrak: features.rasio_kumulatif_kontrak,
    rasio_nilai_terhadap_kontrak: features.rasio_nilai_terhadap_kontrak,
    split: null, label_anomali: null, kelompok_kasus: null, subtipe_kasus: null, sumber,
    ...(koreksiDari ? { koreksi_dari: koreksiDari } : {}),
  };
}

export function susunHasil(args: { evaluation: HasilEvaluasi; input: InputPemeriksaan; saved: Tersimpan; started: number }) {
  const { evaluation, input, saved, started } = args;
  const perluTelaahSyariah = evaluation.findings.some((item) => item.kode === "R08_AKAD");
  return {
    keputusan: evaluation.keputusan,
    jenis_peringatan: evaluation.jenisPeringatan,
    temuan_aturan: evaluation.findings,
    ...(perluTelaahSyariah ? { perlu_telaah_syariah: true } : {}),
    skor: { nilai: evaluation.skor, ambang: evaluation.ambang, di_atas_ambang: evaluation.diAtasAmbang, versi_model: evaluation.versiModel },
    tindak_lanjut: evaluation.tindakLanjut,
    bukti: {
      hash_tercatat: input.hash_tercatat,
      hash_dokumen_saat_ini: input.hash_dokumen_saat_ini,
      hash_cocok: input.hash_tercatat === input.hash_dokumen_saat_ini,
      kelengkapan_bukti: input.kelengkapan_bukti,
      ambang_bukti: ambangBukti(),
      dokumen_asli_tersedia: false,
    },
    fitur: evaluation.features,
    pembanding: {
      median_pencairan_sebelumnya: evaluation.medianPrevious,
      jumlah_pencairan_7_hari: evaluation.sevenDayCount,
      rata_rata_delta_progres: evaluation.averageDelta,
    },
    tersimpan: saved,
    waktu_proses_ms: Math.round((performance.now() - started) * 100) / 100,
  };
}
