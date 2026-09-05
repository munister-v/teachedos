/* Быстрый вход с любой страницы.
 *
 * До этого войти можно было ровно из двух мест: с лендинга (кнопка в шапке)
 * и с доски (там подключён auth-modal.js). На остальных страницах кабинета и
 * на всех ученических (lesson-view, share, invite, portal, homework-do)
 * у вышедшего из аккаунта не было НИ ОДНОГО способа войти: часть страниц
 * молча уводит на лендинг, часть просто показывает пустую страницу.
 *
 * Здесь одна кнопка, одинаковая на телефоне и на десктопе. Формы входа с
 * собой не тащит: auth-modal.js плюс auth.css это 52 КБ на страницу, а
 * лендинг уже умеет открывать модалку по ?auth=login. Если модалка на
 * странице всё же есть (доска), открываем её на месте.
 */
(function () {
  'use strict';

  var TOKEN_KEY = 'teachedos_token';

  function hasSession() {
    try {
      return !!localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      // Приватный режим без localStorage: кнопку показываем, войти можно.
      return false;
    }
  }

  // Страница со своим входом (доска, лендинг) вторую кнопку не получает.
  function pageHasOwnSignIn() {
    if (typeof window.openAuthModal === 'function') return true;
    return !!document.querySelector('#auth-login-btn, #lp-auth, .auth-overlay');
  }

  function openSignIn(ev) {
    if (ev) ev.preventDefault();
    if (typeof window.openAuthModal === 'function') {
      window.openAuthModal('login');
      return;
    }
    // Возврат на ту же страницу после входа - иначе ученик по ссылке на урок
    // после логина оказывается на дашборде и ссылку ищет заново.
    var back = location.pathname + location.search + location.hash;
    try {
      sessionStorage.setItem('teachedos_return_to', back);
    } catch (e) { /* приватный режим - вернёмся на дашборд, не страшно */ }
    location.href = '/?auth=login';
  }

  /* Оформление вживляется скриптом, а не отдельным файлом стилей. Кнопка
     нужна на двадцати страницах, а они подключают РАЗНЫЕ наборы таблиц
     (controls.css есть не везде, mobile-chrome.css тем более), и в этом
     проекте порядок подключения уже не раз решал исход спора правил.
     Свой <style> с id-селектором не зависит ни от того, ни от другого. */
  function injectStyles() {
    if (document.getElementById('global-signin-style')) return;
    var css =
      /* Низ-право, а не верх-право: у страниц свои липкие шапки высотой
         36-56px со своими кнопками справа (на lesson-view кнопка села прямо
         на «Copy link»). Внизу справа пусто на всех страницах, где эта
         кнопка вообще показывается. */
      '#global-signin{' +
        'position:fixed;z-index:9600;' +
        'bottom:max(20px,env(safe-area-inset-bottom,0px));' +
        'right:max(20px,env(safe-area-inset-right,0px));' +
        'display:inline-flex;align-items:center;gap:7px;' +
        'min-height:44px;padding:0 16px;' +
        'border:none;border-radius:999px;' +
        'background:#1C1C1E;color:#CDF24F;' +
        'font:700 14px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;' +
        'letter-spacing:-.01em;cursor:pointer;' +
        'box-shadow:0 6px 20px rgba(5,5,23,.22),0 1px 3px rgba(5,5,23,.14);' +
        '-webkit-tap-highlight-color:transparent;' +
      '}' +
      '#global-signin svg{width:16px;height:16px;flex:none;}' +
      '#global-signin:hover{background:#000;}' +
      '#global-signin:active{transform:scale(.97);}' +
      '#global-signin:focus-visible{outline:3px solid #CDF24F;outline-offset:3px;}' +
      /* На телефоне у части страниц снизу своя навигация (.te-mobnav,
         #mobile-quickbar) - поднимаемся над ней. */
      '@media (max-width:860px){#global-signin{' +
        'bottom:calc(78px + env(safe-area-inset-bottom,0px));' +
      '}}' +
      '@media (prefers-reduced-motion:reduce){#global-signin:active{transform:none;}}';
    var st = document.createElement('style');
    st.id = 'global-signin-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function build() {
    if (document.getElementById('global-signin')) return;
    injectStyles();

    var btn = document.createElement('button');
    btn.id = 'global-signin';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Sign in to TeachEd');
    btn.innerHTML =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6.5 2.5h5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-5"/>' +
      '<path d="M3 8h6M6.5 5.5L9 8l-2.5 2.5"/></svg>' +
      '<span>Sign in</span>';
    btn.addEventListener('click', openSignIn);
    document.body.appendChild(btn);
  }

  function init() {
    if (hasSession() || pageHasOwnSignIn()) return;
    build();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
