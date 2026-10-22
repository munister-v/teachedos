/* The hub's Today: the day as one numbered plan, the Lucky Task (one pull a day), the Treat of the
   day and "what's new" since the student last caught up. Everything is built from what the
   platform really knows: the Word Bank's flights, open homework, the teacher's challenge, duels. */

const xp = require('./xp');
const wordbank = require('./wordbank');
const challenges = require('./challenges');
const { phraseFor, localDay, PHRASES } = require('./phrases');
const hub = require('./hubcontent');

const LUCKY_BASE_XP = 50, LUCKY_BONUS = 1.5, TREAT_XP = 5;
const DECOYS = ['Voice-note story', 'Speed round', 'Five words, one story'];

const hash = str => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const dueWords = (iso, tz) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: tz });
};
const hoursLeft = iso => { const h = Math.max(0, Math.round((new Date(iso) - Date.now()) / 3600000)); return h >= 48 ? Math.floor(h / 24) + ' days' : h + 'h'; };

async function openHomework(db, userId) {
  const { rows } = await db.query(
    `SELECT a.id, a.status, h.title, h.due_at FROM homework_assignment a JOIN homework h ON h.id = a.homework_id
      WHERE a.student_id = $1 AND a.status IN ('assigned','in_progress') ORDER BY h.due_at NULLS LAST LIMIT 3`, [userId]);
  return rows;
}

/* What a Lucky Task can be: only things the platform can see being done. */
function luckyCandidates({ wb, homework, challenge, treatOpen }) {
  const out = [];
  // always possible, so a new student with an empty Word Bank still has a lucky task (island §2)
  out.push({ kind: 'read', need: 1, label: 'Finish a short read', hint: 'Open Watch & Read, read a piece to the end and pass its quiz.', go: 'watchread' });
  if (treatOpen) out.push({ kind: 'treat', need: 1, label: 'Keep today’s phrase', hint: 'Save the phrase of the day to your Word Bank.', go: 'today' });
  if (wb.total >= 5) out.push({ kind: 'words', need: 5, label: 'Review 5 words', hint: 'Five repetitions in your Word Bank today.', go: 'wordbank' });
  if (homework[0]) out.push({ kind: 'homework', need: 1, label: 'Hand in “' + String(homework[0].title).slice(0, 60) + '”', hint: 'Finish your open homework.', go: 'homework', ref: homework[0].id });
  if (challenge && !challenge.done) out.push({ kind: 'challenge', need: 1, label: 'Do today’s challenge', hint: 'The one your teacher set for today.', go: 'challenges' });
  return out;
}

async function luckyState(db, user, ctx) {
  const tz = challenges.tzOf(user), day = challenges.dayIn(tz);
  const cands = luckyCandidates(ctx);
  const { rows: [pull] } = await db.query('SELECT * FROM lucky_pulls WHERE user_id = $1 AND day = $2::date', [user.id, day]);
  if (!pull && !cands.length) return null;
  const pool = [...cands.map(c => c.label), ...DECOYS];
  const base = { xp: Math.round(LUCKY_BASE_XP * LUCKY_BONUS), base_xp: LUCKY_BASE_XP, bonus: LUCKY_BONUS, pool };
  if (!pull) return { state: 'sealed', ...base };
  const meta = { kind: pull.kind, need: pull.need, label: pull.label };
  /* the 30-second task from the student's own words is answered right in the pop-up (answerLucky) */
  if (RECALL.has(pull.kind)) {
    const q = parseRef(pull.ref);
    if (pull.completed_at) return { state: 'done', task: { ...meta, progress: 1, result: q.result || null }, ...base };
    return { state: 'revealed', task: { ...meta, progress: 0, hint: 'Pick the meaning — about thirty seconds.', quiz: { prompt: q.word, options: q.options, word_id: q.word_id || null } }, ...base };
  }
  const go = ({ words: 'wordbank', homework: 'homework', challenge: 'challenges', read: 'watchread', treat: 'today' })[pull.kind];
  if (!pull.completed_at) {
    const { rows: [c] } = await db.query(
      `SELECT COUNT(*)::int AS n FROM xp_events WHERE user_id = $1 AND kind = $2 AND created_at >= $3`,
      [user.id, ({ words: 'word', homework: 'homework', challenge: 'challenge', read: 'hubquiz', treat: 'treat' })[pull.kind], pull.pulled_at]);
    if (c.n >= pull.need) {
      const done = await db.query('UPDATE lucky_pulls SET completed_at = NOW() WHERE user_id = $1 AND day = $2::date AND completed_at IS NULL', [user.id, day]);
      if (done.rowCount) {
        await xp.award(db, user.id, 'lucky', day, base.xp, 'Lucky Task done');
        return { state: 'done', just_done: true, task: { ...meta, go, progress: pull.need }, ...base };
      }
    } else return { state: 'revealed', task: { ...meta, go, ref: pull.ref, progress: c.n, hint: (cands.find(x => x.kind === pull.kind) || {}).hint || '' }, ...base };
  }
  return { state: 'done', task: { ...meta, go, progress: pull.need }, ...base };
}

