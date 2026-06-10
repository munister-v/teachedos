// ── AI Community-Post generator ─────────────────────────────────────────────
// Generates an original, ready-to-share lesson-board "post" for the Community
// feed. Two modes:
//   • topic  — from a topic + level (+ the feed's curated exemplars as style)
//   • source — rework a pasted text or a fetched URL into an ORIGINAL lesson
// Self-contained on purpose: it builds its own provider chain from the same env
// the main AI engine uses, but PREFERS the free OpenRouter model first so this
// feature stays zero-cost and never eats the Groq quota. (Kept out of ai.js /
// aiEngine.js to avoid colliding with parallel work in those files.)
const router    = require('express').Router();
const rateLimit = require('express-rate-limit');
const dns       = require('dns').promises;
const net       = require('net');
const { requireAuth, requireTeacher } = require('../middleware/auth');

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 20000);

// ── Provider chain — free OpenRouter model first, Groq/primary as fallback ───
function buildChain() {
  const chain = [];
  const orKey = process.env.AI_API_KEY_2 || process.env.OPENROUTER_API_KEY;
  if (orKey) {
    chain.push({
      name: 'openrouter-free',
      key: orKey,
      baseUrl: (process.env.AI_BASE_URL_2 || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
      model: process.env.AI_MODEL_2 || 'meta-llama/llama-3.3-70b-instruct:free',
    });
  }
  if (process.env.AI_API_KEY) {
    chain.push({
      name: 'primary',
      key: process.env.AI_API_KEY,
      baseUrl: (process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
      model: process.env.AI_MODEL || 'llama-3.3-70b-versatile',
    });
  }
  return chain;
}
const CHAIN = buildChain();
let lastUsedModel = null;

// Tolerant JSON extraction (handles ```json fences / stray prose).
function extractJson(text) {
  const s = String(text || '');
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : s;
  const start = body.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}') { depth--; if (depth === 0) { try { return JSON.parse(body.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

async function callLLM(system, user) {
  let lastErr;
  for (const provider of CHAIN) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` };
    if (provider.baseUrl.includes('openrouter')) {
      headers['HTTP-Referer'] = process.env.SITE_URL || 'https://teached.tech';
      headers['X-Title'] = 'TeachEd';
    }
    try {
      const resp = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST', headers, signal: ctrl.signal,
        body: JSON.stringify({
          model: provider.model, temperature: 0.7, max_tokens: 2600,
          response_format: { type: 'json_object' },
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      });
      if (!resp.ok) { lastErr = new Error(`LLM ${resp.status}`); continue; }
      const data = await resp.json();
      const parsed = extractJson(data?.choices?.[0]?.message?.content || '');
      if (parsed) { lastUsedModel = provider.model; return parsed; }
      lastErr = new Error('unparseable LLM reply');
    } catch (err) {
      lastErr = new Error(ctrl.signal.aborted ? 'timeout' : err.message);
    } finally { clearTimeout(timer); }
  }
  throw lastErr || new Error('No AI provider configured');
}

// ── SSRF-guarded URL → plain text ────────────────────────────────────────────
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) ||
           (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224;
  }
  const low = ip.toLowerCase();
  return low === '::1' || low.startsWith('fc') || low.startsWith('fd') || low.startsWith('fe80') || low === '::';
}
async function fetchUrlText(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) URLs are allowed');
  const { address } = await dns.lookup(u.hostname);
  if (isPrivateIp(address)) throw new Error('Refusing to fetch a private/internal address');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const resp = await fetch(u.href, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (TeachEd content importer)' },
    });
    if (!resp.ok) throw new Error(`Source returned ${resp.status}`);
    const buf = await resp.arrayBuffer();
    const html = Buffer.from(buf.slice(0, 600000)).toString('utf8'); // cap ~600KB
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim()
      .slice(0, 6000);
  } finally { clearTimeout(timer); }
}

// ── Lay out free-form card texts into a valid board snapshot grid ────────────
const PALETTE = ['#fef3c7', '#d1fae5', '#dbeafe', '#fce7f3', '#ede9fe', '#fee2e2', '#e0f2fe'];
const rid = () => 'c' + Math.random().toString(36).slice(2);
function layoutCards(cards) {
  const COLS = 3, W = 280, H = 130, GX = 24, GY = 22, X0 = 60, Y0 = 60;
  return (cards || []).slice(0, 12).map((c, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    return {
      id: rid(), type: 'sticky',
      x: X0 + col * (W + GX), y: Y0 + row * (H + GY), w: W, h: H,
      data: { text: String(c.text || '').slice(0, 600), color: c.color || PALETTE[i % PALETTE.length] },
    };
  });
}

const SYSTEM = 'You are an expert ESL/EFL lesson designer for an app called TeachEd. ' +
  'You output ONLY a JSON object — no prose, no markdown fences. Content is original, ' +
  'classroom-ready, and pitched at the requested CEFR level. Cards are short, punchy sticky ' +
  'notes (a goal, rules, examples, controlled practice, a speaking/writing task, common mistakes).';

const SHAPE = '{"title":"short lesson title","level":"A1|A2|B1|B2|C1","desc":"1-2 sentence summary for the feed",' +
  '"tags":["grammar"],"cards":[{"text":"emoji + short instructional sticky note","color":"#fef3c7"}]}';

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, max: Number(process.env.AI_RATE_PER_MIN || 15),
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'You are generating too fast. Please wait a few seconds and try again.' },
});

// ── POST /api/community-ai/post ──────────────────────────────────────────────
router.post('/post', requireAuth, requireTeacher, aiLimiter, async (req, res) => {
  if (!CHAIN.length) return res.status(503).json({ error: 'AI engine is not configured' });
  const mode  = req.body?.mode === 'source' ? 'source' : 'topic';
  const level = String(req.body?.level || 'B1').slice(0, 8);
  const topic = String(req.body?.topic || '').slice(0, 200);

  let user;
  try {
    if (mode === 'source') {
      let material = String(req.body?.source || '').slice(0, 6000);
      const url = String(req.body?.url || '').trim();
      if (!material && url) material = await fetchUrlText(url);
      if (!material) return res.status(400).json({ error: 'Provide source text or a URL' });
      user = `Read this source material and design an ORIGINAL ${level} lesson-board inspired by its ` +
        `topic and key ideas. Do NOT copy sentences — paraphrase and turn it into teachable cards ` +
        `(goal, key language, practice, a speaking/writing task). 6–9 cards.\n\nSOURCE:\n${material}\n\n` +
        `Return ONLY JSON matching: ${SHAPE}`;
    } else {
      if (!topic) return res.status(400).json({ error: 'Provide a topic' });
      user = `Design an original ${level} lesson-board for the topic "${topic}", in the style of a ` +
        `TeachEd Community post: a clear goal, 1-2 rule/explanation cards, 2-3 controlled-practice ` +
        `cards, and a speaking or writing task. 6–9 short sticky cards.\n\nReturn ONLY JSON matching: ${SHAPE}`;
    }

    const out = await callLLM(SYSTEM, user);
    const cards = layoutCards(Array.isArray(out?.cards) ? out.cards : []);
    if (!cards.length) return res.status(502).json({ error: 'AI returned no usable content — try again' });
    const title = String(out?.title || topic || 'Untitled lesson').slice(0, 120);
    const post = {
      title,
      level: String(out?.level || level).slice(0, 8),
      desc: String(out?.desc || '').slice(0, 400),
      tags: Array.isArray(out?.tags) ? out.tags.slice(0, 4).map(t => String(t).slice(0, 24)) : [],
      snapshot: { name: title, cards, links: [] },
      engine: lastUsedModel,
    };
    res.json({ post });
  } catch (err) {
    console.error('[community-ai]', err.message);
    res.status(502).json({ error: err.message || 'Generation failed — try again' });
  }
});

module.exports = router;
