"use client";

import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { useRef, useState, type RefObject } from "react";
import StoryScene, { type SceneMode } from "./StoryScene";
import { BEATS, OUTCOME, STORY_BEATS, type StoryMode } from "./copy";

// The scroll story, about three screens long: sun, clouds, rain on a roof,
// then "Today" (to the nalah) or "RainGrid" (caught). The scene is pinned
// while the page scrolls past it. Reduced motion gets a static version: the
// rained-on street, every caption, and the same switch, with nothing pinned.
export default function Story({
  container,
  onFindRoof,
}: {
  container: RefObject<HTMLElement | null>;
  onFindRoof: () => void;
}) {
  const reduced = useReducedMotion() ?? false;
  return reduced ? <StaticStory onFindRoof={onFindRoof} /> : <ScrollStory container={container} onFindRoof={onFindRoof} />;
}

function ScrollStory({ container, onFindRoof }: { container: RefObject<HTMLElement | null>; onFindRoof: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ container, target: ref, offset: ["start start", "end end"] });
  const [beat, setBeat] = useState(0);
  const [mode, setMode] = useState<StoryMode>("today");
  const beatRef = useRef(0);

  // Scroll drives the scene through motion values; React state only changes
  // when the beat changes.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const b = Math.min(BEATS - 1, Math.max(0, Math.floor(v * BEATS * 1.05)));
    if (b !== beatRef.current) {
      beatRef.current = b;
      setBeat(b);
    }
  });

  const sceneMode: SceneMode = beat < BEATS - 1 ? "none" : mode;
  const last = beat === BEATS - 1;

  return (
    <section ref={ref} className="relative" style={{ height: `${BEATS * 100}dvh` }} aria-label="The story of the rain on one street">
      <div className="sticky top-0 h-dvh overflow-hidden bg-[var(--scene-sky-mid)]">
        <div className="absolute inset-0">
          <StoryScene drive={scrollYProgress} mode={sceneMode} animate />
        </div>

        <ol className="absolute right-3 top-[22%] flex flex-col gap-2 md:top-1/2 md:-translate-y-1/2" aria-hidden>
          {Array.from({ length: BEATS }, (_, i) => (
            <li
              key={i}
              className={`h-2 w-2 rounded-full border border-tank-deep/40 transition ${i === beat ? "scale-125 bg-tank-deep" : "bg-panel/70"}`}
            />
          ))}
        </ol>

        <div className="absolute inset-x-4 top-4 mx-auto max-w-md md:inset-x-auto md:left-10 md:top-1/2 md:w-[23rem] md:-translate-y-1/2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={beat}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="glass panel-sheen rounded-2xl p-4"
              aria-live="polite"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-tank-deep">{STORY_BEATS[beat].title}</p>
              {last ? (
                <Outcome mode={mode} setMode={setMode} onFindRoof={onFindRoof} />
              ) : (
                <>
                  <p className="mt-1 text-[15px] leading-snug text-fg">{STORY_BEATS[beat].body}</p>
                  {beat === 0 && <p className="mt-2 text-xs text-muted">Scroll to bring the rain.</p>}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function StaticStory({ onFindRoof }: { onFindRoof: () => void }) {
  const [mode, setMode] = useState<StoryMode>("today");
  const still = useMotionValue(1);
  return (
    <section className="relative" aria-label="The story of the rain on one street">
      <div className="relative h-[70dvh] min-h-[420px] overflow-hidden bg-[var(--scene-sky-mid)]">
        <StoryScene drive={still} mode={mode} animate={false} />
      </div>
      <div className="relative mx-auto -mt-4 grid max-w-5xl items-start gap-3 px-5 md:grid-cols-3">
        {STORY_BEATS.map((b, i) => (
          <div key={b.title} className="glass panel-sheen relative rounded-2xl p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-tank-deep">{b.title}</p>
            {i < BEATS - 1 ? (
              <p className="mt-1 text-[15px] leading-snug text-fg">{b.body}</p>
            ) : (
              <Outcome mode={mode} setMode={setMode} onFindRoof={onFindRoof} />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Outcome({ mode, setMode, onFindRoof }: { mode: StoryMode; setMode: (m: StoryMode) => void; onFindRoof: () => void }) {
  return (
    <>
      <div role="radiogroup" aria-label="Where the water goes" className="mt-2 inline-flex rounded-full border border-line bg-panel p-0.5 text-sm font-medium">
        {(["today", "raingrid"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tank-deep ${
              mode === m ? (m === "today" ? "bg-drain/15 text-drain-deep" : "btn-primary") : "text-muted hover:text-fg"
            }`}
          >
            {m === "today" ? "Today" : "RainGrid"}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[15px] leading-snug text-fg">{OUTCOME[mode]}</p>
      <button onClick={onFindRoof} className="btn-primary mt-4 w-full rounded-xl px-5 py-3 font-semibold">
        See what your roof can do
      </button>
    </>
  );
}
