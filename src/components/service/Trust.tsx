"use client";

import { ESTIMATE_LABEL, MAINTENANCE } from "@/config/packages";

const rs = (v: number) => v.toLocaleString("en-US");

// Yearly maintenance plan, priced from sourced labour rates.
export function MaintenanceCard() {
  return (
    <details className="group rounded-xl border border-line p-3 text-[13px]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-fg">
        Yearly maintenance plan
        <span className="num text-xs font-normal text-tank-deep">
          Rs {rs(MAINTENANCE.visitLowRs)} to {rs(MAINTENANCE.visitHighRs)} a visit
        </span>
      </summary>
      <ul className="mt-2 space-y-1.5">
        {MAINTENANCE.tasks.map((t) => (
          <li key={t.name}>
            <span className="text-fg">{t.name}:</span> <span className="text-muted">{t.what}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Visit price: {MAINTENANCE.visitSource} ({ESTIMATE_LABEL}). {MAINTENANCE.separately}
      </p>
    </details>
  );
}

// Why the stored water is safe to use, and what it is not for.
export function WaterSafety() {
  const points = [
    { t: "First flush", b: "The dirtiest first rain of every storm, with roof dust and droppings, is diverted to the drain before anything reaches the tank." },
    { t: "Mesh screens", b: "A leaf screen on the gutter and mesh on the inlet and overflow keep out leaves, insects and mosquitoes." },
    { t: "Sealed food-grade tank", b: "A covered, food-grade tank keeps out light, so algae don't grow, and keeps the water clean between rains." },
    { t: "Filter + UV for drinking", b: "Drinking water only comes through the 7-stage filter with UV (Plus). Without it, use the water for toilets, washing, cleaning and the garden." },
    { t: "Acidic rain", b: "Rain is naturally slightly acidic. UPVC pipes and food-grade plastic tanks don't rust like bare metal, so it does them no harm." },
    { t: "Roofs only", b: "RainGrid only collects roof water. Road and street water is never collected." },
  ];
  return (
    <details className="rounded-xl border border-line p-3 text-[13px]">
      <summary className="cursor-pointer list-none font-semibold text-fg">Is the water safe?</summary>
      <ul className="mt-2 space-y-1.5">
        {points.map((p) => (
          <li key={p.t}>
            <span className="text-fg">{p.t}:</span> <span className="text-muted">{p.b}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">The site visit checks your roof surface and the tank spot. A water test is part of the yearly visit.</p>
    </details>
  );
}
