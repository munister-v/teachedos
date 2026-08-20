'use strict';

/* ═══════════════════ WHO IS ENTITLED TO SEE WHICH CARD ═══════════════════

   A card a viewer may not see must not reach them AS DATA. Hiding it in the
   interface is not enough - the whole board travels to every collaborator, both
   through GET /api/boards/:id and through every websocket board_patch, so the
   content sat in the payload regardless of what the canvas drew.

   That was already true of the existing "private" flag: board-app.js filters
   those cards out when rendering, and the toast promises "others won't see it",
   but the server had no idea the flag existed and shipped the text to everyone.
   This module is the single place that decides, and both transports use it.

     private        the author's own note. Removed outright for anybody else,
                    matching what the canvas already does visually.

     studentHidden  the teacher is holding it back - an answer, a key. Everyone
                    except the board owner receives a content-free placeholder
                    that keeps its position, so a student sees that something is
                    there and is yet to come. Setting revealed:true releases it.

   Redaction keeps geometry and drops everything the card says. Arrows pointing
   at a card that was removed go with it, otherwise the client renders lines to
   nowhere. */

// Everything that places a card on the canvas; deliberately no content fields.
var GEOMETRY_KEYS = ['id', 'type', 'x', 'y', 'w', 'h', 'z', 'rot', 'color', 'layer', 'groupId', 'locked'];

function same(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function cardVisibility(card, viewerId, ownerId) {
  var d = (card && card.data) || {};
  if (d.private && !same(d.private, viewerId)) return 'omit';
  if (d.studentHidden && !d.revealed && !same(viewerId, ownerId)) return 'redact';
  return 'full';
}

function redactCard(card) {
  var out = {};
  GEOMETRY_KEYS.forEach(function (k) {
    if (card[k] !== undefined) out[k] = card[k];
  });
  // The client draws a cover from this flag; it carries no lesson content.
  out.data = { hiddenForViewer: true };
  return out;
}

/* Returns board data as this viewer is allowed to receive it. Returns the very
   same object when nothing needs changing, so the common case (the teacher on
   a board with no flags) costs one pass and no copying. */
function filterBoardData(data, viewerId, ownerId) {
  if (!data || !Array.isArray(data.cards)) return data;

  var needsWork = data.cards.some(function (c) {
    return cardVisibility(c, viewerId, ownerId) !== 'full';
  });
  if (!needsWork) return data;

  var omitted = Object.create(null);
  var cards = [];
  data.cards.forEach(function (c) {
    var v = cardVisibility(c, viewerId, ownerId);
    if (v === 'omit') { if (c && c.id != null) omitted[c.id] = true; return; }
    cards.push(v === 'redact' ? redactCard(c) : c);
  });

  var out = Object.assign({}, data, { cards: cards });

  if (Array.isArray(data.arrows)) {
    out.arrows = data.arrows.filter(function (a) {
      return !(a && (omitted[a.fromCard] || omitted[a.toCard]));
    });
  }
  return out;
}

module.exports = { filterBoardData: filterBoardData, cardVisibility: cardVisibility, redactCard: redactCard };
