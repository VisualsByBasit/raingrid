// The numbers behind the Rain Report's Overview visuals: the tanks filling
// and the three gauges. Pure, built only from the engine's result and the
// package recommendation, so the pictures can't disagree with the numbers.

import type { RainResult } from "./engine";
import { recommend } from "./engine/recommend";

const nf = (v: number) => (Math.round(v / 100) * 100).toLocaleString("en-US");
const pct = (v: number) => `${Math.round(v * 100)}%`;
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

export interface TankSlot {
  label: string;
  capacity: number;
  filled: number;
  isNew: boolean;
}

// The collectable water poured into your current tank first, then each
// recommended new tank; whatever is left overflows.
export function tankStack(collect: number, existingLitres: number, added: { size: number; count: number } | null) {
  const tanks: TankSlot[] = [];
  if (existingLitres > 0) tanks.push({ label: "Your tank", capacity: existingLitres, filled: 0, isNew: false });
  for (let i = 0; i < (added?.count ?? 0); i++) {
    tanks.push({ label: "New RainGrid tank", capacity: added!.size, filled: 0, isNew: true });
  }
  let left = Math.max(0, Number.isFinite(collect) ? collect : 0);
  for (const t of tanks) {
    t.filled = Math.min(t.capacity, left);
    left -= t.filled;
  }
  return { tanks, stored: tanks.reduce((s, t) => s + t.filled, 0), overflow: left };
}

// The tanks for this roof: your tank plus what RainGrid recommends.
export function recommendedStack(r: RainResult) {
  const { areaM2, tankLitres } = r.inputs;
  const rec = recommend({ areaM2, stormLitres: r.net.mid, tankFills: tankLitres > 0 ? r.net.mid / tankLitres : 0 });
  return tankStack(r.net.mid, tankLitres, rec.tank);
}

export interface GaugeReading {
  id: "tank" | "captured" | "recharge";
  label: string;
  value: number; // 0..1
  litres: number;
  meaning: string;
  // True when the reading is a "what if" (recharge without a well).
  hypothetical: boolean;
}

export function overviewGauges(r: RainResult): GaugeReading[] {
  const { tankLitres, hasRecharge } = r.inputs;
  const gross = Math.max(1, r.gross);
  const tankFill = tankLitres > 0 ? clamp01(r.split.tank / tankLitres) : 0;
  const kept = r.split.tank + r.split.rechargePotential;
  const toWell = hasRecharge ? r.split.rechargePotential : Math.max(0, r.net.mid - r.split.tank);
  return [
    {
      id: "tank",
      label: "Tank fill",
      value: tankFill,
      litres: r.split.tank,
      meaning:
        tankLitres <= 0
          ? "No tank is set up, so nothing is stored."
          : tankFill >= 0.995
            ? `Your ${nf(tankLitres)} L tank fills to the top in this storm.`
            : `Your ${nf(tankLitres)} L tank ends this storm ${pct(tankFill)} full.`,
      hypothetical: false,
    },
    {
      id: "captured",
      label: "Rain kept",
      value: clamp01(kept / gross),
      litres: kept,
      meaning: `${pct(clamp01(kept / gross))} of the rain on your roof is kept${
        hasRecharge ? ", in the tank or sent toward your well" : " in your tank"
      }. The rest goes to the drain or is lost on the roof.`,
      hypothetical: false,
    },
    {
      id: "recharge",
      label: hasRecharge ? "Recharge potential" : "With a recharge well",
      value: clamp01(toWell / gross),
      litres: toWell,
      meaning: hasRecharge
        ? `${pct(clamp01(toWell / gross))} of the rain is routed toward your well. Potential only: soil and groundwater are checked on site.`
        : `${pct(clamp01(toWell / gross))} of the rain could go toward groundwater instead of the drain if you add a well. Checked on site.`,
      hypothetical: !hasRecharge,
    },
  ];
}
