/* /api/community - what turns the catalog into a community (ТЗ v1.0):
   post-lesson feedback, requests born from a weak search, collections and
   curators, author pages, explainable recommendations, the author's weekly
   digest and notification choices, appeals, and the review team's queue.

   Everything public here is built from real rows (lib/communityCards.js). */
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, optionalAuth, requireTeacher, requireAdmin } = require('../middleware/auth');
const { cardSelect, shapeRows, shapeStats, STATS_SQL, CATALOG_SQL, RECOMMENDABLE_SQL } = require('../lib/communityCards');
const mod = require('../lib/communityModeration');
const lessons = require('../lib/communityLessons');
const { tell, prefsOf } = require('../lib/communityNotify');
const { track, EVENTS, cleanProps } = require('../lib/communityEvents');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const isId = v => UUID_RE.test(String(v || ''));
const wrap = (name, fn) => async (req, res) => {
  try { await fn(req, res); } catch (err) { console.error(`[community] ${name}:`, err.message); res.status(500).json({ error: 'Server error' }); }
};
const firstName = n => String(n || 'A teacher').trim().split(/\s+/)[0] || 'A teacher';

/* ══ Catalog pieces that need no sign-in ══════════════════════════════════ */

/* GET /authors/:id - a public author page: what they shared and what came of it.
   Only aggregates - never a student's name, a board's title or a lesson's detail. */
router.get('/authors/:id', optionalAuth, wrap('author', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const me = req.user?.id || null;
  const { rows: [u] } = await pool.query(
    `SELECT id, name, avatar, community_bio AS bio, community_team AS team, created_at FROM users WHERE id = $1 AND role IN ('teacher','admin')`, [req.params.id]);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const { rows: pubs } = await pool.query(
    `SELECT ${cardSelect('$2')} FROM assignments a JOIN users u ON u.id = a.user_id
      WHERE a.user_id = $1 AND ${CATALOG_SQL} ORDER BY a.published_at DESC NULLS LAST LIMIT 100`, [u.id, me]);
  shapeRows(pubs);
  const ids = pubs.map(p => p.id);
  const sum = k => pubs.reduce((n, p) => n + (p.stats[k] || 0), 0);
  const { rows: [reach] } = ids.length ? await pool.query(
    `SELECT COUNT(DISTINCT s)::int AS students, COUNT(DISTINCT vu.teacher_id)::int AS teachers
       FROM verified_uses vu JOIN lesson_sessions ls ON ls.id = vu.lesson_session_id
       LEFT JOIN LATERAL unnest(ls.students) s ON TRUE
      WHERE vu.assignment_id = ANY($1::uuid[])`, [ids]) : { rows: [{ students: 0, teachers: 0 }] };
  const { rows: [hero] } = await pool.query(
    `SELECT COUNT(DISTINCT ra.request_id)::int AS n FROM request_answers ra WHERE ra.author_id = $1 AND ra.helpful`, [u.id]);
  const { rows: [fol] } = await pool.query(
    `SELECT COUNT(*)::int AS n, COALESCE(BOOL_OR(follower_id = $2), FALSE) AS mine FROM curator_follows WHERE curator_id = $1`, [u.id, me]);
  const { rows: cols } = await pool.query(
    `SELECT c.id, c.title, c.description, c.editorial,
            (SELECT COUNT(*) FROM collection_items ci JOIN assignments a ON a.id = ci.assignment_id WHERE ci.collection_id = c.id AND ${CATALOG_SQL})::int AS items
       FROM collections c WHERE c.owner_id = $1 AND (c.is_public OR c.owner_id = $2) ORDER BY c.updated_at DESC LIMIT 30`, [u.id, me]);
  res.json({
    author: { id: u.id, name: u.name, avatar: u.avatar, bio: u.bio, team: u.team, since: u.created_at, is_me: me === u.id },
    stats: { publications: pubs.length, copies: sum('copies'), saves: sum('saves'), likes: sum('likes'),
      used_in_classes: sum('used'), remixes: sum('remixes'), students_reached: reach.students, teachers_used: reach.teachers, requests_helped: hero.n },
    followers: fol.n, following: !!fol.mine,
    publications: pubs, collections: cols.filter(c => c.items > 0 || me === u.id),
  });
}));

/* PUT /profile {bio} - my own line on my author page */
router.put('/profile', requireAuth, requireTeacher, wrap('profile', async (req, res) => {
  const bio = clip(req.body?.bio, 400);
  await pool.query('UPDATE users SET community_bio = $2 WHERE id = $1', [req.user.id, bio]);
  res.json({ ok: true, bio });
}));

