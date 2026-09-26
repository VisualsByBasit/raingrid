import type { Roof } from "./roof";

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
    if ([lat, lng, area].every(Number.isFinite) && area > 0 && area < 1_000_000) {
      roofs.push({ id: `shared-${i}`, label: `Roof ${i + 1}`, lat, lng, areaM2: area, source: "typed" });
    }
    if (roofs.length >= 12) break;
  }
  return { roofs, storm };
}
