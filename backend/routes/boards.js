const { cleanCover, cleanCoverImage } = require('../lib/cover');
const router = require('express').Router();
const { filterBoardData } = require('../lib/boardVisibility');
const { sanitizeBoardData } = require('../lib/boardSanitize');
const pool   = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { recordTelemetry } = require('../lib/telemetry');
const { PLAN_CATALOG, normalizePlanKey, getPlanLimit } = require('../lib/billing');

async function enforceBoardStorageLimit({ userId, boardId, boardData, plan }) {
  const storageMbLimit = getPlanLimit(plan, 'storageMb');
  if (storageMbLimit === -1 || boardData === undefined) return null;

  const serialized = typeof boardData === 'string' ? boardData : JSON.stringify(boardData);
  /* Размеры чужих досок берём из колонки data_bytes, которую поддерживает
     триггер, а не пересчитываем распаковкой каждой доски. Размер входящей
     считаем тем же pg_column_size, чтобы единицы совпадали с хранимыми, -
     и обе величины одним запросом, а не двумя. */
  const { rows } = await pool.query(
    `SELECT (SELECT COALESCE(SUM(data_bytes), 0)::bigint
               FROM boards WHERE user_id = $1 AND id <> $2) AS others,
            pg_column_size($3::jsonb)::bigint AS next`,
    [userId, boardId || null, serialized]
  );
  const totalBytes = Number(rows[0]?.others || 0) + Number(rows[0]?.next || 0);
  const totalMb = Math.round((totalBytes / 1024 / 1024) * 100) / 100;
  if (totalMb > storageMbLimit) {
    return {
      error: 'Storage limit reached for your package',
      code: 'STORAGE_LIMIT_REACHED',
      plan,
      limit_mb: storageMbLimit,
      used_mb: totalMb,
    };
  }
  return null;
}

async function loadBoardAccess(boardId, userId) {
  const { rows } = await pool.query(`
    SELECT b.user_id AS owner_id, b.data,
           CASE WHEN b.user_id=$2 THEN 'owner' ELSE bc.role END AS access_role
      FROM boards b
      LEFT JOIN board_collaborators bc
        ON bc.board_id=b.id AND bc.user_id=$2
     WHERE b.id=$1 AND (b.user_id=$2 OR bc.user_id=$2)
     LIMIT 1
  `, [boardId, userId]);
  return rows[0] || null;
}

function boardHasVisibleCard(access, cardId, viewerId) {
  const visible = filterBoardData(access?.data, viewerId, access?.owner_id);
  const card = Array.isArray(visible?.cards)
    ? visible.cards.find(item => String(item?.id) === String(cardId))
    : null;
  return !!card && card.data?.hiddenForViewer !== true;
}

// All board routes require auth
router.use(requireAuth);

// GET /api/boards - list user's boards (name, id, updated_at, thumbnail)
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    /* Без thumbnail (у 50 досок это ~800 КБ на каждый заход на рабочий стол,
       а учительские экраны превью не показывают) и без распаковки data:
       card_count ведёт триггер. */
    `SELECT id, name, updated_at, created_at, card_count, cover,
            (cover_image IS NOT NULL) AS has_cover_image
     FROM boards WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [req.user.id]
  );
  res.json({ boards: rows });
});

// POST /api/boards - create new board
router.post('/', requireTeacher, async (req, res) => {
  const { name = 'New Board' } = req.body;
  const plan = normalizePlanKey(req.user.plan);
  const boardLimit = PLAN_CATALOG[plan]?.limits?.boards ?? PLAN_CATALOG.free.limits.boards;

  if (boardLimit !== -1) {
    try {
      const { rows: cnt } = await pool.query(
        'SELECT COUNT(*) AS count FROM boards WHERE user_id = $1',
        [req.user.id]
      );
      if (parseInt(cnt[0].count, 10) >= boardLimit) {
        return res.status(402).json({
          error: 'Board limit reached',
          plan,
          limit: boardLimit,
          upgrade_url: '/billing',
        });
      }
    } catch (err) {
      console.error('[boards] limit check error:', err.message);
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO boards (user_id, name)
     VALUES ($1, $2)
     RETURNING id, name, data, thumbnail, updated_at, created_at`,
    [req.user.id, name.trim().slice(0, 255)]
  );
  recordTelemetry({ category: 'product', eventType: 'board.created', actorId: req.user.id, boardId: rows[0].id, metadata: { surface: 'board' } });
  res.status(201).json({ board: rows[0] });
});

