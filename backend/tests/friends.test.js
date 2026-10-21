'use strict';

/* Island §3: friends by invitation, duels with them, a duel invite closed for good, the shared streak,
   and shared sets / progress links. Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const pool = require('../db/pool');
const friends = require('../lib/friends');
const ch = require('../lib/challenges');

let dbUp = false, anna, ben, cara;
const made = [];
const tag = crypto.randomBytes(4).toString('hex');
const mk = async name => {
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,'student','free','free') RETURNING id, name, email, timezone`, [`fr-${tag}-${made.length}@teached.test`, name]);
  made.push(u.id); return u;
};
const words = (uid, n) => Promise.all(Array.from({ length: n }, (_, i) => pool.query(
  `INSERT INTO vocabulary (user_id, word, translation, example, kind) VALUES ($1,$2,$3,$4,'word')`, [uid, 'word' + i, 'tr' + i, `I like word${i} very much.`])));

test.before(async () => {
  try { await pool.query('SELECT 1 FROM friendships LIMIT 1'); dbUp = true; } catch (_) { return; }
  anna = await mk('Anna Smith'); ben = await mk('Ben Jones'); cara = await mk('Cara Lee');
  await words(anna.id, 6); await words(ben.id, 6);
});
test.after(async () => { if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [made]); });

test('friends: one personal code, accepted once, never your own, no catalogue', async t => {
  if (!dbUp) return t.skip('no database');
  const a1 = await friends.myInvite(pool, anna), a2 = await friends.myInvite(pool, anna);
  assert.equal(a1.code, a2.code);
  assert.deepEqual(await friends.inviteInfo(pool, a1.code), { code: a1.code, from: 'Anna' });
  assert.equal(await friends.inviteInfo(pool, 'nope1234'), null);
  assert.equal((await friends.accept(pool, anna, a1.code)).status, 400);
  const r = await friends.accept(pool, ben, a1.code);
  assert.equal(r.new, true);
  assert.equal((await friends.accept(pool, ben, a1.code)).new, false, 'a second accept adds nothing');
  assert.equal(await friends.areFriends(pool, anna.id, ben.id), true);
  assert.equal(await friends.areFriends(pool, anna.id, cara.id), false);
  const list = await friends.list(pool, anna);
  assert.deepEqual(list.map(f => f.name), ['Ben']);
  assert.ok(!('email' in list[0]));
});

test('duel: a friend outside the class can be challenged, a stranger cannot, and a closed invite stays closed', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal((await ch.createDuel(pool, anna, cara.id, 'verb-hunt')).status, 403);
  const d = await ch.createDuel(pool, anna, ben.id, 'verb-hunt');
  assert.ok(d.id, JSON.stringify(d));
  assert.equal((await ch.listDuels(pool, ben.id)).length, 1);
  assert.equal((await ch.closeDuel(pool, ben, d.id)).ok, true);
  assert.equal((await ch.listDuels(pool, ben.id)).length, 0, 'gone for the one who closed it');
  const { rows: [row] } = await pool.query('SELECT status FROM duels WHERE id = $1', [d.id]);
  assert.equal(row.status, 'declined');
  assert.equal((await ch.listDuels(pool, anna.id)).length, 0, 'a declined duel is not shown to the challenger either');
  assert.equal((await ch.classmates(pool, ben.id)).some(m => m.friend), true);
});

test('shared streak: a day counts when both did something; one forgiven day a month', () => {
  const day = n => { const d = new Date(Date.UTC(2026, 9, 21)); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const a = new Set([0, 1, 2, 3].map(day)), b = new Set([0, 1, 3].map(day));
  const s = friends.sharedStreak(a, b, day(0));
  assert.equal(s.streak, 3, 'day 2 is bridged by the pair\'s freeze, day 3 counts');
  assert.deepEqual([s.today_me, s.today_them], [true, true]);
  assert.equal(friends.sharedStreak(a, new Set([day(1), day(2)]), day(0)).streak, 2, 'only one did today: the run lives on yesterday');
  assert.equal(friends.sharedStreak(a, new Set(), day(0)).streak, 0);
});

test('sharing: a set and a progress card are real links with the owner\'s invitation inside; a friend adds the set in one tap', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal((await friends.createShare(pool, cara, 'set', {})).status, 400, 'too few words');
  const s = await friends.createShare(pool, anna, 'set', { title: 'Weekend words' });
  assert.ok(s.token);
  const card = await friends.readShare(pool, s.token);
  assert.equal(card.from, 'Anna'); assert.equal(card.kind, 'set'); assert.ok(card.invite);
  assert.equal(card.payload.words.length, 6);
  const add = await friends.addSet(pool, cara, s.token);
  assert.deepEqual([add.added, add.total], [6, 6]);
  assert.equal((await friends.addSet(pool, cara, s.token)).added, 0, 'nothing twice');
  const p = await friends.createShare(pool, anna, 'progress', {});
  const pc = await friends.readShare(pool, p.token);
  assert.deepEqual(Object.keys(pc.payload).sort(), ['badges', 'level', 'streak', 'words', 'xp']);
  assert.equal(await friends.readShare(pool, 'missing'), null);
});
