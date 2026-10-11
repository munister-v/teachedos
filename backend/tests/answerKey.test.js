'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { filterBoardData } = require('../lib/boardVisibility');
const { checkAnswer, stripAnswers } = require('../lib/answerKey');
const { viewFor } = require('../ws');

/* Answer values are unique tokens, so "the student's payload contains no
   answers" is a substring check over the JSON that would go on the wire. A
   multiple-choice answer is one of its options by nature, so those are
   checked field by field instead. */
function quiz(extra) {
  return {
    id: 'ws1', type: 'worksheet', x: 0, y: 0, w: 600, h: 400,
    data: Object.assign({
      title: 'B1 · Quiz',
      _interactive: true,
      _state: { mcq: { 0: 'TEACHER_PICKED_ANS_MCQ' } },
      questions: [
        { type: 'mcq', text: 'Pick one', options: ['wrong one', 'ANS_MCQ', 'another'], answer: 'ANS_MCQ', points: 1 },
        { type: 'truefalse', text: 'The sky is green', answer: false, explanation: 'ANS_EXPLAINED' },
        { type: 'gap-fill', text: 'I ___ to school.', answer: 'ANS_GAP' },
        { type: 'open', text: 'What does "it" refer to?', answer: 'ANS_OPEN' },
        { type: 'match', text: 'Match', pairs: [
          { left: 'cat', right: 'meows' }, { left: 'dog', right: 'barks' },
          { left: 'cow', right: 'moos' }, { left: 'owl', right: 'hoots', img: { url: 'owl.jpg' } },
        ] },
        { type: 'mcq', text: 'Objects', options: [{ text: 'a' }, { text: 'ANS_OBJ', correct: true }] },
        { type: 'open', text: 'Tell me about your weekend' },
      ],
      _titleChoice: { text: 'Best title?', options: ['ANS_TITLE', 'Other'], answer: 'ANS_TITLE' },
    }, extra || {}),
  };
}

const ANSWERS = ['ANS_GAP', 'ANS_OPEN', 'ANS_EXPLAINED', 'TEACHER_PICKED', '"correct"'];
const leaks = payload => {
  const json = JSON.stringify(payload);
  return ANSWERS.filter(a => json.includes(a));
};

test('a student receives a worksheet without any answer values', () => {
  const board = { cards: [quiz()] };
  const view = filterBoardData(board, 'student', 'teacher');
  assert.deepEqual(leaks(view), []);
  const qs = view.cards[0].data.questions;
  // Still playable: questions, options and match sides are all there.
  assert.deepEqual(qs[0].options, ['wrong one', 'ANS_MCQ', 'another']);
  assert.equal(qs[0].answer, undefined);
  assert.equal(qs[1].answer, undefined);
  assert.equal(qs[0]._ref, 'questions.0');
  assert.equal(qs[4]._ref, 'questions.4');
  assert.equal(view.cards[0].data._titleChoice.answer, undefined);
  assert.equal(view.cards[0].data._titleChoice._ref, '_titleChoice');
  // A question without a key is left exactly as it was.
  assert.equal(qs[6], board.cards[0].data.questions[6]);
  // The stored board is not modified.
  assert.equal(board.cards[0].data.questions[0].answer, 'ANS_MCQ');
});

test('matching keeps both sides but not the pairing', () => {
  const view = filterBoardData({ cards: [quiz()] }, 'student', 'teacher');
  const pairs = view.cards[0].data.questions[4].pairs;
  const orig = quiz().data.questions[4].pairs;
  assert.deepEqual(pairs.map(p => p.left), orig.map(p => p.left));
  assert.deepEqual(pairs.map(p => p.right).sort(), orig.map(p => p.right).sort());
  assert.ok(pairs.some((p, i) => p.right !== orig[i].right), 'right column was reordered');
  // A picture travels with its right-hand side.
  assert.equal(pairs.find(p => p.right === 'hoots').img.url, 'owl.jpg');
  // Same order on every send, so the card does not reshuffle on each patch.
  const again = filterBoardData({ cards: [quiz()] }, 'other-student', 'teacher');
  assert.deepEqual(again.cards[0].data.questions[4].pairs, pairs);
});

test('the owner gets the stored card untouched, and so does the class once the key is shown', () => {
  const board = { cards: [quiz()] };
  assert.equal(filterBoardData(board, 'teacher', 'teacher'), board);
  const shared = { cards: [quiz({ keyShared: true })] };
  assert.equal(filterBoardData(shared, 'student', 'teacher'), shared);
  // keyShared must be exactly true.
  assert.deepEqual(leaks(filterBoardData({ cards: [quiz({ keyShared: 'yes' })] }, 'student', 'teacher')), []);
});

test('only worksheet cards are touched', () => {
  const card = Object.assign(quiz(), { type: 'game' });
  const board = { cards: [card] };
  assert.equal(filterBoardData(board, 'student', 'teacher'), board);
});

