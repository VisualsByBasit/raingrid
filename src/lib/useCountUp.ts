"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Animates a number from 0 to `to` over `ms` once `run` flips true. With
// reduced motion it shows the final number straight away.
export function useCountUp(to: number, ms: number, run: boolean) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!run || reduced) return;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(to * eased);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, ms, run, reduced]);
  if (!run) return 0;
  return reduced ? to : v;
}
