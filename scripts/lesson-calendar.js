/* Attendance & balance: one calendar for the student and for the teacher.

   The student opens it from the lesson balance in the cabinet; the teacher
   from a student's card. It shows what is left, the lessons that took place
   and the ones that are planned. The teacher can also click a day to mark a
   lesson as done or take the mark back (POST /api/journal/:id/lesson).

   window.TeachedLessonCal.open({ api, journalId?, teacher?, onChange? })
     api       - (path, opts) => fetch Response (apiFetch on the page)
     journalId - the teacher's view of one student; without it, the student's own */
(function () {
  'use strict';
  if (window.TeachedLessonCal) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CSS = `
.lc-ov{position:fixed;inset:0;z-index:98500;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(16,18,22,.62);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-family:var(--font,-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif)}
.lc{width:min(420px,100%);max-height:calc(100vh - 36px);overflow:auto;border-radius:26px;padding:22px;background:rgba(30,32,38,.92);border:1px solid rgba(255,255,255,.14);color:#F4F4F8;box-shadow:0 40px 100px rgba(0,0,0,.5)}
.lc-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}
.lc-head b{display:block;font-size:20px;letter-spacing:-.01em}
.lc-head span{display:block;margin-top:3px;font-size:13px;color:#C9CAD4}
.lc-x{margin-left:auto;flex:none;width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;font-size:15px;cursor:pointer}
.lc-bal{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:18px;background:rgba(205,246,73,.1);border:1px solid rgba(205,246,73,.45);margin-bottom:16px}
.lc-bal small{display:block;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C9CAD4}
.lc-bal b{display:block;margin-top:2px;font-size:24px;letter-spacing:-.02em;color:#CDF649}
.lc-top{margin-left:auto;flex:none;display:inline-flex;align-items:center;min-height:40px;padding:0 16px;border-radius:999px;border:0;background:#CDF649;color:#24282C;font-weight:800;font-size:13.5px;font-family:inherit;text-decoration:none;cursor:pointer}
.lc-note{margin-left:auto;max-width:150px;font-size:12px;line-height:1.35;color:#C9CAD4;text-align:right}
.lc-cal{padding:16px;border-radius:20px;background:rgba(0,0,0,.22)}
.lc-nav{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.lc-nav b{flex:1;font-size:16px}
.lc-nav button{width:36px;height:36px;border:0;border-radius:10px;background:rgba(255,255,255,.1);color:#fff;font-size:16px;cursor:pointer;font-family:inherit}
.lc-nav button:disabled{opacity:.3;cursor:default}
.lc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.lc-wd{text-align:center;font-size:11px;font-weight:700;color:#A9ABB8;padding:4px 0}
.lc-d{aspect-ratio:1;min-height:38px;display:grid;place-items:center;border-radius:12px;border:1.5px solid transparent;background:none;color:#E6E7EE;font-weight:650;font-size:14px;font-family:inherit;padding:0}
.lc-d.out{color:#6D6F7C}
.lc-d.today{background:rgba(255,255,255,.14)}
.lc-d.done{background:#CDF649;color:#24282C;font-weight:800}
.lc-d.miss{background:rgba(255,140,58,.28);color:#FFD2B0}
.lc-d.off{background:rgba(255,255,255,.07);color:#A9ABB8;text-decoration:line-through}
.lc-d.plan{border:1.5px dashed #CDF649;color:#CDF649}
button.lc-d{cursor:pointer}
button.lc-d:hover{border-color:rgba(255,255,255,.5)}
.lc-key{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin-top:14px;font-size:12.5px;color:#C9CAD4}
.lc-key i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px}
.lc-foot{margin:14px 0 0;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);font-size:12.5px;line-height:1.45;color:#C9CAD4;text-align:center}
.lc-empty{padding:26px 10px;text-align:center;font-size:14px;line-height:1.5;color:#C9CAD4}
.lc-menu{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
.lc-menu button{min-height:38px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font-weight:650;font-size:13px;font-family:inherit;cursor:pointer}
.lc-menu button.on{background:#CDF649;border-color:#CDF649;color:#24282C}
.lc :is(.lc-x,.lc-top,.lc-nav button,button.lc-d,.lc-menu button):focus-visible{outline:2px solid #fff;outline-offset:2px}
`;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

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
    let cal = null, view = { y: now.getFullYear(), m: now.getMonth() }, picked = null, changed = false;

    async function load() {
      const r = await api(teacher ? `/api/journal/${encodeURIComponent(opts.journalId)}/calendar` : '/api/journal/me/calendar');
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not load');
      cal = d.calendar;
    }
    function paint() {
      if (!cal) {
        box.innerHTML = `<div class="lc-head"><div><b>Attendance & balance</b></div><button type="button" class="lc-x" aria-label="Close">✕</button></div>
          <div class="lc-empty">Your teacher does not track a lesson package for you yet. When they do, your lessons will be marked here.</div>`;
        box.querySelector('.lc-x').addEventListener('click', close);
        return;
      }
      const byDate = new Map(cal.lessons.map(l => [l.date, l.status]));
      const plan = new Set(cal.scheduled);
      const first = new Date(view.y, view.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(view.y, view.m + 1, 0).getDate();
      const cells = [];
      const prevDays = new Date(view.y, view.m, 0).getDate();
      for (let k = lead - 1; k >= 0; k--) cells.push(`<span class="lc-d out">${prevDays - k}</span>`);
      for (let d = 1; d <= days; d++) {
        const key = iso(view.y, view.m, d), st = byDate.get(key);
        const cls = st === 'present' ? 'done' : st === 'no_show' ? 'miss' : st === 'cancelled' ? 'off' : plan.has(key) ? 'plan' : '';
        const label = st === 'present' ? 'lesson held' : st === 'no_show' ? 'missed, counted' : st === 'cancelled' ? 'cancelled' : plan.has(key) ? 'planned' : '';
        const tag = teacher ? 'button' : 'span';
        cells.push(`<${tag}${teacher ? ' type="button"' : ''} class="lc-d ${cls}${key === today ? ' today' : ''}" data-d="${key}"${label ? ` title="${label}" aria-label="${d} ${MONTHS[view.m]}, ${label}"` : ''}>${d}</${tag}>`);
      }
      const who = teacher ? `${esc(cal.name)}${cal.level ? ' · ' + esc(cal.level) : ''}` : (cal.teacher_name ? `with ${esc(cal.teacher_name)}` : '');
      const left = cal.lessons_left;
      const action = teacher
        ? `<button type="button" class="lc-top" data-pack>+${cal.pack_size} lessons</button>`
        : cal.booking_token ? `<a class="lc-top" href="book.html?t=${encodeURIComponent(cal.booking_token)}">Book a lesson</a>`
        : `<span class="lc-note">Ask ${esc(cal.teacher_name || 'your teacher')} to renew</span>`;
      box.innerHTML = `<div class="lc-head"><div><b>Attendance & balance</b>${who ? `<span>${who}</span>` : ''}</div><button type="button" class="lc-x" aria-label="Close">✕</button></div>
        <div class="lc-bal"><div><small>Remaining balance</small><b>${left} lesson${left === 1 ? '' : 's'}</b></div>${action}</div>
        <div class="lc-cal">
          <div class="lc-nav"><b>${MONTHS[view.m]} ${view.y}</b><button type="button" data-nav="-1" aria-label="Previous month">‹</button><button type="button" data-nav="1" aria-label="Next month">›</button></div>
          <div class="lc-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(w => `<span class="lc-wd">${w}</span>`).join('')}${cells.join('')}</div>
          <div class="lc-key"><span><i style="background:#CDF649"></i>Completed</span><span><i style="border:1.5px dashed #CDF649"></i>Scheduled</span>${cal.lessons.some(l => l.status === 'no_show') ? '<span><i style="background:rgba(255,140,58,.6)"></i>Missed</span>' : ''}</div>
          ${picked ? `<div class="lc-menu" data-for="${picked}">${[['present', 'Lesson held'], ['no_show', 'Missed, counted'], ['cancelled', 'Cancelled'], ['reset', 'Clear']].map(([k, l]) => `<button type="button" data-st="${k}"${byDate.get(picked) === k ? ' class="on"' : ''}>${l}</button>`).join('')}</div>` : ''}
        </div>
        ${teacher ? `<p class="lc-foot">${picked ? `Marking ${new Date(picked + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}. A held or missed lesson takes one off the balance; cancelled does not.` : 'Click a day to mark a lesson or change it. The balance follows.'}</p>` : ''}`;
      box.querySelector('.lc-x').addEventListener('click', close);
      box.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
        const d = new Date(view.y, view.m + Number(b.dataset.nav), 1); view = { y: d.getFullYear(), m: d.getMonth() }; picked = null; paint();
      }));
      if (!teacher) return;
      box.querySelectorAll('button.lc-d').forEach(b => b.addEventListener('click', () => { picked = picked === b.dataset.d ? null : b.dataset.d; paint(); }));
      box.querySelectorAll('.lc-menu [data-st]').forEach(b => b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const r = await api(`/api/journal/${encodeURIComponent(opts.journalId)}/lesson`, { method: 'POST', body: { date: picked, status: b.dataset.st } });
          if (!r.ok) throw new Error('failed');
          changed = true; picked = null;
          await load(); paint();
          if (opts.onChange) opts.onChange(cal);
        } catch (_) { b.disabled = false; }
      }));
      const pack = box.querySelector('[data-pack]');
      if (pack) pack.addEventListener('click', async () => {
        if (!confirm(`Add ${cal.pack_size} lessons to ${cal.name}'s balance?`)) return;
        pack.disabled = true;
        try {
          const r = await api(`/api/journal/${encodeURIComponent(opts.journalId)}/pack`, { method: 'POST', body: {} });
          if (!r.ok) throw new Error('failed');
          changed = true;
          await load(); paint();
          if (opts.onChange) opts.onChange(cal);
        } catch (_) { pack.disabled = false; }
      });
    }
    try { await load(); paint(); }
    catch (e) { box.innerHTML = `<div class="lc-empty">${esc(e.message)}</div>`; }
    return { close, changed: () => changed };
  }

  window.TeachedLessonCal = { open };
})();
