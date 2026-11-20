// studio.js — the editor: state, live preview, per-panel drag/zoom cropping,
// photo uploads that never leave the device, and one-click PNG export.
// Everything renders through cover.js, so the preview is the export.

import { SCENES, renderScene } from './scenes.js';
import { GRADES } from './grades.js';
import { LAYOUTS, SIZES, coverGeometry, drawPanelPhoto, hitPanel, clampCrop, clamp } from './layouts.js';
import { CAPTION_STYLES } from './lettering.js';
import { renderCover, renderCoverCanvas, exportCoverDataURL } from './cover.js';

const SCENE_W = 1080;
const SCENE_H = 1350;
const PREVIEW_LONG = 760;

/** Editor state. panels holds one crop per slot; layouts use the first N. */
const state = {
  layout: 'grid',
  grade: 'vice-sunset',
  caption: 'VICE CITY',
  tagline: 'SUMMER NEVER ENDS',
  captionStyle: 'sunset',
  size: 'portrait',
  seed: 1,
  selected: 0,
  panels: [
    { source: 'scene:sunset-strip', zoom: 1, ox: 0, oy: 0 },
    { source: 'scene:neon-nights', zoom: 1, ox: 0, oy: 0 },
    { source: 'scene:golden-marina', zoom: 1, ox: 0, oy: 0 },
    { source: 'scene:causeway-dusk', zoom: 1, ox: 0, oy: 0 },
  ],
};

/** Image registry: scene canvases plus uploaded photos, keyed by source id. */
const sources = new Map();
let uploadCount = 0;

const preview = document.getElementById('preview');
const previewCtx = preview.getContext('2d');
const stage = document.getElementById('stage');
let renderQueued = false;
let drag = null;

function currentSize() {
  return SIZES.find((s) => s.id === state.size) ?? SIZES[1];
}

function layoutCount() {
  return LAYOUTS.find((l) => l.id === state.layout)?.count ?? 4;
}

function panelImages() {
  return state.panels.map((p) => sources.get(p.source)?.image ?? null);
}

function buildScenes() {
  for (const scene of SCENES) {
    sources.set(`scene:${scene.id}`, {
      image: renderScene(scene.id, SCENE_W, SCENE_H, state.seed),
      name: scene.name,
      kind: 'scene',
    });
  }
}

// ---------------------------------------------------------------------------
// Preview rendering
// ---------------------------------------------------------------------------

function previewDims() {
  const size = currentSize();
  const scale = PREVIEW_LONG / Math.max(size.w, size.h);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function renderPreview() {
  const { w, h } = previewDims();
  if (preview.width !== w || preview.height !== h) {
    preview.width = w;
    preview.height = h;
  }
  renderCover(previewCtx, w, h, state, panelImages());
  renderPanelThumbs();
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPreview();
  });
}

/** Map a pointer event to cover coordinates. */
function coverPoint(e) {
  const rect = preview.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * preview.width,
    y: ((e.clientY - rect.top) / rect.height) * preview.height,
  };
}

function panelAt(x, y) {
  const geo = coverGeometry(preview.width, preview.height, state.layout);
  for (let i = layoutCount() - 1; i >= 0; i--) {
    if (hitPanel(geo.panels[i], x, y)) return i;
  }
  return -1;
}

