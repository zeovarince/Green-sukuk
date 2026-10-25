import Link from "next/link";
import { ambilInfoModel } from "@/lib/iforest";

const nav = [
  ["/", "Ringkasan"], ["/periksa", "Periksa"], ["/peringatan", "Peringatan"],
  ["/ledger", "Ledger"], ["/evaluasi", "Evaluasi"], ["/tentang", "Tentang"],
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const model = ambilInfoModel();
  return (
    <div className="site-frame">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="GSTP, Ringkasan">
          <span className="brand-mark" aria-hidden="true">G</span>
          <span><strong>GSTP</strong><small>Prototipe pemeriksa alokasi</small></span>
        </Link>
        <nav className="main-nav" aria-label="Navigasi utama">
          {nav.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <span className="simulation-flag"><span aria-hidden="true" />Data simulasi</span>
      </header>
      <main className="page-sheet">{children}</main>
      <footer className="title-block">
        <div className="title-block-name"><strong>Green Sukuk Traceability Protocol</strong><span>Catatan teknis prototipe</span></div>
        <div><span>Model</span><strong>{model.versi_model}</strong></div>
        <div><span>Ambang skor</span><strong>{model.ambang.toLocaleString("id-ID", { minimumFractionDigits: 3 })}</strong></div>
        <div><span>Ledger</span><Link href="/ledger">Lihat status rantai</Link></div>
        <div className="title-block-sim">Data simulasi</div>
      </footer>
      <p className="site-disclaimer">Peringatan anomali menentukan prioritas pemeriksaan. Keputusan tetap pada petugas berwenang.</p>
    </div>
  );
}

