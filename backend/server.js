require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const http     = require('http');
const migrate  = require('./db/migrate');

const app = express();

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
  ]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '4mb' }));   // boards can be large
app.use(express.urlencoded({ extended: true }));

// ── Trust proxy (Render sits behind a load-balancer) ───────────────────────
app.set('trust proxy', 1);

// ── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/boards', require('./routes/boards'));
app.use('/api/users',  require('./routes/users'));

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ──────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message || 'Server error' });
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
  } else {
    console.warn('[startup] DATABASE_URL not set — DB features disabled until env var is added');
  }

  server.listen(PORT, () => {
    console.log(`[server] TeachedOS API running on port ${PORT}`);
  });
}

main();
