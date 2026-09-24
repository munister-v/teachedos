/* Режим нескольких процессов (включается WEB_CONCURRENCY >= 2).

   Главный процесс ничего не обслуживает сам: один раз применяет миграцию,
   затем держит детей и перезапускает упавших.
   - web x N  - HTTP-API на общем PORT (cluster раздаёт соединения);
                апгрейд WebSocket пробрасывают сырым TCP в хаб.
   - hub x 1  - все комнаты совместной работы (они в памяти, поэтому ровно
                один процесс), фоновые задачи (напоминания, уборка) и
                внутренний /internal/online для «кто сейчас на доске».
   Для nginx и браузера ничего не меняется: всё по-прежнему на PORT.
   WEB_CONCURRENCY=1 (по умолчанию) - прежний один процесс, этот файл не
   загружается вовсе. На VPS 1.7 ГБ на десять проектов больше одного
   процесса включать не стоит - режим для сервера побольше. */
const cluster = require('cluster');
const crypto = require('crypto');

module.exports = async function runPrimary(webCount) {
  const migrate = require('../db/migrate');
  const pool = require('../db/pool');
  if (process.env.DATABASE_URL) {
    try { await migrate(); }
    catch (err) {
      console.error('[cluster] migration failed, not starting workers:', err.message);
      process.exitCode = 1;
      await pool.end().catch(() => {});
      return;
    }
  }
  await pool.end().catch(() => {});                 // главному база больше не нужна

  const hubPort = String(parseInt(process.env.TEACHED_HUB_PORT, 10) || 4101);
  const secret = crypto.randomBytes(24).toString('hex');
  const baseEnv = { TEACHED_HUB_PORT: hubPort, TEACHED_HUB_SECRET: secret, TEACHED_SKIP_MIGRATE: '1' };
  const roles = new Map();                          // worker.id -> role
  let stopping = false;
  const backoff = { hub: 0, web: 0 };

  function spawn(role) {
    const w = cluster.fork({ ...baseEnv, TEACHED_ROLE: role });
    roles.set(w.id, role);
    w.on('online', () => { setTimeout(() => { backoff[role] = 0; }, 30000).unref(); });
    return w;
  }
  cluster.on('exit', (w, code, signal) => {
    const role = roles.get(w.id); roles.delete(w.id);
    if (stopping || !role) return;
    backoff[role] = Math.min(30000, backoff[role] ? backoff[role] * 2 : 500);
    console.error(`[cluster] ${role} ${w.process.pid} exited (${signal || code}), restarting in ${backoff[role]}ms`);
    setTimeout(() => { if (!stopping) spawn(role); }, backoff[role]);
  });

  spawn('hub');
  for (let i = 0; i < webCount; i++) spawn('web');
  console.log(`[cluster] primary ${process.pid}: 1 hub on 127.0.0.1:${hubPort} + ${webCount} web workers`);

  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.once(sig, () => {
      stopping = true;
      for (const id in cluster.workers) cluster.workers[id].process.kill('SIGTERM');
      setTimeout(() => process.exit(0), 5000).unref();
      cluster.on('exit', () => { if (!Object.keys(cluster.workers).length) process.exit(0); });
    });
  }
};
