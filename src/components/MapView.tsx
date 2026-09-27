"use client";

import { Map as MLMap, NavigationControl, AttributionControl, setWorkerUrl } from "maplibre-gl";
import type {
  ExpressionSpecification,
  FeatureIdentifier,
  GeoJSONSource,
  MapGeoJSONFeature,
  StyleSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { useEffect, useLayoutEffect, useRef } from "react";
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
  onZoom: (z: number) => void;
  onMapError: () => void;
  flyTarget: FlyTarget | null;
  raining: boolean;
}

const BUILDING_LAYER = "rg-buildings";
const STATIC_BUILDING_LAYER = "rg-static-buildings";
const HILLSHADE_LAYER = "rg-hillshade";
const TERRAIN_SOURCE = "rg-terrain";
const HILLSHADE_SOURCE = "rg-hillshade-dem";
const GLOW_LAYER = "rg-roof-glow";
const HALO_LAYER = "rg-roof-halo";
const HOVER_SOURCE = "rg-hover";
const LARGE_ROOF_M2 = 5000;

const ROOF_ACTIVE = "#0ea5e9";
const ROOF_ACTIVE_RAIN = "#38bdf8";
// Green (#10b981) is reserved for neighbour roofs.
const ROOF_OTHER = "#7dd3fc";

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

const HOVER_COLOR = "#a5d8f7";
const HOVER_LIFT = 3;

