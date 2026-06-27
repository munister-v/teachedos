/* ════════════════════════════════════════════════════════════════════
   TeachEd — local teacher-tool GENERATION engine (PILOT heuristic generators).
   Extracted from board-app.js and loaded ON DEMAND (only when a teacher first
   generates), via _ensureGenLoaded() in board-app.js. Keeps the core board
   bundle smaller/faster to parse. Classic script — globals, no module.
   Shared helpers _ttShuffle / _ttHideRetry / _ttEstWorksheetHeight stay in
   board-app.js (also used by core), so this file references them as globals.
   ════════════════════════════════════════════════════════════════════ */
/* ════════════════ PILOT: real local-heuristic generators ════════════════
   These three tools build genuine, structured output from the teacher's
   pasted source text (no API, no model) and drop proper cards on the board:
   - abcd-text   → assignment (Quiz) with real MCQ cloze questions + key
   - true-false  → assignment (Quiz) with True/False statements + key
   - extract-vocab → a frame of real vocab cards (word + example from text)
   Anything else falls back to the legacy template generator below.        */
// All 62 tools covered — specific generators for quality ones, _ttGenScaffold for the rest.
const TT_PILOT_TOOLS = Object.fromEntries(
  (typeof BOARD_TEACHER_TOOLS !== 'undefined' ? BOARD_TEACHER_TOOLS : []).map(t => [t.id, 1])
);
const _TT_STOP = new Set(('the a an and or but of to in on at for with as by from is are was were be been being this that these those it its he she him her they them we us you your our my his their not no do does did have has had will would shall can could should may might must about into over under than then so if when while because before after during between among each every some any all both more most other such only own same very just also too not nor only own here there what which who whom whose why how').split(/\s+/));
function _ttCap(w){ w = String(w||''); return w ? w[0].toUpperCase() + w.slice(1) : w; }
function _ttWords(text){ return (String(text||'').toLowerCase().match(/[a-z][a-z'-]{1,}/g) || []); }
function _ttContentWords(text, min){
  min = min || 4; const seen = new Set(); const out = [];
  for (const w of _ttWords(text)) {
    const base = w.replace(/^[^a-z]+|[^a-z]+$/g,'');
    if (base.length >= min && !_TT_STOP.has(base) && !seen.has(base)) { seen.add(base); out.push(base); }
  }
  return out;
}
function _ttBlank(sentence, word){
  const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b', 'i');
  return sentence.replace(re, '_____');
}

// Build (sentence, target-word) pairs — up to `perSentence` different content
// words per sentence — so a short text still yields many distinct questions
// (each blanks a different word). Interleaved so variety comes first.
function _ttSentenceTargets(sents, perSentence = 3){
  const rows = sents.map(s => ({ s, ws: _ttContentWords(s).sort((a,b)=>b.length-a.length).slice(0, perSentence) }));
  const out = [];
  for (let k = 0; k < perSentence; k++) for (const r of rows) if (r.ws[k]) out.push([r.s, r.ws[k]]);
  return out;
}

function _ttGenAbcd(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 60)
    .filter(s => s.split(/\s+/).length >= 5 && _ttContentWords(s).length);
  const pool = _ttContentWords(input.source || sents.join(' '));
  if (sents.length < 1 || pool.length < 4) return null;
  const questions = [];
  for (const [s, target] of _ttSentenceTargets(sents, 3)) {
    if (questions.length >= input.count) break;
    if (!target) continue;
    const candidates = pool
      .filter(w => w !== target && !s.toLowerCase().includes(w))
      .sort((a,b) => Math.abs(a.length - target.length) - Math.abs(b.length - target.length));
    const distract = [];
    const top = candidates.slice(0, 8);
    while (distract.length < 3 && top.length) distract.push(top.splice(Math.floor(Math.random()*top.length),1)[0]);
    const fb = ['information','example','process','reason','result','idea'];
    while (distract.length < 3) { const w = fb.shift(); if (w && w !== target && !distract.includes(w)) distract.push(w); }
    const options = _ttShuffle([target, ...distract].map(_ttCap));
    questions.push({ type:'mcq', text:'Complete from the text: ' + _ttBlank(s, target), options, answer:_ttCap(target), points:1 });
  }
  return questions.length
    ? { boardKind:'quiz', kind:'MCQ', cat:'reading', level:input.level, topic:input.topic, title:`${input.level} · ABCD Questions: ${input.topic}`, questions }
    : null;
}

function _ttGenTrueFalse(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 60)
    .filter(s => s.split(/\s+/).length >= 4);
  const pool = _ttContentWords(input.source);
  if (!sents.length) return null;
  const questions = [];
  const seenTrue = new Set();
  let tfIdx = 0;
  for (const [s, target] of _ttSentenceTargets(sents, 2)) {
    if (questions.length >= input.count) break;
    const makeFalse = tfIdx % 2 === 1; // alternate true / false
    tfIdx++;
    if (!makeFalse) {
      if (seenTrue.has(s)) continue;            // never repeat an identical TRUE statement
      seenTrue.add(s);
      questions.push({ type:'truefalse', text:s, answer:true, points:1 });
    } else {
      const repl = pool.find(w => w !== target && Math.abs(w.length - (target ? target.length : 0)) <= 3 && !s.toLowerCase().includes(w));
      if (target && repl) {
        questions.push({ type:'truefalse', text:_ttBlank(s, target).replace('_____', _ttCap(repl)), answer:false, points:1 });
      } else if (!seenTrue.has(s)) {
        seenTrue.add(s);
        questions.push({ type:'truefalse', text:s, answer:true, points:1 });
      }
    }
  }
  return questions.length
    ? { boardKind:'quiz', kind:'Check', cat:'reading', level:input.level, topic:input.topic, title:`${input.level} · True / False: ${input.topic}`, questions }
    : null;
}

function _ttGenExtractVocab(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 80);
  const freq = new Map();
  for (const w of _ttWords(input.source)) {
    const base = w.replace(/^[^a-z]+|[^a-z]+$/g,'');
    if (base.length >= 4 && !_TT_STOP.has(base)) freq.set(base, (freq.get(base)||0) + 1);
  }
  const words = [...freq.entries()]
    .sort((a,b) => (b[1]-a[1]) || (b[0].length - a[0].length))
    .slice(0, input.count)
    .map(e => e[0]);
  if (!words.length) return null;
  const items = words.map(w => {
    const ex = sents.find(s => new RegExp('\\b'+w+'\\b','i').test(s)) || '';
    return { word:_ttCap(w), example:ex };
  });
  return { boardKind:'vocab', kind:'Extraction', cat:'vocabulary', level:input.level, topic:input.topic, title:`${input.level} · Vocabulary: ${input.topic}`, items };
}

function _ttGenGapFill(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 60)
    .filter(s => s.split(/\s+/).length >= 5 && _ttContentWords(s).length);
  if (!sents.length) return null;
  const questions = [];
  for (const [s, target] of _ttSentenceTargets(sents, 3)) {
    if (questions.length >= input.count) break;
    if (!target) continue;
    questions.push({ type:'gap-fill', text:_ttBlank(s, target), answer:target, points:1 });
  }
  return questions.length
    ? { boardKind:'quiz', kind:'Gap Fill', cat:'grammar', level:input.level, topic:input.topic, title:`${input.level} · Fill in the Gap: ${input.topic}`, questions }
    : null;
}

function _ttGenOpenQuestions(input){
  const wordTemplates = [
    (w, topic) => `What does the text say about ${w}?`,
    w => `Why is ${w} important here?`,
    (w, topic) => `How is ${w} connected to ${topic}?`,
    w => `What is your opinion about ${w}? Give a reason.`,
    w => `Can you explain ${w} in your own words?`,
    w => `What example of ${w} can you think of?`,
    w => `How would you describe ${w} to a friend?`,
    w => `What questions do you still have about ${w}?`,
  ];
  const topicTemplates = [
    t => `What is the main idea about ${t}?`,
    t => `What did you find most interesting about ${t}?`,
    t => `What would you like to know more about regarding ${t}?`,
    t => `How does ${t} relate to your own life?`,
    t => `What is one new thing you learned about ${t}?`,
    t => `Do you agree with what was said about ${t}? Why?`,
  ];
  const questions = _ttScaleQuestions(input, wordTemplates, topicTemplates)
    .map(text => ({ type:'open', text, points:2 }));
  return questions.length
    ? { boardKind:'quiz', kind:'Questions', cat:'reading', level:input.level, topic:input.topic, title:`${input.level} · Open Questions: ${input.topic}`, questions }
    : null;
}

function _ttGenGapsAbcd(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 60)
    .filter(s => s.split(/\s+/).length >= 5 && _ttContentWords(s).length);
  const pool = _ttContentWords(input.source || '');
  if (!sents.length || pool.length < 4) return null;
  const questions = [];
  for (const [s, target] of _ttSentenceTargets(sents, 3)) {
    if (questions.length >= input.count) break;
    if (!target) continue;
    const cands = pool.filter(w => w !== target && !s.toLowerCase().includes(w))
      .sort((a,b) => Math.abs(a.length-target.length)-Math.abs(b.length-target.length));
    const distract = [];
    const top = cands.slice(0,8);
    while (distract.length < 3 && top.length) distract.push(top.splice(Math.floor(Math.random()*top.length),1)[0]);
    const fb = ['form','tense','structure','pattern','word','phrase'];
    while (distract.length < 3){ const w=fb.shift(); if(w&&w!==target&&!distract.includes(w)) distract.push(w); }
    const options = _ttShuffle([target,...distract].map(_ttCap));
    questions.push({ type:'mcq', text:'Choose the correct word: '+_ttBlank(s,target), options, answer:_ttCap(target), points:1 });
  }
  return questions.length
    ? { boardKind:'quiz', kind:'MCQ', cat:'grammar', level:input.level, topic:input.topic,
        title:`${input.level} · Gaps with ABCD: ${input.topic}`, questions }
    : null;
}

// Reverse index of the topic vocabulary library: word → { uk, ex }. Lets the
// fast (offline) path auto-fill a definition/example for common words without
// any source text. Built once and cached.
let _ttVocabIndexCache = null;
function _ttVocabLibIndex(){
  if (_ttVocabIndexCache) return _ttVocabIndexCache;
  const idx = {};
  const V = (typeof window !== 'undefined') && window.TEACHEDOS_VOCAB;
  if (V && typeof V.listTopics === 'function' && typeof V.getWords === 'function') {
    try {
      for (const t of V.listTopics()) {
        for (const w of (V.getWords(t.id, 'mix') || [])) {
          const k = String(w.en || '').trim().toLowerCase();
          if (k && !idx[k]) idx[k] = { uk: w.uk || '', ex: w.ex || '' };
        }
      }
    } catch {}
  }
  _ttVocabIndexCache = idx;
  return idx;
}

