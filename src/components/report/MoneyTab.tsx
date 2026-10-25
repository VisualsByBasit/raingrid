"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { MAINTENANCE } from "@/config/packages";
import { TANKER_PRESETS, TANKER_SIZE } from "@/config/tankers";
import { formatL, type RainResult } from "@/lib/engine";
import { sentence } from "@/lib/explain";
import { monsoonCatch, seasonMonths } from "@/lib/season";
import { SOURCES } from "@/lib/sources";
import { loadsLabel, tankerComparison } from "@/lib/tanker";
import TankerCompare from "../act/TankerCompare";
import SourceTip from "../SourceTip";
import DailyUse from "./DailyUse";
import { storageFor } from "./SeasonTab";

const rs = (v: number) => `Rs ${Math.round(v).toLocaleString("en-US")}`;

// What the water is worth: this storm in tanker loads, then a typical
// monsoon's catch (capped by storage and daily use, never the full harvest)
// priced at both tanker presets, next to harvesting's yearly running cost.
// The installation itself is priced in "Get it installed".
export default function MoneyTab({
  result,
  dailyUse,
  setDailyUse,
}: {
  result: RainResult;
  dailyUse: number;
  setDailyUse: (v: number) => void;
}) {
  const reduced = useReducedMotion();
  const [table, setTable] = useState(false);
  const storage = storageFor(result);
  const c = monsoonCatch(seasonMonths(result.inputs), storage.total, dailyUse);
  const value = tankerComparison(c.caught);
  const byId = Object.fromEntries(value.values.map((v) => [v.preset.id, v.rupees]));
  const rows = [
    ...TANKER_PRESETS.map((p) => ({
      id: p.id,
      label: `Buying it from ${p.short} tankers`,
      lo: byId[p.id] ?? 0,
      hi: byId[p.id] ?? 0,
      color: "var(--color-drain)",
      note: `Rs ${p.priceRs.toLocaleString("en-US")} a load, ${p.source.label}`,
      url: p.source.url,
    })),
    {
      id: "harvest",
      label: "Harvesting it: the yearly maintenance visit",
      lo: MAINTENANCE.visitLowRs,
      hi: MAINTENANCE.visitHighRs,
      color: "var(--color-ground)",
      note: "labour plus the RainGrid service",
      url: undefined,
    },
  ];
  const max = Math.max(1, ...rows.map((r) => r.hi));
  const tip = {
    method: `${formatL(c.caught)} ÷ ${TANKER_SIZE.litres.toLocaleString("en-US")} L a load = ${loadsLabel(value.loads)} loads, × Rs ${TANKER_PRESETS.map((p) => p.priceRs.toLocaleString("en-US")).join(" or Rs ")} a load.`,
    sources: [
      ...TANKER_PRESETS.map((p) => ({ label: `${p.label}: Rs ${p.priceRs.toLocaleString("en-US")}, ${p.source.label}`, url: p.source.url })),
      { label: `Tanker size: ${TANKER_SIZE.label}, ${TANKER_SIZE.note}` },
      SOURCES.rainDays,
      SOURCES.dailyUse,
      SOURCES.recommendation,
    ],
  };

  return (
    <div className="space-y-8 text-sm">
      <section aria-labelledby="money-storm">
        <h3 id="money-storm" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          This storm
        </h3>
        <TankerCompare stored={result.split.tank} harvestable={result.net.mid} />
      </section>

      <section aria-labelledby="money-monsoon">
        <h3 id="money-monsoon" className="text-xs font-semibold uppercase tracking-widest text-muted">
          A typical monsoon, July to September
          <SourceTip {...tip} />
        </h3>
        <p className="mt-2 text-[15px] text-fg">
          {sentence(storage.words)} could catch up to <span className="num font-semibold">{formatL(c.caught)}</span>: about{" "}
          <span className="num font-semibold">{loadsLabel(value.loads)} tanker loads</span>.
        </p>

        <div className="mt-4 space-y-3" role="img" aria-label={rows.map((r) => `${r.label}: ${r.lo === r.hi ? rs(r.lo) : `${rs(r.lo)} to ${rs(r.hi)}`}`).join("; ")}>
          {rows.map((r, i) => (
            <div key={r.id}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-fg">{r.label}</span>
                <span className="num shrink-0 font-semibold text-fg">{r.lo === r.hi ? rs(r.lo) : `${rs(r.lo)} to ${Math.round(r.hi).toLocaleString("en-US")}`}</span>
              </div>
              <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-line/60">
                {/* The range's top end, lighter; then the low end, solid. */}
                {[r.hi, r.lo].map((v, j) => (
                  <motion.span
                    key={j}
                    className="absolute inset-y-0 left-0 w-full origin-left"
                    style={{ background: r.color, opacity: j === 0 && r.hi !== r.lo ? 0.35 : 0.85 }}
                    initial={{ scaleX: reduced ? v / max : 0 }}
                    animate={{ scaleX: v / max }}
                    transition={{ duration: reduced ? 0 : 0.6, delay: reduced ? 0 : 0.1 * i }}
                  />
                ))}
              </div>
              <p className="mt-0.5 text-[11px] text-muted">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-tank">
                    {r.note} ↗
                  </a>
                ) : (
                  r.note
                )}
              </p>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-1 text-[11px] text-muted">
            <span>Rs 0</span>
            <span>Rupees for one monsoon&apos;s water</span>
            <span>{rs(max)}</span>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 rounded-xl border border-drain/30 bg-drain/5 p-3 text-xs text-fg">
          <li>
            <span className="font-semibold">Needs enough storage.</span> This counts only the{" "}
            <span className="num">{formatL(c.caught)}</span> your storage can catch, not the{" "}
            <span className="num">{formatL(c.harvest)}</span> that falls on your roof from July to September.
          </li>
          <li>
            <span className="font-semibold">Assumed tanker size:</span> {TANKER_SIZE.label}, {TANKER_SIZE.note}. Neither price source
            states a size.
          </li>
          <li>
            Tanker prices are reported figures used as an estimate: yours depends on your sector, the season and the supplier.
            The private price is from Rawalpindi in 2023.
          </li>
          <li>The value counts the monsoon only; rain in the rest of the year adds more. The installation is priced in Get it installed.</li>
        </ul>

        <div className="mt-4">
          <DailyUse value={dailyUse} onChange={setDailyUse} />
        </div>

        <button onClick={() => setTable((v) => !v)} aria-expanded={table} className="mt-3 text-xs text-tank-deep underline underline-offset-4">
          {table ? "Hide the table" : "Show as a table"}
        </button>
        {table && (
          <table className="num mt-2 w-full border-collapse text-left text-xs">
            <caption className="sr-only">A typical monsoon&apos;s water, in tanker loads and rupees</caption>
            <tbody>
              {[
                ["Your roof could collect, July to September", formatL(c.harvest)],
                [`Your storage could catch (${dailyUse.toLocaleString("en-US")} L a day used)`, formatL(c.caught)],
                ["Tanker loads", loadsLabel(value.loads)],
                ...rows.map((r) => [r.label, r.lo === r.hi ? rs(r.lo) : `${rs(r.lo)} to ${Math.round(r.hi).toLocaleString("en-US")}`]),
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-line/60">
                  <td className="py-1.5 pr-3">{k}</td>
                  <td className="py-1.5 text-right">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
