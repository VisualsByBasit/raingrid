// Server-safe theme pieces: the theme names, how a stored choice and the
// system preference resolve, and the inline <head> script that applies it
// before first paint (imported by app/layout.tsx, a Server Component).

export type Theme = "light" | "dark";
export const THEME_KEY = "rg-theme";

export function isTheme(v: unknown): v is Theme {
  return v === "light" || v === "dark";
}

// A stored choice beats the system preference.
export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  return isTheme(stored) ? stored : systemDark ? "dark" : "light";
}

// Inline, dependency-free copy of resolveTheme for <head>.
export const THEME_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)})()`;
