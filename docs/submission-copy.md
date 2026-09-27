# Submission copy drafts

These drafts describe only features currently present in the repository.

## 240-character summary — 211 characters

RAIN//GRID lets Islamabad households replay sourced monsoon storms on their own roof, see every litre routed to storage, recharge or drains, and combine neighbouring roofs into a shareable street rainwater plan.

## 800-character solution — 770 characters

RAIN//GRID turns abstract monsoon numbers into a household action plan. A resident searches an Islamabad sector, selects or draws a roof, and replays a sourced storm using the nearest reported gauge. A deterministic engine calculates rainfall on the roof, first-flush diversion and runoff losses, then follows the water into a user-sized tank, toward potential recharge or to the drain. Results include an honest coefficient range, maintenance guidance and source links. Neighbours can add up to 12 roofs, compare combined storage and recharge potential, and share the street scenario by URL. A checked-in OpenStreetMap footprint dataset keeps the core demo usable when live building tiles fail, while drawing and typed area remain available where mapping is incomplete.

## 600-character judge notes — 564 characters

All quantities come from a deterministic formula: roof area × usable share × (rainfall − first flush) × runoff coefficient. Results are ranges and preliminary estimates, not engineering advice. Storm readings are PMD figures reported by APP, ARY, ProPakistani, Arab News, INCPak and WE News; monthly normals are Pakistan’s WMO 1991–2020 submission hosted by NOAA. Static footprints are © OpenStreetMap contributors. Recharge values mean water routed toward a recharge system, not measured infiltration. AI assisted development but never generates the calculations.

## Source checklist

- Storm events: APP, ARY News, ProPakistani, Arab News, INCPak citing PMD, and WE News citing PMD. Exact links are stored with each event in `src/data/storms.ts`.
- Monthly rainfall normals: Pakistan WMO 1991–2020 submission, Islamabad Airport station 41571, hosted by NOAA NCEI.
- Roof runoff coefficients: Indian Railways Institute, *Rain Water Harvesting* manual (2022).
- First flush: Lebanon Ministry of Energy and Water / UNDP, *National Guideline for Rainwater Harvesting Systems* (2016).
- City context: CDA, PCRWR via Accountability Lab, and Dawn.
- Map and footprints: OpenFreeMap, OpenMapTiles and © OpenStreetMap contributors.

Do not add forecast, AI Roof Check, Supabase or Rain Card claims unless those features ship and are re-verified before submission.
