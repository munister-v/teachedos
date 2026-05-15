/* ══════════════════════ CLOCK ══════════════════════ */
function updateClock() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2,'0');
  const m = now.getMinutes().toString().padStart(2,'0');
  document.getElementById('wg-time').innerHTML = h + '<em>:</em>' + m;
  document.getElementById('mb-clock').textContent = h + ':' + m;
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('wg-date').textContent =
    days[now.getDay()].toLowerCase() + ' · ' +
    months[now.getMonth()].toLowerCase() + ' ' + now.getDate();
}
updateClock(); setInterval(updateClock, 30000);

/* ══════════════════════ WINDOW MANAGEMENT ══════════════════════ */
let topZ = 200;
const zMap = {};
const winState = {};
const isMobileViewport = () => window.matchMedia('(max-width: 860px)').matches;

function openApp(id) {
  const win = document.getElementById('win-' + id);
  const di  = document.getElementById('di-' + id);
  if (!win) return;
  const wasOpen = win.classList.contains('open');
  win.classList.add('open');
  if (!wasOpen) win.classList.add('appear');
  setTimeout(()=>win.classList.remove('appear'), 300);
  bringToFront(id);
  if (di) di.classList.add('open');
}

function closeWin(id) {
  const win = document.getElementById('win-' + id);
  const di  = document.getElementById('di-' + id);
  if (win) win.classList.remove('open');
  if (di) di.classList.remove('open');
}

function minWin(id) { closeWin(id); }

function bringToFront(id) {
  topZ++;
  const win = document.getElementById('win-' + id);
  if (win) win.style.zIndex = topZ;
}

function rememberWindowState(win) {
  const id = win.id.replace('win-', '');
  winState[id] = {
    top: win.style.top || `${win.offsetTop}px`,
    left: win.style.left || `${win.offsetLeft}px`,
    width: win.style.width || `${win.offsetWidth}px`,
    height: win.style.height || `${win.offsetHeight}px`
  };
}

function toggleMaxWin(id) {
  const win = document.getElementById('win-' + id);
  if (!win || isMobileViewport()) return;
  if (win.dataset.maximized === 'true') {
    const prev = winState[id];
    if (prev) {
      win.style.top = prev.top;
      win.style.left = prev.left;
      win.style.width = prev.width;
      win.style.height = prev.height;
    }
    win.dataset.maximized = 'false';
    return;
  }
  rememberWindowState(win);
  win.style.top = '44px';
  win.style.left = '20px';
  win.style.width = 'calc(100vw - 40px)';
  win.style.height = 'calc(100vh - 76px)';
  win.dataset.maximized = 'true';
  bringToFront(id);
}

