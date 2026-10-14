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
// A fusion shows its two parents' icons overlapped
const mutIcon = (m, cls = 'mut-ico') => m.fusion
  ? `<span class="fuse-ico">${m.fusion.map(id => mutIcon(MUT[id], cls)).join('')}</span>`
  : `<img class="${cls}" src="assets/${m.img || 'mut_' + m.id}.png" alt="${m.icon}">`;

// ============================================================
//  Sprites — drop PNGs into /assets with these names and they
//  replace the procedural drawings automatically.
// ============================================================
const SPRITE_NAMES = [
  'background', 'planet',
  'orb_rock', 'orb_ice', 'orb_lava', 'orb_drone', 'orb_void', 'orb_gold',
  'enemy_drifter', 'enemy_comet', 'enemy_scout', 'enemy_molten', 'enemy_wraith',
  'boss_worm', 'boss_mothership',
  'skin_ember', 'skin_glacier', 'skin_gasgiant', 'skin_crystal', 'skin_void', 'skin_solar',
];
const SPRITES = {};
for (const name of SPRITE_NAMES) {
  const img = new Image();
  img.onload = () => { SPRITES[name] = img; if (name === 'background') buildBackground(); };
  img.src = `assets/${name}.${name === 'background' ? 'jpg' : 'png'}`;
}
const sprite = name => SPRITES[name] || null;
// Art that may arrive later (new enemies, boss, elite icons). Loaded only if present, so no 404s.
const OPTIONAL_SPRITES = ['enemy_sentinel', 'enemy_blinker', 'enemy_hive', 'enemy_swarmer', 'boss_queen',
  'elite_swift', 'elite_armored', 'elite_regen', 'elite_explosive', 'elite_splitting'];
fetch('assets.json').then(r => (r.ok ? r.json() : [])).then(list => {
  for (const name of OPTIONAL_SPRITES) {
    if (!list.includes(name + '.png')) continue;
    const img = new Image();
    img.onload = () => { SPRITES[name] = img; };
    img.src = `assets/${name}.png`;
  }
}).catch(() => {});

// ============================================================
//  Save data
// ============================================================
const SAVE_KEY = 'gravitywell.v1';
function defaultSave() {
  return { stardust: 0, bestWave: 0, meta: {}, tips: {}, skins: ['terra'], skin: 'terra',
           settings: { sfx: true, music: true, vibe: true, musicVol: 1, sfxVol: 1 } };
}
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
const metaLv = id => (Challenge.active ? 0 : save.meta[id] || 0); // challenges ignore the Observatory
const metaVal = id => MT[id].value(metaLv(id));

// ============================================================
//  Mutations (drafted every few waves)
// ============================================================
const RARITY = {
  common:    { weight: 60, label: 'Common' },
  rare:      { weight: 28, label: 'Rare' },
  epic:      { weight: 10, label: 'Epic' },
  legendary: { weight: 3,  label: 'Legendary' },
  fusion:    { weight: 0,  label: 'Fusion' }, // never rolled: offered when both parents are owned
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
  { id: 'chainPulse', rarity: 'epic',   icon: '🌀', name: 'Chain Pulse',       desc: 'Gravity Pulse recharges 35% faster' },
  { id: 'blackHole',  rarity: 'legendary', icon: '⚫', name: 'Black Hole Heart', desc: 'Every 75 kills, a black hole devours nearby enemies' },
  { id: 'outerHalo',  rarity: 'legendary', icon: '🪐', name: 'Outer Halo',       desc: 'A 4th orbit ring and +6 orbit slots' },
  { id: 'goldenTouch',rarity: 'legendary', icon: '👑', name: 'Golden Touch',     desc: 'Golden moons are 10x more common' },
  // Unlocked through Constellations (requires = node id)
  { id: 'darkHarvest',rarity: 'rare',   icon: '✦', name: 'Dark Harvest', desc: 'Kills have a 3% chance to drop Stardust', requires: 'darkHarvest', img: 'icon_stardust' },
  { id: 'echoPulse',  rarity: 'epic',   icon: '🔁', name: 'Echo Pulse',   desc: 'Every Gravity Pulse fires a second, half-power blast', requires: 'echoPulse', img: 'ui_pulse' },
  { id: 'twinCore',   rarity: 'legendary', icon: '⚡', name: 'Twin Core', desc: 'Your core fires two shots at once', requires: 'twinCore', img: 'upg_fireRate' },
];
// Fusions: own both parents and the fusion takes a slot in every draft until you take it.
// Each one upgrades its two parents into something new, so drafting toward a pair pays off.
const FUSIONS = [
  { id: 'thermalShock', fusion: ['frostbite', 'kindling'],    icon: '♨️', name: 'Thermal Shock', desc: 'Orbital hits on chilled, burning enemies erupt in a fiery blast' },
  { id: 'eventHorizon', fusion: ['blackHole', 'hungry'],      icon: '🌌', name: 'Event Horizon', desc: 'Black holes form every 40 kills, pull from further and last longer' },
  { id: 'trinaryStar',  fusion: ['binaryStar', 'rapidCore'],  icon: '🌟', name: 'Trinary Star',  desc: 'A second mini-star joins, and both fire at full core power' },
  { id: 'clusterBomb',  fusion: ['shrapnel', 'denseRock'],    icon: '💣', name: 'Cluster Bomb',  desc: 'Shattering orbitals blow up twice as wide and twice as hard' },
  { id: 'midasOrbit',   fusion: ['goldenTouch', 'magnet'],    icon: '🪙', name: 'Midas Orbit',   desc: 'Golden moons never crack, and each adds +10% orbit damage' },
  { id: 'bloodMoon',    fusion: ['siphon', 'glassCannon'],    icon: '🌑', name: 'Blood Moon',    desc: 'Siphon heals 3x, and Glass Cannon costs only 25% health' },
  { id: 'tidalWave',    fusion: ['tidalLock', 'chainPulse'],  icon: '🌊', name: 'Tidal Wave',    desc: 'Gravity Pulse breaks the lock: orbitals whirl at 3x speed for 4 s' },
];
for (const f of FUSIONS) MUTATIONS.push(Object.assign(f, { rarity: 'fusion' }));
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
  // Supporter Pack exclusive: looks only, no stat changes (so nobody pays for power)
  { id: 'solar',    name: 'Solar Crown',   img: 'skin_solar',    size: 2.35, glow: '#FFD34A',
    perk: 'Supporter exclusive. Pure style, no drawbacks.', drawback: '', cost: 0, wave: 0, exclusive: true },
];
const SKIN = Object.fromEntries(SKINS.map(s => [s.id, s]));
const skin = () => SKIN[save.skin] || SKIN.terra;
// Planets earned by playing (the 'own all 6' achievement doesn't count the paid one)
const earnedSkins = () => save.skins.filter(id => SKIN[id] && !SKIN[id].exclusive).length;
const isSkin = id => !Challenge.active && save.skin === id;   // ...and planet perks

// ============================================================
//  Final stats = upgrade × permanent bonus × mutations × skin
// ============================================================
const lvl = id => run.lv[id] || 0;
const base = id => UP[id].value(lvl(id));
const mc = id => run.mut[id] || 0;

