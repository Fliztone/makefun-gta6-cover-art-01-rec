// grain.js — seeded film grain and a soft vignette. The grain tile is painted
// once per seed from the same PRNG the scenes use, then tiled over the art
// with an 'overlay' blend so it reads as film, not noise.

import { mulberry32 } from './scenes.js';

const TILE = 160;
const tileCache = new Map();

/** A reusable grain tile for a seed: gray speckle around mid-gray. */
function grainTile(seed) {
  const cached = tileCache.get(seed);
  if (cached) return cached;
  const tile = document.createElement('canvas');
  tile.width = TILE;
  tile.height = TILE;
  const ctx = tile.getContext('2d');
  const frame = ctx.createImageData(TILE, TILE);
  const rng = mulberry32(seed * 613 + 4241);
  for (let i = 0; i < frame.data.length; i += 4) {
    const v = 128 + (rng() - 0.5) * 132;
    frame.data[i] = v;
    frame.data[i + 1] = v;
    frame.data[i + 2] = v;
    frame.data[i + 3] = 255;
  }
  ctx.putImageData(frame, 0, 0);
  if (tileCache.size > 24) tileCache.delete(tileCache.keys().next().value);
  tileCache.set(seed, tile);
  return tile;
}

/** Grain + vignette over a rectangular art region, in cover coordinates. */
export function applyFilmFinish(ctx, region, seed, amount) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(region.x, region.y, region.w, region.h);
  ctx.clip();
  const pattern = ctx.createPattern(grainTile(seed), 'repeat');
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.fillStyle = pattern;
  ctx.fillRect(region.x, region.y, region.w, region.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  const radius = Math.hypot(region.w, region.h) / 2;
  const vignette = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius);
  vignette.addColorStop(0, 'rgba(20,8,40,0)');
  vignette.addColorStop(1, 'rgba(20,8,40,0.3)');
  ctx.fillStyle = vignette;
  ctx.fillRect(region.x, region.y, region.w, region.h);
  ctx.restore();
}