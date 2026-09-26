const path = require('path');
require('dotenv').config();
// Also resolve a colocated backend/.env when the process is started from the repo root.
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '.env') });
/* Несколько процессов - только по WEB_CONCURRENCY >= 2 (lib/clusterPrimary.js).
   Проверка до тяжёлых require: главный процесс маршруты не грузит. */
const cluster = require('cluster');
const WEB_N = Math.max(1, Math.min(8, parseInt(process.env.WEB_CONCURRENCY, 10) || 1));
if (WEB_N > 1 && cluster.isPrimary) {
  require('./lib/clusterPrimary')(WEB_N);
  return;
}
const ROLE = process.env.TEACHED_ROLE || 'single';   // single | web | hub
const express  = require('express');
require('./lib/asyncErrors'); // async-ошибки маршрутов -> next(err), а не падение процесса
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
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set([
  ...configuredOrigins,
  'https://teached.tech',
  'https://www.teached.tech',
  ...(!isProduction ? [
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ] : []),
]);

// The gate for the API proper, unchanged: an unknown Origin is still refused,
// and only these origins may make calls that carry credentials.
const apiCors = cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
});

/* Reading images is public and deliberately plays by other rules.

   Everything under /api/images is a read-only GET: no auth, no cookies, no
   provider keys in the response, and /proxy sets Access-Control-Allow-Origin
   itself on purpose so html2canvas can paint photos into an export. The gate
   above got there first, though. A sandboxed iframe (sandbox without
   allow-same-origin), a data: URL or a file:// page sends the literal string
   "null" as Origin, which is neither falsy nor on the allowlist, so the
   request died with 403 before the route ever ran and the board drew empty
   grey boxes where the photos should have been.

   So public image reads get their own permissive CORS and skip the gate. The
   fix is deliberately not "add null to ALLOWED_ORIGINS": that set goes out
   with credentials: true, and a null origin covers sandboxes, data: URLs and
   local files, which must never be able to call the API with credentials.
   The star is also a constant, which matters because /proxy is cached for a
   year: reflecting the caller's Origin back would bake one consumer's header
   into that cached copy.

   Ordering alone would not have been enough. cors() sets its headers and
   calls next() for anything that is not a preflight, so mounting this merely
   in front of the gate would still leave the gate to refuse the request. */
const publicImageCors = cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  credentials: false,
});
const isPublicImageRequest = (req) => {
  const p = req.path.toLowerCase();
  return p === '/api/images' || p.startsWith('/api/images/');
};

app.use((req, res, next) => (
  isPublicImageRequest(req) ? publicImageCors(req, res, next) : apiCors(req, res, next)
));

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

/* 64 обработчика отвечают на сбой `{ error: err.message }` - и клиент видел
   сырой текст Postgres/Node («invalid input syntax for type uuid…», имена
   ограничений, куски SQL). Здесь, до маршрутов, ответ 5xx с таким текстом
   заменяется нейтральным (битый id - 400), оригинал уходит в лог. Понятные
   сообщения самих маршрутов (например, про недоступный AI) не трогаются. */
const INTERNAL_ERR_RE = /invalid input syntax|violates|constraint|relation "|column "|syntax error|duplicate key|null value in column|operator does not exist|function .* does not exist|ECONN|ETIMEDOUT|EPIPE|socket hang up|Cannot read prop|is not a function|is not defined|undefined|canceling statement/i;
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body.error === 'string' && INTERNAL_ERR_RE.test(body.error)) {
      console.error('[error]', req.method, req.originalUrl.split('?')[0], body.error);
      if (/invalid input syntax/i.test(body.error)) { res.status(400); body = { ...body, error: 'Invalid id or value in the request.' }; }
      else if (/canceling statement/i.test(body.error)) { res.status(503); body = { ...body, error: 'The server is busy. Please try again in a moment.' }; }
      else body = { ...body, error: 'Server error' };
    }
    return json(body);
  };
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
app.use('/api/booking', require('./routes/booking'));
app.use('/api/homework', require('./routes/homework'));
app.use('/api/writing', require('./routes/writing'));
app.use('/api/vault', require('./routes/vault'));
app.use('/api/library', require('./routes/library'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/images', require('./routes/images'));
app.use('/api/dictionary', require('./routes/dictionary'));

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ──────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
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
  if (res.headersSent) return;
  /* Ошибки Postgres, которые вызывает сам запрос, - это 4xx, а не 500:
     битый id в адресе, повтор уникального значения. Таймаут запроса -
     перегрузка, клиенту стоит повторить. */
  if (err.code === '22P02' || err.code === '22007' || err.code === '22008') {
    return res.status(400).json({ error: 'Invalid id or value in the request.' });
  }
  if (err.code === '23505') return res.status(409).json({ error: 'This already exists.' });
  if (err.code === '23503') return res.status(409).json({ error: 'A linked record does not exist.' });
  if (err.code === '57014') return res.status(503).json({ error: 'The server is busy. Please try again in a moment.' });
  console.error('[error]', req.method, req.originalUrl.split('?')[0], err.message);
  res.status(500).json({ error: 'Server error' });
});

