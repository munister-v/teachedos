const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const pool    = require('../db/pool');
const { requireAuth, signToken } = require('../middleware/auth');
const { ensureBillingSchema } = require('../lib/billing');
const { sendEmail, resetPasswordEmail } = require('../lib/email');

pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Kyiv'`).catch(() => {});
pool.query(`
  CREATE TABLE IF NOT EXISTS email_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    INTEGER     REFERENCES users(id) ON DELETE CASCADE,
    email      TEXT        NOT NULL,
    token      TEXT        NOT NULL UNIQUE,
    type       TEXT        NOT NULL DEFAULT 'reset',
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone_mode VARCHAR(16) DEFAULT 'auto'`).catch(() => {});
// OAuth support: password becomes optional, track the external identity.
pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20)`).catch(() => {});
pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL`).catch(() => {});
ensureBillingSchema(pool).catch(() => {});

// Public OAuth 2.0 Web client ID (not a secret — it is exposed in browser code
// by design). Hardcoded as the default so Google Sign-In works without setting
// a server env var; GOOGLE_CLIENT_ID env still overrides it if present.
const DEFAULT_GOOGLE_CLIENT_ID = '588434820929-ml1lshdikjohskc0kjuhiu43vgcvqk56.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Throttle credential-guessing: 20 attempts / 15 min per IP on auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

function defaultAvatarForRole(role) {
  if (role === 'student') return '🎓';
  if (role === 'admin') return '🛡️';
  return '🧑‍🏫';
}

function isValidTimeZone(timeZone) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    plan: user.plan || 'free',
    plan_status: user.plan_status || (user.plan === 'free' ? 'free' : 'active'),
    billing_cycle: user.billing_cycle || 'monthly',
    plan_started_at: user.plan_started_at,
    plan_expires_at: user.plan_expires_at,
    plan_source: user.plan_source || 'free',
    timezone: user.timezone,
    timezone_mode: user.timezone_mode,
    created_at: user.created_at
  };
}

