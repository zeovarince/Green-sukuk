export type Tier = "tinggi" | "sedang" | "rendah" | "statis";
export type TierStatus = { tier: Tier; reason: "siap" | "kurang-gerak" | "hemat-data" | "webgl-tidak-tersedia" | "dimatikan" | "memeriksa" };

export const BATAS = {
  tinggi: { dpr: 1.75, titik: 8000 },
  sedang: { dpr: 1.5, titik: 4000 },
  rendah: { dpr: 1.25, titik: 2000 },
  statis: { dpr: 1, titik: 0 },
} as const;

const KUNCI_MATI = "gstp-3d";

function adaWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function setAnimasi3D(nyala: boolean): void {
  try {
    if (nyala) localStorage.removeItem(KUNCI_MATI);
    else localStorage.setItem(KUNCI_MATI, "mati");
  } catch {
    // Versi statis tetap tersedia bila penyimpanan browser diblokir.
  }
}

export function tentukanTier(): TierStatus {
  if (typeof window === "undefined") return { tier: "statis", reason: "memeriksa" };
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return { tier: "statis", reason: "kurang-gerak" };
  if (nav.connection?.saveData) return { tier: "statis", reason: "hemat-data" };
  try {
    if (localStorage.getItem(KUNCI_MATI) === "mati") return { tier: "statis", reason: "dimatikan" };
  } catch {
    // Lanjutkan pemeriksaan perangkat.
  }
  if (!adaWebGL()) return { tier: "statis", reason: "webgl-tidak-tersedia" };

  const ponsel = window.matchMedia("(pointer: coarse)").matches;
  const inti = navigator.hardwareConcurrency ?? 4;
  const memori = nav.deviceMemory ?? 4;
  if (ponsel && (inti <= 4 || memori <= 3)) return { tier: "rendah", reason: "siap" };
  if (ponsel) return { tier: "sedang", reason: "siap" };
  return { tier: "tinggi", reason: "siap" };
}
