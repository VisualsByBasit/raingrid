"use client";

import { motion } from "framer-motion";
import { CITY } from "@/config/city";
import { DEFAULTS, ROOF_TYPES } from "@/lib/engine";
import { GAUGES, PRESETS, STORMS } from "@/data/storms";

export default function SourcesDrawer({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex justify-end bg-black/50"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: 40 }}
        animate={{ x: 0 }}
        exit={{ x: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="glass h-full w-full max-w-md overflow-y-auto p-6 text-sm"
        role="dialog"
        aria-label="Assumptions and sources"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">How RAIN//GRID calculates</h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-muted hover:text-fg" aria-label="Close">
            ✕
          </button>
        </div>

        <p className="mt-4 text-muted">
          1 mm of rain on 1 m² of roof is exactly 1 litre. Everything else is an assumption, shown here so you can check it.
        </p>
        <pre className="num mt-3 overflow-x-auto rounded-lg border border-line bg-ink p-3 text-xs text-fg">
          {"harvest = roof area × usable share\n        × (rain − first flush)\n        × runoff coefficient"}
        </pre>

        <h3 className="mt-6 font-semibold">Assumptions</h3>
        <ul className="mt-2 space-y-1.5 text-muted">
          {Object.values(ROOF_TYPES).map((t) => (
            <li key={t.label}>
              {t.label}: runoff coefficient {t.mid} (range {t.low} to {t.high})
            </li>
          ))}
          <li>First flush diverted: {DEFAULTS.firstFlushMm} mm per storm (dirty first water, never stored)</li>
          <li>Usable roof share: {Math.round(DEFAULTS.usableShare * 100)}% by default (tanks, stairs, solar panels)</li>
          <li>Tank: {DEFAULTS.tankLitres.toLocaleString()} L by default. You can change it.</li>
          <li>Recharge assumes a well can take the overflow. Real capacity depends on your soil and needs a professional.</li>
          <li>Results are shown as ranges and rounded to the nearest 100 L.</li>
          <li>Harvested rainwater is for gardening, washing, flushing, cleaning and recharge. Not for drinking.</li>
        </ul>

        <h3 className="mt-6 font-semibold">Storms</h3>
        <ul className="mt-2 space-y-2 text-muted">
          {STORMS.map((s) => (
            <li key={s.id}>
              <span className="text-fg">{s.dateLabel}</span>:{" "}
              {Object.entries(s.readings)
                .map(([g, mm]) => `${GAUGES[g].name} ${mm} mm`)
                .join(", ")}
              .{" "}
              <a className="underline underline-offset-2 hover:text-tank" href={s.source.url} target="_blank" rel="noreferrer">
                {s.source.label} ↗
              </a>
            </li>
          ))}
          {PRESETS.map((p) => (
            <li key={p.id}>
              <span className="text-fg">{p.title}</span>: {p.mm} mm.{" "}
              <a className="underline underline-offset-2 hover:text-tank" href={p.source.url} target="_blank" rel="noreferrer">
                {p.source.label} ↗
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted/80">
          Your roof uses the nearest gauge that reported that storm. Gauge locations are approximate.
        </p>

        <h3 className="mt-6 font-semibold">City facts</h3>
        <ul className="mt-2 space-y-1.5 text-muted">
          {[...CITY.facts, { stat: "CDA", text: "Rooftop harvesting made mandatory, March 2026", source: CITY.whyNow.source }].map((f) => (
            <li key={f.stat}>
              <a className="underline underline-offset-2 hover:text-tank" href={f.source.url} target="_blank" rel="noreferrer">
                {f.source.label} ↗
              </a>{" "}
              {f.stat} {f.text}
            </li>
          ))}
        </ul>

        <h3 className="mt-6 font-semibold">Map and data credits</h3>
        <ul className="mt-2 space-y-1.5 text-muted">
          <li>
            Map tiles: <a className="underline" href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>, data ©{" "}
            <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
          </li>
          <li>Map engine: MapLibre GL JS. Geometry: Turf.js.</li>
          <li>Sector locations are approximate (within about 1 km).</li>
        </ul>

        <h3 className="mt-6 font-semibold">Honesty notes</h3>
        <p className="mt-2 text-muted">
          RAIN//GRID gives preliminary estimates, not engineering advice. Site-specific design, construction and any potable
          use need a qualified professional and local rules. We used AI tools to help build this app; every number comes
          from the formula above, never from AI.
        </p>
        <p className="mt-4 text-xs text-muted/70">Built for Banao Imaginathon 2026 by Mayaar OS.</p>
      </motion.aside>
    </motion.div>
  );
}
