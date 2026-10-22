const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth, optionalAuth, requireTeacher } = require('../middleware/auth');

/* material - задание, собранное инструментом на доске и сохранённое само
   (окно Teaching Tools на рабочем столе). */
const KINDS = ['lesson', 'quiz', 'game', 'board', 'material', 'other'];
const COMMUNITY_SNAPSHOT_MAX_BYTES = 10 * 1024 * 1024;
const COMMUNITY_SNAPSHOT_MAX_CARDS = 1200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_VISIBILITIES = new Set(['community', 'unlisted']);
const cleanKind = k => (KINDS.includes(k) ? k : 'other');
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const cleanTags = t => {
  if (Array.isArray(t)) return t.map(x => clip(x, 40)).filter(Boolean).slice(0, 12);
  if (typeof t === 'string') return t.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12);
  return [];
};

const { cleanCover, cleanCoverImage } = require('../lib/cover');
const { detectRemix, remixBlock } = require('../lib/communityRemix');

/* Everything that must be true the moment a publication goes public: the first
   public date ("New" counts from it), version 1, who it was remixed from. */
async function onPublished(db, id, { remix, allowRemix } = {}) {
  await db.query(
    `UPDATE assignments SET first_public_at = COALESCE(first_public_at, NOW()),
            allow_remix = COALESCE($2, allow_remix)
      WHERE id = $1`, [id, typeof allowRemix === 'boolean' ? allowRemix : null]);
  // the public address (/community/resources/{slug}/) is made now, once, and kept for good
  const { rows: [pub] } = await db.query(`SELECT id, title, slug, visibility FROM assignments WHERE id = $1`, [id]);
  if (pub && pub.visibility === 'community') await require('../lib/seoPages').ensureSlug(db, pub).catch(() => {});
  await db.query(
    `INSERT INTO publication_versions (assignment_id, version_no, title)
     SELECT id, version_no, title FROM assignments WHERE id = $1 ON CONFLICT DO NOTHING`, [id]);
  // the lesson falls into the teachers' feed as a lesson card - one object with the publication (ТЗ «Удержание» §2.1)
  if (pub && pub.visibility === 'community') await require('../lib/feed').onPublished(db, id);
  if (remix) {
    const { rows: [v] } = await db.query('SELECT id FROM publication_versions WHERE assignment_id = $1 AND version_no = (SELECT version_no FROM assignments WHERE id = $1)', [remix.id]);
    await db.query(
      `UPDATE assignments SET remix_of = $2, remix_of_title = $3, remix_of_author = $4, remix_of_author_id = $5, remix_of_version_id = $6
        WHERE id = $1 AND remix_of IS NULL`,   // the line is never rewritten, let alone removed
      [id, remix.id, String(remix.title).slice(0, 255), String(remix.author_name || '').slice(0, 255), remix.user_id, remix.source_version_id || v?.id || null]);
  }
}

const { STATS_SQL, CARD_EXTRA_SQL, CATALOG_SQL, shapeStats, shapeRows, cardSelect } = require('../lib/communityCards');
const mod = require('../lib/communityModeration');
const { tell } = require('../lib/communityNotify');

function buildCommunityBoardPreview(snapshot) {
  const cards = snapshot.cards.filter(card => card && card.type !== 'frame');
  const columns = Math.max(1, Math.ceil(Math.sqrt(Math.min(cards.length, 12))));
  const validColor = value => /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? String(value) : null;
  const nodes = cards.slice(0, 12).map((card, index) => ({
    x: Number.isFinite(Number(card.x)) ? Math.round(Number(card.x)) : (index % columns) * 220,
    y: Number.isFinite(Number(card.y)) ? Math.round(Number(card.y)) : Math.floor(index / columns) * 130,
    w: Math.max(40, Math.min(1200, Math.round(Number(card.w) || 170))),
    h: Math.max(30, Math.min(900, Math.round(Number(card.h) || 96))),
    color: validColor(card.data?.color),
  }));
  const types = new Map();
  cards.forEach(card => {
    const type = clip(String(card.type || 'activity').replace(/[-_]/g, ' '), 32) || 'activity';
    types.set(type, (types.get(type) || 0) + 1);
  });
  return {
    cardCount: cards.length,
    nodes,
    types: Array.from(types.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([type, count]) => ({ type, count })),
  };
}

function normalizeCommunityBoardData(raw, title) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'A board snapshot is required to publish this lesson' };
  }
  const snapshot = raw.snapshot;
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.cards)) {
    return { error: 'A board snapshot is required to publish this lesson' };
  }
  if (snapshot.cards.length > COMMUNITY_SNAPSHOT_MAX_CARDS) {
    return { error: `A shared lesson can contain up to ${COMMUNITY_SNAPSHOT_MAX_CARDS} cards` };
  }
  const serialized = JSON.stringify(snapshot);
  if (Buffer.byteLength(serialized, 'utf8') > COMMUNITY_SNAPSHOT_MAX_BYTES) {
    return { error: 'This board snapshot is too large to publish' };
  }
  const rawDuration = Number(raw.duration);
  return {
    value: {
      snapshot_version: Math.max(1, Math.floor(Number(raw.snapshot_version) || 1)),
      source_board_id: clip(raw.source_board_id || raw.sourceBoardId, 64) || null,
      source_board_name: clip(raw.source_board_name || raw.sourceBoardName, 255) || null,
      // A non-empty frame means the author published one lesson from a board.
      // Keep it beside the source board id so list views can distinguish a
      // Lesson from a whole-board Space after a reload.
      source_frame_id: clip(raw.source_frame_id || raw.sourceFrameId, 64) || null,
      duration: Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration <= 600 ? Math.round(rawDuration) : null,
      /* Это белый список: всё, чего здесь нет, до базы не доезжает. Поля
         публикации приходится заводить и тут, иначе форма их спрашивает, а
         страница урока не получает — настройка выглядит рабочей и молча
         никуда не сохраняется.

         allowCopy пишется только когда автор явно снял галочку. Отсутствие
         поля читается на клиенте как «копировать можно», и уроки, изданные
         до его появления, остаются копируемыми. */
      language: clip(raw.language, 40) || null,
      audience: clip(raw.audience, 40) || null,
      allowCopy: raw.allowCopy === false ? false : undefined,
      cover: cleanCover(raw.cover) || undefined,
      preview: buildCommunityBoardPreview(snapshot),
      snapshot: { ...snapshot, name: clip(snapshot.name || title, 255) || 'Community lesson' },
    }
  };
}

async function assertSourceBoardOwnership(userId, data) {
  const sourceBoardId = data?.source_board_id;
  if (!sourceBoardId || !UUID_RE.test(sourceBoardId)) {
    return { status:400, error:'Select one of your boards before publishing this lesson' };
  }
  const owned = await pool.query(
    'SELECT 1 FROM boards WHERE id = $1 AND user_id = $2',
    [sourceBoardId, userId]
  );
  if (!owned.rows.length) {
    return { status:403, error:'Only the owner can publish a board snapshot to Community' };
  }
  return null;
}

