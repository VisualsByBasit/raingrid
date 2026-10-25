import { describe, expect, it } from "vitest";
import { defaultPins } from "./roof";

describe("roof check pins", () => {
  it("starts the tank west of the outline and the downpipe on its first corner", () => {
    const geometry = {
      type: "Polygon" as const,
      coordinates: [
        [
          [73.0501, 33.7001],
          [73.0499, 33.7001],
          [73.0499, 33.6999],
          [73.0501, 33.6999],
          [73.0501, 33.7001],
        ],
      ],
    };
    const pins = defaultPins({ lat: 33.7, lng: 73.05, geometry });
    expect(pins.downpipe).toEqual({ lat: 33.7001, lng: 73.0501 });
    expect(pins.tank.lat).toBe(33.7);
    expect(pins.tank.lng).toBeCloseTo(73.04987, 6);
  });

  it("offsets from the centre when the roof has no outline", () => {
    const pins = defaultPins({ lat: 33.7, lng: 73.05 });
    expect(pins.tank.lng).toBeLessThan(73.05);
    expect(pins.downpipe.lat).toBeGreaterThan(33.7);
  });
});
