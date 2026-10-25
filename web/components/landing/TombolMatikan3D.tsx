import type { TierStatus } from "@/lib/landing/tier";

const alasan: Record<TierStatus["reason"], string> = {
  siap: "",
  "kurang-gerak": "Mode kurang gerak aktif",
  "hemat-data": "Mode hemat data aktif",
  "webgl-tidak-tersedia": "WebGL tidak tersedia di perangkat ini",
  dimatikan: "",
  memeriksa: "Memeriksa kemampuan perangkat",
};

export default function TombolMatikan3D({ status, onToggle }: { status: TierStatus; onToggle: (nyala: boolean) => void }) {
  const nyala = status.tier !== "statis";
  const dikunci = ["kurang-gerak", "hemat-data", "webgl-tidak-tersedia", "memeriksa"].includes(status.reason);
  return (
    <button
      className="landing-motion-toggle"
      type="button"
      onClick={() => onToggle(!nyala)}
      disabled={dikunci}
      aria-label={nyala ? "Matikan animasi 3D" : "Nyalakan animasi 3D"}
      title={alasan[status.reason] || undefined}
    >
      {dikunci ? alasan[status.reason] : nyala ? "Matikan animasi 3D" : "Nyalakan animasi 3D"}
    </button>
  );
}
