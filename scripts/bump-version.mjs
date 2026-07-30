#!/usr/bin/env node
/* Bump the app version in one place.
 *
 * There are three things that must agree and used to be updated by hand:
 * sw.js (CACHE + VERSION), version.json, and the ?v= query on every asset
 * link in every page. They drifted — board.css was being served as ?v=210
 * while the service worker was on 220 — and because nginx sends
 * `max-age=86400, must-revalidate`, a returning teacher could keep up to a
 * day of stale CSS after a deploy that was supposed to fix exactly that.
 *
 *   node scripts/bump-version.mjs        # next version
 *   node scripts/bump-version.mjs 231    # explicit
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const versionFile = 'version.json';
const meta = JSON.parse(readFileSync(versionFile, 'utf8'));
const next = String(process.argv[2] || Number(meta.version) + 1);
if (!/^\d+$/.test(next)) {
  console.error(`Version must be digits, got "${next}"`);
  process.exit(1);
}

meta.version = next;
meta.deployedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
writeFileSync(versionFile, JSON.stringify(meta, null, 2) + '\n');

const sw = readFileSync('sw.js', 'utf8')
  .replace(/const CACHE = 'teachedos-v\d+';/, `const CACHE = 'teachedos-v${next}';`)
  .replace(/const VERSION = '\d+';/, `const VERSION = '${next}';`);
writeFileSync('sw.js', sw);

/* board-gen.js is not referenced from any HTML — board-app.js loads it at
   runtime and versions it with a constant of its own. That constant escaped
   this script and had sat at 188 while the site reached 246, so every fix
   shipped inside board-gen.js kept being served from cache for up to a day,
   which is the exact failure this file exists to prevent. Bump it here so the
   two cannot drift again. */
let assetConstBumped = false;
{
  const p = 'scripts/board-app.js';
  const before = readFileSync(p, 'utf8');
  const after = before.replace(
    /const TEACHEDOS_ASSET_VERSION = '\d+';/,
    `const TEACHEDOS_ASSET_VERSION = '${next}';`);
  if (after !== before) { writeFileSync(p, after); assetConstBumped = true; }
}

let touched = 0, links = 0;
for (const file of readdirSync('.').filter(f => f.endsWith('.html'))) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/(\.(?:css|js|json))\?v=\d+/g, `$1?v=${next}`);
  if (after !== before) {
    writeFileSync(file, after);
    touched++;
    links += (before.match(/\.(?:css|js|json)\?v=\d+/g) || []).length;
  }
}

console.log(`v${next} — sw.js, version.json, ${links} asset links across ${touched} pages`
  + (assetConstBumped ? ', TEACHEDOS_ASSET_VERSION' : ''));
