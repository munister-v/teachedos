/* The session controller of the Speaking Tutor (ТЗ v1.0 §§1-8, 20, 25): one thread with Tich, rounds of
   ask -> answer -> (self-correction hint) -> one better version -> repeat -> log. Pure engine in engine.js, the model in
   llm.js, the voice and the pronunciation in azure.js. Every limit that keeps a session from becoming an open cost
   is enforced here, not in the client. */
const crypto = require('crypto');
const C = require('./constants');
const engine = require('./engine');
const llmDefault = require('./llm');
const azureDefault = require('./azure');
const { buildContext, todayIn, tzOf, mistakeFromRow } = require('./context');
const { soundCard } = require('./sounds');
const xp = require('../xp');
const billing = require('../billing');

const deps = { llm: llmDefault, azure: azureDefault, stt: null };
const setDeps = d => Object.assign(deps, d);
const stt = (buf, mime, opts) => (deps.stt ? deps.stt(buf, mime, opts) : require('../aiEngine').transcribeAudio(buf, mime, opts));
const sttEnabled = () => (deps.stt ? true : require('../aiEngine').transcribeEnabled());

const fail = (status, code, error) => Object.assign(new Error(error), { status, code });
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

/* ── the thread ───────────────────────────────────────────────────────── */

const shapeMsg = r => ({ id: r.id, author: r.author, kind: r.kind, text: r.text, audio_id: r.audio_id, audio_sec: r.audio_sec, round_id: r.round_id, session_id: r.session_id, meta: r.meta, created_at: r.created_at });
async function say(db, userId, m) {
  const { rows: [r] } = await db.query(
    `INSERT INTO speaking_messages (user_id, author, kind, text, audio_id, audio_sec, round_id, session_id, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [userId, m.author, m.kind, m.text == null ? null : m.text, m.audio_id || null, m.audio_sec == null ? null : m.audio_sec, m.round_id || null, m.session_id || null, m.meta ? JSON.stringify(m.meta) : null]);
  return shapeMsg(r);
}

/* Tich's voice: a neural voice (never the browser's), cached by text and accent so a phrase is voiced once */
async function voiceFor(db, user, text, accent) {
  if (!deps.azure.enabled() || !text) return null;
  const key = crypto.createHash('sha1').update(accent + '|' + text).digest('hex');
  const { rows: [c] } = await db.query(`SELECT id, sec FROM speaking_audio WHERE cache_key = $1 LIMIT 1`, [key]);
  if (c) return { id: c.id, sec: c.sec };
  const out = await deps.azure.speak(text, accent);
  if (!out) return null;
  const sec = Math.max(1, Math.round(out.buffer.length / 6000));            // 48 kbps mp3 = 6 kB per second
  const { rows: [r] } = await db.query(`INSERT INTO speaking_audio (user_id, kind, mime, sec, bytes, cache_key) VALUES ($1,'tich',$2,$3,$4,$5) RETURNING id`, [user.id, out.mime, sec, out.buffer, key]);
  return { id: r.id, sec };
}

async function ensureDayDivider(db, user) {
  const tz = tzOf(user), today = todayIn(tz);
  const { rows: [m] } = await db.query(`SELECT 1 FROM speaking_messages WHERE user_id = $1 AND kind = 'dayDivider' AND (created_at AT TIME ZONE $2)::date = $3::date LIMIT 1`, [user.id, tz, today]);
  if (m) return null;
  return say(db, user.id, { author: 'system', kind: 'dayDivider', text: new Date(today + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) });
}

async function listMessages(db, user, { before, limit = 40 } = {}) {
  const n = Math.max(1, Math.min(100, parseInt(limit, 10) || 40));
  const { rows } = before
    ? await db.query(`SELECT * FROM speaking_messages WHERE user_id = $1 AND created_at < (SELECT created_at FROM speaking_messages WHERE id = $2 AND user_id = $1) ORDER BY created_at DESC LIMIT $3`, [user.id, before, n])
    : await db.query(`SELECT * FROM speaking_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`, [user.id, n]);
  return rows.reverse().map(shapeMsg);
}

/* ── limits ───────────────────────────────────────────────────────────── */

async function teacherIsPro(db, userId) {
  const { rows } = await db.query(`SELECT t.plan, t.plan_status, t.plan_expires_at FROM student_journal j JOIN users t ON t.id = j.teacher_id WHERE j.student_id = $1`, [userId]);
  return rows.some(t => billing.effectivePlanKey(t) !== 'free');
}
async function freeLeft(db, user) {
  const pro = await teacherIsPro(db, user.id);
  if (pro) return { pro: true, free_left: null };
  const tz = tzOf(user);
  const { rows: [c] } = await db.query(
    `SELECT COUNT(*)::int AS n FROM speaking_sessions WHERE user_id = $1 AND kind = 'free' AND started_at >= (date_trunc('week', NOW() AT TIME ZONE $2) AT TIME ZONE $2)`, [user.id, tz]);
  return { pro: false, free_left: Math.max(0, C.FREE_SESSIONS_PER_WEEK - c.n) };
}
async function audioSecondsToday(db, userId) {
  const { rows: [r] } = await db.query(`SELECT COALESCE(SUM(sec),0)::float AS s FROM speaking_audio WHERE user_id = $1 AND kind IN ('student','repeat') AND created_at > NOW() - INTERVAL '24 hours'`, [userId]);
  return r.s;
}
const assertCap = async (db, userId) => {
  if (await audioSecondsToday(db, userId) >= C.DAILY_AUDIO_CAP_MIN * 60) throw fail(429, 'DAILY_CAP', 'That is enough talking for today - your voice needs a rest. Tich will be here tomorrow.');
};
async function voiceAllowed(db, userId) {
  const { rows: [u] } = await db.query('SELECT speaking_voice_ok FROM users WHERE id = $1', [userId]);
  return !(u && u.speaking_voice_ok === false);
}

async function getState(db, user) {
  const [lim, open, voiceOk, done, acc, unread] = await Promise.all([
    freeLeft(db, user),
    db.query(`SELECT s.id, s.total_rounds, s.kind, (SELECT COUNT(*)::int FROM speaking_rounds r WHERE r.session_id = s.id AND r.state = 'done') AS done
                FROM speaking_sessions s WHERE s.user_id = $1 AND s.finished_at IS NULL AND s.started_at > NOW() - INTERVAL '6 hours' ORDER BY s.started_at DESC LIMIT 1`, [user.id]),
    voiceAllowed(db, user.id),
    db.query(`SELECT COUNT(*)::int AS n FROM speaking_sessions WHERE user_id = $1 AND finished_at IS NOT NULL AND (finished_at AT TIME ZONE $2)::date = $3::date`, [user.id, tzOf(user), todayIn(tzOf(user))]),
    db.query('SELECT speaking_accent FROM users WHERE id = $1', [user.id]),
    db.query(`SELECT COUNT(*)::int AS n, (ARRAY_AGG(text ORDER BY created_at DESC) FILTER (WHERE text IS NOT NULL))[1] AS last
                FROM speaking_messages WHERE user_id = $1 AND author = 'tich' AND kind IN ('text','greeting','hint')
                 AND created_at > COALESCE((SELECT talk_seen_at FROM users WHERE id = $1), 'epoch')`, [user.id]),
  ]);
  let active = null;
  if (open.rows[0]) {
    const { rows: [r] } = await db.query(`SELECT id, state FROM speaking_rounds WHERE session_id = $1 ORDER BY idx DESC LIMIT 1`, [open.rows[0].id]);
    active = r ? { id: r.id, state: r.state } : null;
  }
  return { accent: acc.rows[0].speaking_accent, tts: deps.azure.enabled(), stt: sttEnabled(), voice_allowed: voiceOk, ...lim,
    open_session: open.rows[0] ? { id: open.rows[0].id, done: open.rows[0].done, total: open.rows[0].total_rounds, kind: open.rows[0].kind, round: active } : null,
    unread: unread.rows[0].n, last_tich: unread.rows[0].last || null,
    sessions_today: done.rows[0].n, daily_cap_min: C.DAILY_AUDIO_CAP_MIN, max_answer_sec: C.MAX_ANSWER_SEC, rounds: C.SESSION_ROUNDS };
}

/* ── rounds ───────────────────────────────────────────────────────────── */

async function askNext(db, user, session, ctx) {
  const { rows: [{ n }] } = await db.query('SELECT COUNT(*)::int AS n FROM speaking_rounds WHERE session_id = $1', [session.id]);
  const plan = (session.plan || [])[n];
  if (!plan) return null;
  const { rows: rec } = await db.query('SELECT question FROM speaking_rounds WHERE user_id = $1 ORDER BY asked_at DESC LIMIT 10', [user.id]);
  const q = await deps.llm.makeQuestion(plan, ctx, rec.map(r => r.question));
  const voice = await voiceFor(db, user, q.question, ctx.accent);
  const { rows: [round] } = await db.query(
    `INSERT INTO speaking_rounds (session_id, user_id, idx, source, question, question_audio, construct, target_words) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [session.id, user.id, n, plan.source, q.question, voice && voice.id, plan.construct || null, plan.targetWords || []]);
  const m = await say(db, user.id, { author: 'tich', kind: 'text', text: q.question, audio_id: voice && voice.id, audio_sec: voice && voice.sec, round_id: round.id, session_id: session.id });
  return { round, message: m };
}