/* The task of the day is a 30-60 second action from the student's own material: the word that is
   about to be forgotten (overdue first, then the one forgotten most often), its meaning picked from
   four. A student with too few words gets the phrase of the day instead. */
const RECALL = new Set(['recall', 'phrase']);
const parseRef = r => { try { return JSON.parse(r) || {}; } catch (_) { return {}; } };
const shuffle = (arr, seed) => arr.map((x, i) => ({ x, k: hash(seed + ':' + i) })).sort((a, b) => a.k - b.k).map(o => o.x);
function recallTask(ctx, seed, level) {
  const all = [...ctx.wb.queue, ...ctx.wb.air, ...(ctx.wb.waiting || [])].filter(w => w.translation && w.translation.trim());
  const edge = all.filter(w => w.status === 'LAST CALL' || w.status === 'DELAYED')
    .concat(all.filter(w => w.stage !== 'new').sort((a, b) => b.lapses - a.lapses || (a.in_days || 0) - (b.in_days || 0)))
    .concat(all);
  const pick = edge[0];
  const others = [...new Set(all.filter(w => pick && w.id !== pick.id && w.translation.toLowerCase() !== pick.translation.toLowerCase()).map(w => w.translation))];
  if (pick && others.length >= 3) {
    const options = shuffle([pick.translation, ...shuffle(others, seed).slice(0, 3)], seed + pick.id);
    const w = String(pick.word).slice(0, 60);
    return { kind: 'recall', label: pick.stage === 'new' ? 'Quick: what does “' + w + '” mean?' : 'Save “' + w + '” before it slips', ref: { word_id: pick.id, word: pick.word, options, answer: options.indexOf(pick.translation) } };
  }
  const p = phraseFor(level, localDay(ctx.tz));
  const pool = Object.values(PHRASES).flat().map(x => x[1]).filter(m => m !== p.meaning);
  const options = shuffle([p.meaning, ...shuffle(pool, seed).slice(0, 3)], seed + p.phrase);
  return { kind: 'phrase', label: 'What does “' + p.phrase + '” mean?', ref: { word: p.phrase, options, answer: options.indexOf(p.meaning) } };
}

async function pullLucky(db, user) {
  const ctx = await context(db, user);
  const tz = challenges.tzOf(user), day = challenges.dayIn(tz);
  const have = await db.query('SELECT 1 FROM lucky_pulls WHERE user_id = $1 AND day = $2::date', [user.id, day]);
  if (have.rows.length) return { error: 'One pull a day - today’s task is already yours', status: 409 };
  const { rows: [lv] } = await db.query(
    `SELECT COALESCE((SELECT j.level FROM student_journal j WHERE j.student_id = $1 ORDER BY j.created_at DESC LIMIT 1), (SELECT level FROM student_dna WHERE user_id = $1)) AS level`, [user.id]).catch(() => ({ rows: [{}] }));
  const pick = recallTask(ctx, user.id + ':' + day, lv && lv.level);
  await db.query('INSERT INTO lucky_pulls (user_id, day, kind, need, label, ref) VALUES ($1,$2::date,$3,1,$4,$5) ON CONFLICT DO NOTHING',
    [user.id, day, pick.kind, pick.label.slice(0, 160), JSON.stringify(pick.ref)]);
  return { lucky: await luckyState(db, user, ctx) };
}

