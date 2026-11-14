import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getKontrak: vi.fn(), getProyek: vi.fn(), getRiwayatKontrak: vi.fn(),
  insertTransaksi: vi.fn(), insertPeringatan: vi.fn(), hapusTransaksi: vi.fn(), tambahLedger: vi.fn(),
  getPeringatan: vi.fn(), getTransaksi: vi.fn(), getLedgerUntukTransaksi: vi.fn(), updatePeringatan: vi.fn(),
  listPeringatan: vi.fn(), getLedger: vi.fn(), bacaSemuaLedger: vi.fn(), getRows: vi.fn(),
  getDemoBackup: vi.fn(), saveDemoBackup: vi.fn(), updateLedgerPayload: vi.fn(), deleteDemoBackup: vi.fn(), hapusPeringatan: vi.fn(),
  tandaiTransaksiDigantikan: vi.fn(),
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
import { POST as koreksiPeringatan } from "@/app/api/peringatan/[id]/koreksi/route";
import { POST as telaahSyariah } from "@/app/api/peringatan/[id]/telaah-syariah/route";
import { hitungHashSha256, verifikasiRantaiLedger, type EntriLedger } from "@/lib/ledger";

const request = (url: string, init: RequestInit = {}) => new Request(`http://localhost${url}`, init);
const roleEnv = ["KODE_AKSES_AUDITOR", "KODE_AKSES_PEJABAT", "KODE_AKSES_SYARIAH"] as const;

function pasangModePeran() {
  process.env.DEMO_PASSCODE = "penyedia-pass";
  process.env.KODE_AKSES_AUDITOR = "auditor-pass";
  process.env.KODE_AKSES_PEJABAT = "pejabat-pass";
  process.env.KODE_AKSES_SYARIAH = "syariah-pass";
}

