const router = require('express').Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool   = require('../db/pool');
const bcrypt = require('bcryptjs');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { ensureTelemetrySchema } = require('../lib/telemetry');
const {
  cleanLongText,
  cleanText,
  ensureIncidentSchema,
  isUuid,
  normalizeSeverity,
  normalizeStatus,
  SEVERITIES,
  STATUSES,
} = require('../lib/incidents');
const {
  ensureBillingSchema,
  normalizePlanKey,
  normalizeCycleKey,
} = require('../lib/billing');

function passwordProblem(password) {
  if (typeof password !== 'string') return 'Password is required';
  const value = password;
  if (value.length < 10) return 'Password must be at least 10 characters';
  if (Buffer.byteLength(value, 'utf8') > 72) return 'Password is too long. Use 72 bytes or fewer';
  return null;
}

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

async function ensureIbanPaymentsTable() {
  await ensureBillingSchema(pool);
}

// Fire-and-forget: record a sensitive admin action. Never blocks the response.
function logAdminAction(req, action, opts = {}) {
  pool.query(
    `INSERT INTO admin_audit (admin_id, admin_email, action, target_id, target_label, detail, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      req.user?.id || null,
      req.user?.email || null,
      String(action).slice(0, 64),
      opts.targetId ? String(opts.targetId).slice(0, 64) : null,
      opts.targetLabel ? String(opts.targetLabel).slice(0, 160) : null,
      opts.detail ? String(opts.detail).slice(0, 500) : null,
      req.ip || null,
    ]
  ).catch(() => {});
}

// ── GET /api/admin/stats ───────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    await ensureIbanPaymentsTable().catch(() => {});
    const [users, boards, sessions, roles, courses, cards, newUsers, storage, pendingPayments, suspended, locked, failedLogins24h] = await Promise.all([
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
      pool.query("SELECT COUNT(*) FROM users WHERE is_suspended=TRUE").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) FROM users WHERE locked_at IS NOT NULL").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) FROM auth_events WHERE event='login.fail' AND created_at >= NOW() - INTERVAL '24 hours'").catch(() => ({ rows: [{ count: 0 }] })),
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
      suspended: parseInt(suspended.rows[0].count, 10),
      locked:    parseInt(locked.rows[0].count, 10),
      failedLogins24h: parseInt(failedLogins24h.rows[0].count, 10),
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
              p.billing_cycle, p.months, p.company_name, p.contact_email, p.package_snapshot,
              u.name AS user_name, u.email AS user_email, u.plan AS current_plan, u.plan_status AS current_plan_status,
              u.billing_cycle AS current_billing_cycle, u.plan_expires_at AS current_plan_expires_at,
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
        `SELECT id, name, email, plan, plan_status, billing_cycle, plan_expires_at,
           CASE WHEN plan_expires_at < NOW() THEN 'overdue'
                WHEN plan_status = 'grace' THEN 'grace'
                ELSE 'expiring' END AS urgency
         FROM users
         WHERE plan <> 'free'
           AND plan_status IN ('active', 'grace')
           AND plan_expires_at IS NOT NULL
           AND plan_expires_at <= NOW() + INTERVAL '7 days'
         ORDER BY plan_expires_at ASC
         LIMIT 12`
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
  const { note = '', months } = req.body || {};
  const requestedMonths = months == null || months === '' ? null : parseInt(months, 10);
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid payment id' });
  const client = await pool.connect();
  try {
    await ensureIbanPaymentsTable();
    await client.query('BEGIN');
    const paymentRes = await client.query(
      `SELECT id, user_id, plan, status, billing_cycle, months
       FROM iban_payments WHERE id=$1 FOR UPDATE`,
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
    const invoiceMonths = Math.max(1, parseInt(payment.months, 10) || 1);
    const appliedMonths = Number.isFinite(requestedMonths)
      ? Math.min(Math.max(requestedMonths, 1), 24)
      : Math.min(invoiceMonths, 24);
    await client.query(
      `UPDATE users
       SET plan=$1,
           plan_status='active',
           billing_cycle=$2,
           plan_started_at=COALESCE(plan_started_at, NOW()),
           plan_expires_at=GREATEST(COALESCE(plan_expires_at, NOW()), NOW()) + ($3::int * INTERVAL '1 month'),
           plan_source='manual'
       WHERE id=$4`,
      [normalizePlanKey(payment.plan), normalizeCycleKey(payment.billing_cycle), appliedMonths, payment.user_id]
    );
    await client.query('COMMIT');
    logAdminAction(req, 'billing.approve', {
      targetId: payment.user_id,
      targetLabel: `payment #${id}`,
      detail: `${payment.plan} for ${appliedMonths}mo${note ? ': ' + note : ''}`,
    });
    res.json({ ok: true, plan: payment.plan, months: appliedMonths });
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
    logAdminAction(req, 'billing.reject', {
      targetId: rows[0].id,
      targetLabel: `payment #${id}`,
      detail: note || 'rejected',
    });
    // If user's plan_status is 'pending' (set when they submitted the IBAN request),
    // revert it so they don't stay in limbo.
    await pool.query(
      `UPDATE users SET plan_status='free'
       WHERE id=(SELECT user_id FROM iban_payments WHERE id=$1)
         AND plan_status='pending'`,
      [id]
    ).catch(() => {});
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

