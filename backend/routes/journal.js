const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// Auto-create tables
pool.query(`
  CREATE TABLE IF NOT EXISTS student_journal (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name       VARCHAR(255) NOT NULL,
    email      VARCHAR(255),
    level      VARCHAR(20) DEFAULT 'A2',
    lessons_left INTEGER NOT NULL DEFAULT 0,
    notes      TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(()=>{});

pool.query(`
  CREATE TABLE IF NOT EXISTS attendance (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    journal_id UUID NOT NULL REFERENCES student_journal(id) ON DELETE CASCADE,
    date       DATE NOT NULL DEFAULT CURRENT_DATE,
    status     VARCHAR(20) DEFAULT 'present',
    note       TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(()=>{});

pool.query(`
  CREATE TABLE IF NOT EXISTS vocabulary (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word       VARCHAR(255) NOT NULL,
    translation VARCHAR(255) DEFAULT '',
    example    TEXT DEFAULT '',
    learned    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(()=>{});

router.use(requireAuth);

/* ── JOURNAL ── */
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT j.*, COUNT(a.id) FILTER (WHERE a.status='present') AS attended,
            COUNT(a.id) AS total_sessions
     FROM student_journal j
     LEFT JOIN attendance a ON a.journal_id = j.id
     WHERE j.teacher_id=$1
     GROUP BY j.id ORDER BY j.created_at DESC`,
    [req.user.id]
  );
  res.json({ students: rows });
});

router.post('/', async (req, res) => {
  const { name, email='', level='A2', lessons_left=0 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const { rows } = await pool.query(
    `INSERT INTO student_journal (teacher_id,name,email,level,lessons_left)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.id, name.trim(), email.trim(), level, lessons_left]
  );
  res.status(201).json({ student: rows[0] });
});

router.patch('/:id', async (req, res) => {
  const { name, email, level, lessons_left, notes } = req.body;
  const sets=[]; const p=[req.params.id, req.user.id];
  if (name!==undefined)         { p.push(name);         sets.push(`name=$${p.length}`); }
  if (email!==undefined)        { p.push(email);        sets.push(`email=$${p.length}`); }
  if (level!==undefined)        { p.push(level);        sets.push(`level=$${p.length}`); }
  if (lessons_left!==undefined) { p.push(lessons_left); sets.push(`lessons_left=$${p.length}`); }
  if (notes!==undefined)        { p.push(notes);        sets.push(`notes=$${p.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  const { rows } = await pool.query(
    `UPDATE student_journal SET ${sets.join(',')} WHERE id=$1 AND teacher_id=$2 RETURNING *`, p
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ student: rows[0] });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

/* ── ATTENDANCE ── */
router.post('/:id/attendance', async (req, res) => {
  const { date = new Date().toISOString().slice(0,10), status = 'present', note = '' } = req.body;
  // verify ownership
  const { rows: own } = await pool.query('SELECT id FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  if (!own.length) return res.status(403).json({ error: 'not your student' });
  const { rows } = await pool.query(
    `INSERT INTO attendance (teacher_id,journal_id,date,status,note)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT DO NOTHING RETURNING *`,
    [req.user.id, req.params.id, date, status, note]
  );
  // Deduct lesson if present
  if (status === 'present') {
    await pool.query(
      `UPDATE student_journal SET lessons_left = GREATEST(0, lessons_left - 1) WHERE id=$1`,
      [req.params.id]
    );
  }
  res.json({ ok: true, record: rows[0] || null });
});

router.get('/:id/attendance', async (req, res) => {
  const { rows: own } = await pool.query('SELECT id FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  if (!own.length) return res.status(403).json({ error: 'not your student' });
  const { rows } = await pool.query(
    'SELECT * FROM attendance WHERE journal_id=$1 ORDER BY date DESC LIMIT 50',
    [req.params.id]
  );
  res.json({ records: rows });
});

/* ── VOCABULARY ── */
router.get('/vocab/list', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM vocabulary WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',
    [req.user.id]
  );
  const learned = rows.filter(r=>r.learned).length;
  res.json({ words: rows, learned, toLearn: rows.length - learned });
});

router.post('/vocab', async (req, res) => {
  const { word, translation='', example='' } = req.body;
  if (!word) return res.status(400).json({ error: 'word required' });
  const { rows } = await pool.query(
    `INSERT INTO vocabulary (user_id,word,translation,example)
     VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *`,
    [req.user.id, word.trim(), translation.trim(), example.trim()]
  );
  res.status(201).json({ word: rows[0] });
});

router.patch('/vocab/:id', async (req, res) => {
  const { learned } = req.body;
  const { rows } = await pool.query(
    'UPDATE vocabulary SET learned=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
    [learned, req.params.id, req.user.id]
  );
  res.json({ word: rows[0] });
});

router.delete('/vocab/:id', async (req, res) => {
  await pool.query('DELETE FROM vocabulary WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
