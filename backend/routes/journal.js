const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('./notifications');

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
  const { name, email='', level='A2', lessons_left=0, payment_due=null, format=null, telegram=null, phone=null } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (payment_due && !/^\d{4}-\d{2}-\d{2}$/.test(String(payment_due))) return res.status(400).json({ error: 'payment_due must be YYYY-MM-DD' });
  const fmt = ['individual', 'group'].includes(format) ? format : null;
  const { rows } = await pool.query(
    `INSERT INTO student_journal (teacher_id,name,email,level,lessons_left,payment_due,format,telegram,phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, name.trim(), email.trim(), level, Math.max(0, parseInt(lessons_left, 10) || 0), payment_due || null,
     fmt, cleanContact(telegram, 64), cleanContact(phone, 32)]
  );
  res.status(201).json({ student: rows[0] });
});

/* ── LESSON BALANCE ──────────────────────────────────────────────────────
   Деньги платформа не трогает: ученик переводит преподавателю сам. Здесь
   только пакеты уроков и статусы уроков в расписании. */
const CHARGING = new Set(['present', 'no_show']);
const LESSON_STATUSES = new Set(['present', 'cancelled', 'no_show']);

/* Ученик: где он числится у преподавателей, остаток и реквизиты для перевода.
   Записи журнала связаны с аккаунтом по student_id или по почте (как и домашка). */
router.get('/me/balance', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT j.id AS journal_id, j.lessons_left, j.pack_size, j.paid_claim_at,
              to_char(j.payment_due, 'YYYY-MM-DD') AS payment_due,
              t.name AS teacher_name, t.pay_details
         FROM student_journal j
         JOIN users t ON t.id = j.teacher_id
        WHERE j.student_id = $1 OR ($2::text <> '' AND lower(j.email) = lower($2))
        ORDER BY j.created_at`,
      [req.user.id, req.user.email || '']
    );
    res.json({ balances: rows });
  } catch (err) {
    console.error('[journal/me/balance]', err.message);
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

/* «+пакет» одним нажатием: остаток растёт, пометка «я оплатил» и просрочка
   оплаты снимаются - деньги пришли. */
router.post('/:id/pack', async (req, res) => {
  const { rows: cur } = await pool.query('SELECT pack_size FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  if (!cur.length) return res.status(404).json({ error: 'not found' });
  const n = Math.max(1, Math.min(200, parseInt(req.body?.lessons, 10) || cur[0].pack_size || 8));
  const { rows } = await pool.query(
    `UPDATE student_journal
        SET lessons_left = lessons_left + $3, paid_claim_at = NULL,
            payment_due = CASE WHEN payment_due <= CURRENT_DATE THEN NULL ELSE payment_due END
      WHERE id=$1 AND teacher_id=$2 RETURNING *, to_char(payment_due, 'YYYY-MM-DD') AS payment_due`,
    [req.params.id, req.user.id, n]
  );
  const st = rows[0];
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
router.post('/:id/lesson', async (req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date || '')) ? req.body.date : null;
  const status = String(req.body?.status || '');
  if (!date || !(LESSON_STATUSES.has(status) || status === 'reset')) return res.status(400).json({ error: 'date and a valid status are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: own } = await client.query('SELECT id, lessons_left FROM student_journal WHERE id=$1 AND teacher_id=$2 FOR UPDATE', [req.params.id, req.user.id]);
    if (!own.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }); }
    const slot = /^[0-9a-f-]{36}$/i.test(String(req.body?.slot_id || '')) ? req.body.slot_id : null;
    const { rows: prevRows } = await client.query('SELECT * FROM attendance WHERE journal_id=$1 AND date=$2 FOR UPDATE', [req.params.id, date]);
    const prev = prevRows[0] || null;
    const wasCharged = !!prev && CHARGING.has(prev.status) && prev.charged !== false;
    const wantCharge = CHARGING.has(status);
    let left = own[0].lessons_left, charged = null;
    if (wasCharged && !wantCharge) left += 1;                  // возврат
    if (wantCharge && !wasCharged) { charged = left > 0; if (charged) left -= 1; }
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
    await client.query('COMMIT');
    res.json({ ok: true, status: status === 'reset' ? null : status, lessons_left: left });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[journal/lesson]', err.message);
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
      `SELECT j.id, j.name, j.email, j.student_id, j.lessons_left,
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
      if ((left >= 1 && left <= 2) || (left === 0 && recent)) {
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

/* Напоминание уходит уведомлением в TeachEd (колокольчик ученика). Если
   ученик не зарегистрирован, сказать ему можно только письмом - это
   решает клиент (mailto), сервер честно отвечает 409. */
const REMIND_TEXT = {
  package: st => ({ title: 'Your lesson package is ending', body: st.lessons_left > 0 ? `${st.lessons_left} lesson${st.lessons_left === 1 ? '' : 's'} left in your package.` : 'Your lesson package is used up.' }),
  payment: () => ({ title: 'Payment reminder', body: 'Your payment for lessons is overdue. Please get in touch with your teacher.' }),
};
router.post('/:id/remind', async (req, res) => {
  const kind = String(req.body?.kind || '');
  if (!REMIND_TEXT[kind]) return res.status(400).json({ error: 'bad kind' });
  const { rows } = await pool.query('SELECT * FROM student_journal WHERE id=$1 AND teacher_id=$2', [req.params.id, req.user.id]);
  const st = rows[0];
  if (!st) return res.status(404).json({ error: 'not found' });
  if (!st.student_id) return res.status(409).json({ error: 'This student is not on TeachEd yet', email: st.email || '' });
  const msg = REMIND_TEXT[kind](st);
  const sent = await createNotification(st.student_id, 'reminder', msg.title, `${msg.body} - ${req.user.name || 'your teacher'}`, 'student.html');
  if (!sent) return res.status(502).json({ error: 'The reminder could not be sent' });
  res.json({ ok: true });
});

router.patch('/:id', async (req, res) => {
  const { name, email, level, lessons_left, notes, payment_due, format, telegram, phone } = req.body;
  const sets=[]; const p=[req.params.id, req.user.id];
  if (format!==undefined)       { p.push(['individual','group'].includes(format) ? format : null); sets.push(`format=$${p.length}`); }
  if (telegram!==undefined)     { p.push(cleanContact(telegram, 64)); sets.push(`telegram=$${p.length}`); }
  if (phone!==undefined)        { p.push(cleanContact(phone, 32));    sets.push(`phone=$${p.length}`); }
  if (name!==undefined)         { p.push(name);         sets.push(`name=$${p.length}`); }
  if (email!==undefined)        { p.push(email);        sets.push(`email=$${p.length}`); }
  if (level!==undefined)        { p.push(level);        sets.push(`level=$${p.length}`); }
  if (lessons_left!==undefined) { p.push(lessons_left); sets.push(`lessons_left=$${p.length}`); }
  if (notes!==undefined)        { p.push(notes);        sets.push(`notes=$${p.length}`); }
  if (payment_due!==undefined) {
    if (payment_due && !/^\d{4}-\d{2}-\d{2}$/.test(String(payment_due))) return res.status(400).json({ error: 'payment_due must be YYYY-MM-DD' });
    p.push(payment_due || null); sets.push(`payment_due=$${p.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  const { rows } = await pool.query(
    `UPDATE student_journal SET ${sets.join(',')} WHERE id=$1 AND teacher_id=$2 RETURNING *`, p
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ student: rows[0] });
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
    await pool.query(
      `UPDATE student_journal SET lessons_left = GREATEST(0, lessons_left - 1) WHERE id=$1`,
      [req.params.id]
    );
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
