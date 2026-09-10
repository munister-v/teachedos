#!/usr/bin/env node
/* Lightweight regression contract for AI quality rules.
   It runs without model credentials. Live model evaluation belongs in a
   separately provisioned environment; this guard makes sure the concrete
   scenario, source-evidence and fallback-quality requirements stay wired in.

   The board is the only tool pipeline. The Tools Hub (teacher-tools.html plus
   scripts/teacher-tools-app.js) was retired on 2026-09-09, so the hub-side
   contracts below now point at their board successors:
     TT_LOCAL_TRANSFORM_TOOLS  -> TT_LOCAL_QUALITY_SET  (scripts/board-app.js)
     hub per-tool form branches -> TT_NEEDS_SOURCE_SET  (scripts/board-app.js)
                                   and BOARD_TEACHER_TOOLS (js/teacher-tools-data.js)
   Registries are parsed rather than grepped, so a rename fails the check
   instead of silently matching nothing. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fail = message => { console.error(`AI quality contract failed: ${message}`); process.exitCode = 1; };

/* js/teacher-tools-data.js is a classic script that publishes its constants on
   `window`. Running it in a VM gives us the real registry the board loads, so
   these checks track the data instead of its formatting. */
function loadBoardRegistry() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  new vm.Script(read('js/teacher-tools-data.js'), { filename: 'js/teacher-tools-data.js' }).runInContext(sandbox);
  const tools = sandbox.window.BOARD_TEACHER_TOOLS;
  if (!Array.isArray(tools) || !tools.length) throw new Error('BOARD_TEACHER_TOOLS is empty or not exported on window');
  return tools;
}

/* Pull a flat `const NAME = new Set([...]);` literal out of a source file and
   evaluate just that literal. The bodies are string literals and comments only,
   so `]);` is an unambiguous terminator. */
function readSetLiteral(text, name, file) {
  const start = text.indexOf(`const ${name} = new Set([`);
  if (start === -1) { fail(`${file} no longer declares ${name}`); return new Set(); }
  const end = text.indexOf(']);', start);
  if (end === -1) { fail(`${file}: ${name} literal is unterminated`); return new Set(); }
  const literal = text.slice(text.indexOf('new Set([', start), end + 2);
  return vm.runInNewContext(`(${literal})`);
}

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
const boardGenerators = read('scripts/board-gen.js');
const localTextCore = read('scripts/tt-text-core.js');
const boardMarkup = read('board.html');
const moduleStudio = read('scripts/games/twee-module-studio.js');
const moduleStudioCatalogue = read('scripts/teachedos-data.js');
const clozeQuiz = read('scripts/games/linguaquiz-ai-uk.js');
const opinionsHandoff = read('scripts/games/four-opinions-uk.js');
const desktopTools = read('scripts/desktop-app.js');
const gamesHub = read('games/index.html');
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
  [boardBuilder, 'const TT_LOCAL_QUALITY_SET', 'board local-quality allowlist'],
  [boardBuilder, 'const TT_NEEDS_SOURCE_SET', 'board source-required allowlist'],
  [moduleStudio, 'const MODULE_INPUT_RULES', 'module studio input contract'],
  [moduleStudio, 'const AI_HANDOFFS', 'module studio AI handoff contract'],
  [moduleStudio, 'Порожня форма не перетворюється на шаблонний урок.', 'module studio no-fallback state'],
  [backendPrompt, 'preserve one supplied sentence verbatim', 'source-bound proofreading rule'],
  [clozeQuiz, 'Every option comes from the text you provided.', 'source-only cloze explanation'],
  [clozeQuiz, 'function escapeHtml', 'source-only cloze output escaping'],
  [opinionsHandoff, 'const FOUR_OPINIONS_TOOL_ID', 'four-opinions AI handoff id'],
  [opinionsHandoff, 'window.location.assign', 'four-opinions authenticated handoff'],
];
for (const [text, needle, label] of contracts) if (!text.includes(needle)) fail(`missing ${label}`);

/* ── board registry contracts (successors to the retired hub form branches) ── */
let boardTools = [];
try { boardTools = loadBoardRegistry(); } catch (err) { fail(`board tool registry did not load: ${err.message}`); }
const boardToolIds = new Set(boardTools.map(t => t && t.id).filter(Boolean));

