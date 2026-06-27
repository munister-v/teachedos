// GET /api/images/search?q=term[&limit=N]
// Returns {url, urls:[{url,thumb,credit}]} or {url:null}
// Primary: Unsplash API. Fallback chain: Wikipedia summary → OpenSearch → Commons.
const router = require('express').Router();

const singleCache = new Map();   // q → url|null
const multiCache  = new Map();   // q+limit → [{url,thumb,credit}]
const MAXCACHE = 2000;

const TIMEOUT = 5000;
async function safeFetch(url, headers = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers });
    return await r.json();
  } catch { return null; }
  finally { clearTimeout(id); }
}

// ── Unsplash ──────────────────────────────────────────────────────────────────
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || '';

async function unsplashSearch(query, limit = 1) {
  if (!UNSPLASH_KEY) return [];
  const d = await safeFetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=squarish&content_filter=high`,
    { Authorization: `Client-ID ${UNSPLASH_KEY}` }
  );
  if (!Array.isArray(d?.results)) return [];
  return d.results.map(r => ({
    url:    r.urls?.regular || r.urls?.small || null,
    thumb:  r.urls?.small   || r.urls?.thumb || null,
    credit: r.user?.name ? `Photo by ${r.user.name} on Unsplash` : 'Unsplash',
  })).filter(r => r.url);
}

// ── Wikipedia fallback chain ───────────────────────────────────────────────────
async function wikiSummary(query) {
  const d = await safeFetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
  );
  return d?.thumbnail?.source || null;
}

async function wikiSearch(query) {
  const d = await safeFetch(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`
  );
  const title = d?.[1]?.[0];
  if (!title) return null;
  const d2 = await safeFetch(
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=600`
  );
  const page = Object.values(d2?.query?.pages || {})[0];
  return page?.thumbnail?.source || null;
}

async function commonsSearch(query) {
  const d = await safeFetch(
    `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=1&format=json`
  );
  const hit = d?.query?.search?.[0];
  if (!hit) return null;
  const d2 = await safeFetch(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json`
  );
  const page = Object.values(d2?.query?.pages || {})[0];
  return page?.imageinfo?.[0]?.thumburl || null;
}

async function wikiResolve(query) {
  const qCap = query[0].toUpperCase() + query.slice(1);
  let url = await wikiSummary(qCap);
  if (!url) url = await wikiSearch(query);
  if (!url && query !== qCap) url = await wikiSummary(query);
  if (!url) url = await commonsSearch(query);
  return url ? [{ url, thumb: url, credit: 'Wikimedia' }] : [];
}

// ── Evict-oldest helper ───────────────────────────────────────────────────────
function cacheSet(map, key, val) {
  if (map.size >= MAXCACHE) map.delete(map.keys().next().value);
  map.set(key, val);
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Single best image (used by the game at play time)
router.get('/search', async (req, res) => {
  const q     = String(req.query.q || '').trim().toLowerCase().slice(0, 120);
  const limit = Math.min(parseInt(req.query.limit) || 1, 12);
  if (!q) return res.json({ url: null, urls: [] });

  if (limit === 1 && singleCache.has(q)) return res.json({ url: singleCache.get(q), urls: [] });

  const cacheKey = `${q}|${limit}`;
  if (multiCache.has(cacheKey)) {
    const cached = multiCache.get(cacheKey);
    return res.json({ url: cached[0]?.url || null, urls: cached });
  }

  // Primary: Unsplash; fallback: Wikipedia chain
  let results = await unsplashSearch(q, limit);
  if (!results.length) results = await wikiResolve(q);

  const url = results[0]?.url || null;
  cacheSet(singleCache, q, url);
  cacheSet(multiCache, cacheKey, results);

  res.json({ url, urls: results });
});

module.exports = router;
