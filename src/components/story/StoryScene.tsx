"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

// The whole story is one SVG "world" 400 units wide. The camera group slides
// up as the drop falls, so the view follows it from the clouds to the roof.
// Everything is driven by `drive` (0..1 scroll progress, or a fixed snapshot
// for reduced motion) through transforms and attributes only: no React
// re-render per frame, no WebGL.

export type SceneMode = "none" | "today" | "caught";

const ROOF_Y = 1700; // top of the target roof's parapet
const STREET_Y = 1806;
const LAND = 0.5; // drive value at which the drop hits the roof
const EASE = { duration: 1.2, ease: [0.22, 1, 0.36, 1] as const };

// Groundwater top, nalah water top and tank water top per mode.
const LEVELS: Record<SceneMode, { gw: number; nalah: number; tank: number }> = {
  none: { gw: 2040, nalah: 1842, tank: 1798 },
  today: { gw: 2078, nalah: 1814, tank: 1798 },
  caught: { gw: 2000, nalah: 1846, tank: 1747 },
};

export default function StoryScene({ drive, mode, animate }: { drive: MotionValue<number>; mode: SceneMode; animate: boolean }) {
  const camY = useTransform(drive, [0.29, LAND], [0, -1420], { clamp: true });
  const sunOpacity = useTransform(drive, [0.12, 0.28], [1, 0.3]);
  const heatOpacity = useTransform(drive, [0, 0.1, 0.18], [1, 1, 0]);
  const cloudsIn = useTransform(drive, [0.1, 0.26], [0, 1], { clamp: true });
  const cloudLeftX = useTransform(cloudsIn, [0, 1], [-260, 0]);
  const cloudRightX = useTransform(cloudsIn, [0, 1], [260, 0]);
  const cloudDark = useTransform(drive, [0.2, 0.3], [0, 0.65]);
  const dropY = useTransform(drive, [0.27, 0.29, LAND], [262, 262, ROOF_Y - 8], { clamp: true });
  const dropScale = useTransform(drive, [0.26, 0.3], [0.2, 1], { clamp: true });
  const dropOpacity = useTransform(drive, [0.26, 0.28, LAND, LAND + 0.02], [0, 1, 1, 0]);
  const splashR = useTransform(drive, [LAND, LAND + 0.06], [2, 26], { clamp: true });
  const splashOpacity = useTransform(drive, [LAND - 0.005, LAND, LAND + 0.06], [0, 0.9, 0]);
  const roofHit = useTransform(drive, [LAND, LAND + 0.04], [0, 1], { clamp: true });
  const levels = LEVELS[mode];
  const t = animate ? EASE : { duration: 0 };

  return (
    <svg
      viewBox="0 0 400 800"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      role="img"
      aria-label="A rain drop falls from monsoon clouds over the Margalla Hills onto an Islamabad rooftop"
    >
      <defs>
        <linearGradient id="rg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--scene-sky-top)" />
          <stop offset="0.35" stopColor="var(--scene-sky-mid)" />
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

      <motion.g style={{ y: camY }}>
        {/* Sky, wide enough to fill letterboxed desktop screens. */}
        <rect x="-1400" y="-400" width="3200" height={STREET_Y + 400} fill="url(#rg-sky)" />

        {/* Beat 1: sun and heat over the hills */}
        <motion.g style={{ opacity: sunOpacity }}>
          <circle cx="300" cy="150" r="110" fill="url(#rg-sun)" />
          <circle cx="300" cy="150" r="38" fill="var(--scene-sun)" />
        </motion.g>
        <motion.g style={{ opacity: heatOpacity }} stroke="var(--scene-heat)" strokeOpacity="0.5" strokeWidth="2" fill="none" strokeLinecap="round">
          {[70, 150, 230, 310].map((x, i) => (
            <path
              key={x}
              className="scene-heat"
              style={{ animationDelay: `${i * 0.5}s` }}
              d={`M${x} 520 q6 -10 0 -20 q-6 -10 0 -20`}
            />
          ))}
        </motion.g>

        <Hills y={560} />

        {/* Beat 2: clouds gather */}
        <motion.g style={{ x: cloudLeftX, opacity: cloudsIn }}>
          <Cloud x={40} y={230} s={1.2} dark={cloudDark} />
          <Cloud x={-180} y={200} s={1} dark={cloudDark} />
          <Cloud x={-420} y={240} s={1.3} dark={cloudDark} />
        </motion.g>
        <motion.g style={{ x: cloudRightX, opacity: cloudsIn }}>
          <Cloud x={220} y={200} s={1.35} dark={cloudDark} />
          <Cloud x={430} y={235} s={1.1} dark={cloudDark} />
          <Cloud x={650} y={205} s={1.2} dark={cloudDark} />
        </motion.g>

        {/* Distant city and hills behind the rooftops */}
        <Hills y={1590} faint />

        {/* Street row */}
        <Street />

        {/* Target roof lights up where the drop lands */}
        <motion.rect x="150" y={ROOF_Y - 6} width="100" height="6" rx="1" fill="var(--scene-roof-hit)" style={{ opacity: roofHit }} />

        {/* Ground, nalah and groundwater */}
        <rect x="-1400" y={STREET_Y + 6} width="3200" height="700" fill="url(#rg-soil)" />
        <motion.g initial={false} animate={{ y: levels.gw - 2040 }} transition={t}>
          <path
            d="M-1400 2040 Q-1350 2032 -1300 2040 T-1200 2040 T-1100 2040 T-1000 2040 T-900 2040 T-800 2040 T-700 2040 T-600 2040 T-500 2040 T-400 2040 T-300 2040 T-200 2040 T-100 2040 T0 2040 T100 2040 T200 2040 T300 2040 T400 2040 T500 2040 T600 2040 T700 2040 T800 2040 T900 2040 T1000 2040 T1100 2040 T1200 2040 T1300 2040 T1400 2040 T1500 2040 T1600 2040 T1700 2040 T1800 2040 V2600 H-1400 Z"
            fill="var(--scene-groundwater)"
            opacity="0.55"
          />
          <text x="16" y="2062" fontSize="11" fill="var(--color-tank-deep)" fontWeight="600">
            groundwater
          </text>
        </motion.g>
        {/* Nalah channel */}
        <rect x="330" y={STREET_Y + 6} width="64" height="44" rx="4" fill="var(--scene-soil-deep)" />
        <motion.rect
          x="333"
          width="58"
          rx="3"
          fill="var(--scene-water)"
          opacity="0.8"
          initial={false}
          animate={{ attrY: levels.nalah, height: STREET_Y + 48 - levels.nalah }}
          transition={t}
        />
        <text x="362" y={STREET_Y + 66} fontSize="11" textAnchor="middle" fill="var(--color-muted)">
          nalah
        </text>

        {/* Today: water runs off the roof, down the street, into the nalah */}
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

        {/* Caught: pipe to a tank, overflow to a recharge well */}
        <g opacity={mode === "caught" ? 1 : 0} style={{ transition: "opacity 0.6s" }}>
          <path
            d={`M150 ${ROOF_Y + 3} H140 V1742`}
            fill="none"
            stroke="var(--scene-pipe)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="scene-flow"
            d={`M150 ${ROOF_Y + 3} H140 V1742`}
            fill="none"
            stroke="var(--scene-water)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="6 6"
          />
          {/* recharge well shaft */}
          <rect x="97" y={STREET_Y + 6} width="14" height="200" rx="3" fill="var(--scene-soil-deep)" stroke="var(--scene-pipe)" strokeWidth="1.5" />
          <path
            d={`M110 1752 H104 V${STREET_Y + 200}`}
            fill="none"
            stroke="var(--scene-pipe)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="scene-flow"
            d={`M110 1752 H104 V${STREET_Y + 200}`}
            fill="none"
            stroke="var(--scene-recharge)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="6 6"
          />
          <text x="116" y={STREET_Y + 120} fontSize="11" fill="var(--color-ground-deep)" fontWeight="600">
            recharge well
          </text>
        </g>
        {/* The tank itself stays visible so it can fill and empty smoothly */}
        <g opacity={mode === "caught" ? 1 : 0} style={{ transition: "opacity 0.6s" }}>
          <rect x="110" y="1742" width="36" height="60" rx="4" fill="var(--scene-tank)" stroke="var(--scene-pipe)" strokeWidth="2" />
          <motion.rect
            x="113"
            width="30"
            rx="2"
            fill="var(--scene-water)"
            initial={false}
            animate={{ attrY: levels.tank, height: 1799 - levels.tank }}
            transition={t}
          />
          <text x="122" y="1736" fontSize="11" textAnchor="middle" fill="var(--color-tank-deep)" fontWeight="600">
            tank
          </text>
        </g>

        {/* Beat 3: the drop forms under the clouds and falls */}
        <motion.g style={{ y: dropY, opacity: dropOpacity }}>
          <motion.path
            d="M200 -14 C206 -4 211 2 211 8 A11 11 0 0 1 189 8 C189 2 194 -4 200 -14 Z"
            fill="var(--scene-water)"
            style={{ scale: dropScale, transformBox: "fill-box", transformOrigin: "50% 0%" }}
          />
        </motion.g>
        <motion.ellipse
          cx="200"
          cy={ROOF_Y - 3}
          ry="5"
          rx={splashR}
          fill="none"
          stroke="var(--scene-water)"
          strokeWidth="2"
          style={{ opacity: splashOpacity }}
        />
      </motion.g>
    </svg>
  );
}

