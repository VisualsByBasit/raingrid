import { describe, expect, it } from "vitest";
import { aggregate, calculate, formatRange, mmToFillTank, roundL, roundSplitForDisplay } from "./index";

describe("rain engine", () => {
  it("1 mm on 1 m2 is exactly 1 litre gross", () => {
    const r = calculate({ areaM2: 1, rainMm: 1 });
    expect(r.gross).toBe(1);
  });

  it("matches the war-plan worked check (250 m2, 175 mm, full roof)", () => {
    const r = calculate({ areaM2: 250, rainMm: 175, usableShare: 1, firstFlushMm: 1.5 });
    expect(r.net.mid).toBeCloseTo(30362.5, 0);
    expect(r.split.tank).toBe(2000);
    expect(r.split.rechargePotential).toBe(0);
  });

  it("sends overflow to the ground only when a recharge well exists", () => {
    const r = calculate({ areaM2: 250, rainMm: 175, usableShare: 1, hasRecharge: true });
    expect(r.split.tank).toBe(2000);
    expect(r.split.rechargePotential).toBeCloseTo(30362.5 - 2000, 0);
  });

  it("conserves water: tank + ground + drain + lost = gross", () => {
    for (const hasRecharge of [true, false]) {
      const r = calculate({ areaM2: 180, rainMm: 60, usableShare: 0.85, tankLitres: 3000, hasRecharge });
      const sum = r.split.tank + r.split.rechargePotential + r.split.drain + r.split.lost;
      expect(sum).toBeCloseTo(r.gross, 6);
    }
  });

  it("a drizzle below first flush stores nothing", () => {
    const r = calculate({ areaM2: 200, rainMm: 1 });
    expect(r.net.mid).toBe(0);
    expect(r.split.tank).toBe(0);
  });

  it("zero and silly inputs never produce NaN or negatives", () => {
    for (const input of [
      { areaM2: 0, rainMm: 0 },
      { areaM2: -50, rainMm: 100 },
      { areaM2: Number.NaN, rainMm: 5000 },
      { areaM2: 100, rainMm: 100, tankLitres: -1 },
    ]) {
      const r = calculate(input);
      for (const v of [r.gross, r.net.low, r.net.mid, r.net.high, ...Object.values(r.split)]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("low <= mid <= high", () => {
    const r = calculate({ areaM2: 300, rainMm: 40, roofType: "metal" });
    expect(r.net.low).toBeLessThanOrEqual(r.net.mid);
    expect(r.net.mid).toBeLessThanOrEqual(r.net.high);
  });

  it("rounds to the nearest 100 L and formats ranges", () => {
    expect(roundL(34_712)).toBe(34_700);
    expect(roundL(0)).toBe(0);
    expect(formatRange(32_540, 39_050)).toBe("32,500 to 39,100 L");
  });

  it("rounds displayed split parts to the displayed gross total", () => {
    const r = calculate({ areaM2: 250, rainMm: 157 });
    const split = roundSplitForDisplay(r.split, r.gross);
    expect(Object.values(split).reduce((sum, value) => sum + value, 0)).toBe(roundL(r.gross));
  });

  it("aggregates a street", () => {
    const a = calculate({ areaM2: 200, rainMm: 100 });
    const b = calculate({ areaM2: 150, rainMm: 100 });
    const s = aggregate([a, b]);
    expect(s.gross).toBe(35_000);
    expect(s.tank).toBe(4000);
  });
});

describe("tank fill", () => {
  it("a 2,000 L tank on a 250 m2 roof fills after about 12.9 mm", () => {
    // 2000 / (250 * 1 * 0.7) = 11.43 mm, plus 1.5 mm first flush
    expect(mmToFillTank({ areaM2: 250, rainMm: 0, usableShare: 1 })).toBeCloseTo(2000 / 175 + 1.5, 5);
  });
  it("zero area never fills", () => {
    expect(mmToFillTank({ areaM2: 0, rainMm: 0 })).toBe(Number.POSITIVE_INFINITY);
  });
  it("a zero-capacity tank is full from 0 mm", () => {
    expect(mmToFillTank({ areaM2: 250, rainMm: 0, tankLitres: 0 })).toBe(0);
  });
});
