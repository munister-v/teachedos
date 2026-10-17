/* Schools (18.10.2026): the organisation behind TeachEd memory hand-overs (ТЗ §8.1).

   - A teacher creates a school and is its admin.
   - The admin invites teachers by email; a teacher accepts (or declines) the
     invitation. A teacher is in one school at most.
   - A teacher in a school hands a student's memory over only within it
     (routes/memory.js). The admin never reads a dossier: they see that a teacher
     has dossiers, by student name, and can hand them to another teacher of the
     school - for a teacher who is leaving, say. Every hand-over is logged with who
     started it. */
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const memory = require('./memory');
const { MemErr, fail } = memory;

router.use(requireAuth);
router.use((req, res, next) => (req.user.role === 'student' ? fail(res, new MemErr(404, 'not_found', 'Not found')) : next()));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = msg => new MemErr(422, 'validation', msg);
const nf = (msg = 'Not found') => new MemErr(404, 'not_found', msg);
const cleanName = v => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 120);

async function membership(db, userId) {
  const { rows: [m] } = await db.query(
    `SELECT m.school_id, m.role, s.name, s.owner_id FROM school_members m JOIN schools s ON s.id = m.school_id WHERE m.user_id = $1`, [userId]);
  return m || null;
}
async function adminOf(db, userId) {
  const m = await membership(db, userId);
  if (!m || m.role !== 'admin') throw new MemErr(403, 'forbidden', 'Only the school admin can do this');
  return m;
}

/* my school (members for everyone, open invitations for the admin) and invitations to me */
router.get('/mine', async (req, res) => {
  try {
    const m = await membership(pool, req.user.id);
    let school = null;
    if (m) {
      const { rows: members } = await pool.query(
        `SELECT u.id, u.name, u.email, sm.role, sm.joined_at FROM school_members sm JOIN users u ON u.id = sm.user_id
          WHERE sm.school_id = $1 ORDER BY sm.role, u.name`, [m.school_id]);
      school = { id: m.school_id, name: m.name, role: m.role, members };
      if (m.role === 'admin') {
        const { rows: invites } = await pool.query(
          `SELECT id, email, created_at FROM school_invites WHERE school_id = $1 AND answered_at IS NULL ORDER BY created_at DESC`, [m.school_id]);
        school.invites = invites;
      }
    }
    const { rows: invitations } = await pool.query(
      `SELECT i.id, s.name AS school_name, u.name AS from_name, i.created_at
         FROM school_invites i JOIN schools s ON s.id = i.school_id LEFT JOIN users u ON u.id = i.invited_by
        WHERE LOWER(i.email) = LOWER($1) AND i.answered_at IS NULL ORDER BY i.created_at DESC`, [req.user.email]);
    res.json({ school, invitations });
  } catch (e) { fail(res, e); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const name = cleanName(req.body && req.body.name);
    if (name.length < 2) throw bad('Name your school');
    await client.query('BEGIN');
    if (await membership(client, req.user.id)) throw bad('You are already in a school');
    const { rows: [s] } = await client.query('INSERT INTO schools (name, owner_id) VALUES ($1, $2) RETURNING id, name', [name, req.user.id]);
    await client.query(`INSERT INTO school_members (user_id, school_id, role) VALUES ($1, $2, 'admin')`, [req.user.id, s.id]);
    await client.query('COMMIT');
    res.status(201).json({ school: s });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); fail(res, e); } finally { client.release(); }
});

