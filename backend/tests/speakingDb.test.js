'use strict';

/* The Speaking Tutor circle on a real database with stubbed model, speech-to-text and Azure
   (ТЗ acceptance §10: 1, 2, 4, 5, 6, 9, 10). Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const pool = require('../db/pool');
const tutor = require('../lib/speaking/tutor');
const llm = require('../lib/speaking/llm');

let dbUp = false, teacher, s;
const made = [], tag = crypto.randomBytes(4).toString('hex');
async function user(role, name) {
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,'free','free') RETURNING id, name, email, role, timezone`, [`sp-${tag}-${made.length}@teached.test`, name, role]);
  made.push(u.id); return u;
}
let qn = 0, azureIssues = [];
const stubLlm = async (text) => {
  if (/Write ONE question/.test(text)) return { question: 'Stub question ' + (++qn) + '?' };
  if (/Extract durable personal facts/.test(text)) return { newFacts: ['has a dog named Lucky'] };
  const said = (text.match(/Student said: "([^"]*)"/) || [])[1] || '';
  if (/goed/.test(said)) return { reaction: 'Ha, sounds like a fun day!', betterVersion: said.replace('goed', 'went'), hint: 'Listen - that was yesterday...', usedTargetWords: [],
    changedFragments: [{ said: 'goed', better: 'went', construct: 'past simple, irregular verbs', category: 'grammar', breaksMeaning: false }] };
  return { reaction: 'Nice one!', betterVersion: said, changedFragments: [], hint: '', usedTargetWords: [] };
};
const stubAzure = { enabled: () => false, speak: async () => null, assess: async () => (azureIssues.length ? { accuracy: 70, fluency: 80, issues: azureIssues.shift() } : { accuracy: 95, fluency: 90, issues: [] }), weakestSound: r => (r && r.issues[0]) || null };

test.before(async () => {
  try { await pool.query('SELECT 1 FROM speaking_rounds LIMIT 1'); dbUp = true; } catch (_) { return; }
  llm.setLlm(stubLlm);
  tutor.setDeps({ azure: stubAzure, stt: async (buf) => buf.toString('utf8') });         // the "audio" is its own transcript
  teacher = await user('teacher', 'Kate Teacher'); s = await user('student', 'Anna Smith');
  await pool.query(`INSERT INTO student_journal (teacher_id, student_id, name, level) VALUES ($1,$2,'Anna','A2')`, [teacher.id, s.id]);
});
test.after(async () => { llm.setLlm(null); if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1)', [made]); await pool.end(); });

const voice = text => ({ audio: Buffer.from(text).toString('base64'), mime: 'audio/webm', sec: 12 });
const lastRound = async (sid) => (await pool.query('SELECT * FROM speaking_rounds WHERE session_id = $1 ORDER BY idx DESC LIMIT 1', [sid])).rows[0];

test('a new student: the first session comes from the starter bank of their level, and the circle runs - hint, self-correction, no better version', async t => {
  if (!dbUp) return t.skip('no database');
  const st = await tutor.startSession(pool, s, {});
  assert.equal(st.messages.filter(m => m.author === 'tich' && m.kind === 'text').length, 1);
  const r1 = await lastRound(st.session_id);
  assert.equal(r1.source, 'starter');
  // the slip -> one hint, a second try
  const a1 = await tutor.answer(pool, s, r1.id, voice('Yesterday I goed to the shop'));
  assert.equal(a1.state, 'hinted');
  assert.deepEqual(a1.messages.map(m => m.kind), ['voice', 'text', 'hint']);
  assert.equal(a1.messages[0].text, 'Yesterday I goed to the shop', 'the transcript is under the voice bubble');
  // fixed it herself: no better version
  const a2 = await tutor.answer(pool, s, r1.id, voice('Yesterday I went to the shop'));
  assert.equal(a2.state, 'done');
  assert.ok(!a2.messages.some(m => m.kind === 'betterVersion'), 'a self-fix hides the better version');
  assert.ok(a2.messages.some(m => m.meta && m.meta.selfFixed));
  const { rows: log } = await pool.query('SELECT * FROM speaking_mistakes WHERE user_id = $1', [s.id]);
  assert.equal(log.length, 1); assert.equal(log[0].self_fixed, 1, 'logged as self-fixed'); assert.equal(log[0].construct, 'past simple, irregular verbs');
  assert.equal((await lastRound(st.session_id)).idx, 1, 'the next question was asked');
});

test('the better version, the repeat that must happen, two repeats at most, then the next question', async t => {
  if (!dbUp) return t.skip('no database');
  const open = (await tutor.getState(pool, s)).open_session;
  const r = await lastRound(open.id);
  // a slip, hinted, a second try that is still wrong -> the one better version
  await tutor.answer(pool, s, r.id, voice('We goed home'));
  const a = await tutor.answer(pool, s, r.id, voice('We goed home late'));
  assert.equal(a.state, 'better');
  const bv = a.messages.find(m => m.kind === 'betterVersion');
  assert.equal(bv.text, 'We went home late'); assert.equal(bv.meta.changed.length, 1);
  const { rows: ph } = await pool.query('SELECT * FROM speaking_phrases WHERE user_id = $1', [s.id]);
  assert.equal(ph.length, 1, 'the better version is in the Phrase Bank'); assert.equal(ph[0].text, 'We went home late');
  assert.equal((await pool.query('SELECT state FROM speaking_rounds WHERE id = $1', [r.id])).rows[0].state, 'better', 'no repeat, no credit');
  // the repeat: Azure finds one weak sound -> one more try; the second repeat closes the round whatever the sound
  azureIssues = [[{ word: 'went', phoneme: 'w', score: 40 }], [{ word: 'went', phoneme: 'w', score: 50 }]];
  const r1 = await tutor.repeat(pool, s, r.id, { audio: Buffer.from('x').toString('base64'), sec: 3 });
  assert.equal(r1.state, 'better'); assert.deepEqual(r1.weakest, { word: 'went', phoneme: 'w' });
  assert.ok(!JSON.stringify(r1).includes('"score"'), 'no number leaves the server');
  const r2 = await tutor.repeat(pool, s, r.id, { audio: Buffer.from('x').toString('base64'), sec: 3 });
  assert.equal(r2.state, 'done');
  assert.ok(r2.messages.some(m => m.author === 'tich' && m.kind === 'text' && /Stub question/.test(m.text)), 'the next question follows');
  assert.equal(await tutor.repeat(pool, s, r.id, { audio: 'eA==' }).catch(e => e.status), 409, 'a finished round cannot be repeated again');
});

test('a clean answer counts at once; a typed session pays half XP; leaving keeps the finished rounds', async t => {
  if (!dbUp) return t.skip('no database');
  const open = (await tutor.getState(pool, s)).open_session;
  const r = await lastRound(open.id);
  const a = await tutor.answer(pool, s, r.id, { text: 'I like cooking with my family' });
  assert.equal(a.state, 'done');
  const m = await tutor.leave(pool, s, open.id);
  assert.equal(m.kind, 'sessionSummary');
  assert.equal(m.meta.rounds_done, 3);
  assert.equal(m.meta.pairs.length, 1, 'only the round with a better version is a pair');
  assert.equal(m.meta.goal, 'past simple, irregular verbs', 'the one goal of the session');
  assert.equal(m.meta.input_mode, 'voice');
  assert.equal(m.meta.xp, 12, '3 of 5 rounds of 20 XP');
  const { rows: [x] } = await pool.query(`SELECT xp FROM xp_events WHERE user_id = $1 AND kind = 'speaking'`, [s.id]);
  assert.equal(x.xp, 12);
  assert.equal((await tutor.finishSession(pool, s, open.id)).id, m.id, 'finishing twice pays once');
});

test('the free plan: two sessions a week start; the third is refused at the start, not in the middle', async t => {
  if (!dbUp) return t.skip('no database');
  const second = await tutor.startSession(pool, s, {});
  assert.equal(second.resumed, false);
  await tutor.leave(pool, s, second.session_id);
  const err = await tutor.startSession(pool, s, {}).catch(e => e);
  assert.equal(err.code, 'FREE_LIMIT'); assert.equal(err.status, 403);
  await pool.query(`UPDATE users SET plan = 'pro', plan_status = 'active' WHERE id = $1`, [teacher.id]);
  assert.equal((await tutor.startSession(pool, s, {})).resumed, false, 'a Pro teacher lifts the limit');
});

test('the daily audio cap and the answer length hold whatever the client sends', async t => {
  if (!dbUp) return t.skip('no database');
  const open = (await tutor.getState(pool, s)).open_session;
  const r = await lastRound(open.id);
  await pool.query(`INSERT INTO speaking_audio (user_id, kind, mime, sec, bytes) VALUES ($1,'student','audio/webm',1700,'x')`, [s.id]);
  const ok = await tutor.answer(pool, s, r.id, { ...voice('I like tea'), sec: 9999 });       // clamped to 90 s; still under the cap before it
  assert.equal(ok.state, 'done');
  const { rows: [a] } = await pool.query(`SELECT MAX(sec) AS m FROM speaking_audio WHERE user_id = $1 AND mime = 'audio/webm' AND sec < 1000`, [s.id]);
  assert.ok(a.m <= 90, 'an answer is at most 90 seconds');
  const next = await lastRound(open.id);
  const err = await tutor.answer(pool, s, next.id, voice('I like coffee')).catch(e => e);
  assert.equal(err.code, 'DAILY_CAP'); assert.equal(err.status, 429);
  assert.equal((await tutor.answer(pool, s, next.id, { text: 'I like coffee' })).state, 'done', 'typing still works: the cap is for assessed audio');
});

test('two clean sessions in a row fix a recurring construction, and it stops being asked', async t => {
  if (!dbUp) return t.skip('no database');
  await pool.query(`DELETE FROM speaking_mistakes WHERE user_id = $1`, [s.id]);
  await pool.query(`INSERT INTO speaking_mistakes (user_id, said, better, construct, weight, occurrences, status) VALUES ($1,'goed','went','past simple, irregular verbs','recurring',4,'recurring')`, [s.id]);
  const plan = require('../lib/speaking/engine').buildSessionPlan(await require('../lib/speaking/context').buildContext(pool, s));
  assert.equal(plan[0].construct, 'past simple, irregular verbs', 'the recurring slip leads the next session');
  // two finished sessions where that construction was asked and came out clean
  for (let i = 0; i < 2; i++) {
    const { rows: [ses] } = await pool.query(`INSERT INTO speaking_sessions (user_id, kind, total_rounds) VALUES ($1,'free',1) RETURNING id`, [s.id]);
    await pool.query(`INSERT INTO speaking_rounds (session_id, user_id, idx, source, question, construct, state, transcript) VALUES ($1,$2,0,'recurring','q','past simple, irregular verbs','done','I went')`, [ses.id, s.id]);
    await tutor.finishSession(pool, s, ses.id);
  }
  assert.equal((await pool.query(`SELECT status FROM speaking_mistakes WHERE user_id = $1`, [s.id])).rows[0].status, 'fixed');
});
