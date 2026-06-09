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
//
// Without AI_API_KEY, or on any error, the caller falls back to the local rule
// engine — nothing breaks, generation just degrades to the old templates.

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 12000);

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
  model: process.env.AI_MODEL_2 || 'meta-llama/llama-3.3-70b-instruct:free',
});
const CHAIN = PROVIDERS.filter(p => p.key);

// Primary descriptors kept for status reporting / the engine label.
const MODEL = CHAIN[0]?.model || PRIMARY_MODEL;
const BASE_URL = CHAIN[0]?.baseUrl || PRIMARY_URL;

// The model that actually produced the last successful generation.
let lastUsedModel = null;
function getLastModel() { return lastUsedModel; }
function listModels() { return CHAIN.map(p => p.model); }

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

// ── Reading passage support ─────────────────────────────────────────────
// The six reading-comprehension tools must always ship a visible text so the
// questions have something to refer to. When the teacher pastes a source we
// echo it; otherwise the model writes an original passage at the right level.
const READING_PASSAGE_TOOLS = new Set(['abcd-text', 'true-false', 'gist-detail', 'three-titles', 'open-questions', 'choose-summary']);

function passageWordTarget(level) {
  return ({ A1: '70-90', A2: '90-120', B1: '130-170', B2: '180-230', C1: '230-290', C2: '260-330' })[level] || '140-180';
}

function passageDirective(input) {
  const hasSource = input.source && String(input.source).trim().length > 40;
  if (hasSource) {
    return 'READING PASSAGE: A source text is provided above. Use it AS the reading passage: set passage.text to that source text (lightly cleaned, do NOT rewrite or shorten it), passage.title to a short fitting title, and passage.vocab to 5-7 of its hardest words, each with a short student-friendly gloss. Base EVERY question strictly and only on this passage.';
  }
  const words = passageWordTarget(input.level);
  return `READING PASSAGE: No source text was given, so FIRST write an original, engaging, factually-plausible reading passage about the topic at ${input.level} level (${words} words, 2-3 natural paragraphs) as passage.text; give it a short passage.title; and list 5-7 key words in passage.vocab, each with a short gloss. THEN base EVERY question strictly and only on the passage you wrote.`;
}

const PASSAGE_SCHEMA = '"passage":{"title":"Short title","text":"the full reading passage (2-3 paragraphs)","vocab":[{"word":"key word","gloss":"short meaning"}]},';

// Augment a quiz spec so the model also returns a reading passage.
function addPassageToSpec(spec, input) {
  return {
    task: passageDirective(input) + '\n\n' + spec.task,
    schema: spec.schema.replace('{', '{' + PASSAGE_SCHEMA),
  };
}

// Listening comprehension tools attach a TRANSCRIPT (the spoken text students
// hear). Same passage envelope as reading; only the wording differs.
const LISTENING_PASSAGE_TOOLS = new Set(['audio-video-questions', 'summary-gapfill', 'listening-dictation']);

function transcriptDirective(input) {
  const hasSource = input.source && String(input.source).trim().length > 40;
  if (hasSource) {
    return 'AUDIO TRANSCRIPT: A transcript / notes are provided above. Use it AS the transcript: set passage.text to that text (lightly cleaned, do NOT rewrite or shorten it), passage.title to a short fitting title, and passage.vocab to 5-7 of its key words, each with a short student-friendly gloss. Base EVERY question strictly and only on this transcript.';
  }
  const words = passageWordTarget(input.level);
  return `AUDIO TRANSCRIPT: No transcript was given, so FIRST write a short, natural spoken-style transcript about the topic at ${input.level} level (${words} words) - a monologue or a short two-speaker dialogue, exactly as if it were the audio students hear (use speaker labels like "A:" / "B:" for a dialogue). Set passage.text to the transcript, passage.title to a short title, and list 5-7 key words in passage.vocab, each with a short gloss. THEN base EVERY question strictly and only on this transcript.`;
}

function addTranscriptToSpec(spec, input) {
  return {
    task: transcriptDirective(input) + '\n\n' + spec.task,
    schema: spec.schema.replace('{', '{' + PASSAGE_SCHEMA),
  };
}

