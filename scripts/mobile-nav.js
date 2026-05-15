/* mobile-nav.js — shared bottom tab bar for teacher PWA pages */
(function () {
  var isMobile = window.innerWidth <= 860;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  if (!isMobile && !isStandalone) return;

  var page = location.pathname.split('/').pop() || 'index.html';
  if (page === '' || page === 'teachedos') page = 'index.html';

  var PAGE_MAP = {
    'index.html': 'home',
    'schedule.html': 'schedule',
    'gradebook.html': 'grades',
    'journal.html': 'journal',
    'profile.html': 'me',
  };
  var activeId = PAGE_MAP[page] || '';

  var TABS = [
    {
      id: 'home', href: 'index.html', label: 'Boards',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    },
    {
      id: 'schedule', href: 'schedule.html', label: 'Schedule',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    },
    {
      id: 'grades', href: 'gradebook.html', label: 'Grades',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
    },
    {
      id: 'journal', href: 'journal.html', label: 'Journal',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    },
    {
      id: 'me', href: 'profile.html', label: 'Me',
      icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    },
  ];

  /* ── CSS ── */
  var style = document.createElement('style');
  style.textContent = [
    '.mob-nav{',
    '  position:fixed;bottom:0;left:0;right:0;z-index:9990;',
    '  height:calc(56px + env(safe-area-inset-bottom,0px));',
    '  padding-bottom:env(safe-area-inset-bottom,0px);',
    '  background:rgba(22,22,24,0.94);',
    '  backdrop-filter:blur(24px) saturate(1.8);',
    '  -webkit-backdrop-filter:blur(24px) saturate(1.8);',
    '  border-top:1px solid rgba(255,255,255,0.07);',
    '  display:flex;align-items:stretch;',
    '}',
    '.mob-nav-tab{',
    '  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;',
    '  height:56px;gap:4px;text-decoration:none;',
    '  color:rgba(255,255,255,0.36);',
    '  transition:color 0.15s, opacity 0.15s;',
    '  -webkit-tap-highlight-color:transparent;',
    '  cursor:pointer;border:none;background:none;font-family:inherit;',
    '  position:relative;',
    '}',
    '.mob-nav-tab:active{opacity:0.6;}',
    '.mob-nav-tab.active{color:#E85D75;}',
    '.mob-nav-tab.active::before{',
    '  content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);',
    '  width:28px;height:2px;border-radius:0 0 2px 2px;',
    '  background:#E85D75;',
    '}',
    '.mob-nav-icon{line-height:1;display:flex;align-items:center;justify-content:center;}',
    '.mob-nav-label{',
    '  font-size:9px;font-weight:800;letter-spacing:0.04em;',
    '  font-family:Nunito,ui-sans-serif,sans-serif;line-height:1;',
    '}',
    /* body padding so content isn't hidden behind nav */
    'body{padding-bottom:calc(56px + env(safe-area-inset-bottom,0px)) !important;}',
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
    var tab = e.target.closest('.mob-nav-tab');
    if (tab && navigator.vibrate) navigator.vibrate(8);
  });

  function mount() { document.body.appendChild(nav); }
  if (document.body) { mount(); }
  else { document.addEventListener('DOMContentLoaded', mount); }
})();
