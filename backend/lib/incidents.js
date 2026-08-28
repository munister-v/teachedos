const pool = require('../db/pool');

const SEVERITIES = new Set(['s1', 's2', 's3', 's4']);
const STATUSES = new Set(['open', 'acknowledged', 'mitigating', 'resolved']);

let schemaPromise = null;

function cleanText(value, max = 160) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLongText(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeSeverity(value, fallback = 's3') {
  const severity = String(value || '').toLowerCase();
  return SEVERITIES.has(severity) ? severity : fallback;
}

function normalizeStatus(value, fallback = 'open') {
  const status = String(value || '').toLowerCase();
  return STATUSES.has(status) ? status : fallback;
}

function ensureIncidentSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS incidents (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title           VARCHAR(160) NOT NULL,
          severity        VARCHAR(8) NOT NULL DEFAULT 's3',
          status          VARCHAR(16) NOT NULL DEFAULT 'open',
          affected_scope  VARCHAR(160) NOT NULL DEFAULT '',
          summary         TEXT NOT NULL DEFAULT '',
          source          VARCHAR(32) NOT NULL DEFAULT 'manual',
          owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
          created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
          updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
          acknowledged_at TIMESTAMPTZ,
          resolved_at     TIMESTAMPTZ,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (severity IN ('s1', 's2', 's3', 's4')),
          CHECK (status IN ('open', 'acknowledged', 'mitigating', 'resolved'))
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_incidents_status_updated
          ON incidents(status, updated_at DESC)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_incidents_owner_status
          ON incidents(owner_id, status, updated_at DESC)
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS incident_updates (
          id          BIGSERIAL PRIMARY KEY,
          incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
          author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
          kind        VARCHAR(24) NOT NULL DEFAULT 'note',
          body        TEXT NOT NULL DEFAULT '',
          from_status VARCHAR(16),
          to_status   VARCHAR(16),
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (kind IN ('created', 'note', 'status', 'assignment', 'metadata'))
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_created
          ON incident_updates(incident_id, created_at ASC)
      `);
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

module.exports = {
  SEVERITIES,
  STATUSES,
  cleanText,
  cleanLongText,
  ensureIncidentSchema,
  isUuid,
  normalizeSeverity,
  normalizeStatus,
};
