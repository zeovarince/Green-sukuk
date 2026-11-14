import { timingSafeEqual } from "node:crypto";
import type { Peran } from "./akses";
import { StoreError } from "./store";

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export function errorResponse(code: string, message: string, status: number): Response {
  return json({ galat: { kode: code, pesan: message } }, status);
}

export function fromError(error: unknown): Response {
  if (error instanceof StoreError) {
    const code = error.status === 409 ? "KONFLIK_LEDGER" : "GALAT_SERVER";
    return errorResponse(code, error.message, error.status === 409 ? 409 : 500);
  }
  return errorResponse("GALAT_SERVER", "Terjadi kesalahan saat memproses permintaan.", 500);
}

export async function bacaJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export class KonfigurasiAksesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KonfigurasiAksesError";
  }
}

const KODE_PERAN: Array<{ peran: Exclude<Peran, "umum" | "penyedia_data">; env: string }> = [
  { peran: "auditor", env: "KODE_AKSES_AUDITOR" },
  { peran: "pejabat_berwenang", env: "KODE_AKSES_PEJABAT" },
  { peran: "otoritas_syariah", env: "KODE_AKSES_SYARIAH" },
];

export function modeAkses(): "satu_kode" | "peran" {
  const terisi = KODE_PERAN.filter(({ env }) => Boolean(process.env[env]?.trim()));
  if (terisi.length === 0) return "satu_kode";
  if (terisi.length === KODE_PERAN.length) return "peran";
  const kosong = KODE_PERAN.filter(({ env }) => !process.env[env]?.trim()).map(({ env }) => env);
  throw new KonfigurasiAksesError(`Konfigurasi kode akses peran tidak lengkap. Isi KODE_AKSES_AUDITOR, KODE_AKSES_PEJABAT, dan KODE_AKSES_SYARIAH sekaligus, atau kosongkan ketiganya. Belum diisi: ${kosong.join(", ")}.`);
}

export function pastikanKonfigurasiAkses(): void {
  modeAkses();
}

function samaAman(expected: string | undefined, provided: string): boolean {
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function peranDariPermintaan(request: Request): Peran | null {
  const mode = modeAkses();
  const provided = request.headers.get("x-kode-akses") ?? "";
  if (!provided) return null;
  if (mode === "satu_kode") return samaAman(process.env.DEMO_PASSCODE, provided) ? "umum" : null;
  if (samaAman(process.env.DEMO_PASSCODE, provided)) return "penyedia_data";
  for (const { peran, env } of KODE_PERAN) if (samaAman(process.env[env], provided)) return peran;
  return null;
}

export type HasilAkses = { ok: true; peran: Peran } | { ok: false; response: Response };

export function periksaAkses(request: Request, izin: readonly Peran[] = []): HasilAkses {
  let peran: Peran | null;
  try {
    peran = peranDariPermintaan(request);
  } catch (error) {
    if (error instanceof KonfigurasiAksesError) return { ok: false, response: errorResponse("GALAT_SERVER", error.message, 500) };
    throw error;
  }
  if (!peran) return { ok: false, response: errorResponse("TIDAK_ADA_AKSES", "Kode akses tidak valid.", 401) };
  if (izin.length > 0 && peran !== "umum" && !izin.includes(peran)) {
    return { ok: false, response: errorResponse("PERAN_TIDAK_SESUAI", "Peran kode akses ini tidak berwenang untuk tindakan tersebut.", 403) };
  }
  return { ok: true, peran };
}

type RateEntry = { start: number; count: number };
const globalRate = globalThis as typeof globalThis & { __gstpWriteRates?: Map<string, RateEntry> };
const writeRates = globalRate.__gstpWriteRates ??= new Map<string, RateEntry>();

export function batasiPenulisan(request: Request, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const address = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (writeRates.size > 4096) {
    for (const [key, value] of writeRates) if (now - value.start >= windowMs) writeRates.delete(key);
    if (writeRates.size > 4096 && !writeRates.has(address)) return false;
  }
  const current = writeRates.get(address);
  if (!current || now - current.start >= windowMs) {
    writeRates.set(address, { start: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
