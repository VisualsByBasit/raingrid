"use client";

import { ESTIMATE_LABEL, MAINTENANCE, SERVICE_LINE } from "@/config/packages";
import { SOURCES } from "@/lib/sources";
import SourceTip from "../SourceTip";

const rs = (v: number) => v.toLocaleString("en-US");

// Yearly maintenance plan, priced from sourced labour rates.
export function MaintenanceCard() {
  return (
    <details className="group rounded-xl border border-line p-3 text-[13px]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-fg">
        Yearly maintenance plan
        <span className="num shrink-0 whitespace-nowrap text-xs font-normal text-tank-deep">
          Rs {rs(MAINTENANCE.visitLowRs)} to {rs(MAINTENANCE.visitHighRs)} a visit
        </span>
      </summary>
      <ul className="mt-2 space-y-1.5">
        {MAINTENANCE.tasks.map((t) => (
          <li key={t.name}>
            <span className="text-fg">{t.name}:</span> <span className="text-muted">{t.what}</span>
            {t.name === "Tank clean" && (
              <SourceTip method="Clean tanks once a year (Mosley, SOPAC 2005, Tank maintenance)." sources={[SOURCES.waterQuality]} />
            )}
          </li>
        ))}
      </ul>
      <ul className="mt-2 space-y-0.5 border-t border-line pt-2 text-xs">
        <li className="flex justify-between gap-3">
          <span className="text-muted">Plumber and helper, one day ({ESTIMATE_LABEL})</span>
          <span className="num shrink-0 text-fg">
            Rs {rs(MAINTENANCE.labourLowRs)} to {rs(MAINTENANCE.labourHighRs)}
          </span>
        </li>
        <li className="flex justify-between gap-3">
          <span className="text-muted">{SERVICE_LINE}</span>
          <span className="num shrink-0 text-fg">
            Rs {rs(Math.round(MAINTENANCE.serviceLowRs))} to {rs(Math.round(MAINTENANCE.serviceHighRs))}
          </span>
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted">
        Labour: {MAINTENANCE.visitSource}. {MAINTENANCE.separately}
      </p>
    </details>
  );
}

// Why the stored water is safe to use, and what it is not for. Lines that
// rest on published guidance carry its source tip.
export function WaterSafety() {
  const points: { t: string; b: string; tip?: string }[] = [
    {
      t: "First flush",
      b: "The dirtiest first rain of every storm, with roof dust and droppings, is diverted to the drain before anything reaches the tank.",
      tip: "With the first flush diverted, the water collected is much cleaner (Mosley, SOPAC 2005, First-flush devices).",
    },
    { t: "Mesh screens", b: "A leaf screen on the gutter and mesh on the inlet and overflow keep out leaves, insects and mosquitoes." },
    { t: "Sealed food-grade tank", b: "A covered, food-grade tank keeps out light, so algae don't grow, and keeps the water clean between rains." },
    {
      t: "Cleaning",
      b: "The tank is cleaned once a year, and the roof and gutters are kept clear of leaves and debris.",
      tip: "Clean tanks once a year, and keep roofs and gutters free of debris (Mosley, SOPAC 2005, Tank maintenance; Roofs).",
    },
    { t: "Filter + UV for drinking", b: "Drinking water only comes through the 7-stage filter with UV (Plus). Without it, use the water for toilets, washing, cleaning and the garden." },
    {
      t: "Acidic rain",
      b: "Acidic rain mainly affects metal parts, so the kit uses PVC and food-grade plastic.",
      tip: "Acidic rain means more corrosion and leaching of metals from roofs and fittings; PVC gutters do not rust; tanks should be food-grade plastic (Mosley, SOPAC 2005).",
    },
    { t: "Roofs only", b: "RainGrid only collects roof water. Road and street water is never collected." },
  ];
  return (
    <details className="rounded-xl border border-line p-3 text-[13px]">
      <summary className="cursor-pointer list-none font-semibold text-fg">Is the water safe?</summary>
      <ul className="mt-2 space-y-1.5">
        {points.map((p) => (
          <li key={p.t}>
            <span className="text-fg">{p.t}:</span> <span className="text-muted">{p.b}</span>
            {p.tip && <SourceTip method={p.tip} sources={[SOURCES.waterQuality]} />}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">The site visit checks your roof surface and the tank spot. A water test is part of the yearly visit.</p>
    </details>
  );
}
