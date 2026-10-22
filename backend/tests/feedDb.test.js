'use strict';

/* Retention phase 2: the teachers' feed. Cards and a published lesson are posts; «Тиць» and the two facts
   (took to the board, taught it) are counted, never faked; three reports hide a post until a person looks; a
   question gets answers and its author hears; the dashboard digest is a door of at most three lines; students
   never touch it. Skipped when no Postgres answers. */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const pool = require('../db/pool');
const feed = require('../lib/feed');

let dbUp = false, kate, ivan, olga, pete, student, lesson;
const made = [];
const tag = crypto.randomBytes(4).toString('hex');
const mk = async (name, role = 'teacher') => {
  const { rows: [u] } = await pool.query(`INSERT INTO users (email, password_hash, name, role, plan, plan_status) VALUES ($1,'x',$2,$3,'free','free') RETURNING id, name, email, role, timezone`, [`fd-${tag}-${made.length}@teached.test`, name, role]);
  made.push(u.id); return u;
};
const ids = async u => (await feed.list(pool, u, { open: false, limit: 30 })).posts.map(p => p.id);

test.before(async () => {
  try { await pool.query('SELECT 1 FROM feed_posts LIMIT 1'); dbUp = true; } catch (_) { return; }
  kate = await mk('Kate Author'); ivan = await mk('Ivan Reader'); olga = await mk('Olga Reader'); pete = await mk('Pete Reader'); student = await mk('Stu Dent', 'student');
  const { rows: [a] } = await pool.query(
    `INSERT INTO assignments (user_id, kind, title, level, visibility, published_at, first_public_at) VALUES ($1,'lesson','Small talk at the airport','B1','community', NOW(), NOW()) RETURNING id`, [kate.id]);
  lesson = a.id;
});
test.after(async () => { if (dbUp) await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [made]); });

test('a lesson published to the library falls into the feed once, as a lesson card that is one object with it', async t => {
  if (!dbUp) return t.skip('no database');
  await feed.onPublished(pool, lesson); await feed.onPublished(pool, lesson);
  const { posts } = await feed.list(pool, ivan, { open: false });
  const post = posts.find(p => p.lesson_id === lesson);
  assert.ok(post, 'the colleague sees it'); assert.equal(posts.filter(p => p.lesson_id === lesson).length, 1);
  assert.equal(post.card.kind, 'lesson'); assert.equal(post.author.name, 'Kate'); assert.equal(post.card.snapshot.title, 'Small talk at the airport');
  await pool.query(`UPDATE assignments SET visibility = 'private' WHERE id = $1`, [lesson]);
  assert.ok(!(await ids(ivan)).includes(post.id), 'unpublished: gone from the feed with it');
  await pool.query(`UPDATE assignments SET visibility = 'community' WHERE id = $1`, [lesson]);
});

test('«took to the board» and «taught it» are the library\'s own facts, not clicks; «Тиць» is one tap, never on your own', async t => {
  if (!dbUp) return t.skip('no database');
  const post = (await feed.list(pool, ivan, { open: false })).posts.find(p => p.lesson_id === lesson);
  assert.equal(post.took, 0); assert.equal(post.taught, 0);
  await pool.query(`INSERT INTO library_copies (assignment_id, user_id, target, title) VALUES ($1,$2,'board','x'),($1,$2,'board','x'),($1,$3,'board','x'),($1,$4,'board','own')`, [lesson, ivan.id, olga.id, kate.id]);
  const sess = await pool.query(`INSERT INTO lesson_sessions (teacher_id) VALUES ($1) RETURNING id`, [ivan.id]).catch(() => null);
  if (sess) await pool.query(`INSERT INTO verified_uses (assignment_id, teacher_id, lesson_session_id) VALUES ($1,$2,$3)`, [lesson, ivan.id, sess.rows[0].id]);
  const again = (await feed.list(pool, olga, { open: false })).posts.find(p => p.lesson_id === lesson);
  assert.equal(again.took, 2, 'two colleagues, the author\'s own copy and repeats not counted');
  if (sess) assert.equal(again.taught, 1);
  assert.deepEqual(await feed.react(pool, ivan, post.id), { tyts: 1, tyted: true });
  assert.deepEqual(await feed.react(pool, ivan, post.id), { tyts: 0, tyted: false });
  assert.equal((await feed.react(pool, kate, post.id)).status, 400);
  assert.equal((await feed.react(pool, student, post.id)).status, 403);
});

