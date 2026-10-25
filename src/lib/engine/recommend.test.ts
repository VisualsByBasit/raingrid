import { describe, expect, it } from "vitest";
import { MAX_TANKS, recommend, tankFor } from "./recommend";

describe("tank size", () => {
  it("picks the smallest standard size that holds the storm", () => {
    expect(tankFor(600)).toEqual({ size: 1000, count: 1 });
    expect(tankFor(1000)).toEqual({ size: 1000, count: 1 });
    expect(tankFor(1001)).toEqual({ size: 2000, count: 1 });
    expect(tankFor(3500)).toEqual({ size: 2000, count: 2 });
  });

  it("never proposes more than the tank cap", () => {
    expect(tankFor(50_000)).toEqual({ size: 2000, count: MAX_TANKS });
  });
});

describe("package recommendation", () => {
  it("recommends Basic when the current tank already holds the storm", () => {
    const r = recommend({ areaM2: 100, stormLitres: 1500, tankFills: 0.75 });
    expect(r.package).toBe("basic");
    expect(r.tank).toBeNull();
    expect(r.suggestRecharge).toBe(false);
  });

  it("recommends Basic when the shortfall is too small for a new tank", () => {
    expect(recommend({ areaM2: 20, stormLitres: 2300, tankFills: 1.15 }).package).toBe("basic");
    const r = recommend({ areaM2: 20, stormLitres: 300, tankFills: 0 });
    expect(r.package).toBe("basic");
    expect(r.tank).toBeNull();
  });

  it("adds a tank sized for what the current tank can't hold", () => {
    // 3,500 L storm, 2,000 L tank (fills 1.75 times): 1,500 L short.
    const r = recommend({ areaM2: 200, stormLitres: 3500, tankFills: 1.75 });
    expect(r.package).toBe("standard");
    expect(r.tank).toEqual({ size: 2000, count: 1 });
    expect(r.newStorageLitres).toBe(2000);
    expect(r.suggestRecharge).toBe(false);
    // No tank at all: size for the whole storm.
    expect(recommend({ areaM2: 200, stormLitres: 3500, tankFills: 0 }).tank).toEqual({ size: 2000, count: 2 });
  });

  it("suggests a recharge well when the overflow is large", () => {
    const r = recommend({ areaM2: 250, stormLitres: 26_000, tankFills: 13 });
    expect(r.package).toBe("standard");
    expect(r.tank).toEqual({ size: 2000, count: 3 });
    expect(r.suggestRecharge).toBe(true);
    // 26,000 - 2,000 (current tank) - 6,000 (new) = 18,000 L
    expect(r.reasons.join(" ")).toContain("18,000 L would still overflow");
  });

  it("only recommends Plus for drinking water, always with a tank", () => {
    expect(recommend({ areaM2: 200, stormLitres: 3500, tankFills: 1.75, wantsDrinking: true }).package).toBe("plus");
    const small = recommend({ areaM2: 20, stormLitres: 300, tankFills: 0, wantsDrinking: true });
    expect(small.package).toBe("plus");
    expect(small.tank).toEqual({ size: 1000, count: 1 });
  });

  it("treats bad numbers as zero", () => {
    const r = recommend({ areaM2: 0, stormLitres: Number.NaN, tankFills: Number.NaN });
    expect(r.package).toBe("basic");
    expect(r.newStorageLitres).toBe(0);
  });
});
