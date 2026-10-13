'use strict';

// ============================================================
//  GRAVITY WELL — galaxies (prestige) & constellations
//  Reaching wave 25 lets the planet go supernova: Stardust and the
//  Observatory reset, Dark Matter is earned, and the next galaxy brings
//  a new twist and a new enemy. Dark Matter buys Constellation nodes:
//  permanent power and brand-new mechanics.
//  Loaded before game.js; uses game globals only at call time.
// ============================================================

const Galaxy = (() => {
  const PRESTIGE_MIN = 25;
  const DM_POWER = 0.02;

  const GALAXIES = [
    { name: 'Home Cluster',  tint: null,      desc: 'Where it all began.' },
    { name: 'Frozen Reach',  tint: '#4AA8FF', desc: 'Comets swarm twice as often.',       enemy: 'sentinel', mod: 'cometX2' },
    { name: 'Ember Expanse', tint: '#FF6A2A', desc: 'Molten rocks appear from wave 4.',   enemy: 'blinker',  mod: 'earlyMolten' },
    { name: 'Void Rift',     tint: '#9B5CFF', desc: 'Void Wraiths appear from wave 8.',   enemy: 'hive',     mod: 'earlyWraith' },
  ];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  // ---------- Constellation nodes ----------
  // kind 'power' = endless levels; 'unlock' = one-time new mechanic
  const NODES = [
    { id: 'dmCore',  kind: 'power',  icon: 'mut_heavyCore',   name: 'Dark Core',       desc: l => `×${Math.pow(1.25, l).toFixed(2)} all damage`,     cost: l => Math.ceil(5 * Math.pow(1.45, l)) },
    { id: 'dmHull',  kind: 'power',  icon: 'upg_maxHp',       name: 'Dark Crust',      desc: l => `×${Math.pow(1.25, l).toFixed(2)} max health`,     cost: l => Math.ceil(5 * Math.pow(1.45, l)) },
    { id: 'dmDust',  kind: 'power',  icon: 'icon_stardust',   name: 'Stardust Siphon', desc: l => `+${25 * l}% Stardust (also offline)`,      cost: l => Math.ceil(8 * Math.pow(1.55, l)) },
    { id: 'warp',    kind: 'power',  icon: 'mut_rapidCore',   name: 'Warp Drive',      max: 6,
      desc: l => (l ? `Skip up to ${5 * l} early waves (max half your best here)` : 'Skip the early waves'), cost: l => [10, 20, 40, 75, 130, 220][l] },
    { id: 'autoBuy',   kind: 'unlock', icon: 'upg_slots',      name: 'Auto-Buy',        text: 'A toggle that buys the cheapest upgrade for you',   cost: () => 15 },
    { id: 'autoPulse', kind: 'unlock', icon: 'ui_pulse',       name: 'Auto-Pulse',      text: 'Gravity Pulse fires by itself when enemies get close', cost: () => 20 },
    { id: 'darkHarvest', kind: 'unlock', icon: 'icon_stardust', name: 'Mutation: Dark Harvest', text: 'Adds it to the draft: kills can drop Stardust',  cost: () => 15 },
    { id: 'echoPulse', kind: 'unlock', icon: 'mut_chainPulse', name: 'Mutation: Echo Pulse',   text: 'Adds it to the draft: every Pulse fires twice',    cost: () => 25 },
    { id: 'headStart', kind: 'unlock', icon: 'mut_binaryStar', name: 'Head Start',      text: 'Draft a free mutation at the start of every run',    cost: () => 30 },
    { id: 'starMoon',  kind: 'unlock', icon: 'orb_gold',       name: 'Star Moons',      text: '8% of captures become Star moons that heal you',     cost: () => 30, tint: '#3FF2E0' },
    { id: 'shield',    kind: 'unlock', icon: 'upg_durability', name: 'Wave Shield',     text: 'A shield worth 15% health at the start of every wave', cost: () => 35 },
    { id: 'fourth',    kind: 'unlock', icon: 'mut_glassCannon', name: 'Fourth Card',    text: 'Mutation drafts show 4 cards instead of 3',          cost: () => 40 },
    { id: 'twinCore',  kind: 'unlock', icon: 'upg_fireRate',   name: 'Mutation: Twin Core',    text: 'Adds it to the draft: your core fires two shots',  cost: () => 50 },
  ];
  const NODE = Object.fromEntries(NODES.map(n => [n.id, n]));

  // ---------- State ----------
  // During a Daily Challenge everyone plays on equal terms: home galaxy, no Constellations, no dark power
  const fair = () => typeof Challenge !== 'undefined' && Challenge.active;
  const g = () => (fair() ? 1 : save.galaxy || 1);
  const lv = id => (fair() ? 0 : (save.cons && save.cons[id]) || 0);
  const has = id => lv(id) > 0;

  function info(n = g()) {
    if (n <= GALAXIES.length) return { ...GALAXIES[n - 1], n };
    // Deep Space: every twist and every new enemy, colors cycling
    const cyc = GALAXIES[1 + ((n - 5) % 3)];
    return { name: `Deep Space ${ROMAN[(n - 5) % 10]}${n > 14 ? '+' : ''}`, tint: cyc.tint,
             desc: 'Every twist at once. Enemies grow tougher with each galaxy.', n, deep: true };
  }

  // Twists active in the current galaxy
  function mod(name) {
    const n = g();
    if (n >= 5) return true;
    return GALAXIES[n - 1].mod === name;
  }

  // New enemy types unlocked so far (cumulative), with their spawn chance and first wave
  const EXTRA = { sentinel: [6, 0.10], blinker: [8, 0.10], hive: [10, 0.07] };
  function extraEnemies() {
    const out = [];
    for (let i = 1; i < Math.min(g(), 4); i++) out.push(GALAXIES[i].enemy);
    return out;
  }
  function extraSpawn(w) {
    for (const type of extraEnemies()) {
      const [from, chance] = EXTRA[type];
      if (w >= from && Math.random() < chance) return type;
    }
    return null;
  }
  function extraChances(w) {
    const res = {};
    let left = 1;
    for (const type of extraEnemies()) {
      const [from, chance] = EXTRA[type];
      res[type] = w >= from ? left * chance : 0;
      left -= res[type];
    }
    return { res, left };
  }

  // ---------- Multipliers used by game.js ----------
  // Every Dark Matter ever earned gives +2% damage & health (spending it doesn't remove this)
  const darkPower = () => (fair() ? 1 : 1 + DM_POWER * (save.dmEarned || 0));
  const dmgMult = () => Math.pow(1.25, lv('dmCore')) * darkPower();
  const hpMult = () => Math.pow(1.25, lv('dmHull')) * darkPower();
  const dustMult = () => 1 + 0.25 * lv('dmDust');
  const enemyHpMult = () => 1 + 0.12 * (g() - 1);
  const warpWave = () => Math.max(1, Math.min(1 + 5 * lv('warp'), Math.floor((save.galaxyBest || 0) / 2)));

  // ---------- Supernova ----------
  function darkMatterFor(best = save.galaxyBest || 0, n = g()) {
    if (best < PRESTIGE_MIN) return 0;
    // Grows with how far you got, and ×1.3 per galaxy so every supernova feels bigger than the last
    return Math.floor(Math.pow(best - 15, 1.6) / 4 * Math.pow(1.3, n - 1));
  }

  let armed = false, armTimer = null;
  function supernova() {
    const gain = darkMatterFor();
    if (!gain) return;
    if (!armed) {
      // Two-tap confirm: this resets the Observatory
      armed = true;
      render();
      clearTimeout(armTimer);
      armTimer = setTimeout(() => { armed = false; render(); }, 4000);
      return;
    }
    armed = false;
    save.darkMatter = (save.darkMatter || 0) + gain;
    save.dmEarned = (save.dmEarned || 0) + gain;
    save.galaxy = g() + 1;
    save.galaxyBest = 0;
    save.stardust = 0;
    save.meta = {};
    persist();
    Progress.track('supernovas');
    Progress.max('galaxy', save.galaxy);
    if (typeof buildBackground === 'function') buildBackground();
    if (typeof Sound !== 'undefined') { Sound.play('boom'); Sound.play('fanfare'); }
    if (typeof vibrate === 'function') vibrate([80, 60, 200]);
    const fl = document.getElementById('nova-flash');
    if (fl) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); }
    render();
  }

  function buy(id) {
    const n = NODE[id];
    const l = lv(id);
    if (n.kind === 'unlock' && l >= 1) return;
    if (n.max !== undefined && l >= n.max) return;
    const c = n.cost(l);
    if ((save.darkMatter || 0) < c) return;
    save.darkMatter -= c;
    if (!save.cons) save.cons = {};
    save.cons[id] = l + 1;
    persist();
    if (typeof Sound !== 'undefined') Sound.play(n.kind === 'unlock' ? 'fanfare' : 'buy');
    render();
  }

  // ---------- UI ----------
  const DM = '<span class="dm">◆</span>';
  function render() {
    const el = document.getElementById('galaxy-body');
    if (!el) return;
    const gi = info();
    const best = save.galaxyBest || 0;
    const gain = darkMatterFor();
    const next = info(g() + 1);
    let html = `
      <div class="gal-head" style="--gt:${gi.tint || '#3FF2E0'}">
        <div class="gal-num">GALAXY ${gi.n}</div>
        <div class="gal-name">${gi.name}</div>
        <div class="muted small">${gi.desc}</div>
        <div class="gal-stats">
          <div><span class="label">Best wave here</span><b>${best}</b></div>
          <div><span class="label">Dark Matter</span><b>${DM}${fmt(save.darkMatter || 0)}</b></div>
        </div>
        <div class="dark-power">Dark power: <b>+${Math.round((darkPower() - 1) * 100)}%</b> damage &amp; health <span class="muted">(+${DM_POWER * 100}% per ◆ ever earned)</span>
        </div>
      </div>
      <div class="nova-box ${gain ? 'ready' : ''}">
        <div class="nova-title">🌟 Supernova</div>
        <p class="small">Reset Stardust &amp; Observatory, keep everything else, and travel to
          <b style="color:${next.tint || '#3FF2E0'}">${next.name}</b>${next.deep ? '' : (GALAXIES[next.n - 1] && GALAXIES[next.n - 1].enemy ? ` · new enemy: <b>${ENEMY_INFO[GALAXIES[next.n - 1].enemy].name}</b>` : '')}.</p>
        <button id="nova-btn" class="btn ${gain ? 'gold' : ''}" ${gain ? '' : 'disabled'}>
          ${gain ? (armed ? `Tap again to go supernova` : `Go Supernova · +${DM}${fmt(gain)}`) : `Reach wave ${PRESTIGE_MIN} here (best: ${best})`}
        </button>
        ${gain ? '' : `<p class="muted small">At wave ${PRESTIGE_MIN} you'd earn ${DM}${darkMatterFor(PRESTIGE_MIN)}; at wave 35, ${DM}${darkMatterFor(35)}.</p>`}
      </div>
      <h3 class="cons-title">✨ Constellations</h3>`;
    for (const n of NODES) {
      const l = lv(n.id);
      const done = (n.kind === 'unlock' && l >= 1) || (n.max !== undefined && l >= n.max);
      const c = done ? 0 : n.cost(l);
      const afford = !done && (save.darkMatter || 0) >= c;
      const desc = n.kind === 'unlock' ? n.text : `${n.desc(l)}${done ? '' : ` → <span class="next">${n.desc(l + 1)}</span>`}`;
      html += `
        <div class="node ${n.kind} ${done ? 'done' : ''} ${l ? 'owned' : ''}">
          <img src="assets/${n.icon}.png" alt="" ${n.tint ? `style="filter:hue-rotate(150deg) saturate(1.3)"` : ''}>
          <div class="minfo">
            <div class="mtext">${n.name}${n.kind === 'power' && l ? ` <span class="muted small">Lv ${l}</span>` : ''}</div>
            <div class="small ndesc">${desc}</div>
          </div>
          <button data-node="${n.id}" ${afford ? '' : 'disabled'}>${done ? '✓' : DM + fmt(c)}</button>
        </div>`;
    }
    el.innerHTML = html;
    const nb = document.getElementById('nova-btn');
    if (nb) nb.onclick = supernova;
    el.querySelectorAll('[data-node]').forEach(b => { b.onclick = () => buy(b.dataset.node); });
  }

  return {
    PRESTIGE_MIN, NODES, info, mod, has, lv, extraSpawn, extraChances, extraEnemies,
    dmgMult, hpMult, dustMult, darkPower, supernova, buy, enemyHpMult, warpWave, darkMatterFor, render,
    get n() { return g(); },
  };
})();
