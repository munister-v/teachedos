#!/usr/bin/env node
/* Interface copy against the glossary (Lesson Builder 2.0 ТЗ §7 / E8).
   Part of the release step, next to check-static-assets: exits 1 on any finding. */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { scanRepo } = require('../backend/lib/glossaryScan.js');
const root = resolve(process.argv[2] || '.');
const findings = scanRepo(root);
if (findings.length) {
  console.error(`Glossary: ${findings.length} finding(s)`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  "${f.match}"  ->  ${f.say}`);
  process.exit(1);
}
console.log('Glossary lint passed.');
