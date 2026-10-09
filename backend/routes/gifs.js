// GET /api/gifs/search?q=term[&limit=N]   → { source, results:[{id,url,preview,title,dims}] }
// GET /api/gifs/status                    → { source }
//
// Tenor closed its public API ("Tenor API is discontinued", HTTP 403 on every
// v1 call), and the board searched Tenor straight from the browser, so GIF
// search returned nothing at all. The browser now asks us; we ask whoever is
// connected:
//   1. GIPHY, when GIPHY_API_KEY is in .env (free key at developers.giphy.com);
//   2. Openverse otherwise: no key, GIF files only, open licences. Fewer
//      reaction GIFs and looser matches than GIPHY, but it is never empty.
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');

const GIPHY_KEY = process.env.GIPHY_API_KEY || '';
const TIMEOUT = 6000;
const CACHE_MAX = 500;
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map();   // key → { at, value }

router.use(requireAuth);
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.GIF_RATE_PER_MIN || 40),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many GIF searches. Wait a moment.' },
}));

async function getJson(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'User-Agent': 'TeachEd/1.0 (+https://teached.tech)', Accept: 'application/json' },
  });
  if (!r.ok) throw new Error('upstream ' + r.status);
  return r.json();
}

const num = (v, d) => (Number(v) > 0 ? Number(v) : d);

function fromGiphy(d) {
  return (Array.isArray(d && d.data) ? d.data : []).map(g => {
    const im = g.images || {};
    const full = im.downsized || im.fixed_height || im.original || {};
    const small = im.fixed_height_small || im.fixed_width_small || im.preview_gif || full;
    return {
      id: String(g.id || ''),
      url: full.url || '',
      preview: small.url || full.url || '',
      title: String(g.title || '').trim() || 'GIF',
      dims: [num(full.width, 320), num(full.height, 240)],
    };
  }).filter(g => g.id && g.url);
}

function fromOpenverse(d) {
  return (Array.isArray(d && d.results) ? d.results : [])
    .filter(r => r && r.url && /^https:\/\//.test(r.url) && String(r.filetype || '').toLowerCase() === 'gif')
    .map(r => ({
      id: String(r.id || ''),
      url: r.url,
      preview: r.url,
      title: String(r.title || '').trim() || 'GIF',
      dims: [num(r.width, 320), num(r.height, 240)],
    }))
    .filter(g => g.id);
}

async function search(q, limit) {
  if (GIPHY_KEY) {
    const u = `https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?api_key=${encodeURIComponent(GIPHY_KEY)}`
      + `&limit=${limit}&rating=g&lang=en${q ? '&q=' + encodeURIComponent(q) : ''}`;
    return { source: 'giphy', results: fromGiphy(await getJson(u)) };
  }
  const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q || 'celebration')}`
    + `&extension=gif&mature=false&page_size=${Math.min(50, limit * 2)}`;
  return { source: 'openverse', results: fromOpenverse(await getJson(u)).slice(0, limit) };
}

router.get('/status', (req, res) => {
  res.json({ source: GIPHY_KEY ? 'giphy' : 'openverse', keyed: !!GIPHY_KEY });
});

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 16));
  const key = `${GIPHY_KEY ? 'g' : 'o'}|${limit}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return res.json(hit.value);
  try {
    const value = await search(q, limit);
    if (value.results.length) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(key, { at: Date.now(), value });
    }
    res.json(value);
  } catch (err) {
    console.warn('[gifs] search failed:', err.message);
    res.status(502).json({ error: 'GIF search is unavailable right now.', results: [] });
  }
});

module.exports = router;
module.exports._test = { fromGiphy, fromOpenverse };
