import { describe, expect, it } from "vitest";
import { contactNumber, installerMessage, isPlausiblePhone, nearestSector, normalizeNumber, visitMessage, waLink } from "./whatsapp";

describe("contact number", () => {
  it("is demo mode (null) when unset or implausible", () => {
    expect(contactNumber(undefined)).toBeNull();
    expect(contactNumber("")).toBeNull();
    expect(contactNumber("12345")).toBeNull();
  });

  it("normalises Pakistani numbers to wa.me's international digits", () => {
    expect(normalizeNumber("+92 300 1234567")).toBe("923001234567");
    expect(normalizeNumber("0300-1234567")).toBe("923001234567");
    expect(normalizeNumber("0092 300 1234567")).toBe("923001234567");
  });

  it("builds wa.me links with and without a number", () => {
    expect(waLink("923001234567", "Hi there")).toBe("https://wa.me/923001234567?text=Hi%20there");
    expect(waLink(null, "Hi")).toBe("https://wa.me/?text=Hi");
  });

  it("accepts plausible callback numbers only", () => {
    expect(isPlausiblePhone("0300 1234567")).toBe(true);
    expect(isPlausiblePhone("051-1234567")).toBe(true);
    expect(isPlausiblePhone("123")).toBe(false);
  });
});

describe("messages", () => {
  const base = {
    name: " Ayesha ",
    phone: "0300 1234567",
    sector: "F-10",
    time: "Weekend morning",
    packageName: "Standard",
    notes: "",
    roofAreaM2: 248.6,
    quote: "Rs 102,000 to 199,500",
    recharge: true,
    shareLink: "https://raingridpk.vercel.app/?s=2025-07-21&r=33.70060,73.04960,249,1",
    pins: {},
  };

  it("writes the visit request with roof, quote and link", () => {
    expect(visitMessage(base)).toBe(
      [
        "RainGrid: free site visit request",
        "Name: Ayesha",
        "Phone: 0300 1234567",
        "Sector: F-10",
        "Preferred time: Weekend morning",
        "Package: Standard + recharge well (quote on site visit)",
        "Roof area: about 249 m² (confirmed on site)",
        "Quote shown: Rs 102,000 to 199,500 (indicative)",
        "Roof link: https://raingridpk.vercel.app/?s=2025-07-21&r=33.70060,73.04960,249,1",
      ].join("\n"),
    );
  });

  it("adds pins and notes when given", () => {
    const text = visitMessage({ ...base, notes: "Gate on the back street", pins: { tank: { lat: 33.7, lng: 73.0496 }, downpipe: null } });
    expect(text).toContain("Tank spot: 33.70000,73.04960 (https://maps.google.com/?q=33.70000,73.04960)");
    expect(text).not.toContain("Downpipe:");
    expect(text).toContain("Notes: Gate on the back street");
  });

  it("writes the installer application", () => {
    expect(installerMessage({ name: "Bilal", phone: "0311 7654321", trade: "Plumber", area: "G-11, G-10", experience: "5 to 10 years" })).toBe(
      ["RainGrid: installer application", "Name: Bilal", "Phone: 0311 7654321", "Trade: Plumber", "Area: G-11, G-10", "Experience: 5 to 10 years"].join("\n"),
    );
  });
});

describe("nearest sector", () => {
  it("finds the sector a roof sits in, and doesn't guess far away", () => {
    expect(nearestSector(33.6938, 73.0219)).toMatch(/^[A-Z]-\d+$/);
    expect(nearestSector(34.5, 74.5)).toBeNull();
  });
});
