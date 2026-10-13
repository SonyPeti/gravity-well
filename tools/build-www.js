// Copies the game into www/ for the Capacitor app (the web build is served straight from the repo root).
// Run via: npm run build   (also refreshes sw.js and assets.json first)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'www');
const FILES = ['index.html', 'style.css', 'audio.js', 'ads.js', 'progress.js', 'galaxy.js', 'challenge.js', 'game.js',
  'manifest.json', 'icon.svg', 'assets.json', 'sw.js'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true, filter: src => !src.endsWith('README.md') });
const count = fs.readdirSync(OUT, { recursive: true }).length;
console.log(`www/ ready: ${count} files`);
