/* The student cabinet's door to the hub: where the climb stands (level, XP) and what is waiting today,
   each thing one tap from its hub screen. Reads the same endpoints the hub does, so the numbers agree. */
(function () {
  'use strict';
  const api = () => window.apiFetch;
  const json = p => api()(p).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = n => Number(n).toLocaleString('en-US');
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  const CSS = '.hubstrip{margin:0 0 18px;padding:18px 20px;border-radius:20px;background:#1E2231;color:#F4F3EC;font-family:inherit}' +
    '.hubstrip .hs-top{display:flex;align-items:center;gap:16px;flex-wrap:wrap}' +
    '.hubstrip .hs-lv{font-size:11px;font-weight:800;letter-spacing:.14em;color:#D3F26A}' +
    '.hubstrip .hs-xp{font-size:26px;font-weight:800;letter-spacing:-.02em;margin-top:2px}.hubstrip .hs-xp small{font-size:13px;font-weight:700;opacity:.6;margin-left:6px}' +
    '.hubstrip .hs-bar{flex:1;min-width:160px;height:10px;border-radius:99px;background:rgba(244,243,236,.14);overflow:hidden}.hubstrip .hs-bar i{display:block;height:100%;background:#D3F26A;border-radius:99px}' +
    '.hubstrip .hs-go{margin-left:auto;background:#D3F26A;color:#1E2231;font-weight:800;font-size:14px;padding:11px 20px;border-radius:99px;text-decoration:none;white-space:nowrap}' +
    '.hubstrip .hs-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}' +
    '.hubstrip .hs-links a{display:flex;flex-direction:column;gap:2px;min-width:132px;padding:10px 14px;border-radius:14px;background:rgba(244,243,236,.08);color:#F4F3EC;text-decoration:none;font-weight:800;font-size:14px}' +
    '.hubstrip .hs-links a span{font-size:12px;font-weight:600;opacity:.62}.hubstrip .hs-links a.hot{background:#F6D8D8;color:#1E2231}.hubstrip .hs-links a.hot span{opacity:.7}' +
    '@media (max-width:600px){.hubstrip .hs-go{margin-left:0;width:100%;text-align:center}.hubstrip .hs-links a{flex:1 1 44%}}';

  function paint(x, t, f) {
    const host = document.querySelector('#main-content .welcome');
    if (!host || !x) return;
    if (!document.getElementById('hubstrip-css')) { const st = document.createElement('style'); st.id = 'hubstrip-css'; st.textContent = CSS; document.head.appendChild(st); }
    let box = document.getElementById('hubstrip');
    if (!box) { box = document.createElement('section'); box.id = 'hubstrip'; box.className = 'hubstrip'; box.setAttribute('aria-label', 'Your hub'); host.after(box); }
    const L = x.level, plan = (t && t.plan) || [];
    const words = plan.find(r => r.kind === 'words'), hot = plan.find(r => r.kind === 'duel' || r.kind === 'challenge' || (r.kind === 'lucky' && r.state === 'sealed'));
    const unseen = f && f.items ? f.items.filter(m => !m.finished).length : 0;
    const link = (href, title, sub, cls) => '<a href="student-hub.html#' + href + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(title) + '<span>' + esc(sub) + '</span></a>';
    box.innerHTML = '<div class="hs-top"><div><div class="hs-lv">' + esc(L.from) + ' → ' + esc(L.to) + ' · ' + L.pct + '%</div><div class="hs-xp">' + num(x.total) + '<small>XP · +' + num(x.today) + ' today</small></div></div>' +
      '<div class="hs-bar" role="progressbar" aria-valuenow="' + L.pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + L.pct + '%"></i></div>' +
      '<a class="hs-go" href="student-hub.html#today">Open my hub</a></div>' +
      '<div class="hs-links">' +
      link('today', plan.length ? plural(plan.length, 'task') + ' today' : 'Nothing due', t && t.minutes ? '≈' + t.minutes + ' min · your plan' : 'a quiet day') +
      link('wordbank', words ? words.title : 'Word Bank', words ? words.meta.replace(/^Word Bank · /, '') : 'all caught up') +
      link('challenges', hot ? hot.title : 'Challenges', hot ? hot.meta : 'duels and the daily mission', hot ? 'hot' : '') +
      link('watch', unseen ? plural(unseen, 'new piece') : 'Watch & Read', unseen ? 'picked by your teacher' : 'nothing new yet') +
      link('progress', 'Progress', x.level.to_next_camp + ' XP to ' + (x.level.next_camp && x.level.next_camp.name || 'the summit')) + '</div>';
  }

  function start() {
    if (!api() || !localStorage.getItem('teachedos_token')) return;
    Promise.all([json('/api/student/xp'), json('/api/student/today'), json('/api/hub/feed')]).then(([x, t, f]) => paint(x, t, f));
  }
  // the cabinet reveals its content once the user is known; wait for it
  let tries = 0;
  const iv = setInterval(() => {
    const mc = document.getElementById('main-content');
    if ((mc && mc.style.display !== 'none' && window.apiFetch) || ++tries > 40) { clearInterval(iv); if (mc && mc.style.display !== 'none') start(); }
  }, 300);
})();
