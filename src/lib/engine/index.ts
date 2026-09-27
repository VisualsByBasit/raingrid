// RAIN//GRID rain engine.
// Pure, deterministic, no network. The only source of numbers in the app.
// Unit fact: 1 mm of rain on 1 m2 of roof is exactly 1 litre.

export type RoofType = "rcc" | "metal";

export interface RoofTypeSpec {
  label: string;
  low: number;
  mid: number;
  high: number;
}

// Roof-catchment ranges from the Indian Railways Institute's 2022 rainwater
// harvesting manual. RCC uses the midpoint of the cited 0.6–0.8 range for the
// headline estimate; the low and high values remain visible as a range.
export const ROOF_TYPES: Record<RoofType, RoofTypeSpec> = {
  rcc: { label: "Flat concrete (RCC)", low: 0.6, mid: 0.7, high: 0.8 },
  metal: { label: "Metal sheet", low: 0.7, mid: 0.8, high: 0.9 },
};

export const ENGINE_SOURCES = {
  runoff: {
    label: "Indian Railways Institute, Rain Water Harvesting manual (2022)",
    url: "https://iricen.gov.in/iricen/books_jquery/rain_water_harvesting.pdf",
    note: "Roof runoff coefficients: concrete 0.6–0.8; metal sheet 0.7–0.9.",
  },
  firstFlush: {
    label: "Lebanon Ministry of Agriculture / UNDP greenhouse rainwater guideline (2016)",
    url: "https://www.pseau.org/outils/ouvrages/moe_pnud_national_guidelines_for_greenhouse_rainwater_harvesting_systems_in_the_agriculture_sector_2016.pdf",
    note: "Uses 0.5 mm as the typical first-flush diversion height (Equation 8, p. 24).",
  },
  unit: {
    label: "Australian Government, YourHome rainwater guide",
    url: "https://www.yourhome.gov.au/water/rainwater",
    note: "1 mm of rain on 1 m² of roof equals 1 litre before losses.",
  },
} as const;

export const DEFAULTS = {
  roofType: "rcc" as RoofType,
  firstFlushMm: 0.5,
  // Start from the full measured footprint. The user reduces this for solar
  // panels, stairs, tanks, or roof sections that do not drain to the system.
  usableShare: 1,
  tankLitres: 2000,
  hasRecharge: false,
};

export interface RainInput {
  areaM2: number; // roof footprint area
  rainMm: number; // storm rainfall
  roofType?: RoofType;
  usableShare?: number; // 0..1 share of the roof that drains to the system
  firstFlushMm?: number;
  tankLitres?: number;
  hasRecharge?: boolean;
}

export interface Split {
  tank: number;
  // Water routed toward a recharge system. This is potential recharge, not a
  // claim that the full amount infiltrates; that requires site-specific tests.
  rechargePotential: number;
  drain: number; // overflow + first flush + water from the unused roof part
  lost: number; // soaked into the roof / evaporated / splashed
}