/* Последняя сетка: забытый .catch в фоновой задаче не должен ронять API
   для всех. Пишем в лог и живём дальше. */
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason && reason.message ? reason.message : reason);
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT   = process.env.PORT || 4000;
const HUB_PORT = parseInt(process.env.TEACHED_HUB_PORT, 10) || 4101;
const HUB_SECRET = process.env.TEACHED_HUB_SECRET || '';

/* hub: только WebSocket-комнаты + внутренний /internal/online.
   web: HTTP-API, апгрейды WebSocket - сырым TCP в хаб.
   single: всё в одном процессе, как было. */
const server = ROLE === 'hub'
  ? http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/internal/online' && req.headers['x-hub-secret'] === HUB_SECRET) {
        let body = '';
        req.on('data', d => { body += d; if (body.length > 1e6) req.destroy(); });
        req.on('end', () => {
          let ids = [];
          try { ids = JSON.parse(body).boardIds || []; } catch (_) {}
          const online = require('./ws').onlineUserIds(new Set(ids.map(String)));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ userIds: [...online] }));
        });
        return;
      }
      res.statusCode = 404; res.end();
    })
  : http.createServer(app);

if (ROLE === 'web') {
  const net = require('net');
  server.on('upgrade', (req, socket, head) => {
    const up = net.connect(HUB_PORT, '127.0.0.1');
    const kill = () => { socket.destroy(); up.destroy(); };
    up.on('error', kill); socket.on('error', kill);
    up.on('connect', () => {
      let h = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
      for (let i = 0; i < req.rawHeaders.length; i += 2) h += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
      up.write(h + '\r\n');
      if (head && head.length) up.write(head);
      socket.pipe(up).pipe(socket);
    });
  });
} else {
  // WebSocket
  require('./ws').setup(server);
}

async function main() {
  if (process.env.DATABASE_URL) {
    try {
      if (!process.env.TEACHED_SKIP_MIGRATE) await migrate();
      await ensureTelemetrySchema();
    } catch (err) {
      // Serving requests against a partially migrated schema creates data loss
      // and misleading green process checks. Leave the port closed so systemd
      // and the dependency-aware health probe can treat startup as failed.
      console.error('[startup] database initialization failed:', err.message);
      process.exitCode = 1;
      await pool.end().catch(() => {});
      return;
    }
  } else {
    console.warn('[startup] DATABASE_URL not set - DB features disabled until env var is added');
  }

  if (ROLE === 'hub') {
    server.listen(HUB_PORT, '127.0.0.1', () => console.log(`[hub ${process.pid}] WebSocket hub on 127.0.0.1:${HUB_PORT}`));
  } else {
    server.listen(PORT, () => {
      console.log(`[server${ROLE === 'web' ? ' web ' + process.pid : ''}] TeachedOS API running on port ${PORT}`);
    });
  }

  // Deadline reminder job - runs every hour. Фоновые задачи - в одном процессе.
  if (process.env.DATABASE_URL && ROLE !== 'web') {
    const { scheduleDeadlineReminders } = require('./jobs/deadlineReminders');
    scheduleDeadlineReminders();
    const { scheduleHousekeeping } = require('./jobs/housekeeping');
    scheduleHousekeeping();
  }
}

main().catch((err) => {
  console.error('[startup] fatal:', err.message);
  process.exitCode = 1;
});