// ── GET /api/admin/production-status ──────────────────────────────────────
// Deliberately returns readiness booleans only. Secret values must never be
// sent to the admin browser, even for authenticated administrators.
router.get('/production-status', async (req, res) => {
  const has = (...keys) => keys.some((key) => String(process.env[key] || '').trim().length > 0);
  const checks = {
    database: { label: 'Database', ready: has('DATABASE_URL'), required: true },
    jwt: { label: 'JWT sessions', ready: has('JWT_SECRET'), required: true },
    origins: { label: 'Allowed origins', ready: has('ALLOWED_ORIGINS'), required: true },
    site: { label: 'Site URLs', ready: has('SITE_URL') && has('FRONTEND_URL'), required: true },
    ai: { label: 'AI provider', ready: has('AI_API_KEY', 'AI_API_KEY_2'), required: false, mode: has('AI_API_KEY', 'AI_API_KEY_2') ? 'provider' : 'local-fallback' },
    stripe: { label: 'Stripe billing', ready: has('STRIPE_SECRET_KEY'), required: false, mode: has('STRIPE_SECRET_KEY') ? 'live' : 'manual/dev' },
    email: { label: 'Transactional email', ready: has('RESEND_API_KEY') || (has('GMAIL_USER') && has('GMAIL_APP_PASSWORD')), required: false, mode: has('RESEND_API_KEY') || (has('GMAIL_USER') && has('GMAIL_APP_PASSWORD')) ? 'provider' : 'simulated/dev' },
    imageSearch: { label: 'Image search', ready: has('UNSPLASH_ACCESS_KEY', 'PIXABAY_API_KEY'), required: false, mode: has('UNSPLASH_ACCESS_KEY', 'PIXABAY_API_KEY') ? 'provider' : 'empty fallback' },
    google: { label: 'Google sign-in', ready: true, required: false, mode: has('GOOGLE_CLIENT_ID') ? 'env override' : 'built-in client' },
  };

  let deployedSha = null;
  let version = null;
  let deployedAt = null;
  try {
    const markerPath = process.env.TEACHED_DEPLOY_MARKER || '/opt/teachedos/.deployed_sha';
    deployedSha = (await fs.promises.readFile(markerPath, 'utf8')).trim().slice(0, 40) || null;
  } catch (_) { /* local/dev installs may not have a deploy marker */ }
  try {
    const versionPath = process.env.TEACHED_VERSION_FILE || path.join(__dirname, '..', '..', 'version.json');
    const release = JSON.parse(await fs.promises.readFile(versionPath, 'utf8'));
    version = release.version || null;
    deployedAt = release.deployedAt || null;
  } catch (_) { /* version metadata is optional during local development */ }

  const requiredReady = Object.values(checks).filter((check) => check.required).every((check) => check.ready);
  res.json({
    ok: requiredReady,
    checkedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    port: Number(process.env.PORT || 4000),
    checks,
    release: { deployedSha, version, deployedAt },
  });
});

