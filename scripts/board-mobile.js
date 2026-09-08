/* ═══════════════════ WHAT THE BOARD PROMISES ON A PHONE ═══════════════════

   The board grew up with a mouse. Over time the phone got the same buttons as
   the desktop on the theory that a teacher shouldn't be told "not here" - but
   a button that opens a connector pipeline needing hover, a 6px anchor dot and
   a precise drag isn't a feature on a touch screen, it's a dead end. The
   audit that produced this file found a whole layer of phone fixes
   (scripts/mobile-board-fixes.js) that had never been loaded by any page, so
   for months the phone ran the raw desktop code path.

   So the phone now runs on a contract instead of on hope. Every board
   capability sits in exactly one of three buckets below, and the bucket
   decides what the phone shows and what it refuses:

     direct    - the finger does it: pan, pinch, tap to select, double-tap to
                 zoom, scroll inside a card, add, edit, undo, save, share.
     assisted  - possible, but only through a control built for a thumb:
                 moving a card (Move), sizing it (Size). The desktop gesture
                 for these needs pixel precision we don't have.
     desktop   - genuinely needs a mouse. Hidden from the phone UI, and if
                 something reaches the function anyway it says so in one
                 consistent sentence instead of half-working.

   The rule that keeps this honest: nothing is in `direct` unless it was
   tested with a finger. If a capability is unreliable, it moves down a
   bucket - it does not stay put with a caveat in the docs. */

