"use client";

// Light / dark theme in the browser. The choice lives on <html data-theme>
// and, once the user picks one, in localStorage; until then the system
// preference wins. THEME_SCRIPT (theme-script.ts) applies it before first
// paint; every storage access is wrapped in try/catch.

import { useSyncExternalStore } from "react";
import { THEME_KEY, isTheme, resolveTheme, type Theme } from "./theme-script";

export { THEME_KEY, THEME_SCRIPT, isTheme, resolveTheme, type Theme } from "./theme-script";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return isTheme(attr) ? attr : resolveTheme(readStored(), systemDark());
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

// Follow <html data-theme> (set by the toggle) and, while the user hasn't
// chosen, the system preference.
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (!isTheme(readStored())) document.documentElement.setAttribute("data-theme", systemDark() ? "dark" : "light");
  };
  mq.addEventListener("change", onSystem);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", onSystem);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}
