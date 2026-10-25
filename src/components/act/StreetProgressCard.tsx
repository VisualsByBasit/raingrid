"use client";

import { streetProgress } from "@/lib/invite";
import type { Roof } from "@/lib/roof";

// "2 of 5 roofs on this street have a plan", from the roofs in the link.
// There is no backend: the newest link carries the newest count.
export default function StreetProgressCard({ roofs, onInvite }: { roofs: Roof[]; onInvite: () => void }) {
  const { planned, total } = streetProgress(roofs);
  if (total === 0) return null;
  return (
    <div className="rounded-lg border border-ground/30 bg-ground/5 p-3">
      <p className="text-sm text-fg">
        <span className="num font-semibold text-ground-deep">
          {planned} of {total}
        </span>{" "}
        {total === 1 ? "roof" : "roofs"} on this street {total === 1 ? "has" : "have"} a plan
      </p>
      <div className="mt-2 flex gap-1" aria-hidden>
        {roofs.map((r) => (
          <span key={r.id} className={`h-1.5 flex-1 rounded-full ${r.planned ? "bg-ground" : "bg-line"}`} />
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-muted">Counted from this link. Share the newest link so the count stays current.</p>
      <button
        onClick={onInvite}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-ground/50 bg-panel px-3 py-2 text-sm font-semibold text-ground-deep transition hover:bg-ground/10"
      >
        Invite a neighbour on WhatsApp
      </button>
    </div>
  );
}
