const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');

router.use(requireAuth);

/* ── GET /api/courses — list teacher's courses ────────────────────────── */
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.description, c.level, c.color, c.created_at,
            COUNT(DISTINCT b.id)::int AS board_count
     FROM courses c
     LEFT JOIN boards b ON b.course_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [req.user.id]
  );
  res.json({ courses: rows });
});

/* ── POST /api/courses — create course ───────────────────────────────── */
router.post('/', requireTeacher, async (req, res) => {
  const { name = 'New Course', description = '', level = '', color = '#FF4B8B' } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO courses (user_id, name, description, level, color)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.id, name.trim().slice(0,255), description, level, color]
  );
  res.status(201).json({ course: rows[0] });
});

/* ── GET /api/courses/:id — full course with modules + boards ─────────── */
router.get('/:id', async (req, res) => {
  const { rows: cr } = await pool.query(
    'SELECT * FROM courses WHERE id=$1 AND user_id=$2',
    [req.params.id, req.user.id]
  );
  if (!cr.length) return res.status(404).json({ error: 'Course not found' });
  const course = cr[0];

  const { rows: modules } = await pool.query(
    `SELECT * FROM course_modules WHERE course_id=$1 ORDER BY ord, created_at`,
    [course.id]
  );

  const { rows: boards } = await pool.query(
    `SELECT id, name, thumbnail, updated_at, course_id, module_id, board_order,
            jsonb_array_length(data->'cards') AS card_count
     FROM boards
     WHERE course_id=$1
     ORDER BY board_order, updated_at DESC`,
    [course.id]
  );

  // attach boards to their modules
  const modMap = {};
  modules.forEach(m => { modMap[m.id] = { ...m, boards: [] }; });
  const unassigned = [];
  boards.forEach(b => {
    if (b.module_id && modMap[b.module_id]) modMap[b.module_id].boards.push(b);
    else unassigned.push(b);
  });

  res.json({ course, modules: Object.values(modMap), unassigned });
});

/* ── PATCH /api/courses/:id — rename / update course ─────────────────── */
router.patch('/:id', async (req, res) => {
  const { name, description, level, color } = req.body;
  const sets = [], params = [req.params.id, req.user.id];
  if (name        !== undefined) { params.push(name.trim().slice(0,255)); sets.push(`name=$${params.length}`); }
  if (description !== undefined) { params.push(description);              sets.push(`description=$${params.length}`); }
  if (level       !== undefined) { params.push(level);                    sets.push(`level=$${params.length}`); }
  if (color       !== undefined) { params.push(color);                    sets.push(`color=$${params.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  const { rows } = await pool.query(
    `UPDATE courses SET ${sets.join(',')} WHERE id=$1 AND user_id=$2 RETURNING *`, params
  );
  if (!rows.length) return res.status(404).json({ error: 'Course not found' });
  res.json({ course: rows[0] });
});

/* ── DELETE /api/courses/:id — delete course (boards stay, unlinked) ─── */
router.delete('/:id', async (req, res) => {
  await pool.query(
    'UPDATE boards SET course_id=NULL, module_id=NULL WHERE course_id=$1',
    [req.params.id]
  );
  const { rowCount } = await pool.query(
    'DELETE FROM courses WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Course not found' });
  res.json({ ok: true });
});

/* ── POST /api/courses/:id/modules — add module ──────────────────────── */
router.post('/:id/modules', requireTeacher, async (req, res) => {
  const { name = 'New Module', ord = 0 } = req.body;
  const { rows: own } = await pool.query(
    'SELECT id FROM courses WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
  );
  if (!own.length) return res.status(404).json({ error: 'Course not found' });
  const { rows } = await pool.query(
    `INSERT INTO course_modules (course_id, name, ord) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.id, name.trim().slice(0,255), ord]
  );
  res.status(201).json({ module: rows[0] });
});

/* ── PATCH /api/courses/:id/modules/:mid — rename / reorder module ───── */
router.patch('/:id/modules/:mid', async (req, res) => {
  const { name, ord } = req.body;
  const sets = [], params = [req.params.mid, req.params.id];
  if (name !== undefined) { params.push(name.trim().slice(0,255)); sets.push(`name=$${params.length}`); }
  if (ord  !== undefined) { params.push(ord);                      sets.push(`ord=$${params.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  const { rows } = await pool.query(
    `UPDATE course_modules SET ${sets.join(',')} WHERE id=$1 AND course_id=$2 RETURNING *`, params
  );
  if (!rows.length) return res.status(404).json({ error: 'Module not found' });
  res.json({ module: rows[0] });
});

/* ── DELETE /api/courses/:id/modules/:mid — delete module ────────────── */
router.delete('/:id/modules/:mid', async (req, res) => {
  await pool.query(
    'UPDATE boards SET module_id=NULL WHERE module_id=$1', [req.params.mid]
  );
  const { rowCount } = await pool.query(
    'DELETE FROM course_modules WHERE id=$1 AND course_id=$2', [req.params.mid, req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Module not found' });
  res.json({ ok: true });
});

/* ── PATCH /api/courses/:id/boards/:bid — assign board to module/order ─ */
router.patch('/:id/boards/:bid', async (req, res) => {
  const { module_id, board_order } = req.body;
  const sets = [`course_id=$3`], params = [req.params.bid, req.user.id, req.params.id];
  if (module_id   !== undefined) { params.push(module_id);    sets.push(`module_id=$${params.length}`); }
  if (board_order !== undefined) { params.push(board_order);  sets.push(`board_order=$${params.length}`); }
  const { rows } = await pool.query(
    `UPDATE boards SET ${sets.join(',')} WHERE id=$1 AND user_id=$2 RETURNING id,name,course_id,module_id,board_order`,
    params
  );
  if (!rows.length) return res.status(404).json({ error: 'Board not found' });
  res.json({ board: rows[0] });
});

/* ── DELETE /api/courses/:id/boards/:bid — remove board from course ──── */
router.delete('/:id/boards/:bid', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE boards SET course_id=NULL, module_id=NULL
     WHERE id=$1 AND user_id=$2 AND course_id=$3
     RETURNING id`,
    [req.params.bid, req.user.id, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Board not found' });
  res.json({ ok: true });
});

/* ── GET /api/courses/shared — courses shared with me (as student) ───── */
router.get('/shared/list', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT c.id, c.name, c.description, c.level, c.color,
            u.name AS owner_name, u.avatar AS owner_avatar
     FROM board_collaborators bc
     JOIN boards b  ON b.id = bc.board_id
     JOIN courses c ON c.id = b.course_id
     JOIN users u   ON u.id = c.user_id
     WHERE bc.user_id=$1
     ORDER BY c.name`,
    [req.user.id]
  );
  res.json({ courses: rows });
});

module.exports = router;
