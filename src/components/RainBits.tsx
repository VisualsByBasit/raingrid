"use client";

import { GAUGE_CONFIDENCE_LABEL, gaugeConfidence, gaugeConfidenceNote, mmExplainer } from "@/lib/explain";
import Hint from "./guide/Hint";

// Small pieces shared by the side panel and the Rain Report.

const CONFIDENCE_STYLE = {
  good: "bg-ground/10 text-ground-deep",
  fair: "bg-tank/10 text-tank-deep",
  low: "bg-drain/10 text-drain-deep",
} as const;

// "Good match (?)": how well the nearest gauge stands in for this roof.
export function GaugeBadge({ km }: { km: number }) {
  const level = gaugeConfidence(km);
  return (
    <span className="ml-1 inline-flex items-center whitespace-nowrap align-middle">
      <span className={`rounded-full px-1.5 py-px text-[11px] font-medium ${CONFIDENCE_STYLE[level]}`}>
        {GAUGE_CONFIDENCE_LABEL[level]}
      </span>
      <Hint text={gaugeConfidenceNote(km)} label="How good is this gauge for my roof?" />
    </span>
  );
}

// "157 mm (?) of rain · measured at Saidpur gauge, 3 km from your roof [Fair match]"
export function RainLine({ mm, where, km, className = "" }: { mm: number; where: string; km?: number; className?: string }) {
  return (
    <p className={className}>
      <span className="num font-semibold text-tank-deep">{mm.toLocaleString("en-US")} mm</span>
      <Hint text={mmExplainer(mm)} label="What does mm of rain mean?" />{" "}
      of rain · {where}
      {km != null && <GaugeBadge km={km} />}
    </p>
  );
}

// Recharge depends on the ground under the plot, which no map can show.
export const RECHARGE_SUITABILITY =
  "Recharge suitability depends on your soil and the depth to groundwater, so it is checked on the site visit. RAIN//GRID shows water routed toward a well, never measured infiltration.";

// A small tank whose water level shows how full it is (0 to 1). The level
// moves with a transform, so it never triggers layout.
export function TankIcon({ fill, className = "h-14 w-9" }: { fill: number; className?: string }) {
  const k = Math.max(0, Math.min(1, fill));
  return (
    <span aria-hidden className={`relative block overflow-hidden rounded-md border border-tank/50 bg-panel ${className}`}>
      <span
        className="absolute inset-0 origin-bottom bg-tank/75 transition-transform duration-700 ease-out"
        style={{ transform: `scaleY(${k})` }}
      />
      <span className="num absolute inset-x-0 top-0.5 text-center text-[8px] font-semibold text-fg/70">TANK</span>
    </span>
  );
}
