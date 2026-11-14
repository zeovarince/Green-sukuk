import { kanonikalisasiPayload, hitungHashSha256 } from "@/lib/ledger";
import { batasiPenulisan, bacaJson, errorResponse, fromError, json, periksaAkses } from "@/lib/http";
import { getPeringatan, tambahLedger } from "@/lib/store";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const PUTUSAN_SAH = ["sesuai", "tidak_sesuai", "perlu_dokumen"] as const;

export async function POST(request: Request, context: Context) {
  const akses = periksaAkses(request, ["otoritas_syariah"]);
  if (!akses.ok) return akses.response;

  if (!batasiPenulisan(request)) {
    return errorResponse("TERLALU_BANYAK", "Batas permintaan tulis tercapai. Coba lagi sebentar.", 429);
  }

  const body = await bacaJson(request);
  if (!body) {
    return errorResponse("VALIDASI_GAGAL", "Badan permintaan harus berupa objek JSON.", 400);
  }

  if (typeof body.putusan !== "string" || !PUTUSAN_SAH.includes(body.putusan as (typeof PUTUSAN_SAH)[number])) {
    return errorResponse(
      "VALIDASI_GAGAL",
      'putusan wajib salah satu dari: "sesuai", "tidak_sesuai", "perlu_dokumen".',
      400,
    );
  }

  if (typeof body.catatan !== "string" || body.catatan.trim().length < 8) {
    return errorResponse("VALIDASI_GAGAL", "Catatan telaah syariah wajib diisi minimal 8 karakter.", 400);
  }

  const { id } = await context.params;

  try {
    const alert = await getPeringatan(id);
    if (!alert) return errorResponse("TIDAK_DITEMUKAN", "Peringatan tidak ditemukan.", 404);

    const hasR08 = Array.isArray(alert.kode_aturan) && alert.kode_aturan.includes("R08_AKAD");
    if (!hasR08) {
      return errorResponse(
        "VALIDASI_GAGAL",
        "Hanya peringatan dengan temuan aturan R08_AKAD yang dapat menerima telaah syariah.",
        400,
      );
    }

    const waktu = new Date().toISOString();
    const event = {
      peringatan_id: id,
      trx_id: alert.trx_id,
      jenis_catatan: "telaah_syariah",
      putusan: body.putusan,
      catatan: body.catatan.trim(),
      peran: akses.peran,
      waktu,
    };

    const canonical = kanonikalisasiPayload(event);
    const ledger = await tambahLedger("status", alert.trx_id, canonical, event, hitungHashSha256(canonical));

    return json({
      sukses: true,
      seq_ledger: Number(ledger.seq),
      ...event,
    });
  } catch (error) {
    return fromError(error);
  }
}

