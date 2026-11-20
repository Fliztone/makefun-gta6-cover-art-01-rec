// lettering.js — the poster's voice: auto-fitted bold caption lettering in
// three styles (sunset gradient, neon, chrome), the tagline, an original VI
// badge, and palm silhouettes flanking the caption band. Fonts are the shipped
// OFL files: Bungee for display, Anton for the tagline.

import { paintPalm, mulberry32 } from './scenes.js';

export const CAPTION_STYLES = [
  { id: 'sunset', name: 'Sunset Gradient' },
  { id: 'neon', name: 'Neon' },
  { id: 'chrome', name: 'Chrome' },
];

/** Auto-fit one line: shrink long captions, grow short ones, within bounds. */
export function fitCaptionSize(ctx, text, maxWidth, startSize, font, maxSize) {
  let size = startSize;
  ctx.font = `${size}px ${font}`;
  const width = ctx.measureText(text).width;
  if (width > maxWidth) {
    while (size > 12 && ctx.measureText(text).width > maxWidth) {
      size *= 0.94;
      ctx.font = `${size}px ${font}`;
    }
  } else if (maxSize && width < maxWidth * 0.82) {
    const grown = Math.min(maxSize, size * (maxWidth * 0.9) / width);
    size = grown;
    ctx.font = `${size}px ${font}`;
    while (size > startSize && ctx.measureText(text).width > maxWidth) {
      size *= 0.96;
      ctx.font = `${size}px ${font}`;
    }
  }
  return size;
}

function captionGradient(ctx, style, x, yTop, yBottom) {
  const g = ctx.createLinearGradient(0, yTop, 0, yBottom);
  if (style === 'sunset') {
    g.addColorStop(0, '#ffd23f');
    g.addColorStop(0.42, '#ff7a3d');
    g.addColorStop(0.75, '#ff2e88');
    g.addColorStop(1, '#a44aff');
  } else if (style === 'chrome') {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#c9d4e0');
    g.addColorStop(0.5, '#7e8a9c');
    g.addColorStop(0.62, '#eef2f7');
    g.addColorStop(1, '#9aa6b8');
  } else {
    g.addColorStop(0, '#ff5ee0');
    g.addColorStop(1, '#8f2eff');
  }
  return g;
}

/**
 * Draw the caption centered in the band. The lettering is outlined, shadowed
 * and style-filled; 'neon' adds a cyan chromatic ghost behind the magenta face.
 */
export function drawCaption(ctx, band, text, style) {
  const maxWidth = band.w * 0.86;
  const startSize = band.h * 0.46;
  const size = fitCaptionSize(ctx, text, maxWidth, startSize, 'Bungee, sans-serif', band.h * 0.58);
  const cx = band.x + band.w / 2;
  const cy = band.y + band.h * 0.44;
  ctx.save();
  ctx.font = `${size}px Bungee, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (style === 'neon') {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#2ee8ff';
    ctx.fillText(text, cx + size * 0.045, cy + size * 0.035);
    ctx.restore();
  }
  ctx.shadowColor = style === 'chrome' ? 'rgba(30,40,60,0.4)' : 'rgba(255,46,136,0.35)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.05;
  ctx.fillStyle = captionGradient(ctx, style, cx, cy - size * 0.55, cy + size * 0.55);
  ctx.fillText(text, cx, cy);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = style === 'chrome' ? '#232a36' : '#2a0f3e';
  ctx.lineWidth = Math.max(1.5, size * 0.045);
  ctx.strokeText(text, cx, cy);
  ctx.restore();
  return size;
}

/** The small tracked-out tagline under the caption, in Anton. */
export function drawTagline(ctx, band, text) {
  if (!text) return;
  const size = band.h * 0.135;
  ctx.save();
  ctx.font = `${size}px Anton, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3a2050';
  const tracking = size * 0.32;
  const chars = [...text.toUpperCase()];
  let total = 0;
  for (const ch of chars) total += ctx.measureText(ch).width + tracking;
  total -= tracking;
  let x = band.x + band.w / 2 - total / 2;
  const y = band.y + band.h * 0.8;
  for (const ch of chars) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + tracking;
  }
  ctx.restore();
}

/**
 * The original VI badge: a sunset-gradient rounded shield with bold white VI
 * lettering and a thin inner keyline. Drawn over the art's top-right corner.
 */
export function drawBadge(ctx, x, y, size) {
  ctx.save();
  const r = size * 0.22;
  const g = ctx.createLinearGradient(x, y, x + size, y + size);
  g.addColorStop(0, '#ff2e88');
  g.addColorStop(0.55, '#ff6a3d');
  g.addColorStop(1, '#ffb02e');
  ctx.shadowColor = 'rgba(20,8,40,0.45)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.05;
  roundRect(ctx, x, y, size, size, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  roundRect(ctx, x + size * 0.07, y + size * 0.07, size * 0.86, size * 0.86, r * 0.7);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1.5, size * 0.03);
  ctx.stroke();
  ctx.font = `${size * 0.52}px Bungee, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(42,10,50,0.5)';
  ctx.fillText('VI', x + size * 0.52, y + size * 0.565);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('VI', x + size * 0.5, y + size * 0.53);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Palm silhouettes flanking the caption band, seeded so they never jitter. */
export function drawBandPalms(ctx, band, seed) {
  const rng = mulberry32(seed * 31 + 7);
  const ph = band.h * 0.78;
  paintPalm(ctx, band.x + band.w * 0.035, band.y + band.h * 0.96, ph, 1, '#241238', rng);
  paintPalm(ctx, band.x + band.w * 0.965, band.y + band.h * 0.96, ph * 0.92, -1, '#241238', rng);
}