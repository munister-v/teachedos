/* What Tich knows about a student when he builds a session: level, accent, the words known but never spoken,
   the recurring mistakes, the phrases due today, the facts the student can see, the teacher's errands. */
const { bankFor } = require('./starterBank');
const hub = require('../hubcontent');

const tzOf = u => { let tz = String((u && u.timezone) || 'Europe/Kyiv'); try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch (_) { tz = 'UTC'; } return tz; };
const todayIn = tz => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

const mistakeFromRow = r => ({ id: r.id, studentId: r.user_id, source: r.source, said: r.said, better: r.better, category: r.category, construct: r.construct,
  weight: r.weight, occurrences: r.occurrences, status: r.status, selfFixedCount: r.self_fixed, cleanSessionsStreak: r.clean_streak,
  firstSeenAt: r.first_seen, lastSeenAt: r.last_seen });

async function buildContext(db, user) {
  const tz = tzOf(user), today = todayIn(tz);
  const [level, acc, mistakes, phrases, facts, tasks, words, used] = await Promise.all([
    hub.levelOf(db, user.id),
    db.query('SELECT speaking_accent FROM users WHERE id = $1', [user.id]),
    db.query(`SELECT * FROM speaking_mistakes WHERE user_id = $1 AND status <> 'fixed' ORDER BY last_seen DESC LIMIT 60`, [user.id]),
    db.query(`SELECT id, text, status, next_review FROM speaking_phrases WHERE user_id = $1 AND status = 'learning' AND next_review <= $2::date ORDER BY next_review LIMIT 3`, [user.id, today]),
    db.query('SELECT id, fact FROM speaking_facts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 12', [user.id]),
    db.query(`SELECT id, instruction, construct, status FROM speaking_tasks WHERE user_id = $1 AND status IN ('queued','inProgress') ORDER BY created_at LIMIT 5`, [user.id]),
    db.query(`SELECT word FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND created_at > NOW() - INTERVAL '60 days' ORDER BY created_at DESC LIMIT 40`, [user.id]),
    db.query(`SELECT DISTINCT lower(w) AS w FROM speaking_rounds r, unnest(r.used_words) w WHERE r.user_id = $1`, [user.id]),
  ]);
  const spoken = new Set(used.rows.map(r => r.w));
  const passive = words.rows.map(r => r.word).filter(w => w && !spoken.has(String(w).toLowerCase()) && w.length <= 30);
  // the last words the teacher sent: the "last lesson" vocabulary
  const { rows: lw } = await db.query(`SELECT word FROM vocabulary WHERE user_id = $1 AND kind = 'word' AND sent_by IS NOT NULL AND created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 6`, [user.id]);
  return {
    studentId: user.id, level, accent: (acc.rows[0] && acc.rows[0].speaking_accent) || 'en-US', tz, today,
    currentTopic: null, dueProgramChecks: [],
    recurring: mistakes.rows.map(mistakeFromRow),
    lastLessonWords: lw.map(r => r.word), passiveWords: passive,
    duePhrases: phrases.rows.map(r => ({ id: r.id, text: r.text, status: r.status, nextReviewOn: r.next_review })),
    facts: facts.rows, teacherTasks: tasks.rows.map(r => ({ id: r.id, instruction: r.instruction, construct: r.construct, status: r.status })),
    starterBank: bankFor(level),
  };
}

module.exports = { buildContext, tzOf, todayIn, mistakeFromRow };
