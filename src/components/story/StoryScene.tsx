"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import type { StoryMode } from "./copy";

// One still SVG frame of an Islamabad street under the Margalla Hills, 400
// units wide; everything is drawn wider so letterboxed desktops stay filled.
// `drive` (0..1 scroll progress, or 1 for reduced motion) brings in the
// clouds and the rain through transforms only: no React render per frame,
// no WebGL. Once the rain is down, `mode` shows where the water goes.

export type SceneMode = "none" | StoryMode;

const ROOF_Y = 330; // top of the target roof's parapet
const STREET_Y = 400;
const EASE = { duration: 1.1, ease: [0.22, 1, 0.36, 1] as const };

// Groundwater top, nalah water top and tank water top per mode.
const LEVELS: Record<SceneMode, { gw: number; nalah: number; tank: number }> = {
  none: { gw: 460, nalah: 436, tank: 397 },
  today: { gw: 470, nalah: 410, tank: 397 },
  raingrid: { gw: 446, nalah: 434, tank: 352 },
};

// Rain streaks: fixed, scattered positions (no randomness between renders).
const DROPS = Array.from({ length: 46 }, (_, i) => ({
  x: ((i * 97) % 1180) - 390,
  y: 110 + ((i * 53) % 190),
  delay: ((i * 37) % 60) / 100,
}));

