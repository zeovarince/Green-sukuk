import { describe, expect, it } from "vitest";
import { bolehKoreksi, bolehTransisi, transisiSah, type Peran } from "@/lib/akses";

const auditTransitions: Array<[string, string]> = [
  ["baru", "ditelaah"],
  ["ditelaah", "perlu_klarifikasi"],
  ["perlu_klarifikasi", "diklarifikasi"],
];
const pejabatTransitions: Array<[string, string]> = [
  ["ditelaah", "ditindaklanjuti"],
  ["diklarifikasi", "ditindaklanjuti"],
  ["ditindaklanjuti", "ditutup"],
];

function semuaTransisiSah() {
  return [
    ["baru", "ditelaah"],
    ["ditelaah", "perlu_klarifikasi"],
    ["ditelaah", "ditindaklanjuti"],
    ["perlu_klarifikasi", "diklarifikasi"],
    ["diklarifikasi", "ditindaklanjuti"],
    ["ditindaklanjuti", "ditutup"],
  ] as Array<[string, string]>;
}

describe("tabel perpindahan status per peran", () => {
  it("mengizinkan perpindahan auditor dan menolak yang lain", () => {
    for (const [dari, ke] of semuaTransisiSah()) {
      const diizinkan = auditTransitions.some(([asal, tujuan]) => asal === dari && tujuan === ke);
      expect(bolehTransisi("auditor", dari, ke), `${dari} ke ${ke}`).toBe(diizinkan);
    }
  });

  it("mengizinkan perpindahan pejabat berwenang dan menolak yang lain", () => {
    for (const [dari, ke] of semuaTransisiSah()) {
      const diizinkan = pejabatTransitions.some(([asal, tujuan]) => asal === dari && tujuan === ke);
      expect(bolehTransisi("pejabat_berwenang", dari, ke), `${dari} ke ${ke}`).toBe(diizinkan);
    }
  });

  it("tidak memberi perpindahan status kepada penyedia data dan otoritas syariah", () => {
    for (const peran of ["penyedia_data", "otoritas_syariah"] as Peran[]) {
      for (const [dari, ke] of semuaTransisiSah()) {
        expect(bolehTransisi(peran, dari, ke), `${peran} ${dari} ke ${ke}`).toBe(false);
      }
    }
  });

  it("mengizinkan semua perpindahan sah dalam mode satu kode", () => {
    for (const [dari, ke] of semuaTransisiSah()) {
      expect(bolehTransisi("umum", dari, ke), `${dari} ke ${ke}`).toBe(true);
    }
    expect(bolehTransisi("umum", "baru", "ditutup")).toBe(false);
  });

  it("menolak perpindahan yang tidak ada di tabel global", () => {
    for (const peran of ["umum", "auditor", "pejabat_berwenang"] as Peran[]) {
      expect(bolehTransisi(peran, "baru", "ditutup")).toBe(false);
      expect(bolehTransisi(peran, "ditutup", "baru")).toBe(false);
      expect(bolehTransisi(peran, "tidak_ada", "ditelaah")).toBe(false);
    }
    expect(transisiSah("ditelaah", "ditindaklanjuti")).toBe(true);
    expect(transisiSah("perlu_klarifikasi", "ditutup")).toBe(false);
  });

  it("hanya mengizinkan koreksi untuk penyedia data dan mode satu kode", () => {
    expect(bolehKoreksi("umum")).toBe(true);
    expect(bolehKoreksi("penyedia_data")).toBe(true);
    expect(bolehKoreksi("auditor")).toBe(false);
    expect(bolehKoreksi("pejabat_berwenang")).toBe(false);
    expect(bolehKoreksi("otoritas_syariah")).toBe(false);
    expect(bolehKoreksi(null)).toBe(false);
  });
});
