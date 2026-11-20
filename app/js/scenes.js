// scenes.js — original procedural Vice City sample photos, painted on canvas.
// Every scene is deterministic: a seeded PRNG drives all variation, so the same
// seed always paints the same pixels. No borrowed imagery, no network, no clock.

/** Small fast seeded PRNG (mulberry32): one stream per scene render. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Vertical sky gradient from a list of [stop, color] pairs. */
function paintSky(ctx, w, h, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [t, color] of stops) g.addColorStop(t, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** The classic slatted sun: a warm disc with horizontal cuts across its lower half. */
function paintSun(ctx, cx, cy, r, top, bottom, rng) {
  const disc = document.createElement('canvas');
  disc.width = Math.ceil(r * 2 + 4);
  disc.height = Math.ceil(r * 2 + 4);
  const d = disc.getContext('2d');
  const g = d.createLinearGradient(0, 0, 0, disc.height);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  d.fillStyle = g;
  d.beginPath();
  d.arc(r + 2, r + 2, r, 0, Math.PI * 2);
  d.fill();
  d.globalCompositeOperation = 'destination-out';
  let y = r + 2 - r * 0.25;
  let gap = r * 0.18;
  while (y < disc.height) {
    const thick = Math.max(2, gap * 0.5);
    d.fillRect(0, y, disc.width, thick);
    y += gap;
    gap *= 0.88;
  }
  ctx.save();
  ctx.shadowColor = top;
  ctx.shadowBlur = r * 0.55;
  ctx.drawImage(disc, cx - r - 2, cy - r - 2);
  ctx.restore();
  void rng;
}

/** Soft warm clouds: a few stacked translucent ellipses. */
function paintClouds(ctx, w, h, rng, color, count, yMin, yMax) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const cx = range(rng, 0, w);
    const cy = range(rng, h * yMin, h * yMax);
    const rw = range(rng, w * 0.12, w * 0.34);
    const rh = rw * range(rng, 0.1, 0.2);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rw);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = range(rng, 0.25, 0.6);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A palm silhouette: tapered curved trunk plus arching, drooping fronds. */
