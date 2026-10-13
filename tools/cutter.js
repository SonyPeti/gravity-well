'use strict';
// Cuts sprites out of AI-generated art: removes fake checkerboard / white backgrounds,
// crops tightly, rotates to "pointing up", and saves PNGs into /assets via sprite-server.js.

const OUT_SIZE = 256;

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function toCanvas(img, sx = 0, sy = 0, sw = img.width, sh = img.height) {
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return c;
}

// Remove a light, painted-on checkerboard. Light pixels connected to the cell border are
// background (or glow over background): they get "color-to-alpha" against white, which turns
// pale glows into properly coloured semi-transparent glows. Enclosed highlights stay opaque.
function removeLightBackground(canvas, { flood = 0.45, floor = 0.1 } = {}) {
  const w = canvas.width, h = canvas.height;
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const rawA = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const m = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    rawA[i] = (255 - m) / 255;
  }
  // Flood fill from the border through light pixels
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || rawA[i] >= flood) continue;
    bg[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) {
    if (!bg[i]) continue;
    const a = rawA[i];
    const out = Math.max(0, (a - floor) / (1 - floor));
    if (out <= 0.01) { d[i * 4 + 3] = 0; continue; }
    for (let k = 0; k < 3; k++) {
      d[i * 4 + k] = Math.max(0, Math.min(255, 255 - (255 - d[i * 4 + k]) / a));
    }
    d[i * 4 + 3] = Math.round(out * 255);
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

// Remove a black background. Dark pixels connected to the border are background (or glow over
// black): they get "color-to-alpha" against black, so glows stay glowing on any background.
// Dark details enclosed inside the object (hull panels, craters) stay opaque.
function removeDarkBackground(canvas, { flood = 0.42, floor = 0.04 } = {}) {
  const w = canvas.width, h = canvas.height;
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const rawA = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) rawA[i] = Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) / 255;
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || rawA[i] >= flood) continue;
    bg[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  for (let i = 0; i < w * h; i++) {
    if (!bg[i]) continue;
    const a = rawA[i];
    const out = Math.max(0, (a - floor) / (1 - floor));
    if (out <= 0.01) { d[i * 4 + 3] = 0; continue; }
    for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.min(255, d[i * 4 + k] / a);
    d[i * 4 + 3] = Math.round(out * 255);
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

// Drop separate blobs that touch the cell edge (pieces of neighbouring icons poking in).
// The main icon and its own floating particles are kept.
function dropEdgeIntruders(canvas, alphaMin = 30) {
  const w = canvas.width, h = canvas.height;
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] >= 0 || d[s * 4 + 3] < alphaMin) continue;
    const id = comps.length;
    const comp = { size: 0, edge: false, pixels: [] };
    const stack = [s];
    label[s] = id;
    while (stack.length) {
      const i = stack.pop();
      comp.size++;
      comp.pixels.push(i);
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) comp.edge = true;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (n >= 0 && label[n] < 0 && d[n * 4 + 3] >= alphaMin) { label[n] = id; stack.push(n); }
      }
    }
    comps.push(comp);
  }
  if (!comps.length) return canvas;
  const biggest = comps.reduce((a, b) => (b.size > a.size ? b : a));
  for (const c of comps) {
    if (c === biggest || !c.edge) continue;
    for (const i of c.pixels) d[i * 4 + 3] = 0;
  }
  // Neighbour pieces at the top/bottom edge: if an empty horizontal band separates them from the
  // main icon, clear everything beyond that band
  const rowHas = y => { for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 60) return true; return false; };
  const clearRows = (from, to) => { for (let y = from; y < to; y++) for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = 0; };
  const band = Math.max(3, Math.round(h * 0.02));
  const edgeZone = Math.round(h * 0.2);
  for (const fromBottom of [true, false]) {
    let empty = 0, sawContent = false;
    for (let k = 0; k < edgeZone; k++) {
      const y = fromBottom ? h - 1 - k : k;
      if (rowHas(y)) { if (empty >= band && sawContent) { /* reached main icon after a gap */ break; } sawContent = true; empty = 0; }
      else if (sawContent) {
        empty++;
        if (empty >= band) {
          // look ahead: is there main-icon content further in? if so, cut here
          if (fromBottom) clearRows(y, h); else clearRows(0, y + 1);
          break;
        }
      }
    }
  }
  // Also clear faint glow pixels along the border so no edge seams remain
  for (let x = 0; x < w; x++) for (const y of [0, 1, h - 2, h - 1]) d[(y * w + x) * 4 + 3] = 0;
  g.putImageData(img, 0, 0);
  return canvas;
}

