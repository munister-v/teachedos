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
    'board.html': 'board',
    'board': 'board',
    'schedule.html': 'home',
    'courses.html': 'courses',
    'community.html': 'home',
    'homework.html': 'courses',
    'student.html': 'progress',
    'gradebook.html': 'progress',
    'lesson-packs.html': 'courses',
    'profile.html': 'profile',
    'analytics.html': 'progress',
    'journal.html': 'progress',
  };
  // board.html has its own bottom quickbar — skip the global mob-nav there.
  // Accept both /board and /board.html (some hosts strip extension).
  if (page === 'board.html' || page === 'board') return;
  var activeId = PAGE_MAP[page] || '';

  var TABS = [
    {
      id: 'home', href: 'index.html', label: 'Home',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    },
    {
      id: 'board', href: 'board.html', label: 'Board',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h8"/><path d="M8 12h5"/><path d="M8 16h7"/></svg>',
    },
    {
      id: 'courses', href: 'courses.html', label: 'Courses',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>',
    },
    {
      id: 'progress', href: 'gradebook.html', label: 'Progress',
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
    '  position:fixed;bottom:max(8px,env(safe-area-inset-bottom,0px));left:12px;right:12px;z-index:9990;',
    '  height:64px;',
    '  padding:5px;',
    /* solid bg: no backdrop-filter — saves GPU on every scroll frame */
    '  background:rgba(255,255,255,0.96);',
    '  border:1px solid rgba(28,28,30,0.10);',
    '  border-radius:22px;',
    '  display:flex;align-items:stretch;gap:4px;',
    /* GPU-promote to own layer so scrolling content never triggers nav repaint */
    '  transform:translateZ(0);',
    '  will-change:transform;',
    '  box-shadow:0 10px 24px rgba(28,28,30,0.10),0 1px 0 rgba(255,255,255,0.86) inset;',
    /* SPA shell: anchor the tab bar across page navigations so it stays put
       (native app-bar feel) instead of cross-fading with the page body. */
    '  view-transition-name:te-mobnav;',
    '}',
    /* Hold the bar steady through the swap — no fade flicker. */
    '::view-transition-group(te-mobnav){animation-duration:220ms;}',
    '::view-transition-old(te-mobnav),',
    '::view-transition-new(te-mobnav){animation:none;}',
    '.mob-nav-tab{',
    '  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;',
    '  height:52px;gap:4px;text-decoration:none;border-radius:17px;',
    '  color:rgba(28,28,30,0.46);',
    '  transition:color 0.15s, opacity 0.15s, background 0.15s, transform 0.15s;',
    '  -webkit-tap-highlight-color:transparent;',
    '  cursor:pointer;border:none;background:none;font-family:inherit;',
    '  position:relative;',
    '}',
    '.mob-nav-tab:active{opacity:0.82;transform:scale(0.96);}',
    '.mob-nav-tab.active{color:#111113;background:rgba(200,230,50,0.24);}',
    // Active indicator is uniquely named (only one .active exists at a time), so
    // the browser MORPHS it from the old tab to the new tab on navigation — the
    // lime pill slides across the bar like a native tab indicator.
    '.mob-nav-tab.active::before{content:"";position:absolute;top:6px;width:16px;height:3px;border-radius:99px;background:#C8E632;view-transition-name:te-tab-pill;}',
    '::view-transition-group(te-tab-pill){animation-duration:280ms;animation-timing-function:cubic-bezier(.4,1.3,.5,1);}',
    '.mob-nav-icon{line-height:1;display:flex;align-items:center;justify-content:center;}',
    '.mob-nav-icon svg{width:20px;height:20px;stroke-width:2.1;}',
    '.mob-nav-label{',
    '  font-size:10px;font-weight:850;letter-spacing:0;',
    '  font-family:inherit;line-height:1;',
    '}',
    /* body padding so content isn't hidden behind nav */
    'body{padding-bottom:calc(88px + env(safe-area-inset-bottom,0px)) !important;}',
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
