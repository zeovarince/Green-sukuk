import { randomUUID } from "node:crypto";
import { kanonikalisasiPayload, hitungHashSha256 } from "@/lib/ledger";
import { batasiPenulisan, bacaJson, errorResponse, json, periksaAkses } from "@/lib/http";
import { getKontrak, getProyek, getRiwayatKontrak, getLedgerUntukTransaksi, getPeringatan, getTransaksi, insertPeringatan, insertTransaksi, hapusPeringatan, hapusTransaksi, tambahLedger, tandaiTransaksiDigantikan, updatePeringatan } from "@/lib/store";
import { bangunBarisTransaksi, evaluasiTransaksi, siapkanInput, susunHasil, validasiPemeriksaan } from "@/lib/periksa";
import type { TransaksiRow } from "@/lib/store";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const KOLOM_PERUBAHAN = [
  "project_id", "tanggal", "jenis_pembayaran", "nilai_pencairan", "progres_fisik_pct",
  "milestone_terverifikasi", "persetujuan_diperoleh", "kelengkapan_bukti", "kategori_hijau",
  "hash_tercatat", "hash_dokumen_saat_ini",
] as const;

function nilaiSama(a: unknown, b: unknown): boolean {
  if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return String(a ?? "") === String(b ?? "");
}

export async function POST(request: Request, context: Context) {
  const started = performance.now();
  const akses = periksaAkses(request, ["penyedia_data"]);
  if (!akses.ok) return akses.response;
  if (!batasiPenulisan(request)) return errorResponse("TERLALU_BANYAK", "Batas permintaan tulis tercapai. Coba lagi sebentar.", 429);
  const body = await bacaJson(request);
  if (!body) return errorResponse("VALIDASI_GAGAL", "Badan permintaan harus berupa objek JSON.", 400);
  if (typeof body.alasan !== "string" || body.alasan.trim().length < 8) return errorResponse("VALIDASI_GAGAL", "alasan wajib diisi minimal 8 karakter.", 400);
  if (body.alasan.length > 2000) return errorResponse("VALIDASI_GAGAL", "alasan maksimum 2.000 karakter.", 400);
  if (typeof body.diajukan_oleh !== "string" || body.diajukan_oleh.trim().length < 3 || body.diajukan_oleh.trim().length > 80) {
    return errorResponse("VALIDASI_GAGAL", "diajukan_oleh wajib diisi 3 sampai 80 karakter.", 400);
  }
  if (!body.perubahan || typeof body.perubahan !== "object" || Array.isArray(body.perubahan)) {
    return errorResponse("VALIDASI_GAGAL", "perubahan harus berupa objek berisi kolom yang dikoreksi.", 400);
  }
  const perubahan = body.perubahan as Record<string, unknown>;
  const kunci = Object.keys(perubahan);
  const kunciAsing = kunci.filter((key) => !(KOLOM_PERUBAHAN as readonly string[]).includes(key));
  if (kunciAsing.length) return errorResponse("VALIDASI_GAGAL", `Kolom tidak boleh dikoreksi: ${kunciAsing.join(", ")}.`, 400);
  if (kunci.length === 0) return errorResponse("VALIDASI_GAGAL", "Isi sedikitnya satu kolom yang dikoreksi.", 400);

  const { id } = await context.params;
  let langkah = "memuat peringatan dan transaksi lama";
  let newTxInserted = false;
  let newWarningId: string | null = null;
  let transactionLedgerAppended = false;
  let newTrxId = "";
  try {
    const alert = await getPeringatan(id);
    if (!alert) return errorResponse("TIDAK_DITEMUKAN", "Peringatan tidak ditemukan.", 404);
    if (alert.status !== "perlu_klarifikasi") {
      return errorResponse("STATUS_TIDAK_SESUAI", `Koreksi hanya untuk peringatan berstatus perlu_klarifikasi. Status saat ini ${alert.status}.`, 409);
    }
    const old = await getTransaksi(alert.trx_id);
    if (!old) return errorResponse("GALAT_SERVER", "Transaksi lama untuk peringatan ini tidak ditemukan.", 500);
    if (old.digantikan_oleh) {
      return errorResponse("STATUS_TIDAK_SESUAI", "Transaksi ini sudah dikoreksi. Muat ulang halaman untuk melihat transaksi pengganti.", 409);
    }

    const kunciBerubah = kunci.filter((key) => !nilaiSama(perubahan[key], old[key as keyof TransaksiRow]));
    if (kunciBerubah.length === 0) return errorResponse("VALIDASI_GAGAL", "Tidak ada nilai yang berbeda dari transaksi lama. Ubah sedikitnya satu kolom.", 400);
    const perubahanEfektif: Record<string, unknown> = {};
    for (const key of kunciBerubah) perubahanEfektif[key] = perubahan[key];

    const merged: Record<string, unknown> = { ...old, ...perubahanEfektif, kontrak_id: old.kontrak_id };
    const problem = validasiPemeriksaan(merged);
    if (problem) return errorResponse("VALIDASI_GAGAL", problem, 400);

    const kontrakId = String(old.kontrak_id);
    const contract = await getKontrak(kontrakId);
    if (!contract) return errorResponse("TIDAK_DITEMUKAN", "Kontrak tidak ditemukan di registri.", 404);
    const [contractProject, requestedProject, oldEntries] = await Promise.all([
      getProyek(contract.project_id), getProyek(String(merged.project_id)), getLedgerUntukTransaksi(String(old.trx_id)),
    ]);
    if (!contractProject) return errorResponse("GALAT_SERVER", "Data proyek untuk kontrak tidak ditemukan.", 500);
    const oldTransactionLedger = oldEntries.find((entry) => entry.jenis_entri === "transaksi");
    if (!oldTransactionLedger) return errorResponse("GALAT_SERVER", "Entri ledger transaksi lama tidak ditemukan.", 500);

    const { input, approvalRequired } = siapkanInput(merged, contract);
    langkah = "memuat riwayat kontrak tanpa transaksi lama";
    const history = await getRiwayatKontrak(kontrakId, input.tanggal, { kecualiTrxId: String(old.trx_id) });
    const evaluation = evaluasiTransaksi(input, { contract, contractProject, requestedProject, history });

    newTrxId = `TRX-LIVE-${randomUUID()}`;
    const row = bangunBarisTransaksi({
      input, contract, contractProject, features: evaluation.features, approvalRequired,
      priorTotal: evaluation.priorTotal, trxId: newTrxId, sumber: "koreksi",
      nilaiKontrak: Number(old.nilai_kontrak ?? evaluation.nilaiKontrakEfektif),
      versiKontrak: Number(old.versi_kontrak ?? 1),
      statusAddendum: String(old.status_addendum ?? "tidak_ada"),
      koreksiDari: String(old.trx_id),
    });

    langkah = "menyimpan transaksi baru";
    await insertTransaksi(row);
    newTxInserted = true;
    let warning = null;
    if (evaluation.keputusan === "peringatan" && evaluation.jenisPeringatan) {
      langkah = "membuat peringatan baru";
      warning = await insertPeringatan({
        trx_id: newTrxId, jenis: evaluation.jenisPeringatan, kode_aturan: evaluation.findings.map((item) => item.kode),
        skor: evaluation.skor, ambang: evaluation.ambang, versi_model: evaluation.versiModel, status: "baru", catatan: "",
      });
      newWarningId = warning.id;
    }

    const transactionPayload = {
      trx_id: newTrxId, kontrak_id: kontrakId, tanggal: input.tanggal,
      nilai_pencairan: input.nilai_pencairan, hash_tercatat: input.hash_tercatat,
      keputusan: evaluation.keputusan, kode_aturan: evaluation.findings.map((item) => item.kode),
      skor: evaluation.skor, versi_model: evaluation.versiModel,
      sumber: "koreksi", koreksi_dari: String(old.trx_id),
      diajukan_oleh: body.diajukan_oleh.trim(), peran: akses.peran,
    };
    langkah = "mencatat transaksi baru ke ledger";
    const txCanonical = kanonikalisasiPayload(transactionPayload);
    const txLedger = await tambahLedger("transaksi", newTrxId, txCanonical, transactionPayload, hitungHashSha256(txCanonical));
    transactionLedgerAppended = true;

    let warningSeq: number | null = null;
    if (warning && newWarningId) {
      langkah = "mencatat peringatan baru ke ledger";
      const alertPayload = {
        peringatan_id: newWarningId, trx_id: newTrxId, jenis: evaluation.jenisPeringatan,
        kode_aturan: evaluation.findings.map((item) => item.kode), skor: evaluation.skor, ambang: evaluation.ambang,
        versi_model: evaluation.versiModel,
      };
      const canonical = kanonikalisasiPayload(alertPayload);
      const alertLedger = await tambahLedger("peringatan", newTrxId, canonical, alertPayload, hitungHashSha256(canonical));
      warningSeq = Number(alertLedger.seq);
    }

    langkah = "menandai transaksi lama";
    await tandaiTransaksiDigantikan(String(old.trx_id), newTrxId);

    const koreksiPayload = {
      seq_dikoreksi: Number(oldTransactionLedger.seq),
      trx_id_lama: String(old.trx_id), trx_id_baru: newTrxId,
      alasan: body.alasan.trim(), diajukan_oleh: body.diajukan_oleh.trim(), perubahan: perubahanEfektif,
      hasil_baru: {
        keputusan: evaluation.keputusan, kode_aturan: evaluation.findings.map((item) => item.kode),
        skor: evaluation.skor, jenis_peringatan: evaluation.jenisPeringatan,
      },
      peran: akses.peran,
    };
    langkah = "mencatat koreksi ke ledger";
    const koreksiCanonical = kanonikalisasiPayload(koreksiPayload);
    const koreksiLedger = await tambahLedger("koreksi", newTrxId, koreksiCanonical, koreksiPayload, hitungHashSha256(koreksiCanonical));

    const now = new Date().toISOString();
    langkah = "memperbarui status peringatan lama";
    const updated = await updatePeringatan(alert.id, { status: "diklarifikasi", catatan: body.alasan.trim(), diperbarui_pada: now });
    if (!updated) throw new Error("Peringatan lama tidak dapat diperbarui.");
    const statusEvent = {
      peringatan_id: alert.id, status_lama: alert.status, status_baru: "diklarifikasi",
      catatan: body.alasan.trim(), waktu: updated.diperbarui_pada,
      peran: akses.peran, jenis_catatan: "perubahan_status",
    };
    langkah = "mencatat status ke ledger";
    const statusCanonical = kanonikalisasiPayload(statusEvent);
    try {
      const statusLedger = await tambahLedger("status", alert.trx_id, statusCanonical, statusEvent, hitungHashSha256(statusCanonical));
      return json({
        trx_id_baru: newTrxId,
        hasil: susunHasil({ evaluation, input, saved: { trx_id: newTrxId, peringatan_id: newWarningId, seq_ledger: Number(txLedger.seq) }, started }),
        peringatan_lama: { id: alert.id, status: "diklarifikasi" },
        peringatan_baru: newWarningId ? { id: newWarningId } : null,
        seq_ledger: [Number(txLedger.seq), ...(warningSeq === null ? [] : [warningSeq]), Number(koreksiLedger.seq), Number(statusLedger.seq)],
      });
    } catch (error) {
      try { await updatePeringatan(alert.id, { status: alert.status, catatan: alert.catatan, diperbarui_pada: alert.diperbarui_pada }); } catch { /* report ledger failure */ }
      throw error;
    }
  } catch (error) {
    if (newTxInserted && !transactionLedgerAppended) {
      if (newWarningId) try { await hapusPeringatan(newWarningId); } catch { /* preserve original failure */ }
      try { await hapusTransaksi(newTrxId); } catch { /* preserve original failure */ }
    }
    const status = error && typeof error === "object" && "status" in error ? Number((error as { status?: number }).status) : 500;
    if (status === 409) return errorResponse("KONFLIK_LEDGER", `Penambahan ledger gagal pada langkah ${langkah}. Coba lagi.`, 409);
    return errorResponse("GALAT_SERVER", `Koreksi gagal pada langkah ${langkah}. Langkah yang sudah selesai tidak dihapus.`, 500);
  }
}