// Word-Definition Match works from the teacher's WORD LIST (no source text
// needed). The definition is auto-filled from a source sentence when text is
// pasted, otherwise from the vocab library; the AI path writes real definitions.
function _ttGenWordDefinitionMatch(input){
  const words = _ttVocabLines(input).slice(0, input.count);
  if (words.length < 2) return null;
  const sents = input.source ? teacherToolSourceSentences(input.source, input.topic, 80) : [];
  const lib = _ttVocabLibIndex();
  const reEsc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pairs = words.map(w => {
    let right = '';
    if (sents.length) {
      const ex = sents.find(s => new RegExp('\\b' + reEsc(w) + '\\b', 'i').test(s));
      if (ex) right = ex.length > 100 ? ex.slice(0, 100) + '…' : ex;
    }
    if (!right) { const hit = lib[String(w).toLowerCase()]; if (hit) right = hit.ex || hit.uk || ''; }
    return { left: _ttCap(w), right };
  });
  return { boardKind:'quiz', kind:'Matching', cat:'vocabulary', level:input.level, topic:input.topic,
    title:`${input.level} · Word-Definition Match: ${input.topic}`,
    questions: [{ type:'match', text:'Match each word to its definition.', pairs, points: pairs.length }] };
}

/* ── collocations ────────────────────────────────────────────────── */
function _ttGenCollocations(input){
  const words = _ttVocabLines(input).slice(0, input.count);
  if (!words.length) return null;
  const questions = words.map(w => ({
    type:'open',
    text:`Write 2 collocations with "${_ttCap(w)}" and use each in a sentence.`,
    points:2,
  }));
  return { boardKind:'quiz', kind:'Collocations', cat:'vocabulary', level:input.level, topic:input.topic,
    title:`${input.level} · Collocations: ${input.topic}`, questions };
}

/* ── synonyms-antonyms ───────────────────────────────────────────── */
function _ttGenSynonymsAntonyms(input){
  const words = _ttVocabLines(input).slice(0, input.count);
  if (!words.length) return null;
  const questions = words.map(w => ({
    type:'open',
    text:`Give one synonym and one antonym for "${_ttCap(w)}". Use the synonym in a sentence.`,
    points:2,
  }));
  return { boardKind:'quiz', kind:'Synonyms & Antonyms', cat:'vocabulary', level:input.level, topic:input.topic,
    title:`${input.level} · Synonyms & Antonyms: ${input.topic}`, questions };
}

/* ── word-families ───────────────────────────────────────────────── */
function _ttGenWordFamilies(input){
  const words = _ttVocabLines(input).slice(0, input.count);
  if (!words.length) return null;
  const questions = words.map(w => ({
    type:'open',
    text:`Complete the word family for "${_ttCap(w)}":\nNoun: ___  Verb: ___  Adjective: ___  Adverb: ___`,
    points:3,
  }));
  return { boardKind:'quiz', kind:'Word Families', cat:'vocabulary', level:input.level, topic:input.topic,
    title:`${input.level} · Word Families: ${input.topic}`, questions };
}

/* ── phrasal-verbs ───────────────────────────────────────────────── */
function _ttGenPhrasalVerbs(input){
  const words = _ttVocabLines(input).slice(0, input.count);
  if (!words.length) return null;
  const questions = words.map(w => ({
    type:'open',
    text:`Complete the sentence using "${_ttCap(w)}":\n"Yesterday, I _______________."\nThen explain what it means.`,
    points:2,
  }));
  return { boardKind:'quiz', kind:'Phrasal Verbs', cat:'vocabulary', level:input.level, topic:input.topic,
    title:`${input.level} · Phrasal Verbs: ${input.topic}`, questions };
}

/* ── idioms ─────────────────────────────────────────────────────── */
function _ttGenIdioms(input){
  const words = _ttVocabLines(input).slice(0, input.count);
  if (!words.length) return null;
  const questions = words.map(w => ({
    type:'open',
    text:`Explain the meaning of "${_ttCap(w)}" and write a sentence using it in context.`,
    points:2,
  }));
  return { boardKind:'quiz', kind:'Idioms', cat:'vocabulary', level:input.level, topic:input.topic,
    title:`${input.level} · Idioms: ${input.topic}`, questions };
}

function _ttGenErrorCorrection(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 60)
    .filter(s => s.split(/\s+/).length >= 5 && _ttContentWords(s).length >= 2);
  const pool = _ttContentWords(input.source || '');
  if (!sents.length || pool.length < 3) return null;
  const questions = [];
  for (const s of sents) {
    if (questions.length >= input.count) break;
    const words = _ttContentWords(s);
    const target = words.sort((a,b)=>b.length-a.length)[0];
    const repl = pool.find(w => w !== target && Math.abs(w.length-target.length) <= 2 && !s.toLowerCase().includes(w));
    if (!target || !repl) { questions.push({ type:'open', text:'Is this sentence correct? If not, correct it:\n"'+s+'"', answer:s, points:2 }); continue; }
    const broken = s.replace(new RegExp('\\b'+target+'\\b','i'), repl);
    questions.push({ type:'open', text:'Find and correct the mistake:\n"'+broken+'"', answer:s, points:2 });
  }
  return questions.length
    ? { boardKind:'quiz', kind:'Correction', cat:'grammar', level:input.level, topic:input.topic,
        title:`${input.level} · Error Correction: ${input.topic}`, questions }
    : null;
}

/* Most meaningful item count for the preview chip. A single "match" question
   (sorting / word-definition) really contains N pairs, so count those. */
function _ttCountItems(out){
  if (!out) return null;
  if (Array.isArray(out.questions)) {
    if (out.questions.length === 1 && Array.isArray(out.questions[0].pairs)) return out.questions[0].pairs.length;
    return out.questions.length;
  }
  if (Array.isArray(out.items)) return out.items.length;
  // Card-based tools (reading text, summary, grammar rules…) wrap a small set of
  // STRUCTURAL cards (text / glossary / before / after) around a larger set of
  // teachable items. Report the meaningful count — the glossary/vocab — instead
  // of the 3–4 wrapper cards, so "12 items" never shows up as "4". Only when the
  // vocab list is genuinely larger than the card count (i.e. the cards are
  // wrappers, not the content themselves, as in flashcards).
  const cards = Array.isArray(out.cards) ? out.cards.length : 0;
  const vocab = Array.isArray(out.vocab) ? out.vocab.length : 0;
  if (cards && vocab > cards) return vocab;
  if (cards) return cards;
  if (vocab) return vocab;
  return null;
}

/* ── vocab-field helper ─────────────────────────────────────────── */
function _ttVocabLines(input){
  const lines = String(input.vocab||'').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
  const count = Math.max(1, input.count || 0);
  if (lines.length) {
    // If the teacher's own vocab list is shorter than the requested count, top
    // it up ONLY with real content words from the pasted source text (deduped).
    // We deliberately do NOT pad with generic topic seeds: a short list of real
    // words beats inflating it with off-topic filler like "problem", "reason".
    if (lines.length >= count) return lines;
    const seen = new Set(lines.map(w => w.toLowerCase()));
    for (const w of _ttContentWords(input.source||'')) {
      if (lines.length >= count) break;
      const key = String(w).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(w);
    }
    return lines;
  }
  const fromSource = _ttContentWords(input.source).slice(0, count);
  return fromSource.length ? fromSource : teacherToolTopicSeeds(input.topic, count);
}

/* ── content pool: target vocabulary ∪ source content words ──────────
   Real, meaningful subjects for topic-style tools (discussion, open
   questions, ladders). Unlike teacherToolTopicSeeds it does NOT inject
   generic filler words, so questions stay natural. */
function _ttContentPool(input){
  const out = [], seen = new Set();
  const push = w => {
    const v = String(w || '').trim();
    const k = v.toLowerCase();
    if (v && !seen.has(k)) { seen.add(k); out.push(v); }
  };
  String(input.vocab||'').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean).forEach(push);
  _ttContentWords(input.source||'').forEach(push);
  return out;
}

/* Build up to `count` unique question strings by cycling a word-template bank
   over the content pool (diagonally, for variety), then filling any shortfall
   from a bank of topic-level templates. Honours input.count for every tool
   that isn't bound to a fixed source text. */
function _ttScaleQuestions(input, wordTemplates, topicTemplates){
  const count = Math.max(1, input.count || 5);
  const topic = _ttCap(input.topic || 'this topic');
  const realPool = _ttContentPool(input);
  // No vocab / no source → treat the topic itself as the single subject so the
  // word-template bank still contributes (instead of only topic templates).
  const pool = realPool.length ? realPool : [topic];
  const out = [], used = new Set();
  const add = text => { if (text && !used.has(text)) { used.add(text); out.push(text); } };
  if (pool.length && wordTemplates.length) {
    const total = pool.length * wordTemplates.length;
    for (let i = 0; out.length < count && i < total; i++) {
      const w = _ttCap(pool[i % pool.length]);
      const t = wordTemplates[Math.floor(i / pool.length) % wordTemplates.length];
      add(t(w, topic));
    }
  }
  for (let i = 0; out.length < count && i < topicTemplates.length; i++) {
    add(topicTemplates[i](topic));
  }
  return out;
}

/* ── essential-vocab / flashcards ───────────────────────────────── */
function _ttGenEssentialVocab(input){
  const words = _ttVocabLines(input).slice(0, input.count);
  if (!words.length) return null;
  const sents = teacherToolSourceSentences(input.source||'', input.topic, 80);
  const items = words.map(w => ({
    word: _ttCap(w),
    example: sents.find(s => new RegExp('\\b'+w+'\\b','i').test(s)) || '',
  }));
  return { boardKind:'vocab', kind:'Essential', cat:'vocabulary', level:input.level, topic:input.topic,
    title:`${input.level} · Essential Vocabulary: ${input.topic}`, items };
}
function _ttGenFlashcards(input){
  const out = _ttGenEssentialVocab(input);
  return out ? { ...out, kind:'Flashcard Set', title:`${input.level} · Flashcards: ${input.topic}` } : null;
}

/* ── sentences-vocab ────────────────────────────────────────────── */
function _ttGenSentencesVocab(input){
  const words = _ttVocabLines(input).slice(0, input.count);
  if (!words.length) return null;
  const questions = words.map(w => ({
    type:'open', text:`Make a sentence using the word: "${_ttCap(w)}"`, points:2,
  }));
  return { boardKind:'quiz', kind:'Sentence Set', cat:'vocabulary', level:input.level, topic:input.topic,
    title:`${input.level} · Sentences with Vocabulary: ${input.topic}`, questions };
}

