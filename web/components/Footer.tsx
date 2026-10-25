import Image from "next/image";
import Link from "next/link";
import { ambilInfoModel } from "@/lib/iforest";
import { ANGGOTA_TIM } from "@/lib/tim";

export default function Footer() {
  const model = ambilInfoModel();

  return (
    <footer className="site-footer">
      <div className="title-block">
        <div className="title-block-name"><strong>Green Sukuk Traceability Protocol</strong><span>Catatan teknis prototipe</span></div>
        <div><span>Model</span><strong>{model.versi_model}</strong></div>
        <div><span>Ambang skor</span><strong>{model.ambang.toLocaleString("id-ID", { minimumFractionDigits: 3 })}</strong></div>
        <div><span>Ledger</span><Link href="/ledger">Lihat status rantai</Link></div>
        <div className="title-block-sim">Data simulasi</div>
      </div>

      <div className="copyright-block">
        <div className="copyright-copy">
          <span className="eyebrow">Hak cipta 2026</span>
          <p>Hak cipta © 2026 tim GSTP. Prototipe esai Green Sukuk Traceability Protocol, Universitas Trunojoyo Madura. Data simulasi.</p>
        </div>
        <ul className="team-credits" aria-label="Anggota tim dan pemilik karya">
          {ANGGOTA_TIM.map((anggota) => (
            <li key={anggota.nama}>
              <Image src={anggota.foto} alt={`Foto ${anggota.nama}`} width={64} height={76} sizes="64px" />
              <span><small>{anggota.peran}</small><strong>{anggota.nama}</strong></span>
            </li>
          ))}
        </ul>
      </div>

      <p className="site-disclaimer">Peringatan anomali menjadi prioritas pemeriksaan, bukan penetapan fraud.</p>
    </footer>
  );
}