test('worksheets nested in a lesson path lose their answers too', () => {
  const card = {
    id: 'path', type: 'worksheet',
    data: { _wfPath: { assigned: [], steps: [{ role: 'task', out: { tasks: [
      { title: 'Check', questions: [{ type: 'mcq', text: 'Q', options: ['x', 'ANS_MCQ'], answer: 'ANS_MCQ' }] },
      { title: 'Dictation', _tool: 'listening-dictation', questions: [{ type: 'gap-fill', text: 'Say ___', answer: 'SPOKEN' }] },
    ] } }] } },
  };
  const view = filterBoardData({ cards: [card] }, 'student', 'teacher');
  const tasks = view.cards[0].data._wfPath.steps[0].out.tasks;
  assert.deepEqual(leaks(view), []);
  assert.equal(tasks[0].questions[0].answer, undefined);
  assert.equal(tasks[0].questions[0]._ref, '_wfPath.steps.0.out.tasks.0.questions.0');
  // Dictation is read aloud by the browser - it has to keep its sentence.
  assert.equal(tasks[1].questions[0].answer, 'SPOKEN');
});

test('a sheet of blank gap-fills gets a word bank that does not say which blank is which', () => {
  const card = { id: 'g', type: 'worksheet', data: { questions: [
    { type: 'gap-fill', text: 'I ___ tea.', answer: 'drink' },
    { type: 'gap-fill', text: 'She ___ home.', answer: 'walks' },
    { type: 'gap-fill', text: 'They ___ late.', answer: 'arrive' },
  ] } };
  const data = filterBoardData({ cards: [card] }, 'student', 'teacher').cards[0].data;
  assert.deepEqual(data.questions.map(q => q.answer), [undefined, undefined, undefined]);
  assert.deepEqual(data._gapBank.map(w => w.a).sort(), ['arrive', 'drink', 'walks']);
  assert.ok(data._gapBank.every(w => Object.keys(w).sort().join() === 'a,m'));
  // Mixed sheets (no drag bank in Play) get none.
  assert.equal(stripAnswers(quiz()).data._gapBank, undefined);
});

test('held-back and private rules still win over key stripping', () => {
  const hidden = quiz({ studentHidden: true });
  const view = filterBoardData({ cards: [hidden] }, 'student', 'teacher');
  assert.deepEqual(view.cards[0].data, { hiddenForViewer: true });
});

test('every websocket board message a student receives is stripped', () => {
  const state = { cards: [quiz()], arrows: [] };
  const patch = viewFor({ type: 'board_patch', state }, 'student', 'teacher');
  assert.deepEqual(leaks(patch), []);
  const legacy = viewFor({ type: 'board_patch', data: state }, 'student', 'teacher');
  assert.deepEqual(leaks(legacy), []);
  for (const type of ['card_add', 'card_update']) {
    const msg = viewFor({ type, card: quiz() }, 'student', 'teacher');
    assert.deepEqual(leaks(msg), [], type);
    assert.equal(msg.card.data.questions[0].options.length, 3);
  }
  // The teacher's own echo keeps everything.
  assert.equal(viewFor({ type: 'card_update', card: quiz() }, 'teacher', 'teacher').card.data.questions[0].answer, 'ANS_MCQ');
});

test('Play checks one answer at a time against the stored card', () => {
  const stored = quiz().data;
  const student = stripAnswers(quiz()).data;
  const ref = i => student.questions[i]._ref;

  assert.deepEqual(checkAnswer(stored, ref(0), 'ANS_MCQ'), { ok: true, answer: 'ANS_MCQ' });
  assert.deepEqual(checkAnswer(stored, ref(0), 'wrong one'), { ok: false, answer: 'ANS_MCQ' });
  assert.deepEqual(checkAnswer(stored, ref(1), 'false'), { ok: true, answer: 'false' });
  assert.deepEqual(checkAnswer(stored, ref(1), 'true'), { ok: false, answer: 'false' });
  // A gap learns right or wrong, not the word.
  assert.deepEqual(checkAnswer(stored, ref(2), '  ans_gap '), { ok: true });
  assert.deepEqual(checkAnswer(stored, ref(2), 'went'), { ok: false });
  // Matching: is this left on this right? (also sorting into a category)
  assert.deepEqual(checkAnswer(stored, ref(4), 'owl', 'hoots'), { ok: true });
  assert.deepEqual(checkAnswer(stored, ref(4), 'owl', 'barks'), { ok: false });
  assert.deepEqual(checkAnswer(stored, student._titleChoice._ref, 'Other'), { ok: false, answer: 'ANS_TITLE' });
});

test('the check refuses anything that is not a question of that card', () => {
  const stored = quiz().data;
  assert.equal(checkAnswer(stored, 'questions.99', 'x'), null);
  assert.equal(checkAnswer(stored, 'questions', 'x'), null);
  assert.equal(checkAnswer(stored, '__proto__.constructor', 'x'), null);
  assert.equal(checkAnswer(stored, 'questions.0.options', 'x'), null);
  assert.equal(checkAnswer(stored, 'questions.6', 'anything'), null); // open question without a key
  assert.equal(checkAnswer(stored, '', 'x'), null);
  assert.equal(checkAnswer(stored, null, 'x'), null);
});
