/* TeachEd memory (ТЗ «Память TeachEd», 17.10.2026, part 1).

   The server is the source of truth for the teacher's style and for each
   student's dossier; the browser keeps a cache and an offline queue
   (scripts/teached-memory.js) and syncs in the background.

   A dossier belongs to one teacher and one journal row (student_journal.id):
   a student added by email who has no account yet has a dossier too.

   Merge rules:
   - text fields: last writer wins PER FIELD, by the field's own time. The time
     comes from the client (offline edits are legal) but a time more than five
     minutes in the future is replaced by the server's - a device with a wrong
     clock must not freeze a field for every other device.
   - common_mistakes: merged by `pattern` - count and last_seen take the max,
     first_seen the min, examples the union (the five latest).
   - deleted_tag_keys: tombstones ("tag|source_id"), a union; a tag in it never
     comes back into weak_spot_tags, from any device.

   Privacy: only the owning teacher; a student account, someone else's journal
   row or a missing dossier all answer the same 404. Field values are never
   logged. */
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

const LIMITS = { text: 20000, patterns: 200, examples: 5, tags: 300, styleBytes: 20 * 1024, tombstones: 2000 };
const TEXT_FIELDS = { interests: 'interests_updated_at', weak_spots: 'weak_spots_updated_at', goals: 'goals_updated_at', notes: 'notes_updated_at' };
const PAGE = 200;
const SKEW_MS = 5 * 60 * 1000;
const OVERLAP_MS = 10 * 1000;   // a sync cursor reads 10s back: a slow commit never slips past it

class MemErr extends Error { constructor(status, code, message, extra) { super(message); Object.assign(this, { status, code, extra }); } }
const fail = (res, e) => {
  if (e instanceof MemErr) return res.status(e.status).json({ error: { code: e.code, message: e.message }, ...(e.extra || {}) });
  console.error('[memory]', e.message);
  return res.status(500).json({ error: { code: 'server', message: 'Server error' } });
};
const notFound = () => new MemErr(404, 'not_found', 'Not found');
const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

/* students never reach any of this - not even to learn that it exists */
router.use((req, res, next) => (req.user.role === 'student' ? fail(res, notFound()) : next()));

/* a client's field time: valid, and never more than five minutes ahead of the server */
function clampTime(value, now = Date.now()) {
  const t = Date.parse(value);
  if (!Number.isFinite(t) || t > now + SKEW_MS) return new Date(now);
  return new Date(t);
}

/* ── array merges ── */
function cleanMistakes(list) {
  if (!Array.isArray(list)) throw new MemErr(422, 'validation', 'common_mistakes must be a list');
  const out = [];
  for (const m of list) {
    const pattern = String((m && m.pattern) || '').trim().slice(0, 200);
    if (!pattern) continue;
    const examples = (Array.isArray(m.examples) ? m.examples : []).map(x => String(x).slice(0, 500)).filter(Boolean);
    const at = v => (Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null);
    out.push({ pattern, examples, first_seen: at(m.first_seen), last_seen: at(m.last_seen), count: Math.max(1, Math.floor(Number(m.count) || 1)) });
  }
  return out;
}
function mergeMistakes(a, b) {
  const by = new Map();
  const minT = (x, y) => (!x ? y : !y ? x : x < y ? x : y);
  const maxT = (x, y) => (!x ? y : !y ? x : x > y ? x : y);
  for (const m of [...(a || []), ...(b || [])]) {
    const k = m.pattern.toLowerCase();
    const was = by.get(k);
    if (!was) { by.set(k, { ...m, examples: [...new Set(m.examples || [])] }); continue; }
    by.set(k, {
      pattern: was.pattern,
      count: Math.max(was.count || 1, m.count || 1),
      first_seen: minT(was.first_seen, m.first_seen),
      last_seen: maxT(was.last_seen, m.last_seen),
      // the newest examples win the five places: the later list's go first
      examples: [...new Set([...(m.examples || []), ...(was.examples || [])])],
    });
  }
  return [...by.values()].map(m => ({ ...m, examples: m.examples.slice(0, LIMITS.examples) }));
}
const tagKey = t => `${t.tag}|${t.source_id == null ? '' : t.source_id}`;
function mergeTags(a, b, tombstones) {
  const dead = new Set(tombstones || []);
  const by = new Map();
  for (const t of [...(a || []), ...(b || [])]) { const k = tagKey(t); if (!dead.has(k) && !by.has(k)) by.set(k, t); }
  return [...by.values()];
}

/* ── ownership ── */
async function ownedJournal(db, teacherId, journalId) {
  if (!isUuid(journalId)) throw notFound();
  const { rows } = await db.query('SELECT id FROM student_journal WHERE id = $1 AND teacher_id = $2', [journalId, teacherId]);
  if (!rows.length) throw notFound();
}

const DOSSIER_COLS = `journal_id AS student_id, interests, interests_updated_at, weak_spots, weak_spots_updated_at,
  common_mistakes, mistakes_updated_at, goals, goals_updated_at, notes, notes_updated_at,
  weak_spot_tags, deleted_tag_keys, tags_updated_at, version, updated_at`;

