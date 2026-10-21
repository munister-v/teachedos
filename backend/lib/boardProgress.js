/* Where a board stands: "5 of 9 steps done" without opening it.

   A lesson on a board is a path card (data._wfPath: steps, the current step,
   which steps are done). The summary adds the paths of a board together and
   names the one the work is in: the path with the most steps done, or the first
   one when nothing has been done yet. It is stored next to the board when the
   board is saved, so the boards list reads a few bytes, not the whole canvas. */

function summarize(data) {
  const cards = data && Array.isArray(data.cards) ? data.cards : [];
  let steps = 0, done = 0, paths = 0, active = null;
  for (const c of cards) {
    const p = c && c.data && c.data._wfPath;
    if (!p || !Array.isArray(p.steps) || !p.steps.length) continue;
    paths += 1;
    steps += p.steps.length;
    const d = Array.isArray(p.done) ? p.done.slice(0, p.steps.length).filter(Boolean).length : 0;
    done += d;
    if (!active || d > active.done) {
      active = {
        done: d,
        title: String(c.data.title || '').slice(0, 80),
        step: Math.min(p.steps.length, (Number(p.cur) || 0) + 1),
        of: p.steps.length,
      };
    }
  }
  if (!paths) return null;
  return { paths, steps, done, title: active.title, step: active.step, of: active.of };
}

module.exports = { summarize };
