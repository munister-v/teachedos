/* ═══════════════════════════════════════════════════════════════════════════
   schedule-booking.js — свободные часы и личное время в расписании (24.09.2026).

   Учитель кликает по пустому месту недели (или тянет вниз по колонке, чтобы
   выделить несколько часов) и выбирает: добавить урок, открыть время для
   бронирования или закрыть как личное. Открытые часы ученики видят по одной
   ссылке (book.html) и бронируют сами - урок появляется здесь же.
   Блоки еженедельные: день 0=Пн, время учителя. Данные - /api/booking/*.
   Подключается после основного скрипта schedule.html и пользуется его
   apiFetch, getWeekDates, gridMinutesFromPointer, openPlannerAt, toast.
   ═══════════════════════════════════════════════════════════════════════════ */
let BK_BLOCKS = [];
const BK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const bkMin = t => { const [h, m] = String(t).split(':'); return +h * 60 + +m; };
const bkFmt = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const bkEsc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function bkLoad() {
  try { const d = await apiFetch('/api/booking/blocks'); BK_BLOCKS = d.blocks || []; }
  catch (_) { BK_BLOCKS = []; }
  bkRender();
}

/* Рисует блоки под уроками в каждой колонке недели. */
function bkRender() {
  document.querySelectorAll('.day-col .bk-block').forEach(el => el.remove());
  BK_BLOCKS.forEach(b => {
    const col = document.getElementById(`day-${b.day}`);
    if (!col) return;
    const s = bkMin(b.start_time), e = bkMin(b.end_time);
    const top = (s - HOUR_START * 60) / 60 * PX_PER_HOUR;
    const h = Math.max(14, (e - s) / 60 * PX_PER_HOUR);
    const el = document.createElement('div');
    el.className = `bk-block ${b.kind}`;
    el.style.top = top + 'px';
    el.style.height = h + 'px';
    el.dataset.id = b.id;
    el.title = b.kind === 'open' ? `Open for booking ${b.start_time}-${b.end_time}` : `Busy ${b.start_time}-${b.end_time}${b.label ? ' · ' + b.label : ''}`;
    el.innerHTML = `<span class="bk-tag">${b.kind === 'open' ? 'Open for booking' : 'Busy' + (b.label ? ' · ' + bkEsc(b.label) : '')}</span>`;
    el.addEventListener('click', ev => {
      ev.stopPropagation();
      bkMenu({ day: b.day, start: s, end: e, block: b }, ev.clientX, ev.clientY);
    });
    col.insertBefore(el, col.firstChild);
  });
}

/* renderGrid стирает содержимое колонок - блоки дорисовываются после него. */
(function hookRender() {
  if (typeof renderGrid !== 'function') return;
  const orig = renderGrid;
  renderGrid = function () { orig.apply(this, arguments); bkRender(); };
})();

/* ── Выделение диапазона: тянуть вниз по пустой колонке ─────────────── */
const bkSel = { on: false, col: null, day: 0, a: 0, b: 0, y0: 0, moved: false, el: null, justEnded: false };
document.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const col = e.target.closest?.('.day-col');
  if (!col || e.target.closest('.cls-block, .bk-block, .bk-menu')) return;
  bkSel.on = true; bkSel.moved = false; bkSel.col = col; bkSel.day = Number(col.dataset.day);
  bkSel.y0 = e.clientY;
  bkSel.a = bkSel.b = Math.floor(gridMinutesFromPointer(e.clientY, col) / 30) * 30;
});
document.addEventListener('mousemove', e => {
  if (!bkSel.on) return;
  if (!bkSel.moved && Math.abs(e.clientY - bkSel.y0) < 8) return;
  bkSel.moved = true;
  bkSel.b = Math.floor(gridMinutesFromPointer(e.clientY, bkSel.col) / 30) * 30;
  const lo = Math.max(HOUR_START * 60, Math.min(bkSel.a, bkSel.b));
  const hi = Math.min(HOUR_END * 60, Math.max(bkSel.a, bkSel.b) + 30);
  if (!bkSel.el) { bkSel.el = document.createElement('div'); bkSel.el.className = 'bk-select'; bkSel.col.appendChild(bkSel.el); }
  bkSel.el.style.top = (lo - HOUR_START * 60) / 60 * PX_PER_HOUR + 'px';
  bkSel.el.style.height = (hi - lo) / 60 * PX_PER_HOUR + 'px';
  bkSel.el.textContent = `${bkFmt(lo)} - ${bkFmt(hi)}`;
});
document.addEventListener('mouseup', e => {
  if (!bkSel.on) return;
  bkSel.on = false;
  if (!bkSel.moved) return;
  const lo = Math.max(HOUR_START * 60, Math.min(bkSel.a, bkSel.b));
  const hi = Math.min(HOUR_END * 60, Math.max(bkSel.a, bkSel.b) + 30);
  bkSel.justEnded = true; setTimeout(() => { bkSel.justEnded = false; }, 50);
  bkMenu({ day: bkSel.day, start: lo, end: hi }, e.clientX, e.clientY);
});

