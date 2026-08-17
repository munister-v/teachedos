/* УБОРКА.

   Ничего из перечисленного ниже никогда не удалялось. Пока учителей десяток,
   это несколько сотен строк; при тысяче активных пользователей сессии растут
   на десятки тысяч строк в месяц, а auth_events — быстрее них, потому что
   пишутся и на неудачные попытки входа. Растёт не только диск: индекс по
   сессиям перестаёт помещаться в память, и проверка токена на КАЖДОМ запросе
   к API становится дороже.

   Сроки выбраны по смыслу, а не по вкусу: сессия после истечения не нужна
   никому (JWT живёт семь дней, так что её удаление ничего не разлогинивает —
   она уже недействительна), журнал входов нужен для разбора инцидентов и
   держится 90 дней, прочитанные уведомления после месяца не читает никто. */
const pool = require('../db/pool');

const TASKS = [
  ['expired sessions',   `DELETE FROM sessions WHERE expires_at <= NOW() - INTERVAL '1 day'`],
  ['old auth events',    `DELETE FROM auth_events WHERE created_at < NOW() - INTERVAL '90 days'`],
  ['read notifications', `DELETE FROM notifications WHERE read = TRUE AND created_at < NOW() - INTERVAL '30 days'`],
  ['used email tokens',  `DELETE FROM email_tokens WHERE expires_at <= NOW() - INTERVAL '7 days'`],
];

async function runHousekeeping() {
  for (const [label, sql] of TASKS) {
    try {
      const r = await pool.query(sql);
      if (r.rowCount) console.log(`[housekeeping] ${label}: removed ${r.rowCount}`);
    } catch (err) {
      // Таблицы может не быть на свежей базе — это не повод ронять остальные.
      if (!/does not exist/i.test(err.message)) console.warn(`[housekeeping] ${label}:`, err.message);
    }
  }
}

function scheduleHousekeeping() {
  // Через минуту после старта (не мешая выкату), дальше раз в шесть часов.
  setTimeout(runHousekeeping, 60 * 1000).unref?.();
  setInterval(runHousekeeping, 6 * 60 * 60 * 1000).unref?.();
}

module.exports = { runHousekeeping, scheduleHousekeeping };
