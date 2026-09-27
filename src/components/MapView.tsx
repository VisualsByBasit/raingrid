"use client";

import { Map as MLMap, NavigationControl, AttributionControl, setWorkerUrl } from "maplibre-gl";
import type { ExpressionSpecification, GeoJSONSource, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CITY } from "@/config/city";
import { areaOf, centroidOf, mergePieces, newRoofId, type Roof } from "@/lib/roof";

export interface FlyTarget {
  lng: number;
  lat: number;
  zoom: number;
  key: number;
}

interface Props {
  roofs: Roof[];
  activeRoofId: string | null;
  mode: "pick" | "draw";
  drawPoints: [number, number][];
  onDrawPoint: (p: [number, number]) => void;
  onPick: (roof: Roof) => void;
  onUpdateRoof: (roof: Roof) => void;
  onZoom: (z: number) => void;
  onMapError: () => void;
  flyTarget: FlyTarget | null;
  raining: boolean;
  addingNeighbour: boolean;
}

type Geom = Polygon | MultiPolygon;

const BUILDING_LAYER = "rg-buildings";
const STATIC_BUILDING_LAYER = "rg-static-buildings";
const HILLSHADE_LAYER = "rg-hillshade";
const TERRAIN_SOURCE = "rg-terrain";
const HILLSHADE_SOURCE = "rg-hillshade-dem";
const ROOF_LAYER = "rg-roofs"; // other roofs (neighbours)
const ROOF_ACTIVE_LAYER = "rg-roof-active";
const GLOW_LAYER = "rg-roof-glow";
const HALO_LAYER = "rg-roof-halo";
const HOVER_SOURCE = "rg-hover";
const HOVER_LAYER = "rg-hover";
const OUTLINE_SOURCE = "rg-hover-outline";
const OUTLINE_GLOW_LAYER = "rg-hover-outline-glow";
const OUTLINE_LAYER = "rg-hover-outline";
const LARGE_ROOF_M2 = 5000;
const PART_TOLERANCE_M = 0.5;

const ROOF_ACTIVE = "#0ea5e9";
const ROOF_ACTIVE_RAIN = "#38bdf8";
// Green (#10b981) is reserved for neighbour roofs.
const ROOF_OTHER = "#7dd3fc";
const ROOF_LIFT = 1.2;
const ROOF_START = "#e6edf4";
const HOVER_COLOR = "#a5d8f7";
const HOVER_LIFT = 3;
const OUTLINE = "#0ea5e9";
const OUTLINE_CLEAR = "rgba(14, 165, 233, 0)";
const SELECT_MS = 300;
const HOVER_MS = 250;
const NO_TRANSITION = { duration: 0, delay: 0 };
const SOFT_TRANSITION = { duration: 300, delay: 0 };

const POSITRON = "https://tiles.openfreemap.org/styles/positron";
const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const ELEVATION_CREDIT =
  'Elevation: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Mapzen / AWS Terrain Tiles</a>';

// Only used if the OpenFreeMap positron style itself fails to load. Kept tiny
// and label-free (no glyphs needed); the 3D layers are added on top as usual.
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: "RAIN//GRID minimal light map",
  sources: {
    openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f4f7fa" } },
    {
      id: "park",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "park",
      paint: { "fill-color": "#e6f2e8", "fill-opacity": 0.8 },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": "#cfe5f4" },
    },
    {
      id: "roads",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      paint: { "line-color": "#dfe6ee", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 17, 4] },
    },
  ],
};

