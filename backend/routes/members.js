const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { normalizePlanKey, getPlanLimit } = require('../lib/billing');
const crypto = require('crypto');
const { sendEmail, studentInviteEmail, emailConfigured, SITE } = require('../lib/email');

async function loadBoardOwner(boardId, ownerId) {
  const { rows } = await pool.query(
    'SELECT id FROM boards WHERE id=$1 AND user_id=$2',
    [boardId, ownerId]
  );
  return rows.length ? rows[0] : null;
}

async function currentCollaboratorCount(boardId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM board_collaborators WHERE board_id = $1',
    [boardId]
  );
  return Number(rows[0]?.count || 0);
}

async function existingCollaborator(boardId, userId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM board_collaborators WHERE board_id=$1 AND user_id=$2 LIMIT 1',
    [boardId, userId]
  );
  return !!rows.length;
}

function normalizeBoardRole(role) {
  // Collaborative clients currently synchronize full board snapshots. Until
  // writes are object-scoped, a non-owner editor could overwrite cards that
  // were intentionally redacted from their view.
  return ['student', 'viewer'].includes(role) ? role : 'student';
}

async function enforceStudentLimit({ boardId, ownerPlan, inviteeId }) {
  const limit = getPlanLimit(ownerPlan, 'studentsPerBoard');
  if (limit === -1) return null;
  const alreadyMember = await existingCollaborator(boardId, inviteeId);
  if (alreadyMember) return null;
  const count = await currentCollaboratorCount(boardId);
  if (count >= limit) {
    return { error: 'Student limit reached', code: 'STUDENT_LIMIT_REACHED', plan: ownerPlan, limit };
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────
   Join links - one reusable link per board.
   Typing every student's email is slow; the teacher copies the link into
   a chat instead. Whoever opens it (join.html) and signs in - or signs up -
   is seated on the board as a student. "New link" rotates the token, so an
   old link that leaked stops working.
────────────────────────────────────────────────────────────── */
const joinUrl = token => `${SITE}/join.html?t=${encodeURIComponent(token)}`;

// POST /api/members/:boardId/join-link  body: { rotate? }  - owner only
router.post('/:boardId/join-link', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, join_token FROM boards WHERE id=$1 AND user_id=$2', [req.params.boardId, req.user.id]
    );
    if (!rows.length) return res.status(403).json({ error: 'Not your board' });
    let token = rows[0].join_token;
    if (!token || req.body?.rotate) {
      token = crypto.randomBytes(12).toString('base64url');
      await pool.query('UPDATE boards SET join_token=$1 WHERE id=$2', [token, rows[0].id]);
    }
    res.json({ token, url: joinUrl(token) });
  } catch (err) {
    console.error('[members] join-link error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

async function boardByJoinToken(token) {
  if (!token || String(token).length > 64) return null;
  const { rows } = await pool.query(
    `SELECT b.id, b.name, b.user_id, u.name AS teacher_name, u.plan AS teacher_plan
       FROM boards b JOIN users u ON u.id = b.user_id
      WHERE b.join_token = $1`,
    [String(token)]
  );
  return rows[0] || null;
}

// GET /api/members/join/:token  - public: what the link leads to
router.get('/join/:token', async (req, res) => {
  try {
    const b = await boardByJoinToken(req.params.token);
    if (!b) return res.status(404).json({ error: 'This link no longer works - ask your teacher for a new one' });
    res.json({ board: { id: b.id, name: b.name }, teacher: { name: b.teacher_name || 'Your teacher' } });
  } catch (err) {
    console.error('[members] join lookup error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/members/join/:token  - the signed-in visitor joins the board
router.post('/join/:token', requireAuth, async (req, res) => {
  try {
    const b = await boardByJoinToken(req.params.token);
    if (!b) return res.status(404).json({ error: 'This link no longer works - ask your teacher for a new one' });
    if (String(b.user_id) === String(req.user.id)) return res.json({ boardId: b.id, owner: true });
    const limited = await enforceStudentLimit({
      boardId: b.id, ownerPlan: normalizePlanKey(b.teacher_plan), inviteeId: req.user.id,
    });
    if (limited) return res.status(402).json({ ...limited, error: 'This board is full - ask your teacher to make room' });
    const { rowCount } = await pool.query(
      `INSERT INTO board_collaborators (board_id, user_id, role)
       VALUES ($1, $2, 'student') ON CONFLICT (board_id, user_id) DO NOTHING`,
      [b.id, req.user.id]
    );
    res.json({ boardId: b.id, boardName: b.name, joined: rowCount > 0 });
  } catch (err) {
    console.error('[members] join error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   GET /api/members/roster  - every student across the teacher's boards
   Один запрос на весь список учеников рабочего стола вместо запроса на
   каждую доску. Рядом с пользователем - то, что учитель сам ведёт в журнале
   (уровень, оставшиеся уроки; связь по student_id, иначе по почте), средний
   процент квизов на досках учителя, и кто сейчас на доске. «Группа» здесь
   не сущность, а факт: ученик делит доску хотя бы с одним другим учеником.
   Стоит ДО /:boardId, иначе «roster» разбирался бы как id доски.
────────────────────────────────────────────────────────────── */
router.get('/roster', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH mine AS (
        SELECT id FROM boards WHERE user_id = $1
      ), seats AS (
        SELECT bc.board_id, bc.user_id,
               COUNT(*) OVER (PARTITION BY bc.board_id) AS board_size
          FROM board_collaborators bc
          JOIN mine m ON m.id = bc.board_id
         WHERE bc.user_id <> $1
      )
      SELECT u.id, u.name, u.email, u.avatar, u.last_login_at,
             ARRAY_AGG(DISTINCT s.board_id::text) AS board_ids,
             BOOL_OR(s.board_size = 1) AS individual,
             BOOL_OR(s.board_size > 1) AS in_group,
             j.id AS journal_id, j.level, j.lessons_left, j.format, j.telegram, j.phone,
             to_char(j.payment_due, 'YYYY-MM-DD') AS payment_due,
             q.quiz_avg, q.quiz_count
        FROM seats s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN LATERAL (
          SELECT id, level, lessons_left, format, telegram, phone, payment_due FROM student_journal
           WHERE teacher_id = $1 AND (student_id = u.id OR LOWER(email) = LOWER(u.email))
           ORDER BY (student_id = u.id) DESC NULLS LAST, created_at DESC
           LIMIT 1
        ) j ON TRUE
        LEFT JOIN LATERAL (
          SELECT ROUND(AVG(qr.pct))::int AS quiz_avg, COUNT(*)::int AS quiz_count
            -- quiz_results.board_id is text, boards.id is uuid: compared as
            -- they are, Postgres refused ("operator does not exist: uuid = text")
            -- and the whole roster answered 500
            FROM quiz_results qr JOIN mine m ON m.id::text = qr.board_id::text
           WHERE qr.user_id = u.id
        ) q ON TRUE
       GROUP BY u.id, j.id, j.level, j.lessons_left, j.format, j.telegram, j.phone, j.payment_due, q.quiz_avg, q.quiz_count
       ORDER BY u.name
    `, [req.user.id]);

    const boardIds = new Set(rows.flatMap(r => r.board_ids || []));
    const online = require('../ws').onlineUserIds(boardIds);
    /* Ученики из журнала, которых ещё нет ни на одной доске (добавлен по
       почте без аккаунта - ждёт регистрации, или ведётся только в журнале).
       Без них добавленный через «+» ученик пропадал из списка до регистрации. */
    const seen = rows.map(r => r.journal_id).filter(Boolean);
    const { rows: pending } = await pool.query(`
      SELECT j.id AS journal_id, j.name, j.email, j.level, j.lessons_left, j.format, j.telegram, j.phone,
             to_char(j.payment_due, 'YYYY-MM-DD') AS payment_due,
             EXISTS (SELECT 1 FROM invites i JOIN boards b ON b.id = i.board_id
                      WHERE b.user_id = $1 AND i.accepted_at IS NULL
                        AND j.email <> '' AND LOWER(i.email) = LOWER(j.email)) AS invited
        FROM student_journal j
       WHERE j.teacher_id = $1 AND NOT (j.id = ANY($2::uuid[]))
       ORDER BY j.name`, [req.user.id, seen]);
    const withFormat = r => r.format
      ? { ...r, individual: r.format === 'individual', in_group: r.format === 'group' }
      : r;
    res.json({
      students: [
        ...rows.map(r => withFormat({
          ...r,
          boardCount: (r.board_ids || []).length,
          online: online.has(String(r.id)),
        })),
        ...pending.map(j => withFormat({
          ...j, id: `j:${j.journal_id}`, avatar: '', board_ids: [], boardCount: 0,
          individual: false, in_group: false, online: false, pending: true,
        })),
      ].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    });
  } catch (err) {
    console.error('[members] roster error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   GET /api/members/my/boards  - boards shared with current user (as student)
────────────────────────────────────────────────────────────── */
router.get('/my/boards', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.id, b.name, b.updated_at, bc.role,
             u.name AS owner_name, u.avatar AS owner_avatar
      FROM board_collaborators bc
      JOIN boards b ON b.id = bc.board_id
      JOIN users  u ON u.id = b.user_id
      WHERE bc.user_id = $1
      ORDER BY b.updated_at DESC
    `, [req.user.id]);
    res.json({ boards: rows });
  } catch (err) {
    console.error('[members] my/boards error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   GET /api/members/:boardId  - list members of a board (owner only)
────────────────────────────────────────────────────────────── */
router.get('/:boardId', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  try {
    // verify ownership
    const own = await loadBoardOwner(boardId, req.user.id);
    if (!own) return res.status(403).json({ error: 'Not your board' });

    const { rows } = await pool.query(`
      SELECT bc.user_id, bc.role, bc.added_at,
             u.name, u.email, u.avatar
      FROM board_collaborators bc
      JOIN users u ON u.id = bc.user_id
      WHERE bc.board_id = $1
      ORDER BY bc.added_at
    `, [boardId]);
    res.json({ members: rows });
  } catch (err) {
    console.error('[members] GET error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   POST /api/members/:boardId/invite  - invite by email
   body: { email, role? }
────────────────────────────────────────────────────────────── */
router.post('/:boardId/invite', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  const { email, role = 'student' } = req.body;
  const safeRole = normalizeBoardRole(role);
  if (!email) return res.status(400).json({ error: 'Email required' });

  // The plan's student-limit check and the insert used to be two separate
  // queries with no lock between them, so two concurrent invites for the
  // same board could both pass the "under limit" check before either
  // commits. Locking the board row for the duration of the transaction
  // serializes concurrent invites on that board (other boards are
  // unaffected) so the count the limit check sees is never stale.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: own } = await client.query(
      'SELECT id, name FROM boards WHERE id=$1 AND user_id=$2 FOR UPDATE', [boardId, req.user.id]
    );
    if (!own.length) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Not your board' }); }

    const cleanEmail = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    const { rows: users } = await client.query(
      'SELECT id, name, email, avatar FROM users WHERE email=$1',
      [cleanEmail]
    );
    /* Nobody has this address yet. It used to stop here with "They must
       register first" and the student heard nothing; now an invite keeps the
       board, the student gets a link to sign up, and signing up - by the link
       or any other way with this email - seats them on the board. The
       teacher also gets the link back, to send it themselves if mail is off. */
    if (!users.length) {
      const { rows: pending } = await client.query(
        `SELECT token FROM invites
          WHERE LOWER(email) = $1 AND board_id = $2 AND accepted_at IS NULL
            AND revoked_at IS NULL AND expires_at > NOW()
          ORDER BY created_at DESC LIMIT 1`,
        [cleanEmail, boardId]
      );
      const token = pending[0]?.token || crypto.randomBytes(24).toString('hex');
      if (!pending.length) {
        await client.query(
          `INSERT INTO invites (email, role, token, note, created_by, expires_at, board_id, board_role)
           VALUES ($1, 'student', $2, $3, $4, NOW() + INTERVAL '30 days', $5, $6)`,
          [cleanEmail, token, `Board: ${own[0].name || ''}`.slice(0, 500), req.user.id, boardId, safeRole]
        );
      } else {
        await client.query(`UPDATE invites SET expires_at = NOW() + INTERVAL '30 days' WHERE token = $1`, [token]);
      }
      await client.query('COMMIT');
      const mail = studentInviteEmail({ token, teacherName: req.user.name, boardTitle: own[0].name });
      let emailSent = false;
      if (emailConfigured()) {
        try { await sendEmail({ to: cleanEmail, subject: mail.subject, html: mail.html, text: mail.text }); emailSent = true; }
        catch (err) { console.error('[members] invite email failed:', err.message); }
      }
      return res.status(202).json({ invited: true, email: cleanEmail, emailSent, inviteUrl: mail.link });
    }
    const invitee = users[0];

    if (invitee.id === req.user.id) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Cannot invite yourself' }); }

    const plan = normalizePlanKey(req.user.plan);
    const limit = getPlanLimit(plan, 'studentsPerBoard');
    if (limit !== -1) {
      const { rows: existing } = await client.query(
        'SELECT 1 FROM board_collaborators WHERE board_id=$1 AND user_id=$2 LIMIT 1', [boardId, invitee.id]
      );
      if (!existing.length) {
        const { rows: countRows } = await client.query(
          'SELECT COUNT(*)::int AS count FROM board_collaborators WHERE board_id=$1', [boardId]
        );
        if (Number(countRows[0]?.count || 0) >= limit) {
          await client.query('ROLLBACK');
          return res.status(402).json({ error: 'Student limit reached', code: 'STUDENT_LIMIT_REACHED', plan, limit });
        }
      }
    }

    await client.query(`
      INSERT INTO board_collaborators (board_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role
    `, [boardId, invitee.id, safeRole]);

    await client.query('COMMIT');
    res.json({ member: { ...invitee, role: safeRole } });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[members] invite error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

/* ──────────────────────────────────────────────────────────────
   DELETE /api/members/:boardId/:userId  - remove member
────────────────────────────────────────────────────────────── */
router.delete('/:boardId/:userId', requireAuth, async (req, res) => {
  const { boardId, userId } = req.params;
  try {
    const { rows: own } = await pool.query(
      'SELECT id FROM boards WHERE id=$1 AND user_id=$2', [boardId, req.user.id]
    );
    if (!own.length) return res.status(403).json({ error: 'Not your board' });

    await pool.query(
      'DELETE FROM board_collaborators WHERE board_id=$1 AND user_id=$2',
      [boardId, userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[members] delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   POST /api/members/:boardId/bulk-invite  - invite multiple by email (CSV)
   body: { emails: ["a@b.com", "c@d.com"], role? }
────────────────────────────────────────────────────────────── */
router.post('/:boardId/bulk-invite', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  const { emails = [], role = 'student' } = req.body;
  const safeRole = normalizeBoardRole(role);
  if (!Array.isArray(emails) || !emails.length) return res.status(400).json({ error: 'emails array required' });

  try {
    const own = await loadBoardOwner(boardId, req.user.id);
    if (!own) return res.status(403).json({ error: 'Not your board' });
    const plan = normalizePlanKey(req.user.plan);
    if (plan !== 'school') {
      return res.status(402).json({
        error: 'Bulk invite is available on the School package',
        code: 'BULK_INVITE_REQUIRES_SCHOOL',
        plan,
        required_plan: 'school',
      });
    }

    const results = { added: [], notFound: [], alreadyMember: [] };

    /* Раньше на каждый email в списке уходил свой SELECT - до 100 круговых
       обращений к базе последовательно одно за другим. Список email известен
       весь и сразу, так что ищем всех разом одним запросом (ANY($1) по
       нормализованным адресам) и дальше просто читаем из карты в памяти.
       Проверку лимита (enforceStudentLimit) и сам INSERT не трогаю: там
       ранний break по лимиту тарифа и обработка конфликтов по каждой
       строке - переписывать вслепую на боевом биллинге без стенда для
       проверки не стал. */
    const normalizedEmails = [...new Set(
      emails.slice(0, 100)
        .map(e => e.trim().toLowerCase())
        .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )];
    const { rows: foundUsers } = normalizedEmails.length
      ? await pool.query(
          'SELECT id, name, email, avatar FROM users WHERE email = ANY($1)', [normalizedEmails]
        )
      : { rows: [] };
    const userByEmail = new Map(foundUsers.map(u => [u.email.toLowerCase(), u]));

    for (const rawEmail of emails.slice(0, 100)) {
      const email = rawEmail.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

      const invitee = userByEmail.get(email);
      if (!invitee) { results.notFound.push(email); continue; }
      if (invitee.id === req.user.id) continue;
      const limitError = await enforceStudentLimit({ boardId, ownerPlan: plan, inviteeId: invitee.id });
      if (limitError) {
        results.limitReached = limitError;
        break;
      }

      try {
        const insert = await pool.query(`
          INSERT INTO board_collaborators (board_id, user_id, role)
          VALUES ($1,$2,$3) ON CONFLICT (board_id, user_id) DO NOTHING`,
          [boardId, invitee.id, safeRole]
        );
        if (insert.rowCount) results.added.push({ email: invitee.email, name: invitee.name });
        else results.alreadyMember.push(email);
      } catch {
        results.alreadyMember.push(email);
      }
    }

    if (results.limitReached && !results.added.length) {
      return res.status(402).json(results.limitReached);
    }
    res.json(results);
  } catch (err) {
    console.error('[members] bulk-invite error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   GET /api/members/:boardId/progress  - per-student lesson progress
   Returns: [{ user_id, name, avatar, email, lessons: [{id, status}] }]
────────────────────────────────────────────────────────────── */
router.get('/:boardId/progress', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  try {
    const { rows: own } = await pool.query(
      'SELECT id, data FROM boards WHERE id=$1 AND user_id=$2', [boardId, req.user.id]
    );
    if (!own.length) return res.status(403).json({ error: 'Not your board' });

    const board = own[0];
    const cards  = (board.data && board.data.cards) || [];
    const lessons = cards.filter(c => c.type === 'lesson');

    // get all members
    const { rows: members } = await pool.query(`
      SELECT bc.user_id, bc.role, u.name, u.email, u.avatar
      FROM board_collaborators bc
      JOIN users u ON u.id = bc.user_id
      WHERE bc.board_id = $1
    `, [boardId]);

    // get per-student progress from student_progress table
    let progressRows = [];
    try {
      const pr = await pool.query(
        'SELECT user_id, card_id, status FROM student_progress WHERE board_id=$1',
        [boardId]
      );
      progressRows = pr.rows;
    } catch {
      // table may not exist yet - will be created below on first write
    }

    // build map: user_id -> { card_id -> status }
    const progMap = {};
    progressRows.forEach(r => {
      if (!progMap[r.user_id]) progMap[r.user_id] = {};
      progMap[r.user_id][r.card_id] = r.status;
    });

    const result = members.map(m => ({
      ...m,
      lessons: lessons.map(l => ({
        id:     l.id,
        title:  l.data.title || 'Lesson',
        skill:  l.data.skill || '',
        status: (progMap[m.user_id] && progMap[m.user_id][l.id]) || l.data.status || 'locked'
      }))
    }));

    res.json({ lessons, members: result });
  } catch (err) {
    console.error('[members] progress error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ──────────────────────────────────────────────────────────────
   PATCH /api/members/:boardId/progress  - student updates own lesson status
   body: { cardId, status }
────────────────────────────────────────────────────────────── */
router.patch('/:boardId/progress', requireAuth, async (req, res) => {
  const { boardId } = req.params;
  const { cardId, status } = req.body;
  const validStatuses = ['locked','available','in-progress','done'];
  if (!cardId || !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid data' });

  try {
    // verify membership (student or owner)
    const { rows: acc } = await pool.query(`
      SELECT 1 FROM boards WHERE id=$1 AND user_id=$2
      UNION
      SELECT 1 FROM board_collaborators WHERE board_id=$1 AND user_id=$2
    `, [boardId, req.user.id]);
    if (!acc.length) return res.status(403).json({ error: 'No access' });

    await pool.query(`
      INSERT INTO student_progress (board_id, user_id, card_id, status, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (board_id, user_id, card_id) DO UPDATE SET status=EXCLUDED.status, updated_at=NOW()
    `, [boardId, req.user.id, cardId, status]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[members] progress PATCH error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
