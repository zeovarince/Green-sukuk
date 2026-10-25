"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { pathKurva, titikPada } from "@/lib/kurvaS";

gsap.registerPlugin(useGSAP);
const KEY = "gstp-splash-v1";
const GEO = { lebar: 640, tinggi: 250, x0: 160, y0: 380 };
const CASH = { ...GEO, lonjakanDi: 0.62, selisih: 0.2 };
const PROGRESS_PATH = pathKurva(GEO);
const CASH_PATH = pathKurva(CASH);
const TIP = titikPada(CASH, 0.62);
const MEASURE_X = titikPada(GEO, 0.64).x + 14;
const MEASURE_TOP = titikPada(CASH, 0.64).y;
const MEASURE_BOTTOM = titikPada(GEO, 0.64).y;

export default function Splash() {
  const root = useRef<HTMLDivElement>(null);
  const skipRef = useRef<() => void>(() => {});
  const button = useRef<HTMLButtonElement>(null);

  const { contextSafe } = useGSAP(() => {
    const html = document.documentElement;
    if (html.dataset.splash !== "aktif" || !root.current) return;
    const host = root.current;
    const app = document.getElementById("app");
    app?.setAttribute("inert", "");
    button.current?.focus({ preventScroll: true });

    const finish = () => {
      try { sessionStorage.setItem(KEY, "1"); } catch { /* session storage can be disabled */ }
      html.dataset.splash = "lewati";
      app?.removeAttribute("inert");
    };
    const leave = contextSafe((duration: number) => {
      gsap.to(host, { yPercent: -100, duration, ease: "power3.inOut", onComplete: finish });
    });
    const tl = gsap.timeline();
    const motion = gsap.matchMedia();
    motion.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(host.querySelectorAll("[data-a]"), { autoAlpha: 1 });
      tl.set(host, { autoAlpha: 1 }).to(host, { autoAlpha: 0, duration: 0.2, delay: 0.6, onComplete: finish });
      skipRef.current = contextSafe(() => { tl.kill(); leave(0.25); });
      return () => tl.kill();
    });
    motion.add("(prefers-reduced-motion: no-preference)", () => {
      const frame = host.querySelectorAll<SVGElement>('[data-a="frame"]');
      const progress = host.querySelector<SVGPathElement>('[data-a="progress"]');
      const cash = host.querySelector<SVGPathElement>('[data-a="cash"]');
      gsap.set(host.querySelectorAll("[data-a]"), { autoAlpha: 1 });
      frame?.forEach((line) => {
        if (line instanceof SVGGeometryElement) {
          const length = line.getTotalLength();
          gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
          tl.to(line, { strokeDashoffset: 0, duration: 0.55, ease: "power2.inOut" }, 0);
        }
      });
      [progress, cash].forEach((line, index) => {
        if (!line) return;
        const length = line.getTotalLength();
        gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
        tl.to(line, { strokeDashoffset: 0, duration: index === 0 ? 0.8 : 0.7, ease: "power2.inOut" }, index === 0 ? 0.25 : 0.55);
      });
      const flag = host.querySelector('[data-a="flag"]');
      const measure = host.querySelector('[data-a="measure"]');
      const title = host.querySelector('[data-a="title"]');
      const subtitle = host.querySelector('[data-a="subtitle"]');
      if (!flag || !measure || !title || !subtitle) return;
      gsap.set(flag, { y: -28, autoAlpha: 0 });
      gsap.set(measure, { scaleY: 0, transformOrigin: "50% 50%" });
      gsap.set(title, { yPercent: 100 });
      gsap.set(subtitle, { autoAlpha: 0 });
      tl.to(flag, { y: 0, autoAlpha: 1, duration: 0.25 }, 1.15)
        .to(measure, { scaleY: 1, autoAlpha: 1, duration: 0.25 }, 1.3)
        .to(title, { yPercent: 0, duration: 0.45 }, 1.3)
        .to(subtitle, { autoAlpha: 1, duration: 0.3 }, 1.6)
        .to({}, { duration: 0.3 })
        .call(() => leave(0.5));
      skipRef.current = contextSafe(() => { tl.kill(); leave(0.25); });
      return () => tl.kill();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") skipRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      motion.revert();
      app?.removeAttribute("inert");
    };
  }, { scope: root });

  return (
    <div id="splash" ref={root} role="dialog" aria-modal="true" aria-label="Pengantar GSTP">
      <button ref={button} className="splash-skip" type="button" onClick={() => skipRef.current()}>Lewati</button>
      <svg className="splash-graphic" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <g fill="none" stroke="var(--tinta)" strokeWidth="1.5">
          <rect data-a="frame" x="40" y="40" width="880" height="460" />
          <line data-a="frame" x1="560" y1="420" x2="920" y2="420" />
          <line data-a="frame" x1="560" y1="420" x2="560" y2="500" />
        </g>
        <path data-a="progress" data-draw d={PROGRESS_PATH} fill="none" stroke="var(--tinta)" strokeWidth="2.5" strokeLinejoin="round" />
        <path data-a="cash" data-draw d={CASH_PATH} fill="none" stroke="var(--air)" strokeWidth="2.5" strokeLinejoin="round" />
        <g data-a="measure" stroke="var(--tinta)" strokeWidth="1.25" fill="none">
          <line x1={MEASURE_X} y1={MEASURE_TOP} x2={MEASURE_X} y2={MEASURE_BOTTOM} />
          <line x1={MEASURE_X - 6} y1={MEASURE_TOP} x2={MEASURE_X + 6} y2={MEASURE_TOP} />
          <line x1={MEASURE_X - 6} y1={MEASURE_BOTTOM} x2={MEASURE_X + 6} y2={MEASURE_BOTTOM} />
        </g>
        <g data-a="flag">
          <line x1={TIP.x} y1={TIP.y} x2={TIP.x} y2={TIP.y - 40} stroke="var(--tinta)" strokeWidth="2" />
          <polygon points={`${TIP.x},${TIP.y - 40} ${TIP.x + 26},${TIP.y - 33} ${TIP.x},${TIP.y - 24}`} fill="var(--patok)" />
        </g>
      </svg>
      <div className="splash-caption">
        <span className="splash-title-mask"><span data-a="title">GSTP</span></span>
        <p data-a="subtitle">Prototipe pemeriksa alokasi Green Sukuk<br /><span>Data simulasi</span></p>
      </div>
    </div>
  );
}

