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

// Runoff coefficient ranges. Standard literature ranges, to be verified
// against CGWB / PCRWR manuals (see ASSUMPTIONS for citations).
export const ROOF_TYPES: Record<RoofType, RoofTypeSpec> = {
  rcc: { label: "Flat concrete (RCC)", low: 0.75, mid: 0.8, high: 0.9 },
  metal: { label: "Metal sheet", low: 0.85, mid: 0.9, high: 0.95 },
};

export const DEFAULTS = {
  roofType: "rcc" as RoofType,
  firstFlushMm: 1.5,
  usableShare: 0.85,
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
  ground: number;
  drain: number; // overflow + first flush + water from the unused roof part
  lost: number; // soaked into the roof / evaporated / splashed
}

export interface RainResult {
  gross: number; // all rain that fell on the footprint
  firstFlush: number; // diverted before storage
  net: { low: number; mid: number; high: number }; // harvestable after losses
  split: Split; // what happens to the gross water, using the mid coefficient
  splitRange: { tankLow: number; tankHigh: number; groundLow: number; groundHigh: number };
  inputs: Required<RainInput>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const safe = (v: number) => (Number.isFinite(v) ? v : 0);

function route(net: number, tank: number, hasRecharge: boolean) {
  const stored = Math.min(net, tank);
  const ground = hasRecharge ? net - stored : 0;
  const overflow = net - stored - ground;
  return { stored, ground, overflow };
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
      ground: mid.ground,
      drain: mid.overflow + firstFlush + unusedRoofRunoff,
      lost,
    },
    splitRange: {
      tankLow: lo.stored,
      tankHigh: hi.stored,
      groundLow: lo.ground,
      groundHigh: hi.ground,
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

// Street aggregation: sums results roof by roof (tanks are per roof).
export function aggregate(results: RainResult[]) {
  return results.reduce(
    (acc, r) => ({
      gross: acc.gross + r.gross,
      tank: acc.tank + r.split.tank,
      ground: acc.ground + r.split.ground,
      drain: acc.drain + r.split.drain,
      lost: acc.lost + r.split.lost,
      netLow: acc.netLow + r.net.low,
      netHigh: acc.netHigh + r.net.high,
    }),
    { gross: 0, tank: 0, ground: 0, drain: 0, lost: 0, netLow: 0, netHigh: 0 },
  );
}

// How many mm of rain it takes to fill the tank (including first flush).
// Returns Infinity when the roof can't fill it (zero catchment).
export function mmToFillTank(input: RainInput): number {
  const c = calculate({ ...input, rainMm: 0 }).inputs;
  const perMm = c.areaM2 * c.usableShare * ROOF_TYPES[c.roofType].mid;
  if (perMm <= 0) return Number.POSITIVE_INFINITY;
  return c.firstFlushMm + c.tankLitres / perMm;
}
