'use strict';

// ============================================================
//  GRAVITY WELL — Daily Challenge
//  One special run per day with three twists, the same for everyone.
//  Fair play: no Observatory, planet perks or Constellations apply.
//  Reaching waves 5 / 10 / 15 / 20 pays out once per day.
//  Loaded before game.js; uses game globals only at call time.
// ============================================================

const Challenge = (() => {
  // kind: 'boon' helps, 'curse' hurts, 'mixed' both — every day gets at least one boon/mixed
  const MODS = [
    { id: 'glass',    kind: 'mixed', icon: '🔮', name: 'Glass Cannon',   desc: 'Start with Glass Cannon: double damage, half health' },
    { id: 'rich',     kind: 'boon',  icon: '💰', name: 'War Chest',      desc: 'Start the run with ⚡300' },
    { id: 'goldRush', kind: 'boon',  icon: '🪙', name: 'Gold Rush',      desc: 'Golden moons are 20× more common' },
    { id: 'frenzy',   kind: 'boon',  icon: '🎴', name: 'Mutation Frenzy', desc: 'Draft a mutation after every wave' },
    { id: 'fragile',  kind: 'mixed', icon: '🧲', name: 'Strong Pull',    desc: '+30% capture chance, but moons last half as long' },
    { id: 'comets',   kind: 'curse', icon: '☄️', name: 'Comet Storm',    desc: 'Comets swarm twice as often' },
    { id: 'noPulse',  kind: 'curse', icon: '🚫', name: 'Silent Core',    desc: 'Gravity Pulse is disabled' },
    { id: 'swift',    kind: 'curse', icon: '💨', name: 'Hyperspeed',     desc: 'All enemies are 30% faster' },
    { id: 'elites',   kind: 'curse', icon: '👑', name: 'Elite Invasion', desc: 'Elite enemies appear from wave 5, and often' },
    { id: 'bossRush', kind: 'curse', icon: '🐉', name: 'Boss Rush',      desc: 'A boss every 5 waves' },
    { id: 'cramped',  kind: 'curse', icon: '📦', name: 'Cramped Orbit',  desc: 'You can hold at most 6 moons' },
  ];
  const MOD = Object.fromEntries(MODS.map(m => [m.id, m]));
  const TIERS = [5, 10, 15, 20];

  let active = false;
  let lastResult = null;

  const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function seeded(str) {
    let h = 2166136261;
    for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  }

  // Today's three twists: one boon/mixed + two others, seeded by the date
  function today() {
    const key = todayKey();
    const rnd = seeded('gw-challenge-' + key);
    const pick = list => list.splice(Math.floor(rnd() * list.length), 1)[0];
    const helpful = MODS.filter(m => m.kind !== 'curse');
    const first = pick(helpful);
    const rest = MODS.filter(m => m !== first);
    return { date: key, mods: [first, pick(rest), pick(rest)].map(m => m.id) };
  }

  function state() {
    const key = todayKey();
    if (!save.challenge || save.challenge.date !== key) save.challenge = { date: key, best: 0, tiers: [false, false, false, false], plays: 0 };
    return save.challenge;
  }

  const has = id => active && today().mods.includes(id);

  // Rewards scale with how far the player has come, so they stay meaningful
  function tierReward(i) {
    const dust = Math.round((15 + (save.bestWave || 0) * 1.5) * [1, 2, 4, 6][i]);
    const dm = [0, 0, 2, 6][i];
    return { dust, dm };
  }

  function start() {
    active = true;
    const st = state();
    st.plays++;
    persist();
  }

  // Called from gameOver(): pays out newly reached tiers, returns a summary
  function finish(wave) {
    const st = state();
    const reached = wave - 1; // waves fully cleared
    const isBest = reached > st.best;
    if (isBest) st.best = reached;
    const gained = { dust: 0, dm: 0, tiers: [] };
    TIERS.forEach((w, i) => {
      if (reached >= w && !st.tiers[i]) {
        st.tiers[i] = true;
        const r = tierReward(i);
        gained.dust += r.dust; gained.dm += r.dm; gained.tiers.push(w);
      }
    });
    save.stardust += gained.dust;
    if (gained.dm) { save.darkMatter = (save.darkMatter || 0) + gained.dm; save.dmEarned = (save.dmEarned || 0) + gained.dm; }
    if (reached >= 20) Progress.track('challenge20');
    Progress.track('challenges');
    active = false;
    persist();
    lastResult = { reached, isBest, gained };
    return lastResult;
  }

  function timeLeft() {
    const now = new Date(), next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const m = Math.ceil((next - now) / 60000);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }

  function render() {
    const el = document.getElementById('challenge-body');
    if (!el) return;
    const t = today(), st = state();
    const S = typeof ICON_S !== 'undefined' ? ICON_S : '✦';
    let html = `
      <p class="muted small">New challenge in ${timeLeft()} · same rules for everyone today</p>
      <div class="ch-mods">`;
    for (const id of t.mods) {
      const m = MOD[id];
      html += `<div class="ch-mod ${m.kind}"><div class="ch-icon">${m.icon}</div><div><b>${m.name}</b><div class="small">${m.desc}</div></div></div>`;
    }
    html += `</div>
      <p class="muted small">Fair play: Observatory upgrades, planet perks and Constellations don't apply.</p>
      <div class="ch-best">Your best today: <b>${st.best ? 'wave ' + st.best : '—'}</b>${st.plays ? ` <span class="muted small">(${st.plays} tr${st.plays === 1 ? 'y' : 'ies'})</span>` : ''}</div>
      <div class="ch-tiers">`;
    TIERS.forEach((w, i) => {
      const r = tierReward(i);
      html += `<div class="ch-tier ${st.tiers[i] ? 'done' : ''}"><span>Wave ${w}</span><b>${st.tiers[i] ? '✓' : `${S}${fmt(r.dust)}${r.dm ? ` <span class="dm">◆</span>${r.dm}` : ''}`}</b></div>`;
    });
    html += `</div>`;
    el.innerHTML = html;
  }

  return {
    MODS, TIERS, today, state, has, start, finish, render, tierReward,
    get active() { return active; },
    set active(v) { active = !!v; },
    get lastResult() { return lastResult; },
  };
})();
