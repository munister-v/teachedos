const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const aiEngine = require('../lib/aiEngine');
const derive = require('../lib/derive');
const pool = require('../db/pool');

// Persistent daily usage counters (survive restarts; power the dashboard chart).
pool.query(`
  CREATE TABLE IF NOT EXISTS ai_usage_daily (
    day        DATE PRIMARY KEY,
    total      INTEGER NOT NULL DEFAULT 0,
    llm_ok     INTEGER NOT NULL DEFAULT 0,
    fallback   INTEGER NOT NULL DEFAULT 0,
    cache_hits INTEGER NOT NULL DEFAULT 0
  )
`).catch(() => {});

// Fire-and-forget daily upsert. kind ∈ {'llm_ok','fallback','cache_hits'}.
function recordUsage(kind) {
  const col = ['llm_ok', 'fallback', 'cache_hits'].includes(kind) ? kind : null;
  if (!col) return;
  pool.query(
    `INSERT INTO ai_usage_daily (day, total, ${col})
     VALUES (CURRENT_DATE, 1, 1)
     ON CONFLICT (day) DO UPDATE
       SET total = ai_usage_daily.total + 1,
           ${col} = ai_usage_daily.${col} + 1`
  ).catch(() => {});
}

// Per-user throttle so one teacher cannot exhaust the shared free-tier budget.
// Keyed by user id (set by requireAuth); generous enough for normal lesson prep.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.AI_RATE_PER_MIN || 15),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'You are generating too fast. Please wait a few seconds and try again.' },
});

const MAX_ITEMS = 100;
const CACHE_TTL_MS = 1000 * 60 * 30;
const CACHE_MAX = 200;
const cache = new Map();

const TOOL_META = {
  'lesson-pack': ['utility', 'Lesson Pack'],
  'worksheet-builder': ['utility', 'Worksheet'],
  'homework-set': ['utility', 'Homework'],
  'rubric-maker': ['utility', 'Rubric'],
  'answer-key': ['utility', 'Teacher Aid'],
  'text-topic-vocab': ['reading', 'Reading Text'],
  'abcd-text': ['reading', 'MCQ'],
  'open-questions': ['reading', 'Questions'],
  'true-false': ['reading', 'Check'],
  'three-titles': ['reading', 'Titles'],
  'summary-task': ['reading', 'Summary'],
  'simplify-text': ['reading', 'Adaptation'],
  'gist-detail': ['reading', 'Reading Flow'],
  'generate-text': ['reading', 'Reading Text'],
  'tf-not-given': ['reading', 'Check'],
  'vocab-in-context': ['reading', 'MCQ'],
  'reference-questions': ['reading', 'Questions'],
  'match-headings': ['reading', 'Matching'],
  'sentence-insertion': ['reading', 'MCQ'],
  'reading-bits': ['reading', 'Reorder'],
  'word-definition-match': ['vocabulary', 'Matching'],
  'word-image-match': ['vocabulary', 'Matching'],
  'extract-vocab': ['vocabulary', 'Extraction'],
  'essential-vocab': ['vocabulary', 'Vocab Set'],
  'odd-one-out': ['vocabulary', 'Sorting'],
  'word-sorting': ['vocabulary', 'Sorting'],
  'sentences-vocab': ['vocabulary', 'Sentence Set'],
  'collocations': ['vocabulary', 'Collocations'],
  'word-families': ['vocabulary', 'Word Forms'],
  'flashcards': ['vocabulary', 'Flashcards'],
  'synonyms-antonyms': ['vocabulary', 'Word Bank'],
  'phrasal-verbs': ['vocabulary', 'Phrasal Verbs'],
  'idioms': ['vocabulary', 'Idioms'],
  'creative-writing': ['writing', 'Prompt'],
  'sentence-translation': ['writing', 'Translation'],
  'essay-outline': ['writing', 'Essay'],
  'email-reply': ['writing', 'Email'],
  'rewrite-style': ['writing', 'Rewrite'],
  gap: ['grammar', 'Gap Fill'],
  'gaps-abcd': ['grammar', 'MCQ'],
  'gaps-brackets': ['grammar', 'Word Form'],
  'two-options': ['grammar', 'Choice'],
  rewrite: ['grammar', 'Transformation'],
  'error-correction': ['grammar', 'Correction'],
  'grammar-rules': ['grammar', 'Rule'],
  'tense-contrast': ['grammar', 'Tenses'],
  discussion: ['speaking', 'Discussion'],
  dialogue: ['speaking', 'Dialogue'],
  'roleplay-cards': ['speaking', 'Role Play'],
  'debate-cards': ['speaking', 'Debate'],
  'question-ladder': ['speaking', 'Fluency'],
  'conversation-starters': ['speaking', 'Warm-up'],
  'audio-video-questions': ['listening', 'Listening'],
  'transcript-helper': ['listening', 'Transcript'],
  'warmup-listening': ['listening', 'Warm-up'],
  'listening-dictation': ['listening', 'Pronunciation'],
  'word-set-builder': ['vocabulary', 'Word Set'],
};

const TOPIC_WORDS = [
  'problem', 'solution', 'example', 'reason', 'opinion', 'evidence', 'choice', 'result',
  'risk', 'benefit', 'challenge', 'goal', 'plan', 'step', 'mistake', 'feedback',
  'context', 'priority', 'routine', 'process', 'feature', 'pattern', 'rule',
  'keyword', 'phrase', 'connection', 'comparison', 'prediction', 'experience',
];

function clean(value, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function limitText(value, max = 12000) {
  return clean(value).slice(0, max);
}

function normaliseInput(body) {
  const raw = body?.input || body || {};
  const toolId = clean(body?.toolId || raw.toolId || raw.tool?.id || 'lesson-pack', 'lesson-pack');
  const meta = TOOL_META[toolId] || ['utility', 'Task'];
  const count = Math.max(3, Math.min(MAX_ITEMS, parseInt(raw.count || body?.count || 12, 10) || 12));
  const action = ['simplify', 'upgrade', 'keep'].includes(raw.action) ? raw.action : 'simplify';
  // Reading-text controls (optional): genre + length. Empty string = "let the
  // engine choose" (length then defaults by CEFR level).
  const genre = ['article', 'story', 'email', 'report', 'blog', 'dialogue', 'review'].includes(raw.genre) ? raw.genre : '';
  const length = ['short', 'medium', 'long'].includes(raw.length) ? raw.length : '';
  return {
    toolId,
    level: clean(raw.level, 'B1').slice(0, 8),
    count,
    topic: clean(raw.topic, 'Practical English').slice(0, 160),
    action,
    genre,
    length,
    source: limitText(raw.source, 18000),
    vocab: limitText(raw.vocab, 8000),
    extra: clean(raw.extra, '').slice(0, 600),
    model: clean(raw.model, '').slice(0, 80),
    cat: meta[0],
    kind: meta[1],
  };
}

function cacheKey(userId, input) {
  return JSON.stringify({
    userId,
    toolId: input.toolId,
    level: input.level,
    count: input.count,
    topic: input.topic,
    action: input.action,
    genre: input.genre,
    length: input.length,
    source: input.source,
    vocab: input.vocab,
    extra: input.extra,
    model: input.model,
  });
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return JSON.parse(JSON.stringify(hit.value));
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value: JSON.parse(JSON.stringify(value)) });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

