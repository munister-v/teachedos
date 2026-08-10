#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, resolve, relative } from 'node:path';

const root = resolve(process.argv[2] || '.');
const missing = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('._') || entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'ng') continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile() && entry.name.endsWith('.html')) checkHtml(file);
  }
}

function checkHtml(file) {
  const html = readFileSync(file, 'utf8');
  const attr = /(?:src|href)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(attr)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('http:') || raw.startsWith('https:') ||
        raw.startsWith('//') || raw.startsWith('data:') || raw.startsWith('javascript:') || raw.startsWith('mailto:') ||
        raw.startsWith('tel:') || raw.includes('${')) continue;
    const clean = raw.split('#')[0].split('?')[0];
    const candidate = clean.startsWith('/')
      ? join(root, clean.slice(1))
      : resolve(dirname(file), normalize(clean));
    if (!existsSync(candidate)) {
      missing.push(`${relative(root, file)} -> ${raw}`);
    }
  }
}

walk(root);
if (missing.length) {
  console.error(`Missing local assets: ${missing.length}`);
  console.error(missing.join('\n'));
  process.exit(1);
}
console.log(`Static asset check passed for ${countHtml(root)} HTML files.`);

function countHtml(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('._') || entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'ng') continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) count += countHtml(file);
    else if (entry.isFile() && entry.name.endsWith('.html')) count++;
  }
  return count;
}