// Metadata columns for list views (never ship the heavy `data`/`image` blobs in lists)
const LIST_COLS = `id, kind, title, description, level, skill, tags,
  (image IS NOT NULL) AS has_image, visibility, cloned_from, clone_count,
  published_at, created_at, updated_at, data->'meta' AS meta`;

/* Витрина сообщества и просмотр опубликованного урока доступны без входа:
   именно с них начинается знакомство с TeachEd. Всё, что ниже requireAuth,
   работает только для авторизованных. */
// ── GET /api/library/community - browse published items ─────────────────────
router.get('/community', optionalAuth, async (req, res) => {
  try {
    const { kind, level, skill, q } = req.query;
    const params = [req.user?.id || null];
    let where = CATALOG_SQL;
    if (kind && KINDS.includes(kind)) { params.push(kind);  where += ` AND a.kind = $${params.length}`; }
    if (level)                        { params.push(level);  where += ` AND a.level = $${params.length}`; }
    if (skill)                        { params.push(skill);  where += ` AND a.skill = $${params.length}`; }
    if (q && q.trim())                { params.push(`%${q.trim()}%`); where += ` AND (a.title ILIKE $${params.length} OR a.description ILIKE $${params.length})`; }
    /* A selected frame means one Lesson; an empty value means a whole-board
       Space. The camelCase fallback keeps older published records readable. */
    const { rows } = await pool.query(
      `SELECT ${cardSelect('$1')}
       FROM assignments a JOIN users u ON u.id = a.user_id
       WHERE ${where}
       ORDER BY a.published_at DESC NULLS LAST LIMIT 200`,
      params
    );
    shapeRows(rows);
    res.json({ assignments: rows });
  } catch (err) {
    console.error('[library] community error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* GET /api/library/by-board/:boardId - find the published Community listing
   for a private board, if any.

   board.html?id=<boardId> is a private edit link: /api/boards/:id 404s for
   anyone but the owner or an invited collaborator, even after the owner
   publishes that same board to Community. A teacher who shares the address-
   bar URL instead of the Community card gets a flat "Board not found" on
   every other account, although the lesson is sitting right there in the
   feed. The publish snapshot keeps source_board_id, so this looks up the
   community listing it belongs to and lets the client redirect there. */
router.get('/by-board/:boardId', optionalAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.boardId || ''))) return res.status(404).json({ error: 'Not found' });
    const { rows } = await pool.query(
      `SELECT id FROM assignments
       WHERE visibility = 'community'
         AND COALESCE(NULLIF(data->>'source_board_id', ''),
                      NULLIF(data->>'sourceBoardId', '')) = $1
       ORDER BY published_at DESC NULLS LAST LIMIT 1`,
      [req.params.boardId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ id: rows[0].id });
  } catch (err) {
    console.error('[library] by-board error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/library/:id - full item (owner, or anyone if community) ─────────
const { budgetSnapshot, fullAccess, PAID_PREVIEW_RULES, FREE_PREVIEW_RULES } = require('../lib/communityPreview');
const WITHDRAWN = new Set(['hidden', 'needs_changes', 'removed']);
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id || ''))) return res.status(404).json({ error: 'Not found' });
    // Гость видит только опубликованное; владелец — ещё и свои приватные записи.
    const viewerId = req.user?.id || null;
    const { rows } = await pool.query(
      `SELECT a.*, ($2::uuid IS NOT NULL AND a.user_id = $2) AS is_owner,
              u.name AS author_name, u.avatar AS author_avatar, u.community_team AS author_team,
              ${STATS_SQL},
              ($2::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM entitlements e WHERE e.assignment_id = a.id AND e.user_id = $2 AND e.status = 'active')) AS entitled
       FROM assignments a JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND (a.visibility IN ('community', 'unlisted') OR ($2::uuid IS NOT NULL AND a.user_id = $2))`,
      [req.params.id, viewerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const a = rows[0];
    const staff = req.user?.role === 'admin';
    /* Hidden pending a decision: a neutral screen, not the reason and not the
       content. The author and the team still see it. */
    if (!a.is_owner && !staff && (a.hidden_at || WITHDRAWN.has(a.moderation_state))) {
      return res.status(410).json({ error: 'Temporarily unavailable', unavailable: true });
    }
    a.stats = shapeStats(a);
    if (a.remix_of_author_id) {   // attribution follows the original author's current name
      const { rows: [ro] } = await pool.query('SELECT name FROM users WHERE id = $1', [a.remix_of_author_id]);
      if (ro) a.remix_of_author = ro.name;
    }
    if (!fullAccess(a, { isOwner: a.is_owner, isAdmin: staff, entitled: a.entitled })) {
      // paid and not bought: the budgeted preview, never the source
      const b = budgetSnapshot(a.data?.snapshot, { mode: a.preview_mode, itemIds: a.preview_item_ids || [] });
      a.data = { ...a.data, snapshot: b.snapshot };
      a.locked = true;
      a.preview_budget = { toc: b.toc, total: b.totalItems, shown: b.shownItems, seconds: b.seconds };
      a.preview_rules = PAID_PREVIEW_RULES;
    } else {
      a.preview_rules = FREE_PREVIEW_RULES;
    }
    delete a.entitled;
    res.json({ assignment: a });
  } catch (err) {
    console.error('[library] get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* POST /api/library/:id/track-copy - the older import path (a lesson sent to
   board.html through the browser, not made on the server).

   A copy counts once per teacher, and only after it was really made, so this
   needs a signed-in teacher and records one row; a guest, a repeat or a click
   with nothing behind it changes nothing. (It used to be public and bumped a
   counter on every call - anybody could inflate it.) */
router.post('/:id/track-copy', optionalAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id || '')) || !req.user) return res.status(204).end();
    await pool.query(
      `INSERT INTO library_copies (assignment_id, user_id, target, title, author_name, source_version_id)
       SELECT a.id, $2, 'board', a.title, u.name,
              (SELECT v.id FROM publication_versions v WHERE v.assignment_id = a.id AND v.version_no = a.version_no)
         FROM assignments a JOIN users u ON u.id = a.user_id
        WHERE a.id = $1 AND a.visibility IN ('community', 'unlisted') AND a.hidden_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM library_copies c WHERE c.assignment_id = a.id AND c.user_id = $2 AND c.undone_at IS NULL)`,
      [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    // Метрика не должна ронять поток копирования на клиенте.
    res.status(204).end();
  }
});

/* GET /api/library/:id/cover - свой снимок обложки. Публичный для
   опубликованных уроков, как и сама витрина; тело - картинка, а не JSON,
   поэтому карточка ставит его прямо в background-image и браузер кеширует. */
router.get('/:id/cover', async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id || ''))) return res.status(404).end();
    const { rows } = await pool.query(
      `SELECT image, updated_at FROM assignments
       WHERE id = $1 AND visibility IN ('community', 'unlisted') AND image IS NOT NULL`,
      [req.params.id]
    );
    const m = rows[0] && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(rows[0].image);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(m[2], 'base64'));
  } catch (err) {
    console.error('[library] cover error:', err.message);
    res.status(500).end();
  }
});

router.use(requireAuth);

