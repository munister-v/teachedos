const pool    = require('../db/pool');
const { webpush, pushConfigured } = require('../lib/pushConfig');

async function sendDeadlineReminders() {
  if (!pushConfigured) return;
  try {
    // Find all boards with saved JSON state and scan for assignment cards with deadlines in ~24h.
    // Older code called this payload "state"; the current schema stores it in boards.data.
    /* Раньше отсюда вычитывались ВСЕ доски целиком - каждый час, с распаковкой
       jsonb из TOAST, ради горстки карточек с дедлайном. При тысяче досок это
       сотни мегабайт чтения в час на задаче, которая почти всегда не находит
       ничего. Отбор карточек с дедлайном делает Postgres по jsonb-условию, и
       наружу едут только доски, где такие карточки действительно есть. */
    /* Раньше отсюда вычитывались ВСЕ доски целиком - каждый час, с распаковкой
       jsonb из TOAST, ради горстки карточек с дедлайном. При тысяче досок это
       сотни мегабайт чтения в час на задаче, которая почти всегда не находит
       ничего. Ближайший срок доски теперь проставляет триггер при сохранении,
       и час без дедлайнов не читает ни одной строки. */
    const { rows: boards } = await pool.query(
      `SELECT id, data AS state FROM boards
        WHERE next_deadline >= NOW() + INTERVAL '24 hours'
          AND next_deadline <  NOW() + INTERVAL '25 hours'`
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