function stat(id) {
  switch (id) {
    case 'coreDamage':  return base(id) * metaVal('sCore') * Math.pow(1.4, mc('heavyCore')) * (mc('glassCannon') ? 2 : 1)
                               * (isSkin('glacier') ? 0.9 : isSkin('gasgiant') ? 0.85 : 1) * Galaxy.dmgMult();
    case 'critChance':  return base(id) + (isSkin('crystal') ? 0.1 : 0);
    case 'critMult':    return base(id) + (isSkin('crystal') ? 0.5 : 0);
    case 'fireRate':    return base(id) * Math.pow(1.3, mc('rapidCore'));
    case 'orbitDamage': return base(id) * metaVal('sOrbit') * (mc('wideOrbit') ? 1.15 : 1) * (mc('hungry') ? 1.5 : 1)
                               * (mc('tidalLock') ? 3 : 1) * (mc('glassCannon') ? 2 : 1) * Galaxy.dmgMult()
                               * (mc('midasOrbit') ? 1 + 0.1 * (run.goldCount || 0) : 1);
    case 'slots':       return Math.min(Challenge.has('cramped') ? 6 : 999, base(id) + (mc('outerHalo') ? 6 : 0) + (isSkin('gasgiant') ? 3 : 0));
    case 'capture':     return Math.min(0.95, base(id) + metaVal('sCapture') + 0.15 * mc('magnet') + (Challenge.has('fragile') ? 0.3 : 0));
    case 'durability':  return base(id) * Math.pow(1.5, mc('denseRock')) * (Challenge.has('fragile') ? 0.5 : 1);
    case 'spin':        if (mc('tidalLock')) return run.spinBoost > 0 ? base(id) * 3 : 0;
                        return base(id) * (mc('retrograde') ? 1.3 : 1);
    case 'maxHp':       return base(id) * metaVal('sHull') * Math.pow(1.3, mc('thickAtmo')) * (mc('glassCannon') ? (mc('bloodMoon') ? 0.75 : 0.5) : 1)
                               * (isSkin('ember') || isSkin('crystal') ? 0.9 : 1) * Galaxy.hpMult();
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
const pulseCdMax = () => PULSE_CD * (mc('chainPulse') ? 0.65 : 1);
const PULSE_RESIST = 6; // seconds after a pulse hit during which the next one pushes an enemy much less

const ORBITALS = {
  rock:  { dmg: 1,   r: 4.5, trail: '#3FF2E0' },
  ice:   { dmg: 0.7, r: 4.5, trail: '#8FD8FF', slow: true },
  lava:  { dmg: 0.6, r: 5,   trail: '#FF8A2A', burn: true },
  drone: { dmg: 0.5, r: 4.5, trail: '#3FF2E0', shoots: true },
  void:  { dmg: 1.3, r: 4.5, trail: '#9B5CFF', pierce: true },
  gold:  { dmg: 1,   r: 5,   trail: '#FFD34A', gold: true },
  star:  { dmg: 0.8, r: 5,   trail: '#7DFFEA', heal: true },   // Constellation unlock: heals the planet
};

const ENEMY_TYPES = {
  drifter: { hp: 1,   speed: 26, r: 9,  dmg: 1,   energy: 1,   capture: 'rock' },
  comet:   { hp: 0.5, speed: 55, r: 6,  dmg: 0.6, energy: 1,   capture: 'ice' },
  scout:   { hp: 0.8, speed: 40, r: 8,  dmg: 0.5, energy: 1.5, capture: 'drone', ranged: true },
  molten:  { hp: 3.5, speed: 15, r: 14, dmg: 2,   energy: 3,   capture: 'lava', splits: true },
  wraith:  { hp: 2.5, speed: 30, r: 10, dmg: 2,   energy: 4,   capture: 'void', ghost: true },
  worm:    { hp: 16,  speed: 13, r: 20, dmg: 4,   energy: 25,  capture: 'void', boss: true },
  mother:  { hp: 18,  speed: 12, r: 26, dmg: 4,   energy: 25,  capture: 'drone', boss: true, ranged: true },
  // Galaxy enemies (one new type per galaxy)
  sentinel:{ hp: 1.6, speed: 22, r: 10, dmg: 1.2, energy: 2.5, capture: 'ice', shielded: true },
  blinker: { hp: 0.8, speed: 26, r: 7,  dmg: 1,   energy: 2.5, capture: 'void', blinks: true },
  hive:    { hp: 4.5, speed: 12, r: 15, dmg: 2,   energy: 5,   capture: 'lava', hive: true },
  swarmer: { hp: 0.25,speed: 48, r: 5,  dmg: 0.4, energy: 0.4, capture: 'rock' },
  queen:   { hp: 22,  speed: 10, r: 24, dmg: 5,   energy: 30,  capture: 'void', boss: true },
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
  sentinel:{ name: 'Sentinel',    sprite: 'enemy_sentinel',  fallback: 'enemy_scout',   tint: '#4AA8FF', css: 'hue-rotate(200deg) saturate(1.2)', galaxy: 2,
             desc: 'Shielded. Takes 65% less damage from core shots: crack it with your moons.' },
  blinker: { name: 'Blinker',     sprite: 'enemy_blinker',   fallback: 'enemy_comet',   tint: '#FF4FD8', css: 'hue-rotate(110deg) saturate(1.6)', galaxy: 3,
             desc: 'Teleports toward your planet every few seconds.' },
  hive:    { name: 'Hive',        sprite: 'enemy_hive',      fallback: 'enemy_molten',  tint: '#7DFF8A', css: 'hue-rotate(90deg) saturate(1.3)', galaxy: 4,
             desc: 'Bursts into a swarm of six tiny Swarmers when destroyed.' },
  swarmer: { name: 'Swarmer',     sprite: 'enemy_swarmer',   fallback: 'enemy_drifter', tint: '#7DFF8A', css: 'hue-rotate(100deg)', galaxy: 4, hidden: true,
             desc: 'Tiny and fast. Comes out of Hives.' },
};
ENEMY_INFO.queen = { name: 'Nebula Queen', sprite: 'boss_queen', fallback: 'enemy_wraith', tint: '#FF7AE0', css: 'hue-rotate(40deg) saturate(1.5)',
  desc: 'Boss. Hangs back and shields every enemy near her: they take 60% less damage. Take her down first!' };

// Elites: from wave 20 some enemies spawn with a random trait. Bigger, golden ring, 3x energy.
const ELITE_TRAITS = {
  swift:     { icon: '⚡', name: 'Swift',        desc: '60% faster' },
  armored:   { icon: '🛡️', name: 'Armored',      desc: '4× health' },
  regen:     { icon: '♻️', name: 'Regenerating', desc: 'Heals 4% per second' },
  explosive: { icon: '💥', name: 'Explosive',    desc: 'Explodes on death, cracking nearby moons' },
  splitting: { icon: '👥', name: 'Splitting',    desc: 'Splits into two when destroyed' },
};
const ELITE_LIST = Object.keys(ELITE_TRAITS);
function eliteChance(w) {
  if (Challenge.has('elites')) return w >= 5 ? 0.2 : 0;
  return w >= 20 ? Math.min(0.22, 0.04 + (w - 20) * 0.006) : 0;
}
function makeElite(e, trait) {
  e.elite = trait;
  e.maxHp *= trait === 'armored' ? 4 : 2;
  e.hp = e.maxHp;
  e.r *= 1.25;
  e.energy *= 3;
  if (trait === 'swift') e.speed *= 1.6;
  if (!save.seen) save.seen = {};
  save.seen.elite = true;
}

const MOON_NAMES = { rock: 'Rock moon', ice: 'Ice moon', lava: 'Lava moon', drone: 'Captured drone', void: 'Void shard', star: 'Star moon' };

// Pacing knobs, all in one place
const PACE = {
  waveLen: 17,       // max seconds per wave
  spawnWindow: 11,   // enemies arrive during the first N seconds
  clearDelay: 0.8,   // breather after the last enemy dies, then the next wave starts
  countBase: 9, countPer: 2.6,   // a swarm of weaker enemies feels better than a trickle
  speed: 1.5,        // enemy speed multiplier
  spawnMargin: 6,    // how far off-screen enemies appear
  scoutStop: [105, 125], // how far from the planet scouts stop to shoot
  bossEscort: 0.6,   // share of the normal enemy count that comes along with a boss
  coreTargetsShooters: true,    // while nothing touches the planet, the core shoots ranged enemies first
};
// Boss waves bring a smaller escort so the boss itself is the fight
const waveCount = w => Math.min(100, Math.round((PACE.countBase + PACE.countPer * w) * (BOSS_WAVE(w) ? PACE.bossEscort : 1)));
// Difficulty knobs, all in one place
const BALANCE = {
  hpBase: 5, hpGrowth: 1.20, hpCurve: 1.0012,   // enemy health per wave (curve gets steeper late)
  dmgBase: 3, dmgGrowth: 1.12, dmgCurve: 1.001,
  clearBase: 4, clearPer: 1.5,   // energy for clearing a wave (before fast/flawless bonuses)
  pulseDmg: 1,   // Gravity Pulse damage (× core damage) to every enemy in range
};
const enemyHp = w => BALANCE.hpBase * Math.pow(BALANCE.hpGrowth, w - 1) * Math.pow(BALANCE.hpCurve, (w - 1) * (w - 1)) * Galaxy.enemyHpMult();
const enemyDmg = w => BALANCE.dmgBase * Math.pow(BALANCE.dmgGrowth, w - 1) * Math.pow(BALANCE.dmgCurve, (w - 1) * (w - 1));
const stardustForWave = w => Math.max(1, Math.floor((1 + w * 0.5) * metaVal('sStardust') * Galaxy.dustMult()));

// ============================================================
//  Canvas & background
// ============================================================
const canvas = $('game');
let ctx = canvas.getContext('2d'); // swapped temporarily to draw the menu planet
const mainCtx = ctx;
const stage = $('stage');
let W = 0, H = 0, DPR = 1, SCALE = 1;
let stillFrames = 0; // frames drawn since the scene stopped moving (see frame())
const bgCanvas = document.createElement('canvas');
const twinkles = [];

// ---------- Graphics quality: 2 = high, 1 = medium, 0 = low (auto-adjusts to the phone) ----------
let GFX = 2;
const GFX_DPR = [1, 1.5, 2];          // canvas resolution
const GFX_PARTICLES = [90, 200, 350];  // particle cap
const GFX_BURST = [0.35, 0.6, 1];      // particles per explosion
const GFX_NAMES = ['Low', 'Medium', 'High'];
function setGfx(level) {
  level = Math.max(0, Math.min(2, level));
  if (level === GFX) return;
  GFX = level;
  document.body.classList.toggle('gfx-low', GFX === 0);
  resize();
  if (typeof refreshGfxUi === 'function') refreshGfxUi();
}

function resize() {
  const r = stage.getBoundingClientRect();
  // A hidden/collapsed stage measures 0x0: keep the last size, or SCALE becomes 0 and spawns land at NaN
  if (!r.width || !r.height) return;
  DPR = Math.min(GFX_DPR[GFX], window.devicePixelRatio || 1);
  W = r.width; H = r.height;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  SCALE = Math.min(W, H) / 300;
  stillFrames = 0; // resizing clears the canvas: draw it again
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
  const gi = Galaxy.info();
  if (gi.tint) {
    g.globalCompositeOperation = 'color';
    g.globalAlpha = 0.5;
    g.fillStyle = gi.tint;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
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

// Energy for runs that warp past the early waves, so you can buy upgrades right away
function warpEnergy(W) {
  let e = 0;
  for (let w = 1; w < W; w++) e += waveCount(w) * (2 + 0.3 * w) + BALANCE.clearBase + BALANCE.clearPer * w;
  return e * 0.85;
}

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
  run.dmg = {};
  run.captures = 0; run.elitesKilled = 0; run.bestCombo = 0; run.upgradesBought = 0;
  const warp = Galaxy.warpWave();
  if (warp > 1) {
    run.wave = warp;
    run.energy += warpEnergy(warp);
    run.spawnAcc = PACE.spawnWindow / waveCount(warp);
  }
  run.shield = Galaxy.has('shield') ? stat('maxHp') * 0.15 : 0;
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
  banner('WAVE ' + run.wave, run.wave > 1 ? 'WARP DRIVE ENGAGED' : 'DEFEND YOUR PLANET');
  $('auto-buy').classList.toggle('hidden', !Galaxy.has('autoBuy'));
  if (Galaxy.has('headStart')) setTimeout(() => { if (run && !run.over && !run.drafting && !paused) openDraft(); }, 700);
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
  if (Math.random() < 0.01 * (mc('goldenTouch') ? 10 : 1) * (Challenge.has('goldRush') ? 20 : 1)) type = 'gold';
  else if (Galaxy.has('starMoon') && Math.random() < 0.08) type = 'star';
  const o = addOrbital(type, e.x, e.y, true);
  if (o) {
    Sound.play('capture', { x: e.x });
    Progress.track('captures');
    run.captures++;
    Progress.track('cap_' + type);
  }
  if (o) coach('capture', 'Captured! Destroyed enemies can join your orbit and fight for you.', '#orbit-info');
}

function shatter(o) {
  burst(o.x, o.y, ORBITALS[o.type].trail, 10, false);
  Sound.play('shatter', { x: o.x });
  if (mc('shrapnel')) {
    const big = mc('clusterBomb'), rad = big ? 56 : 32;
    const dmg = stat('orbitDamage') * (big ? 6 : 3);
    for (const e of run.enemies) if (!e.dead && Math.hypot(e.x - o.x, e.y - o.y) < rad + e.r) damageEnemy(e, dmg, false, false, 'orbit');
    run.waves.push({ x: o.x, y: o.y, r: 4, max: rad, t: 0.25, color: '#FF8A2A' });
  }
  o.dead = true;
}

function thermalBlast(x, y, od) {
  for (const e of run.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < 30 + e.r) damageEnemy(e, od * 1.5, false, false, 'orbit');
  run.waves.push({ x, y, r: 4, max: 30, t: 0.25, color: '#FFB27A' });
  burst(x, y, '#8FD8FF', 5, false);
}

// ---------- Spawning ----------
// [type, first wave, cumulative roll threshold]; checked top to bottom, the rest are drifters.
// Shared by spawning and the Bestiary so the shown odds are always the real ones.
// [type, first wave, full share of the swarm, waves to ramp up to that share]
// New types fade in over a few waves instead of arriving at full strength (a sudden 20% molten wave was a wall).
function spawnOdds() {
  return [
    ['wraith', Galaxy.mod('earlyWraith') ? 8 : 15, 0.08, 4],
    ['molten', Galaxy.mod('earlyMolten') ? 4 : 6, 0.12, 5],
    ['scout', 4, 0.13, 3],
    ['comet', 2, Galaxy.mod('cometX2') || Challenge.has('comets') ? 0.37 : 0.22, 2],
  ];
}
const oddsShare = (w, from, share, ramp) => w < from ? 0 : share * Math.min(1, (w - from + 1) / ramp);
// Bosses rotate: World Eater (10, 40, 70…), Mothership (20, 50, 80…), Nebula Queen (30, 60, 90…)
const BOSS_WAVE = w => {
  const step = Challenge.has('bossRush') ? 5 : 10;
  if (w % step) return null;
  const i = (w / step) % 3;
  return i === 1 ? 'worm' : i === 2 ? 'mother' : 'queen';
};
const QUEEN_AURA = 90;

function pickType(w, isFirst) {
  if (isFirst && BOSS_WAVE(w)) return BOSS_WAVE(w);
  const extra = Galaxy.extraSpawn(w);   // this galaxy's new enemies roll first
  if (extra) return extra;
  let r = Math.random();
  for (const [type, ...o] of spawnOdds()) if ((r -= oddsShare(w, ...o)) < 0) return type;
  return 'drifter';
}

// Chance of each regular enemy type at a given wave (0..1)
function spawnChances(w) {
  const res = {};
  let sum = 0;
  for (const [type, ...o] of spawnOdds()) sum += res[type] = oddsShare(w, ...o);
  res.drifter = 1 - sum;
  const { res: extra, left } = Galaxy.extraChances(w);
  for (const k in res) res[k] *= left;
  return Object.assign(res, extra);
}

function spawnEnemy(typeId, x, y, hpMult = 1) {
  const t = ENEMY_TYPES[typeId];
  const spawnedNaturally = x === undefined;
  if (x === undefined) {
    const a = Math.random() * TAU;
    const d = Math.hypot(W, H) / 2 / SCALE + PACE.spawnMargin;
    x = Math.cos(a) * d; y = Math.sin(a) * d;
  }
  // The very first boss (wave 10) is a gentler introduction to boss fights
  const intro = t.boss && run.wave <= 10 ? 0.7 : 1;
  const hp = enemyHp(run.wave) * t.hp * hpMult * intro;
  if (!save.seen) save.seen = {};
  save.seen[typeId] = true; // unlocks its Bestiary entry
  const e = {
    type: typeId, x, y, r: t.r, speed: t.speed * PACE.speed * rand(0.9, 1.1),
    hp, maxHp: hp, dmg: enemyDmg(run.wave) * t.dmg * intro, energy: t.energy,
    boss: !!t.boss, ranged: !!t.ranged, ghost: !!t.ghost,
    atk: 0.3, shoot: rand(1, 2), flash: 0, rot: Math.random() * TAU, spinV: rand(-1.5, 1.5),
    slow: 0, burn: 0, burnDps: 0, kb: 0, dead: false,
    verts: Array.from({ length: 9 }, () => rand(0.75, 1.1)),
    stopAt: typeId === 'scout' ? rand(PACE.scoutStop[0], PACE.scoutStop[1]) : typeId === 'mother' ? 105 : typeId === 'queen' ? 128 : PLANET_R + t.r,
    hist: [], segs: [],
  };
  if (Challenge.has('swift')) e.speed *= 1.3;
  // Regular spawns (no position given) can roll an elite trait
  if (spawnedNaturally && !t.boss && typeId !== 'swarmer' && Math.random() < eliteChance(run.wave)) {
    makeElite(e, ELITE_LIST[Math.floor(Math.random() * ELITE_LIST.length)]);
  }
  if (typeId === 'queen') run.queen = e;
  run.enemies.push(e);
  return e;
}

function hitTest(e, x, y, r) {
  if (Math.hypot(e.x - x, e.y - y) < e.r + r) return true;
  for (const s of e.segs) if (Math.hypot(s.x - x, s.y - y) < s.r + r) return true;
  return false;
}

// ---------- Combat ----------
// src: where the damage came from, for the run summary ('core' | 'orbit' | 'pulse' | 'burn' | 'other')
function damageEnemy(e, amount, crit, quiet, src = 'other') {
  if (e.dead) return;
  const q = run.queen;
  if (q && q !== e && !q.dead && Math.hypot(e.x - q.x, e.y - q.y) < QUEEN_AURA) amount *= 0.4;
  run.dmg[src] = (run.dmg[src] || 0) + Math.min(amount, Math.max(0, e.hp)); // don't count overkill
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
  if (e.boss) { Progress.track('bosses'); Progress.track(e.type); }
  if (e === run.queen) run.queen = null;
  if (e.elite) {
    Progress.track('elites');
    run.elitesKilled++;
    if (e.elite === 'explosive') {
      run.waves.push({ x: e.x, y: e.y, r: 4, max: 40, t: 0.35, color: '#FF8A2A' });
      Sound.play('kill_big', { x: e.x, vol: 0.7 });
      for (const o of run.orbitals) {
        if (!o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 40) { o.hp -= 2; if (o.hp <= 0) shatter(o); }
      }
      if (Math.hypot(e.x, e.y) < 60) hitPlanet(e.dmg * 2, false);
    }
    if (e.elite === 'splitting') {
      for (let i = 0; i < 2; i++) spawnEnemy(e.type, e.x + rand(-10, 10), e.y + rand(-10, 10), 0.4);
    }
  }
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
  if (mc('siphon')) run.hp = Math.min(stat('maxHp'), run.hp + stat('maxHp') * 0.005 * mc('siphon') * (mc('bloodMoon') ? 3 : 1));
  if (t.hive) {
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      spawnEnemy('swarmer', e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10);
    }
  }
  if (mc('darkHarvest') && Math.random() < 0.03) {
    const s = Math.max(1, Math.round(Galaxy.dustMult()));
    addStardust(s);
    floatText(e.x, e.y - 12, `+${s} ✦`, '#FFD34A', 11);
  }
  if (t.splits) {
    for (let i = 0; i < 2; i++) spawnEnemy('drifter', e.x + rand(-8, 8), e.y + rand(-8, 8), 0.6);
  }
  if (e.boss) {
    const bonus = Math.floor(5 * metaVal('sStardust') * Galaxy.dustMult());
    addStardust(bonus);
    floatText(e.x, e.y - 30, `+${bonus} ✦`, '#FFD34A', 16);
  }
  if (mc('blackHole')) {
    run.holeKills++;
    const horizon = mc('eventHorizon');
    if (run.holeKills >= (horizon ? 40 : 75)) {
      run.holeKills = 0;
      run.holes.push({ x: e.x * 0.8, y: e.y * 0.8, t: horizon ? 7 : 5, s: horizon ? 1.4 : 1 });
      Sound.play('hole', { x: e.x });
    }
  }
  tryCapture(e);
}

function hitPlanet(dmg, big) {
  if (run.reviveOffer || run.invuln > 0) return; // dead and deciding, or just revived
  if (run.shield > 0) {
    const absorbed = Math.min(run.shield, dmg);
    run.shield -= absorbed;
    dmg -= absorbed;
    if (dmg <= 0) { Sound.play('orb_drone', { vol: 0.6 }); return; }
  }
  run.tookDamage = true;
  Sound.play('planet_hit', { vol: big ? 1.4 : 1 });
  if (big) vibrate(45); else if (!run.lastBuzz || run.time - run.lastBuzz > 0.4) { run.lastBuzz = run.time; vibrate(12); }
  run.hp -= dmg;
  run.hurt = 0.15;
  run.wobble = Math.min(0.15, run.wobble + 0.06);
  if (big) run.shake = Math.min(6, run.shake + 4);
  if (run.hp <= 0) planetDied();
}

// ---------- Second Wind: one ad-revive per run ----------
const REVIVE_SECONDS = 6;
const canRevive = () => !run.revived && !Challenge.active && run.wave >= 3;
function planetDied() {
  if (!canRevive()) { gameOver(); return; }
  run.hp = 0;
  run.reviveOffer = true;
  paused = true;
  Sound.play('boom');
  vibrate([60, 40, 60]);
  $('revive-yes').innerHTML = (Ads.noAds ? '' : '<span class="ad-tag">▶ AD</span> ') + 'Revive';
  $('revive-yes').disabled = $('revive-no').disabled = false;
  show('revive');
  Sound.muffle(true);
  // Countdown ring: when it runs out, the run ends
  let left = REVIVE_SECONDS;
  const ring = $('revive-ring');
  clearInterval(run.reviveTimer);
  run.reviveTimer = setInterval(() => {
    if (run.watchingAd || document.hidden) return; // the clock stops while the ad plays or the app is in the background
    left -= 0.05;
    ring.style.setProperty('--p', Math.max(0, left / REVIVE_SECONDS).toFixed(3));
    $('revive-count').textContent = Math.max(0, Math.ceil(left));
    if (left <= 0) declineRevive();
  }, 50);
}
function declineRevive() {
  if (!run.reviveOffer) return;
  clearInterval(run.reviveTimer);
  run.reviveOffer = false;
  run.revived = true;
  hideAll();
  gameOver();
}
async function acceptRevive() {
  if (!run.reviveOffer || run.watchingAd) return;
  $('revive-yes').disabled = $('revive-no').disabled = true;
  run.watchingAd = true;
  const ok = await Ads.rewarded('revive');
  run.watchingAd = false;
  if (!ok) { declineRevive(); return; }
  clearInterval(run.reviveTimer);
  run.reviveOffer = false;
  run.revived = true;
  Progress.track('revives');
  // Back with half health, a moment of safety, and every enemy blown away from the planet
  run.hp = stat('maxHp') * 0.5;
  run.invuln = 2.5;
  run.pulseCd = 0;
  for (const e of run.enemies) {
    const d = Math.hypot(e.x, e.y);
    if (d < 200) e.kb += (e.boss ? 80 : 220) * (1 - d / 260);
  }
  run.eBullets.length = 0;
  run.waves.push({ x: 0, y: 0, r: PLANET_R, max: 230, t: 0.7, color: '#FFD34A' });
  hideAll();
  paused = false;
  Sound.muffle(false, 0.6);
  Sound.play('fanfare');
  screenFlash('#FFD34A');
  banner('SECOND WIND', 'BACK IN THE FIGHT');
}
$('revive-yes').onclick = acceptRevive;
$('revive-no').onclick = declineRevive;

// preferRanged: shooters within range win over closer enemies (used by the core)
// queenFirst: the Nebula Queen shields everyone near her, so she's always the top target in range
function nearestEnemy(x, y, range, preferRanged = false, queenFirst = false) {
  let best = null, bd = Infinity;
  for (const e of run.enemies) {
    if (e.dead) continue;
    let d = Math.hypot(e.x - x, e.y - y) - e.r;
    if (d > range) continue;
    if (preferRanged && e.ranged) d -= 1000;
    if (queenFirst && e === run.queen) d -= 2000;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// True while a melee enemy is at the planet, chewing on it
const planetUnderAttack = () => run.enemies.some(e => !e.dead && !e.ranged && Math.hypot(e.x, e.y) <= e.stopAt + 2);

function fireFrom(x, y, range, dmgMult) {
  const target = nearestEnemy(x, y, range, PACE.coreTargetsShooters && !planetUnderAttack(), true);
  if (!target) return false;
  const crit = Math.random() < stat('critChance');
  const dmg = stat('coreDamage') * dmgMult * (crit ? stat('critMult') : 1);
  const a = Math.atan2(target.y - y, target.x - x);
  run.bullets.push({ x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a), vy: Math.sin(a), target, dmg, crit, life: 2 });
  Sound.play(crit ? 'crit' : 'shot', { x: target.x, vol: dmgMult < 1 ? 0.6 : 1 });
  return a;
}

function usePulse() {
  if (!run || run.over || paused || run.pulseCd > 0 || Challenge.has('noPulse')) return;
  run.pulseCd = pulseCdMax();
  Progress.track('pulses');
  vibrate(35);
  if (mc('echoPulse')) run.echoAt = run.time + 0.6;
  if (mc('tidalWave')) run.spinBoost = 4;
  pulseBlast();
}

// echo: the weaker second blast from Echo Pulse (half power, no bullet clear)
function pulseBlast(echo = false) {
  run.pulseT = 0.9;
  const power = echo ? 0.5 : 1;
  const dmg = stat('coreDamage') * BALANCE.pulseDmg * power;
  for (const e of run.enemies) {
    const d = Math.hypot(e.x, e.y);
    if (d < 230) {
      // Back-to-back pulses can't keep enemies pinned at the edge forever
      const resisted = !echo && e.pulsedAt !== undefined && run.time - e.pulsedAt < PULSE_RESIST;
      e.kb += (e.boss ? 60 : 170) * (1 - d / 280) * power * (resisted ? 0.35 : 1);
      if (!echo) e.pulsedAt = run.time;
      damageEnemy(e, dmg, false, false, 'pulse');
    }
  }
  if (!echo) run.eBullets.length = 0;
  run.waves.push({ x: 0, y: 0, r: PLANET_R, max: 230, t: 0.55, color: '#3FF2E0' });
  Sound.play('pulse');
  run.shake = Math.min(6, run.shake + 2);
}

// ---------- Effects ----------
function burst(x, y, color, count, suck) {
  count = Math.ceil(count * GFX_BURST[GFX]);
  for (let i = 0; i < count && run.particles.length < GFX_PARTICLES[GFX]; i++) {
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
  if (!Sound.ready || (save.settings && save.settings.vibe === false)) return;
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
  if (run.combo > run.bestCombo) run.bestCombo = run.combo;
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

const coachQueue = [];
let coachTimer = null, coachShowing = false, coachDone = null;
// Switching screens closes the current hint and drops queued ones (they'll come back when relevant)
function clearCoach() {
  coachQueue.length = 0;
  if (coachDone) coachDone(true);
}
// side: 'above' | 'below' to force where the bubble goes (default: below targets near the top, above the rest)
function coach(id, text, target, side) {
  if (!save.tips) save.tips = {};
  if (save.tips['h_' + id] || coachQueue.some(q => q.id === id)) return;
  coachQueue.push({ id, text, target, side });
  if (!coachShowing) nextCoach();
}
function nextCoach() {
  const q = coachQueue.shift();
  if (!q) { coachShowing = false; return; }
  const el = typeof q.target === 'string' ? document.querySelector(q.target) : q.target;
  if (!el || !el.getClientRects().length) { nextCoach(); return; } // target not visible: skip
  coachShowing = true;
  save.tips['h_' + q.id] = true;
  persist();
  const b = $('coach');
  b.querySelector('.coach-text').textContent = q.text;
  const r = el.getBoundingClientRect();
  b.classList.remove('hidden', 'above', 'below');
  const below = q.side ? q.side === 'below' : r.top < innerHeight * 0.45;
  b.classList.add(below ? 'below' : 'above');
  const bw = Math.min(280, innerWidth - 24);
  b.style.width = bw + 'px';
  const left = Math.max(12, Math.min(innerWidth - bw - 12, r.left + r.width / 2 - bw / 2));
  b.style.left = left + 'px';
  b.style.setProperty('--arrow', (r.left + r.width / 2 - left) + 'px');
  b.style.top = below ? (r.bottom + 12) + 'px' : '';
  b.style.bottom = below ? '' : (innerHeight - r.top + 12) + 'px';
  el.classList.add('coach-target');
  clearTimeout(coachTimer);
  const done = (silent) => {
    b.classList.add('hidden');
    el.classList.remove('coach-target');
    document.removeEventListener('pointerdown', done, true);
    clearTimeout(coachTimer);
    coachDone = null;
    coachShowing = false;
    if (silent !== true) setTimeout(nextCoach, 400);
  };
  coachDone = done;
  coachTimer = setTimeout(done, 6500);
  setTimeout(() => document.addEventListener('pointerdown', done, true), 300);
}

let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.innerHTML = msg;
  el.classList.add('show');
  toastTimer = 2.8;
}

// ---------- Waves & draft ----------
// Energy for clearing a wave: base grows with the wave, +50% for clearing before the timer,
// +50% for taking no damage. The Wave Bonus upgrade adds on top.
const waveClearBase = w => (BALANCE.clearBase + BALANCE.clearPer * w) * stat('energyKill');
function waveClearReward(w) {
  const early = run.waveTime < PACE.waveLen;
  const fast = early ? Math.max(0, (PACE.waveLen - run.waveTime) / (PACE.waveLen - PACE.spawnWindow)) : 0;
  const fastBonus = Math.min(1, fast) * 0.5;
  const flawless = !run.tookDamage;
  const total = waveClearBase(w) * (1 + fastBonus + (flawless ? 0.5 : 0)) + stat('waveBonus');
  return { total, fast: fastBonus >= 0.1, flawless };
}

function endWave() {
  const w = run.wave;
  const rw = waveClearReward(w);
  run.energy += rw.total;
  const sd = Challenge.active ? 0 : stardustForWave(w);
  if (sd) addStardust(sd);
  // Green energy bursts in from around the planet and gets pulled into it
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * TAU;
    burst(Math.cos(a) * 70, Math.sin(a) * 70, '#7DFF8A', 6, true);
  }
  const parts = [`<b class="e">+${ICON_E}${fmt(rw.total)}</b>`, `<b class="s">+${sd}${ICON_S}</b>`];
  if (rw.fast) parts.push('FAST');
  if (rw.flawless) parts.push('FLAWLESS');
  run.clearSub = parts.join(' · ');
  // Boss waves have no "WAVE N" banner, so show the reward as a toast instead
  if (BOSS_WAVE(w + 1)) toast(`Wave ${w} clear · ${parts.slice(0, 2).join(' ')}`);
  if (!Challenge.active) {
    if (w > save.bestWave) save.bestWave = w;
    if (w > (save.galaxyBest || 0)) save.galaxyBest = w;
  }
  persist();
  run.flawless = run.tookDamage ? 0 : run.flawless + 1;
  run.tookDamage = false;
  Progress.max('flawless', run.flawless);
  run.wave++;
  if (!Challenge.active) Progress.max('wave', run.wave);
  if (Galaxy.has('shield')) run.shield = stat('maxHp') * 0.15;
  if (!BOSS_WAVE(run.wave)) banner('WAVE ' + run.wave, run.clearSub);
  if (run.wave === 4) coach('orbitTab', 'Orbit upgrades make your moons stronger and let you hold more of them.', '[data-tab="orbit"]');
  run.waveTime = 0;
  run.spawned = 0;
  run.spawnAcc = PACE.spawnWindow / waveCount(run.wave); // next wave starts immediately
  if (w % (Challenge.has('frenzy') ? 1 : DRAFT_EVERY) === 0) openDraft();
  else Sound.play('wave_clear');
}

function rollMutations(n) {
  const pool = MUTATIONS.filter(m => !m.fusion && (m.stack || !mc(m.id)) && (!m.requires || Galaxy.has(m.requires)));
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

// A ready fusion always takes the last slot, so a pair you built toward never gets lost to bad luck
const readyFusions = () => FUSIONS.filter(f => !mc(f.id) && f.fusion.every(id => mc(id)));
function rollDraft() {
  const opts = rollMutations(Galaxy.has('fourth') ? 4 : 3);
  const ready = readyFusions();
  if (ready.length) opts.splice(Math.max(0, opts.length - 1), 1, ready[Math.floor(Math.random() * ready.length)]);
  return opts;
}

let draftOptions = [];
function openDraft() {
  run.drafting = true;
  paused = true;
  draftOptions = rollDraft();
  renderDraft();
  show('draft');
  Sound.play('draft_open');
  Sound.muffle(true);
}

function renderDraft() {
  const wrap = $('draft-cards');
  wrap.innerHTML = '';
  wrap.classList.toggle('four', draftOptions.length > 3);
  for (const m of draftOptions) {
    const el = document.createElement('button');
    el.className = 'mcard ' + m.rarity;
    const owned = mc(m.id);
    el.innerHTML = `
      <div class="rarity">${RARITY[m.rarity].label}</div>
      <div class="micon">${mutIcon(m)}</div>
      <div class="mname">${m.name}</div>
      <div class="mdesc">${m.desc}</div>
      <div class="mcount">${m.fusion ? m.fusion.map(id => MUT[id].name).join(' + ') : owned ? 'Owned x' + owned : ''}</div>`;
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
  Sound.play(m.fusion || m.rarity === 'legendary' || m.rarity === 'epic' ? 'fanfare' : 'card_pick');
  if (m.fusion) {
    if (!save.fusions) save.fusions = {};
    const first = !save.fusions[m.id];
    save.fusions[m.id] = true;
    persist();
    Progress.track('fusions');
    Progress.max('fusionsFound', Object.keys(save.fusions).length);
    banner('FUSION', m.name + (first ? ' · new discovery!' : ''), false);
    screenFlash('#3FF2E0');
    vibrate([30, 30, 30, 30, 80]);
    run.shake = Math.min(6, run.shake + 3);
  }
  else if (m.rarity === 'legendary') { screenFlash('#FFD34A'); vibrate([30, 30, 60]); }
  else if (m.rarity === 'epic') screenFlash('#B06CFF');
  Sound.muffle(false, 0.8);
}

function gameOver() {
  if (run.over) return;
  run.over = true;
  run.overAt = run.time;
  run.hp = 0;
  paused = true;
  const reached = run.wave;
  const prevBest = save.bestWave;
  const ch = Challenge.active ? Challenge.finish(reached) : null;
  if (!ch && reached > save.bestWave) save.bestWave = reached;
  persist();
  lastMode = ch ? 'challenge' : 'normal';
  $('go-challenge').classList.toggle('hidden', !ch);
  if (ch) {
    const g = ch.gained;
    $('go-challenge').innerHTML = `<b>🏆 Daily Challenge</b> · cleared ${ch.reached} wave${ch.reached === 1 ? '' : 's'}${ch.isBest ? ' · new best today!' : ''}
      ${g.tiers.length ? `<div class="ch-gain">Rewards: +${ICON_S}${fmt(g.dust)}${g.dm ? ` · +<span class="dm">◆</span>${g.dm}` : ''}</div>` : ''}`;
  }
  burst(0, 0, '#3FF2E0', 60, false);
  for (const o of run.orbitals) burst(o.x, o.y, ORBITALS[o.type].trail, 4, false);
  run.orbitals = [];
  const newRecord = renderRunSummary(!ch);
  $('go-wave').textContent = reached;
  $('go-kills').textContent = fmt(run.kills);
  $('go-stardust').innerHTML = '+' + ICON_S + fmt(run.stardust);
  // Rewarded ad: double the Stardust from this run (normal runs only)
  const dbl = $('go-double');
  $('go-stardust').classList.remove('pop');
  dbl.classList.toggle('hidden', !!ch || run.stardust < 1);
  dbl.disabled = false;
  dbl.innerHTML = `${Ads.noAds ? '' : '<span class="ad-tag">▶ AD</span> '}Double Stardust · +${ICON_S}${fmt(run.stardust)}`;
  // Stuck near the same wave? Point to the Supernova, the way past the wall
  const nova = ch ? 0 : Galaxy.darkMatterFor();
  $('go-nova').classList.toggle('hidden', !nova);
  if (nova) {
    const next = Galaxy.info(Galaxy.n + 1);
    $('go-nova').innerHTML = `🌟 <b>Supernova ready</b> · +<span class="dm">◆</span>${fmt(nova)} Dark Matter<small>Travel to ${next.name} and come back much stronger</small>`;
  }
  $('go-best').textContent = ch ?`Best today: wave ${Challenge.state().best}` : reached > prevBest ? '🏆 New best wave!' : `Best wave: ${save.bestWave}`;
  Sound.play('boom');
  Sound.play('kill_big');
  Sound.muffle(true, 1.5);
  setTimeout(() => {
    show('gameover');
    if (!ch) coach('observatory', 'Spend Stardust in the Observatory to become permanently stronger.', '#go-obs-btn', 'below');
    if ((!ch && reached > prevBest) || (ch && ch.gained.tiers.length) || newRecord) Sound.play('fanfare');
  }, 700);
}

// ---------- Run summary ----------
const DMG_PARTS = [
  ['core', 'Core', '#3FF2E0'], ['orbit', 'Moons', '#B06CFF'], ['pulse', 'Pulse', '#E9ECFF'],
  ['burn', 'Fire', '#FF8A2A'], ['other', 'Other', '#FFD34A'],
];
function renderRunSummary(trackRecords) {
  const r = run;
  const total = DMG_PARTS.reduce((s, [k]) => s + (r.dmg[k] || 0), 0);
  // Personal records (normal runs only; challenges have their own rules)
  if (!save.records) save.records = {};
  const rec = save.records, isNew = {};
  const check = (key, v) => { if (trackRecords && v > 0 && v > (rec[key] || 0)) { isNew[key] = rec[key] !== undefined; rec[key] = v; } };
  check('kills', r.kills); check('captures', r.captures); check('combo', r.bestCombo); check('damage', total); check('elites', r.elitesKilled);
  $('go-kills').parentElement.classList.toggle('record', !!isNew.kills); // kills live in the top stats row
  const mins = Math.floor(r.time / 60), secs = Math.floor(r.time % 60);
  const chip = (icon, label, value, key) =>
    `<div class="sum-chip ${isNew[key] ? 'record' : ''}"><span>${icon} ${label}</span><b>${value}</b>${isNew[key] ? '<i>NEW RECORD</i>' : ''}</div>`;
  let html = `<div class="sum-grid">
    ${chip('⏱', 'Time', `${mins}:${String(secs).padStart(2, '0')}`)}
    ${chip('🪐', 'Captured', fmt(r.captures), 'captures')}
    ${chip('🔥', 'Best combo', '×' + r.bestCombo, 'combo')}
    ${chip('👑', 'Elites', fmt(r.elitesKilled), 'elites')}
    ${chip('⬆️', 'Upgrades', fmt(r.upgradesBought))}
    ${chip('💥', 'Damage', fmt(total), 'damage')}
  </div>`;
  if (total > 0) {
    html += '<div class="dmg-bar">';
    for (const [k, , col] of DMG_PARTS) {
      const p = (r.dmg[k] || 0) / total * 100;
      if (p >= 0.5) html += `<div style="width:${p}%;background:${col}"></div>`;
    }
    html += '</div><div class="dmg-legend">';
    for (const [k, label, col] of DMG_PARTS) {
      const p = (r.dmg[k] || 0) / total * 100;
      if (p >= 0.5) html += `<span><i style="background:${col}"></i>${label} ${Math.round(p)}%</span>`;
    }
    html += '</div>';
  }
  const muts = MUTATIONS.filter(m => mc(m.id));
  if (muts.length) html += `<div class="sum-muts">${muts.map(m => mutIcon(m) + (mc(m.id) > 1 ? `<sub>×${mc(m.id)}</sub>` : '')).join('')}</div>`;
  $('go-summary').innerHTML = html;
  return Object.values(isNew).some(Boolean); // caller plays one fanfare for any new record
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
    if (r.invuln > 0) r.invuln -= dt;
    r.pulseCd = Math.max(0, r.pulseCd - dt);
    if (r.echoAt && r.time >= r.echoAt) { r.echoAt = 0; pulseBlast(true); }
    if (r.wave <= 4 && r.pulseCd <= 0 && !save.tips.h_pulse && !Challenge.has('noPulse')
        && r.enemies.some(e => Math.hypot(e.x, e.y) < 70)) coach('pulse', 'Tap your planet (or PULSE) to blast enemies back!', '#pulse-btn');
    // Constellation: Auto-Pulse
    if (Galaxy.has('autoPulse') && !(save.settings && save.settings.autoPulse === false) && r.pulseCd <= 0
        && r.enemies.some(e => Math.hypot(e.x, e.y) < 55)) usePulse();

    // Core fire
    r.fireAcc = Math.min(r.fireAcc + dt * stat('fireRate'), 3);
    let shots = 0;
    while (r.fireAcc >= 1 && shots < 4) {
      const a = fireFrom(0, 0, stat('range'), 1);
      if (a !== false && mc('twinCore')) fireFrom(0, 0, stat('range'), 1);
      if (a === false) { r.fireAcc = Math.min(r.fireAcc, 1); break; }
      r.aim = a;
      r.fireAcc -= 1;
      shots++;
    }
    // Binary star
    if (mc('binaryStar')) {
      r.starAcc += dt * stat('fireRate');
      if (r.starAcc >= 1) {
        const trinary = mc('trinaryStar');
        let fired = false;
        for (let k = 0; k < (trinary ? 2 : 1); k++) {
          const sp = binaryStarPos(k);
          if (fireFrom(sp.x, sp.y, 110, trinary ? 1 : 0.5) !== false) fired = true;
        }
        if (fired) r.starAcc -= 1; else r.starAcc = 1;
      }
    }
  }

  // Orbit layout
  r.spinBoost = Math.max(0, (r.spinBoost || 0) - dt);
  r.goldCount = 0;
  for (const o of r.orbitals) if (o.type === 'gold') r.goldCount++;
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
            damageEnemy(t, od * 0.8, false, false, 'orbit');
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
        damageEnemy(e, od * def.dmg * (e.ghost ? 0.5 : 1), false, false, 'orbit');
        // Thermal Shock: an enemy already chilled and burning erupts (at most once a second each)
        if (mc('thermalShock') && e.slow > 0 && e.burn > 0 && !(r.time - e.shockAt < 1)) { e.shockAt = r.time; thermalBlast(e.x, e.y, od); }
        if (def.slow || mc('frostbite')) e.slow = 1.5;
        if (def.burn || mc('kindling')) { e.burn = 3; e.burnDps = Math.max(e.burnDps, od * 0.4); }
        if (def.gold) { const g = (1 + 0.3 * r.wave) * 0.5; r.energy += g; }
        if (def.heal) r.hp = Math.min(stat('maxHp'), r.hp + stat('maxHp') * 0.01);
        if (!e.boss) e.kb += 25;
        hit = true;
        if (!def.pierce) break;
      }
      if (hit) {
        Sound.play('orb_' + o.type, { x: o.x });
        o.cd = 0.3;
        if (!(def.gold && mc('midasOrbit'))) o.hp -= def.pierce ? 0.5 : 1;
        if (o.hp <= 0) shatter(o);
      }
    }
  }

  // Enemies
  for (const e of r.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (e.elite === 'regen') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04 * dt);
    e.rot += dt * e.spinV;
    e.slow = Math.max(0, e.slow - dt);
    if (e.burn > 0) {
      e.burn -= dt;
      damageEnemy(e, e.burnDps * dt, false, true, 'burn');
      if (Math.random() < dt * 8) r.particles.push({ x: e.x + rand(-e.r, e.r), y: e.y + rand(-e.r, e.r), vx: 0, vy: -20, life: 0.4, max: 0.4, color: '#FF8A2A', size: 2, suck: false, delay: 0 });
      if (e.dead) continue;
    }
    const d = Math.hypot(e.x, e.y) || 1;
    if (e.kb > 0.5) {
      e.x += (e.x / d) * e.kb * dt;
      e.y += (e.y / d) * e.kb * dt;
      e.kb *= Math.exp(-4 * dt);
    } else e.kb = 0;
    // Blinkers teleport toward the planet every few seconds
    if (ENEMY_TYPES[e.type].blinks) {
      e.blinkT = (e.blinkT ?? rand(1.5, 2.5)) - dt;
      if (e.blinkT <= 0 && d > e.stopAt + 45) {
        e.blinkT = 2.6;
        burst(e.x, e.y, '#FF4FD8', 8, false);
        const jump = Math.min(55, d - e.stopAt - 15);
        e.x -= (e.x / d) * jump;
        e.y -= (e.y / d) * jump;
        burst(e.x, e.y, '#FF4FD8', 8, false);
      }
    }
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
      const s = h.s || 1;
      if (d < 95 * s && !e.boss) { e.x += dx / d * 70 * dt; e.y += dy / d * 70 * dt; }
      if (d < 40 * s + e.r) damageEnemy(e, stat('coreDamage') * 3 * dt, false, true);
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
        damageEnemy(e, b.dmg * (ENEMY_TYPES[e.type].shielded ? 0.35 : 1), b.crit, false, 'core');
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
  if (r.particles.length > GFX_PARTICLES[GFX]) r.particles.splice(0, r.particles.length - GFX_PARTICLES[GFX]);
  r.texts = r.texts.filter(t => t.life > 0);
  r.waves = r.waves.filter(w => w.t > 0);
  r.holes = r.holes.filter(h => h.t > 0);
  r.lasers = r.lasers.filter(l => l.t > 0);
  r.shake = Math.max(0, r.shake - dt * 20);
  r.hurt = Math.max(0, r.hurt - dt);
  r.wobble = Math.max(0, r.wobble - dt * 0.6);
}

// k = 1 is Trinary Star's second mini-star, on the opposite side
function binaryStarPos(k = 0) {
  const rad = ringRadius(ringCount() - 1) + 20;
  const a = -run.time * 0.7 + k * Math.PI;
  return { x: Math.cos(a) * rad, y: Math.sin(a) * rad };
}

// ============================================================
//  Render
// ============================================================
const ENEMY_COLORS = {
  drifter: '#FF5A4E', comet: '#8FD8FF', scout: '#FF3D7F', molten: '#FF8A2A', wraith: '#9B5CFF', worm: '#FF3B3B', mother: '#FF3D7F',
  sentinel: '#4AA8FF', blinker: '#FF4FD8', hive: '#7DFF8A', swarmer: '#7DFF8A', queen: '#FF7AE0',
};
// [size multiplier, rotation mode]: 'spin' = tumbles, 'face' = points at the planet, 'up' = stays upright
const SPRITE_DRAW = {
  drifter: [2.9, 'spin'], molten: [2.9, 'spin'], comet: [3.6, 'face'], scout: [3, 'face'], wraith: [3.2, 'up'],
  worm: [3.6, 'up'], mother: [2.9, 'up'], sentinel: [3, 'face'], blinker: [3.6, 'face'], hive: [2.9, 'spin'], swarmer: [3, 'spin'], queen: [3.2, 'up'],
};
function enemyColor(type) {
  return ENEMY_COLORS[type];
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

// Recolor a sprite (keeps its shading, swaps the hue): galaxy enemies and star moons reuse art this way
const tintCache = {};
function tintedSprite(name, color) {
  const key = name + color;
  if (tintCache[key]) return tintCache[key];
  const img = sprite(name);
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'color';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  return (tintCache[key] = c);
}

// While drawing the world, sprites set their transform directly (much cheaper than save/restore)
let worldK = 0, worldX = 0, worldY = 0;
function enemySprite(inf) {
  const own = sprite(inf.sprite);
  if (own && !(inf.tint && !inf.fallback)) return own;
  if (inf.fallback) return tintedSprite(inf.fallback, inf.tint);
  return inf.tint ? tintedSprite(inf.sprite, inf.tint) : own;
}

function drawSprite(img, x, y, size, rot) {
  if (worldK && ctx === mainCtx) {
    const cs = Math.cos(rot || 0) * worldK, sn = Math.sin(rot || 0) * worldK;
    ctx.setTransform(cs, sn, -sn, cs, worldX + x * worldK, worldY + y * worldK);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.setTransform(worldK, 0, 0, worldK, worldX, worldY);
    return;
  }
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

function drawOrbital(o, t, noGlow) {
  const def = ORBITALS[o.type];
  const fade = 0.45 + 0.55 * Math.max(0, o.hp / o.maxHp);
  // Trail (skipped on low graphics)
  const tr = o.trail;
  ctx.strokeStyle = def.trail;
  ctx.lineCap = 'round';
  for (let i = GFX === 0 ? tr.length : 2; i < tr.length; i += 2) {
    ctx.globalAlpha = (i / tr.length) * 0.5 * fade;
    ctx.lineWidth = (i / tr.length) * def.r * 1.2;
    ctx.beginPath(); ctx.moveTo(tr[i - 2], tr[i - 1]); ctx.lineTo(tr[i], tr[i + 1]); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (!noGlow) {
    ctx.globalCompositeOperation = 'lighter';
    glow(o.x, o.y, def.r * 3, def.trail, 0.4 * fade);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = fade;
  const img = o.type === 'star' ? tintedSprite('orb_gold', '#3FF2E0') : sprite('orb_' + o.type);
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

function drawEnemy(e, t, noGlow) {
  const col = enemyColor(e.type);
  if (!noGlow) {
    ctx.globalCompositeOperation = 'lighter';
    glow(e.x, e.y, e.r * (e.boss ? 2.6 : 2.2), col, e.boss ? 0.45 : 0.3);
    ctx.globalCompositeOperation = 'source-over';
  }
  const inf = ENEMY_INFO[e.type];
  const spr = enemySprite(inf);
  const face = Math.atan2(-e.y, -e.x);

  if (spr) {
    const [size, mode] = SPRITE_DRAW[e.type];
    const rot = mode === 'spin' ? e.rot : mode === 'face' ? face + Math.PI / 2 : 0;
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

  if (e.type === 'sentinel' && !SPRITES.enemy_sentinel) {
    // Shield arc facing the planet (the real sprite has its shield painted in)
    ctx.strokeStyle = 'rgba(143,216,255,0.85)';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, face - 1.1, face + 1.1); ctx.stroke();
  }
  if (e.slow > 0) {
    ctx.fillStyle = 'rgba(143,216,255,0.3)';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
  }
  if (e.elite) {
    ctx.strokeStyle = 'rgba(255,211,74,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 3, 0, TAU); ctx.stroke();
    const icon = sprite('elite_' + e.elite);
    if (icon) ctx.drawImage(icon, e.x - 6, e.y - e.r - 20, 12, 12);
    else {
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ELITE_TRAITS[e.elite].icon, e.x, e.y - e.r - 14);
    }
  }
  const q = run && run.queen;
  if (q && q !== e && !q.dead && Math.hypot(e.x - q.x, e.y - q.y) < QUEEN_AURA) {
    ctx.strokeStyle = 'rgba(255,122,224,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 2, 0, TAU); ctx.stroke();
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
  if (GFX >= 1) for (const s of twinkles) {
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
  worldK = DPR * SCALE; worldX = DPR * (W / 2 + sx); worldY = DPR * (H / 2 + sy);
  ctx.setTransform(worldK, 0, 0, worldK, worldX, worldY);

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
    const s = h.s || 1;
    glow(h.x, h.y, 60 * s, '#9B5CFF', 0.5 * a);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(201,168,255,${0.8 * a})`;
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.ellipse(h.x, h.y, (26 + k * 6) * s, (10 + k * 3) * s, tt * (1.5 + k * 0.4), 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(h.x, h.y, 14 * s, 0, TAU); ctx.fill();
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
  if (GFX >= 1) for (const b of r.eBullets) glow(b.x, b.y, 7, '#FF3D7F', 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#FFD0E0';
  for (const b of r.eBullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, TAU); ctx.fill(); }

  // Nebula Queen's shield aura
  if (r.queen && !r.queen.dead) {
    const q = r.queen;
    ctx.fillStyle = 'rgba(255,122,224,0.06)';
    ctx.strokeStyle = `rgba(255,122,224,${0.25 + 0.15 * Math.sin(tt * 3)})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(q.x, q.y, QUEEN_AURA, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
  }
  // All glows in one additive pass (switching blend mode per object is slow on phones)
  ctx.globalCompositeOperation = 'lighter';
  for (const e of r.enemies) {
    if (GFX >= 1 || e.boss) glow(e.x, e.y, e.r * (e.boss ? 2.6 : 2.2), enemyColor(e.type), e.boss ? 0.45 : 0.3);
  }
  if (GFX >= 2) {
    for (const o of r.orbitals) {
      const d = ORBITALS[o.type];
      glow(o.x, o.y, d.r * 3, d.trail, 0.4 * (0.45 + 0.55 * Math.max(0, o.hp / o.maxHp)));
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const e of r.enemies) drawEnemy(e, tt, true);
  for (const o of r.orbitals) drawOrbital(o, tt, true);

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
  if (GFX >= 1) for (const b of r.bullets) glow(b.x, b.y, b.crit ? 9 : 6, b.crit ? '#FFD34A' : '#3FF2E0', 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  for (const b of r.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, b.crit ? 2.2 : 1.6, 0, TAU); ctx.fill(); }

  // Planet
  if (!r.over) {
    const R = PLANET_R * (1 + Math.sin(tt * 30) * r.wobble * 0.3);
    if (r.shield > 0) {
      ctx.strokeStyle = `rgba(143,216,255,${0.35 + 0.25 * Math.sin(tt * 4)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, PLANET_R + 10, 0, TAU); ctx.stroke();
    }
    if (r.invuln > 0) { // Second Wind: golden shield while safe
      ctx.strokeStyle = `rgba(255,211,74,${Math.min(1, r.invuln) * (0.55 + 0.3 * Math.sin(tt * 12))})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, PLANET_R + 9, 0, TAU); ctx.stroke();
    }
    drawPlanet(0, 0, R, tt, r.hurt);
    // Pulse ready ring
    const cdMax = pulseCdMax();
    const p = 1 - r.pulseCd / cdMax;
    ctx.strokeStyle = p >= 1 ? `rgba(63,242,224,${0.5 + 0.3 * Math.sin(tt * 5)})` : 'rgba(63,242,224,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, PLANET_R + 5, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
  }

  // Binary star
  if (mc('binaryStar') && !r.over) {
    for (let k = 0; k < (mc('trinaryStar') ? 2 : 1); k++) {
      const sp = binaryStarPos(k);
      ctx.globalCompositeOperation = 'lighter';
      glow(sp.x, sp.y, 16, '#FFD34A', 0.7);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#FFF6C8';
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 4, 0, TAU); ctx.fill();
    }
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
      <div class="bottom"><div class="value"></div><div class="cost"></div></div>`;
    // Tap to buy once; press and hold to keep buying
    let holdT = null, held = false;
    const stopHold = () => { clearTimeout(holdT); holdT = null; };
    const repeat = delay => {
      holdT = setTimeout(() => {
        const before = run && run.lv[u.id];
        buyUpgrade(u, true);
        if (!run || run.lv[u.id] === before) { stopHold(); return; } // out of energy or maxed
        held = true;
        vibrate(8);
        repeat(Math.max(50, delay * 0.75)); // speeds up the longer you hold
      }, delay);
    };
    el.addEventListener('pointerdown', () => { held = false; stopHold(); repeat(350); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, stopHold);
    el.addEventListener('click', () => { if (held) { held = false; return; } buyUpgrade(u); });
    el.addEventListener('contextmenu', e => e.preventDefault()); // long-press menu on Android
    wrap.appendChild(el);
    cards[u.id] = { el, lvl: el.querySelector('.lvl'), value: el.querySelector('.value'), cost: el.querySelector('.cost') };
  }
}

// Whole-number prices, so cards never show "7.8"
const upCost = (u, l) => Math.ceil(u.cost(l));
function purchasePlan(u) {
  const lv = run.lv[u.id] || 0;
  const max = u.max ?? Infinity;
  const room = max - lv;
  if (room <= 0) return { n: 0, cost: 0, maxed: true };
  if (buyMode === 'max') {
    let n = 0, cost = 0;
    while (n < room && n < 500) {
      const c = upCost(u, lv + n);
      if (cost + c > run.energy) break;
      cost += c; n++;
    }
    if (n === 0) return { n: 1, cost: upCost(u, lv), maxed: false };
    return { n, cost, maxed: false };
  }
  const n = Math.min(Number(buyMode), room);
  let cost = 0;
  for (let i = 0; i < n; i++) cost += upCost(u, lv + i);
  return { n, cost, maxed: false };
}

let buyStreak = 0, lastBuyAt = 0, autoBuying = false;
function autoBuyStep() {
  let best = null, bc = Infinity;
  const mode = buyMode;
  buyMode = '1';
  for (const u of UPGRADES) {
    const p = purchasePlan(u);
    if (!p.maxed && p.cost <= run.energy && p.cost < bc) { bc = p.cost; best = u; }
  }
  if (best) { autoBuying = true; buyUpgrade(best); autoBuying = false; }
  buyMode = mode;
}
function buyUpgrade(u, holding = false) {
  if (!run || run.over || paused) return;
  const plan = purchasePlan(u);
  if (plan.maxed || plan.cost > run.energy) { if (!holding) Sound.play('denied'); return; }
  // Rapid purchases climb in pitch — a little "combo" reward for tapping
  const now = performance.now();
  buyStreak = now - lastBuyAt < 700 ? Math.min(buyStreak + 1, 10) : 0;
  lastBuyAt = now;
  if (!autoBuying) Sound.play('buy', { rate: 1 + buyStreak * 0.045 + (plan.n > 1 ? 0.1 : 0) });
  const oldMax = stat('maxHp');
  run.energy -= plan.cost;
  run.lv[u.id] = (run.lv[u.id] || 0) + plan.n;
  Progress.track('upgrades', plan.n);
  run.upgradesBought += plan.n;
  if (u.id === 'maxHp') run.hp += stat('maxHp') - oldMax;
  if (u.id === 'durability') {
    const d = stat('durability');
    for (const o of run.orbitals) { o.hp += d - o.maxHp; o.maxHp = d; }
  }
  refreshUpgradeCards();
}

// Writing the DOM 10x a second makes phones redo layout; skip writes that wouldn't change anything
function setText(el, v) { v = String(v); if (el._t !== v) { el._t = v; el.textContent = v; } }
function setHTML(el, v) { if (el._h !== v) { el._h = v; el.innerHTML = v; } }
function setWidth(el, pct) { const v = pct.toFixed(1) + '%'; if (el._w !== v) { el._w = v; el.style.width = v; } }

const tabEls = {};
document.querySelectorAll('.tab').forEach(t => { tabEls[t.dataset.tab] = t; });
function refreshUpgradeCards() {
  if (!run) return;
  const canBuy = {};
  for (const u of UPGRADES) {
    const c = cards[u.id];
    c.el.classList.toggle('hidden', u.tab !== activeTab);
    if (u.tab !== activeTab) {
      // A dot on the other tabs when something there is affordable
      if (!canBuy[u.tab]) { const p = purchasePlan(u); canBuy[u.tab] = !p.maxed && p.cost <= run.energy; }
      continue;
    }
    const lv = run.lv[u.id] || 0;
    const plan = purchasePlan(u);
    const cur = stat(u.id);
    setText(c.lvl, 'Lv ' + lv + (u.max ? '/' + u.max : ''));
    if (plan.maxed) {
      setHTML(c.value, `<b>${u.show(cur)}</b>`);
      setHTML(c.cost, 'MAX');
    } else {
      const saved = run.lv[u.id];
      run.lv[u.id] = lv + plan.n;
      const next = stat(u.id);
      run.lv[u.id] = saved;
      setHTML(c.value, `<b>${u.show(cur)}</b> → ${u.show(next)}`);
      setHTML(c.cost, ICON_E + fmt(plan.cost) + (plan.n > 1 ? `  (x${plan.n})` : ''));
    }
    const afford = !plan.maxed && plan.cost <= run.energy;
    if (afford && !save.tips.h_buy && !paused) coach('buy', 'You have Energy! Tap an upgrade to get stronger.', c.el);
    c.el.classList.toggle('afford', afford);
    c.el.classList.toggle('cant', !afford && !plan.maxed);
    c.el.classList.toggle('maxed', plan.maxed);
  }
  for (const id in tabEls) tabEls[id].classList.toggle('dot', id !== activeTab && !!canBuy[id]);
}

function refreshHud() {
  if (!run) return;
  setText($('hud-wave'), run.wave);
  setHTML($('hud-energy'), ICON_E + fmt(Math.floor(run.energy)));
  setHTML($('hud-stardust'), ICON_S + fmt(save.stardust));
  const maxHp = stat('maxHp');
  const frac = Math.max(0, run.hp) / maxHp;
  setWidth($('hp-fill'), frac * 100);
  $('hp-fill').classList.toggle('low', frac < 0.3);
  $('danger').classList.toggle('on', frac < 0.3 && !run.over);
  const boss = run.enemies.find(e => e.boss && !e.dead);
  $('boss-bar').classList.toggle('hidden', !boss);
  if (boss) {
    setText($('boss-name'), ENEMY_INFO[boss.type].name);
    setWidth($('boss-fill'), Math.max(0, boss.hp / boss.maxHp * 100));
  }
  setText($('hp-text'), `${fmt(Math.max(0, run.hp))} / ${fmt(maxHp)}`);
  setWidth($('wave-fill'), Math.min(100, run.waveTime / PACE.waveLen * 100));
  setText($('orbit-count'), `${run.orbitals.length}/${stat('slots')}`);
  const cdMax = pulseCdMax();
  const p = 1 - run.pulseCd / cdMax;
  const pb = $('pulse-btn');
  const pv = p.toFixed(3);
  if (pb._p !== pv) { pb._p = pv; pb.style.setProperty('--p', pv); }
  pb.classList.toggle('ready', p >= 1);
}

// One icon per mutation; stacks get a small count
function refreshMutStrip() {
  const icons = [];
  for (const m of MUTATIONS) { const n = mc(m.id); if (n) icons.push(mutIcon(m) + (n > 1 ? `<sub>${n}</sub>` : '')); }
  $('mut-strip').innerHTML = icons.join('');
}

// Pause screen: tap a mutation to read what it does
function renderMutList(el) {
  el.innerHTML = '';
  const info = document.createElement('p');
  info.className = 'mut-desc small';
  for (const m of MUTATIONS) {
    const n = mc(m.id);
    if (!n) continue;
    const pill = document.createElement('button');
    pill.className = 'mut-pill';
    pill.style.setProperty('--c', `var(--${m.rarity})`);
    pill.innerHTML = `${mutIcon(m)} ${m.name}${n > 1 ? ' x' + n : ''}`;
    pill.onclick = () => {
      el.querySelectorAll('.mut-pill').forEach(p => p.classList.toggle('sel', p === pill));
      info.textContent = m.desc;
    };
    el.appendChild(pill);
  }
  if (!el.children.length) { el.innerHTML = '<span class="muted">No mutations yet</span>'; return; }
  info.textContent = 'Tap a mutation to see what it does';
  el.appendChild(info);
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
  document.querySelectorAll('[data-obs]').forEach(b => b.classList.toggle('active', b.dataset.obs === tab));
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
    else if (s.exclusive) btn = '<button class="buy">🛒 Supporter Pack</button>';
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
      if (!owned && s.exclusive) { show('store'); return; }
      if (!owned) {
        if (!waveOk || save.stardust < s.cost) return;
        save.stardust -= s.cost;
        save.skins.push(s.id);
        Progress.max('skins', earnedSkins());
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
const offlineRate = () => (2 + save.bestWave * 1.5) * (1 + 0.25 * metaLv('sRelay')) * metaVal('sStardust') * Galaxy.dustMult(); // per hour
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
  const order = ['drifter', 'comet', 'scout', 'molten', 'wraith', 'sentinel', 'blinker', 'hive', 'worm', 'mother', 'queen'];
  const firstWave = { drifter: 1, worm: 10, mother: 20, queen: 30, sentinel: 6, blinker: 8, hive: 10 };
  for (const [type, from] of spawnOdds()) firstWave[type] = from;
  let html = '';
  for (const type of order) {
    const t = ENEMY_TYPES[type], info = ENEMY_INFO[type];
    const seen = save.seen && save.seen[type];
    if (!seen) {
      const where = info.galaxy && Galaxy.n < info.galaxy
        ? `Discovered in Galaxy ${info.galaxy}` : `Appears from wave ${firstWave[type]}`;
      html += `
        <div class="beast locked">
          <img src="assets/${beastSrc(info)}.png" alt="">
          <div class="bname">???<span class="bchance off">${where}</span></div>
          <div class="bdesc">Not encountered yet.</div>
        </div>`;
      continue;
    }
    let chance;
    if (t.boss) chance = `<span class="bchance off">${{ worm: 'Waves 10, 40, 70…', mother: 'Waves 20, 50, 80…', queen: 'Waves 30, 60, 90…' }[type]}</span>`;
    else chance = odds[type] > 0 ? `<span class="bchance">${Math.round(odds[type] * 100)}%</span>` : `<span class="bchance off">from wave ${firstWave[type]}</span>`;
    const hp = enemyHp(w) * t.hp, dmg = enemyDmg(w) * t.dmg;
    const dmgLabel = t.ranged ? (type === 'mother' ? 'Spawns' : 'Shot') : 'Dmg/s';
    const dmgVal = type === 'mother' ? 'scouts' : fmt(dmg);
    const moon = t.capture;
    html += `
      <div class="beast ${t.boss ? 'boss' : ''}">
        <img src="assets/${beastSrc(info)}.png" alt="" style="${info.css && !sprite(info.sprite) ? 'filter:' + info.css : ''}">
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
  // Elite traits
  html += save.seen && save.seen.elite
    ? `<div class="beast elites"><div class="bname">👑 Elites<span class="bchance off">from wave 20</span></div>
        <div class="bdesc">Bigger, ringed in gold, and worth 3× energy. Each has one trait:</div>
        <div class="etraits">${ELITE_LIST.map(k => `<div><b>${ELITE_TRAITS[k].icon} ${ELITE_TRAITS[k].name}</b><span>${ELITE_TRAITS[k].desc}</span></div>`).join('')}</div></div>`
    : `<div class="beast locked elites"><div class="bname">👑 ???<span class="bchance off">Appears from wave 20</span></div><div class="bdesc">Something stronger is coming.</div></div>`;
  // Fusions: the recipe is shown, the result stays a mystery until you draft it once
  const found = save.fusions || {};
  html += `<h3 class="bst-head">⚗️ Fusions · ${FUSIONS.filter(f => found[f.id]).length}/${FUSIONS.length}</h3>
    <p class="muted small bst-note">Own both mutations in one run and the fusion shows up in your next draft.</p>`;
  for (const f of FUSIONS) {
    const [a, b] = f.fusion.map(id => MUT[id]);
    html += found[f.id]
      ? `<div class="beast fusion"><div class="bico">${mutIcon(f)}</div><div class="bname">${f.name}</div>
          <div class="bdesc">${f.desc}<br><span class="muted">${a.name} + ${b.name}</span></div></div>`
      : `<div class="beast fusion locked"><div class="bico">${mutIcon(f)}</div><div class="bname">???</div>
          <div class="bdesc">${a.name} + ${b.name}</div></div>`;
  }
  $('bst-list').innerHTML = html;
}
// Use an enemy's own art when it exists, otherwise its recolored stand-in
const beastSrc = info => (sprite(info.sprite) || !info.fallback ? info.sprite : info.fallback);
$('bst-wave').addEventListener('input', renderBestiary);

// ============================================================
//  Home base
// ============================================================
function refreshLobby() {
  refreshInstallBanner();
  if ((save.galaxyBest || 0) >= Galaxy.PRESTIGE_MIN) coach('nova', 'Supernova unlocked! Travel to a new galaxy for big permanent power.', '#menu-galaxy-btn');
  else if (save.bestWave >= 8) coach('challenge', 'New every day: a Daily Challenge with special rules and rewards!', '#menu-challenge-btn');
  const cst = Challenge.state();
  $('challenge-tile-sub').textContent = cst.tiers.every(Boolean) ? 'All rewards claimed ✓'
    : cst.best ? `Best today: wave ${cst.best}` : Challenge.today().mods.map(id => Challenge.MODS.find(m => m.id === id).icon).join(' ') + ' · new today';
  const gi = Galaxy.info();
  $('lobby-galaxy').textContent = `Galaxy ${gi.n} · ${gi.name}`;
  $('lobby-galaxy').style.color = gi.tint || 'var(--friend)';
  const novaReady = Galaxy.darkMatterFor() > 0;
  $('menu-galaxy-btn').classList.toggle('ready', novaReady);
  $('galaxy-tile-sub').textContent = novaReady ? `Supernova ready · +◆${Galaxy.darkMatterFor()}`
    : (save.galaxyBest || 0) >= 1 ? `Supernova at wave ${Galaxy.PRESTIGE_MIN} · best ${save.galaxyBest}` : 'Constellations & new galaxies';
  const sk = skin();
  $('lobby-planet-name').textContent = sk.name;
  $('lobby-perk').textContent = sk.perk;
  const d = Progress.ensureDaily();
  const done = d.list.filter(m => m.progress >= m.target).length;
  const ready = d.list.some(m => m.progress >= m.target && !m.claimed) || (d.list.every(m => m.claimed) && !d.chestClaimed);
  $('lobby-daily-text').textContent = d.chestClaimed ? 'Daily missions complete ✓' : `Daily missions ${done}/${d.list.length}${ready ? ' · reward ready!' : ''}`;
  $('lobby-daily').classList.toggle('ready', ready);
}

const OVERLAYS = ['menu', 'pause', 'gameover', 'observatory', 'draft', 'howto', 'welcome', 'missions', 'bestiary', 'settings', 'galaxy', 'challenge', 'revive', 'store'];
function show(id) {
  clearCoach();
  for (const o of OVERLAYS) $(o).classList.toggle('hidden', o !== id);
  if (id === 'menu') {
    $('menu-best').textContent = save.bestWave;
    $('menu-stardust').innerHTML = ICON_S + fmt(save.stardust);
  }
  if (id === 'observatory') setObsTab(obsTab);
  if (id === 'missions') Progress.open();
  if (id === 'settings') { refreshGfxUi(); refreshSaveNote(); }
  // Screens that pop up mid-action ignore taps for a moment, so a tap meant for the game can't pick a card by accident
  if (id === 'draft' || id === 'gameover' || id === 'revive') {
    const el = $(id);
    el.classList.add('guard');
    clearTimeout(el._guard);
    el._guard = setTimeout(() => el.classList.remove('guard'), 450);
  }
  // Scrolling screens open at the top
  const modal = $(id).querySelector('.modal');
  if (modal) modal.scrollTop = 0;
  if (id === 'galaxy') Galaxy.render();
  if (id === 'challenge') Challenge.render();
  if (id === 'store') Store.render();
  if (id === 'menu') refreshLobby();
  if (id === 'bestiary') { const s = $('bst-wave'); s.max = Math.max(30, save.bestWave + 10); if (!s.dataset.touched) s.value = Math.max(1, save.bestWave); renderBestiary(); }
  if (id === 'menu' || id === 'gameover') Progress.refreshBadge();
  if (id === 'pause') { renderMutList($('pause-muts')); disarmQuit(); Sound.muffle(true); }
  if (id === 'menu' || id === 'observatory' || id === 'missions' || id === 'bestiary' || id === 'settings' || id === 'galaxy' || id === 'challenge' || id === 'store' || (id === 'howto' && !(run && !run.over))) {
    Sound.music('menu');
    Sound.muffle(false, 0.8);
  }
}
function hideAll() { for (const o of OVERLAYS) $(o).classList.add('hidden'); }

let lastMode = 'normal';
function startRun() {
  if (!save.tips.howto) { show('howto'); return; }
  Challenge.active = false;
  buildBackground();
  $('pulse-btn').classList.remove('hidden');
  newRun();
  hideAll();
  Sound.music('game');
  Sound.muffle(false, 0.6);
}
function startChallenge() {
  Challenge.start();
  buildBackground(); // challenges always use the home galaxy
  newRun();
  hideAll();
  Sound.music('game');
  Sound.muffle(false, 0.6);
  const mods = Challenge.today().mods.map(id => Challenge.MODS.find(m => m.id === id));
  if (Challenge.has('glass')) run.mut.glassCannon = 1;
  $('pulse-btn').classList.toggle('hidden', Challenge.has('noPulse'));
  if (Challenge.has('rich')) run.energy += 300;
  run.hp = stat('maxHp');
  refreshMutStrip();
  banner('DAILY CHALLENGE', mods.map(m => m.icon + ' ' + m.name).join(' · '), false);
}
$('howto-ok').onclick = () => {
  const first = !save.tips.howto;
  save.tips.howto = true;
  persist();
  if (first) startRun(); else show('menu');
};
$('menu-howto-btn').onclick = () => show('howto');
$('menu-planets-btn').onclick = () => { obsTab = 'planets'; show('observatory'); };
document.querySelectorAll('[data-obs]').forEach(b => { b.onclick = () => setObsTab(b.dataset.obs); });

$('play-btn').onclick = startRun;
$('retry-btn').onclick = () => (lastMode === 'challenge' ? startChallenge() : startRun());
$('menu-obs-btn').onclick = () => { obsTab = 'upgrades'; show('observatory'); };
$('go-obs-btn').onclick = () => { obsTab = 'upgrades'; show('observatory'); };
$('obs-close').onclick = () => show('menu');
$('menu-missions-btn').onclick = () => show('missions');
$('go-missions-btn').onclick = () => show('missions');
$('go-home-btn').onclick = () => show('menu');
$('go-nova').onclick = () => show('galaxy');
$('go-double').onclick = async () => {
  const btn = $('go-double');
  if (btn.disabled || !run || !run.over || run.doubled) return;
  btn.disabled = true;
  const ok = await Ads.rewarded('double_stardust');
  if (!ok) { btn.disabled = false; btn.textContent = 'Ad not available right now'; return; }
  run.doubled = true;
  const bonus = run.stardust;
  addStardust(bonus);
  persist();
  Progress.refreshBadge();
  const el = $('go-stardust');
  el.innerHTML = '+' + ICON_S + fmt(run.stardust);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  btn.innerHTML = `✓ Doubled · +${ICON_S}${fmt(bonus)} extra`;
  Sound.play('fanfare');
};
$('missions-close').onclick = () => show('menu');
$('menu-bestiary-btn').onclick = () => show('bestiary');
$('bst-close').onclick = () => show('menu');
$('lobby-daily').onclick = () => { show('missions'); Progress.setTab('daily'); };
$('bst-wave').addEventListener('pointerdown', () => { $('bst-wave').dataset.touched = 1; });
document.querySelectorAll('[data-mtab]').forEach(b => { b.onclick = () => Progress.setTab(b.dataset.mtab); });
$('reroll-btn').onclick = () => {
  if (!run || run.rerolls <= 0) return;
  run.rerolls--;
  draftOptions = rollDraft();
  renderDraft();
  Sound.play('reroll');
};

function pauseRun() {
  if (!run || run.over || run.drafting || paused) return;
  paused = true;
  show('pause');
}
function resumeRun() { paused = false; hideAll(); Sound.muffle(false); }
$('pause-btn').onclick = pauseRun;
$('mut-strip').onclick = pauseRun; // the pause screen explains each mutation
$('resume-btn').onclick = resumeRun;
// Ending a run takes two taps, so a stray tap can't throw it away
let quitArmed = null;
function disarmQuit() { clearTimeout(quitArmed); quitArmed = null; $('quit-btn').textContent = 'End run'; }
$('quit-btn').onclick = () => {
  if (!quitArmed) {
    $('quit-btn').textContent = 'Tap again to end the run';
    quitArmed = setTimeout(disarmQuit, 2500);
    return;
  }
  disarmQuit();
  hideAll(); paused = false; gameOver();
};

// Back (Android button, Esc key, or a tap outside a window): close the top screen
const BACK_TO_MENU = ['observatory', 'missions', 'bestiary', 'settings', 'galaxy', 'challenge', 'store'];
function goBack() {
  const open = OVERLAYS.find(o => !$(o).classList.contains('hidden'));
  if (open === 'pause') { resumeRun(); return true; }
  if (open === 'revive') { if (!run.watchingAd) declineRevive(); return true; }
  if (BACK_TO_MENU.includes(open) || (open === 'howto' && save.tips.howto)) { show('menu'); return true; }
  if (open === 'gameover') { show('menu'); return true; }
  if (!open && run && !run.over) { pauseRun(); return true; }
  return false; // menu, draft, welcome: nothing to go back to
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') goBack(); });
for (const id of [...BACK_TO_MENU, 'pause']) {
  $(id).addEventListener('click', e => { if (e.target === e.currentTarget) goBack(); });
}
// Android back button (Capacitor app only)
const CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
if (CapApp) CapApp.addListener('backButton', () => { if (!goBack()) CapApp.minimizeApp(); });

// Game speed is remembered between runs
gameSpeed = (save.settings && save.settings.speed) || 1;
$('speed-btn').textContent = gameSpeed + 'x';
$('speed-btn').onclick = () => {
  gameSpeed = gameSpeed >= 3 ? 1 : gameSpeed + 1;
  $('speed-btn').textContent = gameSpeed + 'x';
  $('speed-btn').classList.toggle('active', gameSpeed > 1);
  save.settings.speed = gameSpeed;
  persist();
};
$('speed-btn').classList.toggle('active', gameSpeed > 1);
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
// Volumes (0..1). Older saves used on/off switches: carry "off" over as volume 0
for (const [k, flag] of [['musicVol', 'music'], ['sfxVol', 'sfx']]) {
  if (save.settings[k] === undefined) save.settings[k] = save.settings[flag] === false ? 0 : 1;
  save.settings[flag] = true;
}
function refreshVolumeSliders() {
  document.querySelectorAll('.vol-slider').forEach(s => {
    const v = Math.round(save.settings[s.dataset.vol] * 100);
    s.value = v;
    s.parentElement.querySelector('.vol-val').textContent = v ? v + '%' : 'Off';
  });
}
let volSaveTimer = null;
document.querySelectorAll('.vol-slider').forEach(s => {
  s.addEventListener('input', () => {
    save.settings[s.dataset.vol] = Number(s.value) / 100;
    Sound.configure(save.settings);
    refreshVolumeSliders(); // keeps the pause and settings sliders in sync
    clearTimeout(volSaveTimer);
    volSaveTimer = setTimeout(persist, 300);
  });
  // Let the player hear the new sound level when they let go
  s.addEventListener('change', () => { if (s.dataset.vol === 'sfxVol') Sound.play('buy'); });
});
refreshVolumeSliders();
$('menu-settings-btn').onclick = () => show('settings');

// ---------- Graphics setting ----------
function refreshGfxUi() {
  const mode = save.settings.gfx || 'auto';
  document.querySelectorAll('[data-gfx]').forEach(b => b.classList.toggle('active', b.dataset.gfx === mode));
  $('gfx-note').textContent = mode === 'auto'
    ? `Adjusts to your phone automatically (now: ${GFX_NAMES[GFX]})`
    : mode === 'low' ? 'Fewer effects, smoother on older phones' : 'All effects, sharpest picture';
}
document.querySelectorAll('[data-gfx]').forEach(b => {
  b.onclick = () => {
    save.settings.gfx = b.dataset.gfx;
    setGfx(b.dataset.gfx === 'low' ? 0 : b.dataset.gfx === 'high' ? 2 : (save.settings.gfxAuto ?? 2));
    persist();
    refreshGfxUi();
  };
});

// ---------- Save codes: back up / move progress between devices ----------
// Format: GW1.<base64 of the save JSON>.<checksum>
function checksum(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function exportSave() {
  persist();
  const json = JSON.stringify(save);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const body = btoa(bin);
  return `GW1.${body}.${checksum(body)}`;
}
function parseSaveCode(code) {
  const parts = code.trim().replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== 'GW1') throw new Error("That doesn't look like a Gravity Well save code.");
  if (checksum(parts[1]) !== parts[2]) throw new Error('The code is incomplete or was changed. Copy it again.');
  const bin = atob(parts[1]);
  const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
  if (typeof data !== 'object' || data.bestWave === undefined) throw new Error('This save code is missing data.');
  return data;
}
function refreshSaveNote() {
  const t = save.lastBackup;
  $('save-note').textContent = t
    ? `Last backup: ${new Date(t).toLocaleDateString()}. Galaxy ${save.galaxy || 1}, best wave ${save.bestWave}.`
    : 'No backup yet. Copy your save code and keep it somewhere safe (notes, email).';
}
$('save-copy').onclick = async () => {
  const code = exportSave();
  let ok = false;
  try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { /* clipboard blocked */ }
  if (!ok) {
    // Fallback: show the code so it can be copied by hand
    $('save-load').classList.remove('hidden');
    $('save-input').value = code;
    $('save-input').select();
  }
  save.lastBackup = Date.now();
  persist();
  refreshSaveNote();
  $('save-copy').textContent = ok ? 'Copied ✓' : 'Select & copy ↓';
  setTimeout(() => { $('save-copy').textContent = 'Copy save code'; }, 2500);
};
$('save-download').onclick = () => {
  const blob = new Blob([exportSave()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gravity-well-save-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  save.lastBackup = Date.now();
  persist();
  refreshSaveNote();
};
$('save-load-toggle').onclick = () => $('save-load').classList.toggle('hidden');
let loadArmed = null;
$('save-load-btn').onclick = () => {
  const msg = $('save-msg');
  let data;
  try { data = parseSaveCode($('save-input').value); }
  catch (e) { msg.className = 'small err'; msg.textContent = e.message; return; }
  if (loadArmed !== $('save-input').value) {
    // Two taps: loading replaces everything on this device
    loadArmed = $('save-input').value;
    msg.className = 'small';
    msg.textContent = `Found: Galaxy ${data.galaxy || 1}, best wave ${data.bestWave}, ✦${fmt(data.stardust || 0)}. Tap "Load save" again to replace your current progress.`;
    return;
  }
  // Replace the in-memory save too, so the page doesn't write the old one back while reloading
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, defaultSave(), data);
  persist();
  msg.className = 'small ok';
  msg.textContent = 'Loaded! Restarting…';
  setTimeout(() => location.reload(), 600);
};

// Ask the browser to never auto-clear our storage (granted for installed/engaged apps)
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist().catch(() => {}); }).catch(() => {});
}

// ---------- Install nudge (installed apps keep their data) ----------
let installPrompt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; refreshInstallBanner(); });
function refreshInstallBanner() {
  const snoozed = save.tips.installSnooze && Date.now() < save.tips.installSnooze;
  const show = !isStandalone() && save.bestWave >= 5 && !snoozed && (installPrompt || isIOS);
  $('install-banner').classList.toggle('hidden', !show);
}
$('install-btn').onclick = async () => {
  if (installPrompt) {
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* ignore */ }
    installPrompt = null;
    refreshInstallBanner();
  } else {
    $('install-ios').classList.remove('hidden');
  }
};
$('install-x').onclick = () => {
  save.tips.installSnooze = Date.now() + 3 * 24 * 3600 * 1000; // ask again in 3 days
  persist();
  refreshInstallBanner();
};
$('menu-galaxy-btn').onclick = () => show('galaxy');
$('menu-challenge-btn').onclick = () => show('challenge');
$('challenge-close').onclick = () => show('menu');
$('challenge-start').onclick = () => { if (!save.tips.howto) { show('howto'); return; } startChallenge(); };
$('galaxy-close').onclick = () => { buildBackground(); show('menu'); };
$('auto-buy').onclick = () => {
  save.settings.autoBuy = !save.settings.autoBuy;
  $('auto-buy').classList.toggle('active', !!save.settings.autoBuy);
  persist();
};
$('auto-buy').classList.toggle('active', !!save.settings.autoBuy);
$('settings-close').onclick = () => show('menu');
$('menu-store-btn').onclick = () => show('store');
$('store-close').onclick = () => show('menu');
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
const fpsMon = { frames: 0, time: 0, good: 0, holdUntil: 0 };
function monitorFps(raw, now) {
  const mode = (save.settings && save.settings.gfx) || 'auto';
  if (mode !== 'auto') return;
  // Only judge real gameplay (menus and paused screens don't count)
  if (!run || paused || run.over || document.hidden || raw > 0.5) { fpsMon.frames = 0; fpsMon.time = 0; return; }
  fpsMon.frames++;
  fpsMon.time += raw;
  if (fpsMon.time < 3) return;
  const fps = fpsMon.frames / fpsMon.time;
  fpsMon.frames = 0; fpsMon.time = 0;
  if (fps < 45 && GFX > 0) {
    setGfx(GFX - 1);
    save.settings.gfxAuto = GFX;
    fpsMon.good = 0;
    fpsMon.holdUntil = now + 60000; // don't flip back up for a minute
  } else if (fps > 57 && now > fpsMon.holdUntil) {
    if (++fpsMon.good >= 4 && GFX < 2) { setGfx(GFX + 1); save.settings.gfxAuto = GFX; fpsMon.good = 0; }
  } else fpsMon.good = 0;
}

function frame(now) {
  const raw = (now - last) / 1000;
  monitorFps(raw, now);
  const dt = Math.min(0.1, raw);
  last = now;
  if (slowmoLeft > 0) { slowmoLeft -= dt; if (slowmoLeft <= 0) timeScale = 1; }
  // Battery: the game canvas is hidden behind the home screen, and frozen while paused,
  // so only draw it while something moves (plus a couple of frames to settle)
  const menuUp = !$('menu').classList.contains('hidden');
  const collapsing = run && run.over && run.time - run.overAt < 3;
  const moving = run && (!paused || collapsing);
  if (moving || menuUp) stillFrames = 0;
  if (run && !paused) {
    for (let i = 0; i < gameSpeed && !paused; i++) update(dt * timeScale);
  } else if (collapsing && !menuUp) {
    update(dt); // let the collapse play out
  }
  if (!menuUp && (moving || stillFrames++ < 2)) render(now);
  renderMenuPlanet(now);
  uiTimer -= dt;
  if (uiTimer <= 0) {
    uiTimer = 0.1;
    if (run && !paused && !run.over && Galaxy.has('autoBuy') && save.settings && save.settings.autoBuy) autoBuyStep();
    if (!menuUp) { refreshHud(); refreshUpgradeCards(); }
  }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
  // Heartbeat so offline time is measured even if the app is killed without a "hidden" event
  if (now - lastHeartbeat > 5000) { lastHeartbeat = now; markSeen(); }
  requestAnimationFrame(frame);
}
let lastHeartbeat = 0;

buildUpgradeCards();
equipSkin(save.skin);
GFX = save.settings.gfx === 'low' ? 0 : save.settings.gfx === 'high' ? 2 : (save.settings.gfxAuto ?? 2);
document.body.classList.toggle('gfx-low', GFX === 0);
Ads.setNoAds(save.noAds);
if (!save.galaxy) save.galaxy = 1;
if (save.galaxyBest === undefined) save.galaxyBest = save.bestWave || 0;
if (save.darkMatter === undefined) save.darkMatter = 0;
if (!save.cons) save.cons = {};
Progress.ensureDaily();
Progress.sync('wave', save.bestWave);
Progress.sync('skins', earnedSkins());
resize();
show('menu');
checkOffline();
requestAnimationFrame(frame);

// ---------- Offline play & installability ----------
// Only on the published site: locally it would serve stale cached files while editing
// Not inside the Android app: it ships its own files, and a cache there would only serve stale versions
const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
if ('serviceWorker' in navigator && location.protocol === 'https:' && !isNativeApp) {
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
