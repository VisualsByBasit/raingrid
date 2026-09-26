// Fetch a small, static OpenStreetMap building fallback for the demo sectors.
// Usage: node scripts/extract-footprints.mjs
// The production demo never calls Overpass; only this build-time script does.

import { mkdir, writeFile } from "node:fs/promises";

const endpoint = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const sectors = [
  { id: "E-11", lat: 33.7006, lng: 72.9890 },
  { id: "F-10", lat: 33.6918, lng: 73.0070 },
  { id: "F-7", lat: 33.7168, lng: 73.0568 },
  { id: "G-11", lat: 33.6678, lng: 73.0005 },
  { id: "H-8", lat: 33.6687, lng: 73.0488 },
];
const radius = 0.0035;

const bbox = ({ lat, lng }) => `${lat - radius},${lng - radius},${lat + radius},${lng + radius}`;
const query = `[out:json][timeout:120];(${sectors.map((sector) => `way["building"](${bbox(sector)});`).join("")});out geom;`;

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "user-agent": "RAIN-GRID/1.0 (static demo data builder)",
  },
  body: new URLSearchParams({ data: query }),
});
if (!response.ok) throw new Error(`Overpass returned ${response.status} ${response.statusText}`);
const payload = await response.json();

const features = payload.elements.flatMap((element) => {
  if (element.type !== "way" || !Array.isArray(element.geometry) || element.geometry.length < 3) return [];
  const coordinates = element.geometry.map(({ lon, lat }) => [lon, lat]);
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coordinates.push(first);
  const center = coordinates.slice(0, -1).reduce(
    (sum, coordinate) => [sum[0] + coordinate[0] / (coordinates.length - 1), sum[1] + coordinate[1] / (coordinates.length - 1)],
    [0, 0],
  );
  const sector = sectors.find(({ lat, lng }) => Math.abs(center[1] - lat) <= radius && Math.abs(center[0] - lng) <= radius);
  return [{
    type: "Feature",
    id: `osm-way-${element.id}`,
    properties: {
      id: `osm-way-${element.id}`,
      sector: sector?.id ?? "nearby",
      height: Number(element.tags?.height) || (Number(element.tags?.["building:levels"]) || 2) * 3,
      source: "OpenStreetMap",
    },
    geometry: { type: "Polygon", coordinates: [coordinates] },
  }];
});

const collection = {
  type: "FeatureCollection",
  name: "RAIN//GRID static fallback footprints",
  generatedAt: new Date().toISOString(),
  attribution: "© OpenStreetMap contributors, ODbL 1.0",
  sectors: sectors.map(({ id }) => id),
  features,
};

await mkdir("public/data/footprints", { recursive: true });
await writeFile("public/data/footprints/islamabad-demo.geojson", `${JSON.stringify(collection)}\n`);
console.log(`Wrote ${features.length} footprints across ${sectors.length} demo sectors.`);
