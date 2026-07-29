/* ═══════════════ HOLD A CARD BACK, THEN REVEAL IT ═══════════════

   The classroom move this exists for: put the answer on the board before the
   lesson, keep it covered while the class works, uncover it when they are done.

   The flag is only half of it. What makes this real is that the server stops
   sending the card's content to anyone but the board owner — see
   backend/lib/boardVisibility.js, which filters both GET /api/boards/:id and
   every websocket board_patch. A student receives geometry and a marker, never
   the text, so the answer is not sitting in the network tab waiting to be read.
   Revealing simply saves revealed:true, and the next patch carries the content.

   Kept out of board-app.js (17k+ lines) except for two small hooks it calls:
   the header button below, and the covered-card branch in renderCard(). */

(function () {
  'use strict';

  // Only the person who owns the board decides what the class may not see.
  // A local board has no server record yet, so its author is whoever is looking.
  function canHoldBack() {
    try {
      if (typeof currentBoardId !== 'undefined' && currentBoardId) {
        return typeof isOwner === 'undefined' ? false : !!isOwner;
      }
      return true;
    } catch (e) { return false; }
  }

  function findCard(cardId) {
    try {
      if (typeof state === 'undefined' || !state || !Array.isArray(state.cards)) return null;
      return state.cards.find(function (c) { return c.id === cardId; }) || null;
    } catch (e) { return null; }
  }

  function isHeldBack(card) {
    return !!(card && card.data && card.data.studentHidden && !card.data.revealed);
  }

  window.addStudentRevealToggle = function (hdr, cardId) {
    if (!hdr || !canHoldBack()) return;
    var card = findCard(cardId);
    if (!card) return;
    // A card already private to its author is invisible to the class anyway —
    // offering "hide from students" as well would be two controls for one effect.
    if (card.data && card.data.private) return;

    var held = isHeldBack(card);
    var btn = document.createElement('button');
    btn.className = 'card-close card-reveal-toggle' + (held ? ' is-held' : '');
    btn.style.marginRight = '2px';
    btn.style.fontSize = '12px';
    btn.textContent = held ? '🙈' : '👁';
    btn.title = held ? 'Hidden from students — click to reveal' : 'Hide this card from students';
    btn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      window.toggleCardStudentHidden(cardId);
    });
    hdr.appendChild(btn);
  };

  // Rebuild just this card's header so the icon flips, mirroring how
  // toggleCardPrivate does it — re-rendering the whole card would blow away
  // focus and caret position inside an editable one.
  function refreshHeader(cardId) {
    try {
      if (typeof getCardEl !== 'function' || typeof makeHeader !== 'function') return;
      var el = getCardEl(cardId);
      if (!el) return;
      var oldHdr = el.querySelector(':scope > .card-header');
      if (!oldHdr) return;
      var ic = oldHdr.querySelector('.card-drag-ic');
      var tt = oldHdr.querySelector('.card-title-text');
      el.replaceChild(makeHeader(ic ? ic.textContent : '📄', tt ? tt.textContent : '', cardId), oldHdr);
    } catch (e) { /* the flag is saved regardless */ }
  }

  window.toggleCardStudentHidden = function (cardId) {
    var card = findCard(cardId);
    if (!card) return;
    if (typeof snapshot === 'function') snapshot();
    card.data = card.data || {};

    if (isHeldBack(card)) {
      card.data.revealed = true;                 // kept, so the card can be hidden again later
      if (typeof toast === 'function') toast('👁 Revealed to students');
    } else {
      card.data.studentHidden = true;
      delete card.data.revealed;
      if (typeof toast === 'function') toast('🙈 Hidden from students until you reveal it');
    }

    refreshHeader(cardId);
    refreshRevealBar();
    // The save is what pushes the change through the server filter to students.
    if (typeof scheduleSave === 'function') scheduleSave();
    if (typeof saveLocal === 'function') saveLocal();
  };

  /* Context-menu entry. Stickies and text cards — the two most likely places to
     park an answer — render without a header, so the header toggle never
     reaches them; right-click covers every card type. */
  var _ctxCardId = null;

  window.syncStudentHideCtxItem = function (cardEl) {
    var item = document.getElementById('ctx-student-hide');
    var sep  = document.getElementById('ctx-student-sep');
    if (!item) return;
    var card = cardEl ? findCard(cardEl.dataset.id) : null;
    // A private card is already invisible to the class; two controls for one
    // effect would only confuse.
    var offer = !!card && canHoldBack() && !(card.data && card.data.private);
    _ctxCardId = offer ? card.id : null;
    item.style.display = offer ? '' : 'none';
    if (sep) sep.style.display = offer ? '' : 'none';
    if (offer) item.textContent = isHeldBack(card) ? '👁 Reveal to students' : '🙈 Hide from students';
  };

  document.addEventListener('DOMContentLoaded', function () {
    var item = document.getElementById('ctx-student-hide');
    if (!item) return;
    item.addEventListener('click', function () {
      if (_ctxCardId) window.toggleCardStudentHidden(_ctxCardId);
    });
  });

  /* The banner is the only way to reach revealAllForStudents(), so it has to be
     right whenever the board changes — including undo, redo and a change that
     arrived from someone else. Rather than reach into board-app's render path,
     recompute on our own actions plus a slow tick; counting a few hundred cards
     costs nothing next to a repaint. */
  function refreshRevealBar() {
    var bar = document.getElementById('reveal-bar');
    if (!bar) return;
    var n = 0;
    try {
      if (typeof state !== 'undefined' && state && Array.isArray(state.cards)) {
        n = state.cards.filter(isHeldBack).length;
      }
    } catch (e) { n = 0; }
    // A student cannot reveal anything, and their held-back cards arrive
    // stripped anyway — the banner is for whoever owns the board.
    if (!n || !canHoldBack()) { bar.classList.remove('show'); return; }
    var label = document.getElementById('reveal-bar-count');
    if (label) label.textContent = n + ' card' + (n === 1 ? '' : 's') + ' hidden from students';
    bar.classList.add('show');
  }
  window.refreshRevealBar = refreshRevealBar;

  document.addEventListener('DOMContentLoaded', function () {
    refreshRevealBar();
    setInterval(refreshRevealBar, 1500);
  });

  // Reveal everything at once — the usual end-of-task move.
  window.revealAllForStudents = function () {
    if (!canHoldBack()) return;
    if (typeof state === 'undefined' || !state || !Array.isArray(state.cards)) return;
    var held = state.cards.filter(isHeldBack);
    if (!held.length) { if (typeof toast === 'function') toast('Nothing is hidden right now.'); return; }
    if (typeof snapshot === 'function') snapshot();
    held.forEach(function (c) { c.data.revealed = true; refreshHeader(c.id); });
    refreshRevealBar();
    if (typeof scheduleSave === 'function') scheduleSave();
    if (typeof saveLocal === 'function') saveLocal();
    if (typeof toast === 'function') toast('👁 Revealed ' + held.length + ' card' + (held.length === 1 ? '' : 's'));
  };
})();
