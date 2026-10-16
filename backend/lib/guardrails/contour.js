/* The contour: generate -> check yourself -> draft (ТЗ §10.3, E1 US2/US4).

   Nothing reaches the teacher unchecked. A draft that fails is generated again with
   the reasons in front of the model, up to a few attempts and within a time budget.
   If it still does not pass, the teacher gets the best draft with a calm "check me" and
   the human reason - never a silent pass and never a silent drop.

   Pure orchestration: `produce` and `check` are passed in (so this is testable without a
   model) and the bypass the spec forbids is simply that there is no other way out. */

const MAX_ATTEMPTS = 3;
const BUDGET_MS = 70000;

const adviceFor = reasons => 'Your last draft had problems. Fix every one of them and keep everything else: '
  + reasons.slice(0, 5).map((r, i) => `${i + 1}) ${r.say}`).join(' ');

/* produce({ feedback }) -> output (may throw)   check(output) -> { ok, unverified, reasons:[{rule, say}] } */
async function runContour({ produce, check, maxAttempts = MAX_ATTEMPTS, budgetMs = BUDGET_MS, now = Date.now }) {
  const started = now();
  const history = [];
  let best = null, feedback = null, attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    let out;
    try { out = await produce({ feedback, attempt: attempts }); }
    catch (err) { if (!best) throw err; break; }                    // a later attempt failed: keep what we have
    let verdict;
    try { verdict = await check(out); }
    catch (err) { verdict = { ok: true, unverified: true, reasons: [], error: err.message }; }   // the checker failing is said, not hidden
    history.push({ attempt: attempts, ok: !!verdict.ok, rules: (verdict.reasons || []).map(r => r.rule) });
    const score = (verdict.reasons || []).length;
    if (!best || score < best.score || verdict.ok) best = { out, verdict, score };
    if (verdict.ok) break;
    if (now() - started > budgetMs) break;
    feedback = adviceFor(verdict.reasons);
  }
  const v = best.verdict;
  const outcome = !v.ok ? 'check_me' : (v.unverified ? 'unverified' : (attempts > 1 ? 'regenerated' : 'pass'));
  return { out: best.out, verdict: v, outcome, attempts, history, firstPassFailed: !!history.length && !history[0].ok };
}

module.exports = { runContour, adviceFor, MAX_ATTEMPTS, BUDGET_MS };
