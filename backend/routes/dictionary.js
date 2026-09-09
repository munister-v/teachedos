/* GET /api/dictionary/define?w=<word>[&level=B2][&words=a,b,c]

   ЗАЧЕМ ЭТО ВООБЩЕ ЕСТЬ.

   «Match words to meanings» в уроке по чтению собирается локальным
   генератором (_ttGenWordDefinitionMatch в scripts/board-gen.js): он
   берёт значение из пояснения учителя, из предложения текста или из
   маленькой встроенной библиотеки. Для урока про травмы («bruise»,
   «blister», «digestion») там нет ничего, и на доску ехала пара
   «Bruise — » с пустой правой половиной: задание есть, а сопоставлять
   не с чем.

   ПОЧЕМУ CAMBRIDGE, А НЕ СЛОВАРНЫЙ API.

   Открытого API у Cambridge нет (их собственный - платный, для
   издателей). Но учебный словарь для изучающих язык - именно то, что
   нужно ESL-уроку: определения написаны ограниченной лексикой, и у
   значений проставлен уровень CEFR (A1-C2) - тот самый, которым
   оперирует урок. Ни один бесплатный словарный API (Wiktionary и
   производные) уровня не даёт, а его определения написаны для
   носителей: «bruise: an injury appearing as an area of discoloured
   skin» - для B1 это сложнее самого слова.

   Берутся ОБЫЧНЫЕ СТРАНИЦЫ СТАТЕЙ (/dictionary/english/<word>).
   robots.txt закрывает /search/, /autocomplete/, /info/, /auth/ -
   страницы статей там не запрещены. Каждое слово запрашивается один
   раз за всё время жизни сервера (см. lib/defIndex.js) и уходит в
   вечный кэш, включая отрицательный ответ, поэтому нагрузка на чужой
   сайт - это десяток запросов на новый урок, а не по запросу на
   каждую сборку.

   ЧЕГО ЗДЕСЬ НЕТ.

   Фраз. «severe burn», «doesn't agree with me» - это не заголовки
   словарных статей, и никакой словарь их не найдёт. Такие возвращаются
   с definition:null, и фронт добирает их движком (у него есть и
   уровень, и тема урока) - словарь для слов, AI для всего остального. */
const router = require('express').Router();
const defIndex = require('../lib/defIndex');

const TIMEOUT = 7000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
           'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const CEFR_ORDER = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

function stripTags(html) {
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Одно слово - одна страница. Разбор построен на классах разметки
   Cambridge; если они поменяются, senses придёт пустым и слово просто
   уйдёт на AI-ветку - страница не «сломается», станет как раньше. */
async function fetchCambridge(word) {
  const slug = String(word).toLowerCase().trim().replace(/\s+/g, '-');
  const url = 'https://dictionary.cambridge.org/dictionary/english/' + encodeURIComponent(slug);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  let html = '';
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    });
    if (!r.ok) return { senses: [], pos: null };
    html = await r.text();
  } catch {
    return null;              // сеть/таймаут - НЕ кэшируем, попробуем в другой раз
  } finally { clearTimeout(t); }

  /* У блока значения класс с висящим пробелом: `ddef_block "`. */
  const blocks = html.split(/class="def-block ddef_block\s*"/).slice(1);
  const senses = [];
  for (const b of blocks.slice(0, 4)) {
    const dm = b.match(/class="def ddef_d db">([\s\S]*?)<\/div>/);
    if (!dm) continue;
    const def = stripTags(dm[1]).replace(/\s*:\s*$/, '');
    if (!def) continue;
    const lm = b.match(/class="epp-xref dxref ([A-C][12])"/);
    /* Берём именно <span class="eg deg"> - само предложение. Внутри
       блока примера ему может предшествовать <span class="lu dlu"> с
       коллокацией, и без этого сужения пример склеивался в
       «covered in bruises His arms and back were covered in bruises.» */
    const em = b.match(/class="eg deg">([\s\S]*?)<\/span>\s*(?:<\/div>|<span class="trans)/)
            || b.match(/class="eg deg">([\s\S]*?)<\/span>/);
    senses.push({
      def,
      cefr: lm ? lm[1] : null,
      example: em ? stripTags(em[1]).slice(0, 120) : null,
    });
  }
  const pos = (html.match(/class="pos dpos"[^>]*>([^<]+)</) || [])[1] || null;
  return { senses, pos };
}

/* Какое значение показать ученику.

   Cambridge выдаёт значения по частоте: первое - самое обычное. Но у
   многозначных слов уровень значений разный, и урок B2 не должен
   получить определение уровня C2 просто потому, что оно стоит первым.
   Поэтому: сначала самое частое из тех, что не выше уровня урока; если
   таких нет - просто самое частое. Для «cut» на B2 это даёт A2-значение
   «разрезать ножом», а не B2-«сократить расходы»: в уроке про травмы
   верно именно первое, и оно же первое по частоте. */
function pickSense(senses, level) {
  if (!Array.isArray(senses) || !senses.length) return null;
  const cap = CEFR_ORDER[String(level || '').toUpperCase()];
  if (cap) {
    const fit = senses.find(s => s.cefr && CEFR_ORDER[s.cefr] <= cap);
    if (fit) return fit;
  }
  return senses[0];
}

async function lookup(word, level) {
  const w = String(word || '').trim();
  if (!w || w.length > 60) return { word: w, definition: null, source: null };

  let entry = defIndex.get(w);
  if (!entry) {
    const fresh = await fetchCambridge(w);
    if (!fresh) return { word: w, definition: null, source: null, error: 'unreachable' };
    entry = fresh;
    defIndex.put(w, fresh);           // включая пустой senses: «нет статьи» - тоже ответ
  }

  const sense = pickSense(entry.senses, level);
  return {
    word: w,
    definition: sense ? sense.def : null,
    cefr: sense ? sense.cefr : null,
    example: sense ? sense.example : null,
    pos: entry.pos || null,
    source: sense ? 'cambridge' : null,
  };
}

/* Пачкой, а не по одному запросу на слово: у задания их шесть-двенадцать,
   и браузер, открывающий двенадцать соединений подряд ради шести строк,
   отвечает медленнее, чем один запрос, который делает то же самое
   параллельно на сервере. */
router.get('/define', async (req, res) => {
  const level = String(req.query.level || '').slice(0, 4);
  const many = String(req.query.words || '').trim();
  const one = String(req.query.w || '').trim();

  if (many) {
    const words = many.split(/[,;\n]/).map(s => s.trim()).filter(Boolean).slice(0, 20);
    const out = await Promise.all(words.map(w => lookup(w, level).catch(() => ({ word: w, definition: null }))));
    return res.json({ results: out });
  }
  if (!one) return res.json({ results: [] });
  const single = await lookup(one, level).catch(() => ({ word: one, definition: null }));
  res.json({ results: [single], ...single });
});

/* Сколько слов уже лежит локально - тот же вопрос, что и у
   /api/images/status: «работает ли подбор или молча падает». */
router.get('/status', (req, res) => {
  res.json({ ok: true, index: defIndex.stats(), source: 'cambridge (learner dictionary pages)' });
});

module.exports = router;