/* Every fixture must describe a tool the board still ships, otherwise the
   suite is regression-testing a tool nobody can open. */
for (const item of fixtures.cases || []) {
  if (item.toolId && boardToolIds.size && !boardToolIds.has(item.toolId)) {
    fail(`${item.id}: fixture targets a tool the board no longer offers: ${item.toolId}`);
  }
}

/* Games hand a draft off to board.html?tool=<id>. runPendingToolOpen() silently
   does nothing when the id is not in BOARD_TEACHER_TOOLS, so a rename would turn
   the game's submit button into a dead end with no error anywhere. */
const handoffToolIds = new Set();
for (const m of moduleStudio.matchAll(/toolId:\s*"([^"]+)"/g)) handoffToolIds.add(m[1]);
const opinionsId = opinionsHandoff.match(/const FOUR_OPINIONS_TOOL_ID\s*=\s*"([^"]+)"/);
if (opinionsId) handoffToolIds.add(opinionsId[1]);
if (handoffToolIds.size < 2) fail('could not read the game AI handoff tool ids');
for (const id of handoffToolIds) {
  if (boardToolIds.size && !boardToolIds.has(id)) fail(`game AI handoff points at a tool the board cannot open: ${id}`);
}

/* Proofreading stays source-bound: the hub asked for a pasted text in its
   error-correction form, the board does it through TT_NEEDS_SOURCE_SET. */
const needsSource = readSetLiteral(boardBuilder, 'TT_NEEDS_SOURCE_SET', 'scripts/board-app.js');
if (needsSource.size && !needsSource.has('error-correction')) {
  fail('proofreading must require the teacher source text');
}

/* "Generate fast" only stays on the local engine for tools in
   TT_LOCAL_QUALITY_SET. Each of those needs a real generator in board-gen.js:
   without one it falls through to _ttGenScaffold, which is the generic
   template this whole suite exists to keep out of teachers' hands. */
const localQuality = readSetLiteral(boardBuilder, 'TT_LOCAL_QUALITY_SET', 'scripts/board-app.js');
for (const id of localQuality) {
  if (!new RegExp(`id === '${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(boardGenerators)) {
    fail(`${id} is trusted to generate locally but has no generator in board-gen.js`);
  }
}

if ((backendRoute.match(/generateLocal\(input\)/g) || []).length !== 1) {
  fail('server route must not call the rule generator after an AI failure');
}
if ((boardBuilder.match(/generateTeacherToolOutput\(input\)/g) || []).length !== 1) {
  fail('board builder must not replace AI output with a generic scaffold');
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
if (clozeQuiz.includes('const fallback =') || clozeQuiz.includes('globalPool.concat(fallback)') || clozeQuiz.includes('|| "answer"')) {
  fail('source-only cloze must not manufacture generic distractors or answers');
}
if (!clozeQuiz.includes('globalPool.length < 4')) {
  fail('source-only cloze must require enough source vocabulary for four honest choices');
}
if (opinionsHandoff.includes('generateOpinions') || opinionsHandoff.includes('LEVEL_LIBRARY') || opinionsHandoff.includes('opinionPersonas')) {
  fail('four-opinions must not ship a generic local opinion template');
}
if (!opinionsHandoff.includes('Lesson context: ') || !opinionsHandoff.includes('count: "4"')) {
  fail('four-opinions handoff must preserve lesson context and fixed response count');
}
for (const staleLabel of ['Topic + Vocabulary · Local Mode', 'Comprehension Questions · Local Mode', 'Statement Builder · Local Mode', 'Dialogue Draft · Local Mode', 'Correction Drill · Local Mode']) {
  if (moduleStudioCatalogue.includes(staleLabel)) fail(`module studio catalogue must not claim AI material is local: ${staleLabel}`);
}
for (const staleClaim of ['LinguaQuiz AI', 'AI-powered adaptive quiz']) {
  if ((moduleStudioCatalogue + desktopTools + gamesHub).includes(staleClaim)) fail(`legacy game metadata must not make a false AI claim: ${staleClaim}`);
}

if (!process.exitCode) console.log(`AI quality contract passed for ${fixtures.cases.length} fixtures across ${boardTools.length} board tools.`);
