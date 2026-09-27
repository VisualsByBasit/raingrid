"use client";

import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useState } from "react";
import { reportProgress, totalProgress } from "./loader/progress";

// Loader, on every page load: water forming on monsoon-deep. A thin bead
// swells under a ledge as real loading progresses (fonts, the hero plate,
// the 3D scene), wobbling with surface tension. At 100% it lets go, falls
// onto dark water and splashes: ripple rings and a small crown of droplets,
// under a second. Then the loader fades to reveal the hero. Plain SVG, no
// WebGL. Shows at least 1.2 s and at most 3 s before the fall. Reduced
// motion (normally skipped altogether) gets a simple fade.

const MIN_MS = 1200;
const MAX_MS = 3000;
const EASE = [0.22, 1, 0.36, 1] as const;

// SVG space (viewBox 240 x 480).
const CX = 120;
const LEDGE_Y = 96;
const WATER_Y = 392;
const R_MIN = 3;
const R_MAX = 34;
const FALL_S = 0.36;
const SPLASH_S = 0.62;

// A hanging teardrop: attached at the ledge by a neck, round body below.
function dropPath(r: number) {
  const top = LEDGE_Y;
  const cy = top + r * 1.6 + 2;
  const mid = top + (cy - top) * 0.45;
  return `M ${CX} ${top} C ${CX + r * 0.22} ${mid}, ${CX + r} ${cy - r * 0.9}, ${CX + r} ${cy} A ${r} ${r} 0 0 1 ${CX - r} ${cy} C ${CX - r} ${cy - r * 0.9}, ${CX - r * 0.22} ${mid}, ${CX} ${top} Z`;
}

// Crown droplets: angle out from the impact, height and spread in SVG units.
const CROWN = [
  { dx: -46, up: 58, r: 2.4 },
  { dx: -30, up: 82, r: 3 },
  { dx: -16, up: 96, r: 2.2 },
  { dx: -6, up: 70, r: 1.8 },
  { dx: 6, up: 88, r: 2 },
  { dx: 18, up: 100, r: 2.6 },
  { dx: 32, up: 76, r: 3 },
  { dx: 48, up: 54, r: 2.2 },
  { dx: -58, up: 34, r: 1.6 },
  { dx: 60, up: 38, r: 1.6 },
];

type Stage = "forming" | "falling" | "splash";

