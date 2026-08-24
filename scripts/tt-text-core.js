/* Спільне ядро текстових помічників для генераторів вправ.

   Ці сім функцій жили в board-app.js, а board-gen.js кликав їх із глобальної
   області - тобто рушій генерації не був самостійним і працював лише на
   сторінці дошки. Саме через це студія інструментів не могла ним скористатися
   і тримала власну копію тих самих генераторів: двадцять вправ у проєкті
   написано двічі.

   Тут немає ні DOM, ні стану дошки - лише робота з текстом, тож файл безпечно
   вантажити будь-якій сторінці.

   ПОРЯДОК ПІДКЛЮЧЕННЯ ВАЖЛИВИЙ: цей файл має йти ПЕРЕД board-app.js і перед
   teacher-tools-app.js - обидва покладаються на ці імена в глобальній області. */

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function _ttShuffle(arr){ for (let i = arr.length-1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; } return arr; }

function _ttMdToHtml(s){
  return esc(s || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function teacherToolActionLabel(action) {
  if (action === 'upgrade') return 'Upgraded text';
  if (action === 'keep') return 'Leveled text';
  return 'Simplified text';
}

function teacherToolTopicSeeds(_topic, count = 50) {
  // A topic label is not a vocabulary list. Callers must either use teacher
  // supplied terms, extract from supplied source, or ask the model. Returning
  // a generic word bank here made unrelated drills look complete.
  return [];
}

function teacherToolSourceSentences(text, topic, count = 6) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(x => x.trim())
    .filter(Boolean);
  // Never manufacture source sentences. A shorter activity from real material
  // is better than a polished-looking exercise about a different lesson.
  return s.slice(0, count);
}

function adaptTeacherToolText(input) {
  const action = ['simplify', 'upgrade', 'keep'].includes(input.action) ? input.action : 'simplify';
  const source = String(input.source || '').replace(/\s+/g, ' ').trim();
  const words = teacherToolVocabList(input.vocab, input.topic, Math.min(10, input.count));
  if (!source) {
    return `${teacherToolActionLabel(action)} for ${input.level}: add source text first, then generate again.`;
  }
  const sentences = teacherToolSourceSentences(source, input.topic, Math.max(4, input.count));
  if (action === 'upgrade') {
    return sentences.slice(0, Math.min(8, input.count)).map((sentence, i) => {
      const connector = ['Furthermore', 'However', 'As a result', 'In practical terms', 'For this reason'][i % 5];
      return `${connector}, ${sentence.replace(/\.$/, '')}, which helps students discuss ${input.topic} with more precise ${input.level} language.`;
    }).join(' ');
  }
  if (action === 'keep') {
    return sentences.slice(0, Math.min(10, input.count)).join(' ');
  }
  const easyMap = [
    [/\bfrustrating\b/gi, 'difficult'],
    [/\bcontact\b/gi, 'call or message'],
    [/\breservation\b/gi, 'booking'],
    [/\bflexible\b/gi, 'ready to change plans'],
    [/\bencounter\b/gi, 'have'],
    [/\bapproximately\b/gi, 'about'],
    [/\bassistance\b/gi, 'help'],
  ];
  return sentences.slice(0, Math.min(8, input.count)).map(sentence => {
    let s = sentence;
    easyMap.forEach(([from, to]) => { s = s.replace(from, to); });
    if (s.length > 150) s = s.slice(0, 145).replace(/\s+\S*$/, '') + '.';
    return s;
  }).join(' ');
}
