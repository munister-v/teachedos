// GET /api/images/search?q=term
// Returns {url: "https://..."} or {url: null}
// Three-strategy Wikipedia/Commons fetch with in-memory cache.
const router = require('express').Router();

const cache  = new Map();     // term → url|null
const MAXCACHE = 2000;

const TIMEOUT = 4000;
async function safeFetch(url) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    return await r.json();
  } catch { return null; }
  finally { clearTimeout(id); }
}

// ── Strategy 1: Wikipedia REST summary (fastest path) ────────────────────────
async function s1_wikiSummary(query) {
  const d = await safeFetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
  );
  return d?.thumbnail?.source || null;
}

// ── Strategy 2: OpenSearch canonical title → pageimages ──────────────────────
async function s2_wikiSearch(query) {
  const d = await safeFetch(
    `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`
  );
  const title = d?.[1]?.[0];
  if (!title) return null;

  const d2 = await safeFetch(
    `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=400`
  );
  const page = Object.values(d2?.query?.pages || {})[0];
  return page?.thumbnail?.source || null;
}

// ── Strategy 3: Wikimedia Commons image search ────────────────────────────────
async function s3_commons(query) {
  const d = await safeFetch(
    `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=1&format=json`
  );
  const hit = d?.query?.search?.[0];
  if (!hit) return null;

  const d2 = await safeFetch(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json`
  );
  const page = Object.values(d2?.query?.pages || {})[0];
  return page?.imageinfo?.[0]?.thumburl || null;
}

// ── Main resolver ─────────────────────────────────────────────────────────────
async function resolveImage(query) {
  // Normalise: capitalise first letter (Wikipedia titles are capitalised)
  const q = query.trim();
  const qCap = q[0].toUpperCase() + q.slice(1);

  // Run strategies sequentially — each is a fallback for the previous
  let url = await s1_wikiSummary(qCap);
  if (!url) url = await s2_wikiSearch(q);
  if (!url && q !== qCap) url = await s1_wikiSummary(q);
  if (!url) url = await s3_commons(q);
  return url;
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase().slice(0, 120);
  if (!q) return res.json({ url: null });

  if (cache.has(q)) return res.json({ url: cache.get(q) });

  const url = await resolveImage(q);

  // Evict oldest when full
  if (cache.size >= MAXCACHE) cache.delete(cache.keys().next().value);
  cache.set(q, url);

  res.json({ url });
});

module.exports = router;
