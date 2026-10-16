const express       = require('express');
const router        = express.Router();
const pool          = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { webpush, pushConfigured } = require('../lib/pushConfig');

/* DATE из node-pg приходит объектом Date на полночь сервера; в JSON он
   уходил как "2026-09-24T21:00:00.000Z", и страница, отрезав 10 символов,
   получала ПРЕДЫДУЩИЙ день (у всех восточнее UTC). Отдаём чистую дату. */
const _ymd = d => d instanceof Date
  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  : (d ? String(d).slice(0, 10) : d);
const normSlot = r => (r ? { ...r, specific_date: _ymd(r.specific_date) } : r);

// meeting_url ends up as the click-through link on a push notification sent
// to every enrolled student - restrict it to actual web links so it can't
// carry a javascript:/data: payload or other non-navigable scheme.
function safeMeetingUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(String(raw).trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
  } catch { return null; }
}


/* Ученик из журнала преподавателя: чужую запись привязать нельзя. */
async function ownJournalId(teacherId, journalId) {
  if (!journalId || !/^[0-9a-f-]{36}$/i.test(String(journalId))) return null;
  const { rows } = await pool.query('SELECT id FROM student_journal WHERE id=$1 AND teacher_id=$2', [journalId, teacherId]);
  return rows[0] ? rows[0].id : null;
}

async function notifyStudentsLive(slot) {
  if (!pushConfigured) return;
  try {
    /* Кому: урок одного ученика (slot.journal_id) будит только его. Раньше
       «Live class started» прилетал всем ученикам учителя со всех досок, и
       чужой индивидуальный урок звенел у всей группы - лучший способ
       приучить выключать уведомления. Групповой слот без ученика - как было:
       все ученики досок учителя. */
    const { rows: subs } = slot.journal_id
      ? await pool.query(`
          SELECT ps.subscription FROM push_subscriptions ps
            JOIN student_journal j ON j.student_id = ps.user_id
           WHERE j.id = $1 AND j.teacher_id = $2`, [slot.journal_id, slot.user_id])
      : await pool.query(`
          SELECT ps.subscription FROM push_subscriptions ps
          WHERE ps.user_id IN (
            SELECT DISTINCT bc.user_id FROM board_collaborators bc
            JOIN boards b ON b.id = bc.board_id
            WHERE b.user_id = $1
          )
        `, [slot.user_id]);

    // a lesson without its own link uses the teacher's regular one
    let url = slot.meeting_url;
    if (!url) {
      const { rows } = await pool.query('SELECT meeting_url FROM users WHERE id = $1', [slot.user_id]);
      url = safeMeetingUrl(rows[0]?.meeting_url);
    }
    const payload = JSON.stringify({
      title: '🔴 Live class started!',
      body: `${slot.title} is now live. Click to join.`,
      url: url || '/'
    });

    await Promise.allSettled(
      subs.map(r => webpush.sendNotification(r.subscription, payload).catch(() => {}))
    );
  } catch (err) {
    console.error('[push live notify]', err.message);
  }
}