async function issueLoginSession(req, user) {
  const token = signToken(user.id);
  await pool.query(
    `INSERT INTO sessions (user_id, token, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
    [user.id, token, req.headers['user-agent'] || '', req.ip]
  );
  return { token, user: publicUser(user) };
}

async function authenticateLegacyUser(email, password) {
  const legacyBase = (process.env.LEGACY_API_BASE || 'https://teachedos-api.onrender.com').replace(/\/+$/, '');
  if (!legacyBase) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`${legacyBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return data && data.user && data.token ? data.user : null;
  } catch (err) {
    console.warn('[auth/legacy-login]', err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertLegacyUser(email, password, legacyUser, existingUser = null) {
  const normalizedEmail = email.toLowerCase().trim();
  const hash = await bcrypt.hash(password, 12);
  const safeRole = ['admin', 'teacher', 'student'].includes(legacyUser.role) ? legacyUser.role : 'teacher';
  const safePlan = ['free', 'pro', 'school'].includes(legacyUser.plan) ? legacyUser.plan : 'free';
  const safePlanStatus = legacyUser.plan_status || (safePlan === 'free' ? 'free' : 'active');
  const safeBillingCycle = legacyUser.billing_cycle || 'monthly';
  const safeTimezone = isValidTimeZone(legacyUser.timezone) ? legacyUser.timezone : 'Europe/Kyiv';
  const safeTimezoneMode = legacyUser.timezone_mode === 'manual' ? 'manual' : 'auto';
  const safeAvatar = String(legacyUser.avatar || defaultAvatarForRole(safeRole)).slice(0, 10);
  const safeName = String(legacyUser.name || normalizedEmail.split('@')[0] || 'Teacher').trim().slice(0, 255);

  if (existingUser) {
    const { rows } = await pool.query(
      `UPDATE users
       SET password_hash=$2, name=$3, role=$4, avatar=$5, plan=$6, plan_status=$7,
           billing_cycle=$8, plan_source=COALESCE(NULLIF(plan_source, 'free'), 'legacy'),
           timezone=$9, timezone_mode=$10
       WHERE id=$1
       RETURNING id, email, password_hash, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, timezone, timezone_mode, created_at`,
      [existingUser.id, hash, safeName, safeRole, safeAvatar, safePlan, safePlanStatus, safeBillingCycle, safeTimezone, safeTimezoneMode]
    );
    return rows[0];
  }

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, avatar, plan, plan_status, billing_cycle, plan_source, timezone, timezone_mode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'legacy', $9, $10)
     RETURNING id, email, password_hash, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, timezone, timezone_mode, created_at`,
    [normalizedEmail, hash, safeName, safeRole, safeAvatar, safePlan, safePlanStatus, safeBillingCycle, safeTimezone, safeTimezoneMode]
  );
  const user = rows[0];
  await pool.query(
    `INSERT INTO boards (user_id, name)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [user.id, 'My First Board']
  );
  return user;
}

async function loadActiveInvite(token) {
  const { rows } = await pool.query(
    `SELECT id, email, role, note, expires_at, accepted_at, revoked_at
     FROM invites
     WHERE token = $1`,
    [token]
  );
  const invite = rows[0];
  if (!invite) {
    const err = new Error('Invite not found');
    err.status = 404;
    throw err;
  }
  if (invite.revoked_at) {
    const err = new Error('Invite has been revoked');
    err.status = 410;
    throw err;
  }
  if (invite.accepted_at) {
    const err = new Error('Invite has already been used');
    err.status = 410;
    throw err;
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    const err = new Error('Invite has expired');
    err.status = 410;
    throw err;
  }
  return invite;
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const { email, password, name, role = 'teacher', avatar = '🧑‍🏫' } = req.body;
  const safeRole = role === 'student' ? 'student' : 'teacher';
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
       RETURNING id, email, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, timezone, timezone_mode, created_at`,
      [email.toLowerCase().trim(), hash, name.trim(), safeRole, avatar]
    );
    const user  = rows[0];
    const token = signToken(user.id);

    // Create a default board for the new user
    await pool.query(
      `INSERT INTO boards (user_id, name) VALUES ($1, $2)`,
      [user.id, 'My First Board']
    );

    res.status(201).json({ token, user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      plan: user.plan || 'free',
      plan_status: user.plan_status || 'free',
      billing_cycle: user.billing_cycle || 'monthly',
      plan_started_at: user.plan_started_at,
      plan_expires_at: user.plan_expires_at,
      plan_source: user.plan_source || 'free',
      timezone: user.timezone,
      timezone_mode: user.timezone_mode,
      created_at: user.created_at
    } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('[auth/register]', err.message, err.code);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/invites/:token — fetch invite details
router.get('/invites/:token', async (req, res) => {
  try {
    const invite = await loadActiveInvite(req.params.token);
    res.json({
      invite: {
        email: invite.email,
        role: invite.role,
        note: invite.note,
        expires_at: invite.expires_at,
      }
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/auth/invites/:token/accept — create account from invite
router.post('/invites/:token/accept', async (req, res) => {
  const { name, password, avatar } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: 'name and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inviteRows = await client.query(
      `SELECT id, email, role, note, expires_at, accepted_at, revoked_at
       FROM invites
       WHERE token = $1
       FOR UPDATE`,
      [req.params.token]
    );
    const invite = inviteRows.rows[0];
    if (!invite) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invite not found' });
    }
    if (invite.revoked_at) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'Invite has been revoked' });
    }
    if (invite.accepted_at) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'Invite has already been used' });
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'Invite has expired' });
    }

    const normalizedEmail = invite.email.toLowerCase().trim();
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'This email is already registered' });
    }

    const safeAvatar = String(avatar || defaultAvatarForRole(invite.role)).trim();
    const hash = await bcrypt.hash(password, 12);
    const created = await client.query(
      `INSERT INTO users (email, password_hash, name, role, avatar)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, created_at`,
      [normalizedEmail, hash, name.trim(), invite.role, safeAvatar]
    );
    const user = created.rows[0];
    const token = signToken(user.id);

    await client.query(
      `INSERT INTO boards (user_id, name) VALUES ($1, $2)`,
      [user.id, 'My First Board']
    );
    await client.query(
      `INSERT INTO sessions (user_id, token, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [user.id, token, req.headers['user-agent'] || '', req.ip]
    );
    await client.query(
      `UPDATE invites
       SET accepted_at = NOW(), accepted_user_id = $2
       WHERE id = $1`,
      [invite.id, user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ token, user });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[auth/invite-accept]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, timezone, timezone_mode, created_at FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses Google sign-in. Please continue with Google.' });
    }
    const ok   = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = await issueLoginSession(req, user);
    res.json(payload);
  } catch (err) {
    console.error('[auth/login]', err.message, err.code);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/config — public client config (which providers are enabled)
router.get('/config', (_req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null, googleEnabled: !!googleClient });
});

