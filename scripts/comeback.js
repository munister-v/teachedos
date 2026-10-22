/* The welcome-back on Today (ТЗ «Удержание» §4): after three days or more, Tich says everything is where it was
   left, shows only what was kept, and offers a first task of about five minutes. No "you lost" anywhere.
   window.Comeback.render(el, cb) - cb is the server's `comeback` (null when the student is not returning). */
(function () {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const key = () => 'cbSeen:' + new Date().toISOString().slice(0, 10);
  const seen = () => { try { return localStorage.getItem(key()) === '1'; } catch (_) { return false; } };

  function render(el, cb) {
    if (!el) return false;
    if (!cb || seen()) { el.style.display = 'none'; el.innerHTML = ''; return false; }
    const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
    const facts = [];
    if (cb.words) facts.push(plural(cb.words, 'word') + ' kept safe in your Word Bank');
    facts.push(cb.streak_alive
      ? 'Your streak is still alive - ' + (cb.covered === 1 ? 'a freeze covered one of the days' : 'freezes covered ' + cb.covered + ' of the days') + ' you were away'
      : 'Your streak starts again with today - the days you did stay on your calendar');
    if (cb.news) facts.push(cb.news.replace(/^While you were away:\s*/, 'While you were away: '));
    el.style.display = '';
    el.innerHTML = '<div class="cb-card"><img class="cb-ava" src="img/tich/tich-joy.webp" alt="">' +
      '<div class="cb-body"><div class="cb-kick">TICH · WELCOME BACK</div><h3>Good to see you.</h3>' +
      '<p>It has been ' + plural(cb.days, 'day') + ' - everything is right where you left it.</p>' +
      '<ul class="cb-facts">' + facts.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul></div>' +
      '<div class="cb-act"><button type="button" class="cb-go">Start with ' + (cb.first_task_min || 5) + ' minutes</button><button type="button" class="cb-no">Got it</button></div></div>';
    el.querySelector('.cb-go').onclick = () => {
      const b = document.querySelector('#pg-today .plan .planrow button:not([disabled])');
      if (b) { b.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => b.click(), 350); }
    };
    el.querySelector('.cb-no').onclick = () => { try { localStorage.setItem(key(), '1'); } catch (_) {} el.style.display = 'none'; };
    return true;
  }
  window.Comeback = { render };
})();
