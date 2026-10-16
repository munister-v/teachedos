#!/usr/bin/env node
/* Builds backend/data/onboarding-starters.json: the starter boards offered by
   the teacher onboarding ("Start from a template").

   Nothing here is written for the onboarding. Each starter is one of the
   ready-made Lesson Packs (scripts/lesson-packs-app.js, the library the
   teacher already has on lesson-packs.html), laid out on a board exactly the
   way "Open on board" does it: packToLessonFlow() turns the pack into stages,
   goals and vocabulary, and the card layout below is the one of
   buildLessonFlowCards() in scripts/board-app.js (frame, overview, goals,
   useful language when the pack has any, one lesson card per stage, homework). Cards the pack has nothing for (vocabulary,
   a rubric, teacher notes) are left out.

   Both source functions are pulled out of their files by name and run in an
   empty vm context, so the pack text is never copied by hand and a change to a
   pack reaches the starter the next time this script runs:

       node scripts/build-onboarding-starters.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'scripts/lesson-packs-app.js'), 'utf8');
const lines = src.split('\n');

const start = lines.findIndex(l => l.startsWith('const PACKS = ['));
if (start < 0) throw new Error('PACKS not found in lesson-packs-app.js');
let end = start;
while (!/^\];/.test(lines[end])) end++;
const chunks = [lines.slice(start, end + 1).join('\n')];
for (const fn of ['_lpSections', '_lpPickSection', '_lpBullets', 'packToLessonFlow']) {
  const a = lines.findIndex(l => l.startsWith('function ' + fn + '('));
  if (a < 0) throw new Error(fn + ' not found in lesson-packs-app.js');
  let b = a;
  while (!/^}/.test(lines[b])) b++;
  chunks.push(lines.slice(a, b + 1).join('\n'));
}
const ctx = {};
vm.createContext(ctx);
vm.runInContext(chunks.join('\n') + '\n;globalThis.__X = { PACKS, packToLessonFlow };', ctx);
const { PACKS, packToLessonFlow } = ctx.__X;

/* The six on offer: two grammar, vocabulary, speaking x2, writing - the skills
   a general English teacher meets in a first week, from A2 to B2. */
const CHOSEN = [
  ['gr-articles', 'Students work out when to use a, an, the or nothing, then practise with targeted exercises.'],
  ['gr-present-perfect', 'Students contrast Present Perfect with Past Simple and practise choosing between them.'],
  ['voc-everyday-phrases', 'Students learn everyday phrases and idioms and use them in short exchanges.'],
  ['sp-small-talk', 'Students practise opening, keeping up and closing a small-talk conversation.'],
  ['sp-discussions', 'Students learn the language of opinions and disagreement, then hold a discussion.'],
  ['wr-formal-email', 'Students study a model formal email and write their own.'],
];

const SKILL_OF = { grammar: 'Grammar', vocabulary: 'Vocabulary', speaking: 'Speaking', writing: 'Writing', reading: 'Reading', pronunciation: 'Pronunciation' };
const normSkill = s => {
  s = String(s || '').toLowerCase();
  if (s.includes('grammar')) return 'Grammar';
  if (s.includes('vocab')) return 'Vocabulary';
  if (s.includes('read')) return 'Reading';
  if (s.includes('writ')) return 'Writing';
  if (s.includes('listen')) return 'Listening';
  if (s.includes('feedback') || s.includes('assessment')) return 'Grammar';
  return 'Speaking';
};