async function startSession(db, user, opts = {}) {
  const open = await db.query(`SELECT * FROM speaking_sessions WHERE user_id = $1 AND finished_at IS NULL AND started_at > NOW() - INTERVAL '6 hours' ORDER BY started_at DESC LIMIT 1`, [user.id]);
  if (open.rows[0]) {                                              // an open session is resumed, not duplicated
    const { rows: [round] } = await db.query(`SELECT id FROM speaking_rounds WHERE session_id = $1 ORDER BY idx DESC LIMIT 1`, [open.rows[0].id]);
    return { resumed: true, session_id: open.rows[0].id, round_id: round && round.id, messages: [] };
  }
  const kind = opts.kind === 'ritual' ? 'ritual' : 'free';
  if (kind === 'free') {
    const lim = await freeLeft(db, user);
    if (!lim.pro && lim.free_left <= 0) throw fail(403, 'FREE_LIMIT', 'This week\'s free Talk Time sessions are used. They come back on Monday.');
  }
  const ctx = await buildContext(db, user);
  const total = kind === 'ritual' ? 2 : C.SESSION_ROUNDS;
  const plan = engine.buildSessionPlan(ctx, total);
  const voiceOk = await voiceAllowed(db, user.id);
  const { rows: [session] } = await db.query(
    `INSERT INTO speaking_sessions (user_id, kind, mode, input_mode, plan, total_rounds) VALUES ($1,$2,'errors',$3,$4,$5) RETURNING *`,
    [user.id, kind, opts.inputMode === 'text' || !voiceOk ? 'text' : 'voice', JSON.stringify(plan), total]);
  const msgs = [];
  const dd = await ensureDayDivider(db, user); if (dd) msgs.push(dd);
  if (kind === 'free') { const w = await warmupMessage(db, user, session, ctx); if (w) msgs.push(w); }
  const first = await askNext(db, user, session, ctx);
  if (first) msgs.push(first.message);
  return { resumed: false, session_id: session.id, round_id: first && first.round.id, messages: msgs };
}

