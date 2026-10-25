"use client";

import { motion } from "framer-motion";
import { ESTIMATE_LABEL, PARTS, type Part } from "@/config/packages";
import { priceLabel } from "@/lib/price";

// How the water is captured and cleaned, part by part: roof -> leaf screen
// -> first-flush diverter -> sealed tank, then two branches: the optional
// filter + UV for drinking, and the overflow to a recharge well. Water runs
// down the rail (CSS, stopped for reduced motion). Prices come from
// src/config/packages.ts.

type Kind = "roof" | "screen" | "diverter" | "tank" | "uv" | "well";

interface Node {
  kind: Kind;
  title: string;
  what: string;
  price?: string;
  estimate?: boolean;
  branch?: "optional" | "overflow";
}

function Icon({ kind }: { kind: Kind }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      {kind === "roof" && <path {...common} d="M3 11 12 4l9 7M6 10v9h12v-9" />}
      {kind === "screen" && <path {...common} d="M4 7h16M4 12h16M4 17h16M8 4v16M12 4v16M16 4v16" />}
      {kind === "diverter" && <path {...common} d="M12 3v7m0 0-5 6v5m5-11 5 6v5M5 21h4m6 0h4" />}
      {kind === "tank" && <path {...common} d="M6 6c0-1.7 2.7-3 6-3s6 1.3 6 3v12c0 1.7-2.7 3-6 3s-6-1.3-6-3zM6 6c0 1.7 2.7 3 6 3s6-1.3 6-3M6 13c0 1.7 2.7 3 6 3s6-1.3 6-3" />}
      {kind === "uv" && <path {...common} d="M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10zM12 11v5M9.5 13.5h5" />}
      {kind === "well" && <path {...common} d="M4 8h16M6 8v12h12V8M9 12h6M9 16h6M12 3v5" />}
    </svg>
  );
}

const kitPrice = (part: Part) => ({ price: priceLabel(part.price), estimate: part.price?.estimate ?? false });

export default function SystemDiagram({ areaM2, firstFlushMm, tankLitres }: { areaM2: number; firstFlushMm: number; tankLitres: number }) {
  const tank = tankLitres > 0 && tankLitres <= 1000 ? PARTS.tank1000 : PARTS.tank2000;
  const nodes: Node[] = [
    { kind: "roof", title: "Your roof", what: `${Math.round(areaM2).toLocaleString("en-US")} m² of catchment. Road water is never collected.` },
    { kind: "screen", title: "Leaf screen", what: "A mesh over the gutter outlet stops leaves, insects and grit.", ...kitPrice(PARTS.gutterKit) },
    {
      kind: "diverter",
      title: "First-flush diverter",
      what: `The dirtiest first ${firstFlushMm} mm of each storm goes to the drain, not the tank. Part of the gutter kit above.`,
    },
    {
      kind: "tank",
      title: tankLitres > 2000 ? "Sealed tanks (priced per 2,000 L tank)" : tank === PARTS.tank1000 ? "Sealed tank (1,000 L)" : "Sealed tank (2,000 L)",
      what: tank.what,
      ...kitPrice(tank),
    },
    { kind: "uv", title: "Filter + UV (optional)", what: PARTS.uvFilter.what, branch: "optional", ...kitPrice(PARTS.uvFilter) },
    {
      kind: "well",
      title: "Overflow to a recharge well",
      what: `When the tank is full, ${PARTS.pipe.name} carries the overflow (${priceLabel(PARTS.pipe.price)}) to a filtered well. Suitability is checked on the site visit.`,
      branch: "overflow",
      price: priceLabel(PARTS.rechargeWell.price),
    },
  ];

  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs uppercase tracking-widest text-muted">How your system works</p>
      <ol className="mt-3" aria-label="Rainwater system, from roof to tank">
        {nodes.map((n, i) => {
          const last = i === nodes.length - 1;
          const onRail = !n.branch;
          return (
            <motion.li
              key={n.kind}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className={`relative flex gap-3 pb-4 last:pb-0 ${n.branch ? "pl-6" : ""}`}
            >
              {/* The water rail runs down from each main-line part; branches leave the tank's line with an elbow. */}
              {onRail && <span aria-hidden className="flow-rail absolute bottom-0 left-[17px] top-9 w-[3px] rounded-full" />}
              {n.branch && (
                <span aria-hidden className="absolute left-[17px] top-0 h-[18px] w-[12px] rounded-bl-lg border-b-[3px] border-l-[3px] border-tank/40" />
              )}
              {n.branch === "optional" && !last && (
                <span aria-hidden className="flow-rail absolute bottom-0 left-[17px] top-0 w-[3px] rounded-full" />
              )}
              <span
                className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 bg-panel ${
                  n.kind === "well"
                    ? "border-ground text-ground-deep"
                    : n.branch === "optional"
                      ? "border-dashed border-tank/60 text-tank-deep"
                      : "border-tank/60 text-tank-deep"
                }`}
              >
                <Icon kind={n.kind} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="font-medium text-fg">{n.title}</p>
                <p className="text-[13px] leading-snug text-muted">{n.what}</p>
                {n.price && (
                  <p className="num mt-0.5 text-xs text-tank-deep">
                    {n.price}
                    {n.estimate && <span className="font-sans text-muted"> ({ESTIMATE_LABEL})</span>}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11px] text-muted">
        Drinking water only with the filter + UV branch. Without it, use the tank for toilets, washing, cleaning and the garden.
      </p>
    </div>
  );
}
