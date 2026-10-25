import { errorResponse, fromError, json } from "@/lib/http";
import { getKontrak, getProyek, getRiwayatKontrak } from "@/lib/store";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  try {
    const contract = await getKontrak(id);
    if (!contract) return errorResponse("TIDAK_DITEMUKAN", "Kontrak tidak ditemukan.", 404);
    const [project, transactions] = await Promise.all([getProyek(contract.project_id), getRiwayatKontrak(id)]);
    return json({ kontrak: contract, proyek: project, riwayat: transactions.map((row) => ({
      trx_id: row.trx_id, tanggal: row.tanggal, jenis_pembayaran: row.jenis_pembayaran,
      nilai_pencairan: row.nilai_pencairan, progres_fisik_pct: row.progres_fisik_pct,
      kumulatif_cair: row.kumulatif_cair, status_addendum: row.status_addendum,
    })) });
  } catch (error) { return fromError(error); }
}