// AI grids are rarely even: find the emptiest line near each expected boundary
function findCuts(img, count, vertical) {
  const c = toCanvas(img);
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const len = vertical ? c.width : c.height, other = vertical ? c.height : c.width;
  const profile = new Array(len).fill(0);
  for (let a = 0; a < len; a++) for (let b = 0; b < other; b++) {
    const i = (vertical ? b * c.width + a : a * c.width + b) * 4;
    if (Math.max(d[i], d[i + 1], d[i + 2]) > 40) profile[a]++;
  }
  const cuts = [0];
  const step = len / count;
  for (let k = 1; k < count; k++) {
    const exp = Math.round(k * step), win = Math.round(step * 0.25);
    let best = exp;
    for (let a = exp - win; a <= exp + win; a++) if (profile[a] < profile[best]) best = a;
    cuts.push(best);
  }
  cuts.push(len);
  return cuts;
}

// Cut a grid sheet into named icons
function cutGrid(img, cols, rows, names, size, opts = {}) {
  const xs = findCuts(img, cols, true), ys = findCuts(img, rows, false);
  const out = {};
  names.forEach((name, i) => {
    if (!name) return;
    const col = i % cols, row = Math.floor(i / cols);
    const cx = xs[col], cy = ys[row], cw = xs[col + 1] - cx, ch = ys[row + 1] - cy;
    const inset = opts.inset || 0;
    const c = removeDarkBackground(toCanvas(img, cx + inset, cy + inset, cw - inset * 2, ch - inset * 2), opts);
    const cut = finalize(dropEdgeIntruders(c), 0, 0.04, size);
    if (cut) out[name] = cut; // empty cell: skip it instead of failing
  });
  return out;
}

// Fade out a dark semi-transparent drop shadow around an already transparent sprite
function removeDarkHalo(canvas) {
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] >= 245) continue;
    const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    if (lum < 120) d[i + 3] = Math.round(d[i + 3] * Math.pow(lum / 120, 2));
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

// Crop to visible pixels, center in a square, rotate, scale to OUT_SIZE
function finalize(canvas, rotateDeg = 0, pad = 0.04, size = OUT_SIZE) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  // Square big enough to hold the crop at any rotation we use
  const diag = rotateDeg % 90 ? Math.hypot(cw, ch) : Math.max(cw, ch);
  const side = Math.ceil(diag * (1 + pad * 2));
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  const s = size / side;
  g.translate(size / 2, size / 2);
  g.rotate(rotateDeg * Math.PI / 180);
  g.scale(s, s);
  g.drawImage(canvas, x0, y0, cw, ch, -cw / 2, -ch / 2, cw, ch);
  return out;
}

async function savePng(name, canvas) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const res = await fetch('/save/' + name + '.png', { method: 'POST', body: blob });
  if (!res.ok) throw new Error('save failed ' + name);
}
async function saveJpg(name, canvas, quality = 0.88) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
  const res = await fetch('/save/' + name + '.jpg', { method: 'POST', body: blob });
  if (!res.ok) throw new Error('save failed ' + name);
}

// Second art batch: background, drone, icon sheets (all on black backgrounds)
const MUTATION_IDS = ['heavyCore', 'rapidCore', 'denseRock', 'thickAtmo', 'magnet', 'wideOrbit', 'shrapnel', 'retrograde',
  'frostbite', 'kindling', 'siphon', 'overflow', 'binaryStar', 'hungry', 'tidalLock', 'glassCannon', 'chainPulse',
  'blackHole', 'outerHalo', 'goldenTouch'];
const UPGRADE_IDS = ['coreDamage', 'fireRate', 'range', 'critChance', 'critMult', 'orbitDamage', 'slots', 'capture',
  'durability', 'spin', 'maxHp', 'regen', 'energyKill', 'waveBonus'];

async function runBatch2({ save = false } = {}) {
  document.getElementById('out').innerHTML = '';
  const results = {};
  const mut = await loadImage('/art/source/mutation-icons.webp');
  Object.assign(results, cutGrid(mut, 5, 4, MUTATION_IDS.map(id => 'mut_' + id), 192, { inset: 2 }));
  const upg = await loadImage('/art/source/upgrade-icons.webp');
  Object.assign(results, cutGrid(upg, 5, 3, UPGRADE_IDS.map(id => 'upg_' + id), 128, { inset: 4 }));
  const cur = await loadImage('/art/source/currency-icons.webp');
  Object.assign(results, cutGrid(cur, 2, 1, ['icon_energy', 'icon_stardust'], 128, { inset: 8 }));
  const drone = await loadImage('/art/source/drone-up.webp');
  results.orb_drone = finalize(removeDarkBackground(toCanvas(drone)), 0, 0.04, 256);
  for (const [name, c] of Object.entries(results)) preview(name, c);
  const bg = toCanvas(await loadImage('/art/source/background-portrait.webp'));
  preview('background', bg);
  if (save) {
    for (const [name, c] of Object.entries(results)) await savePng(name, c);
    await saveJpg('background', bg);
  }
  return Object.keys(results).length + ' sprites + background';
}
window.runBatch2 = runBatch2;

