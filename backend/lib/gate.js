/* The C1 gate (and the gate of every other level): readiness is measured from what the student
   really did - words that landed for good, videos watched and articles read to the end, days they
   showed up. At 90% the gate opens: three sentences of pitch, and the teacher decides. A "not yet"
   always comes with a plan, never just "no". */

const xp = require('./xp');
const hubcontent = require('./hubcontent');
const { createNotification } = require('../routes/notifications');

const OPEN_AT = 90;
const VOCAB_TARGET = { A1: 30, A2: 80, B1: 150, B2: 250, C1: 400 };
const PASS = 70;

const pct = (n, of) => Math.max(0, Math.min(100, Math.round(n / of * 100)));

async function readiness(db, user) {
  const from = await hubcontent.levelOf(db, user.id);
  const to = xp.nextLevel(from);
  const q = async (sql, p = [user.id]) => (await db.query(sql, p)).rows[0];
  const mastered = (await q(`SELECT COUNT(*)::int AS n FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND (learned OR interval_days >= 21)`)).n;
  const watched = (await q(`SELECT COUNT(*)::int AS n FROM hub_progress p JOIN hub_materials m ON m.id = p.material_id WHERE p.user_id = $1 AND p.finished_at IS NOT NULL AND m.kind = 'watch'`)).n;
  const read = (await q(`SELECT COUNT(*)::int AS n FROM hub_progress p JOIN hub_materials m ON m.id = p.material_id WHERE p.user_id = $1 AND p.finished_at IS NOT NULL AND m.kind = 'read'`)).n;
  const days = (await q(`SELECT COUNT(DISTINCT (created_at AT TIME ZONE 'UTC')::date)::int AS n FROM xp_events WHERE user_id = $1 AND kind <> 'backfill' AND created_at > NOW() - INTERVAL '30 days'`)).n;
  const rows = [
    { key: 'vocab', label: 'Vocabulary range', pct: pct(mastered, VOCAB_TARGET[from] || 150), detail: mastered + ' words landed for good' },
    { key: 'watch', label: 'Listening stamina', pct: pct(watched, 6), detail: watched + ' videos watched to the end' },
    { key: 'read', label: 'Reading stamina', pct: pct(read, 6), detail: read + ' pieces read to the end' },
    { key: 'days', label: 'Showing up', pct: pct(days, 20), detail: days + ' active days in the last 30' },
  ].map(r => ({ ...r, ok: r.pct >= PASS }));
  const total = Math.round(rows.reduce((n, r) => n + r.pct, 0) / rows.length);
  const { rows: [g] } = await db.query(`SELECT id, status, plan, pitch, created_at, decided_at FROM level_gates WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [user.id]);
  return { from, to, pct: total, open: total >= OPEN_AT, open_at: OPEN_AT, rows, request: g || null };
}

const sentences = t => String(t || '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 3);

async function pitch(db, user, text) {
  const r = await readiness(db, user);
  if (!r.open) return { error: 'The gate opens at ' + OPEN_AT + '% - you are at ' + r.pct + '%', status: 403 };
  if (r.request && r.request.status === 'pending') return { error: 'Your pitch is with your teacher already', status: 409 };
  if (sentences(text).length < 3) return { error: 'Three sentences, please: why you are ready for ' + r.to + '.', status: 400 };
  const { rows: [t] } = await db.query('SELECT teacher_id FROM student_journal WHERE student_id = $1 ORDER BY created_at DESC LIMIT 1', [user.id]);
  if (!t) return { error: 'Your teacher is not linked to your account yet', status: 409 };
  const { rows: [g] } = await db.query(
    `INSERT INTO level_gates (user_id, teacher_id, level_from, level_to, pitch, readiness) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [user.id, t.teacher_id, r.from, r.to, String(text).trim().slice(0, 1200), r.pct]);
  createNotification(t.teacher_id, 'level', (user.name || 'A student') + ' is ready for ' + r.to, 'They sent a 3-sentence pitch. Open Homework to confirm the level or give a plan.', 'homework.html').catch(() => {});
  return { id: g.id };
}

async function pending(db, teacherId) {
  const { rows } = await db.query(
    `SELECT g.id, g.level_from, g.level_to, g.pitch, g.readiness, g.created_at, u.name FROM level_gates g JOIN users u ON u.id = g.user_id
      WHERE g.teacher_id = $1 AND g.status = 'pending' ORDER BY g.created_at`, [teacherId]);
  return rows;
}

async function decide(db, teacher, id, decision, plan) {
  const { rows: [g] } = await db.query(`SELECT * FROM level_gates WHERE id::text = $1 AND teacher_id = $2 AND status = 'pending'`, [String(id), teacher.id]);
  if (!g) return { error: 'Nothing to decide', status: 404 };
  if (decision === 'confirm') {
    const { rows: [t] } = await db.query('SELECT COALESCE(SUM(xp),0)::int AS n FROM xp_events WHERE user_id = $1', [g.user_id]);
    await db.query(`UPDATE level_gates SET status = 'confirmed', decided_at = NOW() WHERE id = $1`, [g.id]);
    await db.query(`INSERT INTO level_moments (user_id, level_to, xp_at) VALUES ($1,$2,$3)`, [g.user_id, g.level_to, t.n]);
    await db.query(`UPDATE student_journal SET level = $2 WHERE student_id = $1 AND teacher_id = $3`, [g.user_id, g.level_to, teacher.id]);
    await xp.award(db, g.user_id, 'level', g.id, 100, 'Level moment · ' + g.level_to + ' confirmed');
    createNotification(g.user_id, 'level', 'Welcome to ' + g.level_to, 'Your teacher confirmed the level. The climb starts again from Base Camp.', 'student-hub.html').catch(() => {});
    return { status: 'confirmed' };
  }
  if (decision === 'not_yet') {
    const p = String(plan || '').trim();
    if (p.length < 10) return { error: 'A "not yet" comes with a plan - tell them what to do next', status: 400 };
    await db.query(`UPDATE level_gates SET status = 'not_yet', plan = $2, decided_at = NOW() WHERE id = $1`, [g.id, p.slice(0, 600)]);
    createNotification(g.user_id, 'level', 'Not yet - and here is the plan', p.slice(0, 200), 'student-hub.html').catch(() => {});
    return { status: 'not_yet' };
  }
  return { error: 'confirm or not_yet', status: 400 };
}

module.exports = { readiness, pitch, pending, decide, OPEN_AT };