(function () {
  'use strict';

  const MQ = window.matchMedia ? window.matchMedia('(max-width:860px)') : null;
  const isPhone = () => (MQ ? MQ.matches : window.innerWidth <= 860);
  const bridge = () => window.boardPhoneBridge || null;

  const CONTRACT = {
    direct: [
      ['Move around',   'One finger drags the canvas, two fingers pinch to zoom.'],
      ['Select a card', 'Tap it. Tap the canvas to deselect.'],
      ['Zoom to a card','Double-tap it; double-tap the canvas to fit the board.'],
      ['Read long cards','Scroll inside the card itself.'],
      ['Add',           'Sticky, Text, Frame, Sticker, Comment and the lesson library.'],
      ['Edit',          'Opens the full-screen card editor.'],
      ['Undo / Redo',   'From the bar at the bottom.'],
      ['Draw',          'Pen draws; the canvas stops panning while it is on.'],
      ['Share & save',  'Saving is automatic; Share works as it does on desktop.']
    ],
    assisted: [
      ['Move a card',  'Select it, tap Move, then drag anywhere on the screen.'],
      ['Resize a card','Select it, tap Size, pick a size. Free resize needs the corner handles.']
    ],
    desktop: [
      ['Connectors and arrows', 'Anchor dots are smaller than a fingertip and the drag has to land exactly.'],
      ['Multi-select',          'Marquee selection has no touch equivalent that does not fight panning.'],
      ['Grouping',              'Needs multi-select first.'],
      ['Layer order',           'Depends on the layer popover, which needs a cursor.'],
      ['Free resize',           'Use Size on a phone.']
    ]
  };

  /* Reaching a desktop-only path is never a crash and never a silent nothing:
     it is this one sentence, in the board's own toast. */
  function refuse(label) {
    const say = (bridge() && bridge().toast) || window.toast;
    try { say('Only on a computer: ' + label); } catch {}
  }

  /* Wrapping the global is enough to cover the internal callers too: these are
     top-level function declarations, so board-app.js resolves them through the
     same window property we are replacing here. */
  function gate(name, label, silent) {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function () {
      if (!isPhone()) return original.apply(this, arguments);
      if (!silent) refuse(label);
      return undefined;
    };
  }

  function installGates() {
    gate('toggleConnectMode', 'Connectors');
    gate('startConnection',   'Connectors');
    gate('groupSelected',     'Grouping');
    gate('ungroupSelected',   'Grouping');
    // Silent ones are reached by the board's own housekeeping (locking a card
    // re-opens the layer popover, a stray touch starts a marquee). A toast
    // there would blame the teacher for something they never asked for.
    gate('showLayerPopover',       '', true);
    gate('beginBoxSelectionAt',    '', true);
    gate('startMultiSelectionDrag','', true);
    gate('startResize',            '', true);
  }

  /* ───────────────────────── card action bar ───────────────────────── */

  let activeId = null;
  let moving = null;

  function actionBar() {
    let bar = document.getElementById('phone-card-actions');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'phone-card-actions';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = [
      '<button type="button" data-act="edit">Edit</button>',
      '<button type="button" data-act="move">Move</button>',
      '<button type="button" data-act="size">Size</button>',
      '<button type="button" data-act="duplicate">Copy</button>',
      '<button type="button" data-act="delete" class="danger">Delete</button>'
    ].join('');
    document.body.appendChild(bar);
    bar.addEventListener('click', event => {
      const button = event.target.closest('[data-act]');
      if (!button || !activeId) return;
      event.preventDefault();
      event.stopPropagation();
      runAction(button.dataset.act);
    });
    return bar;
  }

  function runAction(action) {
    const api = bridge();
    if (!api) return;
    if (api.isLocked(activeId) && action !== 'duplicate') {
      try { api.toast('This card is locked'); } catch {}
      return;
    }
    if (action === 'edit') {
      if (typeof window.openCardEditor === 'function') window.openCardEditor(activeId);
    } else if (action === 'move') {
      startMoveMode();
    } else if (action === 'size') {
      openSizeSheet();
    } else if (action === 'duplicate') {
      if (typeof window.duplicateSelected === 'function') window.duplicateSelected();
    } else if (action === 'delete') {
      if (window.confirm('Delete this card?') && typeof window.deleteSelected === 'function') {
        window.deleteSelected();
        hideActions();
      }
    }
  }

  function showActions(id) {
    if (!isPhone() || !id) return;
    activeId = id;
    const bar = actionBar();
    bar.classList.add('open');
    bar.setAttribute('aria-hidden', 'false');
    document.body.classList.add('phone-card-selected');
  }

  function hideActions() {
    activeId = null;
    endMoveMode(false);
    closeSizeSheet();
    const bar = document.getElementById('phone-card-actions');
    if (bar) { bar.classList.remove('open'); bar.setAttribute('aria-hidden', 'true'); }
    document.body.classList.remove('phone-card-selected');
  }

  /* ───────────────────────── assisted: move ─────────────────────────
     The desktop drag starts on the card, so the finger covers the thing it is
     placing and the board has to guess whether a gesture is a pan, a drag or a
     scroll. Move mode removes the guess: the card is already chosen, the whole
     screen is the drag surface, and the finger can rest well away from it. */

  function startMoveMode() {
    const api = bridge();
    const card = api && api.getCard(activeId);
    if (!card) return;
    api.snapshot();
    moving = { id: activeId, from: { x: card.x, y: card.y }, origin: null, base: null };
    document.body.classList.add('phone-moving-card');
    document.getElementById('phone-card-actions')?.classList.add('is-moving');
    showMoveHud();
    document.addEventListener('touchstart', onMoveStart, { capture: true, passive: false });
    document.addEventListener('touchmove',  onMoveDrag,  { capture: true, passive: false });
    document.addEventListener('touchend',   onMoveEnd,   { capture: true, passive: false });
  }

  function endMoveMode(commit) {
    if (!moving) return;
    document.removeEventListener('touchstart', onMoveStart, true);
    document.removeEventListener('touchmove',  onMoveDrag,  true);
    document.removeEventListener('touchend',   onMoveEnd,   true);
    document.body.classList.remove('phone-moving-card');
    document.getElementById('phone-card-actions')?.classList.remove('is-moving');
    document.getElementById('phone-move-hud')?.remove();
    const api = bridge();
    if (api) {
      if (!commit) api.moveCardTo(moving.id, moving.from.x, moving.from.y);
      api.scheduleSave();
    }
    moving = null;
  }

  function showMoveHud() {
    let hud = document.getElementById('phone-move-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'phone-move-hud';
      hud.innerHTML = '<span>Drag anywhere to place the card</span>' +
        '<button type="button" data-move="cancel">Cancel</button>' +
        '<button type="button" data-move="done" class="primary">Done</button>';
      document.body.appendChild(hud);
      hud.addEventListener('click', event => {
        const button = event.target.closest('[data-move]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        endMoveMode(button.dataset.move === 'done');
      });
    }
    return hud;
  }

  function onMoveStart(event) {
    if (!moving || event.touches.length !== 1) return;
    if (event.target.closest('#phone-move-hud,#phone-card-actions')) return;
    const api = bridge();
    const card = api && api.getCard(moving.id);
    if (!card) return;
    const touch = event.touches[0];
    moving.origin = api.screenToBoard(touch.clientX, touch.clientY);
    moving.base = { x: card.x, y: card.y };
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onMoveDrag(event) {
    if (!moving || !moving.origin || event.touches.length !== 1) return;
    const api = bridge();
    const touch = event.touches[0];
    const now = api.screenToBoard(touch.clientX, touch.clientY);
    api.moveCardTo(moving.id, moving.base.x + (now.x - moving.origin.x),
                              moving.base.y + (now.y - moving.origin.y));
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onMoveEnd(event) {
    if (!moving) return;
    moving.origin = null;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  /* ───────────────────────── assisted: size ───────────────────────── */

  const SIZES = [
    ['S',    180, 140],
    ['M',    260, 200],
    ['L',    340, 280],
    ['Tall', 260, 380]
  ];

  function openSizeSheet() {
    const api = bridge();
    if (!api || !api.getCard(activeId)) return;
    let sheet = document.getElementById('phone-size-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'phone-size-sheet';
      sheet.innerHTML = '<p>Card size</p><div class="phone-size-row">' +
        SIZES.map(([label, w, h]) => `<button type="button" data-w="${w}" data-h="${h}">${label}</button>`).join('') +
        '</div><button type="button" class="phone-size-fit" data-fit="1">Fit the screen width</button>';
      document.body.appendChild(sheet);
      sheet.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || !activeId) return;
        event.preventDefault();
        event.stopPropagation();
        const api2 = bridge();
        const card = api2 && api2.getCard(activeId);
        if (!card) return;
        api2.snapshot();
        if (button.dataset.fit) {
          const width = Math.max(160, Math.round((window.innerWidth - 48) / (api2.scale() || 1)));
          api2.resizeCardTo(activeId, width, card.h);
        } else {
          api2.resizeCardTo(activeId, Number(button.dataset.w), Number(button.dataset.h));
        }
        api2.scheduleSave();
        closeSizeSheet();
      });
    }
    sheet.classList.add('open');
  }

  function closeSizeSheet() {
    document.getElementById('phone-size-sheet')?.classList.remove('open');
  }

  /* ───────────────────────── selection wiring ─────────────────────────
     Selection rides the click the browser already synthesises after a tap.
     An earlier attempt swallowed touchstart/touchmove/touchend on every card
     to do this by hand, which also swallowed dragging and scrolling - the
     cure was worse than the disease. */

  document.addEventListener('click', event => {
    if (!isPhone()) return;
    if (moving) return;
    const card = event.target.closest && event.target.closest('.board-card');
    if (card && card.dataset.id) {
      if (event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
      showActions(card.dataset.id);
      return;
    }
    if (!event.target.closest('#phone-card-actions,#phone-size-sheet,#phone-move-hud,#card-editor,#mq-add-sheet')) {
      hideActions();
    }
  }, true);

  /* ───────────────────────── the contract, readable ───────────────────────── */

  function openContractSheet() {
    let sheet = document.getElementById('phone-contract-sheet');
    if (!sheet) {
      const section = (title, rows, cls) =>
        `<h3 class="${cls}">${title}</h3><dl>` +
        rows.map(([term, detail]) => `<dt>${term}</dt><dd>${detail}</dd>`).join('') + '</dl>';
      sheet = document.createElement('div');
      sheet.id = 'phone-contract-sheet';
      sheet.innerHTML =
        '<div class="pcs-panel" role="dialog" aria-label="What works on a phone">' +
        '<button type="button" class="pcs-close" aria-label="Close">×</button>' +
        '<h2>On a phone</h2>' +
        section('Works by touch', CONTRACT.direct, 'ok') +
        section('Works through a control', CONTRACT.assisted, 'assisted') +
        section('Needs a computer', CONTRACT.desktop, 'desktop') +
        '</div>';
      document.body.appendChild(sheet);
      sheet.addEventListener('click', event => {
        if (event.target.closest('.pcs-close') || event.target === sheet) {
          sheet.classList.remove('open');
        }
      });
    }
    sheet.classList.add('open');
  }
  window.openPhoneContract = openContractSheet;

  /* ───────────────────────── boot ───────────────────────── */

  function boot() {
    document.body.classList.toggle('phone-board', isPhone());
    if (!isPhone()) { hideActions(); return; }
    installGates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener('resize', () => {
    document.body.classList.toggle('phone-board', isPhone());
    if (!isPhone()) hideActions();
  });

  window.boardPhoneContract = CONTRACT;
})();