function Hills({ y, faint = false }: { y: number; faint?: boolean }) {
  // The Margalla ridge: a far and a near layer, repeated wide for desktop.
  const far = `M-1400 ${y + 40} L-1100 ${y - 10} L-900 ${y + 30} L-650 ${y - 30} L-400 ${y + 20} L-180 ${y - 40} L0 ${y + 10} L90 ${y - 50} L190 ${y} L280 ${y - 60} L380 ${y - 10} L520 ${y - 45} L700 ${y + 15} L950 ${y - 35} L1200 ${y + 20} L1800 ${y - 10} V${y + 160} H-1400 Z`;
  const near = `M-1400 ${y + 80} Q-1000 ${y + 30} -700 ${y + 70} T-100 ${y + 60} Q60 ${y + 20} 160 ${y + 60} T420 ${y + 50} T800 ${y + 70} T1400 ${y + 60} L1800 ${y + 70} V${y + 180} H-1400 Z`;
  return (
    <g opacity={faint ? 0.55 : 1}>
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
  { x: -440, w: 100, roof: 1712 },
  { x: -330, w: 95, roof: 1724 },
  { x: -225, w: 120, roof: 1706 },
  { x: -95, w: 85, roof: 1718 },
  { x: 0, w: 88, roof: 1720 },
  { x: 150, w: 100, roof: ROOF_Y },
  { x: 262, w: 60, roof: 1712 },
  { x: 410, w: 100, roof: 1708 },
  { x: 520, w: 90, roof: 1722 },
  { x: 620, w: 120, roof: 1704 },
  { x: 750, w: 80, roof: 1716 },
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
            <rect key={i} x={h.x + 12 + i * 34} y={h.roof + 22} width="16" height="18" rx="2" fill="var(--scene-window)" />
          ))}
        </g>
      ))}
      <rect x="-1400" y={STREET_Y} width="3200" height="6" fill="var(--scene-street)" />
    </g>
  );
}
