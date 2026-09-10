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
const CAMBRIDGE = 'https://dictionary.cambridge.org';

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

/* ПРОИЗНОШЕНИЕ: транскрипция и запись голосом.

   Нужны карточке текста на доске: подсвеченное слово раскрывает окошко, где
   ученик видит /kʌt/ и может послушать слово. Берётся с той же страницы, что
   и определение, - лишнего запроса нет.

   Два места, где легко ошибиться, оба проверены на живых страницах:

   1) Транскрипция набрана вложенными span'ами: у «digestion» схва вынесена
      в <span class="sp dsp">ə</span>, и выборка «первый текстовый кусок»
      обрывала слово на /daɪˈdʒes.tʃ/. Поэтому блок целиком чистится от
      тегов, а из результата берётся то, что стоит между косыми чертами.
   2) Окно режется по началу СЛЕДУЮЩЕГО блока произношения (со смещением,
      иначе оно находит собственный заголовок): без этого британская выборка
      дотягивалась до американской транскрипции. */
function pronunciation(html, region) {
  const i = html.indexOf(`class="${region} dpron-i`);
  if (i < 0) return null;
  let chunk = html.slice(i, i + 1800);
  const next = chunk.indexOf('dpron-i', 40);
  if (next > 0) chunk = chunk.slice(0, next);

  const mp3 = (chunk.match(/<source type="audio\/mpeg" src="([^"]+\.mp3)"/) || [])[1];
  let ipa = null;
  const pi = chunk.indexOf('class="pron dpron">');
  if (pi >= 0) ipa = (stripTags(chunk.slice(pi, pi + 400)).match(/\/([^/]{1,40})\//) || [])[1] || null;

  if (!ipa && !mp3) return null;
  return {
    ipa: ipa ? ipa.trim() : null,
    audio: mp3 ? (mp3.startsWith('http') ? mp3 : CAMBRIDGE + mp3) : null,
  };
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
  // Британское произношение первым: это учебный словарь, и в нём оно основное.
  const pron = pronunciation(html, 'uk') || pronunciation(html, 'us');
  return { senses, pos, pron };
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

function blank(word) {
  return { word, definition: null, cefr: null, example: null, pos: null, ipa: null, audio: null, source: null };
}

async function lookup(word, level) {
  const w = String(word || '').trim();
  if (!w || w.length > 60) return blank(w);

  let entry = defIndex.get(w);
  if (!entry) {
    /* Одна повторная попытка. Проверено на живом сервере: из шести слов
       холодной пачки одно вернулось «unreachable», остальные пять - с
       определениями. Сеть моргнула ровно один раз, но для урока это
       значит пустую половину пары, которую учитель увидит на доске. */
    let fresh = await fetchCambridge(w);
    if (!fresh) {
      await new Promise(r => setTimeout(r, 250));
      fresh = await fetchCambridge(w);
    }
    if (!fresh) return { ...blank(w), error: 'unreachable' };
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
    /* Произношение у слова одно на все значения, поэтому берётся от статьи,
       а не от выбранного значения, и приходит даже когда подходящего по
       уровню определения не нашлось. */
    ipa: (entry.pron && entry.pron.ipa) || null,
    audio: (entry.pron && entry.pron.audio) || null,
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
    /* По четыре за раз, а не все двенадцать веером. Двенадцать
       одновременных соединений к чужому сайту - это и есть тот случай,
       когда одно из них молча обрывается; четырёх хватает, чтобы пачка
       из шести слов уложилась в те же полсекунды. */
    const out = new Array(words.length);
    let i = 0;
    async function worker() {
      while (i < words.length) {
        const cur = i++;
        out[cur] = await lookup(words[cur], level).catch(() => blank(words[cur]));
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, words.length) }, worker));
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
