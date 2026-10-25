// RainGrid service packages and the parts they are built from. Every price
// is a range in rupees with its source, or flagged as an estimate that is
// confirmed on the site visit. Edit this file to change a price; the quote,
// the system diagram and the sources drawer all read from here.

export interface Source {
  label: string;
  url: string;
}

export interface Price {
  lowRs: number;
  highRs: number;
  unit?: "per foot" | "per day";
  // Unsourced: shown as "estimate, confirmed on site visit".
  estimate: boolean;
  source?: Source;
  note?: string;
}

export type PartId =
  | "gutterKit"
  | "pipe"
  | "tank1000"
  | "tank2000"
  | "uvFilter"
  | "plumber"
  | "helper"
  | "rechargeWell";

export interface Part {
  id: PartId;
  name: string;
  // One line on what it does, for the system diagram.
  what: string;
  // null: priced only after a site visit.
  price: Price | null;
}

export const ESTIMATE_LABEL = "estimate, confirmed on site visit";

const WATERTANK: Source = { label: "watertank.pk, 2026", url: "https://watertank.pk/water-tank-price-in-pakistan/" };
const AVENIR: Source = {
  label: "Avenir Developments, Q4 2026",
  url: "https://avenirdevelopments.com/house-construction-cost/breakdown-of-plumbing-costs-in-pakistan/",
};
const AQUAFILTER: Source = {
  label: "aquafilter.pk",
  url: "https://aquafilter.pk/product/aqua-7-stages-ultraviolet-uv-water-filter-with-minerals-alkaline-best-water-purifier-in-pakistan/",
};

export const PARTS: Record<PartId, Part> = {
  gutterKit: {
    id: "gutterKit",
    name: "Gutters, leaf screen and first-flush diverter",
    what: "Gutters collect the roof's water, a mesh screen stops leaves, and the diverter sends the dirty first flush to the drain.",
    price: { lowRs: 10_000, highRs: 30_000, estimate: true },
  },
  pipe: {
    id: "pipe",
    name: '4" UPVC pipe',
    what: "Downpipes and the overflow line.",
    price: { lowRs: 482.4, highRs: 482.4, unit: "per foot", estimate: false, source: AVENIR, note: "Class O, medium" },
  },
  tank1000: {
    id: "tank1000",
    name: "1,000 L water tank",
    what: "A sealed, covered, food-grade tank that keeps light and mosquitoes out.",
    price: { lowRs: 15_500, highRs: 27_500, estimate: false, source: WATERTANK },
  },
  tank2000: {
    id: "tank2000",
    name: "2,000 L water tank",
    what: "A sealed, covered, food-grade tank that keeps light and mosquitoes out.",
    price: { lowRs: 26_000, highRs: 46_500, estimate: false, source: WATERTANK },
  },
  uvFilter: {
    id: "uvFilter",
    name: "7-stage UV drinking filter",
    what: "Filters and UV-treats tank water for drinking. A small pump may be needed for pressure.",
    price: {
      lowRs: 17_500,
      highRs: 17_500,
      estimate: false,
      source: AQUAFILTER,
      note: "sale price; the pump note is RainGrid's, not the seller's",
    },
  },
  plumber: {
    id: "plumber",
    name: "Plumber",
    what: "Fits the gutters, pipes, diverter and tank.",
    price: { lowRs: 2_800, highRs: 3_800, unit: "per day", estimate: false, source: AVENIR, note: "Islamabad or Rawalpindi day rate" },
  },
  helper: {
    id: "helper",
    name: "Helper",
    what: "Assists the plumber.",
    price: { lowRs: 1_538, highRs: 1_538, unit: "per day", estimate: false, source: AVENIR, note: "Punjab minimum daily wage, July to December 2026" },
  },
  rechargeWell: {
    id: "rechargeWell",
    name: "Recharge well",
    what: "A filtered pit that sends overflow toward groundwater instead of the drain. Suitability depends on soil and depth to water.",
    price: null,
  },
};

// Quantities that turn part prices into a package quote. None of these has
// a source; all are estimates confirmed on the site visit.
export interface Quantities {
  pipeFeet: [number, number];
  labourDays: [number, number];
}

export type PackageId = "basic" | "standard" | "plus";

export interface Package {
  id: PackageId;
  name: string;
  summary: string;
  parts: PartId[];
  quantities: Quantities;
  // Drinking water only with Plus.
  drinking: boolean;
}

export const PACKAGES: Record<PackageId, Package> = {
  basic: {
    id: "basic",
    name: "Basic",
    summary: "Gutters, leaf screen, first-flush diverter and an overflow, feeding a tank you already have.",
    parts: ["gutterKit", "pipe", "plumber", "helper"],
    quantities: { pipeFeet: [20, 40], labourDays: [1, 1] },
    drinking: false,
  },
  standard: {
    id: "standard",
    name: "Standard",
    summary: "Everything in Basic, plus new storage: a sealed tank sized for your roof (2,000 L by default).",
    parts: ["gutterKit", "pipe", "tank2000", "plumber", "helper"],
    quantities: { pipeFeet: [20, 40], labourDays: [1, 2] },
    drinking: false,
  },
  plus: {
    id: "plus",
    name: "Plus",
    summary: "Everything in Standard, plus a 7-stage UV filter for drinking water. A pump may be needed.",
    parts: ["gutterKit", "pipe", "tank2000", "uvFilter", "plumber", "helper"],
    quantities: { pipeFeet: [25, 45], labourDays: [2, 2] },
    drinking: true,
  },
};

export const RECHARGE_ADDON = {
  part: "rechargeWell" as const,
  name: "Recharge well add-on",
  price: "quote on site visit",
};

// Yearly maintenance plan. The visit is priced from the sourced plumber and
// helper day rates; consumables have no source yet, so they are quoted on
// the visit rather than given a made-up number.
export const MAINTENANCE = {
  tasks: [
    { name: "Tank clean", what: "Drain, scrub and rinse the tank; check the lid and the overflow mesh." },
    { name: "Gutters, screen and first flush", what: "Clear leaves and silt so the first flush keeps working." },
    { name: "Filter change", what: "Plus only: new cartridges and a UV lamp check, as the maker advises." },
    { name: "Water test", what: "A basic test of the stored water, and a lab test if you drink it." },
  ],
  // One plumber day plus one helper day, from PARTS.
  visitLowRs: PARTS.plumber.price!.lowRs + PARTS.helper.price!.lowRs,
  visitHighRs: PARTS.plumber.price!.highRs + PARTS.helper.price!.highRs,
  visitSource: "one plumber day and one helper day at Avenir Developments Q4 2026 rates",
  separately: "Filter cartridges and a lab water test are quoted on the visit.",
};
