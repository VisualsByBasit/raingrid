import { describe, expect, it } from "vitest";
import { TANKER_PRESETS, TANKER_SIZE } from "../config/tankers";
import { loadsLabel, roundRs, tankerComparison, tankerLoads } from "./tanker";

describe("tanker comparison", () => {
  it("uses the assumed 1,000 gallon tanker", () => {
    expect(TANKER_SIZE.litres).toBe(4546);
    expect(tankerLoads(4546)).toBe(1);
    expect(tankerLoads(9092)).toBe(2);
  });

  it("returns zero loads for nothing or bad input", () => {
    expect(tankerLoads(0)).toBe(0);
    expect(tankerLoads(-5)).toBe(0);
    expect(tankerLoads(Number.NaN)).toBe(0);
    expect(tankerLoads(1000, 0)).toBe(0);
  });

  it("rounds rupees to 10 below Rs 1,000 and to 100 above", () => {
    expect(roundRs(274)).toBe(270);
    expect(roundRs(1649)).toBe(1600);
    expect(roundRs(0)).toBe(0);
  });

  it("labels loads with one decimal under 10", () => {
    expect(loadsLabel(0.33)).toBe("0.3");
    expect(loadsLabel(1.5)).toBe("1.5");
    expect(loadsLabel(12.4)).toBe("12");
  });

  it("prices one storm at both presets", () => {
    const c = tankerComparison(4546 * 2.5);
    expect(c.meaningful).toBe(true);
    expect(c.values.map((v) => v.rupees)).toEqual([1300, 7500]);
    expect(c.values.map((v) => v.preset.id)).toEqual(TANKER_PRESETS.map((p) => p.id));
  });

  it("is not meaningful under a twentieth of a load", () => {
    expect(tankerComparison(100).meaningful).toBe(false);
  });
});
