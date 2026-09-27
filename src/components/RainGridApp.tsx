"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CITY, OUT_OF_AUTHORIZED_RANGE, isInAuthorizedCity } from "@/config/city";
import { ALL_SECTORS, searchSectors, type Sector } from "@/data/sectors";
import { ISLAMABAD_STORMS, PRESETS, STORMS, nearestReading } from "@/data/storms";
import { DEFAULTS, ROOF_TYPES, aggregate, calculate, type RoofType } from "@/lib/engine";
import { areaOf, centroidOf, newRoofId, type Roof } from "@/lib/roof";
import { choiceFromKey, choiceKey, decodeShare, encodeShare, type StormChoice } from "@/lib/share";
import type { FlyTarget } from "./MapView";
import RainCanvas from "./RainCanvas";
import Intro from "./Intro";
import ResultPanel from "./ResultPanel";
import SourcesDrawer from "./SourcesDrawer";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export interface Setup {
  roofType: RoofType;
  usableShare: number;
  tankLitres: number;
  hasRecharge: boolean;
}

export function rainFor(choice: StormChoice, lat: number, lng: number) {
  if (choice.kind === "custom") return { mm: choice.mm, label: `${choice.mm} mm (your number)`, gaugeNote: null as string | null };
  if (choice.kind === "preset") {
    const p = PRESETS.find((x) => x.id === choice.id)!;
    return { mm: p.mm, label: p.title, gaugeNote: "Long-term average, not a single storm" };
  }
  const s = STORMS.find((x) => x.id === choice.id)!;
  const r = nearestReading(s, lat, lng);
  if (!r) return { mm: 0, label: s.dateLabel, gaugeNote: null };
  return {
    mm: r.mm,
    label: s.dateLabel,
    gaugeNote: `Nearest reported gauge: ${r.gauge.name} (${r.gauge.note}), about ${r.km < 1 ? "<1" : Math.round(r.km)} km away`,
  };
}

type Phase = "idle" | "raining" | "done";

