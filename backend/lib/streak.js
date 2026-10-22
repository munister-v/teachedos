/* The streak, with its freezes: a missed day is closed by a freeze, automatically and without a word of
   shame - two a calendar month, not carried over, never bought or won (ТЗ «Удержание» §4). The freezes are
   not stored as a balance - they are read from the days themselves: a run of missed days between a day with
   something and the run in front of it (or today) is bridged when each of those days still has a freeze in
   its own month. A frozen day keeps the run alive but does not add to it. Today never counts as a miss: the
   day is not over, the run lives on yesterday. A run that burns (no freeze left) simply starts again with
   the next day done - nothing is taken away and the days behind it stay on the calendar. */

const FREEZES_PER_MONTH = 2;
const MAX_GAP = 4;                       // two a month can reach four across a month border, never more

const prevDay = d => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

/* active: Set of 'YYYY-MM-DD' days with something done; today: 'YYYY-MM-DD'.
   -> { streak, frozen: [days bridged], freeze_left: 0..2 (this month), per_month } */
function computeStreak(active, today, freezesPerMonth = FREEZES_PER_MONTH) {
  const used = new Map();                 // 'YYYY-MM' -> freezes spent
  const frozen = [];
  let streak = 0;
  let d = active.has(today) ? today : prevDay(today);
  for (let guard = 0; guard < 800; guard++) {
    if (active.has(d)) { streak++; d = prevDay(d); continue; }
    // a gap: walk back to the day with something done, and see whether the freezes of those months cover it
    const gap = [];
    let e = d;
    while (!active.has(e) && gap.length <= MAX_GAP) { gap.push(e); e = prevDay(e); }
    if (!active.has(e) || gap.length > MAX_GAP) break;
    const need = new Map();
    gap.forEach(g => need.set(g.slice(0, 7), (need.get(g.slice(0, 7)) || 0) + 1));
    if ([...need].some(([m, n]) => (used.get(m) || 0) + n > freezesPerMonth)) break;
    need.forEach((n, m) => used.set(m, (used.get(m) || 0) + n));
    frozen.push(...gap);
    d = e;
  }
  const thisMonth = today.slice(0, 7);
  return { streak, frozen, freeze_left: Math.max(0, freezesPerMonth - (used.get(thisMonth) || 0)), per_month: freezesPerMonth };
}

module.exports = { computeStreak, FREEZES_PER_MONTH };
