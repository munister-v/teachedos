// TeachedOS shared theme manager
(function() {
  const stored = localStorage.getItem('teachedos_theme');
  const theme = stored || 'light';
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
