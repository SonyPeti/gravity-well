'use strict';

// ============================================================
//  GRAVITY WELL
//  Everything you destroy becomes part of your defense.
// ============================================================

// ---------- Utilities ----------
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 10 && n % 1 !== 0) return n.toFixed(1);
  if (n < 1000) return Math.floor(n).toString();
  let i = 0;
  while (n >= 1000 && i < SUFFIXES.length - 1) { n /= 1000; i++; }
  return (n < 100 ? n.toFixed(2) : n.toFixed(1)).replace(/\.?0+$/, '') + SUFFIXES[i];
}
const pct = v => Math.round(v * 100) + '%';

// Inline icon HTML (emoji stay as alt text / canvas fallback)
const ICON_E = '<img class="cur" src="assets/icon_energy.png" alt="⚡">';
const ICON_S = '<img class="cur" src="assets/icon_stardust.png" alt="✦">';
const mutIcon = (m, cls = 'mut-ico') => `<img class="${cls}" src="assets/mut_${m.id}.png" alt="${m.icon}">`;

// ============================================================
//  Sprites — drop PNGs into /assets with these names and they
//  replace the procedural drawings automatically.
// ============================================================
const SPRITE_NAMES = [
  'background', 'planet',
  'orb_rock', 'orb_ice', 'orb_lava', 'orb_drone', 'orb_void', 'orb_gold',
  'enemy_drifter', 'enemy_comet', 'enemy_scout', 'enemy_molten', 'enemy_wraith',
  'boss_worm', 'boss_mothership',
  'skin_ember', 'skin_glacier', 'skin_gasgiant', 'skin_crystal', 'skin_void',
];
const SPRITES = {};
for (const name of SPRITE_NAMES) {
  const img = new Image();
  img.onload = () => { SPRITES[name] = img; if (name === 'background') buildBackground(); };
  img.src = `assets/${name}.${name === 'background' ? 'jpg' : 'png'}`;
}
const sprite = name => SPRITES[name] || null;

// ============================================================
//  Save data
// ============================================================
const SAVE_KEY = 'gravitywell.v1';
function defaultSave() { return { stardust: 0, bestWave: 0, meta: {}, tips: {}, skins: ['terra'], skin: 'terra' }; }
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s) return Object.assign(defaultSave(), s);
  } catch (e) { /* storage unavailable */ }
  return defaultSave();
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}
const save = loadSave();

// ============================================================
//  In-run upgrades (paid with Energy)
// ============================================================
const UPGRADES = [
  // Core — the planet's own gun
  { id: 'coreDamage', tab: 'core', name: 'Core Damage',
    value: l => 6 * Math.pow(1.15, l), show: fmt, cost: l => 6 * Math.pow(1.3, l) },
  { id: 'fireRate', tab: 'core', name: 'Fire Rate', max: 50,
    value: l => 1.2 + 0.1 * l, show: v => v.toFixed(2) + '/s', cost: l => 8 * Math.pow(1.35, l) },
  { id: 'range', tab: 'core', name: 'Range', max: 20,
    value: l => 120 + 6 * l, show: v => Math.round(v) + 'm', cost: l => 15 * Math.pow(1.5, l) },
  { id: 'critChance', tab: 'core', name: 'Crit Chance', max: 26,
    value: l => 0.02 + 0.03 * l, show: pct, cost: l => 20 * Math.pow(1.5, l) },
  { id: 'critMult', tab: 'core', name: 'Crit Damage',
    value: l => 1.5 + 0.2 * l, show: v => 'x' + v.toFixed(1), cost: l => 25 * Math.pow(1.5, l) },

  // Orbit — the captured army
  { id: 'orbitDamage', tab: 'orbit', name: 'Orbit Damage',
    value: l => 3 * Math.pow(1.15, l), show: fmt, cost: l => 8 * Math.pow(1.3, l) },
  { id: 'slots', tab: 'orbit', name: 'Orbit Slots', max: 27,
    value: l => 3 + l, show: v => v + ' moons', cost: l => 10 * Math.pow(1.42, l) },
  { id: 'capture', tab: 'orbit', name: 'Capture Chance', max: 15,
    value: l => 0.25 + 0.04 * l, show: pct, cost: l => 12 * Math.pow(1.45, l) },
  { id: 'durability', tab: 'orbit', name: 'Durability',
    value: l => 6 * (1 + 0.2 * l), show: v => Math.round(v) + ' hits', cost: l => 10 * Math.pow(1.4, l) },
  { id: 'spin', tab: 'orbit', name: 'Spin Speed', max: 20,
    value: l => 1 + 0.1 * l, show: v => 'x' + v.toFixed(1), cost: l => 15 * Math.pow(1.4, l) },

  // Planet — survival & economy
  { id: 'maxHp', tab: 'planet', name: 'Max Health',
    value: l => 50 * Math.pow(1.18, l), show: fmt, cost: l => 6 * Math.pow(1.3, l) },
  { id: 'regen', tab: 'planet', name: 'Regen',
    value: l => (l === 0 ? 0 : 0.6 * l * Math.pow(1.1, l)), show: v => fmt(v) + '/s', cost: l => 12 * Math.pow(1.45, l) },
  { id: 'energyKill', tab: 'planet', name: 'Energy / Kill',
    value: l => 1 + 0.15 * l, show: v => 'x' + v.toFixed(2), cost: l => 15 * Math.pow(1.45, l) },
  { id: 'waveBonus', tab: 'planet', name: 'Wave Bonus',
    value: l => (l === 0 ? 0 : 8 * l * Math.pow(1.15, l)), show: v => ICON_E + fmt(v), cost: l => 20 * Math.pow(1.5, l) },
];
const UP = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

// ============================================================
//  Observatory (permanent upgrades, paid with Stardust)
// ============================================================
const META = [
  { id: 'sCore', icon: '☀️', img: 'upg_coreDamage', name: 'Stellar Core',
    value: l => 1 + 0.1 * l, desc: v => `+${Math.round((v - 1) * 100)}% core damage`, cost: l => 5 * Math.pow(1.3, l) },
  { id: 'sOrbit', icon: '🌑', img: 'upg_orbitDamage', name: 'Heavy Moons',
    value: l => 1 + 0.1 * l, desc: v => `+${Math.round((v - 1) * 100)}% orbit damage`, cost: l => 5 * Math.pow(1.3, l) },
  { id: 'sHull', icon: '🌍', img: 'upg_maxHp', name: 'Thick Crust',
    value: l => 1 + 0.1 * l, desc: v => `+${Math.round((v - 1) * 100)}% max health & regen`, cost: l => 5 * Math.pow(1.3, l) },
  { id: 'sMoons', icon: '🪨', img: 'orb_rock', name: 'Ancient Moons', max: 6,
    value: l => l, desc: v => `Start each run with ${v} rock moon${v === 1 ? '' : 's'}`, cost: l => 15 * Math.pow(1.6, l) },
  { id: 'sCapture', icon: '🧲', img: 'upg_capture', name: 'Gravity Lens', max: 10,
    value: l => 0.02 * l, desc: v => `+${Math.round(v * 100)}% capture chance`, cost: l => 10 * Math.pow(1.4, l) },
  { id: 'sEnergy', icon: '⚡', img: 'icon_energy', name: 'Solar Collectors',
    value: l => 1 + 0.1 * l, desc: v => `+${Math.round((v - 1) * 100)}% energy`, cost: l => 6 * Math.pow(1.3, l) },
  { id: 'sStart', icon: '🔋', img: 'upg_waveBonus', name: 'Charged Start',
    value: l => 25 * l, desc: v => `Start runs with ${ICON_E}${fmt(v)}`, cost: l => 8 * Math.pow(1.35, l) },
  { id: 'sStardust', icon: '✦', img: 'icon_stardust', name: 'Stargazer',
    value: l => 1 + 0.1 * l, desc: v => `+${Math.round((v - 1) * 100)}% stardust`, cost: l => 10 * Math.pow(1.4, l) },
  { id: 'sRelay', icon: '📡', name: 'Relay Station', max: 4,
    value: l => l, desc: v => `Offline: ${8 + 2 * v}h storage, +${25 * v}% rate`, cost: l => 30 * Math.pow(1.8, l) },
  { id: 'sReroll', icon: '🎲', name: 'Fate Dice', max: 3,
    value: l => 1 + l, desc: v => `${v} mutation reroll${v === 1 ? '' : 's'} per run`, cost: l => 40 * Math.pow(2.2, l) },
];
const MT = Object.fromEntries(META.map(m => [m.id, m]));
const metaLv = id => save.meta[id] || 0;
const metaVal = id => MT[id].value(metaLv(id));

// ============================================================
//  Mutations (drafted every few waves)
// ============================================================
const RARITY = {
  common:    { weight: 60, label: 'Common' },
  rare:      { weight: 28, label: 'Rare' },
  epic:      { weight: 10, label: 'Epic' },
  legendary: { weight: 3,  label: 'Legendary' },
};
const MUTATIONS = [
  { id: 'heavyCore',  rarity: 'common', icon: '💥', name: 'Heavy Core',        desc: '+40% core damage', stack: true },
  { id: 'rapidCore',  rarity: 'common', icon: '⚡', name: 'Rapid Core',        desc: '+30% fire rate', stack: true },
  { id: 'denseRock',  rarity: 'common', icon: '🪨', name: 'Dense Rock',        desc: 'Orbitals last 50% longer', stack: true },
  { id: 'thickAtmo',  rarity: 'common', icon: '☁️', name: 'Thick Atmosphere',  desc: '+30% max health and a full heal', stack: true },
  { id: 'magnet',     rarity: 'common', icon: '🧲', name: 'Magnetic Field',    desc: '+15% capture chance', stack: true },
  { id: 'wideOrbit',  rarity: 'common', icon: '⭕', name: 'Wide Orbit',        desc: 'Rings 20% wider, +15% orbit damage' },
  { id: 'shrapnel',   rarity: 'rare',   icon: '✴️', name: 'Shrapnel',          desc: 'Shattering orbitals explode' },
  { id: 'retrograde', rarity: 'rare',   icon: '🔄', name: 'Retrograde',        desc: 'Middle ring spins backwards, all rings 30% faster' },
  { id: 'frostbite',  rarity: 'rare',   icon: '❄️', name: 'Frostbite',         desc: 'All orbitals slow enemies' },
  { id: 'kindling',   rarity: 'rare',   icon: '🔥', name: 'Kindling',          desc: 'All orbitals set enemies on fire' },
  { id: 'siphon',     rarity: 'rare',   icon: '🩸', name: 'Siphon',            desc: 'Heal 0.5% max health per kill', stack: true },
  { id: 'overflow',   rarity: 'rare',   icon: '🌊', name: 'Overflow',          desc: 'While orbit is full, kills give 2x energy' },
  { id: 'binaryStar', rarity: 'epic',   icon: '✨', name: 'Binary Star',       desc: 'A mini-star orbits you and fires too' },
  { id: 'hungry',     rarity: 'epic',   icon: '🕳️', name: 'Hungry Gravity',    desc: 'Enemies are pulled in faster, orbitals deal +50% damage' },
  { id: 'tidalLock',  rarity: 'epic',   icon: '🔒', name: 'Tidal Lock',        desc: 'Orbitals stop spinning but hit 3x harder' },
  { id: 'glassCannon',rarity: 'epic',   icon: '🔮', name: 'Glass Cannon',      desc: 'Double all damage, half max health' },
  { id: 'chainPulse', rarity: 'epic',   icon: '🌀', name: 'Chain Pulse',       desc: 'Gravity Pulse recharges twice as fast' },
  { id: 'blackHole',  rarity: 'legendary', icon: '⚫', name: 'Black Hole Heart', desc: 'Every 75 kills, a black hole devours nearby enemies' },
  { id: 'outerHalo',  rarity: 'legendary', icon: '🪐', name: 'Outer Halo',       desc: 'A 4th orbit ring and +6 orbit slots' },
  { id: 'goldenTouch',rarity: 'legendary', icon: '👑', name: 'Golden Touch',     desc: 'Golden moons are 10x more common' },
];
const MUT = Object.fromEntries(MUTATIONS.map(m => [m.id, m]));
const DRAFT_EVERY = 3; // waves

