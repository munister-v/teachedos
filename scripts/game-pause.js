/* Пауза игры, пока вкладка не на экране.
   На телефоне уход из вкладки — обычное дело: звонок, переключение, блокировка.
   Раньше отсчёт продолжал идти в фоне, а цели не показывались: браузер не
   выполняет requestAnimationFrame у скрытой вкладки, поэтому слово получало
   текст, но не получало класс появления. Игрок возвращался к пустому полю и
   потерянным секундам.

   Здесь замораживаются таймеры самой страницы: на visibilitychange они
   снимаются с запоминанием остатка, при возврате — ставятся заново. */
(function () {
  var nativeSetInterval = window.setInterval;
  var nativeSetTimeout = window.setTimeout;
  var nativeClearInterval = window.clearInterval;
  var nativeClearTimeout = window.clearTimeout;

  var timers = new Map();   // наш id -> запись таймера
  var nextId = 1;
  var frozen = false;

  function now() { return Date.now(); }

  function schedule(rec) {
    if (rec.repeat) {
      rec.realId = nativeSetInterval.call(window, function () {
        rec.startedAt = now();
        rec.fn.apply(null, rec.args);
      }, rec.delay);
    } else {
      rec.realId = nativeSetTimeout.call(window, function () {
        timers.delete(rec.id);
        rec.fn.apply(null, rec.args);
      }, rec.delay);
    }
    rec.startedAt = now();
  }

  function wrap(repeat) {
    return function (fn, delay) {
      if (typeof fn !== 'function') {
        // Строковая форма и прочая экзотика — отдаём браузеру как есть.
        return (repeat ? nativeSetInterval : nativeSetTimeout).apply(window, arguments);
      }
      var rec = {
        id: nextId++,
        fn: fn,
        args: Array.prototype.slice.call(arguments, 2),
        delay: Math.max(0, delay || 0),
        repeat: repeat,
        realId: null,
        startedAt: 0,
        remaining: 0
      };
      timers.set(rec.id, rec);
      if (frozen) {
        // Поставлен, пока вкладка скрыта: ждёт возврата целиком.
        rec.remaining = rec.delay;
      } else {
        schedule(rec);
      }
      return rec.id;
    };
  }

  function clear(repeat) {
    return function (id) {
      var rec = timers.get(id);
      if (!rec) {
        return (repeat ? nativeClearInterval : nativeClearTimeout).call(window, id);
      }
      timers.delete(id);
      if (rec.realId !== null) {
        (rec.repeat ? nativeClearInterval : nativeClearTimeout).call(window, rec.realId);
      }
    };
  }

  window.setInterval = wrap(true);
  window.setTimeout = wrap(false);
  window.clearInterval = clear(true);
  window.clearTimeout = clear(false);

  function freeze() {
    if (frozen) return;
    frozen = true;
    timers.forEach(function (rec) {
      if (rec.realId === null) return;
      var spent = now() - rec.startedAt;
      // Интервал досиживает текущий круг, разовый таймер — свой остаток.
      rec.remaining = Math.max(0, rec.delay - spent);
      (rec.repeat ? nativeClearInterval : nativeClearTimeout).call(window, rec.realId);
      rec.realId = null;
    });
  }

  function thaw() {
    if (!frozen) return;
    frozen = false;
    timers.forEach(function (rec) {
      var wait = rec.remaining;
      rec.remaining = 0;
      if (!rec.repeat) {
        // Разовый таймер доигрывает остаток, а не полный срок заново.
        rec.realId = nativeSetTimeout.call(window, function () {
          timers.delete(rec.id);
          rec.fn.apply(null, rec.args);
        }, wait);
        rec.startedAt = now();
        return;
      }
      // Интервал: доигрываем остаток круга, дальше — обычным шагом.
      rec.realId = nativeSetTimeout.call(window, function () {
        rec.startedAt = now();
        rec.fn.apply(null, rec.args);
        if (!timers.has(rec.id)) return;
        rec.realId = nativeSetInterval.call(window, function () {
          rec.startedAt = now();
          rec.fn.apply(null, rec.args);
        }, rec.delay);
        rec.startedAt = now();
      }, wait);
      rec.startedAt = now() - (rec.delay - wait);
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) freeze(); else thaw();
  });
  window.addEventListener('pagehide', freeze);
  window.addEventListener('pageshow', thaw);
})();
