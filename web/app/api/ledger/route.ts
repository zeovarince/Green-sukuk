import { errorResponse, fromError, json } from "@/lib/http";
import { getLedger } from "@/lib/store";

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
  const limit = positiveInteger(params.get("batas"));
  const urut = params.get("urut") ?? "lama";
  if (urut !== "lama" && urut !== "terbaru") return errorResponse("VALIDASI_GAGAL", "urut harus lama atau terbaru.", 400);
  if (from === null || to === null || limit === null || (limit !== undefined && limit > 200)) return errorResponse("VALIDASI_GAGAL", "dari_seq dan sampai_seq harus positif; batas maksimum 200.", 400);
  if (from !== undefined && to !== undefined && from > to) return errorResponse("VALIDASI_GAGAL", "dari_seq tidak boleh lebih besar dari sampai_seq.", 400);
  try {
    const data = await getLedger({ dariSeq: from, sampaiSeq: to, batas: limit ?? 50, terbaru: urut === "terbaru" });
    return json({ data });
  } catch (error) { return fromError(error); }
}

