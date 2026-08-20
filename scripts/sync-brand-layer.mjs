#!/usr/bin/env node
/*
  Place the shared TeachEd brand layer after each page's local styles.
  It covers the app's static routes and standalone games; Angular source is a
  separate build target and deliberately excluded from static deployment.
*/
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const version = JSON.parse(readFileSync('version.json', 'utf8')).version;
const brandFile = join('styles', 'teached-brand.css');
const skipped = new Set(['.git', 'node_modules', 'ng']);
const pages = [];

function walk(dir = '.') {
  for (const entry of readdirSync(dir, { withFileTypes:true })) {
    if (skipped.has(entry.name) || entry.name.startsWith('._')) continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile() && entry.name.endsWith('.html')) pages.push(file);
  }
}

walk();
let changed = 0;
for (const page of pages) {
  const href = relative(dirname(page), brandFile).split(sep).join('/');
  const tag = '<link rel="stylesheet" href="' + href + '?v=' + version + '">';
  const before = readFileSync(page, 'utf8');
  let after;
  if (/\bteached-brand\.css(?:\?v=\d+)?/.test(before)) {
    after = before.replace(/<link rel="stylesheet" href="[^"]*teached-brand\.css(?:\?v=\d+)?">/, tag);
  } else {
    after = before.replace(/<\/head>/i, tag + '\n</head>');
  }
  if (after !== before) {
    writeFileSync(page, after);
    changed++;
  }
}

console.log('Brand layer linked on ' + pages.length + ' static pages (' + changed + ' changed).');
