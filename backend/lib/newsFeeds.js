/* ── Новости как материал урока чтения ─────────────────────────────────
   Учитель выбирает свежую статью из открытых изданий, а мастер урока
   пересказывает её на нужном уровне (инструмент news-graded) и строит
   вокруг неё обычный урок чтения.

   Ленты - ЗАКРЫТЫЙ список, а не «дай любой RSS»: адрес ленты и адрес
   статьи приходят от клиента только как ключ рубрики и как ссылка, чей
   хост обязан быть одним из хостов этого списка. Поэтому сервер никогда
   не ходит по произвольному адресу, и SSRF-контура /web-text здесь не
   нужно.

   Кого нет и почему (проверено с VPS 23.09.2026):
   - The New York Times отдаёт статьи с 403 «enable JS» - пейвол;
   - NPR с нашего сервера не отвечает вовсе (таймаут и на ленте, и на статье);
   - видео-сюжеты Al Jazeera - это 40 слов подписи, отсекаются по длине. */

const UA = 'Mozilla/5.0 (compatible; TeachEdBot/1.0; +https://teached.tech)';

const FEEDS = {
  'guardian-science':     { source: 'The Guardian',     url: 'https://www.theguardian.com/science/rss' },
  'guardian-environment': { source: 'The Guardian',     url: 'https://www.theguardian.com/uk/environment/rss' },
  'guardian-technology':  { source: 'The Guardian',     url: 'https://www.theguardian.com/uk/technology/rss' },
  'guardian-culture':     { source: 'The Guardian',     url: 'https://www.theguardian.com/uk/culture/rss' },
  'guardian-lifestyle':   { source: 'The Guardian',     url: 'https://www.theguardian.com/uk/lifeandstyle/rss' },
  'guardian-travel':      { source: 'The Guardian',     url: 'https://www.theguardian.com/uk/travel/rss' },
  'guardian-food':        { source: 'The Guardian',     url: 'https://www.theguardian.com/food/rss' },
  'guardian-sport':       { source: 'The Guardian',     url: 'https://www.theguardian.com/uk/sport/rss' },
  'guardian-world':       { source: 'The Guardian',     url: 'https://www.theguardian.com/world/rss' },
  'bbc-science':          { source: 'BBC News',         url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  'bbc-technology':       { source: 'BBC News',         url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  'bbc-arts':             { source: 'BBC News',         url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
  'bbc-health':           { source: 'BBC News',         url: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  'bbc-world':            { source: 'BBC News',         url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  'sciencedaily':         { source: 'ScienceDaily',     url: 'https://www.sciencedaily.com/rss/top.xml' },
  'sciencedaily-health':  { source: 'ScienceDaily',     url: 'https://www.sciencedaily.com/rss/top/health.xml' },
  'conversation':         { source: 'The Conversation', url: 'https://theconversation.com/global/articles.atom' },
  'aljazeera':            { source: 'Al Jazeera',       url: 'https://www.aljazeera.com/xml/rss/all.xml' },
};

/* Рубрика - то, что выбирает учитель; источников в ней несколько, и
   заголовки идут вперемешку по свежести. Первыми стоят темы, на которых
   урок строится спокойно; «World» последним: там чаще всего война,
   преступления и насилие, и учитель должен выбрать это осознанно. */
const TOPICS = [
  { key: 'science',     title: 'Science',      feeds: ['guardian-science', 'bbc-science', 'sciencedaily'] },
  { key: 'environment', title: 'Environment',  feeds: ['guardian-environment'] },
  { key: 'technology',  title: 'Technology',   feeds: ['guardian-technology', 'bbc-technology'] },
  { key: 'health',      title: 'Health',       feeds: ['bbc-health', 'sciencedaily-health'] },
  { key: 'culture',     title: 'Culture',      feeds: ['guardian-culture', 'bbc-arts'] },
  { key: 'lifestyle',   title: 'Life & style', feeds: ['guardian-lifestyle', 'guardian-food', 'guardian-travel'] },
  { key: 'sport',       title: 'Sport',        feeds: ['guardian-sport'] },
  { key: 'ideas',       title: 'Ideas',        feeds: ['conversation'] },
  { key: 'world',       title: 'World news',   feeds: ['guardian-world', 'bbc-world', 'aljazeera'] },
];

const ARTICLE_HOSTS = /(^|\.)(theguardian\.com|bbc\.co\.uk|bbc\.com|sciencedaily\.com|theconversation\.com|aljazeera\.com)$/i;

function sourceForHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (/theguardian\.com$/.test(h)) return 'The Guardian';
  if (/bbc\.(co\.uk|com)$/.test(h)) return 'BBC News';
  if (/sciencedaily\.com$/.test(h)) return 'ScienceDaily';
  if (/theconversation\.com$/.test(h)) return 'The Conversation';
  if (/aljazeera\.com$/.test(h)) return 'Al Jazeera';
  return '';
}

function decode(t) {
  return String(t == null ? '' : t)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}
const stripTags = s => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function fetchText(url, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/xml,*/*' } });
    return { ok: res.ok, status: res.status, url: res.url, text: res.ok ? (await res.text()).slice(0, 1500000) : '' };
  } finally { clearTimeout(timer); }
}

function parseFeed(xml, feedKey) {
  const feed = FEEDS[feedKey];
  const out = [];
  const tag = (block, name) => (block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i')) || [])[1] || '';
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = stripTags(tag(b, 'title'));
    let link = stripTags(tag(b, 'link'));
    if (!link) link = decode((b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)/i) || b.match(/<link[^>]*href=["']([^"']+)/i) || [])[1] || '');
    if (!title || !/^https:\/\//i.test(link)) continue;
    /* Видео и прямые эфиры не читаются: у них вместо статьи подпись. */
    if (/\/(video|live|audio|podcasts?|gallery)\//i.test(link)) continue;
    const date = stripTags(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated'));
    const ts = Date.parse(date) || 0;
    /* Порядок атрибутов у лент разный (у Guardian width идёт до url). */
    const images = (b.match(/<media:(?:content|thumbnail)\b[^>]*>/gi) || [])
      .map(t => ({ url: decode((t.match(/\burl=["']([^"']+)/i) || [])[1] || ''), w: Number((t.match(/\bwidth=["'](\d+)/i) || [])[1]) || 0 }))
      .filter(i => i.url)
      .sort((a, b2) => a.w - b2.w);
    /* Самая маленькая картинка шире 100px: для строки списка большая не нужна. */
    const image = (images.find(i => i.w >= 100) || images[0] || {}).url || '';
    const summary = stripTags(tag(b, 'description') || tag(b, 'summary')).replace(/\s*Continue reading\.*\s*$/i, '').slice(0, 260);
    out.push({ title: title.slice(0, 220), url: link.replace(/\?at_medium=RSS.*$/, '').replace(/\?traffic_source=rss$/, ''), summary, published: ts ? new Date(ts).toISOString() : '', source: feed.source, image });
  }
  return out;
}

const FEED_CACHE = new Map(); // feedKey -> { at, items }
const FEED_TTL_MS = 20 * 60 * 1000;

async function feedItems(feedKey) {
  const hit = FEED_CACHE.get(feedKey);
  if (hit && Date.now() - hit.at < FEED_TTL_MS) return hit.items;
  try {
    const r = await fetchText(FEEDS[feedKey].url);
    if (!r.ok) throw new Error(`feed ${feedKey} ${r.status}`);
    const items = parseFeed(r.text, feedKey);
    FEED_CACHE.set(feedKey, { at: Date.now(), items });
    return items;
  } catch (err) {
    console.warn('[news] feed failed', feedKey, err.message);
    /* Устаревшая лента лучше пустой: учитель выбирает статью, а не
       проверяет, что её напечатали пять минут назад. */
    return hit ? hit.items : [];
  }
}

async function topicItems(topicKey) {
  const topic = TOPICS.find(t => t.key === topicKey) || TOPICS[0];
  const lists = await Promise.all(topic.feeds.map(feedItems));
  const seen = new Set();
  const items = lists.flat().filter(i => {
    const k = i.url.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  items.sort((a, b) => (b.published || '').localeCompare(a.published || ''));
  return { topic: topic.key, items: items.slice(0, 40) };
}

/* Текст статьи - только абзацы <p> внутри самого длинного <article>/<main>.
   Общий извлекатель /web-text снимает теги со всего блока, и на новостях
   в текст попадали подписи к фото («Photograph: …», «Image source»),
   «Most viewed» и заголовки «читайте также». Короткие строки без точки в
   конце - это как раз такие заголовки-ссылки, а не предложения статьи. */
const JUNK_RE = /^(photograph|image source|image caption|figure caption|media caption|getty images|watch:|listen:|sign up|read more|related:|explore more|share this|reuse this content|most viewed|advertisement|©|copyright|this article (was|is) (originally|republished)|follow us|subscribe|have you been affected|get the newsletter|a weekly e-mail)/i;

function articleFromHtml(html) {
  const raw = String(html || '');
  const meta = name => decode((raw.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)`, 'i'))
    || raw.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, 'i')) || [])[1] || '');
  const s = raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|header|footer|aside|figure|figcaption|form|button)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const blocks = [];
  for (const re of [/<article\b[^>]*>([\s\S]*?)<\/article>/gi, /<main\b[^>]*>([\s\S]*?)<\/main>/gi]) {
    let m;
    while ((m = re.exec(s))) blocks.push(m[1]);
  }
  const body = blocks.sort((a, b) => b.length - a.length)[0] || s;
  const paras = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(body))) {
    const t = stripTags(m[1]).replace(/\s+([,.;:!?])/g, '$1');
    if (t.split(' ').length < 8 || JUNK_RE.test(t) || paras.includes(t)) continue;
    paras.push(t);
  }
  while (paras.length && !/[.!?"'”’)]$/.test(paras[paras.length - 1])) paras.pop();
  const title = meta('og:title') || stripTags((raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  return {
    title: title.replace(/\s+[|\-–]\s+(BBC News|The Guardian|Al Jazeera|ScienceDaily)\s*$/i, '').slice(0, 220),
    image: meta('og:image'),
    published: meta('article:published_time'),
    text: paras.join('\n\n'),
  };
}

const ARTICLE_CACHE = new Map();

async function readArticle(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl || '')); } catch { return { error: 'Not a link', status: 400 }; }
  if (u.protocol !== 'https:' || !ARTICLE_HOSTS.test(u.hostname)) {
    return { error: 'Pick a story from the list', status: 400 };
  }
  const key = u.href;
  if (ARTICLE_CACHE.has(key)) return ARTICLE_CACHE.get(key);
  const r = await fetchText(u.href, 12000);
  if (!r.ok) return { error: r.status === 403 ? 'This site does not let us read the story' : 'The story could not be opened', status: 502 };
  const finalHost = (() => { try { return new URL(r.url).hostname; } catch { return ''; } })();
  if (!ARTICLE_HOSTS.test(finalHost)) return { error: 'The story moved somewhere we cannot read', status: 502 };
  const art = articleFromHtml(r.text);
  const words = art.text ? art.text.split(/\s+/).length : 0;
  if (words < 120) return { error: 'This one is too short to read - probably a video or a live page', status: 404 };
  const out = { ...art, text: art.text.slice(0, 16000), words, url: u.href, source: sourceForHost(finalHost) };
  ARTICLE_CACHE.set(key, out);
  if (ARTICLE_CACHE.size > 200) ARTICLE_CACHE.delete(ARTICLE_CACHE.keys().next().value);
  return out;
}

module.exports = {
  topics: () => TOPICS.map(t => ({ key: t.key, title: t.title, sources: [...new Set(t.feeds.map(f => FEEDS[f].source))] })),
  topicItems,
  readArticle,
  articleFromHtml,
  parseFeed,
};
