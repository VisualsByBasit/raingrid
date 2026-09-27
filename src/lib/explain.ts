// Plain-language helpers for explaining results. Pure maths and wording on
// top of the engine's numbers; no external facts, no change to the formula.

import type { RoofSource } from "./roof";

// A map outline bigger than this is almost always a whole complex (with
// courtyards and walkways), not one roof.
export const LARGE_COMPLEX_M2 = 5000;

const nf = (v: number) => v.toLocaleString("en-US");

// 12.34 -> "12.3", 31.0 -> "31"
function oneDecimal(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? nf(r) : nf(Math.round(r * 10) / 10);
}

// How many of your tanks this much water would fill. Under 10 keeps one
// decimal ("1.5"), from 10 up it rounds to whole tanks ("31").
export function tanksCount(litres: number, tankLitres: number): string | null {
  if (!(tankLitres > 0) || !Number.isFinite(litres) || litres < 0) return null;
  const n = litres / tankLitres;
  return n >= 10 ? nf(Math.round(n)) : oneDecimal(n);
}

// "= 31 of your 2,000 L tanks"
export function tanksLine(litres: number, tankLitres: number): string | null {
  const count = tanksCount(litres, tankLitres);
  if (count === null) return null;
  const plural = litres / tankLitres > 1.05 ? "tanks" : "tank";
  return `= ${count} of your ${nf(tankLitres)} L ${plural}`;
}

// 1 mm of rain is 1 L on every m2, i.e. a layer 1 mm deep: 157 mm -> "15.7 cm".
export function depthCm(rainMm: number): string {
  return `${oneDecimal(Math.max(0, rainMm) / 10)} cm`;
}

// "= water 15.7 cm deep across your roof"
export function depthLine(rainMm: number): string {
  return `= water ${depthCm(rainMm)} deep across your roof`;
}

// Tooltip for "mm".
export function mmExplainer(rainMm: number): string {
  return `1 mm of rain = 1 litre on every square metre. ${nf(Math.round(rainMm * 10) / 10)} mm = water ${depthCm(rainMm)} deep across your whole roof.`;
}

// "Saidpur" -> "Saidpur gauge"; "PMD station" and "... gauge" stay as they are.
export function gaugeLabel(name: string): string {
  return /\b(gauge|station)\b/i.test(name) ? name : `${name} gauge`;
}

export function distanceLabel(km: number): string {
  return km < 1 ? "under 1 km" : `${Math.round(km)} km`;
}

// "measured at Saidpur gauge, 3 km from your roof"
export function measuredAt(gaugeName: string, km: number): string {
  return `measured at ${gaugeLabel(gaugeName)}, ${distanceLabel(km)} from your roof`;
}

export function isLargeComplex(areaM2: number, source: RoofSource): boolean {
  // Only outlines (map or drawn) can accidentally cover a complex; a typed
  // area is exactly what the user meant.
  return source !== "typed" && areaM2 > LARGE_COMPLEX_M2;
}

// "Your roof" becomes "Large complex"; other labels get a note.
export function roofDisplayLabel(label: string, areaM2: number, source: RoofSource): string {
  if (!isLargeComplex(areaM2, source)) return label;
  return label === "Your roof" ? "Large complex" : `${label} (large complex)`;
}

export function largeComplexNotice(areaM2: number): string {
  return `This outline covers a whole complex (${nf(Math.round(areaM2))} m²), including courtyards and walkways, not one roof. Results are for the full outline. Edit the area or draw just the roof you want.`;
}