/* ── teacher memory ── */
router.get('/teacher', async (req, res) => {
  try {
    const { rows: [m] } = await pool.query(
      `SELECT COALESCE(t.style, '{}') AS style, t.style_updated_at, COALESCE(t.version, 0) AS version, NOW() AS server_time
         FROM (SELECT 1) one LEFT JOIN teacher_memory t ON t.teacher_id = $1`, [req.user.id]);
    res.json({ ...m, version: Number(m.version) });
  } catch (e) { fail(res, e); }
});

router.put('/teacher', async (req, res) => {
  const { style, base_version } = req.body || {};
  try {
    if (!style || typeof style !== 'object' || Array.isArray(style)) throw new MemErr(422, 'validation', 'style must be an object');
    if (Buffer.byteLength(JSON.stringify(style)) > LIMITS.styleBytes) throw new MemErr(413, 'payload_too_large', 'Teaching style is too long');
    const base = Number(base_version) || 0;
    // the first save creates the row (base 0); later ones must name the version they edited
    const { rows: [m] } = await pool.query(
      `INSERT INTO teacher_memory (teacher_id, style) SELECT $1, $2
        WHERE $3 = 0 AND NOT EXISTS (SELECT 1 FROM teacher_memory WHERE teacher_id = $1)
       ON CONFLICT (teacher_id) DO NOTHING
       RETURNING version, NOW() AS server_time`, [req.user.id, style, base]);
    if (m) return res.json({ ...m, version: Number(m.version) });
    const { rows: [u] } = await pool.query(
      `UPDATE teacher_memory SET style = $2, style_updated_at = NOW(), version = version + 1, updated_at = NOW()
        WHERE teacher_id = $1 AND version = $3 RETURNING version, NOW() AS server_time`, [req.user.id, style, base]);
    if (u) return res.json({ ...u, version: Number(u.version) });
    const { rows: [server] } = await pool.query('SELECT style, style_updated_at, version FROM teacher_memory WHERE teacher_id = $1', [req.user.id]);
    throw new MemErr(409, 'version_conflict', 'Your teaching style changed on another device', { server: server || { style: {}, style_updated_at: null, version: 0 } });
  } catch (e) { fail(res, e); }
});

/* ── one dossier ── */
router.get('/students/:id/dossier', async (req, res) => {
  try {
    await ownedJournal(pool, req.user.id, req.params.id);
    const { rows: [d] } = await pool.query(`SELECT ${DOSSIER_COLS}, NOW() AS server_time FROM student_dossier WHERE journal_id = $1 AND teacher_id = $2 AND archived_at IS NULL`, [req.params.id, req.user.id]);
    if (!d) throw notFound();
    res.json(d);
  } catch (e) { fail(res, e); }
});

/* PATCH = upsert: field edits with the client's times. Idempotent - sending the
   same edit again from the offline queue changes nothing. */
router.patch('/students/:id/dossier', async (req, res) => {
  const fields = (req.body && req.body.fields) || {};
  const client = await pool.connect();
  try {
    if (typeof fields !== 'object' || Array.isArray(fields)) throw new MemErr(422, 'validation', 'fields must be an object');
    const known = [...Object.keys(TEXT_FIELDS), 'common_mistakes', 'deleted_tag_keys'];
    const unknown = Object.keys(fields).filter(k => !known.includes(k));
    if (unknown.length) throw new MemErr(422, 'validation', `Unknown field: ${unknown[0]}`);
    for (const k of Object.keys(TEXT_FIELDS)) {
      if (fields[k] && String(fields[k].value ?? '').length > LIMITS.text) throw new MemErr(413, 'payload_too_large', `${k} is too long`);
    }
    await client.query('BEGIN');
    await ownedJournal(client, req.user.id, req.params.id);
    await client.query(`INSERT INTO student_dossier (journal_id, teacher_id) VALUES ($1, $2) ON CONFLICT (journal_id) DO NOTHING`, [req.params.id, req.user.id]);
    const { rows: [d] } = await client.query(`SELECT * FROM student_dossier WHERE journal_id = $1 AND teacher_id = $2 FOR UPDATE`, [req.params.id, req.user.id]);
    if (!d || d.archived_at) throw notFound();

    const now = Date.now();
    const sets = [], vals = [req.params.id], applied = [], rejected = [];
    const put = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    for (const [k, tsCol] of Object.entries(TEXT_FIELDS)) {
      if (!fields[k]) continue;
      const at = clampTime(fields[k].updated_at, now);
      const value = String(fields[k].value ?? '');
      if (at > new Date(d[tsCol])) { put(k, value); put(tsCol, at); applied.push(k); }
      else if (value === d[k]) applied.push(k);       // the same edit again: nothing to do
      else rejected.push({ field: k, server_value: d[k], server_updated_at: d[tsCol] });
    }
    if (fields.common_mistakes) {
      const merged = mergeMistakes(d.common_mistakes, cleanMistakes(fields.common_mistakes.value));
      if (merged.length > LIMITS.patterns) throw new MemErr(413, 'payload_too_large', 'Too many mistake patterns');
      const at = clampTime(fields.common_mistakes.updated_at, now);
      if (JSON.stringify(merged) !== JSON.stringify(d.common_mistakes)) {
        put('common_mistakes', JSON.stringify(merged));
        put('mistakes_updated_at', at > new Date(d.mistakes_updated_at) ? at : new Date(d.mistakes_updated_at));
      }
      applied.push('common_mistakes');
    }
    if (fields.deleted_tag_keys) {
      const keys = fields.deleted_tag_keys.value;
      if (!Array.isArray(keys)) throw new MemErr(422, 'validation', 'deleted_tag_keys must be a list');
      const dead = [...new Set([...(d.deleted_tag_keys || []), ...keys.map(k => String(k).slice(0, 300))])];
      if (dead.length > LIMITS.tombstones) throw new MemErr(413, 'payload_too_large', 'Too many removed tags');
      if (dead.length !== (d.deleted_tag_keys || []).length) {
        put('deleted_tag_keys', JSON.stringify(dead));
        put('weak_spot_tags', JSON.stringify(mergeTags(d.weak_spot_tags, [], dead)));
        put('tags_updated_at', new Date(now));
      }
      applied.push('deleted_tag_keys');
    }
    let version = Number(d.version);
    if (sets.length) {
      const { rows: [u] } = await client.query(
        `UPDATE student_dossier SET ${sets.join(', ')}, version = version + 1, updated_at = NOW() WHERE journal_id = $1 RETURNING version`, vals);
      version = Number(u.version);
    }
    const { rows: [t] } = await client.query('SELECT NOW() AS server_time');
    await client.query('COMMIT');
    res.json({ applied, rejected, version, server_time: t.server_time });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    fail(res, e);
  } finally { client.release(); }
});

