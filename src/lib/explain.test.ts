import { describe, expect, it } from "vitest";
import {
  LARGE_COMPLEX_M2,
  gaugeConfidence,
  gaugeConfidenceNote,
  depthCm,
  depthLine,
  isLargeComplex,
  largeComplexNotice,
  measuredAt,
  mmExplainer,
  roofDisplayLabel,
  tanksCount,
  fillsLine,
  keepLine,
} from "./explain";

describe("relatable maths", () => {
  it("counts tanks: whole numbers from 10 up, one decimal below", () => {
    expect(tanksCount(62_000, 2000)).toBe("31");
    expect(tanksCount(62_900, 2000)).toBe("31");
    expect(tanksCount(3000, 2000)).toBe("1.5");
    expect(tanksCount(2000, 2000)).toBe("1");
    expect(tanksCount(250_000, 2000)).toBe("125");
  });

  it("says how many times the water would fill your tank", () => {
    expect(fillsLine(26_000, 2000)).toBe("enough to fill your 2,000 L tank 13 times");
    expect(fillsLine(3000, 2000)).toBe("enough to fill your 2,000 L tank 1.5 times");
    expect(fillsLine(2000, 2000)).toBe("enough to fill your 2,000 L tank once");
    expect(fillsLine(800, 2000)).toBe("enough to fill 40% of your 2,000 L tank");
  });

  it("says what the tanks keep of the supply", () => {
    expect(keepLine(2000, 26_000, 2000, false)).toBe("Your tanks keep 2,000 L; the rest overflows.");
    expect(keepLine(2000, 26_000, 2000, true)).toBe("Your tanks keep 2,000 L; the rest overflows toward your recharge well.");
    expect(keepLine(1500, 1500, 2000, false)).toBe("Your tanks keep all of it.");
    expect(keepLine(0, 5000, 0, false)).toBe("No tank is set up, so it all overflows.");
  });

  it("has no fills line without a tank", () => {
    expect(fillsLine(62_000, 0)).toBeNull();
    expect(tanksCount(Number.NaN, 2000)).toBeNull();
  });

  it("turns mm of rain into cm of depth", () => {
    expect(depthCm(157)).toBe("15.7 cm");
    expect(depthCm(175)).toBe("17.5 cm");
    expect(depthCm(10)).toBe("1 cm");
    expect(depthCm(2)).toBe("0.2 cm");
    expect(depthCm(-5)).toBe("0 cm");
    expect(depthLine(157)).toBe("= water 15.7 cm deep across your roof");
  });

  it("explains mm in one sentence", () => {
    expect(mmExplainer(157)).toBe(
      "1 mm of rain = 1 litre on every square metre. 157 mm = water 15.7 cm deep across your whole roof.",
    );
  });

  it("names the gauge and distance plainly", () => {
    expect(measuredAt("Saidpur", 3.2)).toBe("measured at Saidpur gauge, 3 km from your roof");
    expect(measuredAt("PMD station", 0.4)).toBe("measured at PMD station, under 1 km from your roof");
  });
});

describe("large complex label", () => {
  it(`applies only to outlines over ${LARGE_COMPLEX_M2} m2`, () => {
    expect(isLargeComplex(LARGE_COMPLEX_M2, "map")).toBe(false);
    expect(isLargeComplex(LARGE_COMPLEX_M2 + 1, "map")).toBe(true);
    expect(isLargeComplex(72_148, "drawn")).toBe(true);
    expect(isLargeComplex(72_148, "typed")).toBe(false);
  });

  it("relabels your roof and notes it on neighbours", () => {
    expect(roofDisplayLabel("Your roof", 72_148, "map")).toBe("Large complex");
    expect(roofDisplayLabel("Your roof", 295, "map")).toBe("Your roof");
    expect(roofDisplayLabel("Neighbour 2", 9000, "map")).toBe("Neighbour 2 (large complex)");
    expect(roofDisplayLabel("Your roof", 9000, "typed")).toBe("Your roof");
  });

  it("states the area in the notice", () => {
    expect(largeComplexNotice(72_148.4)).toContain("(72,148 m²)");
  });
});

describe("gauge confidence", () => {
  it("is good under 3 km, fair from 3 to 8 km, low over 8 km", () => {
    expect(gaugeConfidence(0)).toBe("good");
    expect(gaugeConfidence(2.9)).toBe("good");
    expect(gaugeConfidence(3)).toBe("fair");
    expect(gaugeConfidence(8)).toBe("fair");
    expect(gaugeConfidence(8.1)).toBe("low");
  });

  it("explains that rain varies across sectors", () => {
    expect(gaugeConfidenceNote(5.4)).toMatch(/^The gauge is 5 km from your roof\. Rain varies across sectors/);
  });
});
