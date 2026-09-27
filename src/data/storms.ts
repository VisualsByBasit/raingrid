// Real, sourced storm events for Islamabad.
// Every reading is quoted from the linked report. Gauge coordinates are
// approximate and only used to pick the nearest reported gauge to a roof.

import { isInAuthorizedCity } from "../config/city";

export interface Gauge {
  id: string;
  name: string;
  note: string;
  lat: number;
  lng: number;
}

export const GAUGES: Record<string, Gauge> = {
  pmd: { id: "pmd", name: "PMD station", note: "near H-8/2", lat: 33.6815, lng: 73.0595 },
  golra: { id: "golra", name: "Golra", note: "next to E-11", lat: 33.7045, lng: 72.9905 },
  bokra: { id: "bokra", name: "Bokra", note: "near I-12", lat: 33.6395, lng: 72.9795 },
  saidpur: { id: "saidpur", name: "Saidpur", note: "Margalla foothills, above F-6", lat: 33.7425, lng: 73.0695 },
  zeropoint: { id: "zeropoint", name: "Zero Point", note: "between F-6, G-6 and G-7", lat: 33.6935, lng: 73.0515 },
  airport: { id: "airport", name: "Islamabad Airport", note: "south-west of the city", lat: 33.5495, lng: 72.8255 },
  katcheri: { id: "katcheri", name: "Katcheri", note: "central Rawalpindi", lat: 33.6262, lng: 73.0710 },
  pirwidhai: { id: "pirwidhai", name: "Pirwidhai", note: "north Rawalpindi", lat: 33.6388, lng: 73.0437 },
  gawalmandi: { id: "gawalmandi", name: "Gawalmandi", note: "Rawalpindi", lat: 33.6129, lng: 73.0571 },
  newkatarian: { id: "newkatarian", name: "New Katarian", note: "north-east Rawalpindi", lat: 33.6490, lng: 73.0750 },
  chaklala: { id: "chaklala", name: "Chaklala", note: "south-east Rawalpindi", lat: 33.6058, lng: 73.0997 },
  shamsabad: { id: "shamsabad", name: "Shamsabad", note: "Rawalpindi", lat: 33.6417, lng: 73.0845 },
};

export interface Storm {
  id: string;
  title: string;
  date: string; // ISO
  dateLabel: string;
  blurb: string;
  readings: Partial<Record<keyof typeof GAUGES, number>>; // mm
  window: string; // how long the readings were measured over
  source: { label: string; url: string };
}

export const STORMS: Storm[] = [
  {
    id: "2025-07-21",
    title: "The record monsoon day",
    date: "2025-07-21",
    dateLabel: "21 July 2025",
    blurb: "Islamabad's heaviest monsoon rain since 2001. Saidpur flooded and roads became rivers.",
    readings: { bokra: 198, golra: 184, pmd: 175, saidpur: 157 },
    window: "single rain event",
    source: {
      label: "APP, 21 Jul 2025",
      url: "https://www.app.com.pk/national/cda-islamabad-authorities-respond-swiftly-as-record-monsoon-rainfall-hits-capital/",
    },
  },
  {
    id: "2026-08-20",
    title: "Heaviest spell of 2026",
    date: "2026-08-20",
    dateLabel: "20 August 2026",
    blurb: "The heaviest rain of this year's monsoon so far, while the airport stayed almost dry.",
    readings: { bokra: 104, golra: 100, zeropoint: 99, saidpur: 95, airport: 2 },
    window: "single rain event",
    source: {
      label: "ProPakistani, 20 Aug 2026",
      url: "https://propakistani.pk/2026/08/20/islamabad-and-rawalpindi-receive-heaviest-rain-of-current-monsoon-season/",
    },
  },
  {
    id: "2026-08-17",
    title: "One city, two storms",
    date: "2026-08-17",
    dateLabel: "17 August 2026",
    blurb: "Golra got 145 mm while Saidpur, 9 km away, got 9 mm. Rain is local.",
    readings: { golra: 145, bokra: 134, pmd: 48, saidpur: 9 },
    window: "single rain event",
    source: {
      label: "ARY News, 17 Aug 2026",
      url: "https://arynews.tv/rains-lash-rawalpindi-islamabad-wasa-declares-rain-emergency",
    },
  },
  {
    id: "2025-06-25",
    title: "First monsoon spell",
    date: "2025-06-25",
    dateLabel: "25 June 2025",
    blurb: "An ordinary first spell of the season. This is what a normal heavy morning looks like.",
    readings: { bokra: 66, saidpur: 52 },
    window: "morning of the storm",
    source: { label: "Arab News, 25 Jun 2025", url: "https://arab.news/93b96" },
  },
  {
    id: "2025-07-23-rawalpindi",
    title: "Rawalpindi's widespread downpour",
    date: "2025-07-23",
    dateLabel: "23 July 2025",
    blurb: "Rain varied sharply across six Rawalpindi gauges, led by 88 mm at Katcheri.",
    readings: { katcheri: 88, pirwidhai: 65, gawalmandi: 52, newkatarian: 40, chaklala: 38, shamsabad: 32 },
    window: "24 hours to 08:00 PKT",
    source: {
      label: "INCPak, citing PMD, 23 Jul 2025",
      url: "https://www.incpak.com/national/islamabad/pakistan-monsoon-update-rainfall-data-recorded-in-the-last-24-hours/",
    },
  },
  {
    id: "2026-08-19-rawalpindi",
    title: "Rawalpindi's flood-warning spell",
    date: "2026-08-19",
    dateLabel: "19 August 2026",
    blurb: "PMD recorded 98 mm at Shamsabad but 55 mm at Chaklala, another sharp local contrast.",
    readings: { shamsabad: 98, newkatarian: 90, pirwidhai: 86, chaklala: 55 },
    window: "24 hours to 08:00 PKT",
    source: {
      label: "WE News, citing PMD, 19 Aug 2026",
      url: "https://wenewsenglish.com/monsoon-rains-swell-pakistans-flood-risk/",
    },
  },
];

