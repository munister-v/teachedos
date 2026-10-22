'use strict';

/* Retention phase 2: the absence detector. 7 / 14 days away becomes a hint to the student's own teacher; one
   touch per absence, the teacher's own line in the student's hub; when the student is back the teacher hears it.
   Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const pool = require('../db/pool');
const absence = require('../lib/absence');
const today = require('../lib/today');
const { sendAbsenceNotes } = require('../jobs/classPulse');

let dbUp = false, teacher, stranger, maria, boris, nina, newbie;
const made = [];
const tag = crypto.randomBytes(4).toString('hex');
const mk = async (name, role = 'student') => {
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,'free','free') RETURNING id, name, email, role, timezone`, [`ab-${tag}-${made.length}@teached.test`, name, role]);
  made.push(u.id); return u;
};
const active = (u, ago) => pool.query(`INSERT INTO xp_events (user_id, kind, ref, xp, label, created_at) VALUES ($1,'qa',$2,5,'qa', NOW() - ($3 || ' days')::interval)`, [u.id, 'ab-' + ago + '-' + Math.random(), String(ago)]);
const enrol = (t, s) => pool.query(`INSERT INTO student_journal (teacher_id, student_id, name) VALUES ($1,$2,$3)`, [t.id, s.id, s.name]);

test.before(async () => {
  try { await pool.query('SELECT 1 FROM absence_nudges LIMIT 1'); dbUp = true; } catch (_) { return; }
  teacher = await mk('Kristina T', 'teacher'); stranger = await mk('Other T', 'teacher');
  maria = await mk('Maria Koval'); boris = await mk('Boris Ray'); nina = await mk('Nina Fresh'); newbie = await mk('Never Started');
  for (const s of [maria, boris, nina, newbie]) await enrol(teacher, s);
  await active(maria, 12); await active(boris, 8); await active(nina, 2);       // newbie never did anything
});
test.after(async () => { if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [made]); });

test('7 and 14 days away are hints, longest first; recent students and those who never started are not', async t => {
  if (!dbUp) return t.skip('no database');
  const { alerts } = await absence.alerts(pool, teacher);
  assert.deepEqual(alerts.map(a => [a.name, a.days, a.tier]), [['Maria', 12, 7], ['Boris', 8, 7]]);
  await pool.query(`INSERT INTO xp_events (user_id, kind, ref, xp, label, created_at) VALUES ($1,'qa','ab-long',5,'qa', NOW() - INTERVAL '15 days')`, [nina.id]);
  assert.equal((await absence.alerts(pool, stranger)).alerts.length, 0, 'a teacher sees only their own students');
  assert.match(alerts[0].suggest, /^Hi Maria! .* - Kristina$/);
  assert.equal((await absence.alerts(pool, maria)).status, 403);
});

test('the touch: the teacher\'s own line, only to their own student, once per absence, no push', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal((await absence.nudge(pool, stranger, maria.id, 'Hello there')).status, 404);
  assert.equal((await absence.nudge(pool, teacher, nina.id, 'Hello there')).status, 409, 'Nina was here two days ago');
  assert.equal((await absence.nudge(pool, teacher, maria.id, 'x')).status, 400);
  const sent = await absence.nudge(pool, teacher, maria.id, 'Hi Maria! Five minutes is enough. - Kristina');
  assert.equal(sent.ok, true);
  assert.equal((await absence.nudge(pool, teacher, maria.id, 'Again?')).status, 409, 'one per absence');
  const note = (await pool.query(`SELECT type, title FROM notifications WHERE user_id = $1`, [maria.id])).rows[0];
  assert.equal(note.type, 'teacher_note'); assert.match(note.title, /^Kristina wrote to you/);
  const after = (await absence.alerts(pool, teacher)).alerts.find(a => a.name === 'Maria');
  assert.ok(after.sent, 'the card says it was sent and does not ask again');
});

test('Today shows the teacher\'s note until the student closes it; the student coming back tells the teacher', async t => {
  if (!dbUp) return t.skip('no database');
  const t1 = await today.buildToday(pool, maria);
  assert.equal(t1.teacher_note.teacher, 'Kristina'); assert.match(t1.teacher_note.text, /Five minutes/);
  assert.equal((await absence.markSeen(pool, boris.id, t1.teacher_note.id)).status, 404, 'not someone else\'s note');
  assert.equal((await absence.markSeen(pool, maria.id, t1.teacher_note.id)).ok, true);
  assert.equal((await today.buildToday(pool, maria)).teacher_note, null);
  assert.equal((await pool.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'student_back'`, [teacher.id])).rowCount, 0, 'still away');
  await active(maria, 0);
  await today.buildToday(pool, maria);
  const back = (await pool.query(`SELECT title FROM notifications WHERE user_id = $1 AND type = 'student_back'`, [teacher.id])).rows;
  assert.equal(back.length, 1); assert.equal(back[0].title, 'Maria is back');
  await today.buildToday(pool, maria);
  assert.equal((await pool.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'student_back'`, [teacher.id])).rowCount, 1, 'told once');
});

test('Monday 08:00 in the teacher\'s time: one note about who is away, none on other days, once a week', async t => {
  if (!dbUp) return t.skip('no database');
  const monday = new Date('2026-10-26T12:00:00Z'), tuesday = new Date('2026-10-27T12:00:00Z');
  await pool.query(`UPDATE users SET timezone = 'UTC' WHERE id = $1`, [teacher.id]);
  assert.equal(await sendAbsenceNotes(tuesday) >= 0, true);
  assert.equal((await pool.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'absence'`, [teacher.id])).rowCount, 0);
  await sendAbsenceNotes(monday);
  const n = (await pool.query(`SELECT title FROM notifications WHERE user_id = $1 AND type = 'absence'`, [teacher.id])).rows;
  assert.equal(n.length, 1); assert.match(n[0].title, /Boris has not been in the hub for \d+ days/, 'Maria is back, Boris is the one away');
  await sendAbsenceNotes(monday);
  assert.equal((await pool.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'absence'`, [teacher.id])).rowCount, 1);
});
