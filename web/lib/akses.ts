export type Peran = "umum" | "penyedia_data" | "auditor" | "pejabat_berwenang" | "otoritas_syariah";

export type PeranTerbatas = Exclude<Peran, "umum">;

export const PERAN_LABEL: Record<Peran, string> = {
  umum: "Mode satu kode",
  penyedia_data: "Penyedia data",
  auditor: "Auditor",
  pejabat_berwenang: "Pejabat berwenang",
  otoritas_syariah: "Otoritas syariah",
};

export const TRANSISI_SAH: Record<string, readonly string[]> = {
  baru: ["ditelaah"],
  ditelaah: ["perlu_klarifikasi", "ditindaklanjuti"],
  perlu_klarifikasi: ["diklarifikasi"],
  diklarifikasi: ["ditindaklanjuti"],
  ditindaklanjuti: ["ditutup"],
  ditutup: [],
};

const TRANSISI_PERAN: Record<PeranTerbatas, ReadonlyArray<readonly [string, string]>> = {
  auditor: [
    ["baru", "ditelaah"],
    ["ditelaah", "perlu_klarifikasi"],
    ["perlu_klarifikasi", "diklarifikasi"],
  ],
  pejabat_berwenang: [
    ["ditelaah", "ditindaklanjuti"],
    ["diklarifikasi", "ditindaklanjuti"],
    ["ditindaklanjuti", "ditutup"],
  ],
  penyedia_data: [],
  otoritas_syariah: [],
};

export function transisiSah(dari: string, ke: string): boolean {
  return TRANSISI_SAH[dari]?.includes(ke) ?? false;
}

export function bolehTransisi(peran: Peran | null | undefined, dari: string, ke: string): boolean {
  if (!transisiSah(dari, ke)) return false;
  if (peran === "umum") return true;
  if (!peran) return false;
  return TRANSISI_PERAN[peran].some(([asal, tujuan]) => asal === dari && tujuan === ke);
}

export function bolehKoreksi(peran: Peran | null | undefined): boolean {
  return peran === "penyedia_data" || peran === "umum";
}
