const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { sendEmail, teacherMessageEmail, emailConfigured, SITE } = require('../lib/email');

router.use(requireAuth);

/* Контакт из формы: пусто -> null, иначе обрезанная строка. */
const cleanContact = (v, max) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };

/* ── JOURNAL ── */
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT j.*, to_char(j.payment_due, 'YYYY-MM-DD') AS payment_due,
            COUNT(a.id) FILTER (WHERE a.status='present') AS attended,
            COUNT(a.id) AS total_sessions
     FROM student_journal j
     LEFT JOIN attendance a ON a.journal_id = j.id
     WHERE j.teacher_id=$1
     GROUP BY j.id ORDER BY j.created_at DESC`,
    [req.user.id]
  );
  res.json({ students: rows });
});

router.post('/', async (req, res) => {
  const { name, email='', level='A2', lessons_left=0, payment_due=null, format=null, telegram=null, phone=null, is_trial=false } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (payment_due && !/^\d{4}-\d{2}-\d{2}$/.test(String(payment_due))) return res.status(400).json({ error: 'payment_due must be YYYY-MM-DD' });
  const fmt = ['individual', 'group'].includes(format) ? format : null;
  const { rows } = await pool.query(
    `INSERT INTO student_journal (teacher_id,name,email,level,lessons_left,payment_due,format,telegram,phone,is_trial)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.user.id, name.trim(), email.trim(), level, Math.max(0, parseInt(lessons_left, 10) || 0), payment_due || null,
     fmt, cleanContact(telegram, 64), cleanContact(phone, 32), is_trial === true]
  );
  const st = rows[0];
  await ledger(pool, { journalId: st.id, teacherId: req.user.id, delta: st.lessons_left, after: st.lessons_left, reason: 'manual', note: 'Starting balance' }).catch(() => {});
  res.status(201).json({ student: st });
});

/* ── LESSON BALANCE ──────────────────────────────────────────────────────
   Деньги платформа не трогает: ученик переводит преподавателю сам. Здесь
   только пакеты уроков и статусы уроков в расписании. */
const CHARGING = new Set(['present', 'no_show']);
const LESSON_STATUSES = new Set(['present', 'cancelled', 'no_show']);
/* Did this attendance row take a lesson off the balance? charged is NULL on
   rows written before the column existed: those charged by status. */
const wasChargedRow = r => !!r && (r.charged === true || (r.charged == null && CHARGING.has(r.status)));

/* Every change of lessons_left is written here (balance_ledger), so the
   calendar can say why the number is what it is. reason: lesson | refund |
   pack | manual. db is the pool or the client of an open transaction. */
async function ledger(db, { journalId, teacherId, delta, after, reason, date = null, note = null }) {
  if (!delta) return;
  await db.query(
    `INSERT INTO balance_ledger (journal_id, teacher_id, delta, balance_after, reason, lesson_date, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [journalId, teacherId || null, delta, after, reason, date, note ? String(note).slice(0, 200) : null]);
}

/* ── PROGRESS SNAPSHOT ───────────────────────────────────────────────────
   Что ученик получил за текущий пакет (с последнего пополнения): уроки,
   новые фразы в словаре, сделанная домашка. Только то, что платформа
   действительно знает - нулевые пункты в текст не попадают. */
async function packSnapshot(j) {
  const since = j.pack_started_at || j.created_at;
  let uid = j.student_id || null;
  if (!uid && j.email) {
    const u = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [j.email]);
    uid = u.rows[0] ? u.rows[0].id : null;
  }
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM attendance a WHERE a.journal_id=$1 AND a.status='present' AND a.date >= $2::timestamptz::date)::int AS lessons,
       (SELECT COUNT(*) FROM attendance a WHERE a.journal_id=$1 AND a.status='no_show' AND a.date >= $2::timestamptz::date)::int AS no_show,
       (SELECT COUNT(*) FROM vocabulary v WHERE $3::uuid IS NOT NULL AND v.user_id=$3 AND v.created_at >= $2)::int AS phrases,
       (SELECT COUNT(*) FROM vocabulary v WHERE $3::uuid IS NOT NULL AND v.user_id=$3 AND v.last_reviewed_at >= $2)::int AS reviewed,
       (SELECT COUNT(*) FROM homework_assignment ha JOIN homework h ON h.id=ha.homework_id
         WHERE $3::uuid IS NOT NULL AND ha.student_id=$3 AND h.user_id=$4 AND ha.status IN ('submitted','graded') AND ha.submitted_at >= $2)::int AS homework`,
    [j.id, since, uid, j.teacher_id]);
  const n = rows[0];
  const bits = [];
  if (n.lessons) bits.push(`${n.lessons} lesson${n.lessons === 1 ? '' : 's'}`);
  if (n.phrases) bits.push(`${n.phrases} new word${n.phrases === 1 ? '' : 's'} and phrase${n.phrases === 1 ? '' : 's'} in the dictionary`);
  if (n.reviewed) bits.push(`${n.reviewed} reviewed`);
  if (n.homework) bits.push(`${n.homework} homework task${n.homework === 1 ? '' : 's'} done`);
  const since_day = new Date(since).toISOString().slice(0, 10);
  return { ...n, since: since_day, text: bits.length ? `Since ${since_day}: ${bits.join(', ')}.` : '' };
}

