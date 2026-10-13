// Builds the game's audio from the downloaded CC0 packs (see art/downloads/CREDITS.md).
// Trims, fades, converts SFX to small mono WAVs and loudness-normalizes the music.
// Usage: node tools/build-audio.js <path-to-ffmpeg.exe>
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FFMPEG = process.argv[2] || 'ffmpeg';
const ROOT = path.join(__dirname, '..');
const DL = path.join(ROOT, 'art', 'downloads');
const SCIFI = path.join(DL, 'kenney_sci-fi-sounds', 'Audio');
const IMPACT = path.join(DL, 'kenney_impact-sounds', 'Audio');
const UI = path.join(DL, 'kenney_interface-sounds', 'Audio');
const SFX_OUT = path.join(ROOT, 'assets', 'sfx');
const MUSIC_OUT = path.join(ROOT, 'assets', 'music');

// name: [source dir, file, max seconds, fade-out seconds]
const SFX = {
  shot_0:      [SCIFI, 'laserSmall_000.ogg', 0.24, 0.08],
  shot_1:      [SCIFI, 'laserSmall_003.ogg', 0.28, 0.08],
  crit:        [SCIFI, 'laserSmall_004.ogg', 0.40, 0.12],
  drone:       [SCIFI, 'laserRetro_004.ogg', 0.26, 0.08],
  enemy_shot:  [SCIFI, 'laserRetro_001.ogg', 0.23, 0.08],
  hit_0:       [IMPACT, 'impactGeneric_light_001.ogg', 0.12, 0.04],
  hit_1:       [IMPACT, 'impactGeneric_light_003.ogg', 0.12, 0.04],
  kill_0:      [SCIFI, 'explosionCrunch_000.ogg', 0.6, 0.25],
  kill_1:      [SCIFI, 'explosionCrunch_002.ogg', 0.7, 0.3],
  kill_big:    [SCIFI, 'explosionCrunch_004.ogg', 1.6, 0.6],
  boom:        [SCIFI, 'lowFrequency_explosion_000.ogg', 2.0, 0.8],
  boom_short:  [SCIFI, 'lowFrequency_explosion_001.ogg', 1.0, 0.4],
  orb_rock_0:  [IMPACT, 'impactMining_000.ogg', 0.35, 0.15],
  orb_rock_1:  [IMPACT, 'impactMining_004.ogg', 0.35, 0.15],
  orb_ice_0:   [IMPACT, 'impactGlass_light_001.ogg', 0.2, 0.06],
  orb_ice_1:   [IMPACT, 'impactGlass_light_002.ogg', 0.2, 0.06],
  orb_lava:    [IMPACT, 'impactSoft_heavy_002.ogg', 0.4, 0.15],
  orb_metal:   [IMPACT, 'impactPlate_light_002.ogg', 0.35, 0.15],
  orb_void:    [IMPACT, 'impactBell_heavy_004.ogg', 0.28, 0.1],
  orb_gold:    [IMPACT, 'impactBell_heavy_003.ogg', 0.65, 0.3],
  shatter_0:   [IMPACT, 'impactGlass_medium_000.ogg', 0.54, 0.2],
  shatter_1:   [IMPACT, 'impactGlass_medium_003.ogg', 0.54, 0.2],
  thwump:      [IMPACT, 'impactSoft_heavy_000.ogg', 0.4, 0.15],
  ting:        [UI, 'glass_003.ogg', 0.12, 0.05],
  pulse_hum:   [SCIFI, 'forceField_002.ogg', 0.95, 0.4],
  planet_hit:  [IMPACT, 'impactPunch_heavy_002.ogg', 0.44, 0.15],
  rumble:      [SCIFI, 'spaceEngineLow_003.ogg', 2.6, 1.2],
  alarm:       [UI, 'error_005.ogg', 0.49, 0.1],
  wave_clear:  [UI, 'confirmation_001.ogg', 0.28, 0.08],
  fanfare:     [UI, 'confirmation_002.ogg', 0.53, 0.15],
  draft_open:  [UI, 'maximize_008.ogg', 0.21, 0.05],
  card_pick:   [UI, 'confirmation_004.ogg', 0.49, 0.15],
  reroll:      [UI, 'maximize_009.ogg', 0.21, 0.05],
  buy:         [UI, 'select_005.ogg', 0.37, 0.1],
  denied:      [UI, 'error_004.ogg', 0.1, 0.03],
  click:       [UI, 'click_002.ogg', 0.1, 0.02],
  equip:       [UI, 'maximize_006.ogg', 0.37, 0.1],
  hole:        [SCIFI, 'forceField_000.ogg', 0.95, 0.4],
};

const MUSIC = {
  menu: [path.join(DL, 'outer_space_2.mp3')],
  game: [path.join(DL, 'cosmic_navigation_loop.flac')],
};

function ff(args) { execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' }); }

fs.mkdirSync(SFX_OUT, { recursive: true });
fs.mkdirSync(MUSIC_OUT, { recursive: true });

let total = 0;
for (const [name, [dir, file, maxLen, fade]] of Object.entries(SFX)) {
  const out = path.join(SFX_OUT, name + '.wav');
  // Strip leading silence so sounds land exactly on the frame they're triggered
  const filter = [
    'silenceremove=start_periods=1:start_threshold=-50dB',
    `atrim=end=${maxLen}`,
    `afade=t=out:st=${Math.max(0, maxLen - fade)}:d=${fade}`,
    'aformat=channel_layouts=mono',
  ].join(',');
  ff(['-i', path.join(dir, file), '-af', filter, '-ar', '32000', '-c:a', 'pcm_s16le', out]);
  total += fs.statSync(out).size;
}
console.log(`SFX: ${Object.keys(SFX).length} files, ${(total / 1024).toFixed(0)} KB`);

for (const [name, [src]] of Object.entries(MUSIC)) {
  const out = path.join(MUSIC_OUT, name + '.mp3');
  ff(['-i', src, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', out]);
  console.log(`Music ${name}: ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB`);
}
