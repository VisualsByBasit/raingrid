// Which RainGrid package and tank a roof gets. Pure and deterministic, like
// the rest of the engine; the quote prices whatever this returns
// (src/lib/quote.ts).
//
// Tanks are not sized on the replayed storm: a record storm would ask for a
// wall of tanks. Every roof gets one 2,000 L tank (two on large roofs), and
// what the storm still overflows is the reason for a recharge well. More
// tanks are an optional extra the user can add to the quote.

export type RecommendedPackage = "basic" | "standard" | "plus";

export interface RecommendInput {
  areaM2: number; // roof footprint
  stormLitres: number; // harvestable litres from the chosen storm (engine net, mid)
  tankFills: number; // how many times this storm fills the household's current tank (0 = no tank)
  wantsDrinking?: boolean; // drinking water needs the filter + UV (Plus)
}

export interface Recommendation {
  package: RecommendedPackage;
  // New tanks to fit: none for Basic (it feeds the tank you have).
  tank: { size: 1000 | 2000; count: number } | null;
  newStorageLitres: number;
  // What this storm leaves beyond the current tank and the new tanks.
  overflowLitres: number;
  // Optional extra 2,000 L tanks the overflow would fill, within MAX_TANKS.
  extraTanksUseful: number;
  suggestRecharge: boolean;
  reasons: string[];
}

export const TANK_SIZES = [1000, 2000] as const;
// Roofs bigger than this get two 2,000 L tanks by default.
export const LARGE_ROOF_M2 = 400;
// The most tanks one roof plan proposes, extras included.
export const MAX_TANKS = 3;
// A storm that leaves less than this beyond the current tank doesn't
// justify a new one.
export const MIN_NEW_TANK_LITRES = 500;
// Suggest a recharge well when this much overflows.
export const RECHARGE_OVERFLOW_LITRES = 1000;

// Litres in reasons are rounded to 100 L, like every result in the app.
const nf = (v: number) => (Math.round(v / 100) * 100).toLocaleString("en-US");

export function defaultTank(areaM2: number): { size: 2000; count: number } {
  return { size: 2000, count: areaM2 > LARGE_ROOF_M2 ? 2 : 1 };
}

export function recommend(input: RecommendInput): Recommendation {
  const litres = Number.isFinite(input.stormLitres) ? Math.max(0, input.stormLitres) : 0;
  const fills = Number.isFinite(input.tankFills) ? Math.max(0, input.tankFills) : 0;
  const area = Number.isFinite(input.areaM2) ? Math.max(0, input.areaM2) : 0;
  // What the household's current tank holds, from how often the storm fills it.
  const existing = fills > 0 ? litres / fills : 0;
  const shortfall = Math.max(0, litres - existing);
  const reasons: string[] = [];

  let tank: Recommendation["tank"] = null;
  if (existing > 0 && shortfall === 0) reasons.push("Your current tank already holds this whole storm.");
  else if (shortfall < MIN_NEW_TANK_LITRES) reasons.push(`This storm leaves about ${nf(shortfall)} L beyond your tank, too little for a new one.`);
  else {
    tank = defaultTank(area);
    reasons.push(
      `This storm gives about ${nf(litres)} L${existing > 0 ? `; your tank holds ${nf(existing)} L` : ""}. RainGrid fits ${
        tank.count > 1 ? `${tank.count} × 2,000 L tanks for a roof this size` : "one 2,000 L tank"
      }.`,
    );
  }

  const overflow = Math.max(0, shortfall - (tank ? tank.size * tank.count : 0));
  const suggestRecharge = tank !== null && overflow >= RECHARGE_OVERFLOW_LITRES;
  if (suggestRecharge) reasons.push(`About ${nf(overflow)} L still overflowed; a recharge well sends it toward groundwater instead of the drain.`);
  const extraTanksUseful = tank ? Math.min(MAX_TANKS - tank.count, Math.ceil(overflow / 2000)) : 0;

  let pkg: RecommendedPackage = tank ? "standard" : "basic";
  if (input.wantsDrinking) {
    pkg = "plus";
    // Plus includes storage; the filter draws from its own tank.
    tank ??= { size: 1000, count: 1 };
    reasons.push("Drinking water needs the 7-stage filter with UV.");
  }

  const newStorageLitres = tank ? tank.size * tank.count : 0;
  return {
    package: pkg,
    tank,
    newStorageLitres,
    overflowLitres: Math.max(0, shortfall - newStorageLitres),
    extraTanksUseful,
    suggestRecharge,
    reasons,
  };
}
