import { describe, expect, it } from "vitest";
import { SERVICE_MARGIN } from "../config/packages";
import { buildQuote, instalments, roundHundred } from "./quote";

describe("quote", () => {
  it("prices Basic from the gutter kit, pipe and one day of labour, plus the service margin", () => {
    const q = buildQuote("basic", null);
    expect(q.lines.map((l) => l.part)).toEqual(["gutterKit", "pipe", "plumber", "helper", "service"]);
    // 10,000 + 20 ft × 482.4 + 2,800 + 1,538 = 23,986; × 1.15 = 27,583.9 -> 27,600
    expect(q.lowRs).toBe(27_600);
    // 30,000 + 40 ft × 482.4 + 3,800 + 1,538 = 54,634; × 1.15 = 62,829.1 -> 62,800
    expect(q.highRs).toBe(62_800);
  });

  it("adds the RainGrid service as its own line, 15% of parts and labour", () => {
    expect(SERVICE_MARGIN).toBe(0.15);
    const q = buildQuote("standard", { size: 2000, count: 1 });
    const service = q.lines.find((l) => l.part === "service")!;
    expect(service.label).toBe("RainGrid service: vetting, quality check and aftercare (15%)");
    expect(service.label).not.toMatch(/warranty/i);
    expect(service.estimate).toBe(false);
    const parts = q.lines.filter((l) => l.part !== "service");
    expect(service.lowRs).toBeCloseTo(parts.reduce((s, l) => s + l.lowRs, 0) * 0.15, 6);
    expect(service.highRs).toBeCloseTo(parts.reduce((s, l) => s + l.highRs, 0) * 0.15, 6);
  });

  it("prices the one-tank packages for the pitch deck", () => {
    const tank = { size: 2000 as const, count: 1 };
    // 49,986 to 106,472 before the margin.
    expect(buildQuote("standard", tank)).toMatchObject({ lowRs: 57_500, highRs: 122_400 });
    // 74,236 to 126,384 before the margin.
    expect(buildQuote("plus", tank)).toMatchObject({ lowRs: 85_400, highRs: 145_300 });
    expect(instalments(buildQuote("basic", null), 12)).toEqual({ months: 12, lowRs: 2_300, highRs: 5_200 });
    expect(instalments(buildQuote("standard", tank), 12)).toEqual({ months: 12, lowRs: 4_800, highRs: 10_200 });
    expect(instalments(buildQuote("plus", tank), 12)).toEqual({ months: 12, lowRs: 7_100, highRs: 12_100 });
  });

  it("prices Standard with the recommended tank size and count", () => {
    const one = buildQuote("standard", { size: 2000, count: 1 });
    const two = buildQuote("standard", { size: 2000, count: 2 });
    const tankLine = two.lines.find((l) => l.part === "tank2000")!;
    expect(tankLine.label).toBe("2 × 2,000 L tank");
    expect(tankLine.lowRs).toBe(52_000);
    expect(tankLine.highRs).toBe(93_000);
    // One more 26,000 tank, plus 15%: 29,900.
    expect(two.lowRs - one.lowRs).toBe(29_900);
    const small = buildQuote("standard", { size: 1000, count: 1 });
    expect(small.lines.some((l) => l.part === "tank1000")).toBe(true);
  });

  it("adds the UV filter for Plus", () => {
    const plus = buildQuote("plus", { size: 2000, count: 1 });
    expect(plus.lines.find((l) => l.part === "uvFilter")?.lowRs).toBe(17_500);
    expect(plus.lowRs).toBeGreaterThan(buildQuote("standard", { size: 2000, count: 1 }).lowRs);
  });

  it("flags pipe and labour lines as estimates, and the sourced tank as not", () => {
    const q = buildQuote("standard", { size: 2000, count: 1 });
    expect(q.lines.find((l) => l.part === "pipe")?.estimate).toBe(true);
    expect(q.lines.find((l) => l.part === "plumber")?.estimate).toBe(true);
    expect(q.lines.find((l) => l.part === "tank2000")?.estimate).toBe(false);
    expect(q.lines.find((l) => l.part === "gutterKit")?.estimate).toBe(true);
  });

  it("leaves the recharge well to the site visit", () => {
    expect(buildQuote("standard", null, { recharge: true }).onSiteVisit).toEqual(["Recharge well"]);
    expect(buildQuote("standard", null).onSiteVisit).toEqual([]);
  });

  it("splits the range into indicative instalments", () => {
    expect(instalments({ lowRs: 60_000, highRs: 120_000 }, 6)).toEqual({ months: 6, lowRs: 10_000, highRs: 20_000 });
    expect(instalments({ lowRs: 60_000, highRs: 120_000 }, 12)).toEqual({ months: 12, lowRs: 5_000, highRs: 10_000 });
    expect(roundHundred(4_349)).toBe(4_300);
  });
});