/* the answer: right pays the lucky bonus, wrong pays the base and shows the meaning - either way the
   task is done, the points are shown at once and the day counts for the streak */
async function answerLucky(db, user, choice) {
  const tz = challenges.tzOf(user), day = challenges.dayIn(tz);
  const { rows: [pull] } = await db.query('SELECT * FROM lucky_pulls WHERE user_id = $1 AND day = $2::date', [user.id, day]);
  if (!pull || !RECALL.has(pull.kind)) return { error: 'Pull today’s task first', status: 409 };
  const q = parseRef(pull.ref);
  if (pull.completed_at) return { error: 'Today’s task is already done', status: 409, result: q.result };
  const correct = Number(choice) === q.answer;
  const pay = correct ? Math.round(LUCKY_BASE_XP * LUCKY_BONUS) : LUCKY_BASE_XP;
  const result = { correct, answer: q.answer, meaning: q.options[q.answer], word: q.word, word_id: q.word_id || null, xp: pay };
  const done = await db.query(`UPDATE lucky_pulls SET completed_at = NOW(), ref = $3 WHERE user_id = $1 AND day = $2::date AND completed_at IS NULL`,
    [user.id, day, JSON.stringify({ ...q, result })]);
  if (!done.rowCount) return { error: 'Today’s task is already done', status: 409 };
  await xp.award(db, user.id, 'lucky', day, pay, correct ? 'Lucky Task · right first time' : 'Lucky Task done');
  const streak = (await require('./streakDays').streakOf(db, user)).streak;
  return { ok: true, ...result, streak };
}

async function context(db, user) {
  const tz = challenges.tzOf(user);
  const { rows } = await db.query(
    `SELECT v.id, v.word, v.translation, v.example, v.source_title, v.source_type, v.created_at, v.reps, v.ease, v.interval_days, v.lapses, v.due_at, v.learned, v.last_reviewed_at,
            v.sent_by, t.name AS teacher_name
       FROM vocabulary v LEFT JOIN users t ON t.id = v.sent_by
      WHERE v.user_id = $1 AND v.kind = 'word' ORDER BY v.created_at DESC LIMIT 600`, [user.id]);
  const [wb, homework, challenge, duels] = await Promise.all([
    Promise.resolve(wordbank.board(rows, tz)), openHomework(db, user.id), challenges.todaysChallenge(db, user), challenges.listDuels(db, user.id)]);
  const { rows: [tp] } = await db.query(`SELECT 1 FROM xp_events WHERE user_id = $1 AND kind = 'treat' AND ref = $2`, [user.id, String(localDay(tz))]);
  let talk = null;
  try { talk = await require('./speaking/tutor').getState(db, user); } catch (_) { /* the plan never waits for Talk Time */ }
  return { tz, wb, homework, challenge, duels, treatOpen: !tp, talk };
}

/* The treat of the day, for the student's level and interests: a word from a piece built for their level
   and what they like (pieces made before today, so it stays the same all day), one they do not have yet.
   No such piece yet: the phrase of the day for the level. */
async function treatPick(db, user, level, day, tz) {
  try {
    const prof = await hub.profileOf(db, user.id);
    const lv = String(level || '').toUpperCase().match(/^[ABC][12]/);
    const { rows } = await db.query(
      `SELECT m.id, m.title, m.interest, m.words FROM hub_materials m
        WHERE m.level = $2 AND m.created_at < ($3::date::timestamp AT TIME ZONE $4)
          AND (cardinality($5::text[]) = 0 OR m.interest = ANY($5::text[]) OR m.teacher_id IN (SELECT teacher_id FROM student_journal WHERE student_id = $1))
        ORDER BY m.created_at DESC LIMIT 30`, [user.id, lv ? lv[0] : 'B1', String(localDayIso(tz)), tz, prof.liked]);
    const have = new Set((await db.query(`SELECT lower(word) AS w FROM vocabulary WHERE user_id = $1 AND kind = 'word'`, [user.id])).rows.map(r => r.w));
    const cands = [];
    rows.forEach(m => (m.words || []).forEach(w => { if (w.word && w.translation && w.word.length <= 40 && !/\s.*\s.*\s/.test(w.word)) cands.push({ w, m }); }));
    const fresh = cands.filter(c => !have.has(c.w.word.toLowerCase()));
    const list = fresh.length ? fresh : [];
    if (!list.length) return null;
    const c = list[hash(user.id + ':' + day) % list.length];
    return { phrase: c.w.word, meaning: c.w.translation, example: c.w.example || '', level: lv ? lv[0] : 'B1', from: c.m.title };
  } catch (_) { return null; }
}
const localDayIso = tz => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