afterEach(() => {
  for (const key of roleEnv) delete process.env[key];
});

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
    expect(body.tindak_lanjut).toBe("pemantauan_berlanjut");
    expect(body.bukti).toMatchObject({ hash_cocok: true, kelengkapan_bukti: 1, ambang_bukti: 0.8, dokumen_asli_tersedia: false });
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
    expect(result.tindak_lanjut).toBe("telaah_auditor");
    expect(Object.fromEntries(result.temuan_aturan.map((finding: { kode: string; prinsip: string }) => [finding.kode, finding.prinsip]))).toMatchObject({
      R01_ID_PROYEK: "amanah", R03_PERSETUJUAN: "amanah", R04_KATEGORI: "hifz_al_mal",
      R06_MILESTONE: "amanah", R07_BUKTI: "hifz_al_mal",
    });
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
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan",
      pengusul: "Budi Santoso", verifikator: "Sari Dewi",
      simpan: true,
    }) }));
    if (prior === undefined) delete process.env.DEMO_PASSCODE; else process.env.DEMO_PASSCODE = prior;
    expect(response.status).toBe(200);
    expect((await response.json()).tersimpan.trx_id).toMatch(/^TRX-LIVE-/);
    expect(store.insertTransaksi).toHaveBeenCalledOnce();
    expect(store.tambahLedger).toHaveBeenCalled();
    const transaksiCall = store.tambahLedger.mock.calls.find((call) => call[0] === "transaksi");
    expect(transaksiCall?.[3]).toMatchObject({ pengusul: "Budi Santoso", verifikator: "Sari Dewi", peran: "umum" });
  });

  it("mewajibkan pengusul dan verifikator saat menyimpan", async () => {
    const prior = process.env.DEMO_PASSCODE;
    process.env.DEMO_PASSCODE = "test-pass";
    const response = await periksa(request("/api/periksa", { method: "POST", headers: { "x-kode-akses": "test-pass", "x-forwarded-for": "test-people" }, body: JSON.stringify({
      kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", tanggal: "2026-02-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: true,
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan",
      pengusul: "Budi Santoso", simpan: true,
    }) }));
    if (prior === undefined) delete process.env.DEMO_PASSCODE; else process.env.DEMO_PASSCODE = prior;
    expect(response.status).toBe(400);
    expect(store.getKontrak).not.toHaveBeenCalled();
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

  it("menandai hash yang tidak cocok pada panel bukti", async () => {
    store.getKontrak.mockResolvedValue({ kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", nilai_kontrak_awal: 100000000, pagu_alokasi: 150000000, tanggal_mulai: "2026-01-01", durasi_bulan: 12 });
    store.getProyek.mockResolvedValue({ project_id: "PRJ-1", nama_proyek: "Proyek", kategori_hijau: "Energi terbarukan", kementerian_pelaksana: "Kementerian", seri_penerbitan: "SBSN", akad: "Ijarah", jenis_pembiayaan: "Proyek", tanggal_mulai: "2026-01-01", pagu_proyek: 1000000000 });
    const response = await periksa(request("/api/periksa", { method: "POST", body: JSON.stringify({
      kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", tanggal: "2026-02-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: true,
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan",
      hash_tercatat: "hash-asli", hash_dokumen_saat_ini: "hash-berubah", simpan: false,
    }) }));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.temuan_aturan.map((finding: { kode: string }) => finding.kode)).toContain("R05_HASH");
    expect(result.bukti).toMatchObject({ hash_tercatat: "hash-asli", hash_dokumen_saat_ini: "hash-berubah", hash_cocok: false, dokumen_asli_tersedia: false });
  });

  it("mengembalikan panel bukti pada detail peringatan", async () => {
    store.getPeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", jenis: "aturan", kode_aturan: ["R05_HASH"], skor: null, ambang: null, versi_model: null, status: "baru", catatan: "", dibuat_pada: "2026-01-01T00:00:00Z", diperbarui_pada: "2026-01-01T00:00:00Z" });
    store.getTransaksi.mockResolvedValue({ trx_id: "trx-1", kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", tanggal: "2026-02-01", nilai_pencairan: 1000000, nilai_kontrak: 100000000, progres_fisik_pct: 10, kategori_hijau: "Energi terbarukan", milestone_terverifikasi: true, persetujuan_diperoleh: 1, kelengkapan_bukti: 0.5, hash_tercatat: "a", hash_dokumen_saat_ini: "b" });
    store.getRiwayatKontrak.mockResolvedValue([]);
    store.getLedgerUntukTransaksi.mockResolvedValue([]);
    const response = await detailPeringatan(request("/api/peringatan/warn-1"), { params: Promise.resolve({ id: "warn-1" }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.bukti).toMatchObject({ hash_cocok: false, kelengkapan_bukti: 0.5, ambang_bukti: 0.8, dokumen_asli_tersedia: false });
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

  it("menegakkan perpindahan status per peran", async () => {
    pasangModePeran();
    async function patch(dari: string, ke: string, kode: string, ip: string) {
      store.getPeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", status: dari, catatan: "", diperbarui_pada: "2026-01-01T00:00:00Z" });
      store.updatePeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", status: ke, catatan: "Catatan pemeriksaan", diperbarui_pada: "2026-01-02T00:00:00Z" });
      return ubahPeringatan(request("/api/peringatan/warn-1", {
        method: "PATCH",
        headers: { "x-kode-akses": kode, "x-forwarded-for": ip },
        body: JSON.stringify({ status: ke, catatan: "Catatan pemeriksaan" }),
      }), { params: Promise.resolve({ id: "warn-1" }) });
    }

    expect((await patch("baru", "ditelaah", "auditor-pass", "peran-a1")).status).toBe(200);
    expect((await patch("ditelaah", "ditindaklanjuti", "auditor-pass", "peran-a2")).status).toBe(403);
    expect((await patch("ditelaah", "ditindaklanjuti", "pejabat-pass", "peran-p1")).status).toBe(200);
    expect((await patch("baru", "ditelaah", "pejabat-pass", "peran-p2")).status).toBe(403);
    expect((await patch("baru", "ditelaah", "penyedia-pass", "peran-d1")).status).toBe(403);
    expect((await patch("baru", "ditelaah", "syariah-pass", "peran-s1")).status).toBe(403);
  });

  it("mengizinkan semua perpindahan sah dalam mode satu kode", async () => {
    const prior = process.env.DEMO_PASSCODE;
    process.env.DEMO_PASSCODE = "single-pass";
    store.getPeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", status: "baru", catatan: "", diperbarui_pada: "2026-01-01T00:00:00Z" });
    store.updatePeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", status: "ditelaah", catatan: "", diperbarui_pada: "2026-01-02T00:00:00Z" });
    const first = await ubahPeringatan(request("/api/peringatan/warn-1", {
      method: "PATCH",
      headers: { "x-kode-akses": "single-pass", "x-forwarded-for": "satu-kode-1" },
      body: JSON.stringify({ status: "ditelaah" }),
    }), { params: Promise.resolve({ id: "warn-1" }) });
    expect(first.status).toBe(200);
    const statusCall = store.tambahLedger.mock.calls.find((call) => call[0] === "status");
    expect(statusCall?.[3]).toMatchObject({ peran: "umum", jenis_catatan: "perubahan_status" });

    store.getPeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", status: "ditelaah", catatan: "", diperbarui_pada: "2026-01-02T00:00:00Z" });
    store.updatePeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", status: "ditindaklanjuti", catatan: "Tindak lanjut disetujui", diperbarui_pada: "2026-01-03T00:00:00Z" });
    const second = await ubahPeringatan(request("/api/peringatan/warn-1", {
      method: "PATCH",
      headers: { "x-kode-akses": "single-pass", "x-forwarded-for": "satu-kode-2" },
      body: JSON.stringify({ status: "ditindaklanjuti", catatan: "Tindak lanjut disetujui" }),
    }), { params: Promise.resolve({ id: "warn-1" }) });
    if (prior === undefined) delete process.env.DEMO_PASSCODE; else process.env.DEMO_PASSCODE = prior;
    expect(second.status).toBe(200);
  });

  it("menolak konfigurasi peran yang hanya terisi sebagian", async () => {
    process.env.KODE_AKSES_AUDITOR = "auditor-pass";
    const response = await ubahPeringatan(request("/api/peringatan/warn-1", {
      method: "PATCH",
      headers: { "x-kode-akses": "auditor-pass", "x-forwarded-for": "peran-sebagian" },
      body: JSON.stringify({ status: "ditelaah" }),
    }), { params: Promise.resolve({ id: "warn-1" }) });
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.galat.kode).toBe("GALAT_SERVER");
    expect(body.galat.pesan).toContain("Belum diisi");
    expect(store.getPeringatan).not.toHaveBeenCalled();
  });

  it("mengembalikan peran dari kode akses pada detail peringatan", async () => {
    pasangModePeran();
    store.getPeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-1", jenis: "aturan", kode_aturan: [], skor: 0.2, ambang: 0.6, versi_model: "if-test", status: "baru", catatan: "", dibuat_pada: "2026-01-01T00:00:00Z", diperbarui_pada: "2026-01-01T00:00:00Z" });
    store.getTransaksi.mockResolvedValue({ trx_id: "trx-1", kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", tanggal: "2026-02-01", nilai_pencairan: 1000000, nilai_kontrak: 100000000, progres_fisik_pct: 10, kategori_hijau: "Energi terbarukan", milestone_terverifikasi: true, persetujuan_diperoleh: 1, kelengkapan_bukti: 1, hash_tercatat: "a", hash_dokumen_saat_ini: "a" });
    store.getRiwayatKontrak.mockResolvedValue([]);
    store.getLedgerUntukTransaksi.mockResolvedValue([]);
    const response = await detailPeringatan(request("/api/peringatan/warn-1", { headers: { "x-kode-akses": "auditor-pass" } }), { params: Promise.resolve({ id: "warn-1" }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.peran).toBe("auditor");
  });

  it("menolak koreksi bila status peringatan bukan perlu_klarifikasi", async () => {
    const prior = process.env.DEMO_PASSCODE;
    process.env.DEMO_PASSCODE = "test-pass";
    store.getPeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-old", status: "ditelaah", catatan: "", diperbarui_pada: "2026-01-01T00:00:00Z" });
    const response = await koreksiPeringatan(request("/api/peringatan/warn-1/koreksi", {
      method: "POST",
      headers: { "x-kode-akses": "test-pass", "x-forwarded-for": "koreksi-status" },
      body: JSON.stringify({ alasan: "Progres fisik salah ketik.", diajukan_oleh: "Budi Santoso", perubahan: { progres_fisik_pct: 20 } }),
    }), { params: Promise.resolve({ id: "warn-1" }) });
    const body = await response.json();
    if (prior === undefined) delete process.env.DEMO_PASSCODE; else process.env.DEMO_PASSCODE = prior;
    expect(response.status).toBe(409);
    expect(body.galat.kode).toBe("STATUS_TIDAK_SESUAI");
    expect(store.insertTransaksi).not.toHaveBeenCalled();
  });

  it("menolak koreksi untuk peran selain penyedia data", async () => {
    pasangModePeran();
    const response = await koreksiPeringatan(request("/api/peringatan/warn-1/koreksi", {
      method: "POST",
      headers: { "x-kode-akses": "auditor-pass", "x-forwarded-for": "koreksi-peran" },
      body: JSON.stringify({ alasan: "Progres fisik salah ketik.", diajukan_oleh: "Budi Santoso", perubahan: { progres_fisik_pct: 20 } }),
    }), { params: Promise.resolve({ id: "warn-1" }) });
    expect(response.status).toBe(403);
    expect(store.getPeringatan).not.toHaveBeenCalled();
  });

  it("menghasilkan transaksi baru dan rantai ledger valid tanpa menghitung ganda", async () => {
    const prior = process.env.DEMO_PASSCODE;
    process.env.DEMO_PASSCODE = "test-pass";
    const proyek = { project_id: "PRJ-1", nama_proyek: "Proyek", kategori_hijau: "Energi terbarukan", kementerian_pelaksana: "Kementerian", seri_penerbitan: "SBSN", akad: "Ijarah", jenis_pembiayaan: "Proyek", tanggal_mulai: "2026-01-01", pagu_proyek: 1000000000 };
    const kontrak = { kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", nilai_kontrak_awal: 100000000, pagu_alokasi: 150000000, tanggal_mulai: "2026-01-01", durasi_bulan: 12, uang_muka_pct: 10, retensi_pct: 5 };
    const trxLama = {
      trx_id: "trx-old", tanggal: "2026-02-01", project_id: "PRJ-1", kontrak_id: "PRJ-1-K01",
      jenis_pembayaran: "termin", nilai_pencairan: 90000000, nilai_kontrak: 100000000, progres_fisik_pct: 10,
      milestone_terverifikasi: true, persetujuan_diperoleh: 2, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan",
      hash_tercatat: "a", hash_dokumen_saat_ini: "a", versi_kontrak: 1, status_addendum: "tidak_ada",
    };
    store.getPeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-old", status: "perlu_klarifikasi", catatan: "", diperbarui_pada: "2026-01-01T00:00:00Z" });
    store.getTransaksi.mockResolvedValue(trxLama);
    store.getKontrak.mockResolvedValue(kontrak);
    store.getProyek.mockResolvedValue(proyek);
    store.getRiwayatKontrak.mockResolvedValue([]);
    store.getLedgerUntukTransaksi.mockResolvedValue([{ jenis_entri: "transaksi", seq: 10, trx_id: "trx-old", payload: {} }]);
    store.insertTransaksi.mockResolvedValue({ trx_id: "TRX-LIVE-new" });
    store.insertPeringatan.mockResolvedValue({ id: "warn-new" });
    store.updatePeringatan.mockResolvedValue({ id: "warn-1", trx_id: "trx-old", status: "diklarifikasi", catatan: "Progres fisik salah ketik pada laporan bulan ini.", diperbarui_pada: "2026-02-02T00:00:00Z" });
    const rantai: EntriLedger[] = [];
    store.tambahLedger.mockImplementation(async (jenis: string, _trxId: string | null, kanonik: string, _payload: Record<string, unknown>, hashPayload: string) => {
      const sebelumnya = rantai.at(-1)?.hash_saat_ini ?? "GENESIS";
      const entri = {
        seq: rantai.length + 1,
        payload_kanonik: kanonik,
        hash_payload: hashPayload,
        hash_sebelumnya: sebelumnya,
        hash_saat_ini: hitungHashSha256(`${sebelumnya}|${hashPayload}`),
      };
      rantai.push(entri);
      return entri;
    });

    const response = await koreksiPeringatan(request("/api/peringatan/warn-1/koreksi", {
      method: "POST",
      headers: { "x-kode-akses": "test-pass", "x-forwarded-for": "koreksi-valid" },
      body: JSON.stringify({
        alasan: "Progres fisik salah ketik pada laporan bulan ini.",
        diajukan_oleh: "Budi Santoso",
        perubahan: { progres_fisik_pct: 15, nilai_pencairan: 70000000 },
      }),
    }), { params: Promise.resolve({ id: "warn-1" }) });
    const body = await response.json();
    if (prior === undefined) delete process.env.DEMO_PASSCODE; else process.env.DEMO_PASSCODE = prior;

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(store.insertTransaksi).toHaveBeenCalledOnce();
    expect(store.getRiwayatKontrak).toHaveBeenCalledWith("PRJ-1-K01", "2026-02-01", { kecualiTrxId: "trx-old" });
    expect(store.tandaiTransaksiDigantikan).toHaveBeenCalledWith("trx-old", expect.stringMatching(/^TRX-LIVE-/));
    expect(body.peringatan_lama).toMatchObject({ id: "warn-1", status: "diklarifikasi" });
    expect(body.hasil.temuan_aturan.map((item: { kode: string }) => item.kode)).not.toContain("R02_PAGU");
    expect(verifikasiRantaiLedger(rantai)).toMatchObject({ valid: true, rusak_pada: null });
    const urutan = store.tambahLedger.mock.calls.map((call) => call[0]);
    expect(urutan[0]).toBe("transaksi");
    expect(urutan.at(-2)).toBe("koreksi");
    expect(urutan.at(-1)).toBe("status");
    const koreksiCall = store.tambahLedger.mock.calls.find((call) => call[0] === "koreksi");
    expect(koreksiCall?.[3]).toMatchObject({
      seq_dikoreksi: 10,
      trx_id_lama: "trx-old",
      perubahan: { progres_fisik_pct: 15, nilai_pencairan: 70000000 },
      peran: "umum",
    });
  });

  it("memeriksa aturan R08_AKAD pada /api/periksa", async () => {
    store.getKontrak.mockResolvedValue({ kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", nilai_kontrak_awal: 100000000, pagu_alokasi: 150000000, tanggal_mulai: "2026-01-01", durasi_bulan: 12 });
    store.getProyek.mockImplementation(async (id: string) => id === "PRJ-1" ? {
      project_id: "PRJ-1", nama_proyek: "Proyek", kategori_hijau: "Energi terbarukan", kementerian_pelaksana: "Kementerian",
      seri_penerbitan: "SBSN", akad: "Ijarah Asset to Be Leased", jenis_pembiayaan: "Proyek", tanggal_mulai: "2026-01-01", pagu_proyek: 1000000000,
    } : null);

    // 1. akad tidak dikenal ditolak 400
    const resBad = await periksa(request("/api/periksa", { method: "POST", body: JSON.stringify({
      kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", tanggal: "2026-02-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: true,
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan", akad: "Murabahah",
    }) }));
    expect(resBad.status).toBe(400);

    // 2. akad berbeda memicu R08 dan perlu_telaah_syariah
    const resR08 = await periksa(request("/api/periksa", { method: "POST", body: JSON.stringify({
      kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", tanggal: "2026-02-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: true,
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan", akad: "Wakalah",
    }) }));
    expect(resR08.status).toBe(200);
    const bodyR08 = await resR08.json();
    expect(bodyR08.temuan_aturan.map((t: { kode: string }) => t.kode)).toContain("R08_AKAD");
    expect(bodyR08.perlu_telaah_syariah).toBe(true);

    // 3. akad kosong tidak memicu R08
    const resEmpty = await periksa(request("/api/periksa", { method: "POST", body: JSON.stringify({
      kontrak_id: "PRJ-1-K01", project_id: "PRJ-1", tanggal: "2026-02-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: true,
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan",
    }) }));
    expect(resEmpty.status).toBe(200);
    const bodyEmpty = await resEmpty.json();
    expect(bodyEmpty.temuan_aturan.map((t: { kode: string }) => t.kode)).not.toContain("R08_AKAD");
    expect(bodyEmpty.perlu_telaah_syariah).toBeUndefined();

    // 4. project_id tidak valid tidak memicu R08 (hanya R01)
    const resInvProj = await periksa(request("/api/periksa", { method: "POST", body: JSON.stringify({
      kontrak_id: "PRJ-1-K01", project_id: "PRJ-9999", tanggal: "2026-02-01", jenis_pembayaran: "termin",
      nilai_pencairan: 1000000, progres_fisik_pct: 10, milestone_terverifikasi: true,
      persetujuan_diperoleh: 1, kelengkapan_bukti: 1, kategori_hijau: "Energi terbarukan", akad: "Wakalah",
    }) }));
    expect(resInvProj.status).toBe(200);
    const bodyInvProj = await resInvProj.json();
    expect(bodyInvProj.temuan_aturan.map((t: { kode: string }) => t.kode)).toContain("R01_ID_PROYEK");
    expect(bodyInvProj.temuan_aturan.map((t: { kode: string }) => t.kode)).not.toContain("R08_AKAD");
  });

  it("mencatat telaah syariah oleh otoritas syariah", async () => {
    pasangModePeran();
    store.getPeringatan.mockImplementation(async (id: string) => {
      if (id === "warn-r08") return { id: "warn-r08", trx_id: "trx-1", status: "baru", kode_aturan: ["R08_AKAD"] };
      if (id === "warn-other") return { id: "warn-other", trx_id: "trx-2", status: "baru", kode_aturan: ["R02_PAGU"] };
      return null;
    });
    store.tambahLedger.mockResolvedValue({ seq: 45 });

    // 1. Ditolak jika tanpa kode akses
    const resNoAuth = await telaahSyariah(request("/api/peringatan/warn-r08/telaah-syariah", {
      method: "POST",
      body: JSON.stringify({ putusan: "sesuai", catatan: "Dokumen akad telah sesuai." }),
    }), { params: Promise.resolve({ id: "warn-r08" }) });
    expect(resNoAuth.status).toBe(401);

    // 2. Ditolak jika peran bukan otoritas syariah
    const resWrongRole = await telaahSyariah(request("/api/peringatan/warn-r08/telaah-syariah", {
      method: "POST",
      headers: { "x-kode-akses": "auditor-pass" },
      body: JSON.stringify({ putusan: "sesuai", catatan: "Dokumen akad telah sesuai." }),
    }), { params: Promise.resolve({ id: "warn-r08" }) });
    expect(resWrongRole.status).toBe(403);

    // 3. Ditolak jika peringatan tidak memuat R08_AKAD
    const resNotR08 = await telaahSyariah(request("/api/peringatan/warn-other/telaah-syariah", {
      method: "POST",
      headers: { "x-kode-akses": "syariah-pass" },
      body: JSON.stringify({ putusan: "sesuai", catatan: "Dokumen akad telah sesuai." }),
    }), { params: Promise.resolve({ id: "warn-other" }) });
    expect(resNotR08.status).toBe(400);

    // 4. Ditolak jika putusan tidak valid atau catatan terlalu pendek
    const resShortNote = await telaahSyariah(request("/api/peringatan/warn-r08/telaah-syariah", {
      method: "POST",
      headers: { "x-kode-akses": "syariah-pass" },
      body: JSON.stringify({ putusan: "sesuai", catatan: "pendek" }),
    }), { params: Promise.resolve({ id: "warn-r08" }) });
    expect(resShortNote.status).toBe(400);

    // 5. Berhasil mencatat ke ledger
    const resOk = await telaahSyariah(request("/api/peringatan/warn-r08/telaah-syariah", {
      method: "POST",
      headers: { "x-kode-akses": "syariah-pass" },
      body: JSON.stringify({ putusan: "perlu_dokumen", catatan: "Mohon klarifikasi adendum akad untuk kontrak ini." }),
    }), { params: Promise.resolve({ id: "warn-r08" }) });
    expect(resOk.status).toBe(200);
    const bodyOk = await resOk.json();
    expect(bodyOk.sukses).toBe(true);
    expect(bodyOk.seq_ledger).toBe(45);
    expect(bodyOk.jenis_catatan).toBe("telaah_syariah");
    expect(bodyOk.putusan).toBe("perlu_dokumen");
    expect(bodyOk.peran).toBe("otoritas_syariah");
  });
});

