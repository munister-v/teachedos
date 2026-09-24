/* Express 4 не ловит отклонённые промисы из async-обработчиков: ошибка
   (например, Postgres «invalid input syntax for type uuid» на
   GET /api/boards/not-a-uuid) становилась unhandledRejection, и Node 20
   ронял ВЕСЬ процесс - у всех пользователей сразу, пока systemd не поднимет.
   Здесь то же, что делает express-async-errors, без внешней зависимости:
   если обработчик вернул промис, его отказ уходит в next(err), то есть в
   общий обработчик ошибок server.js. Подключается ДО маршрутов. */
const Layer = require('express/lib/router/layer');

if (!Layer.prototype.__teachedAsyncPatched) {
  Layer.prototype.__teachedAsyncPatched = true;
  Layer.prototype.handle_request = function handle(req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next();            // error-handling middleware: not for this path
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === 'function') out.then(null, next);
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {};
