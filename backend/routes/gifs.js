// GET /api/gifs/search?q=term[&limit=N]   → { source, results:[{id,url,preview,title,dims}] }
// GET /api/gifs/status                    → { source }
//
// Tenor closed its public API ("Tenor API is discontinued", HTTP 403 on every
// v1 call), and the board searched Tenor straight from the browser, so GIF
// search returned nothing at all. The browser now asks us; we ask whoever is
// connected:
//   1. GIPHY, when GIPHY_API_KEY is in .env (free key at developers.giphy.com);
//   2. Wikimedia Commons otherwise: no key, GIF files only, open licences. Fewer
//      reaction GIFs and looser matches than GIPHY.
// Until 15.10.2026 step 2 was Openverse. Its GIFs are the same Commons files,
// but a search it had not cached took 12-19 s, our timeout is 6 s, so nearly
// every search ended in 502 and the panel said "No GIFs found". Commons
// answers the same search in about a second.
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

// Commons search pages → board GIFs. Icons smaller than a sticker and files
// heavier than 6 MB (a whole animated slideshow) are left out.
function fromCommons(d) {
  const pages = d && d.query && d.query.pages;
  return (pages && typeof pages === 'object' ? Object.values(pages) : [])
    .filter(p => p && Array.isArray(p.imageinfo) && p.imageinfo[0])
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map(p => ({ p, ii: p.imageinfo[0] }))
    .filter(({ ii }) => ii.mime === 'image/gif' && /^https:\/\//.test(ii.url || '')
      && num(ii.width, 0) >= 120 && num(ii.height, 0) >= 80 && num(ii.size, 0) <= 6 * 1024 * 1024)
    .map(({ p, ii }) => ({
      id: 'wm' + String(p.pageid || ''),
      url: ii.url,
      preview: /^https:\/\//.test(ii.thumburl || '') ? ii.thumburl : ii.url,
      title: String(p.title || '').replace(/^File:/, '').replace(/\.gif$/i, '').trim() || 'GIF',
      dims: [num(ii.width, 320), num(ii.height, 240)],
    }))
    .filter(g => g.id !== 'wm');
}

function commonsUrl(terms) {
  return 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search'
    + '&gsrnamespace=6&gsrlimit=40&gsrsearch=' + encodeURIComponent('filemime:image/gif ' + terms)
    + '&prop=imageinfo&iiprop=url%7Csize%7Cmime&iiurlwidth=240';
}

async function searchCommons(q, limit) {
  const words = (q || 'animated smile').split(' ').filter(Boolean).slice(0, 6);
  let list = fromCommons(await getJson(commonsUrl(words.join(' '))));
  // every word must match on Commons; with few hits, any of the words will do
  if (list.length < 6 && words.length > 1) {
    const seen = new Set(list.map(g => g.id));
    for (const g of fromCommons(await getJson(commonsUrl(words.join(' OR '))))) if (!seen.has(g.id)) list.push(g);
  }
  return { source: 'commons', results: list.slice(0, limit) };
}

async function search(q, limit) {
  if (GIPHY_KEY) {
    const u = `https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?api_key=${encodeURIComponent(GIPHY_KEY)}`
      + `&limit=${limit}&rating=g&lang=en${q ? '&q=' + encodeURIComponent(q) : ''}`;
    try { return { source: 'giphy', results: fromGiphy(await getJson(u)) }; }
    catch (err) { console.warn('[gifs] GIPHY failed, using Commons:', err.message); }
  }
  return searchCommons(q, limit);
}

router.get('/status', (req, res) => {
  res.json({ source: GIPHY_KEY ? 'giphy' : 'commons', keyed: !!GIPHY_KEY });
});

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 16));
  const key = `${GIPHY_KEY ? 'g' : 'c'}|${limit}|${q.toLowerCase()}`;
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
module.exports._test = { fromGiphy, fromCommons };
