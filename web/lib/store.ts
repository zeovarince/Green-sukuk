import "server-only";

const PAGE_SIZE = 1000;

export class StoreError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "StoreError";
  }
}

function getConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StoreError("Konfigurasi Supabase server belum lengkap.", 500);
  return { base: `${url.replace(/\/$/, "")}/rest/v1`, key };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<{ data: T; response: Response }> {
  const { base, key } = getConfig();
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        apikey: key,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new StoreError("Tidak dapat menghubungi Supabase.", 502);
  }
  const bodyText = await response.text();
  let body: unknown = null;
  if (bodyText) {
    try { body = JSON.parse(bodyText); } catch { body = bodyText; }
  }
  if (!response.ok) {
    const error = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const status = response.status === 409 ? 409 : response.status >= 500 ? 502 : response.status;
    throw new StoreError("Permintaan database gagal.", status, String(error.code ?? ""));
  }
  return { data: body as T, response };
}

function queryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export async function getRows<T>(table: string, params: Record<string, string | number | undefined> = {}): Promise<T[]> {
  const { data } = await request<T[]>(`/${table}${queryString(params)}`);
  return data ?? [];
}

export async function insertRow<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const { data } = await request<T[]>(`/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!Array.isArray(data) || !data[0]) throw new StoreError("Database tidak mengembalikan baris baru.", 502);
  return data[0];
}

export async function patchRows<T>(table: string, params: Record<string, string>, patch: Record<string, unknown>): Promise<T[]> {
  const { data } = await request<T[]>(`/${table}${queryString(params)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  return data ?? [];
}

export async function deleteRows(table: string, params: Record<string, string>): Promise<void> {
  await request(`/${table}${queryString(params)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

export async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data } = await request<T>(`/rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
  return data;
}

export interface KontrakRow {
  kontrak_id: string;
  project_id: string;
  nilai_kontrak_awal: number;
  pagu_alokasi: number;
  tanggal_mulai: string;
  durasi_bulan: number;
  uang_muka_pct: number;
  retensi_pct: number;
}

export interface ProyekRow {
  project_id: string;
  nama_proyek: string;
  kategori_hijau: string;
  kementerian_pelaksana: string;
  seri_penerbitan: string;
  akad: string;
  jenis_pembiayaan: string;
  tanggal_mulai: string;
  pagu_proyek: number;
}

export interface TransaksiRow extends Record<string, unknown> {
  trx_id: string;
  tanggal: string;
  project_id: string;
  kontrak_id: string;
  jenis_pembayaran: string;
  nilai_pencairan: number;
  progres_fisik_pct: number;
  kumulatif_cair: number;
}

export interface PeringatanRow extends Record<string, unknown> {
  id: string;
  trx_id: string;
  jenis: "aturan" | "skor" | "keduanya";
  kode_aturan: string[];
  skor: number | null;
  ambang: number | null;
  versi_model: string | null;
  status: string;
  catatan: string;
  dibuat_pada: string;
  diperbarui_pada: string;
  transaksi?: { kontrak_id: string; tanggal?: string; project_id?: string };
}

export interface LedgerRow extends Record<string, unknown> {
  seq: number | string;
  jenis_entri: string;
  trx_id: string | null;
  payload_kanonik: string;
  payload: Record<string, unknown>;
  hash_payload: string;
  hash_sebelumnya: string;
  hash_saat_ini: string;
  dibuat_pada: string;
}

export async function getKontrak(kontrakId: string): Promise<KontrakRow | null> {
  return (await getRows<KontrakRow>("registri_kontrak", { select: "*", kontrak_id: `eq.${kontrakId}`, limit: 1 }))[0] ?? null;
}

export async function getProyek(projectId: string): Promise<ProyekRow | null> {
  return (await getRows<ProyekRow>("registri_proyek", { select: "*", project_id: `eq.${projectId}`, limit: 1 }))[0] ?? null;
}

export async function getTransaksi(trxId: string): Promise<TransaksiRow | null> {
  return (await getRows<TransaksiRow>("transaksi", { select: "*", trx_id: `eq.${trxId}`, limit: 1 }))[0] ?? null;
}

export async function getRiwayatKontrak(kontrakId: string, sebelumTanggal?: string): Promise<TransaksiRow[]> {
  const rows: TransaksiRow[] = [];
  let offset = 0;
  while (true) {
    const page = await getRows<TransaksiRow>("transaksi", {
      select: "*",
      kontrak_id: `eq.${kontrakId}`,
      ...(sebelumTanggal ? { tanggal: `lt.${sebelumTanggal}` } : {}),
      order: "tanggal.asc,trx_id.asc",
      limit: PAGE_SIZE,
      offset,
    });
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    offset += PAGE_SIZE;
  }
}

export async function getPeringatan(id: string): Promise<PeringatanRow | null> {
  return (await getRows<PeringatanRow>("peringatan", { select: "*", id: `eq.${id}`, limit: 1 }))[0] ?? null;
}

export async function listPeringatan(options: {
  status?: string; jenis?: string; kontrak_id?: string; urut: "waktu" | "skor"; halaman: number; per_halaman: number;
}): Promise<{ data: PeringatanRow[]; total: number }> {
  const params: Record<string, string | number> = {
    select: "*,transaksi!inner(kontrak_id)",
    order: options.urut === "skor" ? "skor.desc.nullslast,dibuat_pada.desc" : "dibuat_pada.desc",
    limit: options.per_halaman,
    offset: (options.halaman - 1) * options.per_halaman,
  };
  if (options.status) params.status = `eq.${options.status}`;
  if (options.jenis) params.jenis = `eq.${options.jenis}`;
  if (options.kontrak_id) params["transaksi.kontrak_id"] = `eq.${options.kontrak_id}`;
  const { data, response } = await request<PeringatanRow[]>(`/peringatan${queryString(params)}`, { headers: { Prefer: "count=exact" } });
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? data.length);
  return { data: data ?? [], total: Number.isFinite(total) ? total : data.length };
}

export async function getCount(table: "transaksi" | "peringatan" | "registri_kontrak", filter?: { field: string; value: string }): Promise<number> {
  const params: Record<string, string | number> = { select: "*", limit: 1 };
  if (filter) params[filter.field] = filter.value;
  const { data, response } = await request<unknown[]>(`/${table}${queryString(params)}`, { headers: { Prefer: "count=exact" } });
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? data.length);
  return Number.isFinite(total) ? total : data.length;
}

