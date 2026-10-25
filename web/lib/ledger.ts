import { createHash } from "node:crypto";

function serialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(serialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`).join(",")}}`;
}

export function kanonikalisasiPayload(payload: Record<string, unknown>): string {
  return serialize(payload);
}

export function hitungHashSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hitungHashEntriLedger(hashSebelumnya: string, payloadKanonik: string) {
  const hashPayload = hitungHashSha256(payloadKanonik);
  return {
    hash_payload: hashPayload,
    hash_saat_ini: hitungHashSha256(`${hashSebelumnya}|${hashPayload}`),
  };
}

export interface EntriLedger {
  seq: number | string;
  payload_kanonik: string;
  hash_payload: string;
  hash_sebelumnya: string;
  hash_saat_ini: string;
}

export function verifikasiRantaiLedger(
  entries: EntriLedger[],
  hashAwal = "GENESIS",
  jumlahSudahDiperiksa = 0,
) {
  let previous = hashAwal;
  const ordered = [...entries].sort((a, b) => Number(a.seq) - Number(b.seq));
  for (const entry of ordered) {
    const seq = Number(entry.seq);
    const calculated = hitungHashEntriLedger(entry.hash_sebelumnya, entry.payload_kanonik);
    if (entry.hash_sebelumnya !== previous) {
      return { valid: false, entri_diperiksa: jumlahSudahDiperiksa + ordered.indexOf(entry), rusak_pada: seq, alasan: `hash_sebelumnya tidak cocok pada seq ${seq}`, hash_terakhir: previous };
    }
    if (calculated.hash_payload !== entry.hash_payload) {
      return { valid: false, entri_diperiksa: jumlahSudahDiperiksa + ordered.indexOf(entry), rusak_pada: seq, alasan: `hash_payload tidak cocok pada seq ${seq}`, hash_terakhir: previous };
    }
    if (calculated.hash_saat_ini !== entry.hash_saat_ini) {
      return { valid: false, entri_diperiksa: jumlahSudahDiperiksa + ordered.indexOf(entry), rusak_pada: seq, alasan: `hash_saat_ini tidak cocok pada seq ${seq}`, hash_terakhir: previous };
    }
    previous = entry.hash_saat_ini;
  }
  return { valid: true, entri_diperiksa: jumlahSudahDiperiksa + ordered.length, rusak_pada: null, hash_terakhir: previous };
}