/* the warm-up (§13): before the new questions, up to three of the student's own phrases, due by the schedule, said out loud */
async function warmupMessage(db, user, session, ctx) {
  const due = (ctx.duePhrases || []).slice(0, 3);
  if (!due.length) return null;
  const phrases = [];
  for (const p of due) { const v = await voiceFor(db, user, p.text, ctx.accent); phrases.push({ id: p.id, text: p.text, audio_id: v && v.id, audio_sec: v && v.sec }); }
  return say(db, user.id, { author: 'tich', kind: 'warmup', text: 'Warm-up first - say your own phrases out loud, one minute.', session_id: session.id, meta: { phrases } });
}

const ownRound = async (db, userId, roundId) => {
  if (!/^[0-9a-f-]{36}$/i.test(String(roundId))) return null;
  const { rows: [r] } = await db.query(
    `SELECT r.*, s.plan, s.total_rounds, s.finished_at AS s_finished, s.kind AS s_kind FROM speaking_rounds r JOIN speaking_sessions s ON s.id = r.session_id WHERE r.id = $1 AND r.user_id = $2`, [roundId, userId]);
  return r || null;
};

/* the mistake log: one upsert path (§4); a self-corrected slip is kept but weighs less */
async function logMistakes(db, user, round, changed, selfCorrected) {
  const now = new Date().toISOString();
  for (const c of changed) {
    const { rows } = await db.query(`SELECT * FROM speaking_mistakes WHERE user_id = $1 AND construct = $2 AND status <> 'fixed' LIMIT 1`, [user.id, c.construct]);
    const [next] = engine.upsertMistake(rows.map(mistakeFromRow), { said: c.said, better: c.better, category: c.category, construct: c.construct, selfCorrected,
      breaksMeaning: c.breaksMeaning, now, newId: crypto.randomUUID(), studentId: user.id }).filter(e => e.construct === c.construct && e.status !== 'fixed').slice(-1);
    if (rows[0]) await db.query(`UPDATE speaking_mistakes SET said = $2, better = $3, occurrences = $4, status = $5, weight = $6, self_fixed = $7, clean_streak = 0, last_seen = NOW(), round_id = $8 WHERE id = $1`,
      [rows[0].id, next.said, next.better, next.occurrences, next.status, next.weight, next.selfFixedCount, round.id]);
    else await db.query(`INSERT INTO speaking_mistakes (user_id, source, said, better, category, construct, weight, occurrences, status, self_fixed, round_id) VALUES ($1,'speaking',$2,$3,$4,$5,$6,1,'new',$7,$8)`,
      [user.id, c.said, c.better, c.category, c.construct, next.weight, selfCorrected ? 1 : 0, round.id]);
  }
}