test('a text post, a card of one\'s own, and a question with answers - the author hears about the answer', async t => {
  if (!dbUp) return t.skip('no database');
  assert.equal((await feed.createPost(pool, student, { kind: 'text', text: 'hello' })).status, 403);
  assert.equal((await feed.createPost(pool, ivan, { kind: 'text', text: 'x' })).status, 400);
  const q = await feed.createPost(pool, ivan, { kind: 'question', text: 'How do you teach the present perfect to teens?' });
  assert.equal(q.ok, true);
  const a = await feed.answer(pool, olga, q.id, 'Start from "ever" questions about their own lives.');
  assert.equal(a.ok, true);
  assert.equal((await feed.answers(pool, kate, q.id)).answers[0].name, 'Olga');
  assert.equal((await pool.query(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'feed'`, [ivan.id])).rowCount, 1, 'Ivan is told a colleague answered');
  const view = (await feed.list(pool, kate, { open: false })).posts.find(p => p.id === q.id);
  assert.equal(view.answers, 1);
  const code = crypto.randomBytes(5).toString('hex');
  await pool.query(`INSERT INTO share_cards (code, owner_id, kind, mode, snapshot) VALUES ($1,$2,'wordday','brag','{"word":"serendipity"}')`, [code, olga.id]);
  assert.equal((await feed.postCard(pool, olga, code)).ok, true);
  assert.equal((await feed.postCard(pool, olga, code)).already, true);
  assert.equal((await feed.postCard(pool, ivan, code)).status, 404, 'only the owner posts a card');
  await pool.query('UPDATE share_cards SET revoked_at = NOW() WHERE code = $1', [code]);
  assert.ok(!(await feed.list(pool, kate, { open: false })).posts.some(p => p.card && p.card.code === code), 'a taken-down card leaves the feed');
});

test('post-moderation: three reports hide a post until a person looks; restored, it stays', async t => {
  if (!dbUp) return t.skip('no database');
  const p = await feed.createPost(pool, pete, { kind: 'text', text: 'Buy my miracle course now' });
  assert.equal((await feed.report(pool, pete, 'post', p.id)).status, 400, 'not your own');
  await feed.report(pool, kate, 'post', p.id); await feed.report(pool, kate, 'post', p.id);   // a repeat is one report
  assert.ok((await ids(ivan)).includes(p.id));
  await feed.report(pool, ivan, 'post', p.id);
  assert.ok((await ids(ivan)).includes(p.id), 'two distinct reports are not enough');
  assert.equal((await feed.report(pool, olga, 'post', p.id)).hidden, true);
  assert.ok(!(await ids(ivan)).includes(p.id));
  assert.ok((await feed.reviewQueue(pool)).pending.some(x => x.id === p.id));
  await feed.review(pool, 'post', p.id, 'restore');
  assert.ok((await ids(ivan)).includes(p.id));
});

test('the digest is a door of at most three lines; Tich posts the word of the day once and welcomes a new teacher', async t => {
  if (!dbUp) return t.skip('no database');
  assert.deepEqual((await feed.digest(pool, student)).lines, []);
  await pool.query('UPDATE users SET feed_seen_at = NOW() - INTERVAL \'3 days\' WHERE id = ANY($1::uuid[])', [[kate.id, ivan.id]]);
  await feed.ensureOfficial(pool); await feed.ensureOfficial(pool);
  assert.equal((await pool.query(`SELECT 1 FROM feed_posts WHERE official = 'word_day' AND day = CURRENT_DATE`)).rowCount, 1);
  const k = await feed.digest(pool, kate);
  assert.ok(k.lines.length >= 2 && k.lines.length <= 3);
  assert.ok(k.lines.some(l => /taken to a board/.test(l.label) && l.count === 2));
  assert.ok(k.lines.some(l => /word of the day/.test(l.label)));
  assert.ok(k.lines.every(l => l.href === 'community.html#feed'));
  const i = await feed.digest(pool, ivan);
  assert.ok(i.lines.some(l => /question was answered/.test(l.label) && l.count === 1));
  const fresh = (await feed.list(pool, kate)).posts;
  assert.equal(fresh[0].official, 'welcome', 'a new teacher meets Tich first');
  const after = (await feed.digest(pool, kate)).lines;
  assert.ok(!after.some(l => /word of the day/.test(l.label)), 'what was seen in the feed leaves the digest');
  assert.ok(after.some(l => /taken to a board/.test(l.label)), 'the day\'s takes stay until tomorrow');
});
