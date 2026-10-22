'use strict';

/* Retention phase 1: the students' circle. Who sees what (class and friends only, nobody else), «Тиць» as the
   only reaction, a card of one's own, the line from Tich for a duel won (the loser is never named), the class
   teacher's post and one-tap hide, stepping out. Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const pool = require('../db/pool');
const circle = require('../lib/circle');
const ch = require('../lib/challenges');
const friends = require('../lib/friends');

let dbUp = false, teacher, anna, ben, cara, dan;
const made = [];
const tag = crypto.randomBytes(4).toString('hex');
const mk = async (name, role = 'student') => {
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,'free','free') RETURNING id, name, email, role, timezone`, [`ci-${tag}-${made.length}@teached.test`, name, role]);
  made.push(u.id); return u;
};
const enrol = (t, s) => pool.query(`INSERT INTO student_journal (teacher_id, student_id, name) VALUES ($1,$2,$3)`, [t.id, s.id, s.name]);
const card = async (u, kind = 'streak') => {
  const code = crypto.randomBytes(5).toString('hex');
  await pool.query(`INSERT INTO share_cards (code, owner_id, kind, mode, snapshot) VALUES ($1,$2,$3,'brag',$4)`, [code, u.id, kind, JSON.stringify({ audience: 'student', studentName: u.name.split(' ')[0], streak: 7 })]);
  return code;
};
const ids = async u => (await circle.feed(pool, u, { open: false })).posts.map(p => p.id);

test.before(async () => {
  try { await pool.query('SELECT 1 FROM circle_posts LIMIT 1'); dbUp = true; } catch (_) { return; }
  teacher = await mk('Kristina T', 'teacher'); anna = await mk('Anna Smith'); ben = await mk('Ben Jones'); cara = await mk('Cara Lee'); dan = await mk('Dan Ray');
  await enrol(teacher, anna); await enrol(teacher, ben);              // Anna and Ben are one class; Cara and Dan are outside it
  const [a, b] = anna.id < dan.id ? [anna.id, dan.id] : [dan.id, anna.id];
  await pool.query('INSERT INTO friendships (a_id, b_id) VALUES ($1,$2)', [a, b]);   // Dan is Anna's friend
});
test.after(async () => { if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [made]); });

test('a card goes into the circle: classmates and friends see it, a stranger does not; a taken-down card disappears', async t => {
  if (!dbUp) return t.skip('no database');
  const code = await card(anna);
  const out = await circle.shareCard(pool, anna, code);
  assert.equal(out.ok, true); assert.equal(out.seen_by, 2, 'Ben (class) and Dan (friend)');
  assert.equal((await circle.shareCard(pool, anna, code)).already, true, 'the same card is one post');
  const benFeed = await circle.feed(pool, ben, { open: false });
  assert.equal(benFeed.posts.length, 1);
  assert.equal(benFeed.posts[0].author.name, 'Anna'); assert.equal(benFeed.posts[0].card.kind, 'streak'); assert.equal(benFeed.posts[0].can_duel, true);
  assert.equal((await circle.feed(pool, dan, { open: false })).posts.length, 1, 'a friend outside the class');
  assert.equal((await circle.feed(pool, cara, { open: false })).posts.length, 0, 'a stranger sees nothing');
  assert.equal((await circle.shareCard(pool, ben, code)).status, 404, 'only the owner can post a card');
  await pool.query('UPDATE share_cards SET revoked_at = NOW() WHERE code = $1', [code]);
  assert.equal((await circle.feed(pool, ben, { open: false })).posts.length, 0);
});

test('«Тиць» is the one reaction: once, toggled, never on your own post, never on one you cannot see', async t => {
  if (!dbUp) return t.skip('no database');
  const code = await card(anna, 'levelup'); await circle.shareCard(pool, anna, code);
  const [post] = (await circle.feed(pool, ben, { open: false })).posts;
  assert.deepEqual(await circle.react(pool, ben, post.id), { tyts: 1, tyted: true });
  assert.equal((await circle.feed(pool, ben, { open: false })).posts[0].tyted, true);
  assert.equal((await circle.feed(pool, dan, { open: false })).posts[0].tyts, 1, 'the count is public to the circle');
  assert.deepEqual(await circle.react(pool, ben, post.id), { tyts: 0, tyted: false });
  assert.equal((await circle.react(pool, anna, post.id)).status, 400);
  assert.equal((await circle.react(pool, cara, post.id)).status, 404);
});

test('a duel won is one line from Tich - the winner only, the loser is not named, posted once', async t => {
  if (!dbUp) return t.skip('no database');
  const { rows: [d] } = await pool.query(
    `INSERT INTO duels (challenger_id, opponent_id, game, status, questions, challenger_score, challenger_ms, opponent_score, opponent_ms)
     VALUES ($1,$2,'verb-hunt','active','[]'::jsonb,7,40000,5,38000) RETURNING *`, [ben.id, anna.id]);
  const winner = await ch.finishDuel(pool, d);
  assert.equal(winner, ben.id);
  const { posts } = await circle.feed(pool, anna, { open: false });
  const line = posts.find(p => p.kind === 'tich');
  assert.ok(line, 'Anna, who lost, sees Ben\'s win line');
  assert.match(line.text, /^Ben won a duel/); assert.doesNotMatch(line.text, /Anna/);
  assert.equal(line.author.tich, true);
  await circle.postDuelWin(pool, d, ben.id, require('../lib/duel').GAMES);
  assert.equal((await circle.feed(pool, anna, { open: false })).posts.filter(p => p.kind === 'tich').length, 1);
  assert.equal((await circle.react(pool, anna, line.id)).tyts, 1, 'the loser can still say Tiц');
});

test('the class teacher posts to the class and hides a post in one tap; the teaser shows others, at most two', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal((await circle.teacherPost(pool, anna, { text: 'hi' })).status, 403);
  const post = await circle.teacherPost(pool, teacher, { text: 'Word of the week: serendipity' });
  assert.equal(post.ok, true); assert.equal(post.students, 2);
  const mine = (await circle.feed(pool, anna, { open: false })).posts.find(p => p.kind === 'teacher');
  assert.equal(mine.author.name, 'Kristina'); assert.equal(mine.author.teacher, true);
  assert.equal((await circle.feed(pool, cara, { open: false })).posts.length, 0, 'outside the class nothing');
  const tz = await circle.teaser(pool, anna);
  assert.ok(tz.posts.length <= 2 && tz.posts.every(p => !p.author.me));
  const aPost = (await circle.teacherList(pool, teacher)).posts.find(p => p.kind === 'card');
  assert.ok(aPost, 'the teacher sees the class posts');
  assert.equal((await circle.setHidden(pool, teacher, aPost.id, true)).ok, true);
  assert.ok(!(await ids(ben)).includes(aPost.id), 'hidden for the class');
  assert.equal((await circle.setHidden(pool, cara, aPost.id, false)).status, 404, 'a stranger is not a moderator');
});

test('stepping out: no new posts, the old ones vanish for others, and coming back restores them', async t => {
  if (!dbUp) return t.skip('no database');
  await circle.setVisible(pool, anna, false);
  assert.equal((await circle.shareCard(pool, anna, await card(anna, 'week'))).status, 409);
  assert.equal((await circle.feed(pool, ben, { open: false })).posts.filter(p => p.author.name === 'Anna' && p.kind !== 'teacher').length, 0);
  assert.equal((await circle.settings(pool, anna)).visible, false);
  await circle.setVisible(pool, anna, true);
  assert.equal((await circle.settings(pool, anna)).visible, true);
});