// Describe the target JSON shape per board kind. The model fills these in;
// the route then wraps them in the shared `base()` envelope.
function shapeSpec(input) {
  const { boardKind, toolId, level, topic, count } = input;
  const ctx = [];
  if (input.source) ctx.push(`Source text / transcript:\n"""${input.source}"""`);
  if (input.vocab) ctx.push(`Target vocabulary: ${input.vocab}`);
  if (input.extra) ctx.push(`Extra teacher note: ${input.extra}`);
  const context = ctx.length ? `\n\n${ctx.join('\n\n')}` : '';
  const head = `Tool: ${toolId}. CEFR level: ${level}. Topic: "${topic}".`;

  if (boardKind === 'vocab') {
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
        task: `${head} Choose ${cats} clear categories related to the topic, then produce exactly ${count} words to sort. For each word, "left" = the word and "right" = the EXACT category label it belongs to. Spread words roughly evenly across the categories.${context}`,
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
        task: `${head} Produce exactly ${count} concrete, picturable words for this topic. "left" = the word; "right" = a relevant emoji followed by a short vivid visual description students could match to an image (e.g. "✈️ a plane taking off from a runway"). Choose words that have clear visual referents.${context}`,
        schema: '{"pairs":[{"left":"word","right":"😀 short visual description"}]}',
      };
    }
    return {
      task: `${head} Produce exactly ${count} matching pairs. "left" = a word/phrase, "right" = a short student-friendly definition or match at ${level} level.${context}`,
      schema: '{"pairs":[{"left":"...","right":"..."}]}',
    };
  }

  if (boardKind === 'quiz') {
    const isTf = toolId === 'true-false';
    const isGap = ['gap', 'gaps-brackets'].includes(toolId);
    const isTwo = toolId === 'two-options';
    const isOpen = ['open-questions', 'discussion', 'question-ladder'].includes(toolId);
    const isMcqGap = toolId === 'gaps-abcd';
    const isAbcd = toolId === 'abcd-text';
    const isGist = toolId === 'gist-detail';
    const isOdd = toolId === 'odd-one-out';
    const isWarmup = toolId === 'warmup-listening';

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
      return addPassageToSpec({
        task: `${head} Produce exactly ${count} True/False statements based ONLY on the passage at ${level} level. Alternate true and false; for the false ones change one factual detail so the statement contradicts the passage. Use type "truefalse" and a boolean "answer".${context}`,
        schema: '{"questions":[{"type":"truefalse","text":"statement","answer":true,"points":1}]}',
      }, input);
    }
    if (toolId === 'listening-dictation') {
      return addTranscriptToSpec({
        task: `${head} Produce exactly ${count} dictation sentences taken (or lightly adapted) from the transcript at ${level} level. Each "text" = the full sentence the student hears and must write; blank ONE key word in it with "_____"; "answer" = that exact word. The full transcript is the answer key. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"a full sentence with one _____ to fill","answer":"word","points":1}]}',
      }, input);
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
      return addTranscriptToSpec({
        task: `${head} Produce EXACTLY ${count} listening-comprehension questions based ONLY on the transcript, in this order: (1) the FIRST is ONE gist / main-idea MCQ; (2) the MAJORITY of the rest are DETAIL MCQs that check specific facts said in the audio - make these the bulk; (3) end with only 1-2 OPEN inference / opinion questions. Every MCQ has 4 full, plausible options (complete phrases, not single words), exactly one correct and three realistic distractors; "answer" must equal the correct option text verbatim. Open questions have no options.${context}`,
        schema: '{"questions":[{"type":"mcq","text":"What is the speaker mainly talking about?","options":["full answer A","full answer B","full answer C","full answer D"],"answer":"full answer A","points":1},{"type":"mcq","text":"detail question about something stated?","options":["...","...","...","..."],"answer":"...","points":1},{"type":"open","text":"inference or opinion question?","points":2}]}',
      }, input);
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
    if (toolId === 'open-questions') {
      return addPassageToSpec({
        task: `${head} Produce exactly ${count} open-ended reading questions based on the passage at ${level} level: mix literal questions (answer stated in the text), inference questions (read between the lines) and personal-response questions. Use type "open".${context}`,
        schema: '{"questions":[{"type":"open","text":"question?","points":2}]}',
      }, input);
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
      return addPassageToSpec({
        task: `${head} Based on the passage, produce exactly 1 MCQ: "text" = "Which title best fits the text?", "options" = 3 possible titles (the correct one + 2 plausible but inaccurate distractors), "answer" = the correct title text exactly. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"Which title best fits the text?","options":["Title A","Title B","Title C"],"answer":"Title A","points":1}]}',
      }, input);
    }
    if (toolId === 'reading-bits') {
      const n = Math.max(4, Math.min(count, 6));
      return {
        task: `${head} Split the source text (or create a short ${level} reading text about the topic) into exactly ${n} logical paragraphs. Return them in SHUFFLED order. Each paragraph = one question: "text" = the paragraph content, "answer" = the correct position number as a string ("1", "2", …), type = "gap-fill". The student rearranges them.${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"paragraph text here","answer":"2","points":1}]}',
      };
    }
    if (toolId === 'summary-gapfill') {
      return addTranscriptToSpec({
        task: `${head} Based on the transcript, write a 5-7 sentence summary at ${level} level. Remove 6-8 key content words and replace each with "_____". Return one "gap-fill" question per gap: "text" = the full sentence containing "_____", "answer" = the removed word exactly. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"sentence with _____","answer":"removed word","points":1}]}',
      }, input);
    }
    if (toolId === 'choose-summary') {
      return addPassageToSpec({
        task: `${head} Based on the passage, produce exactly 1 MCQ where the student picks the most accurate summary. "options" = 3 summaries: one accurate, one too vague, one with an incorrect detail. "answer" = text of the accurate summary exactly. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"Which summary best describes the text?","options":["Accurate summary","Vague but not wrong","Contains incorrect detail"],"answer":"Accurate summary","points":1}]}',
      }, input);
    }
    if (toolId === 'sentence-translation') {
      return {
        task: `${head} Produce exactly ${count} translation tasks. Each: "text" = a Ukrainian sentence (or the language named in the teacher note) containing a highlighted target English word/phrase; "answer" = a natural English translation at ${level} level. Use type "gap-fill".${context}`,
        schema: '{"questions":[{"type":"gap-fill","text":"Ukrainian sentence with [target word]","answer":"Natural English translation","points":1}]}',
      };
    }
    if (isGist) {
      return addPassageToSpec({
        task: `${head} Produce EXACTLY ${count} reading-comprehension questions based ONLY on the passage, in this order: (1) the FIRST is ONE gist / main-idea MCQ; (2) the MAJORITY of the rest are DETAIL MCQs that check specific facts stated in the text — make these the bulk of the set; (3) end with only 1–2 OPEN inference / opinion questions. So most questions are multiple-choice. Every MCQ has 4 plausible options that are FULL, meaningful answers (complete phrases — NOT single words copied from the text), exactly one correct and three realistic distractors; "answer" must equal the correct option text verbatim. Open questions have no options.${context}`,
        schema: '{"questions":[{"type":"mcq","text":"What is the main idea of the text?","options":["full answer phrase A","full answer phrase B","full answer phrase C","full answer phrase D"],"answer":"full answer phrase A","points":1},{"type":"mcq","text":"detail question about a stated fact?","options":["...","...","...","..."],"answer":"...","points":1},{"type":"open","text":"inference or opinion question?","points":2}]}',
      }, input);
    }
    if (isAbcd) {
      return addPassageToSpec({
        task: `${head} Based ONLY on the passage, produce exactly ${count} multiple-choice reading-comprehension questions (4 options each). Mix gist, detail and inference. Each has exactly one correct option and three plausible distractors; "answer" must equal the correct option text verbatim. Use type "mcq".${context}`,
        schema: '{"questions":[{"type":"mcq","text":"question about the text","options":["A","B","C","D"],"answer":"correct option text","points":1}]}',
      }, input);
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
  if (['text-topic-vocab', 'summary-task'].includes(toolId)) {
    return {
      task: `${head} Write the requested reading/summary content at ${level} level as 2–3 cards (e.g. "Generated text", "Before reading", "After reading"). Include a "vocab" list of key words.${context}`,
      schema: '{"cards":[{"title":"...","text":"..."}],"vocab":["word"]}',
    };
  }
  if (toolId === 'generate-text') {
    return {
      task: `${head} Write an original, engaging reading text on this topic at ${level} level (about 150–220 words, natural paragraphs). Return cards: 1) "Reading text" — the full text; 2) "Before reading" — 2–3 prediction/lead-in questions; 3) "After reading" — 3–4 comprehension + discussion questions. Include a "vocab" list of 6–8 key words from the text.${context}`,
      schema: '{"cards":[{"title":"Reading text","text":"..."},{"title":"Before reading","text":"1. ...\\n2. ..."},{"title":"After reading","text":"1. ...\\n2. ..."}],"vocab":["word"]}',
    };
  }
  if (toolId === 'sentences-vocab') {
    return {
      task: `${head} For each target word/phrase write ONE natural example sentence at ${level} level that makes the meaning clear. Return one card per word: "title" = the word, "text" = the example sentence with the target word in **bold**. Produce ${count} cards. Put all target words in "vocab".${context}`,
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
      task: `${head} Build a printable worksheet at ${level} level. Return cards: "Warm-up", then 3–4 graded exercise cards (each with a clear instruction line and the items), an "Answer key" card, and a "Teacher notes" card. Make exercises varied (matching, gap-fill, short answer). Include "vocab".${context}`,
      schema: '{"cards":[{"title":"Warm-up","text":"..."},{"title":"Exercise 1: ...","text":"..."},{"title":"Answer key","text":"..."},{"title":"Teacher notes","text":"..."}],"vocab":["word"]}',
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

// Call one provider's chat-completions endpoint and parse its JSON reply.
async function callProvider(provider, user) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.key}`,
  };
  // OpenRouter asks for these attribution headers; harmless elsewhere.
  if (provider.baseUrl.includes('openrouter')) {
    headers['HTTP-Referer'] = process.env.SITE_URL || 'https://teached.tech';
    headers['X-Title'] = 'TeachEd';
  }
  let resp;
  try {
    resp = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.6,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
      }),
      signal: ctrl.signal,
    });
  } catch (err) {
    // Network error or aborted by our timeout — treat as retryable.
    const e = new Error(ctrl.signal.aborted ? `timeout after ${TIMEOUT_MS}ms` : err.message);
    e.retryable = true;
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const e = new Error(`LLM ${resp.status}: ${detail.slice(0, 200)}`);
    e.status = resp.status;
    // 429 (rate limit) and 5xx (server) are worth a quick retry; 4xx are not.
    e.retryable = resp.status === 429 || resp.status >= 500;
    throw e;
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return extractJson(text);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function generate(input) {
  if (!CHAIN.length) throw new Error('No AI provider configured');
  const { task, schema } = shapeSpec(input);
  const user = `${task}\n\nReturn ONLY a JSON object matching this exact shape:\n${schema}`;

  let lastErr;
  for (const provider of orderedChain(input)) {
    // Up to 2 attempts per provider: one retry on a transient (429/5xx/timeout)
    // error after a short jittered back-off.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const out = await callProvider(provider, user);
        lastUsedModel = provider.model;
        return out;
      } catch (err) {
        lastErr = err;
        console.warn(`[ai/${provider.name}] ${provider.model} attempt ${attempt + 1} failed: ${err.message}`);
        if (err.retryable && attempt === 0) {
          await sleep(500 + Math.floor(Math.random() * 400));
          continue;
        }
        break; // non-retryable, or retry already used → next provider
      }
    }
  }
  throw lastErr || new Error('All AI providers failed');
}

module.exports = { enabled, generate, MODEL, BASE_URL, getLastModel, listModels };
