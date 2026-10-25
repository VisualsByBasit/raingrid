"use client";

import { useEffect, useState } from "react";
import { WEATHER_SOURCE, WEATHER_URL, chanceWord, parseWeather, type Weather } from "@/lib/weather";

// Islamabad right now and the next 24 h rain chance, from Open-Meteo.
// Hidden while loading and on any error. Cached for 30 minutes per tab.
// "card": the phone card under the hero search. "compact": one line, desktop.

const CACHE_KEY = "rg-weather";
const CACHE_MS = 30 * 60 * 1000;

function readCache(): Weather | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, w } = JSON.parse(raw) as { at: number; w: Weather };
    return Date.now() - at < CACHE_MS ? w : null;
  } catch {
    return null;
  }
}

function writeCache(w: Weather) {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), w }));
  } catch {
    // Storage blocked: fetch again next time.
  }
}

function useWeather(): Weather | null {
  const [w, setW] = useState<Weather | null>(readCache);
  useEffect(() => {
    if (w) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 6000);
    fetch(WEATHER_URL, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const parsed = parseWeather(json);
        if (parsed) {
          writeCache(parsed);
          setW(parsed);
        }
      })
      .catch(() => {
        // Offline, blocked or slow: the card stays hidden.
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [w]);
  return w;
}

function Glyph({ icon }: { icon: Weather["icon"] }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const cloud = "M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z";
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
      {icon === "sun" && (
        <>
          <circle {...p} cx="12" cy="12" r="4" />
          <path {...p} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </>
      )}
      {icon === "cloud" && <path {...p} d={cloud} />}
      {icon === "fog" && <path {...p} d="M4 9h16M6 13h12M4 17h16" />}
      {icon === "snow" && <path {...p} d={`${cloud} M9 21h.01M13 21h.01`} />}
      {icon === "rain" && <path {...p} d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15zM9 18l-1 3M13 18l-1 3M17 18l-1 3" />}
      {icon === "storm" && <path {...p} d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15zM12 15l-2 4h3l-2 3" />}
    </svg>
  );
}

const Credit = () => (
  <a href={WEATHER_SOURCE.url} target="_blank" rel="noreferrer" className="whitespace-nowrap underline decoration-white/30 underline-offset-2 hover:text-glacier">
    Data: {WEATHER_SOURCE.label}
  </a>
);

export default function WeatherCard({ variant, className = "" }: { variant: "card" | "compact"; className?: string }) {
  const w = useWeather();
  if (!w) return null;
  const chance = `${w.rainChance24h}%`;

  if (variant === "compact") {
    return (
      <p className={`glass-dark inline-flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3.5 text-xs text-glacier ${className}`}>
        <Glyph icon={w.icon} />
        <span>
          Islamabad now <span className="num">{w.tempC}°C</span>, {w.label.toLowerCase()} · next 24 h rain chance{" "}
          <span className="num text-rain">{chance}</span>
        </span>
        <span className="text-cloud">
          · <Credit />
        </span>
      </p>
    );
  }

  return (
    <div className={`glass-dark rounded-2xl px-4 py-3 text-glacier ${className}`} role="status" aria-label="Islamabad weather">
      <div className="flex items-center gap-3">
        <Glyph icon={w.icon} />
        <p className="flex-1 text-sm">
          <span className="font-semibold">Islamabad now:</span> <span className="num">{w.tempC}°C</span>, {w.label.toLowerCase()}
        </p>
        <span className="num text-lg font-semibold text-rain">{chance}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-xs text-cloud">
        <span>{chanceWord(w.rainChance24h)} in the next 24 h</span>
        <Credit />
      </div>
    </div>
  );
}
