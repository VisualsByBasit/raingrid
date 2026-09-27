// Builds the app icons from the logo artwork (glass droplet on black):
//   src/app/icon.png        512 x 512 (favicon)
//   src/app/apple-icon.png  180 x 180 (Apple touch icon)
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

try {
  await unlink("src/app/favicon.ico");
  console.log("removed src/app/favicon.ico");
} catch {
  // Already gone.
}
