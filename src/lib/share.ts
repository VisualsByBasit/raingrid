import type { Pin, Roof, RoofPins } from "./roof";
import { isInAuthorizedCity } from "../config/city";
import { ISLAMABAD_STORMS, PRESETS } from "../data/storms";

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
  if (ISLAMABAD_STORMS.some((storm) => storm.id === key)) return { kind: "storm", id: key };
  if (PRESETS.some((preset) => preset.id === key)) return { kind: "preset", id: key };
  return null;
}

// Street share links carry roofs in the URL, no backend needed.
// Format: ?s=<stormId|mm:NN>&r=lat,lng,area[,1];lat,lng,area[,1]
// A trailing ",1" marks a roof that has a Rain Plan. Links without it (all
// links made before plans were tracked) still open, with no roofs planned.
// Optional roof check pins for "Your roof": &t=lat,lng (tank spot) and
// &d=lat,lng (downpipe).
const pinParam = (p: Pin) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

export function shareQuery(roofs: Roof[], storm: string, pins?: RoofPins): string {
  const r = roofs
    .map((x) => `${x.lat.toFixed(5)},${x.lng.toFixed(5)},${Math.round(x.areaM2)}${x.planned ? ",1" : ""}`)
    .join(";");
  // Digits, dots, minus signs, commas and semicolons are safe in a query, so
  // the roof list stays readable when it is pasted into a message.
  let q = `s=${encodeURIComponent(storm)}&r=${r}`;
  if (pins?.tank) q += `&t=${pinParam(pins.tank)}`;
  if (pins?.downpipe) q += `&d=${pinParam(pins.downpipe)}`;
  return q;
}

export function encodeShare(roofs: Roof[], storm: string, pins?: RoofPins): string {
  return `${window.location.origin}${window.location.pathname}?${shareQuery(roofs, storm, pins)}`;
}

function decodePin(v: string | null): Pin | null {
  if (!v) return null;
  const [lat, lng] = v.split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) && isInAuthorizedCity(lat, lng) ? { lat, lng } : null;
}

export function decodeShare(search: string): { roofs: Roof[]; storm: string | null; outOfRange: boolean; pins: RoofPins } {
  const p = new URLSearchParams(search);
  const storm = p.get("s");
  const roofs: Roof[] = [];
  let outOfRange = false;
  for (const [i, chunk] of (p.get("r") ?? "").split(";").entries()) {
    const [lat, lng, area, planned] = chunk.split(",").map(Number);
    const inBounds = Number.isFinite(lat) && Number.isFinite(lng) && isInAuthorizedCity(lat, lng);
    if ([lat, lng, area].every(Number.isFinite) && inBounds && area > 0 && area <= SHARE_LIMITS.areaM2) {
      roofs.push({ id: `shared-${i}`, label: `Roof ${i + 1}`, lat, lng, areaM2: area, source: "typed", planned: planned === 1 });
    } else if ([lat, lng].every(Number.isFinite) && !inBounds) {
      outOfRange = true;
    }
    if (roofs.length >= SHARE_LIMITS.roofs) break;
  }
  const pins: RoofPins = { tank: decodePin(p.get("t")), downpipe: decodePin(p.get("d")) };
  return { roofs, storm, outOfRange, pins };
}