/* Draggable windows */
(function(){
  const wins = document.querySelectorAll('.win');
  wins.forEach(win => {
    const tb = win.querySelector('.win-titlebar');
    if (!tb) return;
    let drag = false, ox=0, oy=0, wx=0, wy=0;
    tb.addEventListener('mousedown', e => {
      if (isMobileViewport()) return;
      if (e.target.classList.contains('tl')) return;
      drag = true;
      ox = e.clientX; oy = e.clientY;
      const r = win.getBoundingClientRect();
      wx = r.left; wy = r.top;
      const id = win.id.replace('win-','');
      bringToFront(id);
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      win.style.left = (wx + e.clientX - ox) + 'px';
      win.style.top  = (wy + e.clientY - oy) + 'px';
      win.dataset.maximized = 'false';
    });
    document.addEventListener('mouseup', () => { drag = false; });
    win.addEventListener('mousedown', () => {
      const id = win.id.replace('win-','');
      bringToFront(id);
    });

    const maxButton = win.querySelector('.tl.max');
    if (maxButton) {
      maxButton.addEventListener('click', () => toggleMaxWin(win.id.replace('win-', '')));
    }

    const handle = document.createElement('div');
    handle.className = 'win-resize-handle';
    win.appendChild(handle);

    let resize = false, sx = 0, sy = 0, sw = 0, sh = 0;
    handle.addEventListener('mousedown', e => {
      if (isMobileViewport()) return;
      resize = true;
      sx = e.clientX; sy = e.clientY;
      sw = win.offsetWidth; sh = win.offsetHeight;
      rememberWindowState(win);
      win.dataset.maximized = 'false';
      bringToFront(win.id.replace('win-', ''));
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener('mousemove', e => {
      if (!resize) return;
      win.style.width = `${Math.max(420, sw + e.clientX - sx)}px`;
      win.style.height = `${Math.max(300, sh + e.clientY - sy)}px`;
    });
    document.addEventListener('mouseup', () => { resize = false; });
  });
})();

function syncViewportMode() {
  document.body.classList.toggle('mobile-mode', isMobileViewport());
}

window.addEventListener('resize', syncViewportMode);
syncViewportMode();

/* ══════════════════════ FLASHCARDS ══════════════════════ */
const FC_DATA = {
  ru: [
    { word:'свет / light', lang:'🇷🇺 → 🇬🇧  Noun', trans:'light', ex:'"Turn off the light, please."\n«Выключи свет, пожалуйста.»' },
    { word:'успех / success', lang:'🇷🇺 → 🇬🇧  Noun', trans:'success', ex:'"Hard work leads to success."\n«Тяжёлый труд ведёт к успеху.»' },
    { word:'запомнить / to remember', lang:'🇷🇺 → 🇬🇧  Verb', trans:'to remember / to memorise', ex:'"I can\'t remember his name."\n«Я не могу вспомнить его имя.»' },
    { word:'на самом деле', lang:'🇷🇺 → 🇬🇧  Phrase', trans:'actually / in fact', ex:'"Actually, I don\'t agree."\n«На самом деле, я не согласен.»' },
    { word:'возможность', lang:'🇷🇺 → 🇬🇧  Noun', trans:'opportunity / possibility', ex:'"This is a great opportunity."\n«Это отличная возможность.»' },
    { word:'несмотря на', lang:'🇷🇺 → 🇬🇧  Preposition', trans:'despite / in spite of', ex:'"Despite the rain, we went out."\n«Несмотря на дождь, мы вышли.»' },
  ],
  ua: [
    { word:'світло / light', lang:'🇺🇦 → 🇬🇧  Noun', trans:'light', ex:'"The light in this room is great."\n«Світло в цій кімнаті чудове.»' },
    { word:'насправді', lang:'🇺🇦 → 🇬🇧  Adverb', trans:'actually / in fact', ex:'"Actually, that\'s not right."\n«Насправді, це не правильно.»' },
    { word:'можливість', lang:'🇺🇦 → 🇬🇧  Noun', trans:'opportunity', ex:'"Don\'t miss this opportunity."\n«Не пропусти цю можливість.»' },
    { word:'незважаючи на', lang:'🇺🇦 → 🇬🇧  Preposition', trans:'despite / regardless of', ex:'"Despite the cold, she ran."\n«Незважаючи на холод, вона бігла.»' },
    { word:'поводитися', lang:'🇺🇦 → 🇬🇧  Verb', trans:'to behave', ex:'"Please behave yourself."\n«Будь ласка, поводься добре.»' },
    { word:'досвід', lang:'🇺🇦 → 🇬🇧  Noun', trans:'experience', ex:'"She has a lot of experience."\n«Вона має великий досвід.»' },
  ],
  pl: [
    { word:'światło / light', lang:'🇵🇱 → 🇬🇧  Noun', trans:'light', ex:'"Switch on the light."\n«Włącz światło.»' },
    { word:'właściwie', lang:'🇵🇱 → 🇬🇧  Adverb', trans:'actually / properly', ex:'"Actually, I changed my mind."\n«Właściwie, zmieniłem zdanie.»' },
    { word:'mimo że', lang:'🇵🇱 → 🇬🇧  Conjunction', trans:'although / even though', ex:'"Although it was late, he called."\n«Mimo że było późno, zadzwonił.»' },
    { word:'doświadczenie', lang:'🇵🇱 → 🇬🇧  Noun', trans:'experience', ex:'"Work experience is important."\n«Doświadczenie zawodowe jest ważne.»' },
    { word:'zachowywać się', lang:'🇵🇱 → 🇬🇧  Verb', trans:'to behave', ex:'"Children, behave yourselves!"\n«Dzieci, zachowujcie się!»' },
    { word:'okazja', lang:'🇵🇱 → 🇬🇧  Noun', trans:'opportunity (NOT occasion!)', ex:'"This is a great opportunity."\n«To świetna okazja.» ⚠️ False friend!' },
  ],
  mistakes: [
    { word:'I am agree ❌', lang:'⚠️ Common Mistake · Grammar', trans:'I agree ✓', ex:'"I agree with you completely."\n❌ "I am agree" — agree is a verb, not adjective!' },
    { word:'магазин → magazine ❌', lang:'⚠️ False Friend · RU/UA', trans:'магазин = shop / store ✓', ex:'"Let\'s go to the shop."\n❌ magazine = журнал, not магазин!' },
    { word:'он живёт здесь since… ❌', lang:'⚠️ Tense Mistake · RU', trans:'He has lived here since… ✓', ex:'"He has lived here since 2010."\n❌ Use Present Perfect, not Present Simple!' },
    { word:'make homework ❌', lang:'⚠️ Collocation · RU/UA/PL', trans:'do homework ✓', ex:'"Did you do your homework?"\n❌ "make homework" — it\'s always DO homework!' },
    { word:'aktualny → actual ❌', lang:'⚠️ False Friend · PL', trans:'aktualny = current / up-to-date ✓', ex:'"The current news is…"\n❌ actual = prawdziwy/rzeczywisty in Polish!' },
    { word:'very much like ❌', lang:'⚠️ Word Order · RU/UA', trans:'like very much ✓', ex:'"I like it very much."\n❌ "I very much like" — adverb after verb object!' },
  ],
};
let fcSet = 'ru', fcIdx = 0, fcFlipped = false;

function fcLoadSet(el, lang) {
  document.querySelectorAll('.fc-set').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  fcSet = lang; fcIdx = 0; fcFlipped = false;
  fcShow();
}
function fcShow() {
  const cards = FC_DATA[fcSet];
  const card = cards[fcIdx];
  document.getElementById('fc-lang').textContent  = card.lang;
  document.getElementById('fc-lang-b').textContent = card.lang;
  document.getElementById('fc-word').textContent   = card.word;
  document.getElementById('fc-trans').textContent  = card.trans;
  const exLines = card.ex.split('\n');
  document.getElementById('fc-ex').innerHTML = exLines[0] + '<br><em>' + (exLines[1]||'') + '</em>';
  document.getElementById('fc-card').classList.remove('flipped');
  document.getElementById('fc-rating-btns').style.display = 'none';
  document.getElementById('fc-flip-hint').style.display = 'block';
  fcFlipped = false;
  const pct = ((fcIdx) / cards.length * 100).toFixed(0);
  document.getElementById('fc-prog').style.width = pct + '%';
  document.getElementById('fc-counter').textContent = (fcIdx+1) + ' / ' + cards.length;
}
function fcFlip() {
  if (fcFlipped) return;
  fcFlipped = true;
  document.getElementById('fc-card').classList.add('flipped');
  document.getElementById('fc-rating-btns').style.display = 'flex';
  document.getElementById('fc-flip-hint').style.display = 'none';
}
function fcRate(r) {
  const cards = FC_DATA[fcSet];
  fcIdx = (fcIdx + 1) % cards.length;
  fcShow();
}
fcShow();

/* ══════════════════════ VOCAB WIDGET ══════════════════════ */
const WG_VOCAB = [
  { word:'nevertheless', lang:'English · Adverb  (рос: тем не менее)', trans:'тем не менее / проте / niemniej jednak', ex:'"Nevertheless, she kept trying."\n«Тем не менее, она продолжала пытаться.»' },
  { word:'although', lang:'English · Conjunction  (укр: хоча)', trans:'хотя / хоча / chociaż', ex:'"Although it was hard, she passed."\n«Хоча це було важко, вона склала.»' },
  { word:'eventually', lang:'English · Adverb  (не "eventually" ≠ "possibly"!)', trans:'в конце концов / врешті-решт / w końcu', ex:'"Eventually, he found a job."\n«В конце концов он нашёл работу.»' },
  { word:'throughout', lang:'English · Preposition', trans:'на протяжении / протягом / przez cały', ex:'"Throughout the year, she studied hard."\n«Протягом року вона наполегливо вчилась.»' },
  { word:'opportunity', lang:'English · Noun  (≠ "possibility")', trans:'возможность / можливість / okazja', ex:'"This is a great opportunity."\n«Це чудова можливість.»' },
  { word:'despite', lang:'English · Preposition  (укр: незважаючи на)', trans:'несмотря на / незважаючи на / mimo', ex:'"Despite the rain, he came."\n«Незважаючи на дощ, він прийшов.»' },
  { word:'whereas', lang:'English · Conjunction', trans:'тогда как / тоді як / podczas gdy', ex:'"She likes tea, whereas he prefers coffee."\n«Вона любить чай, тоді як він воліє каву.»' },
];
let wgVocabIdx = 0;
function wgVocabNext() {
  wgVocabIdx = (wgVocabIdx + 1) % WG_VOCAB.length;
  const v = WG_VOCAB[wgVocabIdx];
  document.getElementById('wgv-word').textContent = v.word;
  document.getElementById('wgv-lang').textContent = v.lang;
  document.getElementById('wgv-trans').textContent = v.trans;
  const lines = v.ex.split('\n');
  document.getElementById('wgv-ex').innerHTML = '「' + lines[0].replace(/「|」/g,'') + '」<br><em>' + (lines[1]||'') + '</em>';
}

/* ══════════════════════ SCHEDULE ══════════════════════ */
let schYear = 2026, schMonth = 4; // 0-indexed, May = 4
const EVENTS = {
  '2026-5-7':  [{ text:'Articles · A2', cls:'' }],
  '2026-5-8':  [{ text:'Vocab Review', cls:'green' }],
  '2026-5-10': [{ text:'Tenses · B1', cls:'' }, { text:'Flashcards', cls:'blue' }],
  '2026-5-12': [{ text:'False Friends', cls:'' }],
  '2026-5-13': [{ text:'Phrasal Verbs', cls:'' }],
  '2026-5-14': [{ text:'Speaking Club', cls:'green' }],
  '2026-5-15': [{ text:'Word Order · B1', cls:'' }],
  '2026-5-17': [{ text:'Grammar Test', cls:'blue' }],
  '2026-5-19': [{ text:'Prepositions · A2', cls:'' }],
  '2026-5-20': [{ text:'Tenses · B1', cls:'' }],
  '2026-5-21': [{ text:'Vocab Review', cls:'green' }],
  '2026-5-24': [{ text:'Listening · B1', cls:'' }],
  '2026-5-27': [{ text:'Speaking · A2', cls:'' }],
  '2026-5-28': [{ text:'Speaking Club', cls:'green' }],
};
const SCH_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function schRender() {
  document.getElementById('sch-month').textContent = SCH_MONTHS[schMonth] + ' ' + schYear;
  const grid = document.getElementById('sch-grid');
  grid.innerHTML = '';
  const dows = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  dows.forEach(d => {
    const el = document.createElement('div');
    el.className = 'sch-dow'; el.textContent = d;
    grid.appendChild(el);
  });
  const first = new Date(schYear, schMonth, 1).getDay();
  const total = new Date(schYear, schMonth+1, 0).getDate();
  const today = new Date();
  for (let i = 0; i < first; i++) {
    const prev = new Date(schYear, schMonth, -first+i+1).getDate();
    const el = document.createElement('div');
    el.className = 'sch-cell other-month';
    el.innerHTML = '<div class="sch-day-num">' + prev + '</div>';
    grid.appendChild(el);
  }
  for (let d = 1; d <= total; d++) {
    const el = document.createElement('div');
    const key = schYear + '-' + (schMonth+1) + '-' + d;
    const isToday = today.getFullYear()===schYear && today.getMonth()===schMonth && today.getDate()===d;
    el.className = 'sch-cell' + (isToday?' today':'');
    let html = '<div class="sch-day-num">' + d + '</div>';
    if (EVENTS[key]) {
      EVENTS[key].forEach(ev => {
        html += '<div class="sch-event ' + ev.cls + '">' + ev.text + '</div>';
      });
    }
    el.innerHTML = html;
    grid.appendChild(el);
  }
  const remain = (first + total) % 7;
  if (remain > 0) {
    for (let i = 1; i <= 7-remain; i++) {
      const el = document.createElement('div');
      el.className = 'sch-cell other-month';
      el.innerHTML = '<div class="sch-day-num">' + i + '</div>';
      grid.appendChild(el);
    }
  }
}
function schPrev() { schMonth--; if(schMonth<0){schMonth=11;schYear--;} schRender(); }
function schNext() { schMonth++; if(schMonth>11){schMonth=0;schYear++;} schRender(); }
schRender();

/* ══════════════════════ NOTES ══════════════════════ */
const NOTES = [
  { id:1, title:'Articles: a / an / the', preview:'No articles in RU/UA/PL — the hardest part…', content:'ARTICLES IN ENGLISH\n——————————————————————\nRussian, Ukrainian and Polish have NO articles.\nThis makes them the #1 difficulty for Slavic speakers.\n\nRULES:\n\n① Indefinite article — A / AN\n  Use when mentioning something for the FIRST time\n  or when it\'s ONE of many:\n  "I saw a dog." (any dog, first mention)\n  "She is a teacher." (one of many teachers)\n  → A before consonant sounds: a book, a university\n  → AN before vowel sounds: an apple, an hour\n\n② Definite article — THE\n  Use when both speaker and listener know WHICH one:\n  "The dog I saw was huge." (we both know which dog)\n  "Pass me the salt." (the one on the table)\n  Use with: unique things (the Sun, the President)\n  superlatives (the best, the most)\n\n③ Zero article — Ø (no article)\n  Use with: plural general nouns: "Dogs are loyal."\n  uncountable nouns: "Water is essential."\n  proper names: "Moscow", "Ukraine"\n  languages: "I speak English."\n\nCOMMON MISTAKES:\n  ❌ "I am student" → ✓ "I am a student"\n  ❌ "She went to hospital" (UK) / ✓ "to the hospital" (US)\n  ❌ "The life is beautiful" → ✓ "Life is beautiful"', date:'May 7' },
  { id:2, title:'False Friends: RU/UA/PL → EN', preview:'Магазин ≠ magazine, актуальний ≠ actual…', content:'FALSE FRIENDS — НЕБЕЗПЕЧНІ СЛОВА\n——————————————————————\nWords that LOOK similar but mean something DIFFERENT:\n\nRUSSIAN / UKRAINIAN:\n• магазин → SHOP (not "magazine" = журнал)\n• фабрика → FACTORY (not "fabric" = ткань/тканина)\n• актуальный/актуальний → CURRENT/RELEVANT\n  (not "actual" = настоящий/справжній)\n• симпатичный → NICE-LOOKING, CUTE\n  (not "sympathetic" = сочувствующий)\n• конспект → LECTURE NOTES\n  (not "conspect" — not an English word!)\n• декада → TEN DAYS (not "decade" = десятилетие)\n• аккуратный → NEAT, TIDY (not "accurate" = точный)\n\nPOLISH:\n• aktualny → CURRENT (not "actual" = rzeczywisty)\n• okazja → OPPORTUNITY (not "occasion" = okazja też!)\n• ewentualnie → POSSIBLY / OR ELSE\n  (not "eventually" = w końcu)\n• konkurs → COMPETITION (not "concourse")\n• sympatyczny → NICE, LIKEABLE (not "sympathetic")\n• recepta → PRESCRIPTION (not "receipt" = paragon)\n\n⚠️ RULE: Never assume a similar-looking word means\nthe same thing. Always check!', date:'May 6' },
  { id:3, title:'English Tenses vs. Slavic Aspect', preview:'Why English has 12 tenses…', content:'ENGLISH TENSES vs. SLAVIC VERBAL ASPECT\n——————————————————————\nSlavic languages use ASPECT (вид дієслова):\n  доконаний (perfective) = completed action\n  недоконаний (imperfective) = ongoing/repeated\n\nEnglish uses TENSE + ASPECT combinations:\n\nPRESENT:\n  Simple:     "I work" — general truth / habit\n  Continuous: "I am working" — happening RIGHT NOW\n  Perfect:    "I have worked" — past with present effect\n  Perf.Cont.: "I have been working" — started past, still now\n\nPAST:\n  Simple:     "I worked" — finished past action\n  Continuous: "I was working" — was in progress\n  Perfect:    "I had worked" — before another past event\n  Perf.Cont.: "I had been working" — duration before past\n\nFUTURE:\n  Simple:     "I will work"\n  Continuous: "I will be working"\n  Perfect:    "I will have worked"\n  Perf.Cont.: "I will have been working"\n\nKEY MAPPINGS for Slavic speakers:\n  я працюю (impf.) → I work / I am working\n  я попрацював (pf.) → I have worked / I worked\n  я працював (impf.past) → I was working / I used to work\n\nCOMMON ERROR:\n  ❌ "I am living here since 2020"\n  ✓  "I have been living here since 2020"', date:'May 4' },
];
let activeNote = NOTES[0].id;
let saveTimer = null;

function notesRender() {
  const list = document.getElementById('notes-list');
  list.innerHTML = '';
  NOTES.forEach(n => {
    const el = document.createElement('div');
    el.className = 'note-item' + (n.id===activeNote?' active':'');
    el.innerHTML = `<div class="note-item-title">${n.title}</div><div class="note-item-preview">${n.preview}</div><div class="note-item-date">${n.date}</div>`;
    el.onclick = () => notesOpen(n.id);
    list.appendChild(el);
  });
  const active = NOTES.find(n=>n.id===activeNote);
  if (active) {
    document.getElementById('notes-ta').value = active.content;
    notesUpdateCount();
  }
}
function notesOpen(id) {
  activeNote = id;
  notesRender();
}
function notesNew() {
  const id = Date.now();
  NOTES.unshift({ id, title:'New Note', preview:'', content:'', date:'Today' });
  activeNote = id;
  notesRender();
  document.getElementById('notes-ta').focus();
}
function notesAutoSave() {
  const ta = document.getElementById('notes-ta');
  const note = NOTES.find(n=>n.id===activeNote);
  if (!note) return;
  note.content = ta.value;
  const lines = ta.value.split('\n');
  note.title = lines[0] || 'New Note';
  note.preview = (lines[1] || '').slice(0,50);
  notesUpdateCount();
  document.getElementById('notes-save-status').textContent = 'editing…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    notesRender();
    document.getElementById('notes-save-status').textContent = 'saved';
  }, 800);
}
function notesUpdateCount() {
  const ta = document.getElementById('notes-ta');
  const words = ta.value.trim().split(/\s+/).filter(Boolean).length;
  document.getElementById('notes-word-count').textContent = words + ' word' + (words===1?'':'s');
}
notesRender();

