"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "framer-motion";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { roofDisplayLabel } from "@/lib/explain";
import { REPORT_TABS, REPORT_TAB_LABEL } from "@/lib/report";
import { nearestSector } from "@/lib/whatsapp";
import TankerCompare from "../act/TankerCompare";
import { GaugeBadge } from "../RainBits";
import InstallTab from "./InstallTab";
import OverviewTab from "./OverviewTab";
import StreetTab from "./StreetTab";
import type { ReportProps } from "./types";
import WaterTab from "./WaterTab";

const EASE = [0.22, 1, 0.36, 1] as const;

// The Rain Report: a full-screen page over the map, one section at a time.
// Lazy-loaded (see RainGridApp). Close with X, Escape, the browser's back
// button or, on phones, a swipe down on the header. Animations use only
// transform and opacity.
export default function RainReport(p: ReportProps) {
  const reduced = useReducedMotion();
  const drag = useDragControls();
  const scroller = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const { onClose } = p;

  // Focus moves in on open and back to the opener on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    return () => prev?.focus?.();
  }, []);

  // Escape closes, unless a dialog opened from the Report is on top.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelectorAll('[aria-modal="true"]').length > 1) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A new section starts at its top, with its tab in view (phones scroll
  // the tab bar sideways).
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    document.getElementById(`report-tab-${p.tab}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [p.tab]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  const onTabKey = (e: ReactKeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = REPORT_TABS.indexOf(p.tab);
    const next = REPORT_TABS[(i + (e.key === "ArrowRight" ? 1 : REPORT_TABS.length - 1)) % REPORT_TABS.length];
    p.setTab(next);
    document.getElementById(`report-tab-${next}`)?.focus();
  };

  const sector = nearestSector(p.roof.lat, p.roof.lng);
  const roofName = roofDisplayLabel(p.roof.label, p.roof.areaM2, p.roof.source);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Your Rain Report"
      className="fixed inset-0 z-[45] bg-ink"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: reduced ? 0.15 : 0.35, ease: EASE }}
      drag={reduced ? false : "y"}
      dragControls={drag}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={onDragEnd}
    >
      <div ref={scroller} className="h-full overflow-y-auto overscroll-contain">
        <header
          className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur"
          onPointerDown={(e) => e.pointerType === "touch" && drag.start(e)}
          style={{ touchAction: "pan-x" }}
        >
          <span aria-hidden className="mx-auto mt-1.5 block h-1 w-10 rounded-full bg-muted/40 md:hidden" />
          <div className="mx-auto flex max-w-3xl items-start gap-3 px-4 pb-2 pt-2 md:pt-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-tank-deep">Your Rain Report</p>
              <h2 className="mt-0.5 truncate text-lg font-semibold text-fg md:text-xl">
                {roofName}
                {sector && <span className="font-normal text-muted"> · near {sector}</span>}
                <span className="num font-normal text-muted"> · {Math.round(p.roof.areaM2).toLocaleString("en-US")} m²</span>
              </h2>
              <p className="mt-0.5 text-[13px] text-fg">
                {p.rain.label} · <span className="num font-semibold text-tank-deep">{p.rain.mm.toLocaleString("en-US")} mm</span>
                {p.rain.km != null && <GaugeBadge km={p.rain.km} />}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={p.copyReportLink}
                className="hidden rounded-lg border border-line px-3 py-1.5 text-xs text-fg transition hover:border-tank/60 sm:block"
              >
                Copy link
              </button>
              <button
                ref={closeBtn}
                onClick={onClose}
                aria-label="Close the report and go back to the map"
                className="grid h-10 w-10 place-items-center rounded-full text-lg text-fg transition hover:bg-tank/10"
              >
                ✕
              </button>
            </div>
          </div>
          <nav className="mx-auto max-w-3xl overflow-x-auto px-2 [scrollbar-width:none]">
            <div role="tablist" aria-label="Report sections" className="flex min-w-max gap-1 pb-2" onKeyDown={onTabKey}>
              {REPORT_TABS.map((t) => {
                const on = t === p.tab;
                return (
                  <button
                    key={t}
                    id={`report-tab-${t}`}
                    role="tab"
                    aria-selected={on}
                    aria-controls="report-panel"
                    tabIndex={on ? 0 : -1}
                    onClick={() => p.setTab(t)}
                    className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      on ? "text-fg" : "text-muted hover:text-fg"
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId={reduced ? undefined : "report-tab-pill"}
                        className="absolute inset-0 rounded-full bg-tank/12 ring-1 ring-tank/40"
                        transition={{ duration: 0.25, ease: EASE }}
                      />
                    )}
                    <span className="relative">{REPORT_TAB_LABEL[t]}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </header>

        <div id="report-panel" role="tabpanel" aria-labelledby={`report-tab-${p.tab}`} className="mx-auto max-w-3xl px-4 pb-10 pt-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={p.tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {p.tab === "overview" && <OverviewTab result={p.result} setTab={p.setTab} />}
              {p.tab === "water" && <WaterTab result={p.result} />}
              {p.tab === "money" && <TankerCompare stored={p.result.split.tank} harvestable={p.result.net.mid} />}
              {p.tab === "street" && (
                <StreetTab
                  roofs={p.roofs}
                  street={p.street}
                  onAddNeighbours={p.onAddNeighbours}
                  invite={p.invite}
                  share={p.share}
                  onPledgeVisit={() => p.setTab("install")}
                />
              )}
              {p.tab === "install" && (
                <InstallTab
                  result={p.result}
                  onQuoteChoice={p.onQuoteChoice}
                  onRoofCheck={p.onRoofCheck}
                  onRequestVisit={p.onRequestVisit}
                  onBecomeInstaller={p.onBecomeInstaller}
                />
              )}
            </motion.div>
          </AnimatePresence>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
            <button onClick={p.openSources} className="underline underline-offset-4 hover:text-tank">
              How we calculate, and every source
            </button>
            <button onClick={p.copyReportLink} className="underline underline-offset-4 hover:text-tank sm:hidden">
              Copy a link to this report
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