// ============================================================
//  Planet skins — each one is a sidegrade with its own look
// ============================================================
const SKINS = [
  { id: 'terra',    name: 'Terra Seed',    img: 'planet',        size: 2.35, glow: '#3FF2E0',
    perk: 'Balanced. A good place to start.', drawback: '', cost: 0, wave: 0 },
  { id: 'ember',    name: 'Ember',         img: 'skin_ember',    size: 2.7, glow: '#FF8A2A',
    perk: 'Core shots set enemies on fire', drawback: '−10% max health', cost: 60, wave: 0 },
  { id: 'glacier',  name: 'Glacier',       img: 'skin_glacier',  size: 2.7, glow: '#8FD8FF',
    perk: 'Core shots chill and slow enemies', drawback: '−10% core damage', cost: 120, wave: 0 },
  { id: 'gasgiant', name: 'Gas Giant Jr.', img: 'skin_gasgiant', size: 2.7, glow: '#D86CFF',
    perk: '+3 orbit slots, rings 10% wider', drawback: '−15% core damage', cost: 200, wave: 15 },
  { id: 'crystal',  name: 'Crystal Core',  img: 'skin_crystal',  size: 2.7, glow: '#5FE6FF',
    perk: '+10% crit chance, +50% crit damage', drawback: '−10% max health', cost: 350, wave: 20 },
  { id: 'void',     name: 'Void Heart',    img: 'skin_void',     size: 2.7, glow: '#9B5CFF',
    perk: '25% of captures become Void Shards', drawback: '−10% energy', cost: 600, wave: 30 },
];
const SKIN = Object.fromEntries(SKINS.map(s => [s.id, s]));
const skin = () => SKIN[save.skin] || SKIN.terra;
const isSkin = id => save.skin === id;

// ============================================================
//  Final stats = upgrade × permanent bonus × mutations × skin
// ============================================================
const lvl = id => run.lv[id] || 0;
const base = id => UP[id].value(lvl(id));
const mc = id => run.mut[id] || 0;

function stat(id) {
  switch (id) {
    case 'coreDamage':  return base(id) * metaVal('sCore') * Math.pow(1.4, mc('heavyCore')) * (mc('glassCannon') ? 2 : 1)
                               * (isSkin('glacier') ? 0.9 : isSkin('gasgiant') ? 0.85 : 1);
    case 'critChance':  return base(id) + (isSkin('crystal') ? 0.1 : 0);
    case 'critMult':    return base(id) + (isSkin('crystal') ? 0.5 : 0);
    case 'fireRate':    return base(id) * Math.pow(1.3, mc('rapidCore'));
    case 'orbitDamage': return base(id) * metaVal('sOrbit') * (mc('wideOrbit') ? 1.15 : 1) * (mc('hungry') ? 1.5 : 1)
                               * (mc('tidalLock') ? 3 : 1) * (mc('glassCannon') ? 2 : 1);
    case 'slots':       return base(id) + (mc('outerHalo') ? 6 : 0) + (isSkin('gasgiant') ? 3 : 0);
    case 'capture':     return Math.min(0.95, base(id) + metaVal('sCapture') + 0.15 * mc('magnet'));
    case 'durability':  return base(id) * Math.pow(1.5, mc('denseRock'));
    case 'spin':        return mc('tidalLock') ? 0 : base(id) * (mc('retrograde') ? 1.3 : 1);
    case 'maxHp':       return base(id) * metaVal('sHull') * Math.pow(1.3, mc('thickAtmo')) * (mc('glassCannon') ? 0.5 : 1)
                               * (isSkin('ember') || isSkin('crystal') ? 0.9 : 1);
    case 'regen':       return base(id) * metaVal('sHull');
    case 'energyKill':  return base(id) * metaVal('sEnergy') * (isSkin('void') ? 0.9 : 1);
    default:            return base(id);
  }
}

// ============================================================
//  World constants
// ============================================================
const PLANET_R = 20;
const RING_BASE = [38, 56, 74, 92];
const RING_CAP = [6, 10, 14, 18];
const RING_SPEED = [1.3, 1.0, 0.8, 0.65];
const ringCount = () => (mc('outerHalo') ? 4 : 3);
const ringRadius = i => RING_BASE[i] * (mc('wideOrbit') ? 1.2 : 1) * (isSkin('gasgiant') ? 1.1 : 1);
const PULSE_CD = 20;

const ORBITALS = {
  rock:  { dmg: 1,   r: 4.5, trail: '#3FF2E0' },
  ice:   { dmg: 0.7, r: 4.5, trail: '#8FD8FF', slow: true },
  lava:  { dmg: 0.6, r: 5,   trail: '#FF8A2A', burn: true },
  drone: { dmg: 0.5, r: 4.5, trail: '#3FF2E0', shoots: true },
  void:  { dmg: 1.3, r: 4.5, trail: '#9B5CFF', pierce: true },
  gold:  { dmg: 1,   r: 5,   trail: '#FFD34A', gold: true },
};

const ENEMY_TYPES = {
  drifter: { hp: 1,   speed: 26, r: 9,  dmg: 1,   energy: 1,   capture: 'rock' },
  comet:   { hp: 0.5, speed: 55, r: 6,  dmg: 0.6, energy: 1,   capture: 'ice' },
  scout:   { hp: 0.8, speed: 40, r: 8,  dmg: 0.5, energy: 1.5, capture: 'drone', ranged: true },
  molten:  { hp: 3.5, speed: 15, r: 14, dmg: 2,   energy: 3,   capture: 'lava', splits: true },
  wraith:  { hp: 2.5, speed: 30, r: 10, dmg: 2,   energy: 4,   capture: 'void', ghost: true },
  worm:    { hp: 16,  speed: 13, r: 20, dmg: 4,   energy: 25,  capture: 'void', boss: true },
  mother:  { hp: 18,  speed: 12, r: 26, dmg: 4,   energy: 25,  capture: 'drone', boss: true, ranged: true },
};

// Bestiary text
const ENEMY_INFO = {
  drifter: { name: 'Drifter',     sprite: 'enemy_drifter',   desc: 'A slow, stubborn chunk of rock. The bulk of every swarm.' },
  comet:   { name: 'Comet',       sprite: 'enemy_comet',     desc: 'Fast and fragile. Hits before you notice it.' },
  scout:   { name: 'Alien Scout', sprite: 'enemy_scout',     desc: 'Keeps its distance and shoots. Your moons can block its shots.' },
  molten:  { name: 'Molten Rock', sprite: 'enemy_molten',    desc: 'Tanky lava boulder that splits into two drifters when destroyed.' },
  wraith:  { name: 'Void Wraith', sprite: 'enemy_wraith',    desc: 'Elite. Half-phases through moons: takes only 50% orbit damage.' },
  worm:    { name: 'World Eater', sprite: 'boss_worm',       desc: 'Boss. A colossal rock serpent that crawls straight for your planet.' },
  mother:  { name: 'Mothership',  sprite: 'boss_mothership', desc: 'Boss. Hangs back and keeps launching scouts at you.' },
};
const MOON_NAMES = { rock: 'Rock moon', ice: 'Ice moon', lava: 'Lava moon', drone: 'Captured drone', void: 'Void shard' };

// Pacing knobs, all in one place
const PACE = {
  waveLen: 17,       // max seconds per wave
  spawnWindow: 11,   // enemies arrive during the first N seconds
  clearDelay: 0.8,   // breather after the last enemy dies, then the next wave starts
  countBase: 9, countPer: 2.6,   // a swarm of weaker enemies feels better than a trickle
  speed: 1.5,        // enemy speed multiplier
  spawnMargin: 6,    // how far off-screen enemies appear
};
const waveCount = w => Math.min(100, Math.round(PACE.countBase + PACE.countPer * w));
// Difficulty knobs, all in one place
const BALANCE = {
  hpBase: 6.2, hpGrowth: 1.20, hpCurve: 1.0012,   // enemy health per wave (curve gets steeper late)
  dmgBase: 3, dmgGrowth: 1.12, dmgCurve: 1.001,
};
const enemyHp = w => BALANCE.hpBase * Math.pow(BALANCE.hpGrowth, w - 1) * Math.pow(BALANCE.hpCurve, (w - 1) * (w - 1));
const enemyDmg = w => BALANCE.dmgBase * Math.pow(BALANCE.dmgGrowth, w - 1) * Math.pow(BALANCE.dmgCurve, (w - 1) * (w - 1));
const stardustForWave = w => Math.max(1, Math.floor((1 + w * 0.5) * metaVal('sStardust')));

// ============================================================
//  Canvas & background
// ============================================================
const canvas = $('game');
let ctx = canvas.getContext('2d'); // swapped temporarily to draw the menu planet
const stage = $('stage');
let W = 0, H = 0, DPR = 1, SCALE = 1;
const bgCanvas = document.createElement('canvas');
const twinkles = [];

function resize() {
  const r = stage.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = r.width; H = r.height;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  SCALE = Math.min(W, H) / 300;
  buildBackground();
}
window.addEventListener('resize', resize);

