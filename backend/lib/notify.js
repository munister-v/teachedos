'use strict';
/* Push to one person's devices, without flooding them.

   Notification strategy (10.10.2026): a student who gets ten pushes a day
   turns them all off, and then the one that matters ("lesson in an hour")
   never arrives. So:
     - push goes to students only for things they act on (new homework,
       checked work, lesson in an hour, no lessons left); the teacher's side
       stays in the bell;
     - one push per person per topic (tag) per QUIET_MS - assigning homework
       to a class, or three checks in a row, makes one buzz, not three;
     - a subscription the browser has dropped (404/410) is removed.
   The bell entry (createNotification) is written regardless; push is extra. */
const pool = require('../db/pool');
const { webpush, pushConfigured } = require('./pushConfig');

const QUIET_MS = 2 * 60 * 1000;
const lastSent = new Map();   // `${userId}:${tag}` -> ms

async function pushToUser(userId, { title, body = '', url = '/', tag = 'teached' } = {}, { onlyRole = null } = {}) {
  if (!pushConfigured || !userId || !title) return 0;
  const key = `${userId}:${tag}`;
  const now = Date.now();
  if (now - (lastSent.get(key) || 0) < QUIET_MS) return 0;
  try {
    if (onlyRole) {
      const { rows } = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
      if (!rows[0] || rows[0].role !== onlyRole) return 0;
    }
    const { rows: subs } = await pool.query('SELECT id, subscription FROM push_subscriptions WHERE user_id = $1', [userId]);
    if (!subs.length) return 0;
    lastSent.set(key, now);
    if (lastSent.size > 5000) for (const [k, t] of lastSent) if (now - t > QUIET_MS) lastSent.delete(k);
    const payload = JSON.stringify({ title: String(title).slice(0, 120), body: String(body).slice(0, 240), url, tag });
    const res = await Promise.allSettled(subs.map(s => webpush.sendNotification(s.subscription, payload).catch(err => {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) return pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
      throw err;
    })));
    return res.filter(r => r.status === 'fulfilled').length;
  } catch (err) {
    console.warn('[notify] push failed:', err.message);
    return 0;
  }
}

module.exports = { pushToUser };
