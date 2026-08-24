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
const boardBuilder = read('scripts/board-app.js');
const localTextCore = read('scripts/tt-text-core.js');
const boardMarkup = read('board.html');
const teacherToolsHub = read('scripts/teacher-tools-app.js');
const moduleStudio = read('scripts/games/twee-module-studio.js');
const moduleStudioCatalogue = read('scripts/teachedos-data.js');
const contracts = [
  [backendPrompt, 'Evidence rule:', 'server prompt evidence rule'],
  [backendPrompt, 'Source checkpoints to cover across the set:', 'server source coverage map'],
  [backendPrompt, 'Topic rule:', 'server prompt scenario rule'],
  [backendRoute, 'sourceAlignmentNotes', 'server source-alignment audit'],
  [backendRoute, 'auditWorksheetParts', 'worksheet answer audit'],
  [backendRoute, 'AI_INPUT_REQUIRED', 'server input guard'],
  [backendRoute, 'releaseAiQuota', 'failed-request quota release'],
  [browserPrompt, 'function _qualityRules', 'offline AI quality rules'],
  [browserPrompt, 'Do not invent supporting facts.', 'offline source evidence rule'],
  [boardBuilder, 'AI could not create this material. Your draft was not changed.', 'board AI failure state'],
  [teacherToolsHub, 'const TT_LOCAL_TRANSFORM_TOOLS', 'hub local-transform allowlist'],
  [teacherToolsHub, 'AI could not create this material', 'hub AI failure state'],
  [moduleStudio, 'const MODULE_INPUT_RULES', 'module studio input contract'],
  [moduleStudio, 'const AI_HANDOFFS', 'module studio AI handoff contract'],
  [moduleStudio, 'Порожня форма не перетворюється на шаблонний урок.', 'module studio no-fallback state'],
  [teacherToolsHub, "m==='error-correction'", 'proofreading source form'],
  [backendPrompt, 'preserve one supplied sentence verbatim', 'source-bound proofreading rule'],
];
for (const [text, needle, label] of contracts) if (!text.includes(needle)) fail(`missing ${label}`);

if ((backendRoute.match(/generateLocal\(input\)/g) || []).length !== 1) {
  fail('server route must not call the rule generator after an AI failure');
}
if ((boardBuilder.match(/generateTeacherToolOutput\(input\)/g) || []).length !== 1) {
  fail('board builder must not replace AI output with a generic scaffold');
}
if ((teacherToolsHub.match(/buildHubOutput\(\)/g) || []).length !== 1) {
  fail('teacher-tools hub must not execute its retired generic generator');
}
if (teacherToolsHub.includes('engineDraftShown=ttLocalDraft') || teacherToolsHub.includes('return generate();')) {
  fail('teacher-tools hub must not display a generic draft when AI is unavailable');
}
if (localTextCore.includes('Generic last-resort filler words')) {
  fail('shared text helpers must not contain a generic vocabulary fallback');
}
if (boardMarkup.includes('value="Travel problems"') || boardMarkup.includes('boarding pass\ncomplaint')) {
  fail('board tool form must not ship with demo lesson content');
}
for (const filler of ['"modern learning habits"', '"everyday habits"', '"everyday decisions"', '"solving a lesson problem"', '"a classroom decision"']) {
  if (moduleStudio.includes(filler)) fail(`module studio must not ship with generic fallback: ${filler}`);
}
if (moduleStudio.includes('const fixes = [')) {
  fail('module studio must not manufacture an answer key unrelated to teacher source material');
}
if (!moduleStudio.includes('if (AI_HANDOFFS[activeModuleId])')) {
  fail('module studio semantic generators must use the authenticated AI handoff');
}
for (const staleLabel of ['Topic + Vocabulary · Local Mode', 'Comprehension Questions · Local Mode', 'Statement Builder · Local Mode', 'Dialogue Draft · Local Mode', 'Correction Drill · Local Mode']) {
  if (moduleStudioCatalogue.includes(staleLabel)) fail(`module studio catalogue must not claim AI material is local: ${staleLabel}`);
}

if (!process.exitCode) console.log(`AI quality contract passed for ${fixtures.cases.length} fixtures.`);
