"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { searchSectors, type Sector } from "@/data/sectors";
import RainCanvas from "./RainCanvas";
import Story from "./story/Story";
import WhyIslamabad from "./story/WhyIslamabad";
import { HERO } from "./story/copy";

// The landing: hero, a pinned scroll story, why Islamabad, and sources. One
// scrollable page inside the intro overlay.
export default function Intro({
  onStart,
  onSector,
  onSources,
  onFindRoof,
}: {
  onStart: () => void;
  onSector: (s: Sector) => void;
  onSources: () => void;
  onFindRoof: () => void;
}) {
  const scroller = useRef<HTMLElement>(null);

  return (
    <motion.section
      ref={scroller}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      className="bg-landing absolute inset-0 z-30 overflow-y-auto overflow-x-hidden"
    >
      <Hero onStart={onStart} onSector={onSector} />
      <Story container={scroller} onFindRoof={onFindRoof} />
      <WhyIslamabad />
      <footer className="mx-auto max-w-5xl px-5 pb-16 text-sm text-muted">
        <button onClick={onSources} className="underline decoration-line underline-offset-4 hover:text-tank-deep">
          How we calculate, and every source
        </button>
      </footer>
    </motion.section>
  );
}

function Hero({ onStart, onSector }: { onStart: () => void; onSector: (s: Sector) => void }) {
  const [q, setQ] = useState("");
  const hits = searchSectors(q, 5);
  // Only grab focus where it won't pop a phone keyboard over the headline.
  const [focusOnLoad] = useState(() => window.matchMedia("(hover: hover) and (pointer: fine)").matches);

  return (
    <header className="bg-hero relative flex min-h-dvh flex-col justify-center overflow-hidden">
      <RainCanvas intensity={0.3} />
      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-7 px-5 py-16">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-semibold uppercase tracking-[0.35em] text-tank-deep"
        >
          {HERO.kicker}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
          className="text-[2.35rem] font-semibold leading-[1.05] tracking-tight text-fg md:text-6xl"
        >
          {HERO.headline}
          <br />
          <span className="bg-gradient-to-r from-tank-deep to-ground-deep bg-clip-text text-transparent">{HERO.question}</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.25 } }}
          className="max-w-xl text-base text-muted md:text-lg"
        >
          {HERO.lead}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.35 } }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <input
              autoFocus={focusOnLoad}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hits[0]) onSector(hits[0]);
              }}
              placeholder="Your sector, e.g. F-10"
              aria-label="Your sector"
              className="glass w-full rounded-xl px-4 py-3 text-base text-fg outline-none placeholder:text-muted focus:border-tank"
            />
            {q && hits.length > 0 && (
              <ul className="glass absolute z-10 mt-1 w-full overflow-hidden rounded-xl">
                {hits.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => onSector(s)} className="w-full px-4 py-2.5 text-left hover:bg-tank/10">
                      {s.id} <span className="text-muted">Islamabad</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => (hits[0] ? onSector(hits[0]) : onStart())}
            className="btn-primary rounded-xl px-6 py-3 font-semibold transition"
          >
            Find my roof
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.6 } }}
          className="text-sm text-muted"
          aria-hidden
        >
          Or scroll to follow one drop of that storm ↓
        </motion.p>
      </div>
    </header>
  );
}
