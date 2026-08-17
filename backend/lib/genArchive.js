/* АРХИВ УДАЧНЫХ ГЕНЕРАЦИЙ.

   Когда модель недоступна — сеть, квота, суточный порог — урок собирается
   локальными шаблонами. Они честные, но заметно площе, и учитель это видит.
   При этом такой же урок («Present Perfect, A2, 12 заданий») уже собирался
   на прошлой неделе и был нормальным: результат просто жил тридцать минут в
   памяти процесса и умирал при первом же выкате.

   Здесь удачные ответы модели складываются на диск надолго. Это НЕ обычный
   кэш и он не отдаётся в штатном режиме: два класса не должны получать один
   и тот же лист только потому, что тема совпала. Архив открывается ровно
   тогда, когда альтернатива — шаблоны, и урок из него честно помечен как
   собранный ранее и с датой.

   Ключ намеренно грубее обычного кэша: без userId и без точного текста
   источника. Совпадение по инструменту, уровню и теме — это и есть тот
   случай, когда чужой прошлый лист лучше сегодняшней заглушки.             */
const fs = require('fs');
const path = require('path');

const ARCHIVE_PATH = process.env.GEN_ARCHIVE_PATH
  || path.join(__dirname, '..', '..', 'data', 'gen-archive.json');

const MAX_ENTRIES = 600;                       // ~600 листов, единицы мегабайт
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 120;  // 120 дней: старше уже неинтересно
const SAVE_DEBOUNCE_MS = 5000;

let store = new Map();
let loaded = false;
let dirty = false;
let timer = null;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const obj = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf8'));
    store = new Map(Object.entries(obj.entries || {}));
    console.log(`[gen-archive] loaded ${store.size} lessons from ${ARCHIVE_PATH}`);
  } catch {
    console.log('[gen-archive] starting empty at', ARCHIVE_PATH);
  }
}

function save() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(path.dirname(ARCHIVE_PATH), { recursive: true });
    const tmp = ARCHIVE_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), entries: Object.fromEntries(store) }));
    fs.renameSync(tmp, ARCHIVE_PATH);
  } catch (e) {
    console.warn('[gen-archive] save failed:', e.message);
  }
}

function scheduleSave() {
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(save, SAVE_DEBOUNCE_MS);
  timer.unref?.();
}

function keyOf(input) {
  const topic = String(input.topic || '').toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 60);
  return [input.toolId, input.level, input.count, topic, input.genre || '', input.action || ''].join('|');
}

/* Кладём только то, что действительно собрала модель: шаблонный урок в
   архиве бессмыслен — им мы и так умеем отвечать. */
function put(input, output) {
  if (!output || (output.engine !== 'ai' && output.engine !== 'backup')) return;
  load();
  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
  store.set(keyOf(input), { at: Date.now(), engine: output.engine, output });
  scheduleSave();
}

function get(input) {
  load();
  const hit = store.get(keyOf(input));
  if (!hit) return null;
  if (Date.now() - hit.at > MAX_AGE_MS) { store.delete(keyOf(input)); scheduleSave(); return null; }
  // Копия: вызывающий дописывает в объект пометки, а архив должен пережить это нетронутым.
  return { at: hit.at, engine: hit.engine, output: JSON.parse(JSON.stringify(hit.output)) };
}

function stats() {
  load();
  return { entries: store.size, path: ARCHIVE_PATH };
}

process.on('exit', save);
process.on('SIGTERM', () => { save(); process.exit(0); });

module.exports = { get, put, stats };