// ── GET /api/library - my library (metadata only) ──────────────────────────
router.get('/', async (req, res) => {
  try {
    const { kind, q } = req.query;
    const params = [req.user.id];
    let where = 'user_id = $1';
    if (kind && KINDS.includes(kind)) { params.push(kind); where += ` AND kind = $${params.length}`; }
    if (q && q.trim())               { params.push(`%${q.trim()}%`); where += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})`; }
    const { rows } = await pool.query(
      `SELECT ${LIST_COLS} FROM assignments WHERE ${where} ORDER BY updated_at DESC LIMIT 300`,
      params
    );
    res.json({ assignments: rows });
  } catch (err) {
    console.error('[library] list error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/library - create ──────────────────────────────────────────────
router.post('/', async (req, res) => {
  const b = req.body || {};
  try {
    const kind = cleanKind(b.kind);
    const visibility = PUBLIC_VISIBILITIES.has(b.visibility) ? b.visibility : 'private';
    if (PUBLIC_VISIBILITIES.has(visibility) && (req.user.role !== 'teacher' && req.user.role !== 'admin')) {
      return res.status(403).json({ error: 'Teacher access required to publish to Community' });
    }
    if (PUBLIC_VISIBILITIES.has(visibility)) {
      const { rows: [blocked] } = await pool.query('SELECT community_publish_blocked AS b FROM users WHERE id = $1', [req.user.id]);
      if (blocked && blocked.b) return res.status(403).json({ error: 'Publishing to Community is switched off for your account after repeated violations. Contact support if you think this is a mistake.' });
    }
    let data = b.data || {};
    let remix = null;
    if (PUBLIC_VISIBILITIES.has(visibility) && kind === 'board') {
      if (clip(b.title, 255).length < 4) {
        return res.status(400).json({ error: 'Add a clear lesson title before publishing' });
      }
      if (clip(b.description, 2000).length < 20) {
        return res.status(400).json({ error: 'Add a short description of what learners will practise' });
      }
      const normalized = normalizeCommunityBoardData(data, b.title);
      if (normalized.error) return res.status(400).json({ error: normalized.error });
      data = normalized.value;
      const ownershipError = await assertSourceBoardOwnership(req.user.id, data);
      if (ownershipError) return res.status(ownershipError.status).json({ error: ownershipError.error });
      // a changed copy of somebody's lesson is a remix: attributed, and only if they allow it
      remix = await detectRemix(pool, req.user.id, data.source_board_id, data.source_frame_id);
      const blocked = remixBlock(remix, data.snapshot.cards);
      if (blocked) return res.status(blocked.status).json({ error: blocked.error });
    }
    const { rows } = await pool.query(
      /* Один и тот же параметр стоял и в позиции колонки visibility
         (VARCHAR(16)), и внутри CASE. Postgres выводит тип параметра из ВСЕХ
         его вхождений сразу, получал varchar из одного и text из другого и
         отказывался готовить запрос целиком: «inconsistent types deduced for
         parameter $10». Публикация в Community падала на этом всегда.

         Приписать `::text` внутри CASE, как было раньше, спор не решает —
         каст не отменяет вывод типа для самого параметра, он только добавляет
         ещё одно требование к нему. Ошибка оставалась ровно та же.

         Поэтому у сравнения теперь свой параметр: $10 идёт в колонку и
         выводится из неё, $11 участвует только в CASE. Каждый выводится из
         одного места, спорить не о чем. Значение одно и то же — visibility
         передаётся дважды осознанно. */
      `INSERT INTO assignments (user_id, kind, title, description, level, skill, tags, data, image, visibility, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $11 IN ('community', 'unlisted') THEN NOW() ELSE NULL END)
       RETURNING ${LIST_COLS}`,
      [
        req.user.id,
        kind,
        clip(b.title, 255) || 'Untitled',
        clip(b.description, 2000),
        clip(b.level, 20),
        clip(b.skill, 40),
        JSON.stringify(cleanTags(b.tags)),
        data,
        kind === 'board' ? cleanCoverImage(b.image) : (b.image ? String(b.image).slice(0, 2_000_000) : null),
        visibility,
        visibility,   // $11 — только для CASE, см. комментарий к запросу
      ]
    );
    if (PUBLIC_VISIBILITIES.has(visibility)) await onPublished(pool, rows[0].id, { remix, allowRemix: b.allowRemix === false ? false : (b.allowRemix === true ? true : undefined) });
    res.status(201).json({ assignment: rows[0], remix_of: remix ? { id: remix.id, title: remix.title, author: remix.author_name } : null });
  } catch (err) {
    console.error('[library] create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/library/:id - update (owner only) ────────────────────────────
router.patch('/:id', async (req, res) => {
  const b = req.body || {};
  const sets = [];
  const params = [req.params.id, req.user.id];
  const push = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
  if (b.kind !== undefined)        push('kind', cleanKind(b.kind));
  if (b.title !== undefined)       push('title', clip(b.title, 255) || 'Untitled');
  if (b.description !== undefined) push('description', clip(b.description, 2000));
  if (b.level !== undefined)       push('level', clip(b.level, 20));
  if (b.skill !== undefined)       push('skill', clip(b.skill, 40));
  if (b.tags !== undefined)        push('tags', JSON.stringify(cleanTags(b.tags)));
  if (typeof b.allowRemix === 'boolean') push('allow_remix', b.allowRemix);
  if (b.data !== undefined)        push('data', b.data || {});
  /* Обложку автор меняет и у опубликованного урока - снимок доски при этом
     не трогается, поэтому это отдельное поле, а не весь data. */
  if (b.cover !== undefined && b.data === undefined) {
    params.push(JSON.stringify(cleanCover(b.cover)));
    sets.push(`data = jsonb_set(COALESCE(data, '{}'::jsonb), '{cover}', $${params.length}::jsonb)`);
  }
  if (b.coverImage !== undefined)  push('image', cleanCoverImage(b.coverImage));
  if (b.image !== undefined && b.coverImage === undefined) push('image', b.image ? String(b.image).slice(0, 2_000_000) : null);
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  // Для ?v= у адреса обложки: новый снимок должен сменить закешированный.
  sets.push('updated_at = NOW()');
  try {
    if (b.data !== undefined || b.kind !== undefined) {
      const current = await pool.query(
        'SELECT kind, visibility FROM assignments WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]
      );
      if (!current.rows.length) return res.status(404).json({ error: 'Not found or not owner' });
      if (current.rows[0].kind === 'board' && PUBLIC_VISIBILITIES.has(current.rows[0].visibility)) {
        return res.status(409).json({ error: 'Published board lessons keep their snapshot and type. Unpublish and create a new version instead.' });
      }
    }
    const { rows } = await pool.query(
      `UPDATE assignments SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING ${LIST_COLS}`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not owner' });
    res.json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/library/:id - delete (owner only) ───────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    // a deleted resource keeps answering 410 at its public address, not 404
    await pool.query(
      `INSERT INTO public_tombstones (slug) SELECT slug FROM assignments WHERE id = $1 AND user_id = $2 AND slug IS NOT NULL
       ON CONFLICT (slug) DO NOTHING`, [req.params.id, req.user.id]).catch(() => {});
    const { rowCount } = await pool.query(
      'DELETE FROM assignments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/library/:id/publish - share to community ──────────────────────
router.post('/:id/publish', requireTeacher, async (req, res) => {
  try {
    const source = await pool.query(
      'SELECT kind, data, moderation_state FROM assignments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!source.rows.length) return res.status(404).json({ error: 'Not found or not owner' });
    if (['hidden', 'needs_changes', 'removed'].includes(source.rows[0].moderation_state)) {
      return res.status(409).json({ error: 'This one is with the review team. Edit it and send an update, or appeal the decision - it cannot be republished by hand.' });
    }
    if (source.rows[0].kind === 'board') {
      const normalized = normalizeCommunityBoardData(source.rows[0].data, 'Community lesson');
      if (normalized.error) return res.status(400).json({ error: normalized.error });
      const ownershipError = await assertSourceBoardOwnership(req.user.id, normalized.value);
      if (ownershipError) return res.status(ownershipError.status).json({ error: ownershipError.error });
    }
    const { rows } = await pool.query(
      `UPDATE assignments SET visibility='community', published_at=COALESCE(published_at, NOW())
       WHERE id = $1 AND user_id = $2 RETURNING ${LIST_COLS}`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not owner' });
    await onPublished(pool, rows[0].id);
    res.json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] publish error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/library/:id/unpublish - make private again ────────────────────
router.post('/:id/unpublish', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE assignments SET visibility='private' WHERE id = $1 AND user_id = $2 RETURNING ${LIST_COLS}`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not owner' });
    res.json({ assignment: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/library/:id/clone - copy a community (or own) item to my library
router.post('/:id/clone', async (req, res) => {
  try {
    const src = await pool.query(
      `SELECT * FROM assignments WHERE id = $1 AND (user_id = $2 OR (visibility IN ('community', 'unlisted') AND hidden_at IS NULL))`,
      [req.params.id, req.user.id]
    );
    if (!src.rows.length) return res.status(404).json({ error: 'Not found' });
    const s = src.rows[0];
    if (s.user_id !== req.user.id && s.data?.allowCopy === false) return res.status(403).json({ error: 'The author does not allow copies of this lesson' });
    if (s.user_id !== req.user.id && s.access_type === 'paid') return res.status(402).json({ error: 'This is a paid resource - get the full version to copy it', code: 'PAID' });
    const { rows } = await pool.query(
      `INSERT INTO assignments (user_id, kind, title, description, level, skill, tags, data, image, cloned_from, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'private')
       RETURNING ${LIST_COLS}`,
      [req.user.id, s.kind, s.user_id === req.user.id ? clip(s.title, 250) + ' (copy)' : copyTitle({ title: s.title, author_name: (await pool.query('SELECT name FROM users WHERE id = $1', [s.user_id])).rows[0]?.name }), s.description, s.level, s.skill,
       JSON.stringify(s.tags || []), s.data || {}, s.image, s.id]
    );
    // it is one of "My copies" in Saved items; the number on the card counts unique teachers
    // who copied it, from these rows (the author's own copy of their own item is not one)
    pool.query(`INSERT INTO library_copies (assignment_id, user_id, target, title, author_name, source_version_id)
                SELECT $1, $2, 'library', $3, u.name, (SELECT v.id FROM publication_versions v WHERE v.assignment_id = $1 AND v.version_no = $5)
                  FROM users u WHERE u.id = $4`, [s.id, req.user.id, rows[0].title, s.user_id, s.version_no || 1]).catch(() => {});
    require('../lib/communityEvents').track(req.user.id, 'copy_created', s.id, { content_type: s.kind, source_surface: 'library' });
    res.status(201).json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] clone error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══ Community actions (16.10.2026): like, bookmark, copy, insert, report ══
   A copy is the copier's own - a new board, or one frame on a student's
   board. Deleting or changing the original never reaches it.

   Every number a card shows is built from these rows (lib/communityCards.js):
   unique accounts, the author excluded, an undone insert not counted. */
const { placeLesson, lessonBoard } = require('../lib/communityPlace');
const { track } = require('../lib/communityEvents');
const { normalizeCategory, isCritical, reportCounts, assess, stricter, authorStatus, reporterStatus, appealOpen, CATEGORIES, LIMITS } = mod;

async function communityItem(id, viewerId) {
  if (!UUID_RE.test(String(id || ''))) return null;
  const { rows } = await pool.query(
    `SELECT a.*, u.name AS author_name,
            ($2::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM entitlements e WHERE e.assignment_id = a.id AND e.user_id = $2 AND e.status = 'active')) AS entitled
       FROM assignments a JOIN users u ON u.id = a.user_id
      WHERE a.id = $1 AND ((a.visibility IN ('community', 'unlisted') AND a.hidden_at IS NULL) OR a.user_id = $2)`, [id, viewerId]);
  return rows[0] || null;
}
const copyTitle = (a) => {
  const t = clip(a.title, 200) || 'Community lesson';
  return a.author_name && !t.includes(`(by ${a.author_name})`) ? `${t} (by ${clip(a.author_name, 50)})` : t;
};
const likesOf = async (a) => (await pool.query('SELECT COUNT(*)::int AS n FROM library_likes WHERE assignment_id = $1 AND user_id <> $2', [a.id, a.user_id])).rows[0].n;
const currentVersionId = async (db, a) => (await db.query('SELECT id FROM publication_versions WHERE assignment_id = $1 AND version_no = $2', [a.id, a.version_no])).rows[0]?.id || null;

/* May this teacher copy it at all? The author says no, or it is paid and not bought. */
function copyBlock(a, userId) {
  if (a.user_id === userId) return null;
  if (a.data?.allowCopy === false) return { status: 403, error: 'The author does not allow copies of this lesson' };
  if (a.access_type === 'paid' && !a.entitled) return { status: 402, error: 'This is a paid resource - get the full version to copy it', code: 'PAID' };
  return null;
}

router.post('/:id/like', async (req, res) => {
  try {
    const a = await communityItem(req.params.id, req.user.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const on = req.body?.on !== false;
    if (on) await pool.query('INSERT INTO library_likes (assignment_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [a.id, req.user.id]);
    else await pool.query('DELETE FROM library_likes WHERE assignment_id = $1 AND user_id = $2', [a.id, req.user.id]);
    res.json({ ok: true, liked: on, like_count: await likesOf(a) });
  } catch (err) { console.error('[library] like:', err.message); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/bookmark', async (req, res) => {
  try {
    const a = await communityItem(req.params.id, req.user.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const on = req.body?.on !== false;
    if (on) {
      const { rowCount } = await pool.query('INSERT INTO library_saves (assignment_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [a.id, req.user.id]);
      if (rowCount) track(req.user.id, 'resource_saved', a.id, { content_type: a.kind, source_surface: clip(req.body?.surface, 24) || 'card' });
    } else await pool.query('DELETE FROM library_saves WHERE assignment_id = $1 AND user_id = $2', [a.id, req.user.id]);
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM library_saves WHERE assignment_id = $1 AND user_id <> $2', [a.id, a.user_id]);
    res.json({ ok: true, saved: on, save_count: n });
  } catch (err) { console.error('[library] bookmark:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* POST /:id/to-board {title?} - Save to My Boards: a new board of the teacher's
   own. The name is "Title (by Author)" unless they renamed it before saving. */
router.post('/:id/to-board', requireTeacher, async (req, res) => {
  try {
    const a = await communityItem(req.params.id, req.user.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const blocked = copyBlock(a, req.user.id);
    if (blocked) return res.status(blocked.status).json({ error: blocked.error, code: blocked.code });
    const snap = a.data?.snapshot;
    if (!snap?.cards?.length) return res.status(400).json({ error: 'This item has no board to copy' });
    const title = clip(req.body?.title, 255) || copyTitle(a);
    const lesson = lessonBoard(snap);
    const versionId = await currentVersionId(pool, a);
    const client = await pool.connect();
    let board, copyId;
    try {
      await client.query('BEGIN');
      ({ rows: [board] } = await client.query(
        'INSERT INTO boards (user_id, name, data) VALUES ($1,$2,$3) RETURNING id, name',
        [req.user.id, title.slice(0, 255), require('../lib/boardSanitize').sanitizeBoardData(lesson)]));
      ({ rows: [{ id: copyId }] } = await client.query(
        `INSERT INTO library_copies (assignment_id, user_id, board_id, target, title, author_name, source_version_id, card_ids)
         VALUES ($1,$2,$3,'board',$4,$5,$6,$7) RETURNING id`,
        [a.id, req.user.id, board.id, title, clip(a.author_name, 255), versionId, JSON.stringify(lesson.cards.map(c => c.id))]));
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    track(req.user.id, 'copy_created', a.id, { content_type: a.kind, source_surface: clip(req.body?.surface, 24) || 'card', board_id: board.id, version_id: versionId });
    res.status(201).json({ ok: true, board, copy_id: copyId });
  } catch (err) { console.error('[library] to-board:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* ── Insert to Student: Student → Board → Position → Confirm ──────────────
   The system never guesses a board when the choice could end in a mistake:
   one board is pre-selected and named, several must be chosen, none offers
   to create one, an unavailable one says why. */
async function studentUserId(teacherId, { studentId, journalId }) {
  if (UUID_RE.test(String(studentId || ''))) return studentId;
  if (journalId) {
    const { rows } = await pool.query('SELECT student_id FROM student_journal WHERE id::text = $1 AND teacher_id = $2', [String(journalId), teacherId]);
    return rows[0]?.student_id || null;
  }
  return null;
}

/* GET /mine/student-boards?studentId|journalId - this teacher's boards the student is on */
router.get('/mine/student-boards', requireTeacher, async (req, res) => {
  try {
    const studentId = await studentUserId(req.user.id, req.query);
    if (!studentId) return res.json({ boards: [], student: null, joined: false });
    const { rows } = await pool.query(
      `SELECT b.id, b.name, b.updated_at, bc.is_home,
              (SELECT COUNT(*) FROM board_collaborators x WHERE x.board_id = b.id AND x.user_id <> b.user_id)::int AS members
         FROM board_collaborators bc JOIN boards b ON b.id = bc.board_id
        WHERE b.user_id = $1 AND bc.user_id = $2 AND NOT b.is_practice
        ORDER BY b.updated_at DESC`, [req.user.id, studentId]);
    const { rows: [st] } = await pool.query('SELECT id, name FROM users WHERE id = $1', [studentId]);
    const boards = rows.map((b, i) => ({
      id: b.id, name: b.name, updated_at: b.updated_at,
      kind: b.members > 1 ? 'group' : (b.is_home ? 'personal' : 'individual'),
      members: b.members, last_opened: i === 0,         // the board used most recently
    }));
    res.json({ boards, student: st || null, joined: true });
  } catch (err) { console.error('[library] student-boards:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* POST /mine/student-board {studentId|journalId} - "Create board for student", then
   the teacher comes back to the same flow with the material still waiting. */
router.post('/mine/student-board', requireTeacher, async (req, res) => {
  try {
    const studentId = await studentUserId(req.user.id, req.body || {});
    if (!studentId) return res.status(409).json({ error: 'This student has not joined TeachEd yet - invite them first, then add materials.', code: 'NOT_JOINED' });
    const { rows: [st] } = await pool.query('SELECT name FROM users WHERE id = $1', [studentId]);
    const { PLAN_CATALOG, normalizePlanKey } = require('../lib/billing');
    const limit = PLAN_CATALOG[normalizePlanKey(req.user.plan)]?.limits?.boards ?? PLAN_CATALOG.free.limits.boards;
    if (limit !== -1) {
      const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM boards WHERE user_id = $1 AND NOT is_practice', [req.user.id]);
      if (n >= limit) return res.status(402).json({ error: 'Board limit reached', code: 'BOARD_LIMIT', upgrade_url: '/billing' });
    }
    const name = (clip(req.body?.name, 200) || `${String(st?.name || 'Student').split(' ')[0]} - lessons`);
    const client = await pool.connect();
    let board;
    try {
      await client.query('BEGIN');
      ({ rows: [board] } = await client.query('INSERT INTO boards (user_id, name) VALUES ($1,$2) RETURNING id, name, updated_at', [req.user.id, name.slice(0, 255)]));
      await client.query(`INSERT INTO board_collaborators (board_id, user_id, role) VALUES ($1,$2,'student')`, [board.id, studentId]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    res.status(201).json({ ok: true, board: { id: board.id, name: board.name, updated_at: board.updated_at, kind: 'individual', members: 1, last_opened: true } });
  } catch (err) { console.error('[library] student-board:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* POST /:id/insert {studentId|journalId, boardId, title?} - the lesson becomes
   one frame on that board, after the end of its flow. All or nothing: a failure
   leaves no half a copy. */
router.post('/:id/insert', requireTeacher, async (req, res) => {
  const fail = (status, error, code) => { track(req.user.id, 'insert_failed', req.params.id, { error_code: code || String(status) }); return res.status(status).json({ error, code }); };
  try {
    const a = await communityItem(req.params.id, req.user.id);
    if (!a) return fail(404, 'This resource is no longer available', 'item_gone');
    const blocked = copyBlock(a, req.user.id);
    if (blocked) return fail(blocked.status, blocked.error, blocked.code || 'copy_blocked');
    const snap = a.data?.snapshot;
    if (!snap?.cards?.length) return fail(400, 'This item has no board to insert', 'empty');
    const studentId = await studentUserId(req.user.id, req.body || {});
    if (!studentId) return fail(409, 'This student is not on any of your boards yet', 'no_student');
    let boardId = String(req.body?.boardId || '');
    if (!UUID_RE.test(boardId)) {
      // no silent pick: with exactly one board it is that one, with more the teacher must choose
      const { rows } = await pool.query(
        `SELECT b.id FROM board_collaborators bc JOIN boards b ON b.id = bc.board_id
          WHERE b.user_id = $1 AND bc.user_id = $2 AND NOT b.is_practice`, [req.user.id, studentId]);
      if (rows.length !== 1) return fail(409, rows.length ? 'Choose which board to use' : 'This student has no board yet', rows.length ? 'choose_board' : 'no_board');
      boardId = rows[0].id;
    }
    const { rows: [target] } = await pool.query(
      `SELECT b.id, b.name FROM boards b JOIN board_collaborators bc ON bc.board_id = b.id
        WHERE b.id = $1 AND b.user_id = $2 AND bc.user_id = $3`, [boardId, req.user.id, studentId]);
    if (!target) return fail(409, 'That board is no longer available for this student - choose another one.', 'board_unavailable');
    const title = clip(req.body?.title, 200) || copyTitle(a);
    const versionId = await currentVersionId(pool, a);
    track(req.user.id, 'insert_started', a.id, { content_type: a.kind, board_id: target.id, student_id: studentId, version_id: versionId });
    const client = await pool.connect();
    let placed, copyId;
    try {
      await client.query('BEGIN');
      const { rows: [b] } = await client.query('SELECT data FROM boards WHERE id = $1 FOR UPDATE', [target.id]);
      placed = placeLesson(b.data || {}, snap, title);
      placed.data = require('../lib/boardSanitize').sanitizeBoardData(placed.data);
      await client.query('UPDATE boards SET data = $2, updated_at = NOW() WHERE id = $1', [target.id, placed.data]);
      ({ rows: [{ id: copyId }] } = await client.query(
        `INSERT INTO library_copies (assignment_id, user_id, board_id, frame_id, target, title, author_name, source_version_id, card_ids, arrow_ids)
         VALUES ($1,$2,$3,$4,'student',$5,$6,$7,$8,$9) RETURNING id`,
        [a.id, req.user.id, target.id, placed.frameId, title, clip(a.author_name, 255), versionId, JSON.stringify(placed.cardIds), JSON.stringify(placed.arrowIds)]));
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    require('../ws').pushBoardState(target.id, placed.data);
    track(req.user.id, 'insert_completed', a.id, { content_type: a.kind, board_id: target.id, student_id: studentId, placement_direction: placed.direction, version_id: versionId });
    track(req.user.id, 'copy_created', a.id, { content_type: a.kind, source_surface: 'insert', board_id: target.id, version_id: versionId });
    res.status(201).json({ ok: true, board: target, frame_id: placed.frameId, copy_id: copyId, direction: placed.direction, direction_why: placed.directionWhy });
  } catch (err) {
    console.error('[library] insert:', err.message);
    track(req.user.id, 'insert_failed', req.params.id, { error_code: 'server' });
    res.status(500).json({ error: 'Could not add it - nothing was changed.', code: 'server' });
  }
});

/* POST /mine/copies/:id/undo - take back what Copy or Insert just did: the
   frame and its arrows leave the student's board, or the new (untouched) board
   is removed. Only for a few minutes, and only the cards the copy brought. */
const UNDO_MINUTES = 10;
router.post('/mine/copies/:id/undo', requireTeacher, async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id || ''))) return res.status(404).json({ error: 'Not found' });
    const { rows: [c] } = await pool.query('SELECT * FROM library_copies WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!c || c.undone_at) return res.status(404).json({ error: 'Nothing to undo' });
    if (Date.now() - Date.parse(c.created_at) > UNDO_MINUTES * 60000) return res.status(409).json({ error: 'It is too late to undo this - remove it from the board yourself.' });
    if (c.target === 'student' && c.board_id) {
      const client = await pool.connect();
      let data;
      try {
        await client.query('BEGIN');
        const { rows: [b] } = await client.query('SELECT data FROM boards WHERE id = $1 AND user_id = $2 FOR UPDATE', [c.board_id, req.user.id]);
        if (b) {
          const gone = new Set(c.card_ids || []), goneArrows = new Set(c.arrow_ids || []);
          data = { ...(b.data || {}) };
          data.cards = (data.cards || []).filter(x => !gone.has(x.id));
          data.arrows = (data.arrows || []).filter(l => !goneArrows.has(l.id) && !gone.has(l.fromCard) && !gone.has(l.toCard));
          await client.query('UPDATE boards SET data = $2, updated_at = NOW() WHERE id = $1', [c.board_id, data]);
        }
        await client.query('UPDATE library_copies SET undone_at = NOW() WHERE id = $1', [c.id]);
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
      if (data) require('../ws').pushBoardState(c.board_id, data);
    } else if (c.target === 'board' && c.board_id) {
      const { rows: [b] } = await pool.query('SELECT created_at, updated_at FROM boards WHERE id = $1 AND user_id = $2', [c.board_id, req.user.id]);
      if (b && Date.parse(b.updated_at) - Date.parse(b.created_at) > 5000) return res.status(409).json({ error: 'You already changed that board, so it stays.' });
      if (b) await pool.query('DELETE FROM boards WHERE id = $1 AND user_id = $2', [c.board_id, req.user.id]);
      await pool.query('UPDATE library_copies SET undone_at = NOW() WHERE id = $1', [c.id]);
    } else {
      await pool.query('UPDATE library_copies SET undone_at = NOW() WHERE id = $1', [c.id]);
    }
    res.json({ ok: true });
  } catch (err) { console.error('[library] undo:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* ── Reports ──────────────────────────────────────────────────────────────
   One teacher, one voice. The thresholds and who may move them live in
   lib/communityModeration.js; this stores the report, opens (or joins) a case
   with a snapshot of what was reported, and tells the author when it matters. */
const caseSnapshot = (a, authorName) => ({
  title: a.title, description: a.description, level: a.level, skill: a.skill, tags: a.tags, author_id: a.user_id, author_name: authorName,
  version_no: a.version_no, language: a.data?.language || null, audience: a.data?.audience || null, cover: a.data?.cover || null,
  snapshot: a.data?.snapshot || null, taken_at: new Date().toISOString(),
});

router.post('/:id/report', requireTeacher, async (req, res) => {
  try {
    const a = await communityItem(req.params.id, req.user.id);
    if (!a || a.visibility !== 'community') return res.status(404).json({ error: 'Not found' });
    if (a.user_id === req.user.id) return res.status(400).json({ error: 'This is your own lesson' });
    if (!mod.isCategory(req.body?.reason)) {
      return res.status(400).json({ error: 'Choose what is wrong - a reason is required' });
    }
    const category = normalizeCategory(req.body.reason);
    const severity = isCritical(category, req.body.critical ? 'critical' : 'normal') ? 'critical' : 'normal';
    const note = clip(req.body?.note, 500);

    // the same teacher on the same version, already reviewed: say how it ended
    const { rows: [prev] } = await pool.query(
      `SELECT r.version_no, r.case_id, c.status, c.decision FROM library_reports r LEFT JOIN moderation_cases c ON c.id = r.case_id
        WHERE r.assignment_id = $1 AND r.user_id = $2`, [a.id, req.user.id]);
    if (prev && prev.status === 'resolved' && prev.version_no === a.version_no) {
      return res.json({ ok: true, reported: true, already: true, status: reporterStatus(prev) });
    }

    const { rows: [me] } = await pool.query(
      `SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS age_h,
              (SELECT COUNT(*) FROM library_reports x WHERE x.user_id = $1 AND x.outcome = 'rejected')::int AS rejected,
              (SELECT COUNT(*) FROM library_reports x WHERE x.user_id = $1 AND x.outcome = 'upheld')::int AS upheld
         FROM users WHERE id = $1`, [req.user.id]);
    const counts = reportCounts({ accountAgeHours: Number(me.age_h), rejected: me.rejected, upheld: me.upheld });

    // the open case for this publication, or a new one holding the snapshot
    let { rows: [kase] } = await pool.query(
      `SELECT * FROM moderation_cases WHERE assignment_id = $1 AND status <> 'resolved' ORDER BY opened_at DESC LIMIT 1`, [a.id]);
    if (!kase) {
      ({ rows: [kase] } = await pool.query(
        `INSERT INTO moderation_cases (assignment_id, author_id, version_no, risk_level, snapshot) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [a.id, a.user_id, a.version_no, severity, caseSnapshot(a, a.author_name)]));
    } else if (severity === 'critical' && kase.risk_level !== 'critical') {
      await pool.query(`UPDATE moderation_cases SET risk_level = 'critical' WHERE id = $1`, [kase.id]);
    }
    // a repeat report from the same teacher updates the comment, never the count
    await pool.query(
      `INSERT INTO library_reports (assignment_id, user_id, reason, note, severity, case_id, counts, version_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (assignment_id, user_id) DO UPDATE
         SET reason = EXCLUDED.reason, note = EXCLUDED.note, severity = EXCLUDED.severity, case_id = EXCLUDED.case_id,
             version_no = EXCLUDED.version_no, outcome = NULL, updated_at = NOW()`,
      [a.id, req.user.id, category, note, severity, kase.id, counts, a.version_no]);

    const { rows: reps } = await pool.query(
      `SELECT r.user_id, u.email, r.reason AS category, r.severity, r.counts, r.created_at
         FROM library_reports r JOIN users u ON u.id = r.user_id
        WHERE r.assignment_id = $1 AND r.case_id = $2 AND r.created_at > NOW() - ($3 || ' days')::interval`,
      [a.id, kase.id, String(LIMITS.windowDays)]);
    const verdict = assess(reps);
    if (verdict.priority || verdict.critical) await pool.query(`UPDATE moderation_cases SET risk_level = 'critical' WHERE id = $1`, [kase.id]);
    const next = stricter(a.moderation_state, verdict.state);
    if (next !== a.moderation_state) {
      // $2 and $3 are separate on purpose: one parameter used as a column value and
      // inside CASE is two types to Postgres ("inconsistent types deduced")
      await pool.query(`UPDATE assignments SET moderation_state = $2, hidden_at = CASE WHEN $3::boolean THEN COALESCE(hidden_at, NOW()) ELSE hidden_at END WHERE id = $1`, [a.id, next, next === 'hidden']);
      const cats = [...new Set(reps.map(r => mod.categoryLabel(r.category)))].slice(0, 3).join(', ');
      const hidden = next === 'hidden';
      await tell(a.user_id, {
        type: 'community', once: { kind: 'report_state', key: `${kase.id}:${next}` }, email: 'always',
        title: hidden ? `"${clip(a.title, 80)}" is under review and hidden from Community` : `"${clip(a.title, 80)}" is pending review`,
        body: hidden
          ? `Reported by teachers (${cats}). It is hidden from the catalog until our team decides. Teachers who already copied it keep their copies. You can edit it and send an update, or appeal.`
          : `Several teachers reported it (${cats}). It stays in search and by link, but is out of recommendations until it is reviewed.`,
        link: 'community.html#publications',
        mail: { subject: hidden ? 'Your Community resource is hidden while we review it' : 'Your Community resource is pending review',
          paragraphs: [hidden ? `"${a.title}" was reported by teachers (${cats}) and is hidden from the catalog until our team decides.` : `"${a.title}" was reported by teachers (${cats}); it is out of recommendations until it is reviewed.`,
            'Teachers who already copied it keep their copies. We do not tell you who reported it.'],
          button: { href: 'community.html#publications', label: 'Open My publications' } } });
      if (hidden) track(req.user.id, 'publication_hidden', a.id, { category, state: next });
    }
    track(req.user.id, 'report_submitted', a.id, { category, content_type: a.kind });
    res.json({ ok: true, reported: true, state: next, status: reporterStatus(null) });
  } catch (err) { console.error('[library] report:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* GET /mine/reports - what became of the reports I sent: Received → Reviewed →
   Action taken / No violation found. Nothing about the author or other reporters. */
router.get('/mine/reports', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.assignment_id, r.reason AS category, r.created_at, a.title, c.status, c.decision
         FROM library_reports r LEFT JOIN assignments a ON a.id = r.assignment_id LEFT JOIN moderation_cases c ON c.id = r.case_id
        WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 50`, [req.user.id]);
    res.json({ reports: rows.map(r => ({ assignment_id: r.assignment_id, title: r.title || 'Removed resource', category: mod.categoryLabel(r.category), created_at: r.created_at, status: reporterStatus(r.status ? r : null) })) });
  } catch (err) { console.error('[library] my reports:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* POST /:id/update {snapshot data} - the author publishes a new version of a
   board lesson. Copies already made keep theirs; the card says "Updated".
   An item that is under review stays hidden until the team looks at the new
   version: Edit & republish sends it back to review, it does not skip it. */
router.post('/:id/update', requireTeacher, async (req, res) => {
  try {
    const { rows: [a] } = await pool.query('SELECT * FROM assignments WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!a) return res.status(404).json({ error: 'Not found or not owner' });
    if (a.kind !== 'board') return res.status(400).json({ error: 'Only board lessons have versions' });
    if (a.moderation_state === 'removed') return res.status(409).json({ error: 'This resource was removed. You can appeal the decision, or share a new one.' });
    const normalized = normalizeCommunityBoardData({ ...(a.data || {}), ...(req.body?.data || {}) }, a.title);
    if (normalized.error) return res.status(400).json({ error: normalized.error });
    const ownershipError = await assertSourceBoardOwnership(req.user.id, normalized.value);
    if (ownershipError) return res.status(ownershipError.status).json({ error: ownershipError.error });
    // still a remix? the same rules (the author of the original may have switched remixes off since)
    const remix = a.remix_of ? null : await detectRemix(pool, req.user.id, normalized.value.source_board_id, normalized.value.source_frame_id);
    if (remix) { const b = remixBlock(remix, normalized.value.snapshot.cards); if (b) return res.status(b.status).json({ error: b.error }); }
    const withdrawn = ['hidden', 'needs_changes'].includes(a.moderation_state);
    const { rows } = await pool.query(
      `UPDATE assignments SET data = $2, content_updated_at = NOW(), updated_at = NOW(), version_no = version_no + 1,
              moderation_state = CASE WHEN moderation_state = 'needs_changes' THEN 'hidden' ELSE moderation_state END
        WHERE id = $1 RETURNING ${LIST_COLS}, content_updated_at, version_no, moderation_state, hidden_at`,
      [a.id, { ...normalized.value, cover: a.data?.cover || normalized.value.cover }]);
    await pool.query('INSERT INTO publication_versions (assignment_id, version_no, title) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [a.id, rows[0].version_no, a.title]);
    if (remix) await onPublished(pool, a.id, { remix });
    if (withdrawn) {
      // back to the queue, as a new version to look at
      await pool.query(
        `UPDATE moderation_cases SET status = 'open', resubmitted_at = NOW(), decision = NULL WHERE id = (
           SELECT id FROM moderation_cases WHERE assignment_id = $1 ORDER BY opened_at DESC LIMIT 1)`, [a.id]);
    } else {
      await pool.query(`UPDATE moderation_cases SET resubmitted_at = NOW() WHERE assignment_id = $1 AND status <> 'resolved'`, [a.id]);
    }
    res.json({ assignment: rows[0], resubmitted: withdrawn });
  } catch (err) { console.error('[library] update:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* GET /mine/saved - bookmarks and copies, newest first; a copy older than the
   author's last update says so. A deleted original keeps the copy. If the
   original was pulled for a safety reason, the owner of a copy is warned -
   nothing is removed from their board. */
router.get('/mine/saved', async (req, res) => {
  try {
    const { rows: marks } = await pool.query(
      `SELECT a.id, a.kind, a.title, a.level, a.skill, a.visibility, a.hidden_at, (a.image IS NOT NULL) AS has_image, a.updated_at,
              a.data->'cover' AS cover, a.data->'preview' AS preview, a.content_updated_at,
              NULLIF(a.data->>'language', '') AS language, u.name AS author_name, u.avatar AS author_avatar, v.created_at AS saved_at,
              ${STATS_SQL}, ${CARD_EXTRA_SQL}
         FROM library_saves v JOIN assignments a ON a.id = v.assignment_id JOIN users u ON u.id = a.user_id
        WHERE v.user_id = $1 ORDER BY v.created_at DESC LIMIT 200`, [req.user.id]);
    marks.forEach(r => { r.stats = shapeStats(r); r.clone_count = r.copy_count; r.unavailable = !!r.hidden_at || r.visibility === 'private'; });
    const { rows: copies } = await pool.query(
      `SELECT c.id, c.assignment_id, c.board_id, c.frame_id, c.target, c.title, c.author_name, c.created_at,
              b.name AS board_name, (b.id IS NOT NULL) AS board_exists,
              (a.id IS NOT NULL AND a.visibility IN ('community','unlisted') AND a.hidden_at IS NULL) AS source_live,
              (a.id IS NOT NULL AND (
                 COALESCE((SELECT pv.version_no FROM publication_versions pv WHERE pv.id = c.source_version_id), 0) > 0
                   AND (SELECT pv.version_no FROM publication_versions pv WHERE pv.id = c.source_version_id) < a.version_no
                 OR (c.source_version_id IS NULL AND a.content_updated_at IS NOT NULL AND a.content_updated_at > c.created_at)
              )) AS update_available,
              (a.id IS NOT NULL AND a.moderation_state IN ('hidden','removed')
                 AND EXISTS (SELECT 1 FROM moderation_cases mc WHERE mc.assignment_id = a.id AND mc.risk_level = 'critical')) AS source_critical
         FROM library_copies c LEFT JOIN boards b ON b.id = c.board_id LEFT JOIN assignments a ON a.id = c.assignment_id
        WHERE c.user_id = $1 AND c.undone_at IS NULL ORDER BY c.created_at DESC LIMIT 200`, [req.user.id]);
    res.json({ bookmarks: marks, copies });
  } catch (err) { console.error('[library] saved:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* PATCH /mine/copies/:id {title} - rename a saved copy (three "Present
   Simple Game"s in the list are no use). Renames its board too. */
router.patch('/mine/copies/:id', async (req, res) => {
  try {
    const title = clip(req.body?.title, 255);
    if (!title) return res.status(400).json({ error: 'Title required' });
    const { rows: [c] } = await pool.query('UPDATE library_copies SET title = $3 WHERE id = $1 AND user_id = $2 RETURNING board_id, target', [req.params.id, req.user.id, title]);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.board_id && c.target === 'board') await pool.query('UPDATE boards SET name = $3 WHERE id = $1 AND user_id = $2', [c.board_id, req.user.id, title]);
    res.json({ ok: true, title });
  } catch (err) { console.error('[library] rename copy:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* GET /mine/publications - what I shared: the numbers, the status the review
   team set, what to fix, and whether I can still appeal. Reporters stay
   anonymous; only categories and counts are shown. */
router.get('/mine/publications', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.kind, a.title, a.level, a.skill, a.visibility, a.hidden_at, a.published_at, a.updated_at, a.content_updated_at,
              (a.image IS NOT NULL) AS has_image, a.data->'cover' AS cover, a.data->'preview' AS preview,
              NULLIF(a.data->>'language', '') AS language,
              COALESCE(NULLIF(a.data->>'source_board_id', ''), NULLIF(a.data->>'sourceBoardId', '')) AS source_board_id,
              COALESCE(NULLIF(a.data->>'source_frame_id', ''), NULLIF(a.data->>'sourceFrameId', '')) AS source_frame_id,
              ${STATS_SQL}, ${CARD_EXTRA_SQL},
              (SELECT COUNT(*) FROM library_reports r WHERE r.assignment_id = a.id)::int AS report_count
         FROM assignments a JOIN users u ON u.id = a.user_id
        WHERE a.user_id = $1 AND (a.visibility IN ('community','unlisted') OR a.published_at IS NOT NULL)
        ORDER BY COALESCE(a.published_at, a.updated_at) DESC LIMIT 200`, [req.user.id]);
    const ids = rows.map(r => r.id);
    const { rows: cases } = ids.length ? await pool.query(
      `SELECT DISTINCT ON (c.assignment_id) c.id, c.assignment_id, c.status, c.decision, c.decision_note, c.required_changes,
              c.appeal_until, c.decided_at, c.risk_level, ap.status AS appeal_status
         FROM moderation_cases c LEFT JOIN moderation_appeals ap ON ap.case_id = c.id
        WHERE c.assignment_id = ANY($1::uuid[]) ORDER BY c.assignment_id, c.opened_at DESC`, [ids]) : { rows: [] };
    const { rows: cats } = ids.length ? await pool.query(
      `SELECT assignment_id, reason AS category, COUNT(*)::int AS n FROM library_reports
        WHERE assignment_id = ANY($1::uuid[]) AND case_id IN (SELECT id FROM moderation_cases WHERE status <> 'resolved' OR decided_at > NOW() - INTERVAL '30 days')
        GROUP BY 1, 2`, [ids]) : { rows: [] };
    const now = Date.now();
    rows.forEach(r => {
      r.stats = shapeStats(r, now); r.clone_count = r.copy_count;
      r.status = authorStatus(r);
      const k = cases.find(c => c.assignment_id === r.id);
      r.moderation = k ? {
        case_id: k.id, status: k.status, decision: k.decision, note: k.decision_note, required_changes: k.required_changes,
        decided_at: k.decided_at, appeal_until: k.appeal_until, appeal_status: k.appeal_status || null,
        can_appeal: !k.appeal_status && appealOpen(k, now),
        categories: cats.filter(c => c.assignment_id === r.id).map(c => ({ label: mod.categoryLabel(c.category), n: c.n })),
      } : (r.moderation_state !== 'published' ? { categories: cats.filter(c => c.assignment_id === r.id).map(c => ({ label: mod.categoryLabel(c.category), n: c.n })) } : null);
    });
    res.json({ publications: rows });
  } catch (err) { console.error('[library] publications:', err.message); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
module.exports.communityItem = communityItem;
