/* Deriving exercises from the teacher's own text, without a model.

   The rule engine used to fabricate the language it needed: definitions ("A
   useful B1 word or phrase for discussing X"), distractors ("An unrelated
   detail", "A grammar-only answer"), even whole reading texts ("Sentence 1:
   airport appears naturally in a classroom-friendly context"). Inventing prose
   is the one thing a rule engine cannot do, so all of it came out unusable -
   and two of them came out broken as exercises, not merely flat. A matching
   task whose right-hand column is the same sentence six times has no answer at
   all. A true/false item that reports "false" after a substitution which never
   applied is not flat, it is wrong: the old code replaced always|never|often|
   sometimes and claimed falsity regardless, so any sentence without one of
   those four adverbs was published verbatim and marked false.

   Everything here works the other way round: it REUSES the language the
   teacher supplied. A gap is a real sentence with a real word taken out. A
   false statement is a real sentence carrying a mutation that provably
   contradicts it. Matching halves are real clauses. Correctness then follows
   from the source instead of from a model, which is the whole point - the
   model is needed for prose, and for prose the caller should still prefer it.

   Nothing here throws and nothing here guesses. Every builder returns null
   when the source will not support a sound item, and the caller is expected to
   drop that item rather than ship a broken one. Returning null is the normal
   case, not the error case: most sentences cannot be turned into most
   exercises, and that is fine when there are twelve more to try. */