export interface RainResult {
  gross: number; // all rain that fell on the footprint
  firstFlush: number; // diverted before storage
  net: { low: number; mid: number; high: number }; // harvestable after losses
  split: Split; // what happens to the gross water, using the mid coefficient
  splitRange: { tankLow: number; tankHigh: number; rechargeLow: number; rechargeHigh: number };
  inputs: Required<RainInput>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const safe = (v: number) => (Number.isFinite(v) ? v : 0);

function route(net: number, tank: number, hasRecharge: boolean) {
  const stored = Math.min(net, tank);
  const rechargePotential = hasRecharge ? net - stored : 0;
  const overflow = net - stored - rechargePotential;
  return { stored, rechargePotential, overflow };
}

export function calculate(input: RainInput): RainResult {
  const inputs: Required<RainInput> = {
    areaM2: clamp(safe(input.areaM2), 0, 1_000_000),
    rainMm: clamp(safe(input.rainMm), 0, 2000),
    roofType: input.roofType ?? DEFAULTS.roofType,
    usableShare: clamp(safe(input.usableShare ?? DEFAULTS.usableShare), 0, 1),
    firstFlushMm: clamp(safe(input.firstFlushMm ?? DEFAULTS.firstFlushMm), 0, 20),
    tankLitres: clamp(safe(input.tankLitres ?? DEFAULTS.tankLitres), 0, 10_000_000),
    hasRecharge: input.hasRecharge ?? DEFAULTS.hasRecharge,
  };
  const { areaM2, rainMm, roofType, usableShare, firstFlushMm, tankLitres, hasRecharge } = inputs;
  const spec = ROOF_TYPES[roofType];

  const gross = areaM2 * rainMm;
  const catchment = areaM2 * usableShare;
  const unusedRoofRunoff = gross - catchment * rainMm; // runs off the part that isn't piped
  const firstFlush = catchment * Math.min(rainMm, firstFlushMm);
  const effectiveMm = Math.max(0, rainMm - firstFlushMm);

  const net = {
    low: catchment * effectiveMm * spec.low,
    mid: catchment * effectiveMm * spec.mid,
    high: catchment * effectiveMm * spec.high,
  };
  const lost = catchment * effectiveMm * (1 - spec.mid);

  const mid = route(net.mid, tankLitres, hasRecharge);
  const lo = route(net.low, tankLitres, hasRecharge);
  const hi = route(net.high, tankLitres, hasRecharge);

  return {
    gross,
    firstFlush,
    net,
    split: {
      tank: mid.stored,
      rechargePotential: mid.rechargePotential,
      drain: mid.overflow + firstFlush + unusedRoofRunoff,
      lost,
    },
    splitRange: {
      tankLow: lo.stored,
      tankHigh: hi.stored,
      rechargeLow: lo.rechargePotential,
      rechargeHigh: hi.rechargePotential,
    },
    inputs,
  };
}

// Round for display. Honest numbers are ranges rounded to the nearest 100 L.
export function roundL(v: number, step = 100): number {
  if (v <= 0) return 0;
  if (v < step) return Math.round(v / 10) * 10;
  return Math.round(v / step) * step;
}

export function formatL(v: number): string {
  const r = roundL(v);
  return `${r.toLocaleString("en-US")} L`;
}

export function formatRange(lo: number, hi: number): string {
  const a = roundL(lo);
  const b = roundL(hi);
  if (a === b) return `${a.toLocaleString("en-US")} L`;
  return `${a.toLocaleString("en-US")} to ${b.toLocaleString("en-US")} L`;
}

// Round a displayed water split while preserving the rounded gross total.
// Independent rounding can otherwise make the visible parts disagree by 100 L.
export function roundSplitForDisplay(split: Split, gross: number): Split {
  const keys: (keyof Split)[] = ["tank", "rechargePotential", "drain", "lost"];
  const quantum = gross > 0 && gross < 100 ? 10 : 100;
  const target = Math.max(0, Math.round(gross / quantum) * quantum);
  const rows = keys.map((key, index) => {
    const value = Math.max(0, safe(split[key]));
    const floor = Math.floor(value / quantum) * quantum;
    return { key, index, floor, fraction: value / quantum - Math.floor(value / quantum) };
  });
  const remaining = Math.max(0, Math.round((target - rows.reduce((sum, row) => sum + row.floor, 0)) / quantum));
  const ranked = [...rows].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remaining; i++) ranked[i % ranked.length].floor += quantum;
  return Object.fromEntries(rows.map((row) => [row.key, row.floor])) as unknown as Split;
}

// Street aggregation: sums results roof by roof (tanks are per roof).
export function aggregate(results: RainResult[]) {
  return results.reduce(
    (acc, r) => ({
      gross: acc.gross + r.gross,
      tank: acc.tank + r.split.tank,
      rechargePotential: acc.rechargePotential + r.split.rechargePotential,
      drain: acc.drain + r.split.drain,
      lost: acc.lost + r.split.lost,
      netLow: acc.netLow + r.net.low,
      netHigh: acc.netHigh + r.net.high,
    }),
    { gross: 0, tank: 0, rechargePotential: 0, drain: 0, lost: 0, netLow: 0, netHigh: 0 },
  );
}

// How many mm of rain it takes to fill the tank (including first flush).
// Returns Infinity when the roof can't fill it (zero catchment).
export function mmToFillTank(input: RainInput): number {
  const c = calculate({ ...input, rainMm: 0 }).inputs;
  if (c.tankLitres <= 0) return 0;
  const perMm = c.areaM2 * c.usableShare * ROOF_TYPES[c.roofType].mid;
  if (perMm <= 0) return Number.POSITIVE_INFINITY;
  return c.firstFlushMm + c.tankLitres / perMm;
}