// GET /api/schedule/student-zones - distinct timezones of all students connected to this teacher
router.get('/student-zones', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.timezone, COUNT(DISTINCT u.id)::int AS student_count, u.name AS sample_name
      FROM board_collaborators bc
      JOIN boards b ON b.id = bc.board_id
      JOIN users  u ON u.id = bc.user_id
      WHERE b.user_id = $1 AND u.timezone IS NOT NULL
      GROUP BY u.timezone, u.name
      ORDER BY student_count DESC
    `, [req.user.id]);
    // Deduplicate by timezone, aggregate names
    const zoneMap = new Map();
    for (const r of rows) {
      const tz = r.timezone;
      if (!zoneMap.has(tz)) {
        zoneMap.set(tz, { timezone: tz, student_count: 0, sample_names: [] });
      }
      const entry = zoneMap.get(tz);
      entry.student_count += r.student_count;
      if (entry.sample_names.length < 3) entry.sample_names.push(r.sample_name);
    }
    res.json({ zones: Array.from(zoneMap.values()) });
  } catch (err) {
    console.error('[schedule] GET /student-zones error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/schedule - get user's weekly schedule
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, j.name AS student_name, j.level AS student_level, u.avatar AS student_avatar,
              (SELECT COUNT(*) FROM schedule_members m WHERE m.schedule_id = s.id)::int AS member_count,
              /* группа: у урока есть состав, или название группы, которое не
                 имя одного ученика (старые слоты и брони хранят имя ученика
                 в group_name) и не пресет «1:1» */
              (EXISTS (SELECT 1 FROM schedule_members m WHERE m.schedule_id = s.id)
               OR (s.journal_id IS NULL AND s.booked_by_email IS NULL
                   AND COALESCE(btrim(s.group_name), '') !~ '^(|1[[:space:]]*:[[:space:]]*1)$'
                   AND NOT EXISTS (SELECT 1 FROM student_journal sj WHERE sj.teacher_id = s.user_id AND lower(btrim(sj.name)) = lower(btrim(s.group_name))))) AS is_group
         FROM schedule s
         LEFT JOIN student_journal j ON j.id = s.journal_id AND j.teacher_id = s.user_id
         LEFT JOIN users u ON u.id = j.student_id
        WHERE s.user_id = $1 ORDER BY s.day, s.start_time`,
      [req.user.id]
    );
    res.json({ schedule: rows.map(normSlot) });
  } catch (err) {
    console.error('[schedule] GET error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/schedule/live - all currently live sessions across all teachers
router.get('/live', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.name AS teacher_name, u.avatar AS teacher_avatar, u.meeting_url AS teacher_meeting_url
       FROM schedule s
       JOIN users u ON u.id = s.user_id
       WHERE s.is_live = TRUE
         AND (
           s.user_id=$1 OR EXISTS (
             SELECT 1
               FROM boards b
               JOIN board_collaborators bc ON bc.board_id=b.id
              WHERE b.user_id=s.user_id AND bc.user_id=$1
                AND (s.board_id IS NULL OR b.id::text=s.board_id)
           )
         )
       ORDER BY s.start_time`,
      [req.user.id]
    );
    // Use teacher's profile meeting_url as fallback if slot has none
    const sessions = rows.map(r => ({
      ...r,
      meeting_url: r.meeting_url || r.teacher_meeting_url || null
    }));
    res.json({ sessions });
  } catch (err) {
    console.error('[schedule] GET /live error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/schedule - create or update a class slot
router.post('/', requireAuth, requireTeacher, async (req, res) => {
  const { id, day, start_time, end_time, title, group_name, level, room, color, recurring, meeting_url, is_live, specific_date, board_id } = req.body;
  try {
    const hasJ = Object.prototype.hasOwnProperty.call(req.body, 'journal_id');
    const journalId = hasJ ? await ownJournalId(req.user.id, req.body.journal_id) : null;
    if (id) {
      const { rows } = await pool.query(
        `UPDATE schedule SET day=$1, start_time=$2, end_time=$3, title=$4, group_name=$5, level=$6, room=$7, color=$8, recurring=$9, meeting_url=$10, is_live=$11, specific_date=$12, board_id=$13
         WHERE id=$14 AND user_id=$15 RETURNING *`,
        [day, start_time, end_time, title || 'Class', group_name, level, room, color || '#CDF649', recurring !== false, safeMeetingUrl(meeting_url), is_live || false, specific_date || null, board_id || null, id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
      if (hasJ) { await pool.query('UPDATE schedule SET journal_id=$1 WHERE id=$2 AND user_id=$3', [journalId, id, req.user.id]); rows[0].journal_id = journalId; }
      return res.json({ slot: normSlot(rows[0]) });
    }
    const { rows } = await pool.query(
      `INSERT INTO schedule (user_id, day, start_time, end_time, title, group_name, level, room, color, recurring, meeting_url, is_live, specific_date, board_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.id, day, start_time, end_time, title || 'Class', group_name, level, room, color || '#CDF649', recurring !== false, safeMeetingUrl(meeting_url), is_live || false, specific_date || null, board_id || null]
    );
    if (journalId) { await pool.query('UPDATE schedule SET journal_id=$1 WHERE id=$2', [journalId, rows[0].id]); rows[0].journal_id = journalId; }
    res.status(201).json({ slot: normSlot(rows[0]) });
  } catch (err) {
    console.error('[schedule] POST error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/schedule/:id - update a slot
router.patch('/:id', requireAuth, requireTeacher, async (req, res) => {
  if (req.params.id === 'live') return res.status(404).json({ error: 'Not found' });
  const { day, start_time, end_time, title, group_name, level, room, color, recurring, meeting_url, is_live, specific_date, board_id } = req.body;
  try {
    const hasJ = Object.prototype.hasOwnProperty.call(req.body, 'journal_id');
    const journalId = hasJ ? await ownJournalId(req.user.id, req.body.journal_id) : null;
    const { rows } = await pool.query(
      `UPDATE schedule SET day=$1, start_time=$2, end_time=$3, title=$4,
        group_name=$5, level=$6, room=$7, color=$8, recurring=$9, meeting_url=$10, is_live=$11, specific_date=$12, board_id=$13
       WHERE id=$14 AND user_id=$15 RETURNING *`,
      [day, start_time, end_time, title||'Class', group_name||null, level||null,
       room||null, color||'#CDF649', recurring!==false, safeMeetingUrl(meeting_url), is_live||false,
       specific_date||null, board_id||null, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
    if (hasJ) { await pool.query('UPDATE schedule SET journal_id=$1 WHERE id=$2 AND user_id=$3', [journalId, req.params.id, req.user.id]); rows[0].journal_id = journalId; }
    res.json({ slot: normSlot(rows[0]) });
  } catch (err) {
    console.error('[schedule] PATCH error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/schedule/:id/live - toggle live status (owner only)
router.patch('/:id/live', requireAuth, requireTeacher, async (req, res) => {
  const { is_live, meeting_url } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE schedule SET is_live=$1, meeting_url=COALESCE($2, meeting_url)
       WHERE id=$3 AND user_id=$4 RETURNING *`,
      [is_live === true, safeMeetingUrl(meeting_url), req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Slot not found' });
    if (is_live === true) notifyStudentsLive(rows[0]);
    res.json({ slot: normSlot(rows[0]) });
  } catch (err) {
    console.error('[schedule] PATCH /live error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/schedule/:id - delete a slot
router.delete('/:id', requireAuth, requireTeacher, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM schedule WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Slot not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[schedule] DELETE error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── Group lessons (15.10.2026) ──────────────────────────────────────────
   Who is in a lesson: the Journal students in schedule_members, plus the
   slot's own student (schedule.journal_id) when it has one. For each of them
   the desktop shows the package, the payment and the homework, so a group
   is checked at a glance before the lesson. */
const UUID_RE = /^[0-9a-f-]{36}$/i;
async function ownSlot(teacherId, slotId) {
  if (!UUID_RE.test(String(slotId))) return null;
  const { rows } = await pool.query('SELECT * FROM schedule WHERE id=$1 AND user_id=$2', [slotId, teacherId]);
  return rows[0] || null;
}
// the Journal rows of a slot, with what the teacher needs to see about each
async function slotMembers(teacherId, slot) {
  const { rows } = await pool.query(
    `SELECT j.id AS journal_id, j.name, j.email, j.level, j.lessons_left, j.pack_size, j.is_trial,
            to_char(j.payment_due, 'YYYY-MM-DD') AS payment_due,
            GREATEST(CURRENT_DATE - j.payment_due, 0)::int AS overdue_days,
            j.paid_claim_at, (j.student_id IS NOT NULL) AS registered, u.avatar,
            COALESCE(hw.todo, 0)::int AS hw_todo, COALESCE(hw.late, 0)::int AS hw_late, COALESCE(hw.review, 0)::int AS hw_review,
            (m.journal_id IS NULL) AS is_slot_student
       FROM student_journal j
       LEFT JOIN schedule_members m ON m.journal_id = j.id AND m.schedule_id = $2
       LEFT JOIN users u ON u.id = j.student_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE ha.status IN ('assigned','in_progress')) AS todo,
                COUNT(*) FILTER (WHERE ha.status IN ('assigned','in_progress') AND h.due_at < NOW()) AS late,
                COUNT(*) FILTER (WHERE ha.status = 'submitted') AS review
           FROM homework_assignment ha
           JOIN homework h ON h.id = ha.homework_id AND h.user_id = $1
           JOIN users su ON su.id = ha.student_id
          WHERE su.id = j.student_id OR (j.student_id IS NULL AND COALESCE(j.email, '') <> '' AND lower(su.email) = lower(j.email))
       ) hw ON TRUE
      WHERE j.teacher_id = $1 AND (m.journal_id IS NOT NULL OR j.id = $3)
      ORDER BY lower(j.name)`,
    [teacherId, slot.id, slot.journal_id || null]
  );
  return rows;
}

// GET /api/schedule/:id/members - who is in this lesson, and who might be
router.get('/:id/members', requireAuth, requireTeacher, async (req, res) => {
  try {
    const slot = await ownSlot(req.user.id, req.params.id);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    const members = await slotMembers(req.user.id, slot);
    /* Подсказка, пока группа не собрана: ученики, которые уже сидят на доске
       этого урока (board_collaborators), - их записи в журнале. */
    const have = members.map(m => m.journal_id);
    const { rows: suggested } = slot.board_id ? await pool.query(
      `SELECT DISTINCT j.id AS journal_id, j.name, j.level
         FROM boards b
         JOIN board_collaborators bc ON bc.board_id = b.id
         JOIN student_journal j ON j.teacher_id = b.user_id AND j.student_id = bc.user_id
        WHERE b.id::text = $1 AND b.user_id = $2 AND NOT (j.id = ANY($3::uuid[]))
        ORDER BY j.name`, [String(slot.board_id), req.user.id, have]) : { rows: [] };
    res.json({ members, suggested });
  } catch (err) {
    console.error('[schedule] GET /:id/members error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/schedule/:id/members { journal_ids: [...] } - the whole list
router.put('/:id/members', requireAuth, requireTeacher, async (req, res) => {
  const ids = Array.isArray(req.body?.journal_ids) ? [...new Set(req.body.journal_ids.map(String).filter(x => UUID_RE.test(x)))].slice(0, 60) : null;
  if (!ids) return res.status(400).json({ error: 'journal_ids must be a list' });
  const client = await pool.connect();
  try {
    const slot = await ownSlot(req.user.id, req.params.id);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    await client.query('BEGIN');
    // только свои ученики: чужой id просто не попадёт в список
    await client.query('DELETE FROM schedule_members WHERE schedule_id=$1', [slot.id]);
    if (ids.length) await client.query(
      `INSERT INTO schedule_members (schedule_id, journal_id)
       SELECT $1, j.id FROM student_journal j WHERE j.teacher_id = $2 AND j.id = ANY($3::uuid[])
       ON CONFLICT DO NOTHING`, [slot.id, req.user.id, ids]);
    await client.query('COMMIT');
    res.json({ members: await slotMembers(req.user.id, slot) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[schedule] PUT /:id/members error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

/* POST /api/schedule/:id/message { text, journal_ids? } - one message to the
   whole group (or to the ones ticked), the same way as a message to one
   student: their cabinet and their email. The answer says who got it. */
const _groupSend = new Map();
router.post('/:id/message', requireAuth, requireTeacher, async (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'Write a message first' });
  try {
    const slot = await ownSlot(req.user.id, req.params.id);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    const only = Array.isArray(req.body?.journal_ids) ? new Set(req.body.journal_ids.map(String)) : null;
    const members = (await slotMembers(req.user.id, slot)).filter(m => !only || only.has(m.journal_id));
    if (!members.length) return res.status(400).json({ error: 'Add students to this group first' });
    const key = `${req.user.id}:${slot.id}`;
    if (Date.now() - (_groupSend.get(key) || 0) < 15000) return res.status(429).json({ error: 'Just sent - wait a moment' });
    _groupSend.set(key, Date.now());
    const { deliverToStudent } = require('./journal');
    const { rows: studs } = await pool.query('SELECT * FROM student_journal WHERE teacher_id=$1 AND id = ANY($2::uuid[])', [req.user.id, members.map(m => m.journal_id)]);
    const title = `Message from ${req.user.name || 'your teacher'}`;
    const results = [];
    for (const st of studs) {
      const out = await deliverToStudent(req, st, { type: 'message', title, body: text }).catch(() => ({ cabinet: false, email: false }));
      results.push({ journal_id: st.id, name: st.name, cabinet: !!out.cabinet, email: !!out.email });
    }
    const sent = results.filter(r => r.cabinet || r.email).length;
    if (!sent) _groupSend.delete(key);
    res.status(sent ? 200 : 502).json({ ok: sent > 0, sent, total: results.length, results, ...(sent ? {} : { error: 'It could not be sent' }) });
  } catch (err) {
    console.error('[schedule] POST /:id/message error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