/* ── odd-one-out ────────────────────────────────────────────────── */
function _ttGenOddOneOut(input){
  const words = _ttVocabLines(input).map(_ttCap);
  if (words.length < 4) return null;
  const questions = [], used = new Set();
  // Build up to `count` distinct groups of 4 by re-shuffling the pool; allow
  // overlap between groups but keep each group's membership unique.
  for (let attempt = 0; questions.length < input.count && attempt < input.count * 6; attempt++){
    const set = _ttShuffle([...words]).slice(0, 4).sort();
    const key = set.join('|');
    if (used.has(key)) continue;
    used.add(key);
    questions.push({ type:'open', text:`Which word is the odd one out? Explain why:\n${set.join(' / ')}`, points:2 });
  }
  return { boardKind:'quiz', kind:'Odd One Out', cat:'vocabulary', level:input.level, topic:input.topic,
    title:`${input.level} · Odd One Out: ${input.topic}`, questions };
}

/* ── word-sorting ───────────────────────────────────────────────── */
function _ttGenWordSorting(input){
  const words = _ttVocabLines(input).slice(0, input.count);
  if (words.length < 3) return null;
  const half = Math.ceil(words.length/2);
  const pairs = words.map((w,i) => ({ left:_ttCap(w), right: i < half ? 'Category A' : 'Category B' }));
  return { boardKind:'quiz', kind:'Word Sort', cat:'vocabulary', level:input.level, topic:input.topic,
    title:`${input.level} · Words Sorting: ${input.topic}`,
    questions:[{ type:'match', text:'Sort these words into two categories. Decide on the category names.', pairs, points:pairs.length }] };
}

/* ── gaps-brackets ──────────────────────────────────────────────── */
// Scaled with _ttSentenceTargets: up to 3 different words per sentence blanked,
// so 3 sentences → up to 9 exercises instead of 3.
function _ttGenGapsBrackets(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 60)
    .filter(s => s.split(/\s+/).length >= 5 && _ttContentWords(s).length);
  if (!sents.length) return null;
  const targets = _ttSentenceTargets(sents, 3);
  const questions = [];
  for (const [s, target] of targets){
    if (questions.length >= input.count) break;
    questions.push({ type:'open',
      text:`Use the word in the correct form:\n"${_ttBlank(s,target)}"  (${target.toUpperCase()})`,
      answer:target, points:1 });
  }
  return questions.length ? { boardKind:'quiz', kind:'Word Form', cat:'grammar', level:input.level, topic:input.topic,
    title:`${input.level} · Gaps with Brackets: ${input.topic}`, questions } : null;
}

/* ── two-options ────────────────────────────────────────────────── */
// Scaled with _ttSentenceTargets: 2 words per sentence → more questions from short texts.
function _ttGenTwoOptions(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 60)
    .filter(s => s.split(/\s+/).length >= 5 && _ttContentWords(s).length >= 2);
  const pool = _ttContentWords(input.source||'');
  if (!sents.length || pool.length < 2) return null;
  const targets = _ttSentenceTargets(sents, 2);
  const questions = [];
  for (const [s, a] of targets){
    if (questions.length >= input.count) break;
    // Distractor: a content word from the pool with similar length, not in this sentence
    const distractor = pool.find(w => w !== a && Math.abs(w.length-a.length) <= 2 && !s.toLowerCase().includes(w))
      || pool.find(w => w !== a) || a + 's';
    questions.push({ type:'mcq', text:`Choose the correct option:\n"${_ttBlank(s,a)}"`,
      options:_ttShuffle([_ttCap(a), _ttCap(distractor)]), answer:_ttCap(a), points:1 });
  }
  return questions.length ? { boardKind:'quiz', kind:'Two Options', cat:'grammar', level:input.level, topic:input.topic,
    title:`${input.level} · Two Options: ${input.topic}`, questions } : null;
}

/* ── rewrite (key-word transformation) ─────────────────────────── */
// CAE-style sentence transformation. Source sentences become the original
// sentences; a rotating set of linking words serves as the KEY WORD prompt.
// The AI upgrade replaces these with real transformations; this is the draft.
function _ttGenRewrite(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 60)
    .filter(s => s.split(/\s+/).length >= 6);
  if (!sents.length) return null;
  const targets = _ttSentenceTargets(sents, 2);
  const KWS = ['although','however','despite','unless','because','so that',
    'in order to','not only','as well as','even though','due to','provided that',
    'had','were','being','having','despite','without','instead of','as long as'];
  let ki = 0;
  const questions = [];
  for (const [s] of targets){
    if (questions.length >= input.count) break;
    const kw = KWS[ki++ % KWS.length].toUpperCase();
    questions.push({ type:'open',
      text:`Complete the second sentence so it has a similar meaning. Use the word in capitals (do NOT change it).\n\n"${s}"\n\n${kw} _______________`,
      answer:'', points:2 });
  }
  return questions.length
    ? { boardKind:'quiz', kind:'Transformation', cat:'grammar', level:input.level, topic:input.topic,
        title:`${input.level} · Rewrite the Sentence: ${input.topic}`, questions }
    : null;
}

/* ── tense-contrast ─────────────────────────────────────────────── */
// Level-appropriate tense pair MCQs.  Source sentences illustrate context;
// without a source text, a free-writing prompt is generated instead.
function _ttGenTenseContrast(input){
  const lvl = String(input.level||'B1').match(/[A-C][12]/)?.[0] || 'B1';
  const PAIRS = {
    A1:[['Present Simple','Present Continuous']],
    A2:[['Present Simple','Present Continuous'],['Past Simple','Past Continuous']],
    B1:[['Past Simple','Present Perfect'],['Past Continuous','Past Simple']],
    B2:[['Present Perfect','Present Perfect Continuous'],['Past Perfect','Past Simple']],
    C1:[['Future Perfect','Future Continuous'],['Past Perfect Continuous','Past Simple']],
    C2:[['Past Perfect Continuous','Present Perfect Continuous'],['Future Perfect','Future Perfect Continuous']],
  };
  const [tA, tB] = (PAIRS[lvl]||PAIRS.B1)[0];
  const sents = teacherToolSourceSentences(input.source||'', input.topic, 60)
    .filter(s => s.split(/\s+/).length >= 5).slice(0, input.count);
  const questions = [];
  for (const s of sents){
    if (questions.length >= input.count) break;
    // The rule engine can't reliably detect which tense a source sentence uses,
    // so we ask students to identify it (open) instead of asserting a fixed,
    // often-wrong MCQ answer. The AI upgrade produces graded gap MCQs.
    questions.push({ type:'open',
      text:`Which tense is used here — ${tA} or ${tB}? Underline the verb and explain why.\n"${s}"`,
      points:1 });
  }
  if (!questions.length){
    // No source text — open writing prompt
    questions.push({ type:'open',
      text:`Write 3 sentences using the ${tA} and 3 using the ${tB} about "${input.topic || 'the topic'}". Explain in one line why you chose each tense.`,
      points:4 });
  }
  return { boardKind:'quiz', kind:'Tense Contrast', cat:'grammar', level:input.level, topic:input.topic,
    title:`${input.level} · ${tA} vs ${tB}: ${input.topic}`, questions };
}

/* ── gist + detail ──────────────────────────────────────────────── */
function _ttGenGistDetail(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 60)
    .filter(s => s.split(/\s+/).length >= 4);
  const pool = _ttContentWords(input.source||'');
  if (!sents.length) return null;
  const questions = [];
  const gt = pool.sort((a,b)=>b.length-a.length)[0] || input.topic;
  const gDistract = _ttShuffle(pool.filter(w=>w!==gt)).slice(0,3).map(_ttCap);
  while (gDistract.length < 3) gDistract.push(['topic','idea','theme'][gDistract.length]||'concept');
  questions.push({ type:'mcq', text:'What is the main topic of this text?',
    options:_ttShuffle([_ttCap(gt),...gDistract]), answer:_ttCap(gt), points:1 });
  // Detail questions scaled to the requested count (a short text shouldn't yield
  // only 2 questions). This is an instant local DRAFT — the AI upgrade turns most
  // of these into detail MCQs; here they are open prompts cycling the key words.
  const detailT = ['What does the text say about _____?','Why is _____ important here?',
    'How is _____ described in the text?','What happens to _____?',
    'What is the writer\'s view on _____?','What detail is given about _____?'];
  const dWords = pool.filter(w => w !== gt);
  const words = dWords.length ? dWords : [gt || input.topic || 'the topic'];
  for (let di = 0; questions.length < Math.max(2, input.count) && di < input.count * 4; di++) {
    const w = _ttCap(words[di % words.length]);
    questions.push({ type:'open', text: detailT[(questions.length - 1) % detailT.length].replace('_____', w), points:2 });
  }
  return questions.length ? { boardKind:'quiz', kind:'Gist+Detail', cat:'reading', level:input.level, topic:input.topic,
    title:`${input.level} · Gist + Detail: ${input.topic}`, questions } : null;
}

/* ── discussion questions (speaking) ────────────────────────────── */
function _ttGenDiscussion(input){
  // The "word" here is a vocabulary item (lexis), not a discussion subject —
  // so frame each question around the TOPIC and ask students to USE the word,
  // shown lowercased and quoted. This avoids clumsy, mis-capitalised phrasing
  // like "Have you ever experienced anything related to Complaint?".
  const lex = w => `"${String(w).toLowerCase()}"`;
  const wordTemplates = [
    (w, topic) => `Talk about ${topic}. Try to use the word ${lex(w)} naturally.`,
    (w, topic) => `Describe a personal experience with ${topic}. Include the word ${lex(w)}.`,
    (w, topic) => `When we talk about ${topic}, how important is ${lex(w)}? Why?`,
    (w, topic) => `Give a real example of ${lex(w)} connected to ${topic}.`,
    (w, topic) => `How would you explain ${lex(w)} to someone new to ${topic}?`,
    (w, topic) => `Tell your partner about a time ${lex(w)} mattered for ${topic}.`,
    (w, topic) => `Do you agree that ${lex(w)} is a key idea in ${topic}? Why / why not?`,
    (w, topic) => `What advice would you give about ${lex(w)} when dealing with ${topic}?`,
  ];
  const topicTemplates = [
    t => `What is your personal experience with ${t}?`,
    t => `Why do you think ${t} matters today?`,
    t => `How do people in your country usually deal with ${t}?`,
    t => `What is the biggest misconception about ${t}?`,
    t => `If you could change one thing about ${t}, what would it be?`,
    t => `How might ${t} look different in the future?`,
    t => `What advice would you give someone struggling with ${t}?`,
    t => `Do you think ${t} is getting better or worse? Why?`,
    t => `What role does technology play in ${t}?`,
    t => `Tell a short story related to ${t}.`,
  ];
  const questions = _ttScaleQuestions(input, wordTemplates, topicTemplates)
    .map(text => ({ type:'open', text, points:2 }));
  return questions.length ? { boardKind:'quiz', kind:'Discussion', cat:'speaking', level:input.level, topic:input.topic,
    title:`${input.level} · Discussion Questions: ${input.topic}`, questions } : null;
}

