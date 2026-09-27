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
// A building as the map selects it: merged outline, height, and a key for
// the piece under the pointer.
type Picked = { key: string; geometry: Geom; height: number };
// A street-network link between two roofs, drawn at height z.
type Link = { a: [number, number]; b: [number, number]; z: number };
// One house: a single polygon part of a live building feature.
type Part = { geometry: Polygon; h: number; base: number };

const BUILDING_LAYER = "rg-buildings";
const HILLSHADE_LAYER = "rg-hillshade";
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
const LINKS_LAYER = "rg-links";
const LINKS_RAIL_LAYER = "rg-links-rail";
// Invisible per-house copy of the live buildings, used only for picking.
const PICK_SOURCE = "rg-pick";
const PICK_LAYER = "rg-pick";
const RAIN_BLUE = "#38bdf8";
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
const OUTLINE_GLOW = "#7dd3fc";
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
  const linkRaf = useRef(0);
  const linkData = useRef<Link[]>([]);
  // Selected-roof tween state: current lift (0..1) and colour.
  const roofAnim = useRef({ raf: 0, lift: 1, color: ROOF_ACTIVE, activeId: null as string | null });
  // The pieces each map roof is made of, so added parts can be removed again.
  const parts = useRef(new Map<string, Geom[]>());
  const [notice, setNotice] = useState<{ text: string; key: number } | null>(null);
  // The roof id whose selection came out over LARGE_ROOF_M2, if any.
  const [largeId, setLargeId] = useState<string | null>(null);
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

    // Hillshade DEM tile errors carry a sourceId, so neither handler above
    // reacts to them; a missing DEM tile just leaves that tile unshaded.

    // Hover, resolved at most once per frame. The hovered house is copied into
    // its own source, lifted, and outlined by a glowing rim that traces around
    // its footprint from the cursor. The rim sits on the lifted roof as a thin
    // 3D ribbon: a flat line would be hidden behind neighbouring buildings.
    let hoverKey = "";
    let hoverPoint: { x: number; y: number } | null = null;
    let hoverRaf = 0;
    let hoverAnim = 0;
    let hoverPath: number[][] = [];
    let hoverHeight = 0;
    const applyHover = (k: number) => {
      if (!m.getLayer(HOVER_LAYER)) return;
      m.setPaintProperty(HOVER_LAYER, "fill-extrusion-height", ["+", ["get", "h"], HOVER_LIFT * k]);
      m.setPaintProperty(HOVER_LAYER, "fill-extrusion-opacity", 0.95 * Math.min(1, k * 1.5));
      const z = hoverHeight + HOVER_LIFT * k;
      // Rim widths are set in screen pixels so it reads at any zoom.
      const px = hoverPath.length ? metresPerPixel(m, hoverPath[0][1]) : 1;
      (m.getSource(OUTLINE_SOURCE) as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { z, glow: true }, geometry: traceRibbon(hoverPath, k, 6 * px) },
          { type: "Feature", properties: { z, glow: false }, geometry: traceRibbon(hoverPath, k, 2 * px) },
        ],
      });
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
    // OpenFreeMap merges many houses into one MultiPolygon feature per tile
    // (one F-10 feature covers ~70,000 m2), so a feature is not a building.
    // Every polygon part is one house: explode the loaded live buildings into
    // parts and keep them in an invisible extrusion layer, so MapLibre's own
    // 3D hit test picks the exact house under the pointer.
    let houses: Part[] = [];
    let pickDirty = true;
    let lastPick: { key: string; building: Picked } | null = null;
    const refreshPick = () => {
      const src = m.getSource(PICK_SOURCE) as GeoJSONSource | undefined;
      if (!src || !m.getSource("openmaptiles")) return;
      pickDirty = false;
      const seen = new Set<string>();
      const next: Part[] = [];
      for (const f of m.querySourceFeatures("openmaptiles", { sourceLayer: "building" })) {
        if (!isPolygonal(f.geometry)) continue;
        const h = Number(f.properties?.render_height ?? 6);
        const base = Number(f.properties?.render_min_height ?? 0);
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const coordinates of polys) {
          const geometry: Polygon = { type: "Polygon", coordinates };
          const key = geometryKey(geometry);
          if (seen.has(key)) continue;
          seen.add(key);
          next.push({ geometry, h: Number.isFinite(h) ? h : 6, base: Number.isFinite(base) ? base : 0 });
        }
      }
      houses = next;
      lastPick = null;
      src.setData({
        type: "FeatureCollection",
        features: next.map((part, i) => ({ type: "Feature", id: i, properties: { i, h: part.h, b: part.base }, geometry: part.geometry })),
      });
    };
    m.on("sourcedata", (e) => {
      if (e.sourceId === "openmaptiles" && (e as { tile?: unknown }).tile) pickDirty = true;
    });
    const maybeRefreshPick = () => {
      if (pickDirty && ready.current && m.getZoom() >= 13.5) refreshPick();
    };
    m.on("idle", maybeRefreshPick);
    m.on("moveend", maybeRefreshPick);

    // What a click at this point would select: the house under the point,
    // merged with its own pieces across tile edges. Hover and click both use
    // it, so the highlighted building is exactly the one that gets selected.
    const pickAt = (point: { x: number; y: number }): Picked | null => {
      if (!m.getLayer(PICK_LAYER)) return null;
      const hit = m.queryRenderedFeatures([point.x, point.y], { layers: [PICK_LAYER] })[0];
      const part = hit ? houses[Number(hit.properties?.i)] : undefined;
      if (!part) return null;
      const key = geometryKey(part.geometry);
      if (lastPick?.key === key) return lastPick.building;
      const merged = mergePieces(
        tileEdgePieces(part, houses).map((g) => ({ type: "Feature", properties: {}, geometry: g }) as Feature<Geom>),
      );
      if (!merged) return null;
      const building = { key, geometry: merged.geometry, height: part.h };
      lastPick = { key, building };
      return building;
    };

    const setHover = (picked?: Picked | null, at?: [number, number]) => {
      const key = picked?.key ?? "";
      if (key === hoverKey) return;
      hoverKey = key;
      if (!picked || !at) {
        cancelAnimationFrame(hoverAnim);
        hoverAnim = 0;
        (m.getSource(HOVER_SOURCE) as GeoJSONSource | undefined)?.setData(emptyFC());
        (m.getSource(OUTLINE_SOURCE) as GeoJSONSource | undefined)?.setData(emptyFC());
        return;
      }
      // Pushed out slightly so its walls don't z-fight the building's.
      const inflated = inflate(picked.geometry, 1.03);
      (m.getSource(HOVER_SOURCE) as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: { h: picked.height }, geometry: inflated }],
      });
      hoverPath = outlineFrom(inflated, at);
      hoverHeight = picked.height;
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
      lastPick = null;
      pickDirty = true;
      decorate(m, slow);
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

    m.on("zoomend", () => {
      latest.current.onZoom(m.getZoom());
      if (ready.current && linkData.current.length) setLinkFlow(m, linkRaf, linkData);
    });
    // A user who starts moving the map before load keeps control.
    m.on("movestart", (e) => {
      if ((e as { originalEvent?: Event }).originalEvent) flown.current = true;
    });

    // While dragging (or any mouse button is held) skip all hover work so the
    // pointer never lags behind the map.
    let dragging = false;
    const pauseHover = () => {
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      hoverRaf = 0;
      if (ready.current) setHover();
      setCursor("hidden");
      if (latest.current.mode !== "draw") m.getCanvas().style.cursor = "grabbing";
    };
    m.on("dragstart", () => {
      dragging = true;
      pauseHover();
    });
    m.on("dragend", () => {
      dragging = false;
      m.getCanvas().style.cursor = "";
      if (hoverPoint && !hoverRaf) hoverRaf = requestAnimationFrame(resolveHover);
    });

    const resolveHover = () => {
      hoverRaf = 0;
      if (!ready.current || !hoverPoint || dragging) return;
      // The ring follows the pointer with a CSS transform on a ref; no React state.
      if (fancyCursor && cursorEl.current) {
        cursorEl.current.style.transform = `translate3d(${hoverPoint.x}px, ${hoverPoint.y}px, 0)`;
      }
      if (latest.current.mode === "draw") {
        setHover();
        setCursor("hidden");
        m.getCanvas().style.cursor = "crosshair";
        return;
      }
      // Camera still easing or flying: move the ring, skip the feature query.
      if (m.isMoving()) return;
      const hit = pickAt(hoverPoint);
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
      if (dragging || e.originalEvent.buttons !== 0) {
        if (hoverRaf || hoverKey) pauseHover();
        return;
      }
      if (!hoverRaf) hoverRaf = requestAnimationFrame(resolveHover);
    });
    m.on("mouseout", () => {
      hoverPoint = null;
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      hoverRaf = 0;
      if (ready.current) setHover();
      setCursor("hidden");
      m.getCanvas().style.cursor = "";
    });

    // Rebuild a roof from its parts: one merged outline, fresh area.
    const setParts = (roof: Roof, next: Geom[], text: string) => {
      const merged = mergePieces(next.map((g) => ({ type: "Feature", properties: {}, geometry: g }) as Feature<Geom>));
      if (!merged) return;
      parts.current.set(roof.id, next);
      const [lng, lat] = centroidOf(merged.geometry);
      const areaM2 = Math.round(areaOf(merged));
      latest.current.onUpdateRoof({ ...roof, geometry: merged.geometry, areaM2, lat, lng });
      setNotice({ text, key: Date.now() });
      setLargeId(areaM2 > LARGE_ROOF_M2 ? roof.id : null);
    };

    m.on("click", (e) => {
      if (!ready.current) return;
      const p = latest.current;
      if (p.mode === "draw") {
        p.onDrawPoint([e.lngLat.lng, e.lngLat.lat]);
        return;
      }
      const picked = pickAt(e.point);
      if (!picked) return;
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
        if (touches(active.geometry, picked.geometry, PART_TOLERANCE_M)) {
          setParts(active, [...own, picked.geometry], "Part added. Tap again to remove.");
          return;
        }
      }

      const area = areaOf({ type: "Feature", properties: {}, geometry: picked.geometry });
      if (area < 8) return;
      const [lng, lat] = centroidOf(picked.geometry);
      const id = newRoofId("b");
      parts.current.set(id, [picked.geometry]);
      setLargeId(area > LARGE_ROOF_M2 ? id : null);
      p.onPick({
        id,
        label: "Selected roof",
        areaM2: Math.round(area),
        lat,
        lng,
        source: "map",
        geometry: picked.geometry,
        height: picked.height,
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
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      cancelAnimationFrame(hoverAnim);
      cancelAnimationFrame(glowRaf.current);
      cancelAnimationFrame(linkRaf.current);
      cancelAnimationFrame(anim.raf);
      glowRaf.current = 0;
      anim.raf = 0;
      linkRaf.current = 0;
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
    const links: Link[] = [];
    for (let i = 1; i < roofs.length; i++) {
      const a = roofs[i - 1];
      const b = roofs[i];
      links.push({ a: [a.lng, a.lat], b: [b.lng, b.lat], z: Math.max(a.height ?? 6, b.height ?? 6) + ROOF_LIFT + 1.5 });
    }
    linkData.current = links;
    setLinkFlow(m, linkRaf, linkData);
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

  // Shown only while the large roof that was just selected is still the
  // selected roof and still over the limit; any other selection hides it.
  const active = largeId && props.activeRoofId === largeId ? props.roofs.find((r) => r.id === largeId) : undefined;
  const large = Boolean(active && active.areaM2 > LARGE_ROOF_M2);
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
        {/* The ring stays small and see-through so the highlighted building
            under it stays visible; "select" appears beside it. */}
        <div className="flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.45)] transition-all duration-200 ease-out group-data-[over=true]:h-6 group-data-[over=true]:w-6">
          <span className="h-1 w-1 rounded-full bg-sky-500" />
        </div>
        <span className="absolute left-4 top-1 whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 opacity-0 shadow-sm transition-opacity duration-150 group-data-[over=true]:opacity-100">
          select
        </span>
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
function decorate(m: MLMap, slow: boolean) {
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

  // No 3D terrain: buildings, outlines and roofs stay exactly aligned with
  // the flat map. The Margalla Hills still read through a subtle hillshade
  // from its own DEM source.
  if (!slow) {
    m.addSource(HILLSHADE_SOURCE, {
      type: "raster-dem",
      tiles: [TERRARIUM],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 15,
      attribution: ELEVATION_CREDIT,
    });
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
  }

  // One set of buildings only: hide the basemap's own building layers.
  for (const layer of m.getStyle().layers) {
    if ("source-layer" in layer && layer["source-layer"] === "building") {
      m.setLayoutProperty(layer.id, "visibility", "none");
    }
  }

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

  // Invisible per-house pick layer (see refreshPick). Same heights as the
  // live layer; opacity 0 is never drawn but is still hit-tested.
  m.addSource(PICK_SOURCE, { type: "geojson", data: emptyFC(), tolerance: 0 });
  m.addLayer(
    {
      id: PICK_LAYER,
      type: "fill-extrusion",
      source: PICK_SOURCE,
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#000000",
        "fill-extrusion-opacity": 0,
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["get", "h"]],
        "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, ["get", "b"]],
      },
    },
    firstSymbol,
  );

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
  // Its outline: a glowing rim on top of the lifted house (a wide soft
  // ribbon plus a crisp thin one), traced on from the cursor by the hover loop.
  m.addSource(OUTLINE_SOURCE, { type: "geojson", data: emptyFC() });
  m.addLayer(
    {
      id: OUTLINE_GLOW_LAYER,
      type: "fill-extrusion",
      source: OUTLINE_SOURCE,
      minzoom: 12,
      filter: ["==", ["get", "glow"], true],
      paint: {
        "fill-extrusion-color": OUTLINE_GLOW,
        "fill-extrusion-base": ["get", "z"],
        "fill-extrusion-height": ["+", ["get", "z"], 0.15],
        "fill-extrusion-opacity": 0.45,
      },
    },
    firstSymbol,
  );
  m.addLayer(
    {
      id: OUTLINE_LAYER,
      type: "fill-extrusion",
      source: OUTLINE_SOURCE,
      minzoom: 12,
      filter: ["==", ["get", "glow"], false],
      paint: {
        "fill-extrusion-color": OUTLINE,
        "fill-extrusion-base": ["get", "z"],
        "fill-extrusion-height": ["+", ["get", "z"], 0.35],
        "fill-extrusion-opacity": 0.95,
      },
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

  // Street "network": dashes flowing from roof to roof just above the roofs
  // (drawn as thin 3D ribbons so roofs can't hide them), animated by
  // setLinkFlow.
  m.addSource("rg-links", { type: "geojson", data: emptyFC() });
  m.addLayer({
    id: LINKS_RAIL_LAYER,
    type: "fill-extrusion",
    source: "rg-links",
    filter: ["==", ["get", "rail"], true],
    paint: {
      "fill-extrusion-color": "#ffffff",
      "fill-extrusion-base": ["get", "z"],
      "fill-extrusion-height": ["+", ["get", "z"], 0.2],
      "fill-extrusion-opacity": 0.85,
    },
  });
  m.addLayer({
    id: LINKS_LAYER,
    type: "fill-extrusion",
    source: "rg-links",
    filter: ["==", ["get", "rail"], false],
    paint: {
      "fill-extrusion-color": RAIN_BLUE,
      "fill-extrusion-base": ["+", ["get", "z"], 0.2],
      "fill-extrusion-height": ["+", ["get", "z"], 0.6],
      "fill-extrusion-opacity": 0.95,
    },
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

// Network dashes, in screen pixels: 10 px dash, 6 px gap, 3 px wide,
// flowing at 40 px/s.
const DASH_PX = 10;
const GAP_PX = 6;
const LINK_WIDTH_PX = 3;
const RAIL_WIDTH_PX = 6;
const FLOW_PX_PER_S = 40;

// Draw the links as dashes and keep them flowing while there are links.
// Updates ~20 times a second from requestAnimationFrame; no React state.
function setLinkFlow(m: MLMap, raf: { current: number }, data: { current: Link[] }) {
  const draw = (t: number) => {
    const links = data.current;
    const px = links.length ? metresPerPixel(m, links[0].a[1]) : 1;
    const dash = DASH_PX * px;
    const gap = GAP_PX * px;
    const phase = ((t / 1000) * FLOW_PX_PER_S * px) % (dash + gap);
    (m.getSource("rg-links") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: links.flatMap((l) => [
        // A soft white rail under the dashes keeps them readable on blue roofs.
        { type: "Feature", properties: { z: l.z, rail: true }, geometry: railRibbon(l.a, l.b, RAIL_WIDTH_PX * px) },
        { type: "Feature", properties: { z: l.z, rail: false }, geometry: dashRibbons(l.a, l.b, phase, dash, gap, LINK_WIDTH_PX * px) },
      ]),
    });
  };
  cancelAnimationFrame(raf.current);
  raf.current = 0;
  draw(0);
  if (!data.current.length || prefersReducedMotion()) return;
  let last = 0;
  const tick = (t: number) => {
    raf.current = requestAnimationFrame(tick);
    if (t - last < 50) return;
    last = t;
    draw(t);
  };
  raf.current = requestAnimationFrame(tick);
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

// Ground metres covered by one screen pixel at the map centre's zoom
// (MapLibre uses 512 px tiles).
function metresPerPixel(m: MLMap, lat: number) {
  return (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** m.getZoom());
}

// Local metres around a reference latitude, for building ribbons.
function metresFrame(lat0: number) {
  const kx = M_PER_DEG_LNG_EQ * Math.cos((lat0 * Math.PI) / 180);
  return {
    to: (c: number[]): XY => [c[0] * kx, c[1] * M_PER_DEG_LAT],
    from: (p: XY): number[] => [p[0] / kx, p[1] / M_PER_DEG_LAT],
  };
}

// A flat quad of the given width along segment p-q (in metres), extended by
// half the width at both ends so consecutive quads close their corners.
function quad(p: XY, q: XY, width: number): XY[] {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
  const ux = (q[0] - p[0]) / len;
  const uy = (q[1] - p[1]) / len;
  const hw = width / 2;
  const a: XY = [p[0] - ux * hw, p[1] - uy * hw];
  const b: XY = [q[0] + ux * hw, q[1] + uy * hw];
  const nx = -uy * hw;
  const ny = ux * hw;
  return [
    [a[0] + nx, a[1] + ny],
    [b[0] + nx, b[1] + ny],
    [b[0] - nx, b[1] - ny],
    [a[0] - nx, a[1] - ny],
    [a[0] + nx, a[1] + ny],
  ];
}

// The outline path as ribbon quads, revealed from both ends (the cursor
// point) towards the far side: k = 0 shows nothing, k = 1 the whole outline.
function traceRibbon(path: number[][], k: number, width: number): MultiPolygon {
  if (path.length < 2 || k <= 0) return { type: "MultiPolygon", coordinates: [] };
  const f = metresFrame(path[0][1]);
  const pts = path.map(f.to);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1] || 1;
  const reach = Math.min(1, k) * (total / 2);
  const spans: [number, number][] = k >= 0.998 ? [[0, total]] : [[0, reach], [total - reach, total]];
  const at = (d: number): XY => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
  };
  const polys: number[][][][] = [];
  for (const [s0, s1] of spans) {
    if (s1 - s0 < 0.05) continue;
    const stops = [s0, ...cum.filter((c) => c > s0 && c < s1), s1];
    for (let i = 1; i < stops.length; i++) {
      if (stops[i] - stops[i - 1] < 0.01) continue;
      polys.push([quad(at(stops[i - 1]), at(stops[i]), width).map(f.from)]);
    }
  }
  return { type: "MultiPolygon", coordinates: polys };
}

// One solid ribbon from a to b.
function railRibbon(a: [number, number], b: [number, number], width: number): MultiPolygon {
  const f = metresFrame(a[1]);
  const p = f.to(a);
  const q = f.to(b);
  if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.5) return { type: "MultiPolygon", coordinates: [] };
  return { type: "MultiPolygon", coordinates: [[quad(p, q, width).map(f.from)]] };
}

// Dashes from a to b, shifted by `phase` metres so they flow towards b.
function dashRibbons(a: [number, number], b: [number, number], phase: number, dash: number, gap: number, width: number): MultiPolygon {
  const f = metresFrame(a[1]);
  const p = f.to(a);
  const q = f.to(b);
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const polys: number[][][][] = [];
  if (len < 0.5) return { type: "MultiPolygon", coordinates: polys };
  const point = (d: number): XY => [p[0] + ((q[0] - p[0]) * d) / len, p[1] + ((q[1] - p[1]) * d) / len];
  const period = dash + gap;
  for (let start = phase - period; start < len; start += period) {
    const s0 = Math.max(0, start);
    const s1 = Math.min(len, start + dash);
    if (s1 - s0 > 0.1) polys.push([quad(point(s0), point(s1), width).map(f.from)]);
  }
  return { type: "MultiPolygon", coordinates: polys };
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

// A house split across tile edges comes back as several parts. Tiles carry a
// small buffer, so the pieces of one house overlap each other near the edge,
// while neighbouring houses only share a wall. Grow the picked part with
// parts that overlap it (not merely touch), have the same height, and sit
// near a tile edge.
function tileEdgePieces(part: Part, all: Part[]): Geom[] {
  if (!nearTileEdge(part.geometry)) return [part.geometry];
  const rest = all.filter((x) => x !== part && x.h === part.h && nearTileEdge(x.geometry));
  const picked: Geom[] = [part.geometry];
  let grew = true;
  while (grew && picked.length < 8) {
    grew = false;
    for (let i = rest.length - 1; i >= 0; i--) {
      if (picked.some((g) => overlaps(g, rest[i].geometry))) {
        picked.push(rest.splice(i, 1)[0].geometry);
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

// True if the shapes share interior area: a vertex of one lies inside the
// other by more than 0.3 m, or two edges properly cross. Shared walls and
// touching corners do not count.
function overlaps(a: Geom, b: Geom): boolean {
  const lat0 = ringsOf(a)[0]?.[0]?.[1] ?? 0;
  const kx = M_PER_DEG_LNG_EQ * Math.cos((lat0 * Math.PI) / 180);
  const toXY = (rings: number[][][]) => rings.map((r) => r.map(([x, y]) => [x * kx, y * M_PER_DEG_LAT] as XY));
  const ra = toXY(ringsOf(a));
  const rb = toXY(ringsOf(b));
  if (!ra[0]?.length || !rb[0]?.length) return false;
  const ba = bboxOf(ra);
  const bb = bboxOf(rb);
  if (ba[0] > bb[2] || bb[0] > ba[2] || ba[1] > bb[3] || bb[1] > ba[3]) return false;
  const deepInside = (p: XY, ring: XY[]) => {
    if (!inRing(p, ring)) return false;
    for (let i = 0; i < ring.length - 1; i++) if (pointSegDist(p, ring[i], ring[i + 1]) < 0.3) return false;
    return true;
  };
  if (ra[0].some((p) => deepInside(p, rb[0])) || rb[0].some((p) => deepInside(p, ra[0]))) return true;
  for (let i = 0; i < ra[0].length - 1; i++) {
    for (let j = 0; j < rb[0].length - 1; j++) {
      const [p, q, r, t] = [ra[0][i], ra[0][i + 1], rb[0][j], rb[0][j + 1]];
      if (cross(r, t, p) * cross(r, t, q) < 0 && cross(p, q, r) * cross(p, q, t) < 0) return true;
    }
  }
  return false;
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