function bindPreview() {
  preview.addEventListener('pointerdown', (e) => {
    const pt = coverPoint(e);
    const i = panelAt(pt.x, pt.y);
    if (i < 0) return;
    selectPanel(i);
    const crop = state.panels[i];
    drag = { i, x: pt.x, y: pt.y, ox: crop.ox, oy: crop.oy, moved: false };
    preview.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  preview.addEventListener('pointermove', (e) => {
    if (!drag) {
      const pt = coverPoint(e);
      preview.style.cursor = panelAt(pt.x, pt.y) >= 0 ? 'grab' : 'default';
      return;
    }
    const pt = coverPoint(e);
    const geo = coverGeometry(preview.width, preview.height, state.layout);
    const panel = geo.panels[drag.i];
    const crop = state.panels[drag.i];
    crop.ox = drag.ox + (pt.x - drag.x) / panel.w;
    crop.oy = drag.oy + (pt.y - drag.y) / panel.h;
    const image = sources.get(crop.source)?.image;
    if (image) clampCrop(crop, panel, image);
    drag.moved = true;
    preview.style.cursor = 'grabbing';
    queueRender();
  });
  const endDrag = () => {
    if (drag) {
      drag = null;
      preview.style.cursor = 'grab';
      syncPanelControls();
    }
  };
  preview.addEventListener('pointerup', endDrag);
  preview.addEventListener('pointercancel', endDrag);
  preview.addEventListener('wheel', (e) => {
    const pt = coverPoint(e);
    const i = panelAt(pt.x, pt.y);
    if (i < 0) return;
    e.preventDefault();
    selectPanel(i);
    const crop = state.panels[i];
    crop.zoom = clamp(crop.zoom * Math.exp(-e.deltaY * 0.0012), 1, 5);
    const geo = coverGeometry(preview.width, preview.height, state.layout);
    const image = sources.get(crop.source)?.image;
    if (image) clampCrop(crop, geo.panels[i], image);
    queueRender();
    syncPanelControls();
  }, { passive: false });
  // Drop photos straight onto the poster.
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) loadFiles(e.dataTransfer.files);
  });
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildLayoutButtons() {
  const wrap = document.getElementById('layout-buttons');
  for (const layout of LAYOUTS) {
    const btn = el('button', 'chip layout-chip');
    btn.type = 'button';
    btn.dataset.layout = layout.id;
    const icon = document.createElement('canvas');
    icon.width = 34;
    icon.height = 34;
    drawLayoutIcon(icon, layout.id);
    btn.append(icon, el('span', null, layout.name));
    btn.addEventListener('click', () => {
      state.layout = layout.id;
      state.selected = Math.min(state.selected, layoutCount() - 1);
      syncControls();
      queueRender();
    });
    wrap.append(btn);
  }
}

