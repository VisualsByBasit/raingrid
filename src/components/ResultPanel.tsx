"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GAUGES, ISLAMABAD_STORMS, PRESETS, nearestReading } from "@/data/storms";
import { formatL, roundL, tankWhatIf, type RainResult, type RoofType, type RoofTypeSpec } from "@/lib/engine";
import { gaugeLabel, isLargeComplex, largeComplexNotice, measuredAt, roofDisplayLabel, tanksLine } from "@/lib/explain";
import type { Roof } from "@/lib/roof";
import type { StormChoice } from "@/lib/share";
import { useCountUp } from "@/lib/useCountUp";
import type { Setup } from "./RainGridApp";
import { RECHARGE_SUITABILITY, RainLine, TankIcon } from "./RainBits";
import { GuideToggle } from "./guide/GuideContext";
import Hint from "./guide/Hint";

// The side panel (and, one step at a time, the phone sheet): only what it
// takes to get a result. Everything after the replay lives in the Rain
// Report (src/components/report).

export type StepNo = 1 | 2 | 3 | 4;

export interface ResultPanelProps {
  roofs: Roof[];
  active: Roof | null;
  setActiveId: (id: string) => void;
  mode: "pick" | "draw";
  setMode: (m: "pick" | "draw") => void;
  drawPoints: [number, number][];
  finishDraw: () => void;
  undoDraw: () => void;
  typedArea: string;
  setTypedArea: (v: string) => void;
  addTyped: () => void;
  updateArea: (id: string, a: number) => void;
  removeRoof: (id: string) => void;
  choice: StormChoice;
  setChoice: (c: StormChoice) => void;
  rain: { mm: number; label: string; where: string; km?: number };
  setup: Setup;
  setSetup: (s: Setup) => void;
  result: RainResult | null;
  phase: "idle" | "raining" | "done";
  replay: () => void;
  openReport: () => void;
  // Opened from a street link and the visitor hasn't added their roof yet.
  joining: boolean;
  onRoofCheck: () => void;
  openSources: () => void;
  roofTypes: Record<RoofType, RoofTypeSpec>;
  // Phone stepper: render only this step, without its heading (the sheet
  // header shows it).
  only?: StepNo;
}
type Props = ResultPanelProps;

const Step = ({
  n,
  title,
  tour,
  bare,
  children,
}: {
  n: string;
  title: string;
  tour?: string;
  bare?: boolean;
  children: React.ReactNode;
}) =>
  bare ? (
    <section data-tour={tour} aria-label={title}>
      {children}
    </section>
  ) : (
    <section data-tour={tour} className="border-b border-line py-4 first:pt-0 last:border-0">
      <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold">
        <span className="num text-xs text-tank">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );

const btn = "rounded-lg border border-line px-3 py-2 text-sm transition hover:border-tank/60 hover:text-fg";

const SETUP_HINTS = {
  tank: "The water tank your house has. One 2,000 L tank is common. Change it to match yours.",
  recharge: "A filtered pit that sends overflow into the ground instead of the drain.",
  roof: "Concrete roofs lose more water than metal sheets. Not sure? Pick Other: the range gets wider instead of guessing.",
  share: "Part of the roof lost to the water tank, stair room and parapets.",
};

// Short roof names for the one-line setup summary.
const ROOF_SHORT: Record<RoofType, string> = { rcc: "RCC roof", metal: "Metal roof", other: "Other roof" };

