"use client";

import { motion } from "framer-motion";
import { mmToFillTank, roundSplitForDisplay, type RainResult } from "@/lib/engine";
import SystemDiagram from "../act/SystemDiagram";

// Where this storm's water went, then the plan that keeps more of it.
export default function WaterTab({ result }: { result: RainResult }) {
  return (
    <div className="space-y-8">
      <FollowTheWater result={result} />
      <RainPlan result={result} />
    </div>
  );
}

function FollowTheWater({ result }: { result: RainResult }) {
  const display = roundSplitForDisplay(result.split, result.gross);
  const parts = [
    { key: "tank", label: "Stored in your tank", v: result.split.tank, display: display.tank, color: "bg-tank", text: "text-tank-deep" },
    {
      key: "rechargePotential",
      label: "Routed toward recharge (potential)",
      v: result.split.rechargePotential,
      display: display.rechargePotential,
      color: "bg-ground",
      text: "text-ground-deep",
    },
    { key: "drain", label: "Routed to the drain", v: result.split.drain, display: display.drain, color: "bg-drain", text: "text-drain-deep" },
    { key: "lost", label: "Roof and collection losses", v: result.split.lost, display: display.lost, color: "bg-lost", text: "text-muted" },
  ];
  const total = Math.max(1, result.gross);
  return (
    <section aria-labelledby="follow-the-water">
      <h3 id="follow-the-water" className="text-xs font-semibold uppercase tracking-widest text-muted">
        Follow the water
      </h3>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-line">
        {parts.map((pt, i) => (
          <motion.div
            key={pt.key}
            className={`${pt.color} origin-left`}
            style={{ width: `${(pt.v / total) * 100}%` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.12 * i, duration: 0.5 }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {parts
          .filter((pt) => pt.key !== "rechargePotential" || pt.v > 0)
          .map((pt) => (
            <li key={pt.key} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${pt.color}`} />
                {pt.label}
              </span>
              <span className={`num ${pt.text}`}>{pt.display.toLocaleString("en-US")} L</span>
            </li>
          ))}
      </ul>
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
