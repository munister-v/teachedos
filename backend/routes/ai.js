const router = require('express').Router();
const { requireAuth, requireTeacher } = require('../middleware/auth');

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

function generate(input) {
  if (['word-definition-match', 'word-image-match', 'word-sorting'].includes(input.toolId)) return makeMatching(input);
  if (['extract-vocab', 'essential-vocab', 'flashcards', 'collocations', 'word-families'].includes(input.toolId)) return makeVocab(input);
  if (['text-topic-vocab', 'simplify-text', 'summary-task'].includes(input.toolId)) return makeText(input);
  if (['abcd-text', 'true-false', 'open-questions', 'gap', 'gaps-abcd', 'gaps-brackets', 'two-options', 'rewrite', 'error-correction', 'tense-contrast', 'gist-detail', 'discussion', 'question-ladder', 'listening-dictation', 'audio-video-questions'].includes(input.toolId)) return makeQuiz(input);
  return makeCards(input);
}

router.post('/teacher-tool', requireAuth, requireTeacher, (req, res) => {
  const started = Date.now();
  try {
    const input = normaliseInput(req.body);
    const key = cacheKey(req.user.id, input);
    const hit = cacheGet(key);
    if (hit) {
      hit.cached = true;
      hit.processingMs = Date.now() - started;
      return res.json({ output: hit });
    }
    const output = generate(input);
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
  res.json({
    ok: true,
    engine: 'vps-fast-v1',
    mode: 'server-cache-rule-engine',
    cacheSize: cache.size,
    maxItems: MAX_ITEMS,
  });
});

// ── YouTube transcript (no API key, no auth — used by the Teacher Tools hub) ──
const TRANSCRIPT_CACHE = new Map();
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
router.get('/youtube-transcript', async (req, res) => {
  const id = ytVideoId(req.query.url || '');
  if (!id) return res.status(400).json({ error: 'Provide a valid YouTube link' });
  if (TRANSCRIPT_CACHE.has(id)) return res.json({ transcript: TRANSCRIPT_CACHE.get(id), videoId: id, cached: true });
  try {
    const watch = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const html = await watch.text();
    const m = html.match(/"captionTracks":(\[.*?\])/);
    if (!m) return res.status(404).json({ error: 'This video has no captions to transcribe' });
    let tracks;
    try { tracks = JSON.parse(m[1]); } catch { return res.status(502).json({ error: 'Could not read captions' }); }
    const track = tracks.find(t => /^en/.test(t.languageCode || '')) || tracks[0];
    if (!track || !track.baseUrl) return res.status(404).json({ error: 'No transcript track available' });
    const xml = await (await fetch(track.baseUrl)).text();
    const text = decodeEntities(
      xml.replace(/<text[^>]*>/g, ' ').replace(/<\/text>/g, ' ').replace(/<[^>]+>/g, '')
    ).replace(/\s+/g, ' ').trim();
    if (!text) return res.status(404).json({ error: 'Transcript was empty' });
    TRANSCRIPT_CACHE.set(id, text);
    if (TRANSCRIPT_CACHE.size > 100) TRANSCRIPT_CACHE.delete(TRANSCRIPT_CACHE.keys().next().value);
    res.json({ transcript: text, videoId: id });
  } catch (err) {
    console.error('[ai/youtube-transcript]', err.message);
    res.status(502).json({ error: 'Could not fetch the transcript right now' });
  }
});

module.exports = router;
