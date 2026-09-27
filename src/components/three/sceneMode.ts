// Which hero the device gets:
//   "webgl"  the living 3D scene ("high" on desktop, "low" on phones)
//   "css"    low-end or no WebGL: the plate with CSS pan, clouds and rain
//   "static" prefers-reduced-motion: the still plate, nothing moves

export type SceneMode = "webgl" | "css" | "static";
export type SceneTier = "high" | "low";

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function detectSceneMode(): SceneMode {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";
  const cores = navigator.hardwareConcurrency ?? 8;
  if (cores <= 4 || !hasWebGL()) return "css";
  return "webgl";
}

export function detectSceneTier(): SceneTier {
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches ? "low" : "high";
}
