"use client";

import { animate, AnimatePresence, motion, useMotionValue, type PanInfo } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatL, roundL } from "@/lib/engine";
import { roofDisplayLabel } from "@/lib/explain";
import { useCountUp } from "@/lib/useCountUp";
import { GuideToggle } from "./guide/GuideContext";
import ResultPanel, { type ResultPanelProps, type StepNo } from "./ResultPanel";

// Phones (< 768 px): the results live in a bottom sheet, one step at a time,
// so the map stays big. Three snap heights (peek, half, full) with a drag
// handle; the height is a motion value (no React state per frame) and is
// published as --sheet-h so map controls, toasts and the tour sit above it.

type Snap = "peek" | "half" | "full";
const PEEK_PX = 92;
const SPRING = { type: "spring" as const, stiffness: 380, damping: 38 };
const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS: { n: StepNo; title: string }[] = [
  { n: 1, title: "Your roof" },
  { n: 2, title: "Pick a storm" },
  { n: 3, title: "Your setup" },
  { n: 4, title: "Replay it" },
  { n: 5, title: "Your street" },
];

function snapPx(snap: Snap): number {
  const h = window.innerHeight;
  return snap === "peek" ? PEEK_PX : snap === "half" ? Math.round(h * 0.42) : Math.round(h * 0.85);
}

