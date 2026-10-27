"use client";

import { Environment, Lightformer, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, SMAA, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { reportProgress } from "../loader/progress";
import Droplet, { type Slot } from "./Droplet";
import Plate from "./Plate";
import Rain from "./Rain";
import { createRig, stepRig, type Rig } from "./rig";
import { PROBE_MS, PROBE_SKIP } from "@/lib/quality";
import { logQuality, type SceneTier } from "./sceneMode";

// The hero's one WebGL scene: the living Islamabad plate, GPU rain and the
// refracting droplet, with a light bloom, vignette and grain. It renders
// on demand: every frame while the hero is on screen and the tab is
// visible, a few frames a second while the loader still covers it, and not
// at all otherwise. It is unmounted with the intro, so the map app never
// runs it. The medium tier (integrated GPUs, phones) renders at 1x with no
// bloom or SMAA, a fixed 256 px droplet buffer, half the rain and 30 fps.
// Nothing here adapts on its own: a tier only changes when the probe below
// reports a slow start and the hero steps down, once.

function CameraRig({ rig, scroller }: { rig: Rig; scroller: RefObject<HTMLElement | null> }) {
  useFrame((state, dt) => {
    stepRig(rig, state.clock.elapsedTime, Math.min(dt, 0.1), state.pointer, scroller.current?.scrollTop ?? 0, state.size.height);
  }, -2);
  return null;
}

// The render clock for frameloop="demand". Full rate (or the tier's cap)
// while the hero is visible; about 8 fps while the loader covers it, enough
// to compile and warm up the scene without competing with the loader;
// nothing when the hero is off screen or the tab is hidden.
function Driver({ active, warmOnly, fps }: { active: boolean; warmOnly: boolean; fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!active) return;
    // A few ms of slack so a 60 Hz display lands exactly on every 2nd frame.
    const gap = warmOnly ? 120 : fps ? 1000 / fps - 4 : 0;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last >= gap) {
        last = t;
        invalidate();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, warmOnly, fps, invalidate]);
  return null;
}

// Times the first ~2 s of real frames once the hero is showing (after a few
// warm-up frames) and reports the gaps once. Pauses if the hero leaves the
// screen; a gap of a second or more (tab switch) is not counted.
function Probe({ active, onResult }: { active: boolean; onResult: (frameMs: number[]) => void }) {
  const state = useRef({ seen: 0, last: 0, total: 0, frames: [] as number[], done: false });
  useFrame(() => {
    const p = state.current;
    if (!active || p.done) return;
    const now = performance.now();
    const dt = now - p.last;
    p.last = now;
    if (++p.seen <= PROBE_SKIP || dt >= 1000) return;
    p.frames.push(dt);
    p.total += dt;
    if (p.total >= PROBE_MS) {
      p.done = true;
      onResult(p.frames);
    }
  });
  useEffect(() => {
    // Restart the warm-up after a pause, so the first frame back is skipped.
    if (!active) state.current.seen = Math.min(state.current.seen, PROBE_SKIP - 1);
  }, [active]);
  return null;
}

// Mounted once everything under Suspense has loaded.
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    reportProgress("scene", 1);
    onReady();
  }, [onReady]);
  return null;
}

