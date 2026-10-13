// Prints duration, loudness, crest (punch) and brightness for audio files, to help pick SFX.
// Usage: node tools/analyze-audio.js <ffmpeg.exe> <file-or-glob-prefix> ...
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [ffmpeg, ...inputs] = process.argv.slice(2);
const files = [];
for (const inp of inputs) {
  if (fs.existsSync(inp) && fs.statSync(inp).isFile()) { files.push(inp); continue; }
  const dir = path.dirname(inp), prefix = path.basename(inp);
  for (const f of fs.readdirSync(dir)) if (f.startsWith(prefix) && /\.(ogg|wav|mp3|flac)$/.test(f)) files.push(path.join(dir, f));
}

function analyze(file) {
  const args = ['-hide_banner', '-nostats', '-i', file, '-af',
    'astats=metadata=1:reset=0,aspectralstats=measure=centroid,ametadata=print:file=-', '-f', 'null', '-'];
  let out = '';
  try { out = execFileSync(ffmpeg, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  const last = (key) => { const m = [...out.matchAll(new RegExp(key.replace(/\./g, '\\.') + '=([-\\d.inf]+)', 'g'))]; return m.length ? parseFloat(m[m.length - 1][1]) : NaN; };
  const cents = [...out.matchAll(/aspectralstats\.1\.centroid=([\d.]+)/g)].map(m => parseFloat(m[1])).filter(v => v > 0);
  const pts = [...out.matchAll(/pts_time:([\d.]+)/g)].map(m => parseFloat(m[1]));
  return {
    dur: pts.length ? pts[pts.length - 1] : NaN,
    peak: last('lavfi.astats.Overall.Peak_level'),
    rms: last('lavfi.astats.Overall.RMS_level'),
    centroid: cents.length ? cents.reduce((a, b) => a + b, 0) / cents.length : NaN,
  };
}

console.log('file'.padEnd(34), 'dur(s)', ' peak', '  rms', 'crest', 'bright(Hz)');
for (const f of files) {
  const a = analyze(f);
  console.log(path.basename(f).padEnd(34), a.dur.toFixed(2).padStart(6), a.peak.toFixed(1).padStart(5), a.rms.toFixed(1).padStart(5),
    (a.peak - a.rms).toFixed(1).padStart(5), Math.round(a.centroid).toString().padStart(8));
}
