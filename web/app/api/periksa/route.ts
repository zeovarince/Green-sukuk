import { randomUUID } from "node:crypto";
import { hitungFiturSatuTransaksi } from "@/lib/fitur";
import { hitungSkorIsolationForest, ambilInfoModel } from "@/lib/iforest";
import { kanonikalisasiPayload, hitungHashSha256 } from "@/lib/ledger";
import { hitungPersetujuanWajib, periksaAturanTransaksi } from "@/lib/aturan";
import { batasiPenulisan, bacaJson, cekKodeAkses, errorResponse, fromError, json } from "@/lib/http";
import { getKontrak, getProyek, getRiwayatKontrak, insertTransaksi, insertPeringatan, hapusTransaksi, hapusPeringatan, tambahLedger } from "@/lib/store";

export const runtime = "nodejs";

function validasi(body: Record<string, unknown>) {
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
  if (body.simpan !== undefined && typeof body.simpan !== "boolean") return "simpan harus boolean.";
  return null;
}

function monthIndex(date: string, start: string, type: string): number {
  if (type.toLowerCase() === "uang_muka") return 0;
  const [year, month] = date.split("-").map(Number);
  const [startYear, startMonth] = start.split("-").map(Number);
  return Math.max(1, (year - startYear) * 12 + month - startMonth + 1);
}

function tahapProyek(type: string, progress: number): string {
  if (type.toLowerCase() === "retensi") return "pemeliharaan";
  if (progress <= 10) return "persiapan";
  if (progress < 90) return "konstruksi";
  return "penyelesaian";
}

