"use client";

import { useEffect, useRef } from "react";

// One lightweight 2D canvas. Particle count scales with intensity and drops
// on small screens so it stays smooth on mid-range phones.
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
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

    const MAX = w < 700 ? 260 : 620;
    type Drop = { x: number; y: number; len: number; v: number; a: number };
    const drops: Drop[] = [];
    const spawn = (y?: number): Drop => ({
      x: Math.random() * (w + 200) - 100,
      y: y ?? -20 - Math.random() * h,
      len: 10 + Math.random() * 18,
      v: 9 + Math.random() * 9,
      a: 0.15 + Math.random() * 0.35,
    });
    for (let i = 0; i < MAX; i++) drops.push(spawn(Math.random() * h));

    let level = target.current;
    let raf = 0;
    const slant = 0.22;
    const frame = () => {
      level += (target.current - level) * 0.05;
      ctx.clearRect(0, 0, w, h);
      const n = Math.floor(MAX * Math.max(0, Math.min(1, level)));
      if (n > 0 && !reduced) {
        ctx.lineCap = "round";
        for (let i = 0; i < n; i++) {
          const d = drops[i];
          ctx.strokeStyle = `rgba(125, 211, 252, ${d.a})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.len * slant, d.y + d.len);
          ctx.stroke();
          const speed = d.v * (0.7 + level * 0.8);
          d.y += speed;
          d.x -= speed * slant;
          if (d.y > h + 20) drops[i] = spawn();
        }
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
