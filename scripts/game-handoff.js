/* Передача матеріалу зі студії в гру.

   Ігри вміли приймати вміст лише через postMessage `teachedos-custom-game-content`
   - так їх годують дошка й game-builder, які тримають гру в iframe. Хаб
   інструментів робить ПОВНУ навігацію (`openPracticeGame` → location.href), тож
   postMessage йому нікуди слати: він клав матеріал у sessionStorage під ключем
   `teachedos_pending_game_material`, а цей ключ не читав НІХТО. Кнопка «Open
   practice game» роками вела в порожню демо-гру.

   Тут той самий ключ і читається. Формат не новий: віддаємо `gameContent` у
   вже існуючу `applyCustomContent(content, title)`, ту саму, що приймає
   повідомлення.

   Ключ НЕ видаляється - інакше перезавантаження сторінки скидало б урок у
   демо-вміст. Від чужого матеріалу боронить звірка типу: `practiceGameUrl`
   мапить gameType рівно у `games/<gameType>.html`, тож імʼя файла і є типом. */
(function () {
  var KEY = 'teachedos_pending_game_material';
  function apply() {
    var raw;
    try { raw = sessionStorage.getItem(KEY); } catch (e) { return; }
    if (!raw) return;
    var material;
    try { material = JSON.parse(raw); } catch (e) { return; }
    if (!material || !material.gameContent) return;
    var here = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    if (material.gameType && here && material.gameType !== here) return;
    if (typeof window.applyCustomContent !== 'function') return;
    try { window.applyCustomContent(material.gameContent, material.title || ''); }
    catch (e) { console.warn('[game-handoff] could not apply material', e); }
  }
  /* Возврат на доску.

     На телефоне доска не играет игру в карточке - там вход, который ведёт
     сюда целой страницей (см. renderGameLaunchPanel в scripts/board-app.js).
     Переход обычный, поэтому системная кнопка «назад» и так работает; но
     единственная видимая ссылка на экране - «← Games» - уводила бы в хаб, то
     есть мимо урока, с которого учитель пришёл. Когда в адресе from=board,
     эта ссылка возвращает на доску. */
  function fixBackLink() {
    try {
      var back = document.querySelector('a.back, .back[href]');
      if (!back) return;
      /* Внутри карточки доски игра лежит в iframe, и «← Games» уводит САМ
         iframe на games/index.html: карточка с заголовком «Grammar Fix»
         превращается в хаб игр, а заголовок остаётся прежним. Возвращаться
         тут некуда - карточка и есть игра, - поэтому кнопки просто нет.
         Проверка идёт до ветки from=board: встроенная игра этого параметра
         не несёт, у неё в адресе только сам файл. */
      var embedded = false;
      try { embedded = window.parent !== window; } catch (e) { embedded = true; }
      if (embedded) { back.remove(); return; }
      if (!/[?&]from=board\b/.test(location.search)) return;
      back.setAttribute('href', '../board.html');
      var label = (back.textContent || '').trim();
      if (/games/i.test(label)) back.textContent = '← Board';
    } catch (e) {}
  }

  function boot() { apply(); fixBackLink(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
