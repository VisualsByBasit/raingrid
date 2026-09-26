"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PRESETS, STORMS, nearestReading } from "@/data/storms";
import {
  formatL,
  formatRange,
  mmToFillTank,
  roundL,
  roundSplitForDisplay,
  type RainResult,
  type RoofType,
  type RoofTypeSpec,
} from "@/lib/engine";
import type { Roof } from "@/lib/roof";
import type { StormChoice } from "@/lib/share";
import { useCountUp } from "@/lib/useCountUp";
import type { Setup } from "./RainGridApp";

interface Street {
  gross: number;
  tank: number;
  rechargePotential: number;
  drain: number;
  lost: number;
  netLow: number;
  netHigh: number;
  count: number;
  potentialWithWells: number;
}

interface Props {
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
  rain: { mm: number; label: string; gaugeNote: string | null };
  setup: Setup;
  setSetup: (s: Setup) => void;
  result: RainResult | null;
  phase: "idle" | "raining" | "done";
  replay: () => void;
  street: Street | null;
  addingNeighbour: boolean;
  setAddingNeighbour: (v: boolean) => void;
  share: () => void;
  openSources: () => void;
  roofTypes: Record<RoofType, RoofTypeSpec>;
}

const Step = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
  <section className="border-b border-line py-4 first:pt-0 last:border-0">
    <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold">
      <span className="num text-xs text-tank">{n}</span>
      {title}
    </h2>
    {children}
  </section>
);

const btn = "rounded-lg border border-line px-3 py-2 text-sm transition hover:border-tank/60 hover:text-fg";