// POST /api/auth/google — sign in / sign up with a Google ID token
router.post('/google', authLimiter, async (req, res) => {
  if (!googleClient) {
    return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
  }
  const { credential, role } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Missing Google credential' });
  }
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p || !p.email || !p.email_verified) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }
    const email = String(p.email).toLowerCase().trim();
    const googleId = p.sub;
    const safeRole = role === 'student' ? 'student' : 'teacher';
    const name = String(p.name || email.split('@')[0] || 'Teacher').trim().slice(0, 255);
    const avatar = defaultAvatarForRole(safeRole);

    // Match by google_id first, then by email (link existing password account).
    let { rows } = await pool.query(
      `SELECT id, email, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, timezone, timezone_mode, created_at, google_id
       FROM users WHERE google_id = $1 OR email = $2 LIMIT 1`,
      [googleId, email]
    );
    let user = rows[0];

    if (user) {
      if (!user.google_id) {
        await pool.query(
          `UPDATE users SET google_id = $2, oauth_provider = COALESCE(oauth_provider, 'google') WHERE id = $1`,
          [user.id, googleId]
        );
      }
    } else {
      const inserted = await pool.query(
        `INSERT INTO users (email, name, role, avatar, google_id, oauth_provider, plan_source)
         VALUES ($1, $2, $3, $4, $5, 'google', 'free')
         RETURNING id, email, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, timezone, timezone_mode, created_at`,
        [email, name, safeRole, avatar, googleId]
      );
      user = inserted.rows[0];
      await pool.query(
        `INSERT INTO boards (user_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [user.id, 'My First Board']
      );
    }

    const payload = await issueLoginSession(req, user);
    res.json(payload);
  } catch (err) {
    console.error('[auth/google]', err.message);
    res.status(401).json({ error: 'Could not verify Google sign-in' });
  }
});

// GET /api/auth/me  — verify token & return current user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// PATCH /api/auth/me — update profile fields
router.patch('/me', requireAuth, async (req, res) => {
  const { name, avatar, meeting_url, zoom_url, timezone, timezone_mode } = req.body;
  const updates = [];
  const params  = [];

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    updates.push(`name = $${params.length + 1}`); params.push(name.trim().slice(0, 100));
  }
  if (avatar !== undefined) {
    updates.push(`avatar = $${params.length + 1}`); params.push(avatar);
  }
  if (meeting_url !== undefined) {
    if (meeting_url && !/^https?:\/\/.+/.test(meeting_url)) {
      return res.status(400).json({ error: 'meeting_url must be a valid URL' });
    }
    updates.push(`meeting_url = $${params.length + 1}`); params.push(meeting_url || null);
  }
  if (zoom_url !== undefined) {
    if (zoom_url && !/^https?:\/\/.+/.test(zoom_url)) {
      return res.status(400).json({ error: 'zoom_url must be a valid URL' });
    }
    updates.push(`zoom_url = $${params.length + 1}`); params.push(zoom_url || null);
  }
  if (timezone !== undefined) {
    const nextTz = String(timezone || '').trim();
    if (!nextTz || !isValidTimeZone(nextTz)) {
      return res.status(400).json({ error: 'timezone must be a valid IANA zone like Europe/Kyiv' });
    }
    updates.push(`timezone = $${params.length + 1}`); params.push(nextTz);
  }
  if (timezone_mode !== undefined) {
    const nextMode = timezone_mode === 'manual' ? 'manual' : 'auto';
    updates.push(`timezone_mode = $${params.length + 1}`); params.push(nextMode);
  }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.user.id);

  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, email, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, meeting_url, zoom_url, timezone, timezone_mode`,
      params
    );
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('[auth/patch-me]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  const token = req.headers['authorization']?.slice(7);
  if (token) {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]).catch(() => {});
  }
  res.json({ ok: true });
});

