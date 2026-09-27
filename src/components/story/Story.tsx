"use client";

import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { useEffect, useRef, useState, type RefObject } from "react";
import StoryScene, { type SceneMode } from "./StoryScene";
import { BEATS, caption } from "./copy";

// With reduced motion each beat is a still frame, taken at these points.
const SNAPSHOT = [0.06, 0.27, 0.4, 0.54, 0.66, 0.8, 0.94];

export default function Story({
  container,
  onFindRoof,
}: {
  container: RefObject<HTMLElement | null>;
  onFindRoof: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ container, target: ref, offset: ["start start", "end end"] });
  const drive = useMotionValue(0);
  const [beat, setBeat] = useState(0);
  const [caught, setCaught] = useState(false);
  const beatRef = useRef(0);

  // Scroll drives the scene through motion values; React state only changes
  // when the beat changes.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const b = Math.min(BEATS - 1, Math.max(0, Math.floor(v * BEATS)));
    if (b !== beatRef.current) {
      beatRef.current = b;
      setBeat(b);
    }
    if (!reduced) drive.set(v);
  });
  useEffect(() => {
    drive.set(reduced ? SNAPSHOT[beat] : scrollYProgress.get());
  }, [reduced, beat, drive, scrollYProgress]);

  const mode: SceneMode = beat < 4 ? "none" : beat === 4 ? "today" : caught ? "caught" : "today";
  const text = caption(beat, caught);
  const captionOnTop = beat >= 3;

  return (
    <section ref={ref} className="relative" style={{ height: `${BEATS * 110}dvh` }} aria-label="The story of one rain drop">
      <div className="sticky top-0 h-dvh overflow-hidden">
        {reduced ? (
          <AnimatePresence initial={false}>
            <motion.div
              key={beat}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <StoryScene drive={drive} mode={mode} animate={false} />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="absolute inset-0">
            <StoryScene drive={drive} mode={mode} animate />
          </div>
        )}

        {/* Beat dots */}
        <ol className="absolute right-3 top-[22%] flex flex-col gap-2 md:top-1/2 md:-translate-y-1/2" aria-hidden>
          {Array.from({ length: BEATS }, (_, i) => (
            <li
              key={i}
              className={`h-2 w-2 rounded-full border border-tank-deep/40 transition ${i === beat ? "scale-125 bg-tank-deep" : "bg-panel/70"}`}
            />
          ))}
        </ol>

        {beat < BEATS - 1 ? (
          <div
            className={`absolute inset-x-4 mx-auto max-w-md md:inset-x-auto md:left-10 md:top-1/2 md:bottom-auto md:w-[22rem] md:-translate-y-1/2 ${
              captionOnTop ? "top-4" : "bottom-6"
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${beat}-${beat === 5 && caught}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="glass panel-sheen rounded-2xl p-4"
                aria-live="polite"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-tank-deep">{text.title}</p>
                <p className="mt-1 text-[15px] leading-snug text-fg">{text.body}</p>
                {beat === 5 && <CatchSwitch caught={caught} onChange={setCaught} />}
                {beat === 0 && <p className="mt-2 text-xs text-muted">Scroll to follow the rain.</p>}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="absolute inset-x-4 top-1/2 mx-auto max-w-sm -translate-y-1/2">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="glass panel-sheen rounded-3xl p-6 text-center"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-tank-deep">{text.title}</p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight text-fg">See what your roof can do</h2>
              <p className="mt-2 text-sm text-muted">{text.body}</p>
              <button onClick={onFindRoof} className="btn-primary mt-5 w-full rounded-xl px-5 py-3 font-semibold transition">
                Find my roof
              </button>
            </motion.div>
          </div>
        )}
      </div>
    </section>
  );
}

function CatchSwitch({ caught, onChange }: { caught: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={caught}
      aria-label="Catch the rain"
      onClick={() => onChange(!caught)}
      className="mt-3 flex items-center gap-3 rounded-full text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tank-deep"
    >
      <span className={caught ? "text-muted" : "text-fg"}>Today</span>
      <span
        className={`relative inline-flex h-7 w-12 items-center rounded-full border border-line transition-colors ${
          caught ? "btn-primary" : "bg-panel"
        }`}
      >
        <span
          className={`absolute left-0.5 h-6 w-6 rounded-full bg-panel shadow transition-transform ${caught ? "translate-x-5" : ""}`}
        />
      </span>
      <span className={caught ? "text-ground-deep" : "text-muted"}>Caught</span>
    </button>
  );
}
