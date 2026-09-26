"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { CITY } from "@/config/city";
import { searchSectors, type Sector } from "@/data/sectors";

export default function Intro({
  onStart,
  onSector,
  onSources,
}: {
  onStart: () => void;
  onSector: (s: Sector) => void;
  onSources: () => void;
}) {
  const [q, setQ] = useState("");
  const hits = searchSectors(q, 5);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      className="absolute inset-0 z-30 overflow-y-auto bg-gradient-to-b from-ink/70 via-ink/85 to-ink"
    >
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 px-5 py-16">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs uppercase tracking-[0.35em] text-tank"
        >
          {"RAIN//GRID · Islamabad"}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }}
          className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl"
        >
          On 21 July 2025, <span className="text-tank tabular-nums">175&nbsp;mm</span> of rain fell near H-8.
          <br />
          <span className="text-muted">Where did your roof&apos;s share go?</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.25 } }}
          className="max-w-xl text-base text-muted md:text-lg"
        >
          Pick your roof, replay a real recorded storm, and follow every litre: into a tank, into the ground, or into the
          nullah. Then bring your street.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.35 } }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hits[0]) onSector(hits[0]);
              }}
              placeholder="Your sector, e.g. F-10"
              aria-label="Your sector"
              className="glass w-full rounded-xl px-4 py-3 text-base outline-none placeholder:text-muted focus:border-tank"
            />
            {q && hits.length > 0 && (
              <ul className="glass absolute z-10 mt-1 w-full overflow-hidden rounded-xl">
                {hits.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => onSector(s)} className="w-full px-4 py-2.5 text-left hover:bg-white/5">
                      {s.id} <span className="text-muted">Islamabad</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => (hits[0] ? onSector(hits[0]) : onStart())}
            className="rounded-xl bg-tank px-6 py-3 font-semibold text-ink transition hover:brightness-110"
          >
            Find my roof
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.5 } }}
          className="grid gap-3 md:grid-cols-3"
        >
          {CITY.facts.map((f) => (
            <a
              key={f.stat}
              href={f.source.url}
              target="_blank"
              rel="noreferrer"
              className="glass group rounded-xl p-4 transition hover:border-tank/50"
            >
              <div className="num text-2xl font-semibold text-fg">{f.stat}</div>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
              <p className="mt-2 text-[11px] text-muted/70 group-hover:text-tank">Source: {f.source.label} ↗</p>
            </a>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.6 } }}
          className="text-sm text-muted"
        >
          {CITY.whyNow.text}{" "}
          <a className="underline decoration-line underline-offset-4 hover:text-tank" href={CITY.whyNow.source.url} target="_blank" rel="noreferrer">
            {CITY.whyNow.source.label} ↗
          </a>
          <br />
          <button onClick={onSources} className="mt-2 underline decoration-line underline-offset-4 hover:text-tank">
            How we calculate, and every source
          </button>
        </motion.p>
      </div>
    </motion.section>
  );
}
