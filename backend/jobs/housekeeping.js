/* УБОРКА.

   Ничего из перечисленного ниже никогда не удалялось. Пока учителей десяток,
   это несколько сотен строк; при тысяче активных пользователей сессии растут
   на десятки тысяч строк в месяц, а auth_events - быстрее них, потому что
   пишутся и на неудачные попытки входа. Растёт не только диск: индекс по
   сессиям перестаёт помещаться в память, и проверка токена на КАЖДОМ запросе
   к API становится дороже.

   Сроки выбраны по смыслу, а не по вкусу: сессия после истечения не нужна
   никому (JWT живёт семь дней, так что её удаление ничего не разлогинивает -
   она уже недействительна), журнал входов нужен для разбора инцидентов и
   держится 90 дней, прочитанные уведомления после месяца не читает никто. */
const pool = require('../db/pool');
const { recordTelemetry } = require('../lib/telemetry');

const TASKS = [
  ['expired sessions',   `DELETE FROM sessions WHERE expires_at <= NOW() - INTERVAL '1 day'`],
  ['old auth events',    `DELETE FROM auth_events WHERE created_at < NOW() - INTERVAL '90 days'`],
  ['raw telemetry',      `DELETE FROM telemetry_events WHERE created_at < NOW() - INTERVAL '45 days'`],
  ['hourly telemetry',   `DELETE FROM telemetry_hourly WHERE hour_start < NOW() - INTERVAL '18 months'`],
  ['read notifications', `DELETE FROM notifications WHERE read = TRUE AND created_at < NOW() - INTERVAL '30 days'`],
  ['used email tokens',  `DELETE FROM email_tokens WHERE expires_at <= NOW() - INTERVAL '7 days'`],
];

async function runHousekeeping() {
  /* Итог печатается всегда, даже когда удалять нечего. Молчание при «всё
     чисто» неотличимо от молчания при «задача не запустилась» - а именно это
     и надо видеть в журнале, чтобы уборка не оказалась мёртвой полгода. */
  const done = [];
  for (const [label, sql] of TASKS) {
    try {
      const r = await pool.query(sql);
      if (r.rowCount) done.push(`${label}: ${r.rowCount}`);
    } catch (err) {
      // Таблицы может не быть на свежей базе - это не повод ронять остальные.
      if (!/does not exist/i.test(err.message)) console.warn(`[housekeeping] ${label}:`, err.message);
    }
  }
  console.log(`[housekeeping] ${done.length ? done.join(', ') : 'nothing to remove'}`);
  recordTelemetry({
    category: 'system',
    eventType: 'system.housekeeping',
    outcome: 'ok',
    metadata: { job: 'housekeeping', operation: done.length ? 'cleaned' : 'checked' },
  });
}

function scheduleHousekeeping() {
  // Через минуту после старта (не мешая выкату), дальше раз в шесть часов.
  setTimeout(runHousekeeping, 60 * 1000).unref?.();
  setInterval(runHousekeeping, 6 * 60 * 60 * 1000).unref?.();
}

module.exports = { runHousekeeping, scheduleHousekeeping };
