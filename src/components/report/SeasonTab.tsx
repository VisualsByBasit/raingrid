"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { formatL, ROOF_TYPES, type RainResult } from "@/lib/engine";
import { recommendedStack } from "@/lib/overview";
import type { Roof } from "@/lib/roof";
import { monsoonCatch, seasonMonths, seasonSummary, type SeasonMonth } from "@/lib/season";
import { useMedia } from "@/lib/useMedia";
import { SOURCES, areaSource } from "@/lib/sources";
import { useCountUp } from "@/lib/useCountUp";
import SourceTip from "../SourceTip";
import DailyUse from "./DailyUse";

const nf = (v: number) => v.toLocaleString("en-US");
// 46,200 -> "46k" for axis ticks and bar labels; the axis title says so.
const kL = (v: number) => (v >= 1000 ? `${nf(Math.round(v / 1000))}k` : nf(Math.round(v / 100) * 100));

// RainGrid's storage (your tank plus the recommended one), with what each
// adds, for a sentence: "your 2,000 L tank and RainGrid's 2,000 L tank".
export function storageFor(result: RainResult) {
  const tanks = recommendedStack(result).tanks;
  const total = tanks.reduce((s, t) => s + t.capacity, 0);
  const added = tanks.filter((t) => t.isNew).reduce((s, t) => s + t.capacity, 0);
  const own = total - added;
  const words =
    own > 0 && added > 0
      ? `your ${formatL(own)} tank and RainGrid's ${formatL(added)}`
      : added > 0
        ? `RainGrid's ${formatL(added)} of tanks`
        : `your ${formatL(own)} tank`;
  return { total, words };
}

