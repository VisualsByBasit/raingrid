"use client";

import { MeshTransmissionMaterial } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { createNoise3D } from "simplex-noise";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seeded } from "./random";
import type { Rig } from "./rig";
import type { SceneTier } from "./sceneMode";

// A crystal clear teardrop hanging in the hero, refracting the living plate
// behind it (same scene, so hills, mosque and street are lensed inside it).
// The surface is fluid on the CPU: an idle simplex wobble along the normals,
// pointer ripples, ripples from tiny drops dripping into it, and a squash and
// stretch from scroll velocity. A fresnel shell adds the bright rim and a
// soft cyan glow sits at its base.

const TIP_Y = 1.35;
const RIPPLE_S = 0.9;
const MAX_RIPPLES = 3;
const MINI_DROPS = 4;
const DRIP_PERIOD = 3.6;
const FALL_S = 0.7;
const FALL_H = 2.4;
// Share of the surface motion's normal change that reaches the shading.
const NORMAL_KEEP = 0.3;

type Ripple = { x: number; y: number; z: number; t0: number; amp: number };

// Icosphere shaped to a teardrop: the upper half narrows to a tip
// (x, z scaled by pow(1 - y * 0.85, 1.25)), y is stretched 1.35 and the
// bottom flattened a little. The narrowing eases in from the equator
// (y^2 / (y + 0.3) * 1.3 matches y at the tip but has no slope at y = 0), so
// the refraction shows no crease there. userData.thin holds each vertex's
// width factor, so surface motion can stay small near the thin tip.
export function teardropGeometry(detail: number): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const thin = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    let s = 1;
    if (y > 0) {
      const eased = ((y * y) / (y + 0.3)) * 1.3;
      s = Math.pow(1 - eased * 0.85, 1.25);
      x *= s;
      z *= s;
    } else {
      y *= 1 - 0.15 * y * y;
    }
    y *= 1.35;
    pos.setXYZ(i, x, y, z);
    thin[i] = Math.min(1, s * 1.6);
  }
  g.computeVertexNormals();
  // The moving surface never leaves this sphere, so it is set once.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.1, 0), 1.6);
  g.userData.thin = thin;
  return g;
}

const rimVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const rimFragment = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 3.0);
    float top = 0.55 + 0.45 * normalize(vN).y;
    vec3 c = mix(vec3(0.22, 0.74, 0.97), vec3(1.0), 0.55 + 0.45 * top);
    gl_FragColor = vec4(c * f * top * 1.5, 1.0);
  }
`;
const glowFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float g = exp(-r * r * 3.2) * (0.85 + 0.15 * sin(uTime * 0.8));
    gl_FragColor = vec4(vec3(0.13, 0.62, 0.9) * g * 0.55, 1.0);
  }
`;
const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The droplet slot in canvas fractions: centre x, centre y (from the top)
// and height.
export interface Slot {
  x: number;
  y: number;
  h: number;
}

