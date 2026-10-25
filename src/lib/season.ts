// A typical year on this roof, month by month, from the WMO 1991 to 2020
// monthly normals (Islamabad Airport): rainfall and the number of rain days.
// Each month runs through the same engine as a storm. Simplification, stated
// in the app: each month counts one first flush, as the monsoon and year
// presets already do. No hourly or invented storm curves.

import { MONTHLY_NORMALS } from "../data/storms";
import { calculate, type RainInput } from "./engine";

// July, August, September.
export const MONSOON_MONTHS = ["Jul", "Aug", "Sep"];

export interface SeasonMonth {
  month: string;
  mm: number;
  rainDays: number;
  days: number;
  litres: number; // harvestable (engine net, mid)
  monsoon: boolean;
}

export function seasonMonths(inputs: Omit<RainInput, "rainMm">): SeasonMonth[] {
  return MONTHLY_NORMALS.map(({ month, mm, rainDays, days }) => ({
    month,
    mm,
    rainDays,
    days,
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

// Water used from the tank each day, the default for the monsoon catch.
// Unsourced: shown as "estimate, confirmed on site visit" and adjustable.
export const DEFAULT_DAILY_USE = 500;

// What storage can really catch across a typical monsoon. A tank only
// catches what there is room for, so the catch is the smallest of:
//  - the harvest: everything the roof could collect, July to September;
//  - one full tank on each rain day (WMO: days with 1 mm or more);
//  - the first fill plus what the household uses each day.
export function monsoonCatch(months: SeasonMonth[], storageLitres: number, dailyUse: number) {
  const m = months.filter((x) => x.monsoon);
  const harvest = m.reduce((s, x) => s + x.litres, 0);
  const rainDays = m.reduce((s, x) => s + x.rainDays, 0);
  const days = m.reduce((s, x) => s + x.days, 0);
  const storage = Math.max(0, Number.isFinite(storageLitres) ? storageLitres : 0);
  const use = Math.max(0, Number.isFinite(dailyUse) ? dailyUse : 0);
  const byRainDays = storage * rainDays;
  const byUse = storage > 0 ? storage + use * days : 0;
  const caught = Math.min(harvest, byRainDays, byUse);
  const limitedBy: "harvest" | "use" | "rainDays" = caught >= harvest ? "harvest" : caught >= byUse ? "use" : "rainDays";
  return { caught, harvest, rainDays, days, byRainDays, byUse, limitedBy };
}