async function savePhrase(db, user, round, text, voice, tz) {
  const { rows: [dup] } = await db.query(`SELECT 1 FROM speaking_phrases WHERE user_id = $1 AND lower(text) = lower($2) LIMIT 1`, [user.id, text]);
  if (dup) return;
  await db.query(`INSERT INTO speaking_phrases (user_id, text, audio_id, round_id, next_review) VALUES ($1,$2,$3,$4,$5::date)`, [user.id, text, voice && voice.id, round.id, engine.addDays(todayIn(tz), 1)]);
}

/* A spoken or typed answer. Returns the messages the thread gained (the client appends them as they are). */
async function answer(db, user, roundId, input = {}) {
  const round = await ownRound(db, user.id, roundId);
  if (!round || round.s_finished) throw fail(404, 'NOT_FOUND', 'This round is not open');
  if (!['asked', 'hinted'].includes(round.state)) throw fail(409, 'DONE', 'This question is already answered');
  let transcript = '', audioBuf = null, sec = 0, mime = '';
  if (input.audio) {
    if (!(await voiceAllowed(db, user.id))) throw fail(403, 'VOICE_OFF', 'Voice practice is switched off for this account - you can type your answer.');
    audioBuf = Buffer.from(String(input.audio), 'base64'); mime = String(input.mime || 'audio/webm').split(';')[0].toLowerCase();
    if (!audioBuf.length || audioBuf.length > 6 * 1024 * 1024) throw fail(413, 'TOO_BIG', 'That recording is too long');
    sec = Math.max(0.5, Math.min(C.MAX_ANSWER_SEC, Number(input.sec) || 0));
    await assertCap(db, user.id);
    try { transcript = clip(await stt(audioBuf, mime, { language: 'en', prompt: round.question }), 1500); }
    catch (e) { throw fail(503, 'STT', 'Tich could not hear that - please try again.'); }
  } else if (input.text) transcript = clip(input.text, 600);
  if (!transcript) throw fail(422, 'EMPTY', 'Tich did not catch anything - try once more.');

  const ctx = await buildContext(db, user);
  let a;
  try { a = await deps.llm.analyseAnswer({ level: ctx.level, question: round.question, transcript, targetConstruct: round.construct, targetWords: round.target_words, attempt: round.attempts + 1 }); }
  catch (e) { throw fail(503, 'LLM', 'Tich is thinking too long - please send it again.'); }

  let audioId = null;
  if (audioBuf) { const { rows: [r] } = await db.query(`INSERT INTO speaking_audio (user_id, kind, mime, sec, bytes) VALUES ($1,'student',$2,$3,$4) RETURNING id`, [user.id, mime, sec, audioBuf]); audioId = r.id; }
  const out = [];
  out.push(await say(db, user.id, { author: 'student', kind: audioId ? 'voice' : 'text', text: transcript, audio_id: audioId, audio_sec: audioId ? sec : null, round_id: round.id, session_id: round.session_id }));
  if (a.reaction) out.push(await say(db, user.id, { author: 'tich', kind: 'text', text: a.reaction, round_id: round.id, session_id: round.session_id }));
  const used = a.usedTargetWords.filter(w => (round.target_words || []).map(x => x.toLowerCase()).includes(w));
  const attempts = round.attempts + 1;
  const tz = tzOf(user);
  const main = engine.mainError(a.changed, round.construct);
  let nextState = 'done', selfFixed = false, finishedRound = false, better = null, changedForLog = a.changed;

  if (!a.changed.length) {                                       // nothing to fix: a good answer, the round counts
    out.push(await say(db, user.id, { author: 'tich', kind: 'text', text: 'Clean. That is exactly how you say it.', round_id: round.id, session_id: round.session_id }));
    finishedRound = true;
    if (round.state === 'hinted' && round.changed && round.changed.length) {   // fixed it after the hint: the slip is logged, but marked self-fixed
      selfFixed = true; changedForLog = round.changed;
    } else changedForLog = [];
  } else if (round.state === 'asked' && a.hint && main) {        // first attempt: one soft hint and a second try (§20)
    nextState = 'hinted';
    out.push(await say(db, user.id, { author: 'tich', kind: 'hint', text: a.hint, round_id: round.id, session_id: round.session_id }));
  } else {                                                      // the one better version
    better = a.betterVersion; nextState = 'better';
  }

  if (selfFixed) {
    // the slip from the first attempt, now said right by the student: logged as self-fixed (lighter), no better version shown
    out.push(await say(db, user.id, { author: 'tich', kind: 'text', text: 'You caught that yourself - that is the best kind of fix.', round_id: round.id, session_id: round.session_id, meta: { selfFixed: true } }));
  }
  if (changedForLog.length && (selfFixed || nextState === 'better')) await logMistakes(db, user, round, changedForLog, selfFixed);

  let betterVoice = null;
  if (nextState === 'better') {
    betterVoice = await voiceFor(db, user, better, ctx.accent);
    out.push(await say(db, user.id, { author: 'tich', kind: 'betterVersion', text: better, audio_id: betterVoice && betterVoice.id, audio_sec: betterVoice && betterVoice.sec, round_id: round.id, session_id: round.session_id, meta: { changed: a.changed } }));
    await savePhrase(db, user, round, better, betterVoice, ctx.tz);
  }
  await db.query(
    `UPDATE speaking_rounds SET state = $2, attempts = $3, student_audio = COALESCE($4, student_audio), student_sec = COALESCE(student_sec, 0) + $5, transcript = COALESCE(transcript || ' / ', '') || $6,
            better = COALESCE($7, better), changed = $8, hint = $9, self_fixed = $10, used_words = (SELECT ARRAY(SELECT DISTINCT unnest(used_words || $11::text[]))), answered_at = COALESCE(answered_at, NOW()), done_at = $12
      WHERE id = $1`,
    [round.id, nextState, attempts, audioId, sec, transcript, better, JSON.stringify(selfFixed ? round.changed : a.changed), a.hint || null, selfFixed, used, finishedRound ? new Date() : null]);
  if (finishedRound) out.push(...await advance(db, user, round.session_id, ctx));
  return { messages: out, state: finishedRound ? 'done' : nextState, round_id: round.id };
}