/* Ученик: где он числится у преподавателей, остаток и реквизиты для перевода.
   Записи журнала связаны с аккаунтом по student_id или по почте (как и домашка). */
router.get('/me/balance', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT j.id AS journal_id, j.lessons_left, j.pack_size, j.paid_claim_at, j.is_trial,
              to_char(j.payment_due, 'YYYY-MM-DD') AS payment_due,
              t.name AS teacher_name, t.pay_details
         FROM student_journal j
         JOIN users t ON t.id = j.teacher_id
        WHERE j.student_id = $1 OR ($2::text <> '' AND lower(j.email) = lower($2))
        ORDER BY j.created_at`,
      [req.user.id, req.user.email || '']
    );
    // Отчёт нужен, только когда пакет на исходе.
    const full = await pool.query(
      `SELECT * FROM student_journal WHERE id = ANY($1::uuid[])`, [rows.map(r => r.journal_id)]);
    const byId = new Map(full.rows.map(r => [r.id, r]));
    for (const r of rows) {
      r.snapshot = Number(r.lessons_left) <= 1 && byId.get(r.journal_id) ? await packSnapshot(byId.get(r.journal_id)) : null;
    }
    res.json({ balances: rows });
  } catch (err) {
    console.error('[journal/me/balance]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── Lessons calendar ──────────────────────────────────────────────────
   One picture of the package for the student and for the teacher: lessons
   that took place (attendance), the ones planned (schedule slots tied to this
   student) and what is left.
   GET /api/journal/me/calendar   - the student's own (first teacher's entry)
   GET /api/journal/:id/calendar  - the teacher's view of one student */
const isoDay = d => d.toISOString().slice(0, 10);
function plannedDates(slots, taken, from = new Date(), days = 62) {
  const out = new Set();
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (const sl of slots) {
    if (sl.specific_date) {
      const d = String(sl.specific_date).slice(0, 10);
      if (d >= isoDay(start)) out.add(d);
      continue;
    }
    if (sl.recurring === false) continue;
    for (let k = 0; k < days; k++) {
      const d = new Date(start.getTime() + k * 864e5);
      if ((d.getUTCDay() + 6) % 7 === Number(sl.day)) out.add(isoDay(d));   // schedule.day: 0 = Monday
    }
  }
  return [...out].filter(d => !taken.has(d)).sort();
}
/* Lessons that should have happened and nobody marked: slot dates in the
   last `days` days (not before the slot was created) with no attendance row.
   The teacher sees them as "not marked yet"; before, past planned days just
   vanished from the calendar. */
function unmarkedDates(slots, taken, today = new Date(), days = 62) {
  const out = new Set();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end.getTime() - days * 864e5);
  for (const sl of slots) {
    const born = sl.created_at ? isoDay(new Date(sl.created_at)) : isoDay(start);
    if (sl.specific_date) {
      const d = String(sl.specific_date).slice(0, 10);
      if (d >= isoDay(start) && d < isoDay(end)) out.add(d);
      continue;
    }
    if (sl.recurring === false) continue;
    for (let k = 0; k < days; k++) {
      const d = new Date(start.getTime() + k * 864e5);
      const key = isoDay(d);
      if (key >= born && (d.getUTCDay() + 6) % 7 === Number(sl.day)) out.add(key);
    }
  }
  return [...out].filter(d => !taken.has(d)).sort();
}
async function lessonCalendar(j) {
  const [att, slots, teacher, hist] = await Promise.all([
    pool.query(`SELECT to_char(date, 'YYYY-MM-DD') AS date, status, charged FROM attendance WHERE journal_id = $1 AND date > CURRENT_DATE - INTERVAL '400 days' ORDER BY date`, [j.id]),
    pool.query(`SELECT day, recurring, to_char(specific_date, 'YYYY-MM-DD') AS specific_date, created_at FROM schedule WHERE user_id = $1 AND journal_id = $2`, [j.teacher_id, j.id]),
    pool.query('SELECT name, booking_token FROM users WHERE id = $1', [j.teacher_id]),
    pool.query(`SELECT created_at, delta, balance_after, reason, to_char(lesson_date, 'YYYY-MM-DD') AS lesson_date, note
                  FROM balance_ledger WHERE journal_id = $1 ORDER BY created_at DESC LIMIT 30`, [j.id]),
  ]);
  const taken = new Set(att.rows.map(r => r.date));
  return {
    journal_id: j.id, name: j.name, level: j.level || '', teacher_name: (teacher.rows[0] || {}).name || '',
    booking_token: (teacher.rows[0] || {}).booking_token || null,
    lessons_left: Number(j.lessons_left) || 0, pack_size: Number(j.pack_size) || 8, is_trial: !!j.is_trial,
    lessons: att.rows.map(r => ({ date: r.date, status: r.status, charged: wasChargedRow(r) })),
    scheduled: plannedDates(slots.rows, taken), unmarked: unmarkedDates(slots.rows, taken),
    history: hist.rows,
  };
}
router.get('/me/calendar', async (req, res) => {
  try {
    /* A student with two teachers has two packages: one calendar each
       (calendars), the first one also as calendar for older pages. */
    const { rows } = await pool.query(
      `SELECT * FROM student_journal
        WHERE student_id = $1 OR ($2::text <> '' AND lower(email) = lower($2))
        ORDER BY (student_id = $1) DESC NULLS LAST, created_at LIMIT 6`, [req.user.id, req.user.email || '']);
    if (!rows[0]) return res.json({ calendar: null, calendars: [] });
    const calendars = await Promise.all(rows.map(lessonCalendar));
    res.json({ calendar: calendars[0], calendars });
  } catch (err) {
    console.error('[journal/me/calendar]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});
router.get('/:id/calendar', async (req, res) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'not found' });
    const { rows } = await pool.query('SELECT * FROM student_journal WHERE id = $1 AND teacher_id = $2', [req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json({ calendar: await lessonCalendar(rows[0]) });
  } catch (err) {
    console.error('[journal/calendar]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* «Я оплатил»: пометка для преподавателя, пакет она не продлевает. */
router.post('/me/paid', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE student_journal SET paid_claim_at = COALESCE(paid_claim_at, NOW())
        WHERE id = $1 AND (student_id = $2 OR ($3::text <> '' AND lower(email) = lower($3)))
        RETURNING id, teacher_id, name, pack_size`,
      [req.body?.journal_id || null, req.user.id, req.user.email || '']
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    const st = rows[0];
    await createNotification(st.teacher_id, 'payment', `${st.name} says they paid`,
      `Check your card or account, then confirm +${st.pack_size} lessons in Schedule.`, 'schedule.html').catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[journal/me/paid]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* Преподаватель: реквизиты, которые видят его ученики. */
router.get('/pay-details', async (req, res) => {
  const { rows } = await pool.query('SELECT pay_details FROM users WHERE id=$1', [req.user.id]);
  res.json({ pay_details: (rows[0] && rows[0].pay_details) || '' });
});
router.put('/pay-details', async (req, res) => {
  const text = String(req.body?.pay_details ?? '').trim().slice(0, 500);
  await pool.query('UPDATE users SET pay_details=$2 WHERE id=$1', [req.user.id, text || null]);
  res.json({ ok: true, pay_details: text });
});

/* Статусы уроков за период - для отметок в сетке расписания. */
router.get('/sessions', async (req, res) => {
  const ymd = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : null);
  const from = ymd(req.query.from), to = ymd(req.query.to);
  if (!from || !to) return res.status(400).json({ error: 'from and to must be YYYY-MM-DD' });
  const { rows } = await pool.query(
    `SELECT a.journal_id, a.slot_id, to_char(a.date, 'YYYY-MM-DD') AS date, a.status, a.charged
       FROM attendance a WHERE a.teacher_id=$1 AND a.date BETWEEN $2 AND $3`,
    [req.user.id, from, to]
  );
  res.json({ sessions: rows });
});

