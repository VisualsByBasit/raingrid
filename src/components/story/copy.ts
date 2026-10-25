// Landing copy. Every number here is read from CITY.facts or the 21 July 2025
// storm record, never typed in by hand. Plain hyphens only, and "nalah".
import { CITY } from "@/config/city";
import { GAUGES, STORMS } from "@/data/storms";

const record = STORMS.find((s) => s.id === "2025-07-21") ?? STORMS[0];
const h8Mm = record.readings.pmd ?? Math.max(...Object.values(record.readings).map((v) => v ?? 0));
const factAbout = (pattern: RegExp) => CITY.facts.find((f) => pattern.test(f.text));
const groundwater = factAbout(/groundwater/i);
const well = factAbout(/recharge well/i);
// "~4 m" reads better in a sentence as "about 4 m".
const plain = (stat: string) => stat.replace(/^~\s*/, "about ");

export const HERO = {
  kicker: `RAIN//GRID - ${CITY.name}`,
  headline: `On ${record.dateLabel}, ${h8Mm} mm of rain fell near H-8.`,
  // The same headline split into lines for the hero's staggered entrance.
  headlineLines: [`On ${record.dateLabel},`, `${h8Mm} mm of rain`, "fell near H-8."],
  eyebrow: `${CITY.name} · Monsoon`,
  question: "Where did your roof's share go?",
  lead: "Pick your roof, replay a real recorded storm, and follow every litre: into a tank, down a recharge well, or into the nalah. Then bring your street.",
};

// The scroll story: three beats over about three screens.
export const BEATS = 3;
export type StoryMode = "today" | "raingrid";

export const STORY_BEATS: { title: string; body: string }[] = [
  { title: "Before the rain", body: "Most days, the sun bakes the Margalla Hills and the city at their feet." },
  {
    title: record.dateLabel,
    body: `The monsoon rolls in over the hills. ${h8Mm} mm fell at the ${GAUGES.pmd.name} ${GAUGES.pmd.note}, on every roof in the city.`,
  },
  { title: "Where does it go?", body: "" },
];

export const OUTCOME: Record<StoryMode, string> = {
  today: groundwater
    ? `Today it runs off the roof, down the street and into the nalah. Underground, the water table in some sectors is dropping ${groundwater.stat} a year.`
    : "Today it runs off the roof, down the street and into the nalah, while the water table underground keeps dropping.",
  raingrid: well
    ? `With RainGrid, gutters fill a tank, the overflow goes down a recharge well, and the nalah stays calmer. One well at Kachnar Park, I-8 raised the local water table by ${plain(well.stat)}.`
    : "With RainGrid, gutters fill a tank, the overflow goes down a recharge well, and the nalah stays calmer.",
};
