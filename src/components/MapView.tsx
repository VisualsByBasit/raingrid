"use client";

import { Map as MLMap, NavigationControl, AttributionControl, setWorkerUrl } from "maplibre-gl";
import type { GeoJSONSource, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";
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

// Keep the style itself local and small. If OpenFreeMap's vector source is
// unavailable, the dark background and prebaked OSM demo footprints still work.
const STYLE: StyleSpecification = {
  version: 8,
  name: "RAIN//GRID resilient dark map",
  sources: {
    openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
    "static-buildings": { type: "geojson", data: "/data/footprints/islamabad-demo.geojson" },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#07090c" } },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": "#0b2535", "fill-opacity": 0.9 },
    },
    {
      id: "roads",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      paint: { "line-color": "#27313d", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 17, 2.2] },
    },
    {
      id: STATIC_BUILDING_LAYER,
      type: "fill-extrusion",
      source: "static-buildings",
      minzoom: 12,
      paint: {
        "fill-extrusion-color": "#1a2330",
        "fill-extrusion-height": ["coalesce", ["get", "height"], 6],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.9,
      },
    },
  ],
};

// Served from /public (see scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  // Init once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new MLMap({
      container: el.current,
      style: STYLE,
      center: CITY.center,
      zoom: CITY.zoom,
      pitch: 40,
      bearing: -20,
      maxBounds: CITY.bounds,
      attributionControl: false,
    });
    map.current = m;
    m.addControl(new NavigationControl({ visualizePitch: true }), "bottom-left");
    m.addControl(
      new AttributionControl({
        compact: true,
        customAttribution: "Rain data: PMD via APP, ARY, ProPakistani, Arab News · Static footprints: © OpenStreetMap contributors",
      }),
      "bottom-left",
    );

    m.on("error", (e) => {
      const msg = String((e as unknown as { error?: { message?: string } }).error?.message ?? "");
      if (/webgl context|failed to initialize webgl/i.test(msg)) latest.current.onMapError();
    });

    m.on("load", () => {
      // Live buildings come from OpenFreeMap. The static layer underneath is
      // available independently for the five demo sectors.
      if (m.getSource("openmaptiles")) {
        m.addLayer({
          id: BUILDING_LAYER,
          type: "fill-extrusion",
          source: "openmaptiles",
          "source-layer": "building",
          minzoom: 13.5,
          paint: {
            "fill-extrusion-color": "#1a2330",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
            "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
            "fill-extrusion-opacity": 0.9,
          },
        });
      }

      m.addSource("rg-roofs", { type: "geojson", data: emptyFC() });
      m.addLayer({
        id: "rg-roofs",
        type: "fill-extrusion",
        source: "rg-roofs",
        paint: {
          "fill-extrusion-color": ["case", ["get", "active"], "#38bdf8", "#0e7490"],
          "fill-extrusion-height": ["+", ["get", "h"], 0.6],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.95,
        },
      });

      m.addSource("rg-links", { type: "geojson", data: emptyFC() });
      m.addLayer({
        id: "rg-links",
        type: "line",
        source: "rg-links",
        paint: { "line-color": "#38bdf8", "line-width": 2, "line-opacity": 0.7, "line-dasharray": [2, 2] },
      });

      m.addSource("rg-draw", { type: "geojson", data: emptyFC() });
      m.addLayer({
        id: "rg-draw-fill",
        type: "fill",
        source: "rg-draw",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#38bdf8", "fill-opacity": 0.25 },
      });
      m.addLayer({
        id: "rg-draw-line",
        type: "line",
        source: "rg-draw",
        paint: { "line-color": "#38bdf8", "line-width": 2 },
      });
      m.addLayer({
        id: "rg-draw-pts",
        type: "circle",
        source: "rg-draw",
        filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-radius": 5, "circle-color": "#07090c", "circle-stroke-color": "#38bdf8", "circle-stroke-width": 2 },
      });

      ready.current = true;
      syncRoofs();
      syncDraw();
      latest.current.onZoom(m.getZoom());
    });

    m.on("zoomend", () => latest.current.onZoom(m.getZoom()));

    m.on("mousemove", (e) => {
      if (!ready.current) return;
      if (latest.current.mode === "draw") {
        m.getCanvas().style.cursor = "crosshair";
        return;
      }
      const layers = selectableBuildingLayers(m);
      const hit = layers.length ? m.queryRenderedFeatures(e.point, { layers }) : [];
      m.getCanvas().style.cursor = hit.length ? "pointer" : "";
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
      if (f.id !== undefined && f.id !== null) {
        pieces = m
          .queryRenderedFeatures({ layers })
          .filter((x) => x.id === f.id);
        if (!pieces.length) pieces = [f];
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
    });

    return () => {
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

  // Roof glows brighter while it rains.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current || !m.getLayer("rg-roofs")) return;
    m.setPaintProperty("rg-roofs", "fill-extrusion-color", [
      "case",
      ["get", "active"],
      props.raining ? "#7dd3fc" : "#38bdf8",
      "#0e7490",
    ]);
  }, [props.raining]);

  useEffect(() => {
    const t = props.flyTarget;
    if (!t || !map.current) return;
    map.current.flyTo({ center: [t.lng, t.lat], zoom: t.zoom, pitch: t.zoom > 15 ? 55 : 40, speed: 1.4, essential: true });
  }, [props.flyTarget]);

  // Inline position: maplibre-gl.css sets .maplibregl-map { position: relative }, which
  // would beat Tailwind utilities (unlayered CSS wins over @layer utilities).
  return <div ref={el} style={{ position: "absolute", inset: 0 }} aria-label="Map of Islamabad" role="application" />;
}

function emptyFC(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function selectableBuildingLayers(map: MLMap): string[] {
  return [BUILDING_LAYER, STATIC_BUILDING_LAYER].filter((layer) => Boolean(map.getLayer(layer)));
}
