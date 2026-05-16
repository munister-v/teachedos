const router = require('express').Router();
const crypto = require('crypto');
const pool   = require('../db/pool');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

async function ensureIbanPaymentsTable() {
  const existing = await pool.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_name='iban_payments' AND column_name='user_id'
     LIMIT 1`
  );
  if (existing.rows.length && existing.rows[0].data_type !== 'uuid') {
    await pool.query(`ALTER TABLE iban_payments RENAME TO iban_payments_legacy_${Date.now()}`);
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS iban_payments (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    plan TEXT NOT NULL,
    payer_name TEXT NOT NULL,
    tx_date DATE NOT NULL,
    tx_note TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2)`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd'`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS invoice_no TEXT`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS admin_note TEXT`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id)`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_iban_payments_status ON iban_payments(status, created_at DESC)`);
}

// ── GET /api/admin/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    await ensureIbanPaymentsTable().catch(() => {});
    const [users, boards, sessions, roles, courses, cards, newUsers, storage, pendingPayments] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM boards'),
      pool.query("SELECT COUNT(*) FROM sessions WHERE expires_at > NOW()"),
      pool.query("SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY COUNT(*) DESC"),
      pool.query('SELECT COUNT(*) FROM courses'),
      pool.query(`SELECT COALESCE(SUM(
        CASE WHEN jsonb_typeof(data->'cards') = 'array' THEN jsonb_array_length(data->'cards') ELSE 0 END
      ), 0) AS count FROM boards`),
      pool.query("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
      pool.query('SELECT COALESCE(SUM(pg_column_size(data)), 0) AS bytes FROM boards'),
      pool.query("SELECT COUNT(*) FROM iban_payments WHERE status = 'pending'").catch(() => ({ rows: [{ count: 0 }] })),
    ]);
    res.json({
      users:    parseInt(users.rows[0].count),
      boards:   parseInt(boards.rows[0].count),
      sessions: parseInt(sessions.rows[0].count),
      roles:    roles.rows,
      courses:  parseInt(courses.rows[0].count),
      cards:    parseInt(cards.rows[0].count),
      newUsers7d: parseInt(newUsers.rows[0].count),
      storageBytes: parseInt(storage.rows[0].bytes),
      pendingPayments: parseInt(pendingPayments.rows[0].count, 10),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/billing/payments ───────────────────────────────────────
router.get('/billing/payments', async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : '';
  try {
    await ensureIbanPaymentsTable();
    const { rows } = await pool.query(
      `SELECT p.id, p.user_id, p.plan, p.payer_name, p.tx_date, p.tx_note, p.status,
              p.amount, p.currency, p.invoice_no, p.admin_note, p.created_at, p.reviewed_at,
              u.name AS user_name, u.email AS user_email, u.plan AS current_plan,
              reviewer.name AS reviewed_by_name
       FROM iban_payments p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN users reviewer ON reviewer.id = p.reviewed_by
       WHERE ($1::text = '' OR p.status = $1)
       ORDER BY
         CASE WHEN p.status = 'pending' THEN 0 ELSE 1 END,
         p.created_at DESC
       LIMIT 150`,
      [status]
    );
    res.json({ payments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/billing/summary ────────────────────────────────────────
router.get('/billing/summary', async (req, res) => {
  try {
    await ensureIbanPaymentsTable();
    const [statusRows, planRows, revenueRows, expiringRows] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*)::int AS count
         FROM iban_payments
         GROUP BY status`
      ),
      pool.query(
        `SELECT plan, COUNT(*)::int AS count
         FROM users
         GROUP BY plan`
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::float AS total
         FROM iban_payments
         WHERE status='approved' AND created_at >= NOW() - INTERVAL '30 days'`
      ),
      pool.query(
        `SELECT id, name, email, plan, plan_expires_at
         FROM users
         WHERE plan <> 'free'
           AND plan_expires_at IS NOT NULL
           AND plan_expires_at <= NOW() + INTERVAL '7 days'
         ORDER BY plan_expires_at ASC
         LIMIT 8`
      ),
    ]);
    const statuses = Object.fromEntries(statusRows.rows.map(row => [row.status, row.count]));
    const plans = Object.fromEntries(planRows.rows.map(row => [row.plan || 'free', row.count]));
    res.json({
      statuses: {
        pending: statuses.pending || 0,
        approved: statuses.approved || 0,
        rejected: statuses.rejected || 0,
      },
      plans: {
        free: plans.free || 0,
        pro: plans.pro || 0,
        school: plans.school || 0,
      },
      approved30d: revenueRows.rows[0]?.total || 0,
      expiringSoon: expiringRows.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/billing/payments/:id/approve ─────────────────────────
router.post('/billing/payments/:id/approve', async (req, res) => {
  const { note = '', months = 1 } = req.body || {};
  const safeMonths = Math.min(Math.max(parseInt(months, 10) || 1, 1), 24);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid payment id' });
  const client = await pool.connect();
  try {
    await ensureIbanPaymentsTable();
    await client.query('BEGIN');
    const paymentRes = await client.query(
      `SELECT id, user_id, plan, status FROM iban_payments WHERE id=$1 FOR UPDATE`,
      [id]
    );
    if (!paymentRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment request not found' });
    }
    const payment = paymentRes.rows[0];
    if (payment.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Payment is already ${payment.status}` });
    }
    await client.query(
      `UPDATE iban_payments
       SET status='approved', admin_note=$2, reviewed_by=$3, reviewed_at=NOW()
       WHERE id=$1`,
      [id, String(note || '').trim().slice(0, 1000), req.user.id]
    );
    await client.query(
      `UPDATE users
       SET plan=$1, plan_expires_at=NOW() + ($2::int * INTERVAL '1 month')
       WHERE id=$3`,
      [payment.plan, safeMonths, payment.user_id]
    );
    await client.query('COMMIT');
    res.json({ ok: true, plan: payment.plan, months: safeMonths });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/billing/payments/:id/reject ──────────────────────────
router.post('/billing/payments/:id/reject', async (req, res) => {
  const { note = '' } = req.body || {};
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid payment id' });
  try {
    await ensureIbanPaymentsTable();
    const { rows } = await pool.query(
      `UPDATE iban_payments
       SET status='rejected', admin_note=$2, reviewed_by=$3, reviewed_at=NOW()
       WHERE id=$1 AND status='pending'
       RETURNING id`,
      [id, String(note || '').trim().slice(0, 1000), req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pending payment request not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/audit ───────────────────────────────────────────────────
router.get('/audit', async (req, res) => {
  try {
    const [staleBoards, emptyBoards, usersNoBoards, admins, expiringSessions, recentUsers] = await Promise.all([
      pool.query(`
        SELECT b.id, b.name, b.updated_at, u.name AS owner_name, u.email AS owner_email
        FROM boards b
        JOIN users u ON u.id = b.user_id
        WHERE b.updated_at < NOW() - INTERVAL '30 days'
        ORDER BY b.updated_at ASC
        LIMIT 10
      `),
      pool.query(`
        SELECT b.id, b.name, b.updated_at, u.name AS owner_name, u.email AS owner_email
        FROM boards b
        JOIN users u ON u.id = b.user_id
        WHERE COALESCE(
          CASE WHEN jsonb_typeof(b.data->'cards') = 'array' THEN jsonb_array_length(b.data->'cards') ELSE 0 END,
          0
        ) = 0
        ORDER BY b.updated_at DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT u.id, u.name, u.email, u.role, u.created_at
        FROM users u
        LEFT JOIN boards b ON b.user_id = u.id
        WHERE b.id IS NULL
        ORDER BY u.created_at DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT id, name, email, created_at
        FROM users
        WHERE role = 'admin'
        ORDER BY created_at ASC
      `),
      pool.query(`
        SELECT s.id, s.expires_at, u.name AS user_name, u.email AS user_email
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.expires_at > NOW() AND s.expires_at < NOW() + INTERVAL '24 hours'
        ORDER BY s.expires_at ASC
        LIMIT 10
      `),
      pool.query(`
        SELECT id, name, email, role, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 8
      `),
    ]);

    const warnings = [];
    if (admins.rows.length > 3) warnings.push({ level: 'medium', text: `${admins.rows.length} admin accounts exist. Review access regularly.` });
    if (staleBoards.rows.length) warnings.push({ level: 'low', text: `${staleBoards.rows.length} stale boards found in the first audit sample.` });
    if (usersNoBoards.rows.length) warnings.push({ level: 'low', text: `${usersNoBoards.rows.length} users have no boards yet.` });

    res.json({
      warnings,
      staleBoards: staleBoards.rows,
      emptyBoards: emptyBoards.rows,
      usersNoBoards: usersNoBoards.rows,
      admins: admins.rows,
      expiringSessions: expiringSessions.rows,
      recentUsers: recentUsers.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/system ──────────────────────────────────────────────────
router.get('/system', async (req, res) => {
  try {
    const [dbNow, expiredSessions, recentUsers, recentBoards, inviteStats, recentInvites] = await Promise.all([
      pool.query('SELECT NOW() AS now'),
      pool.query('SELECT COUNT(*) FROM sessions WHERE expires_at <= NOW()'),
      pool.query(
        `SELECT id, name, email, role, created_at
         FROM users
         ORDER BY created_at DESC
         LIMIT 5`
      ),
      pool.query(
        `SELECT b.id, b.name, b.updated_at, u.name AS owner_name
         FROM boards b
         JOIN users u ON u.id = b.user_id
         ORDER BY b.updated_at DESC
         LIMIT 5`
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE revoked_at IS NULL AND accepted_at IS NULL AND expires_at > NOW())::int AS active,
           COUNT(*) FILTER (WHERE accepted_at IS NOT NULL)::int AS used,
           COUNT(*) FILTER (WHERE revoked_at IS NOT NULL)::int AS revoked,
           COUNT(*) FILTER (WHERE revoked_at IS NULL AND accepted_at IS NULL AND expires_at <= NOW())::int AS expired
         FROM invites`
      ),
      pool.query(
        `SELECT email, role, note, expires_at, accepted_at, revoked_at, created_at
         FROM invites
         ORDER BY created_at DESC
         LIMIT 5`
      ),
    ]);

    res.json({
      serverTime: dbNow.rows[0].now,
      uptimeSec: Math.round(process.uptime()),
      nodeVersion: process.version,
      expiredSessions: parseInt(expiredSessions.rows[0].count, 10),
      invites: inviteStats.rows[0] || { active: 0, used: 0, revoked: 0, expired: 0 },
      recentUsers: recentUsers.rows,
      recentBoards: recentBoards.rows,
      recentInvites: recentInvites.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/analytics ───────────────────────────────────────────────
router.get('/analytics', async (req, res) => {
  const requestedDays = parseInt(req.query.days, 10);
  const days = Number.isFinite(requestedDays) ? Math.min(Math.max(requestedDays, 7), 90) : 14;

  try {
    const [signups, boardUpdates, sessionStarts, topBoardOwners] = await Promise.all([
      pool.query(
        `WITH days AS (
           SELECT generate_series(
             date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
             date_trunc('day', NOW()),
             INTERVAL '1 day'
           ) AS day
         )
         SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
                COUNT(u.id)::int AS count
         FROM days
         LEFT JOIN users u
           ON u.created_at >= days.day
          AND u.created_at < days.day + INTERVAL '1 day'
         GROUP BY days.day
         ORDER BY days.day`,
        [days]
      ),
      pool.query(
        `WITH days AS (
           SELECT generate_series(
             date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
             date_trunc('day', NOW()),
             INTERVAL '1 day'
           ) AS day
         )
         SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
                COUNT(b.id)::int AS count
         FROM days
         LEFT JOIN boards b
           ON b.updated_at >= days.day
          AND b.updated_at < days.day + INTERVAL '1 day'
         GROUP BY days.day
         ORDER BY days.day`,
        [days]
      ),
      pool.query(
        `WITH days AS (
           SELECT generate_series(
             date_trunc('day', NOW()) - ($1::int - 1) * INTERVAL '1 day',
             date_trunc('day', NOW()),
             INTERVAL '1 day'
           ) AS day
         )
         SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
                COUNT(s.id)::int AS count
         FROM days
         LEFT JOIN sessions s
           ON s.created_at >= days.day
          AND s.created_at < days.day + INTERVAL '1 day'
         GROUP BY days.day
         ORDER BY days.day`,
        [days]
      ),
      pool.query(
        `SELECT u.name, u.email, COUNT(b.id)::int AS boards
         FROM users u
         JOIN boards b ON b.user_id = u.id
         WHERE b.updated_at >= NOW() - $1::int * INTERVAL '1 day'
         GROUP BY u.id, u.name, u.email
         ORDER BY boards DESC, u.name ASC
         LIMIT 5`,
        [days]
      ),
    ]);

    const totals = {
      signups: signups.rows.reduce((sum, row) => sum + row.count, 0),
      boardUpdates: boardUpdates.rows.reduce((sum, row) => sum + row.count, 0),
      sessionStarts: sessionStarts.rows.reduce((sum, row) => sum + row.count, 0),
    };

    res.json({
      days,
      totals,
      signups: signups.rows,
      boardUpdates: boardUpdates.rows,
      sessionStarts: sessionStarts.rows,
      topBoardOwners: topBoardOwners.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/timeline ────────────────────────────────────────────────
router.get('/timeline', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM (
        SELECT 'user' AS type, u.created_at AS at, u.name AS title,
               u.email || ' joined as ' || u.role AS detail, u.email AS actor, NULL::uuid AS ref_id
        FROM users u

        UNION ALL

        SELECT 'board' AS type, b.updated_at AS at, b.name AS title,
               'Updated by ' || u.name || ' · ' ||
               COALESCE(
                 CASE WHEN jsonb_typeof(b.data->'cards') = 'array' THEN jsonb_array_length(b.data->'cards') ELSE 0 END,
                 0
               )::text || ' cards' AS detail,
               u.email AS actor, b.id AS ref_id
        FROM boards b
        JOIN users u ON u.id = b.user_id

        UNION ALL

        SELECT 'session' AS type, s.created_at AS at, u.name AS title,
               'Login session from ' || COALESCE(s.ip, 'unknown IP') AS detail,
               u.email AS actor, NULL::uuid AS ref_id
        FROM sessions s
        JOIN users u ON u.id = s.user_id

        UNION ALL

        SELECT 'invite' AS type, i.created_at AS at, i.email AS title,
               'Invite created for ' || i.role ||
               CASE
                 WHEN i.revoked_at IS NOT NULL THEN ' · revoked'
                 WHEN i.accepted_at IS NOT NULL THEN ' · accepted'
                 WHEN i.expires_at <= NOW() THEN ' · expired'
                 ELSE ' · active'
               END AS detail,
               creator.email AS actor, i.id AS ref_id
        FROM invites i
        LEFT JOIN users creator ON creator.id = i.created_by
      ) events
      ORDER BY at DESC
      LIMIT 60
    `);
    res.json({ events: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/brief ───────────────────────────────────────────────────
router.get('/brief', async (req, res) => {
  try {
    const [users, boards, activeSessions, expiredSessions, activeInvites, expiredInvites, staleBoards, emptyBoards, admins] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM users'),
      pool.query('SELECT COUNT(*)::int AS count FROM boards'),
      pool.query('SELECT COUNT(*)::int AS count FROM sessions WHERE expires_at > NOW()'),
      pool.query('SELECT COUNT(*)::int AS count FROM sessions WHERE expires_at <= NOW()'),
      pool.query("SELECT COUNT(*)::int AS count FROM invites WHERE revoked_at IS NULL AND accepted_at IS NULL AND expires_at > NOW()"),
      pool.query("SELECT COUNT(*)::int AS count FROM invites WHERE revoked_at IS NULL AND accepted_at IS NULL AND expires_at <= NOW()"),
      pool.query("SELECT COUNT(*)::int AS count FROM boards WHERE updated_at < NOW() - INTERVAL '30 days'"),
      pool.query(`
        SELECT COUNT(*)::int AS count
        FROM boards
        WHERE COALESCE(
          CASE WHEN jsonb_typeof(data->'cards') = 'array' THEN jsonb_array_length(data->'cards') ELSE 0 END,
          0
        ) = 0
      `),
      pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'"),
    ]);

    const metrics = {
      users: users.rows[0].count,
      boards: boards.rows[0].count,
      activeSessions: activeSessions.rows[0].count,
      expiredSessions: expiredSessions.rows[0].count,
      activeInvites: activeInvites.rows[0].count,
      expiredInvites: expiredInvites.rows[0].count,
      staleBoards: staleBoards.rows[0].count,
      emptyBoards: emptyBoards.rows[0].count,
      admins: admins.rows[0].count,
    };

    let score = 100;
    score -= Math.min(metrics.expiredSessions * 2, 20);
    score -= Math.min(metrics.expiredInvites * 4, 20);
    score -= Math.min(metrics.staleBoards, 18);
    score -= Math.min(metrics.emptyBoards, 12);
    if (metrics.admins > 3) score -= Math.min((metrics.admins - 3) * 5, 15);
    score = Math.max(0, Math.min(100, score));

    const tone = score >= 82 ? 'good' : score >= 60 ? 'watch' : 'risk';
    const highlights = [
      `${metrics.users} users, ${metrics.boards} boards, ${metrics.activeSessions} active sessions.`,
      `${metrics.activeInvites} active invite links and ${metrics.expiredInvites} expired invite links.`,
      `${metrics.staleBoards} stale boards and ${metrics.emptyBoards} empty boards need content review.`,
    ];

    const actions = [];
    if (metrics.expiredSessions) actions.push({ tone: 'watch', label: 'Purge expired sessions', action: 'purgeExpiredSessions()' });
    if (!metrics.activeInvites) actions.push({ tone: 'good', label: 'Create invite pipeline', action: "showPage('settings')" });
    if (metrics.expiredInvites) actions.push({ tone: 'watch', label: 'Review invite links', action: "showPage('settings')" });
    if (metrics.admins > 3) actions.push({ tone: 'risk', label: 'Review admin accounts', action: "showPage('users');setUsersRoleFilter('admin')" });
    if (metrics.staleBoards || metrics.emptyBoards) actions.push({ tone: 'watch', label: 'Open audit board review', action: "showPage('audit')" });
    if (!actions.length) actions.push({ tone: 'good', label: 'Open timeline', action: "document.getElementById('timeline-list')?.scrollIntoView({behavior:'smooth',block:'start'})" });

    res.json({ score, tone, metrics, highlights, actions: actions.slice(0, 4) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/invites ─────────────────────────────────────────────────
router.get('/invites', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.email, i.role, i.note, i.token, i.expires_at, i.accepted_at, i.revoked_at, i.created_at,
              creator.name AS created_by_name,
              accepted.name AS accepted_user_name
       FROM invites i
       LEFT JOIN users creator ON creator.id = i.created_by
       LEFT JOIN users accepted ON accepted.id = i.accepted_user_id
       ORDER BY i.created_at DESC
       LIMIT 100`
    );
    res.json({ invites: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/search ──────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ query: q, users: [], boards: [], invites: [] });
  const like = `%${q}%`;

  try {
    const [users, boards, invites] = await Promise.all([
      pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.avatar, u.created_at,
                COUNT(b.id)::int AS boards_count
         FROM users u
         LEFT JOIN boards b ON b.user_id = u.id
         WHERE u.name ILIKE $1 OR u.email ILIKE $1 OR u.role ILIKE $1
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT 8`,
        [like]
      ),
      pool.query(
        `SELECT b.id, b.name, b.updated_at,
                COALESCE(
                  CASE WHEN jsonb_typeof(b.data->'cards') = 'array' THEN jsonb_array_length(b.data->'cards') ELSE 0 END,
                  0
                )::int AS cards_count,
                u.name AS owner_name, u.email AS owner_email
         FROM boards b
         JOIN users u ON u.id = b.user_id
         WHERE b.name ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1
         ORDER BY b.updated_at DESC
         LIMIT 8`,
        [like]
      ),
      pool.query(
        `SELECT i.id, i.email, i.role, i.note, i.token, i.expires_at, i.accepted_at, i.revoked_at, i.created_at,
                creator.name AS created_by_name
         FROM invites i
         LEFT JOIN users creator ON creator.id = i.created_by
         WHERE i.email ILIKE $1 OR i.role ILIKE $1 OR i.note ILIKE $1
         ORDER BY i.created_at DESC
         LIMIT 8`,
        [like]
      ),
    ]);

    res.json({ query: q, users: users.rows, boards: boards.rows, invites: invites.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/export/:type ────────────────────────────────────────────
router.get('/export/:type', async (req, res) => {
  const type = req.params.type;
  try {
    if (type === 'users') {
      const { rows } = await pool.query(
        `SELECT u.name, u.email, u.role, u.created_at, COUNT(b.id)::int AS boards_count
         FROM users u
         LEFT JOIN boards b ON b.user_id = u.id
         GROUP BY u.id
         ORDER BY u.created_at DESC`
      );
      return res.json({ type, rows });
    }

    if (type === 'boards') {
      const { rows } = await pool.query(
        `SELECT b.name, u.name AS owner_name, u.email AS owner_email,
                COALESCE(
                  CASE WHEN jsonb_typeof(b.data->'cards') = 'array' THEN jsonb_array_length(b.data->'cards') ELSE 0 END,
                  0
                )::int AS cards_count,
                pg_column_size(b.data)::int AS data_bytes,
                b.updated_at, b.created_at
         FROM boards b
         JOIN users u ON u.id = b.user_id
         ORDER BY b.updated_at DESC`
      );
      return res.json({ type, rows });
    }

    if (type === 'invites') {
      const { rows } = await pool.query(
        `SELECT i.email, i.role, i.note, i.expires_at, i.accepted_at, i.revoked_at, i.created_at,
                creator.email AS created_by_email,
                accepted.email AS accepted_user_email
         FROM invites i
         LEFT JOIN users creator ON creator.id = i.created_by
         LEFT JOIN users accepted ON accepted.id = i.accepted_user_id
         ORDER BY i.created_at DESC`
      );
      return res.json({ type, rows });
    }

    res.status(400).json({ error: 'Export type must be users, boards, or invites' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/invites ────────────────────────────────────────────────
router.post('/invites', async (req, res) => {
  const { email, role = 'teacher', expiresInDays = 7, note = '' } = req.body;
  const safeRole = ['teacher', 'student', 'admin'].includes(role) ? role : 'teacher';
  const safeDays = Math.min(Math.max(parseInt(expiresInDays, 10) || 7, 1), 30);
  const safeEmail = String(email || '').toLowerCase().trim();
  const safeNote = String(note || '').trim().slice(0, 280);

  if (!safeEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(safeEmail)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [safeEmail]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const { rows } = await pool.query(
      `INSERT INTO invites (email, role, token, note, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + ($6::int * INTERVAL '1 day'))
       RETURNING id, email, role, note, token, expires_at, accepted_at, revoked_at, created_at`,
      [safeEmail, safeRole, token, safeNote, req.user.id, safeDays]
    );

    res.status(201).json({ invite: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/users ───────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search = '', role = '', limit = 50, offset = 0 } = req.query;
    const like = `%${search}%`;
    const roleFilter = role ? role : null;
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.avatar, u.plan, u.plan_expires_at, u.created_at,
              COUNT(b.id) AS boards_count
       FROM users u
       LEFT JOIN boards b ON b.user_id = u.id
       WHERE (u.email ILIKE $1 OR u.name ILIKE $1)
         AND ($2::text IS NULL OR u.role = $2)
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $3 OFFSET $4`,
      [like, roleFilter, parseInt(limit), parseInt(offset)]
    );
    const { rows: total } = await pool.query(
      `SELECT COUNT(*) FROM users
       WHERE (email ILIKE $1 OR name ILIKE $1)
         AND ($2::text IS NULL OR role = $2)`,
      [like, roleFilter]
    );
    res.json({ users: rows, total: parseInt(total[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/users ──────────────────────────────────────────────────
router.post('/users', async (req, res) => {
  const { email, password, name, role = 'teacher', avatar } = req.body;
  const safeRole = ['teacher', 'student', 'admin'].includes(role) ? role : 'teacher';
  const safeAvatar = (avatar || (safeRole === 'student' ? '🎓' : safeRole === 'admin' ? '🛡️' : '🧑‍🏫')).trim();

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password and name are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, avatar)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, avatar, created_at`,
      [email.toLowerCase().trim(), hash, name.trim(), safeRole, safeAvatar]
    );
    const user = rows[0];

    await pool.query(
      `INSERT INTO boards (user_id, name) VALUES ($1, $2)`,
      [user.id, 'My First Board']
    );

    res.status(201).json({ user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/admin/users/:id ─────────────────────────────────────────────
router.patch('/users/:id', async (req, res) => {
  const { name, role, avatar, password, plan, plan_expires_at } = req.body;
  try {
    const sets = [];
    const vals = [];
    let i = 1;
    if (name !== undefined) {
      const safeName = String(name).trim();
      if (!safeName) return res.status(400).json({ error: 'Name cannot be empty' });
      sets.push(`name=$${i++}`);
      vals.push(safeName);
    }
    if (role !== undefined) {
      if (!['teacher', 'student', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      sets.push(`role=$${i++}`);
      vals.push(role);
    }
    if (avatar !== undefined) {
      sets.push(`avatar=$${i++}`);
      vals.push(String(avatar).trim());
    }
    if (plan !== undefined) {
      if (!['free', 'pro', 'school'].includes(plan)) {
        return res.status(400).json({ error: 'Invalid plan' });
      }
      sets.push(`plan=$${i++}`);
      vals.push(plan);
    }
    if (plan_expires_at !== undefined) {
      sets.push(`plan_expires_at=$${i++}`);
      vals.push(plan_expires_at || null);
    }
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      const hash = await bcrypt.hash(password, 12);
      sets.push(`password_hash=$${i++}`);
      vals.push(hash);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(',')} WHERE id=$${i} RETURNING id,email,name,role,avatar`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/users/:id ────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/boards ──────────────────────────────────────────────────
router.get('/boards', async (req, res) => {
  try {
    const { search = '', limit = 50, offset = 0 } = req.query;
    const like = `%${search}%`;
    const { rows } = await pool.query(
      `SELECT b.id, b.name, b.updated_at, b.created_at,
              u.name AS owner_name, u.email AS owner_email,
              pg_column_size(b.data) AS data_bytes,
              jsonb_array_length(b.data->'cards') AS cards_count
       FROM boards b
       JOIN users u ON u.id = b.user_id
       WHERE b.name ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1
       ORDER BY b.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [like, parseInt(limit), parseInt(offset)]
    );
    const { rows: total } = await pool.query(
      `SELECT COUNT(*) FROM boards b JOIN users u ON u.id=b.user_id
       WHERE b.name ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1`,
      [like]
    );
    res.json({ boards: rows, total: parseInt(total[0].count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/boards/:id ───────────────────────────────────────────
router.delete('/boards/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM boards WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/sessions ────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.user_agent, s.ip, s.created_at, s.expires_at,
              u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW()
       ORDER BY s.created_at DESC
       LIMIT 200`
    );
    res.json({ sessions: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/sessions/:id ────────────────────────────────────────
router.delete('/sessions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/sessions (all for a user) ───────────────────────────
router.delete('/sessions/user/:userId', async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE user_id=$1', [req.params.userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/sessions-expired ─────────────────────────────────────
router.delete('/sessions-expired', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    res.json({ ok: true, deleted: rowCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/invites/:id ──────────────────────────────────────────
router.delete('/invites/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE invites
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE id = $1
       RETURNING id, revoked_at`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invite not found' });
    res.json({ ok: true, invite: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
