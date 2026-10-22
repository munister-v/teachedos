'use strict';

/* The Speaking Tutor engine (ТЗ v1.0 part V smoke, adapted): the plan by priority, the ritual, the mistake log,
   the Phrase Bank, topic status, check dates, fluency. Pure logic, no database. */

const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../lib/speaking/engine');
const { bankFor } = require('../lib/speaking/starterBank');

const ctx = {
  studentId: 'anna', level: 'B1', accent: 'en-GB',
  currentTopic: { topic: 'Past Continuous', construct: 'past continuous', lessonDate: '2026-10-14' },
  dueProgramChecks: [{ construct: 'past continuous', dueOn: '2026-10-21' }],
  recurring: [{ id: 'm1', construct: 'past simple, irregular verbs', occurrences: 4, status: 'recurring', weight: 'recurring' }],
  lastLessonWords: ['headache'], passiveWords: ['appointment', 'prescription'],
  duePhrases: [{ id: 'p1', text: 'I bought a new jacket - it was a real bargain.', status: 'learning' }],
  facts: [{ id: 'f1', fact: 'has a dog named Lucky' }],
  teacherTasks: [{ id: 't1', instruction: 'Ask her to tell about her new job', status: 'queued' }],
  starterBank: bankFor('B1'),
};

test('the plan follows the priority: program check, teacher task, recurring, lesson words, bank; never more than two program rounds', () => {
  const plan = E.buildSessionPlan(ctx);
  assert.equal(plan.length, 5);
  assert.deepEqual(plan.slice(0, 3).map(p => p.source), ['program', 'teacherTask', 'recurring']);
  assert.deepEqual(plan[3].targetWords, ['appointment', 'prescription']);
  const many = E.buildSessionPlan({ ...ctx, dueProgramChecks: [1, 2, 3, 4].map(i => ({ construct: 'c' + i })) });
  assert.equal(many.filter(p => p.source === 'program').length, 2);
});

test('a new student with no history still gets a whole session from the starter bank', () => {
  const plan = E.buildSessionPlan({ studentId: 'x', level: 'A2', dueProgramChecks: [], teacherTasks: [], recurring: [], passiveWords: [], starterBank: bankFor('A2') });
  assert.equal(plan.length, 5);
  assert.ok(plan.every(p => p.source === 'starter' && p.bankQuestion));
});

test('a recurring mistake puts at least one question on its construction; blocking ones go first', () => {
  const plan = E.buildSessionPlan({ ...ctx, dueProgramChecks: [], teacherTasks: [], recurring: [
    { construct: 'articles', occurrences: 9, status: 'recurring', weight: 'recurring' },
    { construct: 'i am agree', occurrences: 3, status: 'recurring', weight: 'blocking' }] });
  assert.equal(plan[0].construct, 'i am agree');
  assert.equal(plan[1].construct, 'articles');
});

test('the morning ritual: a hook from a fact, a pair of words, two questions - and yesterday\'s hook is skipped', () => {
  const r = E.buildRitualPlan(ctx);
  assert.equal(r.hookFact, 'has a dog named Lucky');
  assert.deepEqual(r.pairWords.map(w => w.kind), ['activate', 'phraseRepeat']);
  assert.equal(r.questions.length, 2);
  assert.equal(E.buildRitualPlan({ ...ctx, facts: [{ fact: 'a' }, { fact: 'b' }] }, 'a').hookFact, 'b');
});

test('the mistake log: new -> recurring at three, a self-correction is counted, two clean sessions in a row fix it', () => {
  let log = [];
  for (let i = 0; i < 3; i++) log = E.upsertMistake(log, { said: 'I taked', better: 'I took', category: 'grammar', construct: 'past simple, irregular verbs', selfCorrected: i === 2, now: '2026-10-21', newId: 'mx' });
  assert.equal(log[0].occurrences, 3); assert.equal(log[0].status, 'recurring'); assert.equal(log[0].selfFixedCount, 1);
  const after1 = E.applySessionOutcome(log, ['past simple, irregular verbs']);
  assert.equal(after1[0].status, 'recurring');
  assert.equal(E.applySessionOutcome(after1, ['past simple, irregular verbs'])[0].status, 'fixed');
  assert.equal(E.weightOf({ category: 'grammar', occurrences: 1, selfFixedCount: 0 }, true), 'blocking');
});

test('the Phrase Bank: +1/+3/+7 days; the same day does not count twice; three days make it Mine', () => {
  let c = { id: 'p', correctRepeatDays: [], status: 'learning', nextReviewOn: '2026-10-21' };
  c = E.recordPhraseRepeat(c, true, '2026-10-21'); c = E.recordPhraseRepeat(c, true, '2026-10-21');
  assert.equal(c.correctRepeatDays.length, 1); assert.equal(c.nextReviewOn, '2026-10-24');
  c = E.recordPhraseRepeat(c, true, '2026-10-22');
  assert.equal(c.status, 'learning');
  c = E.recordPhraseRepeat(c, true, '2026-10-25');
  assert.equal(c.status, 'mine');
});

test('topic status needs two different days to "hold"; two slips in a week crumble; nothing heard is unchecked', () => {
  const t = { correctUses: [{ date: '2026-10-15', text: 'a' }, { date: '2026-10-17', text: 'b' }], errorUses: [] };
  assert.equal(E.topicStatus(t, '2026-10-21'), 'holds');
  assert.equal(E.topicStatus({ correctUses: [], errorUses: [{ date: '2026-10-20' }, { date: '2026-10-21' }] }, '2026-10-21'), 'crumbling');
  assert.equal(E.topicStatus({ correctUses: [], errorUses: [] }, '2026-10-21'), 'unchecked');
  assert.equal(E.topicStatus({ correctUses: [{ date: '2026-10-15', text: 'a' }], errorUses: [] }, '2026-10-21'), 'inProgress');
});

test('check dates are +1 and +4 days; fluency is counted from the transcript and the timing', () => {
  assert.deepEqual(E.programCheckDates('2026-10-21'), ['2026-10-22', '2026-10-25']);
  const f = E.fluencyFromRounds('2026-10-19', 'a', [{ transcript: 'I was um cooking and uh then he called me', studentAudioSec: 30 }]);
  assert.equal(f.wordsPerMinute, 20); assert.equal(f.fillersPerMinute, 4);
});

test('the main error of a round: blocking first, then the target construction', () => {
  const list = [{ construct: 'a' }, { construct: 'b' }, { construct: 'c', breaksMeaning: true }];
  assert.equal(E.mainError(list, 'b').construct, 'c');
  assert.equal(E.mainError(list.slice(0, 2), 'b').construct, 'b');
  assert.equal(E.mainError([], 'b'), null);
});
