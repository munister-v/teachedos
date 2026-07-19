// ── Free cloud LLM generator for teacher tools ──────────────────────────────
// Replaces the old `vps-fast-v1` rule engine with a real LLM, using any
// OpenAI-compatible chat-completions endpoint. Defaults to Groq's free tier.
// Keeps the exact same output envelope the front-end consumes
// (board.html / lesson-builder.html / game-builder.html / teacher-tools.html).
//
// Configure via environment (set these on the VPS):
//   AI_API_KEY    — required to enable the engine (free key from Groq/Gemini/…)
//   AI_BASE_URL   — default https://api.groq.com/openai/v1
//   AI_MODEL      — default llama-3.3-70b-versatile
//
// Examples:
//   Groq    : AI_BASE_URL=https://api.groq.com/openai/v1            AI_MODEL=llama-3.3-70b-versatile
//   Gemini  : AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai  AI_MODEL=gemini-2.0-flash
//   OpenRouter: AI_BASE_URL=https://openrouter.ai/api/v1            AI_MODEL=meta-llama/llama-3.3-70b-instruct:free
//   OpenRouter native fallback chain:
//     AI_OPENROUTER_MODELS=model-a,model-b,model-c
//     AI_OPENROUTER_SORT=throughput|latency|price
//
// Without AI_API_KEY, or on any error, the caller falls back to the local rule
// engine — nothing breaks, generation just degrades to the old templates.

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 12000);
const MAX_ATTEMPTS = Math.max(1, Math.min(4, Number(process.env.AI_MAX_ATTEMPTS || 2)));

function listEnv(name, fallback = []) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

const OPENROUTER_DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const OPENROUTER_FALLBACK_MODELS = listEnv('AI_OPENROUTER_MODELS', [
  OPENROUTER_DEFAULT_MODEL,
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'deepseek/deepseek-chat:free',
]);

