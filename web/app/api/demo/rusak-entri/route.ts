import { batasiPenulisan, bacaJson, cekKodeAkses, errorResponse, fromError, json } from "@/lib/http";
import { deleteDemoBackup, getDemoBackup, getRows, saveDemoBackup, updateLedgerPayload, type LedgerRow } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.DEMO_MODE !== "true") return errorResponse("TIDAK_DITEMUKAN", "Route tidak ditemukan.", 404);
  if (!cekKodeAkses(request)) return errorResponse("TIDAK_ADA_AKSES", "Kode akses tidak valid.", 401);
  if (!batasiPenulisan(request, 5)) return errorResponse("TERLALU_BANYAK", "Batas permintaan tulis tercapai. Coba lagi sebentar.", 429);
  const body = await bacaJson(request);
  if (!body || !Number.isSafeInteger(body.seq) || Number(body.seq) < 1) return errorResponse("VALIDASI_GAGAL", "seq harus bilangan bulat positif.", 400);
  const seq = Number(body.seq);
  try {
    const activeBackups = await getRows<{ seq: number }>("demo_pemulihan", { select: "seq", limit: 1 });
    if (activeBackups.length) return errorResponse("KONFLIK_LEDGER", "Pulihkan entri demo yang aktif sebelum merusak entri lain.", 409);
    if (await getDemoBackup(seq)) return errorResponse("KONFLIK_LEDGER", "Entri ini sudah dirusak dan menunggu pemulihan.", 409);
    const [entry] = await getRows<LedgerRow>("ledger_entri", { select: "*", seq: `eq.${seq}`, limit: 1 });
    if (!entry) return errorResponse("TIDAK_DITEMUKAN", "Entri ledger tidak ditemukan.", 404);
    await saveDemoBackup({ seq, payload_kanonik: entry.payload_kanonik });
    try {
      await updateLedgerPayload(seq, `${entry.payload_kanonik} `);
    } catch (error) {
      try { await deleteDemoBackup(seq); } catch { /* preserve original failure */ }
      throw error;
    }
    return json({ rusak: true, seq });
  } catch (error) { return fromError(error); }
}