// Auto-generated YouTube captions arrive with no punctuation at all, so the
// old split on [.!?] returned ONE fragment holding the entire transcript. It
// passed the length check and was handed straight into a question, which is how
// a comprehension task ended up printing forty lines of raw speech — and why
// the card it lived in stretched to thousands of pixels.
const TRANSCRIPT_NOISE = /\[(music|applause|laughter|inaudible|foreign)\]/gi;
const SENTENCE_MAX = 240;            // longer than this is not a sentence a student reads

// Cut an unpunctuated run at a discourse marker near the middle, so the pieces
// break where a speaker actually pauses rather than mid-clause.
function splitRun(text, max = 180) {
  const out = [];
  let rest = clean(text);
  let guard = 0;
  while (rest.length > max && guard++ < 60) {
    const window = rest.slice(0, max);
    const marker = Math.max(
      window.lastIndexOf(' and '), window.lastIndexOf(' but '), window.lastIndexOf(' so '),
      window.lastIndexOf(' because '), window.lastIndexOf(' then '), window.lastIndexOf(' which '),
    );
    const cut = marker > max * 0.4 ? marker : window.lastIndexOf(' ');
    if (cut <= 0) break;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function sourceSentences(source, topic, count) {
  const raw = String(source || '').replace(TRANSCRIPT_NOISE, ' ');
  const parts = raw
    .split(/(?<=[.!?])\s+|\n+/)
    .flatMap(s => {
      const t = clean(s);
      // A fragment far past sentence length means the source was unpunctuated.
      return t.length > SENTENCE_MAX ? splitRun(t) : [t];
    })
    .filter(s => s.length > 18 && s.length <= SENTENCE_MAX)
    .slice(0, Math.max(count, 12));
  if (parts.length) return parts;
  return Array.from({ length: count }, (_, i) =>
    `${topic} creates a realistic classroom situation where students need to notice meaning, choose accurate language and explain their answer.`
  );
}

// One stoplist, owned by the derive module. Two copies of it would drift, and
// the drift would be invisible: the word ranking here and the distractor pool
// there would quietly start disagreeing about what counts as a content word.
const STOPWORDS = derive.STOPWORDS;

function vocabList(input, count = input.count) {
  const direct = String(input.vocab || '')
    .split(/[\n,;]+/)
    .map(s => clean(s))
    .filter(Boolean);
  if (direct.length) return direct.slice(0, count);

  // Taking the first unique 4+ letter words in document order, minus an
  // eleven-word stoplist, meant a transcript handed back whatever the speaker
  // said in their opening seconds — "know, even, though, tired, feel" as the
  // lesson's target language. Score by how much a word is actually used and how
  // substantial it is, and throw away function words and speech filler.
  const sourceWords = String(input.source || '')
    .replace(TRANSCRIPT_NOISE, ' ')   // else "[Applause]" scores as a topic word
    .toLowerCase()
    .match(/[a-z][a-z'-]{3,}/g) || [];
  const freq = new Map();
  sourceWords.forEach(w => { if (!STOPWORDS.has(w)) freq.set(w, (freq.get(w) || 0) + 1); });
  const unique = [...freq.entries()]
    // repetition signals a topic word; length breaks ties toward the meatier one
    .sort((a, b) => (b[1] * 10 + b[0].length) - (a[1] * 10 + a[0].length))
    .map(e => e[0])
    .slice(0, count);
  if (unique.length >= Math.min(6, count)) return unique;

  const topic = input.topic.toLowerCase();
  return TOPIC_WORDS.slice(0, count).map(w => `${w} (${topic})`);
}

function title(input) {
  return `${input.level} · ${input.kind}: ${input.topic}`;
}

function base(input, boardKind) {
  return {
    engine: 'vps-fast-v1',
    boardKind,
    cat: input.cat,
    kind: input.kind,
    level: input.level,
    topic: input.topic,
    title: title(input),
    generatedAt: new Date().toISOString(),
  };
}

function makeWordSet(input) {
  const wordsList = String(input.vocab || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const source = wordsList.length ? wordsList : vocabList(input, input.count);
  return {
    ...base(input, 'wordset'),
    engine: 'vps-fast-v1',
    words: source.map(en => ({
      en, uk: '', ru: '',
      ex: `Try using "${en}" in a sentence about ${input.topic}.`,
    })),
  };
}

/* Vocabulary cards.

   The example is the sentence the word actually appeared in. The old one was
   "In <topic>, "<word>" helps students explain idea 3." — the same sentence on
   every card with the index counting up, which is worse than an empty field
   because it looks filled in.

   The definition is left empty when there is nothing true to put in it. A
   definition cannot be derived from a text, only written, so the honest options
   are the model or the teacher; a fabricated one ("A useful B1 word or phrase
   for discussing X", identical on all twelve cards) is neither. Empty is also
   what the board's editor expects — the field is contenteditable with a
   placeholder, so the teacher can fill it in, and the AI path overwrites it. */
function makeVocab(input) {
  const words = vocabList(input, input.count);
  const sentences = sourceSentences(input.source, input.topic, 40);
  const hasSource = clean(input.source).length > 60;
  return {
    ...base(input, 'vocab'),
    items: words.map((word) => {
      const example = hasSource ? derive.exampleFor(word, sentences) : null;
      return {
        word,
        definition: '',
        example: example || '',
      };
    }),
    cards: [{
      title: 'Teacher flow',
      text: 'Reveal meaning -> ask for examples -> sort hard words -> recycle in a speaking or writing task.',
    }],
  };
}

/* A matching task needs a right-hand column whose entries differ from one
   another — that difference is the only thing the student has to reason about.
   The old version paired every word with "Definition N: use this item
   accurately in a <topic> context", so the six right-hand cells were the same
   sentence six times and the exercise had no answer; the numbering was the only
   distinguishing mark, and it gave the order away.

   Both forms below take their right-hand column from the source instead.
   Clause halves for the halves tools, and for the word tools the real sentence
   the word came out of with the word removed — "match each word to the sentence
   it belongs in" is a standard task, and every cell in it is real language. */
function makeMatching(input) {
  const sentences = sourceSentences(input.source, input.topic, Math.max(input.count, 8));
  const words = vocabList(input, input.count);
  const pool = derive.contentWords(input.source, 40);
  const isHalves = ['matching-halves', 'match-headings'].includes(input.toolId);

  const pairs = [];
  const seen = new Set();
  for (const sentence of sentences) {
    if (pairs.length >= input.count) break;
    if (isHalves) {
      const h = derive.halves(sentence);
      if (!h) continue;
      const key = h[1].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ left: h[0], right: h[1] });
    } else {
      const g = derive.pickGapTarget(sentence, words, pool);
      if (!g) continue;
      const key = g.answer.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ left: g.answer, right: g.text });
    }
  }

  // Under three pairs there is no task. Say so on the card rather than padding
  // to length with invented definitions, which is what made the old output
  // look complete and be useless.
  const sparse = pairs.length < 3;
  const text = sparse
    ? `Not enough source text to build a matching task about ${input.topic}. Paste a text or a longer word list and generate again.`
    : isHalves
      ? `Match the beginnings with the endings. Topic: ${input.topic}.`
      : `Match each word with the sentence it belongs in. Topic: ${input.topic}.`;

  return {
    ...base(input, 'quiz'),
    questions: [{ type: 'match', text, pairs, points: pairs.length }],
    sections: teacherFlow(input),
  };
}

/* Comprehension items built out of the source text.

   Every closed item here is derived, never invented: the stem is a real
   sentence, the answer is a word that was in it, the distractors are words from
   the same text. The builders return null whenever the sentence will not carry
   a sound item — a gap with no context around it, a "false" statement that
   could not actually be made false — and the caller moves to the next sentence
   instead of publishing the broken one. Coming back with nine good items beats
   twelve of which three are wrong.

   Open questions are the exception and are still written from a template. That
   is legitimate: an open question anchored to a real quotation is a real task,
   and there is no answer key to get wrong. They are also what the set is padded
   with when the source runs dry, because the alternative — padding with
   fabricated multiple choice — is how the engine used to produce items whose
   options were "An unrelated detail" and "A grammar-only answer". */
function makeQuiz(input) {
  const sentences = sourceSentences(input.source, input.topic, input.count);
  const words = vocabList(input, input.count);
  const pool = derive.contentWords(input.source, 40);
  const rand = derive.seeded(`${input.toolId}|${input.topic}|${input.source.slice(0, 400)}`);

  const isTf = ['true-false', 'tf-not-given'].includes(input.toolId);
  const isGap = ['gap', 'gaps-brackets', 'listening-dictation', 'type-gap', 'word-bank', 'summary-gapfill'].includes(input.toolId);
  const isTwo = input.toolId === 'two-options';
  const isOpen = ['open-questions', 'discussion', 'question-ladder', 'conversation-starters', 'reference-questions'].includes(input.toolId);
  const isOrder = input.toolId === 'word-order';
  const isGist = input.toolId === 'gist-detail';

  const cloze = (sentence) => derive.pickGapTarget(sentence, words, pool);

  const openItem = (sentence, i) => ({
    type: 'open',
    text: i === 0
      ? `What is the main idea of ${input.topic}?`
      : `How does this detail connect to ${input.topic}: "${snippet(sentence, 90)}"?`,
    points: 1,
  });

  const builders = {
    truefalse: (sentence, i) => {
      // Alternate the intended answer so a set is not all-true, but let the
      // source have the final say: a sentence that cannot be made provably
      // false is kept true rather than shipped as a false one that is not.
      if (i % 2 === 0) return { type: 'truefalse', text: sentence, answer: true, points: 1 };
      const f = derive.falsify(sentence);
      return f ? { type: 'truefalse', text: f.text, answer: false, points: 1 } : null;
    },
    gap: (sentence) => {
      const g = cloze(sentence);
      return g ? { type: 'gap-fill', text: g.text, answer: g.answer, points: 1 } : null;
    },
    mcq: (sentence) => {
      const g = cloze(sentence);
      if (!g) return null;
      const wrong = derive.distractors(g.answer, pool, 3, g.text);
      if (wrong.length < 2) return null;      // one option is not a choice
      return {
        type: 'mcq',
        text: g.text,
        options: derive.shuffle([g.answer, ...wrong], rand),
        answer: g.answer,
        points: 1,
      };
    },
    two: (sentence) => {
      const g = cloze(sentence);
      if (!g) return null;
      const wrong = derive.distractors(g.answer, pool, 1, g.text);
      if (!wrong.length) return null;
      return {
        type: 'mcq',
        text: g.text,
        options: derive.shuffle([g.answer, wrong[0]], rand),
        answer: g.answer,
        points: 1,
      };
    },
    order: (sentence) => {
      const sc = derive.scramble(sentence, rand);
      if (!sc) return null;
      return {
        type: 'gap-fill',
        text: `Put the words in order: ${sc.tokens.join(' / ')}`,
        answer: sc.answer,
        points: 1,
      };
    },
    open: openItem,
  };

  const builder = isTf ? builders.truefalse
    : isGap ? builders.gap
    : isTwo ? builders.two
    : isOrder ? builders.order
    : isOpen ? builders.open
    : builders.mcq;

  const questions = [];
  const seenText = new Set();
  // Two passes over the sentences: with twelve items asked of six usable
  // sentences, the second pass gets the ones the first could not build from
  // (a true/false pass rejects a sentence at odd i and accepts it at even).
  for (let pass = 0; pass < 2 && questions.length < input.count; pass++) {
    for (const sentence of sentences) {
      if (questions.length >= input.count) break;
      const item = builder(sentence, questions.length);
      if (!item) continue;
      const key = clean(item.text).toLowerCase();
      if (seenText.has(key)) continue;
      seenText.add(key);
      questions.push(item);
    }
  }

  // Pad with open questions rather than with fabricated closed items.
  for (let i = 0; questions.length < input.count && i < sentences.length * 2; i++) {
    const item = openItem(sentences[i % sentences.length], questions.length);
    const key = clean(item.text).toLowerCase();
    if (seenText.has(key)) continue;
    seenText.add(key);
    questions.push(item);
  }

  if (isGist && questions.length) {
    questions[0] = { type: 'open', text: `What is the best gist of this text about ${input.topic}?`, points: 1 };
  }

  return { ...base(input, 'quiz'), questions, sections: teacherFlow(input) };
}

function makeCards(input) {
  const words = vocabList(input, Math.max(8, input.count));
  const stages = {
    'lesson-pack': ['Warmer', 'Input', 'Controlled practice', 'Production', 'Feedback', 'Homework'],
    'worksheet-builder': ['Lead-in', 'Task A', 'Task B', 'Challenge', 'Answer key', 'Teacher notes'],
    'homework-set': ['Brief', 'Task 1', 'Task 2', 'Self-check', 'Submission note'],
    'rubric-maker': ['Vocabulary', 'Grammar accuracy', 'Fluency', 'Task achievement', 'Feedback language'],
    'essay-outline': ['Introduction', 'Body 1', 'Body 2', 'Body 3', 'Conclusion'],
    'dialogue': ['Speaker A', 'Speaker B', 'Useful language', 'Extension'],
    'roleplay-cards': ['Role A', 'Role B', 'Useful phrases', 'Challenge round'],
    'debate-cards': ['For', 'Against', 'Evidence', 'Rebuttal', 'Final vote'],
  }[input.toolId] || ['Teacher setup', 'Student task', 'Model answer', 'Practice', 'Feedback'];

  // Looping the stage names with % meant asking for 8 cards produced Warmer and
  // Input twice — a lesson plan with two warmers. A pack has as many stages as
  // it has, and no more.
  const MOVES = [
    'model one example, then ask students to upgrade their answer',
    'elicit first, correct after — let the class self-repair',
    'pair students, then swap partners once for a second attempt',
    'drill the form chorally, then individually',
    'set a short time limit and take feedback on the board',
    'collect two answers, one strong and one weak, and compare them',
  ];
  const cards = [];
  const n = Math.min(input.count, stages.length);
  for (let i = 0; i < n; i++) {
    const stage = stages[i];
    const focus = words.slice(i, i + 5).filter(Boolean);
    cards.push({
      title: stage,
      text: `${stage} for ${input.topic} (${input.level}).`
        + (focus.length ? `\nTarget language: ${focus.join(', ')}.` : '')
        + `\nTeacher move: ${MOVES[i % MOVES.length]}.`,
    });
  }
  cards.push({
    title: 'Teacher flow',
    text: `1. Set the goal.\n2. Model one answer.\n3. Students try silently.\n4. Pair-check.\n5. Collect mistakes and recycle them.\n${input.extra ? `\nTeacher note: ${input.extra}` : ''}`,
  });
  return { ...base(input, 'cards'), cards, sections: teacherFlow(input), vocab: words.slice(0, 16) };
}

function makeText(input) {
  const words = vocabList(input, Math.min(12, input.count));
  if (input.toolId === 'simplify-text') return makeAdaptedText(input, words);
  return {
    ...base(input, 'cards'),
    cards: [{
      title: 'Generated text',
      text: `A ${input.level} reading text about ${input.topic}.\n\n${words.slice(0, 8).map((w, i) => `Sentence ${i + 1}: ${w} appears naturally in a classroom-friendly context.`).join('\n')}`,
    }, {
      title: 'Before reading',
      text: `Predict 3 words you expect in a text about ${input.topic}. Then compare with the word bank.`,
    }, {
      title: 'After reading',
      text: `Choose 3 useful phrases and write your own example connected to your life.`,
    }],
    vocab: words,
  };
}

function actionLabel(action) {
  if (action === 'upgrade') return 'Upgraded text';
  if (action === 'keep') return 'Leveled text';
  return 'Simplified text';
}

function makeAdaptedText(input, words) {
  const label = actionLabel(input.action);
  const sentences = sourceSentences(input.source, input.topic, Math.max(8, input.count));
  let text;
  if (input.action === 'upgrade') {
    const connectors = ['Furthermore', 'However', 'As a result', 'In practical terms', 'For this reason'];
    text = sentences.slice(0, Math.min(8, input.count)).map((sentence, i) =>
      `${connectors[i % connectors.length]}, ${sentence.replace(/\.$/, '')}, which gives students a more precise way to discuss ${input.topic}.`
    ).join(' ');
  } else if (input.action === 'keep') {
    text = sentences.slice(0, Math.min(10, input.count)).join(' ');
  } else {
    const easyPairs = [
      [/\bfrustrating\b/gi, 'difficult'],
      [/\bcontact\b/gi, 'call or message'],
      [/\breservation\b/gi, 'booking'],
      [/\bflexible\b/gi, 'ready to change plans'],
      [/\bencounter\b/gi, 'have'],
      [/\bapproximately\b/gi, 'about'],
      [/\bassistance\b/gi, 'help'],
    ];
    text = sentences.slice(0, Math.min(8, input.count)).map(sentence => {
      let adapted = sentence;
      easyPairs.forEach(([from, to]) => { adapted = adapted.replace(from, to); });
      if (adapted.length > 150) adapted = adapted.slice(0, 145).replace(/\s+\S*$/, '') + '.';
      return adapted;
    }).join(' ');
  }
  return {
    ...base(input, 'cards'),
    kind: label,
    title: `${input.level} · ${label}: ${input.topic}`,
    action: input.action,
    cards: [{
      title: label,
      text,
    }, {
      title: 'Teacher note',
      text: `Mode: ${label}. Target vocabulary to recycle: ${words.slice(0, 8).join(', ') || input.topic}.`,
    }],
    vocab: words,
  };
}

function teacherFlow(input) {
  return [{
    title: 'Teacher flow',
    items: [
      'Model the first item before students start.',
      'Give silent thinking time.',
      'Pair-check before feedback.',
      'Copy 2-3 mistakes into a mistake bank.',
      input.extra || 'Finish with one student-created example.',
    ],
  }];
}

function snippet(text, max) {
  const s = clean(text);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function boardKindFor(toolId) {
  if (toolId === 'word-set-builder') return 'wordset';
  if (toolId === 'worksheet-builder') return 'worksheet';
  if (['word-definition-match', 'word-image-match', 'word-translation-match', 'word-sorting', 'matching-halves', 'match-headings'].includes(toolId)) return 'matching';
  if (['extract-vocab', 'essential-vocab', 'flashcards', 'collocations', 'word-families', 'synonyms-antonyms', 'phrasal-verbs', 'idioms'].includes(toolId)) return 'vocab';
  if (['text-topic-vocab', 'simplify-text', 'summary-task'].includes(toolId)) return 'cards'; // text-style cards
  if (['abcd-text', 'true-false', 'open-questions', 'gap', 'gaps-abcd', 'gaps-brackets', 'two-options', 'rewrite', 'rewrite-style', 'error-correction', 'word-order', 'type-gap', 'word-bank', 'tense-contrast', 'gist-detail', 'odd-one-out', 'discussion', 'question-ladder', 'listening-dictation', 'audio-video-questions', 'three-titles', 'reading-bits', 'summary-gapfill', 'choose-summary', 'warmup-listening', 'sentence-translation', 'conversation-starters', 'tf-not-given', 'vocab-in-context', 'reference-questions', 'sentence-insertion'].includes(toolId)) return 'quiz';
  return 'cards';
}

/* With no source text there is nothing to derive from. The old code's answer to
   that was six hardcoded sentences about urban regeneration, printed under
   whatever topic the teacher had typed — a worksheet on "food" opened with "The
   city centre has become very busy and ___", and all three parts were like it,
   so the topic field did nothing at all. These parts use the only real material
   available without a text: the teacher's own target words. Thin, but true, and
   it says what it needs. */
function vocabOnlyWorksheetParts(input, words) {
  const wb = words.slice(0, 8);
  return [
    { type: 'fill_blank', title: 'Part 1: Word bank', instruction: `Write one sentence about ${input.topic} using each word.`,
      word_bank: wb,
      items: wb.map((w, i) => ({ id: i + 1, stem: `(${w}) ______________________________`, answer: w })) },
    { type: 'essay', title: 'Part 2: Extended writing', instruction: `Use at least four of the words above.`,
      items: [{ id: wb.length + 1, prompt: `Write 80–100 words about ${input.topic}.` }] },
    { type: 'essay', title: 'Teacher note', instruction: 'Generated without a source text.',
      items: [{ id: wb.length + 2, prompt: `Paste a reading text or transcript into "Source text" and generate again to get comprehension, gap-fill and matching parts built from it.` }] },
  ];
}

/* A worksheet built out of the pasted text: cloze multiple choice, gap-fill
   against a word bank, and clause matching — all of them real sentences with
   real words taken out of them.

   A part is dropped when the source cannot fill it, rather than padded. Three
   short parts that work beat six where half the answer key is invented. */
function makeWorksheet(input) {
  const b = base(input, 'worksheet');
  const targets = vocabList(input, 12);
  if (clean(input.source).length < 120) {
    return { ...b, parts: vocabOnlyWorksheetParts(input, targets.length >= 4 ? targets : ['expand', 'develop', 'improve', 'reduce', 'increase', 'maintain']) };
  }

  const sentences = sourceSentences(input.source, input.topic, 30);
  const pool = derive.contentWords(input.source, 40);
  const rand = derive.seeded(`worksheet|${input.topic}|${input.source.slice(0, 400)}`);
  const claimed = new Set();   // an answer is used by one part only
  let id = 1;

  const mcqItems = [];
  for (const s of sentences) {
    if (mcqItems.length >= 6) break;
    const g = derive.pickGapTarget(s, targets, pool, claimed);
    if (!g) continue;
    const wrong = derive.distractors(g.answer, pool, 3, g.text);
    if (wrong.length < 3) continue;
    claimed.add(g.answer.toLowerCase());
    const options = derive.shuffle([g.answer, ...wrong], rand);
    mcqItems.push({ id: id++, stem: g.text, options, answer: options.indexOf(g.answer) });
  }

  // Same sentences, but asking for a word Part 1 did not take, so the two parts
  // do not compete for one word per sentence and quietly drop a section.
  const gapItems = [];
  for (const s of sentences) {
    if (gapItems.length >= 6) break;
    const g = derive.pickGapTarget(s, targets, pool, claimed);
    if (!g) continue;
    claimed.add(g.answer.toLowerCase());
    gapItems.push({ id: id++, stem: g.text, answer: g.answer });
  }

  const matchItems = [];
  const seenEnding = new Set();
  const endings = [];
  for (const s of sentences) {
    const h = derive.halves(s);
    if (h && !seenEnding.has(h[1].toLowerCase())) { seenEnding.add(h[1].toLowerCase()); endings.push(h); }
  }
  for (const [left, right] of endings.slice(0, 6)) {
    // Wrong endings come from the other sentences, so every option is a real
    // clause and the right one has to be chosen on meaning rather than on being
    // the only one that reads like English.
    const others = endings.filter(e => e[1] !== right).map(e => e[1]);
    if (others.length < 2) break;
    const options = derive.shuffle([right, ...derive.shuffle(others, rand).slice(0, 2)], rand);
    matchItems.push({ id: id++, stem: left, options, answer: options.indexOf(right) });
  }

  const parts = [];
  if (mcqItems.length >= 3) {
    parts.push({ type: 'multiple_choice', title: 'Part 1: Multiple Choice', instruction: 'Select the best option to complete each sentence.', items: mcqItems });
  }
  if (gapItems.length >= 3) {
    parts.push({
      type: 'fill_blank', title: 'Part 2: Sentence Completion', instruction: 'Fill in the blank using a word from the word bank.',
      word_bank: derive.shuffle(gapItems.map(i => i.answer), rand), items: gapItems,
    });
  }
  if (matchItems.length >= 3) {
    parts.push({ type: 'matching', title: 'Part 3: Matching Contexts', instruction: 'Choose the most logical sentence ending.', items: matchItems });
  }
  if (!parts.length) {
    return { ...b, parts: vocabOnlyWorksheetParts(input, targets.length >= 4 ? targets : ['expand', 'develop', 'improve', 'reduce', 'increase', 'maintain']) };
  }
  return { ...b, parts };
}

function generateLocal(input) {
  if (input.toolId === 'word-set-builder') return makeWordSet(input);
  if (input.toolId === 'worksheet-builder') return makeWorksheet(input);
  if (['word-definition-match', 'word-image-match', 'word-translation-match', 'word-sorting', 'matching-halves', 'match-headings'].includes(input.toolId)) return makeMatching(input);
  if (['extract-vocab', 'essential-vocab', 'flashcards', 'collocations', 'word-families'].includes(input.toolId)) return makeVocab(input);
  if (['text-topic-vocab', 'simplify-text', 'summary-task'].includes(input.toolId)) return makeText(input);
  if (['abcd-text', 'true-false', 'open-questions', 'gap', 'gaps-abcd', 'gaps-brackets', 'two-options', 'rewrite', 'error-correction', 'word-order', 'type-gap', 'word-bank', 'tense-contrast', 'gist-detail', 'odd-one-out', 'discussion', 'question-ladder', 'listening-dictation', 'audio-video-questions', 'three-titles', 'reading-bits', 'summary-gapfill', 'choose-summary', 'warmup-listening', 'sentence-translation', 'tf-not-given', 'vocab-in-context', 'reference-questions', 'sentence-insertion'].includes(input.toolId)) return makeQuiz(input);
  return makeCards(input);
}

// Light cleaners used when assembling the LLM payload into the shared envelope.
function line(v) { return clean(v); }
function block(v) { return String(v == null ? '' : v).replace(/\r/g, '').trim(); }

// Resolve the model's stated MCQ answer to the EXACT text of one of the options,
// so the front-end always highlights a correct choice. Handles the common LLM
// quirks: a letter ("A"/"b)"), an index ("2"), or an answer reworded/cased
// slightly differently from the option. Falls back to the first option.
function resolveMcqAnswer(answer, options) {
  if (!options.length) return '';
  const raw = String(answer == null ? '' : answer).trim();
  if (!raw) return options[0];
  // exact match
  if (options.includes(raw)) return raw;
  // case-insensitive / trimmed match
  const ci = options.find(o => o.toLowerCase() === raw.toLowerCase());
  if (ci) return ci;
  // a bare letter, optionally with ")"/"." — "A", "b)", "C."
  const letter = raw.match(/^([A-Za-z])[).\s]*$/);
  if (letter) {
    const idx = letter[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) return options[idx];
  }
  // a 1-based index — "2", "3)"
  const num = raw.match(/^(\d+)[).\s]*$/);
  if (num) {
    const idx = parseInt(num[1], 10) - 1;
    if (idx >= 0 && idx < options.length) return options[idx];
  }
  // an option that contains the answer (or vice versa) — minor wording drift
  const sub = options.find(o => o.toLowerCase().includes(raw.toLowerCase()) || raw.toLowerCase().includes(o.toLowerCase()));
  if (sub) return sub;
  return options[0];
}

