"use client";

import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { DEPTH_URL, MASKS_URL, PLATE_URL } from "./assets";
import type { Rig } from "./rig";

// The Islamabad plate as a living 2.5D scene, in one full-screen shader:
// depth parallax (camera drift, pointer, scroll), rolling monsoon clouds over
// the sky, mist drifting across the ridge, breathing sun shafts, shimmering
// wet street with splash sparkles, twinkling city lights and a palette grade.
// Depth and masks come from scripts/build-hero-assets.mjs.

const IMAGE_ASPECT = 1672 / 941;
const OVERSCAN = 1.06;
// Where the crop centres on tall screens: keeps Faisal Mosque (x 0.715) and
// the sun in frame.
const MOSQUE_X = 0.69;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uDepth;
  uniform sampler2D uMasks;
  uniform float uTime;
  uniform vec2 uCover;
  uniform vec2 uCenter;
  uniform vec2 uOffset;
  uniform float uZoom;
  varying vec2 vUv;

  const vec2 SUN = vec2(0.735, 0.915);
  const vec3 WARM = vec3(1.0, 0.693, 0.352); // #ffd9a0, linear
  const float ASPECT = ${IMAGE_ASPECT.toFixed(4)};

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float t = uTime;
    vec2 base = uCenter + (vUv - 0.5) * uCover / uZoom;

    // Depth parallax: near layers move more than far ones. Two taps so the
    // displaced sample reads its own depth.
    float d = texture2D(uDepth, base).r;
    vec2 uv = base - uOffset * uCover * (0.12 + 0.88 * d);
    d = texture2D(uDepth, uv).r;
    uv = base - uOffset * uCover * (0.12 + 0.88 * d);
    vec3 m = texture2D(uMasks, uv).rgb; // r sky, g wet street, b city lights
    float yDown = 1.0 - uv.y;

    // Wet street: a slow ripple distorts the reflections.
    vec2 suv = uv;
    float road = m.g;
    suv.x += road * 0.0022 * sin(uv.y * 260.0 + t * 2.4 + noise(uv * 40.0 + t * 0.5) * 6.0);
    suv.y += road * 0.0010 * sin(uv.x * 180.0 - t * 1.7);
    vec3 col = texture2D(uMap, clamp(suv, 0.001, 0.999)).rgb;
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));

    // Reflections shimmer.
    col *= 1.0 + road * 0.45 * smoothstep(0.05, 0.4, lum) * (noise(vec2(uv.x * 90.0, uv.y * 30.0 - t * 1.3)) - 0.4);

    // Window and street lights twinkle very slightly.
    vec2 cellId = floor(uv * vec2(300.0, 170.0));
    float h = hash(cellId);
    col *= 1.0 + m.b * smoothstep(0.12, 0.5, lum) * 0.2 * sin(t * (1.2 + h * 3.0) + h * 40.0);

    // Splash sparkles along the street.
    vec2 sc = uv * vec2(240.0, 150.0);
    vec2 sid = floor(sc);
    float sh = hash(sid + 7.0);
    float phase = fract(t * (0.7 + sh * 0.6) + sh * 9.0);
    vec2 spos = vec2(hash(sid + 1.3), hash(sid + 4.1)) * 0.6 + 0.2;
    float sd = length(fract(sc) - spos);
    float spark = smoothstep(0.32, 0.0, sd) * pow(1.0 - phase, 10.0) * step(0.55, sh);
    col += vec3(0.85, 0.92, 1.0) * spark * road * 0.9;

    vec2 p = vec2(uv.x * ASPECT, uv.y);
    vec2 sunV = (uv - SUN) * vec2(ASPECT, 1.0);
    float sunR = length(sunV);
    float sunLit = exp(-sunR * 3.2);

    // Monsoon clouds: two fBm layers drifting left to right over the sky and
    // across the ridge.
    float sky = m.r;
    float n1 = fbm(p * vec2(1.9, 3.6) + vec2(-t * 0.011, t * 0.0015));
    float n2 = fbm(p * vec2(3.6, 6.5) + vec2(-t * 0.024, -t * 0.002) + 11.0);
    vec3 grey = vec3(0.028, 0.036, 0.047);
    vec3 lit = mix(grey * 2.2, WARM * 0.9, sunLit);
    float a1 = smoothstep(0.46, 0.78, n1) * sky * 0.62;
    col = mix(col, mix(grey, lit, smoothstep(0.5, 0.85, n1) * 0.6 + sunLit * 0.4), a1);
    float a2 = smoothstep(0.5, 0.8, n2) * sky * 0.38;
    col = mix(col, mix(grey * 1.6, lit * 1.1, sunLit * 0.7), a2);

    // Mist: two thin fog bands over the ridge and the valley.
    float band1 = exp(-pow((yDown - 0.265) / 0.04, 2.0));
    float band2 = exp(-pow((yDown - 0.335) / 0.03, 2.0));
    float f1 = fbm(p * vec2(2.4, 11.0) + vec2(-t * 0.007, 0.0));
    float f2 = fbm(p * vec2(3.2, 14.0) + vec2(-t * 0.012, 3.0));
    vec3 mist = mix(vec3(0.16, 0.19, 0.22), WARM * 0.55, sunLit);
    col = mix(col, mist, band1 * smoothstep(0.4, 0.75, f1) * 0.34);
    col = mix(col, mist * 0.9, band2 * smoothstep(0.42, 0.75, f2) * 0.26);

    // Sun shafts: four soft additive rays from the break in the clouds,
    // breathing slowly.
    float ang = atan(sunV.y, sunV.x);
    float fall = smoothstep(0.0, 0.08, sunR) * exp(-sunR * 1.6) * (1.0 - smoothstep(0.35, 0.75, yDown));
    float rays = 0.0;
    rays += exp(-pow((ang + 1.92) / 0.045, 2.0)) * (0.6 + 0.4 * sin(t * 0.45));
    rays += exp(-pow((ang + 2.18) / 0.06, 2.0)) * (0.6 + 0.4 * sin(t * 0.37 + 1.7));
    rays += exp(-pow((ang + 1.66) / 0.035, 2.0)) * (0.6 + 0.4 * sin(t * 0.52 + 3.1));
    rays += exp(-pow((ang + 2.5) / 0.05, 2.0)) * (0.6 + 0.4 * sin(t * 0.31 + 4.4));
    rays *= 0.75 + 0.5 * noise(vec2(ang * 30.0, t * 0.15));
    col += WARM * rays * fall * 0.3;
    col += WARM * exp(-sunR * 9.0) * 0.18 * (0.8 + 0.2 * sin(t * 0.4));

    // Grade toward the palette in display space: lift shadows to
    // monsoon-deep, pull greens toward forest, leave the warm light alone.
    vec3 s = pow(max(col, 0.0), vec3(1.0 / 2.2));
    float ls = dot(s, vec3(0.2126, 0.7152, 0.0722));
    float shadow = 1.0 - smoothstep(0.0, 0.42, ls);
    s += vec3(0.043, 0.165, 0.227) * shadow * 0.32;
    float green = clamp((s.g - max(s.r, s.b)) * 5.0, 0.0, 1.0) * (1.0 - smoothstep(0.45, 0.75, ls));
    s = mix(s, s * vec3(0.72, 1.0, 0.9) + vec3(0.0, 0.015, 0.012), green * 0.55);
    col = pow(s, vec3(2.2));

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export default function Plate({ rig, phone }: { rig: Rig; phone: boolean }) {
  const [map, depth, masks] = useTexture([PLATE_URL, DEPTH_URL, MASKS_URL], (loaded) => {
    const [plate] = loaded;
    plate.colorSpace = THREE.SRGBColorSpace;
    plate.anisotropy = 4;
    for (const t of loaded) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  });
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uDepth: { value: depth },
      uMasks: { value: masks },
      uTime: { value: 0 },
      uCover: { value: new THREE.Vector2(1, 1) },
      uCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uOffset: { value: new THREE.Vector2() },
      uZoom: { value: 1 },
    }),
    [map, depth, masks],
  );

  useFrame((state) => {
    const m = material.current;
    if (!m) return;
    const u = m.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uOffset.value.copy(rig.offset);
    u.uZoom.value = rig.zoom;
    // Cover fit with overscan; tall screens slide the crop toward the mosque
    // and show a little more sky around the droplet.
    const aspect = state.size.width / state.size.height;
    const w = Math.min(1, aspect / IMAGE_ASPECT) / OVERSCAN;
    const h = Math.min(1, IMAGE_ASPECT / aspect) / OVERSCAN;
    u.uCover.value.set(w, h);
    const k = THREE.MathUtils.smoothstep(w, 0.55, 1.0);
    const cx = THREE.MathUtils.clamp(THREE.MathUtils.lerp(MOSQUE_X, 0.5, k), w / 2, 1 - w / 2);
    const cy = THREE.MathUtils.clamp(phone ? 0.53 : 0.5, h / 2, 1 - h / 2);
    u.uCenter.value.set(cx, cy);
  });

  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}
