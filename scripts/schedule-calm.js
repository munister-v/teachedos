/* Calm schedule (16.10.2026, the owner: "a clean schedule and a time grid").
 *
 * Level 1 - a lesson on the grid is one line, "Iryna • 19:00", with a small
 * corner only for what already happened (held, no-show, cancelled). No
 * balances on the grid: the desktop's Student pulse widget is where money is.
 * A late cancellation that took a lesson off the package says so.
 * Level 2 - hovering a lesson shows 💬 🔗 ✏️; hovering an empty cell shows
 * "+ 15:00" where a click would put the lesson. Clicking a lesson opens a
 * small card: board, message, homework, reschedule, how it went.
 * After every lesson the teacher's break ("10m rest") is drawn - the booking
 * link does not offer that time either (backend/routes/booking.js).
 * The ⋯ menu in the header holds Export, Open board and the break setting.
 *
 * Loaded after schedule-plus.js; wraps buildBlock and renderGrid.
 */
/* global schedule, journalStudent, slotDate, lessonStatus, lessonCharged,
   startSlotDrag, suppressNextSlotClick, openModal, openClassBoard, setLessonOutcome,
   slotMeetingUrl, joinMeeting, toggleLiveSlot, apiFetch, toast, esc, renderGrid,
   buildBlock, currentUser, HOUR_START, HOUR_END, PX_PER_HOUR, dragState,
   timeToMinutes, minutesToTime, snapMinutes, clampSlotStart, gridMinutesFromPointer, DAY_NAMES */
