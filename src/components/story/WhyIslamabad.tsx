"use client";

import { motion } from "framer-motion";
import { CITY } from "@/config/city";

export default function WhyIslamabad() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-20" aria-labelledby="why-islamabad">
      <h2 id="why-islamabad" className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">
        Why {CITY.name}
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {CITY.facts.map((f, i) => (
          <motion.a
            key={f.stat}
            href={f.source.url}
            target="_blank"
            rel="noreferrer"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="glass panel-sheen group flex flex-col rounded-2xl p-5 transition hover:border-tank"
          >
            <span className="num text-3xl font-semibold text-tank-deep">{f.stat}</span>
            <span className="mt-2 flex-1 text-sm leading-relaxed text-fg">{f.text}</span>
            <span className="mt-4 text-xs text-muted group-hover:text-tank-deep">Source: {f.source.label} ↗</span>
          </motion.a>
        ))}
      </div>
      <p className="mt-8 max-w-3xl text-base leading-relaxed text-fg">
        {CITY.whyNow.text}{" "}
        <a
          className="text-tank-deep underline decoration-tank/40 underline-offset-4 hover:decoration-tank-deep"
          href={CITY.whyNow.source.url}
          target="_blank"
          rel="noreferrer"
        >
          Source: {CITY.whyNow.source.label} ↗
        </a>
      </p>
    </section>
  );
}
