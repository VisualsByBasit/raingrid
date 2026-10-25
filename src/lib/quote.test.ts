import { describe, expect, it } from "vitest";
import { buildQuote, instalments, roundHundred } from "./quote";

describe("quote", () => {
  it("prices Basic from the gutter kit, pipe and one day of labour", () => {
    const q = buildQuote("basic", null);
    expect(q.lines.map((l) => l.part)).toEqual(["gutterKit", "pipe", "plumber", "helper"]);
    // 10,000 + 20 ft × 482.4 + 2,800 + 1,538 = 23,986 -> 24,000
    expect(q.lowRs).toBe(24_000);
    // 30,000 + 40 ft × 482.4 + 3,800 + 1,538 = 54,634 -> 54,600
    expect(q.highRs).toBe(54_600);
  });

  it("prices Standard with the recommended tank size and count", () => {
    const one = buildQuote("standard", { size: 2000, count: 1 });
    const two = buildQuote("standard", { size: 2000, count: 2 });
    const tankLine = two.lines.find((l) => l.part === "tank2000")!;
    expect(tankLine.label).toBe("2 × 2,000 L tank");
    expect(tankLine.lowRs).toBe(52_000);
    expect(tankLine.highRs).toBe(93_000);
    expect(two.lowRs - one.lowRs).toBe(26_000);
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
