import { describe, expect, it } from "vitest";
import { isInAuthorizedCity } from "../config/city";
import { ALL_SECTORS } from "../data/sectors";
import { SHARE_LIMITS, choiceFromKey, decodeShare, shareQuery } from "./share";

describe("shared links", () => {
  it("clamps custom rainfall to the engine limit", () => {
    expect(choiceFromKey("mm:999999")).toEqual({ kind: "custom", mm: SHARE_LIMITS.rainMm });
    expect(choiceFromKey("mm:-1")).toBeNull();
    expect(choiceFromKey("mm:not-a-number")).toBeNull();
  });

  it("rejects roofs outside the city or above the supported area", () => {
    const decoded = decodeShare("?r=33.70,73.05,250;0,0,250;33.70,73.05,100001");
    expect(decoded.roofs).toHaveLength(1);
    expect(decoded.roofs[0].areaM2).toBe(250);
    expect(decoded.outOfRange).toBe(true);
  });

  it("rejects Rawalpindi roofs as outside the authorised Islamabad range", () => {
    const decoded = decodeShare("?r=33.6262,73.0710,250");
    expect(decoded.roofs).toHaveLength(0);
    expect(decoded.outOfRange).toBe(true);
  });

  it("keeps every searchable Islamabad sector inside the authorised range", () => {
    expect(ALL_SECTORS.every(({ lat, lng }) => isInAuthorizedCity(lat, lng))).toBe(true);
  });

  it("carries which roofs have a plan, and reads old links as unplanned", () => {
    const roofs = [
      { id: "a", label: "Your roof", lat: 33.7, lng: 73.05, areaM2: 250, source: "map" as const, planned: true },
      { id: "b", label: "Neighbour 1", lat: 33.701, lng: 73.051, areaM2: 180.4, source: "map" as const },
    ];
    const q = shareQuery(roofs, "2025-07-21");
    expect(new URLSearchParams(q).get("r")).toBe("33.70000,73.05000,250,1;33.70100,73.05100,180");
    expect(q).toBe("s=2025-07-21&r=33.70000,73.05000,250,1;33.70100,73.05100,180");
    expect(decodeShare(`?${q}`).roofs.map((r) => r.planned)).toEqual([true, false]);
    expect(decodeShare("?r=33.70,73.05,250").roofs[0].planned).toBe(false);
  });

  it("limits shared streets to 12 roofs", () => {
    const roofs = Array.from({ length: 20 }, (_, i) => `33.70,73.05,${100 + i}`).join(";");
    expect(decodeShare(`?r=${roofs}`).roofs).toHaveLength(SHARE_LIMITS.roofs);
  });
});