// Drop duplicates by a key function, keeping first occurrence.
function dedupeBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter(x => { const k = keyFn(x); if (seen.has(k)) return false; seen.add(k); return true; });
}

function sanitizeQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const type = ['mcq', 'truefalse', 'gap-fill', 'open', 'match'].includes(q.type) ? q.type : 'mcq';
  const text = block(q.text);
  if (!text) return null;
  const out = { type, text, points: 1 };
  if (type === 'mcq') {
    // De-duplicate options (case-insensitive) so there are no repeated choices.
    const seen = new Set();
    out.options = (q.options || []).map(line).filter(o => {
      const k = o.toLowerCase();
      if (!o || seen.has(k)) return false;
      seen.add(k); return true;
    });
    if (out.options.length < 2) return null;
    out.answer = resolveMcqAnswer(q.answer, out.options);
  } else if (type === 'truefalse') {
    out.answer = Boolean(q.answer);
  } else if (type === 'gap-fill') {
    out.answer = line(q.answer);
  } else if (type === 'match') {
    out.pairs = (q.pairs || []).map(p => ({ left: line(p.left), right: line(p.right) })).filter(p => p.left && p.right);
    if (!out.pairs.length) return null;
  }
  return out;
}

// Wrap the LLM's structured pieces in the exact envelope the front-end expects.
function assembleFromLLM(input, data) {
  const kind = input.boardKind;
  const env = {
    ...base(input, kind === 'matching' ? 'quiz' : kind),
    engine: `llm:${aiEngine.getLastModel() || aiEngine.MODEL}`,
  };

  if (kind === 'worksheet') {
    const parts = (data.parts || []).filter(p => p && p.type && Array.isArray(p.items) && p.items.length);
    if (!parts.length) throw new Error('LLM returned no worksheet parts');
    // Normalise item ids and answers
    parts.forEach(p => {
      p.items = p.items.map((it, idx) => ({
        id: it.id ?? idx + 1,
        stem: block(it.stem || it.sentence || it.question || ''),
        options: Array.isArray(it.options) ? it.options.map(line) : undefined,
        answer: it.answer,
        prompt: it.prompt ? block(it.prompt) : undefined,
      }));
      if (p.word_bank) p.word_bank = p.word_bank.map(line).filter(Boolean);
    });
    return { ...env, parts };
  }

  if (kind === 'wordset') {
    const words = dedupeBy(
      (data.words || [])
        .map(x => ({ en: line(x.en), uk: line(x.uk), ru: line(x.ru), ex: block(x.ex) }))
        .filter(x => x.en),
      x => x.en.toLowerCase(),
    );
    if (!words.length) throw new Error('LLM returned no words');
    return { ...env, words };
  }

  if (kind === 'vocab') {
    const items = dedupeBy(
      (data.items || [])
        .map(x => ({ word: line(x.word), definition: block(x.definition), example: block(x.example) }))
        .filter(x => x.word),
      x => x.word.toLowerCase(),
    ).slice(0, input.count);
    if (!items.length) throw new Error('LLM returned no vocab items');
    return {
      ...env,
      items,
      cards: [{
        title: 'Teacher flow',
        text: 'Reveal meaning -> ask for examples -> sort hard words -> recycle in a speaking or writing task.',
      }],
    };
  }

  if (kind === 'matching') {
    const pairs = dedupeBy(
      (data.pairs || [])
        .map(p => ({ left: line(p.left), right: line(p.right) }))
        .filter(p => p.left && p.right),
      p => p.left.toLowerCase(),
    ).slice(0, input.count);
    if (!pairs.length) throw new Error('LLM returned no pairs');
    let matchText = input.toolId === 'word-sorting'
      ? `Sort the words into the correct categories for ${input.topic}.`
      : input.toolId === 'word-translation-match'
        ? `Match each word with its translation (${input.topic}).`
        : input.toolId === 'matching-halves'
          ? `Match the two halves to make complete sentences (${input.topic}).`
          : `Match the words with student-friendly definitions for ${input.topic}.`;
    // Sorting safety net: reject degenerate categories (label == topic, a vague
    // catch-all, fewer than 2 groups, or everything dumped in one) and fall back
    // to an honest open-ended sort where students name the groups themselves.
    if (input.toolId === 'word-sorting') {
      const norm = s => String(s || '').trim().toLowerCase();
      const topicN = norm(input.topic);
      const counts = {};
      pairs.forEach(p => { const k = norm(p.right); counts[k] = (counts[k] || 0) + 1; });
      const cats = Object.keys(counts);
      const maxShare = pairs.length ? Math.max(...Object.values(counts)) / pairs.length : 1;
      const badLabel = cats.some(c => c === topicN || /^(other|misc|general|various|n\/?a|language skills?|words?|vocabulary)$/.test(c));
      if (cats.length < 2 || badLabel || maxShare > 0.7) {
        const half = Math.ceil(pairs.length / 2);
        pairs.forEach((p, i) => { p.right = i < half ? 'Group 1' : 'Group 2'; });
        matchText = 'Sort these words into two groups, then give each group a name.';
      }
    }
    return {
      ...env,
      questions: [{
        type: 'match',
        text: matchText,
        pairs,
        points: pairs.length,
      }],
      sections: teacherFlow(input),
    };
  }

  if (kind === 'quiz') {
    // Sanitise first, drop invalid, THEN cap to count — so bad items don't
    // silently shrink the set below what the teacher asked for.
    const questions = (data.questions || []).map(sanitizeQuestion).filter(Boolean).slice(0, input.count);
    if (!questions.length) throw new Error('LLM returned no questions');
    const sections = teacherFlow(input);
    if (input.toolId === 'word-bank') {
      const bank = [...new Set(questions.map(q => q.answer).filter(Boolean))]
        .sort(() => Math.random() - 0.5);
      if (bank.length) sections.unshift({ title: 'Word bank', items: bank });
    }
    return { ...env, questions, sections };
  }

  // cards (lesson packs, worksheets, texts, dialogues, …)
  const cards = (data.cards || [])
    .map(c => ({ title: line(c.title) || 'Card', text: block(c.text) }))
    .filter(c => c.text);
  if (!cards.length) throw new Error('LLM returned no cards');
  const vocab = Array.isArray(data.vocab) ? data.vocab.map(line).filter(Boolean).slice(0, 16) : [];
  const out = { ...env, cards, vocab };
  if (input.toolId === 'simplify-text') {
    const label = actionLabel(input.action);
    out.kind = label;
    out.title = `${input.level} · ${label}: ${input.topic}`;
    out.action = input.action;
  } else {
    out.sections = teacherFlow(input);
  }
  return out;
}

