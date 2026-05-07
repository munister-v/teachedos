const { Pool } = require('pg');

// Render internal DB (.internal host) doesn't use SSL
// External DB (frankfurt-postgres.render.com) requires SSL
const isInternal = (process.env.DATABASE_URL || '').includes('.internal');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isInternal ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => console.log('[db] connected'));
pool.on('error', (err) => console.error('[db] pool error:', err.message));

module.exports = pool;
