const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const pool    = require('../db/pool');
const { requireAuth, signToken, hashSessionToken } = require('../middleware/auth');
const { ensureBillingSchema } = require('../lib/billing');
const { sendEmail, resetPasswordEmail } = require('../lib/email');

pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Kyiv'`).catch(() => {});
// Auth monitoring columns
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`).catch(() => {});
pool.query(`
  CREATE TABLE IF NOT EXISTS auth_events (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
    email        TEXT,
    event        TEXT         NOT NULL,
    ip           TEXT,
    user_agent   TEXT,
    detail       TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )
`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_events_user    ON auth_events(user_id, created_at DESC)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at DESC)`).catch(() => {});
pool.query(`CREATE INDEX IF NOT EXISTS idx_auth_events_email   ON auth_events(email, created_at DESC)`).catch(() => {});

function logAuthEvent(userId, email, event, req, detail) {
  pool.query(
    `INSERT INTO auth_events (user_id, email, event, ip, user_agent, detail) VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId || null, email || null, String(event).slice(0,40), req?.ip || null, String(req?.headers?.['user-agent'] || '').slice(0,300), detail ? String(detail).slice(0,200) : null]
  ).catch(() => {});
}

pool.query(`
  CREATE TABLE IF NOT EXISTS email_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
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
const SIGNUP_BONUS_PLAN = {
  plan: 'pro',
  status: 'active',
  cycle: 'yearly',
  source: 'signup_bonus',
};
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_BYTES = 72;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 8;
const EMAIL_MAX_LENGTH = 254;
const NAME_MAX_LENGTH = 120;
const AUTH_TOKEN_MAX_LENGTH = 256;

// Throttle credential-guessing: 20 attempts / 15 min per IP on auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// The two emergency admin-secret routes intentionally remain available for
// recovery, but should never be a credential-guessing oracle.
const adminSecretLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many privileged requests. Please try again later.' },
});