export async function POST(request: Request) {
  const started = performance.now();
  const body = await bacaJson(request);
  if (!body) return errorResponse("VALIDASI_GAGAL", "Badan permintaan harus berupa objek JSON.", 400);
  const problem = validasi(body);
  if (problem) return errorResponse("VALIDASI_GAGAL", problem, 400);
  const save = body.simpan === true;
  if (save && !cekKodeAkses(request)) return errorResponse("TIDAK_ADA_AKSES", "Kode akses tidak valid.", 401);
  if (save && !batasiPenulisan(request)) return errorResponse("TERLALU_BANYAK", "Batas permintaan tulis tercapai. Coba lagi sebentar.", 429);

  try {
    const kontrakId = String(body.kontrak_id);
    const contract = await getKontrak(kontrakId);
    if (!contract) return errorResponse("TIDAK_DITEMUKAN", "Kontrak tidak ditemukan di registri.", 404);
    const [contractProject, requestedProject, history] = await Promise.all([
      getProyek(contract.project_id), getProyek(String(body.project_id)), getRiwayatKontrak(kontrakId, String(body.tanggal)),
    ]);
    if (!contractProject) return errorResponse("GALAT_SERVER", "Data proyek untuk kontrak tidak ditemukan.", 500);

    const priorTotal = history.reduce((total, row) => total + Number(row.nilai_pencairan), 0);
    const latestHistory = history[history.length - 1];
    const effectiveContractValue = Number(latestHistory?.nilai_kontrak ?? contract.nilai_kontrak_awal);
    const type = String(body.jenis_pembayaran).toLowerCase();
    const month = monthIndex(String(body.tanggal), contract.tanggal_mulai, type);
    const approvalRequired = hitungPersetujuanWajib(Number(body.nilai_pencairan));
    const providedRecordedHash = typeof body.hash_tercatat === "string" ? body.hash_tercatat : "";
    const providedCurrentHash = typeof body.hash_dokumen_saat_ini === "string" ? body.hash_dokumen_saat_ini : "";
    const recordedHash = providedRecordedHash || providedCurrentHash || "hash-demo";
    const currentHash = providedCurrentHash || recordedHash;
    const input = {
      project_id: String(body.project_id), kontrak_id: kontrakId, tanggal: String(body.tanggal),
      jenis_pembayaran: type, nilai_pencairan: Number(body.nilai_pencairan),
      progres_fisik_pct: Number(body.progres_fisik_pct), milestone_terverifikasi: Boolean(body.milestone_terverifikasi),
      persetujuan_diperoleh: Number(body.persetujuan_diperoleh), persetujuan_wajib: approvalRequired,
      kelengkapan_bukti: Number(body.kelengkapan_bukti), kategori_hijau: String(body.kategori_hijau),
      hash_tercatat: recordedHash, hash_dokumen_saat_ini: currentHash, bulan_ke: month,
    };
    const features = hitungFiturSatuTransaksi(input, history, Number(contract.pagu_alokasi), effectiveContractValue, contract.tanggal_mulai);
    const findings = periksaAturanTransaksi(input, {
      projectIdSah: Boolean(requestedProject), projectIdKontrak: contract.project_id,
      paguAlokasiKontrak: Number(contract.pagu_alokasi), kumulatifCairSebelumnya: priorTotal,
    });
    const modelInfo = ambilInfoModel();
    const score = findings.length === 0 ? hitungSkorIsolationForest(features) : null;
    const scoreFlag = score !== null && score >= modelInfo.ambang;
    const isWarning = findings.length > 0 || scoreFlag;
    const warningKind = findings.length && scoreFlag ? "keduanya" : findings.length ? "aturan" : scoreFlag ? "skor" : null;
    const sortedPriorValues = history.map((row) => Number(row.nilai_pencairan)).sort((a, b) => a - b);
    const medianPrevious = sortedPriorValues.length === 0 ? 0 : sortedPriorValues.length % 2
      ? sortedPriorValues[Math.floor(sortedPriorValues.length / 2)]
      : (sortedPriorValues[sortedPriorValues.length / 2 - 1] + sortedPriorValues[sortedPriorValues.length / 2]) / 2;
    const now = new Date().toISOString();
    let saved: { trx_id: string; peringatan_id: string | null; seq_ledger: number | null } | null = null;

    if (save) {
      const trxId = `TRX-LIVE-${randomUUID()}`;
      const last = latestHistory;
      const row = {
        trx_id: trxId, tanggal: input.tanggal, seri_penerbitan: contractProject.seri_penerbitan,
        akad: contractProject.akad, jenis_pembiayaan: contractProject.jenis_pembiayaan,
        project_id: input.project_id, kontrak_id: kontrakId, kementerian_pelaksana: contractProject.kementerian_pelaksana,
        kategori_hijau: input.kategori_hijau, jenis_pembayaran: type, bulan_ke: month,
        tahap_proyek: tahapProyek(type, input.progres_fisik_pct), nilai_pencairan: input.nilai_pencairan,
        nilai_kontrak: effectiveContractValue, versi_kontrak: Number(last?.versi_kontrak ?? 1),
        status_addendum: last?.status_addendum ?? "tidak_ada", pagu_alokasi_kontrak: Number(contract.pagu_alokasi),
        progres_fisik_pct: input.progres_fisik_pct, milestone_terverifikasi: input.milestone_terverifikasi,
        persetujuan_wajib: approvalRequired, persetujuan_diperoleh: input.persetujuan_diperoleh,
        kelengkapan_bukti: input.kelengkapan_bukti, hash_tercatat: recordedHash, hash_dokumen_saat_ini: currentHash,
        hari_sejak_pencairan_sebelumnya: features.hari_sejak_pencairan_sebelumnya,
        delta_progres_pct: features.delta_progres_pct, kumulatif_cair: priorTotal + input.nilai_pencairan,
        rasio_kumulatif_pagu: features.rasio_kumulatif_pagu,
        rasio_kumulatif_kontrak: features.rasio_kumulatif_kontrak,
        rasio_nilai_terhadap_kontrak: features.rasio_nilai_terhadap_kontrak,
        split: null, label_anomali: null, kelompok_kasus: null, subtipe_kasus: null, sumber: "live",
      };

      let inserted = false;
      let warningId: string | null = null;
      let transactionLedgerAppended = false;
      try {
        await insertTransaksi(row);
        inserted = true;
        let warning = null;
        if (isWarning && warningKind) {
          warning = await insertPeringatan({
            trx_id: trxId, jenis: warningKind, kode_aturan: findings.map((item) => item.kode),
            skor: score, ambang: modelInfo.ambang, versi_model: modelInfo.versi_model, status: "baru", catatan: "",
          });
          warningId = warning.id;
        }

        const transactionPayload = {
          trx_id: trxId, kontrak_id: kontrakId, tanggal: input.tanggal,
          nilai_pencairan: input.nilai_pencairan, hash_tercatat: recordedHash,
          keputusan: isWarning ? "peringatan" : "normal", kode_aturan: findings.map((item) => item.kode),
          skor: score, versi_model: modelInfo.versi_model,
        };
        const txCanonical = kanonikalisasiPayload(transactionPayload);
        const txLedger = await tambahLedger("transaksi", trxId, txCanonical, transactionPayload, hitungHashSha256(txCanonical));
        transactionLedgerAppended = true;
        if (warning && warningId) {
          const alertPayload = {
            peringatan_id: warningId, trx_id: trxId, jenis: warningKind,
            kode_aturan: findings.map((item) => item.kode), skor: score, ambang: modelInfo.ambang,
            versi_model: modelInfo.versi_model,
          };
          const canonical = kanonikalisasiPayload(alertPayload);
          await tambahLedger("peringatan", trxId, canonical, alertPayload, hitungHashSha256(canonical));
        }
        saved = { trx_id: trxId, peringatan_id: warningId, seq_ledger: Number(txLedger.seq) };
      } catch (error) {
        // If the first ledger append did not complete, remove the uncommitted app rows.
        // Ledger rows themselves are append-only and are never deleted here.
        if (inserted && !transactionLedgerAppended) {
          if (warningId) try { await hapusPeringatan(warningId); } catch { /* preserve original failure */ }
          try { await hapusTransaksi(trxId); } catch { /* preserve original failure */ }
        }
        throw error;
      }
    }

    const sevenDayCount = history.filter((row) => {
      const age = Date.parse(`${input.tanggal}T00:00:00Z`) - Date.parse(`${row.tanggal}T00:00:00Z`);
      return age >= 0 && age <= 7 * 86_400_000;
    }).length + 1;
    const averageDelta = history.length
      ? history.reduce((sum, row) => sum + Number(row.delta_progres_pct ?? 0), 0) / history.length
      : 0;
    return json({
      keputusan: isWarning ? "peringatan" : "normal", jenis_peringatan: warningKind,
      temuan_aturan: findings, skor: { nilai: score, ambang: modelInfo.ambang, di_atas_ambang: scoreFlag, versi_model: modelInfo.versi_model },
      fitur: features,
      pembanding: { median_pencairan_sebelumnya: medianPrevious, jumlah_pencairan_7_hari: sevenDayCount, rata_rata_delta_progres: averageDelta },
      tersimpan: saved, waktu_proses_ms: Math.round((performance.now() - started) * 100) / 100,
    });
  } catch (error) {
    return fromError(error);
  }
}

