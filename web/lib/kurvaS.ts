export type OpsiKurva = {
  lebar: number;
  tinggi: number;
  x0: number;
  y0: number;
  kecuraman?: number;
  titik?: number;
  lonjakanDi?: number;
  selisih?: number;
};

const logistik = (u: number, k: number) => 1 / (1 + Math.exp(-k * (u - 0.5)));

export function nilaiKurva(u: number, k = 9): number {
  const a = logistik(0, k);
  const b = logistik(1, k);
  return (logistik(u, k) - a) / (b - a);
}

function nilaiDenganLonjakan(u: number, opsi: OpsiKurva): number {
  let value = nilaiKurva(u, opsi.kecuraman ?? 9);
  if (opsi.lonjakanDi !== undefined && u >= opsi.lonjakanDi) value = Math.min(1, value + (opsi.selisih ?? 0));
  return value;
}

export function titikPada(opsi: OpsiKurva, u: number): { x: number; y: number } {
  const value = nilaiDenganLonjakan(u, opsi);
  return { x: opsi.x0 + u * opsi.lebar, y: opsi.y0 - value * opsi.tinggi };
}

export function pathKurva(opsi: OpsiKurva): string {
  const count = opsi.titik ?? 96;
  const segments: string[] = [];
  for (let index = 0; index <= count; index += 1) {
    const point = titikPada(opsi, index / count);
    segments.push(`${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
  }
  return segments.join(" ");
}

