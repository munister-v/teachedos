const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL || '';
// Internal Render hostnames (.internal) skip SSL; external need SSL
const ssl = dbUrl.includes('.internal') ? false : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString: dbUrl,
  ssl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
});

pool.on('connect', () => console.log('[db] connected to PostgreSQL'));
pool.on('error', (err) => console.error('[db] pool error:', err.message));

module.exports = pool;