/* Отчёт по текущему пакету и мягкое напоминание о продлении. */
router.get('/:id/snapshot', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ snapshot: await packSnapshot(rows[0]), name: rows[0].name, lessons_left: rows[0].lessons_left });
});
router.post('/:id/recap', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  const j = rows[0];
  if (!j) return res.status(404).json({ error: 'not found' });
  const snap = await packSnapshot(j);
  const left = Number(j.lessons_left);
  const ask = left <= 0 ? 'Your package is finished - shall we book the next one?' : `${left} lesson${left === 1 ? '' : 's'} left - the next package can start when you are ready.`;
  const text = [snap.text, ask].filter(Boolean).join(' ');
  let who = j.student_id;
  if (!who && j.email) {
    const u = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [j.email]);
    who = u.rows[0] ? u.rows[0].id : null;
  }
  if (!who) return res.status(409).json({ error: 'This student is not on TeachEd yet - copy the text and send it in your messenger', text });
  const sent = await createNotification(who, 'recap', 'Your progress this package', `${text} - ${req.user.name || 'your teacher'}`, 'portal.html');
  if (!sent) return res.status(502).json({ error: 'The message could not be sent', text });
  res.json({ ok: true, text });
});

/* «+пакет» одним нажатием: остаток растёт, пометка «я оплатил» и просрочка
   оплаты снимаются - деньги пришли. */
