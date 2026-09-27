// Builds the hero's WebGL inputs from the Islamabad plate:
//   public/media/islamabad-plate.jpg   recompressed (mozjpeg ~78) if over 600 KB
//   public/media/islamabad-depth.png   grey depth map, white = near, black = far
//   public/media/islamabad-masks.png   R = sky, G = wet street, B = city lights band
// The depth map is hand-tuned zones in image space (y down from the top) with
// smooth gradients between them, plus a luminance term so the bright sky
// stays far. Edit ZONES / the masks below and rerun:
//   node scripts/build-hero-assets.mjs
import { readFile, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";

const PLATE = "public/media/islamabad-plate.jpg";
const DEPTH = "public/media/islamabad-depth.png";
const MASKS = "public/media/islamabad-masks.png";
const MAX_BYTES = 600 * 1024;
const W = 512;
const H = 288;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// Depth by zone, top to bottom. Each zone ends at `y`; the value ramps into
// the next zone over `blend`.
const ZONES = [
  { y: 0.2, depth: 0.02, blend: 0.12 }, // sky
  { y: 0.36, depth: 0.2, blend: 0.1 }, // Margalla ridge band
  { y: 0.46, depth: 0.4, blend: 0.12 }, // Faisal Mosque and city band
  { y: 0.72, depth: 0.66, blend: 0.16 }, // trees and houses
  { y: 1.01, depth: 0.9, blend: 0.16 }, // street, bottom-right houses, foreground
];

function zoneDepth(y) {
  let d = ZONES[0].depth;
  let start = 0;
  for (let i = 0; i < ZONES.length; i++) {
    const z = ZONES[i];
    if (i === 0) d = z.depth;
    else d = mix(d, z.depth, smooth(start - z.blend / 2, start + z.blend / 2, y));
    start = z.y;
  }
  return d;
}

// The wet street: a wedge from (0.555, 0.64) widening to x 0.66..0.93 at the
// bottom edge.
function roadMask(x, y) {
  const t = smooth(0.62, 0.68, y);
  const k = Math.min(1, Math.max(0, (y - 0.64) / 0.36));
  const left = mix(0.553, 0.67, k);
  const right = mix(0.585, 0.93, Math.pow(k, 0.85));
  const soft = 0.012 + 0.02 * k;
  return t * smooth(left - soft, left + soft, x) * (1 - smooth(right - soft, right + soft, x));
}

async function compressPlate() {
  const buf = await readFile(PLATE);
  const meta = await sharp(buf).metadata();
  const { size } = await stat(PLATE);
  if (meta.format === "jpeg" && size <= MAX_BYTES) {
    console.log(`plate ok: ${meta.width}x${meta.height} jpeg, ${(size / 1024).toFixed(0)} KB`);
    return;
  }
  const out = await sharp(buf).jpeg({ quality: 78, mozjpeg: true, chromaSubsampling: "4:2:0" }).toBuffer();
  await writeFile(PLATE, out);
  console.log(`plate: ${meta.format} ${(size / 1024).toFixed(0)} KB -> jpeg ${(out.length / 1024).toFixed(0)} KB`);
}

async function buildMaps() {
  const { data } = await sharp(PLATE).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const depth = Buffer.alloc(W * H);
  const masks = Buffer.alloc(W * H * 3);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5) / W;
      const y = (j + 0.5) / H;
      const p = (j * W + i) * 3;
      const lum = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;

      // Upper part of the frame: bright pixels are sky or sunlit cloud, so
      // they stay far even where the ridge band starts.
      const skyish = 1 - smooth(0.22, 0.4, y);
      let d = zoneDepth(y);
      d = mix(d, 0.02, skyish * smooth(0.35, 0.7, lum));
      // Left foreground trees rise higher in the frame than on the right.
      d = Math.max(d, mix(0, 0.7, (1 - smooth(0.25, 0.5, x)) * smooth(0.5, 0.75, y)));
      // Bottom-right houses and the street sit nearest.
      const road = roadMask(x, y);
      d = Math.max(d, mix(0, 0.95, smooth(0.62, 0.95, y) * smooth(0.55, 0.8, x)));
      d = Math.max(d, road * mix(0.7, 1, smooth(0.64, 1, y)));
      depth[j * W + i] = Math.round(Math.min(1, Math.max(0, d)) * 255);

      // Masks.
      const sky = 1 - smooth(0.24, 0.38, y);
      // Lights twinkle in the city band and among the houses.
      const lights = smooth(0.33, 0.37, y) * (1 - smooth(0.8, 0.9, y)) * smooth(0.3, 0.45, x);
      masks[p] = Math.round(sky * 255);
      masks[p + 1] = Math.round(road * 255);
      masks[p + 2] = Math.round(lights * 255);
    }
  }
  // Soften so the parallax never tears along zone edges.
  await sharp(depth, { raw: { width: W, height: H, channels: 1 } }).blur(3).png({ compressionLevel: 9 }).toFile(DEPTH);
  await sharp(masks, { raw: { width: W, height: H, channels: 3 } }).blur(1.5).png({ compressionLevel: 9 }).toFile(MASKS);
  console.log(`depth: ${DEPTH} (${W}x${H}), masks: ${MASKS}`);
}

await compressPlate();
await buildMaps();