const WORD_RE = /[A-Za-z][A-Za-z'’-]*/g;

// Shared with the caller's own word-ranking so the two cannot drift apart.
const STOPWORDS = new Set(('about above actually after again against almost already also although always among another anything around because been before being below between both cannot could didn does doesn doing done down during each either else enough even ever every everything from further gonna gotta guys have having here hers herself himself into itself just keep kind know like little long look made make many maybe mean might more most much must myself need never next nothing okay once only other ours ourselves over own people perhaps place probably quite rather really right said same says seem seen several shall should show since some something sometimes soon still such sure take than that thats their theirs them themselves then there these they thing things think this those though thought three through thus time together told too took under until upon used using very want was wasn way well went were what when where whether which while who whom whose why will with within without won would yeah yes yet you your yours yourself').split(' '));

function clean(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countWords(text) {
  return clean(text).split(/\s+/).filter(Boolean).length;
}

/* Crude suffix stripping, deliberately not a real stemmer. Its only job is to
   stop an inflection of the answer being offered as a distractor next to it -
   "travel" against "travels" is not a choice a student can reason about. */
function stem(word) {
  return String(word).toLowerCase()
    .replace(/(ies|ied)$/, 'y')
    .replace(/(es|ed|ing|s)$/, '');
}

function matchCase(original, replacement) {
  const o = String(original);
  if (o === o.toUpperCase() && o.length > 1) return replacement.toUpperCase();
  if (o[0] === o[0]?.toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

/* Words worth building a task around: repeated, substantial, not function
   words. Repetition is the signal - a word the source keeps coming back to is
   what the text is actually about, whereas document order just returns whatever
   the speaker said in their opening seconds. */
function contentWords(text, limit = 40) {
  const freq = new Map();
  (String(text || '').toLowerCase().match(WORD_RE) || []).forEach(w => {
    if (w.length < 4 || STOPWORDS.has(w)) return;
    freq.set(w, (freq.get(w) || 0) + 1);
  });
  return [...freq.entries()]
    .sort((a, b) => (b[1] * 10 + b[0].length) - (a[1] * 10 + a[0].length))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

/* Blank a word out of a real sentence.

   Two refusals matter. A sentence with too few words gives nothing to infer
   the answer from, so the gap is a guess rather than a reading task. And a word
   occurring more than once cannot be blanked: whichever copy is removed, the
   other is still on the page, so the "answer" is sitting in the question. */
function gapSentence(sentence, word, blank = '_____') {
  const s = clean(sentence);
  if (!s || !word) return null;
  if (countWords(s) < 8) return null;
  const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
  const hits = s.match(re);
  if (!hits || hits.length !== 1) return null;
  // The answer keeps the source's own casing - it is what the student writes.
  return { text: s.replace(re, blank), answer: hits[0] };
}

/* Choose what to blank: the teacher's own target words first, since those are
   the ones the lesson is for, then the most salient word in the sentence.

   `taken` lets a caller building several exercises from one text skip words it
   has already used. Without it a sentence only ever offers its single
   highest-ranked word, so a worksheet whose first part claimed that word could
   not build a second part from the same sentences - it silently came out with
   two sections instead of three. A sentence usually has another word worth
   removing; this just asks for the next one. */
function pickGapTarget(sentence, preferred = [], pool = [], taken = null) {
  const isTaken = (w) => {
    if (!taken) return false;
    const key = String(w).toLowerCase();
    return typeof taken.has === 'function' ? taken.has(key) : false;
  };
  for (const w of preferred) {
    if (isTaken(w)) continue;
    const built = gapSentence(sentence, w);
    if (built) return { word: w, ...built };
  }
  for (const entry of pool) {
    const w = typeof entry === 'string' ? entry : entry.word;
    if (isTaken(w)) continue;
    const built = gapSentence(sentence, w);
    if (built) return { word: w, ...built };
  }
  return null;
}

/* A word's ending, used as a cheap stand-in for its part of speech. There is no
   tagger here and it would be the wrong dependency for the gain: the only
   decision it informs is which distractors sit beside an answer, and matching
   "-ed" to "-ed" already stops the obvious tell of offering two verbs against a
   noun. Order matters - the longer endings have to be tested before "s". */
const SUFFIXES = ['tion', 'sion', 'ment', 'ness', 'ance', 'ence', 'ing', 'est', 'ed', 'ly', 'er', 's'];

function suffixClass(word) {
  const w = String(word).toLowerCase();
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length > suf.length + 2) return suf;
  }
  return '';
}

/* Wrong options for a cloze answer, drawn from the same text.

   Drawn from the same text on purpose: a distractor from the source is on-topic
   and the same register, so eliminating it requires reading the sentence. The
   old generic options ("An unrelated detail") could be eliminated without
   reading anything, which makes the item free marks. */
function distractors(answer, pool, n = 3, avoidIn = '') {
  const answerStem = stem(answer);
  const target = String(answer).length;
  const avoid = clean(avoidIn).toLowerCase();
  const seen = new Set([answerStem]);
  const out = [];
  for (const entry of pool) {
    const w = typeof entry === 'string' ? entry : entry.word;
    if (!w) continue;
    const key = stem(w);
    if (seen.has(key)) continue;                 // the answer itself, or an inflection of it
    // A word already visible in the stem is eliminable without thinking, and
    // worse, can read as a second correct answer.
    if (avoid && new RegExp(`\\b${escapeRegExp(w.toLowerCase())}\\b`).test(avoid)) continue;
    seen.add(key);
    out.push(w);
  }
  // Same ending first, then closest in length: a one-syllable option beside a
  // long answer gives the shape of the answer away, and a verb beside a noun
  // gives away more than that.
  const answerClass = suffixClass(answer);
  return out
    .sort((a, b) =>
      (suffixClass(a) === answerClass ? 0 : 1) - (suffixClass(b) === answerClass ? 0 : 1)
      || Math.abs(a.length - target) - Math.abs(b.length - target))
    .slice(0, n);
}

/* Pairs whose members contradict each other in any context, so swapping one
   for the other cannot accidentally leave the sentence true. Deliberately
   excludes near-opposites ("big"/"small" - a thing can be both, relative to
   different comparisons) and anything scalar enough to argue about. */
const OPPOSITES = [
  ['always', 'never'], ['never', 'always'],
  // Swapped in place, so both members must sit in the SAME adverb slot.
  // "every day" → "never" typechecks as an opposite and still produces
  // "Cyclists use the new lanes never": end-position adverbial, mid-position
  // replacement. Paired with another end-position phrase it stays English.
  ['every day', 'once a month'], ['often', 'rarely'], ['rarely', 'often'],
  ['all', 'none'], ['everyone', 'nobody'], ['nobody', 'everyone'],
  ['everything', 'nothing'], ['nothing', 'everything'],
  ['increased', 'decreased'], ['decreased', 'increased'],
  ['increase', 'decrease'], ['decrease', 'increase'],
  ['rose', 'fell'], ['fell', 'rose'],
  ['before', 'after'], ['after', 'before'],
  ['began', 'ended'], ['ended', 'began'],
  ['first', 'last'], ['last', 'first'],
  ['more', 'fewer'], ['fewer', 'more'],
  ['possible', 'impossible'], ['impossible', 'possible'],
  ['legal', 'illegal'], ['illegal', 'legal'],
  ['agreed', 'refused'], ['refused', 'agreed'],
  ['accepted', 'rejected'], ['rejected', 'accepted'],
];

// Auxiliaries and modals. Negation is attached to one of these because "not"
// after an auxiliary is always grammatical, whereas dropping it in front of a
// main verb ("he not went") is not English.
const AUXILIARIES = ['is', 'are', 'was', 'were', 'has', 'have', 'had',
  'can', 'could', 'will', 'would', 'should', 'must', 'does', 'do', 'did'];

/* Turn a true sentence into one the source contradicts.

   Returns null when none of the strategies apply, and the caller must then keep
   the sentence as a TRUE item. That null is the fix for the original bug: the
   old code asserted falsity whether or not its substitution had fired. */
function falsify(sentence) {
  const s = clean(sentence).replace(/\s+([.!?])$/, '$1');
  if (!s || countWords(s) < 5) return null;

  // 1. A polar opposite reads most naturally - the sentence still sounds like
  //    the text, which is what makes the item worth doing.
  for (const [from, to] of OPPOSITES) {
    const re = new RegExp(`\\b${from}\\b`, 'i');
    const m = s.match(re);
    if (m) return { text: s.replace(re, matchCase(m[0], to)), how: 'opposite' };
  }

  // 2. A changed number contradicts the text without disturbing its grammar.
  const num = s.match(/\b(\d{1,4})\b/);
  if (num) {
    const raw = num[1];
    const n = parseInt(raw, 10);
    // A year has to stay a year. Scaling 2019 by half again gives 3029, which a
    // student rejects without reading the text at all - the same free marks the
    // generic distractors used to hand out.
    const isYear = /^(1[5-9]\d\d|20\d\d|21\d\d)$/.test(raw);
    const swapped = isYear ? String(n - 4)
      : String(n < 10 ? n + 3 : Math.round(n * 1.5));
    if (swapped !== raw) {
      return { text: s.replace(new RegExp(`\\b${raw}\\b`), swapped), how: 'number' };
    }
  }

  // 3. Negate an auxiliary. Skipped where the sentence is already negative:
  //    a second negative makes the item a puzzle about grammar rather than a
  //    check on comprehension, and often flips the meaning back.
  if (!/\bnot\b|n['’]t\b|\bno\b|\bnever\b/i.test(s)) {
    for (const aux of AUXILIARIES) {
      const re = new RegExp(`\\b(${aux})\\b`, 'i');
      const m = s.match(re);
      if (m) return { text: s.replace(re, `${m[1]} not`), how: 'negate' };
    }
  }

  return null;
}

/* Split a sentence where a clause actually begins, for matching halves.

   The marker stays with the right-hand half because it is the cue the student
   matches on - "so property prices rose" is findable, "property prices rose"
   next to five other bare clauses is not. */
const CLAUSE_MARKERS = [', which', ', so', ', but', ', because', ', and', ', while',
  ' because ', ' so that ', ' which ', ' although ', ' whereas ', ' unless ',
  ' in order to ', ' but ', ' while ', ' when ', ' if '];

function halves(sentence, minWords = 3) {
  const s = clean(sentence).replace(/[.!?]+$/, '');
  const low = s.toLowerCase();
  for (const marker of CLAUSE_MARKERS) {
    const at = low.indexOf(marker);
    if (at <= 0) continue;
    const cut = marker.startsWith(',') ? at + 1 : at;
    const left = s.slice(0, cut).replace(/,\s*$/, '').trim();
    const right = s.slice(cut).replace(/^,\s*/, '').trim();
    if (countWords(left) >= minWords && countWords(right) >= minWords) return [left, right];
  }
  return null;
}

/* Scramble a sentence for word-order practice.

   Bounded at both ends: under four words there is nothing to reorder, and past
   twelve the task stops being about syntax and becomes clerical. The result is
   checked against the original because a shuffle that happens to reproduce the
   sentence is not an exercise. */
function scramble(sentence, rand = Math.random) {
  const s = clean(sentence).replace(/[.!?]+$/, '');
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length < 4 || parts.length > 12) return null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const a = parts.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.join(' ') !== parts.join(' ')) return { tokens: a, answer: s };
  }
  return null;
}

/* A shuffle seeded from the item's own text.

   Seeded rather than random because the old local MCQ put the answer first in
   every single item - the key was "A" all the way down - and the obvious fix,
   Math.random, trades that for a worksheet that differs between the teacher's
   screen and their printout once the cache expires. Deriving the seed from the
   text means the same source always lays out the same way. */
function seeded(str) {
  const s = String(str);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function rand() {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* The real sentence a word appears in - the example that replaces "In X,
   'word' helps students explain idea 3." Prefers a sentence with enough around
   the word to show how it behaves. */
function exampleFor(word, sentences) {
  const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  const hits = sentences.filter(s => re.test(s));
  if (!hits.length) return null;
  return hits.sort((a, b) => {
    const score = (t) => (countWords(t) >= 8 && countWords(t) <= 28 ? 0 : 1);
    return score(a) - score(b) || a.length - b.length;
  })[0];
}

module.exports = {
  STOPWORDS,
  clean,
  countWords,
  escapeRegExp,
  stem,
  contentWords,
  gapSentence,
  pickGapTarget,
  distractors,
  falsify,
  halves,
  scramble,
  exampleFor,
  seeded,
  shuffle,
  suffixClass,
};
