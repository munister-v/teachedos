/* The Word Bank as the Departures board. One flight = one repetition.

   stage     new       never reviewed
             learning  one or two repetitions behind it
             review    three or more, not yet landed
             mastered  the interval reached 21 days ("arrived")
   status    BOARDING  due today (a new word within today's cap of new ones)
             DELAYED   was due yesterday
             LAST CALL was due two or more days ago - about to slip
             SCHEDULED in the future
             QUEUED    a new word beyond today's cap
   rarity    what the repetition pays: LAST CALL +8, DELAYED +5, BOARDING +3
             (+2 for a word that is new or learning), SCHEDULED +3, QUEUED +2
   The day is the student's own day (their time zone). */

const NEW_PER_DAY = 5;
const MASTERED_DAYS = 21;
const LEGS = 5;

const dayIn = (date, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(date));
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);

function stageOf(r) {
  if (r.learned || Number(r.interval_days) >= MASTERED_DAYS) return 'mastered';
  if (!(Number(r.reps) > 0) && !r.last_reviewed_at) return 'new';
  return Number(r.reps) <= 2 ? 'learning' : 'review';
}

/* status + rarity of one word on a given day; `queued` is true for a new word beyond the cap */
function flight(r, today, tz, queued = false) {
  const stage = stageOf(r);
  if (stage === 'mastered') return { stage, status: 'ARRIVED', xp: 0, overdue: 0, in_days: 0 };
  if (stage === 'new') return { stage, status: queued ? 'QUEUED' : 'BOARDING', xp: queued ? 2 : 2, overdue: 0, in_days: 0 };
  const dueDay = dayIn(r.due_at, tz);
  const diff = daysBetween(dueDay, today);              // > 0: overdue by that many days
  if (diff >= 2) return { stage, status: 'LAST CALL', xp: 8, overdue: diff, in_days: 0 };
  if (diff === 1) return { stage, status: 'DELAYED', xp: 5, overdue: 1, in_days: 0 };
  if (diff === 0) return { stage, status: 'BOARDING', xp: stage === 'review' ? 3 : 2, overdue: 0, in_days: 0 };
  return { stage, status: 'SCHEDULED', xp: 3, overdue: 0, in_days: -diff };
}

/* what a repetition of this word pays right now (the cap of new words does not matter here) */
const rarityFor = (r, tz, now = Date.now()) => flight(r, dayIn(now, tz), tz, false).xp;

const nextLabel = f => f.status === 'LAST CALL' || f.status === 'DELAYED' ? '— overdue'
  : f.status === 'BOARDING' ? 'Today' : f.status === 'QUEUED' ? 'Queued'
  : f.in_days === 1 ? 'tomorrow' : 'in ' + f.in_days + ' days';

function sourceLabel(r) {
  const t = r.source_title ? String(r.source_title).slice(0, 40) : '';
  const kind = { HOMEWORK: 'Homework', LESSON_BOARD: 'Lesson', READING: 'Read', MANUAL: 'Your notebook' }[r.source_type] || 'Your notebook';
  return t && kind !== 'Your notebook' ? kind + ' · ' + t : kind;
}

/* rows: vocabulary rows of one student (kind = 'word'); -> the whole board */
function board(rows, tz, now = Date.now()) {
  const today = dayIn(now, tz);
  const prepared = rows.map(r => ({ r, stage: stageOf(r) }));
  const fresh = prepared.filter(x => x.stage === 'new').sort((a, b) => new Date(a.r.created_at) - new Date(b.r.created_at));
  const queued = new Set(fresh.slice(NEW_PER_DAY).map(x => x.r.id));
  const words = prepared.map(({ r }) => {
    const f = flight(r, today, tz, queued.has(r.id));
    return {
      id: r.id, word: r.word, translation: r.translation || '', example: r.example || '',
      from: sourceLabel(r), stage: f.stage, status: f.status, xp: f.xp,
      legs: f.stage === 'mastered' ? LEGS : Math.min(LEGS, Math.max(Number(r.reps) || 0, f.stage === 'new' ? 0 : 1)),
      next: f.stage === 'mastered' ? 'Mastered' : nextLabel(f), overdue: f.overdue, in_days: f.in_days,
      lapses: Number(r.lapses) || 0, due_at: r.due_at,
    };
  });
  const rank = w => ({ 'LAST CALL': 0, DELAYED: 1, BOARDING: 2 }[w.status]);
  const queue = words.filter(w => rank(w) !== undefined).sort((a, b) => rank(a) - rank(b) || (a.stage === 'new') - (b.stage === 'new') || b.lapses - a.lapses || b.overdue - a.overdue);
  const air = words.filter(w => w.status === 'SCHEDULED').sort((a, b) => a.in_days - b.in_days);
  const waiting = words.filter(w => w.status === 'QUEUED');
  const arrived = words.filter(w => w.stage === 'mastered');
  const nextRecheck = arrived.map(w => daysBetween(today, dayIn(w.due_at, tz))).filter(n => n > 0).sort((a, b) => a - b)[0] || null;
  return {
    today, total: words.length, queue, air, queued: waiting.length, arrived, next_recheck_days: nextRecheck,
    tomorrow: air.filter(w => w.in_days === 1).length + waiting.length,
    flights_today: queue.length,
  };
}

module.exports = { board, flight, stageOf, rarityFor, NEW_PER_DAY, LEGS };
