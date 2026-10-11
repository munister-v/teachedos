'use strict';

const crypto = require('crypto');

/* ═══════════════════ A WORKSHEET'S ANSWER KEY STAYS ON THE SERVER ═══════════════════

   v1164 stopped drawing the key for students, but the board JSON still carried
   every right answer to their browser - one look at the network tab was enough.
   For anyone but the board owner, and until the teacher presses "Show key to
   class" (data.keyShared === true), a worksheet card now travels without them.

   Where the answers live (scripts/board-app.js _ttWorksheetListHTML and
   scripts/worksheet-play.js _buildInteractiveWSHtml), at any depth of the card
   data - a lesson path keeps whole worksheets in _wfPath.steps[k].out.tasks[i]:

     questions[]   mcq        answer = the option text
                   truefalse  answer = true / false
                   gap-fill   answer = the missing word, or the whole rewritten
                              sentence for word-order / rewrite / proofread
                   open       answer = the reference answer, when there is one
                   match      pairs[i] = { left, right } - the pairing IS the key.
                              The right-hand sides are reordered (with their
                              pictures) so the sheet still shows what to match.
     _titleChoice  answer = the right title of a reading text

   Not touched: a vocabulary list (items[]) is study material, a lesson pack
   (cards[]) is prose. A dictation task is exempt - its sentence is read aloud
   by the browser, so the client has to have it.

   Play mode used to check answers against data-answer attributes in its
   iframe. A stripped question carries `_ref` instead (its path inside
   card.data), and the iframe asks POST /api/boards/:id/cards/:cardId/check -
   checkAnswer below - one committed answer at a time. That is exactly what
   pressing an option in Play reveals anyway; the whole key never leaves.

   The owner always receives the untouched card, so an owner's save can never
   write a stripped copy back over the answers (and non-owners cannot save). */

const ANSWER_FIELDS = ['answer', 'answers', 'correct', 'correctAnswer', 'correct_answer', 'correctIndex', 'explanation'];
const OPTION_FLAGS = ['correct', 'isCorrect'];
const BLANK = /_{3,}/;
const MAX_DEPTH = 10;
const SALT = process.env.JWT_SECRET || 'teached-answer-key';

function isDictation(owner) {
  return !!owner && (owner._tool === 'listening-dictation' || /dictation|shadow/i.test(String(owner.title || '')));
}

function pairLeftKey(p) {
  if (Array.isArray(p)) return 0;
  if (p && typeof p === 'object') return 'left' in p ? 'left' : ('a' in p ? 'a' : null);
  return null;
}

function hasKey(q) {
  if (!q || typeof q !== 'object') return false;
  if (ANSWER_FIELDS.some(k => q[k] !== undefined)) return true;
  if (Array.isArray(q.options) && q.options.some(o => o && typeof o === 'object' && OPTION_FLAGS.some(f => f in o))) return true;
  return Array.isArray(q.pairs) && q.pairs.length > 1;
}

/* A stable order per question: the card re-renders on every board patch, and
   a sheet whose right column reshuffled each time the teacher moved anything
   would be unreadable. Seeded from a server secret, so the original order
   cannot be recomputed in the browser. */
function seededOrder(n, seed) {
  let buf = crypto.createHash('sha256').update(SALT + '|' + seed).digest();
  let at = 0;
  const next = () => {
    if (at + 4 > buf.length) { buf = crypto.createHash('sha256').update(buf).digest(); at = 0; }
    const v = buf.readUInt32BE(at); at += 4;
    return v / 0x100000000;
  };
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Left in place, the aligned column would be the key itself.
  if (n > 2 && order.every((v, i) => v === i)) order.push(order.shift());
  return order;
}

function reorderPairs(pairs, seed) {
  const leftKey = pairLeftKey(pairs[0]);
  if (leftKey === null || pairs.some(p => pairLeftKey(p) !== leftKey)) return pairs;
  const order = seededOrder(pairs.length, seed);
  if (leftKey === 0) return pairs.map((p, i) => [p[0], pairs[order[i]][1]]);
  return pairs.map((p, i) => {
    const rhs = Object.assign({}, pairs[order[i]]);
    delete rhs[leftKey];
    return Object.assign({ [leftKey]: p[leftKey] }, rhs);
  });
}

function stripQuestion(q, ref, seed) {
  const out = Object.assign({}, q);
  ANSWER_FIELDS.forEach(k => { delete out[k]; });
  if (Array.isArray(q.options)) {
    out.options = q.options.map(o => {
      if (!o || typeof o !== 'object') return o;
      const c = Object.assign({}, o);
      OPTION_FLAGS.forEach(f => { delete c[f]; });
      return c;
    });
  }
  if (Array.isArray(q.pairs) && q.pairs.length > 1) out.pairs = reorderPairs(q.pairs, seed + '|' + ref);
  out._ref = ref;
  return out;
}

/* Play turns blank gap-fills into a word bank to drag from (gapFillDragHtml):
   the whole sheet when every question is one, otherwise per mission station.
   The bank is what the student is shown anyway - it lists the words without
   saying which blank takes which. */
