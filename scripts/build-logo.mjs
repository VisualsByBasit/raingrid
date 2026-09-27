// Builds the app icons from the logo artwork (glass droplet on black):
//   src/app/icon.png        512 x 512 (favicon)
//   src/app/apple-icon.png  180 x 180 (Apple touch icon)
//   public/media/logo-transparent.png  256 x 256, black keyed out (README)
// Trims the near-black background (luminance above 20), then pads back to
// a centred square with about 6% margin on the same black. Rerun after
// changing the logo:
//   node scripts/build-logo.mjs
import { unlink } from "node:fs/promises";
import sharp from "sharp";

const SRC = "public/media/logo.png";
const MARGIN = 0.06;
const OUT = [
  { file: "src/app/icon.png", size: 512 },
  { file: "src/app/apple-icon.png", size: 180 },
];

// The artwork's own black, read from its top-left corner.
const { data: corner } = await sharp(SRC).removeAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
const background = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };

// Trim: the box of pixels brighter than luminance 20. (A faint blue haze
// near the edges defeats sharp's colour-difference trim, so measure here.)
const { data: px, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let x0 = info.width;
let y0 = info.height;
let x1 = -1;
let y1 = -1;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const p = (y * info.width + x) * 3;
    if (0.2126 * px[p] + 0.7152 * px[p + 1] + 0.0722 * px[p + 2] > 20) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
}
const width = x1 - x0 + 1;
const height = y1 - y0 + 1;
const trimmed = { data: await sharp(SRC).removeAlpha().extract({ left: x0, top: y0, width, height }).png().toBuffer() };
const side = Math.round(Math.max(width, height) / (1 - 2 * MARGIN));
const left = Math.floor((side - width) / 2);
const top = Math.floor((side - height) / 2);
const square = await sharp(trimmed.data)
  .extend({ left, right: side - width - left, top, bottom: side - height - top, background })
  .png()
  .toBuffer();

for (const { file, size } of OUT) {
  await sharp(square).resize(size, size, { kernel: "lanczos3" }).png({ compressionLevel: 9, palette: true, quality: 90, dither: 0.6 }).toFile(file);
}
console.log(`trimmed ${width}x${height} -> square ${side} (bg rgb ${corner[0]},${corner[1]},${corner[2]}); wrote ${OUT.map((o) => o.file).join(", ")}`);

// Transparent logo for light pages (the README). Brightness becomes alpha
// (each pixel's max RGB, a smooth ramp from 12 to 60) and colour is divided
// by alpha, treating the art as light over black: over a dark page it
// matches the original, and the glow fades out with no black box or hard
// edge. The drop itself (everything the background can't reach past its
// bright glass rim, found by flood fill from the frame's edge) stays opaque,
// so dark trees and shadows inside the scene don't turn see-through.
const TRANSPARENT = { file: "public/media/logo-transparent.png", size: 256, lo: 12, hi: 60 };
const smooth = (lo, hi, x) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
const { data: sq, info: sqInfo } = await sharp(square).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = sqInfo.width;
const H = sqInfo.height;
const n = W * H;
const bright = Buffer.alloc(n);
for (let i = 0, j = 0; j < n; i += 3, j++) bright[j] = Math.max(sq[i], sq[i + 1], sq[i + 2]);
const outside = new Uint8Array(n);
const stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const j = stack.pop();
  if (outside[j] || bright[j] > TRANSPARENT.hi) continue;
  outside[j] = 1;
  const x = j % W;
  if (x > 0) stack.push(j - 1);
  if (x < W - 1) stack.push(j + 1);
  if (j >= W) stack.push(j - W);
  if (j < n - W) stack.push(j + W);
}
const solid = Buffer.alloc(n);
for (let j = 0; j < n; j++) solid[j] = outside[j] ? 0 : 255;
// Soften the silhouette's edge by a pixel or two.
const { data: body } = await sharp(solid, { raw: { width: W, height: H, channels: 1 } })
  .blur(1.5)
  .extractChannel(0)
  .raw()
  .toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(n * 4);
for (let i = 0, j = 0, o = 0; j < n; i += 3, j++, o += 4) {
  const a = Math.max(smooth(TRANSPARENT.lo, TRANSPARENT.hi, bright[j]), body[j] / 255);
  const k = a > 0 ? 1 / a : 0;
  for (let c = 0; c < 3; c++) rgba[o + c] = Math.min(255, Math.round(sq[i + c] * k));
  rgba[o + 3] = Math.round(a * 255);
}
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
  .resize(TRANSPARENT.size, TRANSPARENT.size, { kernel: "lanczos3" })
  .png({ compressionLevel: 9 })
  .toFile(TRANSPARENT.file);
console.log(`wrote ${TRANSPARENT.file}`);

try {
  await unlink("src/app/favicon.ico");
  console.log("removed src/app/favicon.ico");
} catch {
  // Already gone.
}