function Lights() {
  return (
    <Environment resolution={256} frames={1}>
      {/* White softboxes, top left. */}
      <Lightformer form="rect" intensity={8} color="#ffffff" position={[-4, 4, 3]} scale={[4, 2.5, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={2} color="#ffffff" position={[-2, 5, -1]} scale={[3, 1.2, 1]} target={[0, 0, 0]} />
      {/* Rain-blue ring behind. */}
      <Lightformer form="ring" intensity={3} color="#38bdf8" position={[0, 0, -6]} scale={4} target={[0, 0, 0]} />
      {/* Leaf-green strip, low right. */}
      <Lightformer form="rect" intensity={1.6} color="#10b981" position={[4, -3, 2]} scale={[5, 0.5, 1]} target={[0, 0, 0]} />
      {/* Warm gold strip, upper right, where the sun breaks through. */}
      <Lightformer form="rect" intensity={3.5} color="#ffd9a0" position={[4, 4, -2]} scale={[4, 0.7, 1]} target={[0, 0, 0]} />
    </Environment>
  );
}

function Scene({
  rig,
  tier,
  slot,
  scroller,
  onReady,
}: {
  rig: Rig;
  tier: SceneTier;
  slot: Slot;
  scroller: RefObject<HTMLElement | null>;
  onReady: () => void;
}) {
  const size = useThree((s) => s.size);
  const phone = size.width < 768 || size.width / size.height < 0.8;
  return (
    <>
      <CameraRig rig={rig} scroller={scroller} />
      <Suspense fallback={null}>
        <Plate rig={rig} phone={phone} />
        <Rain sparse={phone || tier !== "high"} />
        <Lights />
        <Droplet rig={rig} tier={tier} slot={slot} />
        {/* No MSAA: multisampled composer targets render black under
            Chrome's D3D11 backend on Windows. SMAA smooths the droplet's edge.
            Medium skips SMAA and bloom; vignette and grain are one cheap pass. */}
        {tier === "high" ? (
          <EffectComposer multisampling={0}>
            <SMAA />
            <Bloom mipmapBlur intensity={0.35} luminanceThreshold={0.72} luminanceSmoothing={0.2} />
            <Vignette offset={0.3} darkness={0.55} />
            <Noise premultiply opacity={0.3} />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={0}>
            <Vignette offset={0.3} darkness={0.55} />
            <Noise premultiply opacity={0.3} />
          </EffectComposer>
        )}
        <Ready onReady={onReady} />
      </Suspense>
    </>
  );
}

export default function HeroScene({
  tier,
  ready,
  eventSource,
  anchor,
  scroller,
  onReady,
  probe,
  onProbe,
}: {
  tier: SceneTier;
  // Time the first frames once the hero shows (once per visit).
  probe: boolean;
  onProbe: (frameMs: number[]) => void;
  // False while the loader still covers the hero.
  ready: boolean;
  // The hero element: pointer events and the canvas size come from it.
  eventSource: RefObject<HTMLElement | null>;
  // Where the droplet hangs, as a DOM box inside the hero.
  anchor: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
  onReady: () => void;
}) {
  const rig = useMemo(() => createRig(), []);
  const [slot, setSlot] = useState<Slot>({ x: 0.75, y: 0.5, h: 0.5 });
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  // Device pixels per CSS pixel: 1 on medium, at most 1.5 on high.
  const dpr = tier === "high" ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
  const fps = tier === "high" ? 0 : 30;

  useEffect(() => {
    logQuality(
      `applied ${tier}: dpr ${dpr}, bloom ${tier === "high" ? "on" : "off"}, droplet buffer ${tier === "high" ? 1024 : 256}, ` +
        `rain ${tier === "high" ? "full" : "half"}, fps ${fps || "uncapped"}`,
    );
  }, [tier, dpr, fps]);

  // Loader: the textures' loading progress, until <Ready> reports 1.
  const { progress } = useProgress();
  useEffect(() => {
    reportProgress("scene", (progress / 100) * 0.9);
  }, [progress]);

  // Track the droplet slot relative to the hero (both scroll together, so
  // only layout changes move it).
  useEffect(() => {
    const host = eventSource.current;
    const box = anchor.current;
    if (!host || !box) return;
    const measure = () => {
      const h = host.getBoundingClientRect();
      const a = box.getBoundingClientRect();
      if (!h.width || !h.height || !a.height) return;
      setSlot({ x: (a.left + a.width / 2 - h.left) / h.width, y: (a.top + a.height / 2 - h.top) / h.height, h: a.height / h.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    ro.observe(box);
    return () => ro.disconnect();
  }, [eventSource, anchor]);

  useEffect(() => {
    const el = eventSource.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    const vis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, [eventSource]);

  return (
    <Canvas
      flat
      dpr={dpr}
      frameloop="demand"
      camera={{ position: [0, 0, 6], fov: 35, near: 0.1, far: 50 }}
      gl={{ alpha: true, antialias: false, stencil: false, powerPreference: "high-performance" }}
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      // Windows' D3D shader compiler logs harmless constant-folding
      // warnings, which three would echo to the console on every compile.
      onCreated={({ gl }) => {
        gl.debug.checkShaderErrors = false;
      }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden
    >
      <Driver active={onScreen && tabVisible} warmOnly={!ready} fps={fps} />
      {probe && <Probe active={ready && onScreen && tabVisible} onResult={onProbe} />}
      <Scene rig={rig} tier={tier} slot={slot} scroller={scroller} onReady={onReady} />
    </Canvas>
  );
}
