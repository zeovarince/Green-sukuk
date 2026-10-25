type TitikKamera = { p: number; posisi: [number, number, number]; sasaran: [number, number, number] };

const KEYFRAME: TitikKamera[] = [
  { p: 0, posisi: [0.6, 2.7, 7.5], sasaran: [0.8, 0, 0] },
  { p: 0.34, posisi: [0.68, 2.78, 7.4], sasaran: [0.8, 0, 0] },
  { p: 0.54, posisi: [0.72, 2.82, 7.38], sasaran: [0.8, 0, 0] },
  { p: 0.7, posisi: [0.76, 2.86, 7.34], sasaran: [0.8, 0, 0] },
  { p: 0.84, posisi: [0.81, 2.9, 7.3], sasaran: [0.8, 0, 0] },
  { p: 0.94, posisi: [0.85, 2.94, 7.28], sasaran: [0.8, 0, 0] },
  { p: 1, posisi: [0.88, 2.95, 7.25], sasaran: [0.8, 0, 0] },
];

function campur(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function posisiKamera(progress: number): { posisi: [number, number, number]; sasaran: [number, number, number] } {
  const p = Math.min(Math.max(progress, 0), 1);
  const nextIndex = KEYFRAME.findIndex((frame) => frame.p >= p);
  const right = KEYFRAME[nextIndex < 0 ? KEYFRAME.length - 1 : nextIndex];
  const left = KEYFRAME[Math.max(0, (nextIndex < 0 ? KEYFRAME.length : nextIndex) - 1)];
  const local = (p - left.p) / Math.max(right.p - left.p, 0.0001);
  return {
    posisi: [0, 1, 2].map((i) => campur(left.posisi[i], right.posisi[i], local)) as [number, number, number],
    sasaran: [0, 1, 2].map((i) => campur(left.sasaran[i], right.sasaran[i], local)) as [number, number, number],
  };
}
