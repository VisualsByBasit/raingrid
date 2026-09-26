"use client";

import dynamic from "next/dynamic";

// The app reads window (URL, map, canvas), so it renders in the browser only.
const RainGridApp = dynamic(() => import("./RainGridApp"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-ink text-sm tracking-[0.3em] text-muted">RAIN//GRID</div>
  ),
});

export default function RainGridClient() {
  return <RainGridApp />;
}
