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
    `SELECT id, name, thumbnail, updated_at, created_at,
            jsonb_array_length(data->'cards') AS card_count
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
     RETURNING id, name, thumbnail, updated_at`,
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
     RETURNING id, name, thumbnail, updated_at`,
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
