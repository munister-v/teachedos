// The one-minute Daily Sprint: which ten words go in. Pure, so the mix is
// testable without a database (routes/vault.js feeds it the student's words).
//
//   5 - due by the forgetting curve: reviewed before and due_at <= now,
//       the ones forgotten most often first;
//   3 - fresh from the last lesson: LESSON_BOARD words of the last 72 hours;
//   2 - new from homework and the phrase of the day: never reviewed (TO_LEARN).
//
// A bucket that is short is topped up from the rest - other due words, then
// words never reviewed, then whatever comes due soonest - so a student with
// few words still gets a full sprint.

const SIZE = 10;
const PLAN = [['due', 5], ['fresh', 3], ['new', 2]];
const FRESH_MS = 72 * 3600e3;

/** TO_LEARN (never reviewed), LEARNING, MASTERED - derived, not stored. */
function statusOf(w) {
  if (w.learned) return 'MASTERED';
  return w.last_reviewed_at ? 'LEARNING' : 'TO_LEARN';
}

function pickSprint(words, now = Date.now(), size = SIZE) {
  const t = v => (v ? new Date(v).getTime() : 0);
  const list = (Array.isArray(words) ? words : []).filter(w => w && w.id && w.word);
  const isDue = w => !!w.last_reviewed_at && t(w.due_at) <= now;
  const by = {
    due: list.filter(isDue).sort((a, b) => (Number(b.lapses) || 0) - (Number(a.lapses) || 0) || t(a.due_at) - t(b.due_at)),
    fresh: list.filter(w => w.source_type === 'LESSON_BOARD' && now - t(w.created_at) <= FRESH_MS).sort((a, b) => t(b.created_at) - t(a.created_at)),
    new: list.filter(w => !w.last_reviewed_at && !w.learned && (w.source_type === 'HOMEWORK' || w.source_type === 'PHRASE_OF_THE_DAY')).sort((a, b) => t(b.created_at) - t(a.created_at)),
  };
  const taken = new Map();
  const take = (arr, n, bucket) => {
    for (const w of arr) {
      if (n <= 0 || taken.size >= size) break;
      if (taken.has(w.id)) continue;
      taken.set(w.id, { ...w, bucket, status: statusOf(w) });
      n--;
    }
  };
  for (const [k, n] of PLAN) take(by[k], n, k);
  if (taken.size < size) {
    const rest = [
      ...by.due,
      ...list.filter(w => !w.last_reviewed_at).sort((a, b) => t(b.created_at) - t(a.created_at)),
      ...list.slice().sort((a, b) => t(a.due_at) - t(b.due_at)),
    ];
    take(rest, size - taken.size, 'extra');
  }
  return [...taken.values()];
}

module.exports = { pickSprint, statusOf, SIZE };
