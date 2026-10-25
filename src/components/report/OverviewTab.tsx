"use client";

import { formatL, formatRange, mmToFillTank, roundL, type RainResult } from "@/lib/engine";
import { depthLine, tanksLine } from "@/lib/explain";
import type { ReportTab } from "@/lib/report";
import { useCountUp } from "@/lib/useCountUp";
import { RECHARGE_SUITABILITY, TankIcon } from "../RainBits";

// The headline: what this roof can collect from the storm, how the tank
// copes, and where to look next.
export default function OverviewTab({ result, setTab }: { result: RainResult; setTab: (t: ReportTab) => void }) {
  const collect = useCountUp(result.net.mid, 1200, true);
  const { tankLitres, rainMm } = result.inputs;
  const fillMm = mmToFillTank(result.inputs);
  const overflow = Math.max(0, result.net.mid - result.split.tank);
  const tanks = tanksLine(result.net.mid, tankLitres);
  const next: { tab: ReportTab; title: string; body: string }[] = [
    { tab: "water", title: "Follow the water", body: "Where every litre went, and the plan that keeps more of it." },
    { tab: "money", title: "What it's worth", body: "This water in tanker loads, at CDA and private prices." },
    { tab: "install", title: "Get it installed", body: "Your package, price, instalments and a free site visit." },
  ];
  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="num text-5xl font-semibold tracking-tight text-fg md:text-6xl">{roundL(collect).toLocaleString("en-US")} L</p>
          <p className="mt-1 text-base text-fg">you can collect from this storm</p>
          <p className="mt-0.5 text-muted">
            <span className="num">{formatL(result.gross)}</span> landed on your roof
          </p>
        </div>
        <TankIcon fill={tankLitres > 0 ? result.split.tank / tankLitres : 0} className="h-20 w-12 shrink-0" />
      </div>

      <ul className="space-y-1 text-fg">
        {tanks && <li>{tanks}</li>}
        <li>{depthLine(rainMm)}</li>
      </ul>

      <div className="rounded-xl border border-drain/30 bg-drain/5 p-3">
        {tankLitres <= 0 ? (
          <p>
            No storage tank is configured. Harvestable runoff was{" "}
            {result.split.rechargePotential > 0
              ? "routed toward your recharge system; actual infiltration depends on the site."
              : "routed to the drain."}
          </p>
        ) : Number.isFinite(fillMm) && fillMm < rainMm ? (
          <p>
            Your <span className="num">{tankLitres.toLocaleString("en-US")} L</span> tank was full after the first{" "}
            <span className="num text-tank-deep">{Math.ceil(fillMm)} mm</span>. About{" "}
            <span className="num text-drain-deep">{formatL(overflow)}</span> overflowed
            {result.split.rechargePotential > 0
              ? " toward your recharge system; actual infiltration depends on the site."
              : " to the drain. A recharge well could take it instead."}
          </p>
        ) : (
          <p>
            This storm fits in your tank. You could catch <span className="num text-tank-deep">{formatRange(result.net.low, result.net.high)}</span>.
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          Harvestable after losses: {formatRange(result.net.low, result.net.high)}, depending on roof surface.
        </p>
        {(result.split.rechargePotential > 0 || overflow > 0) && <p className="mt-1 text-xs text-muted">{RECHARGE_SUITABILITY}</p>}
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {next.map((n) => (
          <button
            key={n.tab}
            onClick={() => setTab(n.tab)}
            className="rounded-xl border border-line p-3 text-left transition hover:border-tank/60"
          >
            <span className="block font-semibold text-fg">{n.title} →</span>
            <span className="mt-0.5 block text-xs text-muted">{n.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
