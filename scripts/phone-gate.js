/* Phone gate. The teacher web app is not offered on phones: a native app
   for the App Store will cover the phone, and the web version stays for
   computers and tablets. Loaded synchronously first thing in <head> of the
   teacher pages, so nothing of the app runs before the redirect.

   Not gated: students (their homework, boards and games stay on the phone),
   tablets, and the future native shell, which marks itself with
   window.TEACHED_NATIVE or "TeachEdApp" in the user agent. */
(function () {
  try {
    var ua = navigator.userAgent || '';
    if (window.TEACHED_NATIVE || /TeachEdApp/i.test(ua)) return;

    var role = '';
    try { role = localStorage.getItem('teachedos_role') || ''; } catch (e) {}
    if (role === 'student') return;

    var uaPhone = /iPhone|iPod|Android.+Mobile|Windows Phone|BlackBerry|Opera Mini/i.test(ua);
    var touchOnly = window.matchMedia &&
      matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches;
    var smallScreen = Math.min(screen.width || 0, screen.height || 0) < 600;
    if (!(uaPhone || (touchOnly && smallScreen))) return;

    var from = location.pathname + location.search + location.hash;
    location.replace('/mobile.html?from=' + encodeURIComponent(from));
    document.documentElement.style.display = 'none';
  } catch (e) {}
})();
