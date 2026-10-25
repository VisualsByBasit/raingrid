import { describe, expect, it } from "vitest";
import { MONTHLY_NORMALS } from "../data/storms";
import { calculate } from "./engine";
import { waterFlows } from "./flows";
import { monsoonCatch, seasonMonths, seasonSummary } from "./season";

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

describe("monsoon catch", () => {
  const months = seasonMonths({ areaM2: 250 });

  it("is limited by use for a 250 m² roof with 4,000 L and 500 L a day", () => {
    const c = monsoonCatch(months, 4000, 500);
    expect(c.days).toBe(92);
    expect(c.rainDays).toBeCloseTo(30.6, 5);
    // 4,000 + 500 × 92 = 50,000 L, far below the 113,000 L harvest.
    expect(c.caught).toBe(50_000);
    expect(c.limitedBy).toBe("use");
  });

  it("never exceeds the harvest, or one tankful per rain day", () => {
    // 2,000 L × 30.6 rain days = 61,200 L, below the harvest.
    const big = monsoonCatch(months, 2000, 5000);
    expect(big.caught).toBeCloseTo(2000 * 30.6, 6);
    expect(big.limitedBy).toBe("rainDays");
    const huge = monsoonCatch(months, 50_000, 5000);
    expect(huge.caught).toBeCloseTo(huge.harvest, 6);
    expect(huge.limitedBy).toBe("harvest");
  });

  it("catches nothing without storage, and handles bad input", () => {
    expect(monsoonCatch(months, 0, 500).caught).toBe(0);
    expect(monsoonCatch(months, 4000, Number.NaN).caught).toBe(4000);
  });
});