/* GET /remixes/:id - where this lesson went: copies, and the teachers who adapted it */
router.get('/remixes/:id', optionalAuth, wrap('remixes', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const me = req.user?.id || null;
  const { rows: [a] } = await pool.query(
    `SELECT a.id, a.title, a.remix_of, a.remix_of_title, a.remix_of_author, a.remix_of_author_id, a.user_id, a.visibility, a.hidden_at,
            ${STATS_SQL}, u.name AS author_name
       FROM assignments a JOIN users u ON u.id = a.user_id WHERE a.id = $1`, [req.params.id]);
  if (!a || (a.visibility === 'private' && a.user_id !== me) || (a.hidden_at && a.user_id !== me)) return res.status(404).json({ error: 'Not found' });
  const { rows: kids } = await pool.query(
    `SELECT ${cardSelect('$2')} FROM assignments a JOIN users u ON u.id = a.user_id
      WHERE a.remix_of = $1 AND ${CATALOG_SQL} ORDER BY a.published_at DESC LIMIT 50`, [a.id, me]);
  shapeRows(kids);
  // a remix of a remix: the line back to the root, newest parent first (the card shows only the direct parent)
  const lineage = [];
  let cur = a.remix_of ? { id: a.remix_of, title: a.remix_of_title, author: a.remix_of_author, author_id: a.remix_of_author_id } : null;
  for (let i = 0; cur && i < 6; i++) {
    const { rows: [p] } = await pool.query(
      `SELECT a.id, a.title, a.remix_of, a.remix_of_title, a.remix_of_author, a.remix_of_author_id, a.visibility, a.hidden_at, u.name AS author_name
         FROM assignments a JOIN users u ON u.id = a.user_id WHERE a.id = $1`, [cur.id]);
    lineage.push({ id: cur.id, title: p?.title || cur.title, author: p?.author_name || cur.author, author_id: cur.author_id, available: !!p && p.visibility !== 'private' && !p.hidden_at });
    cur = p && p.remix_of ? { id: p.remix_of, title: p.remix_of_title, author: p.remix_of_author, author_id: p.remix_of_author_id } : null;
  }
  res.json({
    copies: a.copy_count, remixes: a.remix_count,
    lineage, remixed_by: kids.map(k => ({ id: k.id, title: k.title, author_id: k.author_id, author_name: k.author_name, published_at: k.published_at, stats: k.stats, remix_count: k.stats.remixes })),
    line: a.remix_count ? `Copied ${a.copy_count} ${a.copy_count === 1 ? 'time' : 'times'} → ${a.remix_count} ${a.remix_count === 1 ? 'teacher' : 'teachers'} adapted it` : null,
  });
}));

/* ══ Collections and curators ═════════════════════════════════════════════ */

const colRow = `c.id, c.owner_id, c.title, c.description, c.is_public, c.editorial, c.updated_at, u.name AS owner_name, u.avatar AS owner_avatar, u.community_team AS owner_team,
  (SELECT COUNT(*) FROM collection_items ci JOIN assignments a ON a.id = ci.assignment_id WHERE ci.collection_id = c.id AND ${CATALOG_SQL})::int AS items,
  (SELECT COUNT(*) FROM curator_follows f WHERE f.curator_id = c.owner_id)::int AS followers`;

/* GET /collections?owner=&mine=1&editorial=1&q= */
router.get('/collections', optionalAuth, wrap('collections', async (req, res) => {
  const me = req.user?.id || null;
  const params = [me]; let where = `(c.is_public OR c.owner_id = $1)`;
  if (req.query.mine === '1' && me) where += ` AND c.owner_id = $1`;
  if (isId(req.query.owner)) { params.push(req.query.owner); where += ` AND c.owner_id = $${params.length}`; }
  if (req.query.editorial === '1') where += ` AND c.editorial`;
  if (req.query.following === '1' && me) where += ` AND c.owner_id IN (SELECT curator_id FROM curator_follows WHERE follower_id = $1)`;
  if (req.query.q) { params.push(`%${clip(req.query.q, 60)}%`); where += ` AND (c.title ILIKE $${params.length} OR c.description ILIKE $${params.length})`; }
  const { rows } = await pool.query(
    `SELECT ${colRow}, ($1::uuid IS NOT NULL AND c.owner_id = $1) AS is_mine,
            ($1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM curator_follows f WHERE f.curator_id = c.owner_id AND f.follower_id = $1)) AS following
       FROM collections c JOIN users u ON u.id = c.owner_id WHERE ${where}
      ORDER BY c.editorial DESC, c.updated_at DESC LIMIT 60`, params);
  // an empty public collection is not worth showing to others
  res.json({ collections: rows.filter(c => c.is_mine || c.items > 0) });
}));

router.get('/collections/:id', optionalAuth, wrap('collection', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const me = req.user?.id || null;
  const { rows: [c] } = await pool.query(
    `SELECT ${colRow}, ($2::uuid IS NOT NULL AND c.owner_id = $2) AS is_mine,
            ($2::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM curator_follows f WHERE f.curator_id = c.owner_id AND f.follower_id = $2)) AS following
       FROM collections c JOIN users u ON u.id = c.owner_id WHERE c.id = $1 AND (c.is_public OR c.owner_id = $2)`, [req.params.id, me]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const { rows: items } = await pool.query(
    `SELECT ${cardSelect('$2')}, ci.position FROM collection_items ci JOIN assignments a ON a.id = ci.assignment_id JOIN users u ON u.id = a.user_id
      WHERE ci.collection_id = $1 AND ${CATALOG_SQL} ORDER BY ci.position, ci.added_at`, [c.id, me]);
  res.json({ collection: c, items: shapeRows(items) });
}));

router.post('/collections', requireAuth, requireTeacher, wrap('collection-new', async (req, res) => {
  const title = clip(req.body?.title, 120);
  if (title.length < 3) return res.status(400).json({ error: 'Give the collection a name, e.g. "B1 Survival Kit"' });
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM collections WHERE owner_id = $1', [req.user.id]);
  if (n >= 30) return res.status(409).json({ error: 'You have 30 collections - tidy one up first' });
  const { rows: [c] } = await pool.query(
    'INSERT INTO collections (owner_id, title, description, is_public) VALUES ($1,$2,$3,$4) RETURNING id, title, description, is_public',
    [req.user.id, title, clip(req.body?.description, 500), req.body?.is_public !== false]);
  if (isId(req.body?.assignmentId)) await addToCollection(c.id, req.body.assignmentId, req.user.id).catch(() => {});
  track(req.user.id, 'collection_created', null, {});
  res.status(201).json({ collection: c });
}));

async function addToCollection(collectionId, assignmentId, userId) {
  const { rows: [a] } = await pool.query(`SELECT id FROM assignments a WHERE a.id = $1 AND ${CATALOG_SQL}`, [assignmentId]);
  if (!a) return false;
  const { rowCount } = await pool.query(
    `INSERT INTO collection_items (collection_id, assignment_id, position)
     SELECT $1, $2, COALESCE(MAX(position), 0) + 1 FROM collection_items WHERE collection_id = $1
     ON CONFLICT DO NOTHING`, [collectionId, assignmentId]);
  await pool.query('UPDATE collections SET updated_at = NOW() WHERE id = $1 AND owner_id = $2', [collectionId, userId]);
  return rowCount > 0;
}
const ownCollection = async (id, userId) => isId(id) && (await pool.query('SELECT id FROM collections WHERE id = $1 AND owner_id = $2', [id, userId])).rows[0];

