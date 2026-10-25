import { describe, expect, it } from "vitest";
import { PACKAGES, PARTS } from "../config/packages";
import { priceLabel, priceWithFlag } from "./price";

describe("part prices", () => {
  it("formats ranges, single prices and units", () => {
    expect(priceLabel(PARTS.tank2000.price)).toBe("Rs 26,000 to 46,500");
    expect(priceLabel(PARTS.tank1000.price)).toBe("Rs 15,500 to 27,500");
    expect(priceLabel(PARTS.uvFilter.price)).toBe("Rs 17,500");
    expect(priceLabel(PARTS.pipe.price)).toBe("Rs 482.4 per foot");
    expect(priceLabel(PARTS.plumber.price)).toBe("Rs 2,800 to 3,800 per day");
    expect(priceLabel(PARTS.helper.price)).toBe("Rs 1,538 per day");
  });

  it("prices the recharge well only on a site visit", () => {
    expect(priceLabel(PARTS.rechargeWell.price)).toBe("quote on site visit");
  });

  it("flags unsourced prices as estimates", () => {
    expect(priceWithFlag(PARTS.gutterKit.price)).toBe("Rs 10,000 to 30,000 (estimate, confirmed on site visit)");
    expect(priceWithFlag(PARTS.tank2000.price)).toBe("Rs 26,000 to 46,500");
  });

  it("gives every sourced price a source, and every part a price or a site-visit quote", () => {
    for (const part of Object.values(PARTS)) {
      if (part.price && !part.price.estimate) expect(part.price.source?.url).toMatch(/^https:\/\//);
      if (part.price) expect(part.price.lowRs).toBeLessThanOrEqual(part.price.highRs);
    }
  });

  it("only offers drinking water with Plus, and Plus includes the UV filter", () => {
    expect(Object.values(PACKAGES).filter((p) => p.drinking).map((p) => p.id)).toEqual(["plus"]);
    expect(PACKAGES.plus.parts).toContain("uvFilter");
    expect(PACKAGES.basic.parts).not.toContain("tank2000");
  });
});
