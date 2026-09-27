"use client";

import { PLATE_URL } from "../three/assets";

// The hero plate without WebGL. "css" (low-end or no WebGL): a slow pan with
// drifting cloud and rain overlays. "still" (reduced motion, and the frame
// under the 3D scene while it loads): the plate alone.
export default function HeroBackdrop({ still }: { still: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0 -z-20 overflow-hidden bg-monsoon-deep">
      {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed decorative plate, already compressed */}
      <img
        src={PLATE_URL}
        alt=""
        className={`hero-plate absolute inset-0 h-full w-full object-cover ${still ? "" : "hero-plate-pan"}`}
        draggable={false}
      />
      {!still && (
        <>
          <div className="hero-clouds absolute inset-x-0 top-0 h-[45%]" />
          <div className="hero-rain absolute inset-0" />
        </>
      )}
    </div>
  );
}