export async function insertTransaksi(row: Record<string, unknown>): Promise<TransaksiRow> {
  return insertRow<TransaksiRow>("transaksi", row);
}

export async function insertPeringatan(row: Record<string, unknown>): Promise<PeringatanRow> {
  return insertRow<PeringatanRow>("peringatan", row);
}

export async function updatePeringatan(id: string, patch: Record<string, unknown>): Promise<PeringatanRow | null> {
  return (await patchRows<PeringatanRow>("peringatan", { id: `eq.${id}` }, patch))[0] ?? null;
}

export async function hapusTransaksi(trxId: string): Promise<void> {
  await deleteRows("transaksi", { trx_id: `eq.${trxId}` });
}

export async function hapusPeringatan(id: string): Promise<void> {
  await deleteRows("peringatan", { id: `eq.${id}` });
}

export async function tambahLedger(jenis: string, trxId: string | null, payloadKanonik: string, payload: Record<string, unknown>, hashPayload: string): Promise<LedgerRow> {
  const result = await callRpc<LedgerRow | LedgerRow[]>("tambah_ledger", {
    p_jenis: jenis,
    p_trx_id: trxId,
    p_payload_kanonik: payloadKanonik,
    p_payload: payload,
    p_hash_payload: hashPayload,
  });
  return Array.isArray(result) ? result[0] : result;
}

export async function getLedger(options: { dariSeq?: number; sampaiSeq?: number; batas?: number; terbaru?: boolean }): Promise<LedgerRow[]> {
  const params: Record<string, string | number> = {
    select: "*",
    order: options.terbaru ? "seq.desc" : "seq.asc",
    limit: options.batas ?? 50,
  };
  if (options.dariSeq !== undefined && options.sampaiSeq !== undefined) params.and = `(seq.gte.${options.dariSeq},seq.lte.${options.sampaiSeq})`;
  else if (options.dariSeq !== undefined) params.seq = `gte.${options.dariSeq}`;
  else if (options.sampaiSeq !== undefined) params.seq = `lte.${options.sampaiSeq}`;
  return getRows<LedgerRow>("ledger_entri", params);
}

export async function getLedgerUntukTransaksi(trxId: string): Promise<LedgerRow[]> {
  return getRows<LedgerRow>("ledger_entri", { select: "*", trx_id: `eq.${trxId}`, order: "seq.asc", limit: 200 });
}

export async function bacaSemuaLedger(dariSeq?: number, sampaiSeq?: number): Promise<LedgerRow[]> {
  const rows: LedgerRow[] = [];
  let offset = 0;
  while (true) {
    const params: Record<string, string | number> = { select: "*", order: "seq.asc", limit: PAGE_SIZE, offset };
    if (dariSeq !== undefined && sampaiSeq !== undefined) params.and = `(seq.gte.${dariSeq},seq.lte.${sampaiSeq})`;
    else if (dariSeq !== undefined) params.seq = `gte.${dariSeq}`;
    else if (sampaiSeq !== undefined) params.seq = `lte.${sampaiSeq}`;
    const page = await getRows<LedgerRow>("ledger_entri", params);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    offset += PAGE_SIZE;
  }
}

export async function updateLedgerPayload(seq: number, payloadKanonik: string): Promise<LedgerRow | null> {
  return (await patchRows<LedgerRow>("ledger_entri", { seq: `eq.${seq}` }, { payload_kanonik: payloadKanonik }))[0] ?? null;
}

export interface DemoBackup { seq: number; payload_kanonik: string; }

export async function getDemoBackup(seq: number): Promise<DemoBackup | null> {
  return (await getRows<DemoBackup>("demo_pemulihan", { select: "*", seq: `eq.${seq}`, limit: 1 }))[0] ?? null;
}

export async function saveDemoBackup(row: DemoBackup): Promise<void> {
  await request("/demo_pemulihan", { method: "POST", headers: { Prefer: "return=minimal,resolution=ignore-duplicates" }, body: JSON.stringify(row) });
}

export async function deleteDemoBackup(seq: number): Promise<void> {
  await deleteRows("demo_pemulihan", { seq: `eq.${seq}` });
}

