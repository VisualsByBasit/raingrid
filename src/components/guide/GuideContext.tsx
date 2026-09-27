"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Whether the inline "?" explanations are shown. Remembered per browser.

const GUIDE_KEY = "rg-guide";
const TOUR_KEY = "rg-tour-seen";

export function readFlag(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeFlag(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the flag just isn't remembered.
  }
}

export const tourSeen = () => readFlag(TOUR_KEY) === "1";
export const markTourSeen = () => writeFlag(TOUR_KEY, "1");

const GuideContext = createContext<{ on: boolean; setOn: (v: boolean) => void }>({ on: true, setOn: () => {} });

export function GuideProvider({ children }: { children: ReactNode }) {
  const [on, setOnState] = useState(() => readFlag(GUIDE_KEY) !== "off");
  const setOn = (v: boolean) => {
    setOnState(v);
    writeFlag(GUIDE_KEY, v ? "on" : "off");
  };
  return <GuideContext.Provider value={{ on, setOn }}>{children}</GuideContext.Provider>;
}

export const useGuide = () => useContext(GuideContext);

// "Guide" switch for the panel: shows or hides every inline "?".
export function GuideToggle() {
  const { on, setOn } = useGuide();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn(!on)}
      className="flex items-center gap-2 rounded-full text-xs text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tank-deep"
    >
      Guide
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full border border-line transition-colors ${on ? "btn-primary" : "bg-panel"}`}>
        <span className={`absolute left-0.5 h-4 w-4 rounded-full bg-panel shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}
