"use client";

import { motion, useReducedMotion } from "framer-motion";
import { formatL } from "@/lib/engine";
import type { FlowLink, FlowNode, FlowNodeId } from "@/lib/flows";
import { useMedia } from "@/lib/useMedia";

// A hand-made Sankey: rain on the roof on the left, where it ends up on the
// right, band widths in proportion to litres (a hairline minimum so tiny
// flows like the first flush stay visible). Bands fade and slide in
// (opacity and transform only). Phones get a narrower drawing, so the
// labels stay full size instead of shrinking with the screen.

const TOP = 36;
const AVAIL = 220;
const GAP = 14;
const NW = 10;
const MIN_W = 2;
const LABEL_H = 24;

// Top to bottom in each column, chosen so bands cross as little as possible.
const ORDER: FlowNodeId[] = ["rain", "collect", "firstFlush", "unpiped", "lost", "tank", "recharge", "drain"];

export const FLOW_COLOR: Record<FlowNodeId, string> = {
  rain: "var(--color-tank-deep)",
  collect: "var(--color-tank)",
  tank: "var(--color-tank)",
  recharge: "var(--color-ground)",
  drain: "var(--color-drain)",
  firstFlush: "var(--color-drain)",
  unpiped: "var(--color-drain)",
  lost: "var(--color-lost)",
};

export default function WaterSankey({ nodes, links, gross }: { nodes: FlowNode[]; links: FlowLink[]; gross: number }) {
  const reduced = useReducedMotion();
  const narrow = useMedia("(max-width: 639px)");
  const W = narrow ? 340 : 440;
  const COL_X = narrow ? ([0, 112, 222] as const) : ([0, 150, 292] as const);
  const rank = (id: FlowNodeId) => ORDER.indexOf(id);
  const col1 = nodes.filter((n) => n.column === 1).length;
  const k = (AVAIL - Math.max(0, col1 - 1) * GAP) / Math.max(1, gross);
  const width = (l: FlowLink) => Math.max(MIN_W, l.litres * k);

  // Node heights: the bands leaving (rain) or arriving (everything else).
  const height = new Map<FlowNodeId, number>();
  for (const n of nodes) {
    const ls = n.column === 0 ? links.filter((l) => l.from === n.id) : links.filter((l) => l.to === n.id);
    height.set(n.id, ls.reduce((s, l) => s + width(l), 0));
  }
  // Stack each column from the top.
  const y = new Map<FlowNodeId, number>();
  for (const col of [0, 1, 2] as const) {
    let at = TOP;
    for (const n of nodes.filter((x) => x.column === col).sort((a, b) => rank(a.id) - rank(b.id))) {
      y.set(n.id, at);
      at += height.get(n.id)! + GAP;
    }
  }
  // Where each band leaves and joins its nodes.
  const outAt = new Map<FlowNodeId, number>();
  const inAt = new Map<FlowNodeId, number>();
  const bands = [...links]
    .sort((a, b) => rank(a.from) - rank(b.from) || rank(a.to) - rank(b.to))
    .map((l) => {
      const w = width(l);
      const from = nodes.find((n) => n.id === l.from)!;
      const to = nodes.find((n) => n.id === l.to)!;
      const y0 = y.get(l.from)! + (outAt.get(l.from) ?? 0);
      outAt.set(l.from, (outAt.get(l.from) ?? 0) + w);
      const y1 = y.get(l.to)! + (inAt.get(l.to) ?? 0);
      inAt.set(l.to, (inAt.get(l.to) ?? 0) + w);
      const x0 = COL_X[from.column] + NW;
      const x1 = COL_X[to.column];
      const mx = (x0 + x1) / 2;
      const d = `M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1} L ${x1} ${y1 + w} C ${mx} ${y1 + w}, ${mx} ${y0 + w}, ${x0} ${y0 + w} Z`;
      return { l, d, stage: from.column };
    });

  // Labels beside their nodes, nudged down so they never overlap.
  const labelY = new Map<FlowNodeId, number>();
  for (const col of [1, 2] as const) {
    let floor = 0;
    for (const n of nodes.filter((x) => x.column === col).sort((a, b) => rank(a.id) - rank(b.id))) {
      const centre = y.get(n.id)! + height.get(n.id)! / 2 - LABEL_H / 2 + 9;
      const at = Math.max(centre, floor);
      labelY.set(n.id, at);
      floor = at + LABEL_H;
    }
  }
  const bottom = Math.max(...nodes.map((n) => y.get(n.id)! + height.get(n.id)!), ...[...labelY.values()].map((v) => v + LABEL_H - 6));
  const H = Math.ceil(bottom + 8);

  const ends = nodes.filter((n) => n.column === 2 || n.id === "lost");
  const summary = `Of ${formatL(gross)} of rain on the roof: ${ends.map((n) => `${n.label} ${formatL(n.litres)}`).join(", ")}.`;
  const halo = { paintOrder: "stroke", stroke: "var(--color-ink)", strokeWidth: 3, strokeLinejoin: "round" } as const;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full max-w-[600px]">
      {bands.map(({ l, d, stage }) => (
        <motion.path
          key={`${l.from}-${l.to}`}
          d={d}
          fill={FLOW_COLOR[l.to]}
          fillOpacity={0.42}
          initial={reduced ? { opacity: 1 } : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduced ? 0 : 0.45, delay: reduced ? 0 : 0.15 + stage * 0.4 }}
        >
          <title>{`${l.label}: ${formatL(l.litres)}`}</title>
        </motion.path>
      ))}
      {nodes.map((n) => (
        <rect key={n.id} x={COL_X[n.column]} y={y.get(n.id)} width={NW} height={Math.max(MIN_W, height.get(n.id)!)} rx={2} fill={FLOW_COLOR[n.id]} />
      ))}

      {/* Rain on roof: above its bar. */}
      <text x={0} y={14} fontSize={11} fontWeight={600} fill="var(--color-fg)">
        Rain on roof
      </text>
      <text x={0} y={27} className="num" fontSize={10} fill="var(--color-muted)">
        {formatL(gross)}
      </text>
      {nodes
        .filter((n) => n.column > 0)
        .map((n) => {
          const x = COL_X[n.column] + NW + 4;
          const ly = labelY.get(n.id)!;
          return (
            <g key={`label-${n.id}`}>
              <text x={x} y={ly} fontSize={10.5} fontWeight={600} fill="var(--color-fg)" style={halo}>
                {n.label}
              </text>
              <text x={x} y={ly + 12} className="num" fontSize={10} fill="var(--color-muted)" style={halo}>
                {formatL(n.litres)}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