// ── GET /api/admin/monitor ─────────────────────────────────────────────────
// The control center reads aggregates and redacted technical events only.
// It must not turn monitoring into a back door to board content or personal data.
router.get('/monitor', async (req, res) => {
  const requestedHours = Number.parseInt(req.query.hours, 10);
  const hours = [24, 168].includes(requestedHours) ? requestedHours : 24;
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);
  const checkedAt = new Date().toISOString();
  const dbStartedAt = Date.now();

  try {
    await ensureTelemetrySchema();
    const [dbProbe, traffic, products, heatmap, errors, housekeeping, aiUsage] = await Promise.all([
      pool.query('SELECT 1 AS ok'),
      pool.query(
        `SELECT
           COUNT(*)::int AS requests,
           COUNT(*) FILTER (WHERE outcome='client_error')::int AS client_errors,
           COUNT(*) FILTER (WHERE outcome='server_error')::int AS server_errors,
           COALESCE(percentile_cont(.5) WITHIN GROUP (ORDER BY duration_ms)
             FILTER (WHERE duration_ms IS NOT NULL), 0)::float AS p50_ms,
           COALESCE(percentile_cont(.95) WITHIN GROUP (ORDER BY duration_ms)
             FILTER (WHERE duration_ms IS NOT NULL), 0)::float AS p95_ms
         FROM telemetry_events
         WHERE category='request' AND created_at >= $1`,
        [windowStart],
      ),
      pool.query(
        `SELECT event_type, SUM(event_count)::int AS count
         FROM telemetry_hourly
         WHERE category='product' AND hour_start >= $1
         GROUP BY event_type
         ORDER BY count DESC, event_type ASC
         LIMIT 12`,
        [windowStart],
      ),
      pool.query(
        `WITH activity AS (
           SELECT created_at AS occurred_at FROM users WHERE created_at >= $1
           UNION ALL
           SELECT updated_at FROM boards WHERE updated_at >= $1
           UNION ALL
           SELECT created_at FROM auth_events
             WHERE created_at >= $1 AND event IN ('login.ok', 'google.login', 'google.signup')
           UNION ALL
           SELECT created_at FROM telemetry_events
             WHERE created_at >= $1
               AND category='product'
               AND event_type NOT LIKE 'board.%'
         )
         SELECT
           EXTRACT(ISODOW FROM occurred_at AT TIME ZONE 'Europe/Kyiv')::int AS weekday,
           EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'Europe/Kyiv')::int AS hour,
           MAX(date_trunc('hour', occurred_at)) AS bucket,
           COUNT(*)::int AS count
         FROM activity
         GROUP BY 1, 2
         ORDER BY 1, 2`,
        [windowStart],
      ),
      pool.query(
        `SELECT event_type, outcome, metadata->>'route' AS route,
                MAX(created_at) AS last_seen, COUNT(*)::int AS count
         FROM telemetry_events
         WHERE created_at >= $1 AND outcome IN ('server_error', 'fallback')
         GROUP BY event_type, outcome, metadata->>'route'
         ORDER BY last_seen DESC
         LIMIT 8`,
        [windowStart],
      ),
      pool.query(
        `SELECT created_at, outcome, metadata->>'operation' AS operation
         FROM telemetry_events
         WHERE event_type='system.housekeeping'
         ORDER BY created_at DESC
         LIMIT 1`,
      ),
      pool.query(
        `SELECT COALESCE(SUM(total), 0)::int AS total,
                COALESCE(SUM(llm_ok), 0)::int AS llm_ok,
                COALESCE(SUM(fallback), 0)::int AS fallback
         FROM ai_usage_daily
         WHERE day >= CURRENT_DATE - (($1::int - 1) / 24) * INTERVAL '1 day'`,
        [hours],
      ).catch(() => ({ rows: [{ total: 0, llm_ok: 0, fallback: 0 }] })),
    ]);

    const trafficRow = traffic.rows[0] || {};
    const requestCount = Number(trafficRow.requests || 0);
    const serverErrors = Number(trafficRow.server_errors || 0);
    const clientErrors = Number(trafficRow.client_errors || 0);
    const errorRate = requestCount ? Number(((serverErrors / requestCount) * 100).toFixed(2)) : 0;
    const lastHousekeeping = housekeeping.rows[0] || null;
    const housekeepingAgeHours = lastHousekeeping
      ? (Date.now() - new Date(lastHousekeeping.created_at).getTime()) / 3_600_000
      : null;
    const ai = aiUsage.rows[0] || { total: 0, llm_ok: 0, fallback: 0 };

    const checks = [
      { key: 'api', label: 'Application', tone: 'good', detail: `Running for ${Math.round(process.uptime() / 60)} min` },
      { key: 'database', label: 'Database', tone: dbProbe.rows.length ? 'good' : 'risk', detail: `${Date.now() - dbStartedAt} ms probe` },
      {
        key: 'housekeeping', label: 'Housekeeping',
        tone: housekeepingAgeHours === null ? 'watch' : housekeepingAgeHours <= 7 ? 'good' : 'risk',
        detail: housekeepingAgeHours === null
          ? 'No completed run recorded yet'
          : `${Math.round(housekeepingAgeHours * 10) / 10}h since last run`,
      },
      {
        key: 'ai', label: 'AI delivery',
        tone: Number(ai.fallback || 0) > 0 ? 'watch' : 'good',
        detail: Number(ai.total || 0)
          ? `${ai.llm_ok || 0}/${ai.total} model responses`
          : 'No requests in this window',
      },
    ];

    const signals = [];
    if (errorRate >= 5) signals.push({ tone: 'risk', title: 'Elevated server errors', detail: `${serverErrors} server errors out of ${requestCount} requests.` });
    else if (serverErrors > 0) signals.push({ tone: 'watch', title: 'Server errors recorded', detail: `${serverErrors} request(s) need a quick review.` });
    if (Number(ai.fallback || 0) > 0) signals.push({ tone: 'watch', title: 'AI used fallback', detail: `${ai.fallback} request(s) did not receive a model response.` });
    if (housekeepingAgeHours === null || housekeepingAgeHours > 7) signals.push({ tone: 'watch', title: 'Housekeeping needs confirmation', detail: 'The cleanup job has not reported a recent completed run.' });
    if (!signals.length) signals.push({ tone: 'good', title: 'No active reliability signals', detail: 'The monitored window has no server-error or job-freshness warning.' });

    res.json({
      checkedAt,
      hours,
      checks,
      traffic: {
        requests: requestCount,
        clientErrors,
        serverErrors,
        errorRate,
        p50Ms: Math.round(Number(trafficRow.p50_ms || 0)),
        p95Ms: Math.round(Number(trafficRow.p95_ms || 0)),
      },
      productEvents: products.rows,
      heatmap: heatmap.rows,
      errors: errors.rows,
      signals,
      freshness: {
        telemetryStarted: true,
        housekeepingAt: lastHousekeeping?.created_at || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Monitor data is temporarily unavailable' });
  }
});

// ── GET /api/admin/monitor/events ─────────────────────────────────────────
router.get('/monitor/events', async (req, res) => {
  const start = new Date(String(req.query.start || ''));
  if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'A valid hour start is required' });
  try {
    await ensureTelemetrySchema();
    const { rows } = await pool.query(
      `SELECT event_type, outcome, duration_ms, metadata, created_at
       FROM (
         SELECT 'account.created'::text AS event_type,
                'ok'::text AS outcome,
                NULL::int AS duration_ms,
                '{}'::jsonb AS metadata,
                created_at
           FROM users
          WHERE created_at >= $1 AND created_at < $1 + INTERVAL '1 hour'
         UNION ALL
         SELECT 'board.updated'::text AS event_type,
                'ok'::text AS outcome,
                NULL::int AS duration_ms,
                '{}'::jsonb AS metadata,
                updated_at AS created_at
           FROM boards
          WHERE updated_at >= $1 AND updated_at < $1 + INTERVAL '1 hour'
         UNION ALL
         SELECT event AS event_type,
                'ok'::text AS outcome,
                NULL::int AS duration_ms,
                '{}'::jsonb AS metadata,
                created_at
           FROM auth_events
          WHERE created_at >= $1 AND created_at < $1 + INTERVAL '1 hour'
            AND event IN ('login.ok', 'google.login', 'google.signup')
         UNION ALL
         SELECT event_type, outcome, duration_ms, metadata, created_at
           FROM telemetry_events
          WHERE created_at >= $1 AND created_at < $1 + INTERVAL '1 hour'
            AND category = 'product'
            AND event_type NOT LIKE 'board.%'
       ) AS activity
       ORDER BY created_at DESC
       LIMIT 30`,
      [start.toISOString()],
    );
    res.json({ events: rows });
  } catch (err) {
    res.status(500).json({ error: 'Could not load this activity slice' });
  }
});