/* ── sync: everything that changed since the cursor, page by page ──
   since: absent = everything (first sign-in, an empty cache). next_since is
   opaque ("<time>|<journal id>"), the client passes it back as is. */
router.get('/sync', async (req, res) => {
  try {
    const raw = String(req.query.since || '');
    let since = null, afterId = null;
    if (raw) {
      const [ts, id] = raw.split('|');
      const t = Date.parse(ts);
      if (!Number.isFinite(t)) throw new MemErr(422, 'validation', 'since must be a time');
      // the page cursor keeps Postgres's microseconds: a JS Date would cut them and repeat a page forever
      if (id && isUuid(id)) { since = ts; afterId = id; }
      else since = new Date(t - OVERLAP_MS);
    }
    const { rows: [{ server_time }] } = await pool.query('SELECT NOW() AS server_time');
    const params = [req.user.id];
    let where = '';
    if (since && afterId) { params.push(since, afterId); where = `AND (d.updated_at, d.journal_id) > ($2::timestamptz, $3::uuid)`; }
    else if (since) { params.push(since); where = 'AND d.updated_at >= $2'; }
    const { rows } = await pool.query(
      `SELECT ${DOSSIER_COLS.replace(/(^|,\s*)(\w+)/g, '$1d.$2')},
              to_char(d.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at
         FROM student_dossier d JOIN student_journal j ON j.id = d.journal_id AND j.teacher_id = d.teacher_id
        WHERE d.teacher_id = $1 AND d.archived_at IS NULL ${where}
        ORDER BY d.updated_at, d.journal_id LIMIT ${PAGE + 1}`, params);
    const hasMore = rows.length > PAGE;
    const page = rows.slice(0, PAGE);
    // dossiers the teacher no longer holds: the journal row is gone, or archived (part 3)
    const { rows: gone } = await pool.query(
      `SELECT d.journal_id FROM student_dossier d
         LEFT JOIN student_journal j ON j.id = d.journal_id AND j.teacher_id = d.teacher_id
        WHERE d.teacher_id = $1 AND (j.id IS NULL OR d.archived_at IS NOT NULL)`, [req.user.id]);
    let teacher = null;
    const { rows: [m] } = await pool.query('SELECT style, style_updated_at, version, updated_at FROM teacher_memory WHERE teacher_id = $1', [req.user.id]);
    // the teacher's style rides on the first page of a sync only
    if (m && !afterId && (!since || m.updated_at >= since)) teacher = { style: m.style, style_updated_at: m.style_updated_at, version: Number(m.version) };
    const last = page[page.length - 1];
    res.json({
      teacher_memory: teacher,
      dossiers: page.map(({ cursor_at, ...d }) => ({ ...d, version: Number(d.version) })),
      revoked: gone.map(r => r.journal_id),
      has_more: hasMore,
      next_since: hasMore ? `${last.cursor_at}|${last.student_id}` : new Date(server_time).toISOString(),
      server_time,
    });
  } catch (e) { fail(res, e); }
});

module.exports = router;
module.exports._test = { clampTime, mergeMistakes, mergeTags, cleanMistakes };
