/* TeachEd memory on the client (ТЗ «Память TeachEd» §3, part 1).

   The server (/api/memory) is the source of truth; this is its mirror in
   IndexedDB plus a queue of edits made here. A screen reads the mirror at once
   and never waits for the network; an edit goes into the mirror and the queue
   and is pushed in the background (2s after the last edit, on start, when the
   network or the tab comes back). Losing the mirror loses nothing: the next
   sync loads everything again.

   - Conflicts are per field: the newer time wins on the server; a losing local
     value is quietly replaced by the server's. The teacher never sees a dialog.
   - Revoked dossiers (the student was deleted, or handed to another teacher)
     are wiped here at once, together with their queued edits.
   - The mirror belongs to one teacher: signing out, or another account signing
     in, empties it (a shared computer must not keep someone else's dossiers).
   - Several tabs: one sync at a time (Web Locks where the browser has them).

   window.TeachedMemory: ready(), getStyle(), saveStyle(style), getDossier(id),
   saveDossierField(id, field, value), syncNow(), pending(), onChange(fn), clear(). */
(function () {
  'use strict';
  if (window.TeachedMemory) return;

  const API = window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000'
    : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech'));
  const DB_NAME = 'teached-memory', DB_VERSION = 1;
  const FIELDS = ['interests', 'weak_spots', 'goals', 'notes', 'common_mistakes', 'deleted_tag_keys'];
  const TS = { interests: 'interests_updated_at', weak_spots: 'weak_spots_updated_at', goals: 'goals_updated_at', notes: 'notes_updated_at',
    common_mistakes: 'mistakes_updated_at', deleted_tag_keys: 'tags_updated_at' };

  const token = () => { try { return localStorage.getItem('teachedos_token') || ''; } catch (_) { return ''; } };
  const role = () => { try { return localStorage.getItem('teachedos_role') || ''; } catch (_) { return ''; } };
  function teacherOf(t) {
    try { return JSON.parse(atob(String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || ''; } catch (_) { return ''; }
  }

  /* ── IndexedDB, promise-shaped ── */
  let dbp = null;
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('no IndexedDB'));
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains('dossiers')) d.createObjectStore('dossiers', { keyPath: 'student_id' });
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return dbp;
  }
  async function tx(stores, mode, fn) {
    const d = await openDb();
    return new Promise((resolve, reject) => {
      const t = d.transaction(stores, mode);
      const s = Object.fromEntries([].concat(stores).map(n => [n, t.objectStore(n)]));
      let out;
      Promise.resolve(fn(s)).then(v => { out = v; }, reject);
      t.oncomplete = () => resolve(out);
      t.onerror = t.onabort = () => reject(t.error);
    });
  }
  const req = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

  const listeners = new Set();
  const emit = what => listeners.forEach(fn => { try { fn(what); } catch (_) {} });

  /* ── the owner of the mirror ── */
  let readyP = null;
  function ready() {
    if (readyP) return readyP;
    readyP = (async () => {
      const me = role() === 'student' ? '' : teacherOf(token());
      const owner = await tx('meta', 'readonly', s => req(s.meta.get('owner'))).catch(() => null);
      if (owner && owner !== me) await wipe();
      if (me && owner !== me) await tx('meta', 'readwrite', s => { s.meta.put(me, 'owner'); });
      return me;
    })().catch(() => '');
    return readyP;
  }
  async function wipe() {
    await tx(['meta', 'dossiers', 'outbox'], 'readwrite', s => { s.meta.clear(); s.dossiers.clear(); s.outbox.clear(); }).catch(() => {});
    emit({ type: 'cleared' });
  }
  async function clear() { readyP = null; await wipe(); }

  /* ── reads ── */
  async function getStyle() {
    if (!(await ready())) return {};
    const m = await tx('meta', 'readonly', s => req(s.meta.get('style'))).catch(() => null);
    return (m && m.style) || {};
  }
  async function getDossier(id) {
    if (!(await ready()) || !id) return null;
    return tx('dossiers', 'readonly', s => req(s.dossiers.get(String(id)))).catch(() => null);
  }
  async function pending() {
    if (!(await ready())) return 0;
    return tx('outbox', 'readonly', s => req(s.outbox.count())).catch(() => 0);
  }

  /* ── writes: the mirror first, then the queue ── */
  async function saveStyle(style) {
    if (!(await ready())) return;
    const now = new Date().toISOString();
    await tx(['meta', 'outbox'], 'readwrite', async s => {
      const m = (await req(s.meta.get('style'))) || { version: 0 };
      s.meta.put({ ...m, style, style_updated_at: now, dirty: true }, 'style');
      // one style edit in the queue at most: the latest one
      const all = await req(s.outbox.getAll());
      all.filter(e => e.kind === 'style').forEach(e => s.outbox.delete(e.id));
      s.outbox.add({ kind: 'style', updated_at: now });
    });
    emit({ type: 'style' });
    schedule();
  }
  async function saveDossierField(id, field, value) {
    if (!(await ready()) || !id || !FIELDS.includes(field)) return;
    const now = new Date().toISOString();
    const sid = String(id);
    await tx(['dossiers', 'outbox'], 'readwrite', async s => {
      const d = (await req(s.dossiers.get(sid))) || { student_id: sid };
      s.dossiers.put({ ...d, [field]: value, [TS[field]]: now });
      s.outbox.add({ kind: 'dossier', studentId: sid, field, value, updated_at: now });
    });
    emit({ type: 'dossier', id: sid });
    schedule();
  }

  /* ── network ── */
  async function api(method, path, body) {
    const r = await fetch(API + '/api/memory' + path, {
      method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  }

  let timer = null, lastFocusSync = 0, running = null;
  function schedule(ms = 2000) { clearTimeout(timer); timer = setTimeout(() => syncNow(), ms); }

  /* resolves true when the queue went out and the server's changes came in */
  function syncNow() {
    if (running) return running;
    running = (async () => {
      try {
        if (!navigator.onLine || !(await ready()) || !token()) return false;
        const work = () => syncOnce();
        const ok = navigator.locks && navigator.locks.request ? await navigator.locks.request('teached-memory-sync', work) : await work();
        return ok === true;
      } catch (e) { return false; /* offline or the server is restarting: the queue waits for the next try */ }
      finally { running = null; }
    })();
    return running;
  }

  async function syncOnce() {
    const queue = await tx('outbox', 'readonly', s => req(s.outbox.getAll()));
    let changed = false;

    // PUSH the style: on 409 put our edit over the server's once, then accept the server's
    const styleEdits = queue.filter(e => e.kind === 'style');
    if (styleEdits.length) {
      const m = (await tx('meta', 'readonly', s => req(s.meta.get('style')))) || { version: 0, style: {} };
      let base = Number(m.version) || 0, res = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        res = await api('PUT', '/teacher', { style: m.style || {}, base_version: base });
        if (res.status !== 409) break;
        base = Number(res.data.server && res.data.server.version) || 0;
      }
      if (res.status === 200 || res.status === 409) {
        const next = res.status === 200
          ? { ...m, version: res.data.version, dirty: false }
          : { style: res.data.server.style, style_updated_at: res.data.server.style_updated_at, version: res.data.server.version, dirty: false };
        await tx(['meta', 'outbox'], 'readwrite', s => { s.meta.put(next, 'style'); styleEdits.forEach(e => s.outbox.delete(e.id)); });
        changed = changed || res.status === 409;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 401) {
        await tx('outbox', 'readwrite', s => styleEdits.forEach(e => s.outbox.delete(e.id)));   // a bad edit is not retried forever
      }
    }

    // PUSH the dossiers: one PATCH per student, the latest edit of each field
    const byStudent = new Map();
    for (const e of queue.filter(x => x.kind === 'dossier')) {
      if (!byStudent.has(e.studentId)) byStudent.set(e.studentId, []);
      byStudent.get(e.studentId).push(e);
    }
    for (const [sid, edits] of byStudent) {
      const fields = {};
      for (const e of edits) if (!fields[e.field] || fields[e.field].updated_at <= e.updated_at) fields[e.field] = { value: e.value, updated_at: e.updated_at };
      const res = await api('PATCH', `/students/${encodeURIComponent(sid)}/dossier`, { fields });
      if (res.status === 404) { await dropStudent(sid); changed = true; continue; }   // the student is no longer ours
      if (res.status === 200) {
        await tx(['dossiers', 'outbox'], 'readwrite', async s => {
          edits.forEach(e => s.outbox.delete(e.id));
          const rest = (await req(s.outbox.getAll())).filter(e => e.kind === 'dossier' && e.studentId === sid);
          const d = (await req(s.dossiers.get(sid))) || { student_id: sid };
          for (const r of res.data.rejected || []) {
            if (rest.some(e => e.field === r.field)) continue;   // a newer edit made meanwhile goes out next time
            d[r.field] = r.server_value; d[TS[r.field]] = r.server_updated_at;
          }
          d.version = res.data.version;
          s.dossiers.put(d);
        });
        if ((res.data.rejected || []).length) changed = true;
      } else if (res.status >= 400 && res.status < 500 && res.status !== 401) {
        await tx('outbox', 'readwrite', s => edits.forEach(e => s.outbox.delete(e.id)));
      } else return;   // the server is away: try again later, in order
    }

    // PULL: page by page from the server's own cursor - the device clock is never used
    let since = await tx('meta', 'readonly', s => req(s.meta.get('last_sync_at')));
    for (let guard = 0; guard < 500; guard++) {
      const res = await api('GET', '/sync' + (since ? '?since=' + encodeURIComponent(since) : ''));
      if (res.status !== 200) return;
      const d = res.data;
      await tx(['meta', 'dossiers', 'outbox'], 'readwrite', async s => {
        const waiting = await req(s.outbox.getAll());
        if (d.teacher_memory && !waiting.some(e => e.kind === 'style')) s.meta.put({ ...d.teacher_memory, dirty: false }, 'style');
        // revoked first: an id revoked once and then given a new dossier arrives in both lists
        for (const id of d.revoked || []) {
          if ((d.dossiers || []).some(x => x.student_id === id)) continue;
          s.dossiers.delete(id);
          waiting.filter(e => e.kind === 'dossier' && e.studentId === id).forEach(e => s.outbox.delete(e.id));
        }
        for (const server of d.dossiers || []) {
          const mine = (await req(s.dossiers.get(server.student_id))) || {};
          const out = { ...mine, student_id: server.student_id, version: server.version, weak_spot_tags: server.weak_spot_tags };
          for (const f of FIELDS) {
            // a field edited here and not sent yet keeps the local value; everything else follows the server
            if (waiting.some(e => e.kind === 'dossier' && e.studentId === server.student_id && e.field === f)) continue;
            out[f] = server[f]; out[TS[f]] = server[TS[f]];
          }
          s.dossiers.put(out);
        }
        s.meta.put(d.next_since, 'last_sync_at');
      });
      if ((d.dossiers || []).length || (d.revoked || []).length || d.teacher_memory) changed = true;
      since = d.next_since;
      if (!d.has_more) break;
    }
    emit({ type: changed ? 'synced' : 'idle' });   // idle: the queue went out, nothing new came in
    return true;
  }

  async function dropStudent(sid) {
    await tx(['dossiers', 'outbox'], 'readwrite', async s => {
      s.dossiers.delete(sid);
      (await req(s.outbox.getAll())).filter(e => e.kind === 'dossier' && e.studentId === sid).forEach(e => s.outbox.delete(e.id));
    });
  }

  /* ── triggers ── */
  addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastFocusSync < 30000) return;
    lastFocusSync = Date.now();
    syncNow();
  });
  // signed out or another account in another tab: the mirror is not theirs
  addEventListener('storage', e => {
    if (e.key !== 'teachedos_token' && e.key !== null) return;
    readyP = null;
    ready().then(me => { if (!me) clear(); else syncNow(); });
  });

  window.TeachedMemory = {
    ready, getStyle, saveStyle, getDossier, saveDossierField, syncNow, pending, clear,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  ready().then(me => (me ? syncNow() : clear()));
})();
