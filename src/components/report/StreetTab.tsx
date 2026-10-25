"use client";

import { formatL, type RainResult } from "@/lib/engine";
import Pledge from "../act/Pledge";
import StreetProgressCard from "../act/StreetProgressCard";
import type { ReportProps, Street } from "./types";

const btn = "rounded-lg border border-line px-3 py-2 text-sm transition hover:border-tank/60 hover:text-fg";

// One roof is a tank; a street of roofs keeps water out of the nalah. Leads
// with the street link's combined total, then inviting and adding roofs.
export default function StreetTab({
  roofs,
  street,
  result,
  onAddNeighbours,
  invite,
  share,
  onPledgeVisit,
}: Pick<ReportProps, "roofs" | "street" | "onAddNeighbours" | "invite" | "share"> & { result: RainResult; onPledgeVisit: () => void }) {
  const n = street?.count ?? 1;
  const landed = street ? street.gross : result.gross;
  const kept = street ? street.tank + street.rechargePotential : result.split.tank + result.split.rechargePotential;
  return (
    <div className="space-y-4 text-sm">
      <section className="rounded-2xl border border-tank/40 bg-tank/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-tank-deep">This street link</p>
        <p className="num mt-1 text-4xl font-semibold tracking-tight text-fg">{formatL(landed)}</p>
        <p className="text-fg">
          of rain landed on the {n === 1 ? "1 roof" : `${n} roofs`} on this link in this storm.{" "}
          <span className="num text-tank-deep">{formatL(kept)}</span> is kept in tanks
          {(street ? street.rechargePotential : result.split.rechargePotential) > 0 ? " or sent toward wells" : ""}; the rest is lost on
          the roofs or heads for the drain and the nalah.
        </p>
      </section>
      <StreetProgressCard roofs={roofs} onInvite={invite} />
      <button onClick={onAddNeighbours} className={`${btn} w-full`}>
        + Add neighbours&apos; roofs on the map
      </button>
      {street && <StreetTotals street={street} />}
      <div>
        <button onClick={share} className={`${btn} w-full`}>
          Copy street link
        </button>
        <p className="mt-1 text-center text-[11px] text-muted">This link includes your roof&apos;s location.</p>
      </div>
      <Pledge onSiteVisit={onPledgeVisit} />
    </div>
  );
}

function StreetTotals({ street }: { street: Street }) {
  return (
    <div className="rounded-lg border border-tank/30 bg-tank/5 p-3">
      <p className="text-xs text-muted">{street.count} roofs in this storm (each with its own tank)</p>
      <p className="num mt-1 text-2xl font-semibold">{formatL(street.gross)}</p>
      <ul className="mt-2 space-y-1">
        <li className="flex justify-between">
          <span>Stored in tanks</span>
          <span className="num text-tank-deep">{formatL(street.tank)}</span>
        </li>
        {street.rechargePotential > 0 && (
          <li className="flex justify-between">
            <span>Routed toward recharge (potential)</span>
            <span className="num text-ground-deep">{formatL(street.rechargePotential)}</span>
          </li>
        )}
        <li className="flex justify-between">
          <span>Still lost to the drain</span>
          <span className="num text-drain-deep">{formatL(street.drain)}</span>
        </li>
      </ul>
      {street.potentialWithWells > street.tank + street.rechargePotential + 100 && (
        <p className="mt-2 rounded-md bg-ground/10 px-2 py-1.5 text-xs">
          <span className="text-muted">Scenario: if every roof here added a filtered recharge well, </span>
          <span className="num text-ground-deep">{formatL(street.potentialWithWells)}</span>
          <span className="text-muted"> could be stored or routed toward recharge. Actual infiltration requires a site assessment.</span>
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        Street action: agree one pre-monsoon cleaning day, and get one shared quote for filters and recharge wells.
      </p>
    </div>
  );
}
