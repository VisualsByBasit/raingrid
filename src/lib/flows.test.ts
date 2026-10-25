import { describe, expect, it } from "vitest";
import { MONTHLY_NORMALS } from "../data/storms";
import { calculate } from "./engine";
import { waterFlows } from "./flows";
import { seasonMonths, seasonSummary } from "./season";

describe("water flows", () => {
  it("accounts for every litre that lands on the roof", () => {
    for (const hasRecharge of [false, true]) {
      for (const mm of [0.3, 12, 175]) {
        const r = calculate({ areaM2: 250, rainMm: mm, hasRecharge });
        const { nodes, links } = waterFlows(r);
        const fromRain = links.filter((l) => l.from === "rain").reduce((s, l) => s + l.litres, 0);
        expect(fromRain).toBeCloseTo(r.gross, 6);
        // What reaches the tank, recharge and drain plus the losses is the whole storm.
        const ends = nodes.filter((n) => n.column === 2 || n.id === "lost").reduce((s, n) => s + n.litres, 0);
        expect(ends).toBeCloseTo(r.gross, 6);
      }
    }
  });

  it("matches the engine's split exactly", () => {
    const r = calculate({ areaM2: 250, rainMm: 175 });
    const node = (id: string) => waterFlows(r).nodes.find((n) => n.id === id)?.litres ?? 0;
    expect(node("tank")).toBeCloseTo(r.split.tank, 6);
    expect(node("drain")).toBeCloseTo(r.split.drain, 6);
    expect(node("lost")).toBeCloseTo(r.split.lost, 6);
    expect(node("collect")).toBeCloseTo(r.net.mid, 6);
    // No well: no recharge band.
    expect(node("recharge")).toBe(0);
  });

  it("sends the overflow toward recharge when there is a well", () => {
    const r = calculate({ areaM2: 250, rainMm: 175, hasRecharge: true });
    const { links } = waterFlows(r);
    expect(links.find((l) => l.to === "recharge")?.litres).toBeCloseTo(r.split.rechargePotential, 6);
    expect(links.some((l) => l.from === "collect" && l.to === "drain")).toBe(false);
  });
});

describe("season", () => {
  const months = seasonMonths({ areaM2: 250 });

  it("has all twelve WMO months, with July to September marked", () => {
    expect(months.map((m) => m.month)).toEqual(MONTHLY_NORMALS.map((m) => m.month));
    expect(months.filter((m) => m.monsoon).map((m) => m.month)).toEqual(["Jul", "Aug", "Sep"]);
  });

  it("runs each month through the engine", () => {
    const aug = months.find((m) => m.month === "Aug")!;
    expect(aug.litres).toBeCloseTo(calculate({ areaM2: 250, rainMm: 317 }).net.mid, 6);
  });

  it("totals the year and the monsoon, and counts tank refills", () => {
    const s = seasonSummary(months, 2000);
    expect(s.monsoonLitres).toBeCloseTo(months.slice(6, 9).reduce((a, m) => a + m.litres, 0), 6);
    expect(s.monsoonShare).toBeGreaterThan(0.5);
    expect(s.monsoonRefills).toBeCloseTo(s.monsoonLitres / 2000, 6);
    expect(seasonSummary(months, 0).monsoonRefills).toBe(0);
  });
});