router.post('/:id/pack', async (req, res) => {
  const { rows: cur } = await pool.query('SELECT pack_size FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  if (!cur.length) return res.status(404).json({ error: 'not found' });
  const n = Math.max(1, Math.min(200, parseInt(req.body?.lessons, 10) || cur[0].pack_size || 8));
  const { rows } = await pool.query(
    `UPDATE student_journal
        SET lessons_left = lessons_left + $3, paid_claim_at = NULL, pack_started_at = NOW(), is_trial = FALSE,
            payment_due = CASE WHEN payment_due <= CURRENT_DATE THEN NULL ELSE payment_due END
      WHERE id=$1 AND teacher_id=$2 RETURNING *, to_char(payment_due, 'YYYY-MM-DD') AS payment_due`,
    [req.params.id, req.user.id, n]
  );
  const st = rows[0];
  await ledger(pool, { journalId: st.id, teacherId: req.user.id, delta: n, after: st.lessons_left, reason: 'pack' }).catch(() => {});
  let who = st.student_id;
  if (!who && st.email) {
    const u = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', [st.email]);
    who = u.rows[0] ? u.rows[0].id : null;
  }
  if (who) {
    await createNotification(who, 'payment', 'Lessons added',
      `${n} lessons were added to your package - ${st.lessons_left} left.`, 'portal.html').catch(() => {});
  }
  res.json({ student: st, added: n });
});

/* Итог урока по расписанию: present (состоялся) и no_show списывают занятие,
   cancelled - нет. Повторный вызов на ту же дату меняет статус и возвращает
   или списывает ровно разницу. status "reset" убирает отметку. */
/* charge (optional): the teacher's choice whether this lesson costs one - a
   trial or make-up lesson held for free (present, charge:false), a late
   cancellation that still counts (cancelled, charge:true). Left out, the
   status decides, as before. */
router.post('/:id/lesson', async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date || '')) ? req.body.date : null;
  const status = String(req.body?.status || '');
  const charge = typeof req.body?.charge === 'boolean' ? req.body.charge : null;
  if (!date || !(LESSON_STATUSES.has(status) || status === 'reset')) return res.status(400).json({ error: 'date and a valid status are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: own } = await client.query('SELECT id, lessons_left, is_trial FROM student_journal WHERE id=$1 AND teacher_id=$2 FOR UPDATE', [req.params.id, req.user.id]);
    if (!own.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }); }
    const slot = /^[0-9a-f-]{36}$/i.test(String(req.body?.slot_id || '')) ? req.body.slot_id : null;
    const { rows: prevRows } = await client.query('SELECT * FROM attendance WHERE journal_id=$1 AND date=$2 FOR UPDATE', [req.params.id, date]);
    const prev = prevRows[0] || null;
    const wasCharged = wasChargedRow(prev);
    // a trial student's lessons are free unless the teacher says otherwise
    const wantCharge = status !== 'reset' && (charge != null ? charge : !own[0].is_trial && CHARGING.has(status));
    let left = own[0].lessons_left, charged = false, delta = 0;
    if (wasCharged && !wantCharge) { left += 1; delta = 1; }    // возврат
    if (wantCharge && !wasCharged) { charged = left > 0; if (charged) { left -= 1; delta = -1; } }
    else if (wantCharge && wasCharged) charged = true;
    if (status === 'reset') {
      if (prev) await client.query('DELETE FROM attendance WHERE id=$1', [prev.id]);
    } else if (prev) {
      await client.query('UPDATE attendance SET status=$2, charged=$3, slot_id=COALESCE($4, slot_id) WHERE id=$1', [prev.id, status, charged, slot]);
    } else {
      await client.query(
        `INSERT INTO attendance (teacher_id, journal_id, date, status, charged, slot_id) VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.user.id, req.params.id, date, status, charged, slot]);
    }
    await client.query('UPDATE student_journal SET lessons_left=$2 WHERE id=$1', [req.params.id, left]);
    await ledger(client, { journalId: req.params.id, teacherId: req.user.id, delta, after: left, reason: delta > 0 ? 'refund' : 'lesson', date, note: status === 'reset' ? 'mark cleared' : status });
    await client.query('COMMIT');
    /* uncharged: the lesson should have cost one but the balance was empty. */
    res.json({ ok: true, status: status === 'reset' ? null : status, charged, lessons_left: left, uncharged: wantCharge && !charged });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[journal/lesson]', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

/* Поправка остатка вручную из календаря: delta ±N с причиной, в историю. */
router.post('/:id/adjust', async (req, res) => {
  const delta = Math.max(-50, Math.min(200, parseInt(req.body?.delta, 10) || 0));
  if (!delta) return res.status(400).json({ error: 'delta required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT lessons_left FROM student_journal WHERE id=$1 AND teacher_id=$2 FOR UPDATE', [req.params.id, req.user.id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }); }
    const before = Number(rows[0].lessons_left) || 0, after = Math.max(0, before + delta);
    await client.query('UPDATE student_journal SET lessons_left=$2 WHERE id=$1', [req.params.id, after]);
    await ledger(client, { journalId: req.params.id, teacherId: req.user.id, delta: after - before, after, reason: 'manual', note: String(req.body?.note || '').trim() || null });
    await client.query('COMMIT');
    res.json({ ok: true, lessons_left: after });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[journal/adjust]', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

/* ── STUDENT PULSE ─────────────────────────────────────────────────────
   Виджет рабочего стола: что по ученикам требует действия прямо сейчас.
   Три сигнала, все из уже существующих данных учителя:
   - пакет кончается: lessons_left 1-2 (0 - только если ученик ходил за
     последний месяц: иначе 0 значит «пакеты не ведутся», это значение по
     умолчанию у каждой записи журнала);
   - домашка сдана и ждёт проверки (homework_assignment.status='submitted');
   - оплата просрочена: payment_due раньше сегодняшнего дня.
   Архив (pulse_hidden) прячет сигнал именно в ЭТОМ состоянии: «pkg:2»
   вернётся как «pkg:1», когда пройдёт урок. */
router.get('/pulse', async (req, res) => {
  try {
    const { rows: studs } = await pool.query(
      `SELECT j.id, j.name, j.email, j.student_id, j.lessons_left, j.is_trial,
              to_char(j.payment_due, 'YYYY-MM-DD') AS payment_due, j.pulse_hidden,
              u.avatar, u.name AS user_name,
              (SELECT MAX(a.date) FROM attendance a WHERE a.journal_id = j.id AND a.status='present') AS last_lesson,
              (CURRENT_DATE - j.payment_due) AS overdue_days
         FROM student_journal j
         LEFT JOIN users u ON u.id = j.student_id
        WHERE j.teacher_id = $1`,
      [req.user.id]
    );
    const items = [];
    const monthAgo = Date.now() - 31 * 864e5;
    for (const st of studs) {
      const hidden = st.pulse_hidden || {};
      const base = { journal_id: st.id, name: st.name, email: st.email || '', avatar: st.avatar || '', registered: !!st.student_id };
      const left = Number(st.lessons_left);
      const recent = st.last_lesson && new Date(st.last_lesson).getTime() > monthAgo;
      if (!st.is_trial && ((left >= 1 && left <= 2) || (left === 0 && recent))) {
        const key = `pkg:${left}`;
        if (!hidden[key]) items.push({ ...base, kind: 'package', key, lessons_left: left, severity: left === 0 ? 3 : 2 });
      }
      if (st.payment_due && Number(st.overdue_days) > 0) {
        const due = st.payment_due;
        const key = `pay:${due}`;
        if (!hidden[key]) items.push({ ...base, kind: 'payment', key, overdue_days: Number(st.overdue_days), payment_due: due, severity: 3 });
      }
    }
    /* Домашка привязана к пользователю-ученику, а не к записи журнала:
       журнал подтягиваем по student_id, иначе по почте. */
    const { rows: hw } = await pool.query(
      `SELECT ha.id AS assignment_id, ha.submitted_at, h.id AS homework_id, h.title,
              u.id AS student_id, u.name, u.email, u.avatar,
              (SELECT j.id FROM student_journal j WHERE j.teacher_id = $1
                  AND (j.student_id = u.id OR lower(j.email) = lower(u.email)) LIMIT 1) AS journal_id
         FROM homework_assignment ha
         JOIN homework h ON h.id = ha.homework_id
         JOIN users u ON u.id = ha.student_id
        WHERE h.user_id = $1 AND ha.status = 'submitted'
        ORDER BY ha.submitted_at DESC NULLS LAST
        LIMIT 20`,
      [req.user.id]
    );
    const hiddenHw = new Map(studs.map(s2 => [s2.id, s2.pulse_hidden || {}]));
    for (const h of hw) {
      const key = `hw:${h.assignment_id}`;
      if (h.journal_id && (hiddenHw.get(h.journal_id) || {})[key]) continue;
      items.push({ kind: 'homework', key, journal_id: h.journal_id, name: h.name, email: h.email || '', avatar: h.avatar || '',
        registered: true, homework_id: h.homework_id, assignment_id: h.assignment_id, title: h.title, submitted_at: h.submitted_at, severity: 1 });
    }
    items.sort((a, b) => b.severity - a.severity);
    res.json({ items, students: studs.length });
  } catch (err) {
    console.error('[journal/pulse]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* Архив сигнала. Для домашки без записи в журнале прятать негде - такую
   сигнал уходит сам, когда учитель её оценит. */
router.post('/:id/pulse-hide', async (req, res) => {
  const key = String(req.body?.key || '').slice(0, 80);
  if (!/^(pkg|pay|hw):/.test(key)) return res.status(400).json({ error: 'bad key' });
  const { rows } = await pool.query(
    `UPDATE student_journal SET pulse_hidden = pulse_hidden || jsonb_build_object($3::text, NOW())
      WHERE id=$1 AND teacher_id=$2 RETURNING id`,
    [req.params.id, req.user.id, key]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

/* Напоминание и сообщение учителя уходят С ПЛАТФОРМЫ: уведомлением в кабинет
   ученика (колокольчик) и письмом на его почту от TeachEd (ответ приходит
   учителю). Ученик без аккаунта получает только письмо; нет ни аккаунта, ни
   почты - сервер честно отвечает 409. Telegram - позже: в журнале уже есть
   поле telegram, не хватает бота. */
const REMIND_TEXT = {
  package: st => ({ title: 'Your lesson package is ending', body: st.lessons_left > 0 ? `${st.lessons_left} lesson${st.lessons_left === 1 ? '' : 's'} left in your package.` : 'Your lesson package is used up.' }),
  payment: () => ({ title: 'Payment reminder', body: 'Your payment for lessons is overdue. Please get in touch with your teacher.' }),
};
const _recentSend = new Map();   // teacher:journal:kind -> time, против двойного клика
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

async function deliverToStudent(req, st, { type, title, body }) {
  const out = { cabinet: false, email: false };
  const teacherName = req.user.name || 'Your teacher';
  let email = st.email || '', name = st.name || '';
  /* A Journal row typed in by hand has an email but no link to the account:
     the reminder went out only as an email and never reached the student's
     cabinet. If a student account has that email, link the row now and
     deliver to the cabinet too. */
  if (!st.student_id && validEmail(email)) {
    try {
      const u = await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1) AND role='student' LIMIT 1`, [String(email).trim()]);
      if (u.rows[0]) {
        st.student_id = u.rows[0].id;
        await pool.query('UPDATE student_journal SET student_id=$1 WHERE id=$2 AND student_id IS NULL', [st.student_id, st.id]);
      }
    } catch (err) { console.error('[journal/deliver] link by email failed:', err.message); }
  }
  if (st.student_id) {
    out.cabinet = await createNotification(st.student_id, type, title, `${body} - ${teacherName}`, 'student.html');
    const u = await pool.query('SELECT email, name FROM users WHERE id=$1', [st.student_id]);
    if (u.rows[0]) { email = u.rows[0].email || email; name = u.rows[0].name || name; }
  }
  if (validEmail(email)) {
    try {
      const t = await pool.query('SELECT email FROM users WHERE id=$1', [req.user.id]);
      const replyTo = validEmail(t.rows[0] && t.rows[0].email) ? t.rows[0].email : undefined;
      const msg = teacherMessageEmail({ studentName: name, teacherName, title, text: body, link: st.student_id ? `${SITE}/student.html` : '' });
      await sendEmail({ to: String(email).trim(), subject: msg.subject, html: msg.html, text: msg.text, replyTo });
      out.email = emailConfigured();
    } catch (err) { console.error('[journal/deliver] email failed:', err.message); }
  }
  return out;
}
async function sendToJournalStudent(req, res, make) {
  const { rows } = await pool.query('SELECT * FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  const st = rows[0];
  if (!st) return res.status(404).json({ error: 'not found' });
  const m = make(st);
  if (m.error) return res.status(400).json({ error: m.error });
  const key = `${req.user.id}:${st.id}:${m.type}`;
  if (Date.now() - (_recentSend.get(key) || 0) < 15000) return res.status(429).json({ error: 'Just sent - wait a moment' });
  if (!st.student_id && !validEmail(st.email)) return res.status(409).json({ error: 'This student is not on TeachEd and has no email in the Journal yet' });
  _recentSend.set(key, Date.now());
  const out = await deliverToStudent(req, st, m);
  if (!out.cabinet && !out.email) { _recentSend.delete(key); return res.status(502).json({ error: 'It could not be sent' }); }
  res.json({ ok: true, ...out });
}
router.post('/:id/remind', (req, res) => {
  const kind = String(req.body?.kind || '');
  if (!REMIND_TEXT[kind]) return res.status(400).json({ error: 'bad kind' });
  sendToJournalStudent(req, res, st => ({ type: 'reminder', ...REMIND_TEXT[kind](st) }))
    .catch(err => { console.error('[journal/remind]', err.message); res.status(500).json({ error: 'Server error' }); });
});
router.post('/:id/message', (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 1000);
  sendToJournalStudent(req, res, () => text
    ? { type: 'message', title: `Message from ${req.user.name || 'your teacher'}`, body: text }
    : { error: 'Write a message first' })
    .catch(err => { console.error('[journal/message]', err.message); res.status(500).json({ error: 'Server error' }); });
});