// Gauges inside Islamabad. The Rawalpindi gauges above stay in the catalogue
// (and the sources drawer) but never set the rain for an Islamabad roof.
export const ISLAMABAD_GAUGE_IDS = ["pmd", "golra", "bokra", "saidpur", "zeropoint", "airport"];

export function isIslamabadGauge(id: string): boolean {
  return ISLAMABAD_GAUGE_IDS.includes(id);
}

// Storms offered in the picker: at least one Islamabad gauge reading.
export const ISLAMABAD_STORMS: Storm[] = STORMS.filter((storm) =>
  Object.entries(storm.readings).some(([id, mm]) => mm != null && isIslamabadGauge(id)),
);

// Longer-period presets. Clearly labelled as averages, not events.
export interface Preset {
  id: string;
  title: string;
  mm: number;
  blurb: string;
  source: { label: string; url: string };
}

export interface MonthlyNormal {
  month: string;
  mm: number;
}

export const NORMALS_SOURCE = {
  label: "WMO 1991–2020 normals via NOAA NCEI · Islamabad Airport 41571",
  url: "https://www.nodc.noaa.gov/archive/arc0216/0253808/4.4/data/0-data/Region-2-WMO-Normals-9120/Pakistan/CSV/Islamabad_41571.csv",
};

export const MONTHLY_NORMALS: MonthlyNormal[] = [
  { month: "Jan", mm: 55.2 },
  { month: "Feb", mm: 93.4 },
  { month: "Mar", mm: 95.2 },
  { month: "Apr", mm: 58.1 },
  { month: "May", mm: 39.9 },
  { month: "Jun", mm: 78.4 },
  { month: "Jul", mm: 310.6 },
  { month: "Aug", mm: 317.0 },
  { month: "Sep", mm: 135.4 },
  { month: "Oct", mm: 34.4 },
  { month: "Nov", mm: 17.7 },
  { month: "Dec", mm: 25.9 },
];

const sumNormal = (months: MonthlyNormal[]) =>
  Math.round(months.reduce((sum, month) => sum + month.mm, 0) * 10) / 10;

export const ANNUAL_NORMAL_MM = sumNormal(MONTHLY_NORMALS);
export const MONSOON_NORMAL_MM = sumNormal(MONTHLY_NORMALS.slice(6, 9));

export const PRESETS: Preset[] = [
  {
    id: "monsoon-quarter",
    title: "A typical monsoon (Jul to Sep)",
    mm: MONSOON_NORMAL_MM,
    blurb: "Average July to September rainfall.",
    source: NORMALS_SOURCE,
  },
  {
    id: "average-year",
    title: "An average year",
    mm: ANNUAL_NORMAL_MM,
    blurb: "Average annual rainfall, 1991 to 2020 normals.",
    source: NORMALS_SOURCE,
  },
];

function distKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// The reading from the gauge closest to the roof, among gauges that reported.
// Islamabad roofs only ever use Islamabad gauges.
export function nearestReading(storm: Storm, lat: number, lng: number) {
  const islamabadRoof = isInAuthorizedCity(lat, lng);
  let best: { gauge: Gauge; mm: number; km: number } | null = null;
  for (const [id, mm] of Object.entries(storm.readings)) {
    if (mm == null) continue;
    if (islamabadRoof && !isIslamabadGauge(id)) continue;
    const g = GAUGES[id];
    const km = distKm(lat, lng, g.lat, g.lng);
    if (!best || km < best.km) best = { gauge: g, mm, km };
  }
  return best;
}
