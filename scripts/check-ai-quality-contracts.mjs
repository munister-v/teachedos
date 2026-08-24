#!/usr/bin/env node
/* Lightweight regression contract for AI quality rules.
   It runs without model credentials. Live model evaluation belongs in a
   separately provisioned environment; this guard makes sure the concrete
   scenario, source-evidence and fallback-quality requirements stay wired in. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fail = message => { console.error(`AI quality contract failed: ${message}`); process.exitCode = 1; };

const fixtures = JSON.parse(read('tests/ai-quality-fixtures.json'));
if (!Array.isArray(fixtures.cases) || fixtures.cases.length < 4) fail('expected at least four representative fixtures');

const ids = new Set();
for (const item of fixtures.cases || []) {
  if (!item.id || ids.has(item.id)) fail(`invalid or duplicate fixture id: ${item.id || '(empty)'}`);
  ids.add(item.id);
  if (!/^[ABC][12]$/.test(item.level || '')) fail(`${item.id}: invalid CEFR level`);
  if (!item.toolId || !item.topic || !Array.isArray(item.expects) || !item.expects.length) fail(`${item.id}: missing test contract`);
  if (item.source) {
    if (item.source.length < 120) fail(`${item.id}: source is too short for a source-based regression`);
    if (!Array.isArray(item.anchors) || item.anchors.length < 3) fail(`${item.id}: source case needs at least three anchors`);
    for (const anchor of item.anchors || []) {
      if (!item.source.toLowerCase().includes(String(anchor).toLowerCase())) fail(`${item.id}: anchor is absent from source: ${anchor}`);
    }
  }
}

const backendPrompt = read('backend/lib/aiEngine.js');
const backendRoute = read('backend/routes/ai.js');
const browserPrompt = read('js/teacher-tool-ai.js');
const contracts = [
  [backendPrompt, 'Evidence rule:', 'server prompt evidence rule'],
  [backendPrompt, 'Source checkpoints to cover across the set:', 'server source coverage map'],
  [backendPrompt, 'Topic rule:', 'server prompt scenario rule'],
  [backendRoute, 'sourceAlignmentNotes', 'server source-alignment audit'],
  [backendRoute, 'auditWorksheetParts', 'worksheet answer audit'],
  [browserPrompt, 'function _qualityRules', 'offline AI quality rules'],
  [browserPrompt, 'Do not invent supporting facts.', 'offline source evidence rule'],
];
for (const [text, needle, label] of contracts) if (!text.includes(needle)) fail(`missing ${label}`);

if (!process.exitCode) console.log(`AI quality contract passed for ${fixtures.cases.length} fixtures.`);