/* the shadowing repeat of the better version: a short WAV (16 kHz mono) that goes to the assessor */
async function repeat(db, user, roundId, input = {}) {
  const round = await ownRound(db, user.id, roundId);
  if (!round || round.s_finished) throw fail(404, 'NOT_FOUND', 'This round is not open');
  if (round.state !== 'better') throw fail(409, 'NOT_READY', 'There is nothing to repeat yet');
  if (!(await voiceAllowed(db, user.id))) throw fail(403, 'VOICE_OFF', 'Voice practice is switched off for this account.');
  const buf = Buffer.from(String(input.audio || ''), 'base64');
  if (!buf.length || buf.length > 3 * 1024 * 1024) throw fail(413, 'TOO_BIG', 'That recording is too long');
  const sec = Math.max(0.5, Math.min(20, Number(input.sec) || 0));
  await assertCap(db, user.id);
  const ctx = await buildContext(db, user);
  const { rows: [aud] } = await db.query(`INSERT INTO speaking_audio (user_id, kind, mime, sec, bytes) VALUES ($1,'repeat',$2,$3,$4) RETURNING id`, [user.id, String(input.mime || 'audio/wav').split(';')[0], sec, buf]);
  const result = await deps.azure.assess(buf, round.better, ctx.accent).catch(() => null);       // null: no scores, the session goes on
  const weakest = result ? deps.azure.weakestSound(result) : null;
  const repeats = round.repeats + 1;
  const again = !!weakest && repeats < C.MAX_REPEATS_PER_PHRASE;
  const out = [];
  out.push(await say(db, user.id, { author: 'student', kind: 'voice', audio_id: aud.id, audio_sec: sec, round_id: round.id, session_id: round.session_id,
    meta: weakest ? { weakest: { word: weakest.word, phoneme: weakest.phoneme } } : null }));      // colours and one sound - no number leaves the server
  if (again) out.push(await say(db, user.id, { author: 'tich', kind: 'text', text: 'Almost - one more go? Slowly, and listen to that one sound.', round_id: round.id, session_id: round.session_id }));
  await db.query(`UPDATE speaking_rounds SET repeat_audio = $2, repeats = $3, weakest = $4, scores = $5, state = $6, done_at = $7 WHERE id = $1`,
    [round.id, aud.id, repeats, weakest ? JSON.stringify({ word: weakest.word, phoneme: weakest.phoneme }) : null,
     result ? JSON.stringify({ accuracy: result.accuracy, fluency: result.fluency, prosody: result.prosody }) : null, again ? 'better' : 'done', again ? null : new Date()]);
  if (!again) out.push(...await advance(db, user, round.session_id, ctx));
  return { messages: out, state: again ? 'better' : 'done', weakest: weakest ? { word: weakest.word, phoneme: weakest.phoneme } : null, round_id: round.id };
}

