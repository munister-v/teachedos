/* Booking: the teacher marks weekly hours as open for booking or busy, and
   shares one link. Students open it without an account, see only the open
   hours that are still free, and book one - the class lands in the
   teacher's schedule on its own.

   Teacher (auth):  GET/POST /api/booking/blocks, POST /api/booking/blocks/clear,
                    DELETE /api/booking/blocks/:id, GET /api/booking/link,
                    POST /api/booking/link/rotate
   Public:          GET/POST /api/booking/public/:token

   Times are the teacher's local wall-clock times (users.timezone), the same
   convention the schedule table uses. Days are 0=Mon. */
const router    = require('express').Router();
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const pool      = require('../db/pool');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { sendEmailQuietly, SITE } = require('../lib/email');

const DAYS_AHEAD = 14;
const MIN_NOTICE_MIN = 60;           // no booking that starts within the hour
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:00)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN_RE = /^[0-9a-f]{24}$/;

const toMin = t => { const [h, m] = String(t).split(':'); return +h * 60 + +m; };
const fmt = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
const newToken = () => crypto.randomBytes(12).toString('hex');
const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Today's date and the current minute in the teacher's zone. */
function nowIn(tz) {
  let parts;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map(p => [p.type, p.value]));
  } catch { return nowIn('Europe/Kyiv'); }
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: +parts.hour * 60 + +parts.minute };
}
function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
const weekdayOf = date => { const [y, m, d] = date.split('-').map(Number); return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; };

/* Free bookable starts per date: open blocks cut into lesson-length pieces,
   minus classes already on that date and busy blocks, minus the past. */
async function freeSlots(teacher) {
  const [{ rows: blocks }, { rows: lessons }] = await Promise.all([
    pool.query('SELECT day, start_time, end_time, kind FROM schedule_blocks WHERE user_id=$1', [teacher.id]),
    pool.query(`SELECT day, start_time, end_time, to_char(specific_date,'YYYY-MM-DD') AS specific_date
                  FROM schedule WHERE user_id=$1`, [teacher.id]),
  ]);
  const len = Math.min(180, Math.max(30, Number(teacher.booking_minutes) || 60));
  const now = nowIn(teacher.timezone);
  const days = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const date = addDays(now.date, i);
    const wd = weekdayOf(date);
    const taken = [
      ...lessons.filter(l => (l.specific_date ? l.specific_date === date : l.day === wd))
        .map(l => { const s = toMin(l.start_time); let e = toMin(l.end_time); if (e <= s) e += 1440; return [s, e]; }),
      ...blocks.filter(b => b.kind === 'busy' && b.day === wd).map(b => [toMin(b.start_time), toMin(b.end_time)]),
    ];
    const slots = [];
    blocks.filter(b => b.kind === 'open' && b.day === wd).forEach(b => {
      const end = toMin(b.end_time);
      for (let s = toMin(b.start_time); s + len <= end; s += len) {
        if (i === 0 && s < now.minute + MIN_NOTICE_MIN) continue;
        if (taken.some(([a, z]) => overlaps(s, s + len, a, z))) continue;
        slots.push(fmt(s));
      }
    });
    if (slots.length) days.push({ date, weekday: wd, slots: [...new Set(slots)].sort() });
  }
  return { days, minutes: len };
}

async function teacherByToken(token) {
  if (!TOKEN_RE.test(String(token || ''))) return null;
  const { rows } = await pool.query(
    `SELECT id, name, email, avatar, timezone, booking_minutes FROM users WHERE booking_token=$1`, [token]);
  return rows[0] || null;
}

