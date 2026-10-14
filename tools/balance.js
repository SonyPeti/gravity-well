// Dev-only balance harness: plays runs at full speed inside the game page and reports how far they get.
// Usage (browser console on the game page):
//   await import('./tools/balance.js?' + Date.now()).then(m => m.compare())
// A bot buys the cheapest upgrade, picks random mutations and (optionally) uses Gravity Pulse when enemies get close.
// Starts from whatever the current save has (fresh browser = no Observatory upgrades).

const DT = 1 / 60;

// 'focus' bot: buys the upgrade with the lowest cost × weight (lower weight = higher priority), closer to how people play
const FOCUS = { coreDamage: 1, fireRate: 1, maxHp: 1, orbitDamage: 1.2, slots: 1.1, regen: 1.3, durability: 1.6,
  capture: 1.6, energyKill: 1.5, range: 2, spin: 2.2, critChance: 2, critMult: 2.5, waveBonus: 2.5 };
function focusBuy() {
  let best = null, bs = Infinity;
  const mode = buyMode;
  buyMode = '1';
  for (const u of UPGRADES) {
    const p = purchasePlan(u);
    const score = p.cost * (FOCUS[u.id] || 2);
    if (!p.maxed && p.cost <= run.energy && score < bs) { bs = score; best = u; }
  }
  if (best) { autoBuying = true; buyUpgrade(best); autoBuying = false; }
  buyMode = mode;
  return !!best;
}

// pulse: 'off' | 'smart' (fire when an enemy is close) | 'spam' (fire whenever ready)
// muts: mutations granted at the start, e.g. { chainPulse: 1, echoPulse: 1 }
export function simRun({ pulse = 'smart', muts = {}, bot = 'focus', maxWave = 60, maxMinutes = 40 } = {}) {
  if (!W || !H) { W = 375; H = 440; SCALE = Math.min(W, H) / 300; } // hidden tab: assume a phone-sized stage
  Challenge.active = false;
  newRun();
  hideAll();
  paused = false;
  run.revived = true; // the bot never watches the revive ad
  Object.assign(run.mut, muts);
  const pulseDmg0 = () => run.dmg.pulse || 0;
  let pulses = 0, buyT = 0;
  const steps = maxMinutes * 60 * 60;
  for (let i = 0; i < steps && !run.over && run.wave < maxWave; i++) {
    if (run.drafting) {
      // random pick, but never re-pick a forced build mutation's "slot" weirdly: just take a random card
      pickMutation(draftOptions[Math.floor(Math.random() * draftOptions.length)]);
    }
    if (paused) { paused = false; hideAll(); } // tutorial hints
    if ((buyT -= DT) <= 0) { buyT = 0.1; for (let k = 0; k < 5; k++) bot === 'focus' ? focusBuy() : autoBuyStep(); }
    if (pulse !== 'off' && run.pulseCd <= 0) {
      const close = pulse === 'spam' || run.enemies.some(e => !e.dead && Math.hypot(e.x, e.y) < 60);
      if (close) { usePulse(); pulses++; }
    }
    update(DT);
  }
  const total = Object.values(run.dmg).reduce((a, b) => a + b, 0) || 1;
  return { wave: run.wave, minutes: +(run.time / 60).toFixed(1), pulses, pulseShare: Math.round(pulseDmg0() / total * 100) };
}

export function batch(opts, n = 6) {
  const res = [];
  for (let i = 0; i < n; i++) res.push(simRun(opts));
  const waves = res.map(r => r.wave).sort((a, b) => a - b);
  const avg = waves.reduce((a, b) => a + b, 0) / n;
  return { avg: +avg.toFixed(1), min: waves[0], max: waves[n - 1], waves: waves.join(' '),
    pulseDmg: Math.round(res.reduce((a, r) => a + r.pulseShare, 0) / n) + '%' };
}

export function compare(n = 6) {
  Sound.play = () => {};
  const out = {
    'no pulse': batch({ pulse: 'off' }, n),
    'pulse': batch({ pulse: 'smart' }, n),
    'pulse + Chain': batch({ pulse: 'smart', muts: { chainPulse: 1 } }, n),
    'pulse + Chain + Echo': batch({ pulse: 'smart', muts: { chainPulse: 1, echoPulse: 1 } }, n),
  };
  console.table(out);
  return out;
}

// ---------- Long-term progression (Observatory → Supernova → Constellations) ----------
// Plays from a fresh save until `hours` of game time or `maxGalaxy`, then restores the real save.
// Results land in window.__prog (poll it; the page stays responsive between runs):
//   import('./tools/balance.js?' + Date.now()).then(m => m.progression({ hours: 8 }))
const OBS_WEIGHT = { sCore: 1, sHull: 1, sOrbit: 1.2, sEnergy: 1.1, sStart: 1.4, sStardust: 1.3, sMoons: 1.5,
  sCapture: 1.6, sReroll: 1.5, sRelay: 99 };
