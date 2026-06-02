const { Pool } = require('pg');

const sslDisabled = process.env.PGSSLMODE === 'disable'
  || /@(?:127\.0\.0\.1|localhost)(?::|\/)/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslDisabled ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => console.log('[db] PostgreSQL connected'));
pool.on('error', (err) => console.error('[db] pool error:', err.message));

module.exports = pool;
