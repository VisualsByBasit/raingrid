"use client";

import { useEffect, useRef } from "react";

// Rain in three depth layers on one 2D canvas. Each layer's streak (a
// gradient from transparent at the top to rain colour at the bottom, tilted
// by the wind) is pre-rendered once to a small sprite, so a frame is just
// drawImage calls. Particle caps halve on small screens; no React state per
// frame; nothing is drawn when the user prefers reduced motion.

const WIND_DEG = 12;
const TAN = Math.tan((WIND_DEG * Math.PI) / 180);
const COS = Math.cos((WIND_DEG * Math.PI) / 180);

type Layer = {
  share: number; // share of the particle cap
  len: [number, number]; // streak length range, px
  width: number;
  speed: [number, number]; // px per 60 fps frame
  alpha: number;
  blur: number;
  splash: boolean;
};

const LAYERS: Layer[] = [
  { share: 0.45, len: [9, 15], width: 1, speed: [5, 7.5], alpha: 0.15, blur: 0, splash: false }, // far
  { share: 0.35, len: [15, 24], width: 1.2, speed: [8.5, 12], alpha: 0.25, blur: 0, splash: false }, // mid
  { share: 0.2, len: [26, 42], width: 1.6, speed: [13, 18], alpha: 0.35, blur: 0.6, splash: true }, // near
];

type Drop = { x: number; y: number; scale: number; v: number; ground: number };
type Splash = { x: number; y: number; t: number };

export default function RainCanvas({ intensity }: { intensity: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef(intensity);
  useEffect(() => {
    target.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Rain #38BDF8 blended with white, from the theme (--rain-rgb).
    const rgb = getComputedStyle(canvas).getPropertyValue("--rain-rgb").trim() || "106, 206, 250";

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // One sprite per layer, drawn at the layer's longest streak length and
    // scaled down per drop for length variation.
    const sprites = LAYERS.map((layer) => {
      const L = layer.len[1];
      const pad = layer.width + layer.blur * 2 + 1;
      const sw = L * TAN * COS + pad * 2;
      const sh = L * COS + pad * 2;
      const c = document.createElement("canvas");
      c.width = Math.ceil(sw * dpr);
      c.height = Math.ceil(sh * dpr);
      const g = c.getContext("2d")!;
      g.scale(dpr, dpr);
      if (layer.blur) g.filter = `blur(${layer.blur}px)`;
      const x0 = sw - pad;
      const y0 = pad;
      const x1 = pad;
      const y1 = sh - pad;
      const grad = g.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, `rgba(${rgb}, 0)`);
      grad.addColorStop(1, `rgba(${rgb}, ${layer.alpha})`);
      g.strokeStyle = grad;
      g.lineWidth = layer.width;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      return { canvas: c, w: sw, h: sh };
    });

    const cap = w < 700 ? 310 : 620;
    const rand = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0]);
    const spawn = (layer: Layer, y?: number): Drop => ({
      x: Math.random() * (w + h * TAN + 40) - 20,
      y: y ?? -60 - Math.random() * h * 0.5,
      scale: rand(layer.len) / layer.len[1],
      v: rand(layer.speed),
      ground: h - Math.random() * 22,
    });
    const drops = LAYERS.map((layer) => {
      const n = Math.round(cap * layer.share);
      return Array.from({ length: n }, () => spawn(layer, Math.random() * h));
    });
    const splashes: Splash[] = [];

    let level = target.current;
    let raf = 0;
    let prev = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(50, t - prev) / (1000 / 60);
      prev = t;
      level += (target.current - level) * 0.05;
      ctx.clearRect(0, 0, w, h);
      const k = Math.max(0, Math.min(1, level));
      if (k > 0.001) {
        const pace = (0.7 + k * 0.8) * dt;
        LAYERS.forEach((layer, li) => {
          const sprite = sprites[li];
          const list = drops[li];
          const n = Math.floor(list.length * k);
          for (let i = 0; i < n; i++) {
            const d = list[i];
            const sw = sprite.w * d.scale;
            const sh = sprite.h * d.scale;
            ctx.drawImage(sprite.canvas, d.x, d.y - sh, sw, sh);
            const step = d.v * pace;
            d.y += step;
            d.x -= step * TAN;
            if (layer.splash && d.y >= d.ground) {
              if (splashes.length < 60) splashes.push({ x: d.x, y: d.ground, t: 0 });
              list[i] = spawn(layer);
            } else if (d.y - sh > h) {
              list[i] = spawn(layer);
            }
          }
        });
        // Near-layer splashes: a small dot that spreads and fades (~300 ms).
        for (let i = splashes.length - 1; i >= 0; i--) {
          const s = splashes[i];
          s.t += dt / 18;
          if (s.t >= 1) {
            splashes.splice(i, 1);
            continue;
          }
          ctx.fillStyle = `rgba(${rgb}, ${0.4 * (1 - s.t)})`;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, 1 + s.t * 2.5, 0.6 + s.t, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        splashes.length = 0;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
