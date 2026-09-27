"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// First-visit coach marks: a dimmed backdrop with a spotlight on each target
// (elements marked data-tour="..."), and a small card with Next, Back and
// Skip. Esc closes, focus stays in the card, works down to 390 px.

type Step = { target: string; title: string; body: string };

export const TOUR_STEPS: Step[] = [
  {
    target: "search",
    title: "Search your sector",
    body: "Type your sector, like F-10 or G-11, and the map flies there.",
  },
  {
    target: "map",
    title: "Tap your roof",
    body: "Zoom in until the buildings appear, then tap your house. Its roof area is measured from the map outline.",
  },
  {
    target: "storms",
    title: "Pick a real storm",
    body: "Each storm was measured at real rain gauges. We use the gauge closest to your roof.",
  },
  {
    target: "replay",
    title: "Replay it and follow the water",
    body: "Watch the storm fall on your roof and see how much fills your tank, goes to a recharge well or runs to the drain.",
  },
];

type Box = { top: number; left: number; width: number; height: number };
const PAD = 8;

export default function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [view, setView] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion() ?? false;
  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;

  // Ask the phone sheet to show the step holding the target, then find the
  // target, bring it into view (panels scroll on phones) and measure.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("rg-tour-step", { detail: step.target }));
    let el: HTMLElement | null = null;
    const measure = () => {
      setView({ w: window.innerWidth, h: window.innerHeight });
      el ??= document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      // Clip to the screen, and light only the top of tall sections so the
      // card still fits beside the spotlight on small phones.
      const top = Math.max(4, r.top - PAD);
      const bottom = Math.min(window.innerHeight - 4, r.bottom + PAD, top + 260);
      setBox({ top, left: r.left - PAD, width: r.width + PAD * 2, height: Math.max(40, bottom - top) });
    };
    const find = window.setTimeout(() => {
      el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    }, 60);
    const t = window.setTimeout(measure, reduced ? 120 : 480);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(find);
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [step.target, reduced]);

  useEffect(() => () => void window.dispatchEvent(new Event("rg-tour-end")), []);

  useEffect(() => {
    next.current?.focus();
  }, [i]);

  // Esc closes; Tab stays inside the card; arrows step through.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" && !last) setI((v) => v + 1);
      else if (e.key === "ArrowLeft" && i > 0) setI((v) => v - 1);
      else if (e.key === "Tab" && card.current) {
        const items = [...card.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
        if (!items.length) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [i, last, onClose]);

  // Card beside the spotlight: below if there's room, else above, else pinned
  // to the bottom of the screen (small phones).
  const cardW = Math.min(340, view.w - 24);
  const cardH = 200; // generous estimate of the card's height
  let cardStyle: { left: number; top: number };
  if (box && view.h - (box.top + box.height) > cardH + 16) {
    cardStyle = { left: clampX(box.left, cardW, view.w), top: box.top + box.height + 12 };
  } else if (box && box.top > cardH + 16) {
    cardStyle = { left: clampX(box.left, cardW, view.w), top: box.top - cardH - 12 };
  } else {
    cardStyle = { left: (view.w - cardW) / 2, top: Math.max(12, view.h - cardH - 16) };
  }
  const ease = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 30 };

  return (
    <motion.div
      className="fixed inset-0 z-[60]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.25 }}
    >
      {/* Blocks the app underneath while the tour is open. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} aria-hidden />
      {box ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-2 ring-tank"
          style={{ boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)" }}
          initial={false}
          animate={box}
          transition={ease}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-slate-900/45" />
      )}
      <motion.div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rg-tour-title"
        aria-describedby="rg-tour-body"
        className="glass panel-sheen absolute rounded-2xl p-4"
        style={{ width: cardW }}
        initial={false}
        animate={cardStyle}
        transition={ease}
      >
        <p className="num text-[11px] text-tank-deep">
          {i + 1} of {TOUR_STEPS.length}
        </p>
        <h2 id="rg-tour-title" className="mt-1 text-base font-semibold text-fg">
          {step.title}
        </h2>
        <p id="rg-tour-body" className="mt-1 text-sm leading-snug text-muted">
          {step.body}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={onClose} className="mr-auto rounded-lg px-2 py-2 text-sm text-muted hover:text-fg">
            Skip
          </button>
          <button
            type="button"
            onClick={() => setI((v) => v - 1)}
            disabled={i === 0}
            className="rounded-lg border border-line px-3 py-2 text-sm transition hover:border-tank/60 disabled:opacity-40"
          >
            Back
          </button>
          <button
            ref={next}
            type="button"
            onClick={() => (last ? onClose() : setI((v) => v + 1))}
            className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
          >
            {last ? "Done" : "Next"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function clampX(x: number, w: number, vw: number) {
  return Math.max(12, Math.min(vw - w - 12, x));
}
