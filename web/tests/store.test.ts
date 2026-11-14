import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { getRiwayatKontrak, tandaiTransaksiDigantikan } from "@/lib/store";

function jawab(data: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } }));
}

beforeEach(() => {
  fetchMock.mockReset();
  process.env.SUPABASE_URL = "https://contoh.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "kunci-uji";
});

describe("filter riwayat kontrak", () => {
  it("menyaring transaksi yang sudah digantikan secara bawaan", async () => {
    jawab([]);
    await getRiwayatKontrak("PRJ-1-K01", "2026-02-01");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toContain("/rest/v1/transaksi");
    expect(url.searchParams.get("digantikan_oleh")).toBe("is.null");
    expect(url.searchParams.get("tanggal")).toBe("lt.2026-02-01");
  });

  it("dapat menyertakan transaksi yang digantikan bila diminta", async () => {
    jawab([]);
    await getRiwayatKontrak("PRJ-1-K01", "2026-02-01", { sertakanDigantikan: true });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.has("digantikan_oleh")).toBe(false);
  });

  it("mengecualikan transaksi lama saat pemeriksaan ulang koreksi", async () => {
    jawab([]);
    await getRiwayatKontrak("PRJ-1-K01", "2026-02-01", { kecualiTrxId: "trx-old" });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("trx_id")).toBe("neq.trx-old");
    expect(url.searchParams.get("digantikan_oleh")).toBe("is.null");
  });

  it("menandai transaksi lama dengan penggantinya", async () => {
    jawab([{ trx_id: "trx-old", digantikan_oleh: "trx-new" }]);
    await tandaiTransaksiDigantikan("trx-old", "trx-new");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("transaksi?trx_id=eq.trx-old");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ digantikan_oleh: "trx-new" });
  });
});
