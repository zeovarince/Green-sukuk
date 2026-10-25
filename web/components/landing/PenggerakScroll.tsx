"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useKemajuanScroll(elementRef: RefObject<HTMLElement | null>, onProgress: (value: number) => void): void {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const trigger = ScrollTrigger.create({
      trigger: element,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => onProgress(self.progress),
    });
    ScrollTrigger.refresh();
    return () => trigger.kill();
  }, [elementRef, onProgress]);
}
