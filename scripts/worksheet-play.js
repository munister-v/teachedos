/* ПРОИГРЫВАТЕЛЬ ЛИСТА - ОБЩИЙ ДЛЯ ДОСКИ И ДОМАШКИ.

   Этот файл собирает по данным карточки самостоятельный HTML-документ, который
   доска и страница домашки кладут в песочный iframe. Раньше он жил внутри
   board-app.js, и следствие было простое: у ученика в домашке листа НЕ БЫЛО.
   `renderCardForStudent` знал game / checklist / voting / lesson / timer, а
   любая карточка-лист упиралась в заглушку «isn't directly playable yet» с
   кнопкой «отметить выполненным». Письменная мастерская, задуманная как
   домашнее задание, до ученика не доезжала вовсе.

   Копировать рендерер во вторую страницу было нельзя: в этом проекте уже
   расходились два независимых реестра инструментов, и стоило это дня работы.
   Поэтому не копия, а один файл на обоих.

   Тут нет ничего про доску: функция чистая, на вход - данные карточки, её id,
   признак владельца и ШИРИНА карточки (от неё зависит раскладка внутри кадра -
   колонки, высота плитки, вертикальная раскладка на телефоне). Размер самой
   карточки на доске считает _ttPlayCardSize, он остался в board-app.js.

   Грузится ПЕРЕД board-app.js: объявления верхнего уровня классического
   скрипта общие, поэтому доска видит эти имена как раньше. */


/* Worksheet output palette. Lime is the default brand highlight, but when the
   teacher picks a card accent we turn that one hex into a full readable theme:
   fill, text-on-fill, muted text and soft borders. Kept next to the worksheet
   renderers because this belongs to generated output, not the tool picker. */
const WS_ACCENT_INK = '#0E0E10';

const WS_ACCENT_LIME = '#CDF24F';

/* ЛАЙМ - ЗАЛИВКА, А НЕ ЧЕРНИЛА.

   Фирменный #CDF24F на белом даёт 1.36:1 - это не «бледновато», это текст,
   которого физически не видно. А в Play-режиме им набраны заголовок листа,
   счёт, стрелки шага, шапки колонок сортировки - всё, что стоит на белом.
   Учитель присылал это скриншотом трижды, каждый раз про новое место:
   правится не место, а само правило.

   Отсюда одна производная: тот же тон, притемнённый ровно настолько, чтобы
   на белом читался (WCAG AA, 4.5:1 для мелкого текста). Считается из
   accent, а не задан константой, потому что accent у карточки может быть
   свой - и тогда «тёмный лайм» был бы просто чужим цветом.

   Заливки, рамки и подсветки остаются самим accent: там он и работает. */
/* Цель чуть выше порога 4.5 не для запаса «на всякий случай»: те же
   чернила ложатся не только на белое, но и на 12-процентную заливку тем же
   accent'ом (.iw-opt.selected, .iw-tf-btn.selected). Фон там темнее белого,
   и ink, посчитанный ровно на 4.5 по белому, на нём проваливался до 4.45. */