function passwordProblem(password) {
  if (typeof password !== 'string') return 'Password is required';
  const value = password;
  if (value.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (Buffer.byteLength(value, 'utf8') > PASSWORD_MAX_BYTES) return 'Password is too long. Use 72 bytes or fewer.';
  return null;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email && email.length <= EMAIL_MAX_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function nameProblem(name) {
  if (typeof name !== 'string' || !name.trim()) return 'Name is required';
  if (name.trim().length > NAME_MAX_LENGTH) return `Name is too long. Use ${NAME_MAX_LENGTH} characters or fewer.`;
  return null;
}

function safeAvatar(value, role) {
  const avatar = typeof value === 'string' ? value.trim() : '';
  return (avatar || defaultAvatarForRole(role)).slice(0, 32);
}

function secretsMatch(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function tokenCandidates(token) {
  const raw = String(token || '');
  return [hashSessionToken(raw), raw];
}

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
  const token = await createLoginSession(req, user);
  return { token, user: publicUser(user) };
}

async function createLoginSession(req, user, db = pool) {
  const sessionId = crypto.randomUUID();
  const token = signToken(user.id, sessionId);
  // A database dump must not be enough to replay active browser tokens.
  // Sessions store only a SHA-256 fingerprint; the raw JWT stays with the
  // client and is compared by fingerprint on every authenticated request.
  await db.query(
    `INSERT INTO sessions (id, user_id, token, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
    [sessionId, user.id, hashSessionToken(token), req.headers['user-agent'] || '', req.ip]
  );
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= NOW()', [user.id]).catch(() => {});
  await db.query(
    `DELETE FROM sessions
     WHERE user_id = $1 AND id IN (
       SELECT id FROM sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC, id DESC
       OFFSET $2
     )`,
    [user.id, MAX_ACTIVE_SESSIONS]
  ).catch(() => {});
  return token;
}

async function authenticateLegacyUser(email, password) {
  // Never forward a password to a legacy service unless an operator has
  // explicitly configured that migration endpoint.
  const legacyBase = (process.env.LEGACY_API_BASE || '').replace(/\/+$/, '');
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
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const nameError = nameProblem(name);
  if (nameError) return res.status(400).json({ error: nameError });
  const passwordError = passwordProblem(password);
  if (passwordError) return res.status(400).json({ error: passwordError });
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + INTERVAL '1 year', $9)
       RETURNING id, email, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, timezone, timezone_mode, created_at`,
      [
        normalizedEmail,
        hash,
        name.trim().slice(0, NAME_MAX_LENGTH),
        safeRole,
        safeAvatar(avatar, safeRole),
        SIGNUP_BONUS_PLAN.plan,
        SIGNUP_BONUS_PLAN.status,
        SIGNUP_BONUS_PLAN.cycle,
        SIGNUP_BONUS_PLAN.source,
      ]
    );
    const user  = rows[0];
    // Create a default board for the new user
    await pool.query(
      `INSERT INTO boards (user_id, name) VALUES ($1, $2)`,
      [user.id, 'My First Board']
    );

    const payload = await issueLoginSession(req, user);
    logAuthEvent(user.id, user.email, 'signup', req);
    res.status(201).json({ ...payload, isNewUser: true });
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
router.post('/invites/:token/accept', authLimiter, async (req, res) => {
  const { name, password, avatar } = req.body;
  const nameError = nameProblem(name);
  if (nameError) return res.status(400).json({ error: nameError });
  const passwordError = passwordProblem(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

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

    const safeAvatarValue = safeAvatar(avatar, invite.role);
    const hash = await bcrypt.hash(password, 12);
    const created = await client.query(
      `INSERT INTO users (email, password_hash, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + INTERVAL '1 year', $9)
       RETURNING id, email, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, created_at`,
      [
        normalizedEmail,
        hash,
        name.trim().slice(0, NAME_MAX_LENGTH),
        invite.role,
        safeAvatarValue,
        SIGNUP_BONUS_PLAN.plan,
        SIGNUP_BONUS_PLAN.status,
        SIGNUP_BONUS_PLAN.cycle,
        SIGNUP_BONUS_PLAN.source,
      ]
    );
    const user = created.rows[0];
    await client.query(
      `INSERT INTO boards (user_id, name) VALUES ($1, $2)`,
      [user.id, 'My First Board']
    );
    const token = await createLoginSession(req, user, client);
    await client.query(
      `UPDATE invites
       SET accepted_at = NOW(), accepted_user_id = $2
       WHERE id = $1`,
      [invite.id, user.id]
    );

    await client.query('COMMIT');
    logAuthEvent(user.id, user.email, 'invite.accept', req);
    res.status(201).json({ token, isNewUser: true, user: publicUser(user) });
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
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Please enter a valid email and password.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, name, role, avatar, plan, plan_status, billing_cycle,
              plan_started_at, plan_expires_at, plan_source, timezone, timezone_mode, created_at,
              is_suspended, suspended_reason, locked_at, failed_login_count
       FROM users WHERE email = $1`,
      [normalizedEmail]
    );
    if (!rows.length) {
      logAuthEvent(null, normalizedEmail, 'login.fail', req, 'user not found');
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const user = rows[0];

    // Suspended account check
    if (user.is_suspended) {
      logAuthEvent(user.id, user.email, 'login.blocked', req, 'account suspended');
      return res.status(403).json({ error: user.suspended_reason || 'Account suspended. Contact support.' });
    }

    // Locked account check (too many failed attempts). The lock naturally
    // expires, avoiding a permanent denial-of-service against a real user.
    if (user.locked_at) {
      const lockAge = Date.now() - new Date(user.locked_at).getTime();
      if (Number.isFinite(lockAge) && lockAge < ACCOUNT_LOCK_MS) {
        const waitMinutes = Math.max(1, Math.ceil((ACCOUNT_LOCK_MS - lockAge) / 60000));
        logAuthEvent(user.id, user.email, 'login.blocked', req, 'temporary account lock');
        return res.status(429).json({ error: `Too many attempts. Try again in ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}.` });
      }
      await pool.query('UPDATE users SET failed_login_count=0, locked_at=NULL WHERE id=$1', [user.id]);
      user.failed_login_count = 0;
      user.locked_at = null;
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses Google sign-in. Please continue with Google.' });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      // Increment failure counter; lock after 10 consecutive failures.
      const newCount = (user.failed_login_count || 0) + 1;
      const lockNow = newCount >= 10;
      await pool.query(
        `UPDATE users SET failed_login_count=$1 ${lockNow ? ', locked_at=NOW()' : ''} WHERE id=$2`,
        [newCount, user.id]
      );
      logAuthEvent(user.id, user.email, 'login.fail', req, `attempt ${newCount}${lockNow ? ' → locked' : ''}`);
      if (lockNow) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Success — reset counter, update last_login_at
    await pool.query(
      `UPDATE users SET failed_login_count=0, locked_at=NULL, last_login_at=NOW() WHERE id=$1`,
      [user.id]
    );
    logAuthEvent(user.id, user.email, 'login.ok', req);
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
    const name = String(p.name || email.split('@')[0] || 'Teacher').trim().slice(0, NAME_MAX_LENGTH);
    const avatar = defaultAvatarForRole(safeRole);

    // Match by google_id first, then by email (link existing password account).
    let { rows } = await pool.query(
      `SELECT id, email, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, timezone, timezone_mode, created_at, google_id, is_suspended, suspended_reason
       FROM users WHERE google_id = $1 OR email = $2 LIMIT 1`,
      [googleId, email]
    );
    let user = rows[0];
    let isNewUser = false;

    if (user) {
      if (user.is_suspended) {
        logAuthEvent(user.id, user.email, 'login.blocked', req, 'account suspended via google');
        return res.status(403).json({ error: user.suspended_reason || 'Account suspended. Contact support.' });
      }
      if (!user.google_id) {
        await pool.query(
          `UPDATE users SET google_id = $2, oauth_provider = COALESCE(oauth_provider, 'google') WHERE id = $1`,
          [user.id, googleId]
        );
      }
    } else {
      const inserted = await pool.query(
        `INSERT INTO users (email, name, role, avatar, google_id, oauth_provider, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source)
         VALUES ($1, $2, $3, $4, $5, 'google', $6, $7, $8, NOW(), NOW() + INTERVAL '1 year', $9)
         RETURNING id, email, name, role, avatar, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, timezone, timezone_mode, created_at`,
        [
          email,
          name,
          safeRole,
          avatar,
          googleId,
          SIGNUP_BONUS_PLAN.plan,
          SIGNUP_BONUS_PLAN.status,
          SIGNUP_BONUS_PLAN.cycle,
          SIGNUP_BONUS_PLAN.source,
        ]
      );
      user = inserted.rows[0];
      isNewUser = true;
      await pool.query(
        `INSERT INTO boards (user_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [user.id, 'My First Board']
      );
    }

    await pool.query(`UPDATE users SET last_login_at=NOW(), failed_login_count=0, locked_at=NULL WHERE id=$1`, [user.id]).catch(() => {});
    logAuthEvent(user.id, user.email, isNewUser ? 'google.signup' : 'google.login', req);
    const payload = await issueLoginSession(req, user);
    payload.isNewUser = isNewUser;
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
  await pool.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [req.authSessionId, req.user.id]).catch(() => {});
  logAuthEvent(req.user.id, req.user.email, 'logout', req);
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
  logAuthEvent(req.user.id, req.user.email, 'session.revoked', req, req.params.id);
  res.json({ ok: true });
});

// POST /api/auth/make-admin  — promote user to admin using ADMIN_SECRET
router.post('/make-admin', adminSecretLimiter, async (req, res) => {
  const { email, secret } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  if (!ADMIN_SECRET || !secretsMatch(secret, ADMIN_SECRET)) {
    return res.status(403).json({ error: 'Invalid admin secret' });
  }
  if (!normalizedEmail) return res.status(400).json({ error: 'A valid email is required.' });
  try {
    const { rows } = await pool.query(
      `UPDATE users SET role='admin' WHERE email=$1 RETURNING id,email,name,role`,
      [normalizedEmail]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/set-role  — set any role using ADMIN_SECRET
router.post('/set-role', adminSecretLimiter, async (req, res) => {
  const { email, role, secret } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  if (!ADMIN_SECRET || !secretsMatch(secret, ADMIN_SECRET)) {
    return res.status(403).json({ error: 'Invalid secret' });
  }
  if (!normalizedEmail) return res.status(400).json({ error: 'A valid email is required.' });
  const allowed = ['teacher', 'student', 'admin'];
  if (!allowed.includes(role)) {
    return res.status(400).json({ error: 'Role must be teacher, student, or admin' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users SET role=$1 WHERE email=$2 RETURNING id,email,name,role`,
      [role, normalizedEmail]
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
const resetTokenCheckLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30,
  message: { error: 'Too many reset-link checks, please try again later.' } });

// POST /api/auth/forgot-password  { email }
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  // Always return success to prevent user enumeration
  res.json({ ok: true, message: 'If an account with that email exists, a reset link has been sent.' });
  if (!email) return;

  try {
    const { rows } = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email]);
    if (!rows.length) return; // silent — don't leak existence

    const userId = rows[0].id;
    const token  = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(token);
    const exp    = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate older unused reset tokens for this user
    await pool.query(
      `UPDATE email_tokens SET used_at = NOW()
       WHERE user_id = $1 AND type = 'reset' AND used_at IS NULL`, [userId]);

    await pool.query(
      `INSERT INTO email_tokens (user_id, email, token, type, expires_at)
       VALUES ($1, $2, $3, 'reset', $4)`,
      [userId, email, tokenHash, exp]);

    const { subject, html } = resetPasswordEmail(token);
    await sendEmail({ to: email, subject, html });
  } catch (err) {
    console.error('[auth/forgot-password]', err.message);
  }
});

// GET /api/auth/reset-password?token=...  — validate token
router.get('/reset-password', resetTokenCheckLimiter, async (req, res) => {
  const token = String(req.query.token || '');
  if (!token || token.length > AUTH_TOKEN_MAX_LENGTH) return res.status(400).json({ valid: false, error: 'Invalid reset link.' });
  try {
    const { rows } = await pool.query(
      `SELECT email, expires_at, used_at
       FROM email_tokens
       WHERE token = ANY($1::text[]) AND type = 'reset'`, [tokenCandidates(token)]);
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
  if (typeof token !== 'string' || !token || token.length > AUTH_TOKEN_MAX_LENGTH || typeof password !== 'string' || !password)
    return res.status(400).json({ error: 'Token and new password are required.' });
  const passwordError = passwordProblem(password);
  if (passwordError) return res.status(400).json({ error: `${passwordError}.` });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT t.id, t.user_id, t.email, t.expires_at, t.used_at
       FROM email_tokens t
       WHERE t.token = ANY($1::text[]) AND t.type = 'reset'
       FOR UPDATE`, [tokenCandidates(token)]);

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
    logAuthEvent(rows[0].user_id, rows[0].email, 'password.reset', req);
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
