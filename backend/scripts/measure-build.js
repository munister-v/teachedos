#!/usr/bin/env node
/* Measures how long the model takes to build lesson material (E19 US8).
 *   node scripts/measure-build.js [runsPerCase=2]
 * Needs AI_API_KEY in backend/.env. Prints a table and writes ops/measure/build-<date>.json.
 * It makes real model calls: a few dozen at most, and they cost what any generation costs. */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const aiEngine = require('../lib/aiEngine');
const { summarise } = require('../lib/buildTiming');

if (!aiEngine.enabled()) {
  console.error('No model key: put AI_API_KEY in backend/.env and run again.');
  process.exit(2);
}
const runsPer = Math.max(1, Math.min(5, parseInt(process.argv[2], 10) || 2));
const base = { count: 8, action: 'simplify', genre: '', length: '', source: '', vocab: '', extra: '', parts: undefined, variant: 0, materials: '', duration: 45 };
const CASES = [
  ['add-text', 'A2', 'A day at the market'],
  ['add-text', 'B2', 'Remote work and wellbeing'],
  ['vocab-workout', 'B1', 'Travelling by train'],
  ['word-order', 'A2', 'Daily routine'],
  ['link-words', 'B1', 'A complaint about a late delivery'],
];

(async () => {
  const runs = [];
  for (const [tool, level, topic] of CASES) {
    for (let i = 0; i < runsPer; i++) {
      const t0 = Date.now();
      let ok = true;
      try { await aiEngine.generate({ ...base, toolId: tool, level, topic, variant: i }); }
      catch (e) { ok = false; console.warn(`  ${tool} ${level} failed: ${e.message}`); }
      const ms = Date.now() - t0;
      const trace = aiEngine.getLastTrace && aiEngine.getLastTrace();
      runs.push({ tool: `${tool} ${level}`, level, ms, ok, tier: aiEngine.getLastTier && aiEngine.getLastTier(), model: aiEngine.getLastModel && aiEngine.getLastModel(), attempts: trace && trace.attempts ? trace.attempts.length : 1 });
      console.log(`${tool.padEnd(14)} ${level}  ${String(ms).padStart(6)} ms  ${ok ? 'ok' : 'FAILED'}  ${runs[runs.length - 1].model || ''}`);
    }
  }
  const summary = summarise(runs);
  console.table(summary.perTool);
  console.log('overall', summary.overall);
  const dir = path.join(__dirname, '..', '..', 'ops', 'measure');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `build-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), runs, summary }, null, 2));
  console.log('written', file);
})();