router.patch('/collections/:id', requireAuth, requireTeacher, wrap('collection-edit', async (req, res) => {
  if (!(await ownCollection(req.params.id, req.user.id))) return res.status(404).json({ error: 'Not found' });
  const sets = [], params = [req.params.id]; const push = (c, v) => { params.push(v); sets.push(`${c} = $${params.length}`); };
  if (req.body?.title !== undefined) { const t = clip(req.body.title, 120); if (t.length < 3) return res.status(400).json({ error: 'Name is too short' }); push('title', t); }
  if (req.body?.description !== undefined) push('description', clip(req.body.description, 500));
  if (req.body?.is_public !== undefined) push('is_public', !!req.body.is_public);
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  await pool.query(`UPDATE collections SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, params);
  res.json({ ok: true });
}));
router.delete('/collections/:id', requireAuth, wrap('collection-del', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM collections WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
  res.status(rowCount ? 200 : 404).json(rowCount ? { ok: true } : { error: 'Not found' });
}));
router.post('/collections/:id/items', requireAuth, requireTeacher, wrap('collection-add', async (req, res) => {
  if (!(await ownCollection(req.params.id, req.user.id)) || !isId(req.body?.assignmentId)) return res.status(404).json({ error: 'Not found' });
  const added = await addToCollection(req.params.id, req.body.assignmentId, req.user.id);
  res.json({ ok: true, added });
}));
router.delete('/collections/:id/items/:assignmentId', requireAuth, wrap('collection-rm', async (req, res) => {
  if (!(await ownCollection(req.params.id, req.user.id))) return res.status(404).json({ error: 'Not found' });
  await pool.query('DELETE FROM collection_items WHERE collection_id = $1 AND assignment_id = $2', [req.params.id, req.params.assignmentId]);
  res.json({ ok: true });
}));

/* follow a curator: their collections and new materials reach you */
router.post('/curators/:id/follow', requireAuth, wrap('follow', async (req, res) => {
  if (!isId(req.params.id) || req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot follow this account' });
  const on = req.body?.on !== false;
  if (on) await pool.query('INSERT INTO curator_follows (follower_id, curator_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, req.params.id]);
  else await pool.query('DELETE FROM curator_follows WHERE follower_id = $1 AND curator_id = $2', [req.user.id, req.params.id]);
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM curator_follows WHERE curator_id = $1', [req.params.id]);
  res.json({ ok: true, following: on, followers: n });
}));
/* my collections for the "add to collection" menu, with whether this item is in each */
router.get('/my-collections', requireAuth, wrap('my-collections', async (req, res) => {
  const a = isId(req.query.assignmentId) ? req.query.assignmentId : null;
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.is_public, (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id)::int AS items,
            ($2::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM collection_items ci WHERE ci.collection_id = c.id AND ci.assignment_id = $2)) AS has
       FROM collections c WHERE c.owner_id = $1 ORDER BY c.updated_at DESC`, [req.user.id, a]);
  res.json({ collections: rows });
}));

/* ══ Requests: a search that found too little becomes a request ═══════════ */

const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const reqSelect = `r.id, r.requester_id, r.query, r.filters, r.format, r.details, to_char(r.needed_by, 'YYYY-MM-DD') AS needed_by, r.status, r.created_at,
  u.name AS requester_name, u.avatar AS requester_avatar,
  (SELECT COUNT(*) FROM request_votes v WHERE v.request_id = r.id)::int AS votes,
  ($1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM request_votes v WHERE v.request_id = r.id AND v.user_id = $1)) AS voted,
  ($1::uuid IS NOT NULL AND r.requester_id = $1) AS is_mine,
  (SELECT COUNT(*) FROM request_answers ra WHERE ra.request_id = r.id)::int AS answers`;

async function expireRequests() {
  await pool.query(`UPDATE resource_requests SET status = 'expired', closed_at = NOW() WHERE status = 'open' AND needed_by IS NOT NULL AND needed_by < CURRENT_DATE`);
}

/* GET /requests?status=open|mine|answered&q= */
router.get('/requests', optionalAuth, wrap('requests', async (req, res) => {
  await expireRequests();
  const me = req.user?.id || null;
  const params = [me]; let where = `r.status = 'open'`;
  if (req.query.status === 'mine' && me) where = `r.requester_id = $1`;
  else if (req.query.status === 'answered') where = `r.status = 'fulfilled'`;
  else if (req.query.status === 'helped' && me) where = `EXISTS (SELECT 1 FROM request_answers ra WHERE ra.request_id = r.id AND ra.author_id = $1)`;
  if (req.query.q) { params.push(`%${clip(req.query.q, 60)}%`); where += ` AND (r.query ILIKE $${params.length} OR r.details ILIKE $${params.length})`; }
  const { rows } = await pool.query(
    `SELECT ${reqSelect} FROM resource_requests r JOIN users u ON u.id = r.requester_id WHERE ${where}
      ORDER BY (r.status = 'open') DESC, votes DESC, r.created_at DESC LIMIT 60`, params);
  res.json({ requests: rows });
}));

/* one request with its answers (each a real resource) */
router.get('/requests/:id', optionalAuth, wrap('request', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const me = req.user?.id || null;
  const { rows: [r] } = await pool.query(`SELECT ${reqSelect} FROM resource_requests r JOIN users u ON u.id = r.requester_id WHERE r.id = $2`, [me, req.params.id]);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { rows } = await pool.query(
    `SELECT ${cardSelect('$1')}, ra.id AS answer_id, ra.helpful, ra.created_at AS answered_at
       FROM request_answers ra JOIN assignments a ON a.id = ra.assignment_id JOIN users u ON u.id = a.user_id
      WHERE ra.request_id = $2 AND ${CATALOG_SQL} ORDER BY ra.helpful DESC, ra.created_at`, [me, req.params.id]);
  res.json({ request: r, answers: shapeRows(rows) });
}));

