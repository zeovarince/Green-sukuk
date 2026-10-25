export function formatRupiah(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0)}`;
}

export function formatRingkas(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "Rp0";
  if (amount >= 1_000_000_000_000) return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(amount / 1_000_000_000_000)} triliun`;
  if (amount >= 1_000_000_000) return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(amount / 1_000_000_000)} miliar`;
  if (amount >= 1_000_000) return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(amount / 1_000_000)} juta`;
  return formatRupiah(amount);
}

export function formatTanggal(value: string | null | undefined): string {
  if (!value) return "Tanggal tidak tersedia";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function formatAngka(value: number | string | null | undefined, digit = 2): string {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: digit }).format(Number.isFinite(number) ? number : 0);
}

export function pendekkanHash(value: string, size = 8): string {
  if (value.length <= size * 2) return value;
  return `${value.slice(0, size)}…${value.slice(-size)}`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as ({ galat?: { pesan?: string } } & T) | null;
  if (!response.ok) throw new Error(body?.galat?.pesan ?? "Permintaan gagal. Periksa koneksi dan coba lagi.");
  return body as T;
}

