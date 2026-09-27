import { describe, expect, it } from "vitest";
import { ANNUAL_NORMAL_MM, MONTHLY_NORMALS, MONSOON_NORMAL_MM, NORMALS_SOURCE, STORMS } from "./storms";

describe("Islamabad 1991–2020 rainfall normals", () => {
  it("contains a complete twelve-month series", () => {
    expect(MONTHLY_NORMALS).toHaveLength(12);
    expect(MONTHLY_NORMALS.map(({ month }) => month)).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
  });

  it("derives the annual and monsoon presets from the WMO monthly series", () => {
    expect(ANNUAL_NORMAL_MM).toBeCloseTo(1261.2, 5);
    expect(MONSOON_NORMAL_MM).toBeCloseTo(763, 5);
    expect(NORMALS_SOURCE.url).toContain("Islamabad_41571.csv");
  });
});

describe("sourced storm catalogue", () => {
  it("includes two Rawalpindi events with recorded gauge readings", () => {
    const july = STORMS.find(({ id }) => id === "2025-07-23-rawalpindi");
    const august = STORMS.find(({ id }) => id === "2026-08-19-rawalpindi");

    expect(july?.readings).toMatchObject({ katcheri: 88, chaklala: 38, shamsabad: 32 });
    expect(august?.readings).toMatchObject({ shamsabad: 98, newkatarian: 90, chaklala: 55 });
    expect(july?.source.url).toMatch(/^https:\/\//);
    expect(august?.source.url).toMatch(/^https:\/\//);
  });
});
