"use client";

import { motion } from "framer-motion";
import type { RoofType, RoofTypeSpec } from "@/lib/engine";
import type { Roof, RoofPins } from "@/lib/roof";

// The roof check card, over the map while the camera orbits the roof:
// what we measured, the roof surface, satellite on or off, and the two pins.
export default function RoofCheck({
  roof,
  roofType,
  roofTypes,
  setRoofType,
  satellite,
  setSatellite,
  pins,
  staticView,
  onClose,
}: {
  roof: Roof;
  roofType: RoofType;
  roofTypes: Record<RoofType, RoofTypeSpec>;
  setRoofType: (t: RoofType) => void;
  satellite: boolean;
  setSatellite: (v: boolean) => void;
  pins: RoofPins;
  staticView: boolean;
  onClose: () => void;
}) {
  const btn = "rounded-lg border border-line px-2 py-1.5 text-xs leading-tight transition hover:border-tank/60";
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      aria-label="Roof check"
      className="glass panel-sheen pointer-events-auto w-full max-w-sm rounded-2xl p-4 text-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-tank-deep">Roof check</p>
          <p className="mt-0.5 text-fg">
            <span className="num text-xl font-semibold">{Math.round(roof.areaM2).toLocaleString("en-US")} m²</span>
            <span className="text-muted">
              {" · "}
              {roof.height != null && roof.source === "map" ? (
                <>
                  about <span className="num">{Math.round(roof.height)} m</span> high
                </>
              ) : (
                "height not mapped"
              )}
            </span>
          </p>
        </div>
        <button onClick={onClose} className="btn-primary shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold">
          Done
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">Roof surface</p>
      <div className="mt-1 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Roof surface">
        {(Object.keys(roofTypes) as RoofType[]).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={roofType === k}
            onClick={() => setRoofType(k)}
            className={`${btn} ${roofType === k ? "border-tank/70 bg-tank/10 text-fg" : "text-muted"}`}
          >
            {roofTypes[k].label}
          </button>
        ))}
      </div>

      <label className="mt-3 flex items-center justify-between gap-3">
        <span>
          <span className="block text-fg">Satellite view</span>
          <span className="block text-[11px] text-muted">Sentinel-2 cloudless 2016 by EOX, 10 m pixels: the area around your roof, not roof detail.</span>
        </span>
        <input type="checkbox" checked={satellite} onChange={(e) => setSatellite(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--color-tank)]" />
      </label>

      <div className="mt-3 rounded-lg border border-line p-2.5 text-xs">
        <p className="text-fg">Drag the pins on the map:</p>
        <ul className="mt-1 space-y-0.5 text-muted">
          <li>
            <span className="mr-1 inline-grid h-4 w-4 place-items-center rounded-full bg-ocean text-[9px] font-bold text-white">T</span>
            where a tank could stand {pins.tank ? <span className="text-ground-deep">· placed</span> : null}
          </li>
          <li>
            <span className="mr-1 inline-grid h-4 w-4 place-items-center rounded-full bg-leaf-deep text-[9px] font-bold text-white">D</span>
            the corner where the downpipe comes down {pins.downpipe ? <span className="text-ground-deep">· placed</span> : null}
          </li>
        </ul>
        <p className="mt-1 text-muted">Placed pins go into your site visit request and your link.</p>
      </div>

      <p className="mt-3 text-[11px] text-muted">
        Outline from OpenStreetMap, confirmed on site.{staticView ? "" : " Drag the map to stop the orbit."}
      </p>
    </motion.section>
  );
}
