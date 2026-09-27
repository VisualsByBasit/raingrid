"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { searchSectors, type Sector } from "@/data/sectors";
import { reportProgress } from "../loader/progress";
import { HERO } from "../story/copy";
import { PLATE_URL } from "../three/assets";
import { detectSceneMode, detectSceneTier, type SceneMode } from "../three/sceneMode";
import HeroBackdrop from "./HeroBackdrop";

// Landing hero: the living Islamabad plate (one WebGL scene with the
// refracting droplet), the 21 July 2025 headline and sector search. Lines
// rise in with an 80 ms stagger once the loader has gone (`ready`). Low-end
// devices get a CSS version, reduced motion a still.

const HeroScene = dynamic(() => import("../three/HeroScene"), { ssr: false });

const EASE = [0.22, 1, 0.36, 1] as const;
const rise = {
  out: { opacity: 0, y: 28 },
  in: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE, delay: 0.08 * i } }),
};

// A WebGL failure at runtime falls back to the CSS hero.
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Hero({
  ready,
  scroller,
  onStart,
  onSector,
  onSources,
}: {
  ready: boolean;
  scroller: RefObject<HTMLElement | null>;
  onStart: () => void;
  onSector: (s: Sector) => void;
  onSources: () => void;
}) {
  const [q, setQ] = useState("");
  const hits = searchSectors(q, 5);
  const [mode, setMode] = useState<SceneMode>(detectSceneMode);
  const [tier] = useState(detectSceneTier);
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  const onSceneError = useCallback(() => {
    reportProgress("scene", 1);
    setMode("css");
  }, []);
  const header = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  // Only grab focus where it won't pop a phone keyboard over the headline.
  const [focusOnLoad] = useState(() => window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  const state = ready ? "in" : "out";
  const input = useRef<HTMLInputElement>(null);
  // Focus the search once the hero is on screen (desktop pointers only).
  useEffect(() => {
    if (ready && focusOnLoad) input.current?.focus({ preventScroll: true });
  }, [ready, focusOnLoad]);
  const lines = [...HERO.headlineLines];

  // Tell the loader when the plate is in (or failed, so nothing waits). The
  // 3D scene reports its own part; without it there is nothing to wait for.
  useEffect(() => {
    const img = new Image();
    img.onload = img.onerror = () => reportProgress("hero", 1);
    img.src = PLATE_URL;
    if (mode !== "webgl") reportProgress("scene", 1);
  }, [mode]);

  const webgl = mode === "webgl";

  return (
    <header ref={header} className="bg-night relative isolate min-h-dvh overflow-hidden text-glacier">
      {/* The still plate sits under the scene until its first frame, and is the whole backdrop without WebGL. */}
      <HeroBackdrop still={webgl || mode === "static"} />
      {webgl && (
        <SceneBoundary onError={onSceneError}>
          <motion.div
            aria-hidden
            className="absolute inset-0 -z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: sceneReady ? 1 : 0 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <HeroScene tier={tier} eventSource={header} anchor={slot} scroller={scroller} onReady={onSceneReady} />
          </motion.div>
        </SceneBoundary>
      )}
      {/* Monsoon-deep from the bottom (and the text side on desktop) keeps the copy AA. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-monsoon-deep/90 via-monsoon-deep/50 to-monsoon-deep/10 md:via-monsoon-deep/25 md:to-transparent"
      />
      <div aria-hidden className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-monsoon-deep/80 via-monsoon-deep/35 to-transparent md:block" />
      {!webgl && <div className="grain" aria-hidden />}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-5 md:px-10 md:py-7">
        <span className="num text-sm font-semibold tracking-[0.3em] text-glacier">
          RAIN<span className="text-rain">{"//"}</span>GRID
        </span>
        <button onClick={onSources} className="glass-dark rounded-full px-4 py-2 text-xs text-glacier transition hover:bg-white/20">
          How we calculate
        </button>
      </div>

      <div className="relative mx-auto grid min-h-dvh w-full max-w-7xl items-center gap-6 px-5 pb-28 pt-20 md:grid-cols-[1.2fr_0.8fr] md:gap-8 md:px-10 md:pt-24">
        {/* Droplet slot: right column on desktop, centred above the headline on phones. The 3D droplet hangs here; without WebGL the still droplet fills it. */}
        <div
          ref={slot}
          aria-hidden
          className="pointer-events-none mx-auto h-[20vh] w-[16vh] md:order-2 md:aspect-[4/5] md:h-auto md:w-full md:max-w-[380px] md:justify-self-center"
        >
          {!webgl && (
            <motion.div
              className="h-full w-full"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={ready ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
              transition={{ duration: 1.2, ease: EASE }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the CSS hero's still droplet */}
              <img
                src="/media/droplet.png"
                alt=""
                width={600}
                height={750}
                className={`h-full w-full object-contain ${mode === "css" ? "float" : ""}`}
                draggable={false}
              />
            </motion.div>
          )}
        </div>

        <div className="relative md:order-1">
          <motion.p variants={rise} custom={0} initial="out" animate={state} className="eyebrow text-rain">
            {HERO.eyebrow}
          </motion.p>
          <h1 className="display mt-5 text-glacier">
            {lines.map((line, i) => (
              <motion.span key={line} variants={rise} custom={i + 1} initial="out" animate={state} className="block">
                {line}
              </motion.span>
            ))}
            <motion.span variants={rise} custom={lines.length + 1} initial="out" animate={state} className="text-rain-leaf mt-2 block pb-1">
              {HERO.question}
            </motion.span>
          </h1>

          <motion.div
            variants={rise}
            custom={lines.length + 2}
            initial="out"
            animate={state}
            className="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hits[0]) onSector(hits[0]);
                }}
                placeholder="Your sector, e.g. F-10"
                aria-label="Your sector"
                className="glass-dark w-full rounded-2xl px-5 py-4 text-base text-glacier outline-none placeholder:text-cloud focus:border-rain"
              />
              {q && hits.length > 0 && (
                <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/15 bg-monsoon-deep/95 backdrop-blur-xl">
                  {hits.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => onSector(s)} className="w-full px-5 py-3 text-left text-glacier hover:bg-white/10">
                        {s.id} <span className="text-cloud">Islamabad</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => (hits[0] ? onSector(hits[0]) : onStart())}
              className="btn-primary rounded-2xl px-7 py-4 font-semibold"
            >
              Find my roof
            </button>
          </motion.div>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        aria-hidden
        className="absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0, transition: { delay: 0.9, duration: 0.8 } }}
      >
        <span className="eyebrow text-cloud">Follow one drop</span>
        <span className="cue-line" />
      </motion.div>
    </header>
  );
}
