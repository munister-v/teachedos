/* Attendance & balance: one calendar for the student and for the teacher.

   The student opens it from the lesson balance in the cabinet; the teacher
   from a student's card. It shows what is left, the lessons that took place
   and the ones that are planned, and why the balance is what it is (the
   history under the calendar).

   The teacher clicks a day and picks what happened - two clicks, and the
   balance follows (POST /api/journal/:id/lesson):
     Lesson held −1 · Held, free 0 · Missed −1 · Cancelled 0 · Late cancel −1 · Clear
   Past lessons from the schedule that nobody marked are outlined in orange.
   "+N lessons" tops the package up; "Adjust" corrects the balance by one with
   a reason (POST /api/journal/:id/adjust).

   window.TeachedLessonCal.open({ api, journalId?, teacher?, onChange? })
     api       - (path, opts) => fetch Response (apiFetch on the page)
     journalId - the teacher's view of one student; without it, the student's own */
(function () {
  'use strict';
  if (window.TeachedLessonCal) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CSS = `
.lc-ov{position:fixed;inset:0;z-index:98500;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(16,18,22,.62);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-family:var(--font,-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif)}
.lc{width:min(440px,100%);max-height:calc(100vh - 36px);overflow:auto;border-radius:26px;padding:22px;background:rgba(30,32,38,.92);border:1px solid rgba(255,255,255,.14);color:#F4F4F8;box-shadow:0 40px 100px rgba(0,0,0,.5)}
.lc-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}
.lc-head b{display:block;font-size:20px;letter-spacing:-.01em}
.lc-head span{display:block;margin-top:3px;font-size:13px;color:#C9CAD4}
.lc-x{margin-left:auto;flex:none;width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;font-size:15px;cursor:pointer}
.lc-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:-4px 0 14px}
.lc-tabs button{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font:650 13px inherit;font-family:inherit;cursor:pointer}
.lc-tabs button.on{background:#CDF649;border-color:#CDF649;color:#24282C}
.lc-bal{display:flex;align-items:center;flex-wrap:wrap;gap:10px 12px;padding:14px 16px;border-radius:18px;background:rgba(205,246,73,.1);border:1px solid rgba(205,246,73,.45);margin-bottom:16px}
.lc-bal small{display:block;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9CAD4}
.lc-bal b{display:block;margin-top:2px;font-size:24px;letter-spacing:-.02em;color:#CDF649}
.lc-acts{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.lc-top{flex:none;display:inline-flex;align-items:center;min-height:40px;padding:0 16px;border-radius:999px;border:0;background:#CDF649;color:#24282C;font-weight:800;font-size:13.5px;font-family:inherit;text-decoration:none;cursor:pointer}
.lc-top.ghost{background:transparent;color:#F4F4F8;border:1px solid rgba(255,255,255,.3)}
.lc-adj{flex-basis:100%;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.lc-adj[hidden]{display:none}
.lc-adj button{min-width:44px;min-height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font:800 15px inherit;font-family:inherit;cursor:pointer}
.lc-adj input{flex:1;min-width:120px;min-height:38px;padding:0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.2);color:#fff;font:500 13px inherit;font-family:inherit}
.lc-note{margin-left:auto;max-width:150px;font-size:12px;line-height:1.35;color:#C9CAD4;text-align:right}
.lc-cal{padding:16px;border-radius:20px;background:rgba(0,0,0,.22)}
.lc-nav{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.lc-nav b{flex:1;font-size:16px}
.lc-nav button{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.1);color:#fff;font-size:16px;cursor:pointer;font-family:inherit}
.lc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.lc-wd{text-align:center;font-size:11px;font-weight:700;color:#A9ABB8;padding:4px 0}
.lc-d{position:relative;aspect-ratio:1;min-height:38px;display:grid;place-items:center;border-radius:12px;border:1.5px solid transparent;background:none;color:#E6E7EE;font-weight:650;font-size:14px;font-family:inherit;padding:0}
.lc-d.out{color:#6D6F7C}
.lc-d.today{background:rgba(255,255,255,.14)}
.lc-d.done{background:#CDF649;color:#24282C;font-weight:800}
.lc-d.free::after,.lc-d.late::after{content:'';position:absolute;top:4px;right:4px;width:7px;height:7px;border-radius:50%;background:#24282C}
.lc-d.late::after{background:#FF8C3A}
.lc-d.miss{background:rgba(255,140,58,.28);color:#FFD2B0}
.lc-d.off{background:rgba(255,255,255,.07);color:#A9ABB8;text-decoration:line-through}
.lc-d.plan{border:1.5px dashed #CDF649;color:#CDF649}
.lc-d.todo{border:1.5px dashed #FF8C3A;color:#FFD2B0}
.lc-d.picked{outline:2px solid #fff;outline-offset:1px}
button.lc-d{cursor:pointer}
button.lc-d:hover{border-color:rgba(255,255,255,.5)}
.lc-key{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 14px;margin-top:14px;font-size:12.5px;color:#C9CAD4}
.lc-key i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px}
.lc-foot{margin:14px 0 0;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);font-size:12.5px;line-height:1.45;color:#C9CAD4;text-align:center}
.lc-foot.warn{background:rgba(255,140,58,.16);color:#FFD2B0}
.lc-empty{padding:26px 10px;text-align:center;font-size:14px;line-height:1.5;color:#C9CAD4}
.lc-menu{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}
.lc-menu button{min-height:44px;padding:4px 8px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font-weight:650;font-size:12.5px;line-height:1.2;font-family:inherit;cursor:pointer}
.lc-menu button small{display:block;font:700 11px 'SF Mono',ui-monospace,Menlo,monospace;color:#A9ABB8;margin-top:2px}
.lc-menu button.on{background:#CDF649;border-color:#CDF649;color:#24282C}
.lc-menu button.on small{color:#3F4A0C}
.lc-hist{margin-top:14px}
.lc-hist summary{cursor:pointer;font-size:13px;font-weight:700;color:#C9CAD4;padding:6px 2px}
.lc-hist ol{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}
.lc-hist li{display:flex;gap:10px;align-items:baseline;padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.05);font-size:12.5px;color:#E6E7EE}
.lc-hist li span{flex:1;min-width:0}
.lc-hist li em{font-style:normal;color:#A9ABB8}
.lc-hist li b{font:800 13px 'SF Mono',ui-monospace,Menlo,monospace;color:#CDF649}
.lc-hist li b.neg{color:#FFB37A}
.lc :is(.lc-x,.lc-top,.lc-nav button,button.lc-d,.lc-menu button,.lc-tabs button,.lc-adj button,.lc-hist summary):focus-visible{outline:2px solid #fff;outline-offset:2px}
@media (max-width:420px){.lc{padding:16px}.lc-menu{grid-template-columns:repeat(2,1fr)}}
`;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dayName = key => new Date(key + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  /* What the teacher can mark a day as, and what it does to the balance. */
  const MARKS = [
    { k: 'held', status: 'present', charge: true, label: 'Lesson held', fx: '−1' },
    { k: 'free', status: 'present', charge: false, label: 'Held, free', fx: '0' },
    { k: 'miss', status: 'no_show', charge: true, label: 'Missed', fx: '−1' },
    { k: 'off', status: 'cancelled', charge: false, label: 'Cancelled', fx: '0' },
    { k: 'late', status: 'cancelled', charge: true, label: 'Late cancel', fx: '−1' },
    { k: 'reset', status: 'reset', charge: null, label: 'Clear', fx: '' },
  ];
  const markOf = l => !l ? null : l.status === 'present' ? (l.charged ? 'held' : 'free') : l.status === 'no_show' ? 'miss' : l.status === 'cancelled' ? (l.charged ? 'late' : 'off') : null;
  const LOOK = {
    held: ['done', 'lesson held'], free: ['done free', 'lesson held, not charged'], miss: ['miss', 'missed, counted'],
    off: ['off', 'cancelled'], late: ['off late', 'late cancellation, counted'],
  };
  const REASON = { lesson: 'Lesson', refund: 'Returned', pack: 'Package added', manual: 'Correction' };
  /* The ledger keeps the status the day got; with the sign it says what happened. */
  const NOTE = {
    lesson: { present: 'held', no_show: 'missed', cancelled: 'late cancellation' },
    refund: { present: 'made free', no_show: 'missed, not counted', cancelled: 'cancelled', 'mark cleared': 'mark cleared' },
  };

  async function open(opts = {}) {
    const api = opts.api;
    if (!api) return;
    if (!document.getElementById('lc-css')) { const st = document.createElement('style'); st.id = 'lc-css'; st.textContent = CSS; document.head.appendChild(st); }
    document.querySelector('.lc-ov')?.remove();
    const ov = document.createElement('div');
    ov.className = 'lc-ov';
    ov.innerHTML = `<div class="lc" role="dialog" aria-modal="true" aria-label="Attendance and balance"><div class="lc-empty">Opening the calendar…</div></div>`;
    document.body.appendChild(ov);
    const box = ov.querySelector('.lc');
    const prevFocus = document.activeElement;
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (prevFocus && document.contains(prevFocus)) prevFocus.focus(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    document.addEventListener('keydown', onKey);

    const teacher = !!opts.teacher && !!opts.journalId;
    const now = new Date();
    const today = iso(now.getFullYear(), now.getMonth(), now.getDate());
    let cals = [], at = 0, view = { y: now.getFullYear(), m: now.getMonth() }, picked = null, changed = false, adjOpen = false, warn = '';

    async function load() {
      const r = await api(teacher ? `/api/journal/${encodeURIComponent(opts.journalId)}/calendar` : '/api/journal/me/calendar');
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not load');
      cals = Array.isArray(d.calendars) && d.calendars.length ? d.calendars : d.calendar ? [d.calendar] : [];
      if (at >= cals.length) at = 0;
    }
    async function post(path, body) {
      const r = await api(path, { method: 'POST', body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'failed');
      changed = true;
      return d;
    }
    function history(cal) {
      const rows = (cal.history || []).slice(0, 12);
      if (!rows.length) return '';
      return `<details class="lc-hist"><summary>Balance history</summary><ol>${rows.map(h => {
        const what = h.reason === 'lesson' || h.reason === 'refund'
          ? `${REASON[h.reason]}${h.lesson_date ? ' ' + dayName(h.lesson_date) : ''}${h.note && NOTE[h.reason][h.note] ? ` · ${NOTE[h.reason][h.note]}` : ''}`
          : `${REASON[h.reason] || h.reason}${h.note && h.reason !== 'lesson' ? ` · ${h.note}` : ''}`;
        return `<li><em>${esc(dayName(String(h.created_at).slice(0, 10)))}</em><span>${esc(what)}</span><b class="${h.delta < 0 ? 'neg' : ''}">${h.delta > 0 ? '+' : ''}${h.delta}</b><em>→ ${h.balance_after}</em></li>`;
      }).join('')}</ol></details>`;
    }
    function paint() {
      const cal = cals[at];
      if (!cal) {
        box.innerHTML = `<div class="lc-head"><div><b>Attendance & balance</b></div><button type="button" class="lc-x" aria-label="Close">✕</button></div>
          <div class="lc-empty">Your teacher does not track a lesson package for you yet. When they do, your lessons will be marked here.</div>`;
        box.querySelector('.lc-x').addEventListener('click', close);
        return;
      }
      const byDate = new Map(cal.lessons.map(l => [l.date, l]));
      const plan = new Set(cal.scheduled || []);
      const todo = new Set(teacher ? cal.unmarked || [] : []);
      const first = new Date(view.y, view.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(view.y, view.m + 1, 0).getDate();
      const cells = [];
      const prevDays = new Date(view.y, view.m, 0).getDate();
      for (let k = lead - 1; k >= 0; k--) cells.push(`<span class="lc-d out">${prevDays - k}</span>`);
      for (let d = 1; d <= days; d++) {
        const key = iso(view.y, view.m, d), mk = markOf(byDate.get(key));
        const [cls, label] = mk ? LOOK[mk] : plan.has(key) ? ['plan', 'planned'] : todo.has(key) ? ['todo', 'planned, not marked yet'] : ['', ''];
        const tag = teacher ? 'button' : 'span';
        cells.push(`<${tag}${teacher ? ' type="button"' : ''} class="lc-d ${cls}${key === today ? ' today' : ''}${key === picked ? ' picked' : ''}" data-d="${key}"${label ? ` title="${label}" aria-label="${d} ${MONTHS[view.m]}, ${label}"` : ''}>${d}</${tag}>`);
      }
      const who = teacher ? `${esc(cal.name)}${cal.level ? ' · ' + esc(cal.level) : ''}` : (cal.teacher_name ? `with ${esc(cal.teacher_name)}` : '');
      const left = cal.lessons_left;
      const action = teacher
        ? `<div class="lc-acts"><button type="button" class="lc-top" data-pack>+${cal.pack_size} lessons</button><button type="button" class="lc-top ghost" data-adj aria-expanded="${adjOpen}">Adjust</button></div>
           <div class="lc-adj"${adjOpen ? '' : ' hidden'}><button type="button" data-delta="-1" aria-label="Take one lesson off">−1</button><button type="button" data-delta="1" aria-label="Add one lesson">+1</button><input type="text" maxlength="120" placeholder="Why? (optional, the student sees it)" aria-label="Reason for the correction"></div>`
        : cal.booking_token ? `<a class="lc-top" href="book.html?t=${encodeURIComponent(cal.booking_token)}" style="margin-left:auto">Book a lesson</a>`
        : `<span class="lc-note">Ask ${esc(cal.teacher_name || 'your teacher')} to renew</span>`;
      const marks = cal.lessons.map(markOf);
      const key = [['#CDF649', 'Completed', true], ['', 'Scheduled', true], ['rgba(255,140,58,.6)', 'Missed', marks.includes('miss')],
        ['#24282C;box-shadow:0 0 0 2px #CDF649', 'Free', marks.includes('free')], ['#FF8C3A', 'Late cancel', marks.includes('late')], ['', 'Not marked', todo.size > 0]]
        .filter(x => x[2]).map(([c, l]) => `<span><i style="${l === 'Scheduled' ? 'border:1.5px dashed #CDF649' : l === 'Not marked' ? 'border:1.5px dashed #FF8C3A' : 'background:' + c}"></i>${l}</span>`).join('');
      const pickedMark = picked ? markOf(byDate.get(picked)) : null;
      const unmarkedPast = [...todo].length;
      const foot = !teacher ? ''
        : warn ? `<p class="lc-foot warn">${esc(warn)}</p>`
        : picked ? `<p class="lc-foot">${esc(dayName(picked))}: what happened? Held and missed lessons and late cancellations take one off the balance; a free lesson and a cancellation do not.</p>`
        : unmarkedPast ? `<p class="lc-foot warn">${unmarkedPast} past lesson${unmarkedPast === 1 ? ' is' : 's are'} not marked yet (orange outline). Click a day to mark it - the balance follows.</p>`
        : '<p class="lc-foot">Click a day to mark a lesson or change it. The balance follows.</p>';
      box.innerHTML = `<div class="lc-head"><div><b>Attendance & balance</b>${who ? `<span>${who}</span>` : ''}</div><button type="button" class="lc-x" aria-label="Close">✕</button></div>
        ${!teacher && cals.length > 1 ? `<div class="lc-tabs" role="tablist">${cals.map((c, k) => `<button type="button" role="tab" aria-selected="${k === at}" class="${k === at ? 'on' : ''}" data-tab="${k}">${esc(c.teacher_name || 'Teacher ' + (k + 1))}</button>`).join('')}</div>` : ''}
        <div class="lc-bal"><div><small>Remaining balance</small><b>${left} lesson${left === 1 ? '' : 's'}</b></div>${action}</div>
        <div class="lc-cal">
          <div class="lc-nav"><b>${MONTHS[view.m]} ${view.y}</b><button type="button" data-nav="-1" aria-label="Previous month">‹</button><button type="button" data-nav="1" aria-label="Next month">›</button></div>
          <div class="lc-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(w => `<span class="lc-wd">${w}</span>`).join('')}${cells.join('')}</div>
          <div class="lc-key">${key}</div>
          ${picked ? `<div class="lc-menu" data-for="${picked}">${MARKS.filter(m => m.k !== 'reset' || pickedMark).map(m => `<button type="button" data-mark="${m.k}"${pickedMark === m.k ? ' class="on"' : ''}>${m.label}${m.fx ? `<small>${m.fx}</small>` : ''}</button>`).join('')}</div>` : ''}
        </div>
        ${foot}${history(cal)}`;
      box.querySelector('.lc-x').addEventListener('click', close);
      box.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { at = Number(b.dataset.tab); paint(); }));
      box.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
        const d = new Date(view.y, view.m + Number(b.dataset.nav), 1); view = { y: d.getFullYear(), m: d.getMonth() }; picked = null; warn = ''; paint();
      }));
      if (!teacher) return;
      box.querySelectorAll('button.lc-d').forEach(b => b.addEventListener('click', () => { picked = picked === b.dataset.d ? null : b.dataset.d; warn = ''; paint(); }));
      box.querySelectorAll('.lc-menu [data-mark]').forEach(b => b.addEventListener('click', async () => {
        const m = MARKS.find(x => x.k === b.dataset.mark);
        b.disabled = true;
        try {
          const body = { date: picked, status: m.status };
          if (m.charge != null) body.charge = m.charge;
          const d = await post(`/api/journal/${encodeURIComponent(opts.journalId)}/lesson`, body);
          warn = d.uncharged ? `The balance was already 0, so ${dayName(picked)} was marked without taking a lesson off. Add a package to count it.` : '';
          picked = null;
          await load(); paint();
          if (opts.onChange) opts.onChange(cals[at]);
        } catch (_) { b.disabled = false; }
      }));
      const pack = box.querySelector('[data-pack]');
      if (pack) pack.addEventListener('click', async () => {
        const raw = prompt(`How many lessons to add to ${cal.name}'s balance?`, String(cal.pack_size));
        if (raw == null) return;
        const n = parseInt(raw, 10);
        if (!(n > 0)) return;
        pack.disabled = true;
        try {
          await post(`/api/journal/${encodeURIComponent(opts.journalId)}/pack`, { lessons: n });
          await load(); paint();
          if (opts.onChange) opts.onChange(cals[at]);
        } catch (_) { pack.disabled = false; }
      });
      box.querySelector('[data-adj]')?.addEventListener('click', () => { adjOpen = !adjOpen; paint(); if (adjOpen) box.querySelector('.lc-adj input')?.focus(); });
      box.querySelectorAll('[data-delta]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          await post(`/api/journal/${encodeURIComponent(opts.journalId)}/adjust`, { delta: Number(b.dataset.delta), note: box.querySelector('.lc-adj input').value.trim() });
          await load(); paint();
          if (opts.onChange) opts.onChange(cals[at]);
        } catch (_) { b.disabled = false; }
      }));
    }
    try { await load(); paint(); }
    catch (e) { box.innerHTML = `<div class="lc-empty">${esc(e.message)}</div>`; }
    return { close, changed: () => changed };
  }

  window.TeachedLessonCal = { open };
})();