function buildBackground() {
  if (!W || !H) return;
  bgCanvas.width = canvas.width;
  bgCanvas.height = canvas.height;
  const g = bgCanvas.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const img = sprite('background');
  if (img) {
    const s = Math.max(W / img.width, H / img.height);
    g.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    // Darken so gameplay pops, and keep the center calm
    g.fillStyle = 'rgba(7,10,24,0.12)';
    g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(7,10,24,0.15)');
    vg.addColorStop(1, 'rgba(7,10,24,0)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  } else {
    g.fillStyle = '#070A18';
    g.fillRect(0, 0, W, H);
    // Nebula clouds
    const blobs = [
      [0.2, 0.25, 0.55, 'rgba(46,26,92,0.55)'], [0.85, 0.7, 0.6, 'rgba(27,21,64,0.7)'],
      [0.7, 0.15, 0.35, 'rgba(155,92,255,0.10)'], [0.1, 0.85, 0.4, 'rgba(63,242,224,0.05)'],
    ];
    for (const [bx, by, br, col] of blobs) {
      const rad = br * Math.max(W, H);
      const ng = g.createRadialGradient(bx * W, by * H, 0, bx * W, by * H, rad);
      ng.addColorStop(0, col);
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = ng;
      g.fillRect(0, 0, W, H);
    }
  }
  {
    // Crisp static stars on top (the background art is low-res)
    for (let i = 0; i < (img ? 40 : 160); i++) {
      g.globalAlpha = rand(0.15, 0.7);
      g.fillStyle = Math.random() < 0.15 ? '#A8FFF4' : '#ffffff';
      const s = Math.random() < 0.1 ? 1.6 : 0.9;
      g.fillRect(Math.random() * W, Math.random() * H, s, s);
    }
    g.globalAlpha = 1;
  }
  twinkles.length = 0;
  for (let i = 0; i < 28; i++) twinkles.push({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * TAU, s: rand(0.8, 2) });
}

// Soft glow sprites, cached per color (much cheaper than shadowBlur on phones)
const glowCache = {};
function glowSprite(color) {
  if (glowCache[color]) return glowCache[color];
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, color);
  gr.addColorStop(0.35, color + '66');
  gr.addColorStop(1, color + '00');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return (glowCache[color] = c);
}
function glow(x, y, radius, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

// Planet surface features (procedural)
const CONTINENTS = Array.from({ length: 6 }, () => ({ x: rand(0, 4), y: rand(-0.7, 0.7), rx: rand(0.25, 0.55), ry: rand(0.15, 0.35) }));
const CLOUDS = Array.from({ length: 7 }, () => ({ x: rand(0, 4), y: rand(-0.85, 0.85), rx: rand(0.3, 0.7), ry: rand(0.05, 0.11) }));

// ============================================================
//  Run state
// ============================================================
let run = null;
let paused = true;
let gameSpeed = 1;
let buyMode = '1';
let activeTab = 'core';
let nextId = 1;

function newRun() {
  run = {
    wave: 1, waveTime: 0, spawned: 0, spawnAcc: PACE.spawnWindow / waveCount(1), time: 0, // first enemy right away
    energy: 10 + metaVal('sStart'), stardust: 0, kills: 0,
    lv: {}, mut: {}, hp: 0,
    enemies: [], bullets: [], eBullets: [], orbitals: [], particles: [], texts: [], waves: [], holes: [], lasers: [],
    ringAngle: [0, 0, 0, 0],
    fireAcc: 0, starAcc: 0, aim: -Math.PI / 2,
    pulseCd: 3, pulseT: 0,
    rerolls: metaVal('sReroll'), holeKills: 0,
    shake: 0, hurt: 0, wobble: 0, over: false, drafting: false,
  };
  run.hp = stat('maxHp');
  run.flawless = 0;
  run.tookDamage = false;
  for (let i = 0; i < metaVal('sMoons'); i++) addOrbital('rock', 0, 0, false);
  Progress.track('runs');
  paused = false;
  refreshUpgradeCards();
  refreshMutStrip();
  run.combo = 0;
  $('combo').classList.add('hidden');
  $('boss-bar').classList.add('hidden');
  timeScale = 1; slowmoLeft = 0;
  banner('WAVE 1', 'DEFEND YOUR PLANET');
}

// ---------- Orbitals ----------
function ringLoad() {
  const load = [0, 0, 0, 0];
  for (const o of run.orbitals) load[o.ring]++;
  return load;
}
function addOrbital(type, x, y, arriving) {
  if (run.orbitals.length >= stat('slots')) return null;
  const load = ringLoad();
  let ring = -1;
  for (let i = 0; i < ringCount(); i++) if (load[i] < RING_CAP[i]) { ring = i; break; }
  if (ring < 0) return null;
  const dur = stat('durability');
  const o = { id: nextId++, type, ring, x, y, hp: dur, maxHp: dur, cd: 0, shoot: rand(0, 1.2), trail: [], arriving, arriveT: 0 };
  if (!arriving) {
    const a = run.ringAngle[ring] + load[ring] * TAU / Math.max(1, load[ring] + 1);
    o.x = Math.cos(a) * ringRadius(ring);
    o.y = Math.sin(a) * ringRadius(ring);
  }
  run.orbitals.push(o);
  Progress.max('maxOrbit', run.orbitals.length);
  return o;
}

function tryCapture(e) {
  const t = ENEMY_TYPES[e.type];
  if (!t.boss && Math.random() > stat('capture')) return;
  let type = t.capture;
  if (isSkin('void') && Math.random() < 0.25) type = 'void';
  if (Math.random() < 0.01 * (mc('goldenTouch') ? 10 : 1)) type = 'gold';
  const o = addOrbital(type, e.x, e.y, true);
  if (o) {
    Sound.play('capture', { x: e.x });
    Progress.track('captures');
    Progress.track('cap_' + type);
  }
  if (o && !save.tips.capture) {
    save.tips.capture = true;
    persist();
    toast('Captured! Destroyed enemies join your orbit 🪐');
  }
}

function shatter(o) {
  burst(o.x, o.y, ORBITALS[o.type].trail, 10, false);
  Sound.play('shatter', { x: o.x });
  if (mc('shrapnel')) {
    const dmg = stat('orbitDamage') * 3;
    for (const e of run.enemies) if (!e.dead && Math.hypot(e.x - o.x, e.y - o.y) < 32 + e.r) damageEnemy(e, dmg, false);
    run.waves.push({ x: o.x, y: o.y, r: 4, max: 32, t: 0.25, color: '#FF8A2A' });
  }
  o.dead = true;
}

// ---------- Spawning ----------
// [type, first wave, cumulative roll threshold]; checked top to bottom, the rest are drifters.
// Shared by spawning and the Bestiary so the shown odds are always the real ones.
const SPAWN_ODDS = [
  ['wraith', 15, 0.08],
  ['molten', 7, 0.20],
  ['scout', 5, 0.33],
  ['comet', 3, 0.55],
];
const BOSS_WAVE = w => (w % 10 === 0 ? (w % 20 === 0 ? 'mother' : 'worm') : null);

function pickType(w, isFirst) {
  if (isFirst && BOSS_WAVE(w)) return BOSS_WAVE(w);
  const r = Math.random();
  for (const [type, from, cum] of SPAWN_ODDS) if (w >= from && r < cum) return type;
  return 'drifter';
}

// Chance of each regular enemy type at a given wave (0..1)
function spawnChances(w) {
  const res = {};
  let prev = 0;
  for (const [type, from, cum] of SPAWN_ODDS) {
    if (w < from) { res[type] = 0; continue; }
    res[type] = cum - prev;
    prev = cum;
  }
  res.drifter = 1 - prev;
  return res;
}

function spawnEnemy(typeId, x, y, hpMult = 1) {
  const t = ENEMY_TYPES[typeId];
  if (x === undefined) {
    const a = Math.random() * TAU;
    const d = Math.hypot(W, H) / 2 / SCALE + PACE.spawnMargin;
    x = Math.cos(a) * d; y = Math.sin(a) * d;
  }
  const hp = enemyHp(run.wave) * t.hp * hpMult;
  if (!save.seen) save.seen = {};
  save.seen[typeId] = true; // unlocks its Bestiary entry
  const e = {
    type: typeId, x, y, r: t.r, speed: t.speed * PACE.speed * rand(0.9, 1.1),
    hp, maxHp: hp, dmg: enemyDmg(run.wave) * t.dmg, energy: t.energy,
    boss: !!t.boss, ranged: !!t.ranged, ghost: !!t.ghost,
    atk: 0.3, shoot: rand(1, 2), flash: 0, rot: Math.random() * TAU, spinV: rand(-1.5, 1.5),
    slow: 0, burn: 0, burnDps: 0, kb: 0, dead: false,
    verts: Array.from({ length: 9 }, () => rand(0.75, 1.1)),
    stopAt: typeId === 'scout' ? rand(105, 125) : typeId === 'mother' ? 105 : PLANET_R + t.r,
    hist: [], segs: [],
  };
  run.enemies.push(e);
  return e;
}

function hitTest(e, x, y, r) {
  if (Math.hypot(e.x - x, e.y - y) < e.r + r) return true;
  for (const s of e.segs) if (Math.hypot(s.x - x, s.y - y) < s.r + r) return true;
  return false;
}

// ---------- Combat ----------
function damageEnemy(e, amount, crit, quiet) {
  if (e.dead) return;
  e.hp -= amount;
  if (!quiet) e.flash = 0.07;
  if (crit && run.texts.length < 30) {
    run.texts.push({ x: e.x + rand(-6, 6), y: e.y - e.r, txt: fmt(amount), color: '#FFD34A', size: 12, life: 0.7, max: 0.7 });
  }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  run.kills++;
  const t = ENEMY_TYPES[e.type];
  Progress.track('kills');
  if (e.boss) { Progress.track('bosses'); Progress.track(e.type === 'worm' ? 'worm' : 'mother'); }
  comboHit();
  const full = run.orbitals.length >= stat('slots');
  const reward = (2 + 0.3 * run.wave) * e.energy * stat('energyKill') * (mc('overflow') && full ? 2 : 1) * comboMult();
  run.energy += reward;
  burst(e.x, e.y, enemyColor(e.type), e.boss ? 40 : 10, true);
  if (e.boss) {
    Sound.play('boom'); Sound.play('kill_big', { x: e.x });
    slowmo(0.9);
    screenFlash('#ffffff');
    vibrate([60, 40, 140]);
    run.shake = 6;
    banner('DEFEATED', ENEMY_INFO[e.type].name, false);
  }
  else if (t.splits) Sound.play('kill_big', { x: e.x, vol: 0.6 });
  else Sound.play('kill', { x: e.x });
  if (mc('siphon')) run.hp = Math.min(stat('maxHp'), run.hp + stat('maxHp') * 0.005 * mc('siphon'));
  if (t.splits) {
    for (let i = 0; i < 2; i++) spawnEnemy('drifter', e.x + rand(-8, 8), e.y + rand(-8, 8), 0.6);
  }
  if (e.boss) {
    const bonus = Math.floor(5 * metaVal('sStardust'));
    addStardust(bonus);
    floatText(e.x, e.y - 30, `+${bonus} ✦`, '#FFD34A', 16);
  }
  if (mc('blackHole')) {
    run.holeKills++;
    if (run.holeKills >= 75) {
      run.holeKills = 0;
      run.holes.push({ x: e.x * 0.8, y: e.y * 0.8, t: 5 });
      Sound.play('hole', { x: e.x });
    }
  }
  tryCapture(e);
}

function hitPlanet(dmg, big) {
  run.tookDamage = true;
  Sound.play('planet_hit', { vol: big ? 1.4 : 1 });
  if (big) vibrate(45); else if (!run.lastBuzz || run.time - run.lastBuzz > 0.4) { run.lastBuzz = run.time; vibrate(12); }
  run.hp -= dmg;
  run.hurt = 0.15;
  run.wobble = Math.min(0.15, run.wobble + 0.06);
  if (big) run.shake = Math.min(6, run.shake + 4);
  if (run.hp <= 0) gameOver();
}

function nearestEnemy(x, y, range) {
  let best = null, bd = Infinity;
  for (const e of run.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y) - e.r;
    if (d < bd && d <= range) { bd = d; best = e; }
  }
  return best;
}

function fireFrom(x, y, range, dmgMult) {
  const target = nearestEnemy(x, y, range);
  if (!target) return false;
  const crit = Math.random() < stat('critChance');
  const dmg = stat('coreDamage') * dmgMult * (crit ? stat('critMult') : 1);
  const a = Math.atan2(target.y - y, target.x - x);
  run.bullets.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a), vy: Math.sin(a), target, dmg, crit, life: 2 });
  Sound.play(crit ? 'crit' : 'shot', { x: target.x, vol: dmgMult < 1 ? 0.6 : 1 });
  return a;
}

function usePulse() {
  if (!run || run.over || paused || run.pulseCd > 0) return;
  run.pulseCd = PULSE_CD * (mc('chainPulse') ? 0.5 : 1);
  run.pulseT = 0.9;
  Progress.track('pulses');
  vibrate(35);
  const dmg = stat('coreDamage') * 2;
  for (const e of run.enemies) {
    const d = Math.hypot(e.x, e.y);
    if (d < 230) {
      e.kb += (e.boss ? 60 : 170) * (1 - d / 280);
      damageEnemy(e, dmg, false);
    }
  }
  run.eBullets.length = 0;
  run.waves.push({ x: 0, y: 0, r: PLANET_R, max: 230, t: 0.55, color: '#3FF2E0' });
  Sound.play('pulse');
  run.shake = Math.min(6, run.shake + 2);
}

// ---------- Effects ----------
function burst(x, y, color, count, suck) {
  for (let i = 0; i < count && run.particles.length < 350; i++) {
    const a = Math.random() * TAU;
    const s = rand(30, 110);
    const life = suck ? rand(1.2, 2) : rand(0.3, 0.6);
    run.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: rand(1.2, 2.8), suck, delay: suck ? rand(0.15, 0.35) : 0 });
  }
}
function floatText(x, y, txt, color, size) {
  run.texts.push({ x, y, txt, color, size, life: 1.4, max: 1.4 });
}
function addStardust(n) {
  run.stardust += n;
  save.stardust += n;
}
// ---------- Juice: vibration, banners, flashes, slow motion, combos ----------
function vibrate(pattern) {
  if (save.settings && save.settings.vibe === false) return;
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* unsupported */ } }
}