async function treat(db, user) {
  const tz = challenges.tzOf(user);
  const { rows: [r] } = await db.query(
    `SELECT COALESCE((SELECT j.level FROM student_journal j WHERE j.student_id = $1 ORDER BY j.created_at DESC LIMIT 1), (SELECT level FROM student_dna WHERE user_id = $1)) AS level`, [user.id]).catch(() => ({ rows: [{}] }));
  const day = localDay(tz);
  const kept = await db.query(`SELECT 1 FROM xp_events WHERE user_id = $1 AND kind = 'treat' AND ref = $2`, [user.id, String(day)]);
  // once kept, the treat stays the word that was kept (it is in the bank now, so the pick would move on)
  const { rows: [k] } = kept.rows.length ? await db.query(
    `SELECT word, translation, example FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND source_type = 'PHRASE_OF_THE_DAY' ORDER BY created_at DESC LIMIT 1`, [user.id]) : { rows: [] };
  const p = k ? { phrase: k.word, meaning: k.translation, example: k.example, level: String((r && r.level) || 'B1').slice(0, 2) }
    : (await treatPick(db, user, r && r.level, day, tz)) || phraseFor(r && r.level, day);
  const have = await db.query(`SELECT id FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND lower(word) = lower($2) LIMIT 1`, [user.id, p.phrase]);
  const left = (() => { const now = new Date(); const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz })); return Math.max(1, 24 * 60 - (tzNow.getHours() * 60 + tzNow.getMinutes())); })();
  return { word: p.phrase, meaning: p.meaning, example: p.example, level: p.level, from: p.from || null, saved: have.rows.length > 0, paid: kept.rows.length > 0, xp: TREAT_XP, day, next_in_min: left };
}

async function keepTreat(db, user) {
  const t = await treat(db, user);
  if (!t.saved) await db.query(
    `INSERT INTO vocabulary (user_id, word, translation, example, kind, source_title, source_type) VALUES ($1,$2,$3,$4,'word',$5,'PHRASE_OF_THE_DAY')`,
    [user.id, t.word, t.meaning, t.example, 'Treat of the day · ' + localDayIso(challenges.tzOf(user))]);
  const paid = await xp.award(db, user.id, 'treat', String(t.day), TREAT_XP, 'Treat of the day kept');
  return { ok: true, xp: paid ? TREAT_XP : 0, word: t.word, where: 'My finds' };
}

async function whatsNew(db, user, ctx) {
  const { rows: [u] } = await db.query('SELECT hub_seen_at FROM users WHERE id = $1', [user.id]);
  if (!u || !u.hub_seen_at) { await db.query('UPDATE users SET hub_seen_at = NOW() WHERE id = $1 AND hub_seen_at IS NULL', [user.id]); return null; }
  const since = u.hub_seen_at;
  const { rows: [w] } = await db.query(
    `SELECT COUNT(*)::int AS n FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND created_at > $2 AND (sent_by IS NOT NULL OR source_type IN ('LESSON_BOARD','HOMEWORK'))`, [user.id, since]);
  const { rows: [x] } = await db.query(
    `SELECT COALESCE(SUM(xp),0)::int AS n FROM xp_events WHERE user_id = $1 AND created_at > $2 AND kind IN ('lesson','duel','badge')`, [user.id, since]);
  const incoming = ctx.duels.filter(d => d.state === 'incoming' && new Date(d.created_at) > new Date(since));
  const parts = [];
  if (w.n) parts.push(w.n + (w.n === 1 ? ' new word is' : ' new words are') + ' waiting in your Word Bank');
  if (incoming.length) parts.push(incoming[0].with + ' sent you a duel');
  if (x.n) {
    const { rows: [t] } = await db.query('SELECT COALESCE(SUM(xp),0)::int AS n FROM xp_events WHERE user_id = $1', [user.id]);
    const camp = xp.CAMPS.find(c => c.at > Math.min(t.n, xp.BAND_XP)) || xp.CAMPS[xp.CAMPS.length - 1];
    parts.push('your flag moved ' + x.n + ' XP closer to ' + camp.name);
  }
  if (!parts.length) return null;
  const text = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  return { text: 'While you were away: ' + text + '.', since };
}

