import { CACHE_KEY, decodeCache, encodeCache, parseQuality, pickQuality, type Quality } from "@/lib/quality";

// Which hero the device gets:
//   "webgl"  the living 3D scene, at the "high" or "medium" tier
//   "css"    the "low" tier or no WebGL: the plate with CSS pan, clouds and rain
//   "static" prefers-reduced-motion: the still plate, nothing moves
// The tier is decided once per visit (see lib/quality) and can only step
// down after that. ?quality=high|medium|low forces one for testing and
// demos; ?quality=auto forgets the cached tier.

export type SceneMode = "webgl" | "css" | "static";
export type SceneTier = Exclude<Quality, "low">;

function probeGl(): { ok: boolean; renderer: string } {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return { ok: false, renderer: "" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { ok: true, renderer };
  } catch {
    return { ok: false, renderer: "" };
  }
}

export function logQuality(msg: string) {
  console.info(`[quality] ${msg}`);
}

function readCache(renderer: string): Quality | null {
  try {
    return decodeCache(window.localStorage.getItem(CACHE_KEY), renderer);
  } catch {
    return null;
  }
}

interface Decision {
  quality: Quality;
  renderer: string;
  forced: boolean;
}

// Decided once per page load; the hero and the app share it.
let decision: Decision | null = null;

export function detectQuality(): Decision {
  if (decision) return decision;
  const gl = probeGl();
  const param = new URLSearchParams(window.location.search).get("quality");
  if (param === "auto") {
    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch {
      // Storage blocked: nothing cached to forget.
    }
  }
  const forced = parseQuality(param);
  if (!gl.ok) {
    decision = { quality: "low", renderer: "", forced: false };
    logQuality("tier low (no WebGL)");
  } else if (forced) {
    decision = { quality: forced, renderer: gl.renderer, forced: true };
    logQuality(`tier ${forced} (forced by ?quality, ${gl.renderer || "renderer hidden"})`);
  } else {
    const cached = readCache(gl.renderer);
    if (cached) {
      decision = { quality: cached, renderer: gl.renderer, forced: false };
      logQuality(`tier ${cached} (cached for ${gl.renderer || "this GPU"})`);
    } else {
      const nav = navigator as Navigator & { deviceMemory?: number };
      const picked = pickQuality({
        renderer: gl.renderer,
        memory: nav.deviceMemory,
        cores: nav.hardwareConcurrency,
        screenPx: window.screen.width * window.screen.height * (window.devicePixelRatio || 1) ** 2,
        phone: window.matchMedia("(max-width: 767px), (pointer: coarse)").matches,
      });
      decision = { quality: picked.quality, renderer: gl.renderer, forced: false };
      logQuality(`tier ${picked.quality} (${picked.reason}; ${gl.renderer || "renderer hidden"})`);
    }
  }
  return decision;
}

// Remember a tier for this GPU's next visit. Forced tiers are never cached.
export function saveQuality(quality: Quality) {
  const d = detectQuality();
  d.quality = quality;
  if (d.forced) return;
  try {
    window.localStorage.setItem(CACHE_KEY, encodeCache(quality, d.renderer));
  } catch {
    // Storage blocked: detect again next visit.
  }
}

export function detectSceneMode(): SceneMode {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";
  return detectQuality().quality === "low" ? "css" : "webgl";
}
