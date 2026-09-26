// The Vault reminder: once a day, at the student's chosen local hour, when
// saved words are due - a bell notification, a push (if they subscribed) and
// an email (if they want it). Runs every 15 minutes; `vault_reminded_on`
// (the student's local date) makes it at most one reminder a day.
const crypto = require('crypto');
const pool = require('../db/pool');
const { webpush, pushConfigured } = require('../lib/pushConfig');
const { createNotification } = require('../routes/notifications');
const { sendEmailQuietly, emailConfigured, vaultReminderEmail, SITE } = require('../lib/email');

function unsubscribeToken(userId) {
  return crypto.createHmac('sha256', String(process.env.JWT_SECRET || 'teached')).update(`${userId}:vault`).digest('hex').slice(0, 32);
}
function unsubscribeLink(userId) {
  return `${SITE}/api/vault/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
}

async function sendVaultReminders() {
  try {
    // Who: has due words, is at their reminder hour, not reminded today,
    // and was active in the last 60 days (no mail to long-gone accounts).
    const { rows: users } = await pool.query(`
      WITH tz AS (
        SELECT u.id, u.name, u.email, u.vault_remind_push, u.vault_remind_email,
               (NOW() AT TIME ZONE u.timezone) AS local_now
          FROM users u
         WHERE u.timezone IN (SELECT name FROM pg_timezone_names)
           AND (u.vault_remind_push OR u.vault_remind_email)
           AND COALESCE(u.last_login_at, u.created_at) > NOW() - INTERVAL '60 days'
      )
      SELECT tz.*, d.due
        FROM tz
        JOIN LATERAL (SELECT COUNT(*)::int AS due FROM vocabulary v
                       WHERE v.user_id = tz.id AND v.kind = 'word' AND v.due_at <= NOW()) d ON d.due > 0
        JOIN users u ON u.id = tz.id
       WHERE EXTRACT(HOUR FROM tz.local_now) = u.vault_remind_hour
         AND (u.vault_reminded_on IS NULL OR u.vault_reminded_on < tz.local_now::date)
       LIMIT 500`);

    for (const u of users) {
      // Claim the day first, so a second process or a slow send never doubles it.
      const claim = await pool.query(
        `UPDATE users SET vault_reminded_on = (NOW() AT TIME ZONE timezone)::date
          WHERE id = $1 AND (vault_reminded_on IS NULL OR vault_reminded_on < (NOW() AT TIME ZONE timezone)::date)
          RETURNING id`, [u.id]);
      if (!claim.rows[0]) continue;

      const { rows: words } = await pool.query(
        `SELECT word, translation FROM vocabulary
          WHERE user_id = $1 AND kind = 'word' AND due_at <= NOW()
          ORDER BY lapses DESC, due_at ASC LIMIT 3`, [u.id]);
      const title = `🔁 ${u.due} word${u.due === 1 ? '' : 's'} to review`;
      const body = words.map(w => w.word).join(' · ');

      createNotification(u.id, 'vault', title, body, 'student.html#vault');

      if (u.vault_remind_push && pushConfigured) {
        const { rows: subs } = await pool.query('SELECT id, subscription FROM push_subscriptions WHERE user_id = $1', [u.id]);
        const payload = JSON.stringify({ title, body: `${body} - two minutes is enough.`, url: '/student.html#vault' });
        await Promise.allSettled(subs.map(s => webpush.sendNotification(s.subscription, payload).catch(err => {
          // A subscription the browser has dropped will never work again.
          if (err && (err.statusCode === 404 || err.statusCode === 410)) return pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
        })));
      }

      if (u.vault_remind_email && u.email && emailConfigured()) {
        const msg = vaultReminderEmail({ name: u.name, due: u.due, words, unsubscribe: unsubscribeLink(u.id) });
        sendEmailQuietly({ to: u.email, ...msg }, 'vault-reminder');
      }
    }
    if (users.length) console.log(`[vaultReminders] reminded ${users.length} student(s)`);
  } catch (err) {
    console.error('[vaultReminders]', err.message);
  }
}

function scheduleVaultReminders() {
  setTimeout(sendVaultReminders, 60 * 1000);
  setInterval(sendVaultReminders, 15 * 60 * 1000);
}

module.exports = { scheduleVaultReminders, sendVaultReminders, unsubscribeToken };
