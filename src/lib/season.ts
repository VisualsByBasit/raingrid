// A typical year on this roof, month by month, from the WMO 1991 to 2020
// monthly normals (Islamabad Airport). Each month runs through the same
// engine as a storm. Simplification, stated in the app: each month counts
// one first flush, as the monsoon and year presets already do. No hourly or
// invented storm curves.

import { MONTHLY_NORMALS } from "../data/storms";
import { calculate, type RainInput } from "./engine";

// July, August, September.
export const MONSOON_MONTHS = ["Jul", "Aug", "Sep"];

export interface SeasonMonth {
  month: string;
  mm: number;
  litres: number; // harvestable (engine net, mid)
  monsoon: boolean;
}

export function seasonMonths(inputs: Omit<RainInput, "rainMm">): SeasonMonth[] {
  return MONTHLY_NORMALS.map(({ month, mm }) => ({
    month,
    mm,
    litres: calculate({ ...inputs, rainMm: mm }).net.mid,
    monsoon: MONSOON_MONTHS.includes(month),
  }));
}

// Year and monsoon totals, and how many times that water would fill a tank
// of a given size (assuming it is used between rains).
export function seasonSummary(months: SeasonMonth[], storageLitres: number) {
  const year = months.reduce((s, m) => s + m.litres, 0);
  const monsoon = months.filter((m) => m.monsoon).reduce((s, m) => s + m.litres, 0);
  return {
    yearLitres: year,
    monsoonLitres: monsoon,
    monsoonShare: year > 0 ? monsoon / year : 0,
    monsoonRefills: storageLitres > 0 ? monsoon / storageLitres : 0,
  };
}
