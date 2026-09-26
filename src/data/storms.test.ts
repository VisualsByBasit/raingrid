import { describe, expect, it } from "vitest";
import { ANNUAL_NORMAL_MM, MONTHLY_NORMALS, MONSOON_NORMAL_MM, NORMALS_SOURCE } from "./storms";

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