/* ══════════════════════ DICTIONARY ══════════════════════ */
const DICT_DB = {
  'opportunity': { word:'opportunity', phonetic:'/ˌɒp.əˈtʃuː.nɪ.ti/', pos:'noun · countable', defs:['A time or set of circumstances that makes it possible to do something.','⚠️ False friend: Polish "okazja" = opportunity (NOT "occasion"!)'], exs:['"This is a great opportunity to practise your English."\nвозможность / можливість / okazja','"Don\'t miss this opportunity."\n«Не упускайте эту возможность.»'], syns:['chance','possibility','occasion','prospect','opening'] },
  'nevertheless': { word:'nevertheless', phonetic:'/ˌnev.ə.ðəˈles/', pos:'adverb · conjunction', defs:['In spite of that; notwithstanding; all the same.','Used to add a statement that contrasts with or seems to contradict what has just been said.'], exs:['"Nevertheless, she kept trying."\n«Тем не менее, она продолжала пытаться. / Проте вона продовжувала спробувати.»','"The task was hard; nevertheless, we succeeded."\n«Задание было трудным, тем не менее мы справились.»'], syns:['however','nonetheless','still','yet','even so'] },
  'despite': { word:'despite', phonetic:'/dɪˈspaɪt/', pos:'preposition', defs:['Without being affected by; in spite of.','⚠️ Do NOT use "despite of" — no "of" after despite!'], exs:['"Despite the rain, he came."\n«Несмотря на дождь, он пришёл. / Незважаючи на дощ, він прийшов.»','"She passed despite not studying much."\n«Она сдала, несмотря на то что мало учила.»'], syns:['in spite of','notwithstanding','regardless of'] },
  'although': { word:'although', phonetic:'/ɔːlˈðəʊ/', pos:'conjunction', defs:['In spite of the fact that; even though.','However; but (used to introduce a contrasting statement).'], exs:['"Although it was hard, she passed."\n«Хотя это было трудно, она сдала. / Хоча це було важко, вона склала.»','"Although tired, he continued working."\n«Хотя он устал, он продолжал работать.»'], syns:['though','even though','while','whereas','notwithstanding'] },
  'eventually': { word:'eventually', phonetic:'/ɪˈventʃ.u.ə.li/', pos:'adverb', defs:['In the end, especially after a long time or a lot of effort.','⚠️ False friend: Polish "ewentualnie" = possibly/or else (NOT eventually!)'], exs:['"Eventually, he found a job."\n«В конце концов он нашёл работу. / Врешті-решт він знайшов роботу.»','"She eventually agreed."\nNOT: «в конце концов» ≠ "eventually… possibly"'], syns:['in the end','finally','ultimately','at last','sooner or later'] },
  'chance': { word:'chance', phonetic:'/tʃɑːns/', pos:'noun · countable/uncountable', defs:['A possibility of something happening.','An opportunity to do something.'], exs:['"There\'s a chance of rain today."\n«Есть вероятность дождя сегодня.»','"Give me a chance to explain."\n«Дайте мне шанс объяснить.»'], syns:['opportunity','possibility','prospect','likelihood'] },
  'actually': { word:'actually', phonetic:'/ˈæk.tʃu.ə.li/', pos:'adverb', defs:['In truth or in fact; really.','⚠️ False friend: "актуальний/aktualny" = current/relevant (NOT actually!)'], exs:['"Actually, I don\'t agree."\n«На самом деле, я не согласен. / Насправді, я не погоджуюсь.»','"What actually happened?"\nNOT: актуальный ≠ actual — актуальный = current!'], syns:['in fact','really','in reality','as a matter of fact','truly'] },
  'although': { word:'although', phonetic:'/ɔːlˈðəʊ/', pos:'conjunction', defs:['In spite of the fact that; even though.','However; but.'], exs:['"Although it was hard, she passed."\n«Хоча це було важко, вона склала. / Chociaż to było trudne, zdała.»','"I liked it, although it was expensive."\n«Мне понравилось, хотя это было дорого.»'], syns:['though','even though','while','whereas'] },
};
function dictLookup() {
  const q = document.getElementById('dict-input').value.trim().toLowerCase();
  if (!q) return;
  const entry = DICT_DB[q];
  const res = document.getElementById('dict-result');
  if (entry) {
    let defs = entry.defs.map((d,i) => {
      const ex = entry.exs[i] || '';
      const parts = ex.split('\n');
      const exHtml = parts[0] + (parts[1] ? '<br><em>' + parts[1] + '</em>' : '');
      return `<div class="dict-def">${i+1}. ${d}</div><div class="dict-example">${exHtml}</div>`;
    }).join('');
    let syns = entry.syns.map(s=>`<div class="dict-syn" onclick="dictSetWord('${s}')">${s}</div>`).join('');
    res.innerHTML = `<div class="dict-word">${entry.word}</div><div class="dict-phonetic">${entry.phonetic}</div><div class="dict-pos">${entry.pos}</div>${defs}<div style="font-size:12px;color:var(--text-3);margin-bottom:8px;font-family:var(--font-mono);">Synonyms</div><div class="dict-syns">${syns}</div><button class="dict-save-btn" onclick="dictSave()">🔖 Save to Flashcards</button>`;
  } else {
    res.innerHTML = `<div class="dict-word" style="font-size:20px;color:var(--text-3)">${q}</div><div class="dict-def" style="color:var(--text-3);margin-top:12px;">No result found. Try: opportunity, nevertheless, despite, although, eventually</div>`;
  }
}
function dictSetWord(w) {
  document.getElementById('dict-input').value = w;
  dictLookup();
}
function dictSave() {
  const btn = document.querySelector('.dict-save-btn');
  if (btn) { btn.textContent = '✓ Saved!'; setTimeout(()=>btn.textContent='🔖 Save to Flashcards',2000); }
}