function gapBank(questions, seed) {
  const isBlank = q => q && q.type === 'gap-fill' && BLANK.test(String(q.text || '')) && q.answer != null && q.answer !== '';
  const groups = [];
  if (questions.length > 1 && questions.every(isBlank)) groups.push(questions);
  else {
    const missions = [...new Set(questions.map(q => q && q._mission).filter(Boolean))];
    if (missions.length > 1) {
      missions.forEach(m => {
        const qs = questions.filter(q => q && q._mission === m);
        if (qs.length > 1 && qs.every(isBlank)) groups.push(qs);
      });
    }
  }
  if (!groups.length) return null;
  const words = [];
  groups.forEach(qs => qs.forEach(q => words.push({ a: String(q.answer).trim(), m: q._mission || '' })));
  return seededOrder(words.length, seed + '|bank').map(i => words[i]);
}

function walk(node, path, seed, depth) {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) return node;
  if (Array.isArray(node)) {
    let changed = false;
    const out = node.map((v, i) => {
      const nv = walk(v, path.concat(i), seed, depth + 1);
      if (nv !== v) changed = true;
      return nv;
    });
    return changed ? out : node;
  }
  let out = null;
  const set = (k, v) => { if (!out) out = Object.assign({}, node); out[k] = v; };
  Object.keys(node).forEach(k => {
    const v = node[k];
    if (k === 'questions' && Array.isArray(v)) {
      if (isDictation(node) || !v.some(hasKey)) return;
      const bank = gapBank(v, seed + '|' + path.join('.'));
      set('questions', v.map((q, i) => hasKey(q) ? stripQuestion(q, path.concat('questions', i).join('.'), seed) : q));
      if (bank) set('_gapBank', bank);
      return;
    }
    if (k === '_titleChoice' && v && typeof v === 'object' && v.answer !== undefined) {
      const tc = Object.assign({}, v);
      delete tc.answer;
      tc._ref = path.concat(k).join('.');
      set(k, tc);
      return;
    }
    if (v && typeof v === 'object') {
      const nv = walk(v, path.concat(k), seed, depth + 1);
      if (nv !== v) set(k, nv);
    }
  });
  return out || node;
}

function cardHidesKey(card, viewerId, ownerId) {
  if (!card || card.type !== 'worksheet' || !card.data || typeof card.data !== 'object') return false;
  if (card.data.keyShared === true) return false;
  return !(viewerId != null && ownerId != null && String(viewerId) === String(ownerId));
}

/* The card as a student may receive it. Returns the same object when there is
   nothing to strip. Memoised per card object: a websocket patch is filtered
   once per person in the room, and every one of them gets the same copy. */
const stripped = new WeakMap();
function stripAnswers(card) {
  if (!card || typeof card !== 'object' || !card.data) return card;
  if (!stripped.has(card)) stripped.set(card, stripUncached(card));
  return stripped.get(card);
}
function stripUncached(card) {
  let data = walk(card.data, [], String(card.id), 0);
  // The owner's own Play answers, saved on the card - a teacher who tried the
  // sheet out would otherwise hand the class every right option.
  if (data._state != null) {
    if (data === card.data) data = Object.assign({}, data);
    delete data._state;
  }
  return data === card.data ? card : Object.assign({}, card, { data });
}

/* ── Checking one answer for a student in Play ── */

function resolveRef(data, ref) {
  if (typeof ref !== 'string' || !ref || ref.length > 300) return null;
  let node = data;
  for (const part of ref.split('.')) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      if (!/^\d+$/.test(part)) return null;
      node = node[Number(part)];
    } else {
      if (!Object.prototype.hasOwnProperty.call(node, part)) return null;
      node = node[part];
    }
  }
  return node && typeof node === 'object' && !Array.isArray(node) ? node : null;
}

const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();

function mcqAnswer(q) {
  if (typeof q.answer === 'number' && Array.isArray(q.options) && q.options[q.answer] !== undefined) return String(q.options[q.answer]);
  return q.answer == null ? null : String(q.answer);
}

/* { ok, answer? } for one committed answer, or null when the ref does not name
   a checkable question. `answer` comes back only where Play marks the right
   option after a pick (multiple choice, true/false, the title choice) - for a
   gap or a match it learns only whether the move was right, as before. */
function checkAnswer(data, ref, value, right) {
  const q = resolveRef(data, ref);
  if (!q) return null;
  if (/(^|\.)_titleChoice$/.test(ref)) {
    const a = mcqAnswer(q);
    return a == null ? null : { ok: String(value) === a, answer: a };
  }
  if (!/(^|\.)questions\.\d+$/.test(ref)) return null;
  if (q.type === 'mcq') {
    const a = mcqAnswer(q);
    return a == null ? null : { ok: String(value) === a, answer: a };
  }
  if (q.type === 'truefalse') {
    const a = (q.answer === true || String(q.answer).toLowerCase() === 'true') ? 'true' : 'false';
    return { ok: String(value) === a, answer: a };
  }
  if (q.type === 'match' && Array.isArray(q.pairs)) {
    const ok = q.pairs.some(p => {
      const lk = pairLeftKey(p);
      if (lk === null) return false;
      const l = p[lk];
      const r = lk === 0 ? p[1] : (lk === 'left' ? p.right : p.b);
      return String(l) === String(value) && String(r) === String(right);
    });
    return { ok };
  }
  if (q.answer == null || q.answer === '') return null;
  const accepted = Array.isArray(q.answer) ? q.answer : [q.answer];
  return { ok: accepted.some(a => norm(a) === norm(value)) };
}

module.exports = { stripAnswers, cardHidesKey, checkAnswer, resolveRef };