/* ── question ladder ────────────────────────────────────────────── */
function _ttGenQuestionLadder(input){
  // One 5-rung ladder per subject; add subjects until we reach input.count rungs.
  const rungs = [
    w => ({ type:'open', text:`Level 1 — Factual: What is ${w}? Give a short definition.`, points:1 }),
    w => ({ type:'open', text:`Level 2 — Descriptive: What is ${w} like? Describe it in 2–3 sentences.`, points:1 }),
    w => ({ type:'open', text:`Level 3 — Analytical: Why does ${w} happen / exist? Explain the reason.`, points:2 }),
    w => ({ type:'open', text:`Level 4 — Evaluative: Is ${w} positive or negative overall? Give evidence.`, points:2 }),
    w => ({ type:'open', text:`Level 5 — Personal: How does ${w} affect you or your community?`, points:3 }),
  ];
  const pool = _ttContentPool(input);
  const subjects = pool.length ? pool : [input.topic || 'the topic'];
  const count = Math.max(3, input.count || 5);
  const questions = [];
  for (let s = 0; s < subjects.length && questions.length < count; s++) {
    const w = _ttCap(subjects[s]);
    for (let r = 0; r < rungs.length && questions.length < count; r++) questions.push(rungs[r](w));
  }
  return { boardKind:'quiz', kind:'Question Ladder', cat:'speaking', level:input.level, topic:input.topic,
    title:`${input.level} · Question Ladder: ${input.topic}`, questions };
}

/* ── role-play cards ────────────────────────────────────────────── */
function _ttGenRoleplay(input){
  const topic=input.topic||'the topic', vocab=_ttVocabLines(input).slice(0,4).join(', ')||'useful language';
  return { boardKind:'cards', kind:'Role-Play', cat:'speaking', level:input.level, topic, title:`${input.level} · Role-Play Cards: ${topic}`,
    cards:[
      { title:'Role A', text:`You are supporting / asking about ${topic}.\nUse: ${vocab}.` },
      { title:'Role B', text:`You are opposing / responding about ${topic}.\nUse: ${vocab}.` },
      { title:'Useful language', text:'Agreeing: I think… / You\'re right…\nDisagreeing: I\'m not sure… / Actually…\nAsking: Could you explain…? / What do you mean?' },
    ]};
}

/* ── debate cards ───────────────────────────────────────────────── */
function _ttGenDebate(input){
  const topic=input.topic||'the topic';
  const words=_ttContentWords(input.source||'').slice(0,3);
  const mkFor = words.length>=2 ? words.map(w=>`${_ttCap(w)} supports this view.`) : [`${topic} has clear benefits.`,'Evidence from research supports it.','Many people benefit from it.'];
  const mkAgainst = words.length>=2 ? words.map(w=>`${_ttCap(w)} could be seen as a problem.`) : [`${topic} has real disadvantages.`,'Not everyone benefits equally.','There are risks to consider.'];
  return { boardKind:'cards', kind:'Debate', cat:'speaking', level:input.level, topic, title:`${input.level} · Debate Cards: ${topic}`,
    cards:[
      { title:'✅ FOR', text:mkFor.join('\n') },
      { title:'❌ AGAINST', text:mkAgainst.join('\n') },
      { title:'Discussion', text:`Is ${topic} more positive or negative overall?\nUse evidence and give your personal opinion.` },
    ]};
}

/* ── listening tools (reuse reading patterns) ───────────────────── */
function _ttGenListeningDictation(input){
  const sents = teacherToolSourceSentences(input.source, input.topic, 40)
    .filter(s=>s.split(/\s+/).length>=4).slice(0,input.count);
  if (!sents.length) return null;
  const questions = sents.map(s=>({ type:'gap-fill', text:_ttBlank(s,_ttContentWords(s)[0]||''), answer:_ttContentWords(s)[0]||'', points:1 }));
  return { boardKind:'quiz', kind:'Dictation', cat:'listening', level:input.level, topic:input.topic,
    title:`${input.level} · Dictation: ${input.topic}`, questions };
}

