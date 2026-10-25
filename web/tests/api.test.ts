import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getKontrak: vi.fn(), getProyek: vi.fn(), getRiwayatKontrak: vi.fn(),
  insertTransaksi: vi.fn(), insertPeringatan: vi.fn(), hapusTransaksi: vi.fn(), tambahLedger: vi.fn(),
  getPeringatan: vi.fn(), getTransaksi: vi.fn(), getLedgerUntukTransaksi: vi.fn(), updatePeringatan: vi.fn(),
  listPeringatan: vi.fn(), getLedger: vi.fn(), bacaSemuaLedger: vi.fn(), getRows: vi.fn(),
  getDemoBackup: vi.fn(), saveDemoBackup: vi.fn(), updateLedgerPayload: vi.fn(), deleteDemoBackup: vi.fn(), hapusPeringatan: vi.fn(),
}));

vi.mock("@/lib/store", () => store);

import { POST as periksa } from "@/app/api/periksa/route";
import { GET as peringatanList } from "@/app/api/peringatan/route";
import { PATCH as ubahPeringatan } from "@/app/api/peringatan/[id]/route";
import { GET as detailPeringatan } from "@/app/api/peringatan/[id]/route";
import { GET as kontrakDetail } from "@/app/api/kontrak/[id]/route";
import { GET as ledgerList } from "@/app/api/ledger/route";
import { GET as verifikasi } from "@/app/api/ledger/verifikasi/route";
import { GET as metrik } from "@/app/api/metrik/route";
import { POST as demoRusak } from "@/app/api/demo/rusak-entri/route";
import { POST as demoPulihkan } from "@/app/api/demo/pulihkan/route";

const request = (url: string, init: RequestInit = {}) => new Request(`http://localhost${url}`, init);

beforeEach(() => {
  vi.clearAllMocks();
  store.getKontrak.mockResolvedValue(null);
  store.getProyek.mockResolvedValue(null);
  store.getRiwayatKontrak.mockResolvedValue([]);
  store.listPeringatan.mockResolvedValue({ total: 0, data: [] });
  store.getLedger.mockResolvedValue([]);
  store.bacaSemuaLedger.mockResolvedValue([]);
});

