/* The island's numbers (TZ §3 teacher side, §4 growth circle).

   classActivity: for a teacher, what the class does by itself - who keeps a streak, who is duelling,
   who shared a set. Nothing to launch by hand; this is only to look at.

   growth: what the island brings the platform - invitations sent and accepted, friends who joined
   through a student's link, teachers who appeared next to such a student, and the share of students
   who come to the hub on days without a lesson (the island's main number). */

const sd = require('./streakDays');
const friends = require('./friends');

const firstName = n => String(n || 'Student').trim().split(/[\s@]/)[0] || 'Student';

async function classActivity(db, teacherId) {
  const { rows: students } = await db.query(
    `SELECT DISTINCT u.id, u.name, u.timezone FROM student_journal j JOIN users u ON u.id = j.student_id WHERE j.teacher_id = $1 AND j.student_id IS NOT NULL`, [teacherId]);
  const ids = students.map(s => s.id);
  if (!ids.length) return { students: [], summary: { in_streak: 0, duelling: 0, shared: 0 } };
  const [{ rows: duels }, { rows: shares }, { rows: fr }] = await Promise.all([
    db.query(`SELECT challenger_id AS a, opponent_id AS b FROM duels WHERE created_at > NOW() - INTERVAL '7 days' AND (challenger_id = ANY($1::uuid[]) OR opponent_id = ANY($1::uuid[]))`, [ids]),
    db.query(`SELECT owner_id, COUNT(*)::int AS n FROM hub_shares WHERE created_at > NOW() - INTERVAL '14 days' AND owner_id = ANY($1::uuid[]) GROUP BY owner_id`, [ids]),
    db.query(`SELECT a_id, b_id FROM friendships WHERE a_id = ANY($1::uuid[]) OR b_id = ANY($1::uuid[])`, [ids]),
  ]);
  const duelCount = new Map(), shareCount = new Map(shares.map(r => [String(r.owner_id), r.n])), friendCount = new Map();
  duels.forEach(d => [d.a, d.b].forEach(x => duelCount.set(String(x), (duelCount.get(String(x)) || 0) + 1)));
  fr.forEach(f => [f.a_id, f.b_id].forEach(x => friendCount.set(String(x), (friendCount.get(String(x)) || 0) + 1)));
  const rows = [];
  for (const s of students) {
    const st = await sd.streakOf(db, s);
    rows.push({ id: s.id, name: firstName(s.name), streak: st.streak, active_today: st.days.has(st.today),
      duels_7d: duelCount.get(String(s.id)) || 0, sets_shared: shareCount.get(String(s.id)) || 0, friends: friendCount.get(String(s.id)) || 0 });
  }
  rows.sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name));
  return { students: rows, summary: {
    in_streak: rows.filter(r => r.streak >= 2).length, duelling: rows.filter(r => r.duels_7d).length, shared: rows.filter(r => r.sets_shared).length } };
}

async function growth(db, days = 30) {
  const d = Math.max(1, Math.min(365, parseInt(days, 10) || 30));
  const one = async (q, p = [d]) => (await db.query(q, p)).rows[0] || {};
  const sent = await one(`SELECT COUNT(*)::int AS invites, COALESCE(SUM(uses),0)::int AS uses FROM friend_invites`, []);
  const accepted = await one(`SELECT COUNT(*)::int AS n FROM friendships WHERE created_at > NOW() - ($1 || ' days')::interval`);
  // an account that signed up through the link: created within an hour before it accepted the invitation
  const joined = await one(`SELECT COUNT(DISTINCT u.id)::int AS n FROM friendships f
      JOIN friend_invites i ON i.code = f.via_code
      JOIN users u ON u.id = CASE WHEN f.a_id = i.inviter_id THEN f.b_id ELSE f.a_id END
     WHERE f.created_at > NOW() - ($1 || ' days')::interval AND u.created_at >= f.created_at - INTERVAL '1 hour'`);
  const teachers = await one(`SELECT COUNT(DISTINCT j.teacher_id)::int AS n FROM friendships f
      JOIN friend_invites i ON i.code = f.via_code
      JOIN users u ON u.id = CASE WHEN f.a_id = i.inviter_id THEN f.b_id ELSE f.a_id END
      JOIN student_journal j ON j.student_id = u.id AND j.created_at >= u.created_at
     WHERE u.created_at >= f.created_at - INTERVAL '1 hour' AND f.created_at > NOW() - ($1 || ' days')::interval`);
  const shares = await one(`SELECT COUNT(*)::int AS n FROM hub_shares WHERE created_at > NOW() - ($1 || ' days')::interval`);
  // students who did something in the hub on a day with no lesson, in the last 7 days
  const off = await one(`
    WITH act AS (
      SELECT user_id, (created_at AT TIME ZONE 'UTC')::date AS day,
             BOOL_OR(kind = 'lesson') AS lesson
        FROM xp_events WHERE created_at > NOW() - INTERVAL '7 days' AND kind <> 'backfill' GROUP BY 1, 2),
    students AS (SELECT DISTINCT user_id FROM act JOIN users u ON u.id = act.user_id AND u.role = 'student')
    SELECT (SELECT COUNT(*) FROM students)::int AS students,
           (SELECT COUNT(DISTINCT user_id) FROM act WHERE NOT lesson AND user_id IN (SELECT user_id FROM students))::int AS off_lesson`, []);
  return {
    window_days: d,
    invitations: { links: sent.invites, uses_total: sent.uses, accepted_in_window: accepted.n, new_accounts_via_link: joined.n },
    teachers_met_via_students: teachers.n,
    shares_created: shares.n,
    off_lesson: { students_active_7d: off.students, came_without_a_lesson: off.off_lesson, share: off.students ? Math.round(off.off_lesson / off.students * 100) : 0 },
  };
}

module.exports = { classActivity, growth, firstName };
