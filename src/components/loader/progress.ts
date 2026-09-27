// What the first-visit loader is waiting for. Parts report 0..1; the loader
// shows their weighted average: fonts, the hero plate, and the 3D scene
// (drei's useProgress over its textures, then 1 once it has mounted).

type Part = { weight: number; value: number };

const parts = new Map<string, Part>([
  ["fonts", { weight: 0.2, value: 0 }],
  ["hero", { weight: 0.3, value: 0 }],
  ["scene", { weight: 0.5, value: 0 }],
]);

export function reportProgress(key: string, value: number) {
  const p = parts.get(key);
  if (p) p.value = Math.max(p.value, Math.min(1, value));
}

export function totalProgress(): number {
  let sum = 0;
  let weight = 0;
  for (const p of parts.values()) {
    sum += p.value * p.weight;
    weight += p.weight;
  }
  return weight ? sum / weight : 1;
}

// First visit in this browser session only.
const SEEN = "rg-loader-seen";
export function loaderSeen(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN) === "1";
  } catch {
    return false;
  }
}
export function markLoaderSeen() {
  try {
    window.sessionStorage.setItem(SEEN, "1");
  } catch {
    // Storage blocked: the loader may show again next time, which is fine.
  }
}
