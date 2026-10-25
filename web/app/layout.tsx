import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import Splash from "@/components/Splash";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GSTP | Pemeriksa alokasi Green Sukuk", template: "%s | GSTP" },
  description: "Prototipe pemeriksa alokasi Green Sukuk berbasis aturan, Isolation Forest, dan ledger simulasi. Data simulasi.",
};

const SPLASH_MARKER = `try{var a=location.pathname==='/'&&!sessionStorage.getItem('gstp-splash-v1');document.documentElement.dataset.splash=a?'aktif':'lewati'}catch(e){document.documentElement.dataset.splash='lewati'}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SPLASH_MARKER }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@78..100,600;78..100,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
        <noscript><style>{"#splash{display:none!important}"}</style></noscript>
      </head>
      <body>
        <Splash />
        <div id="app"><AppShell>{children}</AppShell></div>
      </body>
    </html>
  );
}