// Very light grey to pale blue by height.
function buildingColor(height: ExpressionSpecification): ExpressionSpecification {
  return ["interpolate", ["linear"], height, 0, "#f3f5f8", 12, "#e6edf4", 30, "#d6e4f1", 80, "#c2d8ee"];
}

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const flown = useRef(false);
  const glowRaf = useRef(0);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  // Init once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const reduceMotion = prefersReducedMotion();
    const slow = isSlowDevice();
    // Start wide and low for the fly-in, unless we are about to fly somewhere else.
    const introStart = !reduceMotion && !latest.current.flyTarget;

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

    // Hover, resolved at most once per frame. Static footprints have real
    // unique ids, so they use feature-state. Live OpenFreeMap buildings don't,
    // so the hovered piece is copied into its own "rg-hover" source instead.
    let hovered: FeatureIdentifier | null = null;
    let hoverKey = "";
    let hoverPoint: { x: number; y: number } | null = null;
    let hoverRaf = 0;
    const setHover = (hit?: MapGeoJSONFeature) => {
      const next: FeatureIdentifier | null =
        hit && hit.layer.id === STATIC_BUILDING_LAYER && hit.id !== undefined && hit.id !== null
          ? { id: hit.id, source: hit.source }
          : null;
      if (hovered?.id !== next?.id) {
        if (hovered) m.setFeatureState(hovered, { hover: false });
        hovered = next;
        if (hovered) m.setFeatureState(hovered, { hover: true });
      }
      const live = hit && hit.layer.id === BUILDING_LAYER && isPolygonal(hit.geometry) ? hit : undefined;
      const key = live ? geometryKey(live.geometry as Polygon | MultiPolygon) : "";
      if (key === hoverKey) return;
      hoverKey = key;
      const h = Number(live?.properties?.render_height ?? 6);
      (m.getSource(HOVER_SOURCE) as GeoJSONSource | undefined)?.setData(
        live
          ? {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: { h: Number.isFinite(h) ? h : 6 },
                  // Pushed out slightly so its walls don't z-fight the building's.
                  geometry: inflate(live.geometry as Polygon | MultiPolygon, 1.03),
                },
              ],
            }
          : emptyFC(),
      );
    };

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

    m.on("style.load", () => {
      styleLoaded = true;
      window.clearTimeout(styleTimer);
      hovered = null;
      hoverKey = "";
      decorate(m, slow);
      ready.current = true;
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
        m.getCanvas().style.cursor = "crosshair";
        return;
      }
      const layers = selectableBuildingLayers(m);
      const hit = layers.length ? m.queryRenderedFeatures([hoverPoint.x, hoverPoint.y], { layers })[0] : undefined;
      m.getCanvas().style.cursor = hit ? "pointer" : "";
      setHover(hit);
    };
    m.on("mousemove", (e) => {
      hoverPoint = e.point;
      if (!hoverRaf) hoverRaf = requestAnimationFrame(resolveHover);
    });
    m.on("mouseout", () => {
      hoverPoint = null;
      if (ready.current) setHover();
      m.getCanvas().style.cursor = "";
    });

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
      let pieces: MapGeoJSONFeature[] = [f];
      if (f.layer.id === STATIC_BUILDING_LAYER) {
        // Static footprints have real unique ids.
        if (f.id !== undefined && f.id !== null) {
          pieces = m
            .queryRenderedFeatures({ layers: [f.layer.id] })
            .filter((x) => x.id === f.id);
          if (!pieces.length) pieces = [f];
        }
      } else {
        // Live building ids are not unique: never match by id.
        pieces = tileEdgePieces(m, f);
      }
      const merged = mergePieces(
        pieces
          .filter((x) => x.geometry.type === "Polygon" || x.geometry.type === "MultiPolygon")
          .map((x) => ({ type: "Feature", properties: {}, geometry: x.geometry }) as Feature<Polygon | MultiPolygon>),
      );
      if (!merged) return;
      const area = areaOf(merged);
      if (area < 8) return;
      const [lng, lat] = centroidOf(merged.geometry);
      const h = Number(f.properties?.render_height ?? f.properties?.height ?? 6);
      p.onPick({
        id: newRoofId("b"),
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

    return () => {
      window.clearTimeout(styleTimer);
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      cancelAnimationFrame(glowRaf.current);
      glowRaf.current = 0;
      m.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);

  function syncRoofs() {
    const m = map.current;
    if (!m || !ready.current) return;
    const { roofs, activeRoofId } = latest.current;
    const withGeom = roofs.filter((r) => r.geometry);
    (m.getSource("rg-roofs") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: withGeom.map((r) => ({
        type: "Feature",
        properties: { active: r.id === activeRoofId, h: r.height ?? 6 },
        geometry: r.geometry!,
      })),
    });
    setGlow(m, glowRaf, withGeom.some((r) => r.id === activeRoofId));
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
    if (!m || !ready.current || !m.getLayer("rg-roofs")) return;
    m.setPaintProperty("rg-roofs", "fill-extrusion-color", roofColor(props.raining));
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

  // Inline position: maplibre-gl.css sets .maplibregl-map { position: relative }, which
  // would beat Tailwind utilities (unlayered CSS wins over @layer utilities).
  const active = props.roofs.find((r) => r.id === props.activeRoofId);
  const large = active?.source === "map" && active.areaM2 > LARGE_ROOF_M2;
  return (
    <>
      <div ref={el} style={{ position: "absolute", inset: 0 }} aria-label="Map of Islamabad" role="application" />
      {large && (
        <div
          role="status"
          className="glass pointer-events-none absolute left-1/2 top-28 z-10 max-w-[90vw] -translate-x-1/2 rounded-full px-4 py-1.5 text-center text-xs text-fg md:top-14"
        >
          Large building. Check the area, or draw your roof instead.
        </div>
      )}
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

  // Mustafa's prebaked OSM footprints for the five demo sectors.
  m.addSource("static-buildings", {
    type: "geojson",
    data: "/data/footprints/islamabad-demo.geojson",
    promoteId: "id",
  });
  const staticHeight: ExpressionSpecification = ["coalesce", ["get", "height"], 6];
  const staticHover: ExpressionSpecification = ["boolean", ["feature-state", "hover"], false];
  m.addLayer(
    {
      id: STATIC_BUILDING_LAYER,
      type: "fill-extrusion",
      source: "static-buildings",
      minzoom: 12,
      paint: {
        "fill-extrusion-color": ["case", staticHover, HOVER_COLOR, buildingColor(staticHeight)],
        "fill-extrusion-height": ["+", staticHeight, ["case", staticHover, HOVER_LIFT, 0]],
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

    // The hovered live building, lifted and tinted.
    m.addSource(HOVER_SOURCE, { type: "geojson", data: emptyFC() });
    m.addLayer(
      {
        id: HOVER_SOURCE,
        type: "fill-extrusion",
        source: HOVER_SOURCE,
        minzoom: 14,
        paint: {
          "fill-extrusion-color": HOVER_COLOR,
          "fill-extrusion-height": ["+", ["get", "h"], HOVER_LIFT],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.95,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      firstSymbol,
    );
  }

  // Selected roof: a blue cap slightly taller than the building, a thin
  // glowing slab above it, and a soft halo on the ground.
  m.addSource("rg-roofs", { type: "geojson", data: emptyFC() });
  m.addLayer({
    id: HALO_LAYER,
    type: "line",
    source: "rg-roofs",
    filter: ["==", ["get", "active"], true],
    paint: { "line-color": ROOF_ACTIVE, "line-width": 10, "line-blur": 8, "line-opacity": 0.4 },
  });
  m.addLayer({
    id: "rg-roofs",
    type: "fill-extrusion",
    source: "rg-roofs",
    paint: {
      "fill-extrusion-color": roofColor(false),
      "fill-extrusion-height": ["+", ["get", "h"], 1.2],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.95,
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
      "fill-extrusion-base": ["+", ["get", "h"], 1.2],
      "fill-extrusion-height": ["+", ["get", "h"], 2],
      "fill-extrusion-opacity": 0.3,
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

function disableTerrain(m: MLMap) {
  try {
    m.setTerrain(null);
    if (m.getLayer(HILLSHADE_LAYER)) m.removeLayer(HILLSHADE_LAYER);
  } catch {
    // Map may already be gone; nothing to undo.
  }
}

function roofColor(raining: boolean): ExpressionSpecification {
  return ["case", ["get", "active"], raining ? ROOF_ACTIVE_RAIN : ROOF_ACTIVE, ROOF_OTHER];
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

function isPolygonal(g: MapGeoJSONFeature["geometry"]): g is Polygon | MultiPolygon {
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
      const g = rest[i].geometry as Polygon | MultiPolygon;
      if (picked.some((p) => touches(p.geometry as Polygon | MultiPolygon, g, 0.5))) {
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

function ringsOf(g: Polygon | MultiPolygon): number[][][] {
  return g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
}

function nearTileEdge(g: Polygon | MultiPolygon): boolean {
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
function touches(a: Polygon | MultiPolygon, b: Polygon | MultiPolygon, tol: number): boolean {
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
function geometryKey(g: Polygon | MultiPolygon): string {
  const ring = ringsOf(g)[0] ?? [];
  return `${ring.length}:${ring[0]?.[0]}:${ring[0]?.[1]}`;
}

// Scale a shape about its centre.
function inflate(g: Polygon | MultiPolygon, k: number): Polygon | MultiPolygon {
  const [cx, cy] = centroidOf(g);
  const scale = (ring: number[][]) => ring.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
  return g.type === "Polygon"
    ? { type: "Polygon", coordinates: g.coordinates.map(scale) }
    : { type: "MultiPolygon", coordinates: g.coordinates.map((poly) => poly.map(scale)) };
}

function emptyFC(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function selectableBuildingLayers(map: MLMap): string[] {
  return [BUILDING_LAYER, STATIC_BUILDING_LAYER].filter((layer) => Boolean(map.getLayer(layer)));
}
