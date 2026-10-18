// GET  /api/gifs/search?type=gifs|stickers|clips[&q=term][&page=N][&per_page=N][&locale=xx]
//        → { source:'klipy', type, page, has_next, results:[{id,slug,kind,url,preview,previewKind,title,dims}] }
// POST /api/gifs/share   { type, slug[, q] }  → { ok }   (KLIPY share trigger, fire and forget)
// GET  /api/gifs/status                       → { configured, source }
//
// The board's GIF picker (Add a GIF → GIFs / Stickers / Clips) runs on KLIPY (docs.klipy.com).
// Until 18.10.2026 it ran on Wikimedia Commons, which has few reaction GIFs and loose matches;
// Commons is gone from this file on purpose (TZ "GIF picker: Wikimedia Commons → KLIPY").
//
//   * The API key lives only here (KLIPY_API_KEY in backend/.env). The browser asks us, we ask
//     KLIPY; the key is never in a bundle or in a response body.
//   * The content filter is ours, in two layers. KLIPY's own: every request carries
//     contentfilter=high (G only; KLIPY's default is off) and rating=pg - the browser cannot lower
//     it, and KLIPY_CONTENT_FILTER can only make it "low" or "medium", never "off". And
//     lib/gifGuard.js: a search for sexual, abusive or violent material is not sent at all, and any
//     result whose title, slug or tags carry such a word is dropped, trending included.
//   * Ads are off in the Partner Panel, and items KLIPY still marks type:"ad" are cut here, so
//     the board never sees one.
//   * customer_id is the teacher's TeachEd id; locale comes from the interface language, English
//     by default.
//
// Without a key the picker says so (503, code not_configured) - it no longer falls back to anything.
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { isBlockedQuery, isBlockedItem } = require('../lib/gifGuard');

const KLIPY_BASE = (process.env.KLIPY_API_BASE || 'https://api.klipy.com/api/v1').replace(/\/+$/, '');
const TIMEOUT = 8000;
const PER_PAGE = 24;
const CACHE_MAX = 500;
const CACHE_MS = 10 * 60 * 1000;
const TYPES = ['gifs', 'stickers', 'clips'];
const cache = new Map();   // key → { at, value }

// Read on every request, not once at boot: the key is added to .env and the service restarted,
// and tests set it per case.
const keyNow = () => String(process.env.KLIPY_API_KEY || '').trim();
// "off" is not an option: anything but low / medium / high is the strictest level
const filterNow = () => {
  const v = String(process.env.KLIPY_CONTENT_FILTER || '').trim().toLowerCase();
  return ['low', 'medium', 'high'].includes(v) ? v : 'high';
};

router.use(requireAuth);
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.GIF_RATE_PER_MIN || 60),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many GIF searches. Wait a moment.' },
}));

const num = (v, d) => (Number(v) > 0 ? Number(v) : d);
const secure = (u) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : '');

/* ── what KLIPY sends → what the board uses ─────────────────────────────────
   An item carries its files by size (xs / sm / md / hd) and format (gif, webp, mp4, webm, png,
   jpg), under `file` (`files` in some clients); the reader accepts size-then-format and
   format-then-size, so a change of nesting does not empty the picker. */
function node(files, size, fmt) {
  if (!files || typeof files !== 'object') return null;
  const n = (files[size] && files[size][fmt]) || (files[fmt] && files[fmt][size]) || null;
  const url = n && (typeof n === 'string' ? n : n.url);
  return secure(url) ? { url, w: n.width, h: n.height } : null;
}
function pick(files, sizes, fmts) {
  for (const size of sizes) for (const fmt of fmts) { const n = node(files, size, fmt); if (n) return n; }
  for (const fmt of fmts) {            // a flat { gif: { url } } shape
    const f = files && files[fmt];
    const url = f && (typeof f === 'string' ? f : f.url);
    if (secure(url)) return { url, w: f.width, h: f.height };
  }
  return null;
}

const isAd = (it) => !it || typeof it !== 'object' || String(it.type || '').toLowerCase() === 'ad' || it.is_ad === true || it.ad === true;
// a rating above PG never passes, even if the filter upstream missed it
const tooStrong = (it) => /^(pg-?13|r|nc-?17|x|mature|adult|explicit)\b/i.test(String(it.rating || it.content_rating || '').trim());

const PREF = {
  // full: what lands on the board; thumb: the light animated preview in the grid (not the original)
  gifs:     { full: [['md', 'sm', 'hd', 'xs'], ['gif', 'webp']], thumb: [['sm', 'xs', 'md'], ['webp', 'gif']] },
  stickers: { full: [['md', 'sm', 'hd', 'xs'], ['webp', 'png', 'gif']], thumb: [['sm', 'xs', 'md'], ['webp', 'png', 'gif']] },
  clips:    { full: [['md', 'sm', 'xs', 'hd'], ['mp4', 'webm']], thumb: [['sm', 'xs', 'md'], ['webp', 'gif', 'mp4']] },
};