// Third art batch (CHATGPT_PROMPT_2.md): galaxy enemies, Nebula Queen, elite trait icons.
// Save the source images into art/source/ with these names (any of .webp/.png/.jpg), then
// open cutter.html#batch3 and run runBatch3({ save: true }), then `node tools/build-sw.js`.
const BATCH3 = [
  // [source base name, output sprite name, output size]
  ['enemy-sentinel', 'enemy_sentinel', 256],
  ['enemy-blinker', 'enemy_blinker', 256],
  ['enemy-hive', 'enemy_hive', 256],
  ['enemy-swarmer', 'enemy_swarmer', 192],
  ['boss-queen', 'boss_queen', 384],
];
async function loadSource(base) {
  for (const ext of ['webp', 'png', 'jpg', 'jpeg']) {
    try { return await loadImage(`/art/source/${base}.${ext}`); } catch (e) { /* try next */ }
  }
  return null;
}
async function runBatch3({ save = false } = {}) {
  document.getElementById('out').innerHTML = '';
  const results = {}, missing = [];
  for (const [src, name, size] of BATCH3) {
    const img = await loadSource(src);
    if (!img) { missing.push(src); continue; }
    const cut = finalize(removeDarkBackground(toCanvas(img)), 0, 0.04, size);
    if (cut) results[name] = cut; else missing.push(src + " (empty)");
  }
  const icons = await loadSource('elite-icons');
  if (icons) Object.assign(results, cutGrid(icons, 5, 1,
    ['elite_swift', 'elite_armored', 'elite_regen', 'elite_explosive', 'elite_splitting'], 96, { inset: 4 }));
  else missing.push('elite-icons');
  for (const [name, c] of Object.entries(results)) preview(name, c);
  if (save) for (const [name, c] of Object.entries(results)) await savePng(name, c);
  return `${Object.keys(results).length} sprites` + (missing.length ? ` · missing: ${missing.join(', ')}` : '');
}
window.runBatch3 = runBatch3;

function preview(name, canvas) {
  const f = document.createElement('figure');
  f.appendChild(canvas);
  const cap = document.createElement('figcaption');
  cap.textContent = name;
  f.appendChild(cap);
  document.getElementById('out').appendChild(f);
}

// Cells on the sprite sheet: [name, x, y, w, h, rotateDeg]
const SHEET_CELLS = [
  // Row 1 — planet skins
  ['skin_terra',   15, 30, 200, 215], ['skin_ember', 215, 30, 200, 215], ['skin_glacier', 415, 30, 200, 215],
  ['skin_gasgiant', 612, 30, 200, 215], ['skin_crystal', 805, 30, 200, 215], ['skin_void', 1000, 30, 200, 215],
  // Row 2 — orbitals
  ['orb_rock', 15, 290, 200, 215], ['orb_ice', 215, 290, 200, 215], ['orb_lava', 415, 290, 200, 215],
  ['orb_drone', 612, 290, 200, 215], ['orb_void', 805, 290, 200, 215], ['orb_gold', 1000, 290, 200, 215],
  // Row 3 — enemies
  ['enemy_drifter', 25, 545, 225, 255], ['enemy_comet', 265, 545, 230, 255, 135], ['enemy_scout', 495, 545, 240, 255, 180],
  ['enemy_molten', 745, 545, 200, 255], ['enemy_wraith', 955, 535, 245, 265],
  // Row 4 — bosses
  ['boss_worm', 25, 830, 370, 440], ['boss_mothership', 425, 840, 395, 350],
];

async function run({ save = false } = {}) {
  document.getElementById('out').innerHTML = '';
  const sheet = await loadImage('/art/source/sprite-sheet.webp');
  const results = {};
  for (const [name, x, y, w, h, rot = 0] of SHEET_CELLS) {
    const c = removeLightBackground(toCanvas(sheet, x, y, w, h));
    const out = finalize(c, rot);
    if (!out) continue;
    results[name] = out;
    preview(name, out);
  }
  // Planet (already transparent)
  const planet = await loadImage('/art/source/planet-terra.webp');
  const p = finalize(removeDarkHalo(toCanvas(planet)), 0, 0.01);
  results.planet = p;
  preview('planet', p);
  // Background: crop the nebula square, inset a little to avoid edges
  const bgc = toCanvas(sheet, 845, 826, 336, 436);
  results.background = bgc;
  preview('background', bgc);
  if (save) for (const [name, c] of Object.entries(results)) await savePng(name, c);
  return Object.keys(results);
}

window.run = run;
if (location.hash === '#batch3') runBatch3(); else if (location.hash === '#batch2') runBatch2(); else run();
