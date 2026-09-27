"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGuide } from "./GuideContext";

// A small "?" that opens a plain-language explanation. The bubble is
// rendered in a portal with fixed positioning so the scrolling panel can't
// clip it. Opens on tap/click, hover or keyboard focus; Esc or a tap
// elsewhere closes it. Hidden when the Guide switch is off.
export default function Hint({ text, label = "What does this mean?" }: { text: string; label?: string }) {
  const { on } = useGuide();
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  // Hover and focus preview the bubble; a click pins it until dismissed.
  const pinned = useRef(false);
  const id = useId();
  const open = pos !== null;

  const show = () => {
    const el = btn.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(260, vw - 24);
    const left = Math.max(12, Math.min(vw - width - 12, r.left + r.width / 2 - width / 2));
    setPos(vh - r.bottom > 140 ? { left, width, top: r.bottom + 8 } : { left, width, bottom: vh - r.top + 8 });
  };
  const hide = () => {
    pinned.current = false;
    setPos(null);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => {
      pinned.current = false;
      setPos(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !bubble.current?.contains(t)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  if (!on) return null;
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          // Inside a storm card (a label), don't select the card.
          e.stopPropagation();
          if (open && pinned.current) {
            hide();
          } else {
            show();
            pinned.current = true;
          }
        }}
        onMouseEnter={show}
        onMouseLeave={() => {
          if (!pinned.current) hide();
        }}
        onFocus={show}
        onBlur={hide}
        className="mx-1 inline-grid h-4 w-4 translate-y-[-1px] place-items-center rounded-full border border-tank-deep/40 bg-panel align-middle text-[10px] font-semibold leading-none text-tank-deep transition hover:bg-tank/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tank-deep"
      >
        ?
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {pos && (
              <motion.div
                ref={bubble}
                id={id}
                role="tooltip"
                initial={{ opacity: 0, y: pos.top !== undefined ? -4 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
                className="z-[70] rounded-xl border border-line bg-panel px-3 py-2 text-xs leading-relaxed text-fg shadow-lg"
              >
                {text}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