(function () {
  if (typeof buildBlock !== 'function' || typeof renderGrid !== 'function') return;

  const css = document.createElement('style');
  css.id = 'sc-calm-css';
  css.textContent = `
.cls-block.cc{padding:5px 8px;display:flex;flex-direction:column;gap:2px}
.cc-line{display:flex;align-items:baseline;gap:5px;min-width:0;font-size:12.5px;line-height:1.25;font-weight:700;color:#fff}
.cc-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.cc-dot{opacity:.7;flex:none}
.cc-time{flex:none;font-weight:600;opacity:.88;font-variant-numeric:tabular-nums}
.cc-sub{font-size:11px;font-weight:550;color:rgba(255,255,255,.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cls-block.light .cc-line{color:#24282C}.cls-block.light .cc-sub{color:rgba(36,40,44,.7)}
.cls-block.compact .cc-sub{display:none}
.cc-tag{align-self:flex-start;font-size:10.5px;font-weight:750;border-radius:6px;padding:1px 6px;background:rgba(255,255,255,.88);color:#24282C;white-space:nowrap}
.cls-block.st-late{opacity:.9!important;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.26) 0 6px,transparent 6px 12px)!important}
.cls-block.st-late .cc-tag{background:#FFE1D2;color:#B23A0E}
.cls-block.st-cancelled:not(.st-late) .cc-name{text-decoration:line-through}
.cls-block.needs-topup{opacity:1;background-image:none!important;outline:none}
.cb-topup{display:none!important}
.cc-live{position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:50%;background:#FF4E00;animation:pulse-dot 1.2s infinite}
.cc-quick{position:absolute;top:3px;right:3px;display:flex;gap:2px;opacity:0;transform:translateY(-2px);transition:opacity .15s,transform .15s;pointer-events:none}
.cls-block:hover .cc-quick{opacity:1;transform:none;pointer-events:auto}
.cls-block.tiny .cc-quick{top:50%;margin-top:-11px}
.cc-quick button{width:22px;height:22px;border:0;border-radius:7px;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(36,40,44,.18);font-size:12px;line-height:22px;padding:0;cursor:pointer;color:#24282C}
.cc-quick button:hover{background:#fff;transform:scale(1.08)}
.cc-rest{position:absolute;left:6px;right:6px;z-index:1;border-radius:0 0 8px 8px;pointer-events:none;
  background:repeating-linear-gradient(90deg,rgba(36,40,44,.07) 0 4px,transparent 4px 8px);display:flex;align-items:center;justify-content:center;overflow:hidden}
.cc-rest span{font-size:8.5px;line-height:1;font-weight:700;letter-spacing:.02em;color:rgba(36,40,44,.5);white-space:nowrap}
.cc-ghost{position:absolute;left:3px;right:3px;z-index:3;border-radius:10px;border:1.5px dashed rgba(36,40,44,.32);background:rgba(205,246,73,.18);pointer-events:none;padding:4px 8px;font-size:11.5px;font-weight:750;color:#24282C;font-variant-numeric:tabular-nums}
body.sp-finding .cc-ghost,.day-col.drag-over .cc-ghost{display:none}
.cc-card{position:fixed;z-index:9000;width:300px;max-width:calc(100vw - 24px);border-radius:18px;padding:14px;
  background:rgba(255,255,255,.86);backdrop-filter:blur(30px) saturate(1.8);-webkit-backdrop-filter:blur(30px) saturate(1.8);
  border:1px solid rgba(255,255,255,.7);box-shadow:0 18px 50px rgba(36,40,44,.22),0 2px 6px rgba(36,40,44,.08);color:#24282C;font-size:13px;
  animation:cc-in .16s cubic-bezier(.34,1.3,.64,1)}
@keyframes cc-in{from{opacity:0;transform:translateY(4px) scale(.98)}to{opacity:1;transform:none}}
.cc-card h4{margin:0 22px 2px 0;font-size:15px;font-weight:800;line-height:1.25}
.cc-card .cc-when{color:rgba(36,40,44,.66);font-size:12.5px;margin-bottom:10px}
.cc-card .cc-x{position:absolute;top:10px;right:10px;width:24px;height:24px;border:0;border-radius:50%;background:rgba(36,40,44,.07);cursor:pointer;font-size:13px;color:#24282C}
.cc-hw{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;min-height:22px}
.cc-pill{font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 9px;background:rgba(36,40,44,.06)}
.cc-pill.warn{background:#FFE1D2;color:#B23A0E}.cc-pill.ok{background:#E3F6C5;color:#3B5A0A}.cc-pill.rev{background:#FFF1B8;color:#6B5200}
.cc-acts{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.cc-acts button{border:0;border-radius:11px;padding:8px 10px;font:inherit;font-weight:700;font-size:12.5px;cursor:pointer;background:rgba(36,40,44,.06);color:#24282C;text-align:left}
.cc-acts button:hover{background:rgba(36,40,44,.11)}
.cc-acts button.main{background:#CDF649}.cc-acts button.main:hover{background:#c2ec3c}
.cc-out{margin-top:10px;padding-top:10px;border-top:1px solid rgba(36,40,44,.08)}
.cc-out-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:rgba(36,40,44,.5);margin-bottom:6px}
.cc-seg{display:flex;gap:4px}
.cc-seg button{flex:1;border:0;border-radius:9px;padding:6px 4px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;background:rgba(36,40,44,.06);color:#24282C}
.cc-seg button.on{background:#24282C;color:#fff}
.cc-msg{margin-top:10px}
.cc-msg textarea{width:100%;box-sizing:border-box;min-height:64px;border-radius:11px;border:1px solid rgba(36,40,44,.16);padding:8px 10px;font:inherit;font-size:13px;resize:vertical;background:rgba(255,255,255,.8)}
.cc-msg .cc-msg-row{display:flex;justify-content:flex-end;gap:6px;margin-top:6px}
.cc-msg .cc-msg-row button{border:0;border-radius:10px;padding:7px 12px;font:inherit;font-weight:700;font-size:12.5px;cursor:pointer;background:rgba(36,40,44,.06)}
.cc-msg .cc-msg-row button.main{background:#CDF649}
.sc-more{position:relative;display:inline-flex}
.sc-more-btn{width:34px;height:34px;border-radius:50%;border:1px solid rgba(36,40,44,.14);background:rgba(255,255,255,.7);font-size:18px;line-height:1;cursor:pointer;color:#24282C}
.sc-more-btn:hover{background:#fff}
.sc-more-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:9000;min-width:230px;padding:6px;border-radius:16px;
  background:rgba(255,255,255,.9);backdrop-filter:blur(30px) saturate(1.8);-webkit-backdrop-filter:blur(30px) saturate(1.8);
  border:1px solid rgba(255,255,255,.7);box-shadow:0 18px 50px rgba(36,40,44,.2)}
.sc-more-menu[hidden]{display:none}
.sc-more-menu>button{display:block;width:100%;text-align:left;border:0;background:none;border-radius:10px;padding:9px 10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;color:#24282C}
.sc-more-menu>button:hover{background:rgba(36,40,44,.06)}
.sc-more-sep{height:1px;background:rgba(36,40,44,.08);margin:6px 4px}
.sc-more-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:rgba(36,40,44,.5);padding:4px 10px 6px}
.sc-more-seg{display:flex;gap:4px;padding:0 6px 6px}
.sc-more-seg button{flex:1;border:0;border-radius:9px;padding:6px 2px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;background:rgba(36,40,44,.06);color:#24282C}
.sc-more-seg button.on{background:#24282C;color:#fff}
.side-find .sf-row{display:flex;gap:6px}
.side-find .sf-dur{flex:1;min-width:0;border-radius:12px;border:1px solid rgba(36,40,44,.14);padding:9px 10px;font:inherit;font-size:13px;font-weight:600;background:rgba(255,255,255,.75);color:#24282C}
.side-find .sf-go{border:0;border-radius:12px;padding:9px 16px;font:inherit;font-size:13px;font-weight:750;cursor:pointer;background:#24282C;color:#fff}
.side-find .sf-go:hover{background:#000}
.side-find .sf-hint{margin:8px 2px 0;font-size:12px;line-height:1.4;color:rgba(36,40,44,.6)}
`;
  document.head.appendChild(css);

  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const slotById = id => schedule.find(s => String(s.id) === String(id));
  const bufferMin = () => Math.max(0, Math.min(30, Number(currentUser && currentUser.buffer_minutes) || 0));

  function who(slot) {
    const st = slot.journal_id && journalStudent(slot.journal_id);
    return (st && st.name) || slot.group_name || slot.title || 'Lesson';
  }
  function outcome(slot) {
    if (!slot.journal_id) return null;
    const key = `${slot.journal_id}|${slotDate(slot)}`;
    const st = lessonStatus[key];
    if (!st) return null;
    return { status: st, charged: !!(lessonCharged && lessonCharged[key]) };
  }

  /* ── Level 1: the chip ──────────────────────────────────────────────── */
  const origBuild = buildBlock;
  window.buildBlock = buildBlock = function (slot, layout) {   // eslint-disable-line no-global-assign
    const old = origBuild.apply(this, arguments);
    // The same box (position, colour, lane, sizes) without the old content and listeners.
    const el = old.cloneNode(false);
    el.classList.add('cc');
    const name = who(slot);
    const time = String(slot.start_time).slice(0, 5);
    const sub = name !== slot.title && slot.title ? slot.title : [slot.level, slot.room].filter(Boolean).join(' · ');
    const out = outcome(slot);
    const late = out && out.status === 'cancelled' && out.charged;
    el.classList.toggle('st-late', !!late);
    const tag = late ? 'Late cancellation (Charged)' : out && out.status === 'cancelled' ? 'Cancelled' : out && out.status === 'no_show' ? 'No-show' : '';
    el.title = `${name} · ${time}-${String(slot.end_time).slice(0, 5)}${tag ? ' · ' + tag : ''}`;
    /* design spec v1 №3: the class in its pastel with a deeper spine, the
       student's initial on a white disc, the name, "19:00 · B2 · 1:1" under it,
       a white check once the lesson was held */
    const pastel = typeof slotColor === 'function' ? slotColor(slot) : '#E9F5C4';
    el.style.setProperty('--blk', pastel);
    el.style.background = '';
    el.classList.add('light');
    const st = journalStudent && slot.journal_id ? journalStudent(slot.journal_id) : null;
    const face = st && /^https?:\/\//.test(st.avatar || '') ? `<span class="cc-ph" style="background-image:url('${esc(st.avatar)}')"></span>`
      : `<span class="cc-ph">${esc((st && st.avatar && st.avatar.length <= 4 ? st.avatar : name.trim().charAt(0)).toUpperCase())}</span>`;
    const meta = [time, slot.level || (st && st.level) || '', slot.group_name && !/^1\s*:\s*1$/.test(slot.group_name) && slot.group_name !== name ? slot.group_name : (slot.journal_id ? '1:1' : '')].filter(Boolean).join(' · ');
    const held = out && out.status === 'present';
    el.innerHTML = `
      ${slot.is_live ? '<span class="cc-live"></span>' : ''}
      ${face}
      <div class="cc-txt"><b class="cc-name">${esc(name)}</b><span class="cc-meta">${esc(meta)}</span>${tag ? `<span class="cc-tag">${tag}</span>` : ''}</div>
      ${held ? '<span class="cc-check" title="Held"><svg viewBox="0 0 24 24" fill="none" stroke="#0B1026" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg></span>' : ''}
      <div class="cc-quick">
        <button type="button" data-q="msg" title="Message">💬</button>
        ${slot.board_id ? '<button type="button" data-q="board" title="Open board">🔗</button>' : ''}
        <button type="button" data-q="edit" title="Edit or reschedule">✏️</button>
      </div>`;
    el.addEventListener('mousedown', e => { if (e.target.closest('.cc-quick')) return; startSlotDrag(e, slot, el); });
    el.addEventListener('click', e => {
      if (suppressNextSlotClick) { suppressNextSlotClick = false; return; }   // eslint-disable-line no-global-assign
      const q = e.target.closest('[data-q]');
      e.stopPropagation();
      if (q) {
        if (q.dataset.q === 'board') return openClassBoard(slot.board_id);
        if (q.dataset.q === 'edit') { closeCard(); return openModal(slot); }
        return openCard(slot, el, true);
      }
      openCard(slot, el, false);
    });
    return el;
  };

  /* ── rest bands and the empty-cell ghost ────────────────────────────── */
  function paintRest() {
    document.querySelectorAll('.cc-rest').forEach(n => n.remove());
    const buf = bufferMin();
    if (!buf) return;
    document.querySelectorAll('.day-col').forEach(col => {
      const blocks = [...col.querySelectorAll('.cls-block[data-slot-id]')].map(b => slotById(b.dataset.slotId)).filter(Boolean);
      const starts = blocks.map(s => timeToMinutes(s.start_time));
      blocks.forEach(s => {
        const out = outcome(s);
        if (out && out.status === 'cancelled') return;
        const end = timeToMinutes(s.end_time);
        // a lesson right after this one: the break is shorter or not there
        const next = Math.min(end + buf, ...starts.filter(t => t >= end));
        if (next <= end || end <= HOUR_START * 60 || end >= HOUR_END * 60) return;
        const r = document.createElement('div');
        r.className = 'cc-rest';
        r.style.top = ((end - HOUR_START * 60) / 60 * PX_PER_HOUR) + 'px';
        r.style.height = Math.max(6, (next - end) / 60 * PX_PER_HOUR) + 'px';
        r.title = `${buf} min break after the lesson - the booking link keeps it free`;
        if ((next - end) / 60 * PX_PER_HOUR >= 9) r.innerHTML = `<span>${next - end}m rest</span>`;
        col.appendChild(r);
      });
    });
  }

  function bindGhost() {
    document.querySelectorAll('.day-col').forEach(col => {
      if (col.dataset.ccGhost) return;
      col.dataset.ccGhost = '1';
      col.addEventListener('mousemove', e => {
        let g = col.querySelector('.cc-ghost');
        if (e.target.closest('.cls-block,.bk-block,.cc-card') || (dragState && dragState.active) || document.body.classList.contains('sp-finding')) { g && g.remove(); return; }
        const start = clampSlotStart(gridMinutesFromPointer(e.clientY, col), 60);
        if (!g) { g = document.createElement('div'); g.className = 'cc-ghost'; col.appendChild(g); }
        g.style.top = ((start - HOUR_START * 60) / 60 * PX_PER_HOUR) + 'px';
        g.style.height = (PX_PER_HOUR - 2) + 'px';
        g.textContent = '+ ' + minutesToTime(start);
      });
      col.addEventListener('mouseleave', () => col.querySelector('.cc-ghost')?.remove());
    });
  }

  const origRender = renderGrid;
  window.renderGrid = renderGrid = function () {   // eslint-disable-line no-global-assign
    const r = origRender.apply(this, arguments);
    try { paintRest(); bindGhost(); } catch (e) { console.warn('[schedule-calm]', e); }
    return r;
  };

  /* ── the lesson card ────────────────────────────────────────────────── */
  let card = null;
  function closeCard() { card?.remove(); card = null; }
  document.addEventListener('mousedown', e => { if (card && !card.contains(e.target) && !e.target.closest('.cls-block')) closeCard(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCard(); closeMore(); } });

  function place(el, anchor) {
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = a.right + 10;
    if (x + w > innerWidth - 12) x = a.left - w - 10;
    if (x < 12) x = Math.max(12, Math.min(innerWidth - w - 12, a.left));
    let y = Math.max(12, Math.min(innerHeight - h - 12, a.top));
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }

  function openCard(slot, anchor, focusMsg) {
    closeCard();
    const date = slotDate(slot);
    const d = new Date(date + 'T00:00:00');
    const when = `${DAY_NAMES ? DAY_NAMES[slot.day] : d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })} · ${String(slot.start_time).slice(0, 5)}-${String(slot.end_time).slice(0, 5)}${slot.specific_date ? '' : ' · weekly'}`;
    const out = outcome(slot);
    const meet = typeof slotMeetingUrl === 'function' ? slotMeetingUrl(slot) : '';
    const past = new Date(`${date}T${String(slot.start_time).slice(0, 5)}:00`) <= new Date();
    card = document.createElement('div');
    card.className = 'cc-card';
    card.setAttribute('role', 'dialog');
    card.innerHTML = `
      <button type="button" class="cc-x" aria-label="Close">✕</button>
      <h4>${esc(who(slot))}</h4>
      <div class="cc-when">${esc(when)}${slot.group_name && who(slot) !== slot.group_name ? ' · ' + esc(slot.group_name) : ''}</div>
      <div class="cc-hw" data-hw><span class="cc-pill">Homework…</span></div>
      <div class="cc-acts">
        ${slot.board_id ? '<button type="button" class="main" data-a="board">🔗 Open board</button>' : '<button type="button" class="main" data-a="edit">✏️ Add a board</button>'}
        <button type="button" data-a="msg">💬 Message</button>
        ${meet || slot.is_live ? `<button type="button" data-a="live">${slot.is_live ? '⏹ End live' : meet ? '🎥 Join call' : 'Go live'}</button>` : ''}
        <button type="button" data-a="edit">↻ Reschedule</button>
        <button type="button" data-a="hw">📝 Homework</button>
      </div>
      ${slot.journal_id ? `<div class="cc-out">
        <div class="cc-out-label">${past ? 'How did it go' : 'Mark this lesson'}</div>
        <div class="cc-seg">
          <button type="button" data-o="present" class="${out && out.status === 'present' ? 'on' : ''}">Held</button>
          <button type="button" data-o="no_show" class="${out && out.status === 'no_show' ? 'on' : ''}">No-show</button>
          <button type="button" data-o="cancelled" class="${out && out.status === 'cancelled' ? 'on' : ''}">Cancelled</button>
        </div></div>` : ''}
      <div class="cc-msg" hidden>
        <textarea placeholder="Message to ${esc(who(slot))}…"></textarea>
        <div class="cc-msg-row"><button type="button" data-m="cancel">Cancel</button><button type="button" class="main" data-m="send">Send</button></div>
      </div>`;
    document.body.appendChild(card);
    place(card, anchor);
    const self = card;

    const msgBox = card.querySelector('.cc-msg');
    const showMsg = () => { msgBox.hidden = false; place(self, anchor); msgBox.querySelector('textarea').focus(); };
    if (focusMsg) showMsg();

    card.addEventListener('click', async e => {
      if (e.target.closest('.cc-x')) return closeCard();
      const a = e.target.closest('[data-a]')?.dataset.a;
      const o = e.target.closest('[data-o]')?.dataset.o;
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (a === 'board') return openClassBoard(slot.board_id);
      if (a === 'edit') { closeCard(); return openModal(slot); }
      if (a === 'hw') return void (location.href = 'homework.html');
      if (a === 'live') { closeCard(); return meet && !slot.is_live ? joinMeeting(meet) : toggleLiveSlot(slot.id, !slot.is_live); }
      if (a === 'msg') return showMsg();
      if (m === 'cancel') { msgBox.hidden = true; return; }
      if (m === 'send') {
        const ta = msgBox.querySelector('textarea');
        const text = ta.value.trim();
        if (!text) return ta.focus();
        e.target.disabled = true;
        try {
          const r = await apiFetch(`/api/schedule/${slot.id}/message`, { method: 'POST', body: JSON.stringify({ text }) });
          toast(r && r.sent > 1 ? `Sent to ${r.sent} students` : 'Message sent', 'ok');
          closeCard();
        } catch (err) { toast(err.message || 'Could not send', 'err'); e.target.disabled = false; }
        return;
      }
      if (o) {
        const next = out && out.status === o ? 'reset' : o;
        try { await setLessonOutcome(slot, date, next); closeCard(); }
        catch (err) { toast(err.message || 'Could not save', 'err'); }
      }
    });

    // Homework at a glance: what the student (or the group) still has to do.
    apiFetch(`/api/schedule/${slot.id}/members`).then(r => {
      if (self !== card) return;
      const ms = (r.members || []).filter(x => !x.is_slot_student || slot.journal_id);
      const todo = ms.reduce((n, x) => n + (x.hw_todo || 0), 0);
      const late = ms.reduce((n, x) => n + (x.hw_late || 0), 0);
      const rev = ms.reduce((n, x) => n + (x.hw_review || 0), 0);
      const box = self.querySelector('[data-hw]');
      const pills = [];
      if (ms.length > 1) pills.push(`<span class="cc-pill">${ms.length} students</span>`);
      if (rev) pills.push(`<span class="cc-pill rev">${rev} to review</span>`);
      if (late) pills.push(`<span class="cc-pill warn">${late} overdue</span>`);
      if (todo - late > 0) pills.push(`<span class="cc-pill">${todo - late} in progress</span>`);
      if (!pills.length || (ms.length > 1 && pills.length === 1)) pills.push(`<span class="cc-pill ok">${ms.length ? 'Homework done' : 'No homework'}</span>`);
      box.innerHTML = pills.join('');
    }).catch(() => { if (self === card) self.querySelector('[data-hw]').innerHTML = ''; });
  }

  /* ── the ⋯ menu ─────────────────────────────────────────────────────── */
  const moreBtn = document.getElementById('sc-more-btn');
  const moreMenu = document.getElementById('sc-more-menu');
  function closeMore() { if (moreMenu) { moreMenu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); } }
  function paintBuffer() {
    const b = bufferMin();
    moreMenu?.querySelectorAll('[data-b]').forEach(x => x.classList.toggle('on', Number(x.dataset.b) === b));
  }
  if (moreBtn && moreMenu) {
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      const open = moreMenu.hidden;
      moreMenu.hidden = !open;
      moreBtn.setAttribute('aria-expanded', String(open));
      if (open) paintBuffer();
    });
    document.addEventListener('click', e => { if (!e.target.closest('.sc-more')) closeMore(); });
    moreMenu.addEventListener('click', async e => {
      const b = e.target.closest('[data-b]');
      if (!b) { if (e.target.closest('button[role=menuitem]')) closeMore(); return; }
      const v = Number(b.dataset.b);
      const prev = bufferMin();
      currentUser.buffer_minutes = v; paintBuffer(); renderGrid();
      try {
        const r = await apiFetch('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ buffer_minutes: v }) });
        if (r && r.user) Object.assign(currentUser, { buffer_minutes: r.user.buffer_minutes });
        toast(v ? `${v} min break after each lesson - the booking link keeps it free` : 'No break between lessons', 'ok');
      } catch (err) {
        currentUser.buffer_minutes = prev; paintBuffer(); renderGrid();
        toast(err.message || 'Could not save', 'err');
      }
    });
  }

  try { renderGrid(); } catch (_) {}
})();
