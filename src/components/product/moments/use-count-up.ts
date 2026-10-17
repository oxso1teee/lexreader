"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

// Счётчик «досчитывает» до значения с той же кривой, что в макетах
// (ease-out cubic). При reduced motion — сразу итог, без кадров.
export function useCountUp(target: number, { delay = 0, duration = 1000 }: { delay?: number; duration?: number } = {}): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, duration, reduce]);

  return reduce ? target : value;
}

/** То же, но 0..1 — для колец и полос. */
export function useProgress({ delay = 0, duration = 1000 }: { delay?: number; duration?: number } = {}): number {
  return useCountUp(1000, { delay, duration }) / 1000;
}