const CONS_ORDER = ['shield', 'headStart', 'echoPulse', 'fourth', 'starMoon', 'twinCore', 'darkHarvest']; // unlocks worth having
const STALL_RUNS = 4; // go supernova after this many runs without a new galaxy best (once wave 25 is reached)

function spendStardust() {
  for (;;) {
    let best = null, bs = Infinity;
    for (const m of META) {
      const lv = save.meta[m.id] || 0;
      if (m.max !== undefined && lv >= m.max) continue;
      const c = m.cost(lv), score = c * (OBS_WEIGHT[m.id] || 2);
      if (c <= save.stardust && score < bs) { bs = score; best = m; }
    }
    if (!best) return;
    save.stardust -= best.cost(save.meta[best.id] || 0);
    save.meta[best.id] = (save.meta[best.id] || 0) + 1;
  }
}

function spendDarkMatter() {
  const NODES = Galaxy.NODES;
  const lv = id => (save.cons && save.cons[id]) || 0;
  const cost = id => NODES.find(n => n.id === id).cost(lv(id));
  for (;;) {
    // Alternate the cheap power nodes with the next useful unlock, cheapest first
    const options = ['dmCore', 'dmHull', 'dmDust', 'warp', ...CONS_ORDER.filter(id => !lv(id))]
      .filter(id => { const n = NODES.find(x => x.id === id); return n && (n.max === undefined || lv(id) < n.max); });
    let best = null, bc = Infinity;
    for (const id of options) { const c = cost(id) * (id === 'dmDust' ? 1.5 : 1); if (c < bc) { bc = c; best = id; } }
    if (!best || cost(best) > (save.darkMatter || 0)) return;
    save.darkMatter -= cost(best);
    if (!save.cons) save.cons = {};
    save.cons[best] = lv(best) + 1;
  }
}

export async function progression({ hours = 8, maxGalaxy = 7 } = {}) {
  const backup = localStorage.getItem(SAVE_KEY);
  window.persist = () => {}; // no storage writes while simulating (or after: see finally)
  Sound.play = () => {};
  const keep = { tips: save.tips, settings: save.settings };
  for (const k of Object.keys(save)) delete save[k];
  Object.assign(save, defaultSave(), keep, { galaxy: 1, galaxyBest: 0, darkMatter: 0, dmEarned: 0, cons: {} });

  const out = window.__prog = { done: false, galaxies: [], log: [], runs: [] }; // runs: [hours, galaxy, wave]
  let gStats = null, playSec = 0, stall = 0;
  const newGalaxy = () => { gStats = { galaxy: save.galaxy, best: 0, runs: 0, hours: 0, dm: 0 }; out.galaxies.push(gStats); stall = 0; };
  newGalaxy();
  try {
    while (playSec < hours * 3600 && save.galaxy <= maxGalaxy) {
      await new Promise(r => setTimeout(r, 0));
      const before = save.galaxyBest || 0;
      simRun({ pulse: 'smart', maxWave: 200, maxMinutes: 60 });
      if (!run.over) gameOver(); // hit the time cap: count it as a finished run
      playSec += run.time;
      const boss = run.enemies.find(e => e.boss && !e.dead);
      out.runs.push([+(playSec / 3600).toFixed(2), save.galaxy, run.wave, boss ? boss.type : '-', run.enemies.length]);
      gStats.runs++;
      gStats.hours = +(gStats.hours + run.time / 3600).toFixed(2);
      gStats.best = save.galaxyBest || 0;
      stall = save.galaxyBest > before ? 0 : stall + 1;
      spendStardust();
      if (save.galaxyBest >= 25 && stall >= STALL_RUNS) {
        const gain = Galaxy.darkMatterFor();
        gStats.dm = gain;
        out.log.push(`G${save.galaxy}: supernova at best ${save.galaxyBest} after ${gStats.runs} runs, +${gain} DM`);
        save.darkMatter = (save.darkMatter || 0) + gain;
        save.dmEarned = (save.dmEarned || 0) + gain;
        save.galaxy++;
        save.galaxyBest = 0;
        save.stardust = 0;
        save.meta = {};
        spendDarkMatter();
        newGalaxy();
      }
      out.hours = +(playSec / 3600).toFixed(2);
    }
  } finally {
    // persist stays stubbed: the in-memory save is still the simulated one, and the 5s heartbeat
    // would otherwise write it over the real save. Reload the page to play again.
    if (backup === null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, backup);
    out.done = true;
  }
  return out;
}
