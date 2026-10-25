import { batasiPenulisan, cekKodeAkses, errorResponse, fromError, json } from "@/lib/http";
import { deleteDemoBackup, getDemoBackup, getRows, updateLedgerPayload } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.DEMO_MODE !== "true") return errorResponse("TIDAK_DITEMUKAN", "Route tidak ditemukan.", 404);
  if (!cekKodeAkses(request)) return errorResponse("TIDAK_ADA_AKSES", "Kode akses tidak valid.", 401);
  if (!batasiPenulisan(request, 5)) return errorResponse("TERLALU_BANYAK", "Batas permintaan tulis tercapai. Coba lagi sebentar.", 429);
  try {
    // The saved backup is keyed by seq. A single active damage is allowed so recovery is unambiguous.
    const backups = await getRows<{ seq: number }>("demo_pemulihan", { select: "seq", order: "seq.asc", limit: 2 });
    if (backups.length !== 1) return errorResponse("TIDAK_DITEMUKAN", "Tidak ada satu entri demo yang menunggu pemulihan.", 404);
    const backup = await getDemoBackup(Number(backups[0].seq));
    if (!backup) return errorResponse("TIDAK_DITEMUKAN", "Cadangan entri demo tidak ditemukan.", 404);
    const updated = await updateLedgerPayload(backup.seq, backup.payload_kanonik);
    if (!updated) return errorResponse("TIDAK_DITEMUKAN", "Entri ledger tidak ditemukan.", 404);
    await deleteDemoBackup(backup.seq);
    return json({ dipulihkan: true, seq: backup.seq });
  } catch (error) { return fromError(error); }
}

