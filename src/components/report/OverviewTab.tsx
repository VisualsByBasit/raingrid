"use client";

import { useState } from "react";
import { formatL, formatRange, mmToFillTank, roundL, ROOF_TYPES, type RainResult } from "@/lib/engine";
import { depthCm, fillsLine, keepLine, sentence } from "@/lib/explain";
import { overviewGauges, recommendedStack } from "@/lib/overview";
import type { ReportTab } from "@/lib/report";
import type { Roof } from "@/lib/roof";
import { SOURCES, areaSource, type SourceRef } from "@/lib/sources";
import { useCountUp } from "@/lib/useCountUp";
import type { Setup } from "../RainGridApp";
import { RECHARGE_SUITABILITY } from "../RainBits";
import SourceTip from "../SourceTip";
import TankControl from "../TankControl";
import Gauge from "./Gauge";
import TankFill from "./TankFill";
import type { Rain } from "./types";

const nf = (v: number) => v.toLocaleString("en-US");

const GAUGE_COLOR = {
  tank: "var(--color-tank)",
  captured: "var(--color-tank-deep)",
  recharge: "var(--color-ground)",
} as const;

// The headline: what this roof can collect, the tanks filling with the
// overflow spilling, and three gauges, each with its meaning and source.
export default function OverviewTab({
  result,
  rain,
  roof,
  setup,
  setSetup,
  setTab,
}: {
  result: RainResult;
  rain: Rain;
  roof: Roof;
  setup: Setup;
  setSetup: (s: Setup) => void;
  setTab: (t: ReportTab) => void;
}) {
  const [table, setTable] = useState(false);
  const collect = useCountUp(result.net.mid, 1200, true);
  const { areaM2, rainMm, tankLitres, usableShare, firstFlushMm, roofType, hasRecharge } = result.inputs;
  const spec = ROOF_TYPES[roofType];
  const fillMm = mmToFillTank(result.inputs);
  const fills = fillsLine(result.net.mid, tankLitres);
  const stack = recommendedStack(result);
  const gauges = overviewGauges(result);
  const rainSrc: SourceRef[] = rain.source ? [rain.source] : [];
  const area = areaSource(roof.source);

  const collectTip = {
    method: `${nf(Math.round(areaM2))} m² × ${Math.round(usableShare * 100)}% usable × (${nf(rainMm)} mm rain − ${firstFlushMm} mm first flush) × runoff ${spec.mid} = ${formatL(result.net.mid)}. Range ${formatRange(result.net.low, result.net.high)} for runoff ${spec.low} to ${spec.high}.`,
    sources: [...rainSrc, area, SOURCES.usableShare, SOURCES.firstFlush, SOURCES.runoff],
  };
  const landedTip = {
    method: `${nf(Math.round(areaM2))} m² × ${nf(rainMm)} mm = ${formatL(result.gross)} (1 mm on 1 m² is 1 L).`,
    sources: [...rainSrc, area, SOURCES.unit],
  };
  const gaugeTip: Record<string, { method: string; sources: SourceRef[] }> = {
    tank: { method: `Stored ${formatL(result.split.tank)} in a ${formatL(tankLitres)} tank.`, sources: [SOURCES.tank, ...collectTip.sources] },
    captured: {
      method: `(stored ${formatL(result.split.tank)} + toward recharge ${formatL(result.split.rechargePotential)}) ÷ ${formatL(result.gross)} of rain on the roof.`,
      sources: [...collectTip.sources],
    },
    recharge: {
      method: `${hasRecharge ? "Routed toward your well" : "Harvestable water beyond your tank"}: ${formatL(gauges[2].litres)} ÷ ${formatL(result.gross)} of rain on the roof.`,
      sources: [SOURCES.recharge, ...collectTip.sources],
    },
  };
  const tanksTip = { method: `Your ${formatL(tankLitres)} tank fills first, then the recommended tank${stack.tanks.filter((t) => t.isNew).length > 1 ? "s" : ""}.`, sources: [SOURCES.recommendation, SOURCES.tank] };

  const next: { tab: ReportTab; title: string; body: string }[] = [
    { tab: "water", title: "Follow the water", body: "Where every litre went, and the plan that keeps more of it." },
    { tab: "money", title: "What it's worth", body: "This water in tanker loads, at CDA and private prices." },
    { tab: "install", title: "Get it installed", body: "Your package, price, instalments and a free site visit." },
  ];

  return (
    <div className="space-y-8 text-sm">
      {/* Hero number */}
      <section>
        <p className="text-base text-fg">Your roof could supply</p>
        <p className="num text-5xl font-semibold tracking-tight text-fg md:text-6xl">
          {roundL(collect).toLocaleString("en-US")} L
          <SourceTip {...collectTip} label="How is this worked out?" />
        </p>
        <p className="text-base text-fg">from this storm</p>
        <p className="mt-2 text-[15px] font-medium text-fg">
          {keepLine(result.split.tank, result.net.mid, tankLitres, result.split.rechargePotential > 0)}
        </p>
        <p className="mt-2 text-muted">
          <span className="num">{formatL(result.gross)}</span> landed on your roof
          <SourceTip {...landedTip} />
        </p>
        <ul className="mt-3 space-y-0.5 text-fg">
          {fills && <li>{sentence(fills)}.</li>}
          <li>That&apos;s water {depthCm(rainMm)} deep across your roof.</li>
        </ul>
      </section>

      {/* Tanks filling */}
      <section aria-labelledby="ov-tanks" className="rounded-2xl border border-line p-4">
        <h3 id="ov-tanks" className="text-xs font-semibold uppercase tracking-widest text-muted">
          Your tanks in this storm
          <SourceTip {...tanksTip} />
        </h3>
        <div className="mt-3 grid items-start gap-5 md:grid-cols-[1fr_260px]">
          <div>
            <TankFill tanks={stack.tanks} overflow={stack.overflow} overflowTo={hasRecharge ? "well" : "drain"} />
            <p className="mt-2 text-[13px] text-fg">
              {tankLitres > 0 && Number.isFinite(fillMm) && fillMm < rainMm ? (
                <>
                  Your tank was full after the first <span className="num">{Math.ceil(fillMm)} mm</span>.{" "}
                </>
              ) : null}
              {stack.tanks.some((t) => t.isNew) ? (
                <>
                  With RainGrid&apos;s recommended tank{stack.tanks.filter((t) => t.isNew).length > 1 ? "s" : ""},{" "}
                  <span className="num text-tank-deep">{formatL(stack.stored)}</span> is stored
                  {stack.overflow >= 10 ? (
                    <>
                      {" "}
                      and <span className="num text-drain-deep">{formatL(stack.overflow)}</span> overflows:{" "}
                      {hasRecharge ? "toward your recharge well." : "the reason for a recharge well instead of the drain."}
                    </>
                  ) : (
                    "."
                  )}
                </>
              ) : stack.overflow >= 10 ? (
                <>
                  <span className="num text-drain-deep">{formatL(stack.overflow)}</span> overflows {hasRecharge ? "toward your recharge well." : "to the drain."}
                </>
              ) : (
                "Your tank holds this whole storm."
              )}
            </p>
          </div>
          <TankControl setup={setup} setSetup={setSetup} areaM2={areaM2} rainMm={rainMm} />
        </div>
      </section>

      {/* Gauges */}
      <section aria-labelledby="ov-gauges">
        <h3 id="ov-gauges" className="text-xs font-semibold uppercase tracking-widest text-muted">
          At a glance
        </h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {gauges.map((g) => (
            <li key={g.id} className="flex items-center gap-3 rounded-2xl border border-line p-3 sm:flex-col sm:text-center">
              <div className="w-28 shrink-0 sm:w-full sm:max-w-[150px]">
                <Gauge value={g.value} color={GAUGE_COLOR[g.id]} label={g.label} dashed={g.hypothetical} />
              </div>
              <div>
                <p className="font-semibold text-fg">
                  {g.label}
                  <SourceTip {...gaugeTip[g.id]} />
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted">{g.meaning}</p>
              </div>
            </li>
          ))}
        </ul>
        <button onClick={() => setTable((v) => !v)} aria-expanded={table} className="mt-3 text-xs text-tank-deep underline underline-offset-4">
          {table ? "Hide the table" : "Show as a table"}
        </button>
        {table && (
          <table className="num mt-2 w-full border-collapse text-left text-xs">
            <caption className="sr-only">The numbers behind the tanks and gauges</caption>
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1.5 pr-3 font-normal">Item</th>
                <th className="py-1.5 pr-3 text-right font-normal">Litres</th>
                <th className="py-1.5 text-right font-normal">Share</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/60">
                <td className="py-1.5 pr-3">Rain on the roof</td>
                <td className="py-1.5 pr-3 text-right">{formatL(result.gross)}</td>
                <td className="py-1.5 text-right">100%</td>
              </tr>
              <tr className="border-b border-line/60">
                <td className="py-1.5 pr-3">Your roof could supply</td>
                <td className="py-1.5 pr-3 text-right">{formatL(result.net.mid)}</td>
                <td className="py-1.5 text-right">{Math.round((result.net.mid / Math.max(1, result.gross)) * 100)}%</td>
              </tr>
              {stack.tanks.map((t, i) => (
                <tr key={i} className="border-b border-line/60">
                  <td className="py-1.5 pr-3">
                    {t.isNew ? "New tank" : "Your tank"} ({formatL(t.capacity)})
                  </td>
                  <td className="py-1.5 pr-3 text-right">{formatL(t.filled)}</td>
                  <td className="py-1.5 text-right">{Math.round((t.filled / Math.max(1, t.capacity)) * 100)}% full</td>
                </tr>
              ))}
              <tr className="border-b border-line/60">
                <td className="py-1.5 pr-3">Overflow with those tanks</td>
                <td className="py-1.5 pr-3 text-right">{formatL(stack.overflow)}</td>
                <td className="py-1.5 text-right">{Math.round((stack.overflow / Math.max(1, result.gross)) * 100)}%</td>
              </tr>
              {gauges.map((g) => (
                <tr key={g.id} className="border-b border-line/60">
                  <td className="py-1.5 pr-3">{g.label} (gauge)</td>
                  <td className="py-1.5 pr-3 text-right">{formatL(g.litres)}</td>
                  <td className="py-1.5 text-right">{Math.round(g.value * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="space-y-1 text-xs text-muted">
        <p>Harvestable after losses: {formatRange(result.net.low, result.net.high)}, depending on roof surface.</p>
        <p>{RECHARGE_SUITABILITY}</p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {next.map((n) => (
          <button
            key={n.tab}
            onClick={() => setTab(n.tab)}
            className="rounded-xl border border-line p-3 text-left transition hover:border-tank/60"
          >
            <span className="block font-semibold text-fg">{n.title} →</span>
            <span className="mt-0.5 block text-xs text-muted">{n.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
