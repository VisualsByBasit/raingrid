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
