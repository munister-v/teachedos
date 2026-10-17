/* Design spec v1 (16.10.2026), the bits CSS cannot do alone.
 * №7 Topbar: the "Ask TeachEd…" pill with turquoise sparkles and ⌘K, before
 * the bell. On the desktop it opens Spotlight; on the tool pages it goes to
 * the desktop and opens it there (index.html#ask), and ⌘K does the same. */
(function () {
  const SPARK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4l1.7 4.8 4.8 1.7-4.8 1.7L11 17l-1.7-4.8L4.5 10.5l4.8-1.7z"/><path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>';
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const onDesktop = () => typeof window.openSpotlight === 'function' && !!document.getElementById('spotlight-overlay');
  function ask() {
    if (onDesktop()) window.openSpotlight();
    else location.href = 'index.html#ask';
  }
  function pill() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ds-ask';
    b.setAttribute('aria-label', 'Ask TeachEd');
    b.innerHTML = `${SPARK}<span>Ask TeachEd…</span><kbd>${mac ? '⌘K' : 'Ctrl K'}</kbd>`;
    b.addEventListener('click', ask);
    return b;
  }
  /* BUG-05 (17.10.2026): there is no assistant for a student - the pill sent
     them to the teacher's desktop and straight back. No entry point at all. */
  const isStudent = () => {
    try { return localStorage.getItem('teachedos_role') === 'student' || document.body.classList.contains('role-student'); } catch (_) { return false; }
  };
  function mount() {
    if (isStudent()) { document.querySelectorAll('.ds-ask').forEach(p => p.remove()); return; }
    const mb = document.getElementById('menubar');
    if (mb && !mb.querySelector('.ds-ask')) {
      const bell = document.getElementById('mb-notif-btn');
      const right = mb.querySelector('.mb-right');
      if (bell && bell.parentNode) bell.parentNode.insertBefore(pill(), bell);
      else if (right) right.prepend(pill());
    }
    const nav = document.getElementById('nav');
    if (nav && !nav.querySelector('.ds-ask')) {
      const anchor = nav.querySelector('.nb-bell') || nav.querySelector('.nav-user');
      if (anchor) anchor.parentNode.insertBefore(pill(), anchor);
    }
  }
  // the bell on the tool pages arrives a little later and goes before the user chip
  const keep = () => {
    const nav = document.getElementById('nav'); if (!nav) return;
    const p = nav.querySelector('.ds-ask'), bell = nav.querySelector('.nb-bell');
    if (p && bell && p.nextElementSibling !== bell) bell.parentNode.insertBefore(p, bell);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  setTimeout(() => { mount(); keep(); }, 1200);
  setTimeout(keep, 3000);
  if (!onDesktop()) {
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && document.getElementById('nav') && !isStudent()) { e.preventDefault(); ask(); }
    });
  } else if (location.hash === '#ask') {
    setTimeout(() => { try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {} window.openSpotlight(); }, 400);
  }
})();

/* №10 Community: one search and one "Filters" button with a count; the
 * dropdowns open under it; every chosen filter is a dark tag with ×. */
(function () {
  const bar = document.getElementById('cm-toolbar');
  if (!bar || bar.dataset.dsFilters) return;
  bar.dataset.dsFilters = '1';
  const filters = bar.querySelector('.cm-filters');
  const search = bar.querySelector('.cm-search');
  if (!filters || !search) return;
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6.2 7.6V19l-3.6-1.8v-4.6z"/></svg>';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ds-filters-btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `${ICON}<span>Filters</span><b class="ds-fcount" hidden></b>`;
  search.after(btn);
  filters.classList.add('ds-fpanel');
  filters.hidden = true;
  const tags = document.createElement('div');
  tags.className = 'ds-ftags';
  bar.after(tags);
  btn.addEventListener('click', () => {
    filters.hidden = !filters.hidden;
    btn.setAttribute('aria-expanded', String(!filters.hidden));
  });
  const NAMES = { 'board-language': 'Language', 'board-level': 'Level', 'board-age': 'Age', 'board-skill': 'Skill' };
  function paint() {
    const set = Object.keys(NAMES).map(id => document.getElementById(id)).filter(sel => sel && sel.value);
    const n = btn.querySelector('.ds-fcount');
    n.hidden = !set.length; n.textContent = set.length;
    tags.innerHTML = set.map(sel => `<span class="ds-ftag">${NAMES[sel.id]} · ${sel.options[sel.selectedIndex].text}<button type="button" data-clear="${sel.id}" aria-label="Remove ${NAMES[sel.id]} filter">×</button></span>`).join('');
  }
  tags.addEventListener('click', e => {
    const b = e.target.closest('[data-clear]');
    if (!b) return;
    const sel = document.getElementById(b.dataset.clear);
    if (sel) { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    paint();
  });
  bar.addEventListener('change', paint);
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#board-clear')) setTimeout(paint, 0); });
  paint();
})();
