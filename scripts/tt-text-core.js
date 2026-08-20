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
  // Generic last-resort filler words (used only when there is no real vocab and
  // no source text). Returned as clean headwords - never with a "(topic)"
  // suffix, which read as junk (e.g. "problem (travel problems)") on flashcards.
  const words = [
    'problem','reason','example','solution','opinion','evidence','summary','question','answer','detail','choice','result',
    'benefit','challenge','risk','change','habit','goal','plan','step','mistake','feedback','context','connection',
    'comparison','contrast','cause','effect','purpose','support','argument','decision','experience','prediction',
    'reaction','preference','advice','request','offer','complaint','agreement','disagreement','priority','routine',
    'process','feature','pattern','rule','exception','keyword','phrase','collocation','revision'
  ];
  return words.slice(0, count);
}

function teacherToolSourceSentences(text, topic, count = 6) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(x => x.trim())
    .filter(Boolean);
  const fallback = [
    `${topic} can be easy to understand when students see a clear example.`,
    `Students often need useful language, controlled practice and time to produce their own answer.`,
    `A good task gives a reason to communicate, not only a gap to complete.`,
    `Teacher feedback should focus on one strong point and one next improvement.`,
    `The final activity should help students reuse the target language in a personal way.`,
    `Homework should recycle the same language with a small new challenge.`,
    `A useful lesson about ${topic} should include examples, practice and reflection.`,
    `Students can compare different opinions about ${topic} and explain their reasons.`,
    `The teacher can turn common mistakes into a short review task.`,
    `A final speaking task helps students use the new language naturally.`
  ];
  // Real source text: return only the genuine sentences (never inflate the
  // count with generic filler - better 8 relevant items than 20 with 12 junk).
  if (s.length) return s.slice(0, count);
  // No source at all (only reached by text-adaptation, since source-based
  // tools are gated behind a "paste text" check): use the pedagogical fallback.
  const out = fallback.slice(0, count);
  for (let i = out.length; i < count; i++) out.push(fallback[i % fallback.length]);
  return out;
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
