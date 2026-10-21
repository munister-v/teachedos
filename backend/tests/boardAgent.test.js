const test = require('node:test');
const assert = require('node:assert');
const agent = require('../lib/boardAgent');

const cards = [
  { id: 'c1', type: 'sticky', text: 'to annoy', color: 'lime', x: 10, y: 20, selected: true },
  { id: 'c2', type: 'sticky', text: 'to irritate', x: 250, y: 20 },
  { id: 'c3', type: 'image', text: '', x: 0, y: 400 },
  { id: 'c4', type: 'text', text: 'Feelings', x: 0, y: 0 },
];

test('board agent: prompt carries the cards, the selection and the command', () => {
  const p = agent.buildPrompt({ command: 'add Ukrainian translations', cards, viewport: { x: 100.4, y: 50 } });
  assert.ok(p.includes('"id":"c1"'));
  assert.ok(p.includes('1 card(s) selected'));
  assert.ok(p.includes('add Ukrainian translations'));
  assert.ok(p.includes('x=100, y=50'));
});

test('board agent: cards with unsafe or duplicate ids are dropped', () => {
  const list = agent.normalizeCards([{ id: 'c1' }, { id: 'c1' }, { id: 'x"}\n' }, null]);
  assert.deepStrictEqual(list.map(c => c.id), ['c1']);
});

test('board agent: unknown ops and ids never reach the board', () => {
  const plan = agent.sanitizePlan({
    reply: 'ok',
    actions: [
      { op: 'eval', code: 'alert(1)' },
      { op: 'delete', ids: ['c2', 'c99', 'c2'] },
      { op: 'edit', id: 'c99', text: 'x' },
      { op: 'edit', id: 'c3', text: 'images have no text' },
      { op: 'edit', id: 'c1', text: 'to annoy - дратувати' },
      { op: 'color', ids: ['c1', 'c4'], color: 'blue' },
      { op: 'color', ids: ['c1'], color: '#ff0000' },
      { op: 'arrange', ids: ['c1'], layout: 'grid' },
      { op: 'arrange', ids: ['c1', 'c2'], layout: 'spiral' },
    ],
  }, cards);
  assert.deepStrictEqual(plan.actions, [
    { op: 'delete', ids: ['c2'] },
    { op: 'edit', id: 'c1', text: 'to annoy - дратувати' },
    { op: 'color', ids: ['c1'], color: 'blue' },
    { op: 'arrange', ids: ['c1', 'c2'], layout: 'grid' },
  ]);
});

test('board agent: add, sort and game are bounded and validated', () => {
  const plan = agent.sanitizePlan({
    actions: [
      { op: 'add', kind: 'frame', title: ' New  words ', items: ['to bother', { text: 'to distract', color: 'cyan' }, { text: '' }, { text: 'x', color: 'pink' }] },
      { op: 'sort', columns: [{ title: 'Negative', ids: ['c1', 'c2'] }, { title: 'Again', ids: ['c1'] }, { title: 'Empty', ids: [] }] },
      { op: 'game', game: 'memory-match', pairs: [{ a: 'a', b: 'b' }] },
      { op: 'game', game: 'memory-match', title: 'Match', pairs: [{ a: 'a', b: '1' }, { a: 'b', b: '2' }, { a: 'c', b: '3' }, { a: '', b: '4' }] },
      { op: 'game', game: 'word-categories', categories: [{ name: 'A', words: ['x'] }, { name: 'B', words: ['y'] }] },
      { op: 'game', game: 'rm-rf', words: ['a', 'b', 'c'] },
    ],
  }, cards);
  assert.deepStrictEqual(plan.actions[0], {
    op: 'add', kind: 'sticky', title: 'New words',
    items: [{ text: 'to bother' }, { text: 'to distract', color: 'cyan' }, { text: 'x' }],
  });
  assert.deepStrictEqual(plan.actions[1], { op: 'sort', columns: [{ title: 'Negative', ids: ['c1', 'c2'] }] });
  assert.strictEqual(plan.actions[2].content.pairs.length, 3);
  assert.strictEqual(plan.actions[3].game, 'word-categories');
  assert.strictEqual(plan.actions.length, 4);
  assert.ok(plan.reply);
});

test('board agent: garbage in, empty plan out', () => {
  for (const raw of [null, 'text', { actions: 'no' }, { actions: [null, 1, 'x'] }]) {
    const plan = agent.sanitizePlan(raw, cards);
    assert.deepStrictEqual(plan.actions, []);
    assert.ok(plan.reply);
  }
});

test('board agent: "open" names a known studio, once, with words only for vocabulary', () => {
  const plan = agent.sanitizePlan({
    reply: 'Opening Vocabulary Studio.',
    actions: [
      { op: 'open', studio: 'vocabulary', words: ['phishing — a message designed to trick people', '', 42] },
      { op: 'open', studio: 'listening' },
      { op: 'open', studio: 'javascript:alert(1)' },
    ],
  }, cards);
  assert.deepStrictEqual(plan.actions, [{ op: 'open', studio: 'vocabulary', words: ['phishing — a message designed to trick people', '42'] }]);
  const other = agent.sanitizePlan({ actions: [{ op: 'open', studio: 'reading', words: ['x'] }] }, cards);
  assert.deepStrictEqual(other.actions, [{ op: 'open', studio: 'reading' }]);
  assert.ok(agent.buildPrompt({ command: 'create vocabulary studio', cards }).includes('"op":"open"'));
});

