import { errorResponse, fromError, json } from "@/lib/http";
import { listPeringatan } from "@/lib/store";

export const runtime = "nodejs";

const statuses = new Set(["baru", "ditelaah", "perlu_klarifikasi", "diklarifikasi", "ditindaklanjuti", "ditutup"]);
const kinds = new Set(["aturan", "skor", "keduanya"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const halaman = Number(params.get("halaman") ?? 1);
  const perHalaman = Number(params.get("per_halaman") ?? 25);
  const urut = params.get("urut") ?? "waktu";
  const status = params.get("status") ?? undefined;
  const jenis = params.get("jenis") ?? undefined;
  const kontrakId = params.get("kontrak_id") ?? undefined;
  if (!Number.isInteger(halaman) || halaman < 1 || !Number.isInteger(perHalaman) || perHalaman < 1 || perHalaman > 100) {
    return errorResponse("VALIDASI_GAGAL", "halaman harus positif dan per_halaman harus antara 1 sampai 100.", 400);
  }
  if (urut !== "waktu" && urut !== "skor") return errorResponse("VALIDASI_GAGAL", "urut harus bernilai waktu atau skor.", 400);
  if (status && !statuses.has(status)) return errorResponse("VALIDASI_GAGAL", "status peringatan tidak dikenal.", 400);
  if (jenis && !kinds.has(jenis)) return errorResponse("VALIDASI_GAGAL", "jenis peringatan tidak dikenal.", 400);
  try {
    const result = await listPeringatan({ status, jenis, kontrak_id: kontrakId, urut, halaman, per_halaman: perHalaman });
    return json({ total: result.total, halaman, data: result.data.map((row) => ({
      id: row.id, trx_id: row.trx_id, jenis: row.jenis, kode_aturan: row.kode_aturan,
      skor: row.skor, status: row.status, dibuat_pada: row.dibuat_pada,
      kontrak_id: row.transaksi?.kontrak_id ?? null,
    })) });
  } catch (error) { return fromError(error); }
}

