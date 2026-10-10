/* Phone gate. The teacher web app is not offered on phones: a native app
   for the App Store will cover the phone, and the web version stays for
   computers and tablets. Loaded synchronously first thing in <head> of the
   teacher pages, so nothing of the app runs before the redirect.

   Students keep their homework, games and room on the phone; only the board
   itself becomes lesson-notes.html there (read the lesson, practise the words).
   Not gated at all: tablets, and the future native shell, which marks itself
   with window.TEACHED_NATIVE or "TeachEdApp" in the user agent. */
(function () {
  try {
    var ua = navigator.userAgent || '';
    if (window.TEACHED_NATIVE || /TeachEdApp/i.test(ua)) return;

    var role = '';
    try { role = localStorage.getItem('teachedos_role') || ''; } catch (e) {}

    var uaPhone = /iPhone|iPod|Android.+Mobile|Windows Phone|BlackBerry|Opera Mini/i.test(ua);
    var touchOnly = window.matchMedia &&
      matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches;
    var smallScreen = Math.min(screen.width || 0, screen.height || 0) < 600;
    var phone = uaPhone || (touchOnly && smallScreen);

    /* Ученик на телефоне (10.10.2026): доска не для экрана телефона, мобильной
       версии не будет - будет нативное приложение. Вместо холста ученик
       получает конспект этой доски и дорогу к своим словам (lesson-notes.html).
       Домашние задания, игры и кабинет остаются на телефоне как были. */
    if (role === 'student') {
      if (!phone || !/\/board(\.html)?$/.test(location.pathname)) return;
      var id = '';
      try { id = new URLSearchParams(location.search).get('id') || localStorage.getItem('teachedos_board_id') || ''; } catch (e) {}
      location.replace('/lesson-notes.html' + (id ? '?id=' + encodeURIComponent(id) : ''));
      document.documentElement.style.display = 'none';
      return;
    }
    if (!phone) return;

    var from = location.pathname + location.search + location.hash;
    location.replace('/mobile.html?from=' + encodeURIComponent(from));
    document.documentElement.style.display = 'none';
  } catch (e) {}
})();
