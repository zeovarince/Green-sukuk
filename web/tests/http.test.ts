import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { KonfigurasiAksesError, modeAkses, peranDariPermintaan } from "@/lib/http";

const roleEnv = ["KODE_AKSES_AUDITOR", "KODE_AKSES_PEJABAT", "KODE_AKSES_SYARIAH"] as const;
const passcodeAwal = process.env.DEMO_PASSCODE;

function permintaan(kode?: string) {
  return new Request("http://localhost/api/uji", kode ? { headers: { "x-kode-akses": kode } } : undefined);
}

afterEach(() => {
  for (const key of roleEnv) delete process.env[key];
  if (passcodeAwal === undefined) delete process.env.DEMO_PASSCODE;
  else process.env.DEMO_PASSCODE = passcodeAwal;
});

describe("penentuan peran dari kode akses", () => {
  it("memakai mode satu kode bila tiga kode peran kosong", () => {
    for (const key of roleEnv) delete process.env[key];
    process.env.DEMO_PASSCODE = "satu-kode";
    expect(modeAkses()).toBe("satu_kode");
    expect(peranDariPermintaan(permintaan("satu-kode"))).toBe("umum");
    expect(peranDariPermintaan(permintaan("kode-lain"))).toBeNull();
    expect(peranDariPermintaan(permintaan())).toBeNull();
  });

  it("memetakan tiap kode peran saat mode peran aktif", () => {
    process.env.DEMO_PASSCODE = "penyedia-pass";
    process.env.KODE_AKSES_AUDITOR = "auditor-pass";
    process.env.KODE_AKSES_PEJABAT = "pejabat-pass";
    process.env.KODE_AKSES_SYARIAH = "syariah-pass";
    expect(modeAkses()).toBe("peran");
    expect(peranDariPermintaan(permintaan("penyedia-pass"))).toBe("penyedia_data");
    expect(peranDariPermintaan(permintaan("auditor-pass"))).toBe("auditor");
    expect(peranDariPermintaan(permintaan("pejabat-pass"))).toBe("pejabat_berwenang");
    expect(peranDariPermintaan(permintaan("syariah-pass"))).toBe("otoritas_syariah");
    expect(peranDariPermintaan(permintaan("salah"))).toBeNull();
    expect(peranDariPermintaan(permintaan())).toBeNull();
  });

  it("menolak konfigurasi peran yang hanya terisi sebagian", () => {
    process.env.KODE_AKSES_AUDITOR = "auditor-pass";
    expect(() => modeAkses()).toThrow(KonfigurasiAksesError);
    expect(() => peranDariPermintaan(permintaan("auditor-pass"))).toThrow(KonfigurasiAksesError);
  });
});
