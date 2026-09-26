/* A row of number tiles (Homework, Journal, Gradebook, Analytics, Courses)
   says nothing on a new account - four zeros or dashes. Such a row is hidden
   until at least one number is real; each page's own empty state below it
   then speaks for itself. The rows fill in asynchronously, so they are
   re-checked whenever their content changes. */
(function () {
  'use strict';
  const TILE = '.hw-metric, .stat-card, .insight-card';
  const VALUE = 'b, .stat-num, .stat-val, .insight-value, .stat-n';
  const EMPTY = /^[\s$£€]*(?:0(?:[.,]0+)?\s*%?|[-–—]|n\/a)?[\s%]*$/i;

  const css = document.createElement('style');
  css.textContent = '.te-stats-empty{display:none !important}';
  document.head.appendChild(css);

  function check(row) {
    const tiles = [...row.children].filter(c => c.matches(TILE));
    if (tiles.length < 3) return;
    const empty = tiles.every(t => {
      const v = t.querySelector(VALUE);
      return !v || EMPTY.test(v.textContent.trim());
    });
    row.classList.toggle('te-stats-empty', empty);
  }

  const watched = new WeakSet();
  function scan() {
    const rows = new Set();
    document.querySelectorAll(TILE).forEach(t => t.parentElement && rows.add(t.parentElement));
    rows.forEach(row => {
      check(row);
      if (watched.has(row)) return;
      watched.add(row);
      new MutationObserver(() => check(row)).observe(row, { childList: true, subtree: true, characterData: true });
    });
  }

  function start() {
    scan();
    // rows rendered later (Courses builds its tiles per course)
    new MutationObserver(muts => {
      if (muts.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches?.(TILE) || n.querySelector?.(TILE))))) scan();
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
