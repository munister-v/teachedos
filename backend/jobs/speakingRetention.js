// Speaking Tutor, §28: the student's recordings are kept for 12 months (the "then and now" and the quality audit need them),
// then deleted. Transcripts and the mistake log stay for the whole time of study. Runs once a day.
const pool = require('../db/pool');
const C = require('../lib/speaking/constants');

async function purgeOldRecordings() {
  try {
    const r = await pool.query(`DELETE FROM speaking_audio WHERE kind IN ('student','repeat') AND created_at < NOW() - ($1 || ' months')::interval`, [String(C.AUDIO_RETENTION_MONTHS)]);
    return r.rowCount;
  } catch (err) { console.error('[speaking-retention]', err.message); return 0; }
}
function scheduleSpeakingRetention() {
  setTimeout(purgeOldRecordings, 5 * 60 * 1000).unref?.();
  setInterval(purgeOldRecordings, 24 * 60 * 60 * 1000).unref?.();
}
module.exports = { purgeOldRecordings, scheduleSpeakingRetention };
