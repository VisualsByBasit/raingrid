// "This storm's water is worth about N tanker loads." Pure maths on top of
// the engine's litres and the configured tanker presets.

import { TANKER_PRESETS, TANKER_SIZE, type TankerPreset } from "../config/tankers";

const nf = (v: number) => v.toLocaleString("en-US");

export function tankerLoads(litres: number, tankerLitres = TANKER_SIZE.litres): number {
  if (!(tankerLitres > 0) || !Number.isFinite(litres) || litres <= 0) return 0;
  return litres / tankerLitres;
}

// Rupees rounded to the nearest 10 below Rs 1,000, nearest 100 above.
export function roundRs(rs: number): number {
  if (!(rs > 0)) return 0;
  return rs < 1000 ? Math.round(rs / 10) * 10 : Math.round(rs / 100) * 100;
}

// "0.3", "1.5", "12"
export function loadsLabel(loads: number): string {
  if (loads >= 10) return nf(Math.round(loads));
  return nf(Math.round(loads * 10) / 10);
}

export interface TankerValue {
  preset: TankerPreset;
  rupees: number;
}

export function tankerComparison(litres: number, presets = TANKER_PRESETS, tankerLitres = TANKER_SIZE.litres) {
  const loads = tankerLoads(litres, tankerLitres);
  return {
    loads,
    // Under a twentieth of a load the comparison says nothing useful.
    meaningful: loads >= 0.05,
    values: presets.map((preset): TankerValue => ({ preset, rupees: roundRs(loads * preset.priceRs) })),
  };
}
