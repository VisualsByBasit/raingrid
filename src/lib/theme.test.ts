import { describe, expect, it } from "vitest";
import { THEME_KEY, THEME_SCRIPT, isTheme, resolveTheme } from "./theme-script";

describe("theme", () => {
  it("uses a stored choice over the system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("falls back to the system preference without a valid stored choice", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme("purple", true)).toBe("dark");
  });

  it("only accepts light and dark", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("head script reads the same key and guards storage with try/catch", () => {
    expect(THEME_SCRIPT).toContain(JSON.stringify(THEME_KEY));
    expect(THEME_SCRIPT).toMatch(/try\{t=localStorage\.getItem/);
    expect(THEME_SCRIPT).toContain("prefers-color-scheme: dark");
  });
});