export default function Loader({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion() ?? false;
  const progress = useMotionValue(0);
  const pct = useTransform(progress, (v) => `${String(Math.round(v * 100)).padStart(3, "0")}%`);
  const lineScale = useTransform(progress, (v) => v);
  const [stage, setStage] = useState<Stage>("forming");

  // Bead size follows progress (eased so it swells faster at the end), plus
  // a surface-tension wobble.
  const time = useMotionValue(0);
  useAnimationFrame((t) => time.set(t / 1000));
  const radius = useTransform(progress, (v) => R_MIN + (R_MAX - R_MIN) * Math.pow(v, 1.6));
  const d = useTransform(radius, dropPath);
  const wobbleX = useTransform(time, (t) => 1 + 0.035 * Math.sin(t * 7.1) * (reduced ? 0 : 1));
  const wobbleY = useTransform(time, (t) => 1 - 0.03 * Math.sin(t * 7.1 + 0.6) * (reduced ? 0 : 1));
  const dropBottom = useTransform(radius, (r) => LEDGE_Y + r * 2.6 + 2);
  const hlX = useTransform(radius, (r) => CX - r * 0.38);
  const hlY = useTransform(dropBottom, (b) => b - (b - LEDGE_Y) * 0.42);
  const hlRx = useTransform(radius, (r) => r * 0.16);
  const hlRy = useTransform(radius, (r) => r * 0.28);

  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => reportProgress("fonts", 1)).catch(() => reportProgress("fonts", 1));
    const t0 = performance.now();
    let raf = 0;
    const done = () => {
      progress.set(1);
      if (alive) setStage("falling");
    };
    const tick = (t: number) => {
      const elapsed = t - t0;
      // Hard cap: never hold the visitor longer than MAX_MS.
      if (elapsed >= MAX_MS) return done();
      // Real progress, eased in so the number never jumps, and held back
      // until the minimum time has passed.
      const real = totalProgress();
      const timeCap = Math.min(1, elapsed / MIN_MS);
      const target = Math.min(real, real >= 1 ? timeCap : 0.97);
      progress.set(progress.get() + (target - progress.get()) * 0.12);
      if (target >= 1 && progress.get() > 0.995) return done();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [progress]);

  // 100%: fall, then splash, then hand over (the parent fades the loader).
  useEffect(() => {
    if (stage === "forming") return;
    if (reduced) {
      const t = window.setTimeout(onDone, 150);
      return () => window.clearTimeout(t);
    }
    if (stage === "falling") {
      const t = window.setTimeout(() => setStage("splash"), FALL_S * 1000);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(onDone, SPLASH_S * 1000);
    return () => window.clearTimeout(t);
  }, [stage, reduced, onDone]);

  const fallDistance = WATER_Y - (LEDGE_Y + R_MAX * 2.6 + 2) + R_MAX * 0.4;

  return (
    <motion.div
      role="status"
      aria-label="Loading RAIN//GRID"
      className="bg-night fixed inset-0 z-[80] overflow-hidden text-glacier"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0.3 : 0.55, ease: EASE } }}
    >
      <div className="grain" aria-hidden />
      <div className="absolute inset-0 grid place-items-center">
        <svg viewBox="0 0 240 480" className="h-[64vh] max-h-[560px] w-auto overflow-visible" aria-hidden>
          <defs>
            <radialGradient id="ld-drop" cx="38%" cy="62%" r="70%">
              <stop offset="0%" stopColor="#e6f4fa" stopOpacity="0.95" />
              <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0e6ba8" stopOpacity="0.9" />
            </radialGradient>
            <linearGradient id="ld-ledge" x1="0" x2="1">
              <stop offset="0%" stopColor="#9fb3c1" stopOpacity="0" />
              <stop offset="50%" stopColor="#9fb3c1" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#9fb3c1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="ld-water" x1="0" x2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="ld-pool" cx="50%" cy="0%" r="60%">
              <stop offset="0%" stopColor="#0e6ba8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0e6ba8" stopOpacity="0" />
            </radialGradient>
            <filter id="ld-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* The ledge the water gathers under. */}
          <rect x={CX - 70} y={LEDGE_Y - 1.5} width={140} height={1.5} fill="url(#ld-ledge)" />

          {/* Dark water below, with a faint pool of light. */}
          <ellipse cx={CX} cy={WATER_Y + 18} rx={120} ry={30} fill="url(#ld-pool)" />
          <rect x={CX - 110} y={WATER_Y} width={220} height={1} fill="url(#ld-water)" />

          {/* The forming drop, then its fall. */}
          <motion.g
            animate={
              stage === "forming" || reduced
                ? { y: 0, scaleY: 1, opacity: stage === "forming" ? 1 : 0 }
                : stage === "falling"
                  ? { y: fallDistance, scaleY: 1.12, opacity: 1, transition: { duration: FALL_S, ease: [0.55, 0, 1, 0.45] } }
                  : { y: fallDistance, opacity: 0, transition: { duration: 0.06 } }
            }
            style={{ originX: `${CX}px`, originY: `${LEDGE_Y}px` }}
          >
            <motion.g style={{ scaleX: wobbleX, scaleY: wobbleY, originX: `${CX}px`, originY: `${LEDGE_Y}px` }}>
              <motion.path d={d} fill="#38bdf8" opacity={0.35} filter="url(#ld-glow)" />
              <motion.path d={d} fill="url(#ld-drop)" stroke="#e6f4fa" strokeOpacity={0.5} strokeWidth={0.8} />
              {/* Highlight. */}
              <motion.ellipse
                cx={hlX}
                cy={hlY}
                rx={hlRx}
                ry={hlRy}
                fill="#ffffff"
                opacity={0.8}
              />
            </motion.g>
          </motion.g>

          {/* Splash: ripple rings and a crown of droplets. */}
          {stage === "splash" && !reduced && (
            <g>
              {[0, 1, 2].map((i) => (
                <motion.ellipse
                  key={i}
                  cx={CX}
                  cy={WATER_Y}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={1.4 - i * 0.3}
                  initial={{ rx: 4, ry: 1, opacity: 0.9 }}
                  animate={{ rx: 70 + i * 36, ry: 11 + i * 5, opacity: 0 }}
                  transition={{ duration: SPLASH_S - i * 0.06, delay: i * 0.07, ease: "easeOut" }}
                />
              ))}
              {CROWN.map((c, i) => (
                <motion.circle
                  key={i}
                  cx={CX}
                  cy={WATER_Y}
                  r={c.r}
                  fill="#bfe6fb"
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{ x: [0, c.dx * 0.6, c.dx], y: [0, -c.up, -c.up * 0.2], opacity: [1, 1, 0] }}
                  transition={{ duration: SPLASH_S * 0.9, times: [0, 0.45, 1], ease: ["easeOut", "easeIn"] }}
                />
              ))}
              {/* A short column where the drop went in. */}
              <motion.ellipse
                cx={CX}
                cy={WATER_Y}
                rx={3}
                fill="#e6f4fa"
                initial={{ ry: 0, opacity: 0.9 }}
                animate={{ ry: [0, 16, 0], opacity: [0.9, 0.8, 0] }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </g>
          )}
        </svg>
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
