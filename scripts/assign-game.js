/* ═══════════════════════════════════════════════════════════════════════════
   Assign a game to students.

   A game given as homework is ordinary TeachEd homework: one required card -
   the game card - on a board. The student finds it under Assignments in the
   student room (student.html), plays it in homework-do.html, the score is
   saved per card, and the teacher sees it in Homework and the gradebook.

   Two ways in:
     forBoardCard(card)  - a game card already on the open board, with the
                           teacher's own words/questions (board.html)
     forGame({src,title}) - a game from the catalogue (games/index.html, the
                           board's Games Hub): a small board "Homework · <game>"
                           is created for it, so the teacher can later open
                           that board and change the content.

   window.TeachEdAssign = { forBoardCard, forGame }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const API = window.TEACHED_API_BASE
    || (window.TeachEdApp && window.TeachEdApp.API_BASE)
    || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000'
      : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech'));
  const token = () => { try { return localStorage.getItem('teachedos_token') || ''; } catch (_) { return ''; } };

  async function api(path, opts = {}) {
    const r = await fetch(API + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token(), ...(opts.headers || {}) },
      body: opts.body == null ? undefined : JSON.stringify(opts.body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  }

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // YYYY-MM-DD in local time, n days from today
  const dayFromNow = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };

  function injectCss() {
    if (document.getElementById('tas-css')) return;
    const st = document.createElement('style');
    st.id = 'tas-css';
    st.textContent = `
.tas-ov{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(36,40,44,.38);padding:20px;font-family:var(--font,'Inter',system-ui,sans-serif);}
.tas{width:min(460px,100%);max-height:calc(100vh - 40px);display:flex;flex-direction:column;background:#fff;border-radius:18px;box-shadow:0 24px 64px rgba(36,40,44,.28);color:#24282C;overflow:hidden;}
.tas-head{display:flex;align-items:center;gap:10px;padding:16px 18px 10px;}
.tas-head b{flex:1;font-size:16px;font-weight:650;letter-spacing:-.01em;}
.tas-x{width:30px;height:30px;border:0;border-radius:9px;background:#F6F6EF;cursor:pointer;font-size:18px;line-height:1;color:#24282C;}
.tas-body{padding:0 18px 12px;overflow:auto;display:flex;flex-direction:column;gap:12px;}
.tas-game{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#F6F6EF;font-size:13px;}
.tas-game span{font-size:22px;}
.tas-lbl{display:block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5D614B;margin-bottom:6px;}
.tas-list{border:1px solid rgba(36,40,44,.12);border-radius:12px;max-height:220px;overflow:auto;}
.tas-row{display:flex;align-items:center;gap:10px;padding:8px 12px;font-size:13.5px;cursor:pointer;border-bottom:1px solid rgba(36,40,44,.06);}
.tas-row:last-child{border-bottom:0;}
.tas-row:hover{background:#FAFAF6;}
.tas-row input{width:16px;height:16px;accent-color:#24282C;}
.tas-row small{margin-left:auto;color:#5C5C66;font-size:11.5px;}
.tas-av{width:24px;height:24px;border-radius:50%;background:#CDF649;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex:0 0 24px;overflow:hidden;}
.tas-av img{width:100%;height:100%;object-fit:cover;}
.tas-all{border:0;background:none;padding:0;font-weight:600;font-size:12px;font-family:inherit;color:#24282C;text-decoration:underline;cursor:pointer;float:right;}
.tas-empty{padding:14px;font-size:13px;color:#5C5C66;line-height:1.45;}
.tas-empty a{color:#24282C;font-weight:600;}
.tas-in{width:100%;box-sizing:border-box;border:1px solid rgba(36,40,44,.16);border-radius:10px;padding:9px 11px;font-size:14px;font-family:inherit;color:#24282C;background:#fff;}
.tas-in:focus{outline:2px solid #CDF649;outline-offset:1px;border-color:#24282C;}
textarea.tas-in{min-height:58px;resize:vertical;}
.tas-due{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.tas-due button{border:1px solid rgba(36,40,44,.14);background:#fff;border-radius:999px;padding:5px 11px;font-weight:600;font-size:12px;font-family:inherit;color:#24282C;cursor:pointer;}
.tas-due button.on{background:#CDF649;border-color:#24282C;}
.tas-due input{width:auto;flex:1;min-width:130px;}
.tas-foot{display:flex;align-items:center;gap:10px;padding:12px 18px 16px;border-top:1px solid rgba(36,40,44,.08);}
.tas-msg{flex:1;font-size:12.5px;color:#5C5C66;}
.tas-msg.err{color:#C0392B;}
.tas-btn{border:0;border-radius:11px;padding:10px 16px;font-weight:650;font-size:14px;font-family:inherit;cursor:pointer;background:#CDF649;color:#24282C;}
.tas-btn:disabled{opacity:.55;cursor:default;}
.tas-btn.ghost{background:#F6F6EF;}
.tas-done{padding:26px 18px 8px;text-align:center;font-size:14px;line-height:1.5;}
.tas-done div{font-size:34px;margin-bottom:6px;}
`;
    document.head.appendChild(st);
  }

  /* opts: { title, icon, getTarget: async () => ({ boardId, cardIds }) } */
  function open(opts) {
    injectCss();
    document.querySelector('.tas-ov')?.remove();
    if (!token()) { alert('Sign in as a teacher to assign games to students.'); return; }

    const ov = document.createElement('div');
    ov.className = 'tas-ov';
    ov.innerHTML = `<div class="tas" role="dialog" aria-modal="true" aria-label="Assign to students">
      <div class="tas-head"><b>Assign to students</b><button type="button" class="tas-x" aria-label="Close">×</button></div>
      <div class="tas-body">
        <div class="tas-game"><span>${esc(opts.icon || '🎮')}</span><div><b>${esc(opts.title)}</b><br><small>Students play it from their Assignments; the score comes back to you.</small></div></div>
        <div><span class="tas-lbl">Students <button type="button" class="tas-all" hidden>Select all</button></span><div class="tas-list"><div class="tas-empty">Loading your students…</div></div></div>
        <div><span class="tas-lbl">Due</span><div class="tas-due">
          <button type="button" data-days="1">Tomorrow</button><button type="button" data-days="3">In 3 days</button><button type="button" data-days="7" class="on">In a week</button><button type="button" data-days="">No date</button>
          <input type="date" class="tas-in" value="${dayFromNow(7)}" min="${dayFromNow(0)}" aria-label="Due date">
        </div></div>
        <div><span class="tas-lbl">Note for students</span><textarea class="tas-in" maxlength="600" placeholder="e.g. Play until you get at least 8 right."></textarea></div>
      </div>
      <div class="tas-foot"><span class="tas-msg"></span><button type="button" class="tas-btn ghost" data-cancel>Cancel</button><button type="button" class="tas-btn" data-go disabled>Assign</button></div>
    </div>`;
    document.body.appendChild(ov);

    const $ = s => ov.querySelector(s);
    const list = $('.tas-list'), msg = $('.tas-msg'), go = $('[data-go]'), dateIn = $('input[type=date]');
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    $('.tas-x').onclick = close;
    $('[data-cancel]').onclick = close;

    const picked = () => [...ov.querySelectorAll('.tas-row input:checked')].map(i => i.value);
    const sync = () => { const n = picked().length; go.disabled = !n; go.textContent = n > 1 ? `Assign to ${n}` : 'Assign'; };

    ov.querySelectorAll('.tas-due button').forEach(b => b.onclick = () => {
      ov.querySelectorAll('.tas-due button').forEach(x => x.classList.toggle('on', x === b));
      dateIn.value = b.dataset.days ? dayFromNow(+b.dataset.days) : '';
    });
    dateIn.oninput = () => ov.querySelectorAll('.tas-due button').forEach(x => x.classList.toggle('on', !dateIn.value ? x.dataset.days === '' : x.dataset.days && dayFromNow(+x.dataset.days) === dateIn.value));

    api('/api/members/roster').then(d => {
      // Journal-only entries (no account yet) cannot receive homework.
      const students = (d.students || []).filter(s => !s.pending && /^[0-9a-f-]{36}$/i.test(String(s.id)));
      if (!students.length) {
        list.innerHTML = `<div class="tas-empty">No students yet. Invite one from a board (Share → Invite) or from <a href="${location.pathname.includes('/games/') ? '../' : ''}journal.html">Students</a>, then assign.</div>`;
        return;
      }
      list.innerHTML = students.map(s => `<label class="tas-row"><input type="checkbox" value="${esc(s.id)}">
        <span class="tas-av">${s.avatar && /^(https?:|data:image\/)/.test(s.avatar) ? `<img src="${esc(s.avatar)}" alt="">` : esc((s.name || s.email || '?').trim()[0].toUpperCase())}</span>
        <span>${esc(s.name || s.email)}</span>${s.level ? `<small>${esc(s.level)}</small>` : ''}</label>`).join('');
      const all = $('.tas-all');
      all.hidden = students.length < 2;
      all.onclick = () => { const boxes = [...ov.querySelectorAll('.tas-row input')]; const on = boxes.some(b => !b.checked); boxes.forEach(b => { b.checked = on; }); all.textContent = on ? 'Clear' : 'Select all'; sync(); };
      if (students.length === 1) ov.querySelector('.tas-row input').checked = true;
      list.addEventListener('change', sync);
      sync();
    }).catch(e => { list.innerHTML = `<div class="tas-empty">Could not load students: ${esc(e.message)}</div>`; });

    go.onclick = async () => {
      const ids = picked();
      if (!ids.length) return;
      go.disabled = true; go.textContent = 'Assigning…'; msg.className = 'tas-msg'; msg.textContent = '';
      try {
        const target = await opts.getTarget();
        // due at the end of the chosen day, in the teacher's time zone
        const due = dateIn.value ? new Date(dateIn.value + 'T23:59:00').toISOString() : null;
        await api('/api/homework', {
          method: 'POST',
          body: {
            board_id: target.boardId,
            title: opts.title,
            instructions: $('textarea').value.trim(),
            required_cards: target.cardIds,
            due_at: due,
            student_ids: ids,
          },
        });
        const hw = (location.pathname.includes('/games/') ? '../' : '') + 'homework.html';
        $('.tas-body').innerHTML = `<div class="tas-done"><div>✅</div><b>${esc(opts.title)}</b> is assigned to ${ids.length} student${ids.length > 1 ? 's' : ''}.<br>You will see the scores in <a href="${hw}">Homework</a>.</div>`;
        $('.tas-foot').innerHTML = `<span class="tas-msg"></span><button type="button" class="tas-btn">Done</button>`;
        $('.tas-foot .tas-btn').onclick = close;
      } catch (e) {
        msg.className = 'tas-msg err'; msg.textContent = e.message || 'Could not assign';
        sync();
      }
    };
  }

  /* A game card on the open board (board-app.js globals). The board must be
     in the cloud first - the student's page reads the card from the server. */
  function forBoardCard(card) {
    open({
      title: (card.data && card.data.title) || 'Game',
      icon: '🎮',
      async getTarget() {
        if (typeof currentBoardId === 'undefined' || !currentBoardId || typeof currentUser === 'undefined' || !currentUser) {
          throw new Error('Save this board to your account first (sign in), then assign.');
        }
        if (typeof saveLocal === 'function') saveLocal();
        if (typeof saveToCloud === 'function') await saveToCloud();
        return { boardId: currentBoardId, cardIds: [card.id] };
      },
    });
  }

  /* A game from the catalogue: its own small board with just this game. */
  function forGame(g) {
    const src = String(g.src || '').replace(/^(\.\.\/)+/, '').replace(/^\//, '');
    const w = +g.w || 520, h = +g.h || 640;
    let made = null;   // created once, even if the teacher retries after an error
    open({
      title: g.title || 'Game',
      icon: g.icon || '🎮',
      async getTarget() {
        if (made) return made;
        const { board } = await api('/api/boards', { method: 'POST', body: { name: `Homework · ${g.title || 'Game'}` } });
        const card = { id: 'c1', type: 'game', x: 0, y: 0, w, h, z: 1,
          data: { title: g.title || 'Game', src, naturalW: w, naturalH: h, ...(g.data || {}) } };
        await api('/api/boards/' + board.id, {
          method: 'PATCH',
          body: { state: { pan: { x: 80, y: 80 }, scale: 1, nextId: 2, cards: [card], arrows: [], annotations: [], strokes: [], groups: [] } },
        });
        made = { boardId: board.id, cardIds: [card.id] };
        return made;
      },
    });
  }

  window.TeachEdAssign = { forBoardCard, forGame, open };
})();