const PRIMARY_KEY = process.env.AI_API_KEY || '';
const PRIMARY_URL = (process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
const PRIMARY_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
// Lighter, much faster model on the SAME provider/key. On Groq it lives in a
// separate rate-limit bucket, so it rescues most 429s before we ever drop to
// the rule engine. Set AI_MODEL_LIGHT='' to disable.
const LIGHT_MODEL = process.env.AI_MODEL_LIGHT === undefined
  ? 'llama-3.1-8b-instant'
  : process.env.AI_MODEL_LIGHT;

// Ordered provider chain. We try each in turn; on the final failure the caller
// falls back to the local rule engine. The chain is:
//   1) primary model            (e.g. Groq llama-3.3-70b-versatile)
//   2) light model, same key    (e.g. Groq llama-3.1-8b-instant) — fresh quota
//   3) external secondary        (e.g. OpenRouter free, via AI_API_KEY_2)
const PROVIDERS = [
  { name: 'primary', key: PRIMARY_KEY, baseUrl: PRIMARY_URL, model: PRIMARY_MODEL },
];
if (PRIMARY_KEY && LIGHT_MODEL && LIGHT_MODEL !== PRIMARY_MODEL) {
  PROVIDERS.push({ name: 'light', key: PRIMARY_KEY, baseUrl: PRIMARY_URL, model: LIGHT_MODEL });
}
PROVIDERS.push({
  name: 'secondary',
  key: process.env.AI_API_KEY_2 || '',
  baseUrl: (process.env.AI_BASE_URL_2 || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
  model: process.env.AI_MODEL_2 || OPENROUTER_FALLBACK_MODELS[0] || OPENROUTER_DEFAULT_MODEL,
});
const CHAIN = PROVIDERS.filter(p => p.key);

// OpenRouter provider used as the override target when the caller picks a
// specific free model (games/create.html model switcher). Reuses whichever
// configured key already points at OpenRouter.
const OPENROUTER_PROVIDER = CHAIN.find(p => p.baseUrl.includes('openrouter')) || null;

// Curated list of free OpenRouter models offered in the games/create.html
// "AI model" switcher. Any of these can be requested via input.model.
const FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'deepseek/deepseek-chat:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

// Primary descriptors kept for status reporting / the engine label.
const MODEL = CHAIN[0]?.model || PRIMARY_MODEL;
const BASE_URL = CHAIN[0]?.baseUrl || PRIMARY_URL;

// The model that actually produced the last successful generation.
let lastUsedModel = null;
let lastTrace = null;
function getLastModel() { return lastUsedModel; }
function getLastTrace() { return lastTrace; }
function listModels() {
  return uniq(CHAIN.flatMap(p => isOpenRouter(p) ? [p.model, ...OPENROUTER_FALLBACK_MODELS] : [p.model]));
}

// Complexity routing. "Heavy" work (full lesson cards, essays, reading
// comprehension, gist) genuinely benefits from the big model, so it stays
// first. Everything else (vocab, matching, simple grammar/quiz drills) is
// "light": we try the fast small model FIRST to save the 70B quota and cut
// latency, with the big model still behind it as a quality backstop.
const HEAVY_TOOLS = new Set([
  'abcd-text', 'gist-detail', 'three-titles', 'choose-summary', 'reading-bits',
]);
function isLight(input) {
  if (input.boardKind === 'cards') return false;      // lesson packs, dialogues, essays…
  if (HEAVY_TOOLS.has(input.toolId)) return false;    // comprehension / reasoning
  return true;
}
// Return the provider chain ordered for this request's complexity.
function orderedChain(input) {
  if (!isLight(input)) return CHAIN;
  const light = CHAIN.filter(p => p.name === 'light');
  if (!light.length) return CHAIN;
  const rest = CHAIN.filter(p => p.name !== 'light');
  return [...light, ...rest];
}

function enabled() {
  return CHAIN.length > 0;
}

// Pull the first balanced JSON value (object or array) out of a model reply,
// tolerating ```json fences and stray prose.
function extractJson(text) {
  if (!text) throw new Error('empty model response');
  let s = String(text).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.search(/[[{]/);
  if (start < 0) throw new Error('no JSON found in response');
  const open = s[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('unbalanced JSON in response');
  return JSON.parse(s.slice(start, end + 1));
}

const SYSTEM = [
  'You are an expert EFL/ESL teacher and materials writer.',
  'You design clear, classroom-ready content pitched precisely to the requested CEFR level (A1–C2):',
  'control the vocabulary, grammar and sentence length so it is neither too easy nor too hard for that level.',
  'Quality rules that ALWAYS apply:',
  '• Produce EXACTLY the number of items requested — no more, no fewer.',
  '• Every item must be distinct — never repeat or trivially reword another item.',
  '• Use natural, native-like English; keep content culturally neutral and age-appropriate.',
  '• For multiple-choice questions: exactly ONE option is correct; the other options must be',
  '  plausible but clearly wrong distractors (real misconceptions, not random words), all the same',
  '  type/length as the answer. The "answer" field MUST be the full text of the correct option, copied verbatim.',
  '• For anything built from a source text/transcript, base every item strictly on that text.',
  'You always return ONLY a single valid JSON object that exactly matches the requested shape —',
  'no markdown, no commentary, no code fences, no trailing text.',
].join(' ');

// Describe the target JSON shape per board kind. The model fills these in;
// the route then wraps them in the shared `base()` envelope.
function shapeSpec(input) {
  const { boardKind, toolId, level, topic, count } = input;

  // ── games/create.html: build a custom vocab set (en/uk/ru/example) ────────
  if (toolId === 'word-set-builder') {
    const wordsList = String(input.vocab || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (wordsList.length) {
      return {
        task: `For ESL students at ${level} level, produce a vocab entry for EACH of these words/phrases (one entry per word, same order, do not add or skip any): ${wordsList.join(', ')}. For each: "en" = the word/phrase as given; "uk" = its Ukrainian translation; "ru" = its Russian translation; "ex" = one natural ${level}-level English example sentence using it.`,
        schema: '{"words":[{"en":"...","uk":"...","ru":"...","ex":"..."}]}',
      };
    }
    return {
      task: `For ESL students at ${level} level, build a vocabulary set of exactly ${count} useful words/phrases on the topic "${topic}". For each: "en" = the English word/phrase; "uk" = its Ukrainian translation; "ru" = its Russian translation; "ex" = one natural ${level}-level English example sentence using it.`,
      schema: '{"words":[{"en":"...","uk":"...","ru":"...","ex":"..."}]}',
    };
  }

  const ctx = [];
  if (input.source) ctx.push(`Source text / transcript:\n"""${input.source}"""`);
  if (input.vocab) ctx.push(`Target vocabulary: ${input.vocab}`);
  if (input.extra) ctx.push(`Extra teacher note: ${input.extra}`);
  const context = ctx.length ? `\n\n${ctx.join('\n\n')}` : '';
  const head = `Tool: ${toolId}. CEFR level: ${level}. Topic: "${topic}".`;

  // ── Reading text controls (genre + length) ──────────────────────────────────
  // Optional input.genre / input.length from the UI; otherwise sensible defaults
  // (length scales with CEFR level so A1 texts stay short and C1 texts longer).
  const GENRES = {
    article: 'a short magazine / news article', story: 'a short narrative story',
    email: 'an informal email or letter', report: 'a clear factual report',
    blog: 'an engaging blog post', dialogue: 'a natural two-person dialogue',
    review: 'a review (film / book / product / place)',
  };
  const genre = GENRES[String(input.genre || '').toLowerCase()] || '';
  const genreText = genre ? ` Write it as ${genre}.` : '';
  const LEN_BANDS = { short: '90–130', medium: '160–200', long: '240–320' };
  const lvlDefaultWords = /^A[12]/i.test(level) ? '90–130' : /^C[12]/i.test(level) ? '240–320' : '160–200';
  const words = LEN_BANDS[String(input.length || '').toLowerCase()] || lvlDefaultWords;

  if (boardKind === 'vocab') {
    if (toolId === 'flashcards') {
      return {
        task: `${head} Build a flashcard for EACH target word/phrase the teacher provided: "word" = the target word, "definition" = a short student-friendly definition (max 12 words), "example" = a natural ${level} sentence using it. Make exactly one item per target word — do NOT invent extra words. If no target words are given, choose the ${count} most essential words for the topic.${context}`,
        schema: '{"items":[{"word":"...","definition":"...","example":"..."}]}',
      };
    }
    if (toolId === 'collocations') {
      return {
        task: `${head} Produce exactly ${count} collocation entries for this topic. For each: "word" = the headword; "definition" = its 3–4 strongest natural collocations separated by commas (e.g. "make a decision, take a decision, reach a decision"); "example" = one natural ${level} sentence using one collocation.${context}`,
        schema: '{"items":[{"word":"headword","definition":"collocation, collocation, collocation","example":"..."}]}',
      };
    }
    if (toolId === 'word-families') {
      return {
        task: `${head} Produce exactly ${count} word-family entries. For each: "word" = the base word; "definition" = the family forms labelled "noun: … · verb: … · adjective: … · adverb: …" (use "—" when a form does not exist); "example" = one natural ${level} sentence using one of the forms.${context}`,
        schema: '{"items":[{"word":"base word","definition":"noun: … · verb: … · adjective: … · adverb: …","example":"..."}]}',
      };
    }
    if (toolId === 'synonyms-antonyms') {
      return {
        task: `${head} Produce exactly ${count} entries for useful topic words. For each: "word" = the headword; "definition" = "synonyms: … · antonyms: …" (2–3 each at ${level} level; if a word has no real antonym, write "antonyms: —"); "example" = one natural sentence using the headword.${context}`,
        schema: '{"items":[{"word":"headword","definition":"synonyms: …, … · antonyms: …, …","example":"..."}]}',
      };
    }
    if (toolId === 'phrasal-verbs') {
      return {
        task: `${head} Produce exactly ${count} phrasal verbs relevant to this topic. For each: "word" = the phrasal verb (e.g. "check in"); "definition" = a short plain-English meaning (max 12 words); "example" = a natural ${level} sentence using it.${context}`,
        schema: '{"items":[{"word":"phrasal verb","definition":"plain meaning","example":"..."}]}',
      };
    }
    if (toolId === 'idioms') {
      return {
        task: `${head} Produce exactly ${count} common idioms / fixed expressions connected to this topic. For each: "word" = the idiom; "definition" = its plain meaning (max 12 words); "example" = a natural ${level} sentence using it in context.${context}`,
        schema: '{"items":[{"word":"idiom","definition":"plain meaning","example":"..."}]}',
      };
    }
    const source = toolId === 'extract-vocab'
      ? `Extract the ${count} most useful and teachable words/phrases that actually appear in the source text below (skip trivial function words). For each, give a short student-friendly definition (max 15 words) and quote or adapt a natural example sentence at ${level} level.`
      : `Suggest exactly ${count} essential, high-frequency vocabulary items a student needs to talk about this topic. For each, give a short student-friendly definition (max 15 words) and a natural example sentence at ${level} level.`;
    return {
      task: `${head} ${source}${context}`,
      schema: '{"items":[{"word":"...","definition":"...","example":"..."}]}',
    };
  }

  if (boardKind === 'matching') {
    if (toolId === 'word-translation-match') {
      return {
        task: `${head} Produce exactly ${count} matching pairs. "left" = the English target word/phrase, "right" = its translation. Translate into the language named in the teacher note; if none is given, translate into Ukrainian. Keep translations short and natural at ${level} level.${context}`,
        schema: '{"pairs":[{"left":"english word","right":"translation"}]}',
      };
    }
    if (toolId === 'word-sorting') {
      const cats = Math.max(2, Math.min(4, Math.round(count / 4)));
      return {
        task: `${head} Build a word-sorting task. First invent ${cats} DISTINCT categories that group words by a GENUINE shared property — by part of speech, by function, or by sub-theme. STRICT RULES: (1) NEVER use the topic name "${topic}" as a category label; (2) no vague catch-alls such as "Other", "Misc", "Language skills" or "General"; (3) the categories must be clearly different from each other; (4) every category must receive at least 2 words; (5) assign each word to the ONE category it genuinely belongs to (do not spread randomly). Produce exactly ${count} words. "left" = the word, "right" = its category label.${context}`,
        schema: '{"pairs":[{"left":"word","right":"Category label"}]}',
      };
    }
    if (toolId === 'matching-halves') {
      return {
        task: `${head} Produce exactly ${count} items split into two halves to be matched — sentence beginnings/endings or collocations at ${level} level. "left" = the first half, "right" = the matching second half. Each pair must combine into one natural, grammatical sentence or phrase.${context}`,
        schema: '{"pairs":[{"left":"first half","right":"second half"}]}',
      };
    }
    if (toolId === 'word-image-match') {
      return {
        task: `${head} Produce exactly ${count} concrete, picturable vocabulary items for this topic. Choose words that have a clear visual referent — nouns and concrete objects work best. "left" = the English word at ${level} level; "right" = a short Wikipedia-style search query (2–4 words, no articles, specific enough to find a clear photo — e.g. "volcano eruption", "hospital operating room", "wheat field harvest"). If the teacher provided target words, use exactly those words.${context}`,
        schema: '{"pairs":[{"left":"word","right":"wikipedia search query"}]}',
      };
    }
    if (toolId === 'word-definition-match') {
      return {
        task: `${head} Use the EXACT target vocabulary the teacher provided below. For each word/phrase: "left" = the word exactly as given; "right" = a clear, short, student-friendly definition at ${level} level (max 12 words; do NOT just repeat or translate the word). Keep the teacher's words and order; only invent extra words if fewer than ${count} were given.${context}`,
        schema: '{"pairs":[{"left":"word","right":"short definition"}]}',
      };
    }
    if (toolId === 'match-headings') {
      return {
        task: `${head} Read the source text and divide it into its natural paragraphs (or, if it is one block, into 4–6 logical sections). For EACH paragraph write ONE short, accurate heading that captures its main idea. "left" = "Paragraph N: <first 6–8 words…>" so the student can identify the paragraph; "right" = the heading. Keep headings parallel in style and at ${level} level. Do NOT reuse a heading.${context}`,
        schema: '{"pairs":[{"left":"Paragraph 1: first words…","right":"Heading"}]}',
      };
    }
    return {
      task: `${head} Produce exactly ${count} matching pairs. "left" = a word/phrase, "right" = a short student-friendly definition or match at ${level} level.${context}`,
      schema: '{"pairs":[{"left":"...","right":"..."}]}',
    };
  }

  if (boardKind === 'quiz') {
    const isTf = toolId === 'true-false';
    const isGap = ['gap', 'gaps-brackets', 'listening-dictation'].includes(toolId);
    const isTwo = toolId === 'two-options';
    const isOpen = ['open-questions', 'discussion', 'question-ladder'].includes(toolId);
    const isMcqGap = toolId === 'gaps-abcd';
    const isAbcd = toolId === 'abcd-text';
    const isGist = toolId === 'gist-detail';
    const isOdd = toolId === 'odd-one-out';
    const isWarmup = toolId === 'warmup-listening';

    if (toolId === 'tf-not-given') {
      return {
        task: `${head} Based ONLY on the source text, produce exactly ${count} statements at ${level} level in a varied order, mixing three kinds: some clearly TRUE (supported by the text), some FALSE (directly contradicted by the text), and some NOT GIVEN (plausible, on-topic, but the text neither confirms nor denies them). Aim for a roughly even mix. For each: "options" = ["True","False","Not Given"] and "answer" = the correct one. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"statement about the text","options":["True","False","Not Given"],"answer":"True","points":1}]}',
      };
    }
    if (toolId === 'vocab-in-context') {
      return {
        task: `${head} Choose exactly ${count} useful words/phrases that ACTUALLY APPEAR in the source text. For each write a question: "text" = 'In the text, "<word>" means:'; "options" = 4 short meanings — exactly ONE matching how the word is used IN THIS TEXT, plus 3 plausible distractors (include a common but wrong-in-this-context meaning); "answer" = the correct meaning text verbatim. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"In the text, \\"word\\" means:","options":["correct meaning","distractor","distractor","distractor"],"answer":"correct meaning","points":1}]}',
      };
    }
    if (toolId === 'reference-questions') {
      return {
        task: `${head} Find exactly ${count} reference words in the source text (pronouns / determiners such as it, this, that, they, these, those, one, such, here) and ask what each refers back to. "text" = 'In "<short quote that contains the word>", what does "<word>" refer to?'; "answer" = the exact thing it refers to from the text. Use type "open".${context}`,
        schema: '{"questions":[{"type":"open","text":"In \\"…it…\\", what does \\"it\\" refer to?","answer":"the noun it refers to","points":1}]}',
      };
    }
    if (toolId === 'sentence-insertion') {
      return {
        task: `${head} From the source text build exactly ${count} sentence-insertion items at ${level} level. For each: remove ONE meaningful sentence from a paragraph, then show that paragraph with four numbered gap markers [1] [2] [3] [4] placed between sentences. "text" = 'Where does this sentence best fit?\\nMissing sentence: "<removed sentence>"\\n\\n<paragraph with [1] … [4]>'; "options" = ["[1]","[2]","[3]","[4]"]; "answer" = the correct marker. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"Where does this sentence best fit? Missing sentence: \\"…\\" …[1]…[2]…[3]…[4]…","options":["[1]","[2]","[3]","[4]"],"answer":"[2]","points":1}]}',
      };
    }

    if (isOdd) {
      return {
        task: `${head} Produce exactly ${count} "odd one out" groups. In each group, "options" is an array of 4 words where 3 clearly share a category (meaning, grammar or theme) and 1 does not belong; "answer" is the word that does NOT belong; "text" briefly names what the 3 have in common. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"3 are ... — which is the odd one?","options":["w1","w2","w3","w4"],"answer":"odd word","points":1}]}',
      };
    }
    if (toolId === 'error-correction') {
      return {
        task: `${head} Produce exactly ${count} sentences that each contain exactly ONE natural grammar or vocabulary mistake a ${level} learner would make. "text" = the incorrect sentence; "answer" = the fully corrected sentence. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"incorrect sentence","answer":"corrected sentence","points":1}]}',
      };
    }
    if (toolId === 'rewrite') {
      return {
        task: `${head} Produce exactly ${count} rewrite tasks targeting the grammar structure in the topic/teacher note. "text" = the original sentence followed by " → (use: KEY WORD/STRUCTURE)"; "answer" = the correctly rewritten sentence keeping the same meaning. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"Original sentence. → (use: ...)","answer":"rewritten sentence","points":1}]}',
      };
    }
    if (toolId === 'word-order') {
      return {
        task: `${head} Produce exactly ${count} sentences for word-order practice at ${level} level. "text" = the sentence words shuffled out of order and joined with " / " (keep capitalisation natural, drop the final period); "answer" = the correct sentence. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"word / shuffled / the / are","answer":"The words are shuffled.","points":1}]}',
      };
    }
    if (toolId === 'type-gap') {
      return {
        task: `${head} Produce exactly ${count} gap-fill sentences at ${level} level where several words could fit and the student types their own. Use "_____" for the gap; "answer" = ONE natural example word that fits. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"sentence with _____","answer":"example word","points":1}]}',
      };
    }
    if (toolId === 'word-bank') {
      return {
        task: `${head} Produce exactly ${count} gap-fill sentences at ${level} level. Use "_____" for the gap; "answer" = the exact missing word. The set of all answers will be shown to students as a shuffled word bank, so make every answer a distinct single word. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"sentence with _____","answer":"word","points":1}]}',
      };
    }
    if (isTf) {
      return {
        task: `${head} Produce exactly ${count} True/False statements at ${level} level. Each "text" must be ONE short original sentence (max ~20 words) that YOU write to test a single fact from the source — never copy or quote a whole sentence, paragraph or the transcript itself. Alternate true and false; for false ones make one factual change. Use type "truefalse" and a boolean "answer".${context}`,
        schema: '{"questions":[{"type":"truefalse","text":"statement","answer":true,"points":1}]}',
      };
    }
    if (isGap) {
      return {
        task: `${head} Produce exactly ${count} gap-fill sentences at ${level} level. Use "_____" for the gap and give the exact missing word as "answer". Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"sentence with _____","answer":"word","points":1}]}',
      };
    }
    if (isTwo) {
      return {
        task: `${head} Produce exactly ${count} two-option grammar/vocabulary choices at ${level} level. Each has a blank and exactly 2 options; "answer" must equal the correct option text. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"sentence with _____","options":["A","B"],"answer":"A","points":1}]}',
      };
    }
    if (toolId === 'tense-contrast') {
      return {
        task: `${head} Produce exactly ${count} sentences that contrast the two tenses named in the topic/teacher note (e.g. Present Perfect vs Past Simple). Each: "text" = a sentence with a blank and exactly 2 tense-form options shown as the blank; "options" = the two verb forms; "answer" = the correct form for that context. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"I _____ (just finish / just finished) my homework.","options":["have just finished","just finished"],"answer":"have just finished","points":1}]}',
      };
    }
    if (toolId === 'audio-video-questions') {
      return {
        task: `${head} Based on the transcript / notes, produce exactly ${count} comprehension questions about the audio or video. Make the first ~half multiple-choice (type "mcq") and the rest open detail questions (type "open"). Each MCQ must test a DIFFERENT specific moment or fact from the transcript — do not write generic template questions ("What can we understand from this part?") and do not reuse the same 4 options (or same option pattern) across questions. Every MCQ has 4 full, meaningful answer phrases as options (never a copy-pasted chunk of the transcript, never a meta-comment about the question itself like "an unrelated detail" or "the opposite of the main idea") — exactly one is correct and "answer" must equal that option's text verbatim. Open questions ask about a detail or opinion, not the transcript verbatim.${context}`,
        schema: '{"questions":[{"type":"mcq","text":"Why did the speaker visit the museum?","options":["To see a specific exhibit","To meet a friend for lunch","To attend a work meeting","To get out of the rain"],"answer":"To see a specific exhibit","points":1},{"type":"open","text":"What surprised the speaker most, and why?","points":1}]}',
      };
    }
    if (toolId === 'rewrite-style') {
      const tone = input.extra ? `the style named in the teacher note (${input.extra})` : 'a more formal / academic style';
      return {
        task: `${head} Produce exactly ${count} rewrite tasks. "text" = an original ${level} sentence + " → (rewrite: TONE)"; "answer" = the same sentence rewritten in ${tone}, keeping the meaning. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"Original sentence. → (rewrite: formal)","answer":"Rewritten sentence.","points":1}]}',
      };
    }
    if (toolId === 'conversation-starters') {
      return {
        task: `${head} Produce exactly ${count} fun, low-pressure conversation starters at ${level} level to get students talking about this topic. Mix formats: "Would you rather …?", personal questions ("Have you ever …?"), opinions and imaginative "what if" prompts. Keep them light and engaging. Use type "open".${context}`,
        schema: '{"questions":[{"type":"open","text":"Would you rather …?","points":1}]}',
      };
    }
    if (isOpen || isWarmup) {
      const openTask = isWarmup
        ? `${head} Produce exactly ${count} pre-listening prediction questions at ${level} level that activate prior knowledge and curiosity before hearing/watching. Mix prediction ("What do you think...?"), prior knowledge ("What do you already know about...?"), and personal connection ("Have you ever...?") types. Use type "open".`
        : `${head} Produce exactly ${count} open-ended questions at ${level} level that encourage critical thinking and personal response. Use type "open".`;
      return {
        task: `${openTask}${context}`,
        schema: '{"questions":[{"type":"open","text":"question?","points":1}]}',
      };
    }
    if (toolId === 'three-titles') {
      return {
        task: `${head} Read the source text and produce exactly 1 MCQ: "text" = "Which title best fits the text?", "options" = 3 possible titles (the correct one + 2 plausible but inaccurate distractors), "answer" = the correct title text exactly. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"Which title best fits the text?","options":["Title A","Title B","Title C"],"answer":"Title A","points":1}]}',
      };
    }
    if (toolId === 'reading-bits') {
      const n = Math.max(4, Math.min(count, 6));
      return {
        task: `${head} Split the source text (or create a short ${level} reading text about the topic) into exactly ${n} logical paragraphs. Return them in SHUFFLED order. Each paragraph = one question: "text" = the paragraph content, "answer" = the correct position number as a string ("1", "2", …), type = "gap-fill". The student rearranges them.${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"paragraph text here","answer":"2","points":1}]}',
      };
    }
    if (toolId === 'summary-gapfill') {
      return {
        task: `${head} Write a 5–7 sentence summary of the source text / topic at ${level} level. Remove 6–8 key content words and replace each with "_____". Return one "gap-fill" question per gap: "text" = the full sentence containing "_____", "answer" = the removed word exactly. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"sentence with _____","answer":"removed word","points":1}]}',
      };
    }
    if (toolId === 'choose-summary') {
      return {
        task: `${head} Produce exactly 1 MCQ where the student picks the most accurate SUMMARY of the source text / topic — a summary is a short original paraphrase in your own words (2-3 sentences), never the transcript/source text copied or quoted directly. "options" = 3 such summaries, each 2-3 sentences: one accurate, one that sounds plausible but is too vague/generic to show real understanding, one that states a specific wrong detail (a name, number, place or event that contradicts the source). Do NOT write meta-descriptions of the options (never "the speaker lists unrelated details" or "the opposite of the main idea") — write the actual summary sentences a student would read and judge for themselves. "answer" = the accurate summary's text exactly. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"Which summary best describes the video?","options":["Two-to-three sentence paraphrase that accurately covers the main points of the video.","Two-to-three sentence paraphrase that is technically true but too generic to show the video was watched.","Two-to-three sentence paraphrase that gets one concrete fact wrong."],"answer":"Two-to-three sentence paraphrase that accurately covers the main points of the video.","points":1}]}',
      };
    }
    if (toolId === 'sentence-translation') {
      return {
        task: `${head} Produce exactly ${count} translation tasks. Each: "text" = a Ukrainian sentence (or the language named in the teacher note) containing a highlighted target English word/phrase; "answer" = a natural English translation at ${level} level. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"Ukrainian sentence with [target word]","answer":"Natural English translation","points":1}]}',
      };
    }
    if (isGist) {
      return {
        task: `${head} Produce EXACTLY ${count} reading-comprehension questions based ONLY on the source text, in this order: (1) the FIRST is ONE gist / main-idea MCQ; (2) the MAJORITY of the rest are DETAIL MCQs that check specific facts stated in the text — make these the bulk of the set; (3) end with only 1–2 OPEN inference / opinion questions. So most questions are multiple-choice. Every MCQ has 4 plausible options that are FULL, meaningful answers (complete phrases — NOT single words copied from the text), exactly one correct and three realistic distractors; "answer" must equal the correct option text verbatim. Open questions have no options.${context}`,
        schema: '{"questions":[{"type":"mcq","text":"What is the main idea of the text?","options":["full answer phrase A","full answer phrase B","full answer phrase C","full answer phrase D"],"answer":"full answer phrase A","points":1},{"type":"mcq","text":"detail question about a stated fact?","options":["...","...","...","..."],"answer":"...","points":1},{"type":"open","text":"inference or opinion question?","points":2}]}',
      };
    }
    const verb = isMcqGap ? 'multiple-choice gap-fill sentences (one blank, 4 options)'
      : isAbcd ? 'multiple-choice comprehension questions (4 options)'
        : 'multiple-choice questions (4 options)';
    return {
      task: `${head} Produce exactly ${count} ${verb} at ${level} level. Each has 4 options and "answer" equal to the correct option text. Use type "mcq".${context}`,
      schema: '{"questions":[{"type":"mcq","text":"question","options":["A","B","C","D"],"answer":"correct option text","points":1}]}',
    };
  }

  // boardKind === 'cards' (lesson packs, worksheets, texts, dialogues, etc.)
  if (toolId === 'simplify-text') {
    const mode = input.action === 'upgrade' ? 'rewrite at a higher level with richer vocabulary and connectors'
      : input.action === 'keep' ? 'rewrite keeping the same level but cleaner'
        : 'simplify using easier vocabulary and shorter sentences';
    return {
      task: `${head} ${mode[0].toUpperCase() + mode.slice(1)}. Return one card whose text is the adapted version, plus a short teacher-note card. Keep the main ideas.${context}`,
      schema: '{"cards":[{"title":"...","text":"..."}],"vocab":["word","word"]}',
    };
  }
  if (toolId === 'text-topic-vocab') {
    return {
      task: `${head} Write a leveled reading text (about ${words} words, 2–4 natural paragraphs) at ${level} level that NATURALLY uses EVERY target word/phrase from the vocabulary list in context — mark each target word in **bold** the first time it appears, and do not force them awkwardly.${genreText} Return cards in this order: 1) "📖 Reading text" — a short title on the first line, then the text; 2) "🔑 Glossary" — every target word, one per line as "word — short ${level} definition"; 3) "Before reading" — 2 prediction/lead-in questions; 4) "After reading" — 3 comprehension questions that check the target words in context. Put all target words in "vocab".${context}`,
      schema: '{"cards":[{"title":"📖 Reading text","text":"Title\\nParagraph text…"},{"title":"🔑 Glossary","text":"word — definition\\n…"},{"title":"Before reading","text":"1. …\\n2. …"},{"title":"After reading","text":"1. …\\n2. …\\n3. …"}],"vocab":["word"]}',
    };
  }
  if (toolId === 'summary-task') {
    return {
      task: `${head} Read the source text and build a summarising worksheet at ${level} level. Return cards in this order: 1) "🎯 Main idea" — ONE sentence capturing the central point; 2) "🔑 Key details" — 4–6 of the most important supporting points, one per line as "• …"; 3) "✍️ Your summary" — a guided frame for the student to write a 40–60 word summary, with 2–3 sentence starters (one per line); 4) "✅ Model summary" — a teacher model summary of 40–60 words. Put key words in "vocab".${context}`,
      schema: '{"cards":[{"title":"🎯 Main idea","text":"…"},{"title":"🔑 Key details","text":"• …\\n• …"},{"title":"✍️ Your summary","text":"Write 40–60 words.\\nStart: \\"The text is about…\\"\\n…"},{"title":"✅ Model summary","text":"…"}],"vocab":["word"]}',
    };
  }
  if (toolId === 'generate-text') {
    return {
      task: `${head} Write an original, engaging reading text on this topic at ${level} level (about ${words} words, 2–4 natural paragraphs). Use vocabulary and grammar appropriate to ${level}.${genreText} Return cards in this order: 1) "📖 Reading text" — a short title on the first line, then the text; 2) "🔑 Glossary" — 6–8 key words from the text, one per line as "word — short ${level} definition"; 3) "Before reading" — 2–3 prediction/lead-in questions; 4) "After reading" — 3–4 comprehension + discussion questions. Put the glossary words in "vocab".${context}`,
      schema: '{"cards":[{"title":"📖 Reading text","text":"Title\\nParagraph text…"},{"title":"🔑 Glossary","text":"word — definition\\n…"},{"title":"Before reading","text":"1. …\\n2. …"},{"title":"After reading","text":"1. …\\n2. …"}],"vocab":["word"]}',
    };
  }
  if (toolId === 'sentences-vocab') {
    return {
      task: `${head} For EACH target word/phrase write ONE natural example sentence at ${level} level that makes the meaning clear. Return exactly one card per target word — do NOT invent extra words: "title" = the word, "text" = the example sentence with the target word in **bold**. Put all target words in "vocab".${context}`,
      schema: '{"cards":[{"title":"target word","text":"Example sentence with **word**."}],"vocab":["word"]}',
    };
  }
  if (toolId === 'comm-situations') {
    return {
      task: `${head} Create ${count} short communicative situations that show the target vocabulary in use. Return one card per situation: "title" = the real-life situation, "text" = a natural 2-line mini-dialogue formatted "A: ...\\nB: ..." that uses a target word at ${level} level. Put the target words in "vocab".${context}`,
      schema: '{"cards":[{"title":"situation","text":"A: ...\\nB: ..."}],"vocab":["word"]}',
    };
  }
  if (toolId === 'rephrase-word') {
    return {
      task: `${head} Create ${count} rephrasing tasks: give a sentence and ONE key word the student must use to rewrite it keeping the same meaning. Return one card per task: "title" = "Use: KEYWORD", "text" = the original sentence. End with ONE extra card titled "Answer key" listing the model rewrites, numbered. Keep everything at ${level} level.${context}`,
      schema: '{"cards":[{"title":"Use: KEYWORD","text":"Original sentence."},{"title":"Answer key","text":"1. ... 2. ..."}],"vocab":["KEYWORD"]}',
    };
  }
  if (toolId === 'grammar-rules') {
    return {
      task: `${head} Explain the target grammar point clearly for a ${level} learner as 4 cards in this order: "Rule" (concise explanation + form), "Examples" (3-5 model sentences), "Common mistakes" (typical errors + the fix), "Practice" (3-5 short practice prompts with answers). Put key terms in "vocab".${context}`,
      schema: '{"cards":[{"title":"Rule","text":"..."},{"title":"Examples","text":"..."},{"title":"Common mistakes","text":"..."},{"title":"Practice","text":"..."}],"vocab":["term"]}',
    };
  }
  // ── Listening ────────────────────────────────────────────────────────────────
  if (toolId === 'transcript-helper') {
    return {
      task: `${head} From the transcript / notes create exactly 4 classroom cards in this order: 1) "Pre-listening vocab" — 5–6 key words with short student-friendly definitions; 2) "While-listening task" — one clear focus task to do while listening; 3) "Post-listening questions" — 4–5 comprehension questions; 4) "Speaking follow-up" — 2–3 open discussion prompts. Include a "vocab" list of the key words.${context}`,
      schema: '{"cards":[{"title":"Pre-listening vocab","text":"word — definition\\n..."},{"title":"While-listening task","text":"..."},{"title":"Post-listening questions","text":"1. ...\\n2. ..."},{"title":"Speaking follow-up","text":"1. ...\\n2. ..."}],"vocab":["word"]}',
    };
  }

  // ── Speaking ─────────────────────────────────────────────────────────────────
  if (toolId === 'dialogue') {
    return {
      task: `${head} Write a natural 8–12 line conversation between Speaker A and Speaker B at ${level} level. Use target vocabulary (mark key phrases in **bold**). Return 3 cards: 1) "Dialogue" — full conversation formatted "A: ...\\nB: ..."; 2) "Useful language" — 5–6 key phrases with brief explanations (one per line: phrase — meaning); 3) "Extension task" — a speaking or writing follow-up activity. Include "vocab" list.${context}`,
      schema: '{"cards":[{"title":"Dialogue","text":"A: ...\\nB: ..."},{"title":"Useful language","text":"phrase — meaning\\n..."},{"title":"Extension task","text":"..."}],"vocab":["phrase"]}',
    };
  }
  if (toolId === 'lead-in') {
    return {
      task: `${head} Design 3–4 warm-up activities (5–7 min total) to introduce the topic. One card per activity, variety required: brainstorm / picture description / quick poll / personal connection / prediction. Each card "title" = activity type + number, "text" = clear teacher instruction + expected student output. Include "vocab" of useful preview words.${context}`,
      schema: '{"cards":[{"title":"Activity 1: Brainstorm","text":"..."},{"title":"Activity 2: Quick poll","text":"..."},{"title":"Activity 3: Prediction","text":"..."}],"vocab":["word"]}',
    };
  }
  if (toolId === 'interesting-facts') {
    return {
      task: `${head} Generate 5–6 surprising, engaging facts about the topic suitable for ${level} learners. Each card: "title" = "Fact N: [short hook]", "text" = the fact in 2–3 sentences followed by "💬 Discussion: [open question]". Make facts real or plausible. Include "vocab" of interesting topic words.${context}`,
      schema: '{"cards":[{"title":"Fact 1: ...","text":"Interesting fact text.\\n💬 Discussion: open question?"}],"vocab":["word"]}',
    };
  }
  if (toolId === 'pros-cons') {
    return {
      task: `${head} Produce 3 cards for debate/writing: 1) "Pros" — 5 arguments in favour, each on its own line starting "N. ..."; 2) "Cons" — 5 arguments against, same format; 3) "Discussion starter" — 2–3 nuanced questions to open debate. Language at ${level} level. Include "vocab" of useful discourse markers and opinion phrases.${context}`,
      schema: '{"cards":[{"title":"Pros","text":"1. ...\\n2. ...\\n3. ..."},{"title":"Cons","text":"1. ...\\n2. ...\\n3. ..."},{"title":"Discussion starter","text":"1. ...\\n2. ..."}],"vocab":["discourse marker"]}',
    };
  }

  // ── Writing ──────────────────────────────────────────────────────────────────
  if (toolId === 'link-words') {
    return {
      task: `${head} Choose 5–7 target words/phrases from the topic. Return 3 cards: 1) "Task" — instruction to write sentences or a short paragraph using ALL the words; 2) "Word list" — each word with a one-line usage note; 3) "Model answer" — a short model paragraph using all words (target words in **bold**) plus 2–3 writing tips. Include "vocab" list.${context}`,
      schema: '{"cards":[{"title":"Task","text":"..."},{"title":"Word list","text":"word — usage note\\n..."},{"title":"Model answer","text":"Model paragraph.\\n\\nTips:\\n1. ..."}],"vocab":["word"]}',
    };
  }
  if (toolId === 'creative-writing') {
    return {
      task: `${head} Create a creative writing task at ${level} level. Return 4 cards: 1) "Writing prompt" — an engaging scenario or question; 2) "Requirements" — 3 clear requirements (text type, length, vocabulary to include); 3) "Useful phrases" — 5–6 phrases with brief usage notes; 4) "Model opener" — first 2–3 sentences as a model. Include "vocab" list.${context}`,
      schema: '{"cards":[{"title":"Writing prompt","text":"..."},{"title":"Requirements","text":"1. ...\\n2. ...\\n3. ..."},{"title":"Useful phrases","text":"phrase — use\\n..."},{"title":"Model opener","text":"..."}],"vocab":["phrase"]}',
    };
  }
  if (toolId === 'four-opinions') {
    return {
      task: `${head} Write 4 contrasting opinions on the topic for debate or response writing at ${level} level. Return one card per opinion: 1) "Strongly agree" — confident, direct; 2) "Partially agree" — nuanced, with a concession; 3) "Disagree" — clear counterargument; 4) "Provocative" — surprising or extreme view to spark debate. Include "vocab" of opinion/hedging phrases.${context}`,
      schema: '{"cards":[{"title":"Strongly agree","text":"..."},{"title":"Partially agree","text":"..."},{"title":"Disagree","text":"..."},{"title":"Provocative","text":"..."}],"vocab":["opinion phrase"]}',
    };
  }
  if (toolId === 'find-quotes') {
    return {
      task: `${head} Select or compose 5–6 quotes on the topic (real or plausible, varied viewpoints). Each card: "title" = "Author Name", "text" = the quote in quotation marks + a blank line + "💬 " + an open discussion question. Include "vocab" of key concepts from the quotes.${context}`,
      schema: '{"cards":[{"title":"Author Name","text":"\\"Quote text.\\"\\n\\n💬 Discussion question?"}],"vocab":["concept"]}',
    };
  }
  if (toolId === 'essay-topics') {
    return {
      task: `${head} Generate 5–6 essay prompts for ${level} learners covering different essay types. Each card: "title" = essay type (Argumentative / Discursive / Opinion / Problem-solution / Compare & contrast), "text" = the full prompt + "\\n\\n📋 Structure: " + 3-point outline + "\\n📝 Key vocabulary: " + 4–5 useful terms. Include "vocab" list.${context}`,
      schema: '{"cards":[{"title":"Argumentative","text":"Essay prompt.\\n\\n📋 Structure: Introduction → Main arguments (2–3) → Conclusion\\n📝 Key vocabulary: term1, term2, term3"}],"vocab":["term"]}',
    };
  }

  // ── Writing ──────────────────────────────────────────────────────────────────
  if (toolId === 'essay-outline') {
    return {
      task: `${head} Build a complete essay outline at ${level} level. Return cards: 1) "Essay question" — a clear prompt; 2) "Thesis statement" — a model thesis; 3) "Introduction" — hook + background + thesis plan; 4) "Body paragraph 1/2/3" — one card each with topic sentence + supporting points + example; 5) "Conclusion" — restate + final thought. Include "vocab" of useful linking/academic phrases.${context}`,
      schema: '{"cards":[{"title":"Essay question","text":"..."},{"title":"Thesis statement","text":"..."},{"title":"Introduction","text":"..."},{"title":"Body paragraph 1","text":"Topic sentence: ...\\nSupport: ...\\nExample: ..."},{"title":"Conclusion","text":"..."}],"vocab":["linking phrase"]}',
    };
  }
  if (toolId === 'email-reply') {
    return {
      task: `${head} Create an email-writing task at ${level} level. Return cards: 1) "The email" — a short prompt email the student must reply to; 2) "Your task" — what to include in the reply + register (formal/informal); 3) "Useful phrases" — opening, body and closing phrases for this register; 4) "Model reply" — a complete sample answer. Include "vocab" of functional phrases.${context}`,
      schema: '{"cards":[{"title":"The email","text":"..."},{"title":"Your task","text":"..."},{"title":"Useful phrases","text":"Opening: ...\\nBody: ...\\nClosing: ..."},{"title":"Model reply","text":"..."}],"vocab":["phrase"]}',
    };
  }

  // ── Speaking ─────────────────────────────────────────────────────────────────
  if (toolId === 'roleplay-cards') {
    return {
      task: `${head} Create a role-play at ${level} level. Return cards: 1) "Situation" — the scenario + goal; 2) "Role A" — who they are, their aim and 2–3 things to say; 3) "Role B" — the contrasting role, aim and 2–3 things to say; 4) "Useful language" — functional phrases for this interaction; 5) "Extension" — a follow-up speaking task. Include "vocab".${context}`,
      schema: '{"cards":[{"title":"Situation","text":"..."},{"title":"Role A","text":"..."},{"title":"Role B","text":"..."},{"title":"Useful language","text":"..."},{"title":"Extension","text":"..."}],"vocab":["phrase"]}',
    };
  }
  if (toolId === 'debate-cards') {
    return {
      task: `${head} Create debate material at ${level} level. Return cards: 1) "Motion" — a clear debate statement; 2) "For — arguments" — 4–5 supporting points with brief evidence; 3) "Against — arguments" — 4–5 opposing points; 4) "Rebuttals" — how each side answers the other; 5) "Useful language" — phrases for arguing, conceding and rebutting. Include "vocab".${context}`,
      schema: '{"cards":[{"title":"Motion","text":"..."},{"title":"For — arguments","text":"1. ...\\n2. ..."},{"title":"Against — arguments","text":"1. ...\\n2. ..."},{"title":"Rebuttals","text":"..."},{"title":"Useful language","text":"..."}],"vocab":["phrase"]}',
    };
  }

  // ── Utility / lesson builders ────────────────────────────────────────────────
  if (toolId === 'lesson-pack') {
    return {
      task: `${head} Build a complete, ready-to-teach lesson at ${level} level. Return cards in order: "Lesson aims", "Warm-up (5 min)", "Lead-in", "Pre-teach vocabulary", "Input / presentation", "Controlled practice", "Freer practice / production", "Homework", "Teacher notes". Each card = clear classroom instructions, timing and examples. Include "vocab" of target words.${context}`,
      schema: '{"cards":[{"title":"Lesson aims","text":"..."},{"title":"Warm-up (5 min)","text":"..."},{"title":"Controlled practice","text":"..."},{"title":"Homework","text":"..."}],"vocab":["word"]}',
    };
  }
  if (toolId === 'worksheet-builder') {
    return {
      task: `${head} Build an interactive ESL worksheet at ${level} level on the topic: "${topic}". Return exactly 3 parts in this order: (1) type "multiple_choice" — 6 items, each with a stem sentence containing a blank "___" and 4 options A–D, answer = index 0–3; (2) type "fill_blank" — 6 items with stem sentences containing "___", a word_bank array of 8 words, answer = correct word; (3) type "matching" — 6 items, each item has a sentence stem and 3 options, answer = index of correct ending. Keep language natural and ${level}-appropriate. All answers must be clearly correct.${context}`,
      schema: '{"parts":[{"type":"multiple_choice","title":"Part 1: Multiple Choice","instruction":"Select the best option to complete each sentence.","items":[{"id":1,"stem":"New offices and shops are ___ all over the city center.","options":["springing up","going down","falling out","breaking in"],"answer":0}]},{"type":"fill_blank","title":"Part 2: Sentence Completion","instruction":"Use the correct word from the word bank to complete each sentence.","word_bank":["neglected","sprawling","congested","vibrant","demolished","renovated","affordable","thriving"],"items":[{"id":7,"stem":"The old factory was ___ to make way for a new park.","answer":"demolished"}]},{"type":"matching","title":"Part 3: Matching Contexts","instruction":"Choose the most logical sentence ending.","items":[{"id":13,"stem":"The city centre has become so congested that","options":["many people now avoid driving there","the parks are full of children","new cafes open every week"],"answer":0}]}]}',
    };
  }
  if (toolId === 'homework-set') {
    return {
      task: `${head} Create a homework assignment at ${level} level. Return cards: "Brief" — what to do and why; "Tasks" — 3–4 numbered tasks of increasing challenge; "Success criteria" — what a good answer includes; "Self-check" — a short checklist. Include "vocab".${context}`,
      schema: '{"cards":[{"title":"Brief","text":"..."},{"title":"Tasks","text":"1. ...\\n2. ..."},{"title":"Success criteria","text":"..."},{"title":"Self-check","text":"✅ ...\\n✅ ..."}],"vocab":["word"]}',
    };
  }
  if (toolId === 'rubric-maker') {
    return {
      task: `${head} Create an assessment rubric for this task at ${level} level. Return one card per criterion (e.g. Task achievement, Coherence, Vocabulary, Grammar, Pronunciation/Spelling). Each card "text" describes what Excellent / Good / Needs work looks like for that criterion. End with a "How to use" card.${context}`,
      schema: '{"cards":[{"title":"Task achievement","text":"Excellent: ...\\nGood: ...\\nNeeds work: ..."},{"title":"How to use","text":"..."}],"vocab":["criterion"]}',
    };
  }
  if (toolId === 'answer-key') {
    return {
      task: `${head} Produce a teacher answer key for the exercise in the source text. Return cards: "Answers" — numbered correct answers; "Distractor notes" — why common wrong options are wrong; "Common errors" — mistakes to watch for and how to fix them.${context}`,
      schema: '{"cards":[{"title":"Answers","text":"1. ...\\n2. ..."},{"title":"Distractor notes","text":"..."},{"title":"Common errors","text":"..."}],"vocab":["word"]}',
    };
  }
  if (toolId === 'cefr-checker') {
    return {
      task: `${head} Analyse the source text's difficulty. Return cards: "Estimated level" — the CEFR level + a one-line justification; "Why" — features driving the level (sentence length, tenses, vocabulary); "To simplify" — concrete moves to lower it one level; "To upgrade" — moves to raise it one level. Include "vocab" of the hardest words found.${context}`,
      schema: '{"cards":[{"title":"Estimated level","text":"B1 — ..."},{"title":"Why","text":"..."},{"title":"To simplify","text":"..."},{"title":"To upgrade","text":"..."}],"vocab":["hard word"]}',
    };
  }
  if (toolId === 'add-text' || toolId === 'add-images' || toolId === 'add-video') {
    const media = toolId === 'add-images' ? 'image' : toolId === 'add-video' ? 'video' : 'text';
    return {
      task: `${head} Build a ${media}-based activity at ${level} level. Return cards: "Before" — prediction / lead-in questions; "While" — a focus task to do during reading/viewing; "After" — comprehension + discussion questions; "Speaking follow-up" — a personal-response task. Include "vocab".${context}`,
      schema: '{"cards":[{"title":"Before","text":"..."},{"title":"While","text":"..."},{"title":"After","text":"..."},{"title":"Speaking follow-up","text":"..."}],"vocab":["word"]}',
    };
  }

  // ── Default cards fallback ────────────────────────────────────────────────────
  return {
    task: `${head} Produce a complete, ready-to-teach set of ${Math.max(4, count)} cards. Each card has a clear stage/section "title" and rich classroom "text" (instructions, examples, teacher moves) at ${level} level. End with a "Teacher flow" card. Include a "vocab" list of useful target words.${context}`,
    schema: '{"cards":[{"title":"...","text":"..."}],"vocab":["word"]}',
  };
}

