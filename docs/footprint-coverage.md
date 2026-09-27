# Static footprint coverage audit

Generated on 27 September 2026 with `npm run data:footprints`. The extractor queries OpenStreetMap buildings in a small box around each demo centre and preserves stable OSM way IDs.

| Demo area | Static footprints | Assessment |
| --- | ---: | --- |
| E-11 | 51 | Partial; usable for a demo but not complete sector coverage. |
| F-10 | 327 | Strongest demo coverage. |
| F-7 | 361 | Strong demo coverage. |
| G-11 | 21 | Sparse; retain draw and typed-area fallbacks. |
| H-8 | 16 | Sparse; retain draw and typed-area fallbacks. |
| Satellite Town, Rawalpindi | 1 | Retained as reference data; the UI marks it outside the authorized Islamabad range. |
| Nearby/unassigned | 54 | Buildings intersected a query box but their centre fell outside the named demo box. |

Total: 831 footprints.

## Gaps and demo guidance

- F-7 and F-10 are the safest sectors for a footprint-click demo.
- E-11 is usable with the manual fallbacks available.
- G-11 and H-8 must be tested with draw-polygon and typed-area fallbacks because OSM coverage is sparse.
- Rawalpindi reference data is retained, but Islamabad is the authorized project city. Rawalpindi roofs are rejected in the UI and in shared links with an explicit out-of-range message.
- The checked-in GeoJSON is the production fallback. The application makes no live Overpass request; Overpass is used only when rebuilding this file.
