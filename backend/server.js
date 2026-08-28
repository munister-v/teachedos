const path = require('path');
require('dotenv').config();
// Also resolve a colocated backend/.env when the process is started from the repo root.
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '.env') });
const express  = require('express');
const cors     = require('cors');
const http     = require('http');
const migrate  = require('./db/migrate');
const pool     = require('./db/pool');
const { ensureTelemetrySchema, recordTelemetry } = require('./lib/telemetry');

const app = express();
app.disable('x-powered-by');

// Keep API responses safe even when a request bypasses the nginx front door
// (local previews, health probes and future proxy changes). These headers are
// intentionally conservative and do not interfere with the app's inline UI.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── CORS ───────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .concat([
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://munister-v.github.io',
    'https://munister.com.ua',
    'http://munister.com.ua',
    'https://www.munister.com.ua',
    'http://www.munister.com.ua',
    'https://teached.tech',
    'https://www.teached.tech',
  ]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Stripe webhook needs raw body - must be before express.json()
app.post('/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  require('./routes/billing').handleWebhook
);

// Auth payloads only contain credentials and small profile fields. Parse them
// with a tight limit before the general 25 MB board parser to reduce memory
// abuse on public login/register/reset endpoints.
app.use('/api/auth', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
});
app.use('/api/auth', express.json({ limit: '64kb' }));
app.use('/api/auth', express.urlencoded({ extended: true, limit: '64kb' }));
app.use(express.json({ limit: '25mb' }));   // boards can include optimized image cards
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ── Trust proxy (Render sits behind a load-balancer) ───────────────────────
app.set('trust proxy', 1);

// ── Health ─────────────────────────────────────────────────────────────────
// This is intentionally dependency-aware. A live Node process with an
// unavailable database is not a healthy TeachEd API.
app.get('/health', async (_req, res) => {
  const startedAt = Date.now();
  let database = { ok: false, latencyMs: null };
  try {
    if (process.env.DATABASE_URL) {
      await pool.query('SELECT 1');
      database = { ok: true, latencyMs: Date.now() - startedAt };
    }
  } catch (_) {
    database = { ok: false, latencyMs: Date.now() - startedAt };
  }
  const ok = database.ok;
  return res.status(ok ? 200 : 503).json({
    ok,
    ts: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    dependencies: { database },
  });
});

// Record route-level reliability without retaining bodies or visitor details.
// Board saves are represented separately as product events, so the monitor can
// distinguish demand from raw HTTP traffic.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (!req.path.startsWith('/api/') || req.path.startsWith('/api/admin/monitor')) return;
    const status = Number(res.statusCode || 0);
    const outcome = status >= 500 ? 'server_error' : status >= 400 ? 'client_error' : 'ok';
    let route = String(req.path || '');
    route = route.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id');
    if (/^\/api\/share\/[^/]+$/.test(route)) route = '/api/share/:token';
    route = route.slice(0, 120);
    recordTelemetry({
      category: 'request',
      eventType: 'request.completed',
      outcome,
      actorId: req.user?.id,
      durationMs: Date.now() - startedAt,
      metadata: { method: req.method, route, status },
    });
  });
  next();
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/share',  require('./routes/share'));
app.use('/api/boards', require('./routes/boards'));
app.use('/api/users',  require('./routes/users'));
app.use('/api/admin',  require('./routes/admin'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/members', require('./routes/members'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/student', require('./routes/student'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/notes',   require('./routes/notes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/homework', require('./routes/homework'));
app.use('/api/library', require('./routes/library'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/images', require('./routes/images'));

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ──────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[error]', err.message);
  if (err.message === 'Not allowed by CORS') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(403).json({ error: 'Origin is not allowed.' });
  }
  if (err.type === 'entity.too.large') {
    if (req.originalUrl.startsWith('/api/auth')) {
      return res.status(413).json({ error: 'Authentication request is too large.' });
    }
    return res.status(413).json({
      error: 'Board payload is too large. Compress or remove a few images and try again.',
    });
  }
  res.status(500).json({ error: 'Server error' });
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT   = process.env.PORT || 4000;
const server = http.createServer(app);

// WebSocket
require('./ws').setup(server);

async function main() {
  if (process.env.DATABASE_URL) {
    try { await migrate(); }
    catch (err) { console.error('[startup] migration error (continuing):', err.message); }
    try { await ensureTelemetrySchema(); }
    catch (err) { console.error('[startup] telemetry schema error (continuing):', err.message); }
  } else {
    console.warn('[startup] DATABASE_URL not set - DB features disabled until env var is added');
  }

  server.listen(PORT, () => {
    console.log(`[server] TeachedOS API running on port ${PORT}`);
  });

  // Deadline reminder job - runs every hour
  if (process.env.DATABASE_URL) {
    const { scheduleDeadlineReminders } = require('./jobs/deadlineReminders');
    scheduleDeadlineReminders();
    const { scheduleHousekeeping } = require('./jobs/housekeeping');
    scheduleHousekeeping();
  }
}

main();