// GET /api/auth/sessions — list active sessions for current user
router.get('/sessions', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, user_agent, ip, created_at, expires_at
     FROM sessions WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ sessions: rows });
});

// DELETE /api/auth/sessions/:id — revoke a session
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  await pool.query(
    'DELETE FROM sessions WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

// POST /api/auth/make-admin  — promote user to admin using ADMIN_SECRET
router.post('/make-admin', async (req, res) => {
  const { email, secret } = req.body;
  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Invalid admin secret' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET role='admin' WHERE email=$1 RETURNING id,email,name,role`,
      [email.toLowerCase().trim()]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/set-role  — set any role using ADMIN_SECRET
router.post('/set-role', async (req, res) => {
  const { email, role, secret } = req.body;
  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' });
  }
  const allowed = ['teacher', 'student', 'admin'];
  if (!allowed.includes(role)) {
    return res.status(400).json({ error: 'Role must be teacher, student, or admin' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET role=$1 WHERE email=$2 RETURNING id,email,name,role`,
      [role, email.toLowerCase().trim()]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Password reset ───────────────────────────────────────────────────────────
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5,
  message: { error: 'Too many reset requests, please try again in 15 minutes.' } });

// POST /api/auth/forgot-password  { email }
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  // Always return success to prevent user enumeration
  res.json({ ok: true, message: 'If an account with that email exists, a reset link has been sent.' });

  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email]);
    if (!rows.length) return; // silent — don't leak existence

    const userId = rows[0].id;
    const token  = crypto.randomBytes(32).toString('hex');
    const exp    = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate older unused reset tokens for this user
    await pool.query(
      `UPDATE email_tokens SET used_at = NOW()
       WHERE user_id = $1 AND type = 'reset' AND used_at IS NULL`, [userId]);

    await pool.query(
      `INSERT INTO email_tokens (user_id, email, token, type, expires_at)
       VALUES ($1, $2, $3, 'reset', $4)`,
      [userId, email, token, exp]);

    const { subject, html } = resetPasswordEmail(token);
    await sendEmail({ to: email, subject, html });
  } catch (err) {
    console.error('[auth/forgot-password]', err.message);
  }
});

// GET /api/auth/reset-password?token=...  — validate token
router.get('/reset-password', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ valid: false, error: 'Token is required.' });
  try {
    const { rows } = await pool.query(
      `SELECT email, expires_at, used_at
       FROM email_tokens
       WHERE token = $1 AND type = 'reset'`, [token]);
    if (!rows.length)     return res.json({ valid: false, error: 'Invalid or expired link.' });
    if (rows[0].used_at)  return res.json({ valid: false, error: 'This link has already been used.' });
    if (new Date(rows[0].expires_at) < new Date())
                          return res.json({ valid: false, error: 'This link has expired.' });
    res.json({ valid: true, email: rows[0].email });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// POST /api/auth/reset-password  { token, password }
router.post('/reset-password', forgotLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password)
    return res.status(400).json({ error: 'Token and new password are required.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT t.id, t.user_id, t.email, t.expires_at, t.used_at
       FROM email_tokens t
       WHERE t.token = $1 AND t.type = 'reset'
       FOR UPDATE`, [token]);

    if (!rows.length)    throw Object.assign(new Error('Invalid or expired link.'),    { status: 400 });
    if (rows[0].used_at) throw Object.assign(new Error('This link has already been used.'), { status: 400 });
    if (new Date(rows[0].expires_at) < new Date())
                         throw Object.assign(new Error('This link has expired.'),       { status: 400 });

    const hash = await bcrypt.hash(password, 12);
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2',
      [hash, rows[0].user_id]);
    await client.query('UPDATE email_tokens SET used_at = NOW() WHERE id = $1',
      [rows[0].id]);
    // Invalidate all sessions for this user
    await client.query('DELETE FROM sessions WHERE user_id = $1', [rows[0].user_id]);

    await client.query('COMMIT');
    res.json({ ok: true, message: 'Password updated. You can now sign in.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[auth/reset-password]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
