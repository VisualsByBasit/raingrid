// WhatsApp messages for the site-visit request and the installer sign-up.
// No backend: the message opens in the user's own WhatsApp, and nothing is
// sent until they press send. Until the team's number is configured
// (NEXT_PUBLIC_CONTACT_WHATSAPP), the app runs in demo mode and only
// previews the message. Pure functions, unit tested.

import { ALL_SECTORS } from "../data/sectors";

// Read at build time: Next inlines NEXT_PUBLIC_ variables, so a change
// needs a redeploy.
export function contactNumber(raw: string | undefined = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP): string | null {
  return normalizeNumber(raw);
}

// "+92 300 1234567", "0300-1234567" -> "923001234567" (wa.me wants the
// international number, digits only). Anything implausible -> null.
export function normalizeNumber(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `92${d.slice(1)}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function waLink(number: string | null, text: string): string {
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
}

// A Pakistani mobile or landline the team can call back: 10 to 13 digits
// once spaces and dashes are gone.
export function isPlausiblePhone(raw: string): boolean {
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13;
}

// Nearest searchable sector to a roof (sector centres are approximate).
export function nearestSector(lat: number, lng: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const s of ALL_SECTORS) {
    const d = (s.lat - lat) ** 2 + ((s.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (!best || d < best.d) best = { id: s.id, d };
  }
  // Further than about 3 km from any sector centre: don't guess.
  return best && Math.sqrt(best.d) * 111 < 3 ? best.id : null;
}

export interface Pin {
  lat: number;
  lng: number;
}

export interface VisitRequest {
  name: string;
  phone: string;
  sector: string;
  time: string;
  packageName: string;
  notes: string;
  roofAreaM2: number | null;
  quote: string | null; // "Rs 102,000 to 199,500"
  recharge: boolean;
  shareLink: string;
  pins: { tank?: Pin | null; downpipe?: Pin | null };
}

const pinText = (p: Pin) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)} (https://maps.google.com/?q=${p.lat.toFixed(5)},${p.lng.toFixed(5)})`;

export function visitMessage(r: VisitRequest): string {
  const lines = [
    "RainGrid: free site visit request",
    `Name: ${r.name.trim()}`,
    `Phone: ${r.phone.trim()}`,
    `Sector: ${r.sector.trim() || "not given"}`,
    `Preferred time: ${r.time}`,
    `Package: ${r.packageName}${r.recharge ? " + recharge well (quote on site visit)" : ""}`,
  ];
  if (r.roofAreaM2) lines.push(`Roof area: about ${Math.round(r.roofAreaM2).toLocaleString("en-US")} m² (confirmed on site)`);
  if (r.quote) lines.push(`Quote shown: ${r.quote} (indicative)`);
  if (r.pins.tank) lines.push(`Tank spot: ${pinText(r.pins.tank)}`);
  if (r.pins.downpipe) lines.push(`Downpipe: ${pinText(r.pins.downpipe)}`);
  if (r.notes.trim()) lines.push(`Notes: ${r.notes.trim()}`);
  lines.push(`Roof link: ${r.shareLink}`);
  return lines.join("\n");
}

export interface InstallerApplication {
  name: string;
  phone: string;
  trade: string;
  area: string;
  experience: string;
}

export function installerMessage(a: InstallerApplication): string {
  return [
    "RainGrid: installer application",
    `Name: ${a.name.trim()}`,
    `Phone: ${a.phone.trim()}`,
    `Trade: ${a.trade}`,
    `Area: ${a.area.trim() || "not given"}`,
    `Experience: ${a.experience}`,
  ].join("\n");
}
