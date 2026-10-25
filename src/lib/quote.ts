// Turns a package (and a tank size) into a rupee range, line by line, from
// the prices in src/config/packages.ts. Pure, unit tested. Pipe length and
// labour days are estimates, so any line that uses them is flagged. The
// RainGrid service margin is added as its own line on top of parts and
// labour.

import { PACKAGES, PARTS, SERVICE_LINE, SERVICE_MARGIN, type PackageId, type PartId } from "../config/packages";

export interface QuoteLine {
  part: PartId | "service";
  label: string;
  lowRs: number;
  highRs: number;
  estimate: boolean;
}

export interface Quote {
  package: PackageId;
  lines: QuoteLine[];
  lowRs: number;
  highRs: number;
  // Parts priced only after the site visit (the recharge well).
  onSiteVisit: string[];
}

// Rs 46,532 -> 46,500. Quotes are ranges; whole hundreds are honest enough.
export const roundHundred = (rs: number) => Math.round(rs / 100) * 100;

export function buildQuote(
  pkgId: PackageId,
  tank: { size: 1000 | 2000; count: number } | null,
  opts: { recharge?: boolean } = {},
): Quote {
  const pkg = PACKAGES[pkgId];
  const lines: QuoteLine[] = [];
  const nf = (v: number) => v.toLocaleString("en-US");
  for (const id of pkg.parts) {
    const part = PARTS[id];
    if (!part.price) continue;
    const p = part.price;
    if (id === "tank2000" || id === "tank1000") {
      // The package's default tank, replaced by the recommended size.
      const t = tank ?? { size: id === "tank1000" ? 1000 : 2000, count: 1 };
      const tp = PARTS[t.size === 1000 ? "tank1000" : "tank2000"].price!;
      lines.push({
        part: t.size === 1000 ? "tank1000" : "tank2000",
        label: `${t.count > 1 ? `${t.count} × ` : ""}${nf(t.size)} L tank`,
        lowRs: tp.lowRs * t.count,
        highRs: tp.highRs * t.count,
        estimate: tp.estimate,
      });
      continue;
    }
    if (id === "pipe") {
      const [lo, hi] = pkg.quantities.pipeFeet;
      lines.push({ part: id, label: `${part.name}, ${lo} to ${hi} ft`, lowRs: p.lowRs * lo, highRs: p.highRs * hi, estimate: true });
      continue;
    }
    if (id === "plumber" || id === "helper") {
      const [lo, hi] = pkg.quantities.labourDays;
      const days = lo === hi ? `${lo} day${lo > 1 ? "s" : ""}` : `${lo} to ${hi} days`;
      lines.push({ part: id, label: `${part.name}, ${days}`, lowRs: p.lowRs * lo, highRs: p.highRs * hi, estimate: true });
      continue;
    }
    lines.push({ part: id, label: part.name, lowRs: p.lowRs, highRs: p.highRs, estimate: p.estimate });
  }
  // Plus with no tank given still prices its default tank (handled above);
  // Basic and Standard never add a tank the package doesn't include.
  const partsLowRs = lines.reduce((s, l) => s + l.lowRs, 0);
  const partsHighRs = lines.reduce((s, l) => s + l.highRs, 0);
  lines.push({ part: "service", label: SERVICE_LINE, lowRs: partsLowRs * SERVICE_MARGIN, highRs: partsHighRs * SERVICE_MARGIN, estimate: false });
  const lowRs = roundHundred(lines.reduce((s, l) => s + l.lowRs, 0));
  const highRs = roundHundred(lines.reduce((s, l) => s + l.highRs, 0));
  return { package: pkgId, lines, lowRs, highRs, onSiteVisit: opts.recharge ? [PARTS.rechargeWell.name] : [] };
}

// Indicative monthly instalments: the quote range split evenly, before any
// financing charges. Shown as "via Zindigi, indicative".
export function instalments(q: { lowRs: number; highRs: number }, months: number) {
  return { months, lowRs: roundHundred(q.lowRs / months), highRs: roundHundred(q.highRs / months) };
}