function isOpenRouter(provider) {
  return provider.baseUrl.includes('openrouter');
}

function retryDelayMs(attempt, retryAfter) {
  const parsed = Number(retryAfter);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(8000, parsed * 1000);
  }
  const date = retryAfter ? Date.parse(retryAfter) : NaN;
  if (Number.isFinite(date)) {
    return Math.min(8000, Math.max(0, date - Date.now()));
  }
  return Math.min(8000, 450 * Math.pow(2, attempt) + Math.floor(Math.random() * 350));
}

function parseProviderError(status, body) {
  const e = new Error(`LLM ${status}: ${String(body || '').slice(0, 240)}`);
  e.status = status;
  e.retryable = status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
  return e;
}

function buildRequestBody(provider, user) {
  const openrouter = isOpenRouter(provider);
  const body = {
    model: provider.model,
    temperature: 0.55,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: user },
    ],
  };

  if (openrouter) {
    body.max_completion_tokens = body.max_tokens;
    delete body.max_tokens;
    const models = uniq([provider.model, ...OPENROUTER_FALLBACK_MODELS]).slice(0, 3);
    if (models.length > 1) {
      body.models = models;
      delete body.model;
      body.provider = {
        allow_fallbacks: true,
        sort: { by: process.env.AI_OPENROUTER_SORT || 'throughput', partition: 'none' },
      };
    } else {
      body.provider = { allow_fallbacks: true };
    }
    if (process.env.AI_OPENROUTER_RESPONSE_HEALING !== '0') {
      body.plugins = [{ id: 'response-healing' }];
    }
    body.metadata = {
      app: 'teached',
      purpose: 'teacher-tool-generation',
    };
  }

  return body;
}

