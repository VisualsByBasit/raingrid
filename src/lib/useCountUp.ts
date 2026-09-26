"use client";

import { useEffect, useRef, useState } from "react";

// Animates a number from 0 to `to` over `ms` once `run` flips true.
export function useCountUp(to: number, ms: number, run: boolean) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!run) return;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(to * eased);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, ms, run]);
  return run ? v : 0;
}