export default function StoryScene({ drive, mode, animate }: { drive: MotionValue<number>; mode: SceneMode; animate: boolean }) {
  const sunOpacity = useTransform(drive, [0.12, 0.4], [1, 0.2]);
  const heatOpacity = useTransform(drive, [0, 0.08, 0.18], [1, 1, 0]);
  const cloudsIn = useTransform(drive, [0.1, 0.38], [0, 1], { clamp: true });
  const cloudLeftX = useTransform(cloudsIn, [0, 1], [-260, 0]);
  const cloudRightX = useTransform(cloudsIn, [0, 1], [260, 0]);
  const cloudDark = useTransform(drive, [0.3, 0.46], [0, 0.7], { clamp: true });
  const rain = useTransform(drive, [0.38, 0.5], [0, 1], { clamp: true });
  const roofWet = useTransform(drive, [0.48, 0.6], [0, 1], { clamp: true });
  const levels = LEVELS[mode];
  const t = animate ? EASE : { duration: 0 };

  return (
    <svg
      viewBox="0 0 400 480"
      preserveAspectRatio="xMidYMax meet"
      className="h-full w-full"
      role="img"
      aria-label="Monsoon clouds over the Margalla Hills rain on an Islamabad street. The water either runs to the nalah or is caught in a tank and a recharge well."
    >
      <defs>
        <linearGradient id="rg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--scene-sky-top)" />
          <stop offset="0.5" stopColor="var(--scene-sky-mid)" />
          <stop offset="1" stopColor="var(--scene-sky-low)" />
        </linearGradient>
        <linearGradient id="rg-soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--scene-soil)" />
          <stop offset="1" stopColor="var(--scene-soil-deep)" />
        </linearGradient>
        <radialGradient id="rg-sun">
          <stop offset="0" stopColor="var(--scene-sun-glow)" stopOpacity="1" />
          <stop offset="1" stopColor="var(--scene-sun-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="-1400" y="-600" width="3200" height={STREET_Y + 600} fill="url(#rg-sky)" />

      {/* Sun and heat */}
      <motion.g style={{ opacity: sunOpacity }}>
        <circle cx="312" cy="78" r="78" fill="url(#rg-sun)" />
        <circle cx="312" cy="78" r="26" fill="var(--scene-sun)" />
      </motion.g>
      <motion.g style={{ opacity: heatOpacity }} stroke="var(--scene-heat)" strokeOpacity="0.5" strokeWidth="2" fill="none" strokeLinecap="round">
        {[70, 150, 230, 310].map((x, i) => (
          <path key={x} className="scene-heat" style={{ animationDelay: `${i * 0.5}s` }} d={`M${x} 300 q6 -10 0 -20 q-6 -10 0 -20`} />
        ))}
      </motion.g>

      <Hills y={210} />

      {/* Clouds gather */}
      <motion.g style={{ x: cloudLeftX, opacity: cloudsIn }}>
        <Cloud x={30} y={46} s={1.15} dark={cloudDark} />
        <Cloud x={-190} y={24} s={1} dark={cloudDark} />
        <Cloud x={-430} y={56} s={1.3} dark={cloudDark} />
      </motion.g>
      <motion.g style={{ x: cloudRightX, opacity: cloudsIn }}>
        <Cloud x={210} y={20} s={1.3} dark={cloudDark} />
        <Cloud x={430} y={52} s={1.1} dark={cloudDark} />
        <Cloud x={650} y={24} s={1.2} dark={cloudDark} />
      </motion.g>

      {/* Rain */}
      <motion.g style={{ opacity: rain }} stroke="var(--scene-water)" strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
        {DROPS.map((d) => (
          <line key={`${d.x}-${d.y}`} className="story-drop" style={{ animationDelay: `${d.delay}s` }} x1={d.x} y1={d.y} x2={d.x - 4} y2={d.y + 14} />
        ))}
      </motion.g>

      <Street />

      {/* Your roof gets wet */}
      <motion.rect x="150" y={ROOF_Y - 6} width="100" height="6" rx="1" fill="var(--scene-roof-hit)" style={{ opacity: roofWet }} />

      {/* Ground, nalah and groundwater */}
      <rect x="-1400" y={STREET_Y + 6} width="3200" height="400" fill="url(#rg-soil)" />
      <motion.g initial={false} animate={{ y: levels.gw - 460 }} transition={t}>
        <path
          d="M-1400 460 Q-1350 453 -1300 460 T-1200 460 T-1100 460 T-1000 460 T-900 460 T-800 460 T-700 460 T-600 460 T-500 460 T-400 460 T-300 460 T-200 460 T-100 460 T0 460 T100 460 T200 460 T300 460 T400 460 T500 460 T600 460 T700 460 T800 460 T900 460 T1000 460 T1100 460 T1200 460 T1300 460 T1400 460 T1500 460 T1600 460 T1700 460 T1800 460 V900 H-1400 Z"
          fill="var(--scene-groundwater)"
          opacity="0.55"
        />
        <text x="16" y="478" fontSize="11" fill="var(--color-tank-deep)" fontWeight="600">
          groundwater
        </text>
      </motion.g>
      <rect x="330" y={STREET_Y + 6} width="64" height="38" rx="4" fill="var(--scene-soil-deep)" />
      <motion.rect
        x="333"
        width="58"
        rx="3"
        fill="var(--scene-water)"
        opacity="0.8"
        initial={false}
        animate={{ attrY: levels.nalah, height: STREET_Y + 42 - levels.nalah }}
        transition={t}
      />
      <text x="362" y={STREET_Y + 58} fontSize="11" textAnchor="middle" fill="var(--color-muted)">
        nalah
      </text>

      {/* Today: off the roof, down the street, into the nalah */}
      <g opacity={mode === "today" ? 1 : 0} style={{ transition: "opacity 0.6s" }}>
        <path
          className="scene-flow"
          d={`M250 ${ROOF_Y + 2} H258 V${STREET_Y - 2} H334 L352 ${STREET_Y + 20}`}
          fill="none"
          stroke="var(--scene-drain)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8 4"
        />
      </g>

      {/* RainGrid: gutter and downpipe to a tank, overflow to a recharge well */}
      <g opacity={mode === "raingrid" ? 1 : 0} style={{ transition: "opacity 0.6s" }}>
        <path d={`M150 ${ROOF_Y + 3} H140 V344`} fill="none" stroke="var(--scene-pipe)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path
          className="scene-flow"
          d={`M150 ${ROOF_Y + 3} H140 V344`}
          fill="none"
          stroke="var(--scene-water)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="6 6"
        />
        <rect x="97" y={STREET_Y + 6} width="14" height="70" rx="3" fill="var(--scene-soil-deep)" stroke="var(--scene-pipe)" strokeWidth="1.5" />
        <path d={`M110 354 H104 V${STREET_Y + 70}`} fill="none" stroke="var(--scene-pipe)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path
          className="scene-flow"
          d={`M110 354 H104 V${STREET_Y + 70}`}
          fill="none"
          stroke="var(--scene-recharge)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="6 6"
        />
        <text x="116" y={STREET_Y + 32} fontSize="11" fill="var(--color-ground-deep)" fontWeight="600">
          recharge well
        </text>
      </g>
      {/* The tank stays mounted so it can fill and empty smoothly */}
      <g opacity={mode === "raingrid" ? 1 : 0} style={{ transition: "opacity 0.6s" }}>
        <rect x="110" y="344" width="36" height="56" rx="4" fill="var(--scene-tank)" stroke="var(--scene-pipe)" strokeWidth="2" />
        <motion.rect
          x="113"
          width="30"
          rx="2"
          fill="var(--scene-water)"
          initial={false}
          animate={{ attrY: levels.tank, height: 397 - levels.tank }}
          transition={t}
        />
        <text x="120" y="338" fontSize="11" textAnchor="middle" fill="var(--color-tank-deep)" fontWeight="600">
          tank
        </text>
      </g>
    </svg>
  );
}

function Hills({ y }: { y: number }) {
  // The Margalla ridge: a far and a near layer, repeated wide for desktop.
  const far = `M-1400 ${y + 40} L-1100 ${y - 10} L-900 ${y + 30} L-650 ${y - 30} L-400 ${y + 20} L-180 ${y - 40} L0 ${y + 10} L90 ${y - 50} L190 ${y} L280 ${y - 60} L380 ${y - 10} L520 ${y - 45} L700 ${y + 15} L950 ${y - 35} L1200 ${y + 20} L1800 ${y - 10} V${y + 160} H-1400 Z`;
  const near = `M-1400 ${y + 80} Q-1000 ${y + 30} -700 ${y + 70} T-100 ${y + 60} Q60 ${y + 20} 160 ${y + 60} T420 ${y + 50} T800 ${y + 70} T1400 ${y + 60} L1800 ${y + 70} V${y + 180} H-1400 Z`;
  return (
    <g>
      <path d={far} fill="var(--scene-hill-far)" />
      <path d={near} fill="var(--scene-hill-near)" />
      <rect x="-1400" y={y + 150} width="3200" height="40" fill="var(--scene-hill-city)" />
    </g>
  );
}

function Cloud({ x, y, s, dark }: { x: number; y: number; s: number; dark: MotionValue<number> }) {
  const d = "M0 30 a22 22 0 0 1 22 -22 a30 30 0 0 1 54 -4 a24 24 0 0 1 40 18 a18 18 0 0 1 4 36 H8 a16 16 0 0 1 -8 -28 Z";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={d} fill="var(--scene-cloud)" />
      <motion.path d={d} fill="var(--scene-cloud-dark)" style={{ opacity: dark }} />
    </g>
  );
}

