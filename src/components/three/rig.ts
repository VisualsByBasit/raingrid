import * as THREE from "three";

// Shared, mutable per-frame motion for the hero scene. Written once per frame
// by <CameraRig>, read by the plate, rain and droplet. No React state.
export interface Rig {
  // Camera offset in screen fractions (drift + pointer + scroll).
  offset: THREE.Vector2;
  // Slow dolly, 1 = no zoom.
  zoom: number;
  // Smoothed pointer, -1..1.
  pointer: THREE.Vector2;
  // Hero scroll in viewport heights, and its smoothed velocity per second.
  scroll: number;
  scrollVel: number;
}

export function createRig(): Rig {
  return { offset: new THREE.Vector2(), zoom: 1, pointer: new THREE.Vector2(), scroll: 0, scrollVel: 0 };
}

const LOOP_S = 20;
const DRIFT = 0.012;
const POINTER = 0.015;
const SCROLL = 0.03;

// Camera drift: a 20 s Lissajous (1:2) pan and a gentle dolly, plus pointer
// and scroll parallax. Offsets stay inside the plate's 6% overscan.
export function stepRig(rig: Rig, t: number, dt: number, pointer: THREE.Vector2, scrollTop: number, viewH: number) {
  const k = 1 - Math.exp(-dt * 3);
  rig.pointer.x += (pointer.x - rig.pointer.x) * k;
  rig.pointer.y += (pointer.y - rig.pointer.y) * k;

  const scroll = viewH > 0 ? scrollTop / viewH : 0;
  const vel = dt > 0 ? (scroll - rig.scroll) / dt : 0;
  rig.scrollVel += (vel - rig.scrollVel) * (1 - Math.exp(-dt * 8));
  rig.scroll = scroll;

  const w = (Math.PI * 2 * t) / LOOP_S;
  const sx = Math.sin(w) * DRIFT;
  const sy = Math.sin(w * 2 + 0.6) * DRIFT * 0.5;
  rig.offset.set(
    // The camera leans toward the pointer, so near layers slide away from it.
    sx - rig.pointer.x * POINTER,
    sy - rig.pointer.y * POINTER * 0.6 + Math.min(scroll, 1) * SCROLL,
  );
  rig.zoom = 1 + 0.008 * (0.5 - 0.5 * Math.cos(w));
}
