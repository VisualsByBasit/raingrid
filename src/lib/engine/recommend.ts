// Which RainGrid package and tank size fit a roof and a storm. Pure and
// deterministic, like the rest of the engine; the quote prices whatever this
// returns (src/lib/quote.ts).

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
  suggestRecharge: boolean;
  reasons: string[];
}

// Standard tank sizes, and the most tanks one roof plan proposes. Beyond
// that the overflow goes to a recharge well instead.
export const TANK_SIZES = [1000, 2000] as const;
export const MAX_TANKS = 3;
// A storm smaller than this is too little to justify a new tank.
export const MIN_NEW_TANK_LITRES = 500;
// Suggest a recharge well when this much would still overflow.
export const RECHARGE_OVERFLOW_LITRES = 1000;

// Litres in reasons are rounded to 100 L, like every result in the app.
const nf = (v: number) => (Math.round(v / 100) * 100).toLocaleString("en-US");

export function tankFor(litres: number): { size: 1000 | 2000; count: number } {
  if (litres <= 1000) return { size: 1000, count: 1 };
  return { size: 2000, count: Math.min(MAX_TANKS, Math.ceil(litres / 2000)) };
}

export function recommend(input: RecommendInput): Recommendation {
  const litres = Number.isFinite(input.stormLitres) ? Math.max(0, input.stormLitres) : 0;
  const fills = Number.isFinite(input.tankFills) ? Math.max(0, input.tankFills) : 0;
  // What the household's current tank holds, from how often the storm fills it.
  const existing = fills > 0 ? litres / fills : 0;
  const shortfall = Math.max(0, litres - existing);
  const reasons: string[] = [];

  // New storage covers what the current tank can't. Too small a shortfall
  // isn't worth a new tank: connect the roof properly and keep the tank.
  let tank: Recommendation["tank"] = null;
  if (existing > 0 && shortfall === 0) reasons.push("Your current tank already holds this whole storm.");
  else if (shortfall < MIN_NEW_TANK_LITRES) reasons.push(`This storm leaves about ${nf(shortfall)} L beyond your tank, too little for a new one.`);
  else {
    tank = tankFor(shortfall);
    const added = tank.size * tank.count;
    reasons.push(
      `This storm gives about ${nf(litres)} L${existing > 0 ? `; your tank holds ${nf(existing)} L` : ""}. Adding ${tank.count > 1 ? `${tank.count} × ` : ""}${nf(tank.size)} L holds ${added >= shortfall ? "the rest" : "more of it"}.`,
    );
  }

  const overflow = shortfall - (tank ? tank.size * tank.count : 0);
  const suggestRecharge = overflow >= RECHARGE_OVERFLOW_LITRES;
  if (suggestRecharge) reasons.push(`About ${nf(overflow)} L would still overflow; a recharge well could take it.`);

  let pkg: RecommendedPackage = tank ? "standard" : "basic";
  if (input.wantsDrinking) {
    pkg = "plus";
    // Plus includes storage; the filter draws from its own tank.
    tank ??= { size: 1000, count: 1 };
    reasons.push("Drinking water needs the 7-stage filter with UV.");
  }

  return { package: pkg, tank, newStorageLitres: tank ? tank.size * tank.count : 0, suggestRecharge, reasons };
}
