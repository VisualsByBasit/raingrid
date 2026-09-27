"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { markLoaderSeen, reportProgress, totalProgress } from "./loader/progress";

// First-visit loader: a droplet forming on monsoon-deep, a thin progress line
// and a mono percentage. Progress follows real loading (fonts, hero video;
// the 3D scene joins in stage 3). Shows at least 1.2 s and at most 3 s, then
// the droplet swells and the screen wipes upward to reveal the hero.

const MIN_MS = 1200;
const MAX_MS = 3000;
const EASE = [0.22, 1, 0.36, 1] as const;

export default function Loader({ onDone }: { onDone: () => void }) {
  const progress = useMotionValue(0);
  const pct = useTransform(progress, (v) => `${String(Math.round(v * 100)).padStart(3, "0")}%`);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => reportProgress("fonts", 1)).catch(() => reportProgress("fonts", 1));
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - t0;
      // Hard cap: never hold the visitor longer than MAX_MS.
      if (elapsed >= MAX_MS) {
        progress.set(1);
        if (alive) setFinishing(true);
        return;
      }
      // Real progress, eased in so the number never jumps, and held back
      // until the minimum time has passed.
      const real = totalProgress();
      const timeCap = Math.min(1, elapsed / MIN_MS);
      const target = Math.min(real, real >= 1 ? timeCap : 0.97);
      progress.set(progress.get() + (target - progress.get()) * 0.12);
      if (target >= 1 && progress.get() > 0.995) {
        progress.set(1);
        if (alive) setFinishing(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [progress]);

  // 100%: the droplet swells, then the loader leaves (the parent's
  // AnimatePresence plays the upward wipe).
  useEffect(() => {
    if (!finishing) return;
    markLoaderSeen();
    const t = window.setTimeout(onDone, 380);
    return () => window.clearTimeout(t);
  }, [finishing, onDone]);

  const lineScale = useTransform(progress, (v) => v);

  return (
    <motion.div
      role="status"
      aria-label="Loading RAIN//GRID"
      className="bg-night fixed inset-0 z-[80] overflow-hidden text-glacier"
      initial={{ y: 0 }}
      exit={{ y: "-100%", transition: { duration: 0.7, ease: EASE } }}
    >
      <div className="grain" aria-hidden />
      <div className="absolute inset-0 grid place-items-center">
        <motion.img
          src="/media/droplet.png"
          alt=""
          width={600}
          height={750}
          className="h-[34vh] w-auto max-w-none select-none"
          initial={{ opacity: 0, scale: 0.6, y: 12, filter: "blur(10px)" }}
          animate={
            finishing
              ? { opacity: 0, scale: 1.8, y: -20, filter: "blur(6px)", transition: { duration: 0.45, ease: EASE } }
              : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", transition: { duration: 1.1, ease: EASE } }
          }
          draggable={false}
        />
      </div>
      <p className="eyebrow absolute left-1/2 top-8 -translate-x-1/2 text-cloud">RAIN//GRID</p>
      <div className="absolute inset-x-0 bottom-10 mx-auto flex w-[min(420px,80vw)] flex-col items-center gap-3">
        <div className="relative h-px w-full bg-glacier/15">
          <motion.div className="absolute inset-y-0 left-0 w-full origin-left bg-rain" style={{ scaleX: lineScale }} />
        </div>
        <motion.span className="num text-xs tracking-[0.3em] text-cloud">{pct}</motion.span>
      </div>
    </motion.div>
  );
}
