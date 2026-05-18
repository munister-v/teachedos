// TeachEd shared theme manager — light cream + lime is the single canonical theme.
// Dark mode was retired; this script clears any lingering dark preference
// so that returning users no longer see a half-applied dark UI.
(function () {
  try {
    if (localStorage.getItem('teachedos_theme') === 'dark') {
      localStorage.removeItem('teachedos_theme');
    }
  } catch (e) { /* private mode / storage disabled */ }

  // Remove any stale [data-theme="dark"] attribute applied before this script ran.
  if (document.documentElement.getAttribute('data-theme') === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  }

  // Stubs for any legacy callers (toggle is now a no-op).
  window.__themeToggle = function () { return 'light'; };
  window.__themeGet    = function () { return 'light'; };
})();
