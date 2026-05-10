// TeachedOS shared theme manager
(function() {
  const stored = localStorage.getItem('teachedos_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  // Expose toggle for profile page
  window.__themeToggle = function() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next === 'dark' ? 'dark' : '');
    localStorage.setItem('teachedos_theme', next);
    return next;
  };

  window.__themeGet = function() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  };
})();
