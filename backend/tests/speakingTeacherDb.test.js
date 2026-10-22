'use strict';

/* The teacher's side of Talk Time on a real database (ТЗ §10 acceptance 7, 8 and §§5, 27, 28): assigning in one action (Pro),
   the report that arrives by itself, the live analytics with a fragment to hear behind every mark, errands for Tich, program
   checks from the taught topic, the minor's voice switch, who may hear a recording. Skipped without Postgres. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const pool = require('../db/pool');
const tutor = require('../lib/speaking/tutor');
const T = require('../lib/speaking/teacher');
const llm = require('../lib/speaking/llm');
const { buildContext } = require('../lib/speaking/context');

let dbUp = false, teacher, other, free, s, kid;
const made = [], tag = crypto.randomBytes(4).toString('hex');
async function user(role, name, plan = 'free') {
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,$4,'active') RETURNING id, name, email, role, timezone`, [`st-${tag}-${made.length}@teached.test`, name, role, plan]);
  made.push(u.id); return u;
}
let qn = 0;
const stubLlm = async text => {
  if (/Write ONE question/.test(text)) {
    const brief = (text.match(/Brief: ([^\n]*)/) || [])[1] || '';
    if (/Teacher's task/.test(brief)) return { question: 'Tell me about your new job. #' + (++qn) };      // a real model weaves the errand in; it never says who asked
    return { question: brief.slice(0, 60) + ' #' + (++qn) };
  }
  if (/Extract durable personal facts/.test(text)) return { newFacts: [] };
  const said = (text.match(/Student said: "([^"]*)"/) || [])[1] || '';
  if (/goed/.test(said)) return { reaction: 'Ha!', betterVersion: said.replace('goed', 'went'), hint: '', usedTargetWords: [], changedFragments: [{ said: 'goed', better: 'went', construct: 'past simple, irregular verbs', category: 'grammar', breaksMeaning: false }] };
  return { reaction: 'Nice!', betterVersion: said, changedFragments: [], hint: '', usedTargetWords: [] };
};
const noAzure = { enabled: () => false, speak: async () => null, assess: async () => null, weakestSound: () => null };
const voice = t => ({ audio: Buffer.from(t).toString('base64'), mime: 'audio/webm', sec: 20 });
const roundOf = async sid => (await pool.query('SELECT * FROM speaking_rounds WHERE session_id = $1 ORDER BY idx DESC LIMIT 1', [sid])).rows[0];

test.before(async () => {
  try { await pool.query('SELECT 1 FROM speaking_assignments LIMIT 1'); dbUp = true; } catch (_) { return; }
  llm.setLlm(stubLlm); tutor.setDeps({ azure: noAzure, stt: async buf => buf.toString('utf8') });
  teacher = await user('teacher', 'Kate Teacher', 'pro'); other = await user('teacher', 'Other Teacher', 'pro'); free = await user('teacher', 'Free Teacher', 'free');
  s = await user('student', 'Anna Smith'); kid = await user('student', 'Kid Small');
  await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level) VALUES ($1,$2,'Anna','B1')`, [teacher.id, s.id]);
  await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level, minor) VALUES ($1,$2,'Kid','A2',TRUE)`, [teacher.id, kid.id]);
  await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level) VALUES ($1,$2,'Anna','B1')`, [free.id, s.id]);
});
test.after(async () => { llm.setLlm(null); if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1)', [made]); await pool.end(); });

test('assigning: only your own student, only on Pro, in one action; the student sees it and does it; the teacher hears when it is done', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal((await T.assign(pool, other, { student_id: s.id }).catch(e => e.status)), 404, 'not your student');
  assert.equal((await T.assign(pool, free, { student_id: s.id }).catch(e => e.code)), 'PRO_REQUIRED', 'Free: homework is Pro');
  const a = await T.assign(pool, teacher, { student_id: s.id, sessions: 2, theme: 'My job' });
  assert.equal(a.sessions, 2); assert.equal(a.theme, 'My job');
  const st = await tutor.getState(pool, s);
  assert.equal(st.homework.id, a.id); assert.equal(st.homework.teacher, 'Kate'); assert.equal(st.homework.done, 0);
  assert.ok((await pool.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'homework'`, [s.id])).rows.length, 'the student is told');
  // two homework sessions; the first round of each is about the theme; no Free-plan limit applies to homework
  for (let i = 0; i < 2; i++) {
    const ses = await tutor.startSession(pool, s, { kind: 'homework' });
    const r = await roundOf(ses.session_id);
    assert.match(r.question, /theme "My job"/, 'the theme leads');
    const first = await tutor.answer(pool, s, r.id, voice('I work in a shop and goed there every day'));
    assert.equal(first.state, 'better');                                            // the stub gives no hint: straight to the better version
    await tutor.skipRound(pool, s, r.id);                                           // no repeat, no credit: the next question comes
    const r2 = await roundOf(ses.session_id);
    await tutor.answer(pool, s, r2.id, { text: 'I like my work' });                  // a clean answer counts at once
    await tutor.leave(pool, s, ses.session_id);
  }
  const after = await tutor.getState(pool, s);
  assert.equal(after.homework, null, 'done: nothing left to do');
  assert.ok((await pool.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND title LIKE '%finished the speaking practice%'`, [teacher.id])).rows.length, 'the teacher hears once');
});

test('the report arrives without any action: sessions, minutes, top recurring mistakes, recordings of assigned work only', async t => {
  if (!dbUp) return t.skip('no database');
  await pool.query(`INSERT INTO speaking_mistakes (user_id, said, better, construct, weight, occurrences, status) VALUES ($1,'goed','went','past simple, irregular verbs','recurring',4,'recurring'),($1,'a apple','an apple','articles','cosmetic',3,'recurring')`, [s.id]);
  const rep = await T.report(pool, teacher, s.id);
  assert.ok(rep.sessions >= 2); assert.ok(rep.speech_minutes > 0);
  assert.equal(rep.top_mistakes[0].construct, 'past simple, irregular verbs');
  assert.equal(rep.assignments[0].status, 'done');
  assert.ok(rep.recordings.length >= 1 && rep.recordings.every(r => r.audio_id), 'assigned work can be heard');
  // free practice is the student's own: a free session's recording is not in the report
  assert.equal(await T.report(pool, other, s.id).catch(e => e.status), 404);
});

test('who may hear a recording: the student\'s own teacher - nobody else; the student can delete them all', async t => {
  if (!dbUp) return t.skip('no database');
  const { rows: [a] } = await pool.query(`SELECT id FROM speaking_audio WHERE user_id = $1 AND kind = 'student' LIMIT 1`, [s.id]);
  assert.ok(await T.audioFor(pool, teacher, a.id));
  assert.equal(await T.audioFor(pool, other, a.id), null, 'another teacher');
  assert.equal(await tutor.getAudio(pool, kid, a.id), null, 'another student');
  assert.ok(await tutor.getAudio(pool, s, a.id), 'its owner');
  const del = await tutor.deleteRecordings(pool, s);
  assert.ok(del.deleted >= 1);
  assert.equal(await T.audioFor(pool, teacher, a.id), null, 'gone for everybody');
});

test('program checks: a topic taught yesterday is asked again as an ordinary question (source #0, at most two per session), and the analytics sees it hold or crumble', async t => {
  if (!dbUp) return t.skip('no database');
  await pool.query(`DELETE FROM speaking_topics WHERE user_id = $1`, [s.id]);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  await T.addTopic(pool, teacher, s.id, { topic: 'Past Continuous', construct: 'past continuous', lesson_date: yesterday });
  const ctx = await buildContext(pool, s);
  assert.deepEqual(ctx.dueProgramChecks.map(c => c.construct), ['past continuous']);
  assert.equal(ctx.currentTopic.topic, 'Past Continuous');
  const ses = await tutor.startSession(pool, s, { kind: 'free', inputMode: 'text' }).catch(e => e);
  const sid = ses.session_id || (await tutor.getState(pool, s)).open_session.id;
  const r = await roundOf(sid);
  assert.equal(r.source, 'program'); assert.equal(r.construct, 'past continuous');
  assert.ok(!/test/i.test(r.question), 'never called a test');
  // two slips on the construction in a week -> crumbling, each with a fragment to hear
  await pool.query(`UPDATE speaking_rounds SET answered_at = NOW(), transcript = 'I cook when he call', changed = $2::jsonb, state = 'done', student_audio = gen_random_uuid() WHERE id = $1`, [r.id, JSON.stringify([{ said: 'I cook', better: 'I was cooking', construct: 'past continuous' }])]);
  await pool.query(`INSERT INTO speaking_rounds (session_id, user_id, idx, source, question, construct, state, transcript, changed, answered_at, student_audio) VALUES ($1,$2,9,'program','q','past continuous','done','It rain all day',$3::jsonb,NOW(),gen_random_uuid())`, [sid, s.id, JSON.stringify([{ said: 'It rain', better: 'It was raining', construct: 'past continuous' }])]);
  const an = await T.analytics(pool, teacher, s.id);
  assert.equal(an.topics[0].status, 'crumbling'); assert.equal(an.topics[0].errors.length, 2);
  assert.ok(an.topics[0].errors.every(e => e.audio_id), 'every mark has a fragment to hear');
  assert.ok(an.prepare && an.prepare.constructs.includes('past continuous'), 'Tich proposes the warm-up for the next lesson');
  await tutor.leave(pool, s, sid);
});

test('an errand for Tich is woven into the next conversation and done when its round is; the student sees only a question', async t => {
  if (!dbUp) return t.skip('no database');
  await pool.query(`UPDATE speaking_sessions SET finished_at = NOW() WHERE user_id = $1 AND finished_at IS NULL`, [s.id]);
  await pool.query(`DELETE FROM speaking_topics WHERE user_id = $1`, [s.id]);
  const task = await T.addTask(pool, teacher, s.id, { instruction: 'Ask her to tell about her new job' });
  assert.equal(task.status, 'queued');
  const ses = await tutor.startSession(pool, s, { kind: 'free', inputMode: 'text' });
  const r = await roundOf(ses.session_id);
  assert.equal(r.source, 'teacherTask'); assert.ok(!/teacher/i.test(r.question), 'never "your teacher asked"');
  assert.equal((await pool.query('SELECT status FROM speaking_tasks WHERE id = $1', [task.id])).rows[0].status, 'inProgress');
  await tutor.answer(pool, s, r.id, { text: 'My new job is in a bank' });
  assert.equal((await pool.query('SELECT status FROM speaking_tasks WHERE id = $1', [task.id])).rows[0].status, 'done');
  await tutor.leave(pool, s, ses.session_id);
});

test('a minor\'s voice is off until the parent\'s consent (or the teacher\'s switch); typing still works', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal(await tutor.voiceAllowed(pool, kid.id), false);
  const st = await tutor.getState(pool, kid);
  assert.equal(st.voice_allowed, false);
  const ses = await tutor.startSession(pool, kid, {});
  const r = await roundOf(ses.session_id);
  assert.equal(await tutor.answer(pool, kid, r.id, voice('hello')).catch(e => e.code), 'VOICE_OFF');
  assert.equal((await tutor.answer(pool, kid, r.id, { text: 'I like football' })).state, 'done');
  await T.setVoice(pool, teacher, kid.id, true);
  assert.equal(await tutor.voiceAllowed(pool, kid.id), true);
  await T.setVoice(pool, teacher, kid.id, null);
  await pool.query(`UPDATE student_journal SET consent_at = NOW() WHERE student_id = $1`, [kid.id]);
  assert.equal(await tutor.voiceAllowed(pool, kid.id), true, 'the parent\'s consent in the journal opens it');
});

test('a drill is one session built from the recurring constructions; "not that correction" lands in the calibration list', async t => {
  if (!dbUp) return t.skip('no database');
  const d = await T.makeDrill(pool, teacher, { student_id: s.id });
  assert.equal(d.mode, 'drill'); assert.equal(d.sessions, 1);
  await pool.query(`UPDATE speaking_sessions SET finished_at = NOW() WHERE user_id = $1 AND finished_at IS NULL`, [s.id]);
  const ses = await tutor.startSession(pool, s, { kind: 'homework', inputMode: 'text' });
  const r = await roundOf(ses.session_id);
  assert.equal(r.source, 'recurring'); assert.equal(r.construct, 'past simple, irregular verbs');
  assert.equal((await T.flag(pool, teacher, r.id, 'better')).ok, true);
  assert.equal(await T.flag(pool, other, r.id, 'better').catch(e => e.status), 404);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM speaking_flags WHERE round_id = $1', [r.id])).rows[0].n, 1);
  assert.equal(await T.makeDrill(pool, teacher, { student_id: kid.id }).catch(e => e.code), 'NOTHING_TO_DRILL');
});
