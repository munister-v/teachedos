/* ═══════════════════════════════════════════════════════════════════════════
   Desktop: lessons you can act on right where you see them (15.10.2026).

   The Schedule panel on the desktop was a read-only list. Now:
   - the student's name opens a small card (message, board, move, cancel);
   - each lesson row has 💬 message, ✏️ move and ✕ cancel on hover;
   - "Add +" opens a quick lesson creator (student, day, time, length)
     instead of the full Schedule window, and warns in orange when the time
     clashes with another lesson;
   - a Student pulse card dropped on a day opens the same creator.

   A weekly slot is changed for ONE date the same way the Schedule page marks
   a lesson: an attendance mark "cancelled" on that date (no charge), plus a
   one-off slot for the new time. A weekly slot with no student in the
   Journal has no such mark, so it can only be moved or removed for every
   week, and the popover says so.

   Uses desktop-extras.js: dxJson, dxToast, esc, _sp, spCancelled,
   loadSchedPreview, pulseMessageFor.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.TeachedDesk) return;

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const pad = n => String(n).padStart(2, '0');
  const ymdOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateOf = ymd => { const [y, m, d] = String(ymd).split('-').map(Number); return new Date(y, m - 1, d); };
  const dowOf = ymd => (dateOf(ymd).getDay() + 6) % 7;
  const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const toTime = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const dayLabel = ymd => {
    const d = dateOf(ymd), now = new Date();
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((d - t0) / 864e5);
    return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  // в тексте письма: «today», «tomorrow», «on Fri 17 Oct»
  const dayPhrase = ymd => { const l = dayLabel(ymd); return /^(Today|Tomorrow)$/.test(l) ? l.toLowerCase() : 'on ' + l; };
  const whoOf = s => {
    const g = s.group_name && !/^1\s*:\s*1$/.test(String(s.group_name).trim()) ? s.group_name : '';
    return s.student_name || g || s.title || 'Class';
  };
  const firstName = n => String(n || '').trim().split(/\s+/)[0] || 'there';
  /* групповой урок: решает сервер (is_group - есть состав, или название
     группы, а не имя одного ученика); старый ответ без флага - по названию */
  const isGroup = s => !!s && (s.is_group != null ? !!s.is_group
    : Number(s.member_count) > 0 || (!s.journal_id && !!s.group_name && !/^1\s*:\s*1$/.test(String(s.group_name).trim())));
  const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  const slotDur = s => { const a = toMin(s.start_time); let b = toMin(s.end_time); if (b <= a) b = a + 60; return b - a; };
  const api = (path, opts) => dxJson(path, opts).catch(() => null);
  const refresh = () => { if (typeof loadSchedPreview === 'function') loadSchedPreview(); };

  /* ── popover ─────────────────────────────────────────────────────────── */
  let pop = null, popAnchor = null;
  function close() { if (pop) { pop.remove(); pop = null; } }
  function open(anchor, html, cls) {
    close();
    pop = document.createElement('div');
    pop.className = 'dk-pop' + (cls ? ' ' + cls : '');
    pop.setAttribute('role', 'dialog');
    pop.innerHTML = html;
    document.body.appendChild(pop);
    popAnchor = anchor;
    place();
    pop.addEventListener('mousedown', e => e.stopPropagation());
    pop.addEventListener('click', e => e.stopPropagation());
    return pop;
  }
  // ещё раз после того, как содержимое загрузилось и выросло
  function place() {
    if (!pop) return;
    const anchor = popAnchor && popAnchor.isConnected ? popAnchor : null;
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = r ? r.left + r.width / 2 - w / 2 : (innerWidth - w) / 2;
    let y = r ? r.bottom + 8 : (innerHeight - h) / 2;
    if (r && y + h > innerHeight - 12) y = Math.max(12, r.top - h - 8);
    pop.style.left = Math.max(12, Math.min(x, innerWidth - w - 12)) + 'px';
    pop.style.top = Math.max(12, Math.min(y, innerHeight - h - 12)) + 'px';
  }
  document.addEventListener('mousedown', e => { if (pop && !pop.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) { e.stopPropagation(); close(); } }, true);

  /* ── conflicts ───────────────────────────────────────────────────────── */
  // уроки, которые в этот день пересекаются с [a, b) минут; ignoreId - сам переносимый
  function clashes(ymd, a, b, ignoreId) {
    const dow = dowOf(ymd);
    return (_sp.all || []).filter(s => {
      if (s.id === ignoreId) return false;
      const on = s.specific_date ? String(s.specific_date).slice(0, 10) === ymd : s.recurring !== false && Number(s.day) === dow;
      if (!on || spCancelled(s, ymd)) return false;
      const sa = toMin(s.start_time), sb = sa + slotDur(s);
      return sa < b && a < sb;
    });
  }
  function clashText(list) {
    if (!list.length) return '';
    return `Clashes with ${list.slice(0, 2).map(s => `${whoOf(s)} ${String(s.start_time).slice(0, 5)}`).join(' and ')}${list.length > 2 ? ' and more' : ''}.`;
  }

  // null - не просили; false - не дошло (сервер не шлёт два письма одному ученику за 15 с)
  const toldNote = t => t === true ? ' · told' : t === false ? ' · NOT told, send a message' : '';
  async function tell(journalId, text) {
    if (!journalId || !text) return true;
    const r = await api(`/api/journal/${encodeURIComponent(journalId)}/message`, { method: 'POST', body: { text } });
    return !!(r && r.ok);
  }
  // урок группы: одно сообщение всем, кто в составе
  async function tellSlot(slot, text) {
    if (slot.journal_id) return tell(slot.journal_id, text);
    if (!text || !(Number(slot.member_count) > 0)) return true;
    const r = await api(`/api/schedule/${encodeURIComponent(slot.id)}/message`, { method: 'POST', body: { text } });
    return !!(r && r.ok);
  }
  const canTell = s => !!s.journal_id || Number(s.member_count) > 0;
  const tellLabel = s => s.journal_id ? 'Tell the student' : 'Tell the group';
  /* PATCH /api/schedule/:id переписывает все поля - шлём слот целиком. */
  const slotBody = (s, patch) => ({
    day: s.day, start_time: String(s.start_time).slice(0, 5), end_time: String(s.end_time).slice(0, 5), title: s.title,
    group_name: s.group_name || null, level: s.level || null, room: s.room || null, color: s.color || null,
    recurring: s.recurring !== false, meeting_url: s.meeting_url || null, is_live: !!s.is_live,
    specific_date: s.specific_date ? String(s.specific_date).slice(0, 10) : null, board_id: s.board_id || null, ...patch,
  });

  /* ── student card ────────────────────────────────────────────────────── */
  function person(slot, ymd, anchor) {
    const who = whoOf(slot);
    const p = open(anchor, `<div class="dk-person">
        <span class="dk-av">${slot.student_avatar && !/^https?:/.test(slot.student_avatar) ? esc(slot.student_avatar) : esc(who.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())}</span>
        <div><b>${esc(who)}</b><small>${esc(dayLabel(ymd))} · ${esc(String(slot.start_time).slice(0, 5))} · ${slotDur(slot)} min${slot.level || slot.student_level ? ' · ' + esc(slot.level || slot.student_level) : ''}</small></div></div>
      <div class="dk-list">
        ${slot.journal_id ? '<button type="button" data-k="msg">💬 Message</button>' : ''}
        ${slot.board_id ? '<button type="button" data-k="board">▦ Open the lesson board</button>' : ''}
        ${slot.journal_id ? '<button type="button" data-k="journal">📒 Open in the Journal</button>' : ''}
        <button type="button" data-k="move">✏️ Move this lesson</button>
        <button type="button" data-k="cancel">✕ Cancel this lesson</button>
      </div>`);
    p.addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      const k = b.dataset.k;
      if (k === 'board') { location.href = `board.html?id=${encodeURIComponent(slot.board_id)}`; return; }
      if (k === 'journal') { location.href = 'journal.html'; return; }
      slotAction(k, slot, ymd, anchor);
    });
  }

  function message(slot, ymd) {
    close();
    if (typeof pulseMessageFor !== 'function') return;
    pulseMessageFor({ journal_id: slot.journal_id, name: whoOf(slot), kind: 'lesson',
      text: `Hi ${firstName(whoOf(slot))}! About our lesson ${dayPhrase(ymd)} at ${String(slot.start_time).slice(0, 5)}: ` });
  }

  /* ── group lesson ────────────────────────────────────────────────────── */
  /* The group's name opens its students (GET /api/schedule/:id/members):
     package left, payment, homework, and a message to one or to everyone.
     A group nobody has filled in yet suggests the students already on the
     lesson's board; "Edit students" ticks anyone from the Journal. */
  const pkgChip = m => {
    const left = Number(m.lessons_left) || 0;
    if (m.is_trial && left <= 0) return '<i class="dk-chip is-info">trial</i>';
    return `<i class="dk-chip ${left <= 0 ? 'is-bad' : left <= 2 ? 'is-warn' : 'is-ok'}" title="Lessons left in the package">${left} left</i>`;
  };
  const payChip = m => m.paid_claim_at ? '<i class="dk-chip is-ok" title="The student says they paid">says paid</i>'
    : m.payment_due && m.overdue_days > 0 ? `<i class="dk-chip is-bad" title="Payment was due ${esc(m.payment_due)}">pay ${m.overdue_days} d late</i>` : '';
  const hwChip = m => [
    m.hw_review ? `<i class="dk-chip is-info" title="Handed in, waiting for your review">${m.hw_review} to review</i>` : '',
    m.hw_late ? `<i class="dk-chip is-warn" title="Homework past its due date">${m.hw_late} HW late</i>` : '',
    m.hw_todo - m.hw_late > 0 ? `<i class="dk-chip" title="Homework not handed in yet">${m.hw_todo - m.hw_late} HW to do</i>` : '',
  ].join('');
  const avOf = m => m.avatar && !/^https?:/.test(m.avatar) ? esc(m.avatar) : esc(initials(m.name));

  // карточку группы перерисовываем на месте: состав, правка, ошибка
  function groupHead(slot, ymd, n) {
    return `<div class="dk-person"><span class="dk-av is-group">${esc(initials(whoOf(slot)))}</span>
      <div><b>${esc(whoOf(slot))}</b><small>${esc(dayLabel(ymd))} · ${esc(String(slot.start_time).slice(0, 5))} · ${slotDur(slot)} min${slot.level ? ' · ' + esc(slot.level) : ''}${n != null ? ` · ${n} ${n === 1 ? 'student' : 'students'}` : ''}</small></div></div>`;
  }
  async function group(slot, ymd, anchor) {
    const p = open(anchor, `${groupHead(slot, ymd)}<p class="dk-sub">Loading the group…</p>`, 'is-group');
    const r = await api(`/api/schedule/${encodeURIComponent(slot.id)}/members`);
    if (!pop || pop !== p) return;
    if (!r || !r.ok) { p.innerHTML = `${groupHead(slot, ymd)}<p class="dk-warn">The group could not be loaded. Try again.</p>`; place(); return; }
    groupView(p, slot, ymd, r.data.members || [], r.data.suggested || []);
  }
  function groupView(p, slot, ymd, members, suggested) {
    slot.member_count = members.filter(m => !m.is_slot_student).length;
    const rows = members.map(m => `<div class="dk-mem" data-j="${esc(m.journal_id)}">
        <span class="dk-av sm">${avOf(m)}</span>
        <div class="dk-mem-txt"><b>${esc(m.name)}${m.level ? ` <small>${esc(m.level)}</small>` : ''}</b>
          <span class="dk-chips-s">${pkgChip(m)}${payChip(m)}${hwChip(m)}${!m.registered && !m.email ? '<i class="dk-chip" title="Not on TeachEd and no email in the Journal">can\'t be messaged</i>' : ''}</span></div>
        <button type="button" class="sp-act" data-k="one" title="Message ${esc(m.name)}" aria-label="Message ${esc(m.name)}">💬</button>
      </div>`).join('');
    const sug = suggested.length ? `<div class="dk-sug"><span>On the lesson board: ${suggested.slice(0, 4).map(x => esc(x.name)).join(', ')}${suggested.length > 4 ? ` +${suggested.length - 4}` : ''}</span>
        <button type="button" class="dk-link" data-k="addsug">Add ${suggested.length === 1 ? 'them' : 'all'}</button></div>` : '';
    p.innerHTML = `${groupHead(slot, ymd, members.length)}
      ${members.length ? `<div class="dk-mems">${rows}</div>` : '<p class="dk-sub dk-empty">No students in this group yet. Choose who comes to it, and you will see their package, payment and homework here.</p>'}
      ${sug}
      <div class="dk-list">
        ${members.length ? `<button type="button" data-k="all">💬 Message the group (${members.length})</button>` : ''}
        <button type="button" data-k="edit">👥 ${members.length ? 'Edit students' : 'Choose students'}</button>
        ${slot.board_id ? '<button type="button" data-k="board">▦ Open the lesson board</button>' : ''}
        <button type="button" data-k="move">✏️ Move this lesson</button>
        <button type="button" data-k="cancel">✕ Cancel this lesson</button>
      </div>`;
    place();
    p.onclick = async e => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      const k = b.dataset.k;
      if (k === 'one') {
        const m = members.find(x => x.journal_id === b.closest('[data-j]').dataset.j);
        close();
        if (m && typeof pulseMessageFor === 'function') pulseMessageFor({ journal_id: m.journal_id, name: m.name, kind: 'lesson',
          text: `Hi ${firstName(m.name)}! About our group lesson ${dayPhrase(ymd)} at ${String(slot.start_time).slice(0, 5)}: ` });
        return;
      }
      if (k === 'all') return groupMessage(slot, ymd, members);
      if (k === 'edit') return groupEdit(p, slot, ymd, members, suggested);
      if (k === 'addsug') {
        b.disabled = true;
        const ids = members.filter(m => !m.is_slot_student).map(m => m.journal_id).concat(suggested.map(x => x.journal_id));
        return saveMembers(p, slot, ymd, ids);
      }
      if (k === 'board') { location.href = `board.html?id=${encodeURIComponent(slot.board_id)}`; return; }
      slotAction(k, slot, ymd, document.querySelector(`#fx-ghost-panel .sp-pill[data-slot="${CSS.escape(slot.id)}"]`) || null);
    };
  }
  async function saveMembers(p, slot, ymd, ids) {
    const r = await api(`/api/schedule/${encodeURIComponent(slot.id)}/members`, { method: 'PUT', body: { journal_ids: ids } });
    if (!pop || pop !== p) return;
    if (!r || !r.ok) { dxToast('The group could not be saved. Try again.'); return group(slot, ymd, null); }
    const members = r.data.members || [];
    const sr = await api(`/api/schedule/${encodeURIComponent(slot.id)}/members`);
    groupView(p, slot, ymd, members, sr && sr.ok ? sr.data.suggested || [] : []);
    refresh();
  }
  async function groupEdit(p, slot, ymd, members, suggested) {
    const list = await loadStudents();
    if (!pop || pop !== p) return;
    const own = slot.journal_id || null;
    const inIt = new Set(members.map(m => m.journal_id));
    // пустая группа: заранее отмечены ученики с доски урока
    if (!inIt.size) suggested.forEach(x => inIt.add(x.journal_id));
    const onBoard = new Set(suggested.map(x => x.journal_id));
    // сначала отмеченные, потом группа по формату, потом остальные
    const rank = s => (inIt.has(s.id) ? 0 : onBoard.has(s.id) ? 1 : s.format === 'group' ? 2 : 3);
    const sorted = list.slice().sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
    p.innerHTML = `<form class="dk-form">
        <div class="dk-h">Students in ${esc(whoOf(slot))}</div>
        <input type="search" class="dk-find" placeholder="Find a student" aria-label="Find a student">
        <div class="dk-pick">${sorted.map(s => `<label class="dk-chk" data-n="${esc(String(s.name).toLowerCase())}"><input type="checkbox" name="m" value="${esc(s.id)}"${inIt.has(s.id) ? ' checked' : ''}${s.id === own ? ' checked disabled' : ''}>
          <span>${esc(s.name)}${s.level ? ` <small>${esc(s.level)}</small>` : ''}${onBoard.has(s.id) ? ' <small class="dk-tag">on the board</small>' : s.format === 'group' ? ' <small class="dk-tag">group</small>' : ''}</span></label>`).join('')
          || '<p class="dk-sub">No students in the Journal yet.</p>'}</div>
        <div class="dk-foot"><button type="button" class="dk-ghost" data-x>Back</button><button type="submit" class="dk-go">Save</button></div>
      </form>`;
    p.onclick = null;
    place();
    const f = p.querySelector('form');
    f.querySelector('.dk-find').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      f.querySelectorAll('.dk-pick [data-n]').forEach(l => { l.hidden = !!q && !l.dataset.n.includes(q); });
    });
    f.querySelector('[data-x]').addEventListener('click', () => groupView(p, slot, ymd, members, suggested));
    f.addEventListener('submit', e => {
      e.preventDefault();
      const go = f.querySelector('.dk-go'); go.disabled = true; go.textContent = 'Saving…';
      const ids = [...f.querySelectorAll('input[name=m]:checked:not(:disabled)')].map(i => i.value);
      saveMembers(p, slot, ymd, ids);
    });
    f.querySelector('.dk-find').focus();
  }
  /* One message to the whole group: everyone ticked gets it in their cabinet
     and by email (POST /api/schedule/:id/message). */
  async function groupMessage(slot, ymd, members) {
    close();
    if (!members) {
      const r = await api(`/api/schedule/${encodeURIComponent(slot.id)}/members`);
      members = r && r.ok ? r.data.members || [] : [];
      if (!members.length) { dxToast('No students in this group yet - open the group to choose them'); return; }
    }
    document.getElementById('pulse-msg-ov')?.remove();
    const ov = document.createElement('div');
    ov.id = 'pulse-msg-ov';
    ov.className = 'pm-ov';
    const when = `${dayPhrase(ymd)} at ${String(slot.start_time).slice(0, 5)}`;
    const TPL = [
      ['Reminder', `Hi everyone! A reminder about our group lesson ${when}. See you there!`],
      ['Homework', `Hi everyone! Please finish your homework before our lesson ${when}. Thank you!`],
      ['Payment', `Hi everyone! A quick reminder: if your lesson package is running out, please renew it before our lesson ${when}. Thank you!`],
    ];
    ov.innerHTML = `<div class="pm-sheet" role="dialog" aria-modal="true" aria-labelledby="pm-t">
      <h3 id="pm-t">Message to ${esc(whoOf(slot))}</h3>
      <p>Each student gets it in their TeachEd cabinet and by email, from TeachEd. Untick anyone who should not get it.</p>
      <div class="pm-to">${members.map(m => `<label class="pm-who"><input type="checkbox" value="${esc(m.journal_id)}"${!m.registered && !m.email ? ' disabled title="Not on TeachEd and no email in the Journal"' : ' checked'}> ${esc(m.name)}</label>`).join('')}</div>
      <div class="pm-tpl">${TPL.map(([l], k) => `<button type="button" class="pm-chip" data-tpl="${k}">${esc(l)}</button>`).join('')}</div>
      <textarea id="pm-text" maxlength="1000" rows="5" placeholder="Write your message…">${esc(`Hi everyone! About our lesson ${when}: `)}</textarea>
      <div class="pm-row"><span id="pm-note"></span><button type="button" class="pm-cancel">Cancel</button><button type="button" class="pm-send">Send to all</button></div></div>`;
    document.body.appendChild(ov);
    const ta = ov.querySelector('#pm-text'), note = ov.querySelector('#pm-note'), send = ov.querySelector('.pm-send');
    const picked = () => [...ov.querySelectorAll('.pm-to input:checked')].map(i => i.value);
    const sync = () => { const n = picked().length; send.textContent = n === members.length ? 'Send to all' : `Send to ${n}`; send.disabled = !n; };
    ov.querySelector('.pm-to').addEventListener('change', sync); sync();
    ov.querySelector('.pm-tpl').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (b) { ta.value = TPL[+b.dataset.tpl][1]; ta.focus(); } });
    const shut = () => ov.remove();
    ov.addEventListener('mousedown', e => { if (e.target === ov) shut(); });
    ov.querySelector('.pm-cancel').addEventListener('click', shut);
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });
    send.addEventListener('click', async () => {
      const text = ta.value.trim();
      if (!text) { note.textContent = 'Write a message first.'; return; }
      send.disabled = true; note.textContent = 'Sending…';
      const r = await api(`/api/schedule/${encodeURIComponent(slot.id)}/message`, { method: 'POST', body: { text, journal_ids: picked() } });
      if (r && r.ok) {
        shut();
        const missed = (r.data.results || []).filter(x => !x.cabinet && !x.email).map(x => firstName(x.name));
        dxToast(`Sent to ${r.data.sent} of ${r.data.total}${missed.length ? ` · not reached: ${missed.join(', ')}` : ''}`);
        return;
      }
      sync();
      note.textContent = (r && r.data && r.data.error) || 'It could not be sent. Try again.';
    });
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);
  }

  /* ── move ────────────────────────────────────────────────────────────── */
  function dateOptions(sel) {
    const now = new Date(), out = [];
    for (let k = 0; k < 21; k++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k), v = ymdOf(d);
      out.push(`<option value="${v}"${v === sel ? ' selected' : ''}>${esc(dayLabel(v))}</option>`);
    }
    if (sel && !out.some(o => o.includes(`"${sel}"`))) out.unshift(`<option value="${sel}" selected>${esc(dayLabel(sel))}</option>`);
    return out.join('');
  }
  function move(slot, ymd, anchor) {
    const weekly = !slot.specific_date && slot.recurring !== false;
    const canOnce = weekly && !!slot.journal_id;
    const p = open(anchor, `<form class="dk-form">
        <div class="dk-h">Move ${esc(whoOf(slot))}'s lesson</div>
        <p class="dk-sub">Now: ${esc(dayLabel(ymd))} at ${esc(String(slot.start_time).slice(0, 5))}</p>
        <div class="dk-row"><label>Day<select name="d">${dateOptions(ymd)}</select></label><label>Time<input type="time" name="t" value="${esc(String(slot.start_time).slice(0, 5))}" required></label></div>
        ${weekly ? `<div class="dk-seg">${canOnce ? '<label><input type="radio" name="scope" value="once" checked> Only this time</label>' : ''}<label><input type="radio" name="scope" value="all"${canOnce ? '' : ' checked'}> Every week</label></div>
          ${canOnce ? '' : `<p class="dk-note">${isGroup(slot) ? 'A weekly group lesson moves for every week (one date cannot be moved yet).' : 'This weekly lesson has no student from the Journal, so it moves for every week.'}</p>`}` : ''}
        ${canTell(slot) ? `<label class="dk-chk"><input type="checkbox" name="tell" checked> ${tellLabel(slot)}</label>` : ''}
        <p class="dk-warn" hidden></p>
        <div class="dk-foot"><button type="button" class="dk-ghost" data-x>Cancel</button><button type="submit" class="dk-go">Move</button></div>
      </form>`);
    const f = p.querySelector('form'), warn = p.querySelector('.dk-warn');
    const check = () => {
      const d = f.d.value, a = toMin(f.t.value), list = clashes(d, a, a + slotDur(slot), slot.id);
      warn.hidden = !list.length; warn.textContent = clashText(list);
    };
    f.addEventListener('input', check); f.addEventListener('change', check); check();
    p.querySelector('[data-x]').addEventListener('click', close);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const go = f.querySelector('.dk-go'); go.disabled = true; go.textContent = 'Moving…';
      const nd = f.d.value, a = toMin(f.t.value), b = a + slotDur(slot);
      const scope = f.scope ? (f.querySelector('[name=scope]:checked') || {}).value : 'one';
      let ok = false;
      if (scope === 'once') {
        // эта дата - отменена без списания, новая - разовым уроком
        const m = await api(`/api/journal/${encodeURIComponent(slot.journal_id)}/lesson`, { method: 'POST', body: { date: ymd, slot_id: slot.id, status: 'cancelled', charge: false } });
        const c = m && m.ok && await api('/api/schedule', { method: 'POST', body: { ...slotBody(slot, { day: dowOf(nd), start_time: toTime(a), end_time: toTime(b), recurring: false, specific_date: nd, is_live: false }), journal_id: slot.journal_id } });
        ok = !!(c && c.ok);
      } else {
        const patch = { day: dowOf(nd), start_time: toTime(a), end_time: toTime(b) };
        if (!weekly) patch.specific_date = nd;
        const r = await api(`/api/schedule/${encodeURIComponent(slot.id)}`, { method: 'PATCH', body: slotBody(slot, patch) });
        ok = !!(r && r.ok);
      }
      if (!ok) { go.disabled = false; go.textContent = 'Move'; warn.hidden = false; warn.textContent = 'It could not be moved. Try again.'; return; }
      const when = `${scope === 'all' ? `every ${DAYS[dowOf(nd)]}` : dayLabel(nd)} at ${toTime(a)}`;
      const whenTxt = `${scope === 'all' ? `every ${DAYS[dowOf(nd)]}` : dayPhrase(nd)} at ${toTime(a)}`;
      const told = f.tell && f.tell.checked ? await tellSlot(slot, `Hi ${slot.journal_id ? firstName(whoOf(slot)) : 'everyone'}! Our lesson ${dayPhrase(ymd)} at ${String(slot.start_time).slice(0, 5)} has moved to ${whenTxt}. See you then!`) : null;
      close(); dxToast(`Moved to ${when}${toldNote(told)}`); refresh();
    });
  }

  /* ── cancel ──────────────────────────────────────────────────────────── */
  function cancel(slot, ymd, anchor) {
    const weekly = !slot.specific_date && slot.recurring !== false;
    const once = weekly && !!slot.journal_id;
    const what = !weekly ? `Cancel the lesson ${dayLabel(ymd)} at ${String(slot.start_time).slice(0, 5)}?`
      : once ? `Cancel only ${dayLabel(ymd)} at ${String(slot.start_time).slice(0, 5)}? It is not charged; the weekly lesson stays.`
      : isGroup(slot) ? `One date of a weekly group lesson cannot be cancelled yet. Remove it from every week?`
      : `This weekly lesson has no student from the Journal, so one date cannot be cancelled. Remove it from every week?`;
    const p = open(anchor, `<form class="dk-form">
        <div class="dk-h">${weekly && !once ? 'Remove the weekly lesson' : 'Cancel the lesson'}</div>
        <p class="dk-sub">${esc(whoOf(slot))} · ${esc(what)}</p>
        ${canTell(slot) ? `<label class="dk-chk"><input type="checkbox" name="tell" checked> ${tellLabel(slot)}</label>
          <textarea name="why" rows="2" maxlength="300" placeholder="A few words for ${slot.journal_id ? 'the student' : 'the group'} (optional)"></textarea>` : ''}
        <div class="dk-foot"><button type="button" class="dk-ghost" data-x>Keep it</button><button type="submit" class="dk-go is-danger">${weekly && !once ? 'Remove every week' : 'Cancel lesson'}</button></div>
      </form>`);
    const f = p.querySelector('form');
    p.querySelector('[data-x]').addEventListener('click', close);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const go = f.querySelector('.dk-go'); go.disabled = true;
      const r = once
        ? await api(`/api/journal/${encodeURIComponent(slot.journal_id)}/lesson`, { method: 'POST', body: { date: ymd, slot_id: slot.id, status: 'cancelled', charge: false } })
        : await api(`/api/schedule/${encodeURIComponent(slot.id)}`, { method: 'DELETE' });
      if (!r || !r.ok) { go.disabled = false; dxToast('It could not be cancelled. Try again.'); return; }
      let told = null;
      if (f.tell && f.tell.checked) {
        const why = (f.why && f.why.value.trim()) || '';
        told = await tellSlot(slot, `Hi ${slot.journal_id ? firstName(whoOf(slot)) : 'everyone'}! I have to cancel our lesson ${dayPhrase(ymd)} at ${String(slot.start_time).slice(0, 5)}.${why ? ' ' + why : ''} Sorry about that!`);
      }
      close(); dxToast(`Lesson cancelled${toldNote(told)}`); refresh();
    });
  }

  /* ── quick add ───────────────────────────────────────────────────────── */
  let students = null;
  async function loadStudents() {
    if (students) return students;
    const r = await api('/api/journal');
    students = r && r.ok ? (r.data.students || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))) : [];
    return students;
  }
  async function quickAdd(opts = {}) {
    const anchor = opts.anchor || document.querySelector('#fx-ghost-panel .sp-add');
    const now = new Date();
    const tomorrow = ymdOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const d0 = opts.ymd && opts.ymd >= ymdOf(now) ? opts.ymd : tomorrow;
    const p = open(anchor, `<form class="dk-form dk-add"><div class="dk-h">New lesson</div><p class="dk-sub">Loading students…</p></form>`, 'is-add');
    const list = await loadStudents();
    if (!pop || pop !== p) return;
    const sel = opts.journalId || '';
    p.innerHTML = `<form class="dk-form dk-add">
        <div class="dk-h">New lesson</div>
        <label>Student<select name="j">
          ${list.map(s => `<option value="${esc(s.id)}"${s.id === sel ? ' selected' : ''}>${esc(s.name)}${s.level ? ' · ' + esc(s.level) : ''}</option>`).join('')}
          <option value="">Other / a group…</option></select></label>
        <input name="title" class="dk-other" maxlength="80" placeholder="Group or lesson name" hidden>
        <div class="dk-chips">${[0, 1, 2].map(k => { const v = ymdOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k)); return `<button type="button" data-day="${v}">${esc(dayLabel(v))}</button>`; }).join('')}</div>
        <div class="dk-row"><label>Day<input type="date" name="d" value="${d0}" min="${ymdOf(now)}" required></label>
          <label>Time<input type="time" name="t" value="15:00" required></label>
          <label>Length<select name="len">${[30, 45, 60, 90].map(n => `<option value="${n}"${n === 60 ? ' selected' : ''}>${n} min</option>`).join('')}</select></label></div>
        <label class="dk-chk"><input type="checkbox" name="weekly"> Repeat every week</label>
        <label class="dk-chk dk-tell"><input type="checkbox" name="tell" checked> Tell the student</label>
        <p class="dk-warn" hidden></p>
        <div class="dk-foot"><button type="button" class="dk-link" data-full>Full schedule</button><button type="button" class="dk-ghost" data-x>Cancel</button><button type="submit" class="dk-go">Create</button></div>
      </form>`;
    place();
    const f = p.querySelector('form'), warn = p.querySelector('.dk-warn');
    const sync = () => {
      const other = !f.j.value;
      f.title.hidden = !other;
      p.querySelector('.dk-tell').hidden = other;
      p.querySelectorAll('[data-day]').forEach(b => b.classList.toggle('on', b.dataset.day === f.d.value));
      const a = toMin(f.t.value), b = a + Number(f.len.value);
      let c = clashes(f.d.value, a, b, null);
      // еженедельный урок проверяем и на неделю вперёд - там свои разовые
      if (f.weekly.checked) { const n = dateOf(f.d.value); n.setDate(n.getDate() + 7); c = c.concat(clashes(ymdOf(n), a, b, null).filter(x => !c.includes(x))); }
      warn.hidden = !c.length; warn.textContent = clashText(c);
    };
    f.addEventListener('input', sync); f.addEventListener('change', sync);
    p.addEventListener('click', e => {
      const day = e.target.closest('[data-day]');
      if (day) { f.d.value = day.dataset.day; sync(); return; }
      if (e.target.closest('[data-x]')) close();
      if (e.target.closest('[data-full]')) { close(); if (typeof dockApp === 'function') dockApp('schedule'); }
    });
    sync();
    f.t.focus();
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const st = list.find(s => s.id === f.j.value) || null;
      if (!st && !f.title.value.trim()) { f.title.focus(); return; }
      const go = f.querySelector('.dk-go'); go.disabled = true; go.textContent = 'Creating…';
      const ymd = f.d.value, a = toMin(f.t.value), b = a + Number(f.len.value), weekly = f.weekly.checked;
      const body = {
        day: dowOf(ymd), start_time: toTime(a), end_time: toTime(b),
        title: st ? 'Lesson' : f.title.value.trim(), group_name: st ? null : f.title.value.trim(), level: st ? (st.level || null) : null,
        recurring: weekly, specific_date: weekly ? null : ymd,
        ...(st ? { journal_id: st.id } : {}),
      };
      const r = await api('/api/schedule', { method: 'POST', body });
      if (!r || !r.ok) { go.disabled = false; go.textContent = 'Create'; warn.hidden = false; warn.textContent = (r && r.data && r.data.error) || 'The lesson could not be created. Try again.'; return; }
      const when = `${weekly ? `every ${DAYS[dowOf(ymd)]}` : dayLabel(ymd)} at ${toTime(a)}`;
      const told = st && f.tell.checked ? await tell(st.id, `Hi ${firstName(st.name)}! I have booked our lesson: ${weekly ? `every ${DAYS[dowOf(ymd)]}` : dayPhrase(ymd)} at ${toTime(a)}. See you then!`) : null;
      close(); dxToast(`Lesson added: ${when}${toldNote(told)}`); refresh();
    });
  }

  function slotAction(kind, slot, ymd, anchor) {
    if (kind === 'who') return isGroup(slot) ? group(slot, ymd, anchor) : person(slot, ymd, anchor);
    if (kind === 'msg') return slot.journal_id ? message(slot, ymd) : groupMessage(slot, ymd, null);
    if (kind === 'move') return move(slot, ymd, anchor);
    if (kind === 'cancel') return cancel(slot, ymd, anchor);
  }

  window.TeachedDesk = { slotAction, quickAdd, clashes, close, isGroup };
})();
