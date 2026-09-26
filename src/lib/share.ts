import type { Roof } from "./roof";
import { CITY } from "../config/city";
import { PRESETS, STORMS } from "../data/storms";

export const SHARE_LIMITS = {
  roofs: 12,
  areaM2: 100_000,
  rainMm: 2_000,
} as const;

export type StormChoice =
  | { kind: "storm"; id: string }
  | { kind: "preset"; id: string }
  | { kind: "custom"; mm: number };

export function choiceKey(choice: StormChoice): string {
  return choice.kind === "custom" ? `mm:${Math.min(SHARE_LIMITS.rainMm, Math.max(0, choice.mm))}` : choice.id;
}

export function choiceFromKey(key: string | null): StormChoice | null {
  if (!key) return null;
  if (key.startsWith("mm:")) {
    const mm = Number(key.slice(3));
    return Number.isFinite(mm) && mm >= 0
      ? { kind: "custom", mm: Math.min(SHARE_LIMITS.rainMm, mm) }
      : null;
  }
  if (STORMS.some((storm) => storm.id === key)) return { kind: "storm", id: key };
  if (PRESETS.some((preset) => preset.id === key)) return { kind: "preset", id: key };
  return null;
}

// Street share links carry roofs in the URL, no backend needed.
// Format: ?s=<stormId|mm:NN>&r=lat,lng,area;lat,lng,area
export function encodeShare(roofs: Roof[], storm: string): string {
  const r = roofs
    .map((x) => `${x.lat.toFixed(5)},${x.lng.toFixed(5)},${Math.round(x.areaM2)}`)
    .join(";");
  const params = new URLSearchParams({ s: storm, r });
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

export function decodeShare(search: string): { roofs: Roof[]; storm: string | null } {
  const p = new URLSearchParams(search);
  const storm = p.get("s");
  const roofs: Roof[] = [];
  for (const [i, chunk] of (p.get("r") ?? "").split(";").entries()) {
    const [lat, lng, area] = chunk.split(",").map(Number);
    const inBounds =
      lng >= CITY.bounds[0][0] && lng <= CITY.bounds[1][0] && lat >= CITY.bounds[0][1] && lat <= CITY.bounds[1][1];
    if ([lat, lng, area].every(Number.isFinite) && inBounds && area > 0 && area <= SHARE_LIMITS.areaM2) {
      roofs.push({ id: `shared-${i}`, label: `Roof ${i + 1}`, lat, lng, areaM2: area, source: "typed" });
    }
    if (roofs.length >= SHARE_LIMITS.roofs) break;
  }
  return { roofs, storm };
}
