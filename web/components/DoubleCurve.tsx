"use client";

import { useMemo, useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { formatAngka, formatTanggal, formatRupiah } from "@/lib/format";

export interface CurveRow {
  trx_id?: string;
  tanggal: string;
  nilai_pencairan: number;
  progres_fisik_pct: number;
  kumulatif_cair?: number;
}

type Props = { rows: CurveRow[]; nilaiKontrak: number; flagged?: string[]; preview?: CurveRow; title?: string };
const W = 760;
const H = 300;
const LEFT = 48;
const RIGHT = 155;
const TOP = 28;
const BOTTOM = 44;

export default function DoubleCurve({ rows, nilaiKontrak, flagged = [], preview, title = "Pencairan kumulatif dan progres fisik" }: Props) {
  const root = useRef<SVGSVGElement>(null);
  const source = preview ? [...rows, preview] : rows;
  const signature = source.map((row) => `${row.tanggal}:${row.nilai_pencairan}:${row.progres_fisik_pct}`).join("|");
  const graph = useMemo(() => {
    let cumulative = 0;
    const points = source.map((row, index) => {
      cumulative = row.kumulatif_cair !== undefined && !preview ? Number(row.kumulatif_cair) : cumulative + Number(row.nilai_pencairan);
      const cash = nilaiKontrak > 0 ? (cumulative / nilaiKontrak) * 100 : 0;
      return { ...row, index, cash, progress: Number(row.progres_fisik_pct), cumulative };
    });
    const scale = Math.max(100, ...points.map((point) => point.cash)) * 1.08;
    const width = W - LEFT - RIGHT;
    const height = H - TOP - BOTTOM;
    const px = (index: number) => points.length <= 1 ? LEFT + width * 0.5 : LEFT + (index / (points.length - 1)) * width;
    const py = (value: number) => TOP + height - (Math.max(0, value) / scale) * height;
    const path = (key: "progress" | "cash") => points.map((point, index) => `${index ? "L" : "M"}${px(index).toFixed(1)} ${py(point[key]).toFixed(1)}`).join(" ");
    const markedIndex = Math.max(0, points.findLastIndex((point) => point.trx_id && flagged.includes(point.trx_id)));
    const focusIndex = flagged.length ? markedIndex : points.length - 1;
    const focus = points[focusIndex];
    return { points, scale, height, width, px, py, path, focus, focusIndex };
  }, [signature, nilaiKontrak, flagged.join("|")]);

  useGSAP(() => {
    const paths = root.current?.querySelectorAll<SVGPathElement>(".curve-line");
    if (!paths?.length) return;
    paths.forEach((path) => {
      const length = path.getTotalLength();
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      gsap.to(path, { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut", delay: 0.04 });
    });
  }, { scope: root, dependencies: [signature], revertOnUpdate: true });

  if (!source.length) return <div className="chart-empty">Pilih kontrak untuk melihat pencairan dan progres fisik.</div>;
  const focus = graph.focus;
  const difference = focus ? focus.cash - focus.progress : 0;
  const measureX = focus ? graph.px(graph.focusIndex) : LEFT;
  const measureY1 = focus ? graph.py(focus.cash) : TOP;
  const measureY2 = focus ? graph.py(focus.progress) : TOP;
  const summary = focus
    ? `Progres ${formatAngka(focus.progress)} persen, pencairan ${formatAngka(focus.cash)} persen, selisih ${formatAngka(Math.abs(difference))} poin.`
    : "Belum ada data pencairan.";

  return (
    <figure className="curve-figure">
      <figcaption className="curve-heading"><span>{title}</span><span>{summary}</span></figcaption>
      <svg ref={root} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="curve-svg">
        <title>{title}</title><desc>{summary}. Kurva tinta menunjukkan progres fisik dan kurva teal menunjukkan pencairan kumulatif dibanding nilai kontrak.</desc>
        {[0, 50, 100].filter((value) => value <= graph.scale).map((value) => (
          <g key={value} className="chart-grid"><line x1={LEFT} x2={W - RIGHT + 8} y1={graph.py(value)} y2={graph.py(value)} /><text x={LEFT - 10} y={graph.py(value) + 4} textAnchor="end">{value}%</text></g>
        ))}
        <line className="chart-axis" x1={LEFT} y1={TOP} x2={LEFT} y2={H - BOTTOM} />
        <line className="chart-axis" x1={LEFT} y1={H - BOTTOM} x2={W - RIGHT + 8} y2={H - BOTTOM} />
        <path className="curve-line curve-progress" d={graph.path("progress")} />
        <path className="curve-line curve-cash" d={graph.path("cash")} />
        {graph.points.map((point, index) => flagged.includes(point.trx_id ?? "") && (
          <g key={point.trx_id ?? index} className="curve-flag" transform={`translate(${graph.px(index)},${graph.py(point.progress)})`}>
            <line x1="0" x2="0" y1="-2" y2="-25" /><polygon points="0,-25 17,-21 0,-15" />
          </g>
        ))}
        {focus && <g className="curve-measure" aria-hidden="true">
          <line x1={measureX + 9} x2={measureX + 9} y1={measureY1} y2={measureY2} />
          <line x1={measureX + 3} x2={measureX + 15} y1={measureY1} y2={measureY1} />
          <line x1={measureX + 3} x2={measureX + 15} y1={measureY2} y2={measureY2} />
          <text x={Math.min(W - RIGHT - 8, measureX + 18)} y={(measureY1 + measureY2) / 2 - 5}>selisih {formatAngka(Math.abs(difference))} poin</text>
        </g>}
        <text className="chart-end-label chart-end-progress" x={W - RIGHT + 16} y={focus ? graph.py(focus.progress) + 5 : TOP}>Progres fisik</text>
        <text className="chart-end-label chart-end-cash" x={W - RIGHT + 16} y={focus ? graph.py(focus.cash) + 5 : TOP + 20}>Pencairan</text>
        {focus && <text className="chart-x-label" x={LEFT} y={H - 12}>{formatTanggal(graph.points[0].tanggal)}</text>}
        {focus && <text className="chart-x-label" x={W - RIGHT + 8} y={H - 12} textAnchor="end">{formatTanggal(graph.points.at(-1)?.tanggal)}</text>}
      </svg>
      <details className="chart-data">
        <summary>Lihat data grafik</summary>
        <div className="table-scroll"><table><thead><tr><th scope="col">Tanggal</th><th scope="col">Pencairan</th><th scope="col">Progres</th><th scope="col">Kumulatif</th></tr></thead><tbody>
          {graph.points.map((point, index) => <tr key={`${point.trx_id ?? point.tanggal}-${index}`}><td>{formatTanggal(point.tanggal)}</td><td className="num">{formatRupiah(point.nilai_pencairan)}</td><td className="num">{formatAngka(point.progress)}%</td><td className="num">{formatRupiah(point.cumulative)}</td></tr>)}
        </tbody></table></div>
      </details>
    </figure>
  );
}

