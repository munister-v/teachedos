(function () {
  'use strict';

  var SUPPORT_PHONE = '380683642205';

  function getDeviceType() {
    return (window.innerWidth < 860 || /Mobi|Android/i.test(navigator.userAgent))
      ? 'Mobile'
      : 'Desktop';
  }

  function getBrowser() {
    var ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\/|Opera/.test(ua)) return 'Opera';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return 'Browser';
  }

  function getOS() {
    var ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown OS';
  }

  function extractAndCacheEmailFromJWT(token) {
    try {
      var parts = token.split('.');
      if (parts.length < 2) return null;
      var payload = JSON.parse(atob(parts[1]));
      var email = payload.email || payload.sub || null;
      if (email) localStorage.setItem('teachedos_user_email', email);
      return email;
    } catch (e) {
      return null;
    }
  }

  function getUserEmail() {
    var cached = localStorage.getItem('teachedos_user_email');
    if (cached) return cached;
    var token = localStorage.getItem('teachedos_token');
    if (token) {
      var email = extractAndCacheEmailFromJWT(token);
      if (email) return email;
    }
    return 'Not logged in';
  }

  function buildMessage(context) {
    return [
      'Hello! Feedback from TeachEd',
      '',
      'User: ' + getUserEmail(),
      'Page: ' + window.location.href,
      'Context: ' + (context || 'Settings support'),
      'Device: ' + getDeviceType() + ' · ' + getBrowser() + ' · ' + getOS(),
      '',
      'My message: '
    ].join('\n');
  }

  function openSupport(context) {
    var url = 'https://wa.me/' + SUPPORT_PHONE + '?text=' + encodeURIComponent(buildMessage(context));
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function init() {
    var token = localStorage.getItem('teachedos_token');
    if (token && !localStorage.getItem('teachedos_user_email')) extractAndCacheEmailFromJWT(token);
    document.querySelectorAll('[data-teached-support]').forEach(function (el) {
      el.addEventListener('click', function () {
        openSupport(el.getAttribute('data-support-context') || el.textContent || 'Settings support');
      });
    });
  }

  window.TeachEdSupport = { open: openSupport, buildMessage: buildMessage };
  window.openTeachSupport = openSupport;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