export default function PhoneSheet({ panel, stormPicked, onStormPicked }: { panel: ResultPanelProps; stormPicked: boolean; onStormPicked: () => void }) {
  const [step, setStep] = useState<StepNo>(1);
  const [snap, setSnapState] = useState<Snap>("half");
  const [pulse, setPulse] = useState(false);
  const [seenRoof, setSeenRoof] = useState(panel.active?.id ?? null);
  const [seenPhase, setSeenPhase] = useState(panel.phase);
  const height = useMotionValue(snapPx("half"));
  const snapRef = useRef<Snap>("half");
  const dragStart = useRef(0);

  const hasRoof = Boolean(panel.active && panel.result);
  // Why a step can't be opened yet (null when it can).
  const blocked = (n: StepNo): string | null => {
    if (n === 1) return null;
    if (!hasRoof) return "Pick a roof first";
    if (n === 4 && !stormPicked) return "Pick a storm first";
    if (n === 5 && panel.phase !== "done") return "Replay the storm first";
    return null;
  };

  // A roof was just picked: offer the next step and pulse the arrow (no
  // auto-jump). Adjusted during render, React's pattern for derived state.
  const activeId = panel.active?.id ?? null;
  if (activeId !== seenRoof) {
    setSeenRoof(activeId);
    if (activeId && step === 1) setPulse(true);
  }
  // Replay: drop to peek so the rain on the map is visible, then spring back
  // to half with the result when it finishes.
  const phase = panel.phase;
  if (phase !== seenPhase) {
    setSeenPhase(phase);
    if (phase === "raining") setSnapState("peek");
    else if (phase === "done" && seenPhase === "raining") setSnapState("half");
  }

  // The snap state drives the height spring.
  useEffect(() => {
    snapRef.current = snap;
    const a = animate(height, snapPx(snap), SPRING);
    return () => a.stop();
  }, [snap, height]);

  const setSnap = useCallback(
    (s: Snap) => {
      snapRef.current = s;
      setSnapState(s);
      // Same snap as before (e.g. a short drag): spring back explicitly.
      animate(height, snapPx(s), SPRING);
    },
    [height],
  );

  const go = (n: StepNo) => {
    if (blocked(n)) return;
    setPulse(false);
    setStep(n);
    if (snapRef.current === "peek") setSnap("half");
  };

  // Publish the sheet height for map controls, toast and tour target.
  useEffect(() => {
    const root = document.documentElement;
    const write = (v: number) => root.style.setProperty("--sheet-h", `${Math.round(v)}px`);
    write(height.get());
    const off = height.on("change", write);
    const onResize = () => height.set(snapPx(snapRef.current));
    window.addEventListener("resize", onResize);
    return () => {
      off();
      window.removeEventListener("resize", onResize);
      root.style.removeProperty("--sheet-h");
    };
  }, [height]);

  // The guided tour asks for the step that holds its target.
  const tourReturn = useRef<{ step: StepNo; snap: Snap } | null>(null);
  useEffect(() => {
    const onStep = (e: Event) => {
      const target = (e as CustomEvent<string>).detail;
      const want: StepNo | null = target === "storms" ? 2 : target === "replay" ? 4 : null;
      tourReturn.current ??= { step, snap: snapRef.current };
      if (want) {
        setStep(want);
        setSnap("half");
      } else if (target === "map") {
        setSnap("peek");
      } else {
        setSnap("half");
      }
    };
    const onEnd = () => {
      const back = tourReturn.current;
      tourReturn.current = null;
      if (!back) return;
      setStep(back.step);
      setSnap(back.snap);
    };
    window.addEventListener("rg-tour-step", onStep);
    window.addEventListener("rg-tour-end", onEnd);
    return () => {
      window.removeEventListener("rg-tour-step", onStep);
      window.removeEventListener("rg-tour-end", onEnd);
    };
  }, [step, setSnap]);

  // Drag the handle/header between snaps; a little elastic past the ends.
  const onPanStart = () => {
    height.stop();
    dragStart.current = height.get();
  };
  const onPan = (_: unknown, info: PanInfo) => {
    const lo = snapPx("peek");
    const hi = snapPx("full");
    const raw = dragStart.current - info.offset.y;
    height.set(raw > hi ? hi + (raw - hi) * 0.1 : raw < lo ? lo - (lo - raw) * 0.1 : raw);
  };
  const onPanEnd = (_: unknown, info: PanInfo) => {
    const projected = height.get() - info.velocity.y * 0.2;
    const order: Snap[] = ["peek", "half", "full"];
    const best = order.reduce((a, b) => (Math.abs(snapPx(b) - projected) < Math.abs(snapPx(a) - projected) ? b : a));
    setSnap(best);
  };

  // Swipe left/right on the content changes step (not from inputs/sliders).
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: ReactPointerEvent) => {
    const t = e.target as HTMLElement;
    swipe.current = t.closest("input, textarea, select, [role='slider'], [data-no-swipe]") ? null : { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = (step + (dx < 0 ? 1 : -1)) as StepNo;
    if (next >= 1 && next <= 5) go(next);
  };

  const prev = step > 1 ? ((step - 1) as StepNo) : null;
  const next = step < 5 ? ((step + 1) as StepNo) : null;
  const nextBlocked = next ? blocked(next) : "Last step";
  const title = STEPS[step - 1].title;

  return (
    <motion.section
      aria-label="Your rain steps"
      className="glass panel-sheen sheet fixed inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-3xl"
      style={{ height }}
    >
      {/* Handle + header: drag to resize. */}
      <motion.div onPanStart={onPanStart} onPan={onPan} onPanEnd={onPanEnd} className="shrink-0 touch-none select-none px-2 pt-1.5">
        <button
          type="button"
          aria-label={`Panel size: ${snap}. Tap to change.`}
          onClick={() => setSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "peek")}
          className="mx-auto block h-4 w-16"
        >
          <span className="mx-auto block h-1 w-10 rounded-full bg-muted/40" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={prev ? `Previous step: ${STEPS[prev - 1].title}` : "Previous step"}
            disabled={!prev}
            onClick={() => prev && go(prev)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg text-fg transition disabled:opacity-30"
          >
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold text-fg">
              <span className="num mr-1.5 text-xs text-tank-deep">{String(step).padStart(2, "0")}</span>
              {title}
            </p>
            <div className="mt-1 flex justify-center gap-1.5" role="tablist" aria-label="Steps">
              {STEPS.map((s) => {
                const why = blocked(s.n);
                return (
                  <button
                    key={s.n}
                    type="button"
                    role="tab"
                    aria-selected={s.n === step}
                    aria-label={`Step ${s.n}: ${s.title}${why ? ` (${why})` : ""}`}
                    disabled={Boolean(why)}
                    onClick={() => go(s.n)}
                    className="grid h-5 w-5 place-items-center"
                  >
                    <span
                      className={`block h-1.5 rounded-full transition-all ${
                        s.n === step ? "w-4 bg-tank" : why ? "w-1.5 bg-muted/30" : "w-1.5 bg-tank-deep/50"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            aria-label={next ? `Next step: ${STEPS[next - 1].title}${nextBlocked ? ` (${nextBlocked})` : ""}` : "Next step"}
            disabled={Boolean(nextBlocked)}
            onClick={() => next && go(next)}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition disabled:opacity-30 ${
              pulse && !nextBlocked ? "animate-pulse bg-tank/15 text-tank-deep" : "text-fg"
            }`}
          >
            ›
          </button>
        </div>
        <KeyLine panel={panel} step={step} blockedHint={nextBlocked && next && step > 1 ? nextBlocked : null} />
      </motion.div>

      {/* One step at a time. */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-3 [touch-action:pan-y]"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <ResultPanel {...panel} only={step} />
            <NextButton
              step={step}
              panel={panel}
              blocked={blocked}
              onGo={(n) => {
                if (step === 2) onStormPicked();
                go(n);
              }}
            />
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 flex items-center justify-between border-t border-line pt-3">
          <button onClick={panel.openSources} className="text-xs text-muted underline underline-offset-4">
            How we calculate
          </button>
          <GuideToggle />
        </div>
      </div>
    </motion.section>
  );
}

// "Next: pick a storm →" style buttons under each step.
function NextButton({
  step,
  panel,
  blocked,
  onGo,
}: {
  step: StepNo;
  panel: ResultPanelProps;
  blocked: (n: StepNo) => string | null;
  onGo: (n: StepNo) => void;
}) {
  const next: Record<StepNo, { to: StepNo; label: string } | null> = {
    1: panel.active ? { to: 2, label: "Next: pick a storm" } : null,
    2: panel.active ? { to: 3, label: "Next: your setup" } : null,
    3: panel.active ? { to: 4, label: "Next: replay it" } : null,
    4: panel.phase === "done" ? { to: 5, label: "Next: your street" } : null,
    5: null,
  };
  const n = next[step];
  // Step 2 -> 3 also confirms the storm, so it is never blocked by it.
  if (!n || (step !== 2 && blocked(n.to))) return null;
  return (
    <button type="button" onClick={() => onGo(n.to)} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold">
      {n.label} →
    </button>
  );
}

// The one line that stays visible in the peek state.
function KeyLine({ panel, step, blockedHint }: { panel: ResultPanelProps; step: StepNo; blockedHint: string | null }) {
  const raining = panel.phase === "raining";
  let text: string;
  if (raining && panel.result) return <LiveLitres gross={panel.result.gross} />;
  if (step === 1) {
    text = panel.active
      ? `${roofDisplayLabel(panel.active.label, panel.active.areaM2, panel.active.source)} · ${panel.active.areaM2.toLocaleString("en-US")} m²`
      : "Tap your roof on the map, or draw it";
  } else if (step === 2) {
    text = `${panel.rain.mm.toLocaleString("en-US")} mm · ${panel.rain.label}`;
  } else if (step === 3) {
    text = `${panel.setup.tankLitres.toLocaleString("en-US")} L tank · ${panel.setup.hasRecharge ? "recharge well" : "no recharge well"}`;
  } else if (step === 4) {
    text = panel.result && panel.phase === "done" ? `${formatL(roundL(panel.result.gross))} landed on this roof` : "Ready to replay the storm";
  } else {
    text = panel.street ? `${panel.street.count} roofs · ${formatL(panel.street.tank)} stored` : "Add your neighbours' roofs";
  }
  return (
    <p className="truncate px-2 pb-1 text-center text-xs text-muted" aria-live="polite">
      {text}
      {blockedHint && <span className="text-muted/80"> · Next: {blockedHint.toLowerCase()}</span>}
    </p>
  );
}

function LiveLitres({ gross }: { gross: number }) {
  const v = useCountUp(gross, 3800, true);
  return (
    <p className="px-2 pb-1 text-center text-xs text-muted" aria-live="off">
      <span className="num text-sm font-semibold text-tank-deep">{roundL(v).toLocaleString("en-US")} L</span> landing on your roof
    </p>
  );
}
