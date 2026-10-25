import { describe, expect, it } from "vitest";
import { defaultTank, LARGE_ROOF_M2, MAX_TANKS, recommend } from "./recommend";

describe("default tank", () => {
  it("is one 2,000 L tank, two on roofs over 400 m²", () => {
    expect(LARGE_ROOF_M2).toBe(400);
    expect(defaultTank(120)).toEqual({ size: 2000, count: 1 });
    expect(defaultTank(400)).toEqual({ size: 2000, count: 1 });
    expect(defaultTank(401)).toEqual({ size: 2000, count: 2 });
  });
});

describe("package recommendation", () => {
  it("recommends Basic when the current tank already holds the storm", () => {
    const r = recommend({ areaM2: 100, stormLitres: 1500, tankFills: 0.75 });
    expect(r.package).toBe("basic");
    expect(r.tank).toBeNull();
    expect(r.overflowLitres).toBe(0);
    expect(r.suggestRecharge).toBe(false);
  });

  it("recommends Basic when the shortfall is too small for a new tank", () => {
    expect(recommend({ areaM2: 20, stormLitres: 2300, tankFills: 1.15 }).package).toBe("basic");
    const r = recommend({ areaM2: 20, stormLitres: 300, tankFills: 0 });
    expect(r.package).toBe("basic");
    expect(r.tank).toBeNull();
    expect(r.extraTanksUseful).toBe(0);
  });

  it("does not size tanks on the storm: one 2,000 L tank, whatever the storm", () => {
    const small = recommend({ areaM2: 200, stormLitres: 3500, tankFills: 1.75 });
    expect(small.package).toBe("standard");
    expect(small.tank).toEqual({ size: 2000, count: 1 });
    expect(small.newStorageLitres).toBe(2000);
    expect(small.overflowLitres).toBe(0);
    expect(small.suggestRecharge).toBe(false);
    // The record storm on a 250 m² roof still gets one tank, not three.
    expect(recommend({ areaM2: 250, stormLitres: 26_000, tankFills: 13 }).tank).toEqual({ size: 2000, count: 1 });
  });

  it("gives large roofs two tanks", () => {
    const r = recommend({ areaM2: 450, stormLitres: 40_000, tankFills: 20 });
    expect(r.tank).toEqual({ size: 2000, count: 2 });
    expect(r.reasons.join(" ")).toContain("2 × 2,000 L tanks for a roof this size");
  });

  it("makes the overflow the reason for a recharge well", () => {
    const r = recommend({ areaM2: 250, stormLitres: 26_000, tankFills: 13 });
    // 26,000 - 2,000 (current tank) - 2,000 (new) = 22,000 L
    expect(r.overflowLitres).toBe(22_000);
    expect(r.suggestRecharge).toBe(true);
    expect(r.reasons.join(" ")).toContain("22,000 L still overflowed");
    // Little overflow: no well suggested.
    const little = recommend({ areaM2: 200, stormLitres: 4500, tankFills: 2.25 });
    expect(little.overflowLitres).toBe(500);
    expect(little.suggestRecharge).toBe(false);
  });

  it("offers extra tanks only as far as the overflow would fill them, within the cap", () => {
    expect(recommend({ areaM2: 250, stormLitres: 26_000, tankFills: 13 }).extraTanksUseful).toBe(MAX_TANKS - 1);
    expect(recommend({ areaM2: 450, stormLitres: 40_000, tankFills: 20 }).extraTanksUseful).toBe(MAX_TANKS - 2);
    expect(recommend({ areaM2: 200, stormLitres: 5000, tankFills: 2.5 }).extraTanksUseful).toBe(1);
    expect(recommend({ areaM2: 200, stormLitres: 3500, tankFills: 1.75 }).extraTanksUseful).toBe(0);
  });

  it("only recommends Plus for drinking water, always with a tank", () => {
    const r = recommend({ areaM2: 200, stormLitres: 3500, tankFills: 1.75, wantsDrinking: true });
    expect(r.package).toBe("plus");
    expect(r.tank).toEqual({ size: 2000, count: 1 });
    const small = recommend({ areaM2: 20, stormLitres: 300, tankFills: 0, wantsDrinking: true });
    expect(small.package).toBe("plus");
    expect(small.tank).toEqual({ size: 1000, count: 1 });
    expect(small.overflowLitres).toBe(0);
  });

  it("treats bad numbers as zero", () => {
    const r = recommend({ areaM2: Number.NaN, stormLitres: Number.NaN, tankFills: Number.NaN });
    expect(r.package).toBe("basic");
    expect(r.newStorageLitres).toBe(0);
  });
});
