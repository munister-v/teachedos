const pool    = require('../db/pool');
const webpush = require('web-push');

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || 'BDe-b9CJHHOlgRqh3KVniRiKikLAv97s5UYZYJy1Ki4a4DrUh1UACHEwEVK4iCpImJ5iBkurjIx6GqZxL_uTaKs';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'szfQ1osNlnRticn_GKsmhN0N-QYmwrKFSJXDmFH8AvY';
webpush.setVapidDetails('mailto:support@teachedos.com', VAPID_PUBLIC, VAPID_PRIVATE);

async function sendDeadlineReminders() {
  try {
    // Find all boards with state (JSONB) and scan for assignment cards with deadlines in ~24h
    const { rows: boards } = await pool.query(
      `SELECT id, state FROM boards WHERE state IS NOT NULL`
    );

    const now     = Date.now();
    const in24h   = now + 24 * 60 * 60 * 1000;
    const in25h   = now + 25 * 60 * 60 * 1000; // window to avoid repeat

    for (const board of boards) {
      let boardState;
      try { boardState = typeof board.state === 'string' ? JSON.parse(board.state) : board.state; }
      catch { continue; }

      const cards = boardState?.cards || [];
      const dueCards = cards.filter(c => {
        if (c.type !== 'assignment' || !c.data?.deadline) return false;
        const t = new Date(c.data.deadline).getTime();
        return t >= in24h && t < in25h;
      });

      if (!dueCards.length) continue;

      // Get students enrolled in this board who haven't submitted yet
      const { rows: students } = await pool.query(`
        SELECT DISTINCT ps.user_id, ps.subscription
        FROM push_subscriptions ps
        JOIN board_collaborators bc ON bc.user_id = ps.user_id
        WHERE bc.board_id = $1
      `, [board.id]);

      for (const card of dueCards) {
        const title = card.data.title || 'Assignment';
        const payload = JSON.stringify({
          title: '⏰ Deadline tomorrow!',
          body: `"${title}" is due in 24 hours. Don't forget to submit!`,
          url: `/teachedos/board.html?id=${board.id}`
        });

        await Promise.allSettled(
          students.map(s =>
            webpush.sendNotification(s.subscription, payload).catch(() => {})
          )
        );
      }
    }
  } catch (err) {
    console.error('[deadlineReminders]', err.message);
  }
}

function scheduleDeadlineReminders() {
  // Run immediately on startup, then every hour
  sendDeadlineReminders();
  setInterval(sendDeadlineReminders, 60 * 60 * 1000);
}

module.exports = { scheduleDeadlineReminders };
