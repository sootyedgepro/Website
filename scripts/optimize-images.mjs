// One-shot image optimization for hero assets.
//
// Generates AVIF (small) + WebP (universal fallback) for every entry in
// TARGETS. Run with: `node scripts/optimize-images.mjs`
//
// Phone_Hub is the hero LCP image and is displayed at ~280px CSS width inside
// the phone mockup, so we downscale it to 720w (sufficient for 3× DPI) before
// re-encoding. Computer_Hub sits below the fold at up to ~1100px CSS width
// and has transparency, so we keep its source resolution and just re-encode.

import sharp from "sharp";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

const TARGETS = [
  {
    src: "Phone_Hub.png",
    resizeWidth: 720,
    avifQuality: 60,
    webpQuality: 80,
  },
  {
    src: "Computer_Hub.png",
    resizeWidth: null,
    avifQuality: 65,
    webpQuality: 82,
  },
];

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

for (const t of TARGETS) {
  const srcPath = path.join(PUBLIC_DIR, t.src);
  const base = t.src.replace(/\.png$/i, "");
  const avifPath = path.join(PUBLIC_DIR, `${base}.avif`);
  const webpPath = path.join(PUBLIC_DIR, `${base}.webp`);

  const srcBytes = (await stat(srcPath)).size;
  let pipeline = sharp(srcPath);
  if (t.resizeWidth) {
    pipeline = pipeline.resize({ width: t.resizeWidth, withoutEnlargement: true });
  }

  await pipeline.clone().avif({ quality: t.avifQuality, effort: 6 }).toFile(avifPath);
  await pipeline.clone().webp({ quality: t.webpQuality, effort: 6 }).toFile(webpPath);

  const avifBytes = (await stat(avifPath)).size;
  const webpBytes = (await stat(webpPath)).size;
  const pctAvif = (100 * (1 - avifBytes / srcBytes)).toFixed(0);
  const pctWebp = (100 * (1 - webpBytes / srcBytes)).toFixed(0);

  console.log(
    `${t.src.padEnd(20)} ${fmtKB(srcBytes).padStart(7)}  ->  AVIF ${fmtKB(avifBytes).padStart(6)} (-${pctAvif}%)   WebP ${fmtKB(webpBytes).padStart(6)} (-${pctWebp}%)`
  );
}