// Call one provider's chat-completions endpoint and parse its JSON reply.
async function callProvider(provider, user) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.key}`,
  };
  // OpenRouter asks for these attribution headers; harmless elsewhere.
  if (isOpenRouter(provider)) {
    headers['HTTP-Referer'] = process.env.SITE_URL || 'https://teached.tech';
    headers['X-OpenRouter-Title'] = 'TeachEd';
    headers['X-OpenRouter-Metadata'] = 'enabled';
  }
  let resp;
  try {
    resp = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildRequestBody(provider, user)),
      signal: ctrl.signal,
    });
  } catch (err) {
    // Network error or aborted by our timeout — treat as retryable, but flag
    // timeouts so the caller skips the same-provider retry (see generate()):
    // a hung connection is very likely to hang again, so retrying it in place
    // just burns the client's whole wait budget before ever reaching a
    // healthy fallback provider. Fast HTTP errors (429/5xx) still get their
    // normal same-provider retry below.
    const e = new Error(ctrl.signal.aborted ? `timeout after ${TIMEOUT_MS}ms` : err.message);
    e.retryable = true;
    e.isTimeout = ctrl.signal.aborted;
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const e = parseProviderError(resp.status, detail);
    e.retryAfter = resp.headers.get('retry-after') || '';
    throw e;
  }
  const data = await resp.json();
  const choice = data?.choices?.[0];
  if (choice?.error) {
    const e = new Error(choice.error.message || 'model returned a choice error');
    e.status = choice.error.code;
    e.retryable = !e.status || e.status === 408 || e.status === 429 || e.status >= 500;
    e.metadata = choice.error.metadata;
    throw e;
  }
  if (choice?.finish_reason === 'error') {
    const e = new Error(`model finish_reason=error (${choice.native_finish_reason || 'unknown'})`);
    e.retryable = true;
    throw e;
  }
  const text = choice?.message?.content || '';
  return {
    payload: extractJson(text),
    model: data?.model || provider.model,
    generationId: data?.id || null,
    usage: data?.usage || null,
    metadata: data?.openrouter_metadata || null,
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generate(input) {
  if (!CHAIN.length) throw new Error('No AI provider configured');
  const { task, schema } = shapeSpec(input);
  const user = `${task}\n\nReturn ONLY a JSON object matching this exact shape:\n${schema}`;

  // Caller picked a specific free model (games/create.html switcher) — try it
  // first via OpenRouter, then fall through to the normal chain on failure.
  let chain = orderedChain(input);
  if (input.model && FREE_MODELS.includes(input.model) && OPENROUTER_PROVIDER) {
    chain = [{ ...OPENROUTER_PROVIDER, name: 'chosen', model: input.model }, ...chain];
  }

  const trace = { at: new Date().toISOString(), kind: 'teacher-tool', attempts: [] };
  let lastErr;
  for (const provider of chain) {
    // Retry transient provider/network failures with jittered exponential
    // back-off, then fall through to the next provider in the local chain.
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const attemptInfo = { provider: provider.name, model: provider.model, attempt: attempt + 1, ok: false };
      const started = Date.now();
      try {
        const result = await callProvider(provider, user);
        lastUsedModel = result.model || provider.model;
        attemptInfo.ok = true;
        attemptInfo.model = lastUsedModel;
        attemptInfo.generationId = result.generationId;
        attemptInfo.ms = Date.now() - started;
        trace.attempts.push(attemptInfo);
        trace.usedModel = lastUsedModel;
        trace.usage = result.usage || null;
        lastTrace = trace;
        return result.payload;
      } catch (err) {
        lastErr = err;
        attemptInfo.ok = false;
        attemptInfo.status = err.status || null;
        attemptInfo.retryable = !!err.retryable;
        attemptInfo.error = err.message;
        attemptInfo.ms = Date.now() - started;
        trace.attempts.push(attemptInfo);
        console.warn(`[ai/${provider.name}] ${provider.model} attempt ${attempt + 1} failed: ${err.message}`);
        // A hung/timed-out connection is likely to hang again — don't burn a
        // second full TIMEOUT_MS retrying it in place; move to the next
        // provider immediately instead. Fast HTTP errors (429/5xx) still get
        // their normal same-provider retry with back-off.
        if (err.retryable && !err.isTimeout && attempt < MAX_ATTEMPTS - 1) {
          await sleep(retryDelayMs(attempt, err.retryAfter));
          continue;
        }
        break; // non-retryable, timed out, or retry already used → next provider
      }
    }
  }
  trace.failed = true;
  trace.error = lastErr?.message || 'All AI providers failed';
  lastTrace = trace;
  throw lastErr || new Error('All AI providers failed');
}

// Call the provider chain with a fully-formed user prompt (no shapeSpec wrapping).
async function rawGenerate(userPrompt) {
  if (!CHAIN.length) throw new Error('No AI provider configured');
  const trace = { at: new Date().toISOString(), kind: 'raw', attempts: [] };
  let lastErr;
  for (const provider of CHAIN) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const attemptInfo = { provider: provider.name, model: provider.model, attempt: attempt + 1, ok: false };
      const started = Date.now();
      try {
        const result = await callProvider(provider, userPrompt);
        lastUsedModel = result.model || provider.model;
        attemptInfo.ok = true;
        attemptInfo.model = lastUsedModel;
        attemptInfo.generationId = result.generationId;
        attemptInfo.ms = Date.now() - started;
        trace.attempts.push(attemptInfo);
        trace.usedModel = lastUsedModel;
        trace.usage = result.usage || null;
        lastTrace = trace;
        return result.payload;
      } catch (err) {
        lastErr = err;
        attemptInfo.status = err.status || null;
        attemptInfo.retryable = !!err.retryable;
        attemptInfo.error = err.message;
        attemptInfo.ms = Date.now() - started;
        trace.attempts.push(attemptInfo);
        console.warn(`[ai/raw/${provider.name}] attempt ${attempt + 1} failed: ${err.message}`);
        if (err.retryable && !err.isTimeout && attempt < MAX_ATTEMPTS - 1) {
          await sleep(retryDelayMs(attempt, err.retryAfter));
          continue;
        }
        break;
      }
    }
  }
  trace.failed = true;
  trace.error = lastErr?.message || 'All AI providers failed';
  lastTrace = trace;
  throw lastErr || new Error('All AI providers failed');
}

module.exports = { enabled, generate, rawGenerate, MODEL, BASE_URL, getLastModel, getLastTrace, listModels, FREE_MODELS };