function banner(text, sub, boss) {
  const el = $('banner');
  el.className = boss ? 'boss' : '';
  el.innerHTML = `${sub ? `<small>${sub}</small>` : ''}${text}`;
  void el.offsetWidth; // restart the animation
  el.classList.add('show');
}

function screenFlash(color = '#ffffff') {
  const el = $('flash');
  el.style.background = color;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
}

// Slow motion runs on real time, so it always lasts the same, whatever the game speed
let timeScale = 1, slowmoLeft = 0;
function slowmo(seconds, scale = 0.25) { slowmoLeft = seconds; timeScale = scale; }

const COMBO_WINDOW = 1.4;   // seconds between kills to keep the chain alive
const comboMult = () => 1 + Math.min(run.combo || 0, 50) * 0.005; // up to +25% energy
function comboHit() {
  run.combo = (run.combo || 0) + 1;
  run.comboT = COMBO_WINDOW;
  if (run.combo >= 5) {
    const el = $('combo');
    el.classList.remove('hidden', 'bump');
    void el.offsetWidth;
    el.classList.add('bump');
    el.classList.toggle('hot', run.combo >= 25);
    $('combo-n').textContent = '×' + run.combo;
    $('combo-bonus').textContent = `COMBO +${Math.round((comboMult() - 1) * 100)}%`;
    if (run.combo % 25 === 0) { Sound.play('reroll', { rate: 1 + run.combo / 100 }); vibrate(15); }
  }
  Progress.max('combo', run.combo);
}
function comboTick(dt) {
  if (!run.combo) return;
  run.comboT -= dt;
  if (run.comboT <= 0) { run.combo = 0; $('combo').classList.add('hidden'); }
}

let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.innerHTML = msg;
  el.classList.add('show');
  toastTimer = 2.8;
}

// ---------- Waves & draft ----------
function endWave() {
  const w = run.wave;
  const bonus = stat('waveBonus');
  run.energy += bonus;
  const sd = stardustForWave(w);
  addStardust(sd);
  floatText(0, -PLANET_R - 34, `Wave ${w} cleared  +${sd} ✦`, '#FFD34A', 12);
  if (bonus >= 1) floatText(0, -PLANET_R - 20, `+⚡${fmt(bonus)}`, '#7DFF8A', 11);
  if (w > save.bestWave) save.bestWave = w;
  persist();
  run.flawless = run.tookDamage ? 0 : run.flawless + 1;
  run.tookDamage = false;
  Progress.max('flawless', run.flawless);
  run.wave++;
  Progress.max('wave', run.wave);
  if (!BOSS_WAVE(run.wave)) banner('WAVE ' + run.wave);
  run.waveTime = 0;
  run.spawned = 0;
  run.spawnAcc = PACE.spawnWindow / waveCount(run.wave); // next wave starts immediately
  if (w % DRAFT_EVERY === 0) openDraft();
  else Sound.play('wave_clear');
}

function rollMutations(n) {
  const pool = MUTATIONS.filter(m => m.stack || !mc(m.id));
  const picks = [];
  while (picks.length < n && pool.length) {
    const total = pool.reduce((s, m) => s + RARITY[m.rarity].weight, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) { r -= RARITY[pool[idx].rarity].weight; if (r <= 0) break; }
    picks.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
  }
  return picks;
}

let draftOptions = [];
function openDraft() {
  run.drafting = true;
  paused = true;
  draftOptions = rollMutations(3);
  renderDraft();
  show('draft');
  Sound.play('draft_open');
  Sound.muffle(true);
}

function renderDraft() {
  const wrap = $('draft-cards');
  wrap.innerHTML = '';
  for (const m of draftOptions) {
    const el = document.createElement('button');
    el.className = 'mcard ' + m.rarity;
    const owned = mc(m.id);
    el.innerHTML = `
      <div class="rarity">${RARITY[m.rarity].label}</div>
      <div class="micon">${mutIcon(m)}</div>
      <div class="mname">${m.name}</div>
      <div class="mdesc">${m.desc}</div>
      <div class="mcount">${owned ? 'Owned x' + owned : ''}</div>`;
    el.onclick = () => pickMutation(m);
    wrap.appendChild(el);
  }
  const rb = $('reroll-btn');
  rb.textContent = `🎲 Reroll (${run.rerolls})`;
  rb.disabled = run.rerolls <= 0;
}

function pickMutation(m) {
  const oldMax = stat('maxHp');
  run.mut[m.id] = mc(m.id) + 1;
  Progress.track('mutations');
  if (m.rarity === 'legendary') Progress.track('legendary');
  Progress.max('runMutations', Object.values(run.mut).reduce((a, b) => a + b, 0));
  if (m.id === 'thickAtmo') run.hp = stat('maxHp');
  else run.hp = Math.min(run.hp * stat('maxHp') / oldMax, stat('maxHp'));
  run.drafting = false;
  paused = false;
  hideAll();
  refreshMutStrip();
  refreshUpgradeCards();
  toast(`${mutIcon(m)} ${m.name}`);
  Sound.play(m.rarity === 'legendary' || m.rarity === 'epic' ? 'fanfare' : 'card_pick');
  if (m.rarity === 'legendary') { screenFlash('#FFD34A'); vibrate([30, 30, 60]); }
  else if (m.rarity === 'epic') screenFlash('#B06CFF');
  Sound.muffle(false, 0.8);
}

function gameOver() {
  if (run.over) return;
  run.over = true;
  run.hp = 0;
  paused = true;
  const reached = run.wave;
  const prevBest = save.bestWave;
  if (reached > save.bestWave) save.bestWave = reached;
  persist();
  burst(0, 0, '#3FF2E0', 60, false);
  for (const o of run.orbitals) burst(o.x, o.y, ORBITALS[o.type].trail, 4, false);
  run.orbitals = [];
  $('go-wave').textContent = reached;
  $('go-kills').textContent = fmt(run.kills);
  $('go-stardust').innerHTML = '+' + ICON_S + fmt(run.stardust);
  $('go-best').textContent = reached > prevBest ? '🏆 New best wave!' : `Best wave: ${save.bestWave}`;
  Sound.play('boom');
  Sound.play('kill_big');
  Sound.muffle(true, 1.5);
  setTimeout(() => {
    show('gameover');
    if (reached > prevBest) Sound.play('fanfare');
  }, 700);
}

