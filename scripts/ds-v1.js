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
  function mount() {
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && document.getElementById('nav')) { e.preventDefault(); ask(); }
    });
  } else if (location.hash === '#ask') {
    setTimeout(() => { try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {} window.openSpotlight(); }, 400);
  }
})();
