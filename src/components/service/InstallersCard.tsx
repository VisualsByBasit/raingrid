"use client";

import { INSTALLERS } from "@/data/installers";

// Vetted pilot installers near you. The list is empty until the pilot
// installers are vetted, so this shows the "coming soon" state.
export default function InstallersCard({ onBecomeInstaller }: { onBecomeInstaller: () => void }) {
  return (
    <div className="rounded-xl border border-line p-3 text-[13px]">
      <p className="font-semibold text-fg">Vetted pilot installers (coming soon)</p>
      {INSTALLERS.length === 0 ? (
        <p className="mt-1 text-muted">No installers are listed yet. Each pilot installer is vetted before they visit a home.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {INSTALLERS.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span className="text-fg">{i.name}</span>
              <span className="text-muted">{i.sectors.join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
      <button onClick={onBecomeInstaller} className="mt-2 text-xs text-tank-deep underline underline-offset-4">
        Are you a plumber or mason? Become a RainGrid installer
      </button>
    </div>
  );
}