/* a round is done: the next question, or the end of the session */
async function advance(db, user, sessionId, ctx) {
  const { rows: [s] } = await db.query('SELECT * FROM speaking_sessions WHERE id = $1', [sessionId]);
  const next = await askNext(db, user, s, ctx || await buildContext(db, user));
  if (next) return [next.message];
  return [await finishSession(db, user, sessionId)];
}

/* the end of a session (or a leave after any round): the pairs, the one goal, the XP - one message in the thread */
async function finishSession(db, user, sessionId) {
  const { rows: [s] } = await db.query('SELECT * FROM speaking_sessions WHERE id = $1 AND user_id = $2', [sessionId, user.id]);
  if (!s) throw fail(404, 'NOT_FOUND', 'Session not found');
  if (s.finished_at) { const { rows: [m] } = await db.query(`SELECT * FROM speaking_messages WHERE session_id = $1 AND kind = 'sessionSummary' LIMIT 1`, [sessionId]); return m ? shapeMsg(m) : null; }
  const { rows: rounds } = await db.query('SELECT * FROM speaking_rounds WHERE session_id = $1 ORDER BY idx', [sessionId]);
  const done = rounds.filter(r => r.state === 'done');
  const pairs = done.filter(r => r.better && !r.self_fixed && r.transcript).map(r => ({ said: String(r.transcript).split(' / ').pop(), better: r.better }));
  // the session's one goal: the heaviest slip - blocking first, then the construction seen most often
  const seen = new Map();
  done.forEach(r => (r.changed || []).forEach(c => { const e = seen.get(c.construct) || { n: 0, blocking: false }; e.n++; e.blocking = e.blocking || c.breaksMeaning; seen.set(c.construct, e); }));
  const goal = [...seen.entries()].sort((a, b) => (b[1].blocking - a[1].blocking) || (b[1].n - a[1].n))[0];
  // constructions that were targeted and came out clean move toward Fixed (two clean sessions in a row)
  const clean = done.filter(r => r.construct && !(r.changed || []).some(c => c.construct === r.construct)).map(r => r.construct);
  if (clean.length) {
    const { rows } = await db.query(`SELECT * FROM speaking_mistakes WHERE user_id = $1 AND status <> 'fixed' AND construct = ANY($2::text[])`, [user.id, clean]);
    for (const e of engine.applySessionOutcome(rows.map(mistakeFromRow), clean)) await db.query(`UPDATE speaking_mistakes SET clean_streak = $2, status = $3 WHERE id = $1`, [e.id, e.cleanSessionsStreak, e.status]);
  }
  const typed = done.filter(r => !r.student_audio).length;
  const inputMode = typed > done.length / 2 ? 'text' : 'voice';
  const full = s.kind === 'ritual' ? C.XP_PER_RITUAL : C.XP_PER_SESSION;
  const base = done.length ? Math.round(full * done.length / s.total_rounds) : 0;
  const pay = inputMode === 'text' ? Math.floor(base / 2) : base;
  if (pay > 0) await xp.award(db, user.id, 'speaking', s.id, pay, 'Talk Time');
  const summary = { pairs, goal: goal ? goal[0] : null, xp: pay, rounds_done: done.length, total: s.total_rounds, input_mode: inputMode };
  await db.query(`UPDATE speaking_sessions SET finished_at = NOW(), xp = $2, summary = $3, input_mode = $4 WHERE id = $1`, [s.id, pay, JSON.stringify(summary), inputMode]);
  const text = done.length ? (goal ? `Today we worked on: ${goal[0]}. Your phrases are in the Phrase Bank.` : 'Clean session - nothing to fix today. Nice.') : 'See you next time.';
  const m = await say(db, user.id, { author: 'tich', kind: 'sessionSummary', text, session_id: s.id, meta: summary });
  // what Tich learned about the student's life: shown to them, deletable in one tap (§20)
  if (done.length) setImmediate(() => rememberFacts(db, user, rounds).catch(() => {}));
  return m;
}

