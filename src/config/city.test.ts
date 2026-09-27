import { describe, expect, it } from "vitest";
import { OUT_OF_AUTHORIZED_RANGE, isInAuthorizedCity } from "./city";

describe("authorised Islamabad range", () => {
  it("includes I-10", () => {
    expect(isInAuthorizedCity(33.646, 73.035)).toBe(true);
  });

  it("excludes Pirwadhai, Rawalpindi", () => {
    expect(isInAuthorizedCity(33.6388, 73.0437)).toBe(false);
  });

  it("uses a plain out-of-range message", () => {
    expect(OUT_OF_AUTHORIZED_RANGE).toBe("This RAIN//GRID build covers Islamabad only.");
  });
});
