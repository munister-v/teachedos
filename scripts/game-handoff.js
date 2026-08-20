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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