router.patch('/', async (req, res) => {
  try {
    const m = await adminOf(pool, req.user.id);
    const name = cleanName(req.body && req.body.name);
    if (name.length < 2) throw bad('Name your school');
    await pool.query('UPDATE schools SET name = $2 WHERE id = $1', [m.school_id, name]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

/* deleting the school: everyone is in no school again; logs and dossiers stay */
router.delete('/', async (req, res) => {
  try {
    const m = await adminOf(pool, req.user.id);
    await pool.query('DELETE FROM schools WHERE id = $1', [m.school_id]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.post('/invites', async (req, res) => {
  try {
    const m = await adminOf(pool, req.user.id);
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Write a valid email');
    if (email === String(req.user.email).toLowerCase()) throw bad('This is your own email');
    const { rows: [u] } = await pool.query('SELECT id, role FROM users WHERE LOWER(email) = $1', [email]);
    if (u && u.role === 'student') throw bad('This is a student account - invite teachers only');
    if (u) {
      const in_ = await membership(pool, u.id);
      if (in_ && in_.school_id === m.school_id) throw bad('This teacher is already in your school');
      if (in_) throw bad('This teacher is already in another school');
    }
    const { rows: [i] } = await pool.query(
      `INSERT INTO school_invites (school_id, email, invited_by) VALUES ($1, $2, $3)
       ON CONFLICT (school_id, LOWER(email)) WHERE answered_at IS NULL DO UPDATE SET created_at = NOW(), invited_by = EXCLUDED.invited_by
       RETURNING id, email, created_at`, [m.school_id, email, req.user.id]);
    if (u) createNotification(u.id, 'school_invite', `${req.user.name || 'A teacher'} invited you to ${m.name}`, 'Open your profile, School, to accept.', 'profile.html#school').catch(() => {});
    res.status(201).json({ invite: i });
  } catch (e) { fail(res, e); }
});

router.delete('/invites/:id', async (req, res) => {
  try {
    const m = await adminOf(pool, req.user.id);
    if (!UUID.test(req.params.id)) throw nf();
    const { rowCount } = await pool.query('DELETE FROM school_invites WHERE id = $1 AND school_id = $2 AND answered_at IS NULL', [req.params.id, m.school_id]);
    if (!rowCount) throw nf();
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

async function answer(req, res, accepted) {
  const client = await pool.connect();
  try {
    if (!UUID.test(req.params.id)) throw nf();
    await client.query('BEGIN');
    const { rows: [i] } = await client.query(
      `SELECT i.id, i.school_id, i.invited_by, s.name FROM school_invites i JOIN schools s ON s.id = i.school_id
        WHERE i.id = $1 AND LOWER(i.email) = LOWER($2) AND i.answered_at IS NULL FOR UPDATE`, [req.params.id, req.user.email]);
    if (!i) throw nf('This invitation is no longer open');
    if (accepted && await membership(client, req.user.id)) throw bad('You are already in a school. Leave it first.');
    await client.query('UPDATE school_invites SET answered_at = NOW(), accepted = $2 WHERE id = $1', [i.id, accepted]);
    if (accepted) {
      await client.query(`INSERT INTO school_members (user_id, school_id, role) VALUES ($1, $2, 'teacher')`, [req.user.id, i.school_id]);
      // other open invitations to this teacher are answered by joining one school
      await client.query(`UPDATE school_invites SET answered_at = NOW(), accepted = FALSE WHERE LOWER(email) = LOWER($1) AND answered_at IS NULL`, [req.user.email]);
    }
    await client.query('COMMIT');
    if (i.invited_by) createNotification(i.invited_by, 'school_invite', `${req.user.name || req.user.email} ${accepted ? 'joined' : 'declined to join'} ${i.name}`, null, 'profile.html#school').catch(() => {});
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); fail(res, e); } finally { client.release(); }
}
router.post('/invites/:id/accept', (req, res) => answer(req, res, true));
router.post('/invites/:id/decline', (req, res) => answer(req, res, false));

/* a teacher leaves; the admin leaves only by deleting the school */
router.post('/leave', async (req, res) => {
  try {
    const m = await membership(pool, req.user.id);
    if (!m) throw nf('You are not in a school');
    if (m.role === 'admin') throw bad('You are the admin. Delete the school instead, or keep it.');
    await pool.query('DELETE FROM school_members WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

router.delete('/members/:userId', async (req, res) => {
  try {
    const m = await adminOf(pool, req.user.id);
    if (!UUID.test(req.params.userId) || req.params.userId === req.user.id) throw nf();
    const { rowCount } = await pool.query(`DELETE FROM school_members WHERE user_id = $1 AND school_id = $2 AND role = 'teacher'`, [req.params.userId, m.school_id]);
    if (!rowCount) throw nf();
    res.json({ ok: true });
  } catch (e) { fail(res, e); }
});

/* The admin sees THAT a teacher of the school has dossiers - student names only,
   never a field - so they can hand them to a colleague. */
async function memberOfMySchool(db, adminSchool, userId) {
  if (!UUID.test(String(userId))) throw nf();
  const { rows: [t] } = await db.query(
    `SELECT u.id, u.name FROM school_members sm JOIN users u ON u.id = sm.user_id WHERE sm.user_id = $1 AND sm.school_id = $2`, [userId, adminSchool]);
  if (!t) throw nf('Not a teacher of your school');
  return t;
}
router.get('/members/:userId/dossiers', async (req, res) => {
  try {
    const m = await adminOf(pool, req.user.id);
    const t = await memberOfMySchool(pool, m.school_id, req.params.userId);
    const { rows } = await pool.query(
      `SELECT d.journal_id AS id, COALESCE(j.name, d.archived_name, 'A student') AS student_name, d.archived_at IS NOT NULL AS archived
         FROM student_dossier d LEFT JOIN student_journal j ON j.id = d.journal_id AND j.teacher_id = d.teacher_id
        WHERE d.teacher_id = $1 ORDER BY 2`, [t.id]);
    res.json({ teacher: { id: t.id, name: t.name }, dossiers: rows });
  } catch (e) { fail(res, e); }
});

/* body: { to_teacher_id, ids: [journal ids] } - hands those dossiers over, logged as
   started by the school admin; both teachers are told, the students are not */
router.post('/members/:userId/handover', async (req, res) => {
  const client = await pool.connect();
  try {
    const m = await adminOf(client, req.user.id);
    const from = await memberOfMySchool(client, m.school_id, req.params.userId);
    const to = await memberOfMySchool(client, m.school_id, req.body && req.body.to_teacher_id);
    if (to.id === from.id) throw bad('Choose another teacher');
    const ids = (Array.isArray(req.body && req.body.ids) ? req.body.ids : []).filter(id => UUID.test(String(id))).slice(0, 500);
    if (!ids.length) throw bad('Choose the students to hand over');
    await client.query('BEGIN');
    const done = [];
    for (const id of ids) done.push(await memory.handoverDossier(client, { fromId: from.id, fromName: from.name, journalId: id, to, initiatedBy: 'school_admin' }));
    await client.query('COMMIT');
    for (const d of done) memory.notifyHandover(to.id, `${req.user.name || 'Your school admin'} (for ${from.name || 'a colleague'})`, d);
    if (from.id !== req.user.id) {
      createNotification(from.id, 'memory_handover', `${req.user.name || 'Your school admin'} handed ${done.length} of your students' TeachEd memory to ${to.name || 'a colleague'}`, null, 'index.html#students').catch(() => {});
    }
    res.json({ ok: true, handed: done.length, landed: done.map(d => d.landed) });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); fail(res, e); } finally { client.release(); }
});

module.exports = router;