async function rememberFacts(db, user, rounds) {
  const transcript = rounds.map(r => r.transcript).filter(Boolean).join(' ');
  if (!transcript) return;
  const [known, blocked] = await Promise.all([
    db.query('SELECT fact FROM speaking_facts WHERE user_id = $1', [user.id]),
    db.query('SELECT norm FROM speaking_fact_blocks WHERE user_id = $1', [user.id]),
  ]);
  const facts = await deps.llm.extractFacts(transcript, known.rows.map(r => r.fact), blocked.rows.map(r => r.norm));
  for (const f of facts) await db.query('INSERT INTO speaking_facts (user_id, fact) VALUES ($1,$2)', [user.id, f]);
}

/* ── the Phrase Bank (§13): the student's own better versions, repeated on a schedule until they are Mine ───── */
const phraseShape = r => ({ id: r.id, text: r.text, audio_id: r.audio_id, status: r.status, next_review: r.next_review, repeats: (r.correct_days || []).length, created_at: r.created_at });
async function listPhrases(db, user) {
  const tz = tzOf(user), today = todayIn(tz);
  const { rows } = await db.query(`SELECT id, text, audio_id, status, to_char(next_review, 'YYYY-MM-DD') AS next_review, correct_days, created_at FROM speaking_phrases WHERE user_id = $1 ORDER BY (status = 'learning') DESC, created_at DESC LIMIT 200`, [user.id]);
  const label = r => r.status === 'mine' ? 'Mine' : r.next_review <= today ? 'today' : r.next_review === engine.addDays(today, 1) ? 'tomorrow' : r.next_review;
  return { phrases: rows.map(r => ({ ...phraseShape(r), next_label: label(r) })), today, mine: rows.filter(r => r.status === 'mine').length };
}
/* a phrase said again: with Azure the repeat is assessed (a weak sound means "not yet"), without it the student's own word stands */
async function repeatPhrase(db, user, id, input = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw fail(404, 'NOT_FOUND', 'Phrase not found');
  const { rows: [p] } = await db.query(`SELECT *, to_char(next_review, 'YYYY-MM-DD') AS nr, ARRAY(SELECT to_char(d, 'YYYY-MM-DD') FROM unnest(correct_days) d) AS days FROM speaking_phrases WHERE id = $1 AND user_id = $2`, [id, user.id]);
  if (!p) throw fail(404, 'NOT_FOUND', 'Phrase not found');
  if (p.status === 'mine') throw fail(409, 'DONE', 'This phrase is already yours');
  let correct = true, weakest = null;
  if (input.audio) {
    if (!(await voiceAllowed(db, user.id))) throw fail(403, 'VOICE_OFF', 'Voice practice is switched off for this account.');
    const buf = Buffer.from(String(input.audio), 'base64');
    if (!buf.length || buf.length > 3 * 1024 * 1024) throw fail(413, 'TOO_BIG', 'That recording is too long');
    await assertCap(db, user.id);
    const sec = Math.max(0.5, Math.min(20, Number(input.sec) || 0));
    await db.query(`INSERT INTO speaking_audio (user_id, kind, mime, sec, bytes) VALUES ($1,'repeat',$2,$3,$4)`, [user.id, String(input.mime || 'audio/wav').split(';')[0], sec, buf]);
    const acc = (await db.query('SELECT speaking_accent FROM users WHERE id = $1', [user.id])).rows[0].speaking_accent;
    const res = await deps.azure.assess(buf, p.text, acc).catch(() => null);
    weakest = res ? deps.azure.weakestSound(res) : null;
    correct = !weakest;
  }
  const today = todayIn(tzOf(user));
  const next = engine.recordPhraseRepeat({ ...p, correctRepeatDays: p.days, nextReviewOn: p.nr }, correct, today);
  await db.query(`UPDATE speaking_phrases SET correct_days = $2::date[], status = $3, next_review = $4::date WHERE id = $1`, [p.id, next.correctRepeatDays, next.status, next.nextReviewOn]);
  return { id: p.id, correct, status: next.status, next_review: next.nextReviewOn, repeats: next.correctRepeatDays.length, weakest: weakest ? { word: weakest.word, phoneme: weakest.phoneme } : null };
}