// Lightweight in-memory usage metrics (reset on restart) for the admin dashboard.
const METRICS = {
  total: 0,        // teacher-tool requests served
  llmOk: 0,        // produced by the cloud LLM
  fallback: 0,     // LLM failed → rule engine used
  cacheHits: 0,    // served from cache
  lastError: null, // last LLM error message
  lastModel: null, // model that produced the last LLM generation
  lastTrace: null, // provider/model attempts from the last LLM request
  lastAt: null,    // ISO timestamp of last request
  byModel: {},     // per-model success counts
  startedAt: new Date().toISOString(),
};

/* Primary entry: try the LLM, fall back to the local rule engine on any error.

   The fallback used to be silent to the caller, and that silence was its own
   problem: the rule engine writes noticeably flatter material, so a teacher who
   got it had no way to tell whether the tool is simply like this or whether
   today it could not reach the model. `engine` now travels with every output —
   and into the cache with it, which is right, since a cached result really was
   made by whatever produced it — so the board can label what it is showing. */
async function generate(input) {
  const local = (reason) => {
    const out = generateLocal(input);
    out.engine = 'rules';
    out.engineReason = reason;
    return out;
  };

  if (!aiEngine.enabled()) return local('not-configured');

  try {
    input.boardKind = boardKindFor(input.toolId);
    const out = assembleFromLLM(input, await aiEngine.generate(input));
    out.engine = 'ai';
    METRICS.llmOk++;
    const m = aiEngine.getLastModel() || aiEngine.MODEL;
    METRICS.lastModel = m;
    METRICS.lastTrace = aiEngine.getLastTrace ? aiEngine.getLastTrace() : null;
    METRICS.byModel[m] = (METRICS.byModel[m] || 0) + 1;
    recordUsage('llm_ok');
    return out;
  } catch (err) {
    METRICS.fallback++;
    METRICS.lastError = err.message;
    METRICS.lastTrace = aiEngine.getLastTrace ? aiEngine.getLastTrace() : null;
    recordUsage('fallback');
    console.error('[ai/llm] falling back to rule engine:', err.message);
    // Coarse reason only. The raw error can name the provider, the model and
    // occasionally part of the request, none of which belongs on a teacher's
    // screen; the detail stays in METRICS.lastError for /status.
    return local(
      /timeout|abort|ETIMEDOUT/i.test(err.message) ? 'timeout'
      : /429|rate|quota|limit/i.test(err.message) ? 'busy'
      : 'error');
  }
}

