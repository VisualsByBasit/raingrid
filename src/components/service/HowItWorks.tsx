"use client";

import { motion } from "framer-motion";

// "How RainGrid works": calculate, site visit, certified install, pay in
// instalments, yearly maintenance. "landing" is a full-width section;
// "compact" is a small numbered strip for the panel.
const STEPS = [
  { title: "Calculate", body: "Replay a real storm on your roof and get a package and price." },
  { title: "Site visit", body: "A free visit checks the roof, tank spot, drains and soil." },
  { title: "Certified install", body: "A trained, vetted installer fits it with food-grade parts." },
  { title: "Pay in instalments", body: "Spread the cost over 6 or 12 months via Zindigi (indicative)." },
  { title: "Yearly maintenance", body: "Tank clean, gutters, filter and a water test once a year." },
];

export default function HowItWorks({ variant }: { variant: "landing" | "compact" }) {
  if (variant === "compact") {
    return (
      <ol className="grid grid-cols-5 gap-1" aria-label="How RainGrid works">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col items-center text-center">
            <span className={`num grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${i === 0 ? "btn-primary" : "border border-tank/40 text-tank-deep"}`}>
              {i + 1}
            </span>
            <span className="mt-1 text-[10px] leading-tight text-muted">{s.title}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <section className="mx-auto max-w-5xl px-5 pt-20" aria-labelledby="how-raingrid-works">
      <p className="eyebrow text-tank-deep">RainGrid as a service</p>
      <h2 id="how-raingrid-works" className="mt-2 text-3xl font-semibold tracking-tight text-fg md:text-4xl">
        How RainGrid works
      </h2>
      <ol className="mt-8 grid gap-3 md:grid-cols-5">
        {STEPS.map((s, i) => (
          <motion.li
            key={s.title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="glass panel-sheen relative rounded-2xl p-4"
          >
            <span className="num text-sm font-semibold text-tank-deep">0{i + 1}</span>
            <p className="mt-1 font-semibold text-fg">{s.title}</p>
            <p className="mt-1 text-sm leading-snug text-muted">{s.body}</p>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-tank-deep md:block">
                →
              </span>
            )}
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
