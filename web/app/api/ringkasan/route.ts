import { ambilInfoModel } from "@/lib/iforest";
import { fromError, json } from "@/lib/http";
import { getCount, getLedger } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [totalTransaksi, totalKontrak, peringatanBaru, ledger] = await Promise.all([
      getCount("transaksi"),
      getCount("registri_kontrak"),
      getCount("peringatan", { field: "status", value: "eq.baru" }),
      getLedger({ batas: 1, terbaru: true }),
    ]);
    return json({
      total_transaksi: totalTransaksi,
      total_kontrak: totalKontrak,
      peringatan_baru: peringatanBaru,
      entri_ledger_terakhir: ledger[0] ?? null,
      model: ambilInfoModel(),
      penanda_data: "Data simulasi",
    });
  } catch (error) { return fromError(error); }
}
