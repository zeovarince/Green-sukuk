import { kanonikalisasiPayload, hitungHashSha256 } from "@/lib/ledger";
import { ambangBukti } from "@/lib/aturan";
import { PERAN_LABEL, bolehTransisi, transisiSah, type Peran } from "@/lib/akses";
import { KonfigurasiAksesError, batasiPenulisan, bacaJson, errorResponse, fromError, json, periksaAkses, peranDariPermintaan } from "@/lib/http";
import { getPeringatan, getTransaksi, getRiwayatKontrak, getLedgerUntukTransaksi, updatePeringatan, tambahLedger } from "@/lib/store";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  let peran: Peran | null = null;
  try {
    peran = peranDariPermintaan(request);
  } catch (error) {
    if (error instanceof KonfigurasiAksesError) return errorResponse("GALAT_SERVER", error.message, 500);
    throw error;
  }
  try {
    const alert = await getPeringatan(id);
    if (!alert) return errorResponse("TIDAK_DITEMUKAN", "Peringatan tidak ditemukan.", 404);
    const transaction = await getTransaksi(alert.trx_id);
    if (!transaction) return errorResponse("GALAT_SERVER", "Transaksi terkait peringatan tidak ditemukan.", 500);
    const [history, ledgerHistory] = await Promise.all([
      getRiwayatKontrak(String(transaction.kontrak_id), String(transaction.tanggal)),
      getLedgerUntukTransaksi(String(transaction.trx_id)),
    ]);
    const sorted = history.map((row) => Number(row.nilai_pencairan)).sort((a, b) => a - b);
    const median = sorted.length === 0 ? 0 : sorted.length % 2
      ? sorted[Math.floor(sorted.length / 2)]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const sevenDay = history.filter((row) => {
      const age = Date.parse(`${transaction.tanggal}T00:00:00Z`) - Date.parse(`${row.tanggal}T00:00:00Z`);
      return age >= 0 && age <= 7 * 86_400_000;
    }).length;
    return json({
      ...alert, transaksi: transaction, temuan_aturan: alert.kode_aturan,
      peran,
      bukti: {
        hash_tercatat: String(transaction.hash_tercatat ?? ""),
        hash_dokumen_saat_ini: String(transaction.hash_dokumen_saat_ini ?? ""),
        hash_cocok: String(transaction.hash_tercatat ?? "") === String(transaction.hash_dokumen_saat_ini ?? ""),
        kelengkapan_bukti: Number(transaction.kelengkapan_bukti ?? 0),
        ambang_bukti: ambangBukti(),
        dokumen_asli_tersedia: false,
      },
      riwayat_status: ledgerHistory
        .filter((entry) => entry.jenis_entri === "status" || entry.jenis_entri === "koreksi")
        .map((entry) => ({ seq: entry.seq, jenis: entry.jenis_entri, ...entry.payload })),
      pembanding: { median_pencairan_sebelumnya: median, jumlah_pencairan_7_hari: sevenDay,
        rata_rata_delta_progres: history.length ? history.reduce((s, row) => s + Number(row.delta_progres_pct ?? 0), 0) / history.length : 0 },
    });
  } catch (error) { return fromError(error); }
}

export async function PATCH(request: Request, context: Context) {
  const akses = periksaAkses(request);
  if (!akses.ok) return akses.response;
  if (!batasiPenulisan(request)) return errorResponse("TERLALU_BANYAK", "Batas permintaan tulis tercapai. Coba lagi sebentar.", 429);
  const body = await bacaJson(request);
  if (!body || typeof body.status !== "string" || (body.catatan !== undefined && typeof body.catatan !== "string")) {
    return errorResponse("VALIDASI_GAGAL", "status wajib berupa teks dan catatan harus berupa teks.", 400);
  }
  if (body.catatan !== undefined && String(body.catatan).length > 2000) return errorResponse("VALIDASI_GAGAL", "catatan maksimum 2.000 karakter.", 400);
  const { id } = await context.params;
  try {
    const current = await getPeringatan(id);
    if (!current) return errorResponse("TIDAK_DITEMUKAN", "Peringatan tidak ditemukan.", 404);
    if (!transisiSah(current.status, String(body.status))) {
      return errorResponse("VALIDASI_GAGAL", `Perpindahan status ${current.status} ke ${body.status} tidak diizinkan.`, 400);
    }
    if (!bolehTransisi(akses.peran, current.status, String(body.status))) {
      return errorResponse("PERAN_TIDAK_SESUAI", `Peran ${PERAN_LABEL[akses.peran]} tidak berwenang memindahkan status ${current.status} ke ${body.status}.`, 403);
    }
    if (["perlu_klarifikasi", "diklarifikasi", "ditindaklanjuti", "ditutup"].includes(String(body.status)) && (typeof body.catatan !== "string" || body.catatan.trim().length < 8)) {
      return errorResponse("VALIDASI_GAGAL", "Catatan tindak lanjut wajib diisi minimal 8 karakter untuk keputusan ini.", 400);
    }
    const newNote = body.catatan === undefined ? current.catatan : String(body.catatan);
    const updated = await updatePeringatan(id, { status: body.status, catatan: newNote, diperbarui_pada: new Date().toISOString() });
    if (!updated) return errorResponse("TIDAK_DITEMUKAN", "Peringatan tidak ditemukan.", 404);
    const event = {
      peringatan_id: id, status_lama: current.status, status_baru: String(body.status), catatan: newNote,
      waktu: updated.diperbarui_pada, peran: akses.peran, jenis_catatan: "perubahan_status",
    };
    const canonical = kanonikalisasiPayload(event);
    try {
      await tambahLedger("status", current.trx_id, canonical, event, hitungHashSha256(canonical));
    } catch (error) {
      try { await updatePeringatan(id, { status: current.status, catatan: current.catatan, diperbarui_pada: current.diperbarui_pada }); } catch { /* report ledger failure */ }
      throw error;
    }
    return json({ ...updated, peran: akses.peran });
  } catch (error) { return fromError(error); }
}
