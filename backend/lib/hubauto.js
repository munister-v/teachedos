/* The Watch & Read feed fills itself (island TZ §1): the platform builds reads for a level and an
   interest from real articles, retold at the level, and keeps them for every student who needs
   that level and interest. A student never waits for a teacher; a teacher's pick only goes on top.

   ensure(db, { level, interest }) tops up the stock for one level + interest (at most one piece
   per call, one call at a time per key) and never throws: a failure just means a thinner feed
   today. Pieces are shared, so ten students at B1 with "science" cost one generation. */

const interests = require('./interests');

const STOCK = 4;             // pieces per level + interest kept fresh
const FRESH_DAYS = 14;
const running = new Set();

const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

/* what a magazine retelling becomes as a hub piece */
function pieceFrom(mag, { level, interest, url }) {
  const body = (mag.paragraphs || []).map(p => clip(p, 1500)).filter(Boolean).join('\n\n');
  const words = (mag.vocab || []).slice(0, 10).map(v => [clip(v.term, 60), clip(v.definition, 120).replace(/\|/g, '/'), clip(v.example, 300).replace(/\|/g, '/')].join(' | '));
  const minutes = Math.max(1, Math.min(10, Number(mag.readMinutes) || Math.round(body.split(/\s+/).length / 130) || 3));
  return {
    kind: 'read', title: clip(mag.headline, 160), kicker: clip(mag.category, 60), topic: clip((interests.interestByKey.get(interest) || {}).label || interest, 40),
    level, minutes, body, words, interest, origin_url: url,
  };
}

async function ensure(db, { level, interest }, deps = {}) {
  const key = level + ':' + interest;
  const def = interests.interestByKey.get(interest);
  if (!def || !interests.LEVELS.includes(level) || running.has(key)) return null;
  running.add(key);
  try {
    const { rows: [c] } = await db.query(
      `SELECT COUNT(*)::int AS n FROM hub_materials WHERE source = 'auto' AND level = $1 AND interest = $2 AND created_at > NOW() - ($3 || ' days')::interval`, [level, interest, FRESH_DAYS]);
    if (c.n >= STOCK) return null;
    const newsFeeds = deps.newsFeeds || require('./newsFeeds');
    const build = deps.buildMagazine || require('./magazine').buildMagazine;
    const q = def.q[Math.floor(Math.random() * def.q.length)];
    const found = await newsFeeds.search(q);
    for (const it of (found.items || []).slice(0, 8)) {
      const { rows: dup } = await db.query('SELECT 1 FROM hub_materials WHERE origin_url = $1', [it.url]);
      if (dup.length) continue;
      const art = await newsFeeds.readArticle(it.url);
      if (!art || art.error || !art.text) continue;
      const mag = await build({ title: art.title, text: art.text, source: art.source, url: art.url || it.url, published: art.published, level, topicTitle: def.label.slice(0, 30) });
      const p = pieceFrom(mag, { level, interest, url: it.url });
      if (!p.title || !p.body || p.words.length < 4) continue;
      const hub = require('./hubcontent');
      const words = hub.parseWords(p.words, p.body);
      if (words.length < 4) continue;
      const { rows: [row] } = await db.query(
        `INSERT INTO hub_materials (teacher_id, kind, title, topic, kicker, level, minutes, body, words, source, interest, origin_url)
         VALUES (NULL,'read',$1,$2,$3,$4,$5,$6,$7::jsonb,'auto',$8,$9) ON CONFLICT DO NOTHING RETURNING id`,
        [p.title, p.topic, p.kicker, level, p.minutes, p.body, JSON.stringify(words), interest, p.origin_url]);
      return row ? row.id : null;
    }
    return null;
  } catch (err) {
    console.warn('[hub-auto]', key, err.message);
    return null;
  } finally { running.delete(key); }
}

module.exports = { ensure, pieceFrom, STOCK };