router.post('/requests', requireAuth, requireTeacher, wrap('request-new', async (req, res) => {
  const query = clip(req.body?.query, 200);
  if (query.length < 4) return res.status(400).json({ error: 'Say what you need - a few words is enough' });
  const f = req.body?.filters || {};
  const filters = {};
  for (const k of ['language', 'level', 'age', 'skill']) { const v = clip(f[k], 30); if (v) filters[k] = v; }
  const format = ['space', 'studio', 'game', 'any'].includes(req.body?.format) ? req.body.format : 'any';
  let needed = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.needed_by || '')) ? req.body.needed_by : null;
  if (needed && Date.parse(needed) < Date.now() - 86400000) return res.status(400).json({ error: 'The date has already passed' });
  // the same ask is already there: join it rather than pile up copies
  const { rows: open } = await pool.query(`SELECT r.id, r.query FROM resource_requests r WHERE r.status = 'open' ORDER BY r.created_at DESC LIMIT 300`);
  const twin = open.find(r => norm(r.query) === norm(query));
  if (twin) {
    await pool.query('INSERT INTO request_votes (request_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [twin.id, req.user.id]);
    return res.json({ ok: true, duplicate: true, id: twin.id });
  }
  const { rows: [{ n }] } = await pool.query(`SELECT COUNT(*)::int AS n FROM resource_requests WHERE requester_id = $1 AND status = 'open'`, [req.user.id]);
  if (n >= 5) return res.status(429).json({ error: 'You have 5 open requests - close one that is answered first' });
  const { rows: [r] } = await pool.query(
    `INSERT INTO resource_requests (requester_id, query, filters, format, details, needed_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [req.user.id, query, filters, format, clip(req.body?.details, 1000), needed]);
  await pool.query('INSERT INTO request_votes (request_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.id, req.user.id]);
  track(req.user.id, 'request_created', null, { content_type: format, has_filters: Object.keys(filters).length > 0 });
  res.status(201).json({ ok: true, id: r.id });
}));

router.post('/requests/:id/vote', requireAuth, wrap('request-vote', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const on = req.body?.on !== false;
  if (on) await pool.query(`INSERT INTO request_votes (request_id, user_id) SELECT id, $2 FROM resource_requests WHERE id = $1 AND status = 'open' ON CONFLICT DO NOTHING`, [req.params.id, req.user.id]);
  else await pool.query('DELETE FROM request_votes WHERE request_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM request_votes WHERE request_id = $1', [req.params.id]);
  res.json({ ok: true, voted: on, votes: n });
}));

/* POST /requests/:id/answers {assignmentId} - share a matching resource: one of
   my own public ones (an answer always carries a resource; a promise alone is
   not value). The requester hears at once. */
router.post('/requests/:id/answers', requireAuth, requireTeacher, wrap('request-answer', async (req, res) => {
  if (!isId(req.params.id) || !isId(req.body?.assignmentId)) return res.status(400).json({ error: 'Choose one of your published resources' });
  const { rows: [r] } = await pool.query(`SELECT * FROM resource_requests WHERE id = $1`, [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.status !== 'open' && r.status !== 'fulfilled') return res.status(409).json({ error: 'This request is closed' });
  const { rows: [a] } = await pool.query(`SELECT a.id, a.title, a.user_id FROM assignments a WHERE a.id = $1 AND a.user_id = $2 AND ${CATALOG_SQL}`, [req.body.assignmentId, req.user.id]);
  if (!a) return res.status(404).json({ error: 'Publish it to Community first, then share it here' });
  const { rowCount } = await pool.query('INSERT INTO request_answers (request_id, author_id, assignment_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [r.id, req.user.id, a.id]);
  if (!rowCount) return res.json({ ok: true, already: true });
  track(req.user.id, 'request_answered', a.id, { content_type: 'request' });
  if (r.requester_id !== req.user.id) {
    await tell(r.requester_id, { type: 'community', email: 'requests', once: { kind: 'req_answered', key: `${r.id}:${a.id}` },
      title: 'Your request was fulfilled 🎉', body: `${firstName(req.user.name)} shared "${clip(a.title, 80)}" for "${clip(r.query, 80)}".`,
      link: `community.html#requests`,
      mail: { subject: 'Your request was fulfilled', paragraphs: [`${firstName(req.user.name)} shared a resource for "${r.query}": "${a.title}".`], button: { href: 'community.html#requests', label: 'See the answer' } } });
    // those who needed it too hear once
    const { rows: voters } = await pool.query('SELECT user_id FROM request_votes WHERE request_id = $1 AND user_id NOT IN ($2, $3)', [r.id, r.requester_id, req.user.id]);
    await Promise.all(voters.slice(0, 200).map(v => tell(v.user_id, { type: 'community', once: { kind: 'req_answered', key: `${r.id}:${a.id}` },
      title: 'A resource was shared for a request you needed', body: `"${clip(a.title, 80)}" answers "${clip(r.query, 80)}".`, link: 'community.html#requests' })));
  }
  res.status(201).json({ ok: true });
}));