/* Клик по пустому месту (из bindGridClicks): меню вместо сразу диалога. */
function bookingGridClick(e, col, day, startMin) {
  if (bkSel.justEnded) return true;
  const s = Math.floor(startMin / 60) * 60;
  bkMenu({ day, start: s, end: Math.min(HOUR_END * 60, s + 60) }, e.clientX, e.clientY);
  return true;
}

/* ── Меню действий ─────────────────────────────────────────────────── */
function bkClose() {
  document.querySelector('.bk-menu')?.remove();
  document.querySelectorAll('.bk-select').forEach(el => el.remove());
  bkSel.el = null;
}
function bkMenu(r, x, y) {
  bkClose();
  if (r.start < HOUR_START * 60 || r.end <= r.start) return;
  if (!r.block && bkSel.moved === false) {
    // одиночный клик - подсветить час, о котором спрашиваем
    const col = document.getElementById(`day-${r.day}`);
    if (col) {
      const el = document.createElement('div'); el.className = 'bk-select';
      el.style.top = (r.start - HOUR_START * 60) / 60 * PX_PER_HOUR + 'px';
      el.style.height = (r.end - r.start) / 60 * PX_PER_HOUR + 'px';
      el.textContent = `${bkFmt(r.start)} - ${bkFmt(r.end)}`;
      col.appendChild(el);
    }
  }
  const overlapping = BK_BLOCKS.some(b => b.day === r.day && bkMin(b.start_time) < r.end && bkMin(b.end_time) > r.start);
  const m = document.createElement('div');
  m.className = 'bk-menu';
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-label', 'Time actions');
  m.innerHTML = `
    <div class="bk-menu-h">${BK_DAYS[r.day]} · ${bkFmt(r.start)} - ${bkFmt(r.end)}</div>
    <div class="bk-menu-acts">
      <button type="button" class="bk-act add" data-a="add"><span class="bk-dot add"></span>Add a class</button>
      <button type="button" class="bk-act open" data-a="open"><span class="bk-dot open"></span>Open for booking</button>
      <button type="button" class="bk-act busy" data-a="busy"><span class="bk-dot busy"></span>Mark as busy</button>
      ${overlapping ? '<button type="button" class="bk-act clear" data-a="clear"><span class="bk-dot clear"></span>Clear this time</button>' : ''}
    </div>
    <label class="bk-label" hidden><span>What is it? (optional)</span>
      <input type="text" maxlength="80" placeholder="Lunch, walk, another job…">
      <button type="button" class="bk-label-go">Mark as busy</button>
    </label>
    <div class="bk-menu-note">Open hours repeat every week. Students see them through your booking link.</div>`;
  document.body.appendChild(m);
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px';
  m.style.top = Math.max(8, Math.min(innerHeight - h - 8, y + 12)) + 'px';
  const range = { day: r.day, start_time: bkFmt(r.start), end_time: bkFmt(r.end) };
  const save = async (kind, label) => {
    try {
      await apiFetch('/api/booking/blocks', { method: 'POST', body: JSON.stringify({ ...range, kind, label }) });
      bkClose(); await bkLoad();
      toast(kind === 'open' ? 'Open for booking' : 'Marked as busy', 'ok');
    } catch (err) { toast(err.message || 'Could not save', 'err'); }
  };
  m.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'add') { bkClose(); openPlannerAt(r.day, r.start); return; }
    if (a === 'open') return save('open');
    if (a === 'busy') {
      const lab = m.querySelector('.bk-label'); lab.hidden = false;
      m.querySelector('.bk-menu-acts').hidden = true;
      lab.querySelector('input').focus();
      return;
    }
    if (a === 'clear') {
      try { await apiFetch('/api/booking/blocks/clear', { method: 'POST', body: JSON.stringify(range) }); bkClose(); await bkLoad(); toast('Cleared', 'ok'); }
      catch (err) { toast(err.message || 'Could not clear', 'err'); }
    }
  });
  m.querySelector('.bk-label-go').addEventListener('click', () => save('busy', m.querySelector('.bk-label input').value.trim()));
  m.querySelector('.bk-label input').addEventListener('keydown', ev => { if (ev.key === 'Enter') m.querySelector('.bk-label-go').click(); });
  m.querySelector('.bk-act')?.focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') bkClose(); });