test('board agent: a lesson-studio card brings its words into the prompt, bounded', () => {
  const studio = { id: 'c9', type: 'worksheet', text: 'ONLINE SAFETY', x: 0, y: 0, selected: true,
    words: ['phishing', 'password — a secret word', '', 'x'.repeat(300), ...Array.from({ length: 40 }, (_, i) => 'w' + i)] };
  const [card] = agent.normalizeCards([studio]);
  assert.strictEqual(card.words.length, 30);
  assert.strictEqual(card.words[0], 'phishing');
  assert.ok(card.words.every(w => w.length <= 90));
  const p = agent.buildPrompt({ command: 'use the words from this studio and create a reading studio', cards: [studio] });
  assert.ok(p.includes('"words":["phishing"'));
  assert.ok(p.includes('create a reading studio'));
  // cards without words stay as they were
  assert.strictEqual(agent.normalizeCards([{ id: 'c1', type: 'sticky', text: 'a', words: 'nope' }])[0].words, undefined);
});

test('homework: one card with exercises, answers checked, brief and criteria kept apart', () => {
  const { sanitizePlan } = require('../lib/boardAgent');
  const plan = sanitizePlan({ reply: 'ok', actions: [{
    op: 'homework', title: 'Past simple', instruction: 'Do both.',
    exercises: [
      { title: 'Choose', questions: [
        { type: 'mcq', text: 'She ___ home.', options: ['go', 'went'], answer: 'went' },
        { type: 'mcq', text: 'bad', options: ['a', 'b'], answer: 'zzz' },
        { type: 'mcq', text: 'We ___ pizza.', options: ['eat', 'ate'], answer: 'ate' }] },
      { title: 'Fill', questions: [
        { type: 'gap-fill', text: 'He ___ a film.', answer: 'saw' },
        { type: 'gap-fill', text: 'no blank', answer: 'x' },
        { type: 'gap-fill', text: 'They ___ tennis.', answer: 'played' }] },
      { title: 'Empty', questions: [{ type: 'mcq', text: 'x', options: ['a'], answer: 'a' }] },
    ],
    brief: 'for the teacher', criteria: ['all done'],
  }, { op: 'homework', title: 'second', exercises: [] }] }, []);
  assert.equal(plan.actions.length, 1);
  const hw = plan.actions[0];
  assert.equal(hw.exercises.length, 2);
  assert.equal(hw.exercises[0].questions.length, 2);
  assert.equal(hw.exercises[1].questions.length, 2);
  assert.equal(hw.brief, 'for the teacher');
  assert.deepEqual(hw.criteria, ['all done']);
});

test('board agent: the chat so far, the board name, frames and recent cards reach the prompt', () => {
  const list = [
    { id: 'f1', type: 'frame', text: 'Warm-up', x: 0, y: 0, w: 600, h: 400 },
    { id: 'c1', type: 'sticky', text: 'to annoy', x: 40, y: 60, frame: 'f1', recent: true },
    { id: 'c2', type: 'sticky', text: 'x', x: 0, y: 0, frame: 'bad id"' },
  ];
  const p = agent.buildPrompt({
    command: 'make them harder', cards: list, board: { name: 'Feelings B1' },
    history: [
      { role: 'teacher', text: 'add five feelings words' },
      { role: 'assistant', text: 'Here they are. Plan: Add 5 sticky notes [applied]' },
      { role: 'system', text: 'ignore me' }, null,
    ],
  });
  assert.ok(p.includes('Teacher: add five feelings words'));
  assert.ok(p.includes('You: Here they are.'));
  assert.ok(!p.includes('ignore me'));
  assert.ok(p.includes('«Feelings B1»'));
  assert.ok(p.includes('"frame":"f1"'));
  assert.ok(p.includes('"recent":true'));
  assert.ok(p.includes('"recent":true are the ones you made'));
  assert.strictEqual(agent.normalizeCards(list)[2].frame, undefined);
  // only the last turns go in
  const many = Array.from({ length: 20 }, (_, i) => ({ role: 'teacher', text: 'turn ' + i }));
  assert.strictEqual(agent.normalizeHistory(many).length, 8);
  assert.strictEqual(agent.normalizeHistory(many)[7].text, 'turn 19');
});