router.post('/teacher-tool', requireAuth, requireTeacher, aiLimiter, async (req, res) => {
  const started = Date.now();
  try {
    const input = normaliseInput(req.body);
    METRICS.total++;
    METRICS.lastAt = new Date().toISOString();
    const key = cacheKey(req.user.id, input);
    const hit = cacheGet(key);
    if (hit) {
      METRICS.cacheHits++;
      recordUsage('cache_hits');
      hit.cached = true;
      hit.processingMs = Date.now() - started;
      return res.json({ output: hit });
    }
    const output = await generate(input);
    output.cached = false;
    output.processingMs = Date.now() - started;
    cacheSet(key, output);
    res.json({ output });
  } catch (err) {
    console.error('[ai/teacher-tool]', err.message);
    res.status(500).json({ error: err.message || 'AI engine error' });
  }
});

router.get('/status', requireAuth, requireTeacher, (_req, res) => {
  const llm = aiEngine.enabled();
  res.json({
    ok: true,
    engine: llm ? `llm:${aiEngine.MODEL}` : 'vps-fast-v1',
    model: llm ? aiEngine.MODEL : null,
    baseUrl: llm ? aiEngine.BASE_URL : null,
    chain: llm ? aiEngine.listModels() : [],
    lastTrace: llm && aiEngine.getLastTrace ? aiEngine.getLastTrace() : null,
    mode: llm ? 'cloud-llm-with-rule-fallback' : 'server-cache-rule-engine',
    llmEnabled: llm,
    cacheSize: cache.size,
    maxItems: MAX_ITEMS,
    ratePerMin: Number(process.env.AI_RATE_PER_MIN || 15),
    freeModels: aiEngine.FREE_MODELS || [],
    metrics: { ...METRICS },
  });
});

