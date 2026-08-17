/* ИНДЕКС «СЛОВО → СНИМОК».

   Каждый урок искал картинки заново, даже если это слово искали вчера и
   позавчера. Для фотобанка с лимитом 200 запросов в час это означает, что
   пятнадцать уроков по двенадцать слов выедают час для всей школы; для нас —
   что работа целиком зависит от чужой доступности в момент занятия.

   Найденное складывается сюда навсегда. Через месяц обычной работы индекс
   покрывает большую часть школьной лексики, и обращение наружу становится
   редким событием, а не нормой: повтор отдаётся мгновенно, бесплатно и без
   сети.

   Файл, а не таблица в БД: это кэш, а не данные — потеря его ничего не ломает,
   а нулевая настройка важнее транзакций. Лежит ВНЕ каталога бэкенда, потому
   что деплой синхронизирует backend/ с --delete и стёр бы его при каждом
   выкате.                                                                   */
const fs = require('fs');
const path = require('path');

const INDEX_PATH = process.env.IMAGE_INDEX_PATH
  || path.join(__dirname, '..', '..', 'data', 'image-index.json');

const MAX_ENTRIES = 20000;      // ~20k слов с запасом на все темы и уровни
const SAVE_DEBOUNCE_MS = 4000;  // запись пачкой: урок добавляет по 12 записей подряд

let index = new Map();
let dirty = false;
let saveTimer = null;
let loaded = false;

function keyOf(word, topic) {
  return `${String(word || '').trim().toLowerCase()}|${String(topic || '').trim().toLowerCase()}`;
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = fs.readFileSync(INDEX_PATH, 'utf8');
    const obj = JSON.parse(raw);
    index = new Map(Object.entries(obj.entries || {}));
    console.log(`[image-index] loaded ${index.size} entries from ${INDEX_PATH}`);
  } catch {
    console.log('[image-index] starting empty at', INDEX_PATH);
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
    console.warn('[image-index] save failed:', e.message);
  }
}

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, SAVE_DEBOUNCE_MS);
  saveTimer.unref?.();
}

function get(word, topic) {
  load();
  // Точное совпадение со темой, иначе — то же слово из любой темы: снимок
  // «luggage» из урока про аэропорт годится и для урока про переезд.
  return index.get(keyOf(word, topic)) || index.get(keyOf(word, '')) || null;
}

function put(word, topic, hits) {
  if (!word || !Array.isArray(hits) || !hits.length) return;
  load();
  if (index.size >= MAX_ENTRIES) {
    // Выбрасываем самую старую запись: карта хранит порядок вставки.
    index.delete(index.keys().next().value);
  }
  index.set(keyOf(word, topic), { hits: hits.slice(0, 4), at: Date.now() });
  scheduleSave();
}

function stats() {
  load();
  return { entries: index.size, path: INDEX_PATH, pendingWrite: dirty };
}

process.on('exit', save);
process.on('SIGTERM', () => { save(); process.exit(0); });

module.exports = { get, put, stats };