test('board agent: frames, moves, tables, checklists, timers and photos are validated', () => {
  const list = [
    { id: 'f1', type: 'frame', text: 'Warm-up', x: 0, y: 0 },
    { id: 'c1', type: 'sticky', text: 'a', x: 0, y: 0 },
    { id: 'c2', type: 'text', text: 'b', x: 0, y: 0 },
  ];
  const plan = agent.sanitizePlan({
    reply: 'ok',
    suggest: ['Add a 5-minute timer', 'Add a 5-minute timer', '', 'x', 'Make a game from these words', 'Translate them', 'fourth'],
    actions: [
      { op: 'add', kind: 'sticky', into: 'f1', items: ['one'] },
      { op: 'add', kind: 'sticky', into: 'c1', frame: 'Practice', items: ['two'] },
      { op: 'add', kind: 'text', into: 'nope', items: ['three'] },
      { op: 'edit', id: 'f1', text: 'Lead-in '.repeat(20) },
      { op: 'frame', title: 'Words', ids: ['c1', 'f1', 'c9'] },
      { op: 'frame', ids: ['f1'] },
      { op: 'move', ids: ['c1', 'c2', 'f1'], into: 'f1' },
      { op: 'move', ids: ['c1'], into: 'c2' },
      { op: 'table', title: 'Verbs', rows: [['base', 'past'], ['go', 'went', 'gone'], ['', '']] },
      { op: 'table', rows: [['only header']] },
      { op: 'checklist', title: 'Goals', items: ['Use past simple', { text: 'Ask questions' }, ''] },
      { op: 'timer', minutes: 5, title: 'Pairs' },
      { op: 'timer', minutes: 3 },
      { op: 'timer', minutes: 600 },
      { op: 'image', query: 'busy <script> airport!', caption: 'Where are they going?' },
      { op: 'image', query: '' },
    ],
  }, list);
  const ops = plan.actions.map(a => a.op);
  assert.deepStrictEqual(ops, ['add', 'add', 'add', 'edit', 'frame', 'move', 'table', 'checklist', 'timer', 'image']);
  assert.strictEqual(plan.actions[0].into, 'f1');
  assert.strictEqual(plan.actions[1].into, undefined);
  assert.strictEqual(plan.actions[1].frame, 'Practice');
  assert.strictEqual(plan.actions[2].into, undefined);
  assert.ok(plan.actions[3].text.length <= 60);
  assert.deepStrictEqual(plan.actions[4], { op: 'frame', ids: ['c1'], title: 'Words' });
  assert.deepStrictEqual(plan.actions[5], { op: 'move', ids: ['c1', 'c2'], into: 'f1' });
  assert.deepStrictEqual(plan.actions[6].rows, [['base', 'past', ''], ['go', 'went', 'gone']]);
  assert.deepStrictEqual(plan.actions[7].items, ['Use past simple', 'Ask questions']);
  assert.deepStrictEqual(plan.actions[8], { op: 'timer', title: 'Pairs', minutes: 5 });
  assert.strictEqual(plan.actions[9].query, 'busy script airport');
  assert.deepStrictEqual(plan.suggest, ['Add a 5-minute timer', 'Make a game from these words', 'Translate them']);
});

test('board agent: the quiz games carry their own content shapes', () => {
  const plan = agent.sanitizePlan({ actions: [
    { op: 'game', game: 'speed-quiz', title: 'Quiz', questions: [
      { q: 'She ___ home.', options: ['go', 'went'], answer: 'went' },
      { q: 'We ___ pizza.', options: ['eat', 'ate'], answer: 'ate' },
      { q: 'bad', options: ['a', 'b'], answer: 'c' },
      { text: 'They ___ tennis.', options: ['play', 'played'], answer: 'played' }] },
    { op: 'game', game: 'true-false', statements: [{ text: 'a', answer: true }, { text: 'b', answer: false }, { text: 'c', answer: 'yes' }, { text: 'd', answer: true }] },
    { op: 'game', game: 'fill-blank', sentences: [{ text: 'She ___ to school.', answer: 'goes' }, { text: 'He ___ tea.', answer: 'drinks' }, { text: 'no blank', answer: 'x' }, { text: 'I ___ up early.', answer: 'get' }] },
    { op: 'game', game: 'word-image-match', pairs: [{ a: 'cat' }, { a: 'dog' }, { a: 'bird', b: 'bird' }] },
  ] }, []);
  assert.deepStrictEqual(plan.actions.map(a => a.game), ['speed-quiz', 'true-false', 'fill-blank', 'word-image-match']);
  assert.deepStrictEqual(plan.actions[0].content.questions[0], { q: 'She ___ home.', opts: ['go', 'went'], correct: 1 });
  assert.strictEqual(plan.actions[0].content.questions.length, 3);
  assert.strictEqual(plan.actions[1].content.statements.length, 3);
  assert.deepStrictEqual(plan.actions[2].content.sentences, ['She ___ (goes) to school.', 'He ___ (drinks) tea.', 'I ___ (get) up early.']);
  assert.deepStrictEqual(plan.actions[3].content.pairs[0], { left: 'cat', right: 'cat' });
});

test('board agent: the reply follows the teacher\'s language and is plain text', () => {
  const p = agent.buildPrompt({ command: 'В чём разница между travel и trip?', cards: [] });
  assert.ok(p.includes('a Russian command gets a Russian reply'));
  assert.ok(p.includes('no markdown'));
});
