/* Guardrails: blocking checks run over a built lesson before it is shown for
   review and again before it is published to the board (systemic fix §2).

   A lesson is blocks (tasks, texts, word sets) that used to be checked against
   each other by nobody, so each defect was fixed on its own and came back as a
   class: a word's example in another sense, criteria quoting the model text, a
   mistake used as a model, a pair that is not a pair, a block that came out empty
   or twice. Every check here has a name and a rule; a failed check names the
   block and the row, so the teacher sees what is wrong, not "something failed".

   Pure functions over plain data: no DOM, runs in the browser and in Node tests.
     checkBlock(activity, out)  - checks inside one block (used to retry generation)
     checkSet(set)              - the whole lesson: set.built, set.keys, set.cfg, set.textOut, set.failed
   Both return [{ check, key, block, msg }]; an empty list means the lesson passes. */
(function (root) {
  'use strict';

  const norm = x => String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = x => norm(x).split(' ').filter(Boolean);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const first = v => Array.isArray(v) ? v[0] : v;

  /* All the learner-facing text of a block, as one string. */
  function blockText(out) {
    if (!out) return '';
    const parts = [];
    const add = v => { if (typeof v === 'string') parts.push(v); else if (Array.isArray(v)) v.forEach(add); else if (v && typeof v === 'object') Object.keys(v).forEach(k => { if (!/^_|^id$|^url$|^engine$/.test(k)) add(v[k]); }); };
    ['title', 'text', 'questions', 'items', 'cards', 'pairs', 'vocab', 'struct'].forEach(k => add(out[k]));
    return parts.join('\n');
  }

  function hasContent(out) {
    if (!out) return false;
    const filled = a => Array.isArray(a) && a.some(x => (typeof x === 'string' ? x.trim() : x && Object.values(x).some(v => (Array.isArray(v) ? v.length : String(v == null ? '' : v).trim()))));
    return filled(out.questions) || filled(out.items) || filled(out.cards) || filled(out.pairs) || filled(out.vocab)
      || !!(out.struct && filled(out.struct.cards)) || !!String(out.text || '').trim();
  }

  /* ── Pairing & form: a pair is two non-empty halves; halves are unique and 1:1. */
  function checkPairs(activity, out) {
    const v = [];
    const pairs = Array.isArray(out.pairs) ? out.pairs : null;
    if (!pairs) return v;
    const L = new Set(), R = new Set();
    pairs.forEach((p, i) => {
      const l = norm(p && p.left), r = norm(p && p.right);
      if (!l || !r) v.push({ msg: `Pair ${i + 1} has an empty half` });
      else if (L.has(l) || R.has(r)) v.push({ msg: `Pair ${i + 1} repeats “${(p.left || '').trim()}” / “${(p.right || '').trim()}”: halves must match one to one` });
      L.add(l); R.add(r);
    });
    if (pairs.length < 3) v.push({ msg: `Only ${pairs.length} usable pair${pairs.length === 1 ? '' : 's'} - at least 3 are needed` });
    return v.map(x => Object.assign({ check: 'Pairing & form' }, x));
  }

  /* ── Form: in a "match the halves" task the start of a pair must break off before
        the target form, which lives only in the ending. Known forms only; an unknown
        topic is not guessed at. */
  const IRREG = 'was|were|did|went|saw|had|took|made|came|got|said|bought|ate|ran|wrote|gave|found|told|left|met|paid|sat|stood|spoke|knew|thought|brought|flew|drove|swam|began|woke|lost|won|felt|heard|kept|slept|sold|sent|built|wore|drank|sang|read';
  const FORMS = [
    { topic: /past simple/, re: new RegExp(`\\b(?:\\w+ed|${IRREG})\\b`, 'i') },
    { topic: /present perfect/, re: /\b(?:have|has|haven't|hasn't)\s+(?:\w+ed|been|gone|done|seen|had|made|taken|eaten|written|given|known|lost|met|never|ever|already|just|yet)\b/i },
    { topic: /future|will\b/, re: /\bwill\b|\bgoing to\b|\bwon't\b/i },
  ];
  function checkForm(activity, out, ctx) {
    const topic = norm(ctx && ctx.topic);
    const f = FORMS.find(x => x.topic.test(topic));
    if (!f || activity.tool !== 'matching-halves' || !Array.isArray(out.pairs)) return [];
    const v = [];
    out.pairs.forEach((p, i) => { if (f.re.test(String(p && p.left || ''))) v.push({ check: 'Pairing & form', msg: `Pair ${i + 1} already contains the target form in its beginning: “${String(p.left).trim()}” - only the ending may` }); });
    return v;
  }

  /* ── Composition inside a block: every question is complete. */
  function checkQuestions(activity, out) {
    const v = [];
    (out.questions || []).forEach((q, i) => {
      if (!q || !String(q.text || '').trim()) { v.push({ msg: `Question ${i + 1} is empty` }); return; }
      const ans = first(q.answer);
      if ((q.type === 'gap-fill' || activity.tool === 'error-correction') && !String(ans == null ? '' : ans).trim()) v.push({ msg: `Question ${i + 1} has no answer` });
      if (q.type === 'gap-fill' && !/_{2,}/.test(q.text)) v.push({ msg: `Question ${i + 1} has no gap to fill` });
      if (q.type === 'mcq' && Array.isArray(q.options) && ans != null && !q.options.includes(ans)) v.push({ msg: `Question ${i + 1}: the answer is not one of the options` });
      if (activity.tool === 'error-correction' && ans != null && norm(q.text) === norm(ans)) v.push({ msg: `Question ${i + 1}: the “mistake” is the same as its correction` });
    });
    return v.map(x => Object.assign({ check: 'Composition = Selection' }, x));
  }

  /* ── Sense consistency (vocabulary): the example and the collocations belong to
        the chosen sense and the chosen part of speech of the word. */
  const DET = '(?:a|an|the|any|some|my|your|his|her|our|their|this|that|these|those|good|bad|short|long|great|new|old|small|big)';
  const SUBJ = '(?:i|you|we|they|he|she|it|who|to|will|would|can|could|should|must|may|might|do|does|did|don\'t|doesn\'t|didn\'t|not|never|always|just|please|let\'s)';
  function stems(word) {
    const w = norm(word);
    if (!w || w.includes(' ')) return [w];
    const base = w.replace(/e$/, '');
    return [...new Set([w, w + 's', w + 'es', w + 'ed', w + 'd', w + 'ing', base + 'ing', base + 'ed', w.replace(/y$/, 'ies'), w.replace(/y$/, 'ied')])].filter(Boolean);
  }
  function usesWord(sentence, word) {
    const s = ' ' + norm(sentence) + ' ';
    return stems(word).some(t => s.includes(' ' + t + ' '));
  }
  function posOf(entry) {
    const p = norm(entry.pos);
    if (/^(v|verb|phrasal verb)/.test(p)) return 'verb';
    if (/^(n|noun)/.test(p)) return 'noun';
    return '';
  }
  /* Is the word, in this sentence, used as the other part of speech? Conservative:
     only the two clear patterns (determiner/adjective before it = noun; pronoun, "to"
     or modal before it = verb), so a pass is not proof but a hit is nearly certain. */
  function looksLikeOtherPos(sentence, word, pos) {
    const s = norm(sentence);
    const ws = stems(word).map(esc).join('|');
    const nounUse = new RegExp(`\\b${DET} (?:${ws})\\b`).test(s) && !new RegExp(`\\b${SUBJ} (?:${ws})\\b`).test(s);
    const verbUse = new RegExp(`\\b${SUBJ} (?:${ws})\\b`).test(s) && !new RegExp(`\\b${DET} (?:${ws})\\b`).test(s);
    if (pos === 'verb') return nounUse;
    if (pos === 'noun') return verbUse;
    return false;
  }
  function checkVocabEntry(e) {
    const v = [];
    const word = String(e && e.word || '').trim();
    if (!word) return v;
    const pos = posOf(e);
    if (e.example) {
      if (!usesWord(e.example, word)) v.push({ msg: `“${word}”: the example does not contain the word` });
      else if (pos && looksLikeOtherPos(e.example, word, pos)) v.push({ msg: `“${word}” is ${pos === 'verb' ? 'a verb' : 'a noun'}, but its example uses it as ${pos === 'verb' ? 'a noun' : 'a verb'}: “${String(e.example).trim()}”` });
    }
    (e.collocations || []).forEach(c => {
      const t = String(typeof c === 'string' ? c : c && (c.phrase || c.text) || '');
      if (!t || !pos || !usesWord(t, word)) return;
      if (looksLikeOtherPos(t, word, pos)) v.push({ msg: `“${word}” (${pos}): the collocation “${t.trim()}” belongs to the other part of speech` });
    });
    return v.map(x => Object.assign({ check: 'Sense consistency' }, x));
  }
  /* A word set is published with only the material that belongs to the chosen sense:
     an example in the other part of speech, or without the word, and collocations of the
     other part of speech are taken out, and the result says what was taken out. */
  function repairVocabEntry(e) {
    const dropped = [];
    const out = Object.assign({}, e);
    const word = String(e && e.word || '').trim();
    if (!word) return { entry: out, dropped };
    const bad = checkVocabEntry(Object.assign({}, e, { collocations: [] }));
    if (bad.length && e.example) { out.example = ''; dropped.push(bad[0].msg); }
    if (Array.isArray(e.collocations)) {
      out.collocations = e.collocations.filter(c => {
        const r = checkVocabEntry({ word: e.word, pos: e.pos, collocations: [c] });
        if (r.length) dropped.push(r[0].msg);
        return !r.length;
      });
    }
    return { entry: out, dropped };
  }
  function checkVocab(out) {
    const entries = [].concat(Array.isArray(out.vocab) ? out.vocab : [], Array.isArray(out.words) ? out.words : [])
      .filter(e => e && typeof e === 'object' && e.word);
    return entries.flatMap(checkVocabEntry);
  }

  function checkBlock(activity, out, ctx) {
    activity = activity || {};
    if (!out) return [];
    if (!hasContent(out)) return [{ check: 'Composition = Selection', msg: 'The block came out empty' }];
    return [].concat(checkPairs(activity, out), checkForm(activity, out, ctx), checkQuestions(activity, out), checkVocab(out));
  }

  /* ── Error ≠ Model: the wrong span of every error-correction item may not appear,
        as written, in any other block of the lesson. */
  function wrongSpans(out) {
    const spans = [];
    (out.questions || []).forEach(q => {
      const a = String(q && q.text || '').trim().split(/\s+/).filter(Boolean);
      const c = String(first(q && q.answer) || '').trim().split(/\s+/).filter(Boolean);
      if (!a.length || !c.length) return;
      const cl = w => w.toLowerCase().replace(/[^a-z']/g, '');
      let i = 0; while (i < a.length && i < c.length && cl(a[i]) === cl(c[i])) i++;
      let j = 0; while (j < a.length - i && j < c.length - i && cl(a[a.length - 1 - j]) === cl(c[c.length - 1 - j])) j++;
      const wrong = a.slice(i, a.length - j).map(cl).filter(Boolean);
      if (!wrong.length || wrong.length > 4) return;
      const ctx = a.slice(Math.max(0, i - 1), a.length - j + (j ? 1 : 0)).map(cl).filter(Boolean);
      if (ctx.length >= 2) spans.push(ctx.join(' '));
    });
    return spans;
  }
  function checkErrorModel(built) {
    const v = [];
    const spans = [];
    built.filter(b => b.activity.tool === 'error-correction').forEach(b => spans.push(...wrongSpans(b.out)));
    if (!spans.length) return v;
    built.filter(b => b.activity.tool !== 'error-correction').forEach(b => {
      const text = norm(blockText(b.out));
      spans.forEach(sp => {
        if (new RegExp(`\\b${esc(sp)}\\b`).test(text)) v.push({ check: 'Error ≠ Model', key: b.activity.key, block: b.activity.title, msg: `“${sp}” is marked as a mistake in this lesson, but it appears in “${b.activity.title}”` });
      });
    });
    return v;
  }

  /* ── Criteria from Task: a phrase the criteria / useful-phrases blocks quote
        from the model text must come from the student's task, not the model. */
  function ngrams(text, n) {
    const w = words(text), out = new Set();
    for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
    return out;
  }
  function checkCriteria(set) {
    const built = set.built || [];
    const crit = built.filter(b => /rubric|criteria|phr|link/.test(String(b.activity.key || '')) || /criteria|useful phrases/i.test(String(b.activity.title || '')));
    if (!crit.length) return [];
    const model = set.textOut ? blockText(set.textOut) : '';
    const taskBlock = built.find(b => b.activity.key === 'wr-write' || b.activity.tool === 'creative-writing');
    const task = [set.base && (set.base.topic || ''), set.base && (set.base.task || set.base.prompt || ''), taskBlock ? blockText(taskBlock.out) : ''].join(' ');
    if (!model.trim()) return [];
    const modelGrams = ngrams(model, 4), taskGrams = ngrams(task, 4);
    const v = [];
    crit.forEach(b => {
      const grams = ngrams(blockText(b.out), 4);
      const hit = [...grams].find(g => modelGrams.has(g) && !taskGrams.has(g));
      if (hit) v.push({ check: 'Criteria from Task', key: b.activity.key, block: b.activity.title, msg: `“${hit}” is quoted from the model text, not from the student's task` });
    });
    return v;
  }

  /* ── Composition = Selection: what the teacher ticked is what is in the lesson. */
  function checkComposition(set) {
    const v = [];
    const built = set.built || [];
    const keys = set.keys || [];
    const opts = ((set.cfg && set.cfg.stages) || []).flatMap(st => st.options || []).filter(o => o.tool && keys.includes(o.key));
    const failed = new Set(set.failed || []);
    const dropped = new Set(set.dropped || []);
    opts.forEach(o => {
      const n = built.filter(b => b.activity.key === o.key).length;
      if (!n && !failed.has(o.title) && !dropped.has(o.key)) v.push({ check: 'Composition = Selection', key: o.key, block: o.title, msg: `“${o.title}” was ticked but is not in the lesson` });
      if (n > 1) v.push({ check: 'Composition = Selection', key: o.key, block: o.title, msg: `“${o.title}” is in the lesson ${n} times, it was ticked once` });
    });
    const picked = new Set(opts.map(o => o.key));
    if (opts.length) built.forEach(b => {
      if (b.activity.key && !picked.has(b.activity.key) && !b.activity.homework) v.push({ check: 'Composition = Selection', key: b.activity.key, block: b.activity.title, msg: `“${b.activity.title}” is in the lesson but was not ticked` });
    });
    return v;
  }

  function checkSet(set) {
    if (!set) return [];
    const built = set.built || [];
    const v = [];
    built.forEach(b => checkBlock(b.activity, b.out, { topic: set.base && set.base.topic }).forEach(x => v.push(Object.assign({ key: b.activity.key, block: b.activity.title }, x))));
    return v.concat(checkComposition(set), checkErrorModel(built), checkCriteria(set));
  }

  const api = { checkCriteria, checkBlock, checkSet, checkVocabEntry, repairVocabEntry, blockText, hasContent };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LessonGuardrails = api;
})(typeof window !== 'undefined' ? window : globalThis);