/* ── generic scaffold for all remaining tools ────────────────────── */
function _ttGenLessonPack(input){
  const t=input.topic||'Everyday English', lv=input.level||'B1', tl=t.toLowerCase();
  const ws=_ttContentWords((input.vocab||'')+' '+(input.source||'')+' '+t,4).slice(0,8);
  const vocStr=ws.slice(0,6).join(', ')||tl;
  return {boardKind:'cards',kind:'Lesson Pack',cat:'utility',level:lv,topic:t,
    title:`${lv} · Lesson Plan: ${t}`,cards:[
    {title:'🎯 Lesson aims & objectives',
     text:`Topic: ${t} · Level: ${lv}\nDuration: ~60 min\n\nBy the end, students will be able to:\n• Use target vocabulary in context: ${vocStr}\n• Identify gist and key details in the input\n• Complete controlled practice (80%+ accuracy)\n• Communicate ideas on "${tl}" for 2+ minutes\n\n📌 Key vocabulary: ${vocStr}\n📌 Target structure / skill: ________________________________\n📌 Materials needed: ________________________________`},
    {title:'🔥 Warm-up & lead-in (7 min)',
     text:`Option A — Word association (3 min)\nWrite "${t}" on the board. Students brainstorm 8 connected words in pairs, then share. Teach 2–3 unknown words.\n\nOption B — Two Truths and a Lie (4 min)\nSay 3 statements about ${tl} — students guess which is false. Then pairs do the same.\n\nOption C — Image / quote prompt (3 min)\nShow an image about ${tl}. Students describe and predict the lesson focus.\n\n💡 Aim: activate prior knowledge + create curiosity.`},
    {title:'📖 Vocabulary presentation (8 min)',
     text:`Target words: ${vocStr}.\n\nStep-by-step:\n1. Context — show each word in a sentence (not isolated)\n2. Meaning — elicit, then confirm\n3. CCQ — ask 1–2 concept check questions per word\n4. Pronunciation — model → choral drill → individual\n5. Record — word / definition / example in notebook\n\n⏱ ~1 min per word. Don't rush — quality over quantity.\n💡 Use the Flashcards tool to build a drill activity.`},
    {title:'📄 Input & reading/listening (12 min)',
     text:`1. PRE-TASK (2 min): "What is the main idea?"\n2. FIRST READ (3 min): students find gist answer only.\n3. FEEDBACK (1 min): quick whole-class check.\n4. SECOND READ (4 min):\n   a) Find 3 specific facts about ${tl}.\n   b) Find how target vocabulary is used in context.\n   c) Identify the writer's/speaker's opinion.\n5. PEER CHECK (2 min): compare in pairs before whole-class.\n\n💡 Extension: stronger students write a 2-sentence summary.`},
    {title:'✏️ Controlled practice (10 min)',
     text:`Activity: gap-fill / matching / MCQ (choose one).\n\n1. Demo one example together.\n2. Students work individually (5 min).\n3. Peer check in pairs (2 min).\n4. Whole-class feedback (3 min).\n\nMonitoring tips:\n• Circulate — note 2–3 errors anonymously.\n• Give quiet support; avoid giving answers directly.\n\n✦ Fast finishers: write 3 new gap-fill sentences for a partner.`},
    {title:'🗣 Freer practice & production (12 min)',
     text:`Task: "Discuss with your partner — what do you think about ${tl}?"\n\n• 30 sec: individual think time (3 bullet points)\n• 3 min: pair discussion (both speak equally)\n• 1 min: report back — "My partner said that…"\n\nExpect 4+ target words used. Monitor and note:\n✅ 2 strong examples to praise\n❌ 2–3 errors for feedback\n\n💡 Fast pairs: "Now argue the opposite point of view."`},
    {title:'📋 Feedback & error correction (5 min)',
     text:`1. PRAISE (1 min) — write 2 strong student examples on board.\n   Ask: what is good about these?\n2. ERRORS (2 min) — write 2–3 anonymous errors.\n   Students identify and correct as a class.\n3. CLARIFY (2 min) — address remaining confusion.\n\n   ✗ "_______________"\n   ✓ "_______________" — because _______________\n\n📌 Keep error notes — revisit at the start of next lesson!`},
    {title:'📚 Homework (set in final 2 min)',
     text:`Task: Write 80–100 words on "${t}". Use 5+ target words.\n\nPrompt: "Describe your experience with ${tl}. Include your opinion and one recommendation for others."\n\nDifferentiation:\n✦ Support: use starters — "In my experience…" / "One thing I noticed…"\n✦ Extension: add a counter-argument and respond to it.\n\nDeadline: _______________\nSelf-check: vocabulary ☐ · opinion ☐ · spelling ☐`},
    {title:'🔄 Fast finishers & extension',
     text:`After vocabulary:\n→ Write a paragraph using 5 target words. Make it surprising or personal.\n\nAfter controlled practice:\n→ Write 3 new gap-fill sentences for a partner to solve.\n\nAfter freer practice:\n→ "Teach your partner — explain the key ideas as if they missed the lesson."\n\n🏆 Challenge:\n→ Find a real-world example of ${tl} (news, video, website) and present it in 60 sec next lesson.`},
    {title:'📊 Assessment & success criteria',
     text:`✅ Vocabulary: students define/use ${Math.min(ws.length||4,5)} words without prompting.\n✅ Comprehension: gist + 2 detail questions answered correctly.\n✅ Practice: 80%+ accuracy on controlled exercise.\n✅ Production: students speak for 90+ sec on ${tl}.\n\n☐ All students participated in warm-up.\n☐ Vocabulary drilled 3+ times.\n☐ Errors corrected anonymously.\n☐ Homework set with clear deadline.\n\nNext lesson: revisit errors → 5-min vocab quiz → homework feedback.`},
  ]};
}
function _ttGenWorksheetBoard(input){
  const t=input.topic||'English', lv=input.level||'B1', tl=t.toLowerCase();
  const ws=_ttContentWords((input.vocab||'')+' '+(input.source||'')+' '+t,4).slice(0,8);
  const wsSlice=ws.slice(0,6); const shuffled=[...wsSlice].sort(()=>Math.random()-.5);
  return {boardKind:'cards',kind:'Worksheet',cat:'utility',level:lv,topic:t,
    title:`${lv} · Worksheet: ${t}`,cards:[
    {title:'📝 Student information',
     text:`Student name: ____________________   Date: __________\nClass: ____________________   Teacher: __________\nLevel: ${lv}   Topic: ${t}\n\n📌 Read all instructions before starting.\n📌 Check your work when you finish each section.`},
    {title:'A. Vocabulary — match & define',
     text:`Match the words with their meanings:\n\n${wsSlice.map((w,i)=>`${i+1}. ${w}  → ___________________________`).join('\n')}\n\nWord bank: ${shuffled.join(' · ')}\n\nChoose 2 words. Write your own sentence for each:\na) _______________________________________________\nb) _______________________________________________`},
    {title:'B. Vocabulary in context — gap fill',
     text:`Complete the sentences with a word from Section A:\n\n${wsSlice.slice(0,5).map((w,i)=>`${i+1}. Understanding _____ helps us make progress in ${tl}.`).join('\n')}\n\n★ Challenge: which sentence is most true for you? Explain why.`},
    {title:'C. Reading comprehension',
     text:`Answer in full sentences:\n\n1. Main idea: What is the text mainly about?\n   → ________________________________\n\n2. Give two specific facts from the text:\n   a) ________________________________\n   b) ________________________________\n\n3. What is the writer's view on ${tl}?\n   → ________________________________\n\n4. Find a word in the text meaning "important" or "essential":\n   → The word is: ___________  (line: ___)` },
    {title:'D. Grammar in context',
     text:`Find one example of the target grammar structure in the text:\n   → ________________________________\n\nWrite two more examples using the same structure:\na) ________________________________\nb) ________________________________\n\n★ Challenge: write an INCORRECT version of b) — swap with a partner to correct it.`},
    {title:'E. Speaking / discussion (5 min)',
     text:`Work with a partner:\n\n🗣 Q1: How does ${tl} affect everyday life? Give a real example.\n🗣 Q2: Is ${tl} important for your future? Why / why not?\n🗣 Q3: What else would you like to know about ${tl}?\n\nUse at least 3 words from Section A.\n\nUseful phrases:\n• "In my experience…"\n• "I think this is important because…"\n• "On the other hand…"`},
    {title:'F. Writing task (80–100 words)',
     text:`Choose ONE prompt:\n\n✍️ Opinion: "Is ${tl} important today? Give your view with 2 reasons and an example."\n\n✍️ Personal: "Describe a time when ${tl} made a difference to you or someone you know."\n\nChecklist:\n☐ Used 4+ words from Section A.\n☐ Complete sentences (subject + verb + idea).\n☐ Included personal opinion.\n☐ Checked spelling and punctuation.`},
    {title:'G. Reflection & self-assessment',
     text:`Rate yourself honestly (✗ / ✦ / ✅):\n\nVocabulary: I can explain 4+ words without looking.     ___\nReading: I found main idea + 2 details.                 ___\nGrammar: I formed the structure correctly.              ___\nSpeaking: I spoke for 2+ minutes.                      ___\nWriting: Clear paragraph using target language.         ___\n\nStrongest skill today: ________________________________\nWhat I need to practise more: ________________________________\nOne word I'll use this week: ________________________________`},
    {title:'🔑 Answer key (teacher only)',
     text:`Vocabulary:\n${wsSlice.map((w,i)=>`${i+1}. ${w} — [definition / translation]`).join('\n')}\n\n📌 Timing guide:\n  A (Vocabulary) ......... 8 min\n  B (Gap fill) ........... 8 min\n  C (Comprehension) ...... 12 min\n  D (Grammar) ............ 8 min\n  E (Speaking) ........... 6 min\n  F (Writing) ............ 12 min\n  G (Reflection) ......... 3 min\n  Total .................. ~57 min`},
  ]};
}
function _ttGenHomeworkBoard(input){
  const t=input.topic||'English', lv=input.level||'B1', tl=t.toLowerCase();
  const ws=_ttContentWords((input.vocab||'')+' '+(input.source||'')+' '+t,4).slice(0,8);
  const vocStr=ws.join(', ')||tl;
  return {boardKind:'cards',kind:'Homework',cat:'utility',level:lv,topic:t,
    title:`${lv} · Homework: ${t}`,cards:[
    {title:'📚 Homework brief',
     text:`Topic: ${t} · Level: ${lv}\nEstimated time: 30–40 minutes\nDue date: ____________________\n\n📌 Complete all 5 tasks in order.\n📌 Quality matters more than length.\n📌 If stuck: re-read your class notes first.`},
    {title:'Task 1 — Vocabulary review (8 min)',
     text:`Words to practise: ${vocStr}.\n\n① Write one personal, true sentence for each word.\n② Circle the 2 words you found hardest. Write an extra sentence for those.\n③ Write one question using any word — ask your partner next class.\n\n💡 Read your sentences aloud. If it sounds natural, it probably is.`},
    {title:'Task 2 — Reading / listening review (8 min)',
     text:`Return to the lesson text or audio.\n\n① Write 5 key ideas IN YOUR OWN WORDS:\n   1.___ 2.___ 3.___ 4.___ 5.___\n\n② Underline 3 phrases you want to use yourself:\n   • ___  • ___  • ___\n\n③ Write one thing you are still unsure about:\n   → _______________`},
    {title:'Task 3 — Grammar (7 min)',
     text:`Focus on today's target structure.\n\n① Write 5 original sentences (NOT from class examples):\n   1.___ 2.___ 3.___ 4.___ 5.___\n\n② Check for errors — correct them now.\n\n③ Write ONE sentence combining today's grammar + vocabulary:\n   → _______________\n\n💡 Mixing grammar + vocabulary = excellent practice.`},
    {title:'Task 4 — Speaking preparation (7 min)',
     text:`Prepare a 60–90 second answer:\n\n"What is your opinion about ${tl}?"\n\nStructure:\n📌 Point: "I think / believe that…"\n📌 Reason: "This is because…"\n📌 Example: "For example…"\n📌 Conclusion: "Overall, I would say…"\n\n★ Record yourself. Listen back. Improve one sentence. Record again.\n★ Target: speak for 60+ sec without reading notes.`},
    {title:'Task 5 — Writing (10 min)',
     text:`Write 80–100 words on "${t}".\n\nChoose a prompt:\n✍️ Opinion: "Is ${tl} important today? Give 2 reasons."\n✍️ Personal: "Describe your experience with ${tl}."\n\nRequirements:\n☐ Use 5+ words from Task 1.\n☐ Use today's grammar structure at least once.\n☐ Include your personal opinion.\n☐ Write in paragraphs (not bullets).`},
    {title:'🏆 Challenge extension (optional)',
     text:`For students who want extra practice:\n\n① Find a short English article or video about ${tl}. Summarise in 3 sentences. Share next class.\n\n② Write 5 questions for an expert on ${tl}:\n   What…? Why…? How…? Do you think…? What if…?\n\n③ Teach a family member one word from today. Write what they asked you.\n\n📌 Bonus: share your Task 4 recording and invite feedback.`},
    {title:'✅ Self-check before submitting',
     text:`☐ Task 1: personal sentences (not definitions).\n☐ Task 2: my own words, not copied.\n☐ Task 3: grammar sentences are correct.\n☐ Task 4: I recorded and listened back.\n☐ Task 5: 80–100 words with vocab + grammar used.\n\nStrongest moment: ________________________________\nWhat to practise more: ________________________________\nA word I'll use more often: ________________________________\n\n📌 Bring this sheet to class — we review it together.`},
  ]};
}
function _ttGenScaffold(toolId, input){
  const tool = (typeof BOARD_TEACHER_TOOLS!=='undefined' ? BOARD_TEACHER_TOOLS : []).find(t=>t.id===toolId);
  if (!tool) return null;
  const topic=input.topic||'the topic', level=input.level||'B1';
  const bycat = {
    reading:[
      { title:'Before reading', text:`Predict: What do you already know about "${topic}"?` },
      { title:'While reading', text:'Underline 5 key words. Note the main idea of each paragraph.' },
      { title:'After reading', text:`Discuss: What was the most surprising idea about "${topic}"?` },
    ],
    vocabulary:[
      { title:'Target vocabulary', text:`[Key words and phrases for "${topic}" at ${level}]` },
      { title:'Student task', text:`Define each word, use it in a sentence, or match it to an example.\nFocus: ${tool.desc}` },
    ],
    grammar:[
      { title:'Grammar focus', text:`${tool.title} · ${level}\nTopic: ${topic}` },
      { title:'Explanation', text:'Rule: …\nExample 1: …\nExample 2: …\nCommon mistake: …' },
      { title:'Practice', text:`[Exercise here — ${tool.kind}]` },
    ],
    speaking:[
      { title:'Preparation (1 min)', text:`Think about "${topic}". Note 2–3 ideas.` },
      { title:'Task', text:`${tool.title}:\nDiscuss with your partner using the language below.` },
      { title:'Useful language', text:`Giving opinion: I think… / In my view…\nAgreeing: Exactly / You're right…\nDisagreeing: I'm not sure… / Actually…` },
    ],
    writing:[
      { title:'Plan', text:`Task: ${tool.title}\nTopic: ${topic} · Level: ${level}\nBrainstorm your ideas here.` },
      { title:'Draft', text:'Write your response here. Aim for clear structure.' },
      { title:'Self-check', text:'✅ Structure is clear\n✅ Target vocabulary used\n✅ Grammar checked\n✅ Good opening & closing' },
    ],
    listening:[
      { title:'Before listening', text:`Predict: What words will you hear about "${topic}"?` },
      { title:'While listening', text:'Note 3 key ideas. Write one question you want answered.' },
      { title:'After listening', text:'Summarise in 2 sentences. Discuss: did anything surprise you?' },
    ],
    utility:[
      { title:tool.title, text:`Topic: ${topic} · Level: ${level}` },
      { title:'Task', text:`${tool.desc}\n[Complete this section with your content]` },
    ],
  };
  const cards = bycat[tool.cat] || bycat.utility;
  return { boardKind:'cards', kind:tool.kind, cat:tool.cat, level, topic,
    title:`${level} · ${tool.title}: ${topic}`, cards };
}

