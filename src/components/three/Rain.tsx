"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { seeded } from "./random";

// GPU rain: one instanced quad per streak, animated entirely in the vertex
// shader. Each layer sits at its own depth (the far one passes behind the
// droplet and is refracted by it), tilted by a 12 degree wind, with a head
// that fades into a motion-blurred tail.

const WIND = Math.tan((12 * Math.PI) / 180);

const vertex = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uLen;
  uniform float uWidth;
  uniform float uZ;
  uniform vec2 uArea;
  varying vec2 vQ;
  varying float vFade;
  const float WIND = ${WIND.toFixed(4)};
  void main() {
    float len = uLen * (0.7 + 0.6 * aSeed.w);
    float span = uArea.y + len * 2.0;
    float y = uArea.y * 0.5 + len - mod(aSeed.y * span + uTime * uSpeed * (0.75 + 0.5 * aSeed.z), span);
    float wide = uArea.x + span * WIND + 0.4;
    float x = (aSeed.x - 0.5) * wide - y * WIND;
    vec2 dir = normalize(vec2(WIND, -1.0));
    vec2 perp = vec2(-dir.y, dir.x);
    vec2 p = vec2(x, y) - dir * len * position.y + perp * uWidth * position.x;
    vQ = vec2(position.x * 2.0, position.y);
    vFade = 0.55 + 0.45 * aSeed.z;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, uZ, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vQ;
  varying float vFade;
  void main() {
    float across = 1.0 - smoothstep(0.2, 1.0, abs(vQ.x));
    float along = pow(1.0 - vQ.y, 1.6) * smoothstep(0.0, 0.08, vQ.y + 0.02);
    gl_FragColor = vec4(vec3(0.78, 0.88, 0.97) * across * along * uOpacity * vFade, 1.0);
  }
`;

function RainLayer({
  count,
  z,
  speed,
  len,
  width,
  opacity,
}: {
  count: number;
  z: number;
  speed: number;
  len: number;
  width: number;
  opacity: number;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  const geometry = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    const seeds = new Float32Array(count * 4);
    const rand = seeded(count * 131 + Math.round(z * 10));
    for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
    g.instanceCount = count;
    return g;
  }, [count, z]);

  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeed: { value: speed },
      uLen: { value: len },
      uWidth: { value: width },
      uZ: { value: z },
      uOpacity: { value: opacity },
      uArea: { value: new THREE.Vector2(1, 1) },
    }),
    [speed, len, width, z, opacity],
  );

  useFrame((state) => {
    if (!material.current) return;
    const u = material.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    // Visible area at this layer's depth.
    const dist = camera.position.z - z;
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist;
    u.uArea.value.set(h * (size.width / size.height), h);
  });

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={5}>
      <shaderMaterial
        ref={material}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export default function Rain({ phone }: { phone: boolean }) {
  const scale = phone ? 0.5 : 1;
  return (
    <>
      {/* Far layer: behind the droplet, so it shows through it. */}
      <RainLayer count={Math.round(900 * scale)} z={-2} speed={6.5} len={0.32} width={0.007} opacity={0.3} />
      {/* Near layer: in front of everything, longer and softer. */}
      <RainLayer count={Math.round(260 * scale)} z={2.6} speed={9} len={0.55} width={0.011} opacity={0.2} />
    </>
  );
}
