const test = require('node:test');
const assert = require('node:assert');
const forms = require('../lib/guardrails/forms');
const { runContour } = require('../lib/guardrails/contour');
const grammar = require('../lib/guardrails/grammar');
const { guard, UNVERIFIED_NOTE } = require('../lib/guardrails');
const { isClean } = require('../lib/glossary');

const PP_BAD = `Maya is at the market. On Friday, Maya has brought her lunch to work. She has never eaten there before. Her friend has just arrived. They have already ordered. Maya has lost her keys.
"Have you seen them?" "I have looked everywhere." Maya has found a phone instead.`;
const PP_GOOD = `Maya is at the market. She has brought her lunch to work today. She has never eaten there before. Her friend has just arrived. They have already ordered. Maya has lost her keys.
"Have you seen them?" "I have looked everywhere." Maya has found a phone instead.`;
const story = text => ({ cards: [{ title: '📖 Reading text', text }] });
const input = (over = {}) => ({ lesson: 'grammar', toolId: 'text-topic-vocab', topic: 'Present Perfect', level: 'B1', parts: { form: true }, ...over });

test('the audit\'s top defect: a Present Perfect story that pairs it with a finished time is refused', () => {
  const bad = grammar.ruleCheck(input(), story(PP_BAD));
  assert.ok(bad.some(r => r.rule === 'story.trap.finished-time'));
  assert.match(bad[0].say, /time that is over/);
  assert.deepEqual(grammar.ruleCheck(input(), story(PP_GOOD)), []);
});

test('the form detectors find clear instances and clear mistakes, and say what they cover', () => {
  assert.equal(forms.analyse('I have lived here for years. He has gone.', 'present-perfect').instances, 2);
  assert.equal(forms.analyse('We have been there. Last year I have seen it.', 'present-perfect').traps.length, 1);
  assert.equal(forms.analyse('If I would win, I would travel.', 'second-conditional').traps[0].id, 'would-after-if');
  assert.equal(forms.analyse('If it will rain, we stay home.', 'first-conditional').traps[0].id, 'will-after-if');
  assert.equal(forms.analyse('If I had known, I would have come.', 'third-conditional').traps.length, 0);
  assert.equal(forms.analyse('I did not used to like it.', 'used-to').traps[0].id, 'did-used-to');
  assert.equal(forms.analyse('I am knowing the answer.', 'present-continuous').traps[0].id, 'stative-ing');
  assert.deepEqual(forms.formsFor('Present Perfect vs Past Simple'), ['present-perfect', 'past-simple']);
  assert.equal(forms.targetFor('Present Perfect Continuous'), null, 'a form with no detector gets no rule verdict');
  assert.equal(forms.analyse('anything', 'no-such-form'), null);
});

test('a text that barely uses the form, or highlights it, is refused', () => {
  const thin = grammar.ruleCheck(input(), story('Maya is at the market. She has brought lunch. It is sunny. They sit down.'));
  assert.ok(thin.some(r => r.rule === 'story.instances'));
  const marked = grammar.ruleCheck(input(), story(PP_GOOD.replace('has brought', '**has brought**')));
  assert.ok(marked.some(r => r.rule === 'story.marked'));
});

test('concept checks: no grammar terms, no target form in a choice, and a key that is among the choices', () => {
  const out = { questions: [
    { type: 'mcq', text: 'Is “I have seen it” about a past participle?', options: ['Yes', 'No', 'Maybe'], answer: 'No' },
    { type: 'mcq', text: 'What does it say?', options: ['I have lost it', 'It is lost', 'It was lost'], answer: 'It is lost' },
    { type: 'mcq', text: 'Done?', options: ['Yes', 'No'], answer: 'Perhaps' },
  ] };
  const r = grammar.ruleCheck(input({ toolId: 'abcd-text', parts: undefined }), out);
  assert.deepEqual(new Set(r.map(x => x.rule)), new Set(['ccq.terms', 'ccq.target-in-option', 'key.answer']));
});

test('discovery questions may not name the grammar before the rule is shown', () => {
  const r = grammar.ruleCheck(input({ toolId: 'open-questions', parts: undefined }), { questions: [{ type: 'open', text: 'Find every sentence in the present perfect.' }, { type: 'open', text: 'Which small word comes before the second verb?' }] });
  assert.deepEqual(r.map(x => x.rule), ['discovery.terms']);
});