/** Tiny white-on-dark diagram of a layout, drawn from the real geometry. */
function drawLayoutIcon(canvas, layoutId) {
  const ctx = canvas.getContext('2d');
  const geo = coverGeometry(34, 34, layoutId);
  ctx.fillStyle = '#241238';
  ctx.fillRect(0, 0, 34, 34);
  ctx.fillStyle = '#ff7ab8';
  for (const panel of geo.panels) {
    ctx.save();
    if (panel.poly) {
      ctx.beginPath();
      ctx.moveTo(panel.poly[0].x, panel.poly[0].y);
      for (const p of panel.poly.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    }
    ctx.restore();
  }
}

function buildGradeButtons() {
  const wrap = document.getElementById('grade-buttons');
  for (const grade of GRADES) {
    const btn = el('button', 'chip grade-chip');
    btn.type = 'button';
    btn.dataset.grade = grade.id;
    const swatch = el('span', 'swatch');
    swatch.style.background = `linear-gradient(135deg, ${grade.swatch[0]}, ${grade.swatch[1]})`;
    btn.append(swatch, el('span', null, grade.name));
    btn.addEventListener('click', () => {
      state.grade = grade.id;
      syncControls();
      queueRender();
    });
    wrap.append(btn);
  }
}

function buildStyleButtons() {
  const wrap = document.getElementById('style-buttons');
  for (const style of CAPTION_STYLES) {
    const btn = el('button', 'chip', style.name);
    btn.type = 'button';
    btn.dataset.style = style.id;
    btn.addEventListener('click', () => {
      state.captionStyle = style.id;
      syncControls();
      queueRender();
    });
    wrap.append(btn);
  }
}

function buildSizeButtons() {
  const wrap = document.getElementById('size-buttons');
  for (const size of SIZES) {
    const btn = el('button', 'chip', size.name);
    btn.type = 'button';
    btn.dataset.size = size.id;
    btn.addEventListener('click', () => {
      state.size = size.id;
      syncControls();
      queueRender();
    });
    wrap.append(btn);
  }
}

function sourceOptions() {
  const options = [];
  for (const scene of SCENES) options.push({ id: `scene:${scene.id}`, name: scene.name });
  for (const [id, src] of sources) {
    if (src.kind === 'upload') options.push({ id, name: src.name });
  }
  return options;
}

function buildPanelRows() {
  const wrap = document.getElementById('panel-rows');
  wrap.textContent = '';
  for (let i = 0; i < 4; i++) {
    const row = el('div', 'panel-row');
    row.dataset.panel = String(i);
    const thumb = document.createElement('canvas');
    thumb.width = 52;
    thumb.height = 52;
    thumb.className = 'panel-thumb';
    const body = el('div', 'panel-body');
    const select = el('select', 'panel-source');
    select.dataset.panel = String(i);
    for (const opt of sourceOptions()) {
      const option = el('option', null, opt.name);
      option.value = opt.id;
      select.append(option);
    }
    select.value = state.panels[i].source;
    select.addEventListener('change', () => {
      state.panels[i].source = select.value;
      state.panels[i].ox = 0;
      state.panels[i].oy = 0;
      queueRender();
    });
    const zoom = el('input', 'panel-zoom');
    zoom.type = 'range';
    zoom.min = '1';
    zoom.max = '3';
    zoom.step = '0.01';
    zoom.value = String(state.panels[i].zoom);
    zoom.dataset.panel = String(i);
    zoom.addEventListener('input', () => {
      const crop = state.panels[i];
      crop.zoom = Number(zoom.value);
      const geo = coverGeometry(preview.width, preview.height, state.layout);
      const image = sources.get(crop.source)?.image;
      if (image && geo.panels[i]) clampCrop(crop, geo.panels[i], image);
      queueRender();
    });
    const zoomLabel = el('span', 'zoom-label', 'zoom');
    body.append(select, el('div', 'zoom-line', undefined));
    body.lastChild.append(zoomLabel, zoom);
    row.append(thumb, body);
    row.addEventListener('click', (e) => {
      if (e.target === select || e.target === zoom) return;
      selectPanel(i);
    });
    wrap.append(row);
  }
}

function renderPanelThumbs() {
  const rows = document.querySelectorAll('.panel-row');
  const geo = coverGeometry(preview.width, preview.height, state.layout);
  rows.forEach((row, i) => {
    const thumb = row.querySelector('.panel-thumb');
    const ctx = thumb.getContext('2d');
    ctx.clearRect(0, 0, 52, 52);
    const image = sources.get(state.panels[i].source)?.image;
    if (image && geo.panels[i]) {
      const panel = geo.panels[i];
      const fit = { x: 0, y: 0, w: 52, h: 52 };
      if (panel.poly) fit.poly = panel.poly.map((p) => ({
        x: ((p.x - panel.x) / panel.w) * 52,
        y: ((p.y - panel.y) / panel.h) * 52,
      }));
      drawPanelPhoto(ctx, fit, image, state.panels[i]);
    }
    row.classList.toggle('inactive', i >= layoutCount());
    row.classList.toggle('selected', i === state.selected);
  });
}

function selectPanel(i) {
  state.selected = i;
  syncPanelControls();
}

function syncPanelControls() {
  document.querySelectorAll('.panel-row').forEach((row, i) => {
    row.classList.toggle('selected', i === state.selected);
    row.classList.toggle('inactive', i >= layoutCount());
    const zoom = row.querySelector('.panel-zoom');
    zoom.value = String(state.panels[i].zoom);
    const select = row.querySelector('.panel-source');
    if (select.value !== state.panels[i].source) select.value = state.panels[i].source;
  });
}

function syncControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('active', b.dataset.style === state.captionStyle));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === state.size));
  document.getElementById('caption').value = state.caption;
  document.getElementById('tagline').value = state.tagline;
  syncPanelControls();
}

// ---------------------------------------------------------------------------
// Photos, actions, export
// ---------------------------------------------------------------------------

function loadFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  let slot = state.selected;
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const id = `upload:${uploadCount++}`;
      sources.set(id, { image, name: file.name, kind: 'upload' });
      addSourceOption(id, file.name);
      state.panels[slot % 4].source = id;
      state.panels[slot % 4].ox = 0;
      state.panels[slot % 4].oy = 0;
      slot++;
      syncPanelControls();
      queueRender();
      toast(`Loaded ${file.name} — it stays on this device`);
    };
    image.src = url;
  }
}

function addSourceOption(id, name) {
  document.querySelectorAll('.panel-source').forEach((select) => {
    const option = el('option', null, name);
    option.value = id;
    select.append(option);
  });
}

function bindActions() {
  document.getElementById('caption').addEventListener('input', (e) => {
    state.caption = e.target.value;
    queueRender();
  });
  document.getElementById('tagline').addEventListener('input', (e) => {
    state.tagline = e.target.value;
    queueRender();
  });
  document.getElementById('photo-input').addEventListener('change', (e) => {
    if (e.target.files?.length) loadFiles(e.target.files);
    e.target.value = '';
  });
  document.getElementById('apply-all').addEventListener('click', () => {
    const source = state.panels[state.selected].source;
    for (const crop of state.panels) {
      crop.source = source;
      crop.ox = 0;
      crop.oy = 0;
    }
    syncPanelControls();
    queueRender();
    toast('Photo applied to every panel');
  });
  document.getElementById('shuffle').addEventListener('click', () => {
    state.seed++;
    buildScenes();
    queueRender();
    toast(`Scenes reseeded (${state.seed})`);
  });
  document.getElementById('reset-crops').addEventListener('click', () => {
    for (const crop of state.panels) {
      crop.zoom = 1;
      crop.ox = 0;
      crop.oy = 0;
    }
    syncPanelControls();
    queueRender();
  });
  document.getElementById('export').addEventListener('click', exportPNG);
}

function exportPNG() {
  const size = currentSize();
  const canvas = renderCoverCanvas(size.w, size.h, state, panelImages());
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(`Saved vice-cover-${size.w}x${size.h}.png`);
  }, 'image/png');
}

let toastTimer = 0;
function toast(message) {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
}

// ---------------------------------------------------------------------------
// Boot + a small API the capture tooling and tests drive the studio through.
// ---------------------------------------------------------------------------

async function boot() {
  await Promise.all([
    document.fonts.load('16px Bungee'),
    document.fonts.load('16px Anton'),
  ]);
  buildScenes();
  buildLayoutButtons();
  buildGradeButtons();
  buildStyleButtons();
  buildSizeButtons();
  buildPanelRows();
  bindPreview();
  bindActions();
  syncControls();
  renderPreview();
  document.body.dataset.ready = 'true';
}

window.__vice = {
  state,
  scenes: SCENES,
  sizes: SIZES,
  setState(patch) {
    Object.assign(state, patch);
    syncControls();
    renderPreview();
  },
  setPanel(i, patch) {
    Object.assign(state.panels[i], patch);
    syncPanelControls();
    renderPreview();
  },
  selectPanel,
  exportDataURL(sizeId) {
    return exportCoverDataURL(sizeId ?? state.size, state, panelImages());
  },
  /** The app's own drawing of the current cover, fitted inside maxLong. */
  proofCanvas(maxLong) {
    const size = currentSize();
    const scale = Math.min(1, maxLong / Math.max(size.w, size.h));
    return renderCoverCanvas(Math.round(size.w * scale), Math.round(size.h * scale), state, panelImages());
  },
  /** Load an image from a data URL as if the user picked it (used by tests). */
  uploadFromDataURL(name, dataURL) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const id = `upload:${uploadCount++}`;
        sources.set(id, { image, name, kind: 'upload' });
        addSourceOption(id, name);
        state.panels[state.selected].source = id;
        syncPanelControls();
        renderPreview();
        resolve(id);
      };
      image.src = dataURL;
    });
  },
};

boot();