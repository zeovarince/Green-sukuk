import curveJson from "@/data/landing/kurva_contoh.json";
import cloudJson from "@/data/landing/awan_transaksi.json";
import chainJson from "@/data/landing/rantai_contoh.json";
import evaluationJson from "@/data/landing/evaluasi.json";

export type CurvePoint = { u: number; progres: number; pencairan: number };
export type CurveData = {
  simulasi: true;
  seed: number;
  dibuat_pada: string;
  kontrak_id: string;
  jenis_kasus: string;
  titik: CurvePoint[];
  ditandai: { u: number; selisih_poin: number };
};
export type CloudPoint = { x: number; y: number; z: number; a: 0 | 1; k: number | null; d: 0 | 1 };
export type CloudData = {
  simulasi: true;
  seed: number;
  dibuat_pada: string;
  total: number;
  anomali: number;
  ambang: number;
  catatan_sampel: string;
  n_sampel: number;
  proporsi_anomali_sumber: number;
  proporsi_anomali_sampel: number;
  peringatan_aturan_sampel: number;
  peringatan_skor_sampel: number;
  peringatan_hybrid_sampel: number;
  sampel: CloudPoint[];
};
export type ChainData = {
  simulasi: true;
  dibuat_pada: string;
  entri: { seq: number; jenis: string; hash: string }[];
  rusak_pada: number;
  catatan: string;
};
export type MetricRow = { precision: number; recall: number; f1: number; far: number; peringatan_per_1000: number };
export type EvaluationData = {
  tersedia: boolean;
  versi_model: string;
  dibuat_pada: string;
  seed_utama: number;
  ambang: { nilai: number; ambang_iforest_saja: number };
  pengujian: Record<"aturan_saja" | "iforest_saja" | "hybrid", MetricRow>;
  recall_per_subtipe: Record<string, { n: number; aturan_saja: number; iforest_saja: number; hybrid: number }>;
  false_alarm_normal_tidak_lazim_sah: { n: number; aturan_saja: number; iforest_saja: number; hybrid: number };
  beberapa_seed: { seed: number[]; f1_hybrid_rerata: number; f1_hybrid_sd: number; far_hybrid_rerata: number; far_hybrid_sd: number };
  latensi_ms: { lokal: number; vercel: number };
};

export type LandingData = { curve: CurveData; cloud: CloudData; chain: ChainData; evaluation: EvaluationData };

export const LANDING_DATA = {
  curve: curveJson,
  cloud: cloudJson,
  chain: chainJson,
  evaluation: evaluationJson,
} as unknown as LandingData;

export function validasiLandingData(data: LandingData): void {
  if (data.curve.simulasi !== true || data.cloud.simulasi !== true || data.chain.simulasi !== true) {
    throw new Error("Berkas landing GSTP harus menandai semua data sebagai simulasi.");
  }
  if (!data.curve.titik.length || data.curve.titik.some((point) => ![point.u, point.progres, point.pencairan].every(Number.isFinite))) {
    throw new Error("kurva_contoh.json tidak memiliki titik yang valid.");
  }
  if (data.cloud.sampel.length > 8000 || data.cloud.n_sampel !== data.cloud.sampel.length || data.cloud.ambang < 0 || data.cloud.ambang > 1) {
    throw new Error("awan_transaksi.json tidak memenuhi batas ukuran atau rentang nilai.");
  }
  if (data.cloud.proporsi_anomali_sampel <= data.cloud.proporsi_anomali_sumber) {
    throw new Error("Proporsi anomali sampel visual harus diberi penjelasan karena lebih tinggi daripada data sumber.");
  }
  if (data.chain.entri.length < 18 || data.chain.entri.length > 24 || !data.chain.entri.some((entry) => entry.seq === data.chain.rusak_pada)) {
    throw new Error("rantai_contoh.json harus memiliki 18 sampai 24 entri dan satu tautan contoh yang putus.");
  }
  if (data.evaluation.tersedia && (!data.evaluation.pengujian.hybrid || !data.evaluation.recall_per_subtipe)) {
    throw new Error("evaluasi.json berisi struktur evaluasi yang tidak lengkap.");
  }
}