/* ══════════════════════ TOOLS ══════════════════════ */
const TOOLS_DATA = window.TEACHEDOS_DATA.tools;

const TAG_COLORS = {
  Reading:    { bg:'rgba(96,165,250,.12)',    color:'#60a5fa' },
  Writing:    { bg:'rgba(110,201,138,.12)',   color:'#6ec98a' },
  Listening:  { bg:'rgba(245,158,11,.12)',    color:'#f59e0b' },
  Speaking:   { bg:'rgba(167,139,250,.12)',   color:'#a78bfa' },
  Vocabulary: { bg:'rgba(244,167,185,.12)',   color:'#f4a7b9' },
  Grammar:    { bg:'rgba(248,113,113,.12)',   color:'#f87171' },
  Utility:    { bg:'rgba(156,163,175,.12)',   color:'#9ca3af' },
  New:        { bg:'rgba(110,201,138,.18)',   color:'#6ec98a' },
  Pro:        { bg:'rgba(244,167,185,.18)',   color:'#f4a7b9' },
};

const GAMES_DATA = window.TEACHEDOS_DATA.games;

let activeGameId = GAMES_DATA[0].id;

let activeToolGroup = 'all';

function gameMatchesTool(game, toolId) {
  if (game.toolId === toolId) return true;
  if (Array.isArray(game.toolIds) && game.toolIds.includes(toolId)) return true;
  return false;
}