/* the requester marks an answer Helpful, or closes the request */
router.post('/requests/:id/answers/:answerId/helpful', requireAuth, wrap('request-helpful', async (req, res) => {
  const { rows: [r] } = await pool.query('SELECT * FROM resource_requests WHERE id = $1 AND requester_id = $2', [req.params.id, req.user.id]);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const on = req.body?.on !== false;
  const { rows: [ans] } = await pool.query('UPDATE request_answers SET helpful = $3 WHERE id = $1 AND request_id = $2 RETURNING author_id, assignment_id', [req.params.answerId, r.id, on]);
  if (!ans) return res.status(404).json({ error: 'Not found' });
  await pool.query(`UPDATE resource_requests SET status = CASE WHEN EXISTS (SELECT 1 FROM request_answers WHERE request_id = $1 AND helpful) THEN 'fulfilled' ELSE 'open' END WHERE id = $1 AND status IN ('open','fulfilled')`, [r.id]);
  if (on && ans.author_id !== req.user.id) {
    await tell(ans.author_id, { type: 'community', once: { kind: 'req_helpful', key: `${r.id}:${req.params.answerId}` },
      title: 'You helped a teacher 🙌', body: `Your resource answered "${clip(r.query, 80)}" and was marked helpful. It counts towards your Request hero badge.`, link: 'community.html#requests' });
  }
  res.json({ ok: true, helpful: on });
}));
router.post('/requests/:id/close', requireAuth, wrap('request-close', async (req, res) => {
  const { rows: [r] } = await pool.query(
    `UPDATE resource_requests SET status = CASE WHEN EXISTS (SELECT 1 FROM request_answers WHERE request_id = $1 AND helpful) THEN 'fulfilled' ELSE 'closed' END, closed_at = NOW()
      WHERE id = $1 AND requester_id = $2 AND status IN ('open','fulfilled') RETURNING status`, [req.params.id, req.user.id]);
  res.status(r ? 200 : 404).json(r ? { ok: true, status: r.status } : { error: 'Not found' });
}));

/* ══ Used in class: feedback after the lesson ═════════════════════════════ */

router.get('/feedback/pending', requireAuth, requireTeacher, wrap('feedback-pending', async (req, res) => {
  res.json({ pending: await lessons.pendingFeedback(req.user.id) });
}));
router.post('/feedback/:id', requireAuth, requireTeacher, wrap('feedback', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const r = await lessons.answerFeedback(req.user.id, req.params.id, String(req.body?.answer || ''));
  res.status(r ? 200 : 404).json(r ? { ok: true } : { error: 'Nothing to answer' });
}));

/* ══ Analytics (allow-list) and the author's choices ══════════════════════ */

router.post('/events', optionalAuth, wrap('events', async (req, res) => {
  const name = String(req.body?.event || '');
  if (!EVENTS.has(name)) return res.status(400).json({ error: 'Unknown event' });
  await track(req.user?.id, name, req.body?.publication_id, cleanProps(req.body?.props || req.body));
  res.status(204).end();
}));

router.get('/prefs', requireAuth, wrap('prefs', async (req, res) => { res.json({ prefs: await prefsOf(req.user.id) }); }));
router.put('/prefs', requireAuth, wrap('prefs-save', async (req, res) => {
  const cur = await prefsOf(req.user.id);
  const next = {
    digest: ['weekly', 'off'].includes(req.body?.digest) ? req.body.digest : cur.digest,
    email_digest: typeof req.body?.email_digest === 'boolean' ? req.body.email_digest : cur.email_digest,
    email_requests: typeof req.body?.email_requests === 'boolean' ? req.body.email_requests : cur.email_requests,
  };
  await pool.query(
    `INSERT INTO community_prefs (user_id, digest, email_digest, email_requests) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id) DO UPDATE SET digest = EXCLUDED.digest, email_digest = EXCLUDED.email_digest, email_requests = EXCLUDED.email_requests, updated_at = NOW()`,
    [req.user.id, next.digest, next.email_digest, next.email_requests]);
  res.json({ ok: true, prefs: next });
}));

/* GET /digest?days=7 - this week on my resources, live (the same numbers the weekly
   notification is made from). Empty = nothing happened, so nothing is said. */
const { buildDigest } = require('../lib/communityDigest');
router.get('/digest', requireAuth, wrap('digest', async (req, res) => {
  const d = await buildDigest(req.user.id, Math.min(30, Math.max(1, Number(req.query.days) || 7)));
  if (req.query.opened === '1') track(req.user.id, 'digest_opened', null, {});
  res.json({ digest: d });
}));

/* ══ Recommendations that say why ═════════════════════════════════════════ */

const KIND_NOUN = { board: 'lessons', lesson: 'studio lessons', quiz: 'quizzes', game: 'games', material: 'studio work', other: 'templates' };

/* the teacher steers: "Not relevant" hides that item, "Show fewer like this" that
   kind and skill */
