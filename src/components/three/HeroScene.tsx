"use client";

import { Environment, Lightformer, useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, SMAA, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useState, type RefObject } from "react";
import { reportProgress } from "../loader/progress";
import Droplet, { type Slot } from "./Droplet";
import Plate from "./Plate";
import Rain from "./Rain";
import { createRig, stepRig, type Rig } from "./rig";
import type { SceneTier } from "./sceneMode";

// The hero's one WebGL scene: the living Islamabad plate, GPU rain and the
// refracting droplet, with a light bloom, vignette and grain. It renders
// only while the hero is on screen and the tab is visible, and it is
// unmounted with the intro, so the map app never runs it.

function CameraRig({ rig, scroller }: { rig: Rig; scroller: RefObject<HTMLElement | null> }) {
  useFrame((state, dt) => {
    stepRig(rig, state.clock.elapsedTime, Math.min(dt, 0.1), state.pointer, scroller.current?.scrollTop ?? 0, state.size.height);
  }, -2);
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
        <Rain phone={phone} />
        <Lights />
        <Droplet rig={rig} tier={tier} slot={slot} />
        {/* No MSAA: multisampled composer targets render black under
            Chrome's D3D11 backend on Windows. SMAA smooths the droplet's edge. */}
        <EffectComposer multisampling={0}>
          <SMAA />
          <Bloom mipmapBlur intensity={0.35} luminanceThreshold={0.72} luminanceSmoothing={0.2} />
          <Vignette offset={0.3} darkness={0.55} />
          <Noise premultiply opacity={0.3} />
        </EffectComposer>
        <Ready onReady={onReady} />
      </Suspense>
    </>
  );
}

export default function HeroScene({
  tier,
  eventSource,
  anchor,
  scroller,
  onReady,
}: {
  tier: SceneTier;
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
      dpr={[1, 1.75]}
      frameloop={onScreen && tabVisible ? "always" : "demand"}
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
      <Scene rig={rig} tier={tier} slot={slot} scroller={scroller} onReady={onReady} />
    </Canvas>
  );
}
