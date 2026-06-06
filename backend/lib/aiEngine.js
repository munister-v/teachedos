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

const API_KEY = process.env.AI_API_KEY || '';
const BASE_URL = (process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
const MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 25000);

function enabled() {
  return Boolean(API_KEY);
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
    return {
      task: `${head} Produce exactly ${count} vocabulary items. Each item: the word/phrase, a short student-friendly definition (max 15 words), and a natural example sentence at ${level} level.${context}`,
      schema: '{"items":[{"word":"...","definition":"...","example":"..."}]}',
    };
  }

  if (boardKind === 'matching') {
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
  return {
    task: `${head} Produce a complete, ready-to-teach set of ${Math.max(4, count)} cards. Each card has a clear stage/section "title" and rich classroom "text" (instructions, examples, teacher moves) at ${level} level. End with a "Teacher flow" card. Include a "vocab" list of useful target words.${context}`,
    schema: '{"cards":[{"title":"...","text":"..."}],"vocab":["word"]}',
  };
}

async function generate(input) {
  if (!API_KEY) throw new Error('AI_API_KEY not set');
  const { task, schema } = shapeSpec(input);
  const user = `${task}\n\nReturn ONLY a JSON object matching this exact shape:\n${schema}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
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

module.exports = { enabled, generate, MODEL, BASE_URL };
