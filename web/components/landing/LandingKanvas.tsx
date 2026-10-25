"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { BATAS, setAnimasi3D, tentukanTier, type TierStatus } from "@/lib/landing/tier";
import type { LandingData } from "@/lib/landing/data";
import PosterStatis from "./PosterStatis";
import TombolMatikan3D from "./TombolMatikan3D";

const Scene = dynamic(() => import("./ThreeScene"), { ssr: false, loading: () => null });

export default function LandingKanvas({ data, progress }: { data: LandingData; progress: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<TierStatus>({ tier: "statis", reason: "memeriksa" });
  const [ready, setReady] = useState(false);
  const [intersecting, setIntersecting] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    setStatus(tentukanTier());
  }, []);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setIntersecting(entry.isIntersecting), { threshold: 0 });
    observer.observe(element);
    const updateVisibility = () => setTabVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  function toggle(nyala: boolean) {
    setAnimasi3D(nyala);
    setReady(false);
    setStatus(tentukanTier());
  }

  const quality = BATAS[status.tier];
  const visible = intersecting && tabVisible;
  return (
    <>
      <div ref={host} className="landing-canvas-host" aria-hidden="true">
        <PosterStatis data={data.curve} />
        {status.tier !== "statis" && (
          <div className={`landing-webgl${ready ? " is-ready" : ""}`}>
            <Scene
              data={data}
              progress={progress}
              maxPoints={quality.titik}
              dpr={quality.dpr}
              active={visible}
              onReady={() => setReady(true)}
            />
          </div>
        )}
      </div>
      <TombolMatikan3D status={status} onToggle={toggle} />
    </>
  );
}
