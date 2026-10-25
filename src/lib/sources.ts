// One list of where numbers come from, read by both the Sources drawer and
// the (i) tooltips next to numbers in the Rain Report, so they can't
// disagree. Entries without a url are RAIN//GRID's own defaults or rules,
// and say so.

import { NORMALS_SOURCE } from "../data/storms";
import { DEFAULTS, ENGINE_SOURCES } from "./engine";
import { LARGE_ROOF_M2 } from "./engine/recommend";
import type { RoofSource } from "./roof";
import { DEFAULT_DAILY_USE } from "./season";

export interface SourceRef {
  label: string;
  url?: string;
}

export const SOURCES = {
  runoff: { label: ENGINE_SOURCES.runoff.label, url: ENGINE_SOURCES.runoff.url },
  firstFlush: { label: ENGINE_SOURCES.firstFlush.label, url: ENGINE_SOURCES.firstFlush.url },
  unit: { label: ENGINE_SOURCES.unit.label, url: ENGINE_SOURCES.unit.url },
  normals: { label: NORMALS_SOURCE.label, url: NORMALS_SOURCE.url },
  outline: { label: "Roof outline: OpenStreetMap contributors, via OpenFreeMap", url: "https://www.openstreetmap.org/copyright" },
  usableShare: { label: `Usable roof share: RAIN//GRID default, ${Math.round(DEFAULTS.usableShare * 100)}% (you can change it)` },
  tank: { label: `Tank size: your setup, ${DEFAULTS.tankLitres.toLocaleString("en-US")} L by default (you can change it)` },
  recommendation: {
    label: `Recommended storage: RAIN//GRID's rule, one 2,000 L tank (two on roofs over ${LARGE_ROOF_M2} m²), with a recharge well for the overflow`,
  },
  recharge: { label: "Recharge: potential routing only, never measured infiltration; soil and groundwater are checked on the site visit" },
  waterQuality: {
    label: "Mosley, L. (2005) Water Quality of Rainwater Harvesting Systems, SOPAC Miscellaneous Report 579",
    url: "https://www.pacificwater.org/userfiles/file/MR0579.pdf",
  },
  rainDays: { label: "Rain days (1 mm or more): " + NORMALS_SOURCE.label, url: NORMALS_SOURCE.url },
  dailyUse: { label: `Water used from the tank each day: ${DEFAULT_DAILY_USE} L by default (estimate: a household's non-drinking use, such as toilets, washing and cleaning; confirmed on site visit)` },
} satisfies Record<string, SourceRef>;

// Where the roof's area came from.
export function areaSource(source: RoofSource): SourceRef {
  if (source === "map") return SOURCES.outline;
  return { label: source === "drawn" ? "Roof area: the outline you drew" : "Roof area: the number you typed" };
}
