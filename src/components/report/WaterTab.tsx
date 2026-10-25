"use client";

import { useState } from "react";
import { formatL, mmToFillTank, ROOF_TYPES, type RainResult } from "@/lib/engine";
import { waterFlows } from "@/lib/flows";
import type { Roof } from "@/lib/roof";
import { SOURCES, areaSource } from "@/lib/sources";
import SystemDiagram from "../act/SystemDiagram";
import SourceTip from "../SourceTip";
import type { Rain } from "./types";
import WaterSankey, { FLOW_COLOR } from "./WaterSankey";

const nf = (v: number) => v.toLocaleString("en-US");

// Where this storm's water went, then the plan that keeps more of it.
export default function WaterTab({ result, rain, roof }: { result: RainResult; rain: Rain; roof: Roof }) {
  return (
    <div className="space-y-10">
      <FollowTheWater result={result} rain={rain} roof={roof} />
      <RainPlan result={result} />
    </div>
  );
}

function FollowTheWater({ result, rain, roof }: { result: RainResult; rain: Rain; roof: Roof }) {
  const [table, setTable] = useState(false);
  const { nodes, links } = waterFlows(result);
  const { areaM2, rainMm, usableShare, firstFlushMm, roofType, tankLitres, hasRecharge } = result.inputs;
  const spec = ROOF_TYPES[roofType];
  const catchment = areaM2 * usableShare;
  // How each band is worked out, in the engine's own terms.
  const how: Record<string, string> = {
    "rain-unpiped": `${nf(Math.round(areaM2))} m² × ${Math.round((1 - usableShare) * 100)}% not piped × ${nf(rainMm)} mm`,
    "rain-lost": `${nf(Math.round(catchment))} m² × (${nf(rainMm)} − ${firstFlushMm} mm) × (1 − runoff ${spec.mid})`,
    "rain-firstFlush": `${nf(Math.round(catchment))} m² × ${firstFlushMm} mm`,
    "rain-collect": `${nf(Math.round(catchment))} m² × (${nf(rainMm)} − ${firstFlushMm} mm) × runoff ${spec.mid}`,
    "collect-tank": `up to your ${formatL(tankLitres)} tank`,
    "collect-recharge": "what the tank can't hold, toward your well",
    "collect-drain": "what the tank can't hold",
    "unpiped-drain": "all of it",
    "firstFlush-drain": "all of it",
  };
  const tip = {
    method: `${nf(Math.round(areaM2))} m² × ${nf(rainMm)} mm = ${formatL(result.gross)} on the roof, split by usable share ${Math.round(usableShare * 100)}%, first flush ${firstFlushMm} mm and runoff ${spec.mid} (${spec.label}).`,
    sources: [...(rain.source ? [rain.source] : []), areaSource(roof.source), SOURCES.unit, SOURCES.usableShare, SOURCES.firstFlush, SOURCES.runoff, ...(hasRecharge ? [SOURCES.recharge] : [])],
  };

  return (
    <section aria-labelledby="follow-the-water">
      <h3 id="follow-the-water" className="text-xs font-semibold uppercase tracking-widest text-muted">
        Follow the water
        <SourceTip {...tip} />
      </h3>
      <p className="mt-1 text-[13px] text-fg">Every litre that landed on your roof in this storm, and where it ended up.</p>
      <div className="mt-4">
        <WaterSankey nodes={nodes} links={links} gross={result.gross} />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {[
          ["tank", "Stored"],
          ["recharge", "Toward recharge (potential)"],
          ["drain", "To the drain"],
          ["lost", "Lost on the roof"],
        ]
          .filter(([id]) => id !== "recharge" || hasRecharge)
          .map(([id, label]) => (
            <li key={id} className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm" style={{ background: FLOW_COLOR[id as keyof typeof FLOW_COLOR] }} />
              {label}
            </li>
          ))}
      </ul>
      {!hasRecharge && <p className="mt-2 text-xs text-muted">No recharge well in your setup, so the overflow goes to the drain.</p>}
      <button onClick={() => setTable((v) => !v)} aria-expanded={table} className="mt-3 text-xs text-tank-deep underline underline-offset-4">
        {table ? "Hide the exact numbers" : "Show the exact numbers"}
      </button>
      {table && (
        <table className="num mt-2 w-full border-collapse text-left text-xs">
          <caption className="sr-only">Every flow in litres, as the engine works it out</caption>
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-1.5 pr-3 font-normal">Flow</th>
              <th className="hidden py-1.5 pr-3 font-normal sm:table-cell">How</th>
              <th className="py-1.5 text-right font-normal">Litres</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line/60">
              <td className="py-1.5 pr-3">Rain on the roof</td>
              <td className="hidden py-1.5 pr-3 text-muted sm:table-cell">
                {nf(Math.round(areaM2))} m² × {nf(rainMm)} mm
              </td>
              <td className="py-1.5 text-right">{nf(Math.round(result.gross))}</td>
            </tr>
            {links.map((l) => (
              <tr key={`${l.from}-${l.to}`} className="border-b border-line/60">
                <td className="py-1.5 pr-3">{l.label}</td>
                <td className="hidden py-1.5 pr-3 text-muted sm:table-cell">{how[`${l.from}-${l.to}`]}</td>
                <td className="py-1.5 text-right">{nf(Math.round(l.litres))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function RainPlan({ result }: { result: RainResult }) {
  const hasRecharge = result.inputs.hasRecharge;
  const bigger = result.net.mid > result.inputs.tankLitres;
  const fillMm = mmToFillTank(result.inputs);
  const steps = [
    <>
      Fit a leaf screen and a first-flush diverter so the dirty first <span className="num">{result.inputs.firstFlushMm} mm</span> skips the
      tank.
    </>,
    result.inputs.tankLitres > 0
      ? "Filter before storage and keep the tank covered. Use this water for gardening, washing, flushing and cleaning. Drink it only after the filter + UV branch."
      : "No storage tank is configured. Add a covered tank if you want to reuse water for gardening, washing, flushing or cleaning.",
    bigger
      ? hasRecharge
        ? "Keep the overflow pipe to your recharge well clear, and have the filter pit cleaned before each monsoon."
        : "Your roof catches far more than one tank. A filtered recharge well could send the overflow toward groundwater instead of the drain. Whether your plot suits one depends on the soil and the depth to groundwater, which is checked on a site visit."
      : "Your tank can hold this whole storm. Use it between rains so it has room for the next one.",
    <>
      Before the monsoon: clean the roof, gutters and filter, and check the tank lid.
      {result.inputs.tankLitres > 0 && Number.isFinite(fillMm) && ` Your tank fills in about ${Math.ceil(fillMm)} mm of rain.`}
    </>,
  ];
  return (
    <section aria-labelledby="rain-plan">
      <h3 id="rain-plan" className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        Your rain plan
      </h3>
      <SystemDiagram areaM2={result.inputs.areaM2} firstFlushMm={result.inputs.firstFlushMm} tankLitres={result.inputs.tankLitres} />
      <ol className="mt-4 space-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="num text-tank">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] leading-relaxed text-muted/80">
        Preliminary estimate only. Site-specific design, construction and any potable use need a qualified professional and
        compliance with local rules.
      </p>
    </section>
  );
}
