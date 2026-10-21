/* The hub's Today: the day as one numbered plan, the Lucky Task (one pull a day), the Treat of the
   day and "what's new" since the student last caught up. Everything is built from what the
   platform really knows: the Word Bank's flights, open homework, the teacher's challenge, duels. */

const xp = require('./xp');
const wordbank = require('./wordbank');
const challenges = require('./challenges');
const { phraseFor, localDay } = require('./phrases');

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
function luckyCandidates({ wb, homework, challenge }) {
  const out = [];
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
  const go = ({ words: 'wordbank', homework: 'homework', challenge: 'challenges' })[pull.kind];
  if (!pull.completed_at) {
    const { rows: [c] } = await db.query(
      `SELECT COUNT(*)::int AS n FROM xp_events WHERE user_id = $1 AND kind = $2 AND created_at >= $3`,
      [user.id, ({ words: 'word', homework: 'homework', challenge: 'challenge' })[pull.kind], pull.pulled_at]);
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

async function pullLucky(db, user) {
  const ctx = await context(db, user);
  const tz = challenges.tzOf(user), day = challenges.dayIn(tz);
  const have = await db.query('SELECT 1 FROM lucky_pulls WHERE user_id = $1 AND day = $2::date', [user.id, day]);
  if (have.rows.length) return { error: 'One pull a day - today’s task is already yours', status: 409 };
  const cands = luckyCandidates(ctx);
  if (!cands.length) return { error: 'Nothing to pull from today yet', status: 409 };
  const pick = cands[hash(user.id + day) % cands.length];
  await db.query('INSERT INTO lucky_pulls (user_id, day, kind, need, label, ref) VALUES ($1,$2::date,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
    [user.id, day, pick.kind, pick.need, pick.label, pick.ref || null]);
  return { lucky: await luckyState(db, user, ctx) };
}

async function context(db, user) {
  const tz = challenges.tzOf(user);
  const { rows } = await db.query(
    `SELECT id, word, translation, example, source_title, source_type, created_at, reps, ease, interval_days, lapses, due_at, learned, last_reviewed_at
       FROM vocabulary WHERE user_id = $1 AND kind = 'word' ORDER BY created_at DESC LIMIT 600`, [user.id]);
  const [wb, homework, challenge, duels] = await Promise.all([
    Promise.resolve(wordbank.board(rows, tz)), openHomework(db, user.id), challenges.todaysChallenge(db, user), challenges.listDuels(db, user.id)]);
  return { tz, wb, homework, challenge, duels };
}

async function treat(db, user) {
  const tz = challenges.tzOf(user);
  const { rows: [r] } = await db.query(
    `SELECT COALESCE((SELECT j.level FROM student_journal j WHERE j.student_id = $1 ORDER BY j.created_at DESC LIMIT 1), (SELECT level FROM student_dna WHERE user_id = $1)) AS level`, [user.id]).catch(() => ({ rows: [{}] }));
  const day = localDay(tz);
  const p = phraseFor(r && r.level, day);
  const have = await db.query(`SELECT id FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND lower(word) = lower($2) LIMIT 1`, [user.id, p.phrase]);
  const kept = await db.query(`SELECT 1 FROM xp_events WHERE user_id = $1 AND kind = 'treat' AND ref = $2`, [user.id, String(day)]);
  const left = (() => { const now = new Date(); const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz })); return Math.max(1, 24 * 60 - (tzNow.getHours() * 60 + tzNow.getMinutes())); })();
  return { word: p.phrase, meaning: p.meaning, example: p.example, level: p.level, saved: have.rows.length > 0, paid: kept.rows.length > 0, xp: TREAT_XP, day, next_in_min: left };
}

async function keepTreat(db, user) {
  const t = await treat(db, user);
  if (!t.saved) await db.query(
    `INSERT INTO vocabulary (user_id, word, translation, example, kind, source_title, source_type) VALUES ($1,$2,$3,$4,'word',$5,'PHRASE_OF_THE_DAY')`,
    [user.id, t.word, t.meaning, t.example, 'Phrase of the day · ' + t.level]);
  const paid = await xp.award(db, user.id, 'treat', String(t.day), TREAT_XP, 'Treat of the day kept');
  return { ok: true, xp: paid ? TREAT_XP : 0 };
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
  if (wb.queue.length) {
    const n = Math.min(wb.queue.length, 8), top = wb.queue[0], gain = wb.queue.slice(0, n).reduce((s, w) => s + w.xp, 0);
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
  return rows.slice(0, 5);
}

async function buildToday(db, user) {
  const ctx = await context(db, user);
  const lucky = await luckyState(db, user, ctx);
  const [rows, t, wn] = await Promise.all([plan(db, user, ctx, lucky), treat(db, user), whatsNew(db, user, ctx)]);
  return { plan: rows, minutes: rows.reduce((n, r) => n + (r.min || 0), 0), lucky, treat: t, whats_new: wn };
}

module.exports = { buildToday, pullLucky, keepTreat, luckyCandidates, TREAT_XP, LUCKY_BASE_XP, LUCKY_BONUS };
