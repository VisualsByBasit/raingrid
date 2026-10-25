import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { overviewGauges, recommendedStack, tankStack } from "./overview";

describe("tank stack", () => {
  it("fills your tank first, then the new ones, and overflows the rest", () => {
    const s = tankStack(5_000, 2000, { size: 2000, count: 1 });
    expect(s.tanks.map((t) => [t.label, t.filled])).toEqual([
      ["Your tank", 2000],
      ["New RainGrid tank", 2000],
    ]);
    expect(s.stored).toBe(4000);
    expect(s.overflow).toBe(1000);
  });

  it("leaves tanks part-full when the storm is small", () => {
    const s = tankStack(2_500, 2000, { size: 2000, count: 1 });
    expect(s.tanks[1].filled).toBe(500);
    expect(s.overflow).toBe(0);
  });

  it("works without a current tank or without new tanks", () => {
    expect(tankStack(3000, 0, { size: 2000, count: 1 }).tanks).toHaveLength(1);
    expect(tankStack(3000, 2000, null)).toMatchObject({ stored: 2000, overflow: 1000 });
    expect(tankStack(Number.NaN, 2000, null).stored).toBe(0);
  });

  it("adds the recommended tank for the record storm on a 250 m² roof", () => {
    const r = calculate({ areaM2: 250, rainMm: 175 });
    const s = recommendedStack(r);
    expect(s.tanks.map((t) => t.isNew)).toEqual([false, true]);
    expect(s.stored).toBe(4000);
    expect(s.overflow).toBeCloseTo(r.net.mid - 4000, 6);
  });
});

describe("overview gauges", () => {
  it("reads the engine result: a full tank, the share kept, and what a well could take", () => {
    const r = calculate({ areaM2: 250, rainMm: 175 });
    const [tank, kept, well] = overviewGauges(r);
    expect(tank.value).toBe(1);
    expect(tank.meaning).toBe("Your 2,000 L tank fills to the top in this storm.");
    expect(kept.value).toBeCloseTo(r.split.tank / r.gross, 6);
    expect(well.hypothetical).toBe(true);
    expect(well.label).toBe("With a recharge well");
    expect(well.litres).toBeCloseTo(r.net.mid - r.split.tank, 6);
  });

  it("counts the well's share as kept once there is a well", () => {
    const r = calculate({ areaM2: 250, rainMm: 175, hasRecharge: true });
    const [, kept, well] = overviewGauges(r);
    expect(kept.value).toBeCloseTo((r.split.tank + r.split.rechargePotential) / r.gross, 6);
    expect(well.hypothetical).toBe(false);
    expect(well.meaning).toContain("Potential only");
  });

  it("shows a part-full tank for a small storm, and no tank at all", () => {
    const small = calculate({ areaM2: 100, rainMm: 10 });
    expect(overviewGauges(small)[0].meaning).toMatch(/ends this storm \d+% full/);
    const none = calculate({ areaM2: 100, rainMm: 50, tankLitres: 0 });
    expect(overviewGauges(none)[0]).toMatchObject({ value: 0, meaning: "No tank is set up, so nothing is stored." });
  });

  it("keeps every gauge between 0 and 1", () => {
    for (const mm of [0, 5, 50, 500]) {
      for (const g of overviewGauges(calculate({ areaM2: 250, rainMm: mm }))) {
        expect(g.value).toBeGreaterThanOrEqual(0);
        expect(g.value).toBeLessThanOrEqual(1);
      }
    }
  });
});
