/* Homework → "Writing to review".

   A student's Writing Studio hand-in arrives here with the AI pre-check
   already done (bands per criterion, the lesson's checklist, corrections).
   The teacher adjusts the bands, has the feedback drafted (or writes it),
   sets the grade and returns it. The student then sees it in their cabinet,
   and every version stays so the class can come back to it. */
(function () {
  'use strict';
  const W = window.TeachedWriting;
  if (!W) return;
  const { esc } = W;

  const API_BASE = typeof API !== 'undefined' ? API : location.origin;
  const tok = () => localStorage.getItem('teachedos_token') || '';

  async function call(path, opts = {}) {
    const r = await fetch(API_BASE + '/api/writing' + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok() },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Server error ' + r.status);
    return d;
  }

  const state = { filter: 'submitted', list: [], open: null, poll: null, gradeTouched: false };

  const CSS = `
.wr-queue{margin:18px 0 22px;background:var(--card);border:1px solid var(--border);border-radius:20px;overflow:hidden}
.wr-q-head{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid var(--border)}
.wr-q-head h2{margin:0;font-size:19px;font-weight:750;letter-spacing:-.01em}
.wr-q-count{min-width:26px;height:26px;padding:0 8px;border-radius:13px;background:var(--lime);color:#24282C;font:750 13px/26px var(--font);text-align:center}
.wr-q-tabs{margin-left:auto;display:flex;gap:4px;background:var(--bg);border-radius:12px;padding:3px}
.wr-q-tabs button{border:0;background:transparent;border-radius:9px;padding:7px 12px;font:650 12px var(--font);color:var(--text2);cursor:pointer}
.wr-q-tabs button.on{background:var(--card);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.wr-q-list{display:flex;flex-direction:column}
.wr-row{display:grid;grid-template-columns:40px minmax(0,1.4fr) minmax(0,1fr) 150px 120px 110px;gap:16px;align-items:center;padding:14px 22px;border-top:1px solid var(--border);cursor:pointer;transition:background .15s}
.wr-row:first-child{border-top:0}
.wr-row:hover{background:rgba(205,246,73,.08)}
.wr-av{width:40px;height:40px;border-radius:50%;background:var(--bg);display:grid;place-items:center;font-weight:750;overflow:hidden}
.wr-av img{width:100%;height:100%;object-fit:cover}
.wr-row-main b{display:block;font-size:14px}
.wr-row-main span,.wr-row-sub{font-size:12px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.wr-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font:650 11px/1.4 var(--font);white-space:nowrap}
.wr-chip.ai{background:#eef7d6;color:#3d5a00}
.wr-chip.wait{background:var(--bg);color:var(--text2)}
.wr-chip.fail{background:#fde8e1;color:#a33a10}
.wr-chip.done{background:#24282C;color:#fff}
.wr-row-grade{font:750 20px/1 var(--font);text-align:right}
.wr-row-grade small{display:block;font:600 10px/1.4 var(--font);color:var(--text2);text-transform:uppercase;letter-spacing:.06em}
.wr-empty{padding:26px 22px;color:var(--text2);font-size:13px}

.wr-modal{position:fixed;inset:0;z-index:6000;background:rgba(36,40,44,.55);backdrop-filter:blur(6px);display:flex;align-items:stretch;justify-content:center;padding:24px}
.wr-sheet{width:min(1320px,100%);background:var(--bg);border-radius:22px;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.25)}
.wr-top{display:flex;align-items:center;gap:14px;padding:16px 22px;background:var(--card);border-bottom:1px solid var(--border)}
.wr-top h3{margin:0;font-size:18px;font-weight:750}
.wr-top p{margin:2px 0 0;font-size:12px;color:var(--text2)}
.wr-top .wr-x{margin-left:auto;border:0;background:var(--bg);width:40px;height:40px;border-radius:12px;font-size:18px;cursor:pointer}
.wr-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(380px,.85fr);min-height:0}
.wr-left{overflow:auto;padding:26px 34px 40px;background:var(--card)}
.wr-right{display:grid;grid-template-rows:minmax(0,1fr) auto;min-height:0;border-left:1px solid var(--border)}
.wr-right-scroll{overflow:auto;padding:22px 24px 18px;display:flex;flex-direction:column;gap:14px}
.wr-prompt{background:var(--bg);border-radius:14px;padding:12px 16px;margin-bottom:20px;font-size:13px;line-height:1.5}
.wr-prompt summary{cursor:pointer;font-weight:700}
.wr-left-tools{display:flex;align-items:center;gap:10px;margin-bottom:16px;font-size:12px;color:var(--text2)}
.wr-left-tools label{display:flex;gap:6px;align-items:center;cursor:pointer}
.wr-versions{margin-left:auto;display:flex;gap:4px}
.wr-versions button{border:1px solid var(--border2);background:var(--card);border-radius:8px;padding:4px 9px;font:600 11px var(--font);cursor:pointer}
.wr-versions button.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.wr-meter{font-size:12px;color:var(--text2);margin-bottom:10px}
.wr-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px 18px}
.wr-card h4{margin:0 0 12px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--text2);display:flex;align-items:center;gap:8px}
.wr-card h4 .wr-link{margin-left:auto;text-transform:none;letter-spacing:0;font-weight:600;color:var(--text);cursor:pointer;background:none;border:0;font-size:12px;text-decoration:underline}
.wr-summary{font-size:14px;line-height:1.55;margin:0}
.wr-edit-band{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center;padding:10px 0;border-top:1px solid var(--border)}
.wr-edit-band:first-of-type{border-top:0;padding-top:0}
.wr-edit-band b{font-size:13px}
.wr-pips{display:flex;gap:4px}
.wr-pips button{width:30px;height:30px;border-radius:8px;border:1px solid var(--border2);background:var(--card);font:700 12px var(--font);cursor:pointer}
.wr-pips button.on{background:var(--lime);border-color:#9bc21a}
.wr-edit-band textarea{grid-column:1/-1;width:100%;border:1px solid var(--border);border-radius:10px;padding:8px 10px;font:13px/1.45 var(--font);resize:vertical;min-height:38px;background:var(--bg)}
.wr-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.wr-two ul{margin:0;padding-left:18px;font-size:13px;line-height:1.5}
.wr-foot{padding:14px 24px 18px;background:var(--card);border-top:1px solid var(--border);display:grid;gap:10px;box-shadow:0 -10px 24px -18px rgba(0,0,0,.25)}
.wr-foot textarea#wr-feedback{field-sizing:fixed!important;height:auto;width:100%;min-height:120px!important;max-height:34vh;border:1px solid var(--border2);border-radius:14px;padding:12px 14px;font:14px/1.55 var(--font);resize:vertical;background:var(--card)}
.wr-foot-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wr-foot input.wr-notes{flex:1;min-width:200px;border:1px solid var(--border);border-radius:10px;padding:9px 12px;font:13px var(--font);background:var(--card)}
.wr-foot select{border:1px solid var(--border);border-radius:10px;padding:9px 10px;font:13px var(--font);background:var(--card)}
.wr-grade{display:flex;align-items:center;gap:8px;font:650 13px var(--font)}
.wr-grade input{width:78px;border:1px solid var(--border2);border-radius:10px;padding:9px 10px;font:750 18px var(--font);text-align:center}
.wr-foot .btn{white-space:nowrap}
.wr-foot .wr-send{margin-left:auto}
.wr-status{font-size:12px;color:var(--text2)}
.wr-fixes-edit{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.wr-fixes-edit li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start;padding-top:10px;border-top:1px solid var(--border);font-size:13px}
.wr-fixes-edit li:first-child{border-top:0;padding-top:0}
.wr-fixes-edit li.off .wr-orig{opacity:.55}
.wr-fixes-edit li.off .wr-fix-sugg,.wr-fixes-edit li.off .wr-fix-why{opacity:.45}
.wr-fix-keep input{width:18px;height:18px;margin-top:1px;cursor:pointer;accent-color:#24282C}
.wr-fix-line{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}
.wr-fix-line .wr-orig{cursor:pointer}
.wr-fixes-edit input[type=text]{border:1px solid var(--border);border-radius:8px;padding:6px 9px;font:13px var(--font);background:var(--bg);min-width:0}
.wr-fix-sugg{font-weight:650;flex:1 1 130px}
.wr-fix-why{width:100%;margin-top:6px}
.wr-fix-hint{font-size:12px;color:var(--text2);margin:-4px 0 12px}
.wr-addfix[hidden]{display:none}
.wr-addfix{display:grid;gap:8px;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border2)}
.wr-addfix input,.wr-addfix select{border:1px solid var(--border);border-radius:8px;padding:7px 10px;font:13px var(--font);background:var(--bg);min-width:0}
.wr-addfix .wr-af-row{display:flex;gap:8px;flex-wrap:wrap}
.wr-addfix .wr-af-row input{flex:1 1 140px}
.wr-skel{height:12px;border-radius:6px;background:linear-gradient(90deg,rgba(0,0,0,.06),rgba(0,0,0,.12),rgba(0,0,0,.06));background-size:200% 100%;animation:wrsk 1.2s infinite;margin:8px 0}
@keyframes wrsk{to{background-position:-200% 0}}
`;

  function injectCss() {
    W.injectCss();
    if (document.getElementById('wr-review-css')) return;
    const st = document.createElement('style');
    st.id = 'wr-review-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function avatar(r) {
    const a = r.student_avatar || '';
    if (/^(https?:|data:image)/.test(a)) return `<img src="${esc(a)}" alt="">`;
    // Emoji avatars are several code points long - slicing one breaks them.
    if (a && a.length <= 12) return esc(a);
    return esc(Array.from(r.student_name || '?')[0].toUpperCase());
  }

  function aiChip(r) {
    if (r.status === 'returned') return `<span class="wr-chip done">✓ Returned ${esc(W.when(r.returned_at))}</span>`;
    if (r.ai_status === 'done') return `<span class="wr-chip ai">✦ AI check ready</span>`;
    if (r.ai_status === 'failed') return `<span class="wr-chip fail">AI check failed</span>`;
    return `<span class="wr-chip wait">✦ Checking…</span>`;
  }

  function mountQueue() {
    // Right under the counters: work waiting for a grade is the first thing to see.
    const anchor = document.querySelector('.hw-focus') || document.querySelector('.hw-toolbar');
    if (!anchor || document.getElementById('wr-queue')) return;
    const sec = document.createElement('section');
    sec.className = 'wr-queue';
    sec.id = 'wr-queue';
    sec.setAttribute('aria-labelledby', 'wr-q-title');
    sec.innerHTML = `
      <div class="wr-q-head">
        <h2 id="wr-q-title">Writing to review</h2><span class="wr-q-count" id="wr-q-count">0</span>
        <div class="wr-q-tabs" role="tablist">
          <button type="button" data-f="submitted" class="on">To review</button>
          <button type="button" data-f="returned">Returned</button>
          <button type="button" data-f="all">All</button>
        </div>
      </div>
      <div class="wr-q-list" id="wr-q-list"><div class="wr-empty">Loading…</div></div>`;
    anchor.parentNode.insertBefore(sec, anchor);
    sec.querySelector('.wr-q-tabs').addEventListener('click', e => {
      const b = e.target.closest('button[data-f]');
      if (!b) return;
      state.filter = b.dataset.f;
      sec.querySelectorAll('.wr-q-tabs button').forEach(x => x.classList.toggle('on', x === b));
      renderQueue();
    });
    sec.querySelector('#wr-q-list').addEventListener('click', e => {
      const row = e.target.closest('.wr-row[data-id]');
      if (row) openReview(row.dataset.id);
    });
    sec.querySelector('#wr-q-list').addEventListener('keydown', e => {
      const row = e.target.closest('.wr-row[data-id]');
      if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openReview(row.dataset.id); }
    });
  }

  async function loadQueue() {
    try {
      const d = await call('/inbox?status=all');
      state.list = d.submissions || [];
    } catch (err) {
      state.list = [];
      const el = document.getElementById('wr-q-list');
      if (el) el.innerHTML = `<div class="wr-empty">Writing hand-ins could not be loaded right now.</div>`;
      return;
    }
    renderQueue();
    // A hand-in still being checked: look again shortly.
    clearTimeout(state.poll);
    if (state.list.some(r => r.status === 'submitted' && r.ai_status === 'pending')) state.poll = setTimeout(loadQueue, 6000);
  }

  function renderQueue() {
    const list = document.getElementById('wr-q-list');
    const count = document.getElementById('wr-q-count');
    if (!list) return;
    const waiting = state.list.filter(r => r.status === 'submitted');
    if (count) count.textContent = waiting.length;
    const rows = state.filter === 'all' ? state.list : state.list.filter(r => r.status === state.filter);
    if (!rows.length) {
      list.innerHTML = `<div class="wr-empty">${state.filter === 'submitted'
        ? 'Nothing to review. When a student presses “Submit to teacher” in a Writing Studio, it appears here - already pre-checked.'
        : 'Nothing here yet.'}</div>`;
      return;
    }
    list.innerHTML = rows.map(r => {
      const grade = r.status === 'returned' ? r.grade : r.suggested_grade;
      return `<div class="wr-row" data-id="${esc(r.id)}" tabindex="0" role="button" aria-label="Review ${esc(r.student_name)}: ${esc(r.title)}">
        <span class="wr-av">${avatar(r)}</span>
        <span class="wr-row-main"><b>${esc(r.student_name || 'Student')}</b><span>${esc(r.title || 'Writing')}${r.versions ? ` · draft ${r.versions + 1}` : ''}</span></span>
        <span class="wr-row-sub">${esc(r.board_name || '')}<br>${r.words} ${r.target_words ? `/ ${r.target_words} ` : ''}words · ${esc(r.level || '')}</span>
        <span>${aiChip(r)}</span>
        <span class="wr-row-sub">${esc(W.when(r.submitted_at))}</span>
        <span class="wr-row-grade">${grade != null ? `${grade}%` : '–'}<small>${r.status === 'returned' ? 'grade' : 'suggested'}</small></span>
      </div>`;
    }).join('');
  }

  /* ── Review sheet ─────────────────────────────────────────────────────── */

  let current = null;     // submission
  let view = 'current';   // 'current' or index into history

  async function openReview(id) {
    injectCss();
    closeReview();
    const modal = document.createElement('div');
    modal.className = 'wr-modal';
    modal.id = 'wr-modal';
    modal.innerHTML = `<div class="wr-sheet" role="dialog" aria-modal="true" aria-labelledby="wr-m-title">
      <div class="wr-top"><div><h3 id="wr-m-title">Loading…</h3><p></p></div><button class="wr-x" type="button" aria-label="Close">✕</button></div>
      <div class="wr-body"><div class="wr-left"><div class="wr-skel"></div><div class="wr-skel"></div><div class="wr-skel" style="width:70%"></div></div><div class="wr-right"></div></div>
    </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.wr-x')) closeReview(); });
    modal.querySelector('.wr-right').addEventListener('click', onRightClick);
    modal.querySelector('.wr-right').addEventListener('change', e => {
      const box = e.target.closest('input[data-fk]');
      if (!box) return;
      fixesNow()[Number(box.closest('li').dataset.fi)].keep = box.checked;
      remark();
    });
    modal.querySelector('.wr-right').addEventListener('input', e => {
      const f = e.target.closest('input[data-ff]');
      if (!f) return;
      fixesNow()[Number(f.closest('li').dataset.fi)][f.dataset.ff] = f.value;
      if (f.dataset.ff === 'suggestion') remark();
    });
    document.addEventListener('keydown', escClose);
    try { history.replaceState(null, '', '#writing=' + id); } catch {}
    try {
      const d = await call('/' + encodeURIComponent(id));
      current = d.submission;
      view = 'current';
      state.gradeTouched = current.status === 'returned';
      renderReview();
      if (current.status === 'submitted' && current.ai_status === 'pending') pollOne(id, 0);
    } catch (err) {
      modal.querySelector('.wr-left').innerHTML = `<div class="wr-empty">${esc(err.message)}</div>`;
    }
  }

  function escClose(e) { if (e.key === 'Escape') closeReview(); }
  function closeReview() {
    document.getElementById('wr-modal')?.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', escClose);
    if (/^#writing=/.test(location.hash)) { try { history.replaceState(null, '', location.pathname + location.search); } catch {} }
  }

  async function pollOne(id, n) {
    if (n > 20 || !document.getElementById('wr-modal') || !current || current.id !== id) return;
    await new Promise(r => setTimeout(r, 4000));
    try {
      const d = await call('/' + encodeURIComponent(id));
      if (!current || current.id !== id) return;
      if (d.submission.ai_status !== 'pending') {
        const keepFeedback = document.getElementById('wr-feedback')?.value || '';
        current = d.submission;
        renderReview();
        if (keepFeedback) document.getElementById('wr-feedback').value = keepFeedback;
        loadQueue();
        return;
      }
    } catch {}
    pollOne(id, n + 1);
  }

  function scoresNow() {
    return (current.scores && current.scores.length ? current.scores : (current.ai_check && current.ai_check.scores) || [])
      .map(s => ({ ...s }));
  }

  /* The corrections the student will see: the AI's list to start with, each one
     kept, edited or dropped by the teacher, plus the teacher's own. */
  function fixesNow() {
    if (!current) return [];
    if (!current.fixes) {
      const base = Array.isArray(current.teacher_corrections) ? current.teacher_corrections
        : ((current.ai_check && current.ai_check.corrections) || []);
      current.fixes = base.map(c => ({ original: c.original, suggestion: c.suggestion, why: c.why || '', type: c.type || 'grammar', keep: true }));
    }
    return current.fixes;
  }
  const keptFixes = () => fixesNow().filter(f => f.keep);

  function fixesCardHtml() {
    const fixes = fixesNow();
    if (!fixes.length && !(current.ai_check || current.ai_status === 'failed')) return '';
    let k = -1;
    return `<div class="wr-card" id="wr-fixes-card"><h4><span id="wr-fix-count">Corrections the student sees (${keptFixes().length} of ${fixes.length})</span> <button class="wr-link" type="button" data-act="addfix">+ Add your own</button></h4>
      <p class="wr-fix-hint">The AI proposes; you decide. Untick what the student should not see, reword what is unclear. Nothing here reaches the student until you return the work.</p>
      <ol class="wr-fixes-edit">${fixes.map((f, i) => `
        <li data-fi="${i}" data-ci="${f.keep ? ++k : ''}" class="${f.keep ? '' : 'off'}">
          <label class="wr-fix-keep"><input type="checkbox" data-fk${f.keep ? ' checked' : ''} aria-label="Show this correction to the student"></label>
          <div>
            <div class="wr-fix-line"><span class="wr-orig" title="Show in the text">${esc(f.original)}</span><span class="wr-arrow">→</span>
              <input type="text" class="wr-fix-sugg" data-ff="suggestion" value="${esc(f.suggestion)}" maxlength="200" aria-label="Replacement for ${esc(f.original)}"></div>
            <input type="text" class="wr-fix-why" data-ff="why" value="${esc(f.why)}" maxlength="300" placeholder="Why - in words the student can read" aria-label="Reason">
          </div>
        </li>`).join('') || '<li style="display:block">No corrections. Add one if you want to mark something.</li>'}</ol>
      <div class="wr-addfix" id="wr-addfix" hidden>
        <div class="wr-af-row"><input type="text" id="wr-af-orig" placeholder="The words in the text" maxlength="200"><button class="btn btn-ghost" type="button" data-act="usesel">Use selected text</button></div>
        <div class="wr-af-row"><input type="text" id="wr-af-sugg" placeholder="Write instead" maxlength="200">
          <select id="wr-af-type" aria-label="Kind of mistake">${['grammar', 'vocabulary', 'spelling', 'punctuation', 'style'].map(t => `<option value="${t}">${esc(W.TYPE_NAMES[t])}</option>`).join('')}</select></div>
        <input type="text" id="wr-af-why" placeholder="Why (optional)" maxlength="300">
        <div class="wr-af-row"><button class="btn btn-primary" type="button" data-act="savefix">Add correction</button><span class="wr-status" id="wr-af-msg"></span></div>
      </div>
    </div>`;
  }

  /* Re-mark the text after a correction was kept, dropped or reworded - without
     redrawing the panel, so what the teacher is typing stays put. */
  function remark() {
    const text = document.getElementById('wr-text');
    if (!text || view !== 'current') return;
    const kept = keptFixes();
    text.innerHTML = W.markedText(current.text, kept);
    let k = -1;
    document.querySelectorAll('#wr-fixes-card li[data-fi]').forEach(li => {
      const f = fixesNow()[Number(li.dataset.fi)];
      li.dataset.ci = f && f.keep ? String(++k) : '';
      li.classList.toggle('off', !(f && f.keep));
    });
    const cnt = document.getElementById('wr-fix-count');
    if (cnt) cnt.textContent = `Corrections the student sees (${kept.length} of ${fixesNow().length})`;
  }

  function renderReview() {
    const s = current;
    const modal = document.getElementById('wr-modal');
    if (!modal || !s) return;
    const check = s.ai_check || null;
    const history = Array.isArray(s.history) ? s.history : [];
    const shown = view === 'current' ? s : history[view];
    const corrections = view === 'current' ? keptFixes() : (Array.isArray(shown.corrections) ? shown.corrections : []);

    modal.querySelector('#wr-m-title').textContent = `${s.student_name || 'Student'} · ${s.title || 'Writing'}`;
    modal.querySelector('.wr-top p').textContent =
      `${s.board_name || ''} · handed in ${W.when(s.submitted_at)} · ${s.words}${s.target_words ? ` / ${s.target_words}` : ''} words${s.level ? ` · ${s.level}` : ''}${s.status === 'returned' ? ` · returned ${W.when(s.returned_at)}` : ''}`;

    const versions = history.length
      ? `<div class="wr-versions" role="tablist" aria-label="Drafts">${history.map((h, i) => `<button type="button" data-v="${i}" class="${view === i ? 'on' : ''}">Draft ${i + 1}${h.grade != null ? ` · ${h.grade}%` : ''}</button>`).join('')}<button type="button" data-v="current" class="${view === 'current' ? 'on' : ''}">Draft ${history.length + 1} (now)</button></div>`
      : '';

    modal.querySelector('.wr-left').innerHTML = `
      ${s.prompt ? `<details class="wr-prompt"><summary>The task</summary><div style="margin-top:8px;white-space:pre-wrap">${esc(s.prompt)}</div></details>` : ''}
      <div class="wr-left-tools">
        ${corrections.length ? `<label><input type="checkbox" id="wr-show-fixes"> Show corrections in the text</label>` : '<span>&nbsp;</span>'}
        ${versions}
      </div>
      <div class="wr-text" id="wr-text">${W.markedText(shown.text, corrections)}</div>
      ${view !== 'current' && shown.feedback ? `<div class="wr-card" style="margin-top:24px"><h4>Feedback on this draft${shown.grade != null ? ` · ${shown.grade}%` : ''}</h4><div style="white-space:pre-wrap;font-size:14px;line-height:1.55">${esc(shown.feedback)}</div></div>` : ''}`;

    const right = modal.querySelector('.wr-right');
    const scores = scoresNow();
    const aiBlock = !check
      ? (s.ai_status === 'failed'
        ? `<div class="wr-card"><h4>AI pre-check <button class="wr-link" data-act="recheck">Try again</button></h4><p class="wr-summary">The check did not come back. You can still review and grade by hand.</p></div>`
        : `<div class="wr-card"><h4>AI pre-check</h4><p class="wr-summary">Reading the text against the lesson's criteria…</p><div class="wr-skel"></div><div class="wr-skel" style="width:60%"></div></div>`)
      : `<div class="wr-card"><h4>AI pre-check <button class="wr-link" data-act="recheck">Check again</button></h4><p class="wr-summary">${esc(check.summary || '')}</p></div>`;

    right.innerHTML = `<div class="wr-right-scroll">
      ${aiBlock}
      <div class="wr-card"><h4>Criteria <span style="margin-left:auto;text-transform:none;letter-spacing:0">0–5</span></h4>
        ${(scores.length ? scores : []).map((sc, i) => `
          <div class="wr-edit-band" data-i="${i}">
            <b>${esc(sc.name || sc.key)}</b>
            <span class="wr-pips">${[0, 1, 2, 3, 4, 5].map(n => `<button type="button" data-band="${n}" class="${Number(sc.band) === n ? 'on' : ''}" title="${esc(W.BAND_WORDS[n])}">${n}</button>`).join('')}</span>
            <textarea rows="2" aria-label="Comment on ${esc(sc.name)}">${esc(sc.comment || '')}</textarea>
          </div>`).join('') || '<p class="wr-summary">Bands appear when the pre-check is ready.</p>'}
      </div>
      ${check && check.checklist && check.checklist.length ? `<div class="wr-card"><h4>The lesson's checklist</h4>${W.checklistHtml(check.checklist)}</div>` : ''}
      ${view === 'current' ? fixesCardHtml() : ''}
      ${check && (check.strengths?.length || check.improvements?.length) ? `<div class="wr-card wr-two">
        <div><h4>Worked well</h4><ul>${(check.strengths || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div><h4>To improve</h4><ul>${(check.improvements || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
      </div>
      <div class="wr-foot">
        <textarea id="wr-feedback" rows="5" data-no-autogrow="1" placeholder="Feedback for the student…">${esc(s.feedback || '')}</textarea>
        <div class="wr-foot-row">
          <input class="wr-notes" id="wr-notes" placeholder="Notes for the AI draft (optional): e.g. praise the linking words, focus on past tenses">
          <select id="wr-tone" aria-label="Tone"><option value="warm">Warm</option><option value="brief">Brief</option></select>
          <button class="btn btn-ghost" type="button" data-act="draft">✦ Write feedback</button>
        </div>
        <div class="wr-foot-row">
          <label class="wr-grade">Grade <input id="wr-grade" type="number" min="0" max="100" value="${s.grade != null ? s.grade : (gradeFrom(scores) ?? '')}">%</label>
          <span class="wr-status" id="wr-status">${s.status === 'returned' ? 'Already returned - sending again updates what the student sees.' : 'The student sees nothing until you return it.'}</span>
          <button class="btn btn-primary wr-send" type="button" data-act="return">${s.status === 'returned' ? 'Update & return again' : 'Return to student'}</button>
        </div>
      </div>`;

    W.linkCorrections(modal);
    W.bindExplain(modal.querySelector('#wr-text'), () => (view === 'current' ? keptFixes() : (shown.corrections || [])));
    modal.querySelector('#wr-show-fixes')?.addEventListener('change', e => document.getElementById('wr-text').classList.toggle('wr-show-fixes', e.target.checked));
    modal.querySelector('.wr-versions')?.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      const feedback = document.getElementById('wr-feedback').value;
      view = b.dataset.v === 'current' ? 'current' : Number(b.dataset.v);
      renderReview();
      document.getElementById('wr-feedback').value = feedback;
    });
    modal.querySelector('#wr-grade').addEventListener('input', () => { state.gradeTouched = true; });
    right.querySelectorAll('.wr-edit-band textarea').forEach(t => t.addEventListener('input', () => {
      const i = Number(t.closest('.wr-edit-band').dataset.i);
      const sc = scoresNow();
      sc[i].comment = t.value;
      current.scores = sc;
    }));
  }

  function gradeFrom(scores) {
    const b = scores.map(s => Number(s.band)).filter(Number.isFinite);
    return b.length ? Math.round(b.reduce((a, c) => a + c, 0) / b.length / 5 * 100) : null;
  }

  async function onRightClick(e) {
    const pip = e.target.closest('.wr-pips button[data-band]');
    if (pip) {
      const row = pip.closest('.wr-edit-band');
      const i = Number(row.dataset.i);
      const sc = scoresNow();
      sc[i].band = Number(pip.dataset.band);
      current.scores = sc;
      row.querySelectorAll('.wr-pips button').forEach(b => b.classList.toggle('on', b === pip));
      if (!state.gradeTouched) { const g = gradeFrom(sc); if (g != null) document.getElementById('wr-grade').value = g; }
      return;
    }
    const orig = e.target.closest('.wr-fixes-edit .wr-orig');
    if (orig) {
      const ci = orig.closest('li').dataset.ci;
      if (ci !== '') document.querySelector(`#wr-text .wr-mark[data-ci="${ci}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'addfix') {
      const f = document.getElementById('wr-addfix');
      f.hidden = !f.hidden;
      if (!f.hidden) document.getElementById('wr-af-orig').focus();
      return;
    }
    if (act === 'usesel') {
      const sel = window.getSelection();
      const text = document.getElementById('wr-text');
      const t = sel && sel.rangeCount && text && text.contains(sel.anchorNode) ? sel.toString().replace(/\s+/g, ' ').trim() : '';
      document.getElementById('wr-af-msg').textContent = t ? '' : 'Select the words in the text on the left first.';
      if (t) { document.getElementById('wr-af-orig').value = t.slice(0, 200); document.getElementById('wr-af-sugg').focus(); }
      return;
    }
    if (act === 'savefix') {
      const o = document.getElementById('wr-af-orig').value.replace(/\s+/g, ' ').trim();
      const n = document.getElementById('wr-af-sugg').value.replace(/\s+/g, ' ').trim();
      const msg = document.getElementById('wr-af-msg');
      if (!o || !n || o === n) { msg.textContent = 'Fill in the words and what to write instead.'; return; }
      if (!current.text.toLowerCase().includes(o.toLowerCase())) { msg.textContent = 'These words are not in the text - copy them exactly.'; return; }
      if (fixesNow().some(f => f.original === o)) { msg.textContent = 'That fragment already has a correction.'; return; }
      fixesNow().push({ original: o, suggestion: n, why: document.getElementById('wr-af-why').value.trim(), type: document.getElementById('wr-af-type').value, keep: true });
      const fb = document.getElementById('wr-feedback').value, nt = document.getElementById('wr-notes').value;
      renderReview();
      document.getElementById('wr-feedback').value = fb;
      document.getElementById('wr-notes').value = nt;
      return;
    }
    const status = document.getElementById('wr-status');
    const btn = e.target.closest('[data-act]');
    if (act === 'recheck') {
      btn.textContent = 'Checking…';
      try {
        const d = await call(`/${current.id}/recheck`, { method: 'POST' });
        const fb = document.getElementById('wr-feedback')?.value || '';
        current.ai_check = d.ai_check; current.ai_status = 'done'; current.scores = d.ai_check.scores; current.fixes = null; current.teacher_corrections = null;
        renderReview();
        document.getElementById('wr-feedback').value = fb;
        loadQueue();
      } catch (err) { btn.textContent = 'Try again'; if (status) status.textContent = err.message; }
    }
    if (act === 'draft') {
      btn.disabled = true; btn.textContent = '✦ Writing…';
      try {
        const d = await call(`/${current.id}/feedback-draft`, { method: 'POST', body: {
          scores: scoresNow(), notes: document.getElementById('wr-notes').value, tone: document.getElementById('wr-tone').value } });
        const box = document.getElementById('wr-feedback');
        box.value = d.feedback;
        box.focus();
        if (status) status.textContent = 'Draft ready - edit it as you like before returning.';
      } catch (err) { if (status) status.textContent = err.message; }
      btn.disabled = false; btn.textContent = '✦ Write feedback';
    }
    if (act === 'return') {
      const feedback = document.getElementById('wr-feedback').value.trim();
      const grade = document.getElementById('wr-grade').value;
      const corrections = keptFixes().map(({ original, suggestion, why, type }) => ({ original, suggestion, why, type }));
      if (!feedback && grade === '' && !corrections.length) { if (status) status.textContent = 'Add feedback, a grade or a correction first.'; return; }
      btn.disabled = true; btn.textContent = 'Returning…';
      try {
        const d = await call(`/${current.id}/return`, { method: 'POST', body: { feedback, grade, scores: scoresNow(), corrections } });
        current.status = 'returned'; current.grade = d.grade; current.feedback = feedback; current.returned_at = new Date().toISOString();
        if (typeof toast === 'function') toast(`Returned to ${current.student_name || 'the student'}`);
        closeReview();
        loadQueue();
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Return to student';
        if (status) status.textContent = err.message;
      }
    }
  }

  function start() {
    if (!tok()) return;
    injectCss();
    mountQueue();
    loadQueue();
    const m = location.hash.match(/^#writing=([0-9a-f-]{36})$/i);
    if (m) openReview(m[1]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.openWritingReview = openReview;
})();
