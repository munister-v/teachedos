/* One rule for every window that opens over a page (student cabinet bugfix,
   BUG-26, 17.10.2026): Escape closes the top one, and so does a click on the
   dimmed space around it. Many windows did this themselves; some (Review
   reminders, Add to Word Bank, How it works) did not.

   How a window is closed: its own close button if it has one (so its own
   clean-up runs), else it is hidden the way it was shown. A window that must
   not close this way carries data-no-dismiss. */
(function () {
  'use strict';
  if (window.__modalGuard) return;
  window.__modalGuard = true;

  // what counts as an open window, top-most last in this list
  const OPEN = [
    '.modal-overlay[style*="flex"]',
    '.vc-pop',
    '.te-sheet-ov',
    '.lc-ov',
    '.sw-ov.open',
    '.te-zero',
    '.so-ov',
    '.sf-pop, #sf-pop',
    '#sf-drawer.open',
    '.pf-modal.open, .modal.open, .overlay.open',
    '[role="dialog"][aria-modal="true"]',
  ];
  const CLOSE = '[data-close], .so-x, .sw-x, .lc-x, .te-sheet-x, .sf-d-x, .modal-cancel, [aria-label="Close"], .close, .x';

  function visible(el) {
    if (!el || el.hidden) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function topWindow() {
    const found = [];
    OPEN.forEach(sel => document.querySelectorAll(sel).forEach(el => {
      if (el.hasAttribute('data-no-dismiss') || el.closest('[data-no-dismiss]')) return;
      if (visible(el)) found.push(el);
    }));
    if (!found.length) return null;
    // the one painted on top: highest z-index, then the last in the document
    const z = el => { let n = el, best = 0; while (n && n !== document.body) { const v = parseInt(getComputedStyle(n).zIndex, 10); if (v > best) best = v; n = n.parentElement; } return best; };
    found.sort((a, b) => z(a) - z(b) || (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    // an overlay and the dialog inside it are one window: take the outer one
    const top = found[found.length - 1];
    return found.find(el => el !== top && el.contains(top)) || top;
  }
  function dismiss(win) {
    const btn = [...win.querySelectorAll(CLOSE)].find(visible);
    if (btn) { btn.click(); return true; }
    if (win.matches('.modal-overlay')) { win.style.display = 'none'; return true; }
    if (win.matches('.vc-pop, .sf-pop, #sf-pop')) { win.remove(); return true; }
    if (win.classList.contains('open')) { win.classList.remove('open'); return true; }
    return false;
  }

  /* First (capture), and only the top window: the window's own Escape
     handlers would otherwise close it and then the next one under it too. */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const t = e.target;
    if (t && t.isContentEditable) return;
    const win = topWindow();
    if (win && dismiss(win)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  // a click on the dimmed space around a window - the overlay itself
  document.addEventListener('mousedown', e => {
    const t = e.target;
    if (!(t instanceof Element) || t.closest('[data-no-dismiss]')) return;
    if (t.matches('.modal-overlay[style*="flex"]')) { t.style.display = 'none'; return; }
    if (t.matches('.te-sheet-ov, .lc-ov, .te-zero, .so-ov, .sw-ov.open')) dismiss(t);
  });
})();