// ============================================================
//  Update
// ============================================================
function update(dt) {
  const r = run;
  r.time += dt;
  comboTick(dt);

  if (!r.over) {
    // Waves & spawning
    r.waveTime += dt;
    const total = waveCount(r.wave);
    if (r.spawned < total) {
      r.spawnAcc += dt;
      const interval = PACE.spawnWindow / total;
      while (r.spawnAcc >= interval && r.spawned < total) {
        r.spawnAcc -= interval;
        const e = spawnEnemy(pickType(r.wave, r.spawned === 0));
        if (e.boss) {
          Sound.play('boss_warn');
          banner(ENEMY_INFO[e.type].name.toUpperCase(), '⚠ WAVE ' + r.wave, true);
          vibrate([30, 60, 30]);
        }
        r.spawned++;
      }
    }
    // Wave cleared early: short breather, then straight into the next one
    if (r.spawned >= total && r.enemies.length === 0) {
      r.clearT = (r.clearT || 0) + dt;
      if (r.clearT >= PACE.clearDelay) { r.clearT = 0; endWave(); if (r.drafting) return; }
    } else r.clearT = 0;
    if (r.waveTime >= PACE.waveLen) { r.clearT = 0; endWave(); if (r.drafting) return; }

    // Planet
    r.hp = Math.min(stat('maxHp'), r.hp + stat('regen') * dt);
    r.pulseCd = Math.max(0, r.pulseCd - dt);

    // Core fire
    r.fireAcc = Math.min(r.fireAcc + dt * stat('fireRate'), 3);
    let shots = 0;
    while (r.fireAcc >= 1 && shots < 4) {
      const a = fireFrom(0, 0, stat('range'), 1);
      if (a === false) { r.fireAcc = Math.min(r.fireAcc, 1); break; }
      r.aim = a;
      r.fireAcc -= 1;
      shots++;
    }
    // Binary star
    if (mc('binaryStar')) {
      r.starAcc += dt * stat('fireRate');
      if (r.starAcc >= 1) {
        const sp = binaryStarPos();
        if (fireFrom(sp.x, sp.y, 110, 0.5) !== false) r.starAcc -= 1; else r.starAcc = 1;
      }
    }
  }

  // Orbit layout
  const spin = stat('spin');
  for (let i = 0; i < 4; i++) {
    const dir = (mc('retrograde') && i === 1) ? -1 : 1;
    r.ringAngle[i] += RING_SPEED[i] * spin * dir * dt;
  }
  r.pulseT = Math.max(0, r.pulseT - dt);
  const pulseMult = r.pulseT > 0 ? 1 + 1.3 * Math.sin(Math.PI * (1 - r.pulseT / 0.9)) : 1;
  const byRing = [[], [], [], []];
  for (const o of r.orbitals) byRing[o.ring].push(o);
  for (let i = 0; i < 4; i++) {
    const list = byRing[i];
    const rad = ringRadius(i) * pulseMult;
    list.forEach((o, k) => {
      const a = r.ringAngle[i] + k * TAU / list.length;
      const tx = Math.cos(a) * rad, ty = Math.sin(a) * rad;
      if (o.arriving) {
        o.arriveT += dt;
        const f = Math.min(1, dt * 5);
        o.x += (tx - o.x) * f; o.y += (ty - o.y) * f;
        if (Math.hypot(tx - o.x, ty - o.y) < 2 || o.arriveT > 1.2) {
          o.arriving = false;
          Sound.play('lock_in', { x: o.x }); // the "ting" as it locks into orbit
          r.waves.push({ x: o.x, y: o.y, r: 2, max: 14, t: 0.3, color: ORBITALS[o.type].trail });
          burst(o.x, o.y, ORBITALS[o.type].trail, 6, false);
        }
      } else {
        const f = Math.min(1, dt * 14);
        o.x += (tx - o.x) * f; o.y += (ty - o.y) * f;
      }
      o.trail.push(o.x, o.y);
      if (o.trail.length > 16) o.trail.splice(0, 2);
    });
  }

  // Orbital collisions & drone lasers
  if (!r.over) {
    const od = stat('orbitDamage');
    for (const o of r.orbitals) {
      if (o.dead || o.arriving) continue;
      const def = ORBITALS[o.type];
      o.cd -= dt;
      if (def.shoots) {
        o.shoot -= dt;
        if (o.shoot <= 0) {
          const t = nearestEnemy(o.x, o.y, 90);
          if (t) {
            damageEnemy(t, od * 0.8, false);
            r.lasers.push({ x1: o.x, y1: o.y, x2: t.x, y2: t.y, t: 0.12 });
            Sound.play('drone', { x: o.x });
            o.shoot = 1.4;
          } else o.shoot = 0.2;
        }
      }
      if (o.cd > 0) continue;
      let hit = false;
      for (const e of r.enemies) {
        if (e.dead || !hitTest(e, o.x, o.y, def.r)) continue;
        damageEnemy(e, od * def.dmg * (e.ghost ? 0.5 : 1), false);
        if (def.slow || mc('frostbite')) e.slow = 1.5;
        if (def.burn || mc('kindling')) { e.burn = 3; e.burnDps = Math.max(e.burnDps, od * 0.4); }
        if (def.gold) { const g = (1 + 0.3 * r.wave) * 0.5; r.energy += g; }
        if (!e.boss) e.kb += 25;
        hit = true;
        if (!def.pierce) break;
      }
      if (hit) {
        Sound.play('orb_' + o.type, { x: o.x });
        o.cd = 0.3;
        o.hp -= def.pierce ? 0.5 : 1;
        if (o.hp <= 0) shatter(o);
      }
    }
  }

  // Enemies
  for (const e of r.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    e.rot += dt * e.spinV;
    e.slow = Math.max(0, e.slow - dt);
    if (e.burn > 0) {
      e.burn -= dt;
      damageEnemy(e, e.burnDps * dt, false, true);
      if (Math.random() < dt * 8) r.particles.push({ x: e.x + rand(-e.r, e.r), y: e.y + rand(-e.r, e.r), vx: 0, vy: -20, life: 0.4, max: 0.4, color: '#FF8A2A', size: 2, suck: false, delay: 0 });
      if (e.dead) continue;
    }
    const d = Math.hypot(e.x, e.y) || 1;
    if (e.kb > 0.5) {
      e.x += (e.x / d) * e.kb * dt;
      e.y += (e.y / d) * e.kb * dt;
      e.kb *= Math.exp(-4 * dt);
    } else e.kb = 0;
    let speed = e.speed * (e.slow > 0 ? 0.55 : 1);
    if (mc('hungry') && d < 170) speed *= 1.35;
    if (d > e.stopAt) {
      const move = Math.min(speed * dt, d - e.stopAt);
      e.x -= (e.x / d) * move;
      e.y -= (e.y / d) * move;
    } else if (!r.over) {
      if (e.ranged) {
        e.shoot -= dt;
        if (e.shoot <= 0) {
          if (e.type === 'mother') {
            spawnEnemy('scout', e.x, e.y, 0.7);
            e.shoot = 3.5;
          } else {
            const a = Math.atan2(-e.y, -e.x);
            r.eBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, dmg: e.dmg });
            Sound.play('enemy_shot', { x: e.x });
            e.shoot = 2.2;
          }
        }
      } else {
        e.atk -= dt;
        if (e.atk <= 0) { e.atk = 1; hitPlanet(e.dmg, e.boss); }
      }
    }
    // Serpent body (the sprite version is already curled up, so no trailing segments)
    if (e.type === 'worm' && !sprite('boss_worm')) {
      const last = e.hist[e.hist.length - 1];
      if (!last || Math.hypot(last.x - e.x, last.y - e.y) > 3) e.hist.push({ x: e.x, y: e.y });
      if (e.hist.length > 60) e.hist.shift();
      e.segs = [];
      for (let k = 1; k <= 8; k++) {
        const h = e.hist[e.hist.length - 1 - k * 6];
        if (h) e.segs.push({ x: h.x, y: h.y, r: e.r * (1 - k * 0.08) });
      }
    }
  }

  // Black holes
  for (const h of r.holes) {
    h.t -= dt;
    for (const e of r.enemies) {
      if (e.dead) continue;
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d < 95 && !e.boss) { e.x += dx / d * 70 * dt; e.y += dy / d * 70 * dt; }
      if (d < 40 + e.r) damageEnemy(e, stat('coreDamage') * 3 * dt, false, true);
    }
  }

  // Core bullets
  const BULLET_SPEED = 400;
  for (const b of r.bullets) {
    b.life -= dt;
    if (b.target && !b.target.dead) {
      const dx = b.target.x - b.x, dy = b.target.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < b.target.r + 3) {
        const e = b.target;
        if (isSkin('ember')) { e.burn = 2; e.burnDps = Math.max(e.burnDps, stat('coreDamage') * 0.3); }
        if (isSkin('glacier')) e.slow = Math.max(e.slow, 1);
        damageEnemy(e, b.dmg, b.crit);
        if (!e.dead) Sound.play('hit', { x: e.x });
        b.life = 0;
        continue;
      }
      b.vx = dx / d; b.vy = dy / d;
    } else {
      b.target = null;
      b.life = Math.min(b.life, 0.35);
    }
    b.x += b.vx * BULLET_SPEED * dt;
    b.y += b.vy * BULLET_SPEED * dt;
  }

  // Enemy bullets — orbitals can block them!
  for (const b of r.eBullets) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    for (const o of r.orbitals) {
      if (o.dead || o.arriving) continue;
      if (Math.hypot(o.x - b.x, o.y - b.y) < ORBITALS[o.type].r + 3) {
        b.dead = true;
        o.hp -= 1;
        if (o.hp <= 0) shatter(o);
        burst(b.x, b.y, '#FF3D7F', 4, false);
        break;
      }
    }
    if (!b.dead && Math.hypot(b.x, b.y) < PLANET_R) { b.dead = true; if (!r.over) hitPlanet(b.dmg, false); }
  }

  // Particles, texts, waves
  for (const p of r.particles) {
    p.life -= dt;
    if (p.suck) {
      p.delay -= dt;
      if (p.delay <= 0) {
        const d = Math.hypot(p.x, p.y) || 1;
        p.vx -= (p.x / d) * 520 * dt;
        p.vy -= (p.y / d) * 520 * dt;
        if (d < PLANET_R) p.life = 0;
      }
      p.vx *= 0.96; p.vy *= 0.96;
    } else { p.vx *= 0.92; p.vy *= 0.92; }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (const t of r.texts) { t.life -= dt; t.y -= 20 * dt; }
  for (const w of r.waves) { w.t -= dt; w.r += (w.max - w.r) * Math.min(1, dt * 9); }
  for (const l of r.lasers) l.t -= dt;

  r.enemies = r.enemies.filter(e => !e.dead);
  r.orbitals = r.orbitals.filter(o => !o.dead);
  r.bullets = r.bullets.filter(b => b.life > 0);
  r.eBullets = r.eBullets.filter(b => !b.dead && Math.hypot(b.x, b.y) < 600);
  r.particles = r.particles.filter(p => p.life > 0);
  r.texts = r.texts.filter(t => t.life > 0);
  r.waves = r.waves.filter(w => w.t > 0);
  r.holes = r.holes.filter(h => h.t > 0);
  r.lasers = r.lasers.filter(l => l.t > 0);
  r.shake = Math.max(0, r.shake - dt * 20);
  r.hurt = Math.max(0, r.hurt - dt);
  r.wobble = Math.max(0, r.wobble - dt * 0.6);
}

function binaryStarPos() {
  const rad = ringRadius(ringCount() - 1) + 20;
  const a = -run.time * 0.7;
  return { x: Math.cos(a) * rad, y: Math.sin(a) * rad };
}

// ============================================================
//  Render
// ============================================================
function enemyColor(type) {
  return { drifter: '#FF5A4E', comet: '#8FD8FF', scout: '#FF3D7F', molten: '#FF8A2A', wraith: '#9B5CFF', worm: '#FF3B3B', mother: '#FF3D7F' }[type];
}

