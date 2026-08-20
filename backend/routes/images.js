// GET /api/images/search?q=term[&limit=N]
// Returns {url, urls:[{url,thumb,credit}]} or {url:null}
// Primary: Unsplash API. Fallback chain: Wikipedia summary → OpenSearch → Commons.
const router = require('express').Router();
const imageIndex = require('../lib/imageIndex');

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
// слабая бытовая - «аэропорт», «врач», «поездка на автобусе» дают там красивые
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
    license: 'Pexels License - free to use, attribution appreciated',
  })).filter(r => r.url);
}

// ── Wikipedia fallback chain (last resort - often gives unrelated images) ─────
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

/* ── ЧТО ИМЕННО ИСКАТЬ ─────────────────────────────────────────────────────

   Поиск по голому слову промахивается чаще, чем попадает. Проверка на живых
   словах урока дала 1 попадание из 6: «nervous» - обезьяна, «premiere» -
   пустой стадион, «citizen» - люди в национальных костюмах. Причина не в
   фотобанке: слово вне контекста для него не запрос, а омоним. «Scarf» -
   это и шарф, и модный портрет; «premiere» - и премьера фильма, и любая
   премьера чего угодно.

   Контекст у нас уже есть, просто он не доезжал: у словарной статьи есть тема
   урока и пример предложения. Из них строится лестница запросов от самого
   узкого к самому широкому, и берётся первый, который что-то нашёл.

   Абстрактные слова - отдельный случай. Фото «гражданства» не существует;
   существует фото сцены, где это происходит (церемония, паспорт, очередь).
   Поэтому для них в запрос идёт пример предложения, а не само слово.        */
const ABSTRACT_HINT = /\b(feel|feeling|idea|concept|state|quality|process|ability|belief|right|freedom|justice|trend|policy|status|value)\b/i;

/* ЗАПРОС В ФОТОБАНК ИДЁТ ПО-АНГЛИЙСКИ.

   Фотобанки индексируют снимки английскими тегами. Русский или украинский
   запрос они не отклоняют - они отдают что придётся: «учебник» возвращал
   роман на диване, «иностранные языки» - удалённый кадр с заглушкой «изображение
   недоступно». На доске это выглядит как случайная фотография рядом с
   осмысленной подписью, и понять логику подбора невозможно, потому что её
   там и нет.

   Поэтому нелатинский запрос сначала переводится. MyMemory выбран за
   отсутствие ключа и лимитов, которые здесь можно исчерпать: слова уходят
   поштучно, а найденное оседает в индексе картинок, так что повтор наружу
   не ходит вовсе. Перевод не удался - ищем как раньше, по оригиналу: хуже,
   чем сейчас, от этого не станет.                                          */
const CYRILLIC = /[\u0400-\u04FF]/;
const translationCache = new Map();   // «слово» → "word"

