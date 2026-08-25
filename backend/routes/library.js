const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth, optionalAuth, requireTeacher } = require('../middleware/auth');

const KINDS = ['lesson', 'quiz', 'game', 'board', 'other'];
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
  published_at, created_at, updated_at`;

/* Витрина сообщества и просмотр опубликованного урока доступны без входа:
   именно с них начинается знакомство с TeachEd. Всё, что ниже requireAuth,
   работает только для авторизованных. */
// ── GET /api/library/community - browse published items ─────────────────────
router.get('/community', optionalAuth, async (req, res) => {
  try {
    const { kind, level, skill, q } = req.query;
    const params = [];
    let where = `a.visibility = 'community'`;
    if (kind && KINDS.includes(kind)) { params.push(kind);  where += ` AND a.kind = $${params.length}`; }
    if (level)                        { params.push(level);  where += ` AND a.level = $${params.length}`; }
    if (skill)                        { params.push(skill);  where += ` AND a.skill = $${params.length}`; }
    if (q && q.trim())                { params.push(`%${q.trim()}%`); where += ` AND (a.title ILIKE $${params.length} OR a.description ILIKE $${params.length})`; }
    /* A selected frame means one Lesson; an empty value means a whole-board
       Space. The camelCase fallback keeps older published records readable. */
    const { rows } = await pool.query(
      `SELECT a.id, a.kind, a.title, a.description, a.level, a.skill, a.tags,
              (a.image IS NOT NULL) AS has_image, a.clone_count, a.published_at,
              CASE WHEN jsonb_typeof(a.data #> '{snapshot,cards}') = 'array'
                   THEN jsonb_array_length(a.data #> '{snapshot,cards}')
                   ELSE 0 END AS card_count,
              NULLIF(a.data->>'duration', '') AS duration,
              NULLIF(a.data->>'snapshot_version', '') AS snapshot_version,
              a.data->'preview' AS preview,
              COALESCE(NULLIF(a.data->>'source_frame_id', ''),
                       NULLIF(a.data->>'sourceFrameId', '')) AS source_frame_id,
              u.name AS author_name, u.avatar AS author_avatar
       FROM assignments a JOIN users u ON u.id = a.user_id
       WHERE ${where}
       ORDER BY a.published_at DESC NULLS LAST LIMIT 200`,
      params
    );
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
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id || ''))) return res.status(404).json({ error: 'Not found' });
    // Гость видит только опубликованное; владелец — ещё и свои приватные записи.
    const viewerId = req.user?.id || null;
    const { rows } = await pool.query(
      `SELECT a.*, ($2::uuid IS NOT NULL AND a.user_id = $2) AS is_owner,
              u.name AS author_name, u.avatar AS author_avatar
       FROM assignments a JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND (a.visibility IN ('community', 'unlisted') OR ($2::uuid IS NOT NULL AND a.user_id = $2))`,
      [req.params.id, viewerId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* POST /api/library/:id/track-copy - счётчик «сколько раз урок скопировали».

   Урок-доска копируется не через /clone (тот создаёт запись в библиотеке
   заказчика): снимок уходит прямо на холст board.html через communityImport,
   без обращения к серверу вообще. Из-за этого clone_count у уроков-досок
   всегда оставался нулевым, хотя колонка и читалась в списке витрины.
   Маршрут публичный и намеренно ничего не создаёт и не требует входа —
   это popularity-метрика витрины, а не персональное действие пользователя. */
router.post('/:id/track-copy', async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id || ''))) return res.status(204).end();
    const { rows } = await pool.query(
      `UPDATE assignments SET clone_count = clone_count + 1
       WHERE id = $1 AND visibility IN ('community', 'unlisted') RETURNING clone_count`,
      [req.params.id]
    );
    res.json({ ok: true, cloneCount: rows[0]?.clone_count ?? null });
  } catch (err) {
    // Метрика не должна ронять поток копирования на клиенте.
    res.status(204).end();
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
    let data = b.data || {};
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
        b.image ? String(b.image).slice(0, 2_000_000) : null,
        visibility,
        visibility,   // $11 — только для CASE, см. комментарий к запросу
      ]
    );
    res.status(201).json({ assignment: rows[0] });
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
  if (b.data !== undefined)        push('data', b.data || {});
  if (b.image !== undefined)       push('image', b.image ? String(b.image).slice(0, 2_000_000) : null);
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
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
      'SELECT kind, data FROM assignments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!source.rows.length) return res.status(404).json({ error: 'Not found or not owner' });
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
      `SELECT * FROM assignments WHERE id = $1 AND (user_id = $2 OR visibility IN ('community', 'unlisted'))`,
      [req.params.id, req.user.id]
    );
    if (!src.rows.length) return res.status(404).json({ error: 'Not found' });
    const s = src.rows[0];
    if (s.data?.allowCopy === false) return res.status(403).json({ error: 'The author does not allow copies of this lesson' });
    const { rows } = await pool.query(
      `INSERT INTO assignments (user_id, kind, title, description, level, skill, tags, data, image, cloned_from, visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'private')
       RETURNING ${LIST_COLS}`,
      [req.user.id, s.kind, clip(s.title, 250) + ' (copy)', s.description, s.level, s.skill,
       JSON.stringify(s.tags || []), s.data || {}, s.image, s.id]
    );
    // Bump the source's clone counter (best-effort)
    pool.query('UPDATE assignments SET clone_count = clone_count + 1 WHERE id = $1', [s.id]).catch(() => {});
    res.status(201).json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] clone error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
