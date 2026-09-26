// Spaced repetition for the student's Vault (SM-2, simplified to four
// buttons). Pure functions so the schedule is testable without a database.
//
//   again - forgot: back in 10 minutes, ease drops, counts as a lapse
//   hard  - remembered with effort: a little longer than last time
//   good  - the normal step: 1 day, 3 days, then interval × ease
//   easy  - too easy: a bigger jump, ease grows
//
// A word whose interval reaches 21 days counts as mastered.

const DAY = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
const MASTERED_DAYS = 21;

function schedule(card, grade, now = Date.now()) {
  const reps = Math.max(0, Number(card.reps) || 0);
  let ease = Number(card.ease) || 2.5;
  let interval = Math.max(0, Number(card.interval_days) || 0);
  let lapses = Math.max(0, Number(card.lapses) || 0);
  let nextReps = reps + 1;
  let dueMs;

  if (grade === 'again') {
    ease = Math.max(MIN_EASE, ease - 0.2);
    lapses += 1;
    nextReps = 0;
    interval = 0;
    dueMs = now + 10 * 60 * 1000;
  } else {
    if (grade === 'hard') {
      ease = Math.max(MIN_EASE, ease - 0.15);
      interval = reps === 0 ? 1 : Math.max(1, interval * 1.2);
    } else if (grade === 'easy') {
      interval = reps === 0 ? 3 : Math.max(interval + 1, interval * ease * 1.3);
      ease += 0.15;
    } else { // good
      interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, interval * ease);
    }
    interval = Math.min(365, Math.round(interval * 10) / 10);
    dueMs = now + interval * DAY;
  }
  return {
    reps: nextReps,
    ease: Math.round(ease * 100) / 100,
    interval_days: interval,
    lapses,
    due_at: new Date(dueMs).toISOString(),
    learned: interval >= MASTERED_DAYS,
  };
}

/** Human label for the button: what happens if you press it. */
function preview(card, now = Date.now()) {
  const out = {};
  for (const g of ['again', 'hard', 'good', 'easy']) {
    const s = schedule(card, g, now);
    const ms = Date.parse(s.due_at) - now;
    out[g] = ms < 60 * 60 * 1000 ? `${Math.round(ms / 60000)} min` : ms < DAY ? `${Math.round(ms / 3600000)} h` : `${Math.round(ms / DAY)} d`;
  }
  return out;
}

module.exports = { schedule, preview, MASTERED_DAYS };
