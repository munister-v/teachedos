'use strict';

/* The contour through the real /api/ai/teacher-tool route, with the model stubbed:
   a bad first draft is regenerated, the metrics row is written, and what reaches the
   teacher carries no platform terms. Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const http = require('http');
const express = require('express');

const pool = require('../db/pool');
const { signToken } = require('../middleware/auth');
const aiEngine = require('../lib/aiEngine');
const { isClean } = require('../lib/glossary');

let dbUp = false, server, base, hadRow = true;
const made = [];
const orig = {};
const tag = crypto.randomBytes(4).toString('hex');

const PP_BAD = 'Maya is at the market. On Friday, Maya has brought her lunch to work. She has never eaten there before. Her friend has just arrived. They have already ordered. Maya has lost her keys. I have looked everywhere. Maya has found a phone.';
const PP_GOOD = 'Maya is at the market. She has brought her lunch to work today. She has never eaten there before. Her friend has just arrived. They have already ordered. Maya has lost her keys. I have looked everywhere. Maya has found a phone.';

async function teacher(role = 'teacher', plan = 'pro') {
  const { rows: [u] } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,$4,'active') RETURNING id`,
    [`gr-${tag}-${made.length}@teached.test`, 'Guard Teacher', role, plan]);
  const sid = crypto.randomUUID(); const jwt = signToken(u.id, sid);
  await pool.query(`INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1,$2,$3, NOW() + INTERVAL '1 day')`, [sid, u.id, crypto.createHash('sha256').update(jwt).digest('hex')]);
  made.push(u.id);
  return { id: u.id, jwt };
}
const call = async (u, method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + u.jwt }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test.before(async () => {
  try {
    await pool.query('SELECT 1');
    for (let i = 0; ; i++) { try { await require('../db/migrate')(); break; } catch (e) { if (i >= 3) throw e; await new Promise(r => setTimeout(r, 400 * (i + 1))); } }
    // the metrics rows these tests add are removed again - unless that row was already there for real
    const { rows } = await pool.query(`SELECT 1 FROM guardrail_daily WHERE day = CURRENT_DATE AND skill = 'grammar' AND tool_id = 'text-topic-vocab'`);
    hadRow = rows.length > 0;
    for (const k of ['enabled', 'generate', 'rawGenerate', 'getLastTrace', 'getLastModel', 'getLastTier']) orig[k] = aiEngine[k];
    aiEngine.enabled = () => true;
    aiEngine.getLastModel = () => 'stub-model';
    aiEngine.getLastTier = () => 'ai';
    aiEngine.getLastTrace = () => ({ usage: { prompt_tokens: 10, completion_tokens: 10 } });
    const app = express();
    app.use(express.json());
    app.use('/api/ai', require('../routes/ai'));
    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${server.address().port}`;
    dbUp = true;
  } catch (e) { console.error('[guardrailsDb] skipped:', e.message); dbUp = false; }
});
test.after(async () => {
  Object.assign(aiEngine, orig);
  if (dbUp && made.length) {
    if (!hadRow) await pool.query(`DELETE FROM guardrail_daily WHERE day = CURRENT_DATE AND skill = 'grammar' AND tool_id = 'text-topic-vocab'`).catch(() => {});
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [made]);
  }
  server && server.close();
  await pool.end().catch(() => {});
});
const db = (name, fn) => test(name, async t => { if (!dbUp) return t.skip('no database'); await fn(t); });

const body = (topic, over = {}) => ({ toolId: 'text-topic-vocab', input: { toolId: 'text-topic-vocab', level: 'B1', topic: `${topic} ${tag}`, lesson: 'grammar', parts: { form: true, glossary: false, before: false, after: false }, ...over } });

db('a bad first draft is generated again and the teacher gets the good one, with no badge', async () => {
  const t = await teacher();
  const prompts = [];
  let n = 0;
  aiEngine.generate = async input => { prompts.push(String(input.extra || '')); return { cards: [{ title: '📖 Reading text', text: ++n === 1 ? PP_BAD : PP_GOOD }] }; };
  aiEngine.rawGenerate = async () => ({ ok: true, issues: [] });
  const before = (await pool.query(`SELECT COALESCE(SUM(generations),0)::int AS g, COALESCE(SUM(first_pass_failed),0)::int AS f, COALESCE(SUM(regenerated),0)::int AS r FROM guardrail_daily WHERE skill = 'grammar'`)).rows[0];
  const r = await call(t, 'POST', '/api/ai/teacher-tool', body('Present Perfect'));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const q = r.body.output.quality;
  assert.equal(q.check.status, 'regenerated'); assert.equal(q.checkMe, undefined);
  assert.equal(n, 2);
  assert.match(prompts[0], /Level target: At B1, a learner/, 'the level brief from the bank is in the first prompt');
  assert.match(prompts[1], /time that is over/, 'and the reason is in front of the model the second time');
  assert.ok(r.body.output.cards[0].text.includes('today'));
  await new Promise(r => setTimeout(r, 300));
  const after = (await pool.query(`SELECT COALESCE(SUM(generations),0)::int AS g, COALESCE(SUM(first_pass_failed),0)::int AS f, COALESCE(SUM(regenerated),0)::int AS r FROM guardrail_daily WHERE skill = 'grammar'`)).rows[0];
  assert.deepEqual([after.g - before.g, after.f - before.f, after.r - before.r], [1, 1, 1]);
});

db('a draft that never passes arrives as "check me" with the reason in plain words', async () => {
  const t = await teacher();
  aiEngine.generate = async () => ({ cards: [{ title: '📖 Reading text', text: PP_BAD }] });
  aiEngine.rawGenerate = async () => ({ ok: true, issues: [] });
  const r = await call(t, 'POST', '/api/ai/teacher-tool', body('Present Perfect', { variant: 1 }));
  assert.equal(r.status, 200);
  const q = r.body.output.quality;
  assert.deepEqual([q.check.status, q.checkMe, q.level], ['check_me', true, 'amber']);
  assert.match(q.notes[0], /time that is over/);
  assert.ok(q.notes.every(n => isClean(n, { visible: true })));
  assert.equal(JSON.stringify(r.body).match(/guardrail|descriptor|calibrat/i), null);
});

db('other lessons go through exactly as before', async () => {
  const t = await teacher();
  let n = 0;
  aiEngine.generate = async () => { n++; return { cards: [{ title: '📖 Reading text', text: 'A short text about a city that is long enough to count as a card for sure.' }] }; };
  aiEngine.rawGenerate = async () => { throw new Error('must not be asked'); };
  const r = await call(t, 'POST', '/api/ai/teacher-tool', { toolId: 'text-topic-vocab', input: { toolId: 'text-topic-vocab', level: 'B1', topic: 'City ' + tag, lesson: 'reading' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(n, 1); assert.equal(r.body.output.quality.check, undefined);
});

db('the metric is an admin-only number: triggers per 100 generations', async () => {
  const t = await teacher(), admin = await teacher('admin');
  assert.equal((await call(t, 'GET', '/api/ai/guardrails')).status, 403);
  const r = await call(admin, 'GET', '/api/ai/guardrails?days=7');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.rows) && 'triggers_per_100' in r.body.total);
  const row = r.body.rows.find(x => x.skill === 'grammar');
  assert.ok(row && row.bank_version.match(/^\d+\.\d+\.\d+\+/));
  assert.equal(JSON.stringify(r.body).includes('Maya'), false, 'counts only - no lesson content');
});