// Served from /public (see scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// Very light grey to pale blue by height.
function buildingColor(height: ExpressionSpecification): ExpressionSpecification {
  return ["interpolate", ["linear"], height, 0, "#f3f5f8", 12, "#e6edf4", 30, "#d6e4f1", 80, "#c2d8ee"];
}

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const cursorEl = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const flown = useRef(false);
  const glowRaf = useRef(0);
  // Selected-roof tween state: current lift (0..1) and colour.
  const roofAnim = useRef({ raf: 0, lift: 1, color: ROOF_ACTIVE, activeId: null as string | null });
  // The pieces each map roof is made of, so added parts can be removed again.
  const parts = useRef(new Map<string, Geom[]>());
  const [notice, setNotice] = useState<{ text: string; key: number } | null>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  // Init once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const reduceMotion = prefersReducedMotion();
    const slow = isSlowDevice();
    // Start wide and low for the fly-in, unless we are about to fly somewhere else.
    const introStart = !reduceMotion && !latest.current.flyTarget;
    const fancyCursor = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    let m: MLMap;
    try {
      m = new MLMap({
        container: el.current,
        style: POSITRON,
        center: introStart ? [73.02, 33.63] : CITY.center,
        zoom: introStart ? 10.9 : CITY.zoom,
        pitch: introStart ? 15 : 45,
        bearing: introStart ? -28 : 12,
        maxBounds: CITY.bounds,
        attributionControl: false,
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
        canvasContextAttributes: { antialias: true },
      });
    } catch {
      latest.current.onMapError();
      return;
    }
    map.current = m;
    m.addControl(new NavigationControl({ visualizePitch: true }), "bottom-left");
    m.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: [
          '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>',
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
          ELEVATION_CREDIT,
          "Rain data: PMD via APP, ARY, ProPakistani, Arab News",
        ],
      }),
      "bottom-left",
    );

    m.on("error", (e) => {
      const msg = String((e as unknown as { error?: { message?: string } }).error?.message ?? "");
      if (/webgl context|failed to initialize webgl/i.test(msg)) latest.current.onMapError();
    });

    // If positron itself can't load, swap to the local light style. Tile and
    // source errors carry a sourceId and never trigger the swap.
    let styleLoaded = false;
    let usingFallback = false;
    const switchToFallback = () => {
      if (styleLoaded || usingFallback) return;
      usingFallback = true;
      m.setStyle(FALLBACK_STYLE, { diff: false });
    };
    const styleTimer = window.setTimeout(switchToFallback, 12000);
    m.on("error", (e) => {
      if (!styleLoaded && !(e as unknown as { sourceId?: string }).sourceId) switchToFallback();
    });

    // No elevation? Keep the map, go flat.
    let demErrors = 0;
    m.on("error", (e) => {
      const sourceId = (e as unknown as { sourceId?: string }).sourceId;
      if (sourceId !== TERRAIN_SOURCE && sourceId !== HILLSHADE_SOURCE) return;
      demErrors += 1;
      if (demErrors === 4) disableTerrain(m);
    });

    // Static footprints stay hidden unless live building tiles fail: repeated
    // tile errors, or nothing live rendered 8 s after reaching zoom 15.
    let staticShown = false;
    let liveErrors = 0;
    let liveTimer = 0;
    const showStatic = () => {
      if (staticShown) return;
      staticShown = true;
      if (m.getLayer(STATIC_BUILDING_LAYER)) m.setLayoutProperty(STATIC_BUILDING_LAYER, "visibility", "visible");
    };
    m.on("error", (e) => {
      if ((e as unknown as { sourceId?: string }).sourceId !== "openmaptiles") return;
      liveErrors += 1;
      if (liveErrors >= 3) showStatic();
    });
    const checkLive = () => {
      if (staticShown || liveTimer || m.getZoom() < 15) return;
      liveTimer = window.setTimeout(() => {
        liveTimer = 0;
        if (staticShown || !ready.current || m.getZoom() < 15) return;
        const live = m.getLayer(BUILDING_LAYER) ? m.queryRenderedFeatures({ layers: [BUILDING_LAYER] }) : [];
        if (!live.length) showStatic();
      }, 8000);
    };
    m.on("moveend", checkLive);

    // Hover, resolved at most once per frame. The hovered building is copied
    // into its own source (live building ids are not unique), lifted, and
    // outlined by a glowing line that grows from the cursor around the footprint.
    let hoverKey = "";
    let hoverPoint: { x: number; y: number } | null = null;
    let hoverRaf = 0;
    let hoverAnim = 0;
    const applyHover = (k: number) => {
      if (!m.getLayer(HOVER_LAYER)) return;
      m.setPaintProperty(HOVER_LAYER, "fill-extrusion-height", ["+", ["get", "h"], HOVER_LIFT * k]);
      m.setPaintProperty(HOVER_LAYER, "fill-extrusion-opacity", 0.95 * Math.min(1, k * 1.5));
      const gradient = outlineGradient(k);
      m.setPaintProperty(OUTLINE_LAYER, "line-gradient", gradient);
      m.setPaintProperty(OUTLINE_GLOW_LAYER, "line-gradient", gradient);
    };
    const animateHover = () => {
      cancelAnimationFrame(hoverAnim);
      hoverAnim = 0;
      if (prefersReducedMotion()) {
        applyHover(1);
        return;
      }
      applyHover(0);
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / HOVER_MS);
        applyHover(easeOutCubic(k));
        hoverAnim = k < 1 ? requestAnimationFrame(step) : 0;
      };
      hoverAnim = requestAnimationFrame(step);
    };
    const setHover = (hit?: MapGeoJSONFeature, at?: [number, number]) => {
      const geom = hit && isPolygonal(hit.geometry) ? hit.geometry : undefined;
      const key = hit && geom ? (hit.layer.id === STATIC_BUILDING_LAYER ? `s:${hit.id}` : geometryKey(geom)) : "";
      if (key === hoverKey) return;
      hoverKey = key;
      if (!hit || !geom || !at) {
        cancelAnimationFrame(hoverAnim);
        hoverAnim = 0;
        (m.getSource(HOVER_SOURCE) as GeoJSONSource | undefined)?.setData(emptyFC());
        (m.getSource(OUTLINE_SOURCE) as GeoJSONSource | undefined)?.setData(emptyFC());
        return;
      }
      const h = Number(hit.properties?.render_height ?? hit.properties?.height ?? 6);
      // Pushed out slightly so its walls don't z-fight the building's.
      const inflated = inflate(geom, 1.03);
      (m.getSource(HOVER_SOURCE) as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: { h: Number.isFinite(h) ? h : 6 }, geometry: inflated }],
      });
      (m.getSource(OUTLINE_SOURCE) as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: outlineFrom(inflated, at) } }],
      });
      animateHover();
    };
    const setCursor = (state: "hidden" | "idle" | "over") => {
      const c = cursorEl.current;
      if (!c) return;
      c.style.display = state === "hidden" ? "none" : "block";
      c.dataset.over = state === "over" ? "true" : "false";
    };

    m.on("style.load", () => {
      styleLoaded = true;
      window.clearTimeout(styleTimer);
      hoverKey = "";
      if (!m.getSource("openmaptiles")) staticShown = true;
      decorate(m, slow, staticShown);
      ready.current = true;
      roofAnim.current.activeId = null;
      syncRoofs();
      syncDraw();
      latest.current.onZoom(m.getZoom());
    });

    m.once("load", () => {
      if (flown.current) return;
      flown.current = true;
      const pose = { center: CITY.center, zoom: 12.3, pitch: 55, bearing: 12 };
      if (introStart) m.flyTo({ ...pose, duration: 3600, curve: 1.2 });
      else m.jumpTo(pose);
    });

    m.on("zoomend", () => latest.current.onZoom(m.getZoom()));
    // A user who starts moving the map before load keeps control.
    m.on("movestart", (e) => {
      if ((e as { originalEvent?: Event }).originalEvent) flown.current = true;
    });

    const resolveHover = () => {
      hoverRaf = 0;
      if (!ready.current || !hoverPoint) return;
      if (latest.current.mode === "draw") {
        setHover();
        setCursor("hidden");
        m.getCanvas().style.cursor = "crosshair";
        return;
      }
      const layers = selectableBuildingLayers(m);
      const hit = layers.length ? m.queryRenderedFeatures([hoverPoint.x, hoverPoint.y], { layers })[0] : undefined;
      if (fancyCursor) {
        m.getCanvas().style.cursor = "none";
        setCursor(hit ? "over" : "idle");
      } else {
        m.getCanvas().style.cursor = hit ? "pointer" : "";
      }
      const at = m.unproject([hoverPoint.x, hoverPoint.y]);
      setHover(hit, [at.lng, at.lat]);
    };
    m.on("mousemove", (e) => {
      hoverPoint = e.point;
      // The ring follows the pointer directly; no React state involved.
      if (fancyCursor && cursorEl.current) {
        cursorEl.current.style.transform = `translate3d(${e.point.x}px, ${e.point.y}px, 0)`;
      }
      if (!hoverRaf) hoverRaf = requestAnimationFrame(resolveHover);
    });
    m.on("mouseout", () => {
      hoverPoint = null;
      if (ready.current) setHover();
      setCursor("hidden");
      m.getCanvas().style.cursor = "";
    });

    // Clicked building: live pieces merge only across tile edges; static
    // footprints have real unique ids.
    const clickedBuilding = (f: MapGeoJSONFeature) => {
      let pieces: MapGeoJSONFeature[] = [f];
      if (f.layer.id === STATIC_BUILDING_LAYER) {
        if (f.id !== undefined && f.id !== null) {
          pieces = m
            .queryRenderedFeatures({ layers: [f.layer.id] })
            .filter((x) => x.id === f.id);
          if (!pieces.length) pieces = [f];
        }
      } else {
        pieces = tileEdgePieces(m, f);
      }
      return mergePieces(
        pieces
          .filter((x) => isPolygonal(x.geometry))
          .map((x) => ({ type: "Feature", properties: {}, geometry: x.geometry }) as Feature<Geom>),
      );
    };

    // Rebuild a roof from its parts: one merged outline, fresh area.
    const setParts = (roof: Roof, next: Geom[], text: string) => {
      const merged = mergePieces(next.map((g) => ({ type: "Feature", properties: {}, geometry: g }) as Feature<Geom>));
      if (!merged) return;
      parts.current.set(roof.id, next);
      const [lng, lat] = centroidOf(merged.geometry);
      latest.current.onUpdateRoof({ ...roof, geometry: merged.geometry, areaM2: Math.round(areaOf(merged)), lat, lng });
      setNotice({ text, key: Date.now() });
    };

    m.on("click", (e) => {
      if (!ready.current) return;
      const p = latest.current;
      if (p.mode === "draw") {
        p.onDrawPoint([e.lngLat.lng, e.lngLat.lat]);
        return;
      }
      const layers = selectableBuildingLayers(m);
      if (!layers.length) return;
      const hits = m.queryRenderedFeatures(e.point, { layers });
      if (!hits.length) return;
      const f = hits[0];
      const tap: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      // Multi-part houses: while your roof is selected, a touching building
      // is added to it, and tapping an added part removes it again.
      const active = p.roofs.find((r) => r.id === p.activeRoofId);
      if (!p.addingNeighbour && active?.geometry && active.source === "map") {
        const own = parts.current.get(active.id) ?? [active.geometry];
        const added = own.findIndex((g, i) => i > 0 && containsPoint(g, tap));
        if (added > 0) {
          setParts(
            active,
            own.filter((_, i) => i !== added),
            "Part removed.",
          );
          return;
        }
        if (containsPoint(active.geometry, tap)) return;
        const piece = clickedBuilding(f);
        if (piece && touches(active.geometry, piece.geometry, PART_TOLERANCE_M)) {
          setParts(active, [...own, piece.geometry], "Part added. Tap again to remove.");
          return;
        }
      }

      const merged = clickedBuilding(f);
      if (!merged) return;
      const area = areaOf(merged);
      if (area < 8) return;
      const [lng, lat] = centroidOf(merged.geometry);
      const h = Number(f.properties?.render_height ?? f.properties?.height ?? 6);
      const id = newRoofId("b");
      parts.current.set(id, [merged.geometry]);
      p.onPick({
        id,
        label: "Selected roof",
        areaM2: Math.round(area),
        lat,
        lng,
        source: "map",
        geometry: merged.geometry,
        height: Number.isFinite(h) ? h : 6,
      });
      m.easeTo({
        center: [lng, lat],
        zoom: Math.max(m.getZoom(), 17.5),
        pitch: 60,
        bearing: m.getBearing() + 12,
        duration: 1400,
      });
    });

    const anim = roofAnim.current;
    return () => {
      window.clearTimeout(styleTimer);
      window.clearTimeout(liveTimer);
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      cancelAnimationFrame(hoverAnim);
      cancelAnimationFrame(glowRaf.current);
      cancelAnimationFrame(anim.raf);
      glowRaf.current = 0;
      anim.raf = 0;
      m.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);

  function syncRoofs() {
    const m = map.current;
    if (!m || !ready.current) return;
    const { roofs, activeRoofId, raining } = latest.current;
    const withGeom = roofs.filter((r) => r.geometry);
    (m.getSource("rg-roofs") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: withGeom.map((r) => ({
        type: "Feature",
        properties: { active: r.id === activeRoofId, h: r.height ?? 6 },
        geometry: r.geometry!,
      })),
    });
    const hasActive = withGeom.some((r) => r.id === activeRoofId);
    setGlow(m, glowRaf, hasActive);
    // A newly selected roof rises and tints from the building colour.
    const anim = roofAnim.current;
    if (hasActive && anim.activeId !== activeRoofId) {
      anim.lift = 0;
      anim.color = ROOF_START;
      tweenRoof(m, anim, raining ? ROOF_ACTIVE_RAIN : ROOF_ACTIVE);
    }
    anim.activeId = hasActive ? activeRoofId : null;
    const links: Feature[] = [];
    for (let i = 1; i < roofs.length; i++) {
      links.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [[roofs[i - 1].lng, roofs[i - 1].lat], [roofs[i].lng, roofs[i].lat]] },
      });
    }
    (m.getSource("rg-links") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: links });
  }

  function syncDraw() {
    const m = map.current;
    if (!m || !ready.current) return;
    const pts = latest.current.drawPoints;
    const features: Feature[] = pts.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } }));
    if (pts.length >= 3) {
      features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...pts, pts[0]]] } });
    } else if (pts.length === 2) {
      features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: pts } });
    }
    (m.getSource("rg-draw") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features });
  }

  useEffect(syncRoofs, [props.roofs, props.activeRoofId]);
  useEffect(syncDraw, [props.drawPoints]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (props.mode === "draw") m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
  }, [props.mode]);

  // Roof brightens while it rains.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current || !m.getLayer(ROOF_ACTIVE_LAYER)) return;
    tweenRoof(m, roofAnim.current, props.raining ? ROOF_ACTIVE_RAIN : ROOF_ACTIVE);
  }, [props.raining]);

  // Curved flight to a sector or roof. MapLibre turns this into a jump when
  // the user prefers reduced motion, and any drag or zoom interrupts it.
  useEffect(() => {
    const t = props.flyTarget;
    const m = map.current;
    if (!t || !m) return;
    flown.current = true;
    m.flyTo({
      center: [t.lng, t.lat],
      zoom: t.zoom,
      pitch: t.zoom > 15 ? 55 : 45,
      bearing: m.getBearing() + 8,
      curve: 1.5,
      speed: 0.9,
      maxDuration: 4000,
    });
  }, [props.flyTarget]);

  const active = props.roofs.find((r) => r.id === props.activeRoofId);
  const large = active?.source === "map" && active.areaM2 > LARGE_ROOF_M2;
  return (
    <>
      {/* Inline position: maplibre-gl.css sets .maplibregl-map { position: relative }, which
          would beat Tailwind utilities (unlayered CSS wins over @layer utilities). */}
      <div ref={el} style={{ position: "absolute", inset: 0 }} aria-label="Map of Islamabad" role="application" />
      {/* Custom cursor: a small crosshair ring that opens into "select" over a building. */}
      <div
        ref={cursorEl}
        aria-hidden
        data-over="false"
        className="group pointer-events-none absolute left-0 top-0 z-10 hidden will-change-transform"
      >
        <div className="flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-sky-500 bg-white/30 shadow-[0_0_10px_rgba(14,165,233,0.35)] transition-all duration-200 ease-out group-data-[over=true]:h-7 group-data-[over=true]:w-16 group-data-[over=true]:bg-white/85">
          <span className="h-1 w-1 rounded-full bg-sky-500 group-data-[over=true]:hidden" />
          <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-sky-600 group-data-[over=true]:inline">
            select
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-28 z-10 flex max-w-[90vw] -translate-x-1/2 flex-col items-center gap-2 md:top-14">
        {notice && (
          <div key={notice.key} role="status" className="glass rounded-full px-4 py-1.5 text-center text-xs text-fg">
            {notice.text}
          </div>
        )}
        {large && (
          <div role="status" className="glass rounded-full px-4 py-1.5 text-center text-xs text-fg">
            Large building. Check the area, or draw your roof instead.
          </div>
        )}
      </div>
    </>
  );
}

