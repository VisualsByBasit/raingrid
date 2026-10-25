"use client";

import { motion, useReducedMotion } from "framer-motion";

// A half-circle gauge: a track, the value arc (fades in) and a needle that
// turns to the value (a rotate transform). value is 0..1. A dashed arc marks
// a "what if" reading.

const CX = 60;
const CY = 60;
const R = 48;

const point = (v: number) => {
  const a = Math.PI * (1 - v);
  return [CX + R * Math.cos(a), CY - R * Math.sin(a)] as const;
};

export default function Gauge({ value, color, label, dashed = false }: { value: number; color: string; label: string; dashed?: boolean }) {
  const reduced = useReducedMotion();
  const v = Math.min(1, Math.max(0, value));
  const [x, y] = point(v);
  const pct = Math.round(v * 100);
  return (
    <svg viewBox="0 0 120 80" role="img" aria-label={`${label}: ${pct}%`} className="h-auto w-full max-w-[150px]">
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="var(--color-line)" strokeWidth={10} strokeLinecap="round" />
      {v > 0.004 && (
        <motion.path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={dashed ? "5 5" : undefined}
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.6, delay: reduced ? 0 : 0.3 }}
        />
      )}
      <g transform={`translate(${CX} ${CY})`}>
        <motion.line
          x1={-36}
          y1={0}
          x2={0}
          y2={0}
          stroke="var(--color-fg)"
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ originX: 1, originY: 0.5 }}
          initial={{ rotate: reduced ? 180 * v : 0 }}
          animate={{ rotate: 180 * v }}
          transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <circle r={4} fill="var(--color-fg)" />
      </g>
      <text x={CX} y={CY + 17} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--color-fg)">
        {pct}%
      </text>
    </svg>
  );
}
