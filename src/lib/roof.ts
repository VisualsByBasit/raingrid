import turfArea from "@turf/area";
import { featureCollection } from "@turf/helpers";
import union from "@turf/union";
import type { Feature, MultiPolygon, Polygon } from "geojson";

export type RoofSource = "map" | "drawn" | "typed";

export interface Roof {
  id: string;
  label: string;
  areaM2: number;
  lat: number;
  lng: number;
  source: RoofSource;
  geometry?: Polygon | MultiPolygon;
  height?: number; // building height in metres, for the 3D highlight
  // Has a Rain Plan (the storm was replayed on it). Travels in street links.
  planned?: boolean;
}

type PolyFeature = Feature<Polygon | MultiPolygon>;

// Buildings in vector tiles can be split across tile edges. Merge the pieces.
export function mergePieces(pieces: PolyFeature[]): PolyFeature | null {
  if (pieces.length === 0) return null;
  if (pieces.length === 1) return pieces[0];
  try {
    return union(featureCollection(pieces)) ?? pieces[0];
  } catch {
    return pieces[0];
  }
}

export function areaOf(f: PolyFeature): number {
  return turfArea(f);
}

export function centroidOf(geom: Polygon | MultiPolygon): [number, number] {
  const ring = geom.type === "Polygon" ? geom.coordinates[0] : geom.coordinates[0][0];
  let x = 0;
  let y = 0;
  const n = Math.max(1, ring.length - 1);
  for (let i = 0; i < n; i++) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / n, y / n];
}

let counter = 0;
export function newRoofId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

// Roof check pins: where a tank could stand and where the downpipe comes
// down. Both are optional; they travel in the street link and the request.
export interface Pin {
  lat: number;
  lng: number;
}

export interface RoofPins {
  tank: Pin | null;
  downpipe: Pin | null;
}

export const NO_PINS: RoofPins = { tank: null, downpipe: null };

// Starting spots before the user drags them: the tank just off the roof's
// west edge, the downpipe on the outline's first corner. Typed roofs (no
// outline) get small offsets from their centre.
export function defaultPins(roof: Pick<Roof, "lat" | "lng" | "geometry">): { tank: Pin; downpipe: Pin } {
  const ring = roof.geometry ? (roof.geometry.type === "Polygon" ? roof.geometry.coordinates[0] : roof.geometry.coordinates[0][0]) : null;
  if (!ring || ring.length < 3) {
    return { tank: { lat: roof.lat, lng: roof.lng - 0.00008 }, downpipe: { lat: roof.lat + 0.00005, lng: roof.lng } };
  }
  let west = ring[0];
  for (const p of ring) if (p[0] < west[0]) west = p;
  return {
    // About 3 m west of the westernmost corner, level with the roof centre.
    tank: { lat: roof.lat, lng: west[0] - 0.00003 },
    downpipe: { lat: ring[0][1], lng: ring[0][0] },
  };
}