function toolsFilter(group, el) {
  document.querySelectorAll('#win-tools .sb-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  activeToolGroup = group;
  toolsRender();
}

function toolsRender() {
  const filtered = activeToolGroup === 'all'
    ? TOOLS_DATA
    : TOOLS_DATA.filter(t => t.group === activeToolGroup);

  const seen = new Set();
  const unique = filtered.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id); return true;
  });

  document.getElementById('tools-count').textContent = unique.length + ' tool' + (unique.length === 1 ? '' : 's');

  const grid = document.getElementById('tools-grid');
  grid.innerHTML = unique.map(t => {
    const tagHtml = t.tags.map(tag => {
      const c = TAG_COLORS[tag] || {};
      return `<span style="font-size:9px;font-family:var(--font-mono);padding:2px 8px;border-radius:20px;background:${c.bg};color:${c.color};">${tag}</span>`;
    }).join('');
    const badgeHtml = t.badge ? (() => {
      const c = TAG_COLORS[t.badge] || {};
      return `<span style="font-size:9px;font-family:var(--font-mono);padding:2px 9px;border-radius:20px;background:${c.bg};color:${c.color};border:1px solid ${c.color}40;font-weight:600;">${t.badge}</span>`;
    })() : '';
    const footer = GAMES_DATA.some(g => gameMatchesTool(g, t.id)) ? 'Launch module →' : 'Use tool →';
    return `<div class="tool-card" onclick="toolOpen('${t.id}')" style="background:rgba(244,167,185,0.04);border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;transition:background .18s,border-color .18s,transform .15s;position:relative;overflow:hidden;" onmouseenter="this.style.background='rgba(244,167,185,0.09)';this.style.borderColor='rgba(244,167,185,0.22)';this.style.transform='translateY(-2px)'" onmouseleave="this.style.background='rgba(244,167,185,0.04)';this.style.borderColor='var(--border)';this.style.transform=''">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
        <div style="font-size:22px;flex-shrink:0;line-height:1;">${t.icon}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.3;margin-bottom:4px;">${t.name}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${tagHtml}${badgeHtml}</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-3);line-height:1.65;">${t.desc}</div>
      <div style="margin-top:12px;font-size:11px;font-family:var(--font-mono);color:var(--accent);display:flex;align-items:center;gap:4px;">${footer}</div>
    </div>`;
  }).join('');
}

