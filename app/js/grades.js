// grades.js — the five color grades. Each is a deterministic pixel transform:
// per-channel lift/gamma/gain LUTs, a saturation push, then a luminance-keyed
// tint blend that pushes shadows and highlights toward the grade's palette.

/** Build a 256-entry LUT for one channel: contrast, then lift and gain. */
function channelLUT(contrast, lift, gain) {
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let x = (v - 128) * contrast + 128;
    x = x * gain + lift * 255;
    lut[v] = x;
  }
  return lut;
}

/**
 * A grade definition. shadowTint/highTint are RGB anchors blended by pixel
 * luminance; strength is how far the grade pulls the image toward them.
 */
export const GRADES = [
  { id: 'raw', name: 'Raw', swatch: ['#9aa0a8', '#d8dade'], params: null },
  {
    id: 'vice-sunset', name: 'Vice Sunset', swatch: ['#ff2e88', '#ff9a3d'],
    params: {
      contrast: 1.07, sat: 1.18,
      lift: [0.045, 0.0, 0.07], gain: [1.05, 0.95, 1.02],
      shadowTint: [96, 26, 128], highTint: [255, 170, 66], strength: 0.38,
    },
  },
  {
    id: 'neon-night', name: 'Neon Night', swatch: ['#2ee8ff', '#ff2ed8'],
    params: {
      contrast: 1.12, sat: 1.24,
      lift: [0.015, 0.01, 0.08], gain: [0.93, 0.96, 1.12],
      shadowTint: [18, 26, 100], highTint: [70, 226, 255], strength: 0.42,
    },
  },
  {
    id: 'golden', name: 'Golden', swatch: ['#ffd23f', '#ff8a4d'],
    params: {
      contrast: 1.05, sat: 1.12,
      lift: [0.055, 0.03, 0.0], gain: [1.08, 1.0, 0.88],
      shadowTint: [100, 58, 18], highTint: [255, 216, 122], strength: 0.4,
    },
  },
  {
    id: 'ocean', name: 'Ocean', swatch: ['#2ee8c8', '#3a7bd5'],
    params: {
      contrast: 1.06, sat: 1.06,
      lift: [0.0, 0.03, 0.055], gain: [0.9, 1.02, 1.1],
      shadowTint: [10, 50, 92], highTint: [142, 232, 236], strength: 0.42,
    },
  },
];

/**
 * Apply a grade to a canvas in place. Returns the canvas. 'raw' is a no-op.
 * The transform is pure arithmetic on pixels: identical input, identical output.
 */
export function applyGrade(canvas, gradeId) {
  const grade = GRADES.find((g) => g.id === gradeId);
  if (!grade || !grade.params) return canvas;
  const p = grade.params;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const frame = ctx.getImageData(0, 0, w, h);
  const d = frame.data;
  const lr = channelLUT(p.contrast, p.lift[0], p.gain[0]);
  const lg = channelLUT(p.contrast, p.lift[1], p.gain[1]);
  const lb = channelLUT(p.contrast, p.lift[2], p.gain[2]);
  const [sr, sg, sb] = p.shadowTint;
  const [hr, hg, hb] = p.highTint;
  const strength = p.strength;
  const keep = 1 - strength;
  const sat = p.sat;
  for (let i = 0; i < d.length; i += 4) {
    let r = lr[d[i]];
    let g = lg[d[i + 1]];
    let b = lb[d[i + 2]];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    r = luma + (r - luma) * sat;
    g = luma + (g - luma) * sat;
    b = luma + (b - luma) * sat;
    const t = luma / 255;
    const tr = sr + (hr - sr) * t;
    const tg = sg + (hg - sg) * t;
    const tb = sb + (hb - sb) * t;
    d[i] = r * keep + (tr * r) / 255 * strength;
    d[i + 1] = g * keep + (tg * g) / 255 * strength;
    d[i + 2] = b * keep + (tb * b) / 255 * strength;
  }
  ctx.putImageData(frame, 0, 0);
  return canvas;
}