/* ── "Tich remembers about me" (§20): the student sees every fact and deletes any in one tap; a deleted fact never comes back ── */
const listFacts = async (db, user) => (await db.query('SELECT id, fact, created_at FROM speaking_facts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [user.id])).rows;
async function deleteFact(db, user, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw fail(404, 'NOT_FOUND', 'Not found');
  const { rows: [f] } = await db.query('DELETE FROM speaking_facts WHERE id = $1 AND user_id = $2 RETURNING fact', [id, user.id]);
  if (!f) throw fail(404, 'NOT_FOUND', 'Not found');
  await db.query('INSERT INTO speaking_fact_blocks (user_id, norm) VALUES ($1,$2) ON CONFLICT DO NOTHING', [user.id, f.fact.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()]);
  return { ok: true };
}

/* the pair of words of the morning greeting: a tap, listen, say it, done - the chip is marked */
async function markPair(db, user, input = {}) {
  if (input.kind === 'phraseRepeat' && input.phraseId) return repeatPhrase(db, user, input.phraseId, {});
  return { ok: true };
}

/* "Skip": a round the student does not want to finish. It is not counted (a round counts only with its repeat),
   the next question comes at once */
async function skipRound(db, user, roundId) {
  const round = await ownRound(db, user.id, roundId);
  if (!round || round.s_finished) throw fail(404, 'NOT_FOUND', 'This round is not open');
  if (round.state === 'done') throw fail(409, 'DONE', 'This round is already finished');
  await db.query(`UPDATE speaking_rounds SET state = 'skipped', done_at = NOW() WHERE id = $1`, [round.id]);
  return { messages: await advance(db, user, round.session_id), state: 'skipped', round_id: round.id };
}
/* a single word or short phrase in Tich's voice, for the sound card (cached; null without a voice) */
async function sayAudio(db, user, text) {
  const t = clip(text, 60);
  if (!t || !/^[A-Za-z' ,.!?-]+$/.test(t)) return null;
  const acc = (await db.query('SELECT speaking_accent FROM users WHERE id = $1', [user.id])).rows[0].speaking_accent;
  const v = await voiceFor(db, user, t, acc);
  return v ? getAudio(db, user, v.id) : null;
}
const markSeen = (db, user) => db.query('UPDATE users SET talk_seen_at = NOW() WHERE id = $1', [user.id]);

/* leaving after any round keeps the progress: the log is already written, the finished rounds count */
const leave = (db, user, sessionId) => finishSession(db, user, sessionId);

/* the audio of the thread: the owner's own, or Tich's voice */
async function getAudio(db, user, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  const { rows: [a] } = await db.query(`SELECT mime, bytes, sec FROM speaking_audio WHERE id = $1 AND (user_id = $2 OR kind = 'tich')`, [id, user.id]);
  return a || null;
}

module.exports = { listPhrases, repeatPhrase, listFacts, deleteFact, markPair, sayAudio, skipRound, markSeen, setDeps, getState, listMessages, startSession, answer, repeat, finishSession, leave, getAudio, soundCard, freeLeft, voiceFor, say, ensureDayDivider, askNext, logMistakes };
