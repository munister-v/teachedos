(function () {
  'use strict';

  // Do not show on admin.html
  if (window.location.href.includes('admin.html')) return;

  /* ── Helpers ── */

  function getDeviceType() {
    return (window.innerWidth < 860 || /Mobi|Android/i.test(navigator.userAgent))
      ? 'Mobile'
      : 'Desktop';
  }

  function getBrowser() {
    var ua = navigator.userAgent;
    if (/Edg\//.test(ua))    return 'Edge';
    if (/OPR\/|Opera/.test(ua)) return 'Opera';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Browser';
  }

  function getOS() {
    var ua = navigator.userAgent;
    if (/Windows/i.test(ua))   return 'Windows';
    if (/Android/i.test(ua))   return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Mac/i.test(ua))       return 'Mac';
    if (/Linux/i.test(ua))     return 'Linux';
    return 'Unknown OS';
  }

  /**
   * Extract email from JWT token and cache it in localStorage.
   * Returns the email string or null.
   */
  function extractAndCacheEmailFromJWT(token) {
    try {
      var parts = token.split('.');
      if (parts.length < 2) return null;
      var payload = JSON.parse(atob(parts[1]));
      var email = payload.email || payload.sub || null;
      if (email) {
        localStorage.setItem('teachedos_user_email', email);
      }
      return email;
    } catch (e) {
      return null;
    }
  }

  function getUserEmail() {
    // Try cached email first
    var cached = localStorage.getItem('teachedos_user_email');
    if (cached) return cached;

    // Try to decode JWT
    var token = localStorage.getItem('teachedos_token');
    if (token) {
      var email = extractAndCacheEmailFromJWT(token);
      if (email) return email;
    }

    return 'Not logged in';
  }

  function buildMessage() {
    var email   = getUserEmail();
    var page    = window.location.href;
    var device  = getDeviceType();
    var browser = getBrowser();
    var os      = getOS();

    return (
      'Hello! 👋 Feedback from TeachEd\n\n' +
      '👤 User: ' + email + '\n' +
      '📄 Page: ' + page + '\n' +
      '📱 Device: ' + device + ' · ' + browser + ' · ' + os + '\n' +
      '💬 My feedback: '
    );
  }

  /* ── Button creation ── */

  var isMobile = getDeviceType() === 'Mobile';

  var btn = document.createElement('div');
  btn.id = 'wa-feedback-btn';
  btn.setAttribute('role', 'button');
  btn.setAttribute('aria-label', 'Send feedback via WhatsApp');
  btn.setAttribute('tabindex', '0');

  btn.style.cssText = [
    'position:fixed',
    'right:24px',
    'bottom:' + (isMobile ? '80px' : '24px'),
    'width:52px',
    'height:52px',
    'border-radius:50%',
    'background:#25D366',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'cursor:pointer',
    'z-index:999999',
    'box-shadow:0 4px 20px rgba(37,211,102,.45),0 2px 8px rgba(0,0,0,.18)',
    'transition:transform .18s ease,box-shadow .18s ease',
    'user-select:none',
    '-webkit-user-select:none',
  ].join(';');

  // WhatsApp SVG icon (official path)
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" fill="#fff" aria-hidden="true">' +
    '<path d="M16.003 2.667C8.639 2.667 2.667 8.638 2.667 16c0 2.354.618 4.562 1.695 6.48L2.667 29.333l7.04-1.668A13.28 13.28 0 0 0 16.003 29.333C23.365 29.333 29.333 23.362 29.333 16S23.365 2.667 16.003 2.667zm0 2.4c5.927 0 10.93 5.003 10.93 10.933 0 5.928-5.003 10.933-10.93 10.933a10.893 10.893 0 0 1-5.614-1.558l-.39-.234-4.18.99.998-4.075-.26-.407A10.888 10.888 0 0 1 5.073 16c0-5.93 5.003-10.933 10.93-10.933zm-3.092 5.6c-.208 0-.547.078-.834.39-.287.312-1.094 1.069-1.094 2.605s1.12 3.022 1.276 3.23c.157.208 2.189 3.49 5.383 4.757 2.656 1.062 3.194.85 3.77.797.578-.052 1.869-.764 2.132-1.502.263-.737.263-1.37.184-1.502-.078-.13-.287-.208-.6-.364-.312-.156-1.85-.912-2.136-1.016-.287-.104-.495-.156-.703.156-.208.313-.806 1.016-.988 1.224-.183.208-.365.234-.677.078-.312-.156-1.318-.486-2.511-1.55-.928-.828-1.555-1.85-1.737-2.163-.182-.312-.02-.481.137-.636.14-.14.313-.365.469-.547.156-.183.208-.313.313-.521.104-.208.052-.39-.026-.547-.078-.156-.685-1.7-.95-2.32-.253-.603-.513-.521-.703-.531a12.8 12.8 0 0 0-.6-.013z"/>' +
    '</svg>';

  /* ── Hover / focus effects ── */
  btn.addEventListener('mouseenter', function () {
    btn.style.transform = 'scale(1.08)';
    btn.style.boxShadow = '0 6px 28px rgba(37,211,102,.60),0 4px 12px rgba(0,0,0,.22)';
  });
  btn.addEventListener('mouseleave', function () {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 20px rgba(37,211,102,.45),0 2px 8px rgba(0,0,0,.18)';
  });

  /* ── Click handler ── */
  function handleClick() {
    // "Sent" animation: scale up then back
    btn.style.transform = 'scale(1.2)';
    setTimeout(function () { btn.style.transform = 'scale(1)'; }, 220);

    var msg  = buildMessage();
    var url  = 'https://wa.me/380683642205?text=' + encodeURIComponent(msg);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  btn.addEventListener('click', handleClick);
  btn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }
  });

  /* ── Responsive bottom offset: update on resize ── */
  window.addEventListener('resize', function () {
    btn.style.bottom = (window.innerWidth < 860 || /Mobi|Android/i.test(navigator.userAgent))
      ? '80px'
      : '24px';
  });

  /* ── Inject into DOM when ready ── */
  function inject() {
    document.body.appendChild(btn);

    // Pre-cache email from JWT if token exists and email not cached yet
    if (!localStorage.getItem('teachedos_user_email')) {
      var token = localStorage.getItem('teachedos_token');
      if (token) extractAndCacheEmailFromJWT(token);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