// ── Incident response ─────────────────────────────────────────────────────
// Incidents are deliberately kept separate from telemetry. Monitoring only
// supplies evidence; the response record is a human-owned operational log.
router.get('/incidents', async (req, res) => {
  const requestedStatus = String(req.query.status || 'active');
  const status = requestedStatus === 'all' || requestedStatus === 'active' || STATUSES.has(requestedStatus)
    ? requestedStatus
    : 'active';
  try {
    await ensureIncidentSchema();
    const { rows } = await pool.query(
      `SELECT i.id, i.title, i.severity, i.status, i.affected_scope, i.source,
              i.owner_id, i.acknowledged_at, i.resolved_at, i.created_at, i.updated_at,
              owner.name AS owner_name,
              COUNT(u.id)::int AS update_count,
              MAX(u.created_at) AS last_update_at
         FROM incidents i
         LEFT JOIN users owner ON owner.id = i.owner_id
         LEFT JOIN incident_updates u ON u.incident_id = i.id
        WHERE ($1 = 'all')
           OR ($1 = 'active' AND i.status <> 'resolved')
           OR i.status = $1
        GROUP BY i.id, owner.name
        ORDER BY
          CASE i.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 WHEN 'mitigating' THEN 2 ELSE 3 END,
          CASE i.severity WHEN 's1' THEN 0 WHEN 's2' THEN 1 WHEN 's3' THEN 2 ELSE 3 END,
          i.updated_at DESC
        LIMIT 100`,
      [status],
    );
    const summaryResult = await pool.query(
      `SELECT severity, COUNT(*)::int AS count
         FROM incidents
        WHERE status <> 'resolved'
        GROUP BY severity`,
    );
    const summary = { s1: 0, s2: 0, s3: 0, s4: 0, active: 0 };
    summaryResult.rows.forEach(row => {
      summary[row.severity] = Number(row.count || 0);
      summary.active += Number(row.count || 0);
    });
    res.json({ incidents: rows, summary, status });
  } catch (err) {
    res.status(500).json({ error: 'Could not load incidents' });
  }
});

router.get('/incidents/owners', async (_req, res) => {
  try {
    await ensureIncidentSchema();
    const { rows } = await pool.query(
      `SELECT id, name, email
         FROM users
        WHERE role='admin'
        ORDER BY name ASC, email ASC`,
    );
    res.json({ owners: rows });
  } catch (err) {
    res.status(500).json({ error: 'Could not load incident owners' });
  }
});

router.get('/incidents/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid incident id' });
  try {
    await ensureIncidentSchema();
    const incidentResult = await pool.query(
      `SELECT i.*, owner.name AS owner_name, creator.name AS created_by_name
         FROM incidents i
         LEFT JOIN users owner ON owner.id = i.owner_id
         LEFT JOIN users creator ON creator.id = i.created_by
        WHERE i.id=$1`,
      [req.params.id],
    );
    if (!incidentResult.rows.length) return res.status(404).json({ error: 'Incident not found' });
    const updates = await pool.query(
      `SELECT u.id, u.kind, u.body, u.from_status, u.to_status, u.created_at,
              author.name AS author_name
         FROM incident_updates u
         LEFT JOIN users author ON author.id = u.author_id
        WHERE u.incident_id=$1
        ORDER BY u.created_at ASC, u.id ASC`,
      [req.params.id],
    );
    res.json({ incident: incidentResult.rows[0], updates: updates.rows });
  } catch (err) {
    res.status(500).json({ error: 'Could not load incident detail' });
  }
});

