'use strict';

// ============================================================
//  GRAVITY WELL — daily missions & achievements
//  The game reports what happens via Progress.track()/max();
//  this file turns that into missions, achievements and rewards.
//  Loaded before game.js; uses game globals (save, run, Sound...) only at call time.
// ============================================================

const Progress = (() => {
  // ---------- Daily mission templates ----------
  // target(best) scales with the player's best wave; mode 'sum' adds up over the day, 'max' is a best-in-one-run
  const roundTo = (v, step) => Math.max(step, Math.round(v / step) * step);
  const TEMPLATES = [
    { id: 'kills',      stat: 'kills',      text: n => `Destroy ${n} enemies`,            target: b => roundTo(120 + b * 12, 10) },
    { id: 'captures',   stat: 'captures',   text: n => `Capture ${n} moons`,              target: b => roundTo(20 + b * 2.5, 5) },
    { id: 'wave',       stat: 'wave',       text: n => `Reach wave ${n}`,                 target: b => Math.max(5, Math.round(b * 0.85)), mode: 'max' },
    { id: 'pulses',     stat: 'pulses',     text: n => `Use Gravity Pulse ${n} times`,    target: () => 10 },
    { id: 'mutations',  stat: 'mutations',  text: n => `Draft ${n} mutations`,            target: b => Math.max(4, Math.min(12, Math.round(b / 3))) },
    { id: 'boss',       stat: 'bosses',     text: n => n > 1 ? `Defeat ${n} bosses` : 'Defeat a boss', target: b => (b >= 25 ? 2 : 1), minBest: 10 },
    { id: 'runs',       stat: 'runs',       text: n => `Play ${n} runs`,                  target: () => 3 },
    { id: 'upgrades',   stat: 'upgrades',   text: n => `Buy ${n} upgrades`,               target: b => roundTo(40 + b * 3, 10) },
    { id: 'cap_ice',    stat: 'cap_ice',    text: n => `Capture ${n} ice moons`,          target: b => roundTo(8 + b * 0.6, 2), minBest: 4 },
    { id: 'cap_lava',   stat: 'cap_lava',   text: n => `Capture ${n} lava moons`,         target: b => roundTo(5 + b * 0.4, 1), minBest: 9 },
    { id: 'cap_drone',  stat: 'cap_drone',  text: n => `Capture ${n} drones`,             target: b => roundTo(5 + b * 0.4, 1), minBest: 7 },
  ];
  const TPL = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));
  const missionReward = () => Math.round(10 + (save.bestWave || 0) * 1.5);

  // ---------- Achievements ----------
  // stat: lifetime counter (sum) or best value (max); img: existing sprite used as the badge
  const ACHIEVEMENTS = [
    { id: 'cap1',     name: 'First Catch',       desc: 'Capture your first moon',           stat: 'captures',  target: 1,     reward: 5,   img: 'orb_rock' },
    { id: 'cap100',   name: 'Moon Collector',    desc: 'Capture 100 moons',                 stat: 'captures',  target: 100,   reward: 25,  img: 'orb_ice' },
    { id: 'cap1000',  name: 'Gravity Lord',      desc: 'Capture 1,000 moons',               stat: 'captures',  target: 1000,  reward: 100, img: 'mut_magnet' },
    { id: 'kill500',  name: 'Destroyer',         desc: 'Destroy 500 enemies',               stat: 'kills',     target: 500,   reward: 20,  img: 'enemy_drifter' },
    { id: 'kill5k',   name: 'Annihilator',       desc: 'Destroy 5,000 enemies',             stat: 'kills',     target: 5000,  reward: 80,  img: 'enemy_molten' },
    { id: 'kill50k',  name: 'World Ender',       desc: 'Destroy 50,000 enemies',            stat: 'kills',     target: 50000, reward: 300, img: 'mut_heavyCore' },
    { id: 'wave10',   name: 'Survivor',          desc: 'Reach wave 10',                     stat: 'wave',      target: 10,    reward: 15,  img: 'planet' },
    { id: 'wave20',   name: 'Veteran',           desc: 'Reach wave 20',                     stat: 'wave',      target: 20,    reward: 40,  img: 'mut_wideOrbit' },
    { id: 'wave30',   name: 'Legend',            desc: 'Reach wave 30',                     stat: 'wave',      target: 30,    reward: 100, img: 'mut_outerHalo' },
    { id: 'wave50',   name: 'Immortal',          desc: 'Reach wave 50',                     stat: 'wave',      target: 50,    reward: 300, img: 'mut_goldenTouch' },
    { id: 'worm',     name: 'Serpent Slayer',    desc: 'Defeat the World Eater',            stat: 'worm',      target: 1,     reward: 30,  img: 'boss_worm' },
    { id: 'mother',   name: 'Mothership Down',   desc: 'Defeat the Mothership',             stat: 'mother',    target: 1,     reward: 40,  img: 'boss_mothership' },
    { id: 'golden',   name: 'Golden Age',        desc: 'Capture a golden moon',             stat: 'cap_gold',  target: 1,     reward: 25,  img: 'orb_gold' },
    { id: 'legend',   name: 'Chosen One',        desc: 'Draft a legendary mutation',        stat: 'legendary', target: 1,     reward: 30,  img: 'mut_blackHole' },
    { id: 'mutant',   name: 'Mutant',            desc: 'Hold 8 mutations in one run',       stat: 'runMutations', target: 8,  reward: 40,  img: 'mut_glassCannon' },
    { id: 'orbit20',  name: 'Full Orbit',        desc: 'Have 20 moons orbiting at once',    stat: 'maxOrbit',  target: 20,    reward: 40,  img: 'upg_slots' },
    { id: 'pulse100', name: 'Pulse Master',      desc: 'Use Gravity Pulse 100 times',       stat: 'pulses',    target: 100,   reward: 30,  img: 'mut_chainPulse' },
    { id: 'flawless', name: 'Untouchable',       desc: 'Clear 5 waves in a row without taking damage', stat: 'flawless', target: 5, reward: 50, img: 'upg_durability' },
    { id: 'skins',    name: 'Planet Collector',  desc: 'Own all 6 planets',                 stat: 'skins',     target: 6,     reward: 150, img: 'skin_crystal' },
    { id: 'daily1',   name: 'Daily Routine',     desc: 'Complete all daily missions once',  stat: 'dailySets', target: 1,     reward: 15,  img: 'icon_stardust' },
    { id: 'daily7',   name: 'Dedicated',         desc: 'Complete all daily missions 7 times', stat: 'dailySets', target: 7,   reward: 100, img: 'mut_binaryStar' },
  ];

  // ---------- State helpers ----------
  const stats = () => (save.stats || (save.stats = {}));
  const ach = () => (save.ach || (save.ach = {}));
  const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Small seeded RNG so everyone gets the same missions on the same day
  function seeded(str) {
    let h = 2166136261;
    for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  }

  function ensureDaily() {
    const key = todayKey();
    if (save.daily && save.daily.date === key) return save.daily;
    const best = save.bestWave || 0;
    const rnd = seeded('gw-' + key);
    const pool = TEMPLATES.filter(t => best >= (t.minBest || 0));
    const list = [];
    while (list.length < 3 && pool.length) {
      const t = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      list.push({ tid: t.id, target: t.target(best), progress: 0, claimed: false });
    }
    save.daily = { date: key, list, reward: missionReward(), chestClaimed: false, announced: {} };
    return save.daily;
  }

  // ---------- Tracking ----------
  function bumpDaily(stat, value, isMax) {
    const d = ensureDaily();
    for (const m of d.list) {
      const t = TPL[m.tid];
      if (t.stat !== stat || m.progress >= m.target) continue;
      m.progress = isMax || t.mode === 'max' ? Math.max(m.progress, value) : m.progress + value;
      if (m.progress >= m.target && !d.announced[m.tid]) {
        d.announced[m.tid] = true;
        notify(`✅ Mission complete: ${t.text(m.target)}`);
      }
    }
  }

  function track(stat, n = 1) {
    const s = stats();
    s[stat] = (s[stat] || 0) + n;
    bumpDaily(stat, n, false);
    checkAchievements();
  }

  function max(stat, value) {
    const s = stats();
    if (value > (s[stat] || 0)) s[stat] = value;
    bumpDaily(stat, value, true);
    checkAchievements();
  }

  // Bring a lifetime stat up to date without counting it toward today's missions (used at startup)
  function sync(stat, value) {
    const s = stats();
    if (value > (s[stat] || 0)) s[stat] = value;
    checkAchievements();
  }

  function checkAchievements() {
    const s = stats(), a = ach();
    for (const x of ACHIEVEMENTS) {
      if (a[x.id] || (s[x.stat] || 0) < x.target) continue;
      a[x.id] = 'done';
      notify(`🏆 Achievement: ${x.name}`, true);
      persist();
    }
  }

  function notify(msg, big) {
    if (typeof toast === 'function') toast(msg);
    if (typeof Sound !== 'undefined') Sound.play(big ? 'fanfare' : 'wave_clear');
    refreshBadge();
  }

  // ---------- Claiming ----------
  function claimable() {
    const d = ensureDaily();
    let n = d.list.filter(m => m.progress >= m.target && !m.claimed).length;
    if (d.list.every(m => m.claimed) && !d.chestClaimed) n++;
    n += ACHIEVEMENTS.filter(x => ach()[x.id] === 'done').length;
    return n;
  }

  function grant(amount) {
    save.stardust += amount;
    persist();
    if (typeof Sound !== 'undefined') Sound.play('buy', { rate: 1.2 });
  }

  function claimMission(i) {
    const m = ensureDaily().list[i];
    if (!m || m.claimed || m.progress < m.target) return;
    m.claimed = true;
    grant(save.daily.reward);
    render();
  }

  function claimChest() {
    const d = ensureDaily();
    if (d.chestClaimed || !d.list.every(m => m.claimed)) return;
    d.chestClaimed = true;
    grant(d.reward * 2);
    if (typeof Sound !== 'undefined') Sound.play('fanfare');
    track('dailySets');
    render();
  }

  function claimAchievement(id) {
    const x = ACHIEVEMENTS.find(a => a.id === id);
    if (!x || ach()[id] !== 'done') return;
    ach()[id] = 'claimed';
    grant(x.reward);
    render();
  }

  // ---------- UI ----------
  let tab = 'daily';
  const S = () => (typeof ICON_S !== 'undefined' ? ICON_S : '✦');

  function timeToMidnight() {
    const now = new Date(), next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const m = Math.ceil((next - now) / 60000);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }

  function bar(p, t) {
    const pct = Math.min(100, (p / t) * 100);
    return `<div class="pbar"><div style="width:${pct}%"></div><span>${fmt(Math.min(p, t))} / ${fmt(t)}</span></div>`;
  }

  function renderDaily(el) {
    const d = ensureDaily();
    let html = `<p class="muted small">New missions in ${timeToMidnight()}</p>`;
    d.list.forEach((m, i) => {
      const t = TPL[m.tid], done = m.progress >= m.target;
      html += `
        <div class="mission ${m.claimed ? 'claimed' : done ? 'ready' : ''}">
          <div class="minfo">
            <div class="mtext">${t.text(m.target)}</div>
            ${bar(m.progress, m.target)}
          </div>
          <button data-claim="${i}" ${done && !m.claimed ? '' : 'disabled'}>${m.claimed ? '✓' : S() + d.reward}</button>
        </div>`;
    });
    const all = d.list.every(m => m.claimed);
    html += `
      <div class="chest ${d.chestClaimed ? 'claimed' : all ? 'ready' : ''}">
        <div class="chest-ico">🎁</div>
        <div class="minfo"><div class="mtext">Complete all 3 missions</div><div class="muted small">Bonus chest</div></div>
        <button data-chest ${all && !d.chestClaimed ? '' : 'disabled'}>${d.chestClaimed ? '✓' : S() + d.reward * 2}</button>
      </div>`;
    el.innerHTML = html;
    el.querySelectorAll('[data-claim]').forEach(b => { b.onclick = () => claimMission(Number(b.dataset.claim)); });
    const c = el.querySelector('[data-chest]');
    if (c) c.onclick = claimChest;
  }

  function renderAchievements(el) {
    const s = stats(), a = ach();
    const done = ACHIEVEMENTS.filter(x => a[x.id]).length;
    let html = `<p class="muted small">${done} / ${ACHIEVEMENTS.length} unlocked</p>`;
    // Ready-to-claim first, then in progress, then finished
    const order = x => (a[x.id] === 'done' ? 0 : a[x.id] ? 2 : 1);
    for (const x of [...ACHIEVEMENTS].sort((p, q) => order(p) - order(q))) {
      const state = a[x.id];
      const p = s[x.stat] || 0;
      html += `
        <div class="achv ${state || 'locked'}">
          <img src="assets/${x.img}.png" alt="">
          <div class="minfo">
            <div class="mtext">${x.name}</div>
            <div class="muted small">${x.desc}</div>
            ${state ? '' : bar(p, x.target)}
          </div>
          <button data-ach="${x.id}" ${state === 'done' ? '' : 'disabled'}>${state === 'claimed' ? '✓' : S() + x.reward}</button>
        </div>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-ach]').forEach(b => { b.onclick = () => claimAchievement(b.dataset.ach); });
  }

  function render() {
    const el = document.getElementById('missions-list');
    if (!el) return;
    document.querySelectorAll('[data-mtab]').forEach(b => b.classList.toggle('active', b.dataset.mtab === tab));
    const st = document.getElementById('missions-stardust');
    if (st) st.innerHTML = S() + fmt(save.stardust);
    if (tab === 'daily') renderDaily(el); else renderAchievements(el);
    refreshBadge();
  }

  function setTab(t) { tab = t; render(); }

  function refreshBadge() {
    const n = claimable();
    document.querySelectorAll('.claim-badge').forEach(b => {
      b.textContent = n;
      b.classList.toggle('hidden', n === 0);
    });
  }

  return { track, max, sync, ensureDaily, render, setTab, refreshBadge, claimable, TEMPLATES, ACHIEVEMENTS };
})();