export default function ResultPanel(p: Props) {
  const [showSetup, setShowSetup] = useState(false);
  const [customMm, setCustomMm] = useState("");
  const lat = p.active?.lat;
  const lng = p.active?.lng;

  return (
    <div className="text-sm">
      {/* 01 Roof */}
      <Step n="01" title="Your roof">
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
            {p.roofs.map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                  r.id === p.active?.id ? "border-tank/60 bg-tank/5" : "border-line"
                }`}
              >
                <button onClick={() => p.setActiveId(r.id)} className="flex-1 text-left">
                  <span className="font-medium">{r.label}</span>
                  <span className="ml-2 text-xs text-muted">
                    {r.source === "map" ? "from map outline" : r.source === "drawn" ? "drawn" : "typed"}
                  </span>
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
            <p className="text-xs text-muted/80">Area looks off? Edit it. Map outlines come from OpenStreetMap and can be imperfect.</p>
          </div>
        )}
      </Step>

      {/* 02 Storm */}
      <Step n="02" title="Pick a real storm">
        <div className="space-y-2">
          {STORMS.map((s) => {
            const r = lat != null && lng != null ? nearestReading(s, lat, lng) : null;
            const max = Math.max(...Object.values(s.readings).map((v) => v ?? 0));
            const selected = p.choice.kind === "storm" && p.choice.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => p.setChoice({ kind: "storm", id: s.id })}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                  selected ? "border-tank/70 bg-tank/10" : "border-line hover:border-tank/40"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{s.dateLabel}</span>
                  <span className="num text-tank">{r ? `${r.mm} mm` : `up to ${max} mm`}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{s.title}. {s.blurb}</p>
              </button>
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
          {p.rain.gaugeNote && p.active && <p className="text-xs text-muted/80">{p.rain.gaugeNote}.</p>}
        </div>
      </Step>

      {/* 03 Setup */}
      <Step n="03" title="Your setup">
        <button onClick={() => setShowSetup((v) => !v)} className="flex w-full items-center justify-between text-left text-muted">
          <span>
            <span className="num text-fg">{p.setup.tankLitres.toLocaleString()} L</span> tank ·{" "}
            {p.setup.hasRecharge ? "recharge well" : "no recharge well"} · {p.roofTypes[p.setup.roofType].label}
          </span>
          <span className="text-xs">{showSetup ? "Hide" : "Edit"}</span>
        </button>
        <AnimatePresence initial={false}>
          {showSetup && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-xs text-muted">Tank size (litres)</span>
                  <input
                    inputMode="numeric"
                    value={p.setup.tankLitres}
                    onChange={(e) => p.setSetup({ ...p.setup, tankLitres: Math.min(1_000_000, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                    className="num mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 outline-none focus:border-tank"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block">Recharge well</span>
                    <span className="text-xs text-muted">Routes overflow toward recharge; actual infiltration needs a site assessment</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={p.setup.hasRecharge}
                    onChange={(e) => p.setSetup({ ...p.setup, hasRecharge: e.target.checked })}
                    className="h-5 w-5 accent-[var(--color-ground)]"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(p.roofTypes) as RoofType[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => p.setSetup({ ...p.setup, roofType: k })}
                      className={`${btn} ${p.setup.roofType === k ? "border-tank/70 bg-tank/10" : ""}`}
                    >
                      {p.roofTypes[k].label}
                    </button>
                  ))}
                </div>
                <label className="block">
                  <span className="text-xs text-muted">
                    Share of roof that drains to your pipes: <span className="num text-fg">{Math.round(p.setup.usableShare * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={100}
                    value={Math.round(p.setup.usableShare * 100)}
                    onChange={(e) => p.setSetup({ ...p.setup, usableShare: Number(e.target.value) / 100 })}
                    className="mt-1 w-full"
                  />
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Step>

      {/* 04 Replay + result */}
      <Step n="04" title="Replay it">
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
            <Result result={p.result} phase={p.phase} rainLabel={p.rain.label} />
          </>
        )}
      </Step>

      {/* 05 Street */}
      {p.phase === "done" && p.active && (
        <Step n="05" title="Bring your street">
          <p className="text-muted">
            One roof is a tank. A street of roofs keeps water out of the nullah when it floods. Add your neighbours&apos;
            roofs to see it.
          </p>
          <button
            onClick={() => p.setAddingNeighbour(!p.addingNeighbour)}
            className={`${btn} mt-3 w-full ${p.addingNeighbour ? "border-tank/70 bg-tank/10 text-tank" : ""}`}
          >
            {p.addingNeighbour ? "Done adding neighbours" : "+ Add neighbours' roofs"}
          </button>
          {p.street && <StreetTotals street={p.street} />}
          {p.roofs.length > 0 && (
            <button onClick={p.share} className={`${btn} mt-2 w-full`}>
              Copy street link
            </button>
          )}
        </Step>
      )}

      <button onClick={p.openSources} className="mt-2 text-xs text-muted underline underline-offset-4 hover:text-tank">
        How we calculate, and every source
      </button>
    </div>
  );
}

function Result({ result, phase, rainLabel }: { result: RainResult; phase: string; rainLabel: string }) {
  const box = useRef<HTMLDivElement>(null);
  // Bring the result into view when the storm starts (matters on phones).
  useEffect(() => {
    if (phase === "raining") box.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);
  const counting = phase === "raining" || phase === "done";
  const gross = useCountUp(result.gross, 3800, counting);
  // Net water arrives in step with the rain, and the tank fills first.
  const progress = result.gross > 0 ? gross / result.gross : 0;
  const tankFill = counting
    ? Math.min(1, Math.min(result.split.tank, result.net.mid * progress) / Math.max(1, result.inputs.tankLitres))
    : 0;
  const fillMm = mmToFillTank(result.inputs);
  const rainMm = result.inputs.rainMm;
  const displaySplit = roundSplitForDisplay(result.split, result.gross);

  if (phase === "idle") return null;

  const parts = [
    { key: "tank", label: "Stored in your tank", v: result.split.tank, display: displaySplit.tank, color: "bg-tank", text: "text-tank" },
    {
      key: "rechargePotential",
      label: "Routed toward recharge (potential)",
      v: result.split.rechargePotential,
      display: displaySplit.rechargePotential,
      color: "bg-ground",
      text: "text-ground",
    },
    { key: "drain", label: "Routed to the drain", v: result.split.drain, display: displaySplit.drain, color: "bg-drain", text: "text-drain" },
    { key: "lost", label: "Roof and collection losses", v: result.split.lost, display: displaySplit.lost, color: "bg-lost", text: "text-muted" },
  ];
  const total = Math.max(1, result.gross);

  return (
    <div ref={box} className="mt-4 scroll-mt-4 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Rain that landed on this roof · {rainLabel}</p>
          <p className="num text-3xl font-semibold text-fg">{roundL(gross).toLocaleString("en-US")} L</p>
        </div>
        <div className="relative h-16 w-10 overflow-hidden rounded-md border border-line" aria-label="Tank level">
          <div className="absolute inset-x-0 bottom-0 bg-tank/80 transition-[height] duration-200" style={{ height: `${tankFill * 100}%` }} />
          <span className="num absolute inset-x-0 top-1 text-center text-[9px] text-fg/80">TANK</span>
        </div>
      </div>

      <AnimatePresence>
        {phase === "done" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-muted">Follow the water</p>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-line">
                {parts.map((pt, i) => (
                  <motion.div
                    key={pt.key}
                    className={pt.color}
                    initial={{ width: 0 }}
                    animate={{ width: `${(pt.v / total) * 100}%` }}
                    transition={{ delay: 0.15 * i, duration: 0.6 }}
                  />
                ))}
              </div>
              <ul className="mt-3 space-y-1.5">
                {parts
                  .filter((pt) => pt.key !== "rechargePotential" || pt.v > 0)
                  .map((pt) => (
                    <li key={pt.key} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${pt.color}`} />
                        {pt.label}
                      </span>
                      <span className={`num ${pt.text}`}>{pt.display.toLocaleString("en-US")} L</span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="rounded-lg border border-drain/30 bg-drain/5 p-3">
              {result.inputs.tankLitres <= 0 ? (
                <p>
                  No storage tank is configured. Harvestable runoff was{" "}
                  {result.split.rechargePotential > 0
                    ? "routed toward your recharge system; actual infiltration depends on the site."
                    : "routed to the drain."}
                </p>
              ) : Number.isFinite(fillMm) && fillMm < rainMm ? (
                <p>
                  Your <span className="num">{result.inputs.tankLitres.toLocaleString()} L</span> tank was full after the first{" "}
                  <span className="num text-tank">{Math.ceil(fillMm)} mm</span>. The other{" "}
                  <span className="num text-drain">{Math.max(0, Math.floor(rainMm - fillMm))} mm</span>{" "}
                  {result.split.rechargePotential > 0
                    ? "was routed toward your recharge system; actual infiltration depends on the site."
                    : "was routed to the drain."}
                </p>
              ) : (
                <p>
                  This storm fits in your tank. You could catch{" "}
                  <span className="num text-tank">{formatRange(result.net.low, result.net.high)}</span>.
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                Harvestable after losses: {formatRange(result.net.low, result.net.high)}, depending on roof surface.
              </p>
            </div>

            <RainPlan result={result} fillMm={fillMm} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RainPlan({ result, fillMm }: { result: RainResult; fillMm: number }) {
  const hasRecharge = result.inputs.hasRecharge;
  const bigger = result.net.mid > result.inputs.tankLitres;
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-widest text-muted">Your rain plan</p>
      <ol className="space-y-2">
        <li className="flex gap-2">
          <span className="num text-tank">1</span>
          <span>
            Fit a leaf screen and a first-flush diverter so the dirty first{" "}
            <span className="num">{result.inputs.firstFlushMm} mm</span> skips the tank.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="num text-tank">2</span>
          <span>
            {result.inputs.tankLitres > 0
              ? "Filter before storage and keep the tank covered. Use this water for gardening, washing, flushing and cleaning, not drinking."
              : "No storage tank is configured. Add a covered tank if you want to reuse water for gardening, washing, flushing or cleaning."}
          </span>
        </li>
        <li className="flex gap-2">
          <span className="num text-tank">3</span>
          <span>
            {bigger
              ? hasRecharge
                ? "Keep the overflow pipe to your recharge well clear, and have the filter pit cleaned before each monsoon."
                : `Your roof catches far more than one tank. Ask a qualified professional whether a filtered recharge well suits your plot, so the overflow feeds groundwater instead of the drain.`
              : "Your tank can hold this whole storm. Use it between rains so it has room for the next one."}
          </span>
        </li>
        <li className="flex gap-2">
          <span className="num text-tank">4</span>
          <span>
            Before the monsoon: clean the roof, gutters and filter, and check the tank lid.
            {result.inputs.tankLitres > 0 && Number.isFinite(fillMm) &&
              ` Your tank fills in about ${Math.ceil(fillMm)} mm of rain.`}
          </span>
        </li>
      </ol>
      <p className="mt-3 text-[11px] leading-relaxed text-muted/80">
        Preliminary estimate only. Site-specific design, construction and any potable use need a qualified professional and
        compliance with local rules.
      </p>
    </div>
  );
}

function StreetTotals({ street }: { street: Street }) {
  return (
    <div className="mt-3 rounded-lg border border-tank/30 bg-tank/5 p-3">
      <p className="text-xs text-muted">
        {street.count} roofs in this storm (each with its own tank)
      </p>
      <p className="num mt-1 text-2xl font-semibold">{formatL(street.gross)}</p>
      <ul className="mt-2 space-y-1 text-sm">
        <li className="flex justify-between">
          <span>Stored in tanks</span>
          <span className="num text-tank">{formatL(street.tank)}</span>
        </li>
        {street.rechargePotential > 0 && (
          <li className="flex justify-between">
            <span>Routed toward recharge (potential)</span>
            <span className="num text-ground">{formatL(street.rechargePotential)}</span>
          </li>
        )}
        <li className="flex justify-between">
          <span>Still lost to the drain</span>
          <span className="num text-drain">{formatL(street.drain)}</span>
        </li>
      </ul>
      {street.potentialWithWells > street.tank + street.rechargePotential + 100 && (
        <p className="mt-2 rounded-md bg-ground/10 px-2 py-1.5 text-xs">
          <span className="text-muted">Scenario: if every roof here added a filtered recharge well, </span>
          <span className="num text-ground">{formatL(street.potentialWithWells)}</span>
          <span className="text-muted"> could be stored or routed toward recharge. Actual infiltration requires a site assessment.</span>
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        Street action: agree one pre-monsoon cleaning day, and get one shared quote for filters and recharge wells.
      </p>
    </div>
  );
}
