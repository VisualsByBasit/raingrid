"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { formatL, ROOF_TYPES, type RainResult } from "@/lib/engine";
import { recommendedStack } from "@/lib/overview";
import type { Roof } from "@/lib/roof";
import { seasonMonths, seasonSummary, type SeasonMonth } from "@/lib/season";
import { useMedia } from "@/lib/useMedia";
import { SOURCES, areaSource } from "@/lib/sources";
import SourceTip from "../SourceTip";

const nf = (v: number) => v.toLocaleString("en-US");
// 46,200 -> "46k" for axis ticks and bar labels; the axis title says so.
const kL = (v: number) => (v >= 1000 ? `${nf(Math.round(v / 1000))}k` : nf(Math.round(v / 100) * 100));
const times = (n: number) => (n >= 10 ? nf(Math.round(n)) : (Math.round(n * 10) / 10).toLocaleString("en-US"));

// A typical year on this roof from the WMO 1991 to 2020 monthly normals:
// what it could collect each month, with the monsoon highlighted, and how
// often that refills your tank.
export default function SeasonTab({ result, roof }: { result: RainResult; roof: Roof }) {
  const [table, setTable] = useState(false);
  // The roof and setup from the result; each month brings its own rain.
  const inputs = result.inputs;
  const months = seasonMonths(inputs);
  const yours = seasonSummary(months, inputs.tankLitres);
  const storage = recommendedStack(result).tanks.reduce((s, t) => s + t.capacity, 0);
  const withRec = seasonSummary(months, storage);
  const spec = ROOF_TYPES[inputs.roofType];
  const tip = {
    method: `Each month: ${nf(Math.round(inputs.areaM2))} m² × ${Math.round(inputs.usableShare * 100)}% usable × (monthly normal − ${inputs.firstFlushMm} mm first flush) × runoff ${spec.mid}. One first flush per month, a simplification.`,
    sources: [SOURCES.normals, areaSource(roof.source), SOURCES.usableShare, SOURCES.firstFlush, SOURCES.runoff],
  };

  return (
    <div className="space-y-6 text-sm">
      <section aria-labelledby="season-head">
        <h3 id="season-head" className="text-xs font-semibold uppercase tracking-widest text-muted">
          A typical year on your roof
          <SourceTip {...tip} />
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat label="A typical year" value={formatL(yours.yearLitres)} note="you could collect" />
          <Stat
            label="July to September"
            value={formatL(yours.monsoonLitres)}
            note={`${Math.round(yours.monsoonShare * 100)}% of the year, in three months`}
            accent
          />
          <Stat
            label="Monsoon refills"
            value={inputs.tankLitres > 0 ? `${times(yours.monsoonRefills)} ×` : "No tank"}
            note={
              inputs.tankLitres > 0
                ? `your ${formatL(inputs.tankLitres)} tank, if you use it between rains`
                : "set a tank size to see refills"
            }
          />
        </div>
        {storage > inputs.tankLitres && (
          <p className="mt-2 text-[13px] text-fg">
            With RainGrid&apos;s recommended storage ({formatL(storage)} in all), that is about{" "}
            <span className="num text-tank-deep">{times(withRec.monsoonRefills)} refills</span> in a typical monsoon.
          </p>
        )}
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
                <th className="py-1.5 text-right font-normal">You could collect</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className={`border-b border-line/60 ${m.monsoon ? "text-tank-deep" : ""}`}>
                  <td className="py-1.5 pr-3">{m.month}</td>
                  <td className="py-1.5 pr-3 text-right">{m.mm}</td>
                  <td className="py-1.5 text-right">{formatL(m.litres)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-1.5 pr-3">Year</td>
                <td className="py-1.5 pr-3 text-right">{nf(Math.round(months.reduce((s, m) => s + m.mm, 0) * 10) / 10)}</td>
                <td className="py-1.5 text-right">{formatL(yours.yearLitres)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "border-tank/40 bg-tank/5" : "border-line"}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`num mt-0.5 text-2xl font-semibold ${accent ? "text-tank-deep" : "text-fg"}`}>{value}</p>
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
          <text x={left - 6} y={yOf(t) + 3.5} textAnchor="end" className="num" fontSize={9.5} fill="var(--color-muted)">
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
              <text x={x + bw / 2} y={y - 4} textAnchor="middle" className="num" fontSize={9.5} fontWeight={600} fill="var(--color-tank-deep)">
                {kL(m.litres)}
              </text>
            )}
            <text x={x + bw / 2} y={H - bottom + 14} textAnchor="middle" fontSize={9.5} fill={m.monsoon ? "var(--color-fg)" : "var(--color-muted)"}>
              {m.month}
            </text>
            <text x={x + bw / 2} y={H - bottom + 26} textAnchor="middle" className="num" fontSize={8} fill="var(--color-muted)">
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
