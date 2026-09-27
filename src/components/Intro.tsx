"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import type { Sector } from "@/data/sectors";
import Hero from "./landing/Hero";
import Story from "./story/Story";
import WhyIslamabad from "./story/WhyIslamabad";

// The landing: hero, a pinned scroll story, why Islamabad, and sources. One
// scrollable page inside the intro overlay.
export default function Intro({
  ready,
  onStart,
  onSector,
  onSources,
  onFindRoof,
}: {
  // False while the loader is still on screen.
  ready: boolean;
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
      // Fades out over the map's fly-in, so the city appears underneath.
      exit={{ opacity: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }}
      className="bg-landing absolute inset-0 z-30 overflow-y-auto overflow-x-hidden"
    >
      <Hero ready={ready} scroller={scroller} onStart={onStart} onSector={onSector} onSources={onSources} />
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