document.addEventListener('mousedown', e => { if (!e.target.closest('.bk-menu') && document.querySelector('.bk-menu') && !e.target.closest('.day-col')) bkClose(); });

/* ── Ссылка для бронирования ───────────────────────────────────────── */
async function bkShare(rotate) {
  let d;
  try { d = await apiFetch(rotate ? '/api/booking/link/rotate' : '/api/booking/link', rotate ? { method: 'POST' } : {}); }
  catch (err) { toast(err.message || 'Could not get your link', 'err'); return; }
  document.getElementById('bk-share')?.remove();
  const ov = document.createElement('div');
  ov.id = 'bk-share'; ov.className = 'bk-share-ov';
  const msg = `Book a lesson with me here: ${d.url}`;
  ov.innerHTML = `
    <div class="bk-share" role="dialog" aria-modal="true" aria-labelledby="bk-share-h">
      <button type="button" class="bk-x" aria-label="Close">×</button>
      <h2 id="bk-share-h">Share your booking link</h2>
      <p>Students open it without an account, see only your open hours that are still free, and book one. The lesson appears in your schedule, and you get a notification.</p>
      ${d.openBlocks ? '' : '<p class="bk-warn">You have no open hours yet. Click an empty time in your week and choose “Open for booking”.</p>'}
      <div class="bk-url"><input readonly value="${bkEsc(d.url)}" aria-label="Booking link"><button type="button" class="bk-copy">Copy</button></div>
      <div class="bk-send">
        <a class="bk-send-btn tg" href="https://t.me/share/url?url=${encodeURIComponent(d.url)}&text=${encodeURIComponent('Book a lesson with me')}" target="_blank" rel="noopener">Telegram</a>
        <a class="bk-send-btn wa" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="bk-send-btn" href="${bkEsc(d.url)}" target="_blank" rel="noopener">Preview</a>
      </div>
      <div class="bk-foot">${d.minutes}-minute lessons · <button type="button" class="bk-rotate">New link</button> <span>(the old one stops working)</span></div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('.bk-x').onclick = close;
  ov.querySelector('.bk-copy').onclick = async ev => {
    try { await navigator.clipboard.writeText(d.url); ev.target.textContent = 'Copied ✓'; }
    catch { ov.querySelector('.bk-url input').select(); }
  };
  ov.querySelector('.bk-rotate').onclick = () => { if (confirm('Make a new link? The old one will stop working.')) bkShare(true); };
  ov.querySelector('.bk-copy').focus();
}

bkLoad();
