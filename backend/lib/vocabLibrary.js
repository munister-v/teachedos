/* НАСТОЯЩИЕ СЛОВА ДЛЯ ОФФЛАЙН-РЕЖИМА.

   Когда все провайдеры недоступны (нет сети, кончился бюджет, лежит OpenAI),
   генератор доходил до последней ветки и выдавал «challenge (airport)»,
   «project (airport)» - двадцать одинаковых заглушек с темой в скобках. Это
   формально урок, фактически мусор, и хуже честной ошибки: учитель узнаёт о
   подмене уже перед классом.

   В приложении при этом лежит собранная библиотека: 20 тем, 682 строки вида
   [en, uk, ru, пример]. Оффлайновый урок по теме «Аэропорт» должен получать
   настоящие аэропортовые слова с переводом и примером - тогда отказ ИИ
   означает урок попроще, а не сломанный урок.

   Библиотека живёт во фронтенде как браузерный скрипт (window.TEACHEDOS_VOCAB).
   Читаем и выполняем её с подставным window, вместо того чтобы копировать 682
   строки во второй файл: две копии словаря разъедутся на первой же правке. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CANDIDATES = [
  process.env.VOCAB_LIB_PATH,
  path.join(__dirname, '..', '..', 'repo', 'scripts', 'vocabulary.js'),
  '/var/www/teached/scripts/vocabulary.js',
  path.join(__dirname, '..', '..', 'scripts', 'vocabulary.js'),
].filter(Boolean);

let LIB = null;
let tried = false;

function lib() {
  if (tried) return LIB;
  tried = true;
  for (const file of CANDIDATES) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      const sandbox = { window: {}, console };
      vm.createContext(sandbox);
      vm.runInContext(code, sandbox, { timeout: 2000 });
      const v = sandbox.window.TEACHEDOS_VOCAB;
      if (v && v.topics) {
        LIB = v;
        console.log(`[vocab-lib] loaded ${Object.keys(v.topics).length} topics from ${file}`);
        return LIB;
      }
    } catch { /* следующий кандидат */ }
  }
  console.warn('[vocab-lib] not found; offline lessons fall back to generic words');
  return null;
}

/* Тема урока приходит свободным текстом («Airport small talk», «Аеропорт»),
   а в библиотеке ключи фиксированные. Сопоставляем по вхождению подстроки в
   обе стороны - этого хватает и не требует словаря синонимов. */
function matchTopic(topic) {
  const v = lib();
  if (!v) return null;
  const t = String(topic || '').toLowerCase().trim();
  if (!t) return null;
  const ids = Object.keys(v.topics);
  const score = (id) => {
    const meta = v.topics[id] || {};
    const names = [id, meta.title, meta.name].filter(Boolean).map(s => String(s).toLowerCase());
    for (const n of names) {
      if (n === t) return 3;
      if (t.includes(n) || n.includes(t)) return 2;
    }
    return 0;
  };
  let best = null, bestScore = 0;
  for (const id of ids) {
    const s = score(id);
    if (s > bestScore) { best = id; bestScore = s; }
  }
  if (bestScore) return best;

  /* Названия тем у учителя свои: «Airport small talk», «Дорога в отпуск».
     Ни одно не совпадёт с ключом travel, хотя нужен именно он. Смотрим, в
     какой теме встречаются слова самой формулировки: «airport» лежит в
     travel, и этого достаточно, чтобы попасть в нужный список. */
  const tokens = t.split(/[^a-zа-яіїєґ]+/i).filter(w => w.length > 3);
  if (!tokens.length) return null;
  let hitId = null, hits = 0;
  for (const id of ids) {
    const rows = (typeof v.getWords === 'function' ? v.getWords(id) : (v.topics[id]?.words || [])) || [];
    const flat = JSON.stringify(rows).toLowerCase();
    const n = tokens.filter(w => flat.includes(w)).length;
    if (n > hits) { hits = n; hitId = id; }
  }
  return hits ? hitId : null;
}

/* Слова темы в том виде, в каком их ждёт генератор карточек. */
function words(topic, count = 10) {
  const v = lib();
  const id = matchTopic(topic);
  if (!v || !id) return [];
  const rows = (typeof v.getWords === 'function' ? v.getWords(id) : (v.topics[id]?.words || [])) || [];
  return rows.slice(0, count).map(row => Array.isArray(row)
    ? { en: row[0], uk: row[1] || '', ru: row[2] || '', ex: row[3] || '' }
    : { en: row.en, uk: row.uk || '', ru: row.ru || '', ex: row.ex || row.example || '' }
  ).filter(w => w.en);
}

function available() { return !!lib(); }

module.exports = { words, matchTopic, available };