async function plan(db, user, ctx, lucky) {
  const { wb, homework, challenge, duels, tz } = ctx;
  const rows = [];
  /* Talk Time is task one (Speaking Tutor ТЗ §2): five minutes of talking with Tich. It stays a row all day; it
     is ticked once a session was finished today. */
  const talk = ctx.talk;
  if (talk) rows.push({ id: 'talk', kind: 'talk', state: talk.sessions_today > 0 ? 'done' : undefined, title: 'Talk Time with Tich',
    why: talk.open_session ? 'You are in the middle of a session - pick it up' : talk.last_tich ? 'He asked: ' + String(talk.last_tich).slice(0, 70) : 'Five minutes of talking - he starts with one question',
    meta: '5 min · +' + require('./speaking/constants').XP_PER_SESSION + ' XP', min: 5, label: talk.open_session ? 'Continue' : 'Talk', go: 'talk' });
  /* what the teacher gave comes first: the new words from the teacher are step one, the rest of the queue follows */
  const tw = teacherWords(wb);
  if (tw) rows.push({ id: 'teacher_words', kind: 'teacher_words', title: 'Practise ' + tw.n + (tw.n === 1 ? ' new word' : ' new words') + ' from ' + tw.teacher,
    why: '“' + tw.words[0] + '”' + (tw.n > 1 ? ' and ' + (tw.n - 1) + ' more' : '') + ' — sent to your Word Bank by ' + tw.teacher, meta: 'Word Bank · ≈' + Math.max(2, Math.ceil(tw.n / 2)) + ' min',
    min: Math.max(2, Math.ceil(tw.n / 2)), label: 'Practise', go: 'wordbank', practice: 'teacher' });
  const twIds = new Set(tw ? tw.ids : []), rest = wb.queue.filter(w => !twIds.has(w.id));
  if (rest.length) {
    const n = Math.min(rest.length, 8), top = rest[0], gain = rest.slice(0, n).reduce((s, w) => s + w.xp, 0);
    const why = top.status === 'LAST CALL' ? '“' + top.word + '” is about to slip a stage — a quick pass saves it'
      : top.status === 'DELAYED' ? '“' + top.word + '” has been waiting since yesterday'
      : top.stage === 'new' ? n + (n === 1 ? ' new word is' : ' new words are') + ' ready to board' : '“' + top.word + '” is waiting for you';
    rows.push({ id: 'words', kind: 'words', title: 'Review ' + n + (n === 1 ? ' word' : ' words'), why, meta: 'Word Bank · ≈' + Math.max(2, Math.ceil(n / 2)) + ' min · +' + gain + ' XP', min: Math.max(2, Math.ceil(n / 2)), label: 'Start', go: 'wordbank' });
  }
  if (homework[0]) {
    const h = homework[0], late = h.due_at && new Date(h.due_at) < new Date();
    rows.push({ id: 'homework', kind: 'homework', title: h.title || 'Homework', why: (h.status === 'in_progress' ? 'You have started it — ' : '') + (h.due_at ? (late ? 'it was due ' : 'due ') + dueWords(h.due_at, tz) : 'no deadline, but sooner is lighter'), meta: 'Homework · +' + xp.RULES.homework.xp + ' XP', min: 8, label: h.status === 'in_progress' ? 'Continue' : 'Open', href: 'homework-do.html?a=' + encodeURIComponent(h.id) });
  }
  if (lucky) {
    if (lucky.state === 'sealed') rows.push({ id: 'lucky', kind: 'lucky', state: 'sealed', title: 'Today’s lucky task', why: 'One pull a day · finishing it pays a bonus', meta: 'Free to pull', min: 3, label: 'Pull' });
    else rows.push({ id: 'lucky', kind: 'lucky', state: lucky.state, title: lucky.task.label, why: lucky.state === 'done' ? 'Done — the lucky bonus is in your XP' : 'Lucky bonus ×' + lucky.bonus + ' today' + (lucky.task.need > 1 ? ' · ' + lucky.task.progress + ' of ' + lucky.task.need : ''), meta: 'Lucky Task · +' + lucky.xp + ' XP', min: 3, label: lucky.state === 'done' ? 'Done' : 'Go', go: lucky.task.go });
  }
  if (challenge && !challenge.done && !(lucky && lucky.task && lucky.task.kind === 'challenge' && lucky.state !== 'done')) {
    rows.push({ id: 'challenge', kind: 'challenge', title: challenge.title, why: challenge.teacher + ' set it for today — it pays ×' + challenge.bonus + ' on the day', meta: 'Challenges · +' + challenge.xp + ' XP', min: 5, label: 'Open', go: 'challenges' });
  }
  const d = duels.find(x => x.state === 'incoming' || x.state === 'your_move');
  if (d) rows.push({ id: 'duel', kind: 'duel', title: d.with + '’s duel · ' + d.game_label, why: d.state === 'incoming' ? 'Expires in ' + hoursLeft(d.expires_at) + ' — same words for both of you' : (d.their_score != null ? d.with + ' already played — your turn' : 'Your turn'), meta: 'Challenges · +60 XP', min: 3, label: 'View', go: 'challenges' });
  /* Something new every day (island §2): the freshest piece of the student's own feed, and, when the day
     would otherwise be empty, the phrase of the day - a plan is never blank, and the smallest step
     (keeping a phrase) is already a day done for the streak. */
  let piece = null;
  try { piece = (await hub.feed(db, user)).items.find(i => !i.finished && i.near === 0) || null; } catch (_) {}
  if (piece) rows.push({ id: 'read', kind: 'read', title: 'New for you: ' + String(piece.title).slice(0, 70), why: (piece.from_teacher ? 'Picked by your teacher' : 'Fresh for your level') + ' · ' + piece.words + ' words inside', meta: 'Watch & Read · ' + piece.minutes + ' min', min: piece.minutes, go: 'watchread' });
  if (!rows.length) rows.push({ id: 'treat', kind: 'treat', title: 'Keep today’s phrase', why: 'A small one: save the phrase of the day and the day counts', meta: 'Today · 1 min · +' + TREAT_XP + ' XP', min: 1, go: 'today' });
  return rows.slice(0, 5);
}