export default function Droplet({ rig, tier, slot }: { rig: Rig; tier: SceneTier; slot: Slot }) {
  const viewport = useThree((s) => s.viewport);
  const high = tier === "high";

  const geometry = useMemo(() => teardropGeometry(high ? 64 : 24), [high]);
  // Rest shape, copied once; the live geometry is displaced from it.
  const rest = useMemo(() => {
    const p = (geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const n = (geometry.getAttribute("normal") as THREE.BufferAttribute).array as Float32Array;
    return { p: p.slice(), n: n.slice(), thin: geometry.userData.thin as Float32Array };
  }, [geometry]);
  const noise3D = useMemo(() => createNoise3D(seeded(21)), []);
  const proxy = useMemo(() => teardropGeometry(3), []);

  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const rim = useRef<THREE.Mesh>(null);
  const drops = useRef<(THREE.Mesh | null)[]>([]);
  const ripples = useRef<Ripple[]>([]);
  const lastHover = useRef(0);
  const dropPhase = useRef<number[]>(Array(MINI_DROPS).fill(0));
  const squash = useRef(0);
  const normalSums = useRef<Float32Array | null>(null);

  const rimMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: rimVertex,
        fragmentShader: rimFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  const glow = useRef<THREE.ShaderMaterial>(null);
  const glowUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  // Layout follows the hero's droplet slot (right column on desktop, above
  // the headline on phones). The teardrop spans y -1.15..1.35 at scale 1.
  const layout = useMemo(() => {
    const { width: vw, height: vh } = viewport;
    const s = (slot.h * vh * 0.8) / 2.5;
    return { x: (slot.x - 0.5) * vw, y: (0.5 - slot.y) * vh - 0.1 * s, s };
  }, [viewport, slot]);

  const addRipple = (x: number, y: number, z: number, amp: number, t: number) => {
    const list = ripples.current;
    list.push({ x, y, z, t0: t, amp });
    if (list.length > MAX_RIPPLES) list.shift();
  };

  const onHover = (e: ThreeEvent<PointerEvent>) => {
    const b = body.current;
    if (!b) return;
    const now = performance.now() / 1000;
    if (now - lastHover.current < 0.15) return;
    lastHover.current = now;
    const local = b.worldToLocal(e.point.clone());
    addRipple(local.x, local.y, local.z, 0.06, now);
  };

  // Hide the rim while the transmission material captures the scene behind
  // the drop (its pass runs at priority 0), show it again for the frame.
  useFrame(() => {
    if (rim.current) rim.current.visible = false;
  }, -1);
  useFrame(() => {
    if (rim.current) rim.current.visible = true;
  }, 0.5);

  useFrame((state, dt) => {
    const g = group.current;
    const b = body.current;
    if (!g || !b) return;
    // The hero is scrolled away: nothing to see, skip the surface work.
    if (rig.scroll > 1.1) return;
    const t = state.clock.elapsedTime;
    const now = performance.now() / 1000;

    // Idle float and slow turn.
    g.position.set(layout.x, layout.y + Math.sin(t * 0.9) * 0.04 * layout.s * 2, 0);
    b.rotation.y += 0.06 * dt;

    // Squash and stretch with scroll velocity, springing back.
    const target = THREE.MathUtils.clamp(rig.scrollVel * 0.22, -0.18, 0.18);
    squash.current += (target - squash.current) * (1 - Math.exp(-dt * 10));
    const q = squash.current;
    g.scale.set(layout.s * (1 - q * 0.5), layout.s * (1 + q), layout.s * (1 - q * 0.5));

    // Tiny drops dripping into the tip on a loop; each lands with a ripple.
    const g2 = FALL_H / (0.5 * FALL_S * FALL_S);
    for (let i = 0; i < MINI_DROPS; i++) {
      const m = drops.current[i];
      if (!m) continue;
      const s = (t + i * (DRIP_PERIOD / MINI_DROPS) + i * 0.37) % DRIP_PERIOD;
      const prev = dropPhase.current[i];
      dropPhase.current[i] = s;
      if (prev < FALL_S && s >= FALL_S) addRipple(0, TIP_Y * 0.8, 0, 0.03, now);
      if (s < FALL_S) {
        m.visible = true;
        const y = TIP_Y + FALL_H - 0.5 * g2 * s * s;
        m.position.set(Math.sin(i * 2.1) * 0.02, y + 0.05, Math.cos(i * 1.3) * 0.02);
        const grow = Math.min(1, s / 0.12);
        const r = 0.055 + (i % 3) * 0.012;
        m.scale.set(r * grow, r * grow * 1.35, r * grow);
      } else m.visible = false;
    }

    // Fluid surface: wobble + ripples along the rest normals.
    const list = ripples.current;
    while (list.length && now - list[0].t0 > RIPPLE_S) list.shift();
    // Per-ripple envelope and phase, once per frame.
    const rip = list.map((r) => {
      const age = now - r.t0;
      return { x: r.x, y: r.y, z: r.z, a: r.amp * Math.exp(-age / 0.3), ph: age * 11 };
    });
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const out = attr.array as Float32Array;
    const { p, n, thin } = rest;
    if (normalSums.current?.length !== n.length) normalSums.current = new Float32Array(n.length);
    const acc = normalSums.current;
    const ts = t * 0.35;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i];
      const y = p[i + 1];
      const z = p[i + 2];
      let d = noise3D(x * 1.6 + ts, y * 1.6 + ts, z * 1.6 + ts) * 0.03;
      for (let k = 0; k < rip.length; k++) {
        const r = rip[k];
        const dx = x - r.x;
        const dy = y - r.y;
        const dz = z - r.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 5) continue; // beyond ~2.2 the wave has died out
        const dist = Math.sqrt(d2);
        d += r.a * Math.sin(dist * 6 - r.ph) * Math.exp(-dist * 1.8);
      }
      d *= thin[i / 3];
      out[i] = x + n[i] * d;
      out[i + 1] = y + n[i + 1] * d;
      out[i + 2] = z + n[i + 2] * d;
    }
    attr.needsUpdate = true;

    // Face normals summed per vertex (typed arrays, several times faster
    // than computeVertexNormals). A 1.4-thick lens magnifies every normal
    // wobble into swirls, so shading keeps only part of the change: the
    // silhouette, rim and ripples still move, the view through stays clear.
    const idx = (geometry.index as THREE.BufferAttribute).array;
    acc.fill(0);
    for (let f = 0; f < idx.length; f += 3) {
      const ia = idx[f] * 3;
      const ib = idx[f + 1] * 3;
      const ic = idx[f + 2] * 3;
      const e1x = out[ib] - out[ia];
      const e1y = out[ib + 1] - out[ia + 1];
      const e1z = out[ib + 2] - out[ia + 2];
      const e2x = out[ic] - out[ia];
      const e2y = out[ic + 1] - out[ia + 1];
      const e2z = out[ic + 2] - out[ia + 2];
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      acc[ia] += nx;
      acc[ia + 1] += ny;
      acc[ia + 2] += nz;
      acc[ib] += nx;
      acc[ib + 1] += ny;
      acc[ib + 2] += nz;
      acc[ic] += nx;
      acc[ic + 1] += ny;
      acc[ic + 2] += nz;
    }
    const nAttr = geometry.getAttribute("normal") as THREE.BufferAttribute;
    const nOut = nAttr.array as Float32Array;
    for (let i = 0; i < nOut.length; i += 3) {
      let x = acc[i];
      let y = acc[i + 1];
      let z = acc[i + 2];
      let l = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
      x = n[i] + (x * l - n[i]) * NORMAL_KEEP;
      y = n[i + 1] + (y * l - n[i + 1]) * NORMAL_KEEP;
      z = n[i + 2] + (z * l - n[i + 2]) * NORMAL_KEEP;
      l = 1 / Math.sqrt(x * x + y * y + z * z);
      nOut[i] = x * l;
      nOut[i + 1] = y * l;
      nOut[i + 2] = z * l;
    }
    nAttr.needsUpdate = true;

    if (glow.current) glow.current.uniforms.uTime.value = t;
  });

  return (
    <group ref={group}>
      {/* Soft blue-cyan glow at the base, behind the drop. */}
      <mesh position={[0, -1.05, -0.4]} scale={[2.6, 1.1, 1]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={glow}
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          uniforms={glowUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <group ref={body}>
        <mesh geometry={geometry}>
          <MeshTransmissionMaterial
            transmission={1}
            ior={1.33}
            thickness={1.4}
            roughness={0.02}
            chromaticAberration={0.04}
            anisotropicBlur={0.08}
            distortion={0.1}
            distortionScale={0.3}
            temporalDistortion={0.08}
            color="#eaf8ff"
            backside
            samples={high ? 6 : 3}
            resolution={high ? 1024 : 256}
          />
        </mesh>
        <mesh ref={rim} geometry={geometry} material={rimMaterial} renderOrder={6} />
        {/* Low-poly hit target for pointer ripples (cheap to raycast). */}
        <mesh geometry={proxy} onPointerMove={onHover} scale={1.02}>
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      </group>
      {Array.from({ length: MINI_DROPS }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            drops.current[i] = m;
          }}
          visible={false}
        >
          <sphereGeometry args={[1, 16, 12]} />
          <meshPhysicalMaterial color="#eaf8ff" roughness={0} metalness={0.1} clearcoat={1} transparent opacity={0.6} envMapIntensity={2.5} />
        </mesh>
      ))}
    </group>
  );
}
