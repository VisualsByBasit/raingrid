"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SourceRef } from "@/lib/sources";

// A small (i) next to a number: how it was worked out and where its inputs
// come from, from the same list as the Sources drawer (src/lib/sources.ts).
// Unlike the Guide's "?" hints it is always shown. Click or focus opens it,
// so its links can be followed; Escape, a tap elsewhere or scrolling closes.
export default function SourceTip({ method, sources, label = "Where does this number come from?" }: { method?: string; sources: SourceRef[]; label?: string }) {
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const id = useId();
  const open = pos !== null;

  const show = () => {
    const el = btn.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(300, vw - 24);
    const left = Math.max(12, Math.min(vw - width - 12, r.left + r.width / 2 - width / 2));
    setPos(vh - r.bottom > 220 ? { left, width, top: r.bottom + 8 } : { left, width, bottom: vh - r.top + 8 });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    // Escape closes the tip only, not the Report around it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
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

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (open) setPos(null);
          else show();
        }}
        className="mx-1 inline-grid h-4 w-4 translate-y-[-1px] place-items-center rounded-full bg-tank/10 align-middle font-serif text-[10px] font-semibold italic leading-none text-tank-deep transition hover:bg-tank/20 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tank-deep"
      >
        i
      </button>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {pos && (
              <motion.div
                ref={bubble}
                id={id}
                role="dialog"
                aria-label="Source"
                initial={{ opacity: 0, y: pos.top !== undefined ? -4 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
                className="z-[70] rounded-xl border border-line bg-panel px-3 py-2.5 text-xs leading-relaxed text-fg shadow-lg"
              >
                {method && <p className="num text-[11px] text-fg">{method}</p>}
                <ul className={`space-y-1 text-muted ${method ? "mt-2 border-t border-line pt-2" : ""}`}>
                  {sources.map((s) => (
                    <li key={s.label}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-tank">
                          {s.label} ↗
                        </a>
                      ) : (
                        s.label
                      )}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
