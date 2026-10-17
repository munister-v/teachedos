const test = require('node:test');
const assert = require('node:assert');
const { percentile, summarise } = require('../lib/buildTiming');

test('percentiles of a sorted list', () => {
  const l = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  assert.equal(percentile(l, 0.5), 500);
  assert.equal(percentile(l, 0.9), 900);
  assert.equal(percentile([], 0.5), null);
});

test('failed runs are counted but do not pull the times; fallbacks and retries show', () => {
  const s = summarise([
    { tool: 'a', ms: 1000, ok: true, tier: 'primary', attempts: 1 },
    { tool: 'a', ms: 9000, ok: true, tier: 'backup', attempts: 3 },
    { tool: 'a', ms: 30000, ok: false, attempts: 2 },
  ]);
  assert.deepEqual(s.perTool.a, { runs: 3, failed: 1, fellBack: 1, retried: 2, p50: 1000, p90: 9000, max: 9000 });
});
