/* Lesson Builder v2.0 (design TZ 17.10.2026): the behaviour behind styles/lesson-builder.css.
   board-app.js owns the builder and its data; this file only shapes how it is used:
   - Level as chips A1-C2 over the existing #tbuilder-level select (the select stays the source of
     truth - everything else keeps reading it);
   - the lime marker on the key word of each screen title (the shape of the chrome's №6 head);
   - data-lb on the panel names the screen (studios, source, form, scenes, check), so the stylesheet
     can tell them apart without new hooks in board-app.js;
   - the One lesson path row (a Squish Switch) where a studio can lay a lesson out both ways;
   - Swipe Row on the Preview's tasks: a swipe opens Regenerate / Remove, a full swipe removes. */
(function () {
  'use strict';
  const panel = document.getElementById('tool-builder-panel');
  if (!panel) return;
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wiz = () => (typeof boardLessonWizard !== 'undefined' ? boardLessonWizard : null);

  /* ── Level chips ── */
  function levelChips() {
    const sel = document.getElementById('tbuilder-level');
    if (!sel) return;
    let row = document.getElementById('lb-level-chips');
    if (!row) {
      row = document.createElement('div');
      row.id = 'lb-level-chips';
      row.className = 'lb-chips';
      row.setAttribute('role', 'radiogroup');
      row.setAttribute('aria-label', 'Level');
      row.innerHTML = LEVELS.map(l => `<button type="button" class="lb-chip" role="radio" data-level="${l}">${l}</button>`).join('');
      sel.insertAdjacentElement('afterend', row);
      sel.classList.add('lb-select-hidden');
      sel.setAttribute('tabindex', '-1');
      sel.setAttribute('aria-hidden', 'true');
      row.addEventListener('click', e => {
        const b = e.target.closest('.lb-chip');
        if (!b || sel.value === b.dataset.level) return;
        sel.value = b.dataset.level;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        syncChips();
      });
      row.addEventListener('keydown', e => {
        if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
        e.preventDefault();
        const i = Math.max(0, LEVELS.indexOf(sel.value)) + (/Left|Up/.test(e.key) ? -1 : 1);
        const l = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, i))];
        row.querySelector(`[data-level="${l}"]`).click();
        row.querySelector(`[data-level="${l}"]`).focus();
      });
      sel.addEventListener('change', syncChips);
    }
    syncChips();
  }
  function syncChips() {
    const sel = document.getElementById('tbuilder-level');
    const row = document.getElementById('lb-level-chips');
    if (!sel || !row) return;
    row.querySelectorAll('.lb-chip').forEach(b => {
      const on = b.dataset.level === sel.value;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  /* ── The lime marker on the title ── */
  const MARKS = [
    [/^Where does the (material|word list) come from\?$/, m => m[1]],
    [/^(Listening|Reading|Speaking|Writing|Grammar) lesson$/, m => m[1]],
    [/^Vocabulary (Workout)$/, m => m[1]],
    [/^Magazine (Reading) Studio$/, m => m[1]],
    [/^(?:Which|Check the) (picture)\??$/, m => m[1]],
  ];
  function markTitle() {
    const t = document.getElementById('tbuilder-title');
    if (!t || t.querySelector('.bc-mk')) return;
    const text = t.textContent.trim();
    for (const [re, pick] of MARKS) {
      const m = text.match(re);
      if (!m) continue;
      const word = pick(m), at = text.indexOf(word);
      t.textContent = '';
      t.append(text.slice(0, at));
      const mk = document.createElement('span');
      mk.className = 'bc-mk';
      mk.textContent = word;
      t.append(mk, text.slice(at + word.length));
      return;
    }
  }

  /* ── Which screen is on ── */
  function screen() {
    const wizEl = document.getElementById('tbuilder-wizard');
    const host = document.getElementById('tb-wiz-step');
    if (wizEl && !wizEl.hidden && host) {
      if (host.querySelector('.bc-studios')) return 'studios';
      if (host.querySelector('.scd')) return 'check';
      if (host.querySelector('.lb-pkgrid')) return 'scenes';
      if (host.querySelector('.lb-srcgrid')) return 'source';
      return 'wizard';
    }
    if (panel.classList.contains('tb-magazine-mode')) return 'news';
    return 'form';
  }
  function onePathRow(sc) {
    const row = document.getElementById('tbuilder-onepath');
    if (!row) return;
    const w = wiz();
    const show = sc === 'form' && !!(w && ['reading', 'listening', 'grammar'].includes(w.skill) && w.source && w.source.mode !== 'workout');
    if (row.hidden === !show) return;                       // an unchanged write would wake the observer again
    row.hidden = !show;
    /* The remembered choice is put in only as the row appears: written on every refresh it would
       undo a click mid-way (the observer runs between the click and its change event). */
    const box = document.getElementById('tbuilder-onepath-in');
    if (show && box && typeof boardLessonOnePath === 'function') box.checked = boardLessonOnePath();
  }

  let busy = false;
  function refresh() {
    if (busy || !panel.classList.contains('open')) return;
    busy = true;
    try {
      const sc = screen();
      if (panel.dataset.lb !== sc) panel.dataset.lb = sc;
      const w = wiz();
      const skill = (w && w.skill) || '';
      if ((panel.dataset.lbSkill || '') !== skill) panel.dataset.lbSkill = skill;
      levelChips();
      markTitle();
      onePathRow(sc);
      // An empty section's counter is the grey "none chosen" pill, a filled one the ink pill.
      panel.querySelectorAll('.tb-stage-count').forEach(c => {
        const zero = /^none\b/i.test(c.textContent.trim());
        if (c.classList.contains('zero') !== zero) c.classList.toggle('zero', zero);
      });
    } finally { busy = false; }
  }
  new MutationObserver(refresh).observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'], characterData: true });
  // Code that sets the select's value directly fires no event; a light check keeps the chips honest.
  setInterval(() => { if (panel.classList.contains('open')) syncChips(); }, 500);

  /* ── Swipe Row on the Preview's tasks ── */
  const ICON = {
    regen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 00-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0014.6 4.5L20 16"/><path d="M20 20v-4h-4"/></svg>',
    del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  };
  const OPEN = 104;
  function prepRow(row) {
    if (row.querySelector(':scope > .lb-swipe-fg')) return;
    const fg = document.createElement('div');
    fg.className = 'lb-swipe-fg';
    while (row.firstChild) fg.appendChild(row.firstChild);
    const acts = document.createElement('div');
    acts.className = 'lb-swipe-acts';
    acts.innerHTML = `<button type="button" class="regen" data-swipe="regen" aria-label="Regenerate this task">${ICON.regen}</button><button type="button" class="del" data-swipe="del" aria-label="Remove this task">${ICON.del}</button>`;
    row.classList.add('lb-swipe');
    row.append(acts, fg);
  }
  function setX(row, x, animate) {
    const fg = row.querySelector(':scope > .lb-swipe-fg');
    if (!fg) return;
    fg.style.transition = animate && !reduced() ? 'transform .26s cubic-bezier(.2,.7,.3,1)' : 'none';
    fg.style.transform = x ? `translateX(${x}px)` : '';
    row.classList.toggle('lb-swiped', x < 0);
  }
  function closeOthers(except) {
    document.querySelectorAll('#tbuilder-output .lb-swipe.lb-swiped').forEach(r => { if (r !== except) setX(r, 0, true); });
  }
  const out = document.getElementById('tbuilder-output');
  let drag = null;
  out && out.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const row = e.target.closest('.tbuilder-section[data-act]');
    if (!row || e.target.closest('button, a, input, textarea, select, [contenteditable="true"], .lb-swipe-acts')) return;
    prepRow(row);
    const fg = row.querySelector(':scope > .lb-swipe-fg');
    const base = parseFloat((fg.style.transform.match(/-?[\d.]+/) || [0])[0]) || 0;
    drag = { row, x0: e.clientX, y0: e.clientY, base, x: base, live: false, id: e.pointerId };
  });
  window.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.live) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // a scroll, not a swipe
      if (Math.abs(dx) < 8) return;
      drag.live = true;
      closeOthers(drag.row);
      try { drag.row.setPointerCapture(e.pointerId); } catch (_) {}
    }
    e.preventDefault();
    drag.x = Math.min(0, drag.base + dx);
    setX(drag.row, drag.x, false);
  }, { passive: false });
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const { row, x, live } = drag;
    drag = null;
    if (!live) return;
    const w = row.getBoundingClientRect().width || 1;
    if (x < -w * 0.55) { removeRow(row); return; }
    setX(row, x < -OPEN / 2 ? -OPEN : 0, true);
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  function removeRow(row) {
    const key = row.dataset.act;
    const go = () => { if (typeof dropStageActivity === 'function') dropStageActivity(key); };
    if (reduced()) { go(); return; }
    setX(row, -row.getBoundingClientRect().width, true);
    row.classList.add('lb-gone');
    setTimeout(go, 240);
  }
  out && out.addEventListener('click', e => {
    const b = e.target.closest('[data-swipe]');
    if (!b) return;
    const row = b.closest('.tbuilder-section[data-act]');
    if (!row) return;
    if (b.dataset.swipe === 'del') removeRow(row);
    else { setX(row, 0, true); if (typeof redoStageActivity === 'function') redoStageActivity(row.dataset.act); }
  });
})();