export function paintPalm(ctx, x, y, height, lean, color, rng) {
  ctx.save();
  ctx.fillStyle = color;
  const topX = x + lean * height * 0.22;
  const topY = y - height;
  const wBase = height * 0.055;
  const wTop = height * 0.026;
  const cx = x + lean * height * 0.06;
  const cy = y - height * 0.55;
  ctx.beginPath();
  ctx.moveTo(x - wBase, y);
  ctx.quadraticCurveTo(cx - wTop, cy, topX - wTop, topY);
  ctx.lineTo(topX + wTop, topY);
  ctx.quadraticCurveTo(cx + wTop, cy, x + wBase, y);
  ctx.closePath();
  ctx.fill();
  const fronds = 11 + Math.floor(rng() * 3);
  for (let i = 0; i < fronds; i++) {
    const t = i / (fronds - 1);
    const ang = -Math.PI * (0.08 + 0.84 * t) + range(rng, -0.05, 0.05);
    const len = height * range(rng, 0.36, 0.5);
    const dirX = Math.cos(ang);
    const dirY = Math.sin(ang);
    const tipX = topX + dirX * len;
    const tipY = topY + dirY * len * 0.6 + len * 0.34;
    const ctrlX = topX + dirX * len * 0.45;
    const ctrlY = topY + dirY * len * 0.5 - len * 0.16;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    ctx.quadraticCurveTo(ctrlX + len * 0.02, ctrlY + len * 0.12, topX, topY + height * 0.03);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(topX, topY + height * 0.02, height * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Seeded skyline of deco towers with lit windows. */
function paintSkyline(ctx, w, baseY, minH, maxH, color, windowColor, rng, litChance) {
  ctx.save();
  let x = -w * 0.02;
  while (x < w) {
    const bw = range(rng, w * 0.05, w * 0.12);
    const bh = range(rng, minH, maxH);
    const top = baseY - bh;
    ctx.fillStyle = color;
    ctx.fillRect(x, top, bw, bh + 2);
    if (rng() < 0.4) {
      ctx.fillRect(x + bw * 0.3, top - bh * 0.14, bw * 0.4, bh * 0.14);
    }
    if (rng() < 0.3) {
      ctx.fillRect(x + bw * 0.48, top - bh * 0.3, Math.max(1.5, bw * 0.03), bh * 0.3);
    }
    if (windowColor) {
      ctx.fillStyle = windowColor;
      const cols = Math.max(2, Math.floor(bw / (w * 0.016)));
      const rows = Math.max(3, Math.floor(bh / (w * 0.02)));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() < litChance) {
            ctx.globalAlpha = range(rng, 0.35, 0.95);
            ctx.fillRect(
              x + bw * 0.12 + (c * bw * 0.78) / cols,
              top + bh * 0.06 + (r * bh * 0.88) / rows,
              (bw * 0.78) / cols * 0.55,
              (bh * 0.88) / rows * 0.5
            );
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    x += bw + range(rng, w * 0.004, w * 0.02);
  }
  ctx.restore();
}

/** Water: gradient plus seeded horizontal glints and a sun glitter column. */
function paintWater(ctx, w, h, topY, stops, glintColor, rng, glitterX) {
  const g = ctx.createLinearGradient(0, topY, 0, h);
  for (const [t, color] of stops) g.addColorStop(t, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, topY, w, h - topY);
  ctx.save();
  const rows = Math.floor((h - topY) / (h * 0.012));
  for (let i = 0; i < rows; i++) {
    const y = topY + range(rng, 0, h - topY);
    const depth = (y - topY) / (h - topY);
    const rw = range(rng, w * 0.02, w * 0.16) * (0.5 + depth);
    const rx = glitterX !== undefined
      ? glitterX + range(rng, -w * 0.12, w * 0.12) * (0.4 + depth)
      : range(rng, 0, w);
    ctx.globalAlpha = range(rng, 0.06, 0.3) * (glitterX !== undefined ? 1.4 : 1);
    ctx.fillStyle = glintColor;
    ctx.fillRect(rx - rw / 2, y, rw, Math.max(1.2, h * 0.0035));
  }
  ctx.restore();
}

function paintStars(ctx, w, h, rng, count, maxY) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = range(rng, 0.2, 0.9);
    const s = range(rng, 0.8, 2.2);
    ctx.fillRect(range(rng, 0, w), range(rng, 0, h * maxY), s, s);
  }
  ctx.restore();
}

/** Glowing neon sign text on a building face. */
function paintNeonSign(ctx, x, y, text, size, color, rng) {
  ctx.save();
  ctx.font = `${size}px Bungee, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.9;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.95;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = size * 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, x, y);
  ctx.restore();
  void rng;
}

/** Vertical neon reflection smears on wet asphalt. */
function paintWetStreet(ctx, w, h, topY, rng, colors) {
  const g = ctx.createLinearGradient(0, topY, 0, h);
  g.addColorStop(0, '#151028');
  g.addColorStop(1, '#070510');
  ctx.fillStyle = g;
  ctx.fillRect(0, topY, w, h - topY);
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const color = pick(rng, colors);
    const x = range(rng, 0, w);
    const sw = range(rng, w * 0.008, w * 0.035);
    const sh = range(rng, h * 0.05, h * 0.24);
    const y = topY + range(rng, 0, (h - topY) * 0.7);
    const rg = ctx.createLinearGradient(0, y, 0, y + sh);
    rg.addColorStop(0, color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = range(rng, 0.15, 0.5);
    ctx.fillStyle = rg;
    ctx.fillRect(x, y, sw, sh);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The scenes. Each paints into a w x h context; all coordinates are relative
// so a scene works at any panel aspect.
// ---------------------------------------------------------------------------

function sceneSunsetStrip(ctx, w, h, rng) {
  paintSky(ctx, w, h, [
    [0, '#2b1a5e'], [0.32, '#a13a8f'], [0.55, '#ff5e78'], [0.72, '#ff9a3d'], [0.86, '#ffd23f'],
  ]);
  paintClouds(ctx, w, h, rng, 'rgba(255,190,120,0.9)', 6, 0.1, 0.45);
  const horizon = h * 0.68;
  paintSkyline(ctx, w, horizon, h * 0.05, h * 0.2, '#2a1448', 'rgba(255,205,110,0.85)', rng, 0.22);
  paintSun(ctx, w * 0.5, horizon - h * 0.07, Math.min(w, h) * 0.19, '#ffe95e', '#ff2e88', rng);
  paintWater(ctx, w, h, horizon, [[0, '#e86a5e'], [0.4, '#8f3a7e'], [1, '#2b1a5e']], '#ffd9a0', rng, w * 0.5);
  paintPalm(ctx, w * 0.05, h * 0.99, h * 0.36, 1, '#160b2e', rng);
  paintPalm(ctx, w * 0.96, h * 1.0, h * 0.42, -1, '#160b2e', rng);
  paintPalm(ctx, w * 0.84, h * 0.99, h * 0.26, -1, '#1d1038', rng);
}

function sceneNeonNights(ctx, w, h, rng) {
  paintSky(ctx, w, h, [[0, '#05030f'], [0.45, '#1a0f3d'], [0.75, '#4a1670'], [1, '#8f2a6e']]);
  paintStars(ctx, w, h, rng, 70, 0.4);
  const streetY = h * 0.74;
  paintSkyline(ctx, w, streetY, h * 0.18, h * 0.52, '#0d0722', 'rgba(120,220,255,0.8)', rng, 0.3);
  paintSkyline(ctx, w, streetY, h * 0.08, h * 0.24, '#1a0f33', 'rgba(255,120,220,0.8)', rng, 0.35);
  paintNeonSign(ctx, w * 0.3, h * 0.34, 'MOTEL', Math.min(w, h) * 0.07, '#ff2ed8', rng);
  paintNeonSign(ctx, w * 0.7, h * 0.26, '24H', Math.min(w, h) * 0.065, '#2ee8ff', rng);
  paintNeonSign(ctx, w * 0.5, h * 0.52, 'CLUB', Math.min(w, h) * 0.06, '#ffb02e', rng);
  paintWetStreet(ctx, w, h, streetY, rng, ['#ff2ed8', '#2ee8ff', '#ffb02e', '#8f4bff']);
  paintPalm(ctx, w * 0.04, streetY + h * 0.02, h * 0.44, 1, '#05030f', rng);
  paintPalm(ctx, w * 0.97, streetY + h * 0.03, h * 0.52, -1, '#05030f', rng);
}

function sceneGoldenMarina(ctx, w, h, rng) {
  paintSky(ctx, w, h, [[0, '#7ec8e8'], [0.35, '#ffd9a0'], [0.62, '#ffb05e'], [0.78, '#ff8a4d']]);
  paintClouds(ctx, w, h, rng, 'rgba(255,240,200,0.95)', 5, 0.08, 0.4);
  const waterY = h * 0.62;
  paintSun(ctx, w * 0.62, waterY - h * 0.1, Math.min(w, h) * 0.14, '#fff6d8', '#ffb02e', rng);
  paintSkyline(ctx, w, waterY, h * 0.03, h * 0.1, '#b06a4e', null, rng, 0);
  paintWater(ctx, w, h, waterY, [[0, '#ffb877'], [0.45, '#e88a5e'], [1, '#8f4a3e']], '#fff0c0', rng, w * 0.62);
  // Yacht silhouettes with warm rim light.
  for (const [bx, by, s] of [[0.22, 0.72, 1], [0.55, 0.8, 1.4], [0.84, 0.7, 0.8]]) {
    const bw = w * 0.16 * s;
    const bh = h * 0.035 * s;
    const x = w * bx - bw / 2;
    const y = h * by;
    ctx.fillStyle = '#3a1f2e';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + bw, y);
    ctx.lineTo(x + bw * 0.86, y + bh);
    ctx.lineTo(x + bw * 0.1, y + bh);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x + bw * 0.3, y - bh * 0.9, bw * 0.42, bh * 0.9);
    ctx.fillRect(x + bw * 0.48, y - bh * 2.4, Math.max(1.5, bw * 0.02), bh * 1.6);
    ctx.fillStyle = 'rgba(255,220,150,0.9)';
    ctx.fillRect(x + bw * 0.34, y - bh * 0.6, bw * 0.1, bh * 0.3);
    ctx.fillRect(x + bw * 0.52, y - bh * 0.6, bw * 0.1, bh * 0.3);
  }
  // Pier posts in the foreground.
  ctx.fillStyle = '#2a1420';
  for (let i = 0; i < 4; i++) {
    const px = w * (0.06 + i * 0.055);
    ctx.fillRect(px, h * 0.86, w * 0.014, h * 0.14);
  }
  ctx.fillRect(0, h * 0.855, w * 0.26, h * 0.018);
  // Birds.
  ctx.strokeStyle = '#4a2a30';
  ctx.lineWidth = Math.max(1.2, h * 0.003);
  for (let i = 0; i < 4; i++) {
    const bx = range(rng, w * 0.15, w * 0.85);
    const by = range(rng, h * 0.1, h * 0.3);
    const s = range(rng, w * 0.012, w * 0.025);
    ctx.beginPath();
    ctx.moveTo(bx - s, by);
    ctx.quadraticCurveTo(bx - s * 0.4, by - s * 0.6, bx, by);
    ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.6, bx + s, by);
    ctx.stroke();
  }
}

function sceneCausewayDusk(ctx, w, h, rng) {
  paintSky(ctx, w, h, [[0, '#1e3a6e'], [0.35, '#4a6aa8'], [0.6, '#e88a8f'], [0.78, '#ffb877'], [0.9, '#ffd9a0']]);
  paintClouds(ctx, w, h, rng, 'rgba(255,170,140,0.85)', 5, 0.15, 0.5);
  const waterY = h * 0.7;
  paintSun(ctx, w * 0.36, waterY - h * 0.03, Math.min(w, h) * 0.12, '#fff0c8', '#ff8a5e', rng);
  paintWater(ctx, w, h, waterY, [[0, '#e89a7e'], [0.5, '#5e5a9e'], [1, '#22305e']], '#ffe0b0', rng, w * 0.36);
  // Cable-stayed bridge silhouette.
  const deckY = h * 0.62;
  ctx.fillStyle = '#1a1230';
  ctx.fillRect(0, deckY, w, h * 0.022);
  const towers = [w * 0.3, w * 0.72];
  const spans = [[0, w * 0.51], [w * 0.51, w]];
  ctx.strokeStyle = '#1a1230';
  towers.forEach((tx, ti) => {
    ctx.lineWidth = Math.max(2, w * 0.012);
    ctx.beginPath();
    ctx.moveTo(tx, deckY + h * 0.02);
    ctx.lineTo(tx, deckY - h * 0.26);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, w * 0.0028);
    const leftReach = tx - spans[ti][0];
    const rightReach = spans[ti][1] - tx;
    for (let i = 1; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(tx, deckY - h * 0.25);
      ctx.lineTo(tx - (leftReach * i) / 6, deckY);
      ctx.moveTo(tx, deckY - h * 0.25);
      ctx.lineTo(tx + (rightReach * i) / 6, deckY);
      ctx.stroke();
    }
  });
  // Deck lights.
  ctx.fillStyle = 'rgba(255,215,140,0.95)';
  for (let i = 0; i < 16; i++) {
    ctx.fillRect(w * (0.03 + i * 0.062), deckY - h * 0.006, Math.max(1.5, w * 0.004), h * 0.006);
  }
  paintPalm(ctx, w * 0.03, h * 1.0, h * 0.42, 1, '#120a24', rng);
  paintPalm(ctx, w * 0.98, h * 1.0, h * 0.5, -1, '#120a24', rng);
}

function sceneDowntownHeat(ctx, w, h, rng) {
  paintSky(ctx, w, h, [[0, '#8fd0e8'], [0.4, '#ffe0b0'], [0.75, '#ffb887'], [1, '#ff9a6e']]);
  const haze = ctx.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.6);
  haze.addColorStop(0, 'rgba(255,246,220,0.95)');
  haze.addColorStop(1, 'rgba(255,246,220,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);
  const baseY = h * 0.92;
  // Glass towers: teal faces with warm reflections and window grids.
  let x = -w * 0.03;
  while (x < w) {
    const bw = range(rng, w * 0.09, w * 0.17);
    const bh = range(rng, h * 0.3, h * 0.72);
    const top = baseY - bh;
    const face = ctx.createLinearGradient(x, top, x + bw, top);
    face.addColorStop(0, '#2a6a80');
    face.addColorStop(0.55, '#3f8fa0');
    face.addColorStop(1, '#e8a06e');
    ctx.fillStyle = face;
    ctx.fillRect(x, top, bw, bh);
    ctx.fillStyle = 'rgba(20,40,60,0.35)';
    const rows = Math.floor(bh / (h * 0.022));
    for (let r = 0; r < rows; r++) ctx.fillRect(x, top + r * h * 0.022, bw, Math.max(1, h * 0.003));
    const cols = Math.floor(bw / (w * 0.02));
    for (let c = 0; c < cols; c++) ctx.fillRect(x + c * (bw / cols), top, Math.max(1, w * 0.002), bh);
    if (rng() < 0.5) {
      ctx.fillStyle = '#2a5a70';
      ctx.fillRect(x + bw * 0.35, top - bh * 0.08, bw * 0.3, bh * 0.08);
    }
    x += bw + range(rng, w * 0.006, w * 0.03);
  }
  ctx.fillStyle = '#3a2a40';
  ctx.fillRect(0, baseY, w, h - baseY);
  paintPalm(ctx, w * 0.08, h * 1.0, h * 0.4, 1, '#2a1a30', rng);
  paintPalm(ctx, w * 0.2, h * 1.0, h * 0.3, 1, '#2a1a30', rng);
  paintPalm(ctx, w * 0.92, h * 1.0, h * 0.44, -1, '#2a1a30', rng);
}

function sceneMidnightPier(ctx, w, h, rng) {
  paintSky(ctx, w, h, [[0, '#060418'], [0.5, '#22104a'], [0.8, '#6e2270'], [1, '#c44a7e']]);
  paintStars(ctx, w, h, rng, 90, 0.5);
  const waterY = h * 0.72;
  // Ferris wheel of lights.
  const cx = w * 0.62;
  const cy = h * 0.4;
  const R = Math.min(w, h) * 0.26;
  ctx.save();
  ctx.strokeStyle = '#ff5ea8';
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = R * 0.12;
  ctx.lineWidth = Math.max(1.5, R * 0.02);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  const spokes = 12;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
    ctx.fillStyle = i % 2 ? '#2ee8ff' : '#ffd23f';
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a1650';
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(2, R * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.6, waterY);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + R * 0.6, waterY);
  ctx.stroke();
  ctx.restore();
  paintSkyline(ctx, w, waterY, h * 0.04, h * 0.14, '#120a28', 'rgba(255,170,220,0.75)', rng, 0.3);
  paintWater(ctx, w, h, waterY, [[0, '#4a1a5e'], [0.5, '#22104a'], [1, '#0a0620']], '#ff9ad0', rng, cx);
  // Pier deck.
  ctx.fillStyle = '#0a0518';
  ctx.fillRect(0, h * 0.88, w * 0.55, h * 0.025);
  for (let i = 0; i < 6; i++) ctx.fillRect(w * (0.04 + i * 0.09), h * 0.9, w * 0.012, h * 0.1);
  ctx.fillStyle = 'rgba(255,210,120,0.95)';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(w * (0.06 + i * 0.1), h * 0.872, Math.max(1.5, w * 0.005), 0, Math.PI * 2);
    ctx.fill();
  }
  paintPalm(ctx, w * 0.02, h * 0.89, h * 0.36, 1, '#060312', rng);
}

/** The sample photo library: id, display name and painter. */
export const SCENES = [
  { id: 'sunset-strip', name: 'Sunset Strip', paint: sceneSunsetStrip },
  { id: 'neon-nights', name: 'Neon Nights', paint: sceneNeonNights },
  { id: 'golden-marina', name: 'Golden Marina', paint: sceneGoldenMarina },
  { id: 'causeway-dusk', name: 'Causeway Dusk', paint: sceneCausewayDusk },
  { id: 'downtown-heat', name: 'Downtown Heat', paint: sceneDowntownHeat },
  { id: 'midnight-pier', name: 'Midnight Pier', paint: sceneMidnightPier },
];

/** Paint a scene into a fresh canvas at the given size, deterministic per seed. */
export function renderScene(id, w, h, seed) {
  const scene = SCENES.find((s) => s.id === id) ?? SCENES[0];
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(w));
  canvas.height = Math.max(2, Math.round(h));
  const ctx = canvas.getContext('2d');
  const index = SCENES.indexOf(scene);
  scene.paint(ctx, canvas.width, canvas.height, mulberry32(seed * 7919 + index * 104729 + 17));
  return canvas;
}