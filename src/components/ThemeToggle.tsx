"use client";

import { setTheme, useTheme } from "@/lib/theme";

// Sun / moon switch. `tone="dark"` for the cinematic hero, where the button
// sits on the dark plate in either theme.
export default function ThemeToggle({ tone = "app", className = "" }: { tone?: "app" | "dark"; className?: string }) {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`grid h-9 w-9 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tank ${
        tone === "dark" ? "glass-dark text-glacier hover:bg-white/20" : "glass text-tank-deep hover:bg-panel"
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        {theme === "dark" ? (
          // In dark: show the sun (switch to light).
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        )}
      </svg>
    </button>
  );
}
