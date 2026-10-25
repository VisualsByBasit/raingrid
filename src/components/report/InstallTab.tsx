"use client";

import HowItWorks from "../service/HowItWorks";
import InstallersCard from "../service/InstallersCard";
import QuoteCard from "../service/QuoteCard";
import { MaintenanceCard, WaterSafety } from "../service/Trust";
import type { ReportProps } from "./types";

const btn = "rounded-lg border border-line px-3 py-2 text-sm transition hover:border-tank/60 hover:text-fg";

// Package, price, instalments, roof check and the site-visit request. On
// phones the request button stays stuck to the bottom of the screen.
export default function InstallTab({
  result,
  onQuoteChoice,
  onRoofCheck,
  onRequestVisit,
  onBecomeInstaller,
}: Pick<ReportProps, "result" | "onQuoteChoice" | "onRoofCheck" | "onRequestVisit" | "onBecomeInstaller">) {
  return (
    <div className="space-y-4 text-sm">
      <HowItWorks variant="compact" />
      <Heading>Your package and price</Heading>
      <QuoteCard result={result} onChoice={onQuoteChoice} />
      <Heading>Plan the visit</Heading>
      <button onClick={onRoofCheck} className={`${btn} w-full text-tank-deep`}>
        Mark your tank and downpipe spots (roof check)
      </button>
      <button onClick={onRequestVisit} className="btn-primary hidden w-full rounded-xl px-4 py-3 font-semibold md:block">
        Request a free site visit
      </button>
      <Heading>Looking after it</Heading>
      <div className="space-y-2">
        <MaintenanceCard />
        <WaterSafety />
      </div>
      <Heading>Installers</Heading>
      <InstallersCard onBecomeInstaller={onBecomeInstaller} />
      {/* Phones: last in the tab, so it can stay stuck to the bottom throughout. */}
      <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-ink/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <button onClick={onRequestVisit} className="btn-primary w-full rounded-xl px-4 py-3 font-semibold">
          Request a free site visit
        </button>
      </div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-xs font-semibold uppercase tracking-widest text-muted">{children}</h3>;
}
