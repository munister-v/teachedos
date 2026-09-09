/* ИНДЕКС «СЛОВО → ОПРЕДЕЛЕНИЕ».

   Тот же приём, что и у image-index (lib/imageIndex.js), и по той же
   причине: школьная лексика повторяется из урока в урок, а за каждым
   определением стоит поход на чужой сайт. Найденное складывается сюда
   навсегда, и повтор отдаётся мгновенно, без сети.

   Здесь это ещё и вопрос вежливости, а не только скорости: словарь
   Cambridge - не API, а обычные страницы статей. Ходить туда за одним и
   тем же словом каждый раз, когда учитель собирает урок про травмы,
   значит долбить чужой сайт ради данных, которые не меняются годами.

   Файл лежит РЯДОМ с image-index и вне каталога бэкенда по той же
   причине: deploy.sh синхронизирует backend/ с --delete и стёр бы кэш
   при каждом выкате.                                                     */
const fs = require('fs');
const path = require('path');

const INDEX_PATH = process.env.DEF_INDEX_PATH
  || path.join(__dirname, '..', '..', 'data', 'def-index.json');

const MAX_ENTRIES = 40000;      // слов в школьной программе на порядок меньше
const SAVE_DEBOUNCE_MS = 4000;  // урок добавляет по 6-12 записей подряд

let index = new Map();
let dirty = false;
let saveTimer = null;
let loaded = false;

function keyOf(word) {
  return String(word || '').trim().toLowerCase();
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const obj = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    index = new Map(Object.entries(obj.entries || {}));
    console.log(`[def-index] loaded ${index.size} entries from ${INDEX_PATH}`);
  } catch {
    console.log('[def-index] starting empty at', INDEX_PATH);
  }
}

function save() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
    const tmp = INDEX_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      entries: Object.fromEntries(index),
    }));
    fs.renameSync(tmp, INDEX_PATH);   // атомарно: половина файла хуже, чем его отсутствие
  } catch (e) {
    console.warn('[def-index] save failed:', e.message);
  }
}

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, SAVE_DEBOUNCE_MS);
  saveTimer.unref?.();
}

function get(word) {
  load();
  return index.get(keyOf(word)) || null;
}

/* Пишем и ОТРИЦАТЕЛЬНЫЙ результат тоже (senses: []). Без этого фразы
   вроде «severe burn», которых в словаре нет и не будет, отправляли бы
   запрос на каждую сборку урока - а «не нашлось» это такой же
   стабильный факт, как и найденное определение. */
function put(word, entry) {
  if (!word || !entry) return;
  load();
  if (index.size >= MAX_ENTRIES) index.delete(index.keys().next().value);
  index.set(keyOf(word), { ...entry, at: Date.now() });
  scheduleSave();
}

function stats() {
  load();
  let withSenses = 0;
  for (const v of index.values()) if (v && Array.isArray(v.senses) && v.senses.length) withSenses++;
  return { entries: index.size, withSenses, path: INDEX_PATH, pendingWrite: dirty };
}

process.on('exit', save);
process.on('SIGTERM', () => { save(); process.exit(0); });

module.exports = { get, put, stats };
