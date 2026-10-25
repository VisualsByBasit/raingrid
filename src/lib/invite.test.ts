import { describe, expect, it } from "vitest";
import { inviteMessage, streetProgress, whatsappShareUrl } from "./invite";

describe("street invite", () => {
  it("counts roofs with a plan", () => {
    expect(streetProgress([{ planned: true }, {}, { planned: false }, { planned: true }])).toEqual({ planned: 2, total: 4 });
    expect(streetProgress([])).toEqual({ planned: 0, total: 0 });
  });

  it("writes the message with progress, litres and the link", () => {
    const text = inviteMessage({ progress: { planned: 2, total: 3 }, storedLitres: 6000, link: "https://example.test/?r=1" });
    expect(text).toBe(
      [
        "Our street is making a rain plan with RAIN//GRID.",
        "2 of 3 roofs have a plan so far.",
        "Together our tanks could store about 6,000 L from one storm.",
        "Add your roof and replay a real storm on it:",
        "https://example.test/?r=1",
      ].join("\n"),
    );
  });

  it("uses the singular for one roof and skips zero litres", () => {
    const text = inviteMessage({ progress: { planned: 1, total: 1 }, storedLitres: 0, link: "L" });
    expect(text).toContain("1 of 1 roof has a plan so far.");
    expect(text).not.toContain("Together");
  });

  it("builds a wa.me link with no phone number", () => {
    expect(whatsappShareUrl("a b\nc")).toBe("https://wa.me/?text=a%20b%0Ac");
  });
});