// ── GET /api/ai/usage — persistent daily counters (last N days) ──────────────
router.get('/usage', requireAuth, requireTeacher, async (req, res) => {
  const days = Math.max(1, Math.min(60, parseInt(req.query.days, 10) || 14));
  try {
    const { rows } = await pool.query(
      `SELECT to_char(day,'YYYY-MM-DD') AS day, total, llm_ok, fallback, cache_hits
       FROM ai_usage_daily
       WHERE day >= CURRENT_DATE - ($1::int - 1)
       ORDER BY day ASC`,
      [days]
    );
    res.json({ days, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── YouTube transcript (no API key, no auth — used by the Teacher Tools hub) ──
const TRANSCRIPT_CACHE = new Map();
const TITLE_CACHE = new Map();
function ytVideoId(url) {
  const s = String(url || '').trim();
  const m = s.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null;
}
function decodeEntities(t) {
  return String(t)
    .replace(/&amp;#39;|&#39;/g, "'").replace(/&amp;quot;|&quot;/g, '"')
    .replace(/&amp;amp;|&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
// Public InnerTube web key. The ANDROID client returns caption baseUrls that
// still work when fetched directly — unlike the watch-page baseUrls, which
// YouTube now gates behind a proof-of-origin token and serves empty.
const YT_INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
async function ytCaptionTracks(id) {
  const body = {
    context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' } },
    videoId: id,
  };
  const r = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${YT_INNERTUBE_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
    },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  return {
    tracks: j?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [],
    title: (j?.videoDetails?.title || '').trim(),
  };
}

router.get('/youtube-transcript', async (req, res) => {
  const id = ytVideoId(req.query.url || '');
  if (!id) return res.status(400).json({ error: 'Provide a valid YouTube link' });
  if (TRANSCRIPT_CACHE.has(id)) {
    return res.json({ transcript: TRANSCRIPT_CACHE.get(id), title: TITLE_CACHE.get(id) || '', videoId: id, cached: true });
  }
  try {
    const { tracks, title } = await ytCaptionTracks(id);
    if (!tracks.length) return res.status(404).json({ error: 'This video has no captions to transcribe' });
    // Prefer a manual English track, then any English (incl. auto), then anything.
    const track = tracks.find(t => /^en/.test(t.languageCode || '') && t.kind !== 'asr')
      || tracks.find(t => /^en/.test(t.languageCode || ''))
      || tracks[0];
    if (!track || !track.baseUrl) return res.status(404).json({ error: 'No transcript track available' });
    const xml = await (await fetch(track.baseUrl)).text();
    // format="3" timedtext: strip all tags (<p>, <s>, …), decode, collapse.
    const text = decodeEntities(xml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!text) return res.status(404).json({ error: 'Transcript was empty' });
    TRANSCRIPT_CACHE.set(id, text);
    TITLE_CACHE.set(id, title);
    if (TRANSCRIPT_CACHE.size > 100) {
      const oldest = TRANSCRIPT_CACHE.keys().next().value;
      TRANSCRIPT_CACHE.delete(oldest); TITLE_CACHE.delete(oldest);
    }
    res.json({ transcript: text, title, videoId: id });
  } catch (err) {
    console.error('[ai/youtube-transcript]', err.message);
    res.status(502).json({ error: 'Could not fetch the transcript right now' });
  }
});

// ── POST /api/ai/lesson-board — AI Memory Studio board generation ────────────
// No login required (teachers use it freely). Rate-limited per IP.
const lessonBoardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.AI_LESSON_PER_HOUR || 20),
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Lesson generation limit reached. Try again in an hour.' },
});

router.post('/lesson-board', lessonBoardLimiter, async (req, res) => {
  try {
    const { level='B1', skill='Writing', duration='45 min', audience='Teens',
            goal='confidence', tone='supportive', mode='lesson-board',
            topic='A practical English lesson',
            teacherMemory='', studentMemory='', mistakes='', source='' } = req.body || {};

    if (!aiEngine.enabled()) {
      return res.status(503).json({ error: 'AI not configured on this server' });
    }

    const prompt = `You are an expert ESL lesson planner. Return ONLY a JSON object (no markdown, no prose) with this exact shape:
{"title":"...","summary":"...","stages":[{"time":"...","title":"...","goal":"...","activity":"..."}],"vocabulary":["..."],"warmupPrompts":["..."],"assessmentCriteria":["..."],"modeAddons":["..."],"memoryHints":["..."],"mistakeItems":["..."],"homework":"...","challenge":"...","teacherScript":["..."]}

Lesson parameters:
- Level: ${level}
- Skill: ${skill}
- Duration: ${duration}
- Audience: ${audience}
- Goal: ${goal}
- Tone: ${tone}
- Mode: ${mode}
- Topic: ${topic}
${teacherMemory ? `- Teacher style: ${teacherMemory}` : ''}
${studentMemory ? `- Student profile: ${studentMemory}` : ''}
${mistakes ? `- Common mistakes to target: ${mistakes}` : ''}
${source ? `- Source material: ${source}` : ''}

Rules: 5 stages that sum to ${duration}. All activities must be practical and ready to use in class. vocabulary: 6-8 words. warmupPrompts: 3 items. assessmentCriteria: 3 items. modeAddons: 4-6 items. teacherScript: 3 lines.`;

    const result = await aiEngine.rawGenerate(prompt);
    result.provider = 'backend-ai';
    result.mode = mode;
    res.json({ result });
  } catch (err) {
    console.error('[ai/lesson-board]', err.message);
    res.status(500).json({ error: err.message || 'AI engine error' });
  }
});

// ── POST /api/ai/wordset-guest — no login required ──────────────────────────
// Powers the "AI assist" box on games/create.html for visitors without a
// teacher account. IP-limited and capped to keep free-tier usage in check.
const guestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.AI_GUEST_PER_HOUR || 8),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Free AI generation limit reached for now. Try again later, or log in as a teacher.' },
});

router.post('/wordset-guest', guestLimiter, async (req, res) => {
  try {
    const input = normaliseInput({ ...req.body, toolId: 'word-set-builder' });
    input.count = Math.max(4, Math.min(10, input.count));
    input.vocab = input.vocab.slice(0, 600);
    input.model = ''; // guests can't pick a model — use the server default chain
    const output = await generate(input);
    res.json({ output });
  } catch (err) {
    console.error('[ai/wordset-guest]', err.message);
    res.status(500).json({ error: err.message || 'AI engine error' });
  }
});

module.exports = router;
// The local engine is pure — no request, no database — so it is worth being able
// to exercise it directly instead of booting express and postgres around it.
module.exports.generateLocal = generateLocal;
module.exports.normaliseInput = normaliseInput;