router.patch('/:id', async (req, res) => {
  const { name, email, level, lessons_left, notes, payment_due, format, telegram, phone, is_trial } = req.body;
  const sets=[]; const p=[req.params.id, req.user.id];
  if (format!==undefined)       { p.push(['individual','group'].includes(format) ? format : null); sets.push(`format=$${p.length}`); }
  if (telegram!==undefined)     { p.push(cleanContact(telegram, 64)); sets.push(`telegram=$${p.length}`); }
  if (phone!==undefined)        { p.push(cleanContact(phone, 32));    sets.push(`phone=$${p.length}`); }
  if (name!==undefined)         { p.push(name);         sets.push(`name=$${p.length}`); }
  if (email!==undefined)        { p.push(email);        sets.push(`email=$${p.length}`); }
  if (level!==undefined)        { p.push(level);        sets.push(`level=$${p.length}`); }
  if (lessons_left!==undefined) { p.push(Math.max(0, Math.min(1000, parseInt(lessons_left, 10) || 0))); sets.push(`lessons_left=$${p.length}`); }
  if (notes!==undefined)        { p.push(notes);        sets.push(`notes=$${p.length}`); }
  if (is_trial!==undefined)     { p.push(is_trial === true); sets.push(`is_trial=$${p.length}`); }
  if (payment_due!==undefined) {
    if (payment_due && !/^\d{4}-\d{2}-\d{2}$/.test(String(payment_due))) return res.status(400).json({ error: 'payment_due must be YYYY-MM-DD' });
    p.push(payment_due || null); sets.push(`payment_due=$${p.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  const { rows } = await pool.query(
    `WITH o AS (SELECT lessons_left AS old_left FROM student_journal WHERE id=$1 AND teacher_id=$2)
     UPDATE student_journal SET ${sets.join(',')} WHERE id=$1 AND teacher_id=$2 RETURNING student_journal.*, (SELECT old_left FROM o) AS old_left`, p
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  const { old_left, ...st } = rows[0];
  if (lessons_left !== undefined && st.lessons_left !== old_left) {
    await ledger(pool, { journalId: st.id, teacherId: req.user.id, delta: st.lessons_left - old_left, after: st.lessons_left, reason: 'manual', note: 'Balance edited' }).catch(() => {});
  }
  res.json({ student: st });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

/* ── ATTENDANCE ── */
router.post('/:id/attendance', async (req, res) => {
  const { date = new Date().toISOString().slice(0,10), status = 'present', note = '' } = req.body;
  // verify ownership
  const { rows: own } = await pool.query('SELECT id FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  if (!own.length) return res.status(403).json({ error: 'not your student' });
  // App-level guard in addition to the DB unique index (schema.sql): if the
  // index couldn't be created because older duplicate rows already exist,
  // this still stops a plain double-submit from double-deducting a lesson.
  const { rows: dup } = await pool.query(
    'SELECT id FROM attendance WHERE journal_id=$1 AND date=$2 LIMIT 1',
    [req.params.id, date]
  );
  if (dup.length) return res.json({ ok: true, record: null });
  const { rows } = await pool.query(
    `INSERT INTO attendance (teacher_id,journal_id,date,status,note)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT DO NOTHING RETURNING *`,
    [req.user.id, req.params.id, date, status, note]
  );
  // Deduct lesson if present - only for a row we actually just inserted.
  // ON CONFLICT DO NOTHING returns no row for a duplicate (id, date), so a
  // double-submit (double-click, retry, two tabs) no-ops here too instead of
  // deducting a second lesson for the same attendance record.
  if (status === 'present' && rows.length) {
    const { rows: dd } = await pool.query(
      `UPDATE student_journal SET lessons_left = lessons_left - 1 WHERE id=$1 AND lessons_left > 0 RETURNING lessons_left`,
      [req.params.id]
    );
    await pool.query('UPDATE attendance SET charged=$2 WHERE id=$1', [rows[0].id, !!dd[0]]);
    if (dd[0]) await ledger(pool, { journalId: req.params.id, teacherId: req.user.id, delta: -1, after: dd[0].lessons_left, reason: 'lesson', date, note: 'present' }).catch(() => {});
  }
  res.json({ ok: true, record: rows[0] || null });
});

router.get('/:id/attendance', async (req, res) => {
  const { rows: own } = await pool.query('SELECT id FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  if (!own.length) return res.status(403).json({ error: 'not your student' });
  const { rows } = await pool.query(
    'SELECT * FROM attendance WHERE journal_id=$1 ORDER BY date DESC LIMIT 50',
    [req.params.id]
  );
  res.json({ records: rows });
});

/* ── VOCABULARY ── */
router.get('/vocab/list', async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM vocabulary WHERE user_id=$1 AND kind='word' ORDER BY created_at DESC LIMIT 200",
    [req.user.id]
  );
  const learned = rows.filter(r=>r.learned).length;
  res.json({ words: rows, learned, toLearn: rows.length - learned });
});

router.post('/vocab', async (req, res) => {
  const { word, translation='', example='' } = req.body;
  if (!word) return res.status(400).json({ error: 'word required' });
  const { rows } = await pool.query(
    `INSERT INTO vocabulary (user_id,word,translation,example)
     VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *`,
    [req.user.id, word.trim(), translation.trim(), example.trim()]
  );
  res.status(201).json({ word: rows[0] });
});

router.patch('/vocab/:id', async (req, res) => {
  const { learned } = req.body;
  const { rows } = await pool.query(
    'UPDATE vocabulary SET learned=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
    [learned, req.params.id, req.user.id]
  );
  res.json({ word: rows[0] });
});

router.delete('/vocab/:id', async (req, res) => {
  await pool.query('DELETE FROM vocabulary WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
module.exports._test = { plannedDates, unmarkedDates, wasChargedRow };