async function toEnglish(text) {
  const src = String(text || '').trim();
  if (!src || !CYRILLIC.test(src)) return src;
  const key = src.toLowerCase();
  if (translationCache.has(key)) return translationCache.get(key);

  // Українські літери есть только в украинском: пара выбирается по ним, иначе
  // «і» и «ї» переводятся как опечатки и слово теряется.
  const from = /[іїєґ]/i.test(src) ? 'uk' : 'ru';
  const d = await safeFetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(src.slice(0, 120))}&langpair=${from}|en`
  );
  const out = String(d?.responseData?.translatedText || '').trim();
  /* MyMemory на неудаче возвращает исходную строку или служебное сообщение
     капслоком («MYMEMORY WARNING: …»), а не ошибку. И то и другое для поиска
     бесполезно, поэтому проверяем результат, а не код ответа. */
  const ok = out
    && !CYRILLIC.test(out)
    && !/^[A-Z\s.,'"!?-]+$/.test(out)
    && out.length <= src.length * 3;
  const value = ok ? out.toLowerCase() : src;
  cacheSet(translationCache, key, value);
  return value;
}

function buildQueries({ q, topic, context }) {
  const word = String(q || '').trim();
  const theme = String(topic || '').trim().toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9\s-]/gi, ' ').split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
  /* Из примера берём существительные-«декорации», а не всё предложение:
     фотобанк ищет по ключевым словам, и длинная фраза сужает выдачу в ноль. */
  const scene = String(context || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP.has(w) && w !== word.toLowerCase())
    .slice(0, 3).join(' ');

  const list = [];
  if (theme && word) list.push(`${word} ${theme}`);
  if (scene && word) list.push(`${word} ${scene}`);
  if (word) list.push(word);
  if (scene) list.push(scene);            // абстрактное слово: ищем сцену
  if (theme) list.push(theme);            // последняя попытка - хотя бы по теме
  return [...new Set(list.filter(Boolean))];
}
const STOP = new Set(['this','that','they','their','there','with','from','have','were','been','about','which','when','what','your','you','the','and','for','was','are','его','это','как','для']);

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
  // Необязательный контекст: тема урока и пример предложения. Без них
  // поведение ровно прежнее - ищем по слову.
  const topic   = String(req.query.topic || '').trim().slice(0, 80);
  const context = String(req.query.context || '').trim().slice(0, 200);
  if (!q) return res.json({ url: null, urls: [] });

  /* Долгий индекс: то, что нашли когда-то, отдаём мгновенно и без сети.
     Память процесса живёт до перезапуска, а этот файл - годами, поэтому
     повторное слово (а школьная лексика повторяется постоянно) наружу
     больше не ходит. Контекстные запросы тоже берём из индекса: снимок к
     слову не зависит от того, каким предложением его сегодня обставили. */
  const remembered = imageIndex.get(q, topic);
  if (remembered && remembered.hits.length >= limit) {
    const hits = remembered.hits.slice(0, limit);
    return res.json({ url: hits[0]?.url || null, urls: hits, query: q, source: 'index' });
  }

  /* Перевод стоит ПОСЛЕ индекса и ДО фотобанка: повторное слово отдаётся из
     индекса, ни разу не обратившись к переводчику, а наружу уходит уже
     английский запрос. */
  const [qEn, topicEn, contextEn] = await Promise.all([
    toEnglish(q), toEnglish(topic), toEnglish(context),
  ]);
  const queries = buildQueries({ q: qEn, topic: topicEn, context: contextEn });
  const cacheKey = `${queries.join('~')}|${limit}`;
  if (multiCache.has(cacheKey)) {
    const cached = multiCache.get(cacheKey);
    return res.json({ url: cached[0]?.url || null, urls: cached, query: cached.query || queries[0] });
  }
  if (!topic && !context && limit === 1 && singleCache.has(q)) {
    return res.json({ url: singleCache.get(q), urls: [] });
  }

  /* Порядок: Unsplash → Pexels → Pixabay → Wikipedia.
     Первые три отдают снимки, которые можно печатать без обязательств (у
     Pexels и Unsplash подпись желательна, у Pixabay не нужна). Wikimedia
     оставлен последним намеренно: там CC-лицензии, где указание автора чаще
     всего ОБЯЗАТЕЛЬНО, и материал попадает на печатный лист - поэтому его
     подпись и лицензия едут вместе с картинкой, а не теряются. */
  let results = [];
  let used = queries[0];
  for (const candidate of queries) {
    results = await unsplashSearch(candidate, limit);
    if (!results.length) results = await pexelsSearch(candidate, limit);
    if (!results.length) results = await pixabaySearch(candidate, limit);
    if (results.length) { used = candidate; break; }
  }
  // Wikimedia - только по самому слову и только если не нашлось ничего: его
  // лицензии требуют подписи, поэтому он крайний случай, а не равный участник.
  if (!results.length) { results = await wikiResolve(q); used = q; }

  /* Наружу отдаём адреса через наш прокси, а исходный сохраняем в `origin`:
     карточка урока живёт годами, и ссылка на чужой CDN - это срок годности,
     о котором никто не узнает, пока картинки не пропадут посреди занятия. */
  const proxied = results.map(r => ({
    ...r,
    origin: r.url,
    url: r.url ? `/api/images/proxy?u=${encodeURIComponent(r.url)}` : r.url,
    thumb: r.thumb ? `/api/images/proxy?u=${encodeURIComponent(r.thumb)}` : r.thumb,
  }));
  const url = proxied[0]?.url || null;
  if (!topic && !context) cacheSet(singleCache, q, url);
  proxied.query = used;
  cacheSet(multiCache, cacheKey, proxied);
  imageIndex.put(q, topic, proxied);

  res.json({ url, urls: proxied, query: used });
});

/* GET /api/images/proxy?u=… - чужая картинка через наш домен.

   Зачем вообще: карточки урока печатают, экспортируют в PNG и открывают
   через месяцы. Прямая ссылка на CDN фотобанка держится ровно до тех пор,
   пока фотобанк не поменяет правила хотлинка, - а экспорт доски идёт через
   html2canvas, которому нужен CORS: чужой домен без нужных заголовков даёт
   пустые рамки вместо картинок.

   Почему прокси, а не своя копия на диске: пересжатие требует sharp с
   нативными бинарниками, а на этой машине 1.7 ГБ памяти и общий диск с
   четырьмя другими проектами. Прокси даёт то же главное - свой origin,
   свои CORS-заголовки и годовой кэш, - не заводя ни зависимости, ни
   каталога, который придётся чистить.

   Открытым прокси это быть не должно: без белого списка хостов любой мог бы
   гонять через нас произвольные запросы (SSRF), поэтому пропускаются только
   те источники, из которых мы сами и берём картинки.                        */
const PROXY_HOSTS = new Set([
  'images.pexels.com', 'pixabay.com', 'cdn.pixabay.com',
  'images.unsplash.com', 'upload.wikimedia.org', 'commons.wikimedia.org',
]);
const PROXY_MAX_BYTES = 6 * 1024 * 1024;

router.get('/proxy', async (req, res) => {
  let target;
  try { target = new URL(String(req.query.u || '')); }
  catch { return res.status(400).json({ error: 'bad url' }); }
  if (target.protocol !== 'https:' || !PROXY_HOSTS.has(target.hostname)) {
    return res.status(403).json({ error: 'host not allowed' });
  }
  try {
    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'TeachEd/1.0 (+https://teached.tech)' },
      signal: AbortSignal.timeout(8000),
    });
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !type.startsWith('image/')) {
      return res.status(502).json({ error: 'upstream ' + upstream.status });
    }
    const len = Number(upstream.headers.get('content-length') || 0);
    if (len && len > PROXY_MAX_BYTES) return res.status(413).json({ error: 'too large' });

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > PROXY_MAX_BYTES) return res.status(413).json({ error: 'too large' });
    res.set({
      'Content-Type': type,
      'Content-Length': String(buf.length),
      // Ссылка на конкретный файл фотобанка не меняет содержимое, поэтому год
      // и immutable - печать и повторное открытие урока идут уже из кэша.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.end(buf);
  } catch (e) {
    res.status(504).json({ error: 'fetch failed' });
  }
});

/* GET /api/images/status - какие источники реально подключены.

   Ключей на сервере не было, поэтому поиск молча падал в Wikimedia и отдавал
   случайные картинки: снаружи это выглядело как «подбор не работает», хотя
   код работал. Проверить это было нечем - эндпоинт отвечает на вопрос «ключ
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
    ok: live.length > 0 || imageIndex.stats().entries > 0,
    index: imageIndex.stats(),
    live,
    fallback: 'wikimedia (CC - attribution usually required)',
    sources,
    cache: { single: singleCache.size, multi: multiCache.size },
  });
});

module.exports = router;