router.post('/incidents', async (req, res) => {
  const title = cleanText(req.body?.title, 160);
  const requestedSeverity = req.body?.severity;
  const severity = normalizeSeverity(req.body?.severity);
  const affectedScope = cleanText(req.body?.affectedScope, 160);
  const summary = cleanLongText(req.body?.summary, 4000);
  const requestedOwner = req.body?.ownerId;
  if (title.length < 4) return res.status(400).json({ error: 'Use a clear incident title of at least 4 characters' });
  if (requestedSeverity !== undefined && !SEVERITIES.has(String(requestedSeverity).toLowerCase())) return res.status(400).json({ error: 'Invalid severity' });
  if (requestedOwner !== undefined && requestedOwner !== null && requestedOwner !== '' && !isUuid(requestedOwner)) return res.status(400).json({ error: 'Invalid incident owner' });
  try {
    await ensureIncidentSchema();
    let ownerId = req.user.id;
    if (requestedOwner && isUuid(requestedOwner)) {
      const owner = await pool.query("SELECT id FROM users WHERE id=$1 AND role='admin'", [requestedOwner]);
      if (!owner.rows.length) return res.status(400).json({ error: 'Incident owner must be an administrator' });
      ownerId = requestedOwner;
    }
    const created = await pool.query(
      `INSERT INTO incidents (title, severity, affected_scope, summary, source, owner_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, 'manual', $5, $6, $6)
       RETURNING *`,
      [title, severity, affectedScope, summary, ownerId, req.user.id],
    );
    await pool.query(
      `INSERT INTO incident_updates (incident_id, author_id, kind, body)
       VALUES ($1, $2, 'created', $3)`,
      [created.rows[0].id, req.user.id, summary || 'Incident opened.'],
    );
    logAdminAction(req, 'incident.created', {
      targetId: created.rows[0].id,
      targetLabel: title,
      detail: `${severity} incident opened`,
    });
    res.status(201).json({ incident: created.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Could not create incident' });
  }
});

router.patch('/incidents/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid incident id' });
  const requestedStatus = req.body?.status;
  const requestedSeverity = req.body?.severity;
  const requestedScope = req.body?.affectedScope;
  const requestedOwner = req.body?.ownerId;
  if (requestedStatus !== undefined && !STATUSES.has(String(requestedStatus).toLowerCase())) return res.status(400).json({ error: 'Invalid incident status' });
  if (requestedSeverity !== undefined && !SEVERITIES.has(String(requestedSeverity).toLowerCase())) return res.status(400).json({ error: 'Invalid incident severity' });
  if (requestedOwner !== undefined && requestedOwner !== null && requestedOwner !== '' && !isUuid(requestedOwner)) return res.status(400).json({ error: 'Invalid incident owner' });
  try {
    await ensureIncidentSchema();
    const currentResult = await pool.query('SELECT * FROM incidents WHERE id=$1', [req.params.id]);
    if (!currentResult.rows.length) return res.status(404).json({ error: 'Incident not found' });
    const current = currentResult.rows[0];
    let ownerId = requestedOwner === '' || requestedOwner === null ? null : current.owner_id;
    if (requestedOwner && isUuid(requestedOwner)) {
      const owner = await pool.query("SELECT id FROM users WHERE id=$1 AND role='admin'", [requestedOwner]);
      if (!owner.rows.length) return res.status(400).json({ error: 'Incident owner must be an administrator' });
      ownerId = requestedOwner;
    }
    const status = requestedStatus === undefined ? current.status : normalizeStatus(requestedStatus, current.status);
    const severity = requestedSeverity === undefined ? current.severity : normalizeSeverity(requestedSeverity, current.severity);
    const affectedScope = requestedScope === undefined ? current.affected_scope : cleanText(requestedScope, 160);
    // Acknowledged work must have a named responder. Keep explicit owner edits authoritative.
    if (!ownerId && requestedOwner === undefined && ['acknowledged', 'mitigating'].includes(status)) {
      ownerId = req.user.id;
    }
    const acknowledgement = ['acknowledged', 'mitigating', 'resolved'].includes(status)
      ? (current.acknowledged_at || new Date())
      : null;
    const resolvedAt = status === 'resolved' ? (current.resolved_at || new Date()) : null;
    const updated = await pool.query(
      `UPDATE incidents
          SET status=$2, severity=$3, affected_scope=$4, owner_id=$5,
              acknowledged_at=$6, resolved_at=$7, updated_by=$8, updated_at=NOW()
        WHERE id=$1
      RETURNING *`,
      [req.params.id, status, severity, affectedScope, ownerId, acknowledgement, resolvedAt, req.user.id],
    );
    if (status !== current.status) {
      await pool.query(
        `INSERT INTO incident_updates (incident_id, author_id, kind, from_status, to_status)
         VALUES ($1, $2, 'status', $3, $4)`,
        [req.params.id, req.user.id, current.status, status],
      );
    }
    if (ownerId !== current.owner_id) {
      await pool.query(
        `INSERT INTO incident_updates (incident_id, author_id, kind, body)
         VALUES ($1, $2, 'assignment', $3)`,
        [req.params.id, req.user.id, ownerId ? 'Incident owner updated.' : 'Incident owner cleared.'],
      );
    }
    logAdminAction(req, 'incident.updated', {
      targetId: req.params.id,
      targetLabel: current.title,
      detail: `status ${current.status} to ${status}`,
    });
    res.json({ incident: updated.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Could not update incident' });
  }
});

router.post('/incidents/:id/updates', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid incident id' });
  const body = cleanLongText(req.body?.body, 4000);
  if (!body) return res.status(400).json({ error: 'Write an update before adding it to the timeline' });
  try {
    await ensureIncidentSchema();
    const incident = await pool.query('SELECT id, title FROM incidents WHERE id=$1', [req.params.id]);
    if (!incident.rows.length) return res.status(404).json({ error: 'Incident not found' });
    const update = await pool.query(
      `INSERT INTO incident_updates (incident_id, author_id, kind, body)
       VALUES ($1, $2, 'note', $3)
       RETURNING id, kind, body, created_at`,
      [req.params.id, req.user.id, body],
    );
    await pool.query('UPDATE incidents SET updated_by=$2, updated_at=NOW() WHERE id=$1', [req.params.id, req.user.id]);
    logAdminAction(req, 'incident.note_added', {
      targetId: req.params.id,
      targetLabel: incident.rows[0].title,
      detail: 'Timeline update added',
    });
    res.status(201).json({ update: update.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Could not add incident update' });
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

// ── GET /api/admin/audit-log ───────────────────────────────────────────────
router.get('/audit-log', async (req, res) => {
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 30));
  try {
    const { rows } = await pool.query(
      `SELECT id, admin_email, action, target_label, detail, ip, created_at
       FROM admin_audit ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ entries: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/users ───────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search = '', role = '', access = '', limit = 50, offset = 0 } = req.query;
    const like = `%${search}%`;
    const roleFilter = role ? role : null;
    const accessFilter = ['suspended', 'locked', 'attention'].includes(access) ? access : null;
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.avatar, u.plan, u.plan_status, u.billing_cycle,
              u.plan_started_at, u.plan_expires_at, u.plan_source, u.created_at,
              u.last_login_at, u.is_suspended, u.suspended_reason, u.locked_at, u.failed_login_count,
              COUNT(b.id) AS boards_count
       FROM users u
       LEFT JOIN boards b ON b.user_id = u.id
       WHERE (u.email ILIKE $1 OR u.name ILIKE $1)
         AND ($2::text IS NULL OR u.role = $2)
         AND (
           $3::text IS NULL
           OR ($3 = 'suspended' AND u.is_suspended = TRUE)
           OR ($3 = 'locked' AND u.locked_at IS NOT NULL)
           OR ($3 = 'attention' AND (u.is_suspended = TRUE OR u.locked_at IS NOT NULL OR COALESCE(u.failed_login_count, 0) > 0))
         )
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $4 OFFSET $5`,
      [like, roleFilter, accessFilter, safeLimit, safeOffset]
    );
    const { rows: total } = await pool.query(
      `SELECT COUNT(*) FROM users
       WHERE (email ILIKE $1 OR name ILIKE $1)
         AND ($2::text IS NULL OR role = $2)
         AND (
           $3::text IS NULL
           OR ($3 = 'suspended' AND is_suspended = TRUE)
           OR ($3 = 'locked' AND locked_at IS NOT NULL)
           OR ($3 = 'attention' AND (is_suspended = TRUE OR locked_at IS NOT NULL OR COALESCE(failed_login_count, 0) > 0))
         )`,
      [like, roleFilter, accessFilter]
    );
    res.json({ users: rows, total: parseInt(total[0].count), filters: { role: roleFilter, access: accessFilter } });
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
  const passwordError = passwordProblem(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, avatar)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, avatar, created_at`,
      [email.toLowerCase().trim(), hash, name.trim(), safeRole, safeAvatar]
    );
    const user = rows[0];

    logAdminAction(req, 'user.create', { targetId: user.id, targetLabel: user.email, detail: `role=${user.role}` });
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/users/:id/history ───────────────────────────────────────
// Returns the plan change audit trail + payment history for a specific user.
router.get('/users/:id/history', async (req, res) => {
  try {
    const [auditRes, paymentsRes] = await Promise.all([
      pool.query(
        `SELECT action, detail, admin_email, created_at
         FROM admin_audit
         WHERE target_id=$1 AND action IN ('user.update','billing.approve','billing.reject','user.create')
         ORDER BY created_at DESC LIMIT 30`,
        [req.params.id]
      ),
      pool.query(
        `SELECT id, plan, status, amount, currency, invoice_no, billing_cycle, months,
                payer_name, tx_date, admin_note, reviewed_at, created_at
         FROM iban_payments
         WHERE user_id=$1
         ORDER BY created_at DESC LIMIT 20`,
        [req.params.id]
      ),
    ]);
    res.json({ audit: auditRes.rows, payments: paymentsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/billing/metrics ────────────────────────────────────────
// Revenue and conversion metrics for the billing dashboard.
router.get('/billing/metrics', async (req, res) => {
  try {
    const [mrrRes, convRes, churnRes, totalRevRes] = await Promise.all([
      pool.query(
        `SELECT DATE_TRUNC('month', reviewed_at) AS month,
                SUM(amount) AS revenue, COUNT(*) AS count
         FROM iban_payments
         WHERE status='approved' AND reviewed_at IS NOT NULL
         GROUP BY DATE_TRUNC('month', reviewed_at)
         ORDER BY month DESC LIMIT 6`
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM users WHERE plan<>'free' AND plan_status IN ('active','grace')) AS paid,
           (SELECT COUNT(*) FROM users WHERE plan='free' OR plan IS NULL) AS free,
           (SELECT COUNT(*) FROM users) AS total`
      ),
      pool.query(
        `SELECT COUNT(*) AS churned FROM users
         WHERE plan='free' AND plan_source='system'
           AND plan_started_at IS NOT NULL
           AND plan_started_at > NOW() - INTERVAL '90 days'`
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM iban_payments WHERE status='approved'`
      ),
    ]);
    res.json({
      monthlyRevenue: mrrRes.rows,
      conversion: convRes.rows[0] || { paid:0, free:0, total:0 },
      churned90d: churnRes.rows[0]?.churned || 0,
      totalRevenue: totalRevRes.rows[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/admin/users/:id ─────────────────────────────────────────────
router.patch('/users/:id', async (req, res) => {
  const { name, email, role, avatar, password, plan, plan_status, billing_cycle, plan_expires_at } = req.body;
  const changes = [];
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
    if (email !== undefined) {
      const safeEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
        return res.status(400).json({ error: 'Invalid email' });
      }
      const { rows: dup } = await pool.query(
        'SELECT id FROM users WHERE email=$1 AND id<>$2', [safeEmail, req.params.id]
      );
      if (dup.length) return res.status(409).json({ error: 'Email already in use' });
      sets.push(`email=$${i++}`);
      vals.push(safeEmail);
      changes.push('login');
    }
    if (role !== undefined) {
      if (!['teacher', 'student', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      sets.push(`role=$${i++}`);
      vals.push(role);
      changes.push(`role→${role}`);
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
      vals.push(normalizePlanKey(plan));
      changes.push(`plan→${plan}`);
    }
    if (plan_status !== undefined) {
      if (!['free', 'active', 'pending', 'grace', 'expired', 'canceled', 'rejected'].includes(plan_status)) {
        return res.status(400).json({ error: 'Invalid plan status' });
      }
      sets.push(`plan_status=$${i++}`);
      vals.push(plan_status);
      changes.push(`status→${plan_status}`);
    }
    if (billing_cycle !== undefined) {
      sets.push(`billing_cycle=$${i++}`);
      vals.push(normalizeCycleKey(billing_cycle));
      changes.push(`cycle→${billing_cycle}`);
    }
    if (plan_expires_at !== undefined) {
      sets.push(`plan_expires_at=$${i++}`);
      vals.push(plan_expires_at || null);
      changes.push(`expires→${plan_expires_at || 'null'}`);
    }
    if (password) {
      const passwordError = passwordProblem(password);
      if (passwordError) return res.status(400).json({ error: passwordError });
      const hash = await bcrypt.hash(password, 12);
      sets.push(`password_hash=$${i++}`);
      vals.push(hash);
      changes.push('password');
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(',')} WHERE id=$${i}
       RETURNING id,email,name,role,avatar,plan,plan_status,billing_cycle,plan_started_at,plan_expires_at,plan_source`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (password) {
      // A password set by an administrator is a security event: immediately
      // revoke every existing browser session for that account.
      await pool.query('DELETE FROM sessions WHERE user_id=$1', [rows[0].id]);
    }
    logAdminAction(req, 'user.update', {
      targetId: rows[0].id,
      targetLabel: rows[0].email,
      detail: changes.length ? changes.join(', ') : 'fields updated',
    });
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
    const { rows } = await pool.query('DELETE FROM users WHERE id=$1 RETURNING email', [req.params.id]);
    logAdminAction(req, 'user.delete', { targetId: req.params.id, targetLabel: rows[0]?.email || req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/boards ──────────────────────────────────────────────────
router.get('/boards', async (req, res) => {
  try {
    const { search = '', owner = '', health = '', limit = 50, offset = 0 } = req.query;
    const like = `%${search}%`;
    const ownerFilter = owner ? `%${owner}%` : '%';
    const healthFilter = ['empty', 'stale', 'healthy'].includes(health) ? health : null;
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
    const { rows } = await pool.query(
      `SELECT b.id, b.name, b.updated_at, b.created_at,
              u.name AS owner_name, u.email AS owner_email,
              pg_column_size(b.data) AS data_bytes,
              COALESCE(CASE WHEN jsonb_typeof(b.data->'cards') = 'array'
                THEN jsonb_array_length(b.data->'cards') ELSE 0 END, 0)::int AS cards_count,
              CASE
                WHEN COALESCE(CASE WHEN jsonb_typeof(b.data->'cards') = 'array'
                  THEN jsonb_array_length(b.data->'cards') ELSE 0 END, 0) = 0 THEN 'empty'
                WHEN b.updated_at < NOW() - INTERVAL '30 days' THEN 'stale'
                ELSE 'healthy'
              END AS health
       FROM boards b
       JOIN users u ON u.id = b.user_id
       WHERE (b.name ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1)
         AND u.email ILIKE $4
         AND (
           $5::text IS NULL
           OR ($5 = 'empty' AND COALESCE(CASE WHEN jsonb_typeof(b.data->'cards') = 'array' THEN jsonb_array_length(b.data->'cards') ELSE 0 END, 0) = 0)
           OR ($5 = 'stale' AND COALESCE(CASE WHEN jsonb_typeof(b.data->'cards') = 'array' THEN jsonb_array_length(b.data->'cards') ELSE 0 END, 0) > 0 AND b.updated_at < NOW() - INTERVAL '30 days')
           OR ($5 = 'healthy' AND COALESCE(CASE WHEN jsonb_typeof(b.data->'cards') = 'array' THEN jsonb_array_length(b.data->'cards') ELSE 0 END, 0) > 0 AND b.updated_at >= NOW() - INTERVAL '30 days')
         )
       ORDER BY b.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [like, safeLimit, safeOffset, ownerFilter, healthFilter]
    );
    const { rows: total } = await pool.query(
      `SELECT COUNT(*) FROM boards b JOIN users u ON u.id=b.user_id
       WHERE (b.name ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1)
         AND u.email ILIKE $2
         AND (
           $3::text IS NULL
           OR ($3 = 'empty' AND COALESCE(CASE WHEN jsonb_typeof(b.data->'cards') = 'array' THEN jsonb_array_length(b.data->'cards') ELSE 0 END, 0) = 0)
           OR ($3 = 'stale' AND COALESCE(CASE WHEN jsonb_typeof(b.data->'cards') = 'array' THEN jsonb_array_length(b.data->'cards') ELSE 0 END, 0) > 0 AND b.updated_at < NOW() - INTERVAL '30 days')
           OR ($3 = 'healthy' AND COALESCE(CASE WHEN jsonb_typeof(b.data->'cards') = 'array' THEN jsonb_array_length(b.data->'cards') ELSE 0 END, 0) > 0 AND b.updated_at >= NOW() - INTERVAL '30 days')
         )`,
      [like, ownerFilter, healthFilter]
    );
    res.json({ boards: rows, total: parseInt(total[0].count), filters: { owner: owner || null, health: healthFilter } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/boards/:id/inspection ──────────────────────────────────
// A compact board summary for the control center. The full board payload stays
// in the editor path so this administrative view cannot accidentally load a
// multi-megabyte canvas.
router.get('/boards/:id/inspection', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.name, b.updated_at, b.created_at,
              u.id AS owner_id, u.name AS owner_name, u.email AS owner_email,
              pg_column_size(b.data) AS data_bytes,
              COALESCE(CASE WHEN jsonb_typeof(b.data->'cards') = 'array'
                THEN jsonb_array_length(b.data->'cards') ELSE 0 END, 0)::int AS cards_count,
              CASE
                WHEN COALESCE(CASE WHEN jsonb_typeof(b.data->'cards') = 'array'
                  THEN jsonb_array_length(b.data->'cards') ELSE 0 END, 0) = 0 THEN 'empty'
                WHEN b.updated_at < NOW() - INTERVAL '30 days' THEN 'stale'
                ELSE 'healthy'
              END AS health
       FROM boards b
       JOIN users u ON u.id = b.user_id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Board not found' });
    res.json({ board: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/boards/:id/transfer ───────────────────────────────────
router.post('/boards/:id/transfer', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid new owner email' });
  }
  try {
    const [boardResult, recipientResult] = await Promise.all([
      pool.query(
        `SELECT b.id, b.name, b.user_id, u.email AS owner_email
         FROM boards b JOIN users u ON u.id = b.user_id
         WHERE b.id = $1`,
        [req.params.id]
      ),
      pool.query('SELECT id, email, name FROM users WHERE email = $1', [email]),
    ]);
    const board = boardResult.rows[0];
    const recipient = recipientResult.rows[0];
    if (!board) return res.status(404).json({ error: 'Board not found' });
    if (!recipient) return res.status(404).json({ error: 'No TeachEd account exists for this email' });
    if (recipient.id === board.user_id) return res.status(400).json({ error: 'This person already owns the board' });

    const { rows } = await pool.query(
      `UPDATE boards SET user_id = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, user_id, updated_at`,
      [board.id, recipient.id]
    );
    logAdminAction(req, 'board.transfer', {
      targetId: board.id,
      targetLabel: board.name,
      detail: `${board.owner_email} -> ${recipient.email}`,
    });
    res.json({ ok: true, board: rows[0], owner: recipient });
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

// ── POST /api/admin/users/:id/suspend ─────────────────────────────────────
router.post('/users/:id/suspend', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot suspend yourself' });
  const reason = String(req.body?.reason || 'Suspended by admin').trim().slice(0, 300);
  try {
    const { rows } = await pool.query(
      `UPDATE users SET is_suspended=TRUE, suspended_at=NOW(), suspended_reason=$2
       WHERE id=$1 RETURNING id, email, name`,
      [req.params.id, reason]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    // Revoke all sessions
    await pool.query('DELETE FROM sessions WHERE user_id=$1', [req.params.id]);
    logAdminAction(req, 'user.suspend', { targetId: rows[0].id, targetLabel: rows[0].email, detail: reason });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:id/unsuspend ───────────────────────────────────
router.post('/users/:id/unsuspend', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users SET is_suspended=FALSE, suspended_at=NULL, suspended_reason=NULL
       WHERE id=$1 RETURNING id, email, name`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    logAdminAction(req, 'user.unsuspend', { targetId: rows[0].id, targetLabel: rows[0].email });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/users/:id/unlock ──────────────────────────────────────
router.post('/users/:id/unlock', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users SET locked_at=NULL, failed_login_count=0
       WHERE id=$1 RETURNING id, email, name`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    logAdminAction(req, 'user.unlock', { targetId: rows[0].id, targetLabel: rows[0].email });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/users/:id/auth-events ──────────────────────────────────
router.get('/users/:id/auth-events', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, event, ip, user_agent, detail, created_at
       FROM auth_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ events: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/auth-events ────────────────────────────────────────────
router.get('/auth-events', async (req, res) => {
  const limit  = Math.min(100, parseInt(req.query.limit, 10) || 50);
  const offset = parseInt(req.query.offset, 10) || 0;
  const event  = req.query.event || '';
  const search = req.query.search || '';
  try {
    const like = `%${search}%`;
    const { rows } = await pool.query(
      `SELECT ae.id, ae.event, ae.email, ae.ip, ae.user_agent, ae.detail, ae.created_at,
              u.name AS user_name, u.is_suspended, u.locked_at
       FROM auth_events ae
       LEFT JOIN users u ON u.id = ae.user_id
       WHERE ($1='' OR ae.event ILIKE $1)
         AND ($2='' OR ae.email ILIKE $2 OR ae.ip ILIKE $2)
       ORDER BY ae.created_at DESC
       LIMIT $3 OFFSET $4`,
      [event ? `%${event}%` : '', like, limit, offset]
    );
    const { rows: total } = await pool.query(
      `SELECT COUNT(*) FROM auth_events WHERE ($1='' OR event ILIKE $1) AND ($2='' OR email ILIKE $2 OR ip ILIKE $2)`,
      [event ? `%${event}%` : '', like]
    );
    res.json({ events: rows, total: parseInt(total[0].count, 10) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
