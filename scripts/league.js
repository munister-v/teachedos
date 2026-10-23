/* The league and the personal weekly goals in the hub (ТЗ «Удержание» §4). Until the launch gate the student has a
   goal of their own, set from their own last weeks. Once the league is open, a cohort of about thirty students at their
   level: nicknames only, the week's XP, their own place - no names, no photos, no table of the platform. Leaving is
   one tap. window.League.mount(el). */
(function () {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const token = () => { try { return localStorage.getItem('teachedos_token'); } catch (_) { return null; } };
  let api = null;
  const call = (path, opts) => {
    if (!api) api = window.TeachEdApp.createApiClient(() => token());
    return api('/api/league' + path, opts).then(r => r.json().catch(() => ({})).then(d => ({ ok: r.ok, status: r.status, d })));
  };
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const dayName = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const left = n => n === 0 ? 'ends today' : 'ends in ' + plural(n, 'day');

  /* the personal goal: the week so far, and the last four weeks as a calm picture - a pause is a short bar, never a red one */
  function goalHtml(g) {
    const max = Math.max(g.goal, ...g.history.map(h => h.xp), 1);
    const bars = g.history.map(h => '<div class="lg-bar' + (h.hit ? ' hit' : '') + '" title="' + esc(dayName(h.week)) + ': ' + h.xp + ' XP"><i style="height:' + Math.max(4, Math.round(h.xp / max * 100)) + '%"></i><span>' + esc(dayName(h.week)) + '</span></div>').join('');
    return '<div class="lg-goal"><div class="lg-big"><b>' + g.xp + '</b> / ' + g.goal + ' XP</div>' +
      '<div class="lg-track"><i style="width:' + g.pct + '%"></i></div>' +
      '<div class="lg-meta"><span>' + (g.reached ? 'Goal reached - next week’s goal moves up a little' : Math.max(0, g.goal - g.xp) + ' XP to go') + '</span><span>' + left(g.ends_in_days) + '</span></div>' +
      '<div class="lg-hist" aria-label="The last four weeks">' + bars + '</div></div>';
  }

  function lastWeekHtml(lw) {
    if (!lw) return '';
    return '<div class="lg-last">' + (lw.mark ? '<span class="lg-mark">Тиць</span> Last week you finished ' + ['', 'first', 'second', 'third'][lw.mark] + ' in your group - ' + lw.xp + ' XP.' : 'Last week: ' + lw.xp + ' XP. A new group starts every Monday.') + '</div>';
  }

  function leagueHtml(v) {
    const rows = v.members.map(m => '<div class="lg-row' + (m.me ? ' me' : '') + '"><span class="lg-rank">' + m.rank + '</span><span class="lg-nick">' + esc(m.nickname) + (m.me ? ' · you' : '') + '</span><span class="lg-xp">' + m.xp + '</span></div>').join('');
    return '<div class="lg-sub">A group of ' + v.size + ' students at level ' + esc(v.cefr) + ', formed by last week’s pace. Only nicknames - nobody sees your name. ' + left(v.ends_in_days) + '.</div>' +
      lastWeekHtml(v.last_week) + '<div class="lg-table">' + rows + '</div>';
  }

  function footHtml(v) {
    return '<div class="lg-foot"><span>You are <b>' + esc(v.nickname) + '</b> · <button type="button" class="lg-link" data-nick>New nickname</button>' + (v.marks ? ' · ' + plural(v.marks, 'Тиць-mark') : '') + '</span>' +
      (v.mode === 'league' && !v.out && v.member ? '<button type="button" class="lg-leave" data-in="0">Leave the league</button>' : '') + '</div>';
  }

  async function mount(el) {
    if (!el) return;
    const r = await call('/');
    if (!r.ok) { el.style.display = 'none'; return; }
    const v = r.d;
    let body;
    if (v.mode === 'league' && !v.out && v.member) body = '<div class="ptitle">LEAGUE · ' + esc(v.cefr) + ' · THIS WEEK</div>' + leagueHtml(v) + footHtml(v);
    else if (v.mode === 'league' && v.out) body = '<div class="ptitle">YOUR WEEK</div><div class="lg-sub">You are out of the league. Your XP and your streak are untouched. Come back whenever you like - you join the next Monday.</div>' + goalHtml(v.goals) +
      '<div class="lg-foot"><span></span><button type="button" class="lg-join" data-in="1">Join the league</button></div>';
    else if (v.mode === 'league') body = '<div class="ptitle">YOUR WEEK</div><div class="lg-sub">The league groups are formed every Monday from last week’s pace. You join next Monday - meanwhile, a goal of your own.</div>' + lastWeekHtml(v.last_week) + goalHtml(v.goals) + footHtml(v);
    else body = '<div class="ptitle">YOUR WEEK · A GOAL OF YOUR OWN</div><div class="lg-sub">A little above your own pace of the last weeks - no one to beat but last week’s you. A league opens when enough students are learning at your level.</div>' + goalHtml(v.goals) + footHtml(v);
    el.style.display = '';
    el.innerHTML = body;
    if (!el.__wired) {
      el.__wired = true;
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-in]');
        if (b) { b.disabled = true; return call('/settings', { method: 'PUT', body: JSON.stringify({ in: b.dataset.in === '1' }) }).then(() => mount(el)); }
        if (e.target.closest('[data-nick]')) call('/nickname', { method: 'POST' }).then(() => mount(el));
      });
    }
  }
  window.League = { mount };
})();
