// The weekly Creator Digest: one in-app notification a week to authors whose
// resources had activity (an email only if they opted in). Runs hourly, acts on
// Monday from 07:00 UTC, and `community_notices` makes it once per ISO week.
const pool = require('../db/pool');
const { buildDigest } = require('../lib/communityDigest');
const { tell, prefsOf } = require('../lib/communityNotify');

const isoWeek = d => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  return `${y}-W${String(Math.ceil((((t - Date.UTC(y, 0, 1)) / 86400000) + 1) / 7)).padStart(2, '0')}`;
};

async function sendDigests(now = new Date()) {
  if (now.getUTCDay() !== 1 || now.getUTCHours() < 7) return 0;
  const week = isoWeek(now);
  let sent = 0;
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT a.user_id FROM assignments a WHERE a.visibility = 'community' AND (
          EXISTS (SELECT 1 FROM library_copies c WHERE c.assignment_id = a.id AND c.created_at > NOW() - INTERVAL '7 days') OR
          EXISTS (SELECT 1 FROM library_saves s WHERE s.assignment_id = a.id AND s.created_at > NOW() - INTERVAL '7 days') OR
          EXISTS (SELECT 1 FROM library_likes l WHERE l.assignment_id = a.id AND l.created_at > NOW() - INTERVAL '7 days') OR
          EXISTS (SELECT 1 FROM verified_uses v WHERE v.assignment_id = a.id AND v.created_at > NOW() - INTERVAL '7 days') OR
          EXISTS (SELECT 1 FROM assignments r WHERE r.remix_of = a.id AND r.first_public_at > NOW() - INTERVAL '7 days'))
       LIMIT 2000`);
    for (const { user_id } of rows) {
      const prefs = await prefsOf(user_id);
      if (prefs.digest === 'off') continue;
      const d = await buildDigest(user_id, 7);
      if (!d) continue;                                          // nothing happened: nothing is said
      const change = d.change === null ? '' : d.change === 0 ? ' About the same as last week.' : ` ${d.change > 0 ? 'Up' : 'Down'} ${Math.abs(d.change)}% from last week.`;
      const top = d.top ? ` Top resource: "${String(d.top.title).slice(0, 60)}".` : '';
      const ok = await tell(user_id, {
        type: 'community_digest', once: { kind: 'digest', key: week }, email: 'digest',
        title: 'Your week in Community', body: `${d.line}${top}${change}`, link: 'community.html?digest=1#publications',
        mail: { subject: 'Your week in Community', paragraphs: [d.line + top + change], button: { href: 'community.html?digest=1#publications', label: 'View publications' },
          footnote: 'You can switch this off in Community → My publications → Notifications.' },
      });
      if (ok) sent++;
    }
  } catch (err) { console.error('[community-digest]', err.message); }
  return sent;
}

function scheduleCommunityDigest() {
  const run = () => sendDigests().catch(() => {});
  setTimeout(run, 60 * 1000).unref?.();
  setInterval(run, 60 * 60 * 1000).unref?.();
}

module.exports = { scheduleCommunityDigest, sendDigests, isoWeek };
