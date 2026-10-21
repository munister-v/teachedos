/* The streak, with its freeze: one missed day is forgiven once a month, so a
   single slip does not wipe out weeks. The freeze is not stored - it is read
   from the days themselves: a day with nothing, between a day with something and
   the run behind it, is bridged if that calendar month has not used its freeze.
   A frozen day keeps the run alive but does not add to it. Today never counts as
   a miss: the day is not over, the run lives on yesterday. */

const prevDay = d => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };

/* active: Set of 'YYYY-MM-DD' days with something done; today: 'YYYY-MM-DD'.
   -> { streak, frozen: [days bridged], freeze_left: 0|1 (this month) } */
function computeStreak(active, today, freezesPerMonth = 1) {
  const used = new Map();                 // 'YYYY-MM' -> freezes spent
  const frozen = [];
  let streak = 0;
  let d = active.has(today) ? today : prevDay(today);
  for (let guard = 0; guard < 800; guard++) {
    if (active.has(d)) { streak++; d = prevDay(d); continue; }
    // a gap: bridge it only when there is a run behind it and this month still has its freeze
    const behind = prevDay(d);
    const m = d.slice(0, 7);
    if (streak > 0 && active.has(behind) && (used.get(m) || 0) < freezesPerMonth) {
      used.set(m, (used.get(m) || 0) + 1);
      frozen.push(d);
      d = behind;
      continue;
    }
    break;
  }
  const thisMonth = today.slice(0, 7);
  return { streak, frozen, freeze_left: Math.max(0, freezesPerMonth - (used.get(thisMonth) || 0)) };
}

module.exports = { computeStreak };
