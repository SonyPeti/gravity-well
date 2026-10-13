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