// Everything RAIN//GRID adds on top of the base style. Runs on every style
// load, so the local fallback style gets the same 3D scene.
function decorate(m: MLMap, slow: boolean, showStatic: boolean) {
  const firstSymbol = m.getStyle().layers.find((l) => l.type === "symbol")?.id;

  m.setSky({
    "sky-color": "#a9d6f5",
    "horizon-color": "#eef6fc",
    "fog-color": "#ffffff",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.7,
    "fog-ground-blend": 0.35,
    "atmosphere-blend": 0,
  });
  m.setLight({ anchor: "map", position: [1.4, 225, 40], color: "#ffffff", intensity: 0.32 });

  if (!slow) {
    const dem = {
      type: "raster-dem" as const,
      tiles: [TERRARIUM],
      encoding: "terrarium" as const,
      tileSize: 256,
      maxzoom: 15,
      attribution: ELEVATION_CREDIT,
    };
    // Separate sources for terrain and hillshade, as MapLibre recommends.
    m.addSource(TERRAIN_SOURCE, dem);
    m.addSource(HILLSHADE_SOURCE, dem);
    const hillshadeBefore = m.getLayer("waterway") ? "waterway" : m.getLayer("water") ? "water" : undefined;
    m.addLayer(
      {
        id: HILLSHADE_LAYER,
        type: "hillshade",
        source: HILLSHADE_SOURCE,
        paint: {
          "hillshade-exaggeration": 0.25,
          "hillshade-shadow-color": "#9fb4c9",
          "hillshade-highlight-color": "#ffffff",
          "hillshade-accent-color": "#c8d7e5",
          "hillshade-illumination-direction": 315,
        },
      },
      hillshadeBefore,
    );
    try {
      m.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.3 });
    } catch {
      disableTerrain(m);
    }
  }

  // Mustafa's prebaked OSM footprints for the five demo sectors. Hidden
  // unless live building tiles fail, so the two never draw on top of each other.
  m.addSource("static-buildings", {
    type: "geojson",
    data: "/data/footprints/islamabad-demo.geojson",
    promoteId: "id",
  });
  const staticHeight: ExpressionSpecification = ["coalesce", ["get", "height"], 6];
  m.addLayer(
    {
      id: STATIC_BUILDING_LAYER,
      type: "fill-extrusion",
      source: "static-buildings",
      minzoom: 12,
      layout: { visibility: showStatic ? "visible" : "none" },
      paint: {
        "fill-extrusion-color": buildingColor(staticHeight),
        "fill-extrusion-height": staticHeight,
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 0.92],
        "fill-extrusion-vertical-gradient": true,
      },
    },
    firstSymbol,
  );

  // Live buildings from OpenFreeMap: fade and grow in between z14 and z15.
  if (m.getSource("openmaptiles")) {
    const liveHeight: ExpressionSpecification = ["coalesce", ["get", "render_height"], 6];
    m.addLayer(
      {
        id: BUILDING_LAYER,
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": buildingColor(liveHeight),
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, liveHeight],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            0,
            15,
            ["coalesce", ["get", "render_min_height"], 0],
          ],
          "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 0.92],
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbol,
    );
  }

  // The hovered building, lifted and tinted (tweened in by the hover loop).
  m.addSource(HOVER_SOURCE, { type: "geojson", data: emptyFC() });
  m.addLayer(
    {
      id: HOVER_LAYER,
      type: "fill-extrusion",
      source: HOVER_SOURCE,
      minzoom: 12,
      paint: {
        "fill-extrusion-color": HOVER_COLOR,
        "fill-extrusion-height": ["+", ["get", "h"], HOVER_LIFT],
        "fill-extrusion-height-transition": NO_TRANSITION,
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.95,
        "fill-extrusion-opacity-transition": NO_TRANSITION,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    firstSymbol,
  );
  // Its footprint outline: a soft glow plus a crisp line, revealed along the
  // line from the cursor by animating line-gradient.
  m.addSource(OUTLINE_SOURCE, { type: "geojson", data: emptyFC(), lineMetrics: true });
  m.addLayer(
    {
      id: OUTLINE_GLOW_LAYER,
      type: "line",
      source: OUTLINE_SOURCE,
      minzoom: 12,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-width": 8, "line-blur": 6, "line-opacity": 0.55, "line-gradient": outlineGradient(1) },
    },
    firstSymbol,
  );
  m.addLayer(
    {
      id: OUTLINE_LAYER,
      type: "line",
      source: OUTLINE_SOURCE,
      minzoom: 12,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-width": 2, "line-gradient": outlineGradient(1) },
    },
    firstSymbol,
  );

  // Roofs. Other roofs are pale blue. The selected roof is a blue cap
  // slightly taller than the building, with a thin glowing slab above it and
  // a soft halo on the ground; its lift and colour are tweened on selection.
  m.addSource("rg-roofs", { type: "geojson", data: emptyFC() });
  m.addLayer({
    id: HALO_LAYER,
    type: "line",
    source: "rg-roofs",
    filter: ["==", ["get", "active"], true],
    paint: { "line-color": ROOF_ACTIVE, "line-width": 10, "line-blur": 8, "line-opacity": 0.4, "line-opacity-transition": SOFT_TRANSITION },
  });
  m.addLayer({
    id: ROOF_LAYER,
    type: "fill-extrusion",
    source: "rg-roofs",
    filter: ["!=", ["get", "active"], true],
    paint: {
      "fill-extrusion-color": ROOF_OTHER,
      "fill-extrusion-color-transition": SOFT_TRANSITION,
      "fill-extrusion-height": ["+", ["get", "h"], ROOF_LIFT],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.95,
      "fill-extrusion-opacity-transition": SOFT_TRANSITION,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  m.addLayer({
    id: ROOF_ACTIVE_LAYER,
    type: "fill-extrusion",
    source: "rg-roofs",
    filter: ["==", ["get", "active"], true],
    paint: {
      "fill-extrusion-color": ROOF_ACTIVE,
      "fill-extrusion-color-transition": NO_TRANSITION,
      "fill-extrusion-height": ["+", ["get", "h"], ROOF_LIFT],
      "fill-extrusion-height-transition": NO_TRANSITION,
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.95,
      "fill-extrusion-opacity-transition": SOFT_TRANSITION,
      "fill-extrusion-vertical-gradient": true,
    },
  });
  m.addLayer({
    id: GLOW_LAYER,
    type: "fill-extrusion",
    source: "rg-roofs",
    filter: ["==", ["get", "active"], true],
    paint: {
      "fill-extrusion-color": "#7dd3fc",
      "fill-extrusion-base": ["+", ["get", "h"], ROOF_LIFT],
      "fill-extrusion-height": ["+", ["get", "h"], ROOF_LIFT + 0.8],
      "fill-extrusion-opacity": 0.3,
      "fill-extrusion-opacity-transition": SOFT_TRANSITION,
    },
  });

  m.addSource("rg-links", { type: "geojson", data: emptyFC() });
  m.addLayer({
    id: "rg-links",
    type: "line",
    source: "rg-links",
    paint: { "line-color": ROOF_ACTIVE, "line-width": 2, "line-opacity": 0.7, "line-dasharray": [2, 2] },
  });

  m.addSource("rg-draw", { type: "geojson", data: emptyFC() });
  m.addLayer({
    id: "rg-draw-fill",
    type: "fill",
    source: "rg-draw",
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": ROOF_ACTIVE, "fill-opacity": 0.2 },
  });
  m.addLayer({
    id: "rg-draw-line",
    type: "line",
    source: "rg-draw",
    paint: { "line-color": ROOF_ACTIVE, "line-width": 2 },
  });
  m.addLayer({
    id: "rg-draw-pts",
    type: "circle",
    source: "rg-draw",
    filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": ROOF_ACTIVE, "circle-stroke-width": 2 },
  });
}

// Tween the selected roof's lift (to 1) and colour (to `to`) over ~300 ms.
// Data-driven paint can't use MapLibre transitions, so this sets paint
// properties from a short requestAnimationFrame loop. No React state.
function tweenRoof(m: MLMap, anim: { raf: number; lift: number; color: string }, to: string) {
  cancelAnimationFrame(anim.raf);
  anim.raf = 0;
  const apply = (lift: number, color: string) => {
    if (!m.getLayer(ROOF_ACTIVE_LAYER)) return;
    anim.lift = lift;
    anim.color = color;
    m.setPaintProperty(ROOF_ACTIVE_LAYER, "fill-extrusion-height", ["+", ["get", "h"], ROOF_LIFT * lift]);
    m.setPaintProperty(ROOF_ACTIVE_LAYER, "fill-extrusion-color", color);
  };
  if (prefersReducedMotion()) {
    apply(1, to);
    return;
  }
  const fromLift = anim.lift;
  const fromColor = anim.color;
  const t0 = performance.now();
  const step = (t: number) => {
    const k = easeOutCubic(Math.min(1, (t - t0) / SELECT_MS));
    apply(fromLift + (1 - fromLift) * k, k >= 1 ? to : mixHex(fromColor, to, k));
    anim.raf = k < 1 ? requestAnimationFrame(step) : 0;
  };
  anim.raf = requestAnimationFrame(step);
}

// Slow, soft pulse on the selected roof. Throttled to ~15 fps and only
// touches paint properties, never React state.
function setGlow(m: MLMap, raf: { current: number }, on: boolean) {
  if (!on) {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    return;
  }
  if (prefersReducedMotion()) {
    m.setPaintProperty(GLOW_LAYER, "fill-extrusion-opacity", 0.35);
    m.setPaintProperty(HALO_LAYER, "line-opacity", 0.5);
    return;
  }
  if (raf.current) return;
  let last = 0;
  const tick = (t: number) => {
    raf.current = requestAnimationFrame(tick);
    if (t - last < 66) return;
    last = t;
    if (!m.getLayer(GLOW_LAYER)) return;
    const k = 0.5 + 0.5 * Math.sin(t / 650);
    m.setPaintProperty(GLOW_LAYER, "fill-extrusion-opacity", 0.15 + 0.35 * k);
    m.setPaintProperty(HALO_LAYER, "line-opacity", 0.2 + 0.5 * k);
  };
  raf.current = requestAnimationFrame(tick);
}

// Outline revealed from both ends of the line (the cursor point) towards the
// far side of the footprint: k = 0 shows nothing, k = 1 the whole outline.
function outlineGradient(k: number): ExpressionSpecification {
  if (k >= 0.998) return ["interpolate", ["linear"], ["line-progress"], 0, OUTLINE, 1, OUTLINE];
  const a = Math.max(0.001, k / 2);
  const e = 0.0005;
  return ["interpolate", ["linear"], ["line-progress"], 0, OUTLINE, a, OUTLINE, a + e, OUTLINE_CLEAR, 1 - a - e, OUTLINE_CLEAR, 1 - a, OUTLINE, 1, OUTLINE];
}

// The footprint's outer ring as a line that starts and ends at the point on
// the ring nearest the cursor.
function outlineFrom(g: Geom, at: [number, number]): number[][] {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const ring = (polys.find((p) => inRing(at as XY, p[0] as XY[])) ?? polys[0])[0];
  const open = ring.slice(0, -1);
  if (open.length < 2) return ring;
  const kx = Math.cos((at[1] * Math.PI) / 180);
  const xy = (c: number[]): XY => [c[0] * kx, c[1]];
  const p = xy(at);
  let best = 0;
  let bestD = Infinity;
  let bestT = 0;
  for (let i = 0; i < open.length; i++) {
    const a = xy(open[i]);
    const b = xy(open[(i + 1) % open.length]);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
    const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    if (d < bestD) {
      bestD = d;
      best = i;
      bestT = t;
    }
  }
  const a = open[best];
  const b = open[(best + 1) % open.length];
  const q = [a[0] + (b[0] - a[0]) * bestT, a[1] + (b[1] - a[1]) * bestT];
  const line = [q];
  for (let i = 1; i <= open.length; i++) line.push(open[(best + i) % open.length]);
  line.push(q);
  return line;
}

function disableTerrain(m: MLMap) {
  try {
    m.setTerrain(null);
    if (m.getLayer(HILLSHADE_LAYER)) m.removeLayer(HILLSHADE_LAYER);
  } catch {
    // Map may already be gone; nothing to undo.
  }
}

function easeOutCubic(k: number) {
  return 1 - (1 - k) ** 3;
}

function mixHex(from: string, to: string, k: number): string {
  const f = parseInt(from.slice(1), 16);
  const t = parseInt(to.slice(1), 16);
  const ch = (shift: number) => Math.round(((f >> shift) & 255) + (((t >> shift) & 255) - ((f >> shift) & 255)) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Terrain and hillshade cost the most GPU time; skip them on low-end phones.
function isSlowDevice() {
  const cores = navigator.hardwareConcurrency ?? 8;
  const mobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
  return (mobile && cores <= 4) || cores <= 2;
}

function isPolygonal(g: MapGeoJSONFeature["geometry"]): g is Geom {
  return g.type === "Polygon" || g.type === "MultiPolygon";
}

// Live buildings split across tile edges come back as several pieces. Grow
// the clicked piece only with pieces that touch or overlap it (0.5 m
// tolerance), share its render_height, and sit near a tile edge, so
// neighbouring buildings that merely share a wall are left alone.
function tileEdgePieces(m: MLMap, f: MapGeoJSONFeature): MapGeoJSONFeature[] {
  if (!isPolygonal(f.geometry) || !nearTileEdge(f.geometry)) return [f];
  const h = f.properties?.render_height;
  const rest = m
    .queryRenderedFeatures({ layers: [BUILDING_LAYER] })
    .filter((x) => isPolygonal(x.geometry) && x.properties?.render_height === h && nearTileEdge(x.geometry));
  const picked = [f];
  let grew = true;
  while (grew && picked.length < 8) {
    grew = false;
    for (let i = rest.length - 1; i >= 0; i--) {
      const g = rest[i].geometry as Geom;
      if (picked.some((p) => touches(p.geometry as Geom, g, PART_TOLERANCE_M))) {
        picked.push(rest.splice(i, 1)[0]);
        grew = true;
      }
    }
  }
  return picked;
}

type XY = [number, number];
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LNG_EQ = 111_320;
// OpenFreeMap building data comes from z14 tiles, so pieces are clipped at
// z14 tile edges (plus a small tile buffer).
const TILE_Z = 14;
const TILE_EDGE_M = 80;

function ringsOf(g: Geom): number[][][] {
  return g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
}

function nearTileEdge(g: Geom): boolean {
  const n = 2 ** TILE_Z;
  for (const ring of ringsOf(g)) {
    for (const [lng, lat] of ring) {
      const rad = (lat * Math.PI) / 180;
      const tileM = (40_075_016 * Math.cos(rad)) / n;
      const tx = ((lng + 180) / 360) * n;
      const ty = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
      if (Math.abs(tx - Math.round(tx)) * tileM < TILE_EDGE_M) return true;
      if (Math.abs(ty - Math.round(ty)) * tileM < TILE_EDGE_M) return true;
    }
  }
  return false;
}

// True if the two shapes overlap or come within tol metres of each other.
function touches(a: Geom, b: Geom, tol: number): boolean {
  const lat0 = ringsOf(a)[0]?.[0]?.[1] ?? 0;
  const kx = M_PER_DEG_LNG_EQ * Math.cos((lat0 * Math.PI) / 180);
  const toXY = (rings: number[][][]) => rings.map((r) => r.map(([x, y]) => [x * kx, y * M_PER_DEG_LAT] as XY));
  const ra = toXY(ringsOf(a));
  const rb = toXY(ringsOf(b));
  if (!ra[0]?.length || !rb[0]?.length) return false;
  const ba = bboxOf(ra);
  const bb = bboxOf(rb);
  if (ba[0] - tol > bb[2] || bb[0] - tol > ba[2] || ba[1] - tol > bb[3] || bb[1] - tol > ba[3]) return false;
  for (const r1 of ra) {
    for (const r2 of rb) {
      for (let i = 0; i < r1.length - 1; i++) {
        for (let j = 0; j < r2.length - 1; j++) {
          if (segDist(r1[i], r1[i + 1], r2[j], r2[j + 1]) <= tol) return true;
        }
      }
    }
  }
  // No edges close together: one may sit entirely inside the other.
  return inRing(ra[0][0], rb[0]) || inRing(rb[0][0], ra[0]);
}

// Point in any outer ring of the shape (holes ignored; roofs rarely have them).
function containsPoint(g: Geom, p: [number, number]): boolean {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some((poly) => poly[0] && inRing(p, poly[0] as XY[]));
}

function bboxOf(rings: XY[][]): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of rings) {
    for (const [x, y] of r) {
      b[0] = Math.min(b[0], x);
      b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x);
      b[3] = Math.max(b[3], y);
    }
  }
  return b;
}

function cross(o: XY, a: XY, b: XY) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function pointSegDist(p: XY, a: XY, b: XY) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function segDist(a: XY, b: XY, c: XY, d: XY) {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(pointSegDist(a, c, d), pointSegDist(b, c, d), pointSegDist(c, a, b), pointSegDist(d, a, b));
}

function inRing(p: XY, ring: XY[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Cheap identity for a hovered piece, so the hover source only updates on change.
function geometryKey(g: Geom): string {
  const ring = ringsOf(g)[0] ?? [];
  return `${ring.length}:${ring[0]?.[0]}:${ring[0]?.[1]}`;
}

// Scale a shape about its centre.
function inflate(g: Geom, k: number): Geom {
  const [cx, cy] = centroidOf(g);
  const scale = (ring: number[][]) => ring.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  return g.type === "Polygon"
    ? { type: "Polygon", coordinates: g.coordinates.map(scale) }
    : { type: "MultiPolygon", coordinates: g.coordinates.map((poly) => poly.map(scale)) };
}

function emptyFC(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

// Only layers that are actually shown can be hovered or clicked.
function selectableBuildingLayers(map: MLMap): string[] {
  return [BUILDING_LAYER, STATIC_BUILDING_LAYER].filter(
    (layer) => Boolean(map.getLayer(layer)) && map.getLayoutProperty(layer, "visibility") !== "none",
  );
}
