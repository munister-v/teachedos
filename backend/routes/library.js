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
    let where = `a.visibility = 'community' AND a.hidden_at IS NULL`;
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
              a.data->'cover' AS cover, a.updated_at,
              NULLIF(a.data->>'language', '') AS language,
              NULLIF(a.data->>'audience', '') AS audience,
              (a.data->>'allowCopy') IS DISTINCT FROM 'false' AS allow_copy,
              ($1::uuid IS NOT NULL AND a.user_id = $1) AS is_mine,
              u.name AS author_name, u.avatar AS author_avatar, a.user_id AS author_id, a.content_updated_at,
              (SELECT COUNT(*) FROM library_likes l WHERE l.assignment_id = a.id)::int AS like_count,
              ($1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM library_likes l WHERE l.assignment_id = a.id AND l.user_id = $1)) AS liked,
              ($1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM library_saves v WHERE v.assignment_id = a.id AND v.user_id = $1)) AS saved,
              ($1::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM library_reports r WHERE r.assignment_id = a.id AND r.user_id = $1)) AS reported,
              (SELECT MAX(c.created_at) FROM library_copies c WHERE c.assignment_id = a.id AND c.user_id = $1) AS my_copy_at
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
        kind === 'board' ? cleanCoverImage(b.image) : (b.image ? String(b.image).slice(0, 2_000_000) : null),
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
      [req.user.id, s.kind, s.user_id === req.user.id ? clip(s.title, 250) + ' (copy)' : copyTitle({ title: s.title, author_name: (await pool.query('SELECT name FROM users WHERE id = $1', [s.user_id])).rows[0]?.name }), s.description, s.level, s.skill,
       JSON.stringify(s.tags || []), s.data || {}, s.image, s.id]
    );
    // Bump the source's clone counter (best-effort)
    pool.query('UPDATE assignments SET clone_count = clone_count + 1 WHERE id = $1', [s.id]).catch(() => {});
    // and it is one of "My copies" in Saved items (16.10.2026)
    pool.query(`INSERT INTO library_copies (assignment_id, user_id, target, title, author_name)
                SELECT $1, $2, 'library', $3, u.name FROM users u WHERE u.id = $4`, [s.id, req.user.id, rows[0].title, s.user_id]).catch(() => {});
    res.status(201).json({ assignment: rows[0] });
  } catch (err) {
    console.error('[library] clone error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══ Community actions (16.10.2026): like, bookmark, copy, insert, report ══
   A copy is the copier's own - a new board, or one frame on a student's
   board. Deleting or changing the original never reaches it. */
const { placeLesson, lessonBoard } = require('../lib/communityPlace');
const REPORTS_TO_HIDE = 3;
const REPORT_REASONS = new Set(['mistakes', 'broken', 'inappropriate', 'copyright', 'spam', 'other']);

async function communityItem(id, viewerId) {
  if (!UUID_RE.test(String(id || ''))) return null;
  const { rows } = await pool.query(
    `SELECT a.*, u.name AS author_name FROM assignments a JOIN users u ON u.id = a.user_id
      WHERE a.id = $1 AND (a.visibility IN ('community', 'unlisted') OR a.user_id = $2)`, [id, viewerId]);
  return rows[0] || null;
}
const copyTitle = (a) => {
  const t = clip(a.title, 200) || 'Community lesson';
  return a.author_name && !t.includes(`(by ${a.author_name})`) ? `${t} (by ${clip(a.author_name, 50)})` : t;
};

router.post('/:id/like', async (req, res) => {
  try {
    const a = await communityItem(req.params.id, req.user.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const on = req.body?.on !== false;
    if (on) await pool.query('INSERT INTO library_likes (assignment_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [a.id, req.user.id]);
    else await pool.query('DELETE FROM library_likes WHERE assignment_id = $1 AND user_id = $2', [a.id, req.user.id]);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM library_likes WHERE assignment_id = $1', [a.id]);
    res.json({ ok: true, liked: on, like_count: rows[0].n });
  } catch (err) { console.error('[library] like:', err.message); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/bookmark', async (req, res) => {
  try {
    const a = await communityItem(req.params.id, req.user.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const on = req.body?.on !== false;
    if (on) await pool.query('INSERT INTO library_saves (assignment_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [a.id, req.user.id]);
    else await pool.query('DELETE FROM library_saves WHERE assignment_id = $1 AND user_id = $2', [a.id, req.user.id]);
    res.json({ ok: true, saved: on });
  } catch (err) { console.error('[library] bookmark:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* POST /:id/to-board - Save to My Boards: a new board of the teacher's own. */
router.post('/:id/to-board', requireTeacher, async (req, res) => {
  try {
    const a = await communityItem(req.params.id, req.user.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    if (a.data?.allowCopy === false && a.user_id !== req.user.id) return res.status(403).json({ error: 'The author does not allow copies of this lesson' });
    const snap = a.data?.snapshot;
    if (!snap?.cards?.length) return res.status(400).json({ error: 'This item has no board to copy' });
    const title = copyTitle(a);
    const { rows: [board] } = await pool.query(
      'INSERT INTO boards (user_id, name, data) VALUES ($1,$2,$3) RETURNING id, name',
      [req.user.id, title.slice(0, 255), require('../lib/boardSanitize').sanitizeBoardData(lessonBoard(snap))]);
    await pool.query(`INSERT INTO library_copies (assignment_id, user_id, board_id, target, title, author_name) VALUES ($1,$2,$3,'board',$4,$5)`,
      [a.id, req.user.id, board.id, title, clip(a.author_name, 255)]);
    if (a.user_id !== req.user.id) await pool.query('UPDATE assignments SET clone_count = clone_count + 1 WHERE id = $1', [a.id]);
    res.status(201).json({ ok: true, board });
  } catch (err) { console.error('[library] to-board:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* POST /:id/insert {studentId | journalId} - Insert to Student: the lesson
   becomes one frame on the student's board with this teacher (their own
   board first), next to where the teacher stopped. */
router.post('/:id/insert', requireTeacher, async (req, res) => {
  try {
    const a = await communityItem(req.params.id, req.user.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    if (a.data?.allowCopy === false && a.user_id !== req.user.id) return res.status(403).json({ error: 'The author does not allow copies of this lesson' });
    const snap = a.data?.snapshot;
    if (!snap?.cards?.length) return res.status(400).json({ error: 'This item has no board to insert' });
    let studentId = String(req.body?.studentId || '');
    if (!UUID_RE.test(studentId) && req.body?.journalId) {
      const { rows } = await pool.query('SELECT student_id FROM student_journal WHERE id::text = $1 AND teacher_id = $2', [String(req.body.journalId), req.user.id]);
      studentId = rows[0]?.student_id || '';
    }
    if (!UUID_RE.test(String(studentId))) return res.status(409).json({ error: 'This student is not on any of your boards yet' });
    const { rows: [target] } = await pool.query(
      `SELECT b.id, b.name FROM board_collaborators bc JOIN boards b ON b.id = bc.board_id
        WHERE b.user_id = $1 AND bc.user_id = $2
        ORDER BY bc.is_home DESC, (SELECT COUNT(*) FROM board_collaborators x WHERE x.board_id = b.id) ASC, b.updated_at DESC
        LIMIT 1`, [req.user.id, studentId]);
    if (!target) return res.status(409).json({ error: 'This student is not on any of your boards yet' });
    const title = copyTitle(a);
    const client = await pool.connect();
    let placed;
    try {
      await client.query('BEGIN');
      const { rows: [b] } = await client.query('SELECT data FROM boards WHERE id = $1 FOR UPDATE', [target.id]);
      placed = placeLesson(b.data || {}, snap, title);
      placed.data = require('../lib/boardSanitize').sanitizeBoardData(placed.data);
      await client.query('UPDATE boards SET data = $2, updated_at = NOW() WHERE id = $1', [target.id, placed.data]);
      await client.query(`INSERT INTO library_copies (assignment_id, user_id, board_id, frame_id, target, title, author_name) VALUES ($1,$2,$3,$4,'student',$5,$6)`,
        [a.id, req.user.id, target.id, placed.frameId, title, clip(a.author_name, 255)]);
      if (a.user_id !== req.user.id) await client.query('UPDATE assignments SET clone_count = clone_count + 1 WHERE id = $1', [a.id]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { client.release(); }
    require('../ws').pushBoardState(target.id, placed.data);
    res.status(201).json({ ok: true, board: target, frame_id: placed.frameId });
  } catch (err) { console.error('[library] insert:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* POST /:id/report {reason, note} - three teachers reporting hides it from
   the catalog until the author fixes it; the author is told. */
router.post('/:id/report', requireTeacher, async (req, res) => {
  try {
    const a = await communityItem(req.params.id, req.user.id);
    if (!a || a.visibility !== 'community') return res.status(404).json({ error: 'Not found' });
    if (a.user_id === req.user.id) return res.status(400).json({ error: 'This is your own lesson' });
    const reason = REPORT_REASONS.has(req.body?.reason) ? req.body.reason : 'other';
    const { rowCount } = await pool.query(
      `INSERT INTO library_reports (assignment_id, user_id, reason, note) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [a.id, req.user.id, reason, clip(req.body?.note, 500)]);
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM library_reports WHERE assignment_id = $1', [a.id]);
    let hidden = !!a.hidden_at;
    if (rowCount && !hidden && n >= REPORTS_TO_HIDE) {
      await pool.query('UPDATE assignments SET hidden_at = NOW() WHERE id = $1', [a.id]);
      hidden = true;
      require('./notifications').createNotification(a.user_id, 'community', `"${clip(a.title, 80)}" is hidden from Community`,
        `${n} teachers reported problems with it. Check it, publish an update, and it comes back.`, 'community.html#publications').catch(() => {});
    }
    res.json({ ok: true, reported: true, hidden });
  } catch (err) { console.error('[library] report:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* POST /:id/update {snapshot data} - the author publishes a new version of a
   board lesson. Copies already made keep theirs; the card says "Updated". */
router.post('/:id/update', requireTeacher, async (req, res) => {
  try {
    const { rows: [a] } = await pool.query('SELECT * FROM assignments WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!a) return res.status(404).json({ error: 'Not found or not owner' });
    if (a.kind !== 'board') return res.status(400).json({ error: 'Only board lessons have versions' });
    const normalized = normalizeCommunityBoardData({ ...(a.data || {}), ...(req.body?.data || {}) }, a.title);
    if (normalized.error) return res.status(400).json({ error: normalized.error });
    const ownershipError = await assertSourceBoardOwnership(req.user.id, normalized.value);
    if (ownershipError) return res.status(ownershipError.status).json({ error: ownershipError.error });
    const { rows } = await pool.query(
      `UPDATE assignments SET data = $2, content_updated_at = NOW(), updated_at = NOW(), hidden_at = NULL
        WHERE id = $1 RETURNING ${LIST_COLS}, content_updated_at`, [a.id, { ...normalized.value, cover: a.data?.cover || normalized.value.cover }]);
    // reports were about the old version
    await pool.query('DELETE FROM library_reports WHERE assignment_id = $1', [a.id]);
    res.json({ assignment: rows[0] });
  } catch (err) { console.error('[library] update:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* GET /mine/saved - bookmarks and copies, newest first; a copy older than the
   author's last update says so. A deleted original keeps the copy. */
router.get('/mine/saved', async (req, res) => {
  try {
    const { rows: marks } = await pool.query(
      `SELECT a.id, a.kind, a.title, a.level, a.skill, a.visibility, a.hidden_at, (a.image IS NOT NULL) AS has_image, a.updated_at,
              a.data->'cover' AS cover, a.data->'preview' AS preview, a.clone_count, a.content_updated_at,
              NULLIF(a.data->>'language', '') AS language, u.name AS author_name, u.avatar AS author_avatar, v.created_at AS saved_at,
              (SELECT COUNT(*) FROM library_likes l WHERE l.assignment_id = a.id)::int AS like_count
         FROM library_saves v JOIN assignments a ON a.id = v.assignment_id JOIN users u ON u.id = a.user_id
        WHERE v.user_id = $1 ORDER BY v.created_at DESC LIMIT 200`, [req.user.id]);
    const { rows: copies } = await pool.query(
      `SELECT c.id, c.assignment_id, c.board_id, c.frame_id, c.target, c.title, c.author_name, c.created_at,
              b.name AS board_name, (b.id IS NOT NULL) AS board_exists,
              (a.id IS NOT NULL AND a.visibility IN ('community','unlisted')) AS source_live,
              (a.content_updated_at IS NOT NULL AND a.content_updated_at > c.created_at) AS update_available
         FROM library_copies c LEFT JOIN boards b ON b.id = c.board_id LEFT JOIN assignments a ON a.id = c.assignment_id
        WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT 200`, [req.user.id]);
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

/* GET /mine/publications - what I shared, with likes, copies and status. */
router.get('/mine/publications', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.kind, a.title, a.level, a.skill, a.visibility, a.hidden_at, a.published_at, a.updated_at, a.content_updated_at,
              (a.image IS NOT NULL) AS has_image, a.data->'cover' AS cover, a.data->'preview' AS preview, a.clone_count,
              NULLIF(a.data->>'language', '') AS language,
              COALESCE(NULLIF(a.data->>'source_board_id', ''), NULLIF(a.data->>'sourceBoardId', '')) AS source_board_id,
              COALESCE(NULLIF(a.data->>'source_frame_id', ''), NULLIF(a.data->>'sourceFrameId', '')) AS source_frame_id,
              (SELECT COUNT(*) FROM library_likes l WHERE l.assignment_id = a.id)::int AS like_count,
              (SELECT COUNT(*) FROM library_reports r WHERE r.assignment_id = a.id)::int AS report_count
         FROM assignments a
        WHERE a.user_id = $1 AND (a.visibility IN ('community','unlisted') OR a.published_at IS NOT NULL)
        ORDER BY COALESCE(a.published_at, a.updated_at) DESC LIMIT 200`, [req.user.id]);
    res.json({ publications: rows });
  } catch (err) { console.error('[library] publications:', err.message); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