/* the new words from the teacher, for the plan and the banner on Today: how many, from whom, which */
function teacherWords(wb) {
  const list = wb.teacher_new || [];
  if (!list.length) return null;
  const names = [...new Set(list.map(w => w.teacher))];
  return { n: list.length, teacher: names.length === 1 ? String(names[0]).split(/\s+/)[0] : 'your teachers', words: list.slice(0, 8).map(w => w.word), ids: list.map(w => w.id), at: list[0].created_at };
}

async function buildToday(db, user) {
  const ctx = await context(db, user);
  const lucky = await luckyState(db, user, ctx);
  const [rows, t, wn] = await Promise.all([plan(db, user, ctx, lucky), treat(db, user), whatsNew(db, user, ctx)]);
  return { plan: rows, minutes: rows.reduce((n, r) => n + (r.min || 0), 0), lucky, treat: t, whats_new: wn, teacher_words: teacherWords(ctx.wb),
    talk: ctx.talk ? { sessions_today: ctx.talk.sessions_today, open_session: ctx.talk.open_session, unread: ctx.talk.unread, last_tich: ctx.talk.last_tich, pro: ctx.talk.pro, free_left: ctx.talk.free_left, rounds: ctx.talk.rounds } : null };
}

module.exports = { buildToday, pullLucky, answerLucky, keepTreat, luckyCandidates, TREAT_XP, LUCKY_BASE_XP, LUCKY_BONUS };
