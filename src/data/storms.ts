// Real, sourced storm events for Islamabad.
// Every reading is quoted from the linked report. Gauge coordinates are
// approximate and only used to pick the nearest reported gauge to a roof.

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
];

// Longer-period presets. Clearly labelled as averages, not events.
export interface Preset {
  id: string;
  title: string;
  mm: number;
  blurb: string;
  source: { label: string; url: string };
}

export const PRESETS: Preset[] = [
  {
    id: "monsoon-quarter",
    title: "A typical monsoon (Jul to Sep)",
    mm: 763,
    blurb: "Average July to September rainfall.",
    source: { label: "Wego, PMD-based averages", url: "https://blog.wego.com/monsoon-in-pakistan/" },
  },
  {
    id: "average-year",
    title: "An average year",
    mm: 1250,
    blurb: "Average annual rainfall, 1991 to 2020 normals.",
    source: { label: "Climates to Travel, 1991-2020", url: "https://www.climatestotravel.com/climate/pakistan/islamabad" },
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
export function nearestReading(storm: Storm, lat: number, lng: number) {
  let best: { gauge: Gauge; mm: number; km: number } | null = null;
  for (const [id, mm] of Object.entries(storm.readings)) {
    if (mm == null) continue;
    const g = GAUGES[id];
    const km = distKm(lat, lng, g.lat, g.lng);
    if (!best || km < best.km) best = { gauge: g, mm, km };
  }
  return best;
}
