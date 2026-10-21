'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../lib/duel');

const pool = ['bargain', 'hesitate', 'drift', 'lantern', 'glacier', 'fjord', 'cuisine', 'roughly'].map(w => ({ word: w, translation: w + '-tr', example: `They said the ${w} was lovely.` }));

test('verb hunt: the meaning is the prompt, the right word is among four options', () => {
  const qs = d.buildQuestions('verb-hunt', pool, 7);
  assert.equal(qs.length, 8);
  qs.forEach(q => { assert.equal(q.options.length, 4); assert.ok(q.options[q.answer]); assert.ok(q.prompt.endsWith('-tr')); assert.equal(q.prompt, q.options[q.answer] + '-tr'); });
});

test('sentence cage: the word is cut out of its sentence; words without a sentence are not used', () => {
  const mixed = pool.map((p, i) => i < 3 ? { ...p, example: '' } : p);
  const qs = d.buildQuestions('sentence-cage', mixed, 3);
  assert.equal(qs.length, 5);
  qs.forEach(q => { assert.ok(q.prompt.includes('_____')); assert.ok(!q.prompt.toLowerCase().includes(q.options[q.answer])); });
});

test('too few words or too few usable ones: no duel', () => {
  assert.equal(d.buildQuestions('verb-hunt', pool.slice(0, 3)), null);
  assert.equal(d.buildQuestions('sentence-cage', pool.map(p => ({ ...p, example: '' }))), null);
  assert.equal(d.buildQuestions('nope', pool), null);
});

test('the same seed makes the same duel; the client never sees the answers', () => {
  const a = d.buildQuestions('verb-hunt', pool, 11), b = d.buildQuestions('verb-hunt', pool, 11);
  assert.deepEqual(a, b);
  assert.ok(d.publicQuestions(a).every(q => !('answer' in q)));
});

test('scoring and the winner: more right wins, speed breaks a tie, equal is a draw', () => {
  const qs = d.buildQuestions('verb-hunt', pool, 5);
  const right = qs.map(q => q.answer), wrong = qs.map(q => (q.answer + 1) % 4);
  assert.equal(d.scoreAnswers(qs, right), 8);
  assert.equal(d.scoreAnswers(qs, wrong), 0);
  assert.equal(d.scoreAnswers(qs, null), 0);
  assert.equal(d.decide({ challenger_score: 5, opponent_score: 3, challenger_ms: 9, opponent_ms: 1 }), 'challenger');
  assert.equal(d.decide({ challenger_score: 4, opponent_score: 4, challenger_ms: 70000, opponent_ms: 72000 }), 'challenger');
  assert.equal(d.decide({ challenger_score: 4, opponent_score: 4, challenger_ms: 72000, opponent_ms: 70000 }), 'opponent');
  assert.equal(d.decide({ challenger_score: 4, opponent_score: 4, challenger_ms: 5, opponent_ms: 5 }), 'draw');
});