describe("route API", () => {
  it("menolak input pemeriksaan yang tidak valid sebelum akses database", async () => {
    const response = await periksa(request("/api/periksa", { method: "POST", body: JSON.stringify({ nilai_pencairan: -1 }) }));
    expect(response.status).toBe(400);
    expect((await response.json()).galat.kode).toBe("VALIDASI_GAGAL");
    expect(store.getKontrak).not.toHaveBeenCalled();
  });

  it("mengembalikan 404 untuk kontrak yang tidak terdaftar", async () => {
    const response = await periksa(request("/api/periksa", { method: "POST", body: JSON.stringify({
      kontrak_id: "missing", project_id: "PRJ-1", tanggal: "2026-01-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: true,
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan",
    }) }));
    expect(response.status).toBe(404);
    expect((await response.json()).galat.kode).toBe("TIDAK_DITEMUKAN");
  });

  it("memeriksa transaksi wajar dan mengembalikan fitur turunan", async () => {
    store.getKontrak.mockResolvedValue({ kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", nilai_kontrak_awal: 100000000, pagu_alokasi: 150000000, tanggal_mulai: "2026-01-01", durasi_bulan: 12 });
    store.getProyek.mockResolvedValue({ project_id: "PRJ-1", nama_proyek: "Proyek", kategori_hijau: "Energi terbarukan", kementerian_pelaksana: "Kementerian", seri_penerbitan: "SBSN", akad: "Ijarah", jenis_pembiayaan: "Proyek", tanggal_mulai: "2026-01-01", pagu_proyek: 1000000000 });
    const response = await periksa(request("/api/periksa", { method: "POST", body: JSON.stringify({
      kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", tanggal: "2026-02-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: true,
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan", simpan: false,
    }) }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.temuan_aturan).toEqual([]);
    expect(body.fitur.rasio_nilai_terhadap_kontrak).toBe(0.01);
    expect(body.tersimpan).toBeNull();
    expect(store.insertTransaksi).not.toHaveBeenCalled();
  });

  it("memerlukan kode akses untuk menyimpan hasil pemeriksaan", async () => {
    const response = await periksa(request("/api/periksa", { method: "POST", body: JSON.stringify({
      kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", tanggal: "2026-02-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: true,
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan", simpan: true,
    }) }));
    expect(response.status).toBe(401);
    expect(store.getKontrak).not.toHaveBeenCalled();
  });

  it("melaporkan seluruh aturan yang dilanggar pada pemeriksaan", async () => {
    store.getKontrak.mockResolvedValue({ kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", nilai_kontrak_awal: 100000000, pagu_alokasi: 150000000, tanggal_mulai: "2026-01-01", durasi_bulan: 12 });
    const project = { project_id: "PRJ-1", nama_proyek: "Proyek", kategori_hijau: "Energi terbarukan", kementerian_pelaksana: "Kementerian", seri_penerbitan: "SBSN", akad: "Ijarah", jenis_pembiayaan: "Proyek", tanggal_mulai: "2026-01-01", pagu_proyek: 1000000000 };
    store.getProyek.mockImplementation(async (id: string) => id === "PRJ-1" ? project : null);
    const response = await periksa(request("/api/periksa", { method: "POST", body: JSON.stringify({
      kontrak_id: "PRJ-1-K01", project_id: "OTHER", tanggal: "2026-02-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: false,
      persetujuan_diperoleh: 0, kelengkapan_bukti: 0.5, kategori_hijau: "Kategori tidak sah", simpan: false,
    }) }));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.temuan_aturan.map((finding: { kode: string }) => finding.kode)).toEqual([
      "R01_ID_PROYEK", "R03_PERSETUJUAN", "R04_KATEGORI", "R06_MILESTONE", "R07_BUKTI",
    ]);
    expect(result.skor.nilai).toBeNull();
  });

  it("menyimpan transaksi berakses dan mencatat ledger", async () => {
    const prior = process.env.DEMO_PASSCODE;
    process.env.DEMO_PASSCODE = "test-pass";
    store.getKontrak.mockResolvedValue({ kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", nilai_kontrak_awal: 100000000, pagu_alokasi: 150000000, tanggal_mulai: "2026-01-01", durasi_bulan: 12 });
    store.getProyek.mockResolvedValue({ project_id: "PRJ-1", nama_proyek: "Proyek", kategori_hijau: "Energi terbarukan", kementerian_pelaksana: "Kementerian", seri_penerbitan: "SBSN", akad: "Ijarah", jenis_pembiayaan: "Proyek", tanggal_mulai: "2026-01-01", pagu_proyek: 1000000000 });
    store.insertTransaksi.mockResolvedValue({ trx_id: "TRX-LIVE-test" });
    store.insertPeringatan.mockResolvedValue({ id: "warn-1" });
    store.tambahLedger.mockResolvedValue({ seq: 21 });
    const response = await periksa(request("/api/periksa", { method: "POST", headers: { "x-kode-akses": "test-pass", "x-forwarded-for": "test-save" }, body: JSON.stringify({
      kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", tanggal: "2026-02-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: true,
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan", simpan: true,
    }) }));
    if (prior === undefined) delete process.env.DEMO_PASSCODE; else process.env.DEMO_PASSCODE = prior;
    expect(response.status).toBe(200);
    expect((await response.json()).tersimpan.trx_id).toMatch(/^TRX-LIVE-/);
    expect(store.insertTransaksi).toHaveBeenCalledOnce();
    expect(store.tambahLedger).toHaveBeenCalled();
  });

  it("membatasi daftar peringatan dan ledger", async () => {
    const a = await peringatanList(request("/api/peringatan?per_halaman=25"));
    expect(a.status).toBe(200);
    const b = await ledgerList(request("/api/ledger?batas=201"));
    expect(b.status).toBe(400);
    const c = await ledgerList(request("/api/ledger?batas=1"));
    expect(c.status).toBe(200);
  });

  it("menolak perpindahan status tanpa kode akses", async () => {
    const response = await ubahPeringatan(request("/api/peringatan/id", { method: "PATCH", body: JSON.stringify({ status: "ditelaah" }) }), { params: Promise.resolve({ id: "id" }) });
    expect(response.status).toBe(401);
  });

  it("mengembalikan 404 untuk detail peringatan yang tidak ada", async () => {
    const response = await detailPeringatan(request("/api/peringatan/missing"), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });

  it("menerima perpindahan status yang sah dan menambah ledger", async () => {
    const prior = process.env.DEMO_PASSCODE;
    process.env.DEMO_PASSCODE = "test-pass";
    store.getPeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", status: "baru", catatan: "", diperbarui_pada: "2026-01-01T00:00:00Z" });
    store.updatePeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", status: "ditelaah", catatan: "", diperbarui_pada: "2026-01-02T00:00:00Z" });
    const response = await ubahPeringatan(request("/api/peringatan/warn-1", { method: "PATCH", headers: { "x-kode-akses": "test-pass", "x-forwarded-for": "test-patch-valid" }, body: JSON.stringify({ status: "ditelaah" }) }), { params: Promise.resolve({ id: "warn-1" }) });
    if (prior === undefined) delete process.env.DEMO_PASSCODE; else process.env.DEMO_PASSCODE = prior;
    expect(response.status).toBe(200);
    expect(store.tambahLedger).toHaveBeenCalledOnce();
  });

  it("menolak lompatan status yang tidak sah", async () => {
    const prior = process.env.DEMO_PASSCODE;
    process.env.DEMO_PASSCODE = "test-pass";
    store.getPeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", status: "baru", catatan: "", diperbarui_pada: "2026-01-01T00:00:00Z" });
    const response = await ubahPeringatan(request("/api/peringatan/warn-1", { method: "PATCH", headers: { "x-kode-akses": "test-pass", "x-forwarded-for": "test-patch-invalid" }, body: JSON.stringify({ status: "ditutup" }) }), { params: Promise.resolve({ id: "warn-1" }) });
    if (prior === undefined) delete process.env.DEMO_PASSCODE; else process.env.DEMO_PASSCODE = prior;
    expect(response.status).toBe(400);
    expect(store.updatePeringatan).not.toHaveBeenCalled();
  });

  it("menyediakan metrik dan memverifikasi ledger kosong", async () => {
    const metrics = await metrik();
    expect(metrics.status).toBe(200);
    const result = await verifikasi(request("/api/ledger/verifikasi"));
    expect(result.status).toBe(200);
    expect((await result.json()).valid).toBe(true);
  });

  it("mengembalikan 404 untuk route demo saat mode demo mati", async () => {
    const prior = process.env.DEMO_MODE;
    delete process.env.DEMO_MODE;
    const response = await demoRusak(request("/api/demo/rusak-entri", { method: "POST", body: JSON.stringify({ seq: 2 }) }));
    if (prior !== undefined) process.env.DEMO_MODE = prior;
    expect(response.status).toBe(404);
    const restore = await demoPulihkan(request("/api/demo/pulihkan", { method: "POST" }));
    expect(restore.status).toBe(404);
  });

  it("mencari kontrak tak ada dengan respons 404", async () => {
    const response = await kontrakDetail(request("/api/kontrak/none"), { params: Promise.resolve({ id: "none" }) });
    expect(response.status).toBe(404);
  });
});

