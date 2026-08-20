/* ═══════════════════════ COLLECT LESSON VOCABULARY ═══════════════════════
   A live lesson leaves language scattered across the board - words on stickies,
   a glossary inside a lesson frame, "term - meaning" lines typed into a text
   card. Until now nothing could gather it: _ttGamePayloads() in board-app.js
   turns a teacher-tool RESULT into a game, but has no way to read what the
   lesson itself produced.

   This collects that language into one reviewed set, drops it on the board as a
   card, and hands it to the existing games through placeGameOnBoard(), so the
   words the class actually used become the words they practise.

   Kept in its own file rather than added to board-app.js (17k+ lines) so it can
   be read and removed as one piece. Everything it touches from the board is
   guarded - a missing global degrades to a toast, never a broken canvas. */

(function () {
  'use strict';

  var MAX_ITEMS = 80;          // a lesson's worth; beyond this it is a word list, not vocabulary
  var MAX_TERM_LEN = 42;       // longer than this is a sentence, not a term
  var MAX_TERM_WORDS = 5;      // "make up your mind" is a phrase; a paragraph is not

  function has(fn) { return typeof window[fn] === 'function'; }
  function say(msg, kind) { if (has('toast')) window.toast(msg, kind); }

  /* ── extraction ────────────────────────────────────────────────────────── */

  // Text cards keep markdown-ish source, but a rich-text card can hold real
  // markup; strip tags and entities so both arrive here as plain lines.
  function plain(s) {
    return String(s == null ? '' : s)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  // Lines that are structure, not language: stage headers ("WARM-UP (10 min)"),
  // bare headings ending in a colon, checklist/bullet leftovers, timings.
  function isNoise(line) {
    if (!line) return true;
    if (/^[-•*·>#\s]*$/.test(line)) return true;
    if (/:\s*$/.test(line)) return true;
    if (/\(\s*\d+\s*(min|mins|minutes|хв|мин)\b/i.test(line)) return true;
    if (/^\d+[.)]\s*$/.test(line)) return true;
    return false;
  }

  function cleanTerm(s) {
    return plain(s).replace(/^[-•*·\d.)\s]+/, '').replace(/\s+/g, ' ').trim();
  }

  // A term must look like a word or short phrase. This is what keeps whole
  // sentences from a reading text out of the set.
  function termLooksRight(t) {
    if (!t || t.length > MAX_TERM_LEN) return false;
    if (t.split(/\s+/).length > MAX_TERM_WORDS) return false;
    if (/[.!?]$/.test(t)) return false;
    return /[a-zà-öø-ÿа-щьюяєіїґ]/i.test(t);   // must contain a letter, not just punctuation/digits
  }

  // "word - meaning", "word - meaning", "word: meaning".
  // The separator must be spaced (or a dash character that never appears inside
  // a word) so hyphenated terms like "word-image" are not split in half.
  function splitPair(line) {
    var m = line.match(/^(.{1,42}?)\s+[-]\s+(.+)$/);
    if (m) return { term: cleanTerm(m[1]), def: plain(m[2]).trim() };
    m = line.match(/^([^:]{1,42}?):\s+(.+)$/);
    if (m) return { term: cleanTerm(m[1]), def: plain(m[2]).trim() };
    m = line.match(/^(.{1,42}?)\s+[-]\s*(.+)$/);   // hyphen separator without a trailing space
    if (m) return { term: cleanTerm(m[1]), def: plain(m[2]).trim() };
    return null;
  }

  function fromCard(card, out) {
    var d = (card && card.data) || {};

    // A lesson frame already carries a structured glossary - take it verbatim
    // rather than re-parsing the rendered text.
    if (d.lesson && Array.isArray(d.lesson.vocab)) {
      d.lesson.vocab.forEach(function (v) {
        if (v && v.word) out.push({ term: cleanTerm(v.word), def: plain(v.def || '').trim(), src: 'glossary' });
      });
      return;
    }
    // Comments are notes addressed to people, not language to practise.
    if (d.isComment) return;
    // A set this tool produced earlier: collecting again would re-ingest its own
    // header and rows, so each run compounded the previous one.
    if (d.vocabSet) return;

    var raw = '';
    if (typeof d.text === 'string' && d.text) raw = d.text;
    else if (typeof d.title === 'string' && d.title) raw = d.title;
    if (!raw) return;

    plain(raw).split(/\n+/).forEach(function (line) {
      line = line.trim();
      if (isNoise(line)) return;
      var pair = splitPair(line);
      if (pair && termLooksRight(pair.term) && pair.def) {
        out.push({ term: pair.term, def: pair.def, src: 'pair' });
        return;
      }
      var t = cleanTerm(line);
      if (termLooksRight(t)) out.push({ term: t, def: '', src: 'word' });
    });
  }

  // Same word from two cards is one entry; a definition found anywhere wins over
  // a bare mention, so collecting a sticky plus its glossary line gives a pair.
  function dedupe(items) {
    var seen = Object.create(null), out = [];
    items.forEach(function (it) {
      if (!it.term) return;
      var key = it.term.toLowerCase();
      if (!seen[key]) { seen[key] = it; out.push(it); return; }
      if (!seen[key].def && it.def) seen[key].def = it.def;
    });
    return out.slice(0, MAX_ITEMS);
  }

  // Whole-board fallback goes through serialize(): board-app.js keeps `state`
  // module-private, and serialize() is the only public view of every card.
  // It returns a JSON string, not an object.
  function allCards() {
    if (!has('serialize')) return [];
    try {
      var snap = JSON.parse(window.serialize());
      return (snap && Array.isArray(snap.cards)) ? snap.cards : [];
    } catch (e) { return []; }
  }

  function gather() {
    var cards = [];
    if (has('getSelectedCards')) cards = window.getSelectedCards() || [];
    var scope = cards.length ? 'selection' : 'board';
    if (!cards.length) cards = allCards();
    var out = [];
    cards.forEach(function (c) { try { fromCard(c, out); } catch (e) { /* one bad card must not stop the sweep */ } });
    return { items: dedupe(out), scope: scope, scanned: cards.length };
  }

  /* ── review panel ──────────────────────────────────────────────────────── */

  var _items = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Whether a word is kept lives on the item, not on the checkbox. Reading it
  // back out of the DOM meant any re-render reset every tick to "on", so
  // unticking a word - the entire point of reviewing - could not stick.
  function chosen() {
    return _items.filter(function (it) { return it.on; });
  }

  function updateCount() {
    var picked = chosen();
    var pairs = picked.filter(function (i) { return i.def; }).length;
    var cnt = document.getElementById('vocab-count');
    if (cnt) cnt.textContent = picked.length + ' selected · ' + pairs + ' with meanings';
  }

  function render() {
    var list = document.getElementById('vocab-list');
    if (!list) return;
    if (!_items.length) {
      list.innerHTML = '<p class="vocab-empty">Nothing left in the set.</p>';
    } else {
      list.innerHTML = _items.map(function (it, i) {
        return '<label class="vocab-row">' +
          '<input type="checkbox"' + (it.on ? ' checked' : '') + ' data-i="' + i + '">' +
          '<span class="vocab-term">' + esc(it.term) + '</span>' +
          (it.def ? '<span class="vocab-def">' + esc(it.def) + '</span>' : '<span class="vocab-def vocab-def-empty">no meaning yet</span>') +
          '</label>';
      }).join('');
    }
    updateCount();
  }

  function open() {
    var res = gather();
    if (!res.items.length) {
      say(res.scope === 'selection'
        ? 'No words found in the selected cards - try selecting stickies or a lesson frame.'
        : 'No vocabulary found on this board yet.', 'error');
      return;
    }
    _items = res.items.map(function (it) { it.on = true; return it; });
    var ov = document.getElementById('vocab-overlay');
    if (!ov) { say('Vocabulary panel is missing.', 'error'); return; }
    var scope = document.getElementById('vocab-scope');
    if (scope) {
      scope.textContent = res.scope === 'selection'
        ? 'from ' + res.scanned + ' selected card' + (res.scanned === 1 ? '' : 's')
        : 'from the whole board';
    }
    ov.style.display = 'flex';
    render();
    var l = document.getElementById('vocab-list');
    if (l && !l.dataset.bound) {
      l.dataset.bound = '1';
      l.addEventListener('change', function (e) {
        var box = e.target;
        if (!box || box.type !== 'checkbox') return;
        var it = _items[+box.dataset.i];
        if (it) it.on = box.checked;
        updateCount();
      });
    }
  }

  function close() {
    var ov = document.getElementById('vocab-overlay');
    if (ov) ov.style.display = 'none';
  }

  /* ── outputs ───────────────────────────────────────────────────────────── */

  function addAsCard() {
    var picked = chosen();
    if (!picked.length) { say('Select at least one word.', 'error'); return; }
    if (!has('addCard')) { say('Cannot add a card here.', 'error'); return; }
    if (has('snapshot')) window.snapshot();

    var body = picked.map(function (it) {
      return it.def ? it.term + ' - ' + it.def : it.term;
    }).join('\n');
    var text = 'Lesson vocabulary (' + picked.length + ')\n\n' + body;

    var pos = { x: 700, y: 420 };
    try {
      if (has('screenToBoard') && window.boardWrap) {
        var r = window.boardWrap.getBoundingClientRect();
        pos = window.screenToBoard(r.left + r.width / 2, r.top + r.height / 2) || pos;
      }
    } catch (e) { /* fall back to the default spot */ }

    var data = has('defaultTextData')
      ? window.defaultTextData({ text: text, bgColor: '#ffffff', textColor: '#111111', align: 'left' })
      : { text: text };
    data.vocabSet = true;   // so a later collection skips this card (see fromCard)
    window.addCard('text', pos.x - 160, pos.y - 140, data, 360, Math.min(560, 120 + picked.length * 22));
    close();
    say('📗 ' + picked.length + ' words added to the board');
  }

  // Game payloads reuse the shapes board-app.js already builds in
  // _ttGamePayloads(): {pairs:[{a,b}]} for matching games, {words:[…]} for the rest.
  function toGame(gameType) {
    var picked = chosen();
    if (!picked.length) { say('Select at least one word.', 'error'); return; }
    if (!has('placeGameOnBoard')) { say('Games are not available here.', 'error'); return; }

    var pairs = picked.filter(function (i) { return i.def; }).map(function (i) { return { a: i.term, b: i.def }; });
    var words = picked.map(function (i) { return i.term; });
    var content, needPairs = (gameType === 'memory-match' || gameType === 'flashcards');

    if (needPairs) {
      if (pairs.length < 3) {
        say('Need at least 3 words with meanings for this game - ' + pairs.length + ' so far.', 'error');
        return;
      }
      content = { pairs: pairs };
    } else {
      if (words.length < 3) { say('Need at least 3 words for this game.', 'error'); return; }
      content = { words: words };
    }
    window.placeGameOnBoard(gameType, 'Lesson vocabulary', 'B1', content);
    close();
  }

  /* ── wiring ────────────────────────────────────────────────────────────── */

  window.collectVocabulary = open;
  window.closeVocabOverlay = close;
  window.vocabAddCard = addAsCard;
  window.vocabToGame = toGame;
  window.vocabToggleAll = function (on) {
    _items.forEach(function (it) { it.on = !!on; });
    render();
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('vocab-overlay');
      if (ov && ov.style.display === 'flex') { close(); e.stopPropagation(); }
    }
  });
})();
