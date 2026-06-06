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

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 25000);

// Ordered provider chain. The first with a key is primary; on any failure
// (rate limit, timeout, bad output) we try the next, then the caller falls
// back to the local rule engine. Add a key to AI_API_KEY_2 to enable the
// duplicate provider (default: OpenRouter free tier).
const PROVIDERS = [
  {
    name: 'primary',
    key: process.env.AI_API_KEY || '',
    baseUrl: (process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
    model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
  },
  {
    name: 'secondary',
    key: process.env.AI_API_KEY_2 || '',
    baseUrl: (process.env.AI_BASE_URL_2 || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
    model: process.env.AI_MODEL_2 || 'meta-llama/llama-3.3-70b-instruct:free',
  },
].filter(p => p.key);

// Primary descriptors kept for status reporting / the engine label.
const MODEL = PROVIDERS[0]?.model || (process.env.AI_MODEL || 'llama-3.3-70b-versatile');
const BASE_URL = PROVIDERS[0]?.baseUrl || 'https://api.groq.com/openai/v1';

function enabled() {
  return PROVIDERS.length > 0;
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
  'You design clear, level-appropriate classroom content (CEFR A1–C2).',
  'You always return ONLY a single valid JSON object that exactly matches the requested shape —',
  'no markdown, no commentary, no code fences, no trailing text.',
].join(' ');

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
        task: `${head} Produce exactly ${count} True/False statements at ${level} level. Alternate true and false; for false ones make one factual change. Use type "truefalse" and a boolean "answer".${context}`,
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
    if (isOpen) {
      return {
        task: `${head} Produce exactly ${count} open-ended questions at ${level} level that encourage critical thinking and personal response. Use type "open".${context}`,
        schema: '{"questions":[{"type":"open","text":"question?","points":1}]}',
      };
    }
    if (isGist) {
      return {
        task: `${head} Produce exactly ${count} questions: the FIRST is a gist MCQ (type "mcq", 4 options, "answer" = correct option text); the rest are detail questions (type "open").${context}`,
        schema: '{"questions":[{"type":"mcq","text":"gist question","options":["A","B","C","D"],"answer":"A","points":1},{"type":"open","text":"detail question?","points":1}]}',
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
  if (['text-topic-vocab', 'summary-task'].includes(toolId)) {
    return {
      task: `${head} Write the requested reading/summary content at ${level} level as 2–3 cards (e.g. "Generated text", "Before reading", "After reading"). Include a "vocab" list of key words.${context}`,
      schema: '{"cards":[{"title":"...","text":"..."}],"vocab":["word"]}',
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
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`LLM ${resp.status}: ${detail.slice(0, 200)}`);
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return extractJson(text);
}

async function generate(input) {
  if (!PROVIDERS.length) throw new Error('No AI provider configured');
  const { task, schema } = shapeSpec(input);
  const user = `${task}\n\nReturn ONLY a JSON object matching this exact shape:\n${schema}`;

  let lastErr;
  for (const provider of PROVIDERS) {
    try {
      return await callProvider(provider, user);
    } catch (err) {
      lastErr = err;
      console.warn(`[ai/${provider.name}] ${provider.model} failed: ${err.message}`);
    }
  }
  throw lastErr || new Error('All AI providers failed');
}

module.exports = { enabled, generate, MODEL, BASE_URL };
