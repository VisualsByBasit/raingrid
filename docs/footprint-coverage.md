# Static footprint coverage audit

Generated on 27 September 2026 with `npm run data:footprints`. The extractor queries OpenStreetMap buildings in a small box around each demo centre and preserves stable OSM way IDs.

| Demo area | Static footprints | Assessment |
| --- | ---: | --- |
| E-11 | 51 | Partial; usable for a demo but not complete sector coverage. |
| F-10 | 327 | Strongest demo coverage. |
| F-7 | 361 | Strong demo coverage. |
| G-11 | 21 | Sparse; retain draw and typed-area fallbacks. |
| H-8 | 16 | Sparse; retain draw and typed-area fallbacks. |
| Satellite Town, Rawalpindi | 1 | Inadequate OSM coverage; do not promise roof selection here. |
| Nearby/unassigned | 54 | Buildings intersected a query box but their centre fell outside the named demo box. |

Total: 831 footprints.

## Gaps and demo guidance

- F-7 and F-10 are the safest sectors for a footprint-click demo.
- E-11 is usable with the manual fallbacks available.
- G-11 and H-8 must be tested with draw-polygon and typed-area fallbacks because OSM coverage is sparse.
- Satellite Town satisfies the Rawalpindi extraction check but not a reliable click-a-roof demo. Adding Google Open Buildings or another reviewed footprint source remains future work.
- The checked-in GeoJSON is the production fallback. The application makes no live Overpass request; Overpass is used only when rebuilding this file.
