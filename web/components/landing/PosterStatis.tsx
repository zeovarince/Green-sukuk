import type { CurveData } from "@/lib/landing/data";

function path(points: CurveData["titik"], key: "progres" | "pencairan"): string {
  return points.map((point, index) => {
    const x = 46 + point.u * 390;
    const y = 246 - point[key] * 194;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export default function PosterStatis({ data }: { data: CurveData }) {
  const x = 46 + data.ditandai.u * 390;
  const point = data.titik.reduce((closest, current) => Math.abs(current.u - data.ditandai.u) < Math.abs(closest.u - data.ditandai.u) ? current : closest, data.titik[0]);
  const yProgress = 246 - point.progres * 194;
  const yCash = 246 - point.pencairan * 194;

  return (
    <svg className="landing-poster" viewBox="0 0 480 300" role="img" aria-label={`Kurva progres dan pencairan simulasi kontrak ${data.kontrak_id}`}>
      <path d="M46 52H436M46 149H436M46 246H436M46 52V246" className="poster-grid" />
      {[0, 0.5, 1].map((value) => <text key={value} x="8" y={251 - value * 194}>{Math.round(value * 100)}%</text>)}
      <path d={path(data.titik, "progres")} className="poster-progress" />
      <path d={path(data.titik, "pencairan")} className="poster-cash" />
      <path d={`M${x} ${Math.min(yProgress, yCash)}V${Math.max(yProgress, yCash)}`} className="poster-measure" />
      <path d={`M${x} ${yCash - 12}V${yCash + 12}`} className="poster-flag-stem" />
      <path d={`M${x} ${yCash - 12}l18 5-18 5z`} className="poster-flag" />
      <text x="46" y="282">Awal kontrak</text><text x="436" y="282" textAnchor="end">Waktu</text>
      <text x="286" y="27" className="poster-label">Pencairan kumulatif</text>
      <text x="286" y="44" className="poster-label poster-label-progress">Progres fisik</text>
    </svg>
  );
}
