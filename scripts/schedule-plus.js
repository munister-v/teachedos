/* ═══════════════════════════════════════════════════════════════════════════
   schedule-plus.js - the Schedule page answers the questions a teacher has
   while planning (15.10.2026):

   - booking a student with 0 lessons left asks first: book anyway, book and
     ask for payment, or not now;
   - "+8" asks before adding a package and says what the student receives;
   - the class form warns in orange, as you type, when the time clashes with
     another lesson or with time marked Busy;
   - a lesson of a weekly series that the package no longer covers is drawn
     dashed with "⚠ Top up to continue";
   - the week header shows the teacher's timezone (GMT+3);
   - "Find 60 min" lights up every free hour of the week; clicking windows
     collects times to offer, and one click sends "I can offer Thursday at
     16:00 or Friday at 11:00" to the student (double-click books it).

   Loaded after schedule.html's own script and schedule-booking.js; uses their
   globals: schedule, journalStudents, journalStudent, lessonStatus, editingId,
   BK_BLOCKS, getWeekDates, weekOffset, weekSlotsForDay, HOUR_START, HOUR_END,
   PX_PER_HOUR, DAY_NAMES, apiFetch, toast, renderGrid, renderBalances,
   loadBalances, openPlannerAt, effectiveScheduleZone, timeZoneOffsetMinutes.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const mins = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const hhmm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const first = n => String(n || '').trim().split(/\s+/)[0] || 'there';
  const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const CSS = `
.sp-dlg-ov{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(16,18,22,.32);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
.sp-dlg{width:min(420px,100%);background:#fff;color:#24282C;border-radius:20px;padding:20px;box-shadow:0 30px 80px rgba(16,18,22,.35);font-family:var(--font,system-ui)}
.sp-dlg h3{margin:0 0 6px;font-size:17px;line-height:1.25}
.sp-dlg p{margin:0 0 12px;font-size:13px;line-height:1.45;color:#5D614B}
.sp-dlg-col{display:flex;flex-direction:column;gap:8px}
.sp-dlg-row{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:13px;font-weight:650}
.sp-dlg-row.end{justify-content:flex-end;margin:6px 0 0}
.sp-dlg-row input{width:80px;height:34px;border:1px solid #CACCC6;border-radius:10px;padding:0 10px;font:700 14px inherit;font-family:inherit}
.sp-dlg-sum b{color:#24282C}
.sp-dlg-chk{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin:0 0 6px;cursor:pointer}
.sp-dlg-chk small{color:#6B6E60;font-weight:500}
.sp-dlg-note{font-size:12px!important}
.sp-b{height:38px;padding:0 16px;border:0;border-radius:12px;font:700 13px inherit;font-family:inherit;cursor:pointer;background:rgba(36,40,44,.07);color:#24282C}
.sp-b.main{background:#CDF649}
.sp-b.ghost{background:transparent;box-shadow:inset 0 0 0 1px rgba(36,40,44,.18)}
.sp-b:disabled{opacity:.55}
.sp-clash{margin:0 0 12px;padding:9px 12px;border-radius:10px;background:#FFF1E4;color:#9A4A00;font-size:12.5px;font-weight:650;line-height:1.4;box-shadow:inset 0 0 0 1px rgba(255,140,58,.45)}
.sp-clash[hidden]{display:none}
.cls-block.needs-topup{opacity:.72;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.28) 0 6px,transparent 6px 12px)!important;outline:2px dashed #FF8C3A;outline-offset:-2px}
.cb-topup{margin-top:3px;font-size:10.5px;font-weight:750;color:#24282C;background:#FFE44D;border-radius:6px;padding:1px 6px;display:inline-block}
.sp-tz{margin-left:6px;font:700 11px var(--mono,ui-monospace,monospace);letter-spacing:.04em;color:#5D614B;background:rgba(36,40,44,.06);border-radius:999px;padding:2px 8px;vertical-align:middle}
body.sp-finding .cls-block,body.sp-finding .bk-block{opacity:.35}
.sp-gap{position:absolute;left:3px;right:3px;z-index:6;border-radius:10px;cursor:pointer;background:rgba(205,246,73,.18);box-shadow:inset 0 0 0 2px #9FCC1F;animation:spGap 1.6s ease-in-out infinite}
.sp-gap span{position:absolute;top:4px;left:6px;font:700 10.5px var(--mono,ui-monospace,monospace);color:#3D4A0C}
.sp-gap:hover{background:rgba(205,246,73,.34)}
.sp-gap.sp-offer{z-index:7;background:#CDF649;box-shadow:inset 0 0 0 2px #24282C;animation:none}
.sp-gap.sp-offer span{color:#24282C}
@keyframes spGap{0%,100%{box-shadow:inset 0 0 0 2px rgba(159,204,31,.55)}50%{box-shadow:inset 0 0 0 2px #9FCC1F,0 0 0 3px rgba(205,246,73,.35)}}
@media (prefers-reduced-motion:reduce){.sp-gap{animation:none}}
.sp-findbar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:8000;width:min(860px,calc(100vw - 32px));display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:18px;background:#24282C;color:#fff;box-shadow:0 20px 50px rgba(16,18,22,.4);font-family:var(--font,system-ui);flex-wrap:wrap}
.sp-fb-l{display:flex;flex-direction:column;gap:3px;min-width:0}
.sp-fb-l b{font-size:14px}.sp-fb-l small{font-size:12px;color:#CACCC6}
.sp-fb-offers{display:flex;flex-wrap:wrap;gap:6px}
.sp-fb-offers button{height:26px;padding:0 10px;border:0;border-radius:999px;background:#CDF649;color:#24282C;font:700 12px inherit;font-family:inherit;cursor:pointer}
.sp-fb-r{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sp-fb-r select{height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#33383D;color:#fff;padding:0 8px;font:600 12.5px inherit;font-family:inherit}
.sp-findbar .sp-b.ghost{color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.3)}`;
  if (!document.getElementById('sp-plus-css')) { const st = document.createElement('style'); st.id = 'sp-plus-css'; st.textContent = CSS; document.head.appendChild(st); }

  /* ── small dialog ────────────────────────────────────────────────────── */
  function dialog(html, wire) {
    document.getElementById('sp-dlg')?.remove();
    const ov = document.createElement('div');
    ov.id = 'sp-dlg';
    ov.className = 'sp-dlg-ov';
    ov.innerHTML = `<div class="sp-dlg" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); wire.onCancel && wire.onCancel(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', e => { if (e.target === ov) { close(); wire.onCancel && wire.onCancel(); } });
    wire.init && wire.init(ov.querySelector('.sp-dlg'), close);
    return close;
  }

  /* ── 1. booking a student with 0 lessons ─────────────────────────────── */
  if (typeof saveClass === 'function') {
    const origSave = saveClass;
    window.saveClass = saveClass = async function () {   // eslint-disable-line no-global-assign
      const jid = (document.getElementById('f-student') || {}).value;
      const st = jid && journalStudent(jid);
      const prev = editingId && schedule.find(x => String(x.id) === String(editingId));
      const sameStudent = prev && String(prev.journal_id || '') === String(jid);
      if (!st || st.is_trial || sameStudent || (Number(st.lessons_left) || 0) > 0) return origSave.apply(this, arguments);
      const choice = await new Promise(resolve => dialog(`
          <h3>${esc(st.name)} has 0 lessons left</h3>
          <p>You can still book it. With an empty package this lesson is not taken off any balance when you mark it as held, so ask for payment first or keep count yourself.</p>
          <div class="sp-dlg-col">
            <button type="button" class="sp-b main" data-c="ask">Book it and ask for payment</button>
            <button type="button" class="sp-b" data-c="book">Book it anyway</button>
            <button type="button" class="sp-b ghost" data-c="no">Not now</button>
          </div>`, {
        init: (box, close) => box.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { close(); resolve(b.dataset.c); } }),
        onCancel: () => resolve('no'),
      }));
      if (choice === 'no') return;
      await origSave.apply(this, arguments);
      if (choice === 'ask') {
        // то же напоминание, что и из Student pulse: карточка там будет ждать оплату
        try {
          await apiFetch(`/api/journal/${encodeURIComponent(st.id)}/remind`, { method: 'POST', body: JSON.stringify({ kind: 'package', key: 'pkg:0' }) });
          toast(`Payment request sent to ${first(st.name)}`, 'ok');
        } catch (e) { toast(`The lesson is booked, but the payment request was not sent: ${e.message}`, 'err'); }
      }
    };
  }

  /* ── 2. "+8" asks first ──────────────────────────────────────────────── */
  if (typeof addPack === 'function') {
    window.addPack = addPack = function (id) {   // eslint-disable-line no-global-assign
      const st = journalStudent(id);
      if (!st) return;
      const size = Number(st.pack_size) || 8;
      const left = Number(st.lessons_left) || 0;
      const onPlatform = !!st.student_id;
      dialog(`
        <h3>Add a package for ${esc(st.name)}?</h3>
        <label class="sp-dlg-row">Lessons <input type="number" min="1" max="200" value="${size}" data-n></label>
        <p class="sp-dlg-sum">Balance: <b>${left}</b> → <b data-after>${left + size}</b> lessons</p>
        ${onPlatform || st.email ? `<label class="sp-dlg-chk"><input type="checkbox" data-receipt checked> Send ${esc(first(st.name))} a receipt <small>${onPlatform ? 'in their TeachEd cabinet' : 'by email'}</small></label>`
          : '<p class="sp-dlg-note">They are not on TeachEd and have no email in the Journal, so no receipt can be sent.</p>'}
        <div class="sp-dlg-row end"><button type="button" class="sp-b ghost" data-x>Cancel</button><button type="button" class="sp-b main" data-go>Add package</button></div>`, {
        init: (box, close) => {
          const n = box.querySelector('[data-n]'), after = box.querySelector('[data-after]');
          n.addEventListener('input', () => { after.textContent = left + Math.max(0, parseInt(n.value, 10) || 0); });
          box.querySelector('[data-x]').addEventListener('click', close);
          box.querySelector('[data-go]').addEventListener('click', async e => {
            const lessons = Math.max(1, Math.min(200, parseInt(n.value, 10) || size));
            const receipt = !!box.querySelector('[data-receipt]')?.checked;
            e.currentTarget.disabled = true;
            try {
              const d = await apiFetch(`/api/journal/${encodeURIComponent(id)}/pack`, { method: 'POST', body: JSON.stringify({ lessons, notify: receipt && onPlatform }) });
              // без аккаунта квитанция уходит письмом
              if (receipt && !onPlatform && st.email) {
                await apiFetch(`/api/journal/${encodeURIComponent(id)}/message`, { method: 'POST', body: JSON.stringify({ text: `Hi ${first(st.name)}! Payment received, thank you. ${lessons} lessons were added to your package - ${d.student.lessons_left} left.` }) }).catch(() => {});
              }
              Object.assign(st, d.student);
              if (typeof recapOpen === 'object') delete recapOpen[id];
              close();
              renderBalances();
              if (typeof renderGrid === 'function') renderGrid();
              toast(`+${d.added} lessons · ${d.student.lessons_left} left${receipt ? ' · receipt sent' : ''} ✅`, 'ok');
            } catch (err) { e.currentTarget.disabled = false; toast(err.message, 'err'); }
          });
          n.focus(); n.select();
        },
      });
    };
  }

  /* ── 3. clash warning in the class form ──────────────────────────────── */
  function formClashes() {
    const start = document.getElementById('f-start')?.value, end = document.getElementById('f-end')?.value;
    if (!start || !end || start >= end) return [];
    const a = mins(start), b = mins(end);
    const once = !document.getElementById('f-recurring')?.checked;
    const date = once ? document.getElementById('f-specific-date')?.value : '';
    const days = once ? (date ? [(new Date(date + 'T00:00:00').getDay() + 6) % 7] : []) : [...(typeof selectedDays !== 'undefined' ? selectedDays : [])];
    const out = [];
    days.forEach(day => {
      schedule.forEach(s => {
        if (String(s.id) === String(editingId) || Number(s.day) !== day) return;
        if (date && s.specific_date && String(s.specific_date).slice(0, 10) !== date) return;
        if (!date && s.specific_date) return;   // разовый урок в другой неделе еженедельному не мешает
        if (mins(s.start_time) < b && a < mins(s.end_time)) out.push(`${s.title || 'a lesson'} (${DAY_NAMES[day]} ${String(s.start_time).slice(0, 5)}-${String(s.end_time).slice(0, 5)})`);
      });
      (typeof BK_BLOCKS !== 'undefined' ? BK_BLOCKS : []).forEach(k => {
        if (k.kind !== 'busy' || Number(k.day) !== day) return;
        if (mins(k.start_time) < b && a < mins(k.end_time)) out.push(`your ${k.label ? `"${k.label}"` : 'personal'} time (${DAY_NAMES[day]} ${String(k.start_time).slice(0, 5)}-${String(k.end_time).slice(0, 5)})`);
      });
    });
    return out;
  }
  function paintClash() {
    const save = document.getElementById('modal-save-btn');
    if (!save) return;
    let w = document.getElementById('sp-clash');
    if (!w) { w = document.createElement('p'); w.id = 'sp-clash'; w.className = 'sp-clash'; save.parentElement.parentElement.insertBefore(w, save.parentElement); }
    const list = formClashes();
    w.hidden = !list.length;
    w.textContent = list.length ? `⚠ At this time you have ${list.join(' and ')}.` : '';
  }
  ['input', 'change', 'click'].forEach(t => document.addEventListener(t, e => {
    if (e.target.closest && e.target.closest('#modal, .modal, #class-modal') || (e.target.id || '').startsWith('f-')) setTimeout(paintClash, 0);
  }, true));
  if (typeof openModal === 'function') {
    const origOpen = openModal;
    window.openModal = openModal = function () { const r = origOpen.apply(this, arguments); setTimeout(paintClash, 0); return r; };   // eslint-disable-line no-global-assign
  }

  /* ── 4. weekly series past the package ───────────────────────────────── */
  // Сколько уроков ученика от «сейчас» до этого урока включительно. Больше,
  // чем осталось в пакете, - этот урок пакет уже не покрывает.
  function needsTopUp(slot, date) {
    if (!slot.journal_id) return false;
    const st = journalStudent(slot.journal_id);
    if (!st || st.is_trial) return false;
    const left = Number(st.lessons_left) || 0;
    const now = new Date();
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), ...String(slot.start_time).split(':').map(Number));
    if (target <= now) return false;
    const mine = schedule.filter(s => String(s.journal_id) === String(slot.journal_id));
    let count = 0;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let k = 0; k < 120 && d <= target; k++, d.setDate(d.getDate() + 1)) {
      const key = ymd(d), dow = (d.getDay() + 6) % 7;
      for (const s of mine) {
        const on = s.specific_date ? String(s.specific_date).slice(0, 10) === key : s.recurring !== false && Number(s.day) === dow;
        if (!on) continue;
        const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), ...String(s.start_time).split(':').map(Number));
        if (at <= now || at > target) continue;
        if (typeof lessonStatus === 'object' && lessonStatus[`${s.journal_id}|${key}`] === 'cancelled') continue;
        count++;
      }
    }
    return count > left;
  }
  function markTopUps() {
    const dates = getWeekDates();
    document.querySelectorAll('.cls-block[data-slot-id]').forEach(el => {
      const slot = schedule.find(s => String(s.id) === String(el.dataset.slotId));
      if (!slot) return;
      const date = dates[Number(slot.day)];
      const need = !!date && needsTopUp(slot, date);
      el.classList.toggle('needs-topup', need);
      el.querySelector('.cb-topup')?.remove();
      if (need) {
        const t = document.createElement('div');
        t.className = 'cb-topup';
        t.textContent = '⚠ Top up to continue';
        t.title = `${journalStudent(slot.journal_id).name}'s package does not cover this lesson`;
        el.appendChild(t);
      }
    });
  }

  /* ── 5. timezone in the header ───────────────────────────────────────── */
  function paintZone() {
    const t = document.querySelector('.scb-title');
    if (!t || typeof effectiveScheduleZone !== 'function') return;
    const zone = effectiveScheduleZone();
    let off = 0;
    try { off = timeZoneOffsetMinutes(new Date(), zone); } catch (_) { off = -new Date().getTimezoneOffset(); }
    const gmt = `GMT${off >= 0 ? '+' : '-'}${Math.floor(Math.abs(off) / 60)}${Math.abs(off) % 60 ? ':' + pad(Math.abs(off) % 60) : ''}`;
    t.innerHTML = `Teaching week <span class="sp-tz" title="${esc(zone)} - all times on this page">${gmt}</span>`;
  }

  if (typeof renderGrid === 'function') {
    const origRender = renderGrid;
    window.renderGrid = renderGrid = function () {   // eslint-disable-line no-global-assign
      const r = origRender.apply(this, arguments);
      try { markTopUps(); paintZone(); if (find.on) paintFind(); } catch (e) { console.warn('[schedule-plus]', e); }
      return r;
    };
  }

  /* ── 6. Find 60 min ──────────────────────────────────────────────────── */
  const find = { on: false, dur: 60, offers: [] };   // offers: [{day, start}]
  function freeWindows(dur) {
    const dates = getWeekDates(), now = new Date(), out = [];
    const todayDow = (now.getDay() + 6) % 7;
    dates.forEach((date, day) => {
      if (weekOffset < 0 || (weekOffset === 0 && day < todayDow)) return;
      let from = HOUR_START * 60;
      if (weekOffset === 0 && day === todayDow) from = Math.max(from, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
      const taken = weekSlotsForDay(day, date).map(s => [mins(s.start_time), mins(s.end_time)])
        .concat((typeof BK_BLOCKS !== 'undefined' ? BK_BLOCKS : []).filter(k => k.kind === 'busy' && Number(k.day) === day).map(k => [mins(k.start_time), mins(k.end_time)]))
        .sort((x, y) => x[0] - y[0]);
      let cur = from;
      for (const [a, b] of taken) {
        if (a - cur >= dur) out.push({ day, start: cur, end: a });
        cur = Math.max(cur, b);
      }
      if (HOUR_END * 60 - cur >= dur) out.push({ day, start: cur, end: HOUR_END * 60 });
    });
    return out;
  }
  function paintFind() {
    document.querySelectorAll('.sp-gap').forEach(e => e.remove());
    if (!find.on) return;
    freeWindows(find.dur).forEach(w => {
      const col = document.getElementById(`day-${w.day}`);
      if (!col) return;
      const g = document.createElement('div');
      g.className = 'sp-gap';
      g.style.top = ((w.start - HOUR_START * 60) / 60 * PX_PER_HOUR) + 'px';
      g.style.height = ((w.end - w.start) / 60 * PX_PER_HOUR) + 'px';
      g.dataset.day = w.day; g.dataset.a = w.start; g.dataset.b = w.end;
      g.innerHTML = `<span>free ${hhmm(w.start)}-${hhmm(w.end)}</span>`;
      g.title = 'Click: offer this time · double-click: book it';
      col.appendChild(g);
    });
    find.offers.forEach(o => {
      const col = document.getElementById(`day-${o.day}`);
      if (!col) return;
      const p = document.createElement('div');
      p.className = 'sp-gap sp-offer';
      p.style.top = ((o.start - HOUR_START * 60) / 60 * PX_PER_HOUR) + 'px';
      p.style.height = (find.dur / 60 * PX_PER_HOUR) + 'px';
      p.innerHTML = `<span>offer ${hhmm(o.start)}</span>`;
      p.dataset.offer = `${o.day}|${o.start}`;
      col.appendChild(p);
    });
    paintBar();
  }
  function offerText(name) {
    const parts = find.offers.slice().sort((x, y) => x.day - y.day || x.start - y.start).map(o => `${DAY_LONG[o.day]} at ${hhmm(o.start)}`);
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}` : parts[0] || '';
    return `Hi ${first(name)}! I can offer ${list} (${find.dur} min). Which suits you?`;
  }
  function paintBar() {
    let bar = document.getElementById('sp-findbar');
    if (!find.on) { bar?.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'sp-findbar';
      bar.className = 'sp-findbar';
      document.body.appendChild(bar);
      bar.addEventListener('click', onBar);
      bar.addEventListener('change', onBar);
    }
    const sel = bar.querySelector('[data-to]')?.value || '';
    const n = freeWindows(find.dur).length;
    bar.innerHTML = `<div class="sp-fb-l"><b>${n ? `${n} free window${n === 1 ? '' : 's'} of ${find.dur} min` : `No free ${find.dur} min this week`}</b>
        <small>${find.offers.length ? 'Your offer:' : 'Click a window to offer that time · double-click to book it'}</small>
        <span class="sp-fb-offers">${find.offers.map(o => `<button type="button" data-rm="${o.day}|${o.start}">${DAY_NAMES[o.day]} ${hhmm(o.start)} ×</button>`).join('')}</span></div>
      <div class="sp-fb-r">
        <select aria-label="Duration" data-dur>${[30, 45, 60, 90].map(d => `<option value="${d}"${d === find.dur ? ' selected' : ''}>${d} min</option>`).join('')}</select>
        ${find.offers.length ? `<select aria-label="Student" data-to><option value="">Copy the message</option>${journalStudents.map(s => `<option value="${esc(s.id)}"${String(s.id) === sel ? ' selected' : ''}>Send to ${esc(s.name)}</option>`).join('')}</select>
          <button type="button" class="sp-b main" data-send>${sel ? 'Send' : 'Copy'}</button>` : ''}
        <button type="button" class="sp-b ghost" data-done>Done</button></div>`;
  }
  async function onBar(e) {
    const bar = document.getElementById('sp-findbar');
    if (e.type === 'change' && e.target.matches('[data-dur]')) { find.dur = +e.target.value; find.offers = []; paintFind(); return; }
    if (e.type === 'change' && e.target.matches('[data-to]')) { bar.querySelector('[data-send]').textContent = e.target.value ? 'Send' : 'Copy'; return; }
    if (e.type !== 'click') return;
    const rm = e.target.closest('[data-rm]');
    if (rm) { find.offers = find.offers.filter(o => `${o.day}|${o.start}` !== rm.dataset.rm); paintFind(); return; }
    if (e.target.closest('[data-done]')) { stopFind(); return; }
    if (e.target.closest('[data-send]')) {
      const jid = bar.querySelector('[data-to]')?.value;
      const st = jid && journalStudent(jid);
      const text = offerText(st ? st.name : 'there');
      if (!st) {
        try { await navigator.clipboard.writeText(text); toast('Copied - paste it into your chat ✅', 'ok'); } catch (_) { prompt('Copy the message:', text); }
        return;
      }
      try {
        await apiFetch(`/api/journal/${encodeURIComponent(st.id)}/message`, { method: 'POST', body: JSON.stringify({ text }) });
        toast(`Sent to ${st.name} ✅`, 'ok');
        stopFind();
      } catch (err) { toast(err.message, 'err'); }
    }
  }
  function stopFind() { find.on = false; find.offers = []; document.body.classList.remove('sp-finding'); paintFind(); paintBar(); }
  document.addEventListener('click', e => {
    if (!find.on) return;
    const g = e.target.closest('.sp-gap');
    if (!g) return;
    e.stopPropagation(); e.preventDefault();
    if (g.dataset.offer) { find.offers = find.offers.filter(o => `${o.day}|${o.start}` !== g.dataset.offer); paintFind(); return; }
    // время под курсором, с шагом 15 минут, чтобы урок целиком влез в окно
    const r = g.getBoundingClientRect();
    const a = +g.dataset.a, b = +g.dataset.b;
    let at = a + Math.round(((e.clientY - r.top) / PX_PER_HOUR * 60) / 15) * 15;
    at = Math.max(a, Math.min(b - find.dur, at));
    const day = +g.dataset.day;
    if (!find.offers.some(o => o.day === day && o.start === at)) find.offers.push({ day, start: at });
    paintFind();
  }, true);
  document.addEventListener('dblclick', e => {
    if (!find.on) return;
    const g = e.target.closest('.sp-gap');
    if (!g) return;
    e.stopPropagation();
    const r = g.getBoundingClientRect(), a = +g.dataset.a, b = +g.dataset.b;
    const at = Math.max(a, Math.min(b - find.dur, a + Math.round(((e.clientY - r.top) / PX_PER_HOUR * 60) / 15) * 15));
    const day = +g.dataset.day;
    stopFind();
    openPlannerAt(day, at);
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && find.on && !document.getElementById('sp-dlg')) stopFind(); });

  if (typeof findScheduleGap === 'function') {
    window.findScheduleGap = findScheduleGap = function (duration = 60) {   // eslint-disable-line no-global-assign
      find.on = true; find.dur = duration; find.offers = [];
      document.body.classList.add('sp-finding');
      paintFind();
      if (!freeWindows(duration).length) toast(`No ${duration}-minute opening in this week`, 'err');
      const firstGap = document.querySelector('.sp-gap');
      if (firstGap) firstGap.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    };
  }

  const ready = () => { try { paintZone(); markTopUps(); } catch (_) {} };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
