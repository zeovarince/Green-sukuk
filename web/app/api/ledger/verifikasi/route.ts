import { errorResponse, fromError, json } from "@/lib/http";
import { verifikasiRantaiLedger } from "@/lib/ledger";
import { bacaSemuaLedger, getRows, type LedgerRow } from "@/lib/store";

export const runtime = "nodejs";

function positiveInteger(value: string | null): number | undefined | null {
  if (value === null) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = positiveInteger(params.get("dari_seq"));
  const to = positiveInteger(params.get("sampai_seq"));
  if (from === null || to === null || (from !== undefined && to !== undefined && from > to)) return errorResponse("VALIDASI_GAGAL", "Rentang seq tidak valid.", 400);
  try {
    const entries = await bacaSemuaLedger(from, to);
    let previousHash = "GENESIS";
    let checkedBefore = 0;
    if (from !== undefined && from > 1) {
      const previous = await getRows<LedgerRow>("ledger_entri", { select: "seq,hash_saat_ini", seq: `lt.${from}`, order: "seq.desc", limit: 1 });
      if (previous[0]) {
        previousHash = previous[0].hash_saat_ini;
        checkedBefore = 0;
      }
    }
    const result = verifikasiRantaiLedger(entries, previousHash, checkedBefore);
    return json(result);
  } catch (error) { return fromError(error); }
}

