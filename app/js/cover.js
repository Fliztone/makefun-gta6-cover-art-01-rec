// cover.js — the render pipeline. One function paints the whole poster at any
// size: white frame, photo panels with per-panel crops, the color grade over
// the art, film grain and vignette, the VI badge, and the caption band with
// auto-fitted lettering. Preview and PNG export share this exact code path.

import { coverGeometry, drawPanelPhoto, LAYOUTS, SIZES } from './layouts.js';
import { applyGrade } from './grades.js';
import { applyFilmFinish } from './grain.js';
import { drawCaption, drawTagline, drawBadge, drawBandPalms } from './lettering.js';

/** A scratch canvas pool so repeated renders do not churn allocations. */
const scratchPool = [];
function scratch(w, h) {
  const canvas = scratchPool.pop() ?? document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(w));
  canvas.height = Math.max(2, Math.round(h));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}
function release(s) {
  if (scratchPool.length < 4) scratchPool.push(s.canvas);
}

/**
 * Paint a cover into ctx at W x H.
 * state: { layout, grade, caption, tagline, captionStyle, seed, panels }
 * images: array of drawable sources (canvas or img), one per panel slot.
 */
export function renderCover(ctx, W, H, state, images) {
  const geo = coverGeometry(W, H, state.layout);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Panels into an offscreen art canvas, then grade the whole art at once.
  const art = scratch(geo.art.w, geo.art.h);
  const count = LAYOUTS.find((l) => l.id === state.layout)?.count ?? 4;
  for (let i = 0; i < count; i++) {
    const panel = geo.panels[i];
    const image = images[i] ?? images[0];
    if (!image) continue;
    const localPanel = panel.poly
      ? { ...panel, poly: panel.poly.map((p) => ({ x: p.x - geo.art.x, y: p.y - geo.art.y })), x: panel.x - geo.art.x, y: panel.y - geo.art.y }
      : { ...panel, x: panel.x - geo.art.x, y: panel.y - geo.art.y };
    drawPanelPhoto(art.ctx, localPanel, image, state.panels[i] ?? { zoom: 1, ox: 0, oy: 0 });
  }
  applyGrade(art.canvas, state.grade);
  ctx.drawImage(art.canvas, geo.art.x, geo.art.y);
  release(art);

  // The badge sits over the art's top-right corner; palms flank the band.
  const badgeSize = Math.min(W, H) * 0.115;
  drawBadge(ctx, geo.art.x + geo.art.w - badgeSize - geo.frame * 0.55, geo.art.y + geo.frame * 0.55, badgeSize);
  applyFilmFinish(ctx, geo.art, state.seed, 0.16);

  // Caption band: white, with lettering, tagline and palm silhouettes.
  drawBandPalms(ctx, geo.band, state.seed);
  drawCaption(ctx, geo.band, state.caption || 'VICE CITY', state.captionStyle);
  drawTagline(ctx, geo.band, state.tagline);
}

/** Render a cover into a fresh canvas at the given size. */
export function renderCoverCanvas(W, H, state, images) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  renderCover(canvas.getContext('2d'), W, H, state, images);
  return canvas;
}

/** Export the cover as a PNG data URL at one of the three post sizes. */
export function exportCoverDataURL(sizeId, state, images) {
  const size = SIZES_BY_ID[sizeId] ?? SIZES_BY_ID.portrait;
  const canvas = renderCoverCanvas(size.w, size.h, state, images);
  return canvas.toDataURL('image/png');
}

const SIZES_BY_ID = Object.fromEntries(SIZES.map((s) => [s.id, s]));