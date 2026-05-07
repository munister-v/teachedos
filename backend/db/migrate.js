// Run once on startup to apply schema
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('[migrate] schema applied ✓');
  } catch (err) {
    console.error('[migrate] error:', err.message);
    throw err;
  }
}

module.exports = migrate;
