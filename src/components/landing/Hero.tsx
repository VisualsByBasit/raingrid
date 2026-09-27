"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { searchSectors, type Sector } from "@/data/sectors";
import RainCanvas from "../RainCanvas";
import { reportProgress } from "../loader/progress";
import { HERO } from "../story/copy";

// Landing hero: slow real storm-cloud footage under a monsoon-deep gradient,
// the 21 July 2025 headline, sector search and the droplet. Lines rise in
// with an 80 ms stagger once the loader has gone (`ready`).

const EASE = [0.22, 1, 0.36, 1] as const;
const rise = {
  out: { opacity: 0, y: 28 },
  in: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE, delay: 0.08 * i } }),
};

export default function Hero({
  ready,
  onStart,
  onSector,
  onSources,
}: {
  ready: boolean;
  onStart: () => void;
  onSector: (s: Sector) => void;
  onSources: () => void;
}) {
  const [q, setQ] = useState("");
  const hits = searchSectors(q, 5);
  const reduced = useReducedMotion() ?? false;
  // Only grab focus where it won't pop a phone keyboard over the headline.
  const [focusOnLoad] = useState(() => window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  const state = ready ? "in" : "out";
  const input = useRef<HTMLInputElement>(null);
  // Focus the search once the hero is on screen (desktop pointers only).
  useEffect(() => {
    if (ready && focusOnLoad) input.current?.focus({ preventScroll: true });
  }, [ready, focusOnLoad]);
  const lines = [...HERO.headlineLines];

  // Tell the loader when the hero's first frame is ready: the poster at
  // least, the video when it can play (or if it fails, so nothing waits).
  useEffect(() => {
    const img = new Image();
    img.onload = () => reportProgress("hero", 0.6);
    img.src = "/media/hero-clouds.jpg";
  }, []);

  return (
    <header className="bg-night relative isolate min-h-dvh overflow-hidden text-glacier">
      <video
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        src="/media/hero-clouds.mp4"
        poster="/media/hero-clouds.jpg"
        autoPlay={!reduced}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        onCanPlay={() => reportProgress("hero", 1)}
        onError={() => reportProgress("hero", 1)}
      />
      {/* Monsoon-deep from the bottom (and the text side on desktop) keeps the copy AA. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-monsoon-deep/90 via-monsoon-deep/45 to-monsoon-deep/10" />
      <div aria-hidden className="absolute inset-0 -z-10 hidden bg-gradient-to-r from-monsoon-deep/70 via-monsoon-deep/25 to-transparent md:block" />
      <RainCanvas intensity={0.22} />
      <div className="grain" aria-hidden />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-5 md:px-10 md:py-7">
        <span className="num text-sm font-semibold tracking-[0.3em] text-glacier">
          RAIN<span className="text-rain">{"//"}</span>GRID
        </span>
        <button onClick={onSources} className="glass-dark rounded-full px-4 py-2 text-xs text-glacier transition hover:bg-white/20">
          How we calculate
        </button>
      </div>

      <div className="relative mx-auto grid min-h-dvh w-full max-w-7xl items-center gap-8 px-5 pb-28 pt-24 md:grid-cols-[1.2fr_0.8fr] md:px-10">
        {/* Droplet: right column on desktop, behind the headline on phones. */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-12%] top-[10%] w-[70vw] max-w-[360px] opacity-45 md:static md:order-2 md:w-full md:max-w-[420px] md:justify-self-center md:opacity-100"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={ready ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 1.2, ease: EASE }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- stage 2 placeholder, replaced by the 3D droplet in stage 3 */}
            <img src="/media/droplet.png" alt="" width={600} height={750} className="float h-auto w-full" draggable={false} />
          </motion.div>
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
