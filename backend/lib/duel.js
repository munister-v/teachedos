/* Duels between classmates. Both play the same questions, built from words they both
   have; whoever answers more of them right wins, the faster one breaks a tie.
   The questions are made once, when the duel is thrown, and kept on the server with their
   right answers - the client only ever receives the prompts and the options. */

const GAMES = {
  'verb-hunt': { label: 'Verb Hunt', how: 'You see the meaning - hunt down the word.' },
  'sentence-cage': { label: 'Sentence Cage', how: 'A word is missing from the sentence - put it back.' },
};
const QUESTIONS = 8;
const MIN_QUESTIONS = 4;
const WIN_XP = 60, LOSE_XP = 10, DRAW_XP = 30, FORFEIT_XP = 20;

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (arr, rnd) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* pool: [{ word, translation, example }] -> [{ prompt, options, answer }] or null when there is too little to play */
function buildQuestions(game, pool, seed = Date.now()) {
  const rnd = mulberry32(seed >>> 0);
  const words = [...new Map(pool.filter(p => p.word && String(p.word).trim()).map(p => [String(p.word).toLowerCase(), p])).values()];
  if (!GAMES[game] || words.length < 4) return null;
  const usable = words.filter(p => game === 'verb-hunt'
    ? String(p.translation || '').trim()
    : p.example && new RegExp('\\b' + escRe(p.word) + '\\b', 'i').test(p.example));
  const picked = shuffle(usable, rnd).slice(0, QUESTIONS);
  if (picked.length < MIN_QUESTIONS) return null;
  return picked.map(p => {
    const others = shuffle(words.filter(o => o !== p), rnd).slice(0, 3).map(o => o.word);
    const options = shuffle([p.word, ...others], rnd);
    const prompt = game === 'verb-hunt'
      ? p.translation
      : p.example.replace(new RegExp('\\b' + escRe(p.word) + '\\b', 'i'), '_____');
    return { prompt, options, answer: options.indexOf(p.word) };
  });
}

/* what the client may see */
const publicQuestions = qs => qs.map((q, i) => ({ i, prompt: q.prompt, options: q.options }));

/* choices: [index|null per question] -> number right */
function scoreAnswers(qs, choices) {
  if (!Array.isArray(choices)) return 0;
  return qs.reduce((n, q, i) => n + (Number(choices[i]) === q.answer ? 1 : 0), 0);
}

/* both scores in -> 'challenger' | 'opponent' | 'draw' */
function decide(d) {
  if (d.challenger_score > d.opponent_score) return 'challenger';
  if (d.challenger_score < d.opponent_score) return 'opponent';
  if (d.challenger_ms < d.opponent_ms) return 'challenger';
  if (d.challenger_ms > d.opponent_ms) return 'opponent';
  return 'draw';
}

module.exports = { GAMES, QUESTIONS, MIN_QUESTIONS, WIN_XP, LOSE_XP, DRAW_XP, FORFEIT_XP, buildQuestions, publicQuestions, scoreAnswers, decide };