function gamesRenderList() {
  const list = document.getElementById('games-list');
  if (!list) return;
  list.innerHTML = GAMES_DATA.map(game => `
    <div class="games-nav-item${game.id === activeGameId ? ' active' : ''}" onclick="gamesOpen('${game.id}')" title="${game.title}">
      <div class="games-nav-ic">${game.icon}</div>
      <div class="games-nav-copy">
        <div class="games-nav-title">${game.title}</div>
        <div class="games-nav-sub">${game.skill} · ${game.mode}</div>
      </div>
    </div>
  `).join('');
}

function gamesRenderQuicklist() {
  const wrap = document.getElementById('games-quicklist');
  if (!wrap) return;
  wrap.innerHTML = GAMES_DATA.map(game => `
    <div class="games-quick${game.id === activeGameId ? ' active' : ''}" onclick="gamesOpen('${game.id}')">${game.icon} ${game.title}</div>
  `).join('');
}

function gamesRenderCurrent(loadFrame = false) {
  const game = GAMES_DATA.find(x => x.id === activeGameId) || GAMES_DATA[0];
  document.getElementById('games-titlebar-title').textContent = '🎮 ' + game.title;
  document.getElementById('games-hero-icon').textContent = game.icon;
  document.getElementById('games-hero-icon').style.background = game.accent;
  document.getElementById('games-hero-eyebrow').textContent = game.eyebrow;
  document.getElementById('games-hero-title').innerHTML = game.title.replace(' ', ' <em>') + '</em>';
  if (!game.title.includes(' ')) {
    document.getElementById('games-hero-title').innerHTML = game.title + ' <em>Lab</em>';
  }
  document.getElementById('games-hero-desc').textContent = game.desc;
  document.getElementById('games-link').href = game.rawUrl;
  document.getElementById('games-stage-title').textContent = game.subtitle;
  document.getElementById('games-stage-sub').textContent = game.skill + ' · ' + game.mode + ' · ' + game.audience;
  document.getElementById('games-play-btn').textContent = 'Launch ' + game.title + ' →';
  document.getElementById('games-meta').innerHTML = [
    game.skill,
    game.mode,
    game.audience
  ].map(item => `<span class="games-meta-chip">${item}</span>`).join('');
  gamesRenderList();
  gamesRenderQuicklist();
  if (loadFrame) {
    document.getElementById('games-frame').src = game.embedUrl;
  }
}