export default function ResultPanel(p: Props) {
  const [customMm, setCustomMm] = useState("");
  // Where the setup editor opens (null: closed), measured on click.
  const [editing, setEditing] = useState<{ place: Place | null } | null>(null);
  const lat = p.active?.lat;
  const lng = p.active?.lng;

  const large = p.active && isLargeComplex(p.active.areaM2, p.active.source) ? p.active : null;
  const bare = p.only !== undefined;
  const show = (n: StepNo) => p.only === undefined || p.only === n;
  const setup = p.setup;
  const summary = [
    ROOF_SHORT[setup.roofType],
    `${Math.round(setup.usableShare * 100)}% usable`,
    setup.tankLitres > 0 ? `${setup.tankLitres.toLocaleString("en-US")} L tank` : "no tank",
    setup.hasRecharge ? "recharge well" : "no well",
  ].join(" · ");

  return (
    <div className="text-sm">
      {!bare && (
        <div className="-mt-1 mb-2 flex justify-end">
          <GuideToggle />
        </div>
      )}
      {/* 01 Roof */}
      {show(1) && (
      <Step n="01" title="Your roof" bare={bare}>
        {p.mode === "draw" ? (
          <div className="space-y-2">
            <p className="text-muted">Tap each corner of your roof on the map, then finish.</p>
            <div className="flex gap-2">
              <button className={`${btn} bg-tank/10 text-tank`} disabled={p.drawPoints.length < 3} onClick={p.finishDraw}>
                Finish ({p.drawPoints.length} points)
              </button>
              <button className={btn} onClick={p.undoDraw} disabled={!p.drawPoints.length}>
                Undo
              </button>
              <button className={btn} onClick={() => p.setMode("pick")}>
                Cancel
              </button>
            </div>
          </div>
        ) : p.roofs.length === 0 ? (
          <div className="space-y-3">
            <p className="text-muted">
              Search your sector at the top, zoom in and tap your roof. The area is measured from the building outline.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className={btn} onClick={() => p.setMode("draw")}>
                Roof not on the map? Draw it
              </button>
            </div>
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                value={p.typedArea}
                onChange={(e) => p.setTypedArea(e.target.value.replace(/[^\d.]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && p.addTyped()}
                placeholder="Or type roof area in m²"
                aria-label="Roof area in square metres"
                className="num w-full rounded-lg border border-line bg-ink px-3 py-2 outline-none focus:border-tank"
              />
              <button className={btn} onClick={p.addTyped}>
                Use
              </button>
            </div>
            <p className="text-xs text-muted/80">A 1 kanal house roof is often 250 to 350 m². A 10 marla house, about 150 to 220 m².</p>
          </div>
        ) : (
          <div className="space-y-2">
            {p.joining && (
              <div role="status" className="rounded-lg border border-ground/40 bg-ground/5 p-3 text-[13px] leading-snug text-fg">
                <p className="font-semibold">You opened a street link.</p>
                <p className="mt-0.5">
                  {p.roofs.filter((r) => r.planned).length} of {p.roofs.length} {p.roofs.length === 1 ? "roof here has" : "roofs here have"}{" "}
                  a plan. Tap your own roof on the map to join this street.
                </p>
              </div>
            )}
            {p.roofs.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                  r.id === p.active?.id ? "border-tank/60 bg-tank/5" : "border-line"
                }`}
              >
                <button onClick={() => p.setActiveId(r.id)} className="flex-1 text-left">
                  <span className="font-medium">{roofDisplayLabel(r.label, r.areaM2, r.source)}</span>
                  <span className="ml-2 text-xs text-muted">
                    {r.source === "map" ? "from map outline" : r.source === "drawn" ? "drawn" : "typed"}
                  </span>
                  {r.planned && <span className="ml-1.5 text-xs text-ground-deep">· has a plan</span>}
                </button>
                <input
                  inputMode="numeric"
                  value={r.areaM2}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/\D/g, ""));
                    p.updateArea(r.id, Math.min(100000, v));
                  }}
                  aria-label={`${r.label} area in square metres`}
                  className="num w-20 rounded-md border border-line bg-ink px-2 py-1 text-right outline-none focus:border-tank"
                />
                <span className="text-xs text-muted">m²</span>
                <button onClick={() => p.removeRoof(r.id)} className="px-1 text-muted hover:text-drain" aria-label={`Remove ${r.label}`}>
                  ✕
                </button>
              </div>
            ))}
            {p.active && (
              <button onClick={p.onRoofCheck} className={`${btn} flex w-full items-center justify-center gap-2 bg-tank/5 font-medium text-tank-deep`}>
                Roof check in 3D: mark tank and downpipe spots
              </button>
            )}
            {large ? (
              <div role="status" className="rounded-lg border border-drain/40 bg-drain/5 p-3 text-[13px] leading-snug text-fg">
                <p>{largeComplexNotice(large.areaM2)}</p>
                <button className={`${btn} mt-2 bg-panel`} onClick={() => p.setMode("draw")}>
                  Draw just my roof
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted/80">Area looks off? Edit it. Map outlines come from OpenStreetMap and can be imperfect.</p>
            )}
          </div>
        )}
      </Step>
      )}

      {/* 02 Storm */}
      {show(2) && (
      <Step n="02" title="Pick a real storm" tour="storms" bare={bare}>
        <div className="space-y-2" role="radiogroup" aria-label="Storm">
          {ISLAMABAD_STORMS.map((s) => {
            const r = lat != null && lng != null ? nearestReading(s, lat, lng) : null;
            // Without a roof yet: the storm's highest reading and its gauge.
            const top = Object.entries(s.readings).reduce<[string, number] | null>(
              (best, [id, mm]) => (mm != null && (!best || mm > best[1]) ? [id, mm] : best),
              null,
            );
            const mm = r ? r.mm : (top?.[1] ?? 0);
            const where = r
              ? measuredAt(r.gauge.name, r.km)
              : top
                ? `highest reading, at ${gaugeLabel(GAUGES[top[0]].name)}`
                : "no gauge readings";
            const selected = p.choice.kind === "storm" && p.choice.id === s.id;
            return (
              <label
                key={s.id}
                className={`block w-full cursor-pointer rounded-lg border px-3 py-2.5 text-left transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-tank-deep ${
                  selected ? "border-tank/70 bg-tank/10" : "border-line hover:border-tank/40"
                }`}
              >
                <input
                  type="radio"
                  name="storm"
                  className="sr-only"
                  checked={selected}
                  onChange={() => p.setChoice({ kind: "storm", id: s.id })}
                />
                <span className="block font-medium">{s.dateLabel}</span>
                <RainLine mm={mm} where={where} km={r?.km} className="mt-0.5 text-[13px] text-fg" />
                {/* The story behind a storm only for the one picked, to keep the panel short. */}
                {selected && (
                  <span className="mt-0.5 block text-xs text-muted">
                    {s.title}. {s.blurb}
                  </span>
                )}
              </label>
            );
          })}
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((pr) => {
              const selected = p.choice.kind === "preset" && p.choice.id === pr.id;
              return (
                <button
                  key={pr.id}
                  onClick={() => p.setChoice({ kind: "preset", id: pr.id })}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                    selected ? "border-tank/70 bg-tank/10" : "border-line hover:border-tank/40"
                  }`}
                >
                  <span className="block text-fg">{pr.title}</span>
                  <span className="num text-tank">{pr.mm} mm</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              value={customMm}
              onChange={(e) => setCustomMm(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="Or any amount in mm"
              aria-label="Custom rainfall in millimetres"
              className="num w-full rounded-lg border border-line bg-ink px-3 py-2 outline-none focus:border-tank"
            />
            <button
              className={btn}
              onClick={() => {
                const mm = Math.min(2000, Number(customMm));
                if (Number.isFinite(mm) && mm >= 0 && customMm !== "") p.setChoice({ kind: "custom", mm });
              }}
            >
              Set
            </button>
          </div>
        </div>
      </Step>
      )}

      {/* 03 Setup: one line, edited in a popover */}
      {show(3) && (
      <Step n="03" title="Your setup" bare={bare}>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
          <p className="num min-w-0 text-[13px] leading-snug text-fg">{summary}</p>
          <button
            onClick={(e) => setEditing({ place: popoverPlace(e.currentTarget) })}
            aria-haspopup="dialog"
            aria-expanded={editing !== null}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-tank-deep underline underline-offset-4 hover:bg-tank/10"
          >
            Edit
          </button>
        </div>
        <AnimatePresence>
          {editing && (
            <SetupPopover place={editing.place} onClose={() => setEditing(null)}>
              <TankControl p={p} />
              <div>
                <p className="text-xs text-muted">
                  Roof surface
                  <Hint text={SETUP_HINTS.roof} label="About roof type" />
                </p>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Roof surface">
                  {(Object.keys(p.roofTypes) as RoofType[]).map((k) => (
                    <button
                      key={k}
                      role="radio"
                      aria-checked={setup.roofType === k}
                      onClick={() => p.setSetup({ ...setup, roofType: k })}
                      className={`${btn} px-2 text-xs leading-tight ${setup.roofType === k ? "border-tank/70 bg-tank/10 text-fg" : ""}`}
                    >
                      {p.roofTypes[k].label}
                    </button>
                  ))}
                </div>
                <p className="num mt-1 text-[11px] text-muted">
                  Runoff coefficient {p.roofTypes[setup.roofType].low} to {p.roofTypes[setup.roofType].high}
                </p>
              </div>
              <label className="flex items-center justify-between gap-3">
                <span>
                  <span className="block">
                    Recharge well
                    <Hint text={SETUP_HINTS.recharge} label="About recharge well" />
                  </span>
                  <span className="text-xs text-muted">{RECHARGE_SUITABILITY}</span>
                </span>
                <input
                  type="checkbox"
                  checked={setup.hasRecharge}
                  onChange={(e) => p.setSetup({ ...setup, hasRecharge: e.target.checked })}
                  className="h-5 w-5 shrink-0 accent-[var(--color-ground)]"
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted">
                  Share of roof that drains to your pipes: <span className="num text-fg">{Math.round(setup.usableShare * 100)}%</span>
                  <Hint text={SETUP_HINTS.share} label="About usable share" />
                </span>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={Math.round(setup.usableShare * 100)}
                  onChange={(e) => p.setSetup({ ...setup, usableShare: Number(e.target.value) / 100 })}
                  className="mt-1 w-full"
                />
              </label>
            </SetupPopover>
          )}
        </AnimatePresence>
      </Step>
      )}

      {/* 04 Replay + one result card */}
      {show(4) && (
      <Step n="04" title="Replay it" tour="replay" bare={bare}>
        {!p.active || !p.result ? (
          <p className="text-muted">Pick or type a roof first.</p>
        ) : (
          <>
            <button
              onClick={p.replay}
              disabled={p.phase === "raining"}
              className="w-full rounded-xl bg-tank px-4 py-3 font-semibold text-ink transition hover:brightness-110 disabled:opacity-60"
            >
              {p.phase === "raining"
                ? "Raining…"
                : p.phase === "done"
                  ? "Replay again"
                  : `Replay ${p.rain.mm} mm on my roof`}
            </button>
            <ResultCard result={p.result} phase={p.phase} autoScroll={!bare} onOpen={p.openReport} />
          </>
        )}
      </Step>
      )}

      {!bare && (
        <button onClick={p.openSources} className="mt-2 text-xs text-muted underline underline-offset-4 hover:text-tank">
          How we calculate, and every source
        </button>
      )}
    </div>
  );
}

// After the replay: what you can collect, a tank icon, one plain line, the
// overflow, and the way into the Rain Report. While it rains, the number
// counts the rain landing on the roof; then it settles on what you can
// collect.
function ResultCard({
  result,
  phase,
  autoScroll,
  onOpen,
}: {
  result: RainResult;
  phase: string;
  autoScroll: boolean;
  onOpen: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Into view when the storm starts, and again when the card grows its button.
    if (autoScroll && phase !== "idle") box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [phase, autoScroll]);
  const raining = phase === "raining";
  const done = phase === "done";
  const landed = useCountUp(result.gross, 3800, raining || done);
  const collect = useCountUp(result.net.mid, 900, done);
  const { tankLitres } = result.inputs;
  // The tank fills first, in step with the rain.
  const progress = result.gross > 0 ? landed / result.gross : 0;
  const tankFill = tankLitres > 0 ? Math.min(1, Math.min(result.split.tank, result.net.mid * progress) / tankLitres) : 0;
  const overflow = Math.max(0, result.net.mid - result.split.tank);
  const tanks = tanksLine(result.net.mid, tankLitres);

  if (phase === "idle") return null;
  return (
    <motion.div
      ref={box}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 scroll-mt-4 rounded-2xl border border-tank/30 bg-tank/5 p-4"
    >
      <div className="flex items-end justify-between gap-3">
        <div aria-live="polite">
          <p className="num text-3xl font-semibold text-fg">{roundL(done ? collect : landed).toLocaleString("en-US")} L</p>
          <p className="text-[13px] text-fg">{done ? "you can collect from this storm" : "landing on your roof"}</p>
          {done && (
            <p className="text-xs text-muted">
              <span className="num">{formatL(result.gross)}</span> landed on your roof
            </p>
          )}
        </div>
        <TankIcon fill={tankFill} />
      </div>
      {done && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          {tanks && <p className="mt-2 text-[13px] text-fg">{tanks}</p>}
          {tankLitres > 0 && overflow >= 10 && (
            <p className="mt-0.5 text-xs text-drain-deep">
              About <span className="num">{formatL(overflow)}</span> overflowed your tank
              {result.split.rechargePotential > 0 ? ", routed toward your recharge well." : " to the drain."}
            </p>
          )}
          <button onClick={onOpen} className="btn-primary mt-3 w-full rounded-xl px-4 py-3 text-base font-semibold">
            Open my Rain Report
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

// The setup editor. Desktop: a popover beside the panel, level with the
// Edit button. Phones: a sheet from the bottom. Rendered in a portal so the
// panel's scroll box and the phone sheet's transform can't clip it.
type Place = { right: number; top: number };

// Desktop: just left of the side panel, level with the Edit button.
// Phones: null, for the bottom sheet.
function popoverPlace(anchor: HTMLElement): Place | null {
  if (window.matchMedia("(max-width: 767px)").matches) return null;
  const a = anchor.getBoundingClientRect();
  const panel = anchor.closest("aside")?.getBoundingClientRect();
  const right = window.innerWidth - (panel?.left ?? a.left) + 12;
  const top = Math.max(16, Math.min(a.top - 24, window.innerHeight - 640));
  return { right, top };
}

function SetupPopover({ place, onClose, children }: { place: Place | null; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={`fixed inset-0 z-[60] ${place ? "" : "bg-black/40"}`}
      onClick={onClose}
    >
      <motion.div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label="Edit your setup"
        initial={place ? { opacity: 0, x: 8 } : { y: 24 }}
        animate={place ? { opacity: 1, x: 0 } : { y: 0 }}
        exit={place ? { opacity: 0, x: 8 } : { y: 24 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={place ? { right: place.right, top: place.top, maxHeight: `calc(100dvh - ${place.top + 16}px)` } : undefined}
        className={`${
          place ? "absolute w-[360px] rounded-2xl" : "absolute inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        } overflow-y-auto border border-line bg-panel p-4 text-sm text-fg shadow-2xl`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Your setup</h2>
          <button onClick={onClose} className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold">
            Done
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        <p className="mt-3 text-[11px] text-muted">Changes reset the replay, so you can run the storm again with them.</p>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

// The tank, kept up front: size stepper plus what 1,000 L more or less
// would change for the chosen storm.
function TankControl({ p }: { p: Props }) {
  const size = p.setup.tankLitres;
  const set = (v: number) => p.setSetup({ ...p.setup, tankLitres: Math.max(0, Math.min(1_000_000, v)) });
  const what = p.active && p.rain.mm > 0 ? tankWhatIf({ areaM2: p.active.areaM2, rainMm: p.rain.mm, ...p.setup }) : null;
  const elsewhere = p.setup.hasRecharge ? "toward recharge" : "to the drain";
  const stepBtn =
    "grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-lg text-fg transition hover:border-tank/60 disabled:opacity-40";
  return (
    <div className="rounded-xl border border-tank/30 bg-tank/5 p-3">
      <p className="text-xs text-muted">
        Your tank
        <Hint text={SETUP_HINTS.tank} label="About tank" />
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <button className={stepBtn} onClick={() => set(size - 500)} disabled={size <= 0} aria-label="Tank 500 litres smaller">
          −
        </button>
        <label className="relative flex-1">
          <span className="sr-only">Tank size in litres</span>
          <input
            inputMode="numeric"
            value={size}
            onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || 0)}
            className="num h-10 w-full rounded-lg border border-line bg-panel px-3 pr-8 text-center text-lg font-semibold outline-none focus:border-tank"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">L</span>
        </label>
        <button className={stepBtn} onClick={() => set(size + 500)} aria-label="Tank 500 litres bigger">
          +
        </button>
      </div>
      {what && (
        <ul className="mt-2 space-y-0.5 text-xs text-fg">
          <li>
            With a <span className="num">{formatL(what.biggerSize)}</span> tank:{" "}
            {what.biggerGain >= 10 ? (
              <>
                <span className="num text-tank-deep">{formatL(what.biggerGain)}</span> more stored from this storm
              </>
            ) : (
              "no more stored, this storm already fits"
            )}
          </li>
          {what.smallerSize < size && (
            <li>
              With {what.smallerSize > 0 ? <>a <span className="num">{formatL(what.smallerSize)}</span> tank</> : "no tank"}:{" "}
              {what.smallerLoss >= 10 ? (
                <>
                  <span className="num text-drain-deep">{formatL(what.smallerLoss)}</span> less stored, sent {elsewhere} instead
                </>
              ) : (
                "stores the same for this storm"
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
