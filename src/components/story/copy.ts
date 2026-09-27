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
  question: "Where did your roof's share go?",
  lead: "Pick your roof, replay a real recorded storm, and follow every litre: into a tank, down a recharge well, or into the nalah. Then bring your street.",
};

export const BEATS = 7;

export function caption(beat: number, caught: boolean): { title: string; body: string } {
  switch (beat) {
    case 0:
      return { title: "Before the rain", body: "Most days, the sun bakes the Margalla Hills and the city at their feet." };
    case 1:
      return { title: "The monsoon arrives", body: "Then the clouds roll in over the hills." };
    case 2:
      return {
        title: record.dateLabel,
        body: `${h8Mm} mm fell at the ${GAUGES.pmd.name} ${GAUGES.pmd.note}. Follow one drop.`,
      };
    case 3:
      return { title: "It lands on a roof", body: "An ordinary Islamabad rooftop. Yours probably looks a lot like this one." };
    case 4:
      return {
        title: "Today",
        body: groundwater
          ? `It runs off the roof, down the street and into the nalah. Underground, the water table in some sectors is dropping ${groundwater.stat} a year.`
          : "It runs off the roof, down the street and into the nalah, while the water table underground keeps dropping.",
      };
    case 5:
      return caught
        ? {
            title: "Caught",
            body: well
              ? `A pipe fills the tank, the overflow goes down a recharge well, and the nalah stays calm. One well at Kachnar Park, I-8 raised the local water table by ${plain(well.stat)}.`
              : "A pipe fills the tank, the overflow goes down a recharge well, and the nalah stays calm.",
          }
        : { title: "Now imagine...", body: "The same rain, on the same roof, but caught. Flip the switch." };
    default:
      return { title: "Your turn", body: "Every roof in the city can do this. Find yours." };
  }
}