test('sentence halves: pairs that cannot be told apart, or that make a wrong sentence', () => {
  const twin = { questions: [{ type: 'match', pairs: [{ left: 'I have', right: 'finished it.' }, { left: 'She has', right: 'finished it.' }, { left: 'We have', right: 'left.' }] }] };
  assert.ok(grammar.ruleCheck(input({ toolId: 'matching-halves', parts: undefined }), twin).some(r => r.rule === 'halves.same-ending'));
  const wrong = { questions: [{ type: 'match', pairs: [{ left: 'I have eaten there', right: 'yesterday.' }, { left: 'We have', right: 'gone.' }, { left: 'They have', right: 'won.' }] }] };
  assert.ok(grammar.ruleCheck(input({ toolId: 'matching-halves', parts: undefined }), wrong).some(r => r.rule === 'halves.trap'));
});

test('the rule card needs its four parts, and its examples and "right" versions must really be right', () => {
  const full = { cards: [
    { title: 'Formula', text: 'have/has + past participle' }, { title: 'Meaning', text: 'Used for ...' },
    { title: 'Examples', text: 'She has finished. I have never been there.' }, { title: 'Common mistakes', text: '❌ I have seen it yesterday → ✅ I saw it yesterday' }] };
  assert.deepEqual(grammar.ruleCheck(input({ toolId: 'grammar-rules', parts: undefined }), full), []);
  const broken = { cards: [{ title: 'Formula', text: 'x' }, { title: 'Examples', text: 'I have seen it yesterday.' }, { title: 'Common mistakes', text: '❌ I saw it → ✅ I have seen it last week' }] };
  const r = grammar.ruleCheck(input({ toolId: 'grammar-rules', parts: undefined }), broken).map(x => x.rule);
  assert.ok(r.includes('rules.part.meaning') && r.includes('rules.example.finished-time') && r.includes('rules.mistake-right'));
});

test('an answer key is everywhere (T-G4)', () => {
  const r = grammar.ruleCheck(input({ toolId: 'gap', parts: undefined }), { questions: [{ type: 'gap-fill', text: 'I ___ it.', answer: '' }, { type: 'mcq', text: 'x', options: ['a', 'b'], answer: 'c' }] });
  assert.deepEqual(r.map(x => x.rule), ['key.answer', 'key.answer']);
});

test('what is not grammar, or has no checker yet, passes through untouched', async () => {
  assert.equal(grammar.applies({ lesson: 'reading', toolId: 'abcd-text' }), false);
  assert.equal(grammar.applies({ lesson: 'grammar', toolId: 'homework-set' }), false);
  const r = await grammar.checkGrammar({ input: { lesson: 'reading', toolId: 'abcd-text' }, out: {}, judge: async () => { throw new Error('never called'); } });
  assert.equal(r.ok, true); assert.equal(r.kind, null);
});

test('the second reading: its issues count, its failure is said, and switching it off is explicit', async () => {
  const mk = judge => grammar.checkGrammar({ input: input(), out: story(PP_GOOD), judge });
  const bad = await mk(async () => ({ ok: false, issues: ['“She have lunch” is not correct English.'] }));
  assert.equal(bad.ok, false); assert.equal(bad.reasons[0].rule, 'judge');
  const leaked = await mk(async () => ({ ok: false, issues: ['The guardrail failed the descriptor check.'] }));
  assert.ok(isClean(leaked.reasons[0].say), 'platform terms never reach the teacher');
  const down = await mk(async () => { throw new Error('timeout'); });
  assert.deepEqual([down.ok, down.unverified], [true, true]);
  const garbage = await mk(async () => 'nonsense');
  assert.equal(garbage.unverified, true);
  const off = await mk(null);
  assert.deepEqual([off.ok, off.unverified, off.rulesOnly], [true, false, true]);
  const okay = await mk(async () => ({ ok: true, issues: [] }));
  assert.deepEqual([okay.ok, okay.unverified], [true, false]);
});

test('the judge is asked about the right things, with the level in front of it', () => {
  const p = grammar.judgePrompt('halves', input({ level: 'B2' }), { questions: [{ type: 'match', pairs: [{ left: 'a', right: 'b' }] }] });
  assert.match(p, /exactly ONE ending/);
  assert.match(p, /At B2, a learner/);
  assert.match(p, /Present Perfect/);
});

/* ── the contour ── */
const fail = rule => ({ ok: false, reasons: [{ rule, say: `problem ${rule}` }] });
const pass = { ok: true, reasons: [] };

test('contour: a clean first draft goes straight through', async () => {
  const r = await runContour({ produce: async () => 'draft', check: async () => pass });
  assert.deepEqual([r.outcome, r.attempts, r.firstPassFailed], ['pass', 1, false]);
});

test('contour: a failing draft is generated again with the reasons in front of the model', async () => {
  const seen = [];
  const r = await runContour({ produce: async ({ feedback }) => { seen.push(feedback); return seen.length === 1 ? 'bad' : 'good'; }, check: async o => (o === 'good' ? pass : fail('a')) });
  assert.deepEqual([r.out, r.outcome, r.attempts, r.firstPassFailed], ['good', 'regenerated', 2, true]);
  assert.equal(seen[0], null); assert.match(seen[1], /problem a/);
});