// A row of flat-roofed Islamabad houses. The one at x 150-250 is "your" roof.
const HOUSES = [
  { x: -440, w: 100, roof: 342 },
  { x: -330, w: 95, roof: 354 },
  { x: -225, w: 120, roof: 336 },
  { x: -95, w: 85, roof: 348 },
  { x: 0, w: 88, roof: 350 },
  { x: 150, w: 100, roof: ROOF_Y },
  { x: 262, w: 60, roof: 342 },
  { x: 410, w: 100, roof: 338 },
  { x: 520, w: 90, roof: 352 },
  { x: 620, w: 120, roof: 334 },
  { x: 750, w: 80, roof: 346 },
];

function Street() {
  return (
    <g>
      {HOUSES.map((h) => (
        <g key={h.x}>
          <rect x={h.x} y={h.roof} width={h.w} height={STREET_Y - h.roof} fill="var(--scene-wall)" />
          <rect x={h.x + h.w - 10} y={h.roof} width="10" height={STREET_Y - h.roof} fill="var(--scene-wall-shade)" />
          <rect x={h.x - 2} y={h.roof - 6} width={h.w + 4} height="6" rx="1" fill="var(--scene-roof)" />
          {/* stair room */}
          <rect x={h.x + 8} y={h.roof - 20} width="22" height="14" fill="var(--scene-wall-shade)" />
          {Array.from({ length: Math.max(1, Math.floor(h.w / 34)) }, (_, i) => (
            <rect key={i} x={h.x + 12 + i * 34} y={h.roof + 20} width="16" height="16" rx="2" fill="var(--scene-window)" />
          ))}
        </g>
      ))}
      <rect x="-1400" y={STREET_Y} width="3200" height="6" fill="var(--scene-street)" />
    </g>
  );
}
