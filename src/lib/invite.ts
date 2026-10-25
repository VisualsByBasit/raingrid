// "Invite a neighbour" message for WhatsApp. No phone number: wa.me/?text=
// opens the user's own contact picker. Pure, so it is unit tested.

const nf = (v: number) => v.toLocaleString("en-US");

export interface StreetProgress {
  planned: number; // roofs on the link that have a Rain Plan
  total: number; // roofs on the link
}

export function streetProgress(roofs: { planned?: boolean }[]): StreetProgress {
  return { planned: roofs.filter((r) => r.planned).length, total: roofs.length };
}

export function inviteMessage({ progress, storedLitres, link }: { progress: StreetProgress; storedLitres: number; link: string }): string {
  const lines = [
    "Our street is making a rain plan with RAIN//GRID.",
    `${progress.planned} of ${progress.total} ${progress.total === 1 ? "roof has" : "roofs have"} a plan so far.`,
  ];
  if (storedLitres > 0) lines.push(`Together our tanks could store about ${nf(storedLitres)} L from one storm.`);
  lines.push("Add your roof and replay a real storm on it:", link);
  return lines.join("\n");
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