function _accentInkOnWhite(hex, target = 4.9) {
  const rgb = _hexToRgb(hex);
  if (!rgb) return '#0E0E10';
  const lum = ({ r, g, b }) => {
    const s = [r, g, b].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const onWhite = c => 1.05 / (lum(c) + 0.05);
  let c = { ...rgb };
  /* Умножаем каналы, а не вычитаем: пропорция между ними сохраняется,
     значит сохраняется и оттенок - тёмный лайм остаётся лаймом, а не
     уезжает в серый или в бутылочно-зелёный. */
  for (let i = 0; i < 40 && onWhite(c) < target; i++) {
    c = { r: Math.round(c.r * 0.92), g: Math.round(c.g * 0.92), b: Math.round(c.b * 0.92) };
  }
  return '#' + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function _ttWorksheetStageMeta(title = '', index = 0) {
  const t = String(title).toLowerCase();
  // 'anchor' marks the two bookend stages of a lesson (start/end) - see
  // .ws-anchor in board.css. Everything else is a regular middle stage.
  if (/\baims?\b|objective|goal/.test(t)) return { cls:'ws-stage-aims', icon:'AIM', label:'Aims', anchor:'start' };
  if (/glossary|vocab|word/.test(t)) return { cls:'ws-stage-vocab', icon:'VOC', label:'Language bank' };
  if (/before|lead|warm/.test(t)) return { cls:'ws-stage-before', icon:'Q', label:'Before task' };
  if (/after|discussion|follow/.test(t)) return { cls:'ws-stage-after', icon:'GO', label:'After task' };
  if (/practice|production/.test(t)) return { cls:'ws-stage-practice', icon:'PR', label:'Practice' };
  if (/reading|text|article|story/.test(t)) return { cls:'ws-stage-reading', icon:'IN', label:'Input text' };
  if (/grammar|rule|focus/.test(t)) return { cls:'ws-stage-grammar', icon:'FX', label:'Focus' };
  if (/homework|assignment/.test(t)) return { cls:'ws-stage-default', icon:String(index + 1), label:'Homework', anchor:'end' };
  return { cls:'ws-stage-default', icon:String(index + 1), label:'Stage' };
}

/* One "term - definition" line, or null if the line is not a pair.
   The separator has to be a real one. A bare hyphen cannot be it: compound
   words (Pre-teach, role-play, follow-up) carry hyphens inside them and would
   split at the wrong place, so a hyphen only counts when it is spaced. Em and
   en dashes are unambiguous, and a colon counts when it is followed by space.
   Both sides are then sanity-checked - a term is a couple of words, not a
   clause, and a gloss is a phrase, not a paragraph. */
function _ttParseVocabLine(line) {
  const clean = String(line).replace(/^\s*[-•]\s*/, '').trim();
  const m = clean.match(/^(.{1,40}?)(?:\s+[-]\s+|\s*[-]\s*|:\s+)(.+)$/);
  if (!m) return null;
  const term = _ttStripMd(m[1]).trim();
  const def = m[2].trim();
  if (!term || !def) return null;
  if (term.split(/\s+/).length > 4) return null;   // a clause, not a term
  if (/[.!?]$/.test(term)) return null;            // a finished sentence
  if (def.length > 160) return null;               // prose, not a gloss
  return { term, def };
}

/* The list element that holds what _ttWorksheetListHTML returns. Questions and
   lesson stages are ordered sequences and lesson stages are literally numbered,
   so they are an <ol>; a glossary is an unordered bank of words, so it is a
   <ul>. Both the board and the print view build their container from here, so
   the two cannot drift into different markup for the same content - and the
   items themselves are <li>, which is what makes a worksheet readable to a
   screen reader ("list, 8 items") and survivable as pasted HTML. */
/* Снимок, подобранный к паре на сборке урока («Match words to pictures»).

   Одна точка на все три рендера - лист, доска и расчёт высоты, - потому
   что расхождение здесь стоило бы урока: карточка нарисовала бы
   фотографии, а высоту доска посчитала бы по строке текста.

   thumb принимается наравне с url: в подборщике картинок пара получает
   оба поля, но у набора, пришедшего из архива, бывает только миниатюра -
   а показать миниатюру всё равно лучше, чем поисковый запрос текстом. */
function _ttPairPic(p) {
  const img = p && p.img;
  return (img && (img.thumb || img.url)) || '';
}

/* МАТЕРИАЛ ЧИТАЮТ, А НЕ УГАДЫВАЮТ.

   В Play-режиме любая карточка с cards[] становилась флип-картой: лицо с
   заголовком и «tap to reveal», под ним спрятанное тело. Для коллокаций и
   фразовых глаголов это верно - заголовок там и есть то, что вспоминают.
   Но текст урока приезжает тем же cards[], и ученик получал салатовый
   прямоугольник «📖 Reading text · tap to reveal» вместо самого текста,
   а после переворота - тот же текст в коробке фиксированной высоты 240px
   с прокруткой внутри.

   Признак ставит укладчик урока (`_ttMaterial`, см. placeBoardLessonStageSet):
   там это ЗНАЮТ, а ответ сервера поля kind не несёт вовсе - у текста,
   написанного движком, по нему гадать нечего. kind остаётся вторым путём:
   по нему узнаётся учительский текст (_ttOwnTextOutput) и одиночный
   инструмент, открытый из каталога. */
const TT_MATERIAL_KINDS = ['reading text', 'transcript', 'dialogue', 'model', 'in context'];

function _ttIsMaterialCards(d) {
  if (!d || !Array.isArray(d.cards) || !d.cards.length) return false;
  return d._ttMaterial === 1
      || TT_MATERIAL_KINDS.includes(String(d.kind || '').trim().toLowerCase());
}

/* ДОСКА ВОПРОСОВ, А НЕ СЛАЙДЕР.

   Speaking-подсказки степпер показывал по одной: проверять в них нечего,
   зато класс не видел, куда идёт разговор, а учитель не мог раздать вопросы
   в своём порядке - только листать. Такие наборы (все вопросы открытые и
   тема разговорная) раскладываются сеткой рубашкой вверх.

   Гейт по cat/kind, а не «все вопросы open»: у «Open questions» после текста
   ученик ПИШЕТ ответы, и прятать задание под рубашку там незачем. */
function _ttIsPromptDeck(d) {
  const qs = d && Array.isArray(d.questions) ? d.questions : null;
  if (!qs || qs.length < 2 || !qs.every(q => q && q.type === 'open')) return false;
  const kind = String(d.kind || '').toLowerCase();
  if (/odd/.test(kind)) return false;
  return String(d.cat || '').toLowerCase() === 'speaking'
      || /discussion|ladder|conversation|talk|debate/.test(kind);
}

/* ПИСЬМЕННАЯ РАБОТА - ЭТО РАБОЧЕЕ МЕСТО, А НЕ ЧЕТЫРЕ КАРТОЧКИ.

   creative-writing отдаёт четыре карточки (задание, требования, полезные
   фразы, образец начала), и в Play они становились колодой «переверни меня»:
   писать было негде, а требования, по которым пишут, лежали под рубашкой.
   Разбираем набор по ролям - остальное делает ветка мастерской. */
function _ttWritingTask(d) {
  const cards = d && Array.isArray(d.cards) ? d.cards : null;
  if (!cards || cards.length < 2 || _ttIsMaterialCards(d)) return null;
  const pick = re => cards.find(c => re.test(String(c && c.title || '')));
  const prompt = pick(/writing prompt|^\s*task\b|prompt/i);
  const reqs   = pick(/requirement|success criteria|checklist/i);
  if (!prompt || !reqs) return null;
  return {
    prompt,
    reqs,
    phrases: pick(/useful phrase|phrases|language bank/i) || null,
    model:   pick(/model|example opener|sample/i) || null,
    extras:  cards.filter(c => c !== prompt && c !== reqs
              && !/useful phrase|phrases|language bank|model|example opener|sample/i.test(String(c && c.title || ''))),
  };
}

/* СЕТКА ДОСКИ ВОПРОСОВ СЧИТАЕТСЯ ОДИН РАЗ, НА ДВОИХ.

   Обе стороны флип-плитки лежат absolute, поэтому её высота задаётся числом,
   а не содержимым: посчитать её надо ДО разметки, и ровно так же посчитать
   размер самой карточки. Пока это были две формулы, они и разошлись - на
   телефоне карточка ужималась зумом доски, а плитка оставалась «десктопной»
   и текст в ней обрезался.

   Колонки берём явным числом, а не auto-fill: тогда ширина колонки известна
   здесь, а не только браузеру, и по ней считаются строки текста. */
function _ttDeckMetrics(qs, cardW) {
  const W = Math.max(240, cardW || 720);
  /* Два столбца держим до последнего: доска вопросов тем и отличается от
     списка, что видно всё поле сразу, а рубашка «Q1» читается в любой
     ширине. Порог 280, чтобы iPhone SE (карточка 292) остался доской, а не
     стал столбиком из шести штук. Тесноту оборота добирает высота плитки:
     она считается по строкам, поэтому узкая колонка просто выше. */
  const cols = W >= 620 ? 3 : W >= 280 ? 2 : 1;
  const pad = W < 620 ? 20 : 26;                    // поля плитки, узкой они меньше
  const colW = (W - 36 - (cols - 1) * 12) / cols;
  /* 0.85 - плата за перенос ПО СЛОВАМ. Деление длины на «знаков в строке»
     считает, будто строка заполняется до последнего символа; на деле в конце
     каждой пропадает недописанное слово, и чем уже колонка, тем дороже это
     обходится. Без поправки плитка на 320px выходила ровно на строку короче,
     и последняя строка вопроса уезжала под край. */
  const perRow = Math.max(10, (colW - pad) / 6.6 * 0.85);  // 13px system-ui
  const longest = qs.reduce((n, q) => Math.max(n, String(q.text || '').length), 0);
  const rows = Math.max(1, Math.ceil(longest / perRow));
  /* Пол в 150px - не про текст, а про палец: на обороте лежат поле ответа и
     кнопка «перевернуть назад», и им нужно место. */
  const tile = Math.max(150, Math.min(320, 104 + rows * 20));
  return { cols, tile, rows: Math.ceil(qs.length / cols) };
}

/* Сколько слов ждут: «about 150-180 words» → 180. Верхняя граница, а не
   нижняя - счётчик показывает цель, до которой ученик дописывает. */
function _ttWordTarget(text) {
  const m = String(text || '').match(/(\d{2,4})\s*(?:-|–|—|to)\s*(\d{2,4})\s*words|(\d{2,4})\s*words/i);
  if (!m) return 150;
  return parseInt(m[2] || m[3] || m[1], 10) || 150;
}

/* Замерить содержимое srcdoc-iframe снаружи нельзя, поэтому разметка меряет
   себя сама и присылает высоту (приёмник - обработчик 'iw-height' выше).

   Годится НЕ всякой карточке: у степпера на экране один шаг из шести, и
   карточка, следующая за его высотой, дёргалась бы на каждом «дальше».
   Только там, где всё содержимое видно сразу: материал и лист «все пропуски». */
const IW_HEIGHT_REPORTER = `
var _iwRH=0;
function iwReportHeight(){
  try{
    var h=Math.ceil(document.documentElement.scrollHeight);
    if(Math.abs(h-_iwRH)<4) return; _iwRH=h;
    if(window.__IW_CARD__) parent.postMessage({type:'iw-height',cardId:window.__IW_CARD__,height:h},'*');
  }catch(e){}
}
window.addEventListener('load',iwReportHeight);
document.addEventListener('DOMContentLoaded',iwReportHeight);
if(window.ResizeObserver) new ResizeObserver(iwReportHeight).observe(document.body);`;

/* КЛАВИАТУРА НА ТЕЛЕФОНЕ ЗАКРЫВАЕТ ТО, ВО ЧТО ПИШУТ.

   Содержимое кадра ровно по размеру кадра, прокручивать внутри нечего, а сам
   кадр лежит в трансформированном полотне доски - браузеру некуда «подвести
   элемент в вид», и он не делает ничего. Проверено пальцем: с открытой
   клавиатурой на экране остаются задание и требования, а поле ввода, в
   которое ученик печатает, уезжает вниз за край. Писать вслепую.

   Кадр не может подвинуть доску сам (чужой источник), поэтому он только
   сообщает, где у него оказалось поле; подводит его обработчик 'iw-focus'
   снаружи. Шлём в координатах документа кадра - снаружи их пересчитают в
   координаты доски, зная положение карточки и масштаб. */
const IW_FOCUS_REPORTER = `
function iwFocusable(t){ return !!t && (t.isContentEditable || t.tagName==='TEXTAREA' || t.tagName==='INPUT'); }
document.addEventListener('focusin',function(e){
  if(!iwFocusable(e.target) || !window.__IW_CARD__) return;
  var r=e.target.getBoundingClientRect();
  parent.postMessage({type:'iw-focus',cardId:window.__IW_CARD__,
    top:Math.round(r.top+(window.scrollY||0)),height:Math.round(r.height)},'*');
});
document.addEventListener('focusout',function(e){
  if(!iwFocusable(e.target) || !window.__IW_CARD__) return;
  parent.postMessage({type:'iw-blur',cardId:window.__IW_CARD__},'*');
});`;

/* КАРТОЧКА СЛОВА ПОД ПОДСВЕЧЕННЫМ СЛОВОМ.

   Данные (__IW_WORDS__) приезжают готовыми снаружи: внутри песочницы у
   документа непрозрачный источник, и любой его запрос к нашему же API
   получает 403 - см. [[teached-worksheet-sandbox-iframe]]. Здесь только
   показ.

   Озвучка: сначала запись голосом из словаря (обычный <audio>, CORS ему не
   нужен), а если у слова записи нет - что бывает у фраз вроде «doesn't
   agree with me», их в словаре просто нет - синтез речи браузера. Кнопка
   рисуется только когда есть чем звучать. */
const IW_WORD_HELP_SCRIPT = `
(function(){
  var W = window.__IW_WORDS__ || {};
  var norm = function(s){ return String(s||'').toLowerCase().replace(/[\\u2019]/g,"'").replace(/[^a-z0-9' ]+/g,' ').replace(/\\s+/g,' ').trim(); };
  var box = null, audio = null;
  function close(){ if(box){ box.remove(); box = null; } if(audio){ audio.pause(); audio = null; } }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function row(label, inner){ return '<div class="iw-wh-row"><span class="iw-wh-label">' + label + '</span>' + inner + '</div>'; }

  function open(el, info){
    close();
    box = document.createElement('div');
    box.className = 'iw-wh';
    var canSay = !!info.audio || !!window.speechSynthesis;
    var html = '<div class="iw-wh-head"><span class="iw-wh-word">' + esc(info.word) + '</span>'
      + (info.pos ? '<span class="iw-wh-pos">' + esc(info.pos) + '</span>' : '')
      + '<button type="button" class="iw-wh-x" aria-label="Close">&times;</button></div>';
    if (info.ipa || canSay) {
      html += row('Phonetics &amp; pronunciation', '<div class="iw-wh-ipa">'
        + (canSay ? '<button type="button" class="iw-wh-say" aria-label="Listen">&#128266;</button>' : '')
        + '<span>' + (info.ipa ? '/' + esc(info.ipa) + '/' : '') + '</span></div>');
    }
    if (info.meaning)  html += row('Meaning', '<div>' + esc(info.meaning) + '</div>');
    if (info.synonyms) html += row('Synonyms', '<div>' + esc(info.synonyms) + '</div>');
    if (info.example)  html += row('Example', '<div class="iw-wh-eg">' + esc(info.example) + '</div>');
    box.innerHTML = html;
    document.body.appendChild(box);

    /* Карточка текста невысокая, а окошко со всеми четырьмя строками бывает
       выше половины её высоты. Простое «не влезло снизу - показать сверху»
       давало худшее из возможного: окно упиралось в верхний край и
       накрывало ровно то слово, которое объясняет. Поэтому выбирается
       сторона, где места больше, и высота ограничивается этим местом -
       окно всегда целиком видно и никогда не закрывает слово. */
    var r = el.getBoundingClientRect();
    var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    var below = vh - r.bottom - 18, above = r.top - 18;
    var down = below >= Math.min(box.offsetHeight, above);
    box.style.maxHeight = Math.max(96, Math.round(down ? below : above)) + 'px';
    box.style.overflowY = 'auto';
    var h = box.offsetHeight;
    box.style.left = Math.max(10, Math.min(r.left, vw - box.offsetWidth - 10)) + 'px';
    box.style.top = (down ? r.bottom + 8 : Math.max(10, r.top - h - 8)) + 'px';

    box.querySelector('.iw-wh-x').addEventListener('click', close);
    var say = box.querySelector('.iw-wh-say');
    if (say) say.addEventListener('click', function(){
      say.classList.add('is-playing');
      var done = function(){ say.classList.remove('is-playing'); };
      if (info.audio) {
        audio = new Audio(info.audio);
        audio.addEventListener('ended', done);
        audio.addEventListener('error', done);
        audio.play().catch(done);
      } else if (window.speechSynthesis) {
        var u = new SpeechSynthesisUtterance(info.word);
        u.lang = 'en-GB'; u.onend = done; u.onerror = done;
        window.speechSynthesis.speak(u);
      } else done();
    });
  }

  document.addEventListener('click', function(e){
    var hit = e.target.closest ? e.target.closest('.iw-read-p strong') : null;
    if (hit) {
      var info = W[norm(hit.textContent)];
      if (info) { e.stopPropagation(); open(hit, info); }
      return;
    }
    if (box && !(e.target.closest && e.target.closest('.iw-wh'))) close();
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });

  /* Помечаются только те слова, по которым есть что показать: подчёркивание
     и курсор - обещание, и слово без данных его бы не сдержало. */
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.iw-read-p strong').forEach(function(s){
      if (W[norm(s.textContent)]) s.setAttribute('data-wh', '1');
    });
  });
})();`;

function _buildInteractiveWSHtml(d, cardId, ownerView, cardW) {
  const qs = Array.isArray(d.questions) ? d.questions : [];
  const items = Array.isArray(d.items) ? d.items : [];
  const cards = Array.isArray(d.cards) ? d.cards : [];
  // Matches renderWorksheet's static view: one shared brand accent (lime),
  // not BOARD_TOOL_META's per-category rainbow (reading/vocab/writing/
  // speaking each their own hue) - that system is for the tools sidebar
  // picker. Play mode building its own accent independently of the static
  // render is why the two disagreed: a card generated lime on the board
  // opened teal/orange/whatever its category happened to be once a student
  // pressed Play.
  const accent = d.accent || WS_ACCENT_LIME;
  /* Всё, что набрано accent'ом ПО БЕЛОМУ, берёт эти чернила - см.
     _accentInkOnWhite. Заливки и рамки остаются на самом accent. */
  const ink = _accentInkOnWhite(accent);
  const kind = String(d.kind || '').toLowerCase();
  // Teacher key is only shown to the board owner (students just get correct/wrong
  // feedback after Check). Persisted student state is injected for restore.
  if (ownerView === undefined) ownerView = true;
  const savedState = d._state || null;
  // Карточки слов для подсвеченной лексики - только если их успели собрать
  // (_ttFillWordHelp), иначе подсветка остаётся просто подсветкой.
  const wordHelp = (d._wordHelp && Object.keys(d._wordHelp).length) ? d._wordHelp : null;
  // Выбор заголовка переехал на карточку текста - см. placeBoardLessonStageSet.
  const titleChoice = (d._titleChoice && Array.isArray(d._titleChoice.options)
    && d._titleChoice.options.length > 1) ? d._titleChoice : null;
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  // Keep Markdown only as an authoring convention. Every visible value uses
  // this formatter, while data-* attributes continue to use plain esc().
  const md = s => esc(s)
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');

  let contentHtml = '';
  let scriptHtml = '';

  // Play mode always renders one card at a time (stepper) instead of a long
  // stacked list - big font, tap-to-reveal/advance. See iwGoto/iwCardTap/
  // iwFlipOrNext in the shared script appended below.
  // Worksheets made entirely of single-blank gap-fill sentences collapse into
  // one combined step (a numbered sentence list + a grid of answer tiles)
  // instead of one stepper card per blank - see the isAllGapFill branch below.
  const isAllGapFill = qs.length > 1 && qs.every(q => q.type === 'gap-fill');
  const isMaterial = _ttIsMaterialCards(d);
  const isPromptDeck = _ttIsPromptDeck(d);
  const writing = _ttWritingTask(d);
  // Сетка вопросов и высота её плитки - см. _ttDeckMetrics, там же и почему.
  const deck = isPromptDeck ? _ttDeckMetrics(qs, cardW) : null;
  /* Узкая карточка - это телефон: колонок одна-две, и вёрстка внутри кадра
     обязана переключиться сама. Зум доски её не спасёт - он ужимает готовые
     880 пикселей, а не пересобирает раскладку. */
  const narrow = (cardW || 720) < 620;
  /* Материал не листается: текст и его глоссарий стоят друг под другом и
     читаются подряд, поэтому ни счётчика шагов, ни стрелок у него нет.
     Доска вопросов и письменная мастерская - тоже не степпер: у них всё
     содержимое на экране сразу. */
  const stepTotal = (isMaterial || isPromptDeck || writing) ? 0
    : isAllGapFill ? 1 : (qs.length || items.length || cards.length || 0);
  const stepHud = stepTotal > 1
    ? `<div class="iw-step-hud"><button class="iw-step-nav iw-prev" onclick="iwPrev()" aria-label="Previous">‹</button><span class="iw-step-count" id="iw-step-count">1 / ${stepTotal}</span><button class="iw-step-nav iw-next" onclick="iwNext()" aria-label="Next">›</button></div>`
    : '';
  // Vivid gradient pairs for MCQ/gap-fill answer tiles - a dedicated set
  // (not the pastel STICKY_PALETTE_COLORS, which is built for sticky notes
  // with dark text) matching the gradient look already used by
  // .iw-flash-front/.iw-card-front below.
  /* Пересчитаны 09.09.2026: исходный набор красиво выглядел на пипетке и
     проваливал контраст в деле. Белый текст (.iw-stepper .iw-opt{color:#fff})
     на светлом конце (t1) каждой пары давал 2.2-4.3:1 - вплоть до "The US is
     lagging behind..." почти не читалось на бледно-сиреневом. Ниже - те же
     девять оттенков, темнее ровно настолько, чтобы у ОБОИХ концов градиента
     был честный контраст с белым (проверено формулой WCAG, минимум 4.65:1,
     не «на глаз»), при этом каждая пара всё ещё узнаётся своим цветом и
     светлее/темнее внутри себя - не залита в один плоский тон. */
  const TILE_GRADIENTS = [['#6370B2','#5160AA'],['#AC5E46','#A24C31'],['#43805B','#2F7249'],
    ['#887236','#7A6320'],['#A652A6','#9D3F9D'],['#427D7F','#2D6F71'],
    ['#A75C7A','#9D4A6B'],['#3C7E7E','#277070'],['#8D6F54','#805F41']];

  // ─── MODE: Prompt deck (discussion / speaking) ───
  /* Все вопросы сразу, рубашкой вверх. Ответ ученика живёт на обороте той же
     карточки обычным .iw-open-input[data-qi] - тем самым, который уже умеют
     сохранять и восстанавливать iwSnapshot/iwRestore ниже. */
  if (qs.length && isPromptDeck) {
    contentHtml = `<div class="iw-deck">${qs.map((q, qi) => `<div class="iw-dcard" data-step="${qi}">
      <div class="iw-dcard-inner">
        <button class="iw-dcard-face iw-dcard-front" onclick="iwDeckFlip(this)" aria-label="Reveal question ${qi+1}">
          <span class="iw-dcard-tag">Q${qi+1}</span><span class="iw-dcard-hint">tap to reveal</span>
        </button>
        <div class="iw-dcard-face iw-dcard-back">
          <span class="iw-dcard-num">Q${qi+1}</span>
          <p class="iw-dcard-text">${md(q.text||'')}</p>
          <textarea class="iw-open-input iw-dcard-input" data-qi="${qi}" placeholder="+ Add your response" rows="2"></textarea>
          <button class="iw-dcard-hide" onclick="iwDeckFlip(this)" aria-label="Turn back over">↩</button>
        </div>
      </div>
    </div>`).join('')}</div>
    <div class="iw-bottom"><button class="iw-submit" onclick="iwDeckAll(true)">👁 Reveal All</button>
    <button class="iw-submit iw-reset" onclick="iwDeckAll(false)">↺ Turn All Back</button></div>`;
  }

  // ─── MODE: Questions (quiz-based tools) ───
  else if (qs.length && isAllGapFill) {
    const sentencesHtml = qs.map((q, qi) => `<div class="iw-gs-item"><b>${qi+1}.</b> ${md(q.text||'')}</div>`).join('');
    const tilesHtml = qs.map((q, qi) => {
      const [t1, t2] = TILE_GRADIENTS[qi % TILE_GRADIENTS.length];
      return `<div class="iw-gap" data-qi="${qi}" data-answer="${esc(q.answer||'')}" style="--t1:${t1};--t2:${t2}" onclick="this.querySelector('input').focus()">
        <span class="iw-gap-num">${qi+1}</span>
        <input type="text" class="iw-gap-input" placeholder="?" autocomplete="off" spellcheck="false" onclick="event.stopPropagation()" onkeydown="iwGapEnter(event,this)" onblur="iwGapBlur(this)">
      </div>`;
    }).join('');
    contentHtml = `<div class="iw-stepper"><div class="iw-step-track"><div class="iw-gapgrid-card">
      <div class="iw-gapgrid-sentences">${sentencesHtml}</div>
      <div class="iw-gap-grid">${tilesHtml}</div>
    </div></div></div>` +
      `<div class="iw-bottom"><button class="iw-submit" id="iw-check-btn" onclick="checkAll()">✓ Check Answers</button><button class="iw-submit iw-reset" id="iw-tryagain" style="display:none" onclick="iwReset()">↺ Try Again</button></div><div class="iw-score" id="iw-score"></div>`;
  } else if (qs.length) {
    const isOddOneOut = kind.includes('odd');
    // Порядок миссий - порядок их первого появления, а не алфавит: это
    // последовательность урока, в ней и подписываем «2 из 4».
    const missionOrder = [...new Set(qs.map(q => q && q._mission).filter(Boolean))];
    const qBlocks = qs.map((q, qi) => {
      let inner = '';
      if (q.type === 'mcq' && Array.isArray(q.options)) {
        inner = `<div class="iw-opts" data-qi="${qi}" data-answer="${esc(q.answer)}">${
          q.options.map((o, oi) => { const [t1, t2] = TILE_GRADIENTS[oi % TILE_GRADIENTS.length]; return `<button class="iw-opt" data-oi="${oi}" data-val="${esc(o)}" onclick="pickMCQ(this)" style="--t1:${t1};--t2:${t2}">${String.fromCharCode(65+oi)}. ${md(o)}</button>`; }).join('')
        }</div>`;
      } else if (q.type === 'truefalse') {
        const correct = q.answer === true || q.answer === 'true' || q.answer === 'True';
        inner = `<div class="iw-tf" data-qi="${qi}" data-answer="${correct}">
          <button class="iw-tf-btn" data-val="true" onclick="pickTF(this)">True</button>
          <button class="iw-tf-btn" data-val="false" onclick="pickTF(this)">False</button>
        </div>`;
      } else if (q.type === 'gap-fill') {
        inner = `<div class="iw-gap" data-qi="${qi}" data-answer="${esc(q.answer||'')}">
          <input type="text" class="iw-gap-input" placeholder="Type your answer…" autocomplete="off" onkeydown="iwGapEnter(event,this)">
          <button class="iw-check-btn" onclick="checkGap(this.parentNode)">Check</button>
        </div>`;
      } else if (q.type === 'match' && Array.isArray(q.pairs)) {
        const cats = [...new Set(q.pairs.map(p => p.right))];
        const isSorting = cats.length <= 5 && cats.length < q.pairs.length;
        const shuffled = q.pairs.map((p,i)=>({...p,_i:i})).sort(()=>Math.random()-.5);
        if (isSorting) {
          inner = `<div class="iw-sort" data-qi="${qi}">
            <div class="iw-sort-bank" id="sbank-${qi}">
              ${shuffled.map(p => `<div class="iw-drag" draggable="true" data-left="${esc(p.left)}" data-expect="${esc(p.right)}">${md(p.left)}</div>`).join('')}
            </div>
            <div class="iw-sort-cols">${cats.map(cat => `<div class="iw-sort-col" data-cat="${esc(cat)}">
              <div class="iw-sort-header">${md(cat)}</div>
              <div class="iw-sort-drop"></div>
            </div>`).join('')}</div>
          </div>`;
        } else {
          /* У «Match words to pictures» правая сторона пары - это не
             определение, а ПОИСКОВЫЙ ЗАПРОС, по которому на сборке урока
             уже нашли снимок (p.img). Показывая его текстом, доска
             превращала задание про картинки в матчинг «bruise ↔ human
             bruise close-up»: учитель одобрял в превью фотографии, а
             ученик получал их описания. Есть снимок - показываем снимок.

             Без crossorigin, в отличие от статического листа. Эта разметка
             живёт в iframe с sandbox="allow-scripts" БЕЗ allow-same-origin,
             то есть в непрозрачном источнике: запрос уходит с `Origin: null`,
             а общий CORS-шлюз бекенда отвечает на него 403. Картинки
             приходили битыми - шесть серых плашек вместо фотографий.
             Атрибут тут и не нужен: html2canvas всё равно не может прочитать
             содержимое чужого по источнику фрейма, ради него crossorigin и
             ставился на листе. */
          const withPics = q.pairs.some(p => _ttPairPic(p));
          inner = `<div class="iw-match${withPics ? ' has-pics' : ''}" data-qi="${qi}">
            <div class="iw-match-bank" id="bank-${qi}">
              ${shuffled.map(p => `<div class="iw-drag" draggable="true" data-left="${esc(p.left)}">${md(p.left)}</div>`).join('')}
            </div>
            <div class="iw-match-targets">
              ${q.pairs.map(p => `<div class="iw-target" data-right="${esc(p.right)}" data-expect="${esc(p.left)}">
                <span class="iw-slot"></span>
                ${_ttPairPic(p)
                  ? `<img class="iw-pic" src="${esc(_ttPairPic(p))}" alt="" loading="lazy" referrerpolicy="no-referrer">`
                  : `<span class="iw-def">${md(p.right)}</span>`}
              </div>`).join('')}
            </div>
          </div>`;
        }
      } else if (q.type === 'open' && isOddOneOut) {
        const words = String(q.text||'').split('\n').pop().split(/\s*\/\s*/).filter(w => w.trim());
        if (words.length >= 3) {
          inner = `<div class="iw-ooo" data-qi="${qi}">
            ${words.map(w => `<button class="iw-ooo-btn" data-word="${esc(w.trim())}" onclick="pickOdd(this)">${md(w.trim())}</button>`).join('')}
          </div>`;
        } else {
          inner = `<textarea class="iw-open-input" placeholder="Write your answer…" rows="2"></textarea>`;
        }
      } else if (q.type === 'open') {
        inner = `<textarea class="iw-open-input" data-qi="${qi}" placeholder="Write your answer…" rows="2"></textarea>`;
      }
      const hasInner = !!inner;
      // The answer controls are on the card from the start: a question the
      // student cannot answer without first tapping the card is one extra tap
      // per question and nothing else. Tapping a card that has no controls at
      // all (a bare prompt) still advances to the next one - see iwCardTap.
      /* Подпись миссии. У блока «после чтения» вопросы съехались из четырёх
         заданий (см. placeBoardLessonStageSet), и без неё ученик посреди
         шестнадцати шагов не понимает, что вообще делает: тут «правда или
         ложь», а через три шага уже пропуски. Считается по _mission, поэтому
         у обычной карточки одного задания подписи нет вовсе. */
      const mission = q._mission && missionOrder.length > 1
        ? `<div class="iw-mission">Mission ${missionOrder.indexOf(q._mission) + 1} of ${missionOrder.length} · ${md(q._mission)}</div>`
        : '';
      return `<div class="iw-q" data-step="${qi}" onclick="iwCardTap(this)"><div class="iw-qnum">${qi+1}</div><div class="iw-qbody">${mission}<div class="iw-qtext">${md(q.text||'')}</div>${hasInner ? `<div class="iw-qreveal">${inner}</div>` : ''}</div></div>`;
    }).join('');
    contentHtml = `<div class="iw-stepper">${stepHud}<div class="iw-step-track">${qBlocks}</div></div>` +
      `<div class="iw-bottom"><button class="iw-submit" id="iw-check-btn" onclick="checkAll()">✓ Check Answers</button><button class="iw-submit iw-reset" id="iw-tryagain" style="display:none" onclick="iwReset()">↺ Try Again</button></div><div class="iw-score" id="iw-score"></div>`;
  }

  // Answer key + scoring/state script apply to either Questions branch above
  // (grouped gap-fill grid or the per-question stepper) - both produce the
  // same .iw-opts/.iw-tf/.iw-gap/.iw-match/.iw-sort markup that checkAll()/
  // iwSnapshot()/iwRestore() already query by class+attribute.
  if (qs.length) {
    const hasKey = ownerView && qs.some(q => q.answer !== undefined || (q.pairs && q.pairs.length));
    if (hasKey) {
      contentHtml += `<div class="iw-key-wrap">
        <button class="iw-key-toggle" onclick="toggleKey(this)">🔑 Show Answer Key</button>
        <div class="iw-key" style="display:none">${qs.map((q,i) => {
          let a = '';
          if (q.type === 'mcq') a = q.answer || '';
          else if (q.type === 'truefalse') a = (q.answer === true || q.answer === 'true' || q.answer === 'True') ? 'True' : 'False';
          else if (q.type === 'gap-fill') a = q.answer || '';
          else if (q.type === 'match') a = (q.pairs||[]).map(p => p.left + ' → ' + p.right).join('; ');
          else return '';
          return a ? `<div><b>${i+1}.</b> ${md(a)}</div>` : '';
        }).join('')}</div>
      </div>`;
    }

    scriptHtml = `
/* Instant feedback. A pick used to do nothing visible until Check Answers at
   the bottom of the deck, so a student answering eight questions found out
   about the first one seven questions later. The answer is graded the moment
   it is made: the pick turns green or red, the right one is marked, and the
   question locks. Check Answers still exists for the drag activities and for
   the running total - and fires by itself once nothing is left unanswered. */
function iwGrade(w){
  if(!w || w.dataset.locked) return null;
  const sel=w.querySelector('.iw-opt.selected,.iw-tf-btn.selected');
  if(!sel) return null;
  const ans=w.dataset.answer;
  w.dataset.locked='1';
  w.querySelectorAll('.iw-opt,.iw-tf-btn').forEach(b=>{ b.disabled=true; if(b.dataset.val===ans) b.classList.add('correct'); else if(b.classList.contains('selected')) b.classList.add('wrong'); });
  return sel.dataset.val===ans;
}
/* A wrong answer gets longer on screen than a right one: the point of showing
   the correct option is that it is read before the card slides away. */
function iwAfterPick(ok){
  iwSave(); if(ok!==null) iwBeep(ok);
  setTimeout(function(){ if(typeof iwNext==='function') iwNext(); iwMaybeFinish(); }, ok===false ? 2400 : 1400);
}
/* Everything gradable answered → score the sheet without waiting to be asked. */
function iwMaybeFinish(){
  const el=document.getElementById('iw-score');
  if(el && el.style.display==='block') return;
  if(document.querySelector('.iw-opts:not([data-locked]),.iw-tf:not([data-locked])')) return;
  if(document.querySelector('.iw-match,.iw-sort')) return;
  const openGap=[...document.querySelectorAll('.iw-gap')].some(w=>!w.dataset.locked);
  if(openGap) return;
  if(!document.querySelector('.iw-opts,.iw-tf,.iw-gap')) return;
  checkAll();
}
function pickMCQ(btn){ const w=btn.parentNode; if(w.dataset.locked) return; w.querySelectorAll('.iw-opt').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); iwAfterPick(iwGrade(w)); }
function pickTF(btn){ const w=btn.parentNode; if(w.dataset.locked) return; w.querySelectorAll('.iw-tf-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); iwAfterPick(iwGrade(w)); }
function pickOdd(btn){ const w=btn.parentNode; w.querySelectorAll('.iw-ooo-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); iwSave(); }
function checkGap(w,silent){ const inp=w.querySelector('.iw-gap-input'),ans=w.dataset.answer; w.dataset.locked='1'; inp.readOnly=true; const ok=inp.value.trim().toLowerCase()===String(ans||'').trim().toLowerCase(); inp.classList.remove(ok?'wrong':'correct'); inp.classList.add(ok?'correct':'wrong'); if(silent) return; iwSave(); iwBeep(ok); iwMaybeFinish(); }
/* Same instant grading for the combined gap-fill grid, where the tiles have no
   Check button of their own: leaving a filled tile marks it. */
function iwGapBlur(inp){ const w=inp.closest('.iw-gap'); if(!w||w.dataset.locked||!inp.value.trim()) return; checkGap(w); }
function iwGapEnter(e, inp){
  if(e.key!=='Enter') return;
  e.preventDefault();
  const grid=inp.closest('.iw-gap-grid');
  if(grid){
    // Combined gap-fill grid: jump to the next empty tile, or blur if all filled.
    const inputs=[...grid.querySelectorAll('.iw-gap-input')];
    const next=inputs.find((el,idx)=>idx>inputs.indexOf(inp)&&!el.value) || inputs.find(el=>!el.value&&el!==inp);
    if(next) next.focus(); else inp.blur();
    return;
  }
  // Standalone gap-fill question: Enter submits the same as clicking Check.
  const btn=inp.parentNode.querySelector('.iw-check-btn');
  if(btn) btn.click();
}
function toggleKey(btn){ const k=btn.nextElementSibling; const o=k.style.display!=='none'; k.style.display=o?'none':'block'; btn.textContent=o?'🔑 Show Answer Key':'🔑 Hide Answer Key'; }
${_iwDragScript(accent)}
${_iwSortScript(accent)}
function checkAll(silent){
  let score=0,total=0;
  document.querySelectorAll('.iw-opts').forEach(w=>{ w.dataset.locked='1'; const ans=w.dataset.answer; w.querySelectorAll('.iw-opt').forEach(b=>{ b.disabled=true; if(b.dataset.val===ans) b.classList.add('correct'); else if(b.classList.contains('selected')) b.classList.add('wrong'); }); const sel=w.querySelector('.iw-opt.selected'); total++; if(sel&&sel.dataset.val===ans) score++; });
  document.querySelectorAll('.iw-tf').forEach(w=>{ w.dataset.locked='1'; const ans=w.dataset.answer; w.querySelectorAll('.iw-tf-btn').forEach(b=>{ b.disabled=true; if(b.dataset.val===ans) b.classList.add('correct'); else if(b.classList.contains('selected')) b.classList.add('wrong'); }); const sel=w.querySelector('.iw-tf-btn.selected'); total++; if(sel&&sel.dataset.val===ans) score++; });
  document.querySelectorAll('.iw-gap').forEach(w=>{ total++; const inp=w.querySelector('.iw-gap-input'),ans=w.dataset.answer; inp.readOnly=true; if(inp.value.trim().toLowerCase()===ans.trim().toLowerCase()){inp.classList.add('correct');score++;}else inp.classList.add('wrong'); });
  document.querySelectorAll('.iw-target').forEach(t=>{ total++; const slot=t.querySelector('.iw-slot'),placed=slot.textContent.trim(); if(placed===t.dataset.expect){t.classList.add('correct');score++;}else if(placed) t.classList.add('wrong'); });
  // Sorting
  document.querySelectorAll('.iw-sort-drop .iw-drag').forEach(d=>{ total++; const col=d.closest('.iw-sort-col'); if(col&&d.dataset.expect===col.dataset.cat){d.classList.add('sort-correct');score++;}else d.classList.add('sort-wrong'); });
  // Lock matching/sorting so dragging further doesn't leave the just-computed
  // correct/wrong marks stale (same fix as gap-fill's readOnly, above).
  document.querySelectorAll('.iw-match,.iw-sort').forEach(w=>{ w.dataset.locked='1'; w.querySelectorAll('.iw-drag').forEach(d=>{ d.draggable=false; }); });
  const el=document.getElementById('iw-score'); if(!el) return;
  const pct=total?Math.round(score/total*100):0; el.style.display='block';
  el.textContent=pct>=80?'🎉 '+score+'/'+total+' ('+pct+'%) - Excellent!':pct>=50?'👍 '+score+'/'+total+' ('+pct+'%) - Good job!':'📚 '+score+'/'+total+' ('+pct+'%) - Keep practicing!';
  const cb=document.getElementById('iw-check-btn'); if(cb) cb.style.display='none';
  const ta=document.getElementById('iw-tryagain'); if(ta) ta.style.display='inline-block';
  if(!silent){ el.classList.remove('iw-pop'); void el.offsetWidth; el.classList.add('iw-pop'); iwBeep(pct>=50); if(pct>=80) iwConfetti(); iwSave();
    try{ if(window.__IW_CARD__) parent.postMessage({type:'iw-progress',cardId:window.__IW_CARD__,score:score,maxScore:total,pct:pct},'*'); }catch(e){}
  }
}
function iwBeep(good){
  try{
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    const ctx=new AC(); const now=ctx.currentTime;
    const notes=good?[523.25,659.25,783.99]:[330,247];
    notes.forEach((f,i)=>{ const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=f; o.connect(g); g.connect(ctx.destination); const t=now+i*0.12; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.18,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.22); o.start(t); o.stop(t+0.24); });
    setTimeout(()=>{try{ctx.close();}catch(e){}},1200);
  }catch(e){}
}
function iwConfetti(){
  const cols=['#ef4444','#f59e0b','#16a34a','#4262ff','#8b5cf6','#ec4899'];
  for(let i=0;i<60;i++){
    const c=document.createElement('div'); c.className='iw-conf';
    c.style.left=Math.random()*100+'vw';
    c.style.background=cols[i%cols.length];
    c.style.animationDelay=(Math.random()*0.25)+'s';
    c.style.transform='rotate('+(Math.random()*360)+'deg)';
    document.body.appendChild(c);
    setTimeout(()=>c.remove(),2200);
  }
}
function iwReset(){
  document.querySelectorAll('.iw-opts').forEach(w=>{ delete w.dataset.locked; w.querySelectorAll('.iw-opt').forEach(b=>{ b.disabled=false; b.classList.remove('selected','correct','wrong'); }); });
  document.querySelectorAll('.iw-tf').forEach(w=>{ delete w.dataset.locked; w.querySelectorAll('.iw-tf-btn').forEach(b=>{ b.disabled=false; b.classList.remove('selected','correct','wrong'); }); });
  document.querySelectorAll('.iw-gap').forEach(w=>{ delete w.dataset.locked; });
  document.querySelectorAll('.iw-gap-input').forEach(inp=>{ inp.value=''; inp.readOnly=false; inp.classList.remove('correct','wrong'); });
  document.querySelectorAll('.iw-ooo-btn').forEach(b=>b.classList.remove('selected'));
  document.querySelectorAll('.iw-open-input').forEach(t=>t.value='');
  // Matching: free every slot + chip
  document.querySelectorAll('.iw-match').forEach(m=>{ delete m.dataset.locked; m.querySelectorAll('.iw-slot').forEach(s=>{ s.textContent=''; s.classList.remove('filled'); }); m.querySelectorAll('.iw-target').forEach(t=>t.classList.remove('correct','wrong','dragover')); m.querySelectorAll('.iw-drag').forEach(d=>{ d.draggable=true; d.classList.remove('placed'); d.style.outline=''; d.style.boxShadow=''; }); });
  // Sorting: return chips to bank
  document.querySelectorAll('.iw-sort').forEach(s=>{ delete s.dataset.locked; const bank=s.querySelector('.iw-sort-bank'); s.querySelectorAll('.iw-sort-drop .iw-drag').forEach(d=>{ d.draggable=true; d.classList.remove('sort-correct','sort-wrong','placed'); d.style.outline=''; d.style.boxShadow=''; if(bank) bank.appendChild(d); }); });
  const el=document.getElementById('iw-score'); if(el){ el.style.display='none'; el.textContent=''; }
  const cb=document.getElementById('iw-check-btn'); if(cb) cb.style.display='inline-block';
  const ta=document.getElementById('iw-tryagain'); if(ta) ta.style.display='none';
  if(typeof iwGoto==='function') iwGoto(0);
  iwSave();
}
/* ── State persistence: snapshot DOM → object, post to parent; restore on load ── */
function iwSnapshot(){
  const s={ mcq:{}, tf:{}, gap:{}, open:{}, match:{}, sort:{}, odd:{}, checked:false };
  document.querySelectorAll('.iw-opts').forEach(w=>{ const sel=w.querySelector('.iw-opt.selected'); if(sel) s.mcq[w.dataset.qi]=sel.dataset.val; });
  document.querySelectorAll('.iw-tf').forEach(w=>{ const sel=w.querySelector('.iw-tf-btn.selected'); if(sel) s.tf[w.dataset.qi]=sel.dataset.val; });
  document.querySelectorAll('.iw-gap').forEach(w=>{ const inp=w.querySelector('.iw-gap-input'); if(inp&&inp.value) s.gap[w.dataset.qi]=inp.value; });
  document.querySelectorAll('.iw-open-input').forEach(t=>{ if(t.value) s.open[t.dataset.qi]=t.value; });
  document.querySelectorAll('.iw-ooo').forEach(w=>{ const sel=w.querySelector('.iw-ooo-btn.selected'); if(sel) s.odd[w.dataset.qi]=sel.dataset.word; });
  document.querySelectorAll('.iw-match').forEach(m=>{ const qi=m.dataset.qi, o={}; m.querySelectorAll('.iw-target').forEach((t,i)=>{ const v=t.querySelector('.iw-slot').textContent.trim(); if(v) o[i]=v; }); if(Object.keys(o).length) s.match[qi]=o; });
  document.querySelectorAll('.iw-sort').forEach(w=>{ const qi=w.dataset.qi, o={}; w.querySelectorAll('.iw-sort-drop .iw-drag').forEach(d=>{ const col=d.closest('.iw-sort-col'); if(col) o[d.dataset.left]=col.dataset.cat; }); if(Object.keys(o).length) s.sort[qi]=o; });
  const scoreEl=document.getElementById('iw-score');
  s.checked=!!(scoreEl && scoreEl.style.display==='block');
  return s;
}
let _iwSaveT=null;
function iwSave(){ try{ clearTimeout(_iwSaveT); _iwSaveT=setTimeout(()=>{ if(window.__IW_CARD__) parent.postMessage({ type:'iw-state', cardId:window.__IW_CARD__, state:iwSnapshot() }, '*'); }, 250); }catch(e){} }
function iwRestore(s){
  if(!s) return;
  try{
    Object.keys(s.mcq||{}).forEach(qi=>{ const w=document.querySelector('.iw-opts[data-qi="'+qi+'"]'); if(!w) return; const b=w.querySelector('.iw-opt[data-val="'+CSS.escape(s.mcq[qi])+'"]'); if(b) b.classList.add('selected'); });
    Object.keys(s.tf||{}).forEach(qi=>{ const w=document.querySelector('.iw-tf[data-qi="'+qi+'"]'); if(!w) return; const b=w.querySelector('.iw-tf-btn[data-val="'+s.tf[qi]+'"]'); if(b) b.classList.add('selected'); });
    Object.keys(s.gap||{}).forEach(qi=>{ const w=document.querySelector('.iw-gap[data-qi="'+qi+'"]'); if(w){ const inp=w.querySelector('.iw-gap-input'); if(inp) inp.value=s.gap[qi]; } });
    Object.keys(s.open||{}).forEach(qi=>{ const t=document.querySelector('.iw-open-input[data-qi="'+qi+'"]'); if(t) t.value=s.open[qi]; });
    Object.keys(s.odd||{}).forEach(qi=>{ const w=document.querySelector('.iw-ooo[data-qi="'+qi+'"]'); if(!w) return; const b=w.querySelector('.iw-ooo-btn[data-word="'+CSS.escape(s.odd[qi])+'"]'); if(b) b.classList.add('selected'); });
    Object.keys(s.match||{}).forEach(qi=>{ const m=document.querySelector('.iw-match[data-qi="'+qi+'"]'); if(!m) return; const targets=m.querySelectorAll('.iw-target'); const o=s.match[qi]; Object.keys(o).forEach(i=>{ const t=targets[i]; if(!t) return; const slot=t.querySelector('.iw-slot'); slot.textContent=o[i]; slot.classList.add('filled'); const chip=m.querySelector('.iw-drag[data-left="'+CSS.escape(o[i])+'"]'); if(chip) chip.classList.add('placed'); }); });
    Object.keys(s.sort||{}).forEach(qi=>{ const w=document.querySelector('.iw-sort[data-qi="'+qi+'"]'); if(!w) return; const o=s.sort[qi]; Object.keys(o).forEach(left=>{ const chip=w.querySelector('.iw-drag[data-left="'+CSS.escape(left)+'"]'); const col=w.querySelector('.iw-sort-col[data-cat="'+CSS.escape(o[left])+'"]'); if(chip&&col) col.querySelector('.iw-sort-drop').appendChild(chip); }); });
    // Reopening the sheet has to bring the marks back with the answers -
    // re-grade what was already answered, and only what was answered, so an
    // untouched question is still open rather than pre-revealed.
    document.querySelectorAll('.iw-opts,.iw-tf').forEach(w=>{ if(w.querySelector('.selected')) iwGrade(w); });
    document.querySelectorAll('.iw-gap').forEach(w=>{ const inp=w.querySelector('.iw-gap-input'); if(inp&&inp.value.trim()) checkGap(w,true); });
    if(s.checked) checkAll(true);
  }catch(e){}
}
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.iw-gap-input,.iw-open-input').forEach(el=>el.addEventListener('input',iwSave));
  if(window.__IW_STATE__) iwRestore(window.__IW_STATE__);
});`;
  }

  // ─── MODE: Vocab items (flashcards / essential vocab) ───
  else if (items.length) {
    contentHtml = `<div class="iw-stepper">${stepHud}<div class="iw-step-track">${items.map((it, i) => `<div class="iw-flash" onclick="iwFlipOrNext(this)">
      <div class="iw-flash-inner">
        <div class="iw-flash-front"><span class="iw-flash-num">${i+1}</span><span class="iw-flash-word">${md(it.word||'')}</span></div>
        <div class="iw-flash-back"><span class="iw-flash-def">${md(it.example || it.definition || '-')}</span></div>
      </div>
    </div>`).join('')}</div></div>
    <div class="iw-bottom"><button class="iw-submit" onclick="document.querySelectorAll('.iw-flash').forEach(f=>f.classList.add('flipped'))">👁 Reveal All</button>
    <button class="iw-submit iw-reset" onclick="document.querySelectorAll('.iw-flash').forEach(f=>f.classList.remove('flipped'));if(typeof iwGoto==='function')iwGoto(0)">↺ Reset</button></div>`;
    scriptHtml = '';
  }

  // ─── MODE: Writing workspace (creative writing, homework task) ───
  /* Писать - это работа, а не колода карточек. Слева задание и то, по чему
     его проверяют, справа само письмо; требования - живой чек-лист, фразы и
     образец начала свёрнуты, чтобы не заслонять чистый лист. */
  else if (writing) {
    const wordTarget = _ttWordTarget(writing.reqs.text);
    const lines = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
    const reqItems = lines(writing.reqs.text).map(s => s.replace(/^(\d+[.)]|[-•*☐])\s*/, ''));
    const accordion = (c, open) => c ? `<details class="iw-ws-acc"${open ? ' open' : ''}>
      <summary>${md(c.title || '')}</summary>
      <div class="iw-ws-acc-body">${lines(c.text).map(l => {
        const m = l.match(/^(.+?)\s+[-–—]\s+(.+)$/);
        return m ? `<p><b>${md(m[1])}</b><span>${md(m[2])}</span></p>` : `<p>${md(l)}</p>`;
      }).join('')}</div></details>` : '';
    contentHtml = `<div class="iw-ws">
      <aside class="iw-ws-side">
        <div class="iw-ws-block">
          <h3 class="iw-ws-h">${md(writing.prompt.title || 'Writing prompt')}</h3>
          <p class="iw-ws-prompt">${md(writing.prompt.text || '')}</p>
        </div>
        <div class="iw-ws-block">
          <h3 class="iw-ws-h">${md(writing.reqs.title || 'Requirements')}</h3>
          <ul class="iw-ws-reqs">${reqItems.map((r, i) => `<li><label>
            <input type="checkbox" class="iw-ws-req" data-ri="${i}"><span>${md(r)}</span>
          </label></li>`).join('')}</ul>
        </div>
        ${accordion(writing.phrases)}${accordion(writing.model)}
        ${writing.extras.map(c => accordion(c)).join('')}
      </aside>
      <section class="iw-ws-main">
        <div class="iw-ws-head">
          <span class="iw-ws-label">Writing workspace</span>
          <span class="iw-ws-count"><b id="iw-wc">0</b> / ${wordTarget} words</span>
        </div>
        <div class="iw-ws-bar">
          <button type="button" onclick="iwFmt('bold')" title="Bold"><b>B</b></button>
          <button type="button" onclick="iwFmt('italic')" title="Italic"><i>I</i></button>
          <button type="button" onclick="iwFmt('underline')" title="Underline"><u>U</u></button>
          <span class="iw-ws-bar-sep"></span>
          <button type="button" onclick="iwFmt('insertUnorderedList')" title="Bulleted list">•</button>
          <button type="button" onclick="iwFmt('insertOrderedList')" title="Numbered list">1.</button>
        </div>
        <div class="iw-ws-editor" id="iw-editor" contenteditable="true" spellcheck="true"
             data-placeholder="Start writing here…"></div>
        <div class="iw-ws-meter"><i id="iw-wcbar"></i></div>
        <button class="iw-submit iw-ws-submit" id="iw-ws-submit" onclick="iwWsSubmit()">Submit Final Draft</button>
        <div class="iw-ws-done" id="iw-ws-done"></div>
      </section>
    </div>`;
    scriptHtml = `
var IW_TARGET=${wordTarget};
function iwWords(){
  var t=(document.getElementById('iw-editor').innerText||'').trim();
  return t? t.split(/\\s+/).length : 0;
}
function iwWsTick(){
  var n=iwWords();
  document.getElementById('iw-wc').textContent=n;
  var bar=document.getElementById('iw-wcbar');
  bar.style.width=Math.min(100,Math.round(n/IW_TARGET*100))+'%';
  bar.classList.toggle('full', n>=IW_TARGET);
}
function iwFmt(cmd){ document.getElementById('iw-editor').focus(); document.execCommand(cmd,false,null); iwWsTick(); iwWsSave(); }
var _iwT=null;
function iwWsSave(){
  clearTimeout(_iwT);
  _iwT=setTimeout(function(){
    if(!window.__IW_CARD__) return;
    var done=[].map.call(document.querySelectorAll('.iw-ws-req'),function(c){return c.checked;});
    parent.postMessage({type:'iw-state',cardId:window.__IW_CARD__,
      state:{draft:document.getElementById('iw-editor').innerHTML,done:done,
             submitted:document.body.classList.contains('iw-ws-sent')}},'*');
  },300);
}
/* Кнопка говорит только то, что действительно произошло: черновик записан
   на карточку доски. Никуда он не «отправляется» - отправлять некуда. */
function iwWsSubmit(){
  if(document.body.classList.contains('iw-ws-sent')){
    document.body.classList.remove('iw-ws-sent');
    document.getElementById('iw-editor').setAttribute('contenteditable','true');
    document.getElementById('iw-ws-submit').textContent='Submit Final Draft';
    document.getElementById('iw-ws-done').textContent='';
  } else {
    document.body.classList.add('iw-ws-sent');
    document.getElementById('iw-editor').setAttribute('contenteditable','false');
    document.getElementById('iw-ws-submit').textContent='↩ Reopen draft';
    document.getElementById('iw-ws-done').textContent='✓ Handed in - '+iwWords()+' words saved on the board.';
  }
  iwWsSave();
}
document.addEventListener('DOMContentLoaded',function(){
  var ed=document.getElementById('iw-editor');
  ed.addEventListener('input',function(){ iwWsTick(); iwWsSave(); });
  document.querySelectorAll('.iw-ws-req').forEach(function(c){ c.addEventListener('change',iwWsSave); });
  var s=window.__IW_STATE__;
  if(s){
    if(s.draft) ed.innerHTML=s.draft;
    (s.done||[]).forEach(function(v,i){ var c=document.querySelector('.iw-ws-req[data-ri="'+i+'"]'); if(c) c.checked=!!v; });
    if(s.submitted) iwWsSubmit();
  }
  iwWsTick();
});`;
  }

  // ─── MODE: Reading material (text / transcript / dialogue / model) ───
  else if (isMaterial) {
    /* Первая строка тела - это заголовок текста («My Biggest Fail»), его
       кладёт туда _ttOwnTextOutput. Абзацы разделены переводами строк, и
       пустая строка между ними не обязательна - режем по любому. */
    contentHtml = `<div class="iw-read">${cards.map((c, ci) => {
      const lines = String(c.text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);

      /* Глоссарий под текстом («Glossary under the text» включён по
         умолчанию) приезжает тем же cards[], но это не проза: это пары
         слово-значение, и абзацами они читаются как сплошная стена.
         Разбор и проверка формы те же, что в режиме плана
         (_ttWorksheetStageBodyHtml): заголовок со словом «glossary» сам по
         себе ничего не доказывает - движок нередко отвечает прозой, а один
         неверный разрез превращает абзац в ярлык на одно слово. */
      const isGloss = _ttWorksheetStageMeta(c.title || '').cls === 'ws-stage-vocab';
      const pairs = isGloss ? lines.map(_ttParseVocabLine) : [];
      const parsed = pairs.filter(Boolean).length;
      if (isGloss && lines.length >= 2 && parsed >= Math.ceil(lines.length * 0.6)) {
        const rows = pairs.map((p, i) => `<div class="iw-gloss-row">
          <span class="iw-gloss-term">${md(p ? p.term : lines[i])}</span>
          <span class="iw-gloss-def">${p ? md(p.def) : ''}</span>
        </div>`).join('');
        return `<article class="iw-read-card">
          <div class="iw-read-kicker">${md(c.title || '')}</div>
          <div class="iw-gloss">${rows}</div>
        </article>`;
      }

      const head = lines.length > 1 && lines[0].length <= 90 ? lines.shift() : '';
      /* Абзацы нумеруются, потому что на них ссылаются вслух и в заданиях
         («in paragraph 3…»): без номера обе стороны считают абзацы пальцем
         по экрану. Номер - подпись на поле, а не часть строки: он не
         сдвигает текст и не попадает в копирование. */
      const words = lines.join(' ').split(/\s+/).filter(Boolean).length;
      /* Сколько это читать - первое, что учитель прикидывает, планируя урок.
         180 слов в минуту - средний темп чтения про себя на B1-B2, минимум
         одна минута: «меньше минуты» в план не поставишь.

         Только у настоящего текста: у словаря, который не разобрался на
         пары и приехал сюда прозой, «40 words · ~1 min» означало бы время
         чтения списка слов - число верное, смысл ложный. */
      const meta = (!isGloss && words)
        ? `<span class="iw-read-meta">${words} words · ~${Math.max(1, Math.round(words / 180))} min</span>` : '';
      /* Плашка выбора заголовка встаёт НА МЕСТО заголовка, а сам заголовок
         до ответа скрыт: он и есть правильный ответ, и показывать его рядом
         с вариантами значит не задавать вопроса. Только у первой карточки
         материала - заголовок у текста один. */
      const pick = (titleChoice && ci === 0) ? `
        <div class="iw-tp" id="iw-tp">
          <button type="button" class="iw-tp-bar" onclick="iwTitleToggle()">
            <span class="iw-tp-caret">&#9656;</span><span class="iw-tp-label">${md(titleChoice.text || 'Choose the best title')}</span>
          </button>
          <div class="iw-tp-opts">${(titleChoice.options || []).map((o, oi) =>
            `<button type="button" class="iw-tp-opt" data-val="${esc(o)}" onclick="iwTitlePick(this)">${String.fromCharCode(65 + oi)}. ${md(o)}</button>`).join('')}</div>
        </div>` : '';
      return `<article class="iw-read-card">
        <div class="iw-read-kicker">${md(c.title || '')}${meta}</div>
        ${pick}
        ${head ? `<h2 class="iw-read-head"${titleChoice && ci === 0 ? ' data-veiled="1"' : ''}>${md(head)}</h2>` : ''}
        ${lines.map((p, i) => `<p class="iw-read-p"><span class="iw-read-n" aria-hidden="true">${i + 1}</span>${md(p)}</p>`).join('')}
      </article>`;
    }).join('')}</div>`;
    /* Высота карточки на доске задавалась оценкой и коробкой в 240px -
       текст в неё не помещался и прокручивался внутри. Кто знает
       настоящую высоту, тот её и сообщает: замерить эту разметку снаружи
       нельзя (srcdoc-iframe), а изнутри - одна строка. */
    scriptHtml = IW_HEIGHT_REPORTER;
    if (wordHelp) scriptHtml += IW_WORD_HELP_SCRIPT;
    if (titleChoice) scriptHtml += `
var _iwTitleAns = ${JSON.stringify(String(titleChoice.answer || ''))};
function iwTitleToggle(){
  var tp = document.getElementById('iw-tp');
  if (tp && !tp.classList.contains('is-done')) tp.classList.toggle('is-open');
}
/* Ответ проверяется на месте, как и у остальных вопросов (см. pickMCQ):
   верный вариант зеленеет, неверный краснеет и подсвечивает верный. После
   верного ответа плашка сворачивается и отдаёт место заголовку - ради
   этого места задание сюда и переехало. */
function iwTitlePick(btn){
  var tp = document.getElementById('iw-tp');
  if (!tp || tp.classList.contains('is-done')) return;
  var ok = btn.getAttribute('data-val') === _iwTitleAns;
  btn.classList.add(ok ? 'correct' : 'wrong');
  if (!ok) {
    tp.querySelectorAll('.iw-tp-opt').forEach(function(b){
      if (b.getAttribute('data-val') === _iwTitleAns) b.classList.add('correct');
    });
  }
  tp.classList.add('is-done');
  tp.classList.remove('is-open');
  var lbl = tp.querySelector('.iw-tp-label');
  if (lbl) lbl.textContent = (ok ? '\\u2713 ' : '\\u2717 ') + btn.textContent.replace(/^[A-C]\\.\\s*/, '');
  var caret = tp.querySelector('.iw-tp-caret'); if (caret) caret.remove();
  document.querySelectorAll('.iw-read-head[data-veiled]').forEach(function(h){ h.removeAttribute('data-veiled'); });
  if (typeof iwReportHeight === 'function') setTimeout(iwReportHeight, 60);
}`;
  }

  // ─── MODE: Cards (collocations, word-families, phrasal verbs, idioms, etc.) ───
  else if (cards.length) {
    contentHtml = `<div class="iw-stepper">${stepHud}<div class="iw-step-track">${cards.map((c, i) => `<div class="iw-card-flip" onclick="iwFlipOrNext(this)">
      <div class="iw-card-inner">
        <div class="iw-card-front"><span class="iw-card-num">${i+1}</span><span class="iw-card-title">${md(c.title||'')}</span><span class="iw-card-hint">tap to reveal</span></div>
        <div class="iw-card-back"><div class="iw-card-back-title">${md(c.title||'')}</div><div class="iw-card-back-text">${md(c.text||'').replace(/\n/g,'<br>')}</div></div>
      </div>
    </div>`).join('')}</div></div>
    <div class="iw-bottom"><button class="iw-submit" onclick="document.querySelectorAll('.iw-card-flip').forEach(f=>f.classList.add('flipped'))">👁 Reveal All</button>
    <button class="iw-submit iw-reset" onclick="document.querySelectorAll('.iw-card-flip').forEach(f=>f.classList.remove('flipped'));if(typeof iwGoto==='function')iwGoto(0)">↺ Reset</button></div>`;
    scriptHtml = '';
  }

  /* Дописки к режимам, у которых всё содержимое на экране сразу. Стоят ПОСЛЕ
     всей цепочки: ветки присваивают scriptHtml целиком, и вклиниться раньше
     значит потерять либо своё, либо чужое. */
  if (isPromptDeck) {
    // Флип по нажатию + высота: в сетке её задаёт число рядов, а не самый
    // высокий вопрос, и снаружи это не угадать.
    scriptHtml += `
/* Автофокус в поле ответа - только там, где есть курсор. На телефоне
   перевернуть карточку чаще всего значит ПРОЧИТАТЬ вопрос вслух, а фокус
   выбрасывает клавиатуру на пол-экрана и уводит доску. Захотят писать -
   нажмут на строку ответа сами. */
function iwDeckFlip(btn){
  var c=btn.closest('.iw-dcard'); if(!c) return;
  var open=!c.classList.contains('flipped');
  c.classList.toggle('flipped',open);
  var coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
  if(open && !coarse){ var t=c.querySelector('.iw-dcard-input'); if(t) setTimeout(function(){ t.focus(); },320); }
}
function iwDeckAll(open){ document.querySelectorAll('.iw-dcard').forEach(function(c){ c.classList.toggle('flipped',!!open); }); }
` + IW_HEIGHT_REPORTER;
  }
  /* Мастерская меряет себя ТОЛЬКО на узкой карточке. На широкой её высота -
     это `calc(100vh - 88px)`, то есть высота самой карточки: замер вернул бы
     карточке её же высоту и зациклился. На узкой колонки стоят друг под
     другом, высота честно содержательная, и без замера кнопка «Submit» просто
     уезжает под нижний край. */
  if (writing && narrow) scriptHtml += IW_HEIGHT_REPORTER;
  /* Только на узкой карточке: подводка нужна там, где поле перекрывает
     клавиатура, и только там, где в кадре вообще есть куда печатать. */
  if (narrow && (writing || isPromptDeck)) scriptHtml += IW_FOCUS_REPORTER;

  // ── Shared stepper navigation (one card at a time, all content modes) ──
  if (stepTotal > 0) {
    scriptHtml += `
var iwCur=0, iwTotal=${Math.max(1, stepTotal)};
function iwGoto(i){
  i=Math.max(0,Math.min(iwTotal-1,i));
  iwCur=i;
  document.querySelectorAll('.iw-step-track > *').forEach(function(el,idx){ el.classList.toggle('iw-step-hidden', idx!==i); });
  var lbl=document.getElementById('iw-step-count'); if(lbl) lbl.textContent=(i+1)+' / '+iwTotal;
  var pb=document.querySelector('.iw-prev'); if(pb) pb.disabled = i===0;
  var nb=document.querySelector('.iw-next'); if(nb) nb.disabled = i===iwTotal-1;
}
function iwNext(){ iwGoto(iwCur+1); }
function iwPrev(){ iwGoto(iwCur-1); }
/* A card with answer controls handles its own clicks; one with nothing to
   answer (a bare prompt) advances when tapped anywhere. */
function iwCardTap(el){
  if(!el.querySelector('.iw-qreveal')) iwNext();
}
function iwFlipOrNext(el){
  if(el.classList.contains('flipped')){ iwNext(); }
  else { el.classList.add('flipped'); }
}
document.addEventListener('keydown', function(e){
  var t=e.target;
  if(t && (t.tagName==='INPUT' || t.tagName==='TEXTAREA')) return;
  if(e.key==='ArrowRight') iwNext();
  else if(e.key==='ArrowLeft') iwPrev();
});
document.addEventListener('DOMContentLoaded', function(){ if(typeof iwGoto==='function') iwGoto(0); });
`;
  }

  /* Лист «все пропуски» - единственный вопросник, у которого всё содержимое
     на экране сразу, поэтому он, как и материал, меряет себя сам. Оценка
     снаружи занижала его систематически: плитки квадратные (aspect-ratio:1/1,
     три в ряд), их высота зависит от ШИРИНЫ карточки, а оценщик считал по
     одному вопросу - второй ряд плиток и кнопка «Check Answers» уезжали под
     нижний край. Со счётом после проверки высота меняется ещё раз, и это
     тоже приедет замером, а не догадкой. */
  if (isAllGapFill) scriptHtml += IW_HEIGHT_REPORTER;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{font:14px/1.55 -apple-system,system-ui,sans-serif;color:#1a1722;padding:16px 18px 24px;background:#fff;overflow-x:hidden}
strong{font-weight:650}
.iw-title{font:800 13px system-ui;letter-spacing:.06em;text-transform:uppercase;color:${ink};margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid ${accent}}
/* ── Questions ── */
.iw-q{display:flex;gap:10px;margin-bottom:14px;padding:10px 12px;border:1px solid #eaeaf0;border-radius:12px;border-left:3.5px solid ${accent};transition:box-shadow .2s}
.iw-q:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)}
.iw-qnum{flex-shrink:0;width:26px;height:26px;border-radius:8px;background:${accent};color:${WS_ACCENT_INK};display:flex;align-items:center;justify-content:center;font:800 12px monospace}
.iw-qbody{flex:1;min-width:0}
.iw-qtext{font-size:13.5px;font-weight:650;margin-bottom:8px;line-height:1.5;white-space:pre-line}
/* MCQ */
.iw-opts{display:flex;flex-direction:column;gap:5px}
.iw-opt{display:block;width:100%;text-align:left;padding:8px 13px;border:1.5px solid #e4e5ec;border-radius:10px;background:#fff;font:13px system-ui;color:#3a3644;cursor:pointer;transition:all .15s}
.iw-opt:hover{border-color:${accent};background:color-mix(in srgb,${accent} 6%,#fff)}
.iw-opt.selected{border-color:${accent};background:color-mix(in srgb,${accent} 12%,#fff);color:${ink};font-weight:600}
.iw-opt.correct{border-color:#16a34a;background:#dcfce7;color:#15803d;font-weight:600}
.iw-opt.wrong{border-color:#dc2626;background:#fee2e2;color:#991b1b;opacity:.7}
.iw-opt[disabled]{pointer-events:none}
/* T/F */
.iw-tf{display:flex;gap:10px}
.iw-tf-btn{padding:8px 22px;border:1.5px solid #e4e5ec;border-radius:10px;background:#fff;font:700 13px system-ui;cursor:pointer;transition:all .15s}
.iw-tf-btn:hover{border-color:${accent}}
.iw-tf-btn.selected{border-color:${accent};background:color-mix(in srgb,${accent} 12%,#fff);color:${ink}}
.iw-tf-btn.correct{border-color:#16a34a;background:#dcfce7;color:#15803d}
.iw-tf-btn.wrong{border-color:#dc2626;background:#fee2e2;color:#991b1b}
.iw-tf-btn[disabled]{pointer-events:none}
/* Once a question is graded, the options that were neither picked nor right
   step back - a palette tile that happens to be green should not read as the
   answer next to the one that actually is. */
.iw-opts[data-locked] .iw-opt:not(.correct):not(.wrong),
.iw-tf[data-locked] .iw-tf-btn:not(.correct):not(.wrong){opacity:.4;filter:grayscale(.85)}
/* Gap-fill */
.iw-gap{display:flex;gap:8px;align-items:center}
.iw-gap-input{flex:1;border:none;border-bottom:2px solid ${accent};padding:5px 4px;font:14px system-ui;outline:none;background:transparent}
.iw-gap-input.correct{border-color:#16a34a;color:#15803d;font-weight:600}
.iw-gap-input.wrong{border-color:#dc2626;color:#991b1b}
.iw-check-btn{padding:6px 14px;border:none;border-radius:8px;background:${WS_ACCENT_INK};color:#fff;font:800 11px system-ui;cursor:pointer}
.iw-check-btn:hover{opacity:.85}
/* Matching D&D */
.iw-match{display:flex;gap:16px;flex-wrap:wrap}
.iw-match-bank{display:flex;flex-wrap:wrap;gap:6px;min-height:34px;padding:8px;background:#f8f8fb;border-radius:10px;border:1.5px dashed #d4d6e0;flex:1;align-items:flex-start;align-content:flex-start}
.iw-drag{padding:6px 14px;border-radius:8px;background:${accent};color:${WS_ACCENT_INK};font:700 12.5px system-ui;cursor:grab;user-select:none;transition:transform .15s,opacity .15s}
.iw-drag:active{cursor:grabbing;transform:scale(1.06)}
.iw-drag.placed{opacity:.35;pointer-events:none}
/* #16a34a с белым текстом - 3.3:1, ниже порога WCAG AA (4.5). #15803D - тот
   же зелёный на пару оттенков темнее, уже используется рядом как текст на
   светлом фоне (5.0:1 там) - здесь даёт те же 5.0:1 в паре с белым. */
.iw-drag.sort-correct{background:#15803D!important;color:#fff!important;opacity:1!important}
.iw-drag.sort-wrong{background:#dc2626!important;color:#fff!important;opacity:1!important}
.iw-match-targets{flex:1.2;display:flex;flex-direction:column;gap:6px}
.iw-target{display:flex;align-items:center;gap:8px;padding:6px 10px;border:1.5px solid #e4e5ec;border-radius:10px;min-height:38px;transition:all .2s}
.iw-target.dragover{border-color:${accent};background:color-mix(in srgb,${accent} 8%,#fff);box-shadow:0 0 0 2px color-mix(in srgb,${accent} 20%,transparent)}
.iw-target.correct{border-color:#16a34a;background:#dcfce7}
.iw-target.wrong{border-color:#dc2626;background:#fee2e2}
.iw-slot{min-width:60px;min-height:26px;border:1.5px dashed #ccc;border-radius:6px;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;color:${ink};padding:3px 8px;transition:all .15s}
.iw-slot.filled{border-style:solid;border-color:${accent};background:color-mix(in srgb,${accent} 10%,#fff)}
.iw-def{font-size:12.5px;color:#3f3a4a;flex:1}
.iw-pic{flex:1;min-width:0;height:110px;object-fit:cover;border-radius:8px;background:#f2f2f5;display:block}
.iw-match.has-pics .iw-target{align-items:stretch;padding:8px 10px}
.iw-match.has-pics .iw-slot{align-self:center}
/* Снимки идут в два столбца, а банк слов получает фиксированную колонку.
   Одним столбцом на всю ширину карточки фотография растягивалась в полосу
   4:1: object-fit:cover срезал у «blister» всё, кроме куска кожи, и задание
   «подбери слово к картинке» показывало картинки, по которым слово не
   угадать. Два столбца тратят ту же ширину на РАЗМЕР плитки, а не на её
   растяжение, и на банк остаётся ровно столько, сколько нужно словам. */
.iw-match.has-pics .iw-match-bank{flex:0 0 200px}
.iw-match.has-pics .iw-match-targets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
/* Sorting */
.iw-sort{display:flex;flex-direction:column;gap:12px}
.iw-sort-bank{display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:#f8f8fb;border-radius:10px;border:1.5px dashed #d4d6e0;min-height:40px}
.iw-sort-cols{display:flex;gap:10px;flex-wrap:wrap}
.iw-sort-col{flex:1;min-width:100px}
.iw-sort-header{font:800 12px system-ui;text-transform:uppercase;letter-spacing:.05em;color:${ink};padding:6px 10px;border-bottom:2px solid ${accent};margin-bottom:6px}
.iw-sort-drop{min-height:60px;padding:6px;border:1.5px dashed #d4d6e0;border-radius:10px;display:flex;flex-direction:column;gap:4px;transition:all .2s}
.iw-sort-drop.dragover{border-color:${accent};background:color-mix(in srgb,${accent} 8%,#fff)}
/* Odd one out */
.iw-ooo{display:flex;flex-wrap:wrap;gap:8px}
.iw-ooo-btn{padding:10px 20px;border:1.5px solid #e4e5ec;border-radius:12px;background:#fff;font:700 14px system-ui;cursor:pointer;transition:all .15s}
.iw-ooo-btn:hover{border-color:${accent};transform:scale(1.04)}
.iw-ooo-btn.selected{border-color:#dc2626;background:#fee2e2;color:#991b1b;text-decoration:line-through;transform:scale(.96)}
/* open */
.iw-open-input{width:100%;border:1px solid #d4d6e0;border-radius:8px;padding:8px 10px;font:13.5px system-ui;resize:vertical;outline:none}
.iw-open-input:focus{border-color:${accent}}
/* ── Flashcards ── */
.iw-flash{perspective:600px;cursor:pointer;height:120px}
.iw-flash-inner{position:relative;width:100%;height:100%;transition:transform .5s;transform-style:preserve-3d}
.iw-flash.flipped .iw-flash-inner{transform:rotateY(180deg)}
.iw-flash-front,.iw-flash-back{position:absolute;inset:0;backface-visibility:hidden;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;text-align:center}
.iw-flash-front{background:linear-gradient(135deg,${accent},color-mix(in srgb,${accent} 55%,#0E0E10));color:${WS_ACCENT_INK};border:none}
.iw-flash-num{font:800 10px monospace;opacity:.6;margin-bottom:4px}
.iw-flash-word{font:800 16px system-ui;letter-spacing:-.02em}
.iw-flash-back{background:#f0fdf4;border:1.5px solid #a7e3bd;transform:rotateY(180deg)}
.iw-flash-def{font:600 12.5px system-ui;color:#15803d;line-height:1.5}
/* ── Reading material: read, not guessed. No box, no scroll of its own -
      the card grows to the text (see iwReportHeight). ── */
.iw-read{display:flex;flex-direction:column;gap:18px}
.iw-read-card{border:1.5px solid #e4e5ec;border-radius:12px;padding:18px 20px;background:#fff}
.iw-read-kicker{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font:800 10px system-ui;letter-spacing:.09em;text-transform:uppercase;color:${ink};margin-bottom:10px}
.iw-read-meta{font:700 10px system-ui;letter-spacing:.06em;color:#70707a;white-space:nowrap}
.iw-read-head{font:700 20px/1.25 system-ui;color:#171814;margin:0 0 12px;letter-spacing:-.02em}
/* До ответа заголовок скрыт: он и есть правильный вариант. */
.iw-read-head[data-veiled]{display:none}
/* ── Выбор заголовка в шапке текста ─────────────────────────────────
   Одна плашка вместо целой карточки задания: свёрнутая - строка с
   каретой, развёрнутая - три варианта. После ответа сворачивается совсем
   и уступает место настоящему заголовку. */
.iw-tp{margin:0 0 12px}
.iw-tp-bar{display:flex;align-items:center;gap:8px;width:100%;min-height:38px;padding:8px 12px;border:1.5px solid ${accent};border-radius:10px;
  background:color-mix(in srgb,${accent} 26%,#fff);color:${ink};font:700 13px system-ui;text-align:left;cursor:pointer}
.iw-tp-bar:hover{background:color-mix(in srgb,${accent} 40%,#fff)}
.iw-tp-caret{font-size:11px;transition:transform .18s}
.iw-tp.is-open .iw-tp-caret{transform:rotate(90deg)}
.iw-tp-label{flex:1;min-width:0}
.iw-tp-opts{display:none;flex-direction:column;gap:6px;margin-top:8px}
.iw-tp.is-open .iw-tp-opts{display:flex}
.iw-tp-opt{padding:9px 12px;border:1.5px solid #e4e5ec;border-radius:10px;background:#fff;color:#3a3644;font:13px/1.4 system-ui;text-align:left;cursor:pointer}
.iw-tp-opt:hover{border-color:${accent};background:color-mix(in srgb,${accent} 8%,#fff)}
.iw-tp-opt.correct{border-color:#16a34a;background:#dcfce7;color:#15803d;font-weight:600}
.iw-tp-opt.wrong{border-color:#dc2626;background:#fee2e2;color:#991b1b}
.iw-tp.is-done .iw-tp-bar{border-style:dashed;background:transparent;font-weight:600;color:#4a4a52}
/* ── Подпись миссии в блоке «после чтения» ── */
.iw-mission{font:700 10px system-ui;letter-spacing:.07em;text-transform:uppercase;color:${ink};opacity:.55;margin-bottom:6px}
/* Номер абзаца висит на поле: на него ссылаются в заданиях и вслух, но в
   строке текста он был бы лишним словом. */
.iw-read-p{position:relative;font:15px/1.65 -apple-system,system-ui,sans-serif;color:#1a1a2e;margin:0 0 12px;padding-left:26px}
.iw-read-p:last-child{margin-bottom:0}
.iw-read-n{position:absolute;left:0;top:2px;width:18px;text-align:right;font:700 10px system-ui;color:#70707a;user-select:none}
.iw-read-p strong{background:color-mix(in srgb,${accent} 38%,transparent);padding:0 2px;border-radius:3px}
/* ── Подсказка по слову ───────────────────────────────────────────────
   Подсвеченное слово было просто краской: ученик видел, что слово важное,
   и на этом всё. Теперь оно открывает карточку слова - произношение с
   записью голоса, значение, синонимы и пример. Данные приезжают готовыми
   в __IW_WORDS__ (словарь + глоссарий урока), внутрь песочницы за ними
   ходить нельзя. Курсор и пунктир под словом - чтобы было видно, что
   нажимается; у слов без данных ни того, ни другого. */
.iw-read-p strong[data-wh]{cursor:pointer;box-shadow:inset 0 -1px 0 color-mix(in srgb,${ink} 45%,transparent)}
.iw-read-p strong[data-wh]:hover{background:color-mix(in srgb,${accent} 62%,transparent)}
/* fixed, а не absolute: карточка сама сообщает свою высоту по scrollHeight
   (IW_HEIGHT_REPORTER), и всплывающий блок в потоке документа растил бы её
   на каждое нажатие. Окно iframe и есть видимая часть карточки, поэтому
   координат из getBoundingClientRect достаточно. */
.iw-wh{position:fixed;z-index:40;width:min(280px,calc(100% - 24px));padding:12px 14px;border:1px solid #dcdce4;border-radius:14px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.16);font:13px/1.5 -apple-system,system-ui,sans-serif;color:#2a2a33}
.iw-wh-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.iw-wh-word{font:800 14px system-ui;color:${ink}}
.iw-wh-pos{font:11px system-ui;color:#82828e}
.iw-wh-x{margin-left:auto;width:26px;height:26px;flex-shrink:0;border:0;border-radius:8px;background:#f2f2f5;color:#4a4a52;font:700 14px system-ui;cursor:pointer;line-height:1}
.iw-wh-row{margin-top:6px}
.iw-wh-label{display:block;font:700 10px system-ui;letter-spacing:.07em;text-transform:uppercase;color:#82828e;margin-bottom:2px}
.iw-wh-ipa{display:flex;align-items:center;gap:8px;font:600 14px ui-monospace,monospace;color:#2a2a33}
.iw-wh-say{width:30px;height:30px;flex-shrink:0;border:1px solid #dcdce4;border-radius:9px;background:#fff;cursor:pointer;font-size:14px;line-height:1}
.iw-wh-say:hover{background:color-mix(in srgb,${accent} 22%,#fff);border-color:${accent}}
.iw-wh-say.is-playing{background:${accent};border-color:${accent}}
.iw-wh-eg{color:#4a4a52;font-style:italic}
/* Глоссарий: слово и значение в два столбца, как в языковом банке листа. */
.iw-gloss{display:flex;flex-direction:column;gap:1px}
.iw-gloss-row{display:grid;grid-template-columns:minmax(90px,29%) 1fr;gap:14px;padding:8px 0;border-top:1px solid #eeeef1}
.iw-gloss-row:first-child{border-top:0}
.iw-gloss-term{font:700 14px system-ui;color:#171814}
.iw-gloss-def{font:14px/1.5 -apple-system,system-ui,sans-serif;color:#4a4a52}
/* ── Card-flip (collocations, phrasal, idioms) ── */
.iw-card-flip{perspective:600px;cursor:pointer;min-height:130px}
.iw-card-inner{position:relative;width:100%;height:100%;min-height:130px;transition:transform .5s;transform-style:preserve-3d}
.iw-card-flip.flipped .iw-card-inner{transform:rotateY(180deg)}
.iw-card-front,.iw-card-back{position:absolute;inset:0;backface-visibility:hidden;border-radius:12px;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.iw-card-front{background:linear-gradient(135deg,${accent},color-mix(in srgb,${accent} 55%,#0E0E10));color:${WS_ACCENT_INK}}
.iw-card-num{font:800 10px monospace;opacity:.5;margin-bottom:4px}
.iw-card-title{font:800 15px system-ui}
.iw-card-hint{font:11px system-ui;opacity:.6;margin-top:6px}
.iw-card-back{background:#fff;border:1.5px solid #e4e5ec;transform:rotateY(180deg);justify-content:flex-start;text-align:left;overflow-y:auto}
.iw-card-back-title{font:800 13px system-ui;color:${ink};margin-bottom:6px;width:100%}
.iw-card-back-text{font:13px/1.6 system-ui;color:#3a3644;width:100%}
/* ── Prompt deck (discussion): all questions at once, face down ── */
.iw-deck{display:grid;grid-template-columns:repeat(${deck ? deck.cols : 3},1fr);gap:12px}
.iw-dcard{perspective:800px;height:${deck ? deck.tile : 184}px}
.iw-dcard-inner{position:relative;width:100%;height:100%;transition:transform .45s;transform-style:preserve-3d}
.iw-dcard.flipped .iw-dcard-inner{transform:rotateY(180deg)}
.iw-dcard-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:14px;padding:13px;display:flex;flex-direction:column;text-align:left}
.iw-dcard-front{align-items:center;justify-content:center;gap:6px;cursor:pointer;border:none;width:100%;
  background:linear-gradient(135deg,${accent},color-mix(in srgb,${accent} 55%,#0E0E10));color:${WS_ACCENT_INK};transition:transform .15s}
.iw-dcard-front:hover{transform:translateY(-2px)}
.iw-dcard-tag{font:800 26px system-ui;letter-spacing:.02em}
.iw-dcard-hint{font:11px system-ui;opacity:.62}
.iw-dcard-back{background:#fff;border:1.5px solid #e4e5ec;transform:rotateY(180deg);gap:7px;overflow:hidden}
.iw-dcard-num{font:800 10px monospace;letter-spacing:.1em;color:${ink}}
.iw-dcard-text{font:600 13px/1.45 system-ui;color:#1a1722;flex:1;min-height:0;overflow-y:auto}
.iw-dcard-input{width:100%;border:none;border-top:1.5px dashed #e4e5ec;border-radius:0;padding:7px 0 0;font:12.5px/1.5 system-ui;color:#3a3644;background:none;resize:none;outline:none}
.iw-dcard-input::placeholder{color:#8b8792;font-weight:600}
.iw-dcard-hide{position:absolute;top:8px;right:8px;width:22px;height:22px;border:none;border-radius:7px;background:#f2f2f5;color:#6C6C6F;font:13px system-ui;line-height:1;cursor:pointer}
.iw-dcard-hide:hover{background:#e6e6ea}
/* ── Writing workspace ── */
.iw-ws{display:flex;gap:16px;align-items:stretch;height:calc(100vh - 88px);min-height:400px}
.iw-ws-side{flex:0 0 33%;max-width:310px;min-width:190px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;padding-right:4px}
.iw-ws-block{border:1.5px solid #e4e5ec;border-radius:14px;padding:12px 13px}
.iw-ws-h{font:800 10.5px system-ui;letter-spacing:.09em;text-transform:uppercase;color:${ink};margin-bottom:7px}
.iw-ws-prompt{font:13px/1.55 system-ui;color:#3a3644}
/* padding:0 обязателен - общий reset наверху снимает только margin, и
   браузерные 40px отступа списка съедали треть узкой колонки. */
.iw-ws-reqs{list-style:none;padding:0;display:flex;flex-direction:column;gap:8px}
.iw-ws-reqs label{display:flex;gap:8px;align-items:flex-start;font:12.5px/1.45 system-ui;color:#3a3644;cursor:pointer}
.iw-ws-reqs input{flex-shrink:0;width:15px;height:15px;margin-top:1px;accent-color:${ink};cursor:pointer}
.iw-ws-reqs input:checked+span{color:#8b8792;text-decoration:line-through}
.iw-ws-acc{border:1.5px solid #e4e5ec;border-radius:14px;padding:10px 13px}
.iw-ws-acc summary{font:800 10.5px system-ui;letter-spacing:.09em;text-transform:uppercase;color:${ink};cursor:pointer;list-style:none}
.iw-ws-acc summary::-webkit-details-marker{display:none}
.iw-ws-acc summary::after{content:' +';font-family:monospace;opacity:.5}
.iw-ws-acc[open] summary::after{content:' −'}
.iw-ws-acc-body{margin-top:8px;display:flex;flex-direction:column;gap:6px}
.iw-ws-acc-body p{font:12.5px/1.5 system-ui;color:#3a3644}
.iw-ws-acc-body b{display:block;color:#1a1722}
.iw-ws-acc-body span{color:#6C6C6F}
.iw-ws-main{flex:1;min-width:0;display:flex;flex-direction:column}
.iw-ws-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}
.iw-ws-label{font:800 10.5px system-ui;letter-spacing:.09em;text-transform:uppercase;color:${ink}}
.iw-ws-count{font:12px system-ui;color:#6C6C6F}
.iw-ws-count b{font-weight:800;color:#1a1722}
.iw-ws-bar{display:flex;align-items:center;gap:3px;border:1.5px solid #e4e5ec;border-bottom:none;border-radius:12px 12px 0 0;padding:6px 8px}
.iw-ws-bar button{min-width:28px;height:26px;padding:0 7px;border:none;border-radius:7px;background:none;font:13px system-ui;color:#3a3644;cursor:pointer;white-space:nowrap}
.iw-ws-bar button:hover{background:#f2f2f5}
.iw-ws-bar-sep{width:1px;height:16px;background:#e4e5ec;margin:0 4px}
.iw-ws-editor{flex:1;min-height:140px;overflow-y:auto;border:1.5px solid #e4e5ec;border-radius:0 0 12px 12px;
  padding:13px 14px;font:14px/1.7 system-ui;color:#1a1722;outline:none}
.iw-ws-editor:focus{border-color:${accent}}
.iw-ws-editor:empty::before{content:attr(data-placeholder);color:#a9a5b0}
.iw-ws-meter{height:4px;border-radius:3px;background:#ececed;margin:10px 0;overflow:hidden}
.iw-ws-meter i{display:block;height:100%;width:0;background:${accent};transition:width .25s}
.iw-ws-meter i.full{background:#16a34a}
.iw-ws-submit{margin-top:0}
.iw-ws-done{font:700 12px system-ui;color:#15803d;text-align:center;margin-top:8px}
body.iw-ws-sent .iw-ws-editor{background:#fafafa;color:#4a4a52}
body.iw-ws-sent .iw-ws-bar{opacity:.4;pointer-events:none}
/* ── Узкая карточка = телефон ──
   Ширина кадра равна ширине карточки, поэтому этот порог и есть «телефон»:
   доска на телефоне отдаёт такой карточке ширину экрана (см. phoneW в
   _ttPlayCardSize). Кегль здесь не мельче 11px, цель нажатия не меньше 40px -
   служебные подписи набраны капителью с разрядкой, в ней слово опознаётся по
   одной высоте прописных, и 10px на вытянутой руке не читается. */
@media (max-width:620px){
  .iw-ws{flex-direction:column;height:auto;gap:12px}
  .iw-ws-side{flex:none;max-width:none;overflow:visible}
  .iw-ws-editor{min-height:220px;font-size:15px}
  .iw-ws-h,.iw-ws-label,.iw-ws-acc summary{font-size:11px}
  .iw-ws-reqs label{padding:6px 0;min-height:40px;align-items:center;font-size:13px}
  .iw-ws-reqs input{width:19px;height:19px}
  .iw-ws-acc summary{padding:5px 0}
  .iw-ws-bar{padding:5px 6px}
  .iw-ws-bar button{min-width:40px;height:40px;font-size:15px}
  .iw-ws-count{font-size:12.5px}
  .iw-dcard-face{padding:10px}
  .iw-dcard-num{font-size:11px}
  .iw-dcard-text{font-size:13px}
  .iw-dcard-input{font-size:13px}
  .iw-dcard-hide{width:34px;height:34px;font-size:16px;top:5px;right:5px}
  .iw-dcard-tag{font-size:30px}
  .iw-dcard-hint{font-size:11.5px}
}
/* ── Bottom buttons ── */
/* One wide primary action at the foot of the card, as on the static sheet:
   the small centred pill read as a minor control on the screen where it is
   the only thing to press. Ink rather than the category hue, so Play matches
   the sheet it was generated from. */
.iw-bottom{display:flex;flex-direction:column;gap:9px;margin-top:20px}
.iw-submit{width:100%;padding:14px 22px;border:2px solid ${WS_ACCENT_INK};border-radius:14px;
  background:${WS_ACCENT_INK};color:#fff;font:800 15px system-ui;cursor:pointer;transition:opacity .15s}
.iw-submit:hover{opacity:.9}
/* Secondary: outlined, not a second filled button in a flat grey that
   belongs to no palette. */
.iw-reset{background:transparent;color:${WS_ACCENT_INK};border-color:${WS_ACCENT_INK}}
.iw-score{text-align:center;margin-top:14px;font:700 15px system-ui;color:${ink};display:none}
.iw-score.iw-pop{animation:iwpop .5s cubic-bezier(.34,1.56,.64,1)}
@keyframes iwpop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
.iw-conf{position:fixed;top:-12px;width:9px;height:14px;border-radius:2px;z-index:99999;pointer-events:none;animation:iwfall 1.9s linear forwards}
@keyframes iwfall{0%{transform:translateY(-12px) rotate(0)}100%{transform:translateY(105vh) rotate(540deg)}}
/* ── Key ── */
.iw-key-wrap{margin-top:16px;border-top:1px solid #eee;padding-top:12px}
.iw-key-toggle{background:none;border:2px solid rgba(14,14,16,.14);border-radius:8px;padding:6px 14px;font:800 11px system-ui;cursor:pointer;color:#6C6C6F}
.iw-key-toggle:hover{border-color:${accent};color:${ink}}
.iw-key{margin-top:10px;background:#f0fdf4;border-left:3px solid #16a34a;padding:10px 14px;border-radius:0 8px 8px 0;font-size:12.5px;line-height:1.8}
.iw-key b{color:#16a34a}
/* ── Stepper (Play mode: one card at a time) ── */
.iw-stepper{display:flex;flex-direction:column}
.iw-step-hud{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:16px}
.iw-step-nav{width:34px;height:34px;border-radius:50%;border:1.5px solid #e4e5ec;background:#fff;font:800 17px system-ui;color:${ink};cursor:pointer;transition:all .15s;line-height:1}
.iw-step-nav:hover:not(:disabled){border-color:${accent};background:color-mix(in srgb,${accent} 8%,#fff)}
.iw-step-nav:disabled{opacity:.3;cursor:default}
.iw-step-count{font:800 12px monospace;color:#6C6C6F;min-width:56px;text-align:center}
.iw-step-hidden{display:none!important}
.iw-stepper .iw-q{border:none;box-shadow:0 2px 22px rgba(0,0,0,.08);border-radius:18px;border-left:5px solid ${accent};padding:30px 26px;min-height:220px;display:flex;flex-direction:column;justify-content:center;cursor:pointer}
.iw-stepper .iw-qnum{display:none}
.iw-stepper .iw-qtext{font-size:23px;font-weight:650;line-height:1.4;margin-bottom:18px;text-align:center;white-space:pre-line}
.iw-qreveal{display:block;animation:iwreveal .25s ease}
@keyframes iwreveal{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.iw-stepper .iw-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.iw-stepper .iw-opt{min-height:64px;border:none;border-radius:14px;font-size:15.5px;font-weight:650;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px 10px;background:linear-gradient(135deg,var(--t1),var(--t2))}
.iw-stepper .iw-opt:hover{background:linear-gradient(135deg,var(--t1),var(--t2));opacity:.92}
.iw-stepper .iw-opt.selected:not(.correct):not(.wrong){outline:3px solid #1a1722;outline-offset:2px}
.iw-stepper .iw-opt.correct{background:#15803D!important;color:#fff}
.iw-stepper .iw-opt.wrong{background:#dc2626!important;color:#fff;opacity:.85}
.iw-stepper .iw-tf{justify-content:center}
.iw-stepper .iw-tf-btn{font-size:15px;padding:12px 30px}
.iw-stepper .iw-gap-input{font-size:16px}
.iw-stepper .iw-flash,.iw-stepper .iw-card-flip{height:auto;min-height:240px;cursor:pointer}
.iw-stepper .iw-flash-inner,.iw-stepper .iw-card-inner{min-height:240px}
.iw-stepper .iw-flash-word{font-size:28px}
.iw-stepper .iw-card-title{font-size:22px}
.iw-stepper .iw-card-back-text{font-size:14.5px}
/* ── Grouped gap-fill grid (one step for all single-word blanks) ── */
.iw-gapgrid-card{width:100%}
/* Без своей прокрутки. Коробка была ограничена 180px, потому что карточка не
   умела расти: её высоту задавала оценка снаружи. Теперь разметка сообщает
   свою настоящую высоту, и ограничение осталось бы чистым вредом - на узкой
   карточке из шести предложений было видно четыре, а ученик, заполняя пятую
   плитку, прокручивал список вверх, чтобы вспомнить пятое предложение.
   Полоса прокрутки внутри карточки на бесконечном холсте - вообще запах. */
.iw-gapgrid-sentences{margin-bottom:20px}
.iw-gs-item{font-size:14px;line-height:1.6;margin-bottom:10px;color:#3a3644}
.iw-gs-item b{color:${ink}}
.iw-gap-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.iw-gap-grid .iw-gap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;aspect-ratio:1/1;border-radius:16px;background:linear-gradient(135deg,var(--t1),var(--t2));cursor:text;padding:8px}
.iw-gap-grid .iw-gap:focus-within{transform:scale(1.05);box-shadow:0 4px 16px rgba(0,0,0,.18)}
.iw-gap-num{font:800 11px monospace;color:rgba(255,255,255,.75)}
.iw-gap-grid .iw-gap-input{width:100%;text-align:center;background:rgba(255,255,255,.92);border:none;border-radius:8px;padding:8px 4px;font:800 15px system-ui;color:#1a1722}
.iw-gap-grid .iw-gap-input.correct{background:#dcfce7;color:#15803d}
.iw-gap-grid .iw-gap-input.wrong{background:#fee2e2;color:#991b1b}
</style></head><body>
<div class="iw-title">${md(d.title || d.kind || 'Interactive Activity')}</div>
${contentHtml}
<script>window.__IW_CARD__=${JSON.stringify(cardId || '')};window.__IW_STATE__=${JSON.stringify(savedState)};${wordHelp ? `window.__IW_WORDS__=${JSON.stringify(wordHelp)};` : ''}<\/script>
<script>${scriptHtml}<\/script>
</body></html>`;
}

function _iwDragScript(accent) {
  return `
let dragEl=null;
document.addEventListener('dragstart',e=>{ if(!e.target.classList.contains('iw-drag')||e.target.closest('.iw-match,.iw-sort')?.dataset.locked) return; dragEl=e.target; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',e.target.dataset.left); setTimeout(()=>e.target.style.opacity='.4',0); });
document.addEventListener('dragend',e=>{ if(dragEl) dragEl.style.opacity=''; dragEl=null; document.querySelectorAll('.iw-target,.iw-sort-drop').forEach(t=>t.classList.remove('dragover')); });
document.addEventListener('dragover',e=>{ const tgt=e.target.closest('.iw-target')||e.target.closest('.iw-sort-drop'); if(tgt&&!tgt.closest('.iw-match,.iw-sort')?.dataset.locked){e.preventDefault();tgt.classList.add('dragover');} });
document.addEventListener('dragleave',e=>{ const tgt=e.target.closest('.iw-target')||e.target.closest('.iw-sort-drop'); if(tgt) tgt.classList.remove('dragover'); });
document.addEventListener('drop',e=>{
  e.preventDefault();
  const sortDrop=e.target.closest('.iw-sort-drop');
  if(sortDrop&&sortDrop.closest('.iw-sort')?.dataset.locked) return;
  if(sortDrop&&dragEl){ sortDrop.classList.remove('dragover'); sortDrop.appendChild(dragEl); dragEl.classList.remove('placed'); dragEl.style.opacity=''; dragEl=null; _iwS(); return; }
  const tgt=e.target.closest('.iw-target');
  if(!tgt||!dragEl||tgt.closest('.iw-match')?.dataset.locked) return;
  tgt.classList.remove('dragover');
  const slot=tgt.querySelector('.iw-slot'); const prev=slot.textContent.trim();
  if(prev){ const bank=tgt.closest('.iw-match').querySelector('.iw-match-bank'); const old=bank.querySelector('.iw-drag.placed[data-left="'+CSS.escape(prev)+'"]'); if(old) old.classList.remove('placed'); slot.classList.remove('filled'); }
  slot.textContent=dragEl.dataset.left; slot.classList.add('filled'); dragEl.classList.add('placed'); tgt.classList.remove('correct','wrong'); _iwS();
});
function _iwS(){ if(typeof iwSave==='function') iwSave(); }
// Touch drag
let touchDrag=null,touchClone=null;
document.addEventListener('touchstart',e=>{ const d=e.target.closest('.iw-drag'); if(!d||d.classList.contains('placed')||d.closest('.iw-match,.iw-sort')?.dataset.locked) return; touchDrag=d; touchClone=d.cloneNode(true); touchClone.style.cssText='position:fixed;z-index:9999;pointer-events:none;opacity:.85;transform:scale(1.08)'; document.body.appendChild(touchClone); const t=e.touches[0]; touchClone.style.left=(t.clientX-30)+'px'; touchClone.style.top=(t.clientY-16)+'px'; e.preventDefault(); },{passive:false});
document.addEventListener('touchmove',e=>{ if(!touchDrag) return; const t=e.touches[0]; if(touchClone){touchClone.style.left=(t.clientX-30)+'px';touchClone.style.top=(t.clientY-16)+'px';} document.querySelectorAll('.iw-target,.iw-sort-drop').forEach(tgt=>{ const r=tgt.getBoundingClientRect(); tgt.classList.toggle('dragover',t.clientX>=r.left&&t.clientX<=r.right&&t.clientY>=r.top&&t.clientY<=r.bottom); }); e.preventDefault(); },{passive:false});
document.addEventListener('touchend',e=>{ if(!touchDrag) return; if(touchClone){touchClone.remove();touchClone=null;} const sortDrop=document.querySelector('.iw-sort-drop.dragover'); if(sortDrop){ sortDrop.appendChild(touchDrag); touchDrag.classList.remove('placed'); } else { const over=document.querySelector('.iw-target.dragover'); if(over){ const slot=over.querySelector('.iw-slot'); const prev=slot.textContent.trim(); if(prev){ const bank=over.closest('.iw-match').querySelector('.iw-match-bank'); const old=bank.querySelector('.iw-drag.placed[data-left="'+CSS.escape(prev)+'"]'); if(old) old.classList.remove('placed'); } slot.textContent=touchDrag.dataset.left; slot.classList.add('filled'); touchDrag.classList.add('placed'); over.classList.remove('correct','wrong','dragover'); } } document.querySelectorAll('.iw-target,.iw-sort-drop').forEach(t=>t.classList.remove('dragover')); touchDrag=null; _iwS(); });
// Click-to-place
let clickSelected=null;
document.addEventListener('click',e=>{
  const d=e.target.closest('.iw-drag');
  if(d&&!d.classList.contains('placed')&&!d.closest('.iw-match,.iw-sort')?.dataset.locked){ document.querySelectorAll('.iw-drag').forEach(x=>{x.style.outline='';x.style.boxShadow='';}); d.style.outline='2.5px solid #fff';d.style.outlineOffset='2px';d.style.boxShadow='0 0 0 4px ${accent}'; clickSelected=d; return; }
  const sortDrop=e.target.closest('.iw-sort-drop');
  if(sortDrop&&sortDrop.closest('.iw-sort')?.dataset.locked){ clickSelected=null; return; }
  if(sortDrop&&clickSelected){ sortDrop.appendChild(clickSelected); clickSelected.classList.remove('placed'); clickSelected.style.outline='';clickSelected.style.boxShadow=''; clickSelected=null; _iwS(); return; }
  const tgt=e.target.closest('.iw-target');
  if(tgt&&tgt.closest('.iw-match')?.dataset.locked){ clickSelected=null; return; }
  if(tgt&&clickSelected){ const slot=tgt.querySelector('.iw-slot'); const prev=slot.textContent.trim(); if(prev){ const bank=tgt.closest('.iw-match').querySelector('.iw-match-bank'); const old=bank.querySelector('.iw-drag.placed[data-left="'+CSS.escape(prev)+'"]'); if(old) old.classList.remove('placed'); } slot.textContent=clickSelected.dataset.left; slot.classList.add('filled'); clickSelected.classList.add('placed'); clickSelected.style.outline='';clickSelected.style.boxShadow=''; tgt.classList.remove('correct','wrong'); clickSelected=null; _iwS(); }
});`;
}

function _iwSortScript(accent) {
  return `
// Return a drag chip back to the sort bank on double-click
document.addEventListener('dblclick',e=>{ const d=e.target.closest('.iw-sort-drop .iw-drag'); if(d&&!d.closest('.iw-sort')?.dataset.locked){ const bank=d.closest('.iw-sort').querySelector('.iw-sort-bank'); if(bank) bank.appendChild(d); if(typeof iwSave==='function') iwSave(); } });`;
}
