/* Летучий блокнот урока (Lesson pad).

   Посреди урока учитель бросил фразу «из головы» или ученик спросил слово -
   стикер на доске это не спасает: потом его надо собирать, переносить в
   словарь и превращать в домашку. Блокнот держит такие фразы в одном месте:

   - печатаешь фразу и Enter (или выделяешь текст на доске и жмёшь Alt+Shift+L);
   - слово получает значение и пример из словаря сразу, фраза - от движка
     (одним запросом на пачку, чтобы не жечь лимит на каждую);
   - в конце урока одна кнопка кладёт всё в личный словарь (Vault) каждого
     выбранного ученика - с повторением по интервалам, готово к отработке дома.

   Живёт только у владельца доски. Черновик хранится в браузере по доске. */
(function () {
  'use strict';
  if (window.__lessonPad) return;
  window.__lessonPad = true;

  const KEY = id => 'teachedos_pad_' + id;
  let entries = [];            // { id, text, meaning, example, busy }
  let boardId = null;
  let open = false;
  let students = null;         // [{ id, name }] - ученики этой доски
  let picked = new Set();
  let host = null, aiTimer = 0, seq = 0;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = name => { try { return (0, eval)(name); } catch { return undefined; } };   // let-переменные board-app.js
  const api = (path, opts) => (typeof apiFetch === 'function' ? apiFetch(path, opts) : Promise.reject(new Error('no api')));

  function load() {
    try { entries = JSON.parse(localStorage.getItem(KEY(boardId)) || '[]').filter(e => e && e.text); } catch { entries = []; }
  }
  function save() {
    try { localStorage.setItem(KEY(boardId), JSON.stringify(entries.map(({ id, text, meaning, example }) => ({ id, text, meaning, example })))); } catch {}
  }

  function css() {
    if (document.getElementById('lp-css')) return;
    const st = document.createElement('style');
    st.id = 'lp-css';
    st.textContent = `
.lp{position:fixed;right:16px;top:calc(var(--tb-h,48px) + 14px);z-index:900;font-family:var(--font-ui,system-ui,sans-serif);color:#24282C}
.lp[hidden]{display:none}
.lp-fab{display:flex;align-items:center;gap:8px;height:42px;padding:0 18px 0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(rgba(255,255,255,.08),rgba(255,255,255,.08)),rgba(36,40,44,.58);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);color:#fff;font:650 13.5px var(--font-ui,system-ui,sans-serif);cursor:pointer;box-shadow:0 8px 32px rgba(0,0,0,.3);transition:background .2s ease}
.lp-fab i{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#CDF649;color:#24282C;font:800 11.5px ui-monospace,Menlo,monospace;font-style:normal;text-shadow:none}
.lp-fab:hover{background:linear-gradient(rgba(255,255,255,.16),rgba(255,255,255,.16)),rgba(36,40,44,.58)}
.lp-panel{position:absolute;right:0;top:52px;width:min(360px,calc(100vw - 100px));max-height:min(560px,calc(100vh - 120px));display:flex;flex-direction:column;background:#fff;border:1px solid rgba(36,40,44,.14);border-radius:18px;box-shadow:0 24px 60px -20px rgba(0,0,0,.45);overflow:hidden}
.lp-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 6px}
.lp-head b{font-size:14px}.lp-head span{font-size:11.5px;color:#5D614B}
.lp-x{border:0;background:transparent;font-size:18px;line-height:1;color:#5D614B;cursor:pointer;padding:4px 6px}
.lp-add{margin:0 14px 8px;display:flex;gap:6px}
.lp-add input{flex:1;min-width:0;height:38px;border:1px solid rgba(36,40,44,.2);border-radius:11px;padding:0 11px;font:500 14px var(--font-ui,system-ui,sans-serif);color:#24282C;background:#fff}
.lp-add input:focus{outline:none;border-color:#8FB125;box-shadow:0 0 0 3px rgba(205,246,73,.4)}
.lp-add button{height:38px;padding:0 13px;border:0;border-radius:11px;background:#CDF649;font:750 13px var(--font-ui,system-ui,sans-serif);cursor:pointer;color:#24282C}
.lp-list{flex:1;min-height:60px;overflow:auto;padding:0 14px}
.lp-empty{padding:14px 2px 16px;font-size:12.5px;line-height:1.5;color:#5D614B}
.lp-row{position:relative;padding:9px 26px 9px 0;border-top:1px solid rgba(36,40,44,.08)}
.lp-row b{display:block;font-size:14px;letter-spacing:-.01em}
.lp-row input{width:100%;box-sizing:border-box;margin-top:3px;border:1px solid transparent;border-radius:7px;padding:3px 6px;margin-left:-6px;font:500 12.5px var(--font-ui,system-ui,sans-serif);color:#3A3E32;background:transparent}
.lp-row input:hover,.lp-row input:focus{border-color:rgba(36,40,44,.2);background:#FBFDF0;outline:none}
.lp-row small{display:block;margin-top:1px;font-size:11.5px;font-style:italic;color:#7A7E68}
.lp-row .lp-del{position:absolute;right:0;top:8px;border:0;background:transparent;color:#A3A48D;font-size:16px;cursor:pointer}
.lp-row .lp-del:hover{color:#c0392b}
.lp-busy{font-size:11px;color:#8FB125;font-weight:700}
.lp-foot{padding:10px 14px 14px;border-top:1px solid rgba(36,40,44,.1);background:#FBFDF0;display:flex;flex-direction:column;gap:8px}
.lp-who{display:flex;flex-wrap:wrap;gap:5px}
.lp-who label{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;border:1px solid rgba(36,40,44,.18);background:#fff;font:650 12px var(--font-ui,system-ui,sans-serif);cursor:pointer}
.lp-who label.on{background:#24282C;color:#fff;border-color:#24282C}
.lp-who input{display:none}
.lp-note{font-size:11.5px;color:#5D614B;line-height:1.4}
.lp-send{height:42px;border:0;border-radius:12px;background:#CDF649;font:800 13.5px var(--font-ui,system-ui,sans-serif);color:#24282C;cursor:pointer}
.lp-send:disabled{opacity:.5;cursor:default}
.lp-msg{font-size:12px;font-weight:650;min-height:0}
.lp-msg.err{color:#c0392b}.lp-msg.ok{color:#2e7d32}
.lp-clear{border:0;background:transparent;font:600 11.5px var(--font-ui,system-ui,sans-serif);color:#5D614B;text-decoration:underline;cursor:pointer;align-self:flex-start;padding:0}
@media (max-width:700px){.lp{left:12px;bottom:76px}}
`;
    document.head.appendChild(st);
  }

  function ensureHost() {
    if (host) return host;
    css();
    host = document.createElement('div');
    host.className = 'lp';
    host.hidden = true;
    document.body.appendChild(host);
    host.addEventListener('click', onClick);
    host.addEventListener('submit', e => { e.preventDefault(); const i = host.querySelector('.lp-add input'); add(i.value); i.value = ''; i.focus(); });
    host.addEventListener('input', e => {
      const row = e.target.closest('[data-id]');
      const en = row && entries.find(x => x.id === row.dataset.id);
      if (en && e.target.matches('.lp-mean')) { en.meaning = e.target.value; save(); }
    });
    host.addEventListener('keydown', e => { e.stopPropagation(); });
    return host;
  }

  function render() {
    const h = ensureHost();
    // Перерисовка не должна отнимать фокус у того, кто печатает.
    const ae = document.activeElement && h.contains(document.activeElement) ? document.activeElement : null;
    const keep = ae ? { add: ae.closest('.lp-add') != null, id: ae.closest('[data-id]') && ae.closest('[data-id]').dataset.id, at: ae.selectionStart } : null;
    paint(h);
    if (!keep) return;
    const back = keep.add ? h.querySelector('.lp-add input') : keep.id ? h.querySelector('[data-id="' + keep.id + '"] .lp-mean') : null;
    if (back) { back.focus(); try { back.setSelectionRange(keep.at, keep.at); } catch {} }
  }

  function paint(h) {
    if (!open) {
      h.innerHTML = `<button type="button" class="lp-fab" data-act="toggle" title="Catch phrases during the lesson (Alt+Shift+L adds selected text)">✎ Lesson pad${entries.length ? `<i>${entries.length}</i>` : ''}</button>`;
      return;
    }
    const focusText = h.querySelector('.lp-add input')?.value || '';
    const rows = entries.map(e => `<div class="lp-row" data-id="${esc(e.id)}">
        <b>${esc(e.text)}</b>${e.busy ? ' <span class="lp-busy">looking up…</span>' : ''}
        <input class="lp-mean" value="${esc(e.meaning)}" placeholder="meaning - edit if you like" aria-label="Meaning of ${esc(e.text)}">
        ${e.example ? `<small>${esc(e.example)}</small>` : ''}
        <button type="button" class="lp-del" data-act="del" aria-label="Remove">×</button>
      </div>`).join('');
    const who = students == null ? '<span class="lp-note">Loading students…</span>'
      : students.length ? students.map(s => `<label class="${picked.has(s.id) ? 'on' : ''}"><input type="checkbox" data-act="pick" data-s="${esc(s.id)}"${picked.has(s.id) ? ' checked' : ''}>${esc(s.name)}</label>`).join('')
      : '<span class="lp-note">No students with an account on this board yet. Phrases stay here (saved in this browser) until they join.</span>';
    h.innerHTML = `
      <button type="button" class="lp-fab" data-act="toggle">✎ Lesson pad${entries.length ? `<i>${entries.length}</i>` : ''}</button>
      <div class="lp-panel" role="dialog" aria-label="Lesson pad">
        <div class="lp-head"><div><b>Lesson pad</b><br><span>Type a phrase, press Enter. Meanings fill in by themselves.</span></div><button type="button" class="lp-x" data-act="toggle" aria-label="Close">×</button></div>
        <form class="lp-add"><input type="text" maxlength="200" placeholder="a phrase from the lesson…" autocomplete="off" aria-label="Phrase"><button type="submit">Add</button></form>
        <div class="lp-list">${rows || '<div class="lp-empty">Nothing yet. When you say something worth remembering - “it turns out that…”, “make a tough decision” - drop it here.</div>'}</div>
        <div class="lp-foot">
          <div class="lp-who">${who}</div>
          <button type="button" class="lp-send" data-act="send"${entries.length && picked.size ? '' : ' disabled'}>Send to their Word Bank${entries.length ? ` · ${entries.length}` : ''}</button>
          <div class="lp-msg" id="lp-msg" role="status"></div>
          ${entries.length ? '<button type="button" class="lp-clear" data-act="clear">Clear the pad</button>' : ''}
        </div>
      </div>`;
    const inp = h.querySelector('.lp-add input');
    if (inp) { inp.value = focusText; }
  }

  function add(raw) {
    const text = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!text) return;
    if (entries.some(e => e.text.toLowerCase() === text.toLowerCase())) return;
    const e = { id: 'p' + Date.now().toString(36) + (seq++), text, meaning: '', example: '', busy: true };
    entries.unshift(e);
    save();
    render();
    enrich(e);
  }

  /* Слово - из словаря сразу; фраза - в очередь к движку (пачкой). */
  async function enrich(e) {
    if (!/\s/.test(e.text)) {
      try {
        const r = await api('/api/dictionary/define?w=' + encodeURIComponent(e.text) + '&level=B2');
        const d = await r.json().catch(() => null);
        if (d && d.definition && !d.partial) {
          if (!e.meaning) e.meaning = d.definition;
          if (!e.example && d.example) e.example = d.example;
        }
      } catch {}
      if (e.meaning) { e.busy = false; save(); render(); return; }
    }
    e.queued = true;
    clearTimeout(aiTimer);
    aiTimer = setTimeout(flushAi, 1400);
  }

  async function flushAi() {
    const batch = entries.filter(e => e.queued);
    if (!batch.length) return;
    batch.forEach(e => { e.queued = false; });
    try {
      const r = await api('/api/ai/vocab-enrich', { method: 'POST', body: { words: batch.map(e => e.text), level: 'B1', topic: '' } });
      const d = r.ok ? await r.json().catch(() => null) : null;
      const by = new Map(((d && d.items) || []).map(x => [String(x.word).toLowerCase(), x]));
      batch.forEach(e => {
        const x = by.get(e.text.toLowerCase());
        if (x) { if (!e.meaning) e.meaning = x.meaning || ''; if (!e.example) e.example = x.example || ''; }
      });
    } catch {}
    batch.forEach(e => { e.busy = false; });
    save();
    render();
  }

  async function loadStudents() {
    students = null;
    try {
      const r = await api('/api/members/' + encodeURIComponent(boardId));
      const d = r.ok ? await r.json() : { members: [] };
      students = (d.members || []).filter(m => m.role !== 'viewer').map(m => ({ id: m.user_id, name: m.name || m.email || 'Student' }));
    } catch { students = []; }
    // На уроке обычно все: снять галочку с того, кому не надо, проще, чем ставить каждому.
    if (!picked.size) picked = new Set(students.map(s => s.id));
    if (open) render();
  }

  async function send() {
    const msg = host.querySelector('#lp-msg');
    const btn = host.querySelector('.lp-send');
    const say = (t, cls) => { if (msg) { msg.textContent = t; msg.className = 'lp-msg ' + (cls || ''); } };
    btn.disabled = true;
    say('Sending…');
    try {
      const r = await api('/api/vault/send', { method: 'POST', body: {
        studentIds: [...picked], boardId, title: (G('currentBoardName') || document.title || '').toString().slice(0, 120),
        items: entries.map(e => ({ text: e.text, meaning: e.meaning, example: e.example })) } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not send');
      entries = []; save();
      render();
      const m2 = host.querySelector('#lp-msg');
      if (m2) { m2.textContent = d.added ? `✓ ${d.added} phrase${d.added === 1 ? '' : 's'} sent - they are in the students' Word Bank, ready to practise.` : 'They already have all of these.'; m2.className = 'lp-msg ok'; }
    } catch (e) {
      say(e.message || 'Could not send', 'err');
      btn.disabled = false;
    }
  }

  function onClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'toggle') { open = !open; render(); if (open) { host.querySelector('.lp-add input')?.focus(); if (students == null) loadStudents(); } }
    else if (act === 'del') { const id = t.closest('[data-id]').dataset.id; entries = entries.filter(x => x.id !== id); save(); render(); }
    else if (act === 'clear') { if (confirm('Clear the whole pad?')) { entries = []; save(); render(); } }
    else if (act === 'pick') { const id = t.dataset.s; if (picked.has(id)) picked.delete(id); else picked.add(id); render(); }
    else if (act === 'send') send();
  }

  // Выделил на доске - Alt+Shift+L - фраза в блокноте.
  document.addEventListener('keydown', e => {
    if (!(e.altKey && e.shiftKey && (e.key === 'L' || e.key === 'l' || e.code === 'KeyL'))) return;
    const sel = String(window.getSelection && window.getSelection() || '').trim();
    if (!sel || !boardId || host?.hidden) return;
    e.preventDefault();
    add(sel);
    if (!open) { open = true; render(); if (students == null) loadStudents(); }
  });

  /* Показываем только владельцу открытой доски: тому, кто ведёт урок. */
  function sync() {
    const id = G('currentBoardId');
    const owner = G('isOwner');
    const token = G('authToken');
    const show = !!(id && owner && token) && !document.body.classList.contains('board-presenting');
    ensureHost();
    if (show && id !== boardId) { boardId = id; students = null; picked = new Set(); load(); render(); }
    host.hidden = !show;
  }
  setInterval(sync, 1500);
  setTimeout(sync, 400);
})();
