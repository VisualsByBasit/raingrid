// Hero quality tiers, decided once per visit and never raised afterwards:
//   "high"    dedicated GPU: the full scene (DPR up to 1.5, bloom, SMAA,
//             1024 px droplet buffer, every rain streak)
//   "medium"  integrated GPU or phone: DPR 1, no bloom, a fixed 256 px
//             droplet buffer, half the rain, 30 fps
//   "low"     weak or software rendering: the CSS hero
// Pure functions only; the browser side lives in components/three/sceneMode.

export type Quality = "high" | "medium" | "low";

export type GpuClass = "discrete" | "integrated" | "software" | "unknown";

export interface DeviceInfo {
  // WEBGL_debug_renderer_info's unmasked renderer, or "" when hidden.
  renderer: string;
  // navigator.deviceMemory in GB (Chromium only, capped at 8 there).
  memory?: number;
  cores?: number;
  // Screen size in device pixels.
  screenPx: number;
  // Phone-sized or touch-first.
  phone: boolean;
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen/i;
const INTEGRATED = [
  /intel/i, // UHD, Iris, HD (Arc is caught as discrete first)
  /amd radeon(\(tm\))? graphics/i, // Ryzen APUs report the bare name
  /radeon.*vega \d+ graphics/i,
  /radeon (r[2-7]|hd \d{4}[dg])/i,
  /apple (gpu|m\d)/i, // Apple silicon: shared memory, no discrete GPU
  /mali|adreno|powervr|videocore|tegra/i,
];
const DISCRETE = /nvidia|geforce|quadro|rtx|gtx|radeon (rx|pro)|intel.*arc|arc a\d/i;

export function classifyGpu(renderer: string): GpuClass {
  const r = renderer.trim();
  if (!r) return "unknown";
  if (SOFTWARE.test(r)) return "software";
  if (DISCRETE.test(r)) return "discrete";
  if (INTEGRATED.some((re) => re.test(r))) return "integrated";
  return "unknown";
}

// The tier a device starts on, before any frames are measured.
export function pickQuality(d: DeviceInfo): { quality: Quality; reason: string } {
  const gpu = classifyGpu(d.renderer);
  if (gpu === "software") return { quality: "low", reason: "software renderer" };
  if ((d.cores ?? 8) <= 4) return { quality: "low", reason: `${d.cores} CPU cores` };
  if (d.memory !== undefined && d.memory <= 2) return { quality: "low", reason: `${d.memory} GB memory` };
  if (d.phone) return { quality: "medium", reason: "phone" };
  if (gpu === "integrated") return { quality: "medium", reason: "integrated GPU" };
  if (d.memory !== undefined && d.memory <= 4) return { quality: "medium", reason: `${d.memory} GB memory` };
  // A 4K-class screen on an unknown GPU is a lot of pixels to gamble on.
  if (gpu === "unknown" && d.screenPx > 2560 * 1440) return { quality: "medium", reason: "unknown GPU, large screen" };
  return { quality: "high", reason: gpu === "discrete" ? "dedicated GPU" : "unknown GPU" };
}

export function parseQuality(v: string | null | undefined): Quality | null {
  return v === "high" || v === "medium" || v === "low" ? v : null;
}

export function stepDown(q: Quality): Quality {
  return q === "high" ? "medium" : "low";
}

// Frames to ignore after the hero appears (shader compiles, first uploads)
// and how long to measure after that.
export const PROBE_SKIP = 10;
export const PROBE_MS = 2000;

// Is the median frame clearly too slow for this tier? High aims for 60 fps
// and drops below 30 (33 ms); medium is capped at 30 and drops below 20
// (50 ms). A median ignores the odd hitch.
export function tooSlow(q: Quality, frameMs: number[]): { slow: boolean; median: number } {
  if (frameMs.length === 0) return { slow: false, median: 0 };
  const s = [...frameMs].sort((a, b) => a - b);
  const median = s[s.length >> 1];
  const limit = q === "high" ? 34 : 50;
  return { slow: q !== "low" && median > limit, median };
}

// The cached tier is only trusted on the same GPU and cache version.
export const CACHE_KEY = "raingrid.quality";
const CACHE_VERSION = 1;

export function encodeCache(quality: Quality, renderer: string): string {
  return JSON.stringify({ v: CACHE_VERSION, quality, renderer });
}

export function decodeCache(raw: string | null, renderer: string): Quality | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as { v?: number; quality?: string; renderer?: string };
    if (c.v !== CACHE_VERSION || c.renderer !== renderer) return null;
    return parseQuality(c.quality);
  } catch {
    return null;
  }
}
