#!/usr/bin/env node
/* Bump the app version in one place.
 *
 * There are three things that must agree and used to be updated by hand:
 * sw.js (CACHE + VERSION), version.json, and the ?v= query on every asset
 * link in every page. They drifted - board.css was being served as ?v=210
 * while the service worker was on 220 - and because nginx sends
 * `max-age=86400, must-revalidate`, a returning teacher could keep up to a
 * day of stale CSS after a deploy that was supposed to fix exactly that.
 *
 *   node scripts/bump-version.mjs        # next version
 *   node scripts/bump-version.mjs 231    # explicit
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

/* board-gen.js is not referenced from any HTML - board-app.js loads it at
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

function listStaticHtml(dir = '.') {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes:true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'ng' || entry.name.startsWith('._')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listStaticHtml(path));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(path);
  }
  return files;
}

/* Той самий пін, але вписаний рядком усередині скрипта, а не тегом у HTML:
   `scripts/board-gen.js?v=471` у хабі інструментів і `scripts/vocabulary.js?v=375`
   у лінивовантаженому словнику. Обхід вище дивиться лише в .html, тож обидва стояли
   на своїх числах роками: у vocabulary.js - з 375 при сайті на 539. Тобто
   будь-яка правка в цих двох файлах не доїжджала до вчителя, який уже відкривав
   сторінку: браузер віддавав закешоване за тим самим URL. Це рівно та біда,
   заради якої цей файл і написаний, тому такі рядки теж переписуються. */
function listVersionedScripts() {
  const files = [];
  for (const dir of ['scripts', 'js']) {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes:true }); } catch { continue; }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      files.push(join(dir, entry.name));
    }
  }
  return files;
}
let pins = 0;
for (const file of listVersionedScripts()) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/(\.(?:css|js|json))\?v=\d+/g, `$1?v=${next}`);
  if (after === before) continue;
  writeFileSync(file, after);
  pins += (before.match(/\.(?:css|js|json)\?v=\d+/g) || []).length;
}

let touched = 0, links = 0;
for (const file of listStaticHtml()) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/(\.(?:css|js|json))\?v=\d+/g, `$1?v=${next}`);
  if (after !== before) {
    writeFileSync(file, after);
    touched++;
    links += (before.match(/\.(?:css|js|json)\?v=\d+/g) || []).length;
  }
}

console.log(`v${next} - sw.js, version.json, ${links} asset links across ${touched} pages`
  + (pins ? `, ${pins} in-script pins` : '')
  + (assetConstBumped ? ', TEACHEDOS_ASSET_VERSION' : ''));
