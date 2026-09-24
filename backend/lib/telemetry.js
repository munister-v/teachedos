const pool = require('../db/pool');

// Telemetry is deliberately product- and operations-oriented. It never stores
// request bodies, board data, raw IP addresses, user agents or generated text.
// Those data belong to the feature that owns them, not to a monitoring feed.
const CATEGORIES = new Set(['product', 'request', 'security', 'system']);
const OUTCOMES = new Set(['ok', 'client_error', 'server_error', 'fallback', 'skipped']);
const SAFE_META_KEYS = new Set([
  'feature', 'method', 'operation', 'provider', 'reason', 'route', 'source',
  'status', 'surface', 'job', 'mode', 'kind',
]);

let schemaPromise = null;

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanText(value, max = 80) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanEventType(value) {
  const eventType = cleanText(value, 80).toLowerCase();
  return /^[a-z][a-z0-9_.-]{1,79}$/.test(eventType) ? eventType : 'system.unknown';
}

function cleanMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_META_KEYS.has(key) || value === null || value === undefined) continue;
    if (typeof value === 'number' && Number.isFinite(value)) safe[key] = Math.round(value);
    else if (typeof value === 'boolean') safe[key] = value;
    else if (typeof value === 'string') safe[key] = cleanText(value, 120);
  }
  return safe;
}

function ensureTelemetrySchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telemetry_events (
          id          BIGSERIAL PRIMARY KEY,
          category    VARCHAR(24) NOT NULL,
          event_type  VARCHAR(80) NOT NULL,
          outcome     VARCHAR(24) NOT NULL DEFAULT 'ok',
          actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
          board_id    UUID REFERENCES boards(id) ON DELETE SET NULL,
          duration_ms INTEGER,
          metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_telemetry_events_created
          ON telemetry_events(created_at DESC)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_telemetry_events_category_created
          ON telemetry_events(category, created_at DESC)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_telemetry_events_type_created
          ON telemetry_events(event_type, created_at DESC)
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telemetry_hourly (
          hour_start        TIMESTAMPTZ NOT NULL,
          category          VARCHAR(24) NOT NULL,
          event_type        VARCHAR(80) NOT NULL,
          outcome           VARCHAR(24) NOT NULL,
          event_count       INTEGER NOT NULL DEFAULT 0,
          total_duration_ms BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (hour_start, category, event_type, outcome)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_telemetry_hourly_category_hour
          ON telemetry_hourly(category, hour_start DESC)
      `);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function recordTelemetry(input = {}) {
  const category = CATEGORIES.has(input.category) ? input.category : 'system';
  const outcome = OUTCOMES.has(input.outcome) ? input.outcome : 'ok';
  const eventType = cleanEventType(input.eventType);
  const actorId = isUuid(input.actorId) ? input.actorId : null;
  const boardId = isUuid(input.boardId) ? input.boardId : null;
  const durationMs = Number.isFinite(Number(input.durationMs))
    ? Math.max(0, Math.min(Math.round(Number(input.durationMs)), 10 * 60 * 1000))
    : null;
  const metadata = cleanMetadata(input.metadata);

  // Monitoring must never delay a teacher's save, login, or share action.
  /* Батч вместо двух запросов на КАЖДОЕ событие. Автосохранение доски шлёт
     'board.updated' каждые несколько секунд у каждого учителя, и все они
     делали upsert в ОДНУ строку telemetry_hourly (час + тип события):
     блокировка этой строки выстраивала сохранения в очередь и занимала
     соединения пула. Теперь события копятся в памяти и уходят раз в 5 с
     одним INSERT, а почасовые счётчики - одним upsert на ключ. */
  _tq.events.push([category, eventType, outcome, actorId, boardId, durationMs, JSON.stringify(metadata)]);
  if (_tq.events.length > 2000) _tq.events.splice(0, _tq.events.length - 2000);
  const key = `${category}\u0000${eventType}\u0000${outcome}`;
  const h = _tq.hourly.get(key) || { category, eventType, outcome, n: 0, ms: 0 };
  h.n += 1; h.ms += durationMs || 0;
  _tq.hourly.set(key, h);
  if (!_tq.timer) {
    _tq.timer = setTimeout(flushTelemetry, 5000);
    if (_tq.timer.unref) _tq.timer.unref();
  }
  return Promise.resolve();
}

const _tq = { events: [], hourly: new Map(), timer: null, flushing: false };

async function flushTelemetry() {
  _tq.timer = null;
  if (_tq.flushing) { _tq.timer = setTimeout(flushTelemetry, 1000); return; }
  const events = _tq.events.splice(0);
  const hourly = [..._tq.hourly.values()]; _tq.hourly.clear();
  if (!events.length && !hourly.length) return;
  _tq.flushing = true;
  try {
    await ensureTelemetrySchema();
    for (let i = 0; i < events.length; i += 500) {
      const chunk = events.slice(i, i + 500);
      const params = []; const rows = [];
      chunk.forEach((e, k) => {
        const o = k * 7;
        rows.push(`($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}::jsonb)`);
        params.push(...e);
      });
      await pool.query(
        `INSERT INTO telemetry_events (category, event_type, outcome, actor_id, board_id, duration_ms, metadata)
         VALUES ${rows.join(', ')}`, params);
    }
    for (const h of hourly) {
      await pool.query(
        `INSERT INTO telemetry_hourly
          (hour_start, category, event_type, outcome, event_count, total_duration_ms)
         VALUES (date_trunc('hour', NOW()), $1, $2, $3, $4, $5)
         ON CONFLICT (hour_start, category, event_type, outcome)
         DO UPDATE SET
           event_count = telemetry_hourly.event_count + EXCLUDED.event_count,
           total_duration_ms = telemetry_hourly.total_duration_ms + EXCLUDED.total_duration_ms`,
        [h.category, h.eventType, h.outcome, h.n, h.ms]);
    }
  } catch (error) {
    console.warn('[telemetry]', error.message);
  } finally {
    _tq.flushing = false;
  }
}

/* При штатной остановке (деплой перезапускает сервис) - дописать хвост. */
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.once(sig, () => { flushTelemetry().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 2000).unref(); });
}

module.exports = { ensureTelemetrySchema, recordTelemetry, flushTelemetry };