function _ttGenCards(toolId, input){
  // Scaffold for LLM-only tools: returns a placeholder boardKind:'cards'
  // that renders as text/sticky cards. Real content comes from WebLLM.
  const titles = {
    'three-titles': ['Title option 1','Title option 2','Title option 3'],
    'summary-task': ['Summary'],
    'dialogue':     ['Speaker A','Speaker B','Speaker A (cont.)'],
  };
  const notes = {
    'three-titles': t => `[Write a catchy title for the text about "${input.topic}" here]`,
    'summary-task': t => `[Write a 3-4 sentence summary of the text about "${input.topic}" here]`,
    'dialogue':     t => `[${t}: write 2-3 lines about "${input.topic}" here]`,
  };
  const fn = notes[toolId]; const tts = titles[toolId] || ['Card'];
  return { boardKind:'cards', kind: toolId==='dialogue'?'Dialogue':toolId==='summary-task'?'Summary':'Titles',
    cat: toolId==='dialogue'?'speaking':'reading', level:input.level, topic:input.topic,
    title:`${input.level} · ${BOARD_TEACHER_TOOLS.find(t=>t.id===toolId)?.title||toolId}: ${input.topic}`,
    cards: tts.map(t=>({ title:t, text: fn(t) })) };
}

function _ttGenAdaptText(input) {
  const label = teacherToolActionLabel(input.action);
  const text = adaptTeacherToolText(input);
  const actionNotes = {
    simplify: 'Shorter sentences, easier words, clearer classroom rhythm.',
    upgrade: 'Richer connectors, more precise phrasing and stronger academic tone.',
    keep: 'Same general level, cleaner structure and teacher-ready formatting.',
  };
  return {
    boardKind: 'cards',
    kind: label,
    cat: 'reading',
    level: input.level,
    topic: input.topic,
    title: `${input.level} · ${label}: ${input.topic}`,
    action: input.action || 'simplify',
    cards: [
      { title: label, text },
      { title: 'Teacher note', text: actionNotes[input.action] || actionNotes.simplify },
    ],
  };
}

function _ttBuildFromAI(toolId, input, items) {
  if (!Array.isArray(items) || !items.length) return null;
  const base = { level: input.level, topic: input.topic };
  if (toolId === 'abcd-text') {
    const questions = items.map(it => ({
      type: 'mcq',
      text: String(it.text || it.question || ''),
      options: (it.options || []).map(String),
      answer: String(it.answer || ''),
      points: 1,
    })).filter(q => q.text && q.options.length >= 2 && q.answer);
    return questions.length ? { ...base, boardKind:'quiz', kind:'MCQ', cat:'reading',
      title:`${input.level} · ABCD Questions: ${input.topic}`, questions } : null;
  }
  if (toolId === 'true-false') {
    const questions = items.map(it => ({
      type: 'truefalse',
      text: String(it.text || it.statement || ''),
      answer: it.answer === true || String(it.answer).toLowerCase() === 'true',
      points: 1,
    })).filter(q => q.text);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Check', cat:'reading',
      title:`${input.level} · True / False: ${input.topic}`, questions } : null;
  }
  if (toolId === 'extract-vocab') {
    const vItems = items.map(it => ({
      word: _ttCap(it.word || ''),
      example: it.example || it.definition || '',
    })).filter(it => it.word);
    return vItems.length ? { ...base, boardKind:'vocab', kind:'Extraction', cat:'vocabulary',
      title:`${input.level} · Vocabulary: ${input.topic}`, items: vItems } : null;
  }
  if (toolId === 'gap') {
    const questions = items.map(it => ({
      type: 'gap-fill',
      text: String(it.text || ''),
      answer: String(it.answer || ''),
      points: 1,
    })).filter(q => q.text && q.answer);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Gap Fill', cat:'grammar',
      title:`${input.level} · Fill in the Gap: ${input.topic}`, questions } : null;
  }
  if (toolId === 'open-questions') {
    const questions = items.map(it => ({
      type: 'open', text: String(it.text || it.question || ''), points: 2,
    })).filter(q => q.text);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Questions', cat:'reading',
      title:`${input.level} · Open Questions: ${input.topic}`, questions } : null;
  }
  if (toolId === 'gaps-abcd') {
    const questions = items.map(it => ({
      type: 'mcq', text: String(it.text || it.question || ''),
      options: (it.options || []).map(String), answer: String(it.answer || ''), points: 1,
    })).filter(q => q.text && q.options.length >= 2 && q.answer);
    return questions.length ? { ...base, boardKind:'quiz', kind:'MCQ', cat:'grammar',
      title:`${input.level} · Gaps with ABCD: ${input.topic}`, questions } : null;
  }
  if (toolId === 'word-definition-match') {
    const pairs = items.map(it => ({
      left: String(it.word || it.left || ''), right: String(it.definition || it.right || it.sentence || ''),
    })).filter(p => p.left && p.right);
    return pairs.length ? { ...base, boardKind:'quiz', kind:'Matching', cat:'vocabulary',
      title:`${input.level} · Word-Definition Match: ${input.topic}`,
      questions: [{ type:'match', text:'Match each word to its definition.', pairs, points: pairs.length }] } : null;
  }
  if (toolId === 'error-correction') {
    const questions = items.map(it => ({
      type: 'open', text: String(it.text || it.sentence || ''),
      answer: String(it.answer || it.correction || it.correct || ''), points: 2,
    })).filter(q => q.text);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Correction', cat:'grammar',
      title:`${input.level} · Error Correction: ${input.topic}`, questions } : null;
  }
  // ── vocab-field tools ───────────────────────────────────────────
  if (toolId === 'essential-vocab' || toolId === 'flashcards') {
    const vItems = items.map(it=>({ word:_ttCap(it.word||''), example:it.example||it.definition||'' })).filter(it=>it.word);
    const kind = toolId==='flashcards' ? 'Flashcard Set' : 'Essential';
    const titleLabel = toolId==='flashcards' ? 'Flashcards' : 'Essential Vocabulary';
    return vItems.length ? { ...base, boardKind:'vocab', kind, cat:'vocabulary',
      title:`${input.level} · ${titleLabel}: ${input.topic}`, items:vItems } : null;
  }
  if (toolId === 'sentences-vocab') {
    const questions = items.map(it=>({ type:'open', text:String(it.text||''), points:2 })).filter(q=>q.text);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Sentence Set', cat:'vocabulary',
      title:`${input.level} · Sentences with Vocabulary: ${input.topic}`, questions } : null;
  }
  if (toolId === 'odd-one-out') {
    const questions = items.map(it=>({ type:'open',
      text:`Which word is the odd one out? Explain why:\n${(it.words||[]).join(' / ')}`,
      points:2 })).filter(q=>q.text.length>40);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Odd One Out', cat:'vocabulary',
      title:`${input.level} · Odd One Out: ${input.topic}`, questions } : null;
  }
  if (toolId === 'word-sorting') {
    const pairs = items.map(it=>({ left:String(it.word||''), right:String(it.category||'?') })).filter(p=>p.left);
    return pairs.length ? { ...base, boardKind:'quiz', kind:'Word Sort', cat:'vocabulary',
      title:`${input.level} · Words Sorting: ${input.topic}`,
      questions:[{ type:'match', text:'Sort these words into categories.', pairs, points:pairs.length }] } : null;
  }
  // ── grammar tools ────────────────────────────────────────────────
  if (toolId === 'gaps-brackets') {
    const questions = items.map(it=>({ type:'open', text:String(it.text||''), answer:String(it.answer||''), points:1 })).filter(q=>q.text);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Word Form', cat:'grammar',
      title:`${input.level} · Gaps with Brackets: ${input.topic}`, questions } : null;
  }
  if (toolId === 'two-options') {
    const questions = items.map(it=>({ type:'mcq', text:String(it.text||''), options:(it.options||[]).map(String), answer:String(it.answer||''), points:1 })).filter(q=>q.text&&q.options.length>=2);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Two Options', cat:'grammar',
      title:`${input.level} · Two Options: ${input.topic}`, questions } : null;
  }
  if (toolId === 'tense-contrast') {
    const questions = items.map(it=>({ type:'mcq', text:String(it.text||''), options:(it.options||[]).map(String), answer:String(it.answer||''), points:1 })).filter(q=>q.text&&q.options.length>=2);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Tense Contrast', cat:'grammar',
      title:`${input.level} · Tense Contrast: ${input.topic}`, questions } : null;
  }
  if (toolId === 'gist-detail') {
    const questions = items.map(it=>{
      if (it.type==='mcq') return { type:'mcq', text:String(it.text||''), options:(it.options||[]).map(String), answer:String(it.answer||''), points:1 };
      return { type:'open', text:String(it.text||''), points:2 };
    }).filter(q=>q.text);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Gist+Detail', cat:'reading',
      title:`${input.level} · Gist + Detail: ${input.topic}`, questions } : null;
  }
  // ── speaking tools ───────────────────────────────────────────────
  if (toolId === 'discussion') {
    const questions = items.map(it=>({ type:'open', text:String(it.text||it.question||''), points:2 })).filter(q=>q.text);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Discussion', cat:'speaking',
      title:`${input.level} · Discussion Questions: ${input.topic}`, questions } : null;
  }
  if (toolId === 'question-ladder') {
    const questions = items.map(it=>({ type:'open', text:`Level ${it.level||'?'} — ${String(it.text||'')}`, points:it.level||1 })).filter(q=>q.text.length>10);
    return questions.length ? { ...base, boardKind:'quiz', kind:'Question Ladder', cat:'speaking',
      title:`${input.level} · Question Ladder: ${input.topic}`, questions } : null;
  }
  if (toolId === 'roleplay-cards') {
    const cards = items.map(it=>({ title:String(it.speaker||it.role||'Speaker'), text:String(it.line||it.text||'') })).filter(c=>c.text);
    return cards.length ? { ...base, boardKind:'cards', kind:'Role-Play', cat:'speaking',
      title:`${input.level} · Role-Play Cards: ${input.topic}`, cards } : null;
  }
  if (toolId === 'debate-cards') {
    const forPts = items.filter(it=>/for/i.test(it.side||'')).map(it=>it.point||'').join('\n');
    const against = items.filter(it=>/against/i.test(it.side||'')).map(it=>it.point||'').join('\n');
    const disc = items.find(it=>/discussion/i.test(it.side||''));
    const cards = [{ title:'✅ FOR', text:forPts||'...' },{ title:'❌ AGAINST', text:against||'...' }];
    if (disc) cards.push({ title:'Discussion', text:disc.point||'' });
    return { ...base, boardKind:'cards', kind:'Debate', cat:'speaking',
      title:`${input.level} · Debate Cards: ${input.topic}`, cards };
  }
  // ── text/writing tools ───────────────────────────────────────────
  if (toolId === 'simplify-text' || toolId === 'text-topic-vocab') {
    const text = Array.isArray(items) ? (items[0]?.text||String(items[0]||'')) : String(items||'');
    const label = toolId === 'simplify-text' ? teacherToolActionLabel(input.action) : 'Generated text';
    return text ? { ...base, boardKind:'cards', kind:toolId==='simplify-text'?label:'Text', cat:'reading',
      title:`${input.level} · ${toolId==='simplify-text'?label:'Generated Text'}: ${input.topic}`,
      cards:[{ title:label, text }] } : null;
  }
  if (toolId === 'creative-writing') {
    const cards = items.map(it=>({ title:String(it.title||'Card'), text:String(it.text||'') })).filter(c=>c.text);
    return cards.length ? { ...base, boardKind:'cards', kind:'Creative', cat:'writing',
      title:`${input.level} · Creative Writing: ${input.topic}`, cards } : null;
  }
  if (toolId === 'essay-outline') {
    const cards = items.map(it=>({ title:String(it.section||'Section'), text:String(it.text||'') })).filter(c=>c.text);
    return cards.length ? { ...base, boardKind:'cards', kind:'Outline', cat:'writing',
      title:`${input.level} · Essay Outline: ${input.topic}`, cards } : null;
  }
  if (toolId === 'grammar-rules') {
    const cards = items.map(it=>({ title:String(it.section||'Grammar'), text:String(it.text||'') })).filter(c=>c.text);
    return cards.length ? { ...base, boardKind:'cards', kind:'Grammar', cat:'grammar',
      title:`${input.level} · Grammar Rules: ${input.topic}`, cards } : null;
  }
  if (toolId === 'lesson-pack') {
    const cards = items.map(it=>({ title:String(it.stage||'Stage'), text:String(it.task||it.text||'') })).filter(c=>c.text);
    return cards.length ? { ...base, boardKind:'cards', kind:'Lesson Pack', cat:'utility',
      title:`${input.level} · Lesson Pack: ${input.topic}`, cards } : null;
  }
  // Generic LLM → cards fallback
  if (Array.isArray(items) && items.length && items[0] && typeof items[0]==='object') {
    const cards = items.map((it,i)=>({
      title: String(it.title||it.section||it.stage||it.task||it.criterion||`Card ${i+1}`),
      text: String(it.text||it.task||it.line||it.point||it.example||''),
    })).filter(c=>c.text);
    if (cards.length) {
      const tool = (typeof BOARD_TEACHER_TOOLS!=='undefined'?BOARD_TEACHER_TOOLS:[]).find(t=>t.id===toolId);
      return { ...base, boardKind:'cards', kind:tool?.kind||'Task', cat:tool?.cat||'utility',
        title:`${input.level} · ${tool?.title||toolId}: ${input.topic}`, cards };
    }
  }
  if (toolId === 'three-titles') {
    const cards = (Array.isArray(items) ? items : []).slice(0,3).map((it,i)=>({
      title: `Title ${i+1}`, text: String(it.title || it.text || it || ''),
    }));
    return cards.length ? { ...base, boardKind:'cards', kind:'Titles', cat:'reading',
      title:`${input.level} · Three Titles: ${input.topic}`, cards } : null;
  }
  if (toolId === 'summary-task') {
    const text = typeof items === 'string' ? items
      : Array.isArray(items) ? items.map(it=>it.text||it.sentence||String(it)).join(' ')
      : String(items?.summary || items?.text || '');
    return text ? { ...base, boardKind:'cards', kind:'Summary', cat:'reading',
      title:`${input.level} · Summary: ${input.topic}`, cards:[{ title:'Summary', text }] } : null;
  }
  if (toolId === 'dialogue') {
    const turns = Array.isArray(items) ? items : [];
    const cards = turns.map(it=>({ title: String(it.speaker||it.role||'Speaker'), text: String(it.line||it.text||it||'') }));
    return cards.length ? { ...base, boardKind:'cards', kind:'Dialogue', cat:'speaking',
      title:`${input.level} · Dialogue: ${input.topic}`, cards } : null;
  }
  return null;
}

