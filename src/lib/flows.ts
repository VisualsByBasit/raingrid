// Where a storm's water goes, as a flow diagram: every litre that lands on
// the roof, split exactly the way the engine splits it. Pure and tested; the
// Water tab draws it (src/components/report/WaterSankey.tsx).
//
//   Rain on roof ─┬─ Unpiped roof ──────────────── Drain
//                 ├─ Losses (soaked in, evaporated, splashed)
//                 ├─ First flush ───────────────── Drain
//                 └─ You can collect ─┬─ Tank
//                                     ├─ Recharge
//                                     └─ Overflow ─ Drain

import type { RainResult } from "./engine";

export type FlowNodeId = "rain" | "unpiped" | "lost" | "firstFlush" | "collect" | "tank" | "recharge" | "drain";

export interface FlowNode {
  id: FlowNodeId;
  label: string;
  column: 0 | 1 | 2;
  litres: number;
}

export interface FlowLink {
  from: FlowNodeId;
  to: FlowNodeId;
  litres: number;
  // What this band is, in words, for the table and the screen reader text.
  label: string;
}

export function waterFlows(r: RainResult): { nodes: FlowNode[]; links: FlowLink[] } {
  const { areaM2, rainMm, usableShare } = r.inputs;
  const unpiped = Math.max(0, r.gross - areaM2 * usableShare * rainMm);
  const overflow = Math.max(0, r.net.mid - r.split.tank - r.split.rechargePotential);
  const all: FlowLink[] = [
    { from: "rain", to: "unpiped", litres: unpiped, label: "Rain on the part of the roof that isn't piped" },
    { from: "rain", to: "lost", litres: r.split.lost, label: "Soaked into the roof, evaporated or splashed" },
    { from: "rain", to: "firstFlush", litres: r.firstFlush, label: "The dirty first flush, diverted" },
    { from: "rain", to: "collect", litres: r.net.mid, label: "Water you can collect (after first flush and losses)" },
    { from: "collect", to: "tank", litres: r.split.tank, label: "Stored in your tank" },
    { from: "collect", to: "recharge", litres: r.split.rechargePotential, label: "Routed toward recharge (potential)" },
    { from: "collect", to: "drain", litres: overflow, label: "Overflow, to the drain" },
    { from: "unpiped", to: "drain", litres: unpiped, label: "Unpiped roof water, to the drain" },
    { from: "firstFlush", to: "drain", litres: r.firstFlush, label: "First flush, to the drain" },
  ];
  const links = all.filter((l) => l.litres > 0.5);

  const sum = (pred: (l: FlowLink) => boolean) => links.filter(pred).reduce((s, l) => s + l.litres, 0);
  const NODES: Omit<FlowNode, "litres">[] = [
    { id: "rain", label: "Rain on roof", column: 0 },
    { id: "unpiped", label: "Unpiped roof", column: 1 },
    { id: "lost", label: "Losses", column: 1 },
    { id: "firstFlush", label: "First flush", column: 1 },
    { id: "collect", label: "You can collect", column: 1 },
    { id: "tank", label: "Tank", column: 2 },
    { id: "recharge", label: "Recharge", column: 2 },
    { id: "drain", label: "Drain", column: 2 },
  ];
  const nodes = NODES.map((n) => ({
    ...n,
    litres: n.id === "rain" ? r.gross : sum((l) => l.to === n.id),
  })).filter((n) => n.litres > 0.5);
  return { nodes, links };
}
