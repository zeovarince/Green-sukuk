export default function ScoreRuler({ score, threshold }: { score: number | null; threshold: number }) {
  const marker = score === null ? 0 : Math.min(100, Math.max(0, score * 100));
  return (
    <div className="score-ruler" aria-label={score === null ? "Skor tidak dihitung karena ada temuan aturan" : `Skor ${score.toLocaleString("id-ID", { maximumFractionDigits: 4 })}, ambang ${threshold.toLocaleString("id-ID", { maximumFractionDigits: 4 })}`}>
      <div className="ruler-track"><span className="ruler-score" style={{ left: `${marker}%` }} /><span className="ruler-threshold" style={{ left: `${threshold * 100}%` }} /></div>
      <div className="ruler-ticks">{Array.from({ length: 11 }, (_, index) => <span key={index} style={{ left: `${index * 10}%` }}>{index % 2 === 0 ? (index / 10).toLocaleString("id-ID", { maximumFractionDigits: 1 }) : ""}</span>)}</div>
      <div className="ruler-labels"><span>Skor {score === null ? "tidak dihitung" : score.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</span><span>Ambang {threshold.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</span></div>
    </div>
  );
}

