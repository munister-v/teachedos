'use strict';

/* What the onboarding puts on a board: the practice sandbox and the starter
   templates. Starters are generated from the Lesson Packs the product already
   ships (scripts/build-onboarding-starters.mjs -> data/onboarding-starters.json),
   so there is no lesson text in this file. */

const fs = require('fs');
const path = require('path');

const PRACTICE_NAME = 'Practice - safe to delete';
/* Ids the coach layer in the browser looks for (scripts/onboarding-v2.js). */
const PRACTICE_IDS = { title: 'c1', word: 'c2', zone: 'c3', timer: 'c4' };

/* Three objects (a sentence to edit, a card and a zone to move it to) and one
   interactive (a timer to start). The theme is a neutral English one, there is
   not a single real name in it, and the board has no text inside images. */
function practiceBoardData() {
  return {
    pan: { x: 120, y: 90 }, scale: 1, nextId: 5, arrows: [], groups: [], strokes: [], annotations: [],
    canvas: { tone: 'light' }, savedAt: Date.now(),
    cards: [
      { id: 'c3', type: 'frame', x: 500, y: 40, w: 340, h: 250, z: 0, color: null,
        data: { title: 'Morning routine - drop the card here', bg: '#ffffff', border: '#CDF649' } },
      { id: 'c1', type: 'text', x: 60, y: 60, w: 380, h: 130, z: 1, color: null,
        data: { textColor: '#24282C', bgColor: '#ffffff', fontFamily: 'var(--font)', fontSize: 20, align: 'left',
          text: 'My morning routine\nI usually have toast for breakfast.' } },
      { id: 'c2', type: 'sticky', x: 60, y: 240, w: 240, h: 130, z: 2, color: '#CDF649',
        data: { text: 'I wake up at seven.' } },
      { id: 'c4', type: 'timer', x: 60, y: 420, w: 240, h: 170, z: 3, color: null,
        data: { title: 'Warm-up timer', minutes: 2, seconds: 0, remaining: 120 } },
    ],
  };
}

let starterCache = null;
function loadStarters() {
  if (!starterCache) {
    starterCache = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'onboarding-starters.json'), 'utf8'));
  }
  return starterCache;
}

/* What the picker shows: no card data, only what a teacher chooses by. */
function starterCards() {
  return loadStarters().map(s => ({
    id: s.id, title: s.title, skill: s.skill, level: s.level, minutes: s.minutes,
    students_do: s.students_do, outline: s.outline, cards: s.board.cards.length,
  }));
}

function starterBoard(id) {
  const s = loadStarters().find(x => x.id === id);
  return s ? JSON.parse(JSON.stringify(s.board)) : null;
}

/* A copy of the practice board's current content for "Practice copy". The
   label card and timers' running state are not carried over. */
function practiceCopy(data) {
  const copy = JSON.parse(JSON.stringify(data && typeof data === 'object' ? data : {}));
  if (Array.isArray(copy.cards)) {
    copy.cards.forEach(c => {
      if (c.type === 'timer' && c.data) c.data.remaining = (c.data.minutes || 0) * 60 + (c.data.seconds || 0);
    });
  }
  return copy;
}

module.exports = { PRACTICE_NAME, PRACTICE_IDS, practiceBoardData, starterCards, starterBoard, practiceCopy };