function generateTeacherToolLocal(input){
  const id = input.tool && input.tool.id;
  // ── quality local generators ─────────────────────────────────────
  if (id === 'abcd-text')             return _ttGenAbcd(input);
  if (id === 'true-false')            return _ttGenTrueFalse(input);
  if (id === 'extract-vocab')         return _ttGenExtractVocab(input);
  if (id === 'gap')                   return _ttGenGapFill(input);
  if (id === 'open-questions')        return _ttGenOpenQuestions(input);
  if (id === 'gaps-abcd')             return _ttGenGapsAbcd(input);
  if (id === 'word-definition-match') return _ttGenWordDefinitionMatch(input);
  if (id === 'collocations')          return _ttGenCollocations(input);
  if (id === 'synonyms-antonyms')     return _ttGenSynonymsAntonyms(input);
  if (id === 'word-families')         return _ttGenWordFamilies(input);
  if (id === 'phrasal-verbs')         return _ttGenPhrasalVerbs(input);
  if (id === 'idioms')                return _ttGenIdioms(input);
  if (id === 'error-correction')      return _ttGenErrorCorrection(input);
  if (id === 'essential-vocab')       return _ttGenEssentialVocab(input);
  if (id === 'flashcards')            return _ttGenFlashcards(input);
  if (id === 'sentences-vocab')       return _ttGenSentencesVocab(input);
  if (id === 'odd-one-out')           return _ttGenOddOneOut(input);
  if (id === 'word-sorting')          return _ttGenWordSorting(input);
  if (id === 'gaps-brackets')         return _ttGenGapsBrackets(input);
  if (id === 'two-options')           return _ttGenTwoOptions(input);
  if (id === 'rewrite')               return _ttGenRewrite(input);
  if (id === 'tense-contrast')        return _ttGenTenseContrast(input);
  if (id === 'gist-detail')           return _ttGenGistDetail(input);
  if (id === 'discussion')            return _ttGenDiscussion(input);
  if (id === 'question-ladder')       return _ttGenQuestionLadder(input);
  if (id === 'roleplay-cards')        return _ttGenRoleplay(input);
  if (id === 'debate-cards')          return _ttGenDebate(input);
  if (id === 'listening-dictation')   return _ttGenListeningDictation(input);
  if (id === 'simplify-text')         return _ttGenAdaptText(input);
  if (id === 'lesson-pack')           return _ttGenLessonPack(input);
  if (id === 'worksheet-builder')     return _ttGenWorksheetBoard(input);
  if (id === 'homework-set')          return _ttGenHomeworkBoard(input);
  // ── LLM-first: specific card scaffolds ──────────────────────────
  if (id === 'three-titles' || id === 'summary-task' || id === 'dialogue')
    return _ttGenCards(id, input);
  // ── universal scaffold for all remaining tools ───────────────────
  return _ttGenScaffold(id, input);
}

function _ttShowRetry(){ const b=document.getElementById('tbuilder-regen-btn'); if(b) b.style.display=''; }
function _ttSetGenerating(isGenerating) {
  const gen = document.getElementById('tbuilder-gen-btn');
  const ai = document.getElementById('tbuilder-ai-btn');
  const add = document.getElementById('tbuilder-add-btn');
  if (gen) gen.disabled = !!isGenerating;
  if (ai) ai.disabled = !!isGenerating;
  if (add) add.disabled = !!isGenerating || !lastTeacherToolBuilderOutput;
  if (isGenerating) _ttSetImproving(false); // clear any stale shimmer on a new run
}

// Shimmer state for the "draft shown → AI upgrading it" phase: a sweeping bar on
// the preview + a pulsing chip so the teacher sees the result is being improved.
function _ttSetImproving(on) {
  const chip = document.getElementById('tbuilder-chip');
  const out = document.getElementById('tbuilder-output');
  if (chip) chip.classList.toggle('improving', !!on);
  if (out) out.classList.toggle('tt-improving', !!on);
}

// Live edited output is always lastTeacherToolBuilderOutput; the preview
// mutates it directly so "Add to board" places the edited version.
function _ttRerenderPreview(){
  if (lastTeacherToolBuilderOutput) renderTeacherToolLocalPreview(lastTeacherToolBuilderOutput);
}
const _ttEditHint = `<div class="tt-edit-hint">✎ Tap any text to edit · click ○ to set the answer</div>`;

// Short labels for the "make more from this" quick-switch suggestions.
const _TT_ALSO_LABELS = {
  'extract-vocab':'Key vocabulary','abcd-text':'MCQ questions','true-false':'True / False',
  'open-questions':'Open questions','gap':'Gap-fill','gist-detail':'Gist + Detail',
  'summary-task':'Summary','sentences-vocab':'Example sentences','word-definition-match':'Match words',
  'flashcards':'Flashcards','collocations':'Collocations','idioms':'Idioms','discussion':'Discussion',
  'essential-vocab':'Topic vocabulary','dialogue':'Dialogue','warmup-listening':'Warm-up questions',
};
// Suggest other tools that can reuse the input the teacher already provided, so
// they can spin a second activity from the same text / vocab / topic in one tap.
function _ttSuggestAlternatives(currentToolId) {
  const hasSource = !!(document.getElementById('tbuilder-source')?.value || '').trim();
  const hasVocab  = !!(document.getElementById('tbuilder-vocab')?.value || '').trim();
  const sourceTools = ['extract-vocab','abcd-text','true-false','open-questions','gap','gist-detail','summary-task'];
  const vocabTools  = ['sentences-vocab','word-definition-match','flashcards','collocations','idioms','gap'];
  const topicTools  = ['discussion','essential-vocab','dialogue','gist-detail','warmup-listening'];
  const pool = hasSource ? sourceTools : (hasVocab ? vocabTools : topicTools);
  return pool.filter(id => id !== currentToolId)
    .map(id => (typeof BOARD_TEACHER_TOOLS !== 'undefined' ? BOARD_TEACHER_TOOLS : []).find(t => t.id === id))
    .filter(Boolean).slice(0, 4);
}
function _ttAppendSuggestions(body) {
  const cur = activeTeacherToolBuilder && activeTeacherToolBuilder.id;
  const picks = _ttSuggestAlternatives(cur);
  if (!picks.length || !body) return;
  const row = document.createElement('div');
  row.className = 'tt-also';
  row.innerHTML = `<div class="tt-also-label">✨ Make more from the same input</div>
    <div class="tt-also-row">${picks.map(t => {
      const m = (typeof BOARD_TOOL_META !== 'undefined' && BOARD_TOOL_META[t.cat]) || { icon:'✦' };
      const label = _TT_ALSO_LABELS[t.id] || t.kind || t.title;
      return `<button type="button" class="tt-also-btn" onclick="switchTeacherToolAndGenerate('${t.id}')"><span>${m.icon}</span>${esc(label)}</button>`;
    }).join('')}</div>`;
  body.appendChild(row);
}
// Switch the constructor to another tool, KEEP the current inputs, and generate
// straight away — a one-tap pivot to a related activity.
function switchTeacherToolAndGenerate(toolId) {
  const tool = (typeof BOARD_TEACHER_TOOLS !== 'undefined' ? BOARD_TEACHER_TOOLS : []).find(t => t.id === toolId);
  if (!tool) return;
  activeTeacherToolBuilder = tool;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('tbuilder-title', tool.title);
  set('tbuilder-sub', tool.desc);
  set('tbuilder-kicker', `${(typeof BOARD_TOOL_NAMES !== 'undefined' && BOARD_TOOL_NAMES[tool.cat]) || tool.cat} / ${tool.kind}`);
  _ttAdaptFields(tool);              // toggles field visibility, keeps the values
  generateTeacherToolBuilder('fast');
}

