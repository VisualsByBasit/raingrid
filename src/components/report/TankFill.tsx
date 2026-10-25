"use client";

import { motion, useReducedMotion } from "framer-motion";
import { formatL } from "@/lib/engine";
import type { TankSlot } from "@/lib/overview";

// Your tank and RainGrid's recommended tanks filling in turn, with the
// overflow spilling over the last one. Hand-built SVG; water rises with a
// scaleY transform and the spill is drops moving down (transform and
// opacity only). With reduced motion everything is drawn at its final level.

const TANK_W = 84;
const TANK_H = 120;
const GAP = 26;
const TOP = 34;
const SPILL_W = 120;

export default function TankFill({
  tanks,
  overflow,
  overflowTo,
}: {
  tanks: TankSlot[];
  overflow: number;
  overflowTo: "well" | "drain";
}) {
  const reduced = useReducedMotion();
  const spill = overflow >= 10;
  const width = tanks.length * TANK_W + (tanks.length - 1) * GAP + (spill ? SPILL_W : 8) + 8;
  const height = TOP + TANK_H + 40;
  // Each tank fills after the one before it.
  const per = 0.55;
  const lastX = 4 + (tanks.length - 1) * (TANK_W + GAP);
  const lipX = lastX + TANK_W;
  const fallX = lipX + 36;
  const floorY = TOP + TANK_H;
  const spillDelay = tanks.length * per;
  const summary =
    tanks.map((t) => `${t.label}: ${formatL(t.filled)} of ${formatL(t.capacity)}`).join("; ") +
    (spill ? `. Overflow: ${formatL(overflow)} to ${overflowTo === "well" ? "a recharge well" : "the drain"}.` : ".");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary} className="h-auto w-full max-w-[520px]">
      {tanks.map((t, i) => {
        const x = 4 + i * (TANK_W + GAP);
        const k = t.capacity > 0 ? t.filled / t.capacity : 0;
        const clip = `tank-clip-${i}`;
        return (
          <g key={i}>
            <defs>
              <clipPath id={clip}>
                <rect x={x} y={TOP} width={TANK_W} height={TANK_H} rx={12} />
              </clipPath>
            </defs>
            <rect x={x} y={TOP} width={TANK_W} height={TANK_H} rx={12} fill="var(--color-panel)" />
            <g clipPath={`url(#${clip})`}>
              <motion.rect
                x={x}
                y={TOP}
                width={TANK_W}
                height={TANK_H}
                fill="var(--color-tank)"
                fillOpacity={0.78}
                style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
                initial={{ scaleY: reduced ? k : 0 }}
                animate={{ scaleY: k }}
                transition={{ duration: reduced ? 0 : per, delay: reduced ? 0 : i * per, ease: "easeOut" }}
              />
            </g>
            <rect
              x={x}
              y={TOP}
              width={TANK_W}
              height={TANK_H}
              rx={12}
              fill="none"
              stroke={t.isNew ? "var(--color-ground)" : "var(--color-tank-deep)"}
              strokeWidth={2}
              strokeDasharray={t.isNew ? "6 4" : undefined}
            />
            <text x={x + TANK_W / 2} y={TOP - 10} textAnchor="middle" className="num" fontSize={12} fill="var(--color-fg)">
              {formatL(t.filled)}
            </text>
            <text x={x + TANK_W / 2} y={floorY + 16} textAnchor="middle" fontSize={11} fill="var(--color-fg)">
              {t.isNew ? "New tank" : "Your tank"}
            </text>
            <text x={x + TANK_W / 2} y={floorY + 30} textAnchor="middle" className="num" fontSize={10} fill="var(--color-muted)">
              {formatL(t.capacity)} {k >= 0.995 ? "· full" : `· ${Math.round(k * 100)}%`}
            </text>
          </g>
        );
      })}

      {spill && (
        <g>
          {/* Over the lip and down to the overflow. */}
          <motion.path
            d={`M ${lipX - 6} ${TOP + 2} q 18 -10 30 6 L ${fallX} ${floorY - 8}`}
            fill="none"
            stroke="var(--color-tank)"
            strokeOpacity={0.55}
            strokeWidth={5}
            strokeLinecap="round"
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduced ? 0 : spillDelay, duration: 0.3 }}
          />
          {!reduced &&
            [0, 1, 2, 3].map((d) => (
              <motion.circle
                key={d}
                cx={fallX}
                cy={TOP + 12}
                r={3}
                fill="var(--color-tank)"
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 1, 0], y: [0, floorY - TOP - 22] }}
                transition={{ duration: 0.9, delay: spillDelay + d * 0.22, repeat: Infinity, repeatDelay: 0.1, ease: "easeIn" }}
              />
            ))}
          <motion.ellipse
            cx={fallX}
            cy={floorY - 2}
            rx={34}
            ry={6}
            fill={overflowTo === "well" ? "var(--color-ground)" : "var(--color-drain)"}
            fillOpacity={0.45}
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduced ? 0 : spillDelay + 0.3, duration: 0.4 }}
          />
          <text x={fallX} y={floorY + 16} textAnchor="middle" fontSize={11} fill="var(--color-fg)">
            Overflow
          </text>
          <text
            x={fallX}
            y={floorY + 30}
            textAnchor="middle"
            className="num"
            fontSize={10}
            fill={overflowTo === "well" ? "var(--color-ground-deep)" : "var(--color-drain-deep)"}
          >
            {formatL(overflow)}
          </text>
        </g>
      )}
    </svg>
  );
}