// GET /api/boards/:id - load full board data
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id, b.name, b.data, b.thumbnail, b.updated_at, b.created_at,
            b.user_id, u.name AS owner_name,
            CASE WHEN b.user_id=$2 THEN 'owner' ELSE bc.role END AS access_role
     FROM boards b
     JOIN users u ON u.id = b.user_id
     LEFT JOIN board_collaborators bc ON bc.board_id=b.id AND bc.user_id=$2
     WHERE b.id = $1 AND (b.user_id = $2 OR bc.user_id=$2)`,
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Board not found' });
  // A collaborator gets the board as they are entitled to see it: private cards
  // of other authors are absent, and cards the teacher is still holding back
  // arrive as empty placeholders. Filtering here rather than in the client is
  // the point - the payload itself must not carry what the viewer may not read.
  const board = rows[0];
  board.data = filterBoardData(sanitizeBoardData(board.data), req.user.id, board.user_id);
  // Full-board saves cannot safely be merged from a redacted collaborator
  // view. Editors remain view-only until the client uses object-level writes.
  board.can_edit = board.access_role === 'owner';
  res.json({ board });
});

// PUT /api/boards/:id - save board state (legacy)
router.put('/:id', requireAuth, async (req, res) => {
  const { data, state: stateBody, name, thumbnail } = req.body;
  const boardData = sanitizeBoardData(data || stateBody);
  if (!boardData) return res.status(400).json({ error: 'data or state is required' });
  const plan = normalizePlanKey(req.user.plan);
  const storageError = await enforceBoardStorageLimit({
    userId: req.user.id,
    boardId: req.params.id,
    boardData,
    plan,
  });
  if (storageError) return res.status(402).json(storageError);

  const sets    = ['data = $3'];
  const params  = [req.params.id, req.user.id, boardData];
  if (name !== undefined)      { sets.push(`name = $${params.length + 1}`);      params.push(name.trim().slice(0, 255)); }
  if (thumbnail !== undefined) { sets.push(`thumbnail = $${params.length + 1}`); params.push(thumbnail); }

  const { rows } = await pool.query(
    `UPDATE boards SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, name, updated_at`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'Board not found' });
  recordTelemetry({
    category: 'product',
    eventType: boardData ? 'board.updated' : name !== undefined ? 'board.renamed' : 'board.thumbnail_updated',
    actorId: req.user.id,
    boardId: rows[0].id,
    metadata: { surface: 'board' },
  });
  res.json({ board: rows[0] });
});

// PATCH /api/boards/:id - update board (state, name, or thumbnail)
/* PATCH /api/boards/:id/cover - обложка своей доски: дизайн и, по желанию,
   свой снимок. Отдельно от сохранения доски, чтобы не гонять весь холст
   ради смены цвета и не трогать updated_at (порядок в списке досок). */
router.patch('/:id/cover', requireAuth, async (req, res) => {
  try {
    const sets = ['cover = $3'];
    const params = [req.params.id, req.user.id, req.body?.cover ? JSON.stringify(cleanCover(req.body.cover)) : null];
    if (req.body?.coverImage !== undefined) { params.push(cleanCoverImage(req.body.coverImage)); sets.push(`cover_image = $${params.length}`); }
    const { rows } = await pool.query(
      `UPDATE boards SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2
       RETURNING id, cover, (cover_image IS NOT NULL) AS has_cover_image`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Board not found' });
    res.json({ board: rows[0] });
  } catch (err) {
    console.error('[boards] cover error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/boards/:id/cover-image - own photo of the cover (owner only).
router.get('/:id/cover-image', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT cover_image FROM boards WHERE id = $1 AND user_id = $2 AND cover_image IS NOT NULL',
      [req.params.id, req.user.id]
    );
    const m = rows[0] && /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(rows[0].cover_image);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]);
    res.set('Cache-Control', 'private, max-age=86400');
    res.send(Buffer.from(m[2], 'base64'));
  } catch (err) {
    res.status(500).end();
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  const { data, state: stateBody, name, thumbnail } = req.body;
  const rawBoardData = data || stateBody;
  const boardData = rawBoardData === undefined ? undefined : sanitizeBoardData(rawBoardData);
  const sets   = [];
  const params = [req.params.id, req.user.id];
  const plan = normalizePlanKey(req.user.plan);

  if (boardData !== undefined) {
    const storageError = await enforceBoardStorageLimit({
      userId: req.user.id,
      boardId: req.params.id,
      boardData,
      plan,
    });
    if (storageError) return res.status(402).json(storageError);
  }

  if (boardData !== undefined)  { params.push(boardData);                      sets.push(`data = $${params.length}`); }
  if (name !== undefined)       { params.push(name.trim().slice(0, 255));      sets.push(`name = $${params.length}`); }
  if (thumbnail !== undefined)  { params.push(thumbnail);                      sets.push(`thumbnail = $${params.length}`); }

  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  const { rows } = await pool.query(
    `UPDATE boards SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, name, updated_at`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'Board not found or not owner' });
  recordTelemetry({
    category: 'product',
    eventType: boardData !== undefined ? 'board.updated' : name !== undefined ? 'board.renamed' : 'board.thumbnail_updated',
    actorId: req.user.id,
    boardId: rows[0].id,
    metadata: { surface: 'board' },
  });
  res.json({ board: rows[0] });
});

// PATCH /api/boards/:id/name - rename board (legacy)
router.patch('/:id/name', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { rows } = await pool.query(
    `UPDATE boards SET name = $3, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id, name`,
    [req.params.id, req.user.id, name.trim().slice(0, 255)]
  );
  if (!rows.length) return res.status(404).json({ error: 'Board not found' });
  recordTelemetry({ category: 'product', eventType: 'board.renamed', actorId: req.user.id, boardId: rows[0].id, metadata: { surface: 'board' } });
  res.json({ board: rows[0] });
});

// DELETE /api/boards/:id - delete board
router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM boards WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Board not found' });
  recordTelemetry({ category: 'product', eventType: 'board.deleted', actorId: req.user.id, metadata: { surface: 'board' } });
  res.json({ ok: true });
});

// POST /api/boards/:id/progress - student submits quiz result
router.post('/:id/progress', async (req, res) => {
  const { cardId, score, maxScore, pct, answers } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId required' });
  try {
    const access = await loadBoardAccess(req.params.id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access to this board' });
    if (!boardHasVisibleCard(access, cardId, req.user.id)) return res.status(404).json({ error: 'Card not found' });
    // upsert - one result per student per card
    await pool.query(`
      INSERT INTO quiz_results (board_id, card_id, user_id, score, max_score, pct, answers)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (board_id, card_id, user_id)
      DO UPDATE SET score=$4, max_score=$5, pct=$6, answers=$7, submitted_at=NOW()`,
      [req.params.id, cardId, req.user.id, score||0, maxScore||0, pct||0, JSON.stringify(answers||[])]
    );
    // also mark lesson progress as done
    await pool.query(`
      INSERT INTO student_progress (board_id, user_id, card_id, status, updated_at)
      VALUES ($1,$2,$3,'done',NOW())
      ON CONFLICT (board_id, user_id, card_id) DO UPDATE SET status='done', updated_at=NOW()`,
      [req.params.id, req.user.id, cardId]
    ).catch(() => {});
    recordTelemetry({ category: 'product', eventType: 'lesson.progress_submitted', actorId: req.user.id, boardId: req.params.id, metadata: { surface: 'board' } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[boards] quiz progress error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── Speaking Studio recordings ─────────────────────────────────────────
   A student hands in a spoken answer; the board owner listens. Audio is a
   short Opus/AAC clip sent as base64 (≤ 6 MB decoded, ≤ 5 minutes). */
const REC_MIME = /^audio\/(webm|ogg|mp4|mpeg|aac|x-m4a)(;.*)?$/i;
router.post('/:id/recordings', async (req, res) => {
  try {
    const { cardId, promptIdx, prompt, mime, durationMs, audio } = req.body || {};
    if (!cardId || !audio || !REC_MIME.test(String(mime || ''))) return res.status(400).json({ error: 'Recording required' });
    const access = await loadBoardAccess(req.params.id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access to this board' });
    if (!boardHasVisibleCard(access, cardId, req.user.id)) return res.status(404).json({ error: 'Card not found' });
    const buf = Buffer.from(String(audio), 'base64');
    if (!buf.length || buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: 'Recording is too long' });
    const ms = Math.max(0, Math.min(300000, parseInt(durationMs, 10) || 0));
    const { rows } = await pool.query(
      `INSERT INTO speaking_recordings (board_id, card_id, user_id, prompt_idx, prompt, mime, duration_ms, audio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at`,
      [req.params.id, String(cardId).slice(0, 80), req.user.id, Math.max(0, parseInt(promptIdx, 10) || 0),
       String(prompt || '').slice(0, 600), String(mime).split(';')[0].toLowerCase(), ms, buf]
    );
    res.status(201).json({ recording: rows[0] });
  } catch (err) {
    console.error('[boards] recording error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/boards/:id/recordings?cardId= - the owner's list (no audio bytes)
router.get('/:id/recordings', async (req, res) => {
  try {
    const access = await loadBoardAccess(req.params.id, req.user.id);
    if (!access || access.access_role !== 'owner') return res.status(403).json({ error: 'Board owner access required' });
    const params = [req.params.id];
    let where = 'r.board_id = $1';
    if (req.query.cardId) { params.push(String(req.query.cardId)); where += ` AND r.card_id = $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT r.id, r.card_id, r.prompt_idx, r.prompt, r.mime, r.duration_ms, r.created_at,
              u.name AS student_name, u.email AS student_email
       FROM speaking_recordings r JOIN users u ON u.id = r.user_id
       WHERE ${where} ORDER BY r.created_at DESC LIMIT 300`, params);
    res.json({ recordings: rows });
  } catch (err) {
    console.error('[boards] recordings list error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/boards/:id/recordings/:rid/audio - owner, or the student who recorded it
router.get('/:id/recordings/:rid/audio', async (req, res) => {
  try {
    const access = await loadBoardAccess(req.params.id, req.user.id);
    if (!access) return res.status(403).end();
    const { rows } = await pool.query(
      'SELECT user_id, mime, audio FROM speaking_recordings WHERE id = $1 AND board_id = $2',
      [req.params.rid, req.params.id]);
    const r = rows[0];
    if (!r) return res.status(404).end();
    if (access.access_role !== 'owner' && String(r.user_id) !== String(req.user.id)) return res.status(403).end();
    res.set('Content-Type', r.mime);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(r.audio);
  } catch (err) {
    res.status(500).end();
  }
});

// GET /api/boards/:id/quiz-results - teacher views all student quiz results
router.get('/:id/quiz-results', async (req, res) => {
  try {
    const access = await loadBoardAccess(req.params.id, req.user.id);
    if (!access || access.access_role !== 'owner') {
      return res.status(403).json({ error: 'Board owner access required' });
    }
    const { rows } = await pool.query(`
      SELECT qr.*, u.name as student_name, u.email as student_email
      FROM quiz_results qr
      JOIN users u ON u.id = qr.user_id
      WHERE qr.board_id = $1
      ORDER BY qr.submitted_at DESC`,
      [req.params.id]);
    res.json({ results: rows });
  } catch (err) {
    console.error('[boards] quiz-results error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Card Comments ───────────────────────────────────────────────────────────────

// GET /api/boards/:id/cards/:cardId/comments
router.get('/:id/cards/:cardId/comments', requireAuth, async (req, res) => {
  try {
    const access = await loadBoardAccess(req.params.id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access to this board' });
    if (!boardHasVisibleCard(access, req.params.cardId, req.user.id)) return res.status(404).json({ error: 'Card not found' });
    const { rows } = await pool.query(`
      SELECT cc.id, cc.body, cc.created_at, u.name, u.avatar, u.role
      FROM card_comments cc
      JOIN users u ON u.id = cc.user_id
      WHERE cc.board_id = $1 AND cc.card_id = $2
      ORDER BY cc.created_at ASC`,
      [req.params.id, req.params.cardId]);
    res.json({ comments: rows });
  } catch (err) {
    console.error('[comments] GET error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/boards/:id/cards/:cardId/comments
router.post('/:id/cards/:cardId/comments', requireAuth, async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body required' });
  try {
    const access = await loadBoardAccess(req.params.id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access to this board' });
    if (!boardHasVisibleCard(access, req.params.cardId, req.user.id)) return res.status(404).json({ error: 'Card not found' });
    const { rows } = await pool.query(`
      INSERT INTO card_comments (board_id, card_id, user_id, body)
      VALUES ($1,$2,$3,$4) RETURNING id, body, created_at`,
      [req.params.id, req.params.cardId, req.user.id, body.trim().slice(0, 2000)]
    );
    res.json({ comment: { ...rows[0], name: req.user.name, avatar: req.user.avatar, role: req.user.role } });
  } catch (err) {
    console.error('[comments] POST error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/boards/:id/cards/:cardId/comments/:commentId - author or board owner
router.delete('/:id/cards/:cardId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const access = await loadBoardAccess(req.params.id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access to this board' });
    const { rowCount } = await pool.query(
      `DELETE FROM card_comments
        WHERE id=$1 AND board_id=$3 AND card_id=$4
          AND (user_id=$2 OR $5='owner')`,
      [req.params.commentId, req.user.id, req.params.id, req.params.cardId, access.access_role]
    );
    if (!rowCount) return res.status(404).json({ error: 'Comment not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
