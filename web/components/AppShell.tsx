import Link from "next/link";
import Footer from "@/components/Footer";

const nav = [
  ["/", "Jelajahi GSTP"], ["/ringkasan", "Ringkasan"], ["/periksa", "Periksa"], ["/peringatan", "Peringatan"],
  ["/ledger", "Ledger"], ["/evaluasi", "Evaluasi"], ["/tentang", "Tentang"],
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-frame">
      <Link className="skip-link" href="/#coba">Lewati ke tombol periksa</Link>
      <header className="site-header">
        <Link href="/" className="brand" aria-label="GSTP, beranda">
          <span className="brand-mark" aria-hidden="true">G</span>
          <span><strong>GSTP</strong><small>Pelacakan alokasi Green Sukuk</small></span>
        </Link>
        <nav className="main-nav" aria-label="Navigasi utama">
          {nav.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <span className="simulation-flag"><span aria-hidden="true" />Data simulasi</span>
      </header>
      <main className="page-sheet" id="main-content">{children}</main>
      <Footer />
    </div>
  );
}

