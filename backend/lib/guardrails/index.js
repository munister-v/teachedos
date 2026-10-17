/* The guardrail service: one contour for every studio (ТЗ T-Q2/T-Q3: platform services,
   not studio code). Grammar is the first to use it; another skill adds its own checks
   module and a line in CHECKERS, nothing else.

   GUARDRAILS=off      skips the contour entirely (the old behaviour)
   GUARDRAIL_JUDGE=off keeps the rule checks but skips the second reading by the model

   What the teacher meets is a calm "check me" with the reason in plain words, on the
   same quality signal the lesson card already shows. The platform's own terms stay inside. */
const { runContour } = require('./contour');
const grammar = require('./grammar');
const vocabulary = require('./vocabulary');
const descriptors = require('../descriptorBank');
const { isClean } = require('../glossary');

const CHECKERS = {
  grammar: { applies: grammar.applies, check: grammar.checkGrammar, skill: 'grammar' },
  vocabulary: { applies: vocabulary.applies, check: vocabulary.checkVocabulary, skill: 'vocabulary' },
};

const mode = () => String(process.env.GUARDRAILS || 'on').toLowerCase();
const judgeOn = () => String(process.env.GUARDRAIL_JUDGE || 'on').toLowerCase() !== 'off';
const checkerFor = input => Object.values(CHECKERS).find(c => c.applies(input)) || null;

const UNVERIFIED_NOTE = 'I could not double-check this one - read it through before class.';

/* put the verdict on the quality signal the card already shows */
function decorate(out, res, stampStr) {
  const q = out.quality || { level: 'green', kept: 0, asked: 0, dropped: [], notes: [] };
  const reasons = (res.verdict.reasons || []).map(r => r.say).filter(s => isClean(s, { visible: true }));
  if (res.outcome === 'check_me' || res.outcome === 'unverified') {
    q.level = q.level === 'red' ? 'red' : 'amber';
    q.checkMe = true;
    q.notes = [...(res.outcome === 'unverified' ? [UNVERIFIED_NOTE] : reasons), ...(q.notes || [])].slice(0, 4);
  }
  q.check = { status: res.outcome, attempts: res.attempts, reasons: reasons.slice(0, 3), bank: stampStr };
  out.quality = q;
  return out;
}

/* produce({ feedback, brief, attempt }) -> output.  judge(prompt) -> JSON.  Returns { out, guard } */
async function guard({ input, produce, judge, now, maxAttempts, budgetMs }) {
  const checker = mode() === 'off' ? null : checkerFor(input);
  if (!checker) return { out: await produce({ feedback: null, brief: '', attempt: 1 }), guard: null };
  let bank = null, stampStr = null, brief = '';
  try { bank = descriptors.load(); stampStr = descriptors.stamp(bank); brief = descriptors.brief(input.level, checker.skill, bank); } catch (e) { /* no bank: checks still run, just without a level brief */ }
  const res = await runContour({
    produce: ({ feedback, attempt }) => produce({ feedback, brief, attempt }),
    check: out => checker.check({ input, out, judge: judgeOn() ? judge : null }),
    now, maxAttempts, budgetMs,
  });
  decorate(res.out, res, stampStr);
  return { out: res.out, guard: { skill: checker.skill, kind: res.verdict.kind || null, outcome: res.outcome, attempts: res.attempts, firstPassFailed: res.firstPassFailed, bank: stampStr } };
}

module.exports = { guard, decorate, checkerFor, CHECKERS, UNVERIFIED_NOTE };
