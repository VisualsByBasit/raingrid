<p align="center">
  <img src="public/media/logo-transparent.png" width="96" height="96" alt="RAIN//GRID logo: a glass droplet holding an Islamabad street">
</p>

<h1 align="center">RAIN//GRID</h1>

<p align="center">
  Replay Islamabad's real monsoon storms on your own roof, see where every litre goes, and turn your street into a rainwater network.
</p>

<p align="center">
  <a href="https://raingridpk.vercel.app"><img src="https://img.shields.io/badge/Live-raingridpk.vercel.app-0E6BA8?style=for-the-badge" alt="Live: raingridpk.vercel.app"></a>
</p>

## What it does

1. **Pick your roof on a 3D map.** Search your sector (F-7, G-11...) and tap your house. The area comes from its OpenStreetMap building outline, live from OpenFreeMap vector tiles. If your roof isn't mapped, draw it or type the area.
2. **Replay a real storm.** Choose a recorded Islamabad storm; your roof gets the reading from the nearest rain gauge that reported it.
3. **Follow the water.** Rain falls, litres count up, and RAIN//GRID shows where each one goes: into your tank, into the ground through a recharge well, or down the nalah. Recharge is shown as potential routing, not measured infiltration.
4. **Get your Rain Plan, then bring your street.** Add your neighbours' roofs and share one street link.

## Highlights

- **A living 3D Islamabad hero.** One WebGL scene brings a photo plate of the Margalla Hills to life with depth parallax, rolling monsoon clouds, mist, sun shafts, GPU rain and a shimmering wet street. A crystal droplet hangs in front of it, refracting the city behind it and rippling when you touch it.
- **Per-house roof picking.** Tap a single house, even in a joined block, and add the parts of a multi-part building.
- **Plain-language results.** Every number is explained in everyday words, with ranges instead of false precision.
- **Guided tour.** First-time visitors get a short walkthrough, and "How it works" replays it any time.
- **Phone stepper sheet.** On phones the steps come one at a time in a bottom sheet, so the map stays usable.
- **Fallbacks.** Low-end devices get a light CSS version of the hero, and reduced motion gets a still one with no loader or flight. Shared links open straight on the map.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # rain engine unit tests
npm run build
npm run data:footprints # rebuild the static OSM footprints (currently unused by the map)
```

No API keys needed. Everything runs on free, keyless services.

## Project layout

| Path | What |
| --- | --- |
| `src/lib/engine/` | The rain engine. Pure TypeScript, unit tested, the only source of numbers |
| `src/data/storms.ts` | Sourced storm events and gauge locations |
| `src/data/sectors.ts` | Islamabad sector search (approximate centres) |
| `src/config/city.ts` | Everything city-specific |
| `src/components/` | Map, rain canvas, panels, landing, loader and guided tour |
| `src/components/three/` | The hero's WebGL scene: living plate shader, GPU rain, refracting droplet, fallback detection |
| `scripts/build-hero-assets.mjs` | Compresses the Islamabad plate and builds its hand-tuned depth map and effect masks |
| `scripts/build-logo.mjs` | Builds the favicon, the Apple touch icon and the transparent README logo from the logo art |
| `scripts/extract-footprints.mjs` | Builds `public/data/footprints/islamabad-demo.geojson` (static OSM footprints for E-11, F-10, F-7, G-11, H-8 and Satellite Town, Rawalpindi). Kept in the repo but **not used by the map**: static footprints drew on top of the live buildings, so the map now uses live buildings only, with draw and type-area as the fallback |
| `scripts/copy-maplibre-worker.mjs` | Copies MapLibre's worker into `public/` (runs before dev and build) |
| `docs/scope-decisions.md` | Explicit feature cuts and their honesty rationale |
| `docs/qa/2026-09-27.md` | Desktop, mobile and production-link QA record |

## The formula

```
harvest = roof area × usable share × (rain − first flush) × runoff coefficient
```

1 mm of rain on 1 m² is exactly 1 litre. Results are ranges, rounded to 100 L. Assumptions and every source are listed in the app ("How we calculate, and every source").

## Credits

- Map tiles: [OpenFreeMap](https://openfreemap.org), data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- Map engine: [MapLibre GL JS](https://maplibre.org). Geometry: [Turf.js](https://turfjs.org)
- 3D: [three.js](https://threejs.org), [React Three Fiber](https://r3f.docs.pmnd.rs), [drei](https://github.com/pmndrs/drei), [postprocessing](https://github.com/pmndrs/postprocessing) (via React Postprocessing) and [simplex-noise](https://github.com/jwagner/simplex-noise.js)
- Imagery: the Islamabad background plate and the logo were generated with ChatGPT image generation, edited by Mayaar OS. The plate's depth map is hand-tuned, not measured terrain
- Rain readings: Pakistan Meteorological Department, as reported by APP, ARY News, ProPakistani, Arab News, INCPak and WE News (links in the app)
- Climate normals: Pakistan's WMO 1991-2020 normals submission, via NOAA NCEI (Islamabad Airport station 41571)
- Runoff coefficients: Indian Railways Institute, Rain Water Harvesting manual (2022)
- First flush: Lebanon Ministry of Agriculture / UNDP greenhouse rainwater-harvesting guideline (typical 0.5 mm diversion height)
- City facts: CDA, PCRWR (via Accountability Lab), Dawn

## Team

Built by **Mayaar OS** (Basit and Mustafa) for **Banao Imaginathon 2026**.

## Honesty

Estimates are preliminary, not engineering advice. We used AI tools to help build this app. No number in the app comes from AI.