/* ── Teacher: weekly open / busy blocks ─────────────────────────────── */
router.get('/blocks', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, day, to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time, kind, label
       FROM schedule_blocks WHERE user_id=$1 ORDER BY day, start_time`, [req.user.id]);
  res.json({ blocks: rows });
});

function readRange(body) {
  const day = Number(body?.day);
  const start = String(body?.start_time || ''), end = String(body?.end_time || '');
  if (!Number.isInteger(day) || day < 0 || day > 6) return { error: 'day must be 0-6 (Mon-Sun)' };
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return { error: 'times must be HH:MM' };
  if (toMin(end) <= toMin(start)) return { error: 'end must be after start' };
  return { day, start: start.slice(0, 5), end: end.slice(0, 5) };
}

/* Вырезает [start,end) из блоков дня: перекрытые куски уходят, края,
   торчащие за диапазон, остаются своими блоками. «Busy» 11-12 поверх
   «open» 10-13 оставляет open 10-11 и 12-13, а не стирает всё окно. */
async function cutRange(client, userId, day, start, end) {
  const { rows } = await client.query(
    `DELETE FROM schedule_blocks WHERE user_id=$1 AND day=$2 AND start_time < $4::time AND end_time > $3::time
     RETURNING to_char(start_time,'HH24:MI') AS s, to_char(end_time,'HH24:MI') AS e, kind, label`,
    [userId, day, start, end]);
  for (const b of rows) {
    if (toMin(b.s) < toMin(start)) await client.query(
      'INSERT INTO schedule_blocks (user_id, day, start_time, end_time, kind, label) VALUES ($1,$2,$3,$4,$5,$6)',
      [userId, day, b.s, start, b.kind, b.label]);
    if (toMin(b.e) > toMin(end)) await client.query(
      'INSERT INTO schedule_blocks (user_id, day, start_time, end_time, kind, label) VALUES ($1,$2,$3,$4,$5,$6)',
      [userId, day, end, b.e, b.kind, b.label]);
  }
  return rows.length;
}

/* Marking a range replaces whatever blocks overlapped it on that day, so
   "open" over "busy" (or the other way) simply switches it. */
router.post('/blocks', requireAuth, requireTeacher, async (req, res) => {
  const r = readRange(req.body);
  if (r.error) return res.status(400).json({ error: r.error });
  const kind = req.body?.kind === 'busy' ? 'busy' : req.body?.kind === 'open' ? 'open' : null;
  if (!kind) return res.status(400).json({ error: "kind must be 'open' or 'busy'" });
  const label = String(req.body?.label || '').trim().slice(0, 80) || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await cutRange(client, req.user.id, r.day, r.start, r.end);
    const { rows } = await client.query(
      `INSERT INTO schedule_blocks (user_id, day, start_time, end_time, kind, label) VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, day, to_char(start_time,'HH24:MI') AS start_time, to_char(end_time,'HH24:MI') AS end_time, kind, label`,
      [req.user.id, r.day, r.start, r.end, kind, label]);
    await client.query('COMMIT');
    res.status(201).json({ block: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[booking] block save:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

router.post('/blocks/clear', requireAuth, requireTeacher, async (req, res) => {
  const r = readRange(req.body);
  if (r.error) return res.status(400).json({ error: r.error });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const removed = await cutRange(client, req.user.id, r.day, r.start, r.end);
    await client.query('COMMIT');
    res.json({ removed });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

router.delete('/blocks/:id', requireAuth, requireTeacher, async (req, res) => {
  await pool.query('DELETE FROM schedule_blocks WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]).catch(() => {});
  res.json({ ok: true });
});

/* ── Teacher: the share link ─────────────────────────────────────────── */
async function linkFor(userId, rotate) {
  const { rows } = await pool.query('SELECT booking_token, booking_minutes FROM users WHERE id=$1', [userId]);
  let token = rows[0]?.booking_token;
  if (!token || rotate) {
    token = newToken();
    await pool.query('UPDATE users SET booking_token=$2 WHERE id=$1', [userId, token]);
  }
  const { rows: open } = await pool.query(`SELECT COUNT(*)::int AS n FROM schedule_blocks WHERE user_id=$1 AND kind='open'`, [userId]);
  return { token, url: `${SITE}/book.html?t=${token}`, minutes: rows[0]?.booking_minutes || 60, openBlocks: open[0].n };
}
router.get('/link', requireAuth, requireTeacher, async (req, res) => {
  try { res.json(await linkFor(req.user.id, false)); }
  catch (err) { console.error('[booking] link:', err.message); res.status(500).json({ error: 'Server error' }); }
});
router.post('/link/rotate', requireAuth, requireTeacher, async (req, res) => {
  try { res.json(await linkFor(req.user.id, true)); }
  catch (err) { console.error('[booking] rotate:', err.message); res.status(500).json({ error: 'Server error' }); }
});

/* ── Public: what a student sees and books ───────────────────────────── */
router.get('/public/:token', async (req, res) => {
  try {
    const t = await teacherByToken(req.params.token);
    if (!t) return res.status(404).json({ error: 'This booking link is not active.' });
    const { days, minutes } = await freeSlots(t);
    res.json({ teacher: { name: t.name || 'Your teacher', avatar: t.avatar || '' }, timezone: t.timezone || 'Europe/Kyiv', minutes, days });
  } catch (err) {
    console.error('[booking] public get:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const bookLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many booking attempts. Try again in an hour.' } });

router.post('/public/:token', bookLimiter, async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 80);
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 255);
  const note = String(req.body?.note || '').trim().slice(0, 500);
  const date = String(req.body?.date || ''), start = String(req.body?.start || '');
  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!DATE_RE.test(date) || !TIME_RE.test(start)) return res.status(400).json({ error: 'Pick a time.' });
  try {
    const t = await teacherByToken(req.params.token);
    if (!t) return res.status(404).json({ error: 'This booking link is not active.' });
    // Re-check against the live schedule: the slot may have gone since the page loaded.
    const { days, minutes } = await freeSlots(t);
    const day = days.find(d => d.date === date);
    if (!day || !day.slots.includes(start.slice(0, 5))) {
      return res.status(409).json({ error: 'That time was just taken. Please pick another one.' });
    }
    const end = fmt(toMin(start) + minutes);
    const { rows } = await pool.query(
      `INSERT INTO schedule (user_id, day, start_time, end_time, title, group_name, color, recurring, specific_date, booked_by_email)
       VALUES ($1,$2,$3,$4,$5,$6,'#CDF649',false,$7,$8) RETURNING id`,
      [t.id, day.weekday, start.slice(0, 5), end, 'Booked lesson', name, date, email]);

    const when = `${date} · ${start.slice(0, 5)}-${end} (${t.timezone || 'Europe/Kyiv'})`;
    createNotification(t.id, 'booking', `${name} booked a lesson`, `${when}${note ? ' - ' + note : ''}`, '/schedule.html');
    if (t.email) sendEmailQuietly({
      to: t.email,
      subject: `New booking: ${name}, ${date} ${start.slice(0, 5)}`,
      html: `<p><b>${escHtml(name)}</b> (${escHtml(email)}) booked a lesson.</p><p>${escHtml(when)}</p>${note ? `<p>${escHtml(note)}</p>` : ''}<p><a href="${SITE}/schedule.html">Open your schedule</a></p>`,
      text: `${name} (${email}) booked a lesson.\n${when}\n${note}\n${SITE}/schedule.html`,
    }, 'booking-teacher');
    sendEmailQuietly({
      to: email,
      subject: `Your lesson with ${t.name || 'your teacher'} is booked`,
      html: `<p>You are booked with <b>${escHtml(t.name || 'your teacher')}</b>.</p><p>${escHtml(when)}</p><p>Your teacher will send the lesson link.</p>`,
      text: `You are booked with ${t.name || 'your teacher'}.\n${when}\nYour teacher will send the lesson link.`,
    }, 'booking-student');
    res.status(201).json({ ok: true, id: rows[0].id, date, start: start.slice(0, 5), end, timezone: t.timezone || 'Europe/Kyiv' });
  } catch (err) {
    console.error('[booking] public post:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports._freeSlots = freeSlots;
