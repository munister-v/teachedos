const { Pool } = require('pg');

const sslDisabled = process.env.PGSSLMODE === 'disable'
  || /@(?:127\.0\.0\.1|localhost)(?::|\/)/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslDisabled ? false : { rejectUnauthorized: false },
  /* 10 соединений на всё приложение - при одновременных автосохранениях и
     открытиях досок запросы стояли в очереди к пулу. Размер - из окружения
     (Postgres на VPS общий с другими проектами), по умолчанию 20. */
  max: Math.max(5, Math.min(60, parseInt(process.env.PG_POOL_MAX, 10) || 20)),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  /* Зависший запрос не должен держать соединение вечно и душить остальных. */
  statement_timeout: Math.max(5000, parseInt(process.env.PG_STATEMENT_TIMEOUT_MS, 10) || 15000),
});

pool.on('connect', () => console.log('[db] PostgreSQL connected'));
pool.on('error', (err) => console.error('[db] pool error:', err.message));

module.exports = pool;
