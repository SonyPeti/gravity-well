'use strict';

// ============================================================
//  GRAVITY WELL — audio engine
//  Web Audio for SFX (pitch variance, voice limits, stereo pan,
//  bus compressor) + crossfading, filterable music.
// ============================================================

const Sound = (() => {
  // Each event: files (random pick), volume, pitch variance, min gap between plays, max simultaneous voices
  const EVENTS = {
    shot:        { files: ['shot_0', 'shot_1'], vol: 0.13, pv: 0.10, gap: 0.045, voices: 4 },
    crit:        { files: ['crit'], vol: 0.22, pv: 0.06, gap: 0.06, voices: 3 },
    drone:       { files: ['drone'], vol: 0.10, pv: 0.12, gap: 0.08, voices: 3 },
    enemy_shot:  { files: ['enemy_shot'], vol: 0.08, pv: 0.10, gap: 0.10, voices: 2, rate: 0.75 },
    hit:         { files: ['hit_0', 'hit_1'], vol: 0.10, pv: 0.15, gap: 0.05, voices: 3 },
    kill:        { files: ['kill_0', 'kill_1'], vol: 0.28, pv: 0.12, gap: 0.05, voices: 5 },
    kill_big:    { files: ['kill_big'], vol: 0.45, pv: 0.05, gap: 0.15, voices: 2 },
    boom:        { files: ['boom'], vol: 0.75, pv: 0.03, gap: 0.3, voices: 2 },
    orb_rock:    { files: ['orb_rock_0', 'orb_rock_1'], vol: 0.22, pv: 0.15, gap: 0.04, voices: 4 },
    orb_ice:     { files: ['orb_ice_0', 'orb_ice_1'], vol: 0.24, pv: 0.12, gap: 0.04, voices: 4, rate: 1.15 },
    orb_lava:    { files: ['orb_lava'], vol: 0.30, pv: 0.12, gap: 0.05, voices: 3 },
    orb_drone:   { files: ['orb_metal'], vol: 0.20, pv: 0.12, gap: 0.05, voices: 3 },
    orb_void:    { files: ['orb_void'], vol: 0.28, pv: 0.06, gap: 0.06, voices: 3, rate: 0.8 },
    orb_gold:    { files: ['orb_gold'], vol: 0.26, pv: 0.04, gap: 0.08, voices: 2, rate: 1.7 },
    shatter:     { files: ['shatter_0', 'shatter_1'], vol: 0.32, pv: 0.10, gap: 0.06, voices: 3 },
    capture:     { files: ['thwump'], vol: 0.35, pv: 0.10, gap: 0.06, voices: 3, rate: 1.2 },
    lock_in:     { files: ['ting'], vol: 0.20, pv: 0.05, gap: 0.05, voices: 3, rate: 1.5 },
    pulse:       { files: ['boom'], vol: 0.65, pv: 0.02, gap: 0.5, voices: 1, layer: 'pulse_hum' },
    pulse_hum:   { files: ['pulse_hum'], vol: 0.35, pv: 0.02, gap: 0.5, voices: 1, rate: 0.85 },
    planet_hit:  { files: ['planet_hit'], vol: 0.40, pv: 0.10, gap: 0.14, voices: 2 },
    boss_warn:   { files: ['rumble'], vol: 0.55, pv: 0, gap: 2, voices: 1, layer: 'alarm' },
    alarm:       { files: ['alarm'], vol: 0.30, pv: 0, gap: 2, voices: 1, rate: 0.9 },
    wave_clear:  { files: ['wave_clear'], vol: 0.35, pv: 0, gap: 0.5, voices: 1 },
    fanfare:     { files: ['fanfare'], vol: 0.45, pv: 0, gap: 0.5, voices: 1 },
    draft_open:  { files: ['draft_open'], vol: 0.40, pv: 0, gap: 0.3, voices: 1 },
    card_pick:   { files: ['card_pick'], vol: 0.45, pv: 0, gap: 0.3, voices: 1 },
    reroll:      { files: ['reroll'], vol: 0.40, pv: 0.05, gap: 0.1, voices: 1 },
    buy:         { files: ['buy'], vol: 0.30, pv: 0, gap: 0.03, voices: 3 },
    denied:      { files: ['denied'], vol: 0.25, pv: 0, gap: 0.15, voices: 1 },
    click:       { files: ['click'], vol: 0.30, pv: 0.05, gap: 0.03, voices: 2 },
    equip:       { files: ['equip'], vol: 0.45, pv: 0, gap: 0.2, voices: 1 },
    hole:        { files: ['hole'], vol: 0.55, pv: 0, gap: 0.5, voices: 1, rate: 0.55 },
  };
  const FILES = [...new Set(Object.values(EVENTS).flatMap(e => e.files))];

  let ctx = null, master, sfxBus, musicBus, musicFilter;
  const buffers = {};
  const lastPlay = {};
  const active = {};
  const settings = { sfx: true, music: true };

  // ---------- Setup (must happen inside a user gesture on mobile) ----------
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);

    // SFX bus with a gentle compressor so stacked hits never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    sfxBus = ctx.createGain();
    sfxBus.connect(comp);
    comp.connect(master);

    // Music bus with a low-pass for the "muffled" effect
    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 20000;
    musicFilter.Q.value = 0.7;
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    musicFilter.connect(musicBus);
    musicBus.connect(master);

    applySettings();
    for (const name of FILES) {
      fetch(`assets/sfx/${name}.wav`)
        .then(r => r.arrayBuffer())
        .then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
        .then(buf => { buffers[name] = buf; })
        .catch(() => {});
    }
    Music.attach();
  }

  // ---------- Playback ----------
  function play(event, opts = {}) {
    if (!ctx || !settings.sfx) return;
    const ev = EVENTS[event];
    if (!ev) return;
    const now = ctx.currentTime;
    if (now - (lastPlay[event] || -1) < ev.gap) return;
    if ((active[event] || 0) >= ev.voices) return;
    const name = ev.files[(Math.random() * ev.files.length) | 0];
    const buf = buffers[name];
    if (!buf) return;
    lastPlay[event] = now;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const rate = (ev.rate || 1) * (opts.rate || 1) * (1 + (Math.random() * 2 - 1) * ev.pv);
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = ev.vol * (opts.vol ?? 1);
    let node = src.connect(g);
    if (ctx.createStereoPanner && opts.x !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-0.8, Math.min(0.8, opts.x / 160));
      node = node.connect(p);
    }
    node.connect(sfxBus);
    active[event] = (active[event] || 0) + 1;
    src.onended = () => { active[event]--; };
    src.start(now + (opts.delay || 0));
    if (ev.layer) play(ev.layer, opts);
  }

  // ---------- Music: two <audio> elements per track, crossfaded at the loop point ----------
  const Music = (() => {
    const TRACKS = { menu: 'assets/music/menu.mp3', game: 'assets/music/game.mp3' };
    const XFADE = 2.5;
    const players = {};      // track -> { els: [a, b], gains: [g, g], cur: 0 }
    let current = null;
    let attached = false;

    function make(track) {
      const els = [new Audio(TRACKS[track]), new Audio(TRACKS[track])];
      const gains = els.map(el => {
        el.preload = 'auto';
        el.crossOrigin = 'anonymous';
        const g = ctx.createGain();
        g.gain.value = 0;
        ctx.createMediaElementSource(el).connect(g);
        g.connect(musicFilter);
        return g;
      });
      return { els, gains, cur: 0, level: 0 };
    }

    function attach() {
      if (attached) return;
      attached = true;
      for (const t of Object.keys(TRACKS)) players[t] = make(t);
      setInterval(tick, 250);
      if (current) { const want = current; current = null; set(want); }
    }

    function fadeTo(gain, value, time) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(value, now + time);
    }

    // Start the other element of the pair just before the current one ends, and crossfade
    function tick() {
      if (!current) return;
      const p = players[current];
      const el = p.els[p.cur];
      if (!el.duration || el.paused) return;
      if (el.duration - el.currentTime < XFADE) {
        const next = 1 - p.cur;
        const nel = p.els[next];
        nel.currentTime = 0;
        nel.play().catch(() => {});
        fadeTo(p.gains[next], 1, XFADE);
        fadeTo(p.gains[p.cur], 0, XFADE);
        const old = p.cur;
        p.cur = next;
        setTimeout(() => { p.els[old].pause(); }, XFADE * 1000 + 100);
      }
    }

    function set(track, fade = 1.5) {
      if (track === current) return;
      const prev = current;
      current = track;
      if (!attached) return;
      if (prev && players[prev]) {
        const p = players[prev];
        p.gains.forEach(g => fadeTo(g, 0, fade));
        setTimeout(() => { if (current !== prev) p.els.forEach(el => el.pause()); }, fade * 1000 + 100);
      }
      if (track && players[track]) {
        const p = players[track];
        const el = p.els[p.cur];
        if (el.paused) { el.currentTime = 0; }
        el.play().catch(() => {});
        fadeTo(p.gains[p.cur], 1, fade);
      }
    }

    const state = () => Object.fromEntries(Object.entries(players).map(([k, p]) =>
      [k, p.els.map((el, i) => `${el.paused ? 'paused' : 'playing'}@${el.currentTime.toFixed(1)}s gain=${p.gains[i].gain.value.toFixed(2)}`)]));
    // Debug: jump near the end of the current track to test the loop crossfade
    const seekToEnd = (secondsLeft = 4) => {
      const p = players[current];
      if (p) { const el = p.els[p.cur]; el.currentTime = Math.max(0, el.duration - secondsLeft); }
    };
    return { attach, set, state, seekToEnd, get current() { return current; } };
  })();

  // Muffle the music (pause menu, mutation draft, game over)
  function muffle(on, time = 0.4) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const f = musicFilter.frequency;
    f.cancelScheduledValues(now);
    f.setValueAtTime(f.value, now);
    f.exponentialRampToValueAtTime(on ? 650 : 20000, now + time);
  }

  function applySettings() {
    if (!ctx) return;
    const now = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(settings.sfx ? 1 : 0, now, 0.05);
    musicBus.gain.setTargetAtTime(settings.music ? 0.55 : 0, now, 0.1);
  }

  // Hard mute (e.g. while an ad plays), independent of the player's settings
  function mute(on) {
    if (!ctx) return;
    master.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.05);
  }

  function configure(s) {
    Object.assign(settings, s);
    applySettings();
  }

  // Pause everything while the app is in the background
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return {
    init, play, muffle, configure, mute,
    music: track => Music.set(track),
    _seekToEnd: s => Music.seekToEnd(s),
    get ready() { return !!ctx; },
    get debug() {
      return { state: ctx && ctx.state, loaded: Object.keys(buffers).length, total: FILES.length,
               music: Music.current, players: Music.state(), filter: musicFilter && Math.round(musicFilter.frequency.value), active: { ...active } };
    },
  };
})();