/* Layout of buildLessonFlowCards(), with the board centred on (700, 420). */
function layout(lesson) {
  let nextId = 1;
  let z = 0;
  const cards = [];
  const add = (type, x, y, data, w, h) => {
    const base = type === 'text'
      ? { textColor: '#24282C', bgColor: 'transparent', fontFamily: 'var(--font)', fontSize: 16, align: 'left', ...data }
      : { ...data };
    const card = { id: 'c' + (nextId++), type, x, y, w, h, z: type === 'frame' ? 0 : ++z, data: base, color: null };
    cards.push(card);
    return card;
  };
  const baseX = 700 - 520, baseY = 420 - 360;
  const stages = lesson.stages.slice(0, 9);
  const objectives = String(lesson.objectives || '').split(/\n+/).map(t => t.trim()).filter(Boolean).map(text => ({ text, done: false }));
  const vocabItems = String(lesson.vocab || '').split(/\n+/).map(t => t.trim()).filter(Boolean).slice(0, 8);
  const frameW = Math.max(1180, Math.min(1600, 380 + Math.min(stages.length, 3) * 300));
  const frameH = 850 + Math.max(0, Math.ceil((stages.length - 6) / 3)) * 230;
  add('frame', baseX - 40, baseY - 50, { title: lesson.title, bg: '#ffffff', border: 'rgba(205,246,73,.42)' }, frameW, frameH);
  const overview = add('text', baseX, baseY, {
    text: lesson.title + '\n' + [lesson.level, lesson.skill, lesson.format, lesson.duration + ' min'].filter(Boolean).join(' / ') + '\n\n' + (lesson.brief || ''),
    bgColor: '#ffffff', textColor: '#24282C', align: 'left',
  }, 360, 210);
  const goals = add('checklist', baseX, baseY + 240, {
    title: 'Lesson goals',
    items: (objectives.length ? objectives : [{ text: 'Set a clear lesson objective', done: false }]).slice(0, 5),
  }, 320, 210);
  const vocab = vocabItems.length ? add('text', baseX, baseY + 480, {
    text: 'Useful language\n\n' + vocabItems.join('\n'),
    bgColor: '#ffffff', textColor: '#24282C', align: 'left',
  }, 320, 240) : null;
  const created = stages.map((stage, i) => add('lesson', baseX + 410 + (i % 3) * 300, baseY + Math.floor(i / 3) * 250, {
    title: (i + 1) + '. ' + (stage.name || ('Stage ' + (i + 1))),
    status: i ? 'available' : 'in-progress',
    level: lesson.level || 'B1',
    skill: normSkill(stage.mode || lesson.skill || 'Speaking'),
    duration: (stage.min || 10) + ' min',
    desc: stage.student || stage.teacher || '',
    objectives: objectives.slice(0, 3),
    notes: stage.teacher || '',
    module: lesson.title,
  }, 270, 220));
  const belowY = baseY + Math.ceil(Math.max(stages.length, 1) / 3) * 250 + 20;
  const homework = add('assignment', baseX + 410, belowY, {
    title: 'Homework: ' + lesson.title, type: 'Mixed', maxScore: 20,
    desc: lesson.homework || 'Add homework instructions.', total: 0, submitted: 0, level: lesson.level || 'B1', timeLimit: 30,
  }, 300, 185);
  /* buildLessonFlowCards() also joins the cards with a chain of arrows. In a
     board that is a first impression they only add loops across the frame, so
     the starters keep the layout and leave the arrows out. */
  const arrows = [];
  return {
    pan: { x: 120, y: 20 }, scale: 0.65, nextId, cards, arrows, groups: [], strokes: [], annotations: [],
    canvas: { tone: 'light' },
  };
}

const out = CHOSEN.map(([id, studentsDo]) => {
  const pack = PACKS.find(p => p.id === id);
  if (!pack) throw new Error('Lesson pack not found: ' + id);
  const lesson = packToLessonFlow(pack);
  const board = layout(lesson);
  const minutes = parseInt(String(pack.duration).match(/\d+/)?.[0], 10) || lesson.duration;
  return {
    id: 'pack:' + id,
    pack_id: id,
    title: pack.title,
    skill: SKILL_OF[pack.skill] || normSkill(pack.skill),
    level: pack.level,
    minutes,
    students_do: studentsDo,
    outline: lesson.stages.slice(0, 9).map(s => ({ name: s.name, min: s.min })),
    board,
  };
});

const file = path.join(root, 'backend/data/onboarding-starters.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${out.length} starters (${(fs.statSync(file).size / 1024).toFixed(0)} KB) to ${path.relative(root, file)}`);
for (const s of out) console.log(' ', s.id.padEnd(28), s.skill.padEnd(11), s.level, s.minutes + ' min', s.board.cards.length + ' cards');
