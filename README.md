# RAIN//GRID

Replay Islamabad's real monsoon storms on your own roof, see where every litre goes, and turn your street into a rainwater network.

Built by **Mayaar OS** (Basit and Mustafa) for Banao Imaginathon 2026.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # rain engine unit tests
npm run build
npm run data:footprints # refresh the static OSM fallback (networked build step)
```

No API keys needed. Everything runs on free, keyless services.

## How it works

1. Search your sector (F-7, G-11...) and tap your roof. The area comes from the building outline in OpenStreetMap, using live OpenFreeMap vector tiles plus a static five-sector fallback. If your roof isn't mapped, draw it or type the area.
2. Pick a real storm. Each roof uses the nearest rain gauge that reported that storm.
3. Replay it: rain falls, litres count up, and RAIN//GRID follows the water into your tank, toward a recharge system, or to the drain. Recharge is explicitly shown as potential routing, not measured infiltration.
4. Get a Rain Plan, then add neighbours' roofs and share a street link.

## Project layout

| Path | What |
| --- | --- |
| `src/lib/engine/` | The rain engine. Pure TypeScript, unit tested, the only source of numbers |
| `src/data/storms.ts` | Sourced storm events and gauge locations |
| `src/data/sectors.ts` | Islamabad sector search (approximate centres) |
| `src/config/city.ts` | Everything city-specific |
| `src/components/` | Map, rain canvas, panels |
| `scripts/extract-footprints.mjs` | Builds the static OSM fallback for E-11, F-10, F-7, G-11 and H-8 |
| `scripts/copy-maplibre-worker.mjs` | Copies MapLibre's worker into `public/` (runs before dev and build) |

## The formula

```
harvest = roof area × usable share × (rain − first flush) × runoff coefficient
```

1 mm of rain on 1 m² is exactly 1 litre. Results are ranges, rounded to 100 L. Assumptions and every source are listed in the app ("How we calculate, and every source").

## Credits

- Map tiles: [OpenFreeMap](https://openfreemap.org), data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- Map engine: [MapLibre GL JS](https://maplibre.org). Geometry: [Turf.js](https://turfjs.org)
- Rain readings: Pakistan Meteorological Department, as reported by APP, ARY News, ProPakistani and Arab News (links in the app)
- Climate normals: Pakistan's WMO 1991–2020 submission, hosted by NOAA NCEI (Islamabad Airport station 41571)
- Runoff coefficients: Indian Railways Institute, Rain Water Harvesting manual (2022)
- First flush: Lebanon Ministry of Energy and Water / UNDP national rainwater-harvesting guideline
- City facts: CDA, PCRWR (via Accountability Lab), Dawn

## Honesty

Estimates are preliminary, not engineering advice. We used AI tools to help build this app. No number in the app comes from AI.
