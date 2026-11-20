// layouts.js — poster geometry: the white frame, the caption band, and the
// panel arrangements (grid, hero, mosaic, diagonal-duo). All rectangles are
// computed in pixels from the cover size so every export size shares one code
// path. The diagonal duo clips its two panels along a slanted white gutter.

/** The four multi-panel layouts. `count` is how many photos each one shows. */
export const LAYOUTS = [
  { id: 'grid', name: 'Grid', count: 4 },
  { id: 'hero', name: 'Hero', count: 4 },
  { id: 'mosaic', name: 'Mosaic', count: 3 },
  { id: 'diagonal-duo', name: 'Diagonal Duo', count: 2 },
];

/** The three common post sizes the studio exports. */
export const SIZES = [
  { id: 'square', name: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', name: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'landscape', name: '1920 × 1080', w: 1920, h: 1080 },
];

/**
 * Cover geometry in pixels: outer white frame, art area, caption band, and
 * the panel rects (or diagonal polygons) inside the art area.
 */
export function coverGeometry(W, H, layoutId) {
  const m = Math.min(W, H);
  const frame = Math.round(m * 0.038);
  const gutter = Math.max(3, Math.round(m * 0.012));
  const bandH = Math.round(H * (W > H ? 0.2 : 0.17));
  const art = {
    x: frame,
    y: frame,
    w: W - frame * 2,
    h: H - frame * 2 - bandH - gutter,
  };
  const band = { x: frame, y: art.y + art.h + gutter, w: art.w, h: bandH };
  const panels = layoutPanels(layoutId, art, gutter);
  return { frame, gutter, art, band, panels, W, H };
}

/** Panel rects for a layout, in art-area pixels (absolute cover coords). */
function layoutPanels(layoutId, art, gutter) {
  const { x, y, w, h } = art;
  const half = gutter / 2;
  if (layoutId === 'grid') {
    const cw = (w - gutter) / 2;
    const ch = (h - gutter) / 2;
    return [
      { x, y, w: cw, h: ch },
      { x: x + cw + gutter, y, w: cw, h: ch },
      { x, y: y + ch + gutter, w: cw, h: ch },
      { x: x + cw + gutter, y: y + ch + gutter, w: cw, h: ch },
    ];
  }
  if (layoutId === 'hero') {
    const bigH = h * 0.62 - half;
    const smallH = h - bigH - gutter;
    const cw = (w - gutter * 2) / 3;
    const sy = y + bigH + gutter;
    return [
      { x, y, w, h: bigH },
      { x, y: sy, w: cw, h: smallH },
      { x: x + cw + gutter, y: sy, w: cw, h: smallH },
      { x: x + cw * 2 + gutter * 2, y: sy, w: cw, h: smallH },
    ];
  }
  if (layoutId === 'mosaic') {
    const leftW = w * 0.58 - half;
    const rightW = w - leftW - gutter;
    const topH = h * 0.55 - half;
    const bottomH = h - topH - gutter;
    const rx = x + leftW + gutter;
    return [
      { x, y, w: leftW, h },
      { x: rx, y, w: rightW, h: topH },
      { x: rx, y: y + topH + gutter, w: rightW, h: bottomH },
    ];
  }
  // diagonal-duo: two polygons split by a slanted line, white gutter between.
  const topX = x + w * 0.56;
  const botX = x + w * 0.44;
  const skew = gutter * 1.2;
  const left = [
    { x: x, y },
    { x: topX - skew, y },
    { x: botX - skew, y: y + h },
    { x, y: y + h },
  ];
  const right = [
    { x: topX + skew, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x: botX + skew, y: y + h },
  ];
  return [
    { poly: left, x, y, w: botX - skew - x, h },
    { poly: right, x: topX + skew, y, w: x + w - topX - skew, h },
  ];
}

/** Trace a panel's clip path (rect or polygon) onto a context. */
export function tracePanel(ctx, panel) {
  ctx.beginPath();
  if (panel.poly) {
    ctx.moveTo(panel.poly[0].x, panel.poly[0].y);
    for (let i = 1; i < panel.poly.length; i++) ctx.lineTo(panel.poly[i].x, panel.poly[i].y);
    ctx.closePath();
  } else {
    ctx.rect(panel.x, panel.y, panel.w, panel.h);
  }
}

/** Whether a cover-space point falls inside a panel (for drag hit-testing). */
export function hitPanel(panel, px, py) {
  if (panel.poly) {
    let inside = false;
    const pts = panel.poly;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x; const yi = pts[i].y;
      const xj = pts[j].x; const yj = pts[j].y;
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  return px >= panel.x && px <= panel.x + panel.w && py >= panel.y && py <= panel.y + panel.h;
}

/**
 * Draw one panel's photo with cover-fit crop, zoom and drag offset.
 * crop = { zoom, ox, oy }; offsets are fractions of the panel size.
 */
export function drawPanelPhoto(ctx, panel, image, crop) {
  const iw = image.width;
  const ih = image.height;
  const pw = panel.w;
  const ph = panel.h;
  const base = Math.max(pw / iw, ph / ih);
  const scale = base * crop.zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const maxX = Math.max(0, (dw - pw) / 2);
  const maxY = Math.max(0, (dh - ph) / 2);
  const dx = panel.x + pw / 2 - dw / 2 + clamp(crop.ox * pw, -maxX, maxX);
  const dy = panel.y + ph / 2 - dh / 2 + clamp(crop.oy * ph, -maxY, maxY);
  ctx.save();
  tracePanel(ctx, panel);
  ctx.clip();
  ctx.drawImage(image, dx, dy, dw, dh);
  ctx.restore();
}

/** Clamp helper shared by the crop math and the editor. */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Keep a crop's offsets inside the range where the photo still covers the panel. */
export function clampCrop(crop, panel, image) {
  const base = Math.max(panel.w / image.width, panel.h / image.height);
  const scale = base * crop.zoom;
  const maxX = Math.max(0, (image.width * scale - panel.w) / 2) / panel.w;
  const maxY = Math.max(0, (image.height * scale - panel.h) / 2) / panel.h;
  crop.ox = clamp(crop.ox, -maxX, maxX);
  crop.oy = clamp(crop.oy, -maxY, maxY);
  return crop;
}