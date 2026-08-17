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

// ── Pixabay fallback (free key, no approval needed) ──────────────────────────
const PIXABAY_KEY = process.env.PIXABAY_API_KEY || '';

async function pixabaySearch(query, limit = 1) {
  if (!PIXABAY_KEY) return [];
  const d = await safeFetch(
    `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&safesearch=true&per_page=${Math.max(3, limit)}&min_width=400&min_height=400`
  );
  if (!Array.isArray(d?.hits)) return [];
  return d.hits.slice(0, limit).map(h => ({
    url:    h.webformatURL || h.largeImageURL || null,
    thumb:  h.previewURL   || h.webformatURL  || null,
    credit: `Photo by ${h.user} on Pixabay`,
  })).filter(r => r.url);
}

// ── Pexels ───────────────────────────────────────────────────────────────────
// Третий источник, а не запасной: у Unsplash сильная «эстетическая» база, но
// слабая бытовая — «аэропорт», «врач», «поездка на автобусе» дают там красивые
// пустые кадры. У Pexels ровно обратный перекос, поэтому вместе они закрывают
// школьные темы, а Commons остаётся крайним случаем.
const PEXELS_KEY = process.env.PEXELS_API_KEY || '';

async function pexelsSearch(query, limit = 1) {
  if (!PEXELS_KEY) return [];
  const d = await safeFetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.max(3, limit)}&orientation=square`,
    { Authorization: PEXELS_KEY }
  );
  if (!Array.isArray(d?.photos)) return [];
  return d.photos.slice(0, limit).map(p => ({
    url:    p.src?.large || p.src?.medium || null,
    thumb:  p.src?.small || p.src?.tiny   || null,
    credit: p.photographer ? `Photo by ${p.photographer} on Pexels` : 'Pexels',
    source: 'pexels',
    license: 'Pexels License — free to use, attribution appreciated',
  })).filter(r => r.url);
}

// ── Wikipedia fallback chain (last resort — often gives unrelated images) ─────
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

  /* Порядок: Unsplash → Pexels → Pixabay → Wikipedia.
     Первые три отдают снимки, которые можно печатать без обязательств (у
     Pexels и Unsplash подпись желательна, у Pixabay не нужна). Wikimedia
     оставлен последним намеренно: там CC-лицензии, где указание автора чаще
     всего ОБЯЗАТЕЛЬНО, и материал попадает на печатный лист — поэтому его
     подпись и лицензия едут вместе с картинкой, а не теряются. */
  let results = await unsplashSearch(q, limit);
  if (!results.length) results = await pexelsSearch(q, limit);
  if (!results.length) results = await pixabaySearch(q, limit);
  if (!results.length) results = await wikiResolve(q);

  const url = results[0]?.url || null;
  cacheSet(singleCache, q, url);
  cacheSet(multiCache, cacheKey, results);

  res.json({ url, urls: results });
});

/* GET /api/images/status — какие источники реально подключены.

   Ключей на сервере не было, поэтому поиск молча падал в Wikimedia и отдавал
   случайные картинки: снаружи это выглядело как «подбор не работает», хотя
   код работал. Проверить это было нечем — эндпоинт отвечает на вопрос «ключ
   вставлен и он живой?» одним запросом, без выкладки и без чтения .env
   руками. Ключи не возвращаются, только факт их наличия и ответ провайдера. */
router.get('/status', async (req, res) => {
  const probe = async (name, key, fn) => {
    if (!key) return { name, configured: false, ok: false, note: 'no key in .env' };
    const hits = await fn('classroom', 1).catch(() => []);
    return { name, configured: true, ok: hits.length > 0, sample: hits[0]?.credit || null };
  };
  const sources = [
    await probe('unsplash', UNSPLASH_KEY, unsplashSearch),
    await probe('pexels',   PEXELS_KEY,   pexelsSearch),
    await probe('pixabay',  PIXABAY_KEY,  pixabaySearch),
  ];
  const live = sources.filter(s => s.ok).map(s => s.name);
  res.json({
    ok: live.length > 0,
    live,
    fallback: 'wikimedia (CC — attribution usually required)',
    sources,
    cache: { single: singleCache.size, multi: multiCache.size },
  });
});

module.exports = router;
