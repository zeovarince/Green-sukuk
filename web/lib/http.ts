import { timingSafeEqual } from "node:crypto";
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

export function cekKodeAkses(request: Request): boolean {
  const expected = process.env.DEMO_PASSCODE;
  const provided = request.headers.get("x-kode-akses") ?? "";
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
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

