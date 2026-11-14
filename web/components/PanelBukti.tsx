import { formatAngka } from "@/lib/format";

export type Bukti = {
  hash_tercatat: string;
  hash_dokumen_saat_ini: string;
  hash_cocok: boolean;
  kelengkapan_bukti: number;
  ambang_bukti: number;
  dokumen_asli_tersedia: false;
};

export default function PanelBukti({ bukti }: { bukti: Bukti }) {
  const buktiCukup = bukti.kelengkapan_bukti >= bukti.ambang_bukti;
  return (
    <div className="evidence-panel">
      <h3>Panel bukti</h3>
      <div className="evidence-grid">
        <div className="evidence-row"><span>Hash tercatat</span><strong className="mono">{bukti.hash_tercatat || "belum diisi"}</strong></div>
        <div className="evidence-row"><span>Hash dokumen saat ini</span><strong className="mono">{bukti.hash_dokumen_saat_ini || "belum diisi"}</strong></div>
        <div className="evidence-row"><span>Status hash</span><strong className="evidence-status" data-cocok={bukti.hash_cocok}>{bukti.hash_cocok ? "Cocok" : "Tidak cocok"}</strong></div>
        <div className="evidence-row"><span>Kelengkapan bukti</span><strong className="evidence-status" data-cocok={buktiCukup}>{formatAngka(bukti.kelengkapan_bukti, 2)} dari ambang {formatAngka(bukti.ambang_bukti, 2)}</strong></div>
      </div>
      <p className="provenance">Dokumen asli tidak disimpan pada prototipe. Panel ini menampilkan hash dan kelengkapan.</p>
    </div>
  );
}
