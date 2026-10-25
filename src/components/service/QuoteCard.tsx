"use client";

import { useEffect, useState } from "react";
import { ESTIMATE_LABEL, PACKAGES, RECHARGE_ADDON, type PackageId } from "@/config/packages";
import type { RainResult } from "@/lib/engine";
import { defaultTank, recommend } from "@/lib/engine/recommend";
import { buildQuote, instalments, type Quote } from "@/lib/quote";

export interface QuoteChoice {
  package: PackageId;
  tank: { size: 1000 | 2000; count: number } | null;
  recharge: boolean;
  quote: Quote;
}

const rs = (v: number) => `Rs ${v.toLocaleString("en-US")}`;
const range = (lo: number, hi: number) => (lo === hi ? rs(lo) : `${rs(lo)} to ${hi.toLocaleString("en-US")}`);

// The package a roof needs, priced from src/config/packages.ts. The
// recommendation comes from the engine (one 2,000 L tank, a recharge well
// for the overflow); the user can compare the other packages, add tanks to
// store more, add drinking water or a recharge well. Reports the current
// choice up for the site-visit request.
export default function QuoteCard({
  result,
  onChoice,
}: {
  result: RainResult;
  onChoice?: (c: QuoteChoice) => void;
}) {
  const [drinking, setDrinking] = useState(false);
  const stormLitres = result.net.mid;
  const tankLitres = result.inputs.tankLitres;
  const rec = recommend({
    areaM2: result.inputs.areaM2,
    stormLitres,
    tankFills: tankLitres > 0 ? stormLitres / tankLitres : 0,
    wantsDrinking: drinking,
  });
  const [picked, setPicked] = useState<PackageId | null>(null);
  const [rechargeOverride, setRechargeOverride] = useState<boolean | null>(null);
  const pkg = picked ?? rec.package;
  const recharge = rechargeOverride ?? (rec.suggestRecharge || result.inputs.hasRecharge);
  const [extra, setExtra] = useState(0);
  const baseTank = rec.tank ?? defaultTank(result.inputs.areaM2);
  // Optional extra 2,000 L tanks, as far as this storm's overflow fills them.
  const canAdd = pkg !== "basic" && rec.tank?.size === 2000 ? rec.extraTanksUseful : 0;
  const extraN = Math.min(extra, canAdd);
  const tank = pkg === "basic" ? null : { size: baseTank.size, count: baseTank.count + extraN };
  const quote = buildQuote(pkg, tank, { recharge });
  const six = instalments(quote, 6);
  const twelve = instalments(quote, 12);
  const [open, setOpen] = useState(false);

  // Report the choice for the request form whenever it changes.
  const choiceKey = `${pkg}|${tank?.size}|${tank?.count}|${recharge}|${quote.lowRs}|${quote.highRs}`;
  useEffect(() => {
    onChoice?.({ package: pkg, tank, recharge, quote });
    // choiceKey captures every value that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choiceKey, onChoice]);

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Package" className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-ink p-1">
        {(Object.keys(PACKAGES) as PackageId[]).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={pkg === id}
            onClick={() => {
              setPicked(id);
              if (id === "plus") setDrinking(true);
              else if (drinking) setDrinking(false);
            }}
            className={`relative rounded-lg px-2 py-2 text-sm font-semibold transition ${
              pkg === id ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            {PACKAGES[id].name}
            {rec.package === id && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ground-deep px-1.5 text-[9px] font-semibold uppercase tracking-wider text-panel">
                For you
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-tank/30 bg-tank/5 p-3">
        <p className="text-[13px] text-fg">{PACKAGES[pkg].summary}</p>
        {tank && (
          <p className="mt-1 text-xs text-muted">
            Tank: {tank.count > 1 ? `${tank.count} × ` : ""}
            {tank.size.toLocaleString("en-US")} L{extraN > 0 ? `, including ${extraN} extra` : ""}.
          </p>
        )}
        {canAdd > 0 && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-line bg-panel px-3 py-2">
            <span>
              <span className="block text-xs font-semibold text-fg">Add tanks to store more</span>
              <span className="block text-[11px] text-muted">
                Optional. This storm overflowed about {(Math.round(rec.overflowLitres / 100) * 100).toLocaleString("en-US")} L; each
                extra 2,000 L tank keeps more of it.
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Extra tanks">
              <button
                onClick={() => setExtra(Math.max(0, extraN - 1))}
                disabled={extraN === 0}
                aria-label="One tank fewer"
                className="grid h-7 w-7 place-items-center rounded-md border border-line text-fg disabled:opacity-40"
              >
                −
              </button>
              <span className="num w-8 text-center text-sm text-fg" aria-live="polite">
                +{extraN}
              </span>
              <button
                onClick={() => setExtra(Math.min(canAdd, extraN + 1))}
                disabled={extraN >= canAdd}
                aria-label="One more tank"
                className="grid h-7 w-7 place-items-center rounded-md border border-line text-fg disabled:opacity-40"
              >
                +
              </button>
            </span>
          </div>
        )}
        <p className="num mt-2 text-2xl font-semibold text-fg">{range(quote.lowRs, quote.highRs)}</p>
        <p className="text-xs text-muted">Indicative installed price, confirmed on the free site visit.</p>
        {quote.onSiteVisit.length > 0 && (
          <p className="mt-1 text-xs text-ground-deep">+ {RECHARGE_ADDON.name}: {RECHARGE_ADDON.price}</p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {[six, twelve].map((i) => (
            <div key={i.months} className="rounded-lg border border-line bg-panel px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-muted">{i.months} months</p>
              <p className="num text-sm font-semibold text-fg">
                {range(i.lowRs, i.highRs)}
                <span className="font-sans text-xs font-normal text-muted"> /mo</span>
              </p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">Indicative instalments, subject to Zindigi&apos;s terms: the range split evenly, before any financing charges.</p>

        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-2 text-xs text-tank-deep underline underline-offset-4">
          {open ? "Hide" : "See"} what&apos;s in the price
        </button>
        {open && (
          <ul className="mt-2 space-y-1 text-xs">
            {quote.lines.map((l) => (
              <li key={l.part} className="flex justify-between gap-3">
                <span className="text-muted">
                  {l.label}
                  {l.estimate && <span className="text-muted/80"> ({ESTIMATE_LABEL})</span>}
                </span>
                <span className="num shrink-0 text-fg">{range(Math.round(l.lowRs), Math.round(l.highRs))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {rec.reasons.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted">
          {rec.reasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
      )}

      <label className="flex items-center justify-between gap-3 text-sm">
        <span>I want drinking water too</span>
        <input
          type="checkbox"
          checked={drinking}
          onChange={(e) => {
            setDrinking(e.target.checked);
            setPicked(null);
          }}
          className="h-5 w-5 accent-[var(--color-tank)]"
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Add a recharge well
          <span className="block text-xs text-muted">Quote on site visit; suitability depends on soil and depth to groundwater.</span>
        </span>
        <input
          type="checkbox"
          checked={recharge}
          onChange={(e) => setRechargeOverride(e.target.checked)}
          className="h-5 w-5 accent-[var(--color-ground)]"
        />
      </label>

      <div className="rounded-xl border border-line p-3 text-[13px]">
        <p className="font-semibold text-fg">What this water is for</p>
        <p className="mt-1 text-muted">
          Toilets, washing, cleaning, the garden and recharge. Drinking only with Plus, through the 7-stage filter with UV.
          Road water is never collected: only clean roof water goes in.
        </p>
      </div>
    </div>
  );
}
