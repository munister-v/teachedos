'use strict';

/* The feed fills itself: a student with no teacher still gets pieces at their level and interests; "not
   interested" removes a piece and scores its interest down; three in a row hide the interest.
   Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const pool = require('../db/pool');
const hub = require('../lib/hubcontent');
const auto = require('../lib/hubauto');

let dbUp = false, s;
const tag = crypto.randomBytes(4).toString('hex');
const ids = [];

test.before(async () => {
  try { await pool.query('SELECT source FROM hub_materials LIMIT 1'); dbUp = true; } catch (_) { return; }
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x','Solo Student','student','free','free') RETURNING id, name, email, timezone`, [`ha-${tag}@teached.test`]);
  s = u;
  await pool.query(`INSERT INTO student_dna (user_id, interests, level) VALUES ($1, ARRAY['sport','science'], 'A2')`, [s.id]);
});
test.after(async () => {
  if (!dbUp) return;
  if (ids.length) await pool.query('DELETE FROM hub_materials WHERE id = ANY($1::uuid[])', [ids]);
  await pool.query('DELETE FROM users WHERE id = $1', [s.id]);
});

const fakeMag = n => ({
  headline: 'Auto piece ' + n, category: 'Sport', readMinutes: 3,
  paragraphs: ['The match began late because the pitch was wet. Fans waited under umbrellas.', 'A goal came early. The crowd cheered loudly and the captain raised the trophy.'],
  vocab: ['match', 'pitch', 'umbrellas', 'goal', 'captain'].map(t => ({ term: t, definition: 'meaning of ' + t })),
});
const fakeDeps = (n, urlTag) => ({
  newsFeeds: { search: async () => ({ items: [{ url: `https://example.test/${tag}/${urlTag}`, title: 't' }] }), readArticle: async () => ({ title: 't', text: 'x', source: 'Test', url: `https://example.test/${tag}/${urlTag}` }) },
  buildMagazine: async () => fakeMag(n),
});

test('auto: a piece is built once per article and lands at the level and interest', async t => {
  if (!dbUp) return t.skip('no database');
  const id = await auto.ensure(pool, { level: 'A2', interest: 'sport' }, fakeDeps(1, 'one'));
  assert.ok(id); ids.push(id);
  assert.equal(await auto.ensure(pool, { level: 'A2', interest: 'sport' }, fakeDeps(2, 'one')), null, 'same article is not built twice');
  const { rows: [m] } = await pool.query('SELECT source, interest, level, jsonb_array_length(words) AS w, teacher_id FROM hub_materials WHERE id = $1', [id]);
  assert.deepEqual([m.source, m.interest, m.level, m.teacher_id], ['auto', 'sport', 'A2', null]);
  assert.ok(m.w >= 4);
});

test('feed: a student with no teacher gets the piece, can open it, and dismissing scores the interest down', async t => {
  if (!dbUp) return t.skip('no database');
  let f = await hub.feed(pool, s);
  assert.equal(f.level, 'A2');
  const mine = f.items.find(i => i.id === ids[0]);
  assert.ok(mine, 'the auto piece is in the feed');
  assert.equal(mine.from_teacher, false);
  assert.ok(await hub.detail(pool, s, ids[0]), 'and opens');
  assert.deepEqual(f.interests.sort(), ['science', 'sport']);
  assert.equal((await hub.dismiss(pool, s, ids[0])).ok, true);
  f = await hub.feed(pool, s);
  assert.ok(!f.items.some(i => i.id === ids[0]), 'dismissed piece is gone');
  const { rows: [sc] } = await pool.query(`SELECT score FROM hub_feed_scores WHERE user_id = $1 AND interest = 'sport'`, [s.id]);
  assert.equal(sc.score, -1);
});

test('feed: three "not interested" in a row hide the interest', async t => {
  if (!dbUp) return t.skip('no database');
  for (let i = 2; i <= 4; i++) {
    const id = await auto.ensure(pool, { level: 'A2', interest: 'sport' }, fakeDeps(i, 'p' + i));
    if (id) { ids.push(id); await hub.dismiss(pool, s, id); }
  }
  await pool.query(`INSERT INTO hub_feed_scores (user_id, interest, score) VALUES ($1,'sport',-3) ON CONFLICT (user_id, interest) DO UPDATE SET score = -3`, [s.id]);
  const f = await hub.feed(pool, s);
  assert.ok(!f.items.some(i => i.interest === 'sport'));
});

test('interests: the first visit saves chips, unknown keys are dropped', async t => {
  if (!dbUp) return t.skip('no database');
  const r = await hub.setInterests(pool, s, ['travel', 'nonsense', 'food']);
  assert.deepEqual(r.interests, ['travel', 'food']);
  const f = await hub.feed(pool, s);
  assert.equal(f.need_interests, false);
});
