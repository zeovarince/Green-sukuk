import { randomUUID } from "node:crypto";
import { kanonikalisasiPayload, hitungHashSha256 } from "@/lib/ledger";
import { batasiPenulisan, bacaJson, errorResponse, fromError, json, periksaAkses } from "@/lib/http";
import { getKontrak, getProyek, getRiwayatKontrak, insertTransaksi, insertPeringatan, hapusTransaksi, hapusPeringatan, tambahLedger } from "@/lib/store";
import { bangunBarisTransaksi, evaluasiTransaksi, siapkanInput, susunHasil, validasiPemeriksaan, validasiPengusulVerifikator } from "@/lib/periksa";
import type { Peran } from "@/lib/akses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const started = performance.now();
  const body = await bacaJson(request);
  if (!body) return errorResponse("VALIDASI_GAGAL", "Badan permintaan harus berupa objek JSON.", 400);
  const problem = validasiPemeriksaan(body);
  if (problem) return errorResponse("VALIDASI_GAGAL", problem, 400);
  const save = body.simpan === true;
  let peran: Peran | null = null;
  let pengusul = "";
  let verifikator = "";
  if (save) {
    const akses = periksaAkses(request, ["penyedia_data"]);
    if (!akses.ok) return akses.response;
    peran = akses.peran;
    const peopleProblem = validasiPengusulVerifikator(body);
    if (peopleProblem) return errorResponse("VALIDASI_GAGAL", peopleProblem, 400);
    pengusul = String(body.pengusul).trim();
    verifikator = String(body.verifikator).trim();
    if (!batasiPenulisan(request)) return errorResponse("TERLALU_BANYAK", "Batas permintaan tulis tercapai. Coba lagi sebentar.", 429);
  }

  try {
    const kontrakId = String(body.kontrak_id);
    const contract = await getKontrak(kontrakId);
    if (!contract) return errorResponse("TIDAK_DITEMUKAN", "Kontrak tidak ditemukan di registri.", 404);
    const [contractProject, requestedProject, history] = await Promise.all([
      getProyek(contract.project_id), getProyek(String(body.project_id)), getRiwayatKontrak(kontrakId, String(body.tanggal)),
    ]);
    if (!contractProject) return errorResponse("GALAT_SERVER", "Data proyek untuk kontrak tidak ditemukan.", 500);

    const { input, approvalRequired } = siapkanInput(body, contract);
    const evaluation = evaluasiTransaksi(input, { contract, contractProject, requestedProject, history });
    let saved: { trx_id: string; peringatan_id: string | null; seq_ledger: number | null } | null = null;

    if (save) {
      const trxId = `TRX-LIVE-${randomUUID()}`;
      const last = history[history.length - 1];
      const row = bangunBarisTransaksi({
        input, contract, contractProject, features: evaluation.features, approvalRequired,
        priorTotal: evaluation.priorTotal, trxId, sumber: "live",
        nilaiKontrak: evaluation.nilaiKontrakEfektif,
        versiKontrak: Number(last?.versi_kontrak ?? 1),
        statusAddendum: String(last?.status_addendum ?? "tidak_ada"),
      });

      let inserted = false;
      let warningId: string | null = null;
      let transactionLedgerAppended = false;
      try {
        await insertTransaksi(row);
        inserted = true;
        let warning = null;
        if (evaluation.keputusan === "peringatan" && evaluation.jenisPeringatan) {
          warning = await insertPeringatan({
            trx_id: trxId, jenis: evaluation.jenisPeringatan, kode_aturan: evaluation.findings.map((item) => item.kode),
            skor: evaluation.skor, ambang: evaluation.ambang, versi_model: evaluation.versiModel, status: "baru", catatan: "",
          });
          warningId = warning.id;
        }

        const transactionPayload = {
          trx_id: trxId, kontrak_id: kontrakId, tanggal: input.tanggal,
          nilai_pencairan: input.nilai_pencairan, hash_tercatat: input.hash_tercatat,
          keputusan: evaluation.keputusan, kode_aturan: evaluation.findings.map((item) => item.kode),
          skor: evaluation.skor, versi_model: evaluation.versiModel,
          pengusul, verifikator, peran,
        };
        const txCanonical = kanonikalisasiPayload(transactionPayload);
        const txLedger = await tambahLedger("transaksi", trxId, txCanonical, transactionPayload, hitungHashSha256(txCanonical));
        transactionLedgerAppended = true;
        if (warning && warningId) {
          const alertPayload = {
            peringatan_id: warningId, trx_id: trxId, jenis: evaluation.jenisPeringatan,
            kode_aturan: evaluation.findings.map((item) => item.kode), skor: evaluation.skor, ambang: evaluation.ambang,
            versi_model: evaluation.versiModel,
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

    return json(susunHasil({ evaluation, input, saved, started }));
  } catch (error) {
    return fromError(error);
  }
}