function gamesOpen(id, loadFrame = true) {
  activeGameId = id;
  gamesRenderCurrent(loadFrame);
  openApp('games');
}

function gamesLaunchCurrent() {
  gamesRenderCurrent(true);
  openApp('games');
}

function toolOpen(id) {
  const t = TOOLS_DATA.find(x => x.id === id);
  if (!t) return;
  const interactiveGame = GAMES_DATA.find(game => gameMatchesTool(game, id));
  if (interactiveGame) {
    gamesOpen(interactiveGame.id, true);
    return;
  }
  // Open notes with a template for this tool
  const content = `Tool: ${t.name}\n${'—'.repeat(40)}\n\nSkill: ${t.tags.join(', ')}\n\nDescription:\n${t.desc}\n\n${'—'.repeat(40)}\nMy notes:\n\n`;
  const noteId = Date.now();
  NOTES.unshift({ id: noteId, title: t.name, preview: t.desc.slice(0,50), content, date: 'Today' });
  activeNote = noteId;
  notesRender();
  openApp('notes');
}

toolsRender();
gamesRenderCurrent(true);

if (window.initCurriculumApp) {
  window.initCurriculumApp({
    openApp,
    openTool: toolOpen,
    openGame: (gameId) => gamesOpen(gameId, true),
    openNote: (noteId) => {
      activeNote = noteId;
      notesRender();
      openApp('notes');
    },
    createCurriculumNote: (item) => {
      const id = Date.now();
      const content = `${item.title}\n${item.desc}\n\nTrack: ${item.track}\nLevel: ${item.level}\nDuration: ${item.duration}\n\nObjectives:\n- \n\nKey examples:\n- \n\nTeacher notes:\n- \n`;
      NOTES.unshift({ id, title: item.title, preview: item.desc.slice(0,50), content, date: 'Today' });
      activeNote = id;
      notesRender();
      openApp('notes');
    }
  });
}

/* ══════════════════════ MOBILE ══════════════════════ */
function mobToggleSidebar(winId) {
  const sidebar = document.getElementById('sidebar-' + winId)
    || document.querySelector('#win-' + winId + ' .win-sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('mob-open');
}

function mobInit() {
  if (window.matchMedia('(max-width: 860px)').matches) {
    // Close all windows, then open curriculum as default
    document.querySelectorAll('.win').forEach(w => w.classList.remove('open'));
    document.querySelectorAll('.di').forEach(d => d.classList.remove('open'));
    openApp('curriculum');
  }
}

// On mobile, tapping a dock item closes others (single-window mode)
(function() {
  const isMob = () => window.matchMedia('(max-width: 860px)').matches;
  document.querySelectorAll('.di').forEach(di => {
    di.addEventListener('click', () => {
      if (!isMob()) return;
      document.querySelectorAll('.win').forEach(w => w.classList.remove('open'));
      document.querySelectorAll('.di').forEach(d => d.classList.remove('open'));
    }, true); // capture phase — fires before openApp
  });
})();

mobInit();
