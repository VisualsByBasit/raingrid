// MapLibre v6 runs its worker from a separate module file. Next's bundler
// doesn't emit it, so we copy it (and the chunk it imports) into /public.
import { copyFileSync, mkdirSync } from "node:fs";
const src = "node_modules/maplibre-gl/dist";
const dest = "public/maplibre";
mkdirSync(dest, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`${src}/${f}`, `${dest}/${f}`);
console.log("maplibre worker copied to", dest);