router.post('/signals', requireAuth, wrap('signal', async (req, res) => {
  if (!isId(req.body?.assignmentId) || !['not_relevant', 'fewer_like_this'].includes(req.body?.kind)) return res.status(400).json({ error: 'Bad request' });
  if (req.body.undo) await pool.query('DELETE FROM community_signals WHERE user_id = $1 AND assignment_id = $2 AND kind = $3', [req.user.id, req.body.assignmentId, req.body.kind]);
  else await pool.query('INSERT INTO community_signals (user_id, assignment_id, kind) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [req.user.id, req.body.assignmentId, req.body.kind]);
  if (!req.body.undo) track(req.user.id, 'recommendation_hidden', req.body.assignmentId, { recommendation_reason: clip(req.body.reason, 32) });
  res.json({ ok: true });
}));

/* GET /recommendations - sections, each with its reason. Only product actions and the
   learning settings the teacher gave (levels of their students, what they saved
   and used) - nothing sensitive. A section with too little behind it is not shown. */
router.get('/recommendations', requireAuth, requireTeacher, wrap('recs', async (req, res) => {
  const me = req.user.id;
  const MIN_SECTION = 3;
  const base = `SELECT ${cardSelect('$1')} FROM assignments a JOIN users u ON u.id = a.user_id`;
  const notMine = `a.user_id <> $1 AND NOT EXISTS (SELECT 1 FROM library_copies c WHERE c.assignment_id = a.id AND c.user_id = $1 AND c.undone_at IS NULL)`;
  const steer = `AND NOT EXISTS (SELECT 1 FROM community_signals s WHERE s.user_id = $1 AND s.assignment_id = a.id AND s.kind = 'not_relevant')
    AND NOT EXISTS (SELECT 1 FROM community_signals s JOIN assignments b ON b.id = s.assignment_id
                     WHERE s.user_id = $1 AND s.kind = 'fewer_like_this' AND b.kind = a.kind AND b.skill = a.skill)`;
  const sections = [];

  // 1. what real classes use (a window of real activity, or nothing)
  {
    const { rows } = await pool.query(
      `${base} WHERE ${RECOMMENDABLE_SQL} AND ${notMine} ${steer}
         AND (SELECT COUNT(*) FROM verified_uses vu WHERE vu.assignment_id = a.id AND vu.created_at > NOW() - INTERVAL '30 days') >= 2
       ORDER BY (SELECT COUNT(*) FROM verified_uses vu WHERE vu.assignment_id = a.id AND vu.created_at > NOW() - INTERVAL '30 days') DESC LIMIT 8`, [me]);
    if (rows.length >= MIN_SECTION) sections.push({ key: 'popular_in_classes', title: 'Popular in real classes', why: 'Ranked by how often teachers actually used it in lessons this month - not by previews.', items: shapeRows(rows) });
  }
  // 2. the levels of the students the teacher teaches
  {
    const { rows: lv } = await pool.query(
      `SELECT level, COUNT(*)::int AS n FROM student_journal WHERE teacher_id = $1 AND level ~ '^[ABC][12]$' GROUP BY level ORDER BY n DESC LIMIT 2`, [me]);
    if (lv.length) {
      const levels = lv.map(l => l.level);
      const { rows } = await pool.query(
        `${base} WHERE ${RECOMMENDABLE_SQL} AND ${notMine} ${steer} AND a.level = ANY($2::text[])
         ORDER BY (SELECT COUNT(*) FROM verified_uses vu WHERE vu.assignment_id = a.id) DESC,
                  (SELECT COUNT(DISTINCT c.user_id) FROM library_copies c WHERE c.assignment_id = a.id) DESC, a.published_at DESC LIMIT 8`, [me, levels]);
      if (rows.length >= MIN_SECTION) sections.push({ key: 'your_students', title: `Because you teach ${levels.join(' and ')}`, why: `Based on the levels of the students in your journal (${levels.join(', ')}).`, items: shapeRows(rows) });
    }
  }
  // 3. more like what the teacher saved or copied
  {
    const { rows: liked } = await pool.query(
      `SELECT a.kind, a.skill, COUNT(*)::int AS n FROM (
          SELECT assignment_id FROM library_saves WHERE user_id = $1 UNION ALL
          SELECT assignment_id FROM library_copies WHERE user_id = $1 AND undone_at IS NULL AND assignment_id IS NOT NULL) x
        JOIN assignments a ON a.id = x.assignment_id GROUP BY a.kind, a.skill ORDER BY n DESC LIMIT 1`, [me]);
    if (liked[0]) {
      const { rows } = await pool.query(
        `${base} WHERE ${RECOMMENDABLE_SQL} AND ${notMine} ${steer} AND a.kind = $2 AND ($3 = '' OR a.skill = $3)
           AND NOT EXISTS (SELECT 1 FROM library_saves sv WHERE sv.assignment_id = a.id AND sv.user_id = $1)
         ORDER BY a.published_at DESC LIMIT 8`, [me, liked[0].kind, liked[0].skill || '']);
      if (rows.length >= MIN_SECTION) sections.push({ key: 'like_saved', title: `More like your saved ${KIND_NOUN[liked[0].kind] || 'items'}`, why: `Based on the ${KIND_NOUN[liked[0].kind] || 'items'}${liked[0].skill ? ' for ' + liked[0].skill.toLowerCase() : ''} you saved or copied.`, items: shapeRows(rows) });
    }
  }
  // 4. new from the curators you follow
  {
    const { rows } = await pool.query(
      `${base} WHERE ${CATALOG_SQL} AND a.user_id IN (SELECT curator_id FROM curator_follows WHERE follower_id = $1) AND a.published_at > NOW() - INTERVAL '30 days' ${steer}
       ORDER BY a.published_at DESC LIMIT 8`, [me]);
    if (rows.length) sections.push({ key: 'followed', title: 'New from teachers you follow', why: 'Published in the last 30 days by curators you follow.', items: shapeRows(rows) });
  }
  // 5. the team's picks - a human choice, labelled as such
  {
    const { rows } = await pool.query(`${base} WHERE ${RECOMMENDABLE_SQL} AND a.editorial AND a.user_id <> $1 ${steer} ORDER BY a.published_at DESC LIMIT 8`, [me]);
    if (rows.length) sections.push({ key: 'editors_pick', title: 'Editor\'s picks', why: 'Chosen by the TeachEd team - a person\'s choice, not an algorithm.', items: shapeRows(rows) });
  }
  res.json({ sections });
}));

/* ══ Appeals and the review team ══════════════════════════════════════════ */

/* POST /appeals {assignmentId, message, evidence} - one per decision, within 7 days */
router.post('/appeals', requireAuth, requireTeacher, wrap('appeal', async (req, res) => {
  if (!isId(req.body?.assignmentId)) return res.status(400).json({ error: 'Bad request' });
  const message = clip(req.body?.message, 2000);
  if (message.length < 10) return res.status(400).json({ error: 'Tell the team, in a few words, why the decision should change' });
  const { rows: [c] } = await pool.query(
    `SELECT c.*, a.title FROM moderation_cases c JOIN assignments a ON a.id = c.assignment_id
      WHERE c.assignment_id = $1 AND a.user_id = $2 ORDER BY c.opened_at DESC LIMIT 1`, [req.body.assignmentId, req.user.id]);
  if (!c) return res.status(404).json({ error: 'Nothing to appeal' });
  if (!mod.appealOpen(c)) return res.status(409).json({ error: c.status !== 'resolved' ? 'There is no decision to appeal yet.' : 'The time to appeal this decision (7 days) has passed.' });
  const { rowCount } = await pool.query(
    'INSERT INTO moderation_appeals (case_id, author_id, message, evidence) VALUES ($1,$2,$3,$4) ON CONFLICT (case_id) DO NOTHING',
    [c.id, req.user.id, message, clip(req.body?.evidence, 1000)]);
  if (!rowCount) return res.status(409).json({ error: 'You already appealed this decision.' });
  track(req.user.id, 'appeal_submitted', c.assignment_id, { category: c.decision });
  res.status(201).json({ ok: true });
}));

const staff = [requireAuth, requireAdmin];

/* GET /admin/queue?status=open|resolved|appeals */
router.get('/admin/queue', ...staff, wrap('queue', async (req, res) => {
  const which = req.query.status === 'resolved' ? 'resolved' : req.query.status === 'appeals' ? 'appeals' : 'open';
  const where = which === 'appeals' ? `ap.status = 'pending'` : which === 'resolved' ? `c.status = 'resolved'` : `c.status <> 'resolved'`;
  const { rows } = await pool.query(
    `SELECT c.id, c.assignment_id, c.status, c.risk_level, c.decision, c.decision_note, c.required_changes, c.opened_at, c.decided_at, c.resubmitted_at, c.version_no,
            c.snapshot->>'title' AS title, c.snapshot->>'author_name' AS author_name, c.author_id,
            a.version_no AS current_version, a.moderation_state, a.visibility,
            ap.id AS appeal_id, ap.status AS appeal_status, ap.message AS appeal_message, ap.evidence AS appeal_evidence, ap.created_at AS appeal_at,
            ((SELECT COUNT(*) FROM library_reports r WHERE r.case_id = c.id) + (SELECT COUNT(*) FROM public_reports g WHERE g.case_id = c.id))::int AS reports,
            (SELECT COUNT(*) FROM library_reports r WHERE r.case_id = c.id AND r.counts)::int AS counted,
            (SELECT COALESCE(jsonb_agg(x.j ORDER BY x.at), '[]'::jsonb) FROM (
               SELECT r.created_at AS at, jsonb_build_object('category', r.reason, 'severity', r.severity, 'note', r.note, 'counts', r.counts, 'at', r.created_at) AS j
                 FROM library_reports r WHERE r.case_id = c.id
               UNION ALL
               SELECT g.created_at, jsonb_build_object('category', g.reason, 'severity', 'normal', 'note', g.note, 'counts', FALSE, 'at', g.created_at, 'guest', TRUE)
                 FROM public_reports g WHERE g.case_id = c.id) x) AS report_list
       FROM moderation_cases c LEFT JOIN assignments a ON a.id = c.assignment_id LEFT JOIN moderation_appeals ap ON ap.case_id = c.id
      WHERE ${where}
      ORDER BY (c.risk_level = 'critical') DESC, (c.resubmitted_at IS NOT NULL) DESC, c.opened_at ASC LIMIT 100`);
  // moderators see categories and comments, never who reported
  res.json({ cases: rows, categories: mod.CATEGORIES });
}));

router.get('/admin/cases/:id', ...staff, wrap('case', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const { rows: [c] } = await pool.query('SELECT * FROM moderation_cases WHERE id = $1', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const { rows: reports } = await pool.query(
    `SELECT reason AS category, severity, note, counts, created_at FROM library_reports WHERE case_id = $1
     UNION ALL SELECT reason, 'normal', note, FALSE, created_at FROM public_reports WHERE case_id = $1 ORDER BY created_at`, [c.id]);
  const { rows: history } = await pool.query(
    `SELECT id, status, decision, decision_note, opened_at, decided_at, version_no FROM moderation_cases WHERE assignment_id = $1 AND id <> $2 ORDER BY opened_at DESC LIMIT 10`, [c.assignment_id, c.id]);
  const { rows: versions } = await pool.query('SELECT version_no, title, created_at FROM publication_versions WHERE assignment_id = $1 ORDER BY version_no DESC', [c.assignment_id]);
  const { rows: [appeal] } = await pool.query('SELECT id, message, evidence, status, resolution_note, created_at FROM moderation_appeals WHERE case_id = $1', [c.id]);
  if (c.status === 'open') await pool.query(`UPDATE moderation_cases SET status = 'in_review' WHERE id = $1`, [c.id]);
  res.json({ case: c, reports, history, versions, appeal: appeal || null });
}));

/* POST /admin/cases/:id/decide {decision, note, required_changes, restrict_author} */
router.post('/admin/cases/:id/decide', ...staff, wrap('decide', async (req, res) => {
  const decision = String(req.body?.decision || '');
  if (!mod.DECISIONS.has(decision)) return res.status(400).json({ error: 'Choose No violation, Needs changes or Remove' });
  const note = clip(req.body?.note, 1500);
  if (decision !== 'no_violation' && note.length < 5) return res.status(400).json({ error: 'Tell the author what is wrong - they see this' });
  const { rows: [c] } = await pool.query('SELECT * FROM moderation_cases WHERE id = $1', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const effect = mod.applyDecision(decision);
  await pool.query(
    `UPDATE moderation_cases SET status = 'resolved', decision = $2, decision_note = $3, required_changes = $4, decided_at = NOW(), decided_by = $5,
            appeal_until = CASE WHEN $7::boolean THEN NULL ELSE NOW() + ($6 || ' days')::interval END WHERE id = $1`,
    [c.id, decision, note, clip(req.body?.required_changes, 1500), req.user.id, String(mod.LIMITS.appealDays), decision === 'no_violation']);
  if (c.assignment_id) {
    await pool.query(`UPDATE assignments SET moderation_state = $2, hidden_at = CASE WHEN $3 THEN COALESCE(hidden_at, NOW()) ELSE NULL END WHERE id = $1`, [c.assignment_id, effect.state, effect.hidden]);
  }
  // the reports are judged: reporters whose reports keep being dismissed lose weight
  await pool.query(`UPDATE library_reports SET outcome = $2 WHERE case_id = $1`, [c.id, decision === 'no_violation' ? 'rejected' : 'upheld']);
  if (decision === 'remove' && req.body?.restrict_author && c.author_id) await pool.query('UPDATE users SET community_publish_blocked = TRUE WHERE id = $1', [c.author_id]);
  if (c.author_id) {
    const title = clip(c.snapshot?.title, 80);
    const label = { no_violation: 'is back in Community', needs_changes: 'needs changes', remove: 'was removed from Community' }[decision];
    await tell(c.author_id, { type: 'community', email: 'always', once: { kind: 'decision', key: `${c.id}:${decision}` },
      title: `"${title}" ${label}`,
      body: decision === 'no_violation' ? 'We looked at the reports and found no violation. It is fully visible again.'
        : `${note}${req.body?.required_changes ? ` To restore it: ${clip(req.body.required_changes, 300)}` : ''} You can edit and republish it${decision === 'remove' ? '' : ' for review'}, or appeal the decision within ${mod.LIMITS.appealDays} days.`,
      link: 'community.html#publications',
      mail: { subject: `Your Community resource ${label}`, paragraphs: decision === 'no_violation'
          ? [`We reviewed the reports about "${title}" and found no violation. It is fully visible again.`]
          : [`Decision on "${title}": ${decision === 'remove' ? 'removed' : 'needs changes'}.`, note, ...(req.body?.required_changes ? [`What to change: ${req.body.required_changes}`] : []),
             `Teachers who already copied it keep their copies. You can appeal within ${mod.LIMITS.appealDays} days in My publications.`],
        button: { href: 'community.html#publications', label: 'Open My publications' } } });
  }
  res.json({ ok: true, state: effect.state });
}));

router.post('/admin/appeals/:id/resolve', ...staff, wrap('appeal-resolve', async (req, res) => {
  const outcome = req.body?.outcome === 'overturned' ? 'overturned' : req.body?.outcome === 'upheld' ? 'upheld' : null;
  if (!outcome) return res.status(400).json({ error: 'Upheld or overturned' });
  const { rows: [ap] } = await pool.query(
    `SELECT ap.*, c.assignment_id, c.decided_by, c.snapshot->>'title' AS title FROM moderation_appeals ap JOIN moderation_cases c ON c.id = ap.case_id WHERE ap.id = $1`, [req.params.id]);
  if (!ap || ap.status !== 'pending') return res.status(404).json({ error: 'Not found' });
  // "reviewed by another moderator, if there is one"
  const { rows: [{ n }] } = await pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND NOT is_suspended`);
  if (n > 1 && String(ap.decided_by) === String(req.user.id)) return res.status(409).json({ error: 'Another moderator should review this appeal - you made the decision.' });
  const note = clip(req.body?.note, 1000);
  await pool.query(`UPDATE moderation_appeals SET status = $2, resolution_note = $3, resolved_at = NOW(), resolved_by = $4 WHERE id = $1`, [ap.id, outcome, note, req.user.id]);
  if (outcome === 'overturned' && ap.assignment_id) {
    await pool.query(`UPDATE assignments SET moderation_state = 'published', hidden_at = NULL WHERE id = $1`, [ap.assignment_id]);
    await pool.query(`UPDATE library_reports SET outcome = 'rejected' WHERE case_id = $1`, [ap.case_id]);
  }
  await tell(ap.author_id, { type: 'community', email: 'always', title: `Appeal ${outcome === 'overturned' ? 'accepted' : 'decided'}: "${clip(ap.title, 80)}"`,
    body: outcome === 'overturned' ? 'The decision was reversed. It is back in Community.' : `The decision stands. ${note}`, link: 'community.html#publications',
    mail: { subject: 'Your appeal was reviewed', paragraphs: [outcome === 'overturned' ? `The decision about "${ap.title}" was reversed - it is back in Community.` : `We reviewed your appeal about "${ap.title}". The decision stands.`, note].filter(Boolean),
      button: { href: 'community.html#publications', label: 'Open My publications' } } });
  res.json({ ok: true });
}));

/* team and editorial flags: a person's choice, never automatic */
router.post('/admin/team/:userId', ...staff, wrap('team', async (req, res) => {
  if (!isId(req.params.userId)) return res.status(404).json({ error: 'Not found' });
  await pool.query('UPDATE users SET community_team = $2 WHERE id = $1', [req.params.userId, req.body?.on !== false]);
  res.json({ ok: true });
}));
router.post('/admin/editorial/:kind/:id', ...staff, wrap('editorial', async (req, res) => {
  if (!isId(req.params.id) || !['publication', 'collection'].includes(req.params.kind)) return res.status(404).json({ error: 'Not found' });
  const table = req.params.kind === 'collection' ? 'collections' : 'assignments';
  await pool.query(`UPDATE ${table} SET editorial = $2 WHERE id = $1`, [req.params.id, req.body?.on !== false]);
  res.json({ ok: true });
}));
router.get('/admin/overview', ...staff, wrap('overview', async (req, res) => {
  const { rows: [o] } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM moderation_cases WHERE status <> 'resolved')::int AS open_cases,
            (SELECT COUNT(*) FROM moderation_cases WHERE status <> 'resolved' AND risk_level = 'critical')::int AS critical,
            (SELECT COUNT(*) FROM moderation_appeals WHERE status = 'pending')::int AS appeals,
            (SELECT EXTRACT(EPOCH FROM (NOW() - MIN(opened_at))) / 3600 FROM moderation_cases WHERE status <> 'resolved') AS oldest_hours`);
  res.json({ overview: o });
}));

module.exports = router;
module.exports.addToCollection = addToCollection;