// A typical year on this roof from the WMO 1991 to 2020 monthly normals.
// It leads with what the storage can really catch across the monsoon (a
// tank only catches what there is room for), then the month-by-month bars.
export default function SeasonTab({
  result,
  roof,
  dailyUse,
  setDailyUse,
}: {
  result: RainResult;
  roof: Roof;
  dailyUse: number;
  setDailyUse: (v: number) => void;
}) {
  const [table, setTable] = useState(false);
  // The roof and setup from the result; each month brings its own rain.
  const inputs = result.inputs;
  const months = seasonMonths(inputs);
  const year = seasonSummary(months, 0);
  const storage = storageFor(result);
  const c = monsoonCatch(months, storage.total, dailyUse);
  const shown = useCountUp(c.caught, 900, true);
  const spec = ROOF_TYPES[inputs.roofType];
  const monthTip = {
    method: `Each month: ${nf(Math.round(inputs.areaM2))} m² × ${Math.round(inputs.usableShare * 100)}% usable × (monthly normal − ${inputs.firstFlushMm} mm first flush) × runoff ${spec.mid}. One first flush per month, a simplification.`,
    sources: [SOURCES.normals, areaSource(roof.source), SOURCES.usableShare, SOURCES.firstFlush, SOURCES.runoff],
  };
  const catchTip = {
    method: `The smallest of: the July to September harvest, ${formatL(c.harvest)}; one full ${formatL(storage.total)} on each of ${nf(c.rainDays)} rain days, ${formatL(c.byRainDays)}; the first fill plus ${nf(dailyUse)} L a day for ${c.days} days, ${formatL(c.byUse)}.`,
    sources: [SOURCES.rainDays, SOURCES.dailyUse, SOURCES.recommendation, ...monthTip.sources.slice(1)],
  };
  const why =
    storage.total <= 0
      ? "Without a tank nothing is stored. Set a tank size in your setup."
      : c.limitedBy === "use"
        ? `A tank only catches what you've made room for: the first ${formatL(storage.total)}, then about what you use each day. Use more and it catches more.`
        : c.limitedBy === "rainDays"
          ? `At most one full tank on each of the ${nf(c.rainDays)} rain days (days with 1 mm or more). More storage would catch more.`
          : "Your storage and daily use are enough to catch everything your roof collects in a typical monsoon.";

  return (
    <div className="space-y-6 text-sm">
      <section aria-labelledby="season-head" className="rounded-2xl border border-tank/40 bg-tank/5 p-4">
        <h3 id="season-head" className="text-xs font-semibold uppercase tracking-widest text-tank-deep">
          Across a typical monsoon
          <SourceTip {...catchTip} label="How is the monsoon catch worked out?" />
        </h3>
        <p className="num mt-2 text-4xl font-semibold tracking-tight text-fg md:text-5xl">up to {formatL(shown)}</p>
        <p className="mt-1 text-[15px] text-fg">
          caught by {storage.words}, July to September
        </p>
        <p className="mt-1 text-xs text-muted">
          {Math.round((c.caught / Math.max(1, c.harvest)) * 100)}% of the {formatL(c.harvest)} your roof could collect in those three
          months. {why}
        </p>
        <div className="mt-3">
          <DailyUse value={dailyUse} onChange={setDailyUse} />
        </div>
      </section>

      <section aria-labelledby="season-year">
        <h3 id="season-year" className="text-xs font-semibold uppercase tracking-widest text-muted">
          What falls on your roof in a typical year
          <SourceTip {...monthTip} />
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="A typical year" value={formatL(year.yearLitres)} note="you could collect" />
          <Stat label="July to September" value={formatL(year.monsoonLitres)} note={`${Math.round(year.monsoonShare * 100)}% of the year, in three months`} />
        </div>
      </section>

      <section aria-labelledby="season-chart">
        <h3 id="season-chart" className="sr-only">
          Litres you could collect each month
        </h3>
        <MonthBars months={months} />
        <p className="mt-2 text-xs text-muted">
          Monthly rainfall: WMO 1991 to 2020 normals, Islamabad Airport. Averages, not a forecast. Each month counts one first
          flush, so wet months with many storms are slightly overstated.
        </p>
        <button onClick={() => setTable((v) => !v)} aria-expanded={table} className="mt-3 text-xs text-tank-deep underline underline-offset-4">
          {table ? "Hide the table" : "Show as a table"}
        </button>
        {table && (
          <table className="num mt-2 w-full border-collapse text-left text-xs">
            <caption className="sr-only">Rainfall and litres you could collect, by month</caption>
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1.5 pr-3 font-normal">Month</th>
                <th className="py-1.5 pr-3 text-right font-normal">Rain (mm)</th>
                <th className="py-1.5 pr-3 text-right font-normal">Rain days</th>
                <th className="py-1.5 text-right font-normal">You could collect</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className={`border-b border-line/60 ${m.monsoon ? "text-tank-deep" : ""}`}>
                  <td className="py-1.5 pr-3">{m.month}</td>
                  <td className="py-1.5 pr-3 text-right">{m.mm}</td>
                  <td className="py-1.5 pr-3 text-right">{m.rainDays}</td>
                  <td className="py-1.5 text-right">{formatL(m.litres)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5 pr-3">Year</td>
                <td className="py-1.5 pr-3 text-right">{nf(Math.round(months.reduce((s, m) => s + m.mm, 0) * 10) / 10)}</td>
                <td className="py-1.5 pr-3 text-right">{nf(Math.round(months.reduce((s, m) => s + m.rainDays, 0) * 10) / 10)}</td>
                <td className="py-1.5 text-right">{formatL(year.yearLitres)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-line p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="num mt-0.5 text-xl font-semibold text-fg">{value}</p>
      <p className="text-xs text-muted">{note}</p>
    </div>
  );
}

// Twelve bars, litres on the y axis, July to September highlighted. Bars
// grow with a scaleY transform. Phones get a narrower drawing so the labels
// stay readable.
function MonthBars({ months }: { months: SeasonMonth[] }) {
  const reduced = useReducedMotion();
  const W = useMedia("(max-width: 639px)") ? 350 : 440;
  const H = 246;
  const left = 40;
  const right = 6;
  const top = 44;
  const bottom = 34;
  const plotH = H - top - bottom;
  const slot = (W - left - right) / months.length;
  const max = Math.max(1, ...months.map((m) => m.litres));
  // A round axis top: 10k, 20k, 25k, 50k...
  const step = [1000, 2000, 2500, 5000, 10_000, 20_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000].find((s) => max / s <= 5) ?? 1_000_000;
  const axisMax = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(axisMax / step) + 1 }, (_, i) => i * step);
  const yOf = (v: number) => top + plotH - (v / axisMax) * plotH;
  const monsoon = months.map((m, i) => (m.monsoon ? i : -1)).filter((i) => i >= 0);
  const bandX = left + monsoon[0] * slot;
  const bandW = monsoon.length * slot;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Litres you could collect each month: ${months.map((m) => `${m.month} ${formatL(m.litres)}`).join(", ")}.`}
      className="h-auto w-full max-w-[640px]"
    >
      <text x={0} y={12} fontSize={10} fill="var(--color-muted)">
        Litres you could collect (k = thousand)
      </text>
      {monsoon.length > 0 && (
        <g>
          <rect x={bandX} y={top - 26} width={bandW} height={plotH + 26} rx={6} fill="var(--color-tank)" fillOpacity={0.08} />
          <text x={bandX + bandW / 2} y={top - 14} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="var(--color-tank-deep)">
            Monsoon
          </text>
        </g>
      )}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - right} y1={yOf(t)} y2={yOf(t)} stroke="var(--color-line)" strokeWidth={t === 0 ? 1.2 : 0.6} />
          <text x={left - 6} y={yOf(t) + 3.5} textAnchor="end" fontSize={9.5} fill="var(--color-muted)">
            {kL(t)}
          </text>
        </g>
      ))}
      {months.map((m, i) => {
        const bw = slot * 0.62;
        const x = left + i * slot + (slot - bw) / 2;
        const y = yOf(m.litres);
        const h = top + plotH - y;
        return (
          <g key={m.month}>
            <motion.rect
              x={x}
              y={y}
              width={bw}
              height={Math.max(0.5, h)}
              rx={2}
              fill="var(--color-tank)"
              fillOpacity={m.monsoon ? 0.9 : 0.4}
              style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
              initial={{ scaleY: reduced ? 1 : 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.05 * i, ease: "easeOut" }}
            >
              <title>{`${m.month}: ${m.mm} mm of rain, ${formatL(m.litres)} you could collect`}</title>
            </motion.rect>
            {m.monsoon && (
              <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="var(--color-tank-deep)">
                {kL(m.litres)}
              </text>
            )}
            <text x={x + bw / 2} y={H - bottom + 14} textAnchor="middle" fontSize={9.5} fill={m.monsoon ? "var(--color-fg)" : "var(--color-muted)"}>
              {m.month}
            </text>
            <text x={x + bw / 2} y={H - bottom + 26} textAnchor="middle" fontSize={8} fill="var(--color-muted)">
              {Math.round(m.mm)}
            </text>
          </g>
        );
      })}
      <text x={left - 6} y={H - bottom + 26} textAnchor="end" fontSize={8} fill="var(--color-muted)">
        mm
      </text>
    </svg>
  );
}
