"use client";

import { TANKER_SIZE } from "@/config/tankers";
import { formatL } from "@/lib/engine";
import { loadsLabel, tankerComparison } from "@/lib/tanker";
import Hint from "../guide/Hint";

const loadsText = (loads: number) => `${loadsLabel(loads)} tanker ${loads >= 0.95 && loads < 1.05 ? "load" : "loads"}`;

// What the water kept from this storm would cost from a tanker, at the
// configured CDA and private prices (both estimates). Leads with what the
// tank actually kept; the full harvest shows what more storage could add.
export default function TankerCompare({ stored, harvestable }: { stored: number; harvestable: number }) {
  const kept = tankerComparison(stored);
  const all = tankerComparison(harvestable);
  if (!kept.meaningful && !all.meaningful) return null;
  const hint = [
    `Tanker size: ${TANKER_SIZE.label}, ${TANKER_SIZE.note}; neither source states a size.`,
    ...kept.values.map((v) => `${v.preset.label}: Rs ${v.preset.priceRs.toLocaleString("en-US")}, ${v.preset.note} (${v.preset.source.label}).`),
    "Your price depends on your sector, the season and the supplier.",
  ].join(" ");
  const more = harvestable - stored >= TANKER_SIZE.litres * 0.05;
  return (
    <div className="rounded-lg border border-ground/30 bg-ground/5 p-3">
      <p>
        Your tank kept <span className="num">{formatL(stored)}</span> from this storm: about{" "}
        <span className="num font-semibold text-ground-deep">{loadsText(kept.loads)}</span>
        <Hint text={hint} label="Where do the tanker prices come from?" />
      </p>
      <ul className="mt-1.5 space-y-0.5 text-[13px]">
        {kept.values.map((v) => (
          <li key={v.preset.id} className="flex justify-between gap-3">
            <span className="text-muted">
              At the {v.preset.short} price{" "}
              <a className="underline decoration-line underline-offset-2 hover:text-tank-deep" href={v.preset.source.url} target="_blank" rel="noreferrer">
                ({v.preset.source.label})
              </a>
            </span>
            <span className="num shrink-0 text-fg">Rs {v.rupees.toLocaleString("en-US")}</span>
          </li>
        ))}
      </ul>
      {more && (
        <p className="mt-1.5 text-[13px] text-fg">
          With room for all of it, the harvest of <span className="num">{formatL(harvestable)}</span> would be about{" "}
          <span className="num text-ground-deep">{loadsText(all.loads)}</span>.
        </p>
      )}
      <p className="mt-1 text-[11px] text-muted">Estimate. Assumes a {TANKER_SIZE.label} tanker, {TANKER_SIZE.note}.</p>
    </div>
  );
}
