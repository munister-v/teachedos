/* TeachEd — поля ввода растут под содержимое.
 *
 * Textarea по всей панели имели фиксированную высоту: список слов на четыре
 * строки показывал три с половиной, последняя срезалась пополам. Выглядело
 * так, будто текст испорчен, — и повторялось в полусотне мест: словарь в
 * инструментах, брифы уроков, заметки на доске, поля конструктора игр.
 *
 * Два пути, оба безопасные:
 *   1. Где браузер умеет `field-sizing: content` (Chrome/Edge 123+), всю
 *      работу делает CSS — без скриптов и перерисовок.
 *   2. Где не умеет (Safari, Firefox на момент правки) — этот скрипт.
 *
 * Ловушка, на которой такое ломается: у скрытого элемента `scrollHeight`
 * равен нулю, и поле схлопывается в ничто. Поэтому невидимые пропускаем, а
 * пересчитываем их тогда, когда они появятся на экране.
 */
(function () {
  'use strict';
  if (window.__teAutogrow) return;
  window.__teAutogrow = true;

  var native = false;
  try { native = window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'); } catch (e) {}
  document.documentElement.classList.add(native ? 'te-fieldsizing' : 'te-autogrow-js');
  if (native) return;                       // дальше всё делает CSS

  var MAX = 0.6;                            // выше 60% экрана поле не растёт, дальше прокрутка

  function grow(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    if (el.dataset.noAutogrow === '1') return;
    if (!el.offsetParent && el.offsetHeight === 0) return;   // скрыт — считать нечего
    var cap = Math.round(window.innerHeight * MAX);
    /* Потолок ставим через max-height, а не подменой height: у поля свои
       отступы и рамка, и при `box-sizing: content-box` height=cap давал бы
       на экране cap плюс эти отступы — потолок бы протекал. Пусть считает
       браузер, он знает про модель коробки. */
    /* При `box-sizing: content-box` height и max-height считаются БЕЗ отступов
       и рамки, поэтому на экране поле выходит выше потолка ровно на их сумму.
       В панели везде border-box, но скрипт общий и попадает в том числе на
       страницы игр — поэтому вычитаем разницу явно, а не надеемся на модель. */
    var cs = window.getComputedStyle(el);
    var extra = 0;
    if (cs.boxSizing !== 'border-box') {
      extra = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
            + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    }
    var inner = Math.max(40, cap - extra);
    el.style.maxHeight = inner + 'px';
    el.style.height = 'auto';
    var need = el.scrollHeight + 2;
    el.style.height = need + 'px';
    el.style.overflowY = need > inner ? 'auto' : 'hidden';
  }

  function growAll(root) {
    var list = (root || document).querySelectorAll ? (root || document).querySelectorAll('textarea') : [];
    for (var i = 0; i < list.length; i++) grow(list[i]);
  }

  document.addEventListener('input', function (e) {
    if (e.target && e.target.tagName === 'TEXTAREA') grow(e.target);
  }, true);

  /* Поля, созданные скриптом уже после загрузки (списки заданий, карточки
     доски, конструктор игр), сами о себе сообщить не могут — следим за DOM. */
  var pending = false;
  function schedule(root) {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; growAll(root); });
  }
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.tagName === 'TEXTAREA' || (n.querySelector && n.querySelector('textarea'))) { schedule(document); return; }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* Скрытое поле пересчитываем в момент, когда оно показалось: до этого его
     высота равна нулю и любая попытка «подогнать» превратила бы поле в полоску. */
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) if (entries[i].isIntersecting) grow(entries[i].target);
    }, { rootMargin: '200px' });
    var watch = function () {
      var list = document.querySelectorAll('textarea');
      for (var i = 0; i < list.length; i++) { try { io.observe(list[i]); } catch (e) {} }
    };
    document.addEventListener('DOMContentLoaded', watch);
    setTimeout(watch, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { growAll(document); });
  else growAll(document);
  window.addEventListener('load', function () { growAll(document); });
  window.addEventListener('resize', function () { schedule(document); });
})();
