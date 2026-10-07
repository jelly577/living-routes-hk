// One-off: bake monocular depth maps for the heritage places' then/now images.
// Uses Depth Anything V2 (small) via transformers.js + ONNX, fully offline after
// the first model download. Output is a grayscale PNG per (place, era) that the
// WebGL "3D photo" parallax shader samples at runtime — no per-visit AI call.
//
// Prereq (only when regenerating; the output is already committed):
//   npm i -D @huggingface/transformers onnxruntime-node
//
// Run:  node scripts/generate-depth-maps.mjs
// Output:  src/content/depth/<place>.<past|now>.png
import { pipeline, RawImage } from '@huggingface/transformers';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { placeImages } from '../src/content/placeImages.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'content', 'depth');
mkdirSync(OUT, { recursive: true });

// Depth maps are smooth/low-frequency; 640px is plenty for parallax and keeps
// the baked assets small. Aspect ratio is preserved so UV sampling lines up.
const CAP = 640;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikimedia rate-limits rapid fetches (429); retry with backoff and pace requests.
async function fetchImage(url) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await RawImage.fromURL(url);
    } catch (e) {
      lastErr = e;
      const backoff = 2000 * 2 ** attempt;
      console.warn(`  … retry #${attempt + 1} in ${backoff / 1000}s (${e.message})`);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

// Oldest non-content-warning "past" image — mirrors getThenNowImages().
const pickPast = (place) =>
  (place.gallery || [])
    .filter((i) => i.era === 'past' && !i.contentWarning)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))[0] || null;

const est = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', { dtype: 'fp32' });

for (const [id, place] of Object.entries(placeImages)) {
  const jobs = [];
  const past = pickPast(place);
  const now = place.image;
  if (past?.url) jobs.push(['past', past.url]);
  if (now?.url) jobs.push(['now', now.url]);
  if (!jobs.length) continue;

  for (const [era, url] of jobs) {
    const file = join(OUT, `${id}.${era}.png`);
    try {
      const img = await fetchImage(url);
      const { depth } = await est(img);
      const w = Math.min(CAP, depth.width);
      const h = Math.round((w * depth.height) / depth.width);
      const small = await depth.resize(w, h);
      await small.save(file);
      console.log(`✓ ${id}.${era}  ${depth.width}×${depth.height} → ${w}×${h}`);
    } catch (e) {
      console.error(`✗ ${id}.${era}  ${e.message}`);
    }
    await sleep(1500); // pace the next fetch
  }
}
console.log('done →', OUT);