function jagged(x, y, r, verts, rot) {
  ctx.beginPath();
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const px = x + Math.cos(a) * r * verts[i], py = y + Math.sin(a) * r * verts[i];
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function drawSprite(img, x, y, size, rot) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawPlanet(x, y, R, t, hurt, sk = skin()) {
  ctx.globalCompositeOperation = 'lighter';
  glow(x, y, R * 2.8, sk.glow, 0.35);
  ctx.globalCompositeOperation = 'source-over';
  const img = sprite(sk.img) || sprite('planet');
  if (img) {
    drawSprite(img, x, y, R * (sprite(sk.img) ? sk.size : 2.35), t * 0.05);
  } else {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
    const og = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R);
    og.addColorStop(0, '#4FC3E8');
    og.addColorStop(1, '#0B3A66');
    ctx.fillStyle = og;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
    // Continents drift = planet rotation
    ctx.fillStyle = '#3FBF7F';
    for (const c of CONTINENTS) {
      const cx = (((c.x + t * 0.05) % 4) - 2) * R;
      for (const off of [0, -4 * R]) {
        ctx.beginPath(); ctx.ellipse(x + cx + off, y + c.y * R, c.rx * R, c.ry * R, 0.3, 0, TAU); ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (const c of CLOUDS) {
      const cx = (((c.x + t * 0.11) % 4) - 2) * R;
      for (const off of [0, -4 * R]) {
        ctx.beginPath(); ctx.ellipse(x + cx + off, y + c.y * R, c.rx * R, c.ry * R, 0, 0, TAU); ctx.fill();
      }
    }
    // Night side
    const sg = ctx.createLinearGradient(x - R, y - R, x + R, y + R);
    sg.addColorStop(0.35, 'rgba(5,8,24,0)');
    sg.addColorStop(1, 'rgba(5,8,24,0.75)');
    ctx.fillStyle = sg;
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(168,255,244,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
  }
  if (hurt > 0) {
    ctx.fillStyle = `rgba(255,61,127,${hurt * 2.5})`;
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  }
}

function drawOrbital(o, t) {
  const def = ORBITALS[o.type];
  const fade = 0.45 + 0.55 * Math.max(0, o.hp / o.maxHp);
  // Trail
  const tr = o.trail;
  ctx.strokeStyle = def.trail;
  ctx.lineCap = 'round';
  for (let i = 2; i < tr.length; i += 2) {
    ctx.globalAlpha = (i / tr.length) * 0.5 * fade;
    ctx.lineWidth = (i / tr.length) * def.r * 1.2;
    ctx.beginPath(); ctx.moveTo(tr[i - 2], tr[i - 1]); ctx.lineTo(tr[i], tr[i + 1]); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  glow(o.x, o.y, def.r * 3, def.trail, 0.4 * fade);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = fade;
  const img = sprite('orb_' + o.type);
  const r = def.r;
  if (img) {
    // Drone sprite points up: face along the orbit (reversed on a retrograde ring)
    const backwards = run && o.ring === 1 && mc('retrograde');
    const rot = o.type === 'drone' ? Math.atan2(o.y, o.x) + (backwards ? 0 : Math.PI) : t * 1.2 + o.id;
    drawSprite(img, o.x, o.y, r * 3.6, rot);
  } else if (o.type === 'rock') {
    ctx.fillStyle = '#8F8A86';
    ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5E5955';
    ctx.beginPath(); ctx.arc(o.x - r * 0.3, o.y - r * 0.2, r * 0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(o.x + r * 0.35, o.y + r * 0.3, r * 0.2, 0, TAU); ctx.fill();
  } else if (o.type === 'ice') {
    ctx.fillStyle = '#BFE9FF';
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(t * 2 + o.id);
    ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r * 0.8, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.3, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else if (o.type === 'lava') {
    ctx.fillStyle = '#2A1A1A';
    ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#FF8A2A'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(o.x - r * 0.6, o.y - r * 0.2); ctx.lineTo(o.x, o.y + r * 0.1); ctx.lineTo(o.x + r * 0.5, o.y - r * 0.4);
    ctx.moveTo(o.x, o.y + r * 0.1); ctx.lineTo(o.x + r * 0.1, o.y + r * 0.7); ctx.stroke();
  } else if (o.type === 'drone') {
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(Math.atan2(o.y, o.x) + Math.PI / 2);
    ctx.fillStyle = '#3FF2E0';
    ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r, r); ctx.lineTo(0, r * 0.4); ctx.lineTo(-r, r); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else if (o.type === 'void') {
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(t * 3 + o.id);
    ctx.fillStyle = '#9B5CFF';
    ctx.beginPath(); ctx.moveTo(0, -r * 1.4); ctx.lineTo(r * 0.6, 0); ctx.lineTo(0, r * 1.4); ctx.lineTo(-r * 0.6, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1A0F2A';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (o.type === 'gold') {
    const gg = ctx.createRadialGradient(o.x - r * 0.3, o.y - r * 0.3, 0, o.x, o.y, r);
    gg.addColorStop(0, '#FFF6C8'); gg.addColorStop(1, '#E0A800');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawEnemy(e, t) {
  const col = enemyColor(e.type);
  ctx.globalCompositeOperation = 'lighter';
  glow(e.x, e.y, e.r * (e.boss ? 2.6 : 2.2), col, e.boss ? 0.45 : 0.3);
  ctx.globalCompositeOperation = 'source-over';
  const spr = sprite(e.boss ? 'boss_' + (e.type === 'worm' ? 'worm' : 'mothership') : 'enemy_' + e.type);
  const face = Math.atan2(-e.y, -e.x);

  if (spr) {
    const SPRITE_DRAW = {
      drifter: [2.9, e.rot], molten: [2.9, e.rot], comet: [3.6, face + Math.PI / 2],
      scout: [3, face + Math.PI / 2], wraith: [3.2, 0], worm: [3.6, 0], mother: [2.9, 0],
    };
    const [size, rot] = SPRITE_DRAW[e.type];
    drawSprite(spr, e.x, e.y, e.r * size, rot);
    if (e.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      glow(e.x, e.y, e.r * 1.4, '#ffffff', 0.7);
      ctx.globalCompositeOperation = 'source-over';
    }
  } else if (e.type === 'worm') {
    // Body segments, tail first
    for (let k = e.segs.length - 1; k >= 0; k--) {
      const s = e.segs[k];
      ctx.fillStyle = k % 2 ? '#4A2E2E' : '#5A3A3A';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,90,78,0.35)';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.35, 0, TAU); ctx.fill();
    }
  }

  if (spr) {
    // already drawn above
  } else if (e.flash > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
  } else if (e.type === 'drifter') {
    ctx.fillStyle = '#7D6F66';
    jagged(e.x, e.y, e.r, e.verts, e.rot); ctx.fill();
    ctx.fillStyle = '#FF5A4E';
    ctx.beginPath(); ctx.arc(e.x + Math.cos(e.rot) * e.r * 0.35, e.y + Math.sin(e.rot) * e.r * 0.35, e.r * 0.18, 0, TAU); ctx.fill();
  } else if (e.type === 'comet') {
    const tx = e.x - Math.cos(face) * e.r * 4, ty = e.y - Math.sin(face) * e.r * 4;
    const tg = ctx.createLinearGradient(e.x, e.y, tx, ty);
    tg.addColorStop(0, 'rgba(191,233,255,0.8)'); tg.addColorStop(1, 'rgba(143,216,255,0)');
    ctx.strokeStyle = tg; ctx.lineWidth = e.r * 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = '#E6F7FF';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
  } else if (e.type === 'scout') {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(face + Math.PI / 2);
    ctx.fillStyle = '#FF3D7F';
    ctx.beginPath(); ctx.moveTo(0, -e.r * 1.3); ctx.lineTo(e.r, e.r); ctx.lineTo(0, e.r * 0.5); ctx.lineTo(-e.r, e.r); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFD0E0';
    ctx.beginPath(); ctx.arc(0, -e.r * 0.2, e.r * 0.25, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (e.type === 'molten') {
    ctx.fillStyle = '#1D1416';
    jagged(e.x, e.y, e.r, e.verts, e.rot); ctx.fill();
    ctx.strokeStyle = '#FF8A2A'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = e.rot + k * 2.1;
      ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * e.r * 0.8, e.y + Math.sin(a) * e.r * 0.8);
    }
    ctx.stroke();
  } else if (e.type === 'wraith') {
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = 'rgba(26,15,42,0.55)';
      ctx.beginPath(); ctx.arc(e.x + Math.cos(t * 3 + k * 1.6) * 3, e.y + Math.sin(t * 2 + k) * 3, e.r, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#C9A8FF';
    const ex = Math.cos(face + Math.PI / 2) * e.r * 0.35, ey = Math.sin(face + Math.PI / 2) * e.r * 0.35;
    const fx = e.x + Math.cos(face) * e.r * 0.3, fy = e.y + Math.sin(face) * e.r * 0.3;
    ctx.beginPath(); ctx.arc(fx + ex, fy + ey, 1.8, 0, TAU); ctx.arc(fx - ex, fy - ey, 1.8, 0, TAU); ctx.fill();
  } else if (e.type === 'worm') {
    ctx.fillStyle = '#6A4040';
    jagged(e.x, e.y, e.r, e.verts, face);
    ctx.fill();
    ctx.fillStyle = '#FF3B3B';
    ctx.beginPath(); ctx.arc(e.x + Math.cos(face) * e.r * 0.45, e.y + Math.sin(face) * e.r * 0.45, e.r * 0.4, 0, TAU); ctx.fill();
  } else if (e.type === 'mother') {
    ctx.fillStyle = '#3A1630';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#FF3D7F'; ctx.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r * (1.1 + k * 0.25), e.r * 0.4, t * (k ? -0.8 : 0.6), 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = '#FF9EC0';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.3, 0, TAU); ctx.fill();
  }

  if (e.slow > 0) {
    ctx.fillStyle = 'rgba(143,216,255,0.3)';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
  }
  if (e.hp < e.maxHp) {
    const w = Math.max(14, e.r * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 7, w, 3);
    ctx.fillStyle = e.boss ? '#FFD34A' : '#FF3D7F';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 7, w * Math.max(0, e.hp / e.maxHp), 3);
  }
}

function render(now) {
  const t = now / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (bgCanvas.width) ctx.drawImage(bgCanvas, 0, 0);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (const s of twinkles) {
    ctx.globalAlpha = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.5 + s.p));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
  if (!run) return;
  const r = run;
  const tt = r.time;

  const sx = r.shake ? rand(-r.shake, r.shake) : 0;
  const sy = r.shake ? rand(-r.shake, r.shake) : 0;
  ctx.setTransform(DPR * SCALE, 0, 0, DPR * SCALE, DPR * (W / 2 + sx), DPR * (H / 2 + sy));

  // Core range (very subtle)
  ctx.strokeStyle = 'rgba(63,242,224,0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 6]);
  ctx.beginPath(); ctx.arc(0, 0, stat('range'), 0, TAU); ctx.stroke();
  ctx.setLineDash([]);

  // Orbit ring guides
  const load = ringLoad();
  for (let i = 0; i < ringCount(); i++) {
    if (!load[i]) continue;
    ctx.strokeStyle = 'rgba(63,242,224,0.10)';
    ctx.beginPath(); ctx.arc(0, 0, ringRadius(i), 0, TAU); ctx.stroke();
  }

  // Black holes
  for (const h of r.holes) {
    const a = Math.min(1, h.t);
    ctx.globalCompositeOperation = 'lighter';
    glow(h.x, h.y, 60, '#9B5CFF', 0.5 * a);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(201,168,255,${0.8 * a})`;
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.ellipse(h.x, h.y, 26 + k * 6, 10 + k * 3, tt * (1.5 + k * 0.4), 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(h.x, h.y, 14, 0, TAU); ctx.fill();
  }

  // Gravity lines to arriving captures
  for (const o of r.orbitals) {
    if (!o.arriving) continue;
    ctx.strokeStyle = 'rgba(63,242,224,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(o.x, o.y); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Enemy bullets
  ctx.globalCompositeOperation = 'lighter';
  for (const b of r.eBullets) glow(b.x, b.y, 7, '#FF3D7F', 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#FFD0E0';
  for (const b of r.eBullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, TAU); ctx.fill(); }

  for (const e of r.enemies) drawEnemy(e, tt);
  for (const o of r.orbitals) drawOrbital(o, tt);

  // Drone lasers
  ctx.strokeStyle = '#A8FFF4';
  for (const l of r.lasers) {
    ctx.globalAlpha = l.t / 0.12;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Core bullets
  ctx.globalCompositeOperation = 'lighter';
  for (const b of r.bullets) glow(b.x, b.y, b.crit ? 9 : 6, b.crit ? '#FFD34A' : '#3FF2E0', 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  for (const b of r.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.crit ? 2.2 : 1.6, 0, TAU); ctx.fill(); }

  // Planet
  if (!r.over) {
    const R = PLANET_R * (1 + Math.sin(tt * 30) * r.wobble * 0.3);
    drawPlanet(0, 0, R, tt, r.hurt);
    // Pulse ready ring
    const cdMax = PULSE_CD * (mc('chainPulse') ? 0.5 : 1);
    const p = 1 - r.pulseCd / cdMax;
    ctx.strokeStyle = p >= 1 ? `rgba(63,242,224,${0.5 + 0.3 * Math.sin(tt * 5)})` : 'rgba(63,242,224,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, PLANET_R + 5, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
  }

  // Binary star
  if (mc('binaryStar') && !r.over) {
    const sp = binaryStarPos();
    ctx.globalCompositeOperation = 'lighter';
    glow(sp.x, sp.y, 16, '#FFD34A', 0.7);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFF6C8';
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 4, 0, TAU); ctx.fill();
  }

  // Shockwaves
  for (const w of r.waves) {
    ctx.strokeStyle = w.color;
    ctx.globalAlpha = Math.max(0, w.t * 2);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Particles
  ctx.globalCompositeOperation = 'lighter';
  for (const p of r.particles) {
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Floating texts
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const tx of r.texts) {
    ctx.globalAlpha = Math.min(1, (tx.life / tx.max) * 2);
    ctx.font = `600 ${tx.size}px Fredoka, system-ui, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(tx.txt, tx.x, tx.y);
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.txt, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
}

// Spinning planet on the main menu
const menuCanvas = $('menu-planet');
const mctx = menuCanvas.getContext('2d');
let lobbyPulseAt = -10;
function renderMenuPlanet(now) {
  if ($('menu').classList.contains('hidden')) return;
  const t = now / 1000;
  const size = menuCanvas.width;
  const k = size / 92; // world units → canvas pixels
  // Tap-pulse: moons fling outward and snap back
  const pt = t - lobbyPulseAt;
  const fling = pt < 0.9 ? 1 + 0.45 * Math.sin(Math.PI * pt / 0.9) : 1;
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, size, size);
  drawWith(mctx, () => {
    mctx.setTransform(k, 0, 0, k, size / 2, size / 2);
    if (pt < 0.6) {
      mctx.strokeStyle = `rgba(63,242,224,${1 - pt / 0.6})`;
      mctx.lineWidth = 1.5;
      mctx.beginPath(); mctx.arc(0, 0, PLANET_R + pt * 70, 0, TAU); mctx.stroke();
    }
    drawPlanet(0, 0, PLANET_R, t, 0);
    const rings = [[30, ['rock', 'ice', 'gold'], 1.1], [40, ['lava', 'drone', 'void', 'rock'], -0.7]];
    for (const [rad, kinds, speed] of rings) {
      const r = rad * fling;
      kinds.forEach((kind, i) => {
        const a = t * speed + i * TAU / kinds.length;
        const o = { type: kind, x: Math.cos(a) * r, y: Math.sin(a) * r, hp: 1, maxHp: 1, id: i + rad, ring: 0, trail: [] };
        for (let s = 6; s >= 0; s--) { const aa = a - s * 0.06 * Math.sign(speed); o.trail.push(Math.cos(aa) * r, Math.sin(aa) * r); }
        drawOrbital(o, t);
      });
    }
  });
}
menuCanvas.addEventListener('click', () => {
  lobbyPulseAt = performance.now() / 1000;
  Sound.play('pulse_hum', { vol: 0.6 });
  vibrate(20);
});
// Run the game's drawing functions against another 2D context
function drawWith(c, fn) {
  const prev = ctx;
  ctx = c;
  try { fn(); } finally { ctx = prev; }
}

// ============================================================
//  UI: upgrade cards
// ============================================================
const cards = {};

function buildUpgradeCards() {
  const wrap = $('upgrades');
  for (const u of UPGRADES) {
    const el = document.createElement('button');
    el.className = 'card' + (u.tab === activeTab ? '' : ' hidden');
    el.innerHTML = `
      <div class="top"><span class="name"><img class="upg-ico" src="assets/upg_${u.id}.png" alt="">${u.name}</span><span class="lvl"></span></div>
      <div class="value"></div>
      <div class="cost"></div>`;
    el.addEventListener('click', () => buyUpgrade(u));
    wrap.appendChild(el);
    cards[u.id] = { el, lvl: el.querySelector('.lvl'), value: el.querySelector('.value'), cost: el.querySelector('.cost') };
  }
}

function purchasePlan(u) {
  const lv = run.lv[u.id] || 0;
  const max = u.max ?? Infinity;
  const room = max - lv;
  if (room <= 0) return { n: 0, cost: 0, maxed: true };
  if (buyMode === 'max') {
    let n = 0, cost = 0;
    while (n < room && n < 500) {
      const c = u.cost(lv + n);
      if (cost + c > run.energy) break;
      cost += c; n++;
    }
    if (n === 0) return { n: 1, cost: u.cost(lv), maxed: false };
    return { n, cost, maxed: false };
  }
  const n = Math.min(Number(buyMode), room);
  let cost = 0;
  for (let i = 0; i < n; i++) cost += u.cost(lv + i);
  return { n, cost, maxed: false };
}

let buyStreak = 0, lastBuyAt = 0;
function buyUpgrade(u) {
  if (!run || run.over || paused) return;
  const plan = purchasePlan(u);
  if (plan.maxed || plan.cost > run.energy) { Sound.play('denied'); return; }
  // Rapid purchases climb in pitch — a little "combo" reward for tapping
  const now = performance.now();
  buyStreak = now - lastBuyAt < 700 ? Math.min(buyStreak + 1, 10) : 0;
  lastBuyAt = now;
  Sound.play('buy', { rate: 1 + buyStreak * 0.045 + (plan.n > 1 ? 0.1 : 0) });
  const oldMax = stat('maxHp');
  run.energy -= plan.cost;
  run.lv[u.id] = (run.lv[u.id] || 0) + plan.n;
  Progress.track('upgrades', plan.n);
  if (u.id === 'maxHp') run.hp += stat('maxHp') - oldMax;
  if (u.id === 'durability') {
    const d = stat('durability');
    for (const o of run.orbitals) { o.hp += d - o.maxHp; o.maxHp = d; }
  }
  refreshUpgradeCards();
}

function refreshUpgradeCards() {
  if (!run) return;
  for (const u of UPGRADES) {
    const c = cards[u.id];
    c.el.classList.toggle('hidden', u.tab !== activeTab);
    if (u.tab !== activeTab) continue;
    const lv = run.lv[u.id] || 0;
    const plan = purchasePlan(u);
    const cur = stat(u.id);
    c.lvl.textContent = 'Lv ' + lv + (u.max ? '/' + u.max : '');
    if (plan.maxed) {
      c.value.innerHTML = `<b>${u.show(cur)}</b>`;
      c.cost.textContent = 'MAX';
    } else {
      const saved = run.lv[u.id];
      run.lv[u.id] = lv + plan.n;
      const next = stat(u.id);
      run.lv[u.id] = saved;
      c.value.innerHTML = `<b>${u.show(cur)}</b> → ${u.show(next)}`;
      c.cost.innerHTML = ICON_E + fmt(plan.cost) + (plan.n > 1 ? `  (x${plan.n})` : '');
    }
    const afford = !plan.maxed && plan.cost <= run.energy;
    c.el.classList.toggle('afford', afford);
    c.el.classList.toggle('cant', !afford && !plan.maxed);
    c.el.classList.toggle('maxed', plan.maxed);
  }
}

function refreshHud() {
  if (!run) return;
  $('hud-wave').textContent = run.wave;
  $('hud-energy').innerHTML = ICON_E + fmt(run.energy);
  $('hud-stardust').innerHTML = ICON_S + fmt(save.stardust);
  const maxHp = stat('maxHp');
  const frac = Math.max(0, run.hp) / maxHp;
  $('hp-fill').style.width = (frac * 100) + '%';
  $('hp-fill').classList.toggle('low', frac < 0.3);
  $('danger').classList.toggle('on', frac < 0.3 && !run.over);
  const boss = run.enemies.find(e => e.boss && !e.dead);
  $('boss-bar').classList.toggle('hidden', !boss);
  if (boss) {
    $('boss-name').textContent = ENEMY_INFO[boss.type].name;
    $('boss-fill').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
  }
  $('hp-text').textContent = `${fmt(Math.max(0, run.hp))} / ${fmt(maxHp)}`;
  $('wave-fill').style.width = Math.min(100, run.waveTime / PACE.waveLen * 100) + '%';
  $('orbit-count').textContent = `${run.orbitals.length}/${stat('slots')}`;
  const cdMax = PULSE_CD * (mc('chainPulse') ? 0.5 : 1);
  const p = 1 - run.pulseCd / cdMax;
  const pb = $('pulse-btn');
  pb.style.setProperty('--p', p);
  pb.classList.toggle('ready', p >= 1);
}

function refreshMutStrip() {
  const icons = [];
  for (const m of MUTATIONS) for (let i = 0; i < mc(m.id); i++) icons.push(mutIcon(m));
  $('mut-strip').innerHTML = icons.join('');
}

function renderMutList(el) {
  el.innerHTML = '';
  for (const m of MUTATIONS) {
    const n = mc(m.id);
    if (!n) continue;
    const pill = document.createElement('span');
    pill.className = 'mut-pill';
    pill.style.setProperty('--c', `var(--${m.rarity})`);
    pill.innerHTML = `${mutIcon(m)} ${m.name}${n > 1 ? ' x' + n : ''}`;
    el.appendChild(pill);
  }
  if (!el.children.length) el.innerHTML = '<span class="muted">No mutations yet</span>';
}

// ============================================================
//  UI: Observatory
// ============================================================
function renderObservatory() {
  $('obs-stardust').innerHTML = ICON_S + fmt(save.stardust);
  const list = $('obs-list');
  list.innerHTML = '';
  for (const m of META) {
    const lv = metaLv(m.id);
    const maxed = m.max !== undefined && lv >= m.max;
    const cost = Math.ceil(m.cost(lv));
    const item = document.createElement('div');
    item.className = 'obs-item';
    const current = m.id === 'sReroll' || lv > 0 ? m.desc(m.value(lv)) : 'Not owned';
    item.innerHTML = `
      <div class="icon">${m.img ? `<img src="assets/${m.img}.png" alt="">` : m.icon}</div>
      <div class="info">
        <div class="name">${m.name}<span class="lvl">Lv ${lv}</span></div>
        <div class="desc">${current}</div>
        ${maxed ? '' : `<div class="desc next">Next: ${m.desc(m.value(lv + 1))}</div>`}
      </div>
      <button ${maxed || cost > save.stardust ? 'disabled' : ''}>${maxed ? 'MAX' : ICON_S + fmt(cost)}</button>`;
    item.querySelector('button').addEventListener('click', () => {
      if (maxed || cost > save.stardust) return;
      save.stardust -= cost;
      save.meta[m.id] = lv + 1;
      Sound.play('buy', { rate: 0.9 });
      persist();
      renderObservatory();
    });
    list.appendChild(item);
  }
}

// ============================================================
//  Overlays & controls
// ============================================================
// ============================================================
//  UI: planet skins
// ============================================================
let obsTab = 'upgrades';
function setObsTab(tab) {
  obsTab = tab;
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.obs === tab));
  $('obs-list').classList.toggle('hidden', tab !== 'upgrades');
  $('skin-list').classList.toggle('hidden', tab !== 'planets');
  if (tab === 'planets') renderSkins(); else renderObservatory();
}

function renderSkins() {
  $('obs-stardust').innerHTML = ICON_S + fmt(save.stardust);
  const list = $('skin-list');
  list.innerHTML = '';
  for (const s of SKINS) {
    const owned = save.skins.includes(s.id);
    const equipped = save.skin === s.id;
    const waveOk = save.bestWave >= s.wave;
    const el = document.createElement('div');
    el.className = 'skin' + (equipped ? ' equipped' : '') + (owned ? '' : ' locked');
    el.style.setProperty('--glow', s.glow);
    let btn;
    if (equipped) btn = '<button disabled>Equipped</button>';
    else if (owned) btn = '<button class="equip">Equip</button>';
    else if (!waveOk) btn = `<button disabled>🔒 Reach wave ${s.wave}</button>`;
    else btn = `<button class="buy" ${save.stardust < s.cost ? 'disabled' : ''}>${ICON_S}${fmt(s.cost)}</button>`;
    el.innerHTML = `
      <img src="assets/${s.img}.png" alt="">
      ${owned ? '' : '<div class="lock">🔒</div>'}
      <div class="sname">${s.name}</div>
      <div class="perk">${s.perk}</div>
      <div class="drawback">${s.drawback}</div>
      ${btn}`;
    const b = el.querySelector('button');
    b.onclick = () => {
      if (equipped) return;
      if (!owned) {
        if (!waveOk || save.stardust < s.cost) return;
        save.stardust -= s.cost;
        save.skins.push(s.id);
        Progress.max('skins', save.skins.length);
      }
      Sound.play(owned ? 'equip' : 'fanfare');
      equipSkin(s.id);
      persist();
      renderSkins();
    };
    list.appendChild(el);
  }
}

function equipSkin(id) {
  save.skin = id;
  document.documentElement.style.setProperty('--skin', skin().glow);
}

// ============================================================
//  Offline earnings — the planet keeps orbiting while you're away
// ============================================================
const OFFLINE_MIN_MS = 5 * 60 * 1000;
const offlineRate = () => (2 + save.bestWave * 1.5) * (1 + 0.25 * metaLv('sRelay')) * metaVal('sStardust'); // per hour
const offlineCapHours = () => 8 + 2 * metaLv('sRelay');

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

function markSeen() {
  save.lastSeen = Date.now();
  persist();
}

// Returns true if a welcome-back screen was shown
function checkOffline() {
  const now = Date.now();
  const last = save.lastSeen || now;
  markSeen();
  const away = now - last;  // negative if the clock was moved back: ignored
  if (away < OFFLINE_MIN_MS || save.bestWave < 1) return false;
  const capH = offlineCapHours();
  const hours = Math.min(away / 3.6e6, capH);
  const amount = Math.floor(offlineRate() * hours);
  if (amount < 1) return false;
  showWelcome(away, amount, away / 3.6e6 >= capH);
  return true;
}

let welcomeAmount = 0, welcomeReturn = 'menu', countTimer = null;
function showWelcome(away, amount, full) {
  welcomeAmount = amount;
  // Remember which screen to go back to (pause if a run was interrupted)
  welcomeReturn = OVERLAYS.find(o => o !== 'welcome' && !$(o).classList.contains('hidden')) || (run && !run.over ? 'pause' : 'menu');
  $('welcome-img').src = `assets/${skin().img}.png`;
  $('welcome-away').textContent = `Your planet kept orbiting for ${fmtDuration(away)}`;
  $('welcome-rate').innerHTML = `${ICON_S}${fmt(offlineRate())}/hour · stores up to ${offlineCapHours()}h`;
  $('welcome-full').classList.toggle('hidden', !full);
  $('welcome-collect').disabled = false;
  $('welcome-double').disabled = false;
  // With "Remove ads" the ×2 is free and the AD tag disappears
  $('welcome-double').innerHTML = (Ads.noAds ? '' : '<span class="ad-tag">▶ AD</span> ') + 'Collect ×2';
  $('welcome-amount').parentElement.classList.remove('doubled');
  show('welcome');
  // Count up for a satisfying reveal
  const el = $('welcome-amount');
  const start = performance.now(), dur = 1100;
  clearInterval(countTimer);
  countTimer = setInterval(() => {
    const p = Math.min(1, (performance.now() - start) / dur);
    el.textContent = fmt(Math.round(amount * (1 - Math.pow(1 - p, 3))));
    if (p >= 1) clearInterval(countTimer);
  }, 30);
}

function collectWelcome(amount) {
  save.stardust += amount;
  welcomeAmount = 0;
  markSeen();
  Sound.play('fanfare');
  show(welcomeReturn);
}

$('welcome-collect').onclick = () => {
  if (!welcomeAmount) return;
  clearInterval(countTimer);
  $('welcome-collect').disabled = $('welcome-double').disabled = true;
  collectWelcome(welcomeAmount);
};

$('welcome-double').onclick = async () => {
  if (!welcomeAmount) return;
  $('welcome-collect').disabled = $('welcome-double').disabled = true;
  const ok = await Ads.rewarded('offline_x2');
  if (!ok) {
    // Ad failed or unavailable: let them collect normally
    $('welcome-collect').disabled = false;
    $('welcome-double').textContent = 'Ad not available right now';
    return;
  }
  // Show the doubling before closing
  clearInterval(countTimer);
  const base = welcomeAmount, el = $('welcome-amount');
  el.parentElement.classList.add('doubled');
  Sound.play('buy', { rate: 1.3 });
  const start = performance.now();
  countTimer = setInterval(() => {
    const p = Math.min(1, (performance.now() - start) / 700);
    el.textContent = fmt(Math.round(base * (1 + p)));
    if (p >= 1) {
      clearInterval(countTimer);
      setTimeout(() => collectWelcome(base * 2), 650);
    }
  }, 30);
};

// ============================================================
//  Bestiary — real numbers from the same formulas the game uses
// ============================================================
function renderBestiary() {
  const w = Number($('bst-wave').value);
  $('bst-wave-val').textContent = w;
  const odds = spawnChances(w);
  const order = ['drifter', 'comet', 'scout', 'molten', 'wraith', 'worm', 'mother'];
  const firstWave = { drifter: 1, worm: 10, mother: 20 };
  for (const [type, from] of SPAWN_ODDS) firstWave[type] = from;
  let html = '';
  for (const type of order) {
    const t = ENEMY_TYPES[type], info = ENEMY_INFO[type];
    const seen = save.seen && save.seen[type];
    if (!seen) {
      html += `
        <div class="beast locked">
          <img src="assets/${info.sprite}.png" alt="">
          <div class="bname">???<span class="bchance off">Appears from wave ${firstWave[type]}</span></div>
          <div class="bdesc">Not encountered yet.</div>
        </div>`;
      continue;
    }
    let chance;
    if (t.boss) chance = `<span class="bchance off">${type === 'worm' ? 'Waves 10, 30, 50…' : 'Waves 20, 40, 60…'}</span>`;
    else chance = odds[type] > 0 ? `<span class="bchance">${Math.round(odds[type] * 100)}%</span>` : `<span class="bchance off">from wave ${firstWave[type]}</span>`;
    const hp = enemyHp(w) * t.hp, dmg = enemyDmg(w) * t.dmg;
    const dmgLabel = t.ranged ? (type === 'mother' ? 'Spawns' : 'Shot') : 'Dmg/s';
    const dmgVal = type === 'mother' ? 'scouts' : fmt(dmg);
    const moon = t.capture;
    html += `
      <div class="beast ${t.boss ? 'boss' : ''}">
        <img src="assets/${info.sprite}.png" alt="">
        <div class="bname">${info.name}${chance}</div>
        <div class="bdesc">${info.desc}</div>
        <div class="bstats">
          <div><span>HP</span><b>${fmt(hp)}</b></div>
          <div><span>${dmgLabel}</span><b>${dmgVal}</b></div>
          <div><span>Speed</span><b>${Math.round(t.speed * PACE.speed)}</b></div>
          <div><span>Energy</span><b>${fmt((2 + 0.3 * w) * t.energy)}</b></div>
        </div>
        <div class="bcap">Captured as <img src="assets/orb_${moon}.png" alt=""> ${MOON_NAMES[moon]}</div>
      </div>`;
  }
  $('bst-list').innerHTML = html;
}
$('bst-wave').addEventListener('input', renderBestiary);

// ============================================================
//  Home base
// ============================================================
function refreshLobby() {
  const sk = skin();
  $('lobby-planet-name').textContent = sk.name;
  $('lobby-perk').textContent = sk.perk;
  const d = Progress.ensureDaily();
  const done = d.list.filter(m => m.progress >= m.target).length;
  const ready = d.list.some(m => m.progress >= m.target && !m.claimed) || (d.list.every(m => m.claimed) && !d.chestClaimed);
  $('lobby-daily-text').textContent = d.chestClaimed ? 'Daily missions complete ✓' : `Daily missions ${done}/${d.list.length}${ready ? ' · reward ready!' : ''}`;
  $('lobby-daily').classList.toggle('ready', ready);
}

const OVERLAYS = ['menu', 'pause', 'gameover', 'observatory', 'draft', 'howto', 'welcome', 'missions', 'bestiary'];
function show(id) {
  for (const o of OVERLAYS) $(o).classList.toggle('hidden', o !== id);
  if (id === 'menu') {
    $('menu-best').textContent = save.bestWave;
    $('menu-stardust').innerHTML = ICON_S + fmt(save.stardust);
  }
  if (id === 'observatory') setObsTab(obsTab);
  if (id === 'missions') Progress.render();
  if (id === 'menu') refreshLobby();
  if (id === 'bestiary') { const s = $('bst-wave'); s.max = Math.max(30, save.bestWave + 10); if (!s.dataset.touched) s.value = Math.max(1, save.bestWave); renderBestiary(); }
  if (id === 'menu' || id === 'gameover') Progress.refreshBadge();
  if (id === 'pause') { renderMutList($('pause-muts')); Sound.muffle(true); }
  if (id === 'menu' || id === 'observatory' || id === 'missions' || id === 'bestiary' || (id === 'howto' && !(run && !run.over))) {
    Sound.music('menu');
    Sound.muffle(false, 0.8);
  }
}
function hideAll() { for (const o of OVERLAYS) $(o).classList.add('hidden'); }

function startRun() {
  if (!save.tips.howto) { show('howto'); return; }
  newRun();
  hideAll();
  Sound.music('game');
  Sound.muffle(false, 0.6);
}
$('howto-ok').onclick = () => {
  const first = !save.tips.howto;
  save.tips.howto = true;
  persist();
  if (first) startRun(); else show('menu');
};
$('menu-howto-btn').onclick = () => show('howto');
$('menu-planets-btn').onclick = () => { obsTab = 'planets'; show('observatory'); };
document.querySelectorAll('.seg-btn').forEach(b => { b.onclick = () => setObsTab(b.dataset.obs); });

$('play-btn').onclick = startRun;
$('retry-btn').onclick = startRun;
$('menu-obs-btn').onclick = () => { obsTab = 'upgrades'; show('observatory'); };
$('go-obs-btn').onclick = () => { obsTab = 'upgrades'; show('observatory'); };
$('obs-close').onclick = () => show('menu');
$('menu-missions-btn').onclick = () => show('missions');
$('go-missions-btn').onclick = () => show('missions');
$('missions-close').onclick = () => show('menu');
$('menu-bestiary-btn').onclick = () => show('bestiary');
$('bst-close').onclick = () => show('menu');
$('lobby-daily').onclick = () => { Progress.setTab('daily'); show('missions'); };
$('bst-wave').addEventListener('pointerdown', () => { $('bst-wave').dataset.touched = 1; });
document.querySelectorAll('[data-mtab]').forEach(b => { b.onclick = () => Progress.setTab(b.dataset.mtab); });
$('reroll-btn').onclick = () => {
  if (!run || run.rerolls <= 0) return;
  run.rerolls--;
  draftOptions = rollMutations(3);
  renderDraft();
  Sound.play('reroll');
};

$('pause-btn').onclick = () => {
  if (!run || run.over || run.drafting) return;
  paused = true;
  show('pause');
};
$('resume-btn').onclick = () => { paused = false; hideAll(); Sound.muffle(false); };
$('quit-btn').onclick = () => { hideAll(); paused = false; gameOver(); };

$('speed-btn').onclick = () => {
  gameSpeed = gameSpeed >= 3 ? 1 : gameSpeed + 1;
  $('speed-btn').textContent = gameSpeed + 'x';
};
$('pulse-btn').onclick = usePulse;

// ---------- Audio: unlock on first touch, UI clicks, toggles ----------
document.addEventListener('pointerdown', ev => {
  const first = !Sound.ready;
  Sound.init();
  if (first) Sound.music(run && !run.over ? 'game' : 'menu');
  const b = ev.target.closest('button');
  // Buttons with their own sounds (upgrades, cards, purchases, pulse) skip the generic click
  if (b && !b.disabled && !b.closest('.card, .mcard, .skin, .obs-item, #pulse-btn')) Sound.play('click');
}, true);

if (!save.settings) save.settings = { sfx: true, music: true };
if (save.settings.vibe === undefined) save.settings.vibe = true;
function refreshSoundToggles() {
  document.querySelectorAll('.snd-toggle').forEach(b => b.classList.toggle('off', !save.settings[b.dataset.snd]));
  Sound.configure(save.settings);
}
document.querySelectorAll('.snd-toggle').forEach(b => {
  b.onclick = () => {
    save.settings[b.dataset.snd] = !save.settings[b.dataset.snd];
    persist();
    refreshSoundToggles();
  };
});
refreshSoundToggles();
canvas.addEventListener('pointerdown', ev => {
  const rect = canvas.getBoundingClientRect();
  const wx = (ev.clientX - rect.left - W / 2) / SCALE;
  const wy = (ev.clientY - rect.top - H / 2) / SCALE;
  if (Math.hypot(wx, wy) < PLANET_R + 18) usePulse();
});

for (const t of document.querySelectorAll('.tab')) {
  t.onclick = () => {
    activeTab = t.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    refreshUpgradeCards();
  };
}
for (const b of document.querySelectorAll('#buy-mode .chip')) {
  b.onclick = () => {
    buyMode = b.dataset.mode;
    document.querySelectorAll('#buy-mode .chip').forEach(x => x.classList.toggle('active', x === b));
    refreshUpgradeCards();
  };
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (run && !run.over && !paused) { paused = true; show('pause'); }
    markSeen();
  } else {
    checkOffline();
  }
});
window.addEventListener('pagehide', markSeen);

// ============================================================
//  Main loop
// ============================================================
let last = performance.now();
let uiTimer = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (slowmoLeft > 0) { slowmoLeft -= dt; if (slowmoLeft <= 0) timeScale = 1; }
  if (run && !paused) {
    for (let i = 0; i < gameSpeed && !paused; i++) update(dt * timeScale);
  } else if (run && run.over) {
    update(dt); // let the collapse play out
  }
  render(now);
  renderMenuPlanet(now);
  uiTimer -= dt;
  if (uiTimer <= 0) { uiTimer = 0.1; refreshHud(); refreshUpgradeCards(); }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
  // Heartbeat so offline time is measured even if the app is killed without a "hidden" event
  if (now - lastHeartbeat > 5000) { lastHeartbeat = now; markSeen(); }
  requestAnimationFrame(frame);
}
let lastHeartbeat = 0;

buildUpgradeCards();
equipSkin(save.skin);
Ads.setNoAds(save.noAds);
Progress.ensureDaily();
Progress.sync('wave', save.bestWave);
Progress.sync('skins', save.skins.length);
resize();
show('menu');
checkOffline();
requestAnimationFrame(frame);

// ---------- Offline play & installability ----------
// Only on the published site: locally it would serve stale cached files while editing
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // A new version was published: reload, but never in the middle of a run
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // first install, nothing to refresh
    const reloadWhenSafe = () => {
      if (!run || run.over) { markSeen(); location.reload(); }
      else setTimeout(reloadWhenSafe, 3000);
    };
    reloadWhenSafe();
  });
}