test('contour: if it never passes the teacher gets the best draft, marked check me - never a silent pass', async () => {
  let n = 0;
  const r = await runContour({ produce: async () => `d${++n}`, check: async o => (o === 'd2' ? fail('x') : { ok: false, reasons: [{ rule: 'a', say: 'a' }, { rule: 'b', say: 'b' }] }), maxAttempts: 3 });
  assert.equal(r.outcome, 'check_me'); assert.equal(r.attempts, 3); assert.equal(r.out, 'd2', 'the draft with the fewest problems');
});

test('contour: a later attempt that fails to generate keeps the earlier draft; a first one that fails is an error', async () => {
  let n = 0;
  const kept = await runContour({ produce: async () => { if (++n === 2) throw new Error('provider down'); return 'first'; }, check: async () => fail('a') });
  assert.deepEqual([kept.out, kept.outcome], ['first', 'check_me']);
  await assert.rejects(runContour({ produce: async () => { throw new Error('down'); }, check: async () => pass }), /down/);
});

test('contour: the time budget stops the retries; the checker failing is said, not hidden', async () => {
  let t = 0, n = 0;
  const r = await runContour({ produce: async () => ++n, check: async () => fail('a'), budgetMs: 100, now: () => (t += 80), maxAttempts: 5 });
  assert.ok(r.attempts < 5);
  const u = await runContour({ produce: async () => 'x', check: async () => { throw new Error('boom'); } });
  assert.equal(u.outcome, 'unverified');
});

/* ── the service ── */
test('guard: a draft that keeps failing arrives with a calm "check me" and its reason on the quality signal', async () => {
  const calls = [];
  const r = await guard({
    input: input(),
    produce: async ({ feedback, brief }) => { calls.push({ feedback, brief }); return { ...story(PP_BAD), quality: { level: 'green', kept: 1, asked: 1, dropped: [], notes: [] } }; },
    judge: async () => ({ ok: true, issues: [] }),
  });
  assert.equal(r.guard.outcome, 'check_me');
  assert.equal(r.out.quality.checkMe, true); assert.equal(r.out.quality.level, 'amber');
  assert.match(r.out.quality.notes[0], /time that is over/);
  assert.match(r.out.quality.check.bank, /^\d+\.\d+\.\d+\+[0-9a-f]{8}$/);
  assert.match(calls[0].brief, /^At B1, a learner/, 'the level brief comes from the descriptor bank');
  assert.equal(calls.length, 3);
  assert.ok(r.out.quality.notes.every(n => isClean(n, { visible: true })));
});

test('guard: a draft that passes on the second try shows no badge', async () => {
  let n = 0;
  const r = await guard({ input: input(), produce: async () => ({ ...story(++n === 1 ? PP_BAD : PP_GOOD), quality: { level: 'green', kept: 1, asked: 1, dropped: [], notes: [] } }), judge: async () => ({ ok: true, issues: [] }) });
  assert.deepEqual([r.guard.outcome, r.guard.firstPassFailed, r.out.quality.checkMe], ['regenerated', true, undefined]);
  assert.equal(r.out.quality.level, 'green');
});

test('guard: when the second reading cannot run, the teacher is told so', async () => {
  const r = await guard({ input: input(), produce: async () => story(PP_GOOD), judge: async () => { throw new Error('down'); } });
  assert.equal(r.guard.outcome, 'unverified');
  assert.equal(r.out.quality.notes[0], UNVERIFIED_NOTE);
});

test('guard: other lessons, and GUARDRAILS=off, bypass the contour entirely', async () => {
  let calls = 0;
  const other = await guard({ input: { lesson: 'reading', toolId: 'abcd-text' }, produce: async () => { calls++; return { questions: [] }; }, judge: async () => ({ ok: false }) });
  assert.equal(other.guard, null); assert.equal(calls, 1);
  process.env.GUARDRAILS = 'off';
  try {
    const off = await guard({ input: input(), produce: async () => { calls++; return story(PP_BAD); }, judge: async () => ({ ok: false }) });
    assert.equal(off.guard, null); assert.equal(calls, 2);
  } finally { delete process.env.GUARDRAILS; }
});

test('every message the contour can show a teacher follows the product language', async () => {
  const outs = [story(PP_BAD), story('x y z'), { cards: [{ title: 'Formula', text: '' }] }];
  for (const o of outs) for (const t of ['text-topic-vocab', 'grammar-rules']) {
    for (const r of grammar.ruleCheck(input({ toolId: t, parts: t === 'text-topic-vocab' ? { form: true } : undefined }), o)) assert.ok(isClean(r.say, { visible: true }), r.say);
  }
  assert.ok(isClean(UNVERIFIED_NOTE, { visible: true }));
});
