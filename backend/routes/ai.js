const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const aiEngine = require('../lib/aiEngine');
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
  return {
    toolId,
    level: clean(raw.level, 'B1').slice(0, 8),
    count,
    topic: clean(raw.topic, 'Practical English').slice(0, 160),
    action,
    source: limitText(raw.source, 18000),
    vocab: limitText(raw.vocab, 8000),
    extra: clean(raw.extra, '').slice(0, 600),
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
    source: input.source,
    vocab: input.vocab,
    extra: input.extra,
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

function sourceSentences(source, topic, count) {
  const parts = String(source || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => clean(s))
    .filter(s => s.length > 18)
    .slice(0, Math.max(count, 12));
  if (parts.length) return parts;
  return Array.from({ length: count }, (_, i) =>
    `${topic} creates a realistic classroom situation where students need to notice meaning, choose accurate language and explain their answer.`
  );
}

function vocabList(input, count = input.count) {
  const direct = String(input.vocab || '')
    .split(/[\n,;]+/)
    .map(s => clean(s))
    .filter(Boolean);
  if (direct.length) return direct.slice(0, count);

  const sourceWords = String(input.source || '')
    .toLowerCase()
    .match(/[a-z][a-z'-]{3,}/g) || [];
  const unique = [...new Set(sourceWords)]
    .filter(w => !['that', 'this', 'with', 'from', 'have', 'were', 'will', 'there', 'their', 'about', 'because'].includes(w))
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

function makeVocab(input) {
  const words = vocabList(input, input.count);
  return {
    ...base(input, 'vocab'),
    items: words.map((word, i) => ({
      word,
      definition: `A useful ${input.level} word or phrase for discussing ${input.topic}.`,
      example: `In ${input.topic}, "${word}" helps students explain idea ${i + 1}.`,
    })),
    cards: [{
      title: 'Teacher flow',
      text: 'Reveal meaning -> ask for examples -> sort hard words -> recycle in a speaking or writing task.',
    }],
  };
}

function makeMatching(input) {
  const words = vocabList(input, input.count);
  return {
    ...base(input, 'quiz'),
    questions: [{
      type: 'match',
      text: `Match the words with student-friendly definitions for ${input.topic}.`,
      pairs: words.map((word, i) => ({
        left: word,
        right: `Definition ${i + 1}: use this item accurately in a ${input.topic} context.`,
      })),
      points: words.length,
    }],
    sections: teacherFlow(input),
  };
}

function makeQuiz(input) {
  const sentences = sourceSentences(input.source, input.topic, input.count);
  const words = vocabList(input, input.count);
  const isTf = input.toolId === 'true-false';
  const isGap = ['gap', 'gaps-brackets', 'listening-dictation'].includes(input.toolId);
  const isTwo = input.toolId === 'two-options';
  const isOpen = ['open-questions', 'discussion', 'question-ladder'].includes(input.toolId);
  const isGist = input.toolId === 'gist-detail';

  const questions = Array.from({ length: input.count }, (_, i) => {
    const sentence = sentences[i % sentences.length];
    const word = words[i % words.length] || 'answer';
    if (isTf) {
      return {
        type: 'truefalse',
        text: i % 2 === 0 ? sentence : `${sentence.replace(/\b(always|never|often|sometimes)\b/i, 'rarely')} `,
        answer: i % 2 === 0,
        points: 1,
      };
    }
    if (isGap) {
      return {
        type: 'gap-fill',
        text: `${sentence.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i'), '_____')}${sentence.toLowerCase().includes(word.toLowerCase()) ? '' : ` Use: _____ (${word})`}`,
        answer: word,
        points: 1,
      };
    }
    if (isTwo) {
      return {
        type: 'mcq',
        text: `${sentence} Choose the better word for this context.`,
        options: [word, `${word}s`],
        answer: word,
        points: 1,
      };
    }
    if (isOpen || (isGist && i > 0)) {
      return {
        type: 'open',
        text: i === 0 ? `What is the main idea of ${input.topic}?` : `How does this detail connect to ${input.topic}: "${snippet(sentence, 90)}"?`,
        points: 1,
      };
    }
    return {
      type: 'mcq',
      text: i === 0 && isGist ? `What is the best gist of this text about ${input.topic}?` : `Question ${i + 1}: What can we understand from this part?`,
      options: [
        `A clear point about ${input.topic}`,
        `An unrelated detail`,
        `The opposite of the text`,
        `A grammar-only answer`,
      ],
      answer: `A clear point about ${input.topic}`,
      points: 1,
    };
  });

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

  const cards = [];
  for (let i = 0; i < input.count; i++) {
    const stage = stages[i % stages.length];
    cards.push({
      title: stage,
      text: `${stage} for ${input.topic} (${input.level}).\nTarget language: ${words.slice(i, i + 5).join(', ') || input.topic}.\nTeacher move: model one example, then ask students to upgrade their answer.`,
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
  if (['word-definition-match', 'word-image-match', 'word-translation-match', 'word-sorting', 'matching-halves'].includes(toolId)) return 'matching';
  if (['extract-vocab', 'essential-vocab', 'flashcards', 'collocations', 'word-families', 'synonyms-antonyms', 'phrasal-verbs', 'idioms'].includes(toolId)) return 'vocab';
  if (['text-topic-vocab', 'simplify-text', 'summary-task'].includes(toolId)) return 'cards'; // text-style cards
  if (['abcd-text', 'true-false', 'open-questions', 'gap', 'gaps-abcd', 'gaps-brackets', 'two-options', 'rewrite', 'rewrite-style', 'error-correction', 'word-order', 'type-gap', 'word-bank', 'tense-contrast', 'gist-detail', 'odd-one-out', 'discussion', 'question-ladder', 'listening-dictation', 'audio-video-questions', 'three-titles', 'reading-bits', 'summary-gapfill', 'choose-summary', 'warmup-listening', 'sentence-translation', 'conversation-starters'].includes(toolId)) return 'quiz';
  return 'cards';
}

// Local rule-engine fallback (the original `vps-fast-v1` behaviour).
function generateLocal(input) {
  if (['word-definition-match', 'word-image-match', 'word-translation-match', 'word-sorting', 'matching-halves'].includes(input.toolId)) return makeMatching(input);
  if (['extract-vocab', 'essential-vocab', 'flashcards', 'collocations', 'word-families'].includes(input.toolId)) return makeVocab(input);
  if (['text-topic-vocab', 'simplify-text', 'summary-task'].includes(input.toolId)) return makeText(input);
  if (['abcd-text', 'true-false', 'open-questions', 'gap', 'gaps-abcd', 'gaps-brackets', 'two-options', 'rewrite', 'error-correction', 'word-order', 'type-gap', 'word-bank', 'tense-contrast', 'gist-detail', 'odd-one-out', 'discussion', 'question-ladder', 'listening-dictation', 'audio-video-questions', 'three-titles', 'reading-bits', 'summary-gapfill', 'choose-summary', 'warmup-listening', 'sentence-translation'].includes(input.toolId)) return makeQuiz(input);
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
    const matchText = input.toolId === 'word-sorting'
      ? `Sort the words into the correct categories for ${input.topic}.`
      : input.toolId === 'word-translation-match'
        ? `Match each word with its translation (${input.topic}).`
        : input.toolId === 'matching-halves'
          ? `Match the two halves to make complete sentences (${input.topic}).`
          : `Match the words with student-friendly definitions for ${input.topic}.`;
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
    const out = { ...env, questions, sections };
    // Reading tools also return a passage the questions refer to.
    const p = data.passage;
    if (p && (p.text || p.title)) {
      out.passage = {
        title: line(p.title || ''),
        text: block(p.text || ''),
        vocab: Array.isArray(p.vocab)
          ? p.vocab.map(v => ({ word: line(v.word || ''), gloss: line(v.gloss || v.definition || '') }))
              .filter(v => v.word).slice(0, 10)
          : [],
      };
    }
    return out;
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
  lastAt: null,    // ISO timestamp of last request
  byModel: {},     // per-model success counts
  startedAt: new Date().toISOString(),
};

// Primary entry: try the LLM, fall back to the local rule engine on any error.
async function generate(input) {
  if (aiEngine.enabled()) {
    try {
      input.boardKind = boardKindFor(input.toolId);
      const out = assembleFromLLM(input, await aiEngine.generate(input));
      METRICS.llmOk++;
      const m = aiEngine.getLastModel() || aiEngine.MODEL;
      METRICS.lastModel = m;
      METRICS.byModel[m] = (METRICS.byModel[m] || 0) + 1;
      recordUsage('llm_ok');
      return out;
    } catch (err) {
      METRICS.fallback++;
      METRICS.lastError = err.message;
      recordUsage('fallback');
      console.error('[ai/llm] falling back to rule engine:', err.message);
    }
  }
  const out = generateLocal(input);
  // Reading comprehension fallback: if the teacher pasted a source, echo it as
  // the passage so the worksheet still shows a text to read.
  if (out && out.boardKind === 'quiz' && !out.passage
      && ['abcd-text','true-false','gist-detail','three-titles','open-questions','choose-summary','audio-video-questions','summary-gapfill','listening-dictation'].includes(input.toolId)
      && input.source && String(input.source).trim().length > 40) {
    out.passage = { title: String(input.topic || 'Reading text'), text: String(input.source).trim(), vocab: [] };
  }
  return out;
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
    mode: llm ? 'cloud-llm-with-rule-fallback' : 'server-cache-rule-engine',
    llmEnabled: llm,
    cacheSize: cache.size,
    maxItems: MAX_ITEMS,
    ratePerMin: Number(process.env.AI_RATE_PER_MIN || 15),
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

module.exports = router;