// Premium result header shown above the generated cards — tool icon badge,
// title and meta chips (kind · level · count).
function _ttPreviewHeader(out, n, unit){
  const meta = (typeof BOARD_TOOL_META !== 'undefined' && BOARD_TOOL_META[out.cat]) || { icon:'✦', color:'#4262FF' };
  const accent = meta.color || '#4262FF';
  const unitLabel = n === 1 ? String(unit).replace(/s$/, '') : unit; // "1 question", not "1 questions"
  return `<div class="tt-result-head" style="--accent:${accent}">
    <div class="tt-result-icon">${meta.icon || '✦'}</div>
    <div class="tt-result-meta">
      <div class="tt-result-title">${esc(out.title || 'Worksheet')}</div>
      <div class="tt-result-chips">
        <span class="tt-rc accent">${esc(out.kind || 'Task')}</span>
        ${out.level ? `<span class="tt-rc">${esc(out.level)}</span>` : ''}
        <span class="tt-rc">${n} ${unitLabel}</span>
      </div>
    </div>
  </div>`;
}

function renderTeacherToolLocalPreview(out){
  const body = document.getElementById('tbuilder-output');
  if (!body) return;
  _ttShowRetry();
  _ttSetAddToBoard(true);
  const chip = document.getElementById('tbuilder-chip');

  if (out.boardKind === 'cards') {
    // Show the meaningful item count (glossary/vocab) when the cards are just
    // structural wrappers, so a 12-word reading text doesn't read as "4 cards".
    const vocabN = Array.isArray(out.vocab) ? out.vocab.length : 0;
    if (chip) chip.textContent = vocabN > out.cards.length ? `${vocabN} words` : `${out.cards.length} cards`;
    body.innerHTML = _ttPreviewHeader(out, out.cards.length, 'cards') + _ttEditHint + out.cards.map((c,i)=>`
      <div class="tbuilder-section tt-q" style="--i:${i}" data-ci="${i}">
        <button class="tt-del" data-del-card="${i}" title="Remove">×</button>
        <h4><span class="tt-num">${i+1}</span><span class="tt-edit" contenteditable="true" data-card-field="title" data-ci="${i}">${esc(c.title)}</span></h4>
        <p class="tt-edit" contenteditable="true" data-card-field="text" data-ci="${i}" data-ph="Write here…">${_ttMdToHtml(c.text)}</p>
      </div>`).join('');
    _ttWirePreviewEvents(out, body);
    _ttAppendSuggestions(body);
    return;
  }

  if (out.boardKind === 'vocab') {
    if (chip) chip.textContent = `${out.items.length} words`;
    body.innerHTML = _ttPreviewHeader(out, out.items.length, 'words') + _ttEditHint + out.items.map((it,i)=>`
      <div class="tbuilder-section tt-q" style="--i:${i}" data-vi="${i}">
        <button class="tt-del" data-del-vocab="${i}" title="Remove">×</button>
        <h4><span class="tt-num">${i+1}</span><span class="tt-edit" contenteditable="true" data-vocab-field="word" data-vi="${i}">${esc(it.word)}</span></h4>
        <p class="tt-edit" contenteditable="true" data-vocab-field="example" data-vi="${i}" data-ph="Example sentence (optional)…">${_ttMdToHtml(it.example||'')}</p>
      </div>`).join('');
    _ttWirePreviewEvents(out, body);
    _ttAppendSuggestions(body);
    return;
  }

  // quiz — for match/sort tasks the meaningful count is the number of pairs
  // (a sort is one "question" holding many words), not the question count.
  const isMatchSet = out.questions.length > 0 && out.questions.every(q => q.type === 'match');
  const pairCount = out.questions.reduce((s, q) => s + (Array.isArray(q.pairs) ? q.pairs.length : 0), 0);
  const previewN = isMatchSet ? pairCount : out.questions.length;
  const previewUnit = isMatchSet ? 'items' : 'questions';
  if (chip) chip.textContent = `${previewN} ${isMatchSet ? 'items' : 'q'} · ${out.kind}`;
  body.innerHTML = _ttPreviewHeader(out, previewN, previewUnit) + _ttEditHint + out.questions.map((q, i) => {
    let ans = '';
    if (q.type === 'mcq') {
      ans = `<div class="tt-opts">${
        q.options.map((o,oi) => `
          <div class="tt-opt-row ${o===q.answer?'correct':''}" data-qi="${i}" data-oi="${oi}">
            <div class="tt-correct-dot" data-set-correct="${i}" data-oi="${oi}" title="Mark correct">✓</div>
            <div class="tt-opt-text tt-edit-opt" contenteditable="true" data-qi="${i}" data-oi="${oi}">${esc(o)}</div>
          </div>`).join('')}</div>`;
    } else if (q.type === 'truefalse') {
      ans = `<div class="tt-tf" data-qi="${i}">
        <button class="tt-tf-btn ${q.answer?'sel-true':''}" data-tf="${i}" data-val="true">✅ True</button>
        <button class="tt-tf-btn ${!q.answer?'sel-false':''}" data-tf="${i}" data-val="false">❌ False</button>
      </div>`;
    } else if (q.type === 'gap-fill') {
      ans = `<div class="tt-gap-ans">Answer: <span class="tt-edit" contenteditable="true" data-q-field="answer" data-qi="${i}" data-ph="…">${esc(q.answer||'')}</span></div>`;
    } else if (q.type === 'match') {
      ans = `<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 8px;margin-top:7px;align-items:center;">${
        (q.pairs||[]).map((p,pi)=>`
          <span class="tt-edit" contenteditable="true" data-match="${i}" data-pi="${pi}" data-side="left" style="font-size:11px;font-weight:800;padding:3px 8px;border-radius:7px;background:#eef2ff;color:#4262FF">${esc(p.left)}</span>
          <span class="tt-edit" contenteditable="true" data-match="${i}" data-pi="${pi}" data-side="right" style="font-size:11px;padding:3px 8px;color:#5f6070" data-ph="match / definition…">${esc(p.right||'')}</span>`).join('')
      }</div>`;
    } else if (q.type === 'open') {
      ans = `<div style="font-size:11px;margin-top:5px;color:#9ca3af;font-style:italic;">Open answer — students write freely</div>`;
    }
    return `<div class="tbuilder-section tt-q" style="--i:${i}" data-qi="${i}">
      <button class="tt-del" data-del-q="${i}" title="Remove question">×</button>
      <h4><span class="tt-num">${i+1}</span><span class="tt-edit" contenteditable="true" data-q-field="text" data-qi="${i}">${esc(q.text)}</span></h4>
      ${ans}
    </div>`;
  }).join('');
  _ttWirePreviewEvents(out, body);
  _ttAppendSuggestions(body);
}

function _ttWirePreviewEvents(out, body){
  // contenteditable → write back on blur
  body.querySelectorAll('[contenteditable="true"]').forEach(el => {
    el.addEventListener('blur', () => {
      const txt = el.textContent.trim();
      const qi = el.dataset.qi != null ? +el.dataset.qi : null;
      const vi = el.dataset.vi != null ? +el.dataset.vi : null;
      const ci = el.dataset.ci != null ? +el.dataset.ci : null;
      if (el.dataset.qField && qi != null && out.questions[qi]) {
        const q = out.questions[qi];
        if (el.dataset.qField === 'answer') q.answer = txt;
        else q.text = txt;
      } else if (el.dataset.oi != null && qi != null && out.questions[qi]) {
        const q = out.questions[qi], oi = +el.dataset.oi;
        const wasCorrect = q.options[oi] === q.answer;
        q.options[oi] = txt;
        if (wasCorrect) q.answer = txt;
      } else if (el.dataset.match != null) {
        const q = out.questions[+el.dataset.match], pi = +el.dataset.pi;
        if (q && q.pairs[pi]) q.pairs[pi][el.dataset.side] = txt;
      } else if (el.dataset.vocabField != null && vi != null && out.items[vi]) {
        out.items[vi][el.dataset.vocabField] = txt;
      } else if (el.dataset.cardField != null && ci != null && out.cards[ci]) {
        out.cards[ci][el.dataset.cardField] = txt;
      }
    });
    // Enter on single-line fields = blur (don't insert newline) except multiline text
    el.addEventListener('keydown', e => {
      const multiline = el.dataset.qField === 'text' || el.dataset.cardField === 'text' || el.dataset.vocabField === 'example';
      if (e.key === 'Enter' && !e.shiftKey && !multiline) { e.preventDefault(); el.blur(); }
    });
  });
  // mark correct (mcq)
  body.querySelectorAll('[data-set-correct]').forEach(dot => {
    dot.addEventListener('click', () => {
      const qi = +dot.dataset.setCorrect, oi = +dot.dataset.oi;
      const q = out.questions[qi];
      if (q) { q.answer = q.options[oi]; _ttRerenderPreview(); }
    });
  });
  // TF toggle
  body.querySelectorAll('[data-tf]').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = out.questions[+btn.dataset.tf];
      if (q) { q.answer = btn.dataset.val === 'true'; _ttRerenderPreview(); }
    });
  });
  // delete question / vocab / card
  body.querySelectorAll('[data-del-q]').forEach(b => b.addEventListener('click', () => {
    out.questions.splice(+b.dataset.delQ, 1);
    if (!out.questions.length) { _ttSetAddToBoard(false); }
    _ttRerenderPreview();
  }));
  body.querySelectorAll('[data-del-vocab]').forEach(b => b.addEventListener('click', () => {
    out.items.splice(+b.dataset.delVocab, 1);
    if (!out.items.length) _ttSetAddToBoard(false);
    _ttRerenderPreview();
  }));
  body.querySelectorAll('[data-del-card]').forEach(b => b.addEventListener('click', () => {
    out.cards.splice(+b.dataset.delCard, 1);
    if (!out.cards.length) _ttSetAddToBoard(false);
    _ttRerenderPreview();
  }));
}

/* Styled, read-only worksheet card — mirrors the builder preview on the board. */
