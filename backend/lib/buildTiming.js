/* Timing of a lesson build (Lesson Builder 2.0 E19 US8): what a teacher waits for.
   Pure arithmetic over measured runs, so the numbers can be tested without a model. */
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

/* runs: [{ tool, level, ms, ok, tier, attempts }] -> overall and per-tool summary. */
function summarise(runs) {
  const by = new Map();
  for (const r of runs) {
    if (!by.has(r.tool)) by.set(r.tool, []);
    by.get(r.tool).push(r);
  }
  const stat = list => {
    const ok = list.filter(r => r.ok).map(r => r.ms).sort((a, b) => a - b);
    return {
      runs: list.length,
      failed: list.filter(r => !r.ok).length,
      fellBack: list.filter(r => r.ok && r.tier && r.tier !== 'primary').length,
      retried: list.filter(r => (r.attempts || 1) > 1).length,
      p50: percentile(ok, 0.5), p90: percentile(ok, 0.9), max: ok.length ? ok[ok.length - 1] : null,
    };
  };
  const perTool = {};
  for (const [tool, list] of by) perTool[tool] = stat(list);
  return { overall: stat(runs), perTool };
}

module.exports = { percentile, summarise };
