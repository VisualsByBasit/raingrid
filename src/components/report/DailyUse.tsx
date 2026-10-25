"use client";

import { ESTIMATE_LABEL } from "@/config/packages";
import { DEFAULT_DAILY_USE } from "@/lib/season";

// How much water the household takes from the tank each day. It decides
// how often the tank has room to catch more, so the Season and Money tabs
// share it. The default is an estimate and says so.
export default function DailyUse({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="block rounded-xl border border-line p-3">
      <span className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-fg">Water you use from the tank each day</span>
        <span className="num text-sm font-semibold text-fg">{value.toLocaleString("en-US")} L</span>
      </span>
      <input
        type="range"
        min={100}
        max={2000}
        step={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${value} litres a day`}
        className="mt-2 w-full"
      />
      <span className="block text-[11px] text-muted">
        Toilets, washing, cleaning and the garden. The default, {DEFAULT_DAILY_USE} L a day, is an {ESTIMATE_LABEL}; change it to
        match your home.
      </span>
    </label>
  );
}
