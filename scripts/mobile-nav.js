/* mobile-nav.js — shared bottom tab bar for teacher PWA pages */
(function () {
  var isMobile = window.innerWidth <= 860;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  if (!isMobile && !isStandalone) return;

  var page = location.pathname.split('/').pop() || 'index.html';
  if (page === '' || page === 'teachedos' || page === 'teachedos/') page = 'index.html';

  var PAGE_MAP = {
    'index.html': 'home',
    'schedule.html': 'schedule',
    'courses.html': 'community',
    'student.html': 'students',
    'gradebook.html': 'students',
    'profile.html': 'profile',
    'board.html': 'home',
    'analytics.html': 'home',
    'journal.html': 'home',
  };
  var activeId = PAGE_MAP[page] || '';

  var TABS = [
    {
      id: 'home', href: 'index.html', label: 'Home',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    },
    {
      id: 'schedule', href: 'schedule.html', label: 'Schedule',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    },
    {
      id: 'community', href: 'courses.html', label: 'Community',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    },
    {
      id: 'students', href: 'gradebook.html', label: 'Students',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    },
    {
      id: 'profile', href: 'profile.html', label: 'Profile',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    },
  ];

  /* ── CSS ── */
  var style = document.createElement('style');
  style.textContent = [
    '.mob-nav{',
    '  position:fixed;bottom:0;left:0;right:0;z-index:9990;',
    '  height:calc(60px + env(safe-area-inset-bottom,0px));',
    '  padding-bottom:env(safe-area-inset-bottom,0px);',
    '  background:rgba(255,255,255,0.96);',
    '  backdrop-filter:blur(24px) saturate(1.8);',
    '  -webkit-backdrop-filter:blur(24px) saturate(1.8);',
    '  border-top:1px solid rgba(94,94,74,0.10);',
    '  display:flex;align-items:stretch;',
    '  box-shadow:0 -2px 16px rgba(94,94,74,0.06);',
    '}',
    '.mob-nav-tab{',
    '  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;',
    '  height:60px;gap:3px;text-decoration:none;',
    '  color:rgba(94,94,74,0.45);',
    '  transition:color 0.15s, opacity 0.15s;',
    '  -webkit-tap-highlight-color:transparent;',
    '  cursor:pointer;border:none;background:none;font-family:inherit;',
    '  position:relative;',
    '}',
    '.mob-nav-tab:active{opacity:0.6;}',
    '.mob-nav-tab.active{color:#1C1C1E;}',
    '.mob-nav-icon{line-height:1;display:flex;align-items:center;justify-content:center;}',
    '.mob-nav-label{',
    '  font-size:10px;font-weight:700;letter-spacing:0.02em;',
    '  font-family:Nunito,ui-sans-serif,sans-serif;line-height:1;',
    '}',
    /* body padding so content isn't hidden behind nav */
    'body{padding-bottom:calc(60px + env(safe-area-inset-bottom,0px)) !important;}',
  ].join('');
  document.head.appendChild(style);

  /* ── HTML ── */
  var nav = document.createElement('nav');
  nav.className = 'mob-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main');
  nav.innerHTML = TABS.map(function (t) {
    return [
      '<a class="mob-nav-tab' + (activeId === t.id ? ' active' : '') + '"',
      '   href="' + t.href + '"',
      '   aria-label="' + t.label + '"',
      '   aria-current="' + (activeId === t.id ? 'page' : 'false') + '">',
      '  <span class="mob-nav-icon">' + t.icon + '</span>',
      '  <span class="mob-nav-label">' + t.label + '</span>',
      '</a>',
    ].join('');
  }).join('');

  /* haptic on tap (Android) */
  nav.addEventListener('click', function (e) {
    if (navigator.vibrate) navigator.vibrate(8);
  });

  document.body.appendChild(nav);

  /* Show/hide on resize for responsive switching */
  var mql = window.matchMedia('(max-width: 860px)');
  function toggleNav(e) {
    nav.style.display = e.matches ? 'flex' : 'none';
    style.disabled = !e.matches;
  }
  if (!isMobile && isStandalone) {
    /* standalone always shown */
  } else {
    mql.addEventListener('change', toggleNav);
  }
})();