export default function RainGridApp() {
  // This component only renders in the browser (see RainGridClient), so the
  // shared street link can seed the initial state directly.
  const [shared] = useState(() => decodeShare(window.location.search));
  const [intro, setIntro] = useState(shared.roofs.length === 0);
  const [roofs, setRoofs] = useState<Roof[]>(shared.roofs);
  const [activeId, setActiveId] = useState<string | null>(shared.roofs[0]?.id ?? null);
  const [mode, setMode] = useState<"pick" | "draw">("pick");
  const [addingNeighbour, setAddingNeighbour] = useState(false);
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [zoom, setZoom] = useState(CITY.zoom);
  const [fly, setFly] = useState<FlyTarget | null>(() =>
    shared.roofs[0] ? { lng: shared.roofs[0].lng, lat: shared.roofs[0].lat, zoom: 16.5, key: 1 } : null,
  );
  const [choice, setChoice] = useState<StormChoice>(
    () => choiceFromKey(shared.storm) ?? { kind: "storm", id: ISLAMABAD_STORMS[0].id },
  );
  const [setup, setSetup] = useState<Setup>({
    roofType: DEFAULTS.roofType,
    usableShare: DEFAULTS.usableShare,
    tankLitres: DEFAULTS.tankLitres,
    hasRecharge: DEFAULTS.hasRecharge,
  });
  const [phase, setPhase] = useState<Phase>("idle");
  const [mapError, setMapError] = useState(false);
  const [query, setQuery] = useState("");
  const [typedArea, setTypedArea] = useState("");
  const [showSources, setShowSources] = useState(false);
  // Set by the landing's hand-off card: close the intro and focus the search.
  const [focusSearch, setFocusSearch] = useState(false);
  const [toast, setToast] = useState<string | null>(shared.outOfRange ? OUT_OF_AUTHORIZED_RANGE : null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const active = roofs.find((r) => r.id === activeId) ?? null;
  const rain = useMemo(
    () => rainFor(choice, active?.lat ?? CITY.center[1], active?.lng ?? CITY.center[0]),
    [choice, active],
  );
  const result = useMemo(
    () => (active ? calculate({ areaM2: active.areaM2, rainMm: rain.mm, ...setup }) : null),
    [active, rain.mm, setup],
  );
  const street = useMemo(() => {
    if (roofs.length < 2) return null;
    const run = (hasRecharge: boolean) =>
      aggregate(roofs.map((r) => calculate({ areaM2: r.areaM2, rainMm: rainFor(choice, r.lat, r.lng).mm, ...setup, hasRecharge })));
    const withWells = run(true);
    return {
      ...run(setup.hasRecharge),
      count: roofs.length,
      potentialWithWells: withWells.tank + withWells.rechargePotential,
    };
  }, [roofs, choice, setup]);

  const resetResult = () => setPhase("idle");

  const addRoof = useCallback(
    (roof: Roof) => {
      if (!isInAuthorizedCity(roof.lat, roof.lng)) {
        setToast(OUT_OF_AUTHORIZED_RANGE);
        return;
      }
      setRoofs((prev) => {
        // Clicking an already-selected roof selects it instead of duplicating.
        const dup = prev.find((r) => Math.abs(r.lat - roof.lat) < 1e-5 && Math.abs(r.lng - roof.lng) < 1e-5);
        if (dup) {
          setActiveId(dup.id);
          return prev;
        }
        if (addingNeighbour || prev.length === 0) {
          const label = prev.length === 0 ? "Your roof" : `Neighbour ${prev.length}`;
          const next = [...prev, { ...roof, label }].slice(0, 12);
          if (prev.length === 0) setActiveId(roof.id);
          if (prev.length >= 11) setToast("Street is full at 12 roofs");
          return next;
        }
        // Not adding neighbours: replace your roof.
        setActiveId(roof.id);
        return [{ ...roof, label: "Your roof" }];
      });
      setPhase("idle");
    },
    [addingNeighbour],
  );

  const goSector = (s: Sector) => {
    setQuery(s.id);
    setFly({ lng: s.lng, lat: s.lat, zoom: 16.2, key: Date.now() });
    setIntro(false);
  };

  const finishDraw = () => {
    if (drawPoints.length < 3) return;
    const geometry = { type: "Polygon" as const, coordinates: [[...drawPoints, drawPoints[0]]] };
    const area = Math.round(areaOf({ type: "Feature", properties: {}, geometry }));
    if (area > 100_000) {
      setToast("That outline is bigger than a city block. Zoom in close to your roof and draw again.");
      setDrawPoints([]);
      return;
    }
    const [lng, lat] = centroidOf(geometry);
    addRoof({ id: newRoofId("d"), label: "Your roof", areaM2: area, lat, lng, source: "drawn", geometry, height: 3 });
    setDrawPoints([]);
    setMode("pick");
  };

  const addTyped = () => {
    const a = Number(typedArea);
    if (!Number.isFinite(a) || a <= 0 || a > 100000) {
      setToast("Enter a roof area between 1 and 100,000 m²");
      return;
    }
    const sector = ALL_SECTORS.find((s) => s.id === query.toUpperCase()) ?? null;
    addRoof({
      id: newRoofId("t"),
      label: "Your roof",
      areaM2: Math.round(a),
      lat: sector?.lat ?? CITY.center[1],
      lng: sector?.lng ?? CITY.center[0],
      source: "typed",
    });
    setTypedArea("");
  };

  // A map roof gained or lost a part (multi-part houses): new outline and area.
  const updateRoof = (roof: Roof) => {
    setRoofs((prev) => prev.map((r) => (r.id === roof.id ? { ...roof, label: r.label } : r)));
    setPhase("idle");
  };

  const updateArea = (id: string, areaM2: number) => {
    setRoofs((prev) => prev.map((r) => (r.id === id ? { ...r, areaM2 } : r)));
    setPhase("idle");
  };

  const removeRoof = (id: string) => {
    setRoofs((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
    setPhase("idle");
  };

  const replay = () => {
    if (!result) return;
    setPhase("raining");
    if (active) setFly({ lng: active.lng, lat: active.lat, zoom: 17.2, key: Date.now() });
    setTimeout(() => setPhase("done"), 4200);
  };

  const share = async () => {
    const url = encodeShare(roofs, choiceKey(choice));
    try {
      await navigator.clipboard.writeText(url);
      setToast("Street link copied. Send it to your neighbours.");
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  const intensity =
    // The landing draws its own rain, so the map's rain rests behind it.
    phase === "raining" ? Math.min(1, 0.35 + rain.mm / 200) : intro ? 0 : phase === "done" ? 0.05 : 0.08;
  const suggestions = searchSectors(query);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-ink">
      {!mapError && (
        <MapView
          roofs={roofs}
          activeRoofId={activeId}
          mode={mode}
          drawPoints={drawPoints}
          onDrawPoint={(p) => setDrawPoints((d) => [...d, p])}
          onPick={addRoof}
          onZoom={setZoom}
          onMapError={() => setMapError(true)}
          flyTarget={fly}
          raining={phase === "raining"}
          addingNeighbour={addingNeighbour}
          onUpdateRoof={updateRoof}
        />
      )}
      {mapError && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-muted">
          <p className="max-w-sm text-sm">
            The map couldn&apos;t load on this connection. You can still type your roof area in the panel and replay a storm.
          </p>
        </div>
      )}
      <RainCanvas intensity={intensity} />

      {/* Top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start gap-3 p-3 md:p-4">
        <button
          onClick={() => setIntro(true)}
          className="glass pointer-events-auto rounded-lg px-3 py-2 text-sm font-semibold tracking-[0.2em]"
        >
          RAIN<span className="text-tank">{"//"}</span>GRID
        </button>
        {!intro && (
          <div className="pointer-events-auto relative w-full max-w-xs md:w-72">
            <input
              autoFocus={focusSearch}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) goSector(suggestions[0]);
              }}
              placeholder="Your sector, e.g. F-7 or G-11"
              aria-label="Search sector"
              className="glass w-full rounded-lg px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-tank"
            />
            {query && suggestions.length > 0 && suggestions[0].id !== query.toUpperCase() && (
              <ul className="glass absolute mt-1 w-full overflow-hidden rounded-lg text-sm">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => goSector(s)} className="w-full px-3 py-2 text-left hover:bg-tank/10">
                      {s.id} <span className="text-muted">Islamabad</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      {/* Map hints */}
      {!intro && !mapError && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 md:top-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${mode}-${zoom < 14.5}-${zoom < 16}-${addingNeighbour}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass rounded-full px-4 py-1.5 text-xs text-muted"
            >
              {mode === "draw"
                ? zoom < 16
                  ? "Zoom in first"
                  : "Tap your roof's corners"
                : zoom < 14.5
                  ? "Search your sector or zoom in to see buildings"
                  : addingNeighbour
                    ? "Tap your neighbours' roofs"
                    : "Tap your roof"}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Side panel / bottom sheet */}
      {!intro && (
        <aside className="glass panel-sheen absolute inset-x-0 bottom-0 z-20 max-h-[58dvh] overflow-y-auto rounded-t-2xl p-4 md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:max-h-none md:w-[400px] md:rounded-2xl">
          <ResultPanel
            roofs={roofs}
            active={active}
            setActiveId={(id) => {
              setActiveId(id);
              setPhase("idle");
            }}
            mode={mode}
            setMode={(m) => {
              setMode(m);
              setDrawPoints([]);
            }}
            drawPoints={drawPoints}
            finishDraw={finishDraw}
            undoDraw={() => setDrawPoints((d) => d.slice(0, -1))}
            typedArea={typedArea}
            setTypedArea={setTypedArea}
            addTyped={addTyped}
            updateArea={updateArea}
            removeRoof={removeRoof}
            choice={choice}
            setChoice={(c) => {
              setChoice(c);
              resetResult();
            }}
            rain={rain}
            setup={setup}
            setSetup={(s) => {
              setSetup(s);
              resetResult();
            }}
            result={result}
            phase={phase}
            replay={replay}
            street={street}
            addingNeighbour={addingNeighbour}
            setAddingNeighbour={setAddingNeighbour}
            share={share}
            openSources={() => setShowSources(true)}
            roofTypes={ROOF_TYPES}
          />
        </aside>
      )}

      <AnimatePresence>
        {intro && (
          <Intro
            onStart={() => setIntro(false)}
            onSector={goSector}
            onSources={() => setShowSources(true)}
            onFindRoof={() => {
              setFocusSearch(true);
              setIntro(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{showSources && <SourcesDrawer onClose={() => setShowSources(false)} />}</AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass absolute bottom-[60dvh] left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-sm md:bottom-6"
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
