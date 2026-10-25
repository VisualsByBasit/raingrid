"use client";

import { formatL, tankWhatIf } from "@/lib/engine";
import type { Setup } from "./RainGridApp";
import Hint from "./guide/Hint";

const TANK_HINT = "The water tank your house has. One 2,000 L tank is common. Change it to match yours.";

// The tank, kept up front: size stepper plus what 1,000 L more or less
// would change for the chosen storm.
export default function TankControl({
  setup,
  setSetup,
  areaM2,
  rainMm,
}: {
  setup: Setup;
  setSetup: (s: Setup) => void;
  areaM2: number | null;
  rainMm: number;
}) {
  const size = setup.tankLitres;
  const set = (v: number) => setSetup({ ...setup, tankLitres: Math.max(0, Math.min(1_000_000, v)) });
  const what = areaM2 != null && rainMm > 0 ? tankWhatIf({ areaM2, rainMm, ...setup }) : null;
  const elsewhere = setup.hasRecharge ? "toward recharge" : "to the drain";
  const stepBtn =
    "grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-lg text-fg transition hover:border-tank/60 disabled:opacity-40";
  return (
    <div className="rounded-xl border border-tank/30 bg-tank/5 p-3">
      <p className="text-xs text-muted">
        Your tank
        <Hint text={TANK_HINT} label="About tank" />
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <button className={stepBtn} onClick={() => set(size - 500)} disabled={size <= 0} aria-label="Tank 500 litres smaller">
          −
        </button>
        <label className="relative flex-1">
          <span className="sr-only">Tank size in litres</span>
          <input
            inputMode="numeric"
            value={size}
            onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || 0)}
            className="num h-10 w-full rounded-lg border border-line bg-panel px-3 pr-8 text-center text-lg font-semibold outline-none focus:border-tank"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">L</span>
        </label>
        <button className={stepBtn} onClick={() => set(size + 500)} aria-label="Tank 500 litres bigger">
          +
        </button>
      </div>
      {what && (
        <ul className="mt-2 space-y-0.5 text-xs text-fg">
          <li>
            With a <span className="num">{formatL(what.biggerSize)}</span> tank:{" "}
            {what.biggerGain >= 10 ? (
              <>
                <span className="num text-tank-deep">{formatL(what.biggerGain)}</span> more stored from this storm
              </>
            ) : (
              "no more stored, this storm already fits"
            )}
          </li>
          {what.smallerSize < size && (
            <li>
              With {what.smallerSize > 0 ? <>a <span className="num">{formatL(what.smallerSize)}</span> tank</> : "no tank"}:{" "}
              {what.smallerLoss >= 10 ? (
                <>
                  <span className="num text-drain-deep">{formatL(what.smallerLoss)}</span> less stored, sent {elsewhere} instead
                </>
              ) : (
                "stores the same for this storm"
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