function normalize(type, body) {
  const d = body && typeof body === 'object' ? (body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : body) : {};
  const rows = Array.isArray(d.data) ? d.data : Array.isArray(body && body.data) ? body.data : [];
  const pref = PREF[type] || PREF.gifs;
  const results = rows.filter(it => !isAd(it) && !tooStrong(it) && !isBlockedItem(it)).map(it => {
    const files = it.file || it.files || {};
    const full = pick(files, pref.full[0], pref.full[1]);
    const thumb = pick(files, pref.thumb[0], pref.thumb[1]) || full;
    if (!full || !thumb) return null;
    const slug = String(it.slug || '').trim();
    const id = String(it.id != null && it.id !== '' ? it.id : slug);
    if (!id) return null;
    return {
      id,
      slug: slug || id,
      kind: type === 'stickers' ? 'sticker' : type === 'clips' ? 'clip' : 'gif',
      url: full.url,
      preview: thumb.url,
      previewKind: /\.(mp4|webm)(\?|$)/i.test(thumb.url) ? 'video' : 'img',
      title: String(it.title || it.slug || '').replace(/[-_]+/g, ' ').trim() || (type === 'stickers' ? 'Sticker' : type === 'clips' ? 'Clip' : 'GIF'),
      dims: [num(full.w || thumb.w, 320), num(full.h || thumb.h, 240)],
    };
  }).filter(Boolean);
  return {
    results,
    page: num(d.current_page || d.page, 1),
    has_next: !!(d.has_next != null ? d.has_next : d.hasNext),
  };
}

// "en" → en_US, "uk" → uk_UK (KLIPY's own example), "pt-br" → pt_BR; anything odd → English
function localeOf(v) {
  const m = /^([a-z]{2})(?:[_-]([a-z]{2}))?$/i.exec(String(v || '').trim());
  if (!m) return 'en_US';
  const lang = m[1].toLowerCase();
  const region = (m[2] || (lang === 'en' ? 'us' : lang)).toUpperCase();
  return `${lang}_${region}`;
}

function listUrl({ key, type, q, page, perPage, locale, customerId, filter }) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  p.set('per_page', String(perPage));
  p.set('page', String(page));
  p.set('customer_id', String(customerId));
  p.set('locale', locale);
  // The filter is not the browser's to choose. high = G only, medium = G and PG (KLIPY's default is
  // off); `rating=pg` is a ceiling in the other spelling KLIPY clients use.
  p.set('contentfilter', filter || filterNow());
  p.set('rating', 'pg');
  return `${KLIPY_BASE}/${encodeURIComponent(key)}/${type}/${q ? 'search' : 'trending'}?${p}`;
}

async function getJson(url, fetchImpl = fetch) {
  const r = await fetchImpl(url, {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'User-Agent': 'TeachEd/1.0 (+https://teached.tech)', Accept: 'application/json' },
  });
  if (!r.ok) { const e = new Error('upstream ' + r.status); e.status = r.status; throw e; }
  return r.json();
}

// One page of a tab: search when there is a query, trending when there is not.
async function klipyList(args, fetchImpl) {
  const level = filterNow();
  let body;
  try {
    body = await getJson(listUrl({ ...args, filter: level }), fetchImpl);
  } catch (err) {
    // "high" is the one level not every KLIPY plan accepts: a refusal of the request itself is
    // retried once, this request only, one step down - never to "off" (the guard still applies)
    if (level === 'high' && (err.status === 400 || err.status === 422)) {
      console.warn('[gifs] KLIPY refused contentfilter=high (' + err.status + '); retrying with medium. Set KLIPY_CONTENT_FILTER=medium to stop this.');
      body = await getJson(listUrl({ ...args, filter: 'medium' }), fetchImpl);
    } else throw err;
  }
  return { source: 'klipy', type: args.type, ...normalize(args.type, body) };
}

router.get('/status', (req, res) => {
  res.json({ configured: !!keyNow(), source: 'klipy' });
});

router.get('/search', async (req, res) => {
  const type = req.query.type == null ? 'gifs' : TYPES.includes(String(req.query.type)) ? String(req.query.type) : '';
  if (!type) return res.status(400).json({ error: 'type must be gifs, stickers or clips', results: [] });
  const key = keyNow();
  if (!key) return res.status(503).json({ error: 'GIF search is not set up yet. You can still paste a GIF link below.', code: 'not_configured', results: [] });
  const q = String(req.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const page = Math.min(50, Math.max(1, parseInt(req.query.page, 10) || 1));
  const perPage = Math.min(50, Math.max(8, parseInt(req.query.per_page, 10) || PER_PAGE));
  const locale = localeOf(req.query.locale);
  // a search for something that does not belong in a class goes nowhere; the picker is told why
  if (isBlockedQuery(q)) return res.json({ source: 'klipy', type, page: 1, has_next: false, results: [], filtered: true });
  const ck = `${type}|${page}|${perPage}|${locale}|${q.toLowerCase()}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < CACHE_MS) return res.json(hit.value);
  try {
    const value = await klipyList({ key, type, q, page, perPage, locale, customerId: req.user.id });
    if (value.results.length) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(ck, { at: Date.now(), value });
    }
    res.json(value);
  } catch (err) {
    // the request address carries the key: log the reason, never the address
    console.warn('[gifs] KLIPY failed:', err.message);
    res.status(502).json({ error: 'GIF search is unavailable right now.', results: [] });
  }
});

// KLIPY asks for a share trigger when an item is used; it is bookkeeping, so it never fails the insert.
router.post('/share', async (req, res) => {
  const key = keyNow();
  const type = String(req.body && req.body.type || '');
  const slug = String(req.body && req.body.slug || '');
  if (!key || !TYPES.includes(type) || !/^[A-Za-z0-9_-]{1,160}$/.test(slug)) return res.json({ ok: false });
  try {
    const r = await fetch(`${KLIPY_BASE}/${encodeURIComponent(key)}/${type}/${encodeURIComponent(slug)}/share`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'TeachEd/1.0 (+https://teached.tech)' },
      body: JSON.stringify({ customer_id: String(req.user.id), q: String(req.body.q || '').slice(0, 80) }),
    });
    res.json({ ok: r.ok });
  } catch (err) {
    console.warn('[gifs] share trigger failed:', err.message);
    res.json({ ok: false });
  }
});

module.exports = router;
module.exports._test = { normalize, localeOf, listUrl, klipyList, filterNow, TYPES };
