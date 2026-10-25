import { describe, expect, it } from "vitest";
import { aggregate, calculate, formatRange, mmToFillTank, roundL, roundSplitForDisplay, tankWhatIf } from "./index";

describe("rain engine", () => {
  it("1 mm on 1 m2 is exactly 1 litre gross", () => {
    const r = calculate({ areaM2: 1, rainMm: 1 });
    expect(r.gross).toBe(1);
  });

  it("matches the sourced-default worked check (250 m2, 175 mm, full roof)", () => {
    const r = calculate({ areaM2: 250, rainMm: 175, usableShare: 1, firstFlushMm: 0.5 });
    expect(r.net.mid).toBeCloseTo(30_537.5, 5);
    expect(roundL(r.net.mid)).toBe(30_500);
    expect(r.split.tank).toBe(2000);
    expect(r.split.rechargePotential).toBe(0);
  });

  it("routes overflow toward recharge only when a recharge well exists", () => {
    const r = calculate({ areaM2: 250, rainMm: 175, usableShare: 1, hasRecharge: true });
    expect(r.split.tank).toBe(2000);
    expect(r.split.rechargePotential).toBeCloseTo(30_537.5 - 2000, 5);
  });

  it("conserves water: tank + recharge potential + drain + lost = gross", () => {
    for (const hasRecharge of [true, false]) {
      const r = calculate({ areaM2: 180, rainMm: 60, usableShare: 0.85, tankLitres: 3000, hasRecharge });
      const sum = r.split.tank + r.split.rechargePotential + r.split.drain + r.split.lost;
      expect(sum).toBeCloseTo(r.gross, 6);
    }
  });

  it("a drizzle below first flush stores nothing", () => {
    const r = calculate({ areaM2: 200, rainMm: 0.2 });
    expect(r.net.mid).toBe(0);
    expect(r.split.tank).toBe(0);
  });

  it.each([0, 2, 700])("handles %s mm rainfall without violating conservation", (rainMm) => {
    const r = calculate({ areaM2: 250, rainMm });
    expect(r.split.tank + r.split.rechargePotential + r.split.drain + r.split.lost).toBeCloseTo(r.gross, 6);
    expect(Object.values(r.split).every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
  });

  it.each([20, 5000])("handles a %s m2 roof with a sane ordered range", (areaM2) => {
    const r = calculate({ areaM2, rainMm: 175 });
    expect(r.gross).toBe(areaM2 * 175);
    expect(r.net.low).toBeLessThanOrEqual(r.net.mid);
    expect(r.net.mid).toBeLessThanOrEqual(r.net.high);
    expect(r.split.tank + r.split.rechargePotential + r.split.drain + r.split.lost).toBeCloseTo(r.gross, 6);
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
  it("a 2,000 L tank on a 250 m2 roof fills after about 11.93 mm", () => {
    // 2000 / (250 * 1 * 0.7) + 0.5 mm first flush
    expect(mmToFillTank({ areaM2: 250, rainMm: 0, usableShare: 1 })).toBeCloseTo(11.928571, 5);
  });
  it("zero area never fills", () => {
    expect(mmToFillTank({ areaM2: 0, rainMm: 0 })).toBe(Number.POSITIVE_INFINITY);
  });
  it("a zero-capacity tank is full from 0 mm", () => {
    expect(mmToFillTank({ areaM2: 250, rainMm: 0, tankLitres: 0 })).toBe(0);
  });
});

describe("roof types", () => {
  it("other spans both cited ranges", () => {
    const other = calculate({ areaM2: 100, rainMm: 10.5, usableShare: 1, roofType: "other" });
    expect(other.net.low).toBeCloseTo(600);
    expect(other.net.mid).toBeCloseTo(750);
    expect(other.net.high).toBeCloseTo(900);
  });
});

describe("tank what-if", () => {
  it("shows what 1,000 L more or less changes when the tank overflows", () => {
    // 200 m2, 85% usable, 20.5 mm, RCC 0.7: 200 * 0.85 * 20 * 0.7 = 2,380 L net.
    const w = tankWhatIf({ areaM2: 200, rainMm: 20.5, tankLitres: 2000 });
    expect(w.biggerSize).toBe(3000);
    expect(w.smallerSize).toBe(1000);
    expect(w.biggerGain).toBeCloseTo(380);
    expect(w.smallerLoss).toBeCloseTo(1000);
  });

  it("gains nothing from a bigger tank when the storm already fits", () => {
    const w = tankWhatIf({ areaM2: 50, rainMm: 10.5, tankLitres: 2000 });
    expect(w.biggerGain).toBe(0);
  });

  it("never goes below an empty tank", () => {
    const w = tankWhatIf({ areaM2: 200, rainMm: 50, tankLitres: 500 });
    expect(w.smallerSize).toBe(0);
    expect(w.smallerLoss).toBeCloseTo(500);
  });
});
