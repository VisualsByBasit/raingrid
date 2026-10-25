"use client";

import { useState } from "react";
import { readFlag, writeFlag } from "../guide/GuideContext";

// After the Rain Plan: one or two small promises, remembered in this
// browser only. "Site visit" leads into the request flow when one exists.
const PLEDGES = [
  { id: "visit", key: "rg-pledge-visit", label: "I'll get a site visit" },
  { id: "clean", key: "rg-pledge-clean", label: "I'll clean my roof drains before the monsoon" },
] as const;

export default function Pledge({ onSiteVisit }: { onSiteVisit?: () => void }) {
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PLEDGES.map((p) => [p.id, readFlag(p.key) === "1"])),
  );
  const toggle = (id: string, key: string) => {
    const next = !on[id];
    setOn((o) => ({ ...o, [id]: next }));
    writeFlag(key, next ? "1" : "0");
  };
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs uppercase tracking-widest text-muted">Your next step</p>
      <div className="mt-2 space-y-2">
        {PLEDGES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="checkbox"
            aria-checked={on[p.id]}
            onClick={() => toggle(p.id, p.key)}
            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
              on[p.id] ? "border-ground/60 bg-ground/10" : "border-line hover:border-tank/50"
            }`}
          >
            <span
              aria-hidden
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs ${
                on[p.id] ? "border-ground-deep bg-ground-deep text-panel" : "border-line"
              }`}
            >
              {on[p.id] ? "✓" : ""}
            </span>
            {p.label}
          </button>
        ))}
      </div>
      {on.visit &&
        (onSiteVisit ? (
          <button onClick={onSiteVisit} className="btn-primary mt-3 w-full rounded-lg px-4 py-2.5 font-semibold">
            Request a free site visit
          </button>
        ) : (
          <p className="mt-2 text-xs text-muted">Thanks. Site visit requests open here soon.</p>
        ))}
      {on.clean && <p className="mt-2 text-xs text-muted">Saved in this browser. Clear the gutters, leaf screen and first-flush pipe before the first monsoon rain.</p>}
    </div>
  );
}
