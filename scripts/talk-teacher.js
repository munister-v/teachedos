/* Talk Time, the teacher's side (Speaking Tutor ТЗ §§5, 11, 27, 28): one window per student.
   Assign in one action (1/2/3 sessions, an optional theme, a deadline), a drill from the recurring mistakes, the report that
   arrives by itself, the live analytics (what holds in speech - every mark with a fragment to hear), errands for Tich, what you
   taught (the program checks come from it), the voice switch for a minor. Nothing here shows a student's raw thread. */
(function () {
  'use strict';
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const token = () => { try { return localStorage.getItem('teachedos_token'); } catch (_) { return null; } };
  /* its own small client: the page it opens on may not carry app-core.js */
  const base = () => (window.TeachEdApp && window.TeachEdApp.API_BASE) || window.TEACHED_API_BASE || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:4000' : location.origin);
  const raw = (path, opts) => fetch(base() + path, { method: (opts && opts.method) || 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: opts && opts.body ? JSON.stringify(opts.body) : undefined });
  const call = (path, opts) => raw(path, opts).then(r => r.json().catch(() => ({})).then(d => ({ ok: r.ok, status: r.status, d })));

  const STYLE = '.tt-ov{position:fixed;inset:0;z-index:9400;background:rgba(11,16,38,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:18px}' +
    '.tt-win{background:#F6F6EF;color:#0B1026;width:min(820px,100%);max-height:92vh;overflow:auto;border-radius:26px;padding:24px 26px 26px;font-family:Manrope,sans-serif;position:relative}' +
    '.tt-win h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-.4px}.tt-sub{font-size:13px;font-weight:600;color:#8A8672;margin:3px 0 14px}' +
    '.tt-x{position:absolute;top:16px;right:18px;border:0;background:rgba(11,16,38,.07);width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:15px}' +
    '.tt-sec{background:#fff;border-radius:20px;padding:16px 18px;margin-top:12px;box-shadow:0 2px 10px rgba(11,16,38,.06)}' +
    '.tt-sec h3{margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#8A8672}' +
    '.tt-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.tt-note{font-size:12.5px;font-weight:600;color:#55523f;line-height:1.45}' +
    '.tt-chip{border:1.5px solid rgba(11,16,38,.16);background:#fff;border-radius:999px;padding:8px 15px;font:800 13.5px Manrope,sans-serif;cursor:pointer;color:#0B1026}' +
    '.tt-chip.on{background:#0B1026;color:#D3F26A;border-color:#0B1026}' +
    '.tt-in{flex:1;min-width:160px;background:#F6F6EF;border:0;border-radius:999px;padding:10px 15px;font:600 13.5px Manrope,sans-serif;color:#0B1026}' +
    '.tt-btn{border:2px solid #0B1026;background:#D3F26A;border-radius:999px;padding:9px 18px;font:800 13.5px Manrope,sans-serif;cursor:pointer;color:#0B1026}' +
    '.tt-btn.ghost{background:#fff}.tt-btn:disabled{opacity:.5;cursor:default}' +
    '.tt-pill{font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#ECEADB;color:#55523f;white-space:nowrap}.tt-pill.ok{background:#DFF5B8;color:#3E5A00}.tt-pill.bad{background:#F8DBDB;color:#8C1D40}' +
    '.tt-topic{border-top:1.5px solid #EFEEDF;padding:10px 0}.tt-topic:first-of-type{border-top:0}.tt-trow{display:flex;align-items:center;gap:10px}.tt-trow b{font-size:14.5px}.tt-trow .tt-pill{margin-left:auto}' +
    '.tt-play{display:inline-flex;align-items:center;gap:6px;border:0;background:#F6F6EF;border-radius:999px;padding:6px 12px;font:700 12.5px Manrope,sans-serif;cursor:pointer;margin:6px 6px 0 0;color:#0B1026}' +
    '.tt-said{color:#8C1D40}.tt-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.tt-w{font-size:12px;font-weight:700;background:#F6F6EF;border:1.5px solid #E4E2D2;padding:4px 10px;border-radius:999px}.tt-w.on{background:#DFF5B8;border-color:#B9DE7E}.tt-w.wait{border-style:dashed;color:#8A8672;background:#fff}' +
    '.tt-bars{display:flex;align-items:flex-end;gap:12px;height:84px;margin:8px 0 4px}.tt-bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;font-weight:800;color:#55523f}.tt-bar i{display:block;width:100%;border-radius:8px 8px 4px 4px;background:linear-gradient(180deg,#E6FC95,#D3F26A);border:1.5px solid #0B1026}' +
    '.tt-prep{border:2px solid #2DD4BF;background:#F2FBF9;border-radius:16px;padding:12px 14px;margin-top:10px;font-size:13px;font-weight:600;line-height:1.5}.tt-prep b{display:block;font-size:11px;letter-spacing:.6px;margin-bottom:4px}' +
    '.tt-task{display:flex;gap:9px;align-items:flex-start;padding:8px 0;border-top:1.5px solid #EFEEDF;font-size:13.5px}.tt-task .tt-pill{margin-left:auto}' +
    '.tt-flag{border:0;background:none;color:#8A8672;font:700 11.5px Manrope,sans-serif;cursor:pointer;text-decoration:underline;margin-left:6px}' +
    '.tt-err{color:#8C1D40;font-size:13px;font-weight:700;margin-top:8px}.tt-ok{color:#3E5A00;font-size:13px;font-weight:700;margin-top:8px}' +
    '.tt-pick{display:grid;gap:8px;margin-top:12px}.tt-pick button{text-align:left;background:#fff;border:1.5px solid rgba(11,16,38,.12);border-radius:14px;padding:12px 14px;font:800 14px Manrope,sans-serif;cursor:pointer;color:#0B1026}' +
    '@media(max-width:700px){.tt-win{padding:20px 16px;border-radius:20px}}';
  function style() { if (document.getElementById('ttStyle')) return; const st = document.createElement('style'); st.id = 'ttStyle'; st.textContent = STYLE; document.head.appendChild(st); }

  /* the teacher hears a fragment: the server checks it is their student's, the player gets it with the token */
  const urls = new Map(); let player = null;
  async function play(id) {
    try {
      if (player) { player.pause(); player = null; }
      if (!urls.has(id)) { const r = await raw('/api/speaking-tutor/audio/' + encodeURIComponent(id)); if (!r.ok) return; urls.set(id, URL.createObjectURL(await r.blob())); }
      player = new Audio(urls.get(id)); await player.play();
    } catch (_) { /* nothing to hear */ }
  }

  async function open(studentId, name) {
    style();
    const ov = document.createElement('div'); ov.className = 'tt-ov';
    ov.innerHTML = '<div class="tt-win" role="dialog" aria-modal="true" aria-label="Talk Time"><button class="tt-x" aria-label="Close">✕</button><h2>Talk Time · ' + esc(String(name || 'Student').split(' ')[0]) + '</h2><div class="tt-sub">Speaking practice with Tich between lessons</div><div id="ttBody"><div class="tt-note">Loading…</div></div></div>';
    document.body.appendChild(ov);
    const close = () => ov.remove(); ov.querySelector('.tt-x').onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
    document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); } });
    const body = ov.querySelector('#ttBody');
    const [rep, an] = await Promise.all([call('/api/speaking-tutor/students/' + encodeURIComponent(studentId) + '/report'), call('/api/speaking-tutor/students/' + encodeURIComponent(studentId) + '/analytics')]);
    if (!rep.ok || !an.ok) { body.innerHTML = '<div class="tt-err">' + esc((rep.d && rep.d.error) || (an.d && an.d.error) || 'Could not load') + '</div>'; return; }
    draw(body, studentId, rep.d, an.d);
  }

  function draw(body, sid, rep, an) {
    const st = { sessions: 3 };
    const hasRecurring = rep.top_mistakes.length > 0;
    body.innerHTML =
      '<div class="tt-sec"><h3>THIS WEEK</h3><div class="tt-row"><b style="font-size:18px">' + esc(rep.line) + '</b></div><div class="tt-note" style="margin-top:4px">' + rep.speech_minutes + ' min of speech' + (rep.new_fixed ? ' · ' + rep.new_fixed + ' mistake' + (rep.new_fixed === 1 ? '' : 's') + ' fixed' : '') + '</div>' +
      (rep.top_mistakes.length ? '<div style="margin-top:10px">' + rep.top_mistakes.map(m => '<div class="tt-note"><b>' + esc(m.construct) + '</b> · ' + m.occurrences + '×' + (m.weight === 'blocking' ? ' · breaks the meaning' : '') + ' — <span class="tt-said">' + esc(m.said) + '</span> → <b>' + esc(m.better) + '</b></div>').join('') + '</div>' : '<div class="tt-note" style="margin-top:8px">No recurring slips yet.</div>') +
      (rep.assignments.length ? '<div style="margin-top:10px">' + rep.assignments.slice(0, 4).map(a => '<div class="tt-task"><span>' + a.sessions + (a.sessions === 1 ? ' session' : ' sessions') + (a.theme ? ' · ' + esc(a.theme) : '') + (a.mode === 'drill' ? ' · drill' : '') + '</span><span class="tt-pill ' + (a.status === 'done' ? 'ok' : '') + '">' + (a.status === 'done' ? 'DONE' : a.done + ' of ' + a.sessions) + '</span></div>').join('') + '</div>' : '') +
      (rep.recordings.length ? '<div style="margin-top:10px"><div class="tt-note"><b>Assigned work</b> — listen if you want to; nothing to check.</div>' + rep.recordings.slice(0, 6).map(r => '<div><button class="tt-play" data-play="' + esc(r.audio_id) + '">▶ ' + esc(String(r.transcript || '').split(' / ').pop().slice(0, 70)) + '</button><button class="tt-flag" data-flag="' + esc(r.id) + '" title="The better version was not right">Not that correction</button></div>').join('') + '</div>' : '') + '</div>' +

      '<div class="tt-sec"><h3>GIVE SPEAKING PRACTICE</h3><div class="tt-row" id="ttSess">' + [1, 2, 3].map(n => '<button class="tt-chip' + (n === 3 ? ' on' : '') + '" data-n="' + n + '">' + n + (n === 1 ? ' session' : ' sessions') + '</button>').join('') +
      '<input class="tt-in" id="ttTheme" maxlength="80" placeholder="Theme (optional) — empty means “by my mistakes”"><input class="tt-in" id="ttDue" type="date" style="flex:0 0 auto;min-width:0" aria-label="Deadline"></div>' +
      '<div class="tt-row" style="margin-top:10px"><button class="tt-btn" id="ttAssign">Assign</button>' + (hasRecurring ? '<button class="tt-btn ghost" id="ttDrill">Make a drill from these mistakes</button>' : '') + '</div><div id="ttMsg"></div></div>' +

      '<div class="tt-sec"><h3>WHAT HOLDS IN SPEECH</h3><div class="tt-note">What Tich heard in conversations between lessons. Every mark has a fragment you can hear. The student sees none of this.</div>' +
      (an.topics.length ? an.topics.map(t => '<div class="tt-topic"><div class="tt-trow"><b>' + esc(t.topic) + '</b><span class="tt-note">lesson ' + esc(t.lesson_date) + '</span><span class="tt-pill ' + (t.status === 'holds' ? 'ok' : t.status === 'crumbling' ? 'bad' : '') + '">' + ({ holds: 'HOLDS IN SPEECH', crumbling: 'CRUMBLING', unchecked: 'NOT CHECKED', inProgress: 'BEING CHECKED' }[t.status]) + '</span></div>' +
        t.correct.map(u => u.audio_id ? '<button class="tt-play" data-play="' + esc(u.audio_id) + '">▶ “' + esc(u.text) + '” · ' + esc(u.date) + '</button>' : '').join('') +
        t.errors.map(u => '<div class="tt-note"><span class="tt-said">“' + esc(u.said) + '”</span> → <b>' + esc(u.better) + '</b> ' + (u.audio_id ? '<button class="tt-play" data-play="' + esc(u.audio_id) + '">▶ listen</button>' : '') + '</div>').join('') + '</div>').join('') : '<div class="tt-note" style="margin-top:8px">Add what you taught below — Tich will check it in ordinary conversations after 1 and 4 days.</div>') +
      '<div class="tt-row" style="margin-top:10px"><input class="tt-in" id="ttTopic" maxlength="80" placeholder="What you taught: Past Continuous"><button class="tt-btn ghost" id="ttAddTopic">Add</button></div>' +
      (an.words.activated.length || an.words.pending.length ? '<div style="margin-top:12px"><div class="tt-note"><b>Words: from “know” to “say”</b></div><div class="tt-chips">' + an.words.activated.map(w => '<span class="tt-w on">' + esc(w) + ' ✓ says</span>').join('') + an.words.pending.map(w => '<span class="tt-w wait">' + esc(w) + ' · waits for speech</span>').join('') + '</div></div>' : '') +
      (an.fluency.length ? '<div style="margin-top:12px"><div class="tt-note"><b>Fluency</b> — words per minute, by week</div><div class="tt-bars">' + (() => { const mx = Math.max(...an.fluency.map(f => f.wordsPerMinute), 1); return an.fluency.slice(-8).map(f => '<div class="tt-bar"><span>' + f.wordsPerMinute + '</span><i style="height:' + (8 + f.wordsPerMinute / mx * 54) + 'px"></i><span>' + esc(f.weekOf.slice(5)) + '</span></div>').join(''); })() + '</div></div>' : '') +
      (an.prepare ? '<div class="tt-prep"><b>TICH · FOR THE NEXT LESSON</b>' + esc(an.prepare.text) + '</div>' : '') + '</div>' +

      '<div class="tt-sec"><h3>ERRANDS FOR TICH</h3><div class="tt-note">He weaves them into ordinary conversations — the student does not know it is a check.</div>' +
      an.tasks.map(t => '<div class="tt-task"><span>' + esc(t.instruction) + '</span><span class="tt-pill ' + (t.status === 'done' ? 'ok' : '') + '">' + ({ queued: 'QUEUED', inProgress: 'IN PROGRESS', done: 'DONE', noContact: 'NOT YET HEARD' }[t.status] || esc(t.status)) + '</span></div>').join('') +
      '<div class="tt-row" style="margin-top:10px"><input class="tt-in" id="ttTask" maxlength="300" placeholder="Ask Tich to check or ask something…"><button class="tt-btn" id="ttGive">Give errand</button></div></div>' +

      (an.student.minor ? '<div class="tt-sec"><h3>VOICE PRACTICE</h3><div class="tt-note">This student is a minor. Voice practice is ' + (an.student.voice_ok === true || an.student.consent ? 'on' : 'off until the parent’s consent is recorded') + '. Typing always works.</div><div class="tt-row" style="margin-top:8px"><button class="tt-btn ghost" id="ttVoice">' + (an.student.voice_ok === true ? 'Switch voice off' : 'I have the parent’s consent — switch voice on') + '</button></div></div>' : '');

    const msg = (t, ok) => { const el = body.querySelector('#ttMsg'); if (el) el.innerHTML = '<div class="' + (ok ? 'tt-ok' : 'tt-err') + '">' + esc(t) + '</div>'; };
    body.querySelector('#ttSess').onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; st.sessions = +b.dataset.n; body.querySelectorAll('#ttSess .tt-chip').forEach(x => x.classList.toggle('on', x === b)); };
    body.querySelector('#ttAssign').onclick = async e => {
      e.currentTarget.disabled = true;
      const due = body.querySelector('#ttDue').value;
      const r = await call('/api/speaking-tutor/assign', { method: 'POST', body: { student_id: sid, sessions: st.sessions, theme: body.querySelector('#ttTheme').value, due_at: due ? due + 'T20:00:00' : null } });
      e.currentTarget.disabled = false;
      msg(r.ok ? 'Assigned. The student sees it on Today; the report comes by itself.' : (r.d.error || 'Could not assign'), r.ok);
    };
    const drill = body.querySelector('#ttDrill');
    if (drill) drill.onclick = async () => { drill.disabled = true; const r = await call('/api/speaking-tutor/drill', { method: 'POST', body: { student_id: sid } }); drill.disabled = false; msg(r.ok ? 'A one-session drill is assigned.' : (r.d.error || 'Could not make a drill'), r.ok); };
    body.querySelector('#ttAddTopic').onclick = async () => {
      const v = body.querySelector('#ttTopic').value.trim(); if (!v) return;
      const r = await call('/api/speaking-tutor/students/' + encodeURIComponent(sid) + '/topics', { method: 'POST', body: { topic: v } });
      if (r.ok) { const [a, b] = await Promise.all([call('/api/speaking-tutor/students/' + encodeURIComponent(sid) + '/report'), call('/api/speaking-tutor/students/' + encodeURIComponent(sid) + '/analytics')]); if (a.ok && b.ok) draw(body, sid, a.d, b.d); }
    };
    body.querySelector('#ttGive').onclick = async () => {
      const v = body.querySelector('#ttTask').value.trim(); if (!v) return;
      const r = await call('/api/speaking-tutor/students/' + encodeURIComponent(sid) + '/tasks', { method: 'POST', body: { instruction: v } });
      if (r.ok) { const [a, b] = await Promise.all([call('/api/speaking-tutor/students/' + encodeURIComponent(sid) + '/report'), call('/api/speaking-tutor/students/' + encodeURIComponent(sid) + '/analytics')]); if (a.ok && b.ok) draw(body, sid, a.d, b.d); }
    };
    const vb = body.querySelector('#ttVoice');
    if (vb) vb.onclick = async () => { const on = an.student.voice_ok !== true; const r = await call('/api/speaking-tutor/students/' + encodeURIComponent(sid) + '/voice', { method: 'PUT', body: { ok: on } }); if (r.ok) { an.student.voice_ok = on; draw(body, sid, rep, an); } };
    body.onclick = async e => {
      const p = e.target.closest('[data-play]'); if (p) return play(p.dataset.play);
      const f = e.target.closest('[data-flag]'); if (f) { const r = await call('/api/speaking-tutor/flags', { method: 'POST', body: { round_id: f.dataset.flag } }); f.textContent = r.ok ? 'Noted - Tich will learn from it' : 'Could not note'; f.disabled = true; }
    };
  }

  /* "Homework -> New -> Speaking practice": pick the student, then the same window with the assign form on top */
  async function pick() {
    style();
    const ov = document.createElement('div'); ov.className = 'tt-ov';
    ov.innerHTML = '<div class="tt-win" role="dialog" aria-modal="true"><button class="tt-x" aria-label="Close">✕</button><h2>Speaking practice</h2><div class="tt-sub">Who is it for? It takes half a minute.</div><div class="tt-pick" id="ttPick"><div class="tt-note">Loading…</div></div></div>';
    document.body.appendChild(ov); const close = () => ov.remove(); ov.querySelector('.tt-x').onclick = close; ov.onclick = e => { if (e.target === ov) close(); };
    const r = await call('/api/members/roster');
    const list = ((r.d && r.d.students) || []).filter(s => s.id && s.journal_id);
    const box = ov.querySelector('#ttPick');
    box.innerHTML = list.length ? list.map(s => '<button data-id="' + esc(s.id) + '" data-name="' + esc(s.name) + '">' + esc(s.name) + '</button>').join('') : '<div class="tt-note">No students with accounts yet.</div>';
    box.onclick = e => { const b = e.target.closest('[data-id]'); if (!b) return; close(); open(b.dataset.id, b.dataset.name); };
  }

  window.TalkTeacher = { open, pick };
})();
