// Run once on startup to apply schema
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  /* Отдельное соединение без statement_timeout пула: добор колонок и индексов
     на большой базе может идти дольше 15 с, а упавшая миграция не даёт API
     стартовать. После - таймаут возвращается, соединение уходит в пул. */
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 0');
    await client.query(sql);
    console.log('[migrate] schema applied ✓');
  } catch (err) {
    console.error('[migrate] error:', err.message);
    throw err;
  } finally {
    await client.query('RESET statement_timeout').catch(() => {});
    client.release();
  }
}

module.exports = migrate;
