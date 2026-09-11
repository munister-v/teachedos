/* ══════════════════════ NOTES WIDGET (shared) ══════════════════════
   A compact version of the desktop Notes app (index.html, win-notes /
   scripts/desktop-app.js) for pages that aren't the desktop shell - first
   home: homework.html, so notes written while planning a class don't live
   only in a window that has to be opened separately.

   Same data, not a copy of it: reads and writes the exact same backend
   (/api/notes) and the exact same localStorage fallback key
   (teachedos_notes_v1) the desktop app uses, so a note taken here shows up
   there and back. Only the rendering is separate - the desktop window is a
   draggable macOS-style app among others (Students, Tools, Schedule…) and
   this is one inline card on a page that scrolls; forcing them through one
   DOM/layout would help neither.

   Usage: mountNotesWidget(document.getElementById('notes-widget-host')).
*/
(function () {
  const API_BASE = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:4000'
    : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech')));
  const NOTES_KEY = 'teachedos_notes_v1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  function mountNotesWidget(host) {
    if (!host || host.__notesWidgetMounted) return;
    host.__notesWidgetMounted = true;

    const token = localStorage.getItem('teachedos_token') || '';
    let notes = [];
    let activeId = null;
    let saveTimer = null;
    let loaded = false;

    host.innerHTML = `
      <div class="nw-head">
        <div>
          <div class="nw-eyebrow">Quiet workspace</div>
          <div class="nw-title">Notes that stay with the lesson</div>
        </div>
        <button type="button" class="nw-new">+ New note</button>
      </div>
      <div class="nw-body">
        <div class="nw-list" id="nw-list"></div>
        <div class="nw-editor">
          <div class="nw-toolbar">
            <button type="button" class="nw-tb" data-act="pin" title="Pin note">📌</button>
            <button type="button" class="nw-tb" data-act="del" title="Delete note">🗑</button>
            <span class="nw-status" id="nw-status">ready</span>
          </div>
          <textarea class="nw-ta" id="nw-ta" placeholder="Start writing…&#10;&#10;Lesson prep, student feedback, anything you need to remember."></textarea>
          <div class="nw-foot"><span id="nw-words">0 words</span><span id="nw-autosave">Autosaved locally</span></div>
        </div>
      </div>`;

    const listEl = host.querySelector('#nw-list');
    const taEl = host.querySelector('#nw-ta');
    const statusEl = host.querySelector('#nw-status');
    const wordsEl = host.querySelector('#nw-words');

    function persistLocal() { try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch {} }

    function render() {
      if (!notes.length) {
        listEl.innerHTML = '<div class="nw-item nw-empty">No notes yet - the first one you write here shows up in the desktop Notes app too.</div>';
        taEl.value = '';
        wordsEl.textContent = '0 words';
        statusEl.textContent = 'ready';
        return;
      }
      listEl.innerHTML = notes.map(n => {
        const date = n.updated_at ? new Date(n.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
        return `<div class="nw-item${n.id === activeId ? ' active' : ''}" data-id="${esc(n.id)}">
          <div class="nw-item-title">${n.pinned ? '📌 ' : ''}${esc(n.title || 'Untitled')}</div>
          <div class="nw-item-prev">${esc((n.body || '').slice(0, 50))}</div>
          <div class="nw-item-date">${date}</div>
        </div>`;
      }).join('');
      const active = notes.find(n => n.id === activeId);
      taEl.value = active ? (active.body || '') : '';
      updateWordCount();
    }

    function updateWordCount() {
      const n = taEl.value.trim() ? taEl.value.trim().split(/\s+/).length : 0;
      wordsEl.textContent = n + (n === 1 ? ' word' : ' words');
    }

    function open(id) { activeId = id; render(); taEl.focus(); }

    async function load() {
      if (loaded) return;
      loaded = true;
      try {
        if (!token) throw new Error('local mode');
        const r = await fetch(API_BASE + '/api/notes', { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) throw new Error('notes api unavailable');
        const { notes: fetched } = await r.json();
        notes = Array.isArray(fetched) ? fetched : [];
      } catch {
        try { const s = localStorage.getItem(NOTES_KEY); notes = s ? JSON.parse(s) : []; } catch { notes = []; }
      }
      /* Defensive: the shared store (backend or the desktop app's own
         localStorage fallback) has held a stray null before - neither
         producer filters on write, so read-side is where it has to stop,
         or a single bad entry blanks the whole widget. */
      if (!Array.isArray(notes)) notes = [];
      notes = notes.filter(n => n && typeof n === 'object' && n.id != null);
      if (!activeId && notes.length) activeId = notes[0].id;
      render();
    }

    async function createNote() {
      try {
        if (!token) throw new Error('local mode');
        const r = await fetch(API_BASE + '/api/notes', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Note', body: '' }),
        });
        if (!r.ok) throw new Error('create failed');
        const { note } = await r.json();
        if (!note) throw new Error('malformed response');
        notes.unshift(note);
        activeId = note.id;
        persistLocal();
        render();
        taEl.focus();
        return;
      } catch { /* fall through to local */ }
      const note = { id: 'local_' + Date.now(), title: 'New Note', body: '', pinned: false, updated_at: new Date().toISOString() };
      notes.unshift(note);
      activeId = note.id;
      persistLocal();
      render();
      taEl.focus();
    }

    async function deleteActive() {
      if (!activeId || !confirm('Delete this note?')) return;
      try {
        if (token && !String(activeId).startsWith('local_')) {
          await fetch(API_BASE + '/api/notes/' + activeId, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
        }
      } catch {}
      notes = notes.filter(n => n.id !== activeId);
      activeId = notes[0]?.id || null;
      persistLocal();
      render();
    }

    async function togglePin() {
      const note = notes.find(n => n.id === activeId);
      if (!note) return;
      note.pinned = !note.pinned;
      try {
        if (token && !String(note.id).startsWith('local_')) {
          await fetch(API_BASE + '/api/notes/' + note.id, {
            method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ pinned: note.pinned }),
          });
        }
      } catch {}
      notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
      persistLocal();
      render();
    }

    function autoSave() {
      const note = notes.find(n => n.id === activeId);
      if (!note) return;
      note.body = taEl.value;
      note.title = taEl.value.split('\n')[0]?.trim() || 'Untitled';
      updateWordCount();
      statusEl.textContent = 'editing…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        note.updated_at = new Date().toISOString();
        try {
          if (!token || String(note.id).startsWith('local_')) throw new Error('local mode');
          const r = await fetch(API_BASE + '/api/notes/' + note.id, {
            method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: note.title, body: note.body, pinned: !!note.pinned }),
          });
          if (!r.ok) throw new Error('save failed');
          persistLocal();
          statusEl.textContent = '✓ synced';
        } catch {
          persistLocal();
          statusEl.textContent = '✓ local';
        }
        // Refresh the list's title/preview without stealing focus from the textarea.
        const item = listEl.querySelector(`.nw-item[data-id="${CSS.escape(String(note.id))}"] .nw-item-title`);
        if (item) item.textContent = (note.pinned ? '📌 ' : '') + (note.title || 'Untitled');
        const prev = listEl.querySelector(`.nw-item[data-id="${CSS.escape(String(note.id))}"] .nw-item-prev`);
        if (prev) prev.textContent = (note.body || '').slice(0, 50);
      }, 900);
    }

    host.querySelector('.nw-new').addEventListener('click', createNote);
    host.querySelector('[data-act="pin"]').addEventListener('click', togglePin);
    host.querySelector('[data-act="del"]').addEventListener('click', deleteActive);
    taEl.addEventListener('input', autoSave);
    listEl.addEventListener('click', e => {
      const item = e.target.closest('.nw-item[data-id]');
      if (item) open(item.dataset.id);
    });

    load();
  }

  window.mountNotesWidget = mountNotesWidget;
})();
