"use client";

import { motion } from "framer-motion";
import { CITY } from "@/config/city";
import { DEFAULTS, ENGINE_SOURCES, ROOF_TYPES } from "@/lib/engine";
import { ANNUAL_NORMAL_MM, GAUGES, MONSOON_NORMAL_MM, MONTHLY_NORMALS, NORMALS_SOURCE, PRESETS, STORMS } from "@/data/storms";
import { FOOTAGE } from "./landing/footage";
import { TANKER_PRESETS, TANKER_SIZE } from "@/config/tankers";
import { ESTIMATE_LABEL, PARTS } from "@/config/packages";
import { priceLabel } from "@/lib/price";

const WETTEST_MONTH_MM = Math.max(...MONTHLY_NORMALS.map((m) => m.mm));

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
          <li>
            <a className="underline underline-offset-2 hover:text-tank" href={ENGINE_SOURCES.runoff.url} target="_blank" rel="noreferrer">
              Runoff source ↗
            </a>{" "}
            {ENGINE_SOURCES.runoff.note} &ldquo;Other or not sure&rdquo; has no separate cited value, so it spans both cited
            ranges and shows a wider result.
          </li>
          <li>
            First flush diverted: {DEFAULTS.firstFlushMm} mm per storm. {ENGINE_SOURCES.firstFlush.note}{" "}
            <a className="underline underline-offset-2 hover:text-tank" href={ENGINE_SOURCES.firstFlush.url} target="_blank" rel="noreferrer">
              National guideline ↗
            </a>
          </li>
          <li>
            Usable roof share: {Math.round(DEFAULTS.usableShare * 100)}% of the measured outline by default, because tanks, the stair
            room and parapets take up roof space. You can change it.
          </li>
          <li>Tank: {DEFAULTS.tankLitres.toLocaleString()} L by default. You can change it.</li>
          <li>“Routed toward recharge” is potential routing, never measured infiltration. Recharge suitability depends on soil and depth to groundwater, so it is checked on the site visit.</li>
          <li>Results are shown as ranges and rounded to the nearest 100 L.</li>
          <li>Harvested rainwater is for gardening, washing, flushing, cleaning and recharge. Not for drinking.</li>
        </ul>

        <h3 className="mt-6 font-semibold">Year view · 1991–2020 rainfall normal</h3>
        <div className="mt-3 grid h-32 grid-cols-12 items-end gap-1" aria-label="Monthly rainfall normals bar chart">
          {MONTHLY_NORMALS.map((month) => (
            <div key={month.month} className="flex h-full flex-col items-center justify-end gap-1" title={`${month.month}: ${month.mm} mm`}>
              <div className="w-full rounded-t bg-tank/70" style={{ height: `${Math.max(3, (month.mm / WETTEST_MONTH_MM) * 100)}%` }} />
              <span className="num text-[8px] text-muted">{month.month.slice(0, 1)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          July to September: {MONSOON_NORMAL_MM.toLocaleString("en-US", { minimumFractionDigits: 1 })} mm · annual:{" "}
          {ANNUAL_NORMAL_MM.toLocaleString("en-US", { minimumFractionDigits: 1 })} mm. Source:{" "}
          <a className="underline underline-offset-2 hover:text-tank" href={NORMALS_SOURCE.url} target="_blank" rel="noreferrer">
            {NORMALS_SOURCE.label} ↗
          </a>
        </p>

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
          Your roof uses the nearest gauge that reported that storm. Gauge locations are approximate. Rain varies across
          sectors, so each reading carries a match badge: under 3 km good, 3 to 8 km fair, over 8 km low. These bands are
          RAIN//GRID&apos;s own rule of thumb, not a published standard.
        </p>

        <h3 className="mt-6 font-semibold">Parts and prices</h3>
        <ul className="mt-2 space-y-1.5 text-muted">
          {Object.values(PARTS).map((part) => (
            <li key={part.id}>
              <span className="text-fg">{part.name}</span>: {priceLabel(part.price)}
              {part.price?.note ? ` (${part.price.note})` : ""}.{" "}
              {part.price?.source ? (
                <a className="underline underline-offset-2 hover:text-tank" href={part.price.source.url} target="_blank" rel="noreferrer">
                  {part.price.source.label} ↗
                </a>
              ) : part.price?.estimate ? (
                <span>No source: {ESTIMATE_LABEL}.</span>
              ) : null}
            </li>
          ))}
          <li>Pipe length and labour days in a quote are estimates, confirmed on site visit.</li>
        </ul>

        <h3 className="mt-6 font-semibold">Tanker comparison (estimate)</h3>
        <ul className="mt-2 space-y-1.5 text-muted">
          {TANKER_PRESETS.map((t) => (
            <li key={t.id}>
              {t.label}: Rs {t.priceRs.toLocaleString("en-US")}, {t.note}.{" "}
              <a className="underline underline-offset-2 hover:text-tank" href={t.source.url} target="_blank" rel="noreferrer">
                {t.source.label} ↗
              </a>
            </li>
          ))}
          <li>
            Tanker size: {TANKER_SIZE.label}, {TANKER_SIZE.note}. Neither source states a size. The comparison prices the water
            your tank kept from the chosen storm, and the middle harvest estimate if you had room for all of it.
          </li>
        </ul>

        <h3 className="mt-6 font-semibold">City facts</h3>
        <ul className="mt-2 space-y-1.5 text-muted">
          {[...CITY.facts, { stat: "CDA", text: "called for strict compliance with the existing requirement, March 2026", source: CITY.whyNow.source }].map((f) => (
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
          <li>
            Roof check satellite view:{" "}
            <a className="underline" href="https://s2maps.eu" target="_blank" rel="noreferrer">
              Sentinel-2 cloudless 2016
            </a>{" "}
            by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016),{" "}
            <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
              CC BY 4.0
            </a>
            . 10 m pixels, so it shows the area around a roof, not roof detail. Building heights in the roof check are
            OpenStreetMap values where mapped.
          </li>
          <li>
            Weather card:{" "}
            <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0). Context
            only; no RAIN//GRID number uses the forecast.
          </li>
          <li>Sector locations are approximate (within about 1 km).</li>
        </ul>

        <h3 className="mt-6 font-semibold">Footage</h3>
        <ul className="mt-2 space-y-1.5 text-muted">
          {FOOTAGE.map((c) =>
            c.note ? (
              <li key={c.file}>
                {c.use}: {c.note}.
              </li>
            ) : (
              <li key={c.file}>
                {c.use}: &ldquo;
                <a className="underline" href={c.url} target="_blank" rel="noreferrer">
                  {c.title}
                </a>
                &rdquo; from {c.source},{" "}
                <a className="underline" href={c.licenceUrl} target="_blank" rel="noreferrer">
                  {c.licence}
                </a>
              </li>
            ),
          )}
          <li>Logo generated with ChatGPT image generation, edited by Mayaar OS.</li>
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
