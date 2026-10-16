/* Community: what makes it a community, not a shelf (16.10.2026, ТЗ v1.0).
 *
 *   Recommendations that say why   (All tab; "Not relevant", "Show fewer like this")
 *   Requests                       (a weak search becomes one; "I need this too"; fill it)
 *   Collections and curators       ("My B1 Survival Kit"; follow a curator)
 *   Author pages                   (aggregates only: lessons, copies, used in classes…)
 *   The author's own tools         (this week's digest, notification choices)
 *   A cover for everything         (a coloured, typed cover where there is no image)
 *
 * Built on window.CM from community-plus.js. Every number comes from the server;
 * nothing here invents one.
 */
(function () {
  const CM = window.CM; if (!CM) return;
  const { $, json } = CM;
  const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const signedIn = () => !!token;
  const first = n => String(n || 'A teacher').trim().split(/\s+/)[0];
  const ago = iso => { const t = Date.parse(iso || ''); if (!t) return ''; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); };
  const day = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  const ava = (a, name) => /^\p{Extended_Pictographic}/u.test(String(a || '')) ? esc(a) : esc(getAuthorInitials(name));
  const call = async (path, method, body) => { const r = await api(path, { method: method || 'GET', body }).catch(() => null); return { r, d: r ? await json(r) : {} }; };

  /* ══ Recommendations (All tab) ═════════════════════════════════════════ */
  let recs = null, recsLoading = false;
  async function loadRecs() {
    if (!signedIn() || recsLoading || recs) return;
    recsLoading = true;
    const { r, d } = await call('/api/community/recommendations');
    recs = r && r.ok ? d.sections || [] : [];
    recsLoading = false;
    paintRecs();
  }
  function recsBox() {
    let box = $('cm-recs');
    if (!box) { box = document.createElement('div'); box.id = 'cm-recs'; $('all-count').before(box); }
    return box;
  }
  function paintRecs() {
    const box = recsBox();
    // a search or a filter means the teacher knows what they want: no suggestions on top of it
    if (CM.anyFilter() || !recs || !recs.length) { box.innerHTML = ''; return; }
    box.innerHTML = recs.map(s => `<section class="cm-rec" data-sec="${esc(s.key)}">
        <div class="cm-rec-h"><h2>${esc(s.title)}</h2>
          <button type="button" class="cm-why" data-why="${esc(s.key)}" aria-expanded="false">Why am I seeing this?</button></div>
        <p class="cm-rec-why" hidden>${esc(s.why)}</p>
        <div class="cm-rec-row">${s.items.map(a => CM.toPost(a)).map(p => communityCardHtml(p, { rec: s.key })).join('')}</div>
      </section>`).join('');
  }
  CM.afterAll = () => { if (signedIn()) { loadRecs(); paintRecs(); } else recsBox().innerHTML = ''; };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-why]'); if (!b) return;
    const p = b.closest('.cm-rec').querySelector('.cm-rec-why');
    p.hidden = !p.hidden; b.setAttribute('aria-expanded', String(!p.hidden));
  });
  /* "Not relevant" / "Show fewer like this": steers what comes next, with Undo */
  CM.steer = async (p, kind, recKey) => {
    const { r } = await call('/api/community/signals', 'POST', { assignmentId: p.serverId, kind, reason: recKey });
    if (!r || !r.ok) return toast('Could not save that');
    const gone = a => kind === 'not_relevant' ? a.id === p.serverId : (a.kind === p.kind && (a.skill || '') === (p.skill || ''));
    (recs || []).forEach(s => { s.items = s.items.filter(a => !gone(a)); });
    recs = (recs || []).filter(s => s.items.length >= (s.key === 'followed' || s.key === 'editors_pick' ? 1 : 3));
    paintRecs();
    CM.snack(kind === 'not_relevant' ? 'Hidden from your suggestions' : `You will see fewer ${(CM.KIND_LABEL[p.kind] || 'lesson').toLowerCase()}s${p.skill ? ' for ' + p.skill.toLowerCase() : ''} like this`,
      [{ label: 'Undo', onClick: async () => { await call('/api/community/signals', 'POST', { assignmentId: p.serverId, kind, undo: true }); recs = null; CM.closeSnack(); loadRecs(); } }]);
  };

  /* ══ Collections ═══════════════════════════════════════════════════════ */
  let colFilter = 'all', cols = null, colSearch = '';
  async function loadCollections() {
    const q = new URLSearchParams();
    if (colFilter === 'editorial') q.set('editorial', '1');
    if (colFilter === 'following') q.set('following', '1');
    if (colFilter === 'mine') q.set('mine', '1');
    const box = $('collections-grid'); box.innerHTML = '<div class="skeleton-card"></div>';
    const { r, d } = await call('/api/community/collections?' + q);
    cols = r && r.ok ? d.collections || [] : [];
    paintCollections();
  }
  function colCard(c) {
    return `<article class="cm-col" data-col="${esc(c.id)}" tabindex="0">
      <div class="cm-col-top"><span class="cm-col-n">${c.items}</span><span class="cm-col-t">${c.items === 1 ? 'material' : 'materials'}</span>${c.editorial ? '<span class="cm-badge editor">★ Editor\'s pick</span>' : ''}${!c.is_public ? '<span class="cm-badge gone">Private</span>' : ''}</div>
      <h3>${esc(c.title)}</h3>
      ${c.description ? `<p>${esc(c.description)}</p>` : ''}
      <div class="cm-col-by"><span class="cm-ava" aria-hidden="true">${ava(c.owner_avatar, c.owner_name)}</span><button type="button" class="cm-author" data-cm-author="${esc(c.owner_id)}">${esc(c.owner_name)}${c.owner_team ? ' <span class="cm-team">✓</span>' : ''}</button>
        ${c.followers ? `<span class="cm-col-f">${pl(c.followers, 'follower', 'followers')}</span>` : ''}
        ${c.is_mine ? '' : `<button type="button" class="cm-btn${c.following ? '' : ' main'} cm-follow" data-follow="${esc(c.owner_id)}" data-on="${c.following ? 1 : 0}">${c.following ? 'Following' : 'Follow'}</button>`}</div>
    </article>`;
  }
  function paintCollections() {
    const box = $('collections-grid'); if (!box || !cols) return;
    const q = (CM.val('board-search') || '').trim().toLowerCase();
    const list = cols.filter(c => !q || [c.title, c.description, c.owner_name].join(' ').toLowerCase().includes(q));
    document.querySelectorAll('[data-colf]').forEach(b => b.classList.toggle('on', b.dataset.colf === colFilter));
    box.innerHTML = list.length ? list.map(colCard).join('')
      : `<div class="cm-empty"><b>${colFilter === 'mine' ? 'You have no collections yet.' : colFilter === 'following' ? 'You follow no curators yet.' : 'No collections here yet.'}</b><span>${colFilter === 'following' ? 'Follow a teacher from a collection or from their page, and their new materials gather here.' : 'A collection is a handful of the best materials for one job - "B1 Survival Kit". Add a material from its ⋯ menu.'}</span>${signedIn() && colFilter !== 'following' ? '<button class="btn lime" type="button" data-newcol="1">＋ New collection</button>' : ''}</div>`;
  }
  CM.extraTabs.set('collections', { mark: 'collections', searchOnly: true, show() { loadCollections(); }, render: paintCollections });
  document.addEventListener('click', async e => {
    const f = e.target.closest && e.target.closest('[data-colf]');
    if (f) { colFilter = f.dataset.colf; return loadCollections(); }
    if (e.target.closest && e.target.closest('[data-newcol]')) return newCollectionDialog();
    const fol = e.target.closest && e.target.closest('[data-follow]');
    if (fol) { e.stopPropagation(); return follow(fol); }
    const au = e.target.closest && e.target.closest('[data-cm-author]');
    if (au) { e.stopPropagation(); return switchCommTab('author=' + au.dataset.cmAuthor); }
    const c = e.target.closest && e.target.closest('.cm-col[data-col]');
    if (c) switchCommTab('collection=' + c.dataset.col);
  });
  async function follow(btn) {
    if (await CM.needSignIn()) return;
    const on = btn.dataset.on !== '1';
    const { r, d } = await call(`/api/community/curators/${encodeURIComponent(btn.dataset.follow)}/follow`, 'POST', { on });
    if (!r || !r.ok) return toast(d.error || 'Could not follow');
    document.querySelectorAll(`[data-follow="${btn.dataset.follow}"]`).forEach(b => { b.dataset.on = on ? '1' : '0'; b.textContent = on ? 'Following' : 'Follow'; b.classList.toggle('main', !on); });
    toast(on ? '✓ You follow this teacher - new collections and materials reach you' : 'Unfollowed');
    recs = null; if (cols) cols.forEach(c => { if (c.owner_id === btn.dataset.follow) c.following = on; });
    if (authorData && authorData.author.id === btn.dataset.follow) { authorData.following = on; authorData.followers = d.followers; paintAuthor(); }
  }

  /* one collection: its materials, in the curator's order */
  let colOpen = null;
  async function loadCollection(id) {
    const box = $('collection-view'); box.innerHTML = '<div class="skeleton-card"></div>';
    const { r, d } = await call('/api/community/collections/' + encodeURIComponent(id));
    if (!r || !r.ok) { box.innerHTML = '<div class="cm-empty"><b>This collection is not available.</b><span>It may be private, or its owner removed it.</span><button class="btn ghost" type="button" onclick="switchCommTab(\'collections\')">Back to collections</button></div>'; return; }
    colOpen = d; paintCollection();
  }
  function paintCollection() {
    const box = $('collection-view'); if (!box || !colOpen) return;
    const { collection: c, items } = colOpen;
    const posts = items.map(a => CM.toPost(a));
    box.innerHTML = `<button type="button" class="cm-back" onclick="switchCommTab('collections')">← Collections</button>
      <header class="cm-pg-head">
        <div><h1>${esc(c.title)}</h1>${c.description ? `<p>${esc(c.description)}</p>` : ''}
          <div class="cm-col-by"><span class="cm-ava" aria-hidden="true">${ava(c.owner_avatar, c.owner_name)}</span><button type="button" class="cm-author" data-cm-author="${esc(c.owner_id)}">Curated by ${esc(c.owner_name)}${c.owner_team ? ' <span class="cm-team">✓</span>' : ''}</button>
            ${c.editorial ? '<span class="cm-badge editor">★ Editor\'s pick</span>' : ''}${c.followers ? `<span class="cm-col-f">${pl(c.followers, 'follower', 'followers')}</span>` : ''}</div></div>
        <div class="cm-pg-act">${c.is_mine ? `<button type="button" class="cm-btn" data-col-edit="1">Rename</button><button type="button" class="cm-btn" data-col-vis="1">${c.is_public ? 'Make private' : 'Make public'}</button><button type="button" class="cm-btn" data-col-del="1">Delete</button>`
          : `<button type="button" class="cm-btn${c.following ? '' : ' main'} cm-follow" data-follow="${esc(c.owner_id)}" data-on="${c.following ? 1 : 0}">${c.following ? 'Following' : 'Follow ' + esc(first(c.owner_name))}</button>`}</div>
      </header>
      <section class="grid cm-grid">${posts.length ? posts.map(p => `${communityCardHtml(p)}`).join('') : '<div class="cm-empty"><b>Nothing in here yet.</b><span>Add a material from its ⋯ menu → Add to collection.</span></div>'}</section>`;
    if (c.is_mine) box.querySelectorAll('.cm-card').forEach(card => {
      const p = CM.postById(card.dataset.post);
      card.insertAdjacentHTML('beforeend', `<button type="button" class="cm-rm" data-col-rm="${esc(p.serverId)}" title="Remove from this collection" aria-label="Remove from this collection">✕</button>`);
    });
  }
  CM.extraTabs.set('collection', { mark: 'collections', noToolbar: true, show: id => loadCollection(id) });
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-col-edit],[data-col-vis],[data-col-del],[data-col-rm]'); if (!t || !colOpen) return;
    const c = colOpen.collection;
    if (t.dataset.colRm !== undefined) { await call(`/api/community/collections/${c.id}/items/${encodeURIComponent(t.dataset.colRm)}`, 'DELETE'); return loadCollection(c.id); }
    if (t.dataset.colEdit !== undefined) {
      const title = prompt('Name of the collection', c.title); if (!title || title.trim().length < 3) return;
      const { r, d } = await call(`/api/community/collections/${c.id}`, 'PATCH', { title }); toast(r && r.ok ? 'Renamed' : (d.error || 'Could not rename')); return loadCollection(c.id);
    }
    if (t.dataset.colVis !== undefined) { await call(`/api/community/collections/${c.id}`, 'PATCH', { is_public: !c.is_public }); toast(c.is_public ? 'Only you can see it now' : 'Public - teachers can find and follow it'); return loadCollection(c.id); }
    if (t.dataset.colDel !== undefined) { if (!confirm('Delete this collection? The materials in it are not touched.')) return; await call(`/api/community/collections/${c.id}`, 'DELETE'); toast('Collection deleted'); switchCommTab('collections'); }
  });

  function newCollectionDialog(p) {
    if (!signedIn()) return toast('Sign in to make a collection');
    const card = CM.openDlg(`<div class="cm-dlg-h"><div><b>New collection</b><small>A few of the best materials for one job</small></div><button type="button" class="cm-pv-x" data-d="close" aria-label="Close">✕</button></div>
      <label class="cm-fld"><span>Name</span><input class="cm-pick-q" id="cm-col-t" maxlength="120" placeholder="B1 Survival Kit" aria-label="Name"></label>
      <label class="cm-fld"><span>What is it for? (optional)</span><textarea class="cm-report-note" id="cm-col-d" maxlength="500" placeholder="The ten things a B1 student needs to get by abroad"></textarea></label>
      <label class="cm-check"><input type="checkbox" id="cm-col-p" checked> Public - teachers can find it and follow you</label>
      <div class="cm-dlg-err" role="alert" hidden></div>
      <div class="cm-report-row"><button type="button" class="cm-btn" data-d="close">Cancel</button><button type="button" class="cm-btn main" data-d="make">Create${p ? ' and add this' : ''}</button></div>`);
    card.querySelector('#cm-col-t').focus();
    card.addEventListener('click', async e => {
      const d = e.target.closest('[data-d]')?.dataset.d;
      if (d === 'close') return CM.closeDlg();
      if (d !== 'make') return;
      const err = card.querySelector('.cm-dlg-err');
      CM.busy(e.target, 'Creating…');
      const { r, d: dd } = await call('/api/community/collections', 'POST', { title: card.querySelector('#cm-col-t').value, description: card.querySelector('#cm-col-d').value, is_public: card.querySelector('#cm-col-p').checked, assignmentId: p && p.serverId });
      CM.busy(e.target, null);
      if (!r || !r.ok) { err.hidden = false; err.textContent = dd.error || 'Could not create it'; return; }
      CM.closeDlg();
      CM.snack(p ? `✓ Added to "${dd.collection.title}"` : `✓ "${dd.collection.title}" created`, [{ label: 'Open', onClick: () => { CM.closeSnack(); switchCommTab('collection=' + dd.collection.id); } }]);
    });
  }
  /* ⋯ → Add to collection: tick the ones it belongs in */
  CM.collectMenu = async (p, anchor) => {
    if (await CM.needSignIn()) return;
    const m = CM.openPop(anchor, '<div class="cm-pick-h">Add to a collection</div><div class="cm-pick-list"><div class="cm-pick-empty">Loading…</div></div>');
    m.classList.add('is-picker'); CM.placePop();
    const { r, d } = await call('/api/community/my-collections?assignmentId=' + encodeURIComponent(p.serverId));
    if (CM.pop() !== m) return;
    const list = r && r.ok ? d.collections : [];
    m.querySelector('.cm-pick-list').innerHTML = (list.length ? list.map(c => `<label class="cm-reason"><input type="checkbox" data-cid="${esc(c.id)}" ${c.has ? 'checked' : ''}><span><b>${esc(c.title)}</b><small>${pl(c.items, 'material', 'materials')}${c.is_public ? '' : ' · private'}</small></span></label>`).join('') : '<div class="cm-pick-empty">No collections yet.</div>')
      + '<button type="button" class="cm-pop-item" data-newcol-p="1"><span>＋</span><span><b>New collection…</b></span></button>';
    CM.placePop();
    m.addEventListener('change', async e => {
      const cid = e.target.dataset.cid; if (!cid) return;
      const on = e.target.checked;
      const { r: rr, d: dd } = on ? await call(`/api/community/collections/${cid}/items`, 'POST', { assignmentId: p.serverId }) : await call(`/api/community/collections/${cid}/items/${encodeURIComponent(p.serverId)}`, 'DELETE');
      if (!rr || !rr.ok) { e.target.checked = !on; return toast(dd.error || 'Could not change the collection'); }
      toast(on ? '✓ Added to the collection' : 'Removed from the collection');
    });
    m.addEventListener('click', e => { if (e.target.closest('[data-newcol-p]')) { CM.closePop(); newCollectionDialog(p); } });
  };

  /* ⋯ → Remixes: where it went, where it came from */
  CM.remixMenu = async (p, anchor) => {
    const m = CM.openPop(anchor, '<div class="cm-pick-h">Remixes</div><div class="cm-pick-list"><div class="cm-pick-empty">Loading…</div></div>');
    m.classList.add('is-picker', 'is-wide'); CM.placePop();
    const { r, d } = await call('/api/community/remixes/' + encodeURIComponent(p.serverId));
    if (CM.pop() !== m || !r || !r.ok) return;
    const up = (d.lineage || []).map(l => `<button type="button" class="cm-pick" data-open="${esc(l.id || '')}" ${l.available ? '' : 'disabled'}><span class="cm-pick-ava">↑</span><span class="cm-pick-name">${esc(l.title || 'a lesson')}<small>by ${esc(l.author || 'a teacher')}${l.available ? '' : ' · not available any more'}</small></span></button>`).join('');
    const down = (d.remixed_by || []).map(k => `<button type="button" class="cm-pick" data-open="${esc(k.id)}"><span class="cm-pick-ava">↳</span><span class="cm-pick-name">${esc(k.title)}<small>by ${esc(k.author_name)}${k.remix_count ? ` · ${pl(k.remix_count, 'remix', 'remixes')} of its own` : ''}</small></span></button>`).join('');
    m.querySelector('.cm-pick-list').innerHTML = (d.line ? `<div class="cm-pick-sub">${esc(d.line)}</div>` : '') + (up ? `<div class="cm-pick-sub">Came from</div>${up}` : '') + (down ? `<div class="cm-pick-sub">Adapted by</div>${down}` : '') || '<div class="cm-pick-empty">No remixes yet.</div>';
    CM.placePop();
    m.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b && b.dataset.open) { CM.closePop(); CM.openById(b.dataset.open); } });
  };
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('[data-cm="remix-source"]'); if (a && !a.closest('.cm-card') && !a.closest('.cm-pv')) { e.preventDefault(); CM.openById(a.dataset.rid); } });

  /* ══ Author page ═══════════════════════════════════════════════════════ */
  let authorData = null;
  async function loadAuthor(id) {
    const box = $('author-view'); box.innerHTML = '<div class="skeleton-card"></div>';
    const { r, d } = await call('/api/community/authors/' + encodeURIComponent(id));
    if (!r || !r.ok) { box.innerHTML = '<div class="cm-empty"><b>This page is not available.</b><button class="btn ghost" type="button" onclick="switchCommTab(\'all\')">Back to Community</button></div>'; return; }
    authorData = d; paintAuthor();
  }
  function paintAuthor() {
    const box = $('author-view'); if (!box || !authorData) return;
    const { author: a, stats: s, publications, collections } = authorData;
    const tile = (n, label, hint) => `<div class="cm-stat" ${hint ? `title="${esc(hint)}"` : ''}><b>${n}</b><span>${label}</span></div>`;
    const posts = publications.map(x => CM.toPost(x));
    box.innerHTML = `<button type="button" class="cm-back" onclick="history.length > 1 ? history.back() : switchCommTab('all')">← Back</button>
      <header class="cm-pg-head cm-author-head">
        <span class="cm-ava cm-ava-xl" aria-hidden="true">${ava(a.avatar, a.name)}</span>
        <div><h1>${esc(a.name)}${a.team ? ' <span class="cm-team cm-team-l" title="Official TeachEd Team profile">✓ TeachEd Team</span>' : ''}</h1>
          ${a.bio ? `<p>${esc(a.bio)}</p>` : a.is_me ? '<p class="cm-muted">Add a line about what you teach - it shows on your cards.</p>' : ''}
          <div class="cm-col-f">${authorData.followers ? pl(authorData.followers, 'follower', 'followers') : 'No followers yet'}${s.requests_helped ? ` · <span class="cm-hero" title="Resources marked helpful on teachers' requests">🦸 Request hero × ${s.requests_helped}</span>` : ''}</div></div>
        <div class="cm-pg-act">${a.is_me ? '<button type="button" class="cm-btn" data-bio="1">Edit about</button>' : `<button type="button" class="cm-btn${authorData.following ? '' : ' main'} cm-follow" data-follow="${esc(a.id)}" data-on="${authorData.following ? 1 : 0}">${authorData.following ? 'Following' : 'Follow'}</button>`}</div>
      </header>
      <div class="cm-stats">
        ${tile(s.publications, s.publications === 1 ? 'material shared' : 'materials shared')}
        ${tile(s.copies, 'copies by teachers', 'Unique teachers who made their own copy')}
        ${tile(s.used_in_classes, 'used in classes', 'Lessons in which a teacher really used their materials with students')}
        ${tile(s.students_reached, 'students reached', 'Students who were in a lesson where their material was used - only a count')}
        ${tile(s.remixes, s.remixes === 1 ? 'remix' : 'remixes', 'Teachers who adapted their materials and shared their own version')}
      </div>
      ${collections.length ? `<div class="cm-sub-h">Collections</div><div class="grid cm-cols">${collections.map(c => colCard({ ...c, owner_id: a.id, owner_name: a.name, owner_avatar: a.avatar, owner_team: a.team, is_public: true, is_mine: true, followers: 0 })).join('')}</div>` : ''}
      <div class="cm-sub-h">Shared by ${esc(first(a.name))}</div>
      <section class="grid cm-grid">${posts.length ? posts.map(p => communityCardHtml(p)).join('') : '<div class="cm-empty"><b>Nothing shared yet.</b></div>'}</section>`;
  }
  CM.extraTabs.set('author', { mark: '', noToolbar: true, show: id => loadAuthor(id) });
  document.addEventListener('click', async e => {
    if (!(e.target.closest && e.target.closest('[data-bio]')) || !authorData) return;
    const bio = prompt('A line about you and what you teach', authorData.author.bio || '');
    if (bio === null) return;
    const { r } = await call('/api/community/profile', 'PUT', { bio });
    if (r && r.ok) { authorData.author.bio = bio.trim().slice(0, 400); paintAuthor(); toast('Saved'); } else toast('Could not save');
  });

  /* ══ My publications: this week, and how I am told ═════════════════════ */
  CM.loadAuthorTools = async () => {
    const box = $('pubs-tools'); if (!box || !signedIn()) return;
    const [dg, pf, me] = await Promise.all([call('/api/community/digest?opened=1'), call('/api/community/prefs'), call('/api/auth/me')]);
    const d = dg.r && dg.r.ok ? dg.d.digest : null, prefs = pf.r && pf.r.ok ? pf.d.prefs : { digest: 'weekly', email_digest: false, email_requests: false };
    const mid = me.r && me.r.ok ? me.d.user && me.d.user.id : CM.myId();
    box.innerHTML = `${d ? `<div class="cm-week"><div><b>This week</b><p>${esc(d.line.replace(/^This week: /, ''))}</p>${d.top ? `<small>Top: ${esc(d.top.title)}${d.change === null ? '' : d.change === 0 ? ' · about the same as last week' : ` · ${d.change > 0 ? 'up' : 'down'} ${Math.abs(d.change)}% on last week`}</small>` : ''}</div></div>` : ''}
      <div class="cm-tools">
        ${mid ? `<a class="cm-btn" href="#author=${esc(mid)}">My author page</a>` : ''}
        <label class="cm-sel">Weekly digest <select id="cm-pref-digest"><option value="weekly" ${prefs.digest === 'weekly' ? 'selected' : ''}>In the app, weekly</option><option value="off" ${prefs.digest === 'off' ? 'selected' : ''}>Off</option></select></label>
        <label class="cm-check"><input type="checkbox" id="cm-pref-email" ${prefs.email_digest ? 'checked' : ''}> Also email me the digest</label>
        <label class="cm-check"><input type="checkbox" id="cm-pref-req" ${prefs.email_requests ? 'checked' : ''}> Email me when my request is answered</label>
      </div>`;
  };
  document.addEventListener('change', async e => {
    if (!e.target.matches || !e.target.matches('#cm-pref-digest, #cm-pref-email, #cm-pref-req')) return;
    const { r } = await call('/api/community/prefs', 'PUT', { digest: $('cm-pref-digest').value, email_digest: $('cm-pref-email').checked, email_requests: $('cm-pref-req').checked });
    toast(r && r.ok ? 'Saved' : 'Could not save');
  });

  /* ══ Requests ══════════════════════════════════════════════════════════ */
  let reqs = null, reqFilter = 'open', reqOpen = new Set();
  const FORMAT = { space: 'Space', studio: 'Studio', game: 'Game', any: 'Any format' };
  async function loadRequests() {
    const box = $('requests-list'); box.innerHTML = '<div class="skeleton-card"></div>';
    const { r, d } = await call(`/api/community/requests?status=${encodeURIComponent(reqFilter)}`);
    reqs = r && r.ok ? d.requests || [] : [];
    paintRequests();
  }
  function reqCard(q) {
    const f = q.filters || {};
    const chips = [f.level, f.skill, f.language, f.age, q.format !== 'any' ? FORMAT[q.format] : ''].filter(Boolean).map(x => `<span class="cm-chip">${esc(x)}</span>`).join('');
    const status = q.status === 'fulfilled' ? '<span class="cm-badge ok">Answered</span>' : q.status === 'expired' ? '<span class="cm-badge gone">Expired</span>' : q.status === 'closed' ? '<span class="cm-badge gone">Closed</span>' : '';
    const open = q.status === 'open' || q.status === 'fulfilled';
    return `<article class="cm-req" data-req="${esc(q.id)}">
      <div class="cm-req-main">
        <div class="cm-req-top"><h3>${esc(q.query)}</h3>${status}</div>
        ${chips ? `<div class="cm-chips">${chips}</div>` : ''}
        ${q.details ? `<p>${esc(q.details)}</p>` : ''}
        <div class="cm-req-by"><span class="cm-ava" aria-hidden="true">${ava(q.requester_avatar, q.requester_name)}</span>${esc(first(q.requester_name))} · ${esc(ago(q.created_at))}${q.needed_by ? ` · needed by ${esc(day(q.needed_by))}` : ''}</div>
      </div>
      <div class="cm-req-act">
        ${open && q.status === 'open' ? `<button type="button" class="cm-btn${q.voted ? ' on' : ''}" data-vote="${esc(q.id)}" aria-pressed="${q.voted}">${q.voted ? '✓ ' : ''}I need this too${q.votes ? ` · ${q.votes}` : ''}</button>` : (q.votes ? `<span class="cm-muted">${pl(q.votes, 'teacher needed', 'teachers needed')} this</span>` : '')}
        ${open && !q.is_mine ? `<button type="button" class="cm-btn main" data-fill="${esc(q.id)}">Fill this request</button>` : ''}
        ${q.answers ? `<button type="button" class="cm-btn" data-ans="${esc(q.id)}" aria-expanded="${reqOpen.has(q.id)}">${pl(q.answers, 'answer', 'answers')}</button>` : ''}
        ${q.is_mine && open ? `<button type="button" class="cm-btn" data-reqclose="${esc(q.id)}">Close request</button>` : ''}
      </div>
      <div class="cm-req-ans" data-ansbox="${esc(q.id)}" ${reqOpen.has(q.id) ? '' : 'hidden'}></div>
    </article>`;
  }
  function paintRequests() {
    const box = $('requests-list'); if (!box || !reqs) return;
    document.querySelectorAll('[data-reqf]').forEach(b => b.classList.toggle('on', b.dataset.reqf === reqFilter));
    const q = (CM.val('board-search') || '').trim().toLowerCase();
    const list = reqs.filter(r => !q || [r.query, r.details].join(' ').toLowerCase().includes(q));
    box.innerHTML = list.length ? list.map(reqCard).join('')
      : `<div class="cm-empty"><b>${reqFilter === 'mine' ? 'You have not asked for anything yet.' : reqFilter === 'helped' ? 'You have not answered a request yet.' : 'No requests here.'}</b><span>${reqFilter === 'open' ? 'When a search finds too little, "Post a request" tells teachers what is missing.' : 'Requests you ' + (reqFilter === 'mine' ? 'post' : 'answer') + ' appear here.'}</span>${signedIn() ? '<button class="btn lime" type="button" data-newreq="1">＋ Post a request</button>' : ''}</div>`;
    reqOpen.forEach(id => paintAnswers(id));
  }
  CM.extraTabs.set('requests', { mark: 'requests', searchOnly: true, show() { loadRequests(); }, render: paintRequests });

  async function paintAnswers(id) {
    const box = document.querySelector(`[data-ansbox="${id}"]`); if (!box) return;
    const { r, d } = await call('/api/community/requests/' + encodeURIComponent(id));
    if (!r || !r.ok) return;
    const mine = d.request.is_mine;
    box.innerHTML = d.answers.length ? d.answers.map(a => {
      const p = CM.toPost(a);
      return `<div class="cm-ans" data-ans-post="${esc(p.id)}"><div class="cm-ans-card">${communityCardHtml(p)}</div>
        ${mine ? `<button type="button" class="cm-btn${a.helpful ? ' on' : ''}" data-helpful="${esc(a.answer_id)}" data-req="${esc(id)}" data-on="${a.helpful ? 0 : 1}">${a.helpful ? '✓ Helpful' : 'Mark as helpful'}</button>` : a.helpful ? '<span class="cm-badge ok">Marked helpful</span>' : ''}</div>`;
    }).join('') : '<div class="cm-pick-empty">No answers yet.</div>';
  }

  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-vote],[data-fill],[data-ans],[data-reqclose],[data-newreq],[data-reqf],[data-helpful]'); if (!t) return;
    if (t.dataset.reqf) { reqFilter = t.dataset.reqf; return loadRequests(); }
    if (t.dataset.newreq !== undefined) return requestDialog({});
    if (t.dataset.vote) {
      if (await CM.needSignIn()) return;
      const q = reqs.find(x => x.id === t.dataset.vote); const on = !q.voted;
      const { r, d } = await call(`/api/community/requests/${q.id}/vote`, 'POST', { on });
      if (!r || !r.ok) return toast(d.error || 'Could not save');
      q.voted = on; q.votes = d.votes; paintRequests(); return;
    }
    if (t.dataset.ans) { const id = t.dataset.ans; reqOpen.has(id) ? reqOpen.delete(id) : reqOpen.add(id); return paintRequests(); }
    if (t.dataset.reqclose) {
      const { r } = await call(`/api/community/requests/${t.dataset.reqclose}/close`, 'POST'); toast(r && r.ok ? 'Request closed' : 'Could not close it'); return loadRequests();
    }
    if (t.dataset.helpful) {
      const { r, d } = await call(`/api/community/requests/${t.dataset.req}/answers/${t.dataset.helpful}/helpful`, 'POST', { on: t.dataset.on === '1' });
      if (!r || !r.ok) return toast(d.error || 'Could not save'); toast(t.dataset.on === '1' ? 'Thanks - the author is told they helped' : 'Unmarked'); return loadRequests();
    }
    if (t.dataset.fill) return fillMenu(reqs.find(x => x.id === t.dataset.fill), t);
  });

  /* Post a request: prefilled from the search and its filters */
  function requestDialog(pre) {
    if (!signedIn()) return toast('Sign in to post a request');
    const sel = (id, label, opts, v) => `<label class="cm-fld"><span>${label}</span><select id="${id}"><option value="">Any</option>${opts.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
    const card = CM.openDlg(`<div class="cm-dlg-h"><div><b>Post a request</b><small>Tell teachers what is missing. If someone shares it, you are told.</small></div><button type="button" class="cm-pv-x" data-d="close" aria-label="Close">✕</button></div>
      <label class="cm-fld"><span>What do you need?</span><input class="cm-pick-q" id="cm-rq-q" maxlength="200" value="${esc(pre.query || '')}" placeholder="B2 job interview role-plays"></label>
      <div class="cm-fld-row">${sel('cm-rq-lang', 'Language', ['English', 'Ukrainian', 'Polish', 'German', 'French', 'Spanish', 'Other'], CM.val('board-language'))}${sel('cm-rq-level', 'Level', ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Mixed'], CM.val('board-level'))}${sel('cm-rq-age', 'Age', ['Kids', 'Teens', 'Adults'], CM.val('board-age'))}${sel('cm-rq-skill', 'Skill', ['Speaking', 'Grammar', 'Vocabulary', 'Reading', 'Writing', 'Listening', 'Mixed skills'], CM.val('board-skill'))}</div>
      <div class="cm-fld"><span>Format</span><div class="cm-seg" role="radiogroup">${Object.entries(FORMAT).map(([k, v]) => `<label><input type="radio" name="cm-rq-f" value="${k}" ${k === 'any' ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>
      <label class="cm-fld"><span>Details (optional)</span><textarea class="cm-report-note" id="cm-rq-d" maxlength="1000" placeholder="Lesson goal, length, anything it must or must not have"></textarea></label>
      <label class="cm-fld"><span>Needed by (optional)</span><input class="cm-pick-q" id="cm-rq-by" type="date"></label>
      <div class="cm-dlg-err" role="alert" hidden></div>
      <div class="cm-report-row"><button type="button" class="cm-btn" data-d="close">Cancel</button><button type="button" class="cm-btn main" data-d="post">Post request</button></div>`);
    card.querySelector('#cm-rq-q').focus();
    card.addEventListener('click', async e => {
      const d = e.target.closest('[data-d]')?.dataset.d;
      if (d === 'close') return CM.closeDlg();
      if (d !== 'post') return;
      const err = card.querySelector('.cm-dlg-err');
      CM.busy(e.target, 'Posting…');
      const { r, d: dd } = await call('/api/community/requests', 'POST', {
        query: card.querySelector('#cm-rq-q').value, details: card.querySelector('#cm-rq-d').value, needed_by: card.querySelector('#cm-rq-by').value || undefined,
        format: card.querySelector('input[name="cm-rq-f"]:checked').value,
        filters: { language: card.querySelector('#cm-rq-lang').value, level: card.querySelector('#cm-rq-level').value, age: card.querySelector('#cm-rq-age').value, skill: card.querySelector('#cm-rq-skill').value } });
      CM.busy(e.target, null);
      if (!r || !r.ok) { err.hidden = false; err.textContent = dd.error || 'Could not post it'; return; }
      CM.closeDlg();
      toast(dd.duplicate ? 'Someone already asked for this - you are counted in' : '✓ Request posted - teachers can see it now');
      reqFilter = 'mine'; switchCommTab('requests');
    });
  }
  CM.requestDialog = requestDialog;

  /* Fill this request: one of my published resources, or a new one */
  async function fillMenu(q, anchor) {
    if (await CM.needSignIn()) return;
    const m = CM.openPop(anchor, '<div class="cm-pick-h">Share a matching resource</div><div class="cm-pick-list"><div class="cm-pick-empty">Loading…</div></div>');
    m.classList.add('is-picker', 'is-wide'); CM.placePop();
    const { r, d } = await call('/api/library/mine/publications');
    if (CM.pop() !== m) return;
    const mine = (r && r.ok ? d.publications : []).filter(a => a.visibility === 'community' && (a.status || {}).key === 'published');
    m.querySelector('.cm-pick-list').innerHTML = (mine.length ? `<div class="cm-pick-sub">One of yours</div>${mine.map(a => `<button type="button" class="cm-pick" data-share="${esc(a.id)}"><span class="cm-pick-ava">${a.level ? esc(a.level) : '✓'}</span><span class="cm-pick-name">${esc(a.title)}<small>${esc(CM.KIND_LABEL[a.kind] || 'Template')}${a.skill ? ' · ' + esc(a.skill) : ''}</small></span></button>`).join('')}<div class="cm-pick-sub">Or</div>` : '')
      + '<button type="button" class="cm-pop-item" data-new="1"><span>＋</span><span><b>Share a new lesson…</b><small>Publish one, and it is attached to this request</small></span></button>';
    CM.placePop();
    m.addEventListener('click', async e => {
      const s = e.target.closest('[data-share]'), n = e.target.closest('[data-new]');
      if (s) {
        const { r: rr, d: dd } = await call(`/api/community/requests/${q.id}/answers`, 'POST', { assignmentId: s.dataset.share });
        CM.closePop();
        if (!rr || !rr.ok) return toast(dd.error || 'Could not share it');
        toast(dd.already ? 'That one is already shared here' : '✓ Shared - the teacher who asked is told'); loadRequests();
      }
      if (n) { CM.closePop(); fulfilling = { id: q.id, query: q.query }; showFulfillNote(); focusCommunityPublisher(); }
    });
  }
  /* a lesson published for a request is attached to it the moment it is published */
  let fulfilling = null;
  function showFulfillNote() {
    document.getElementById('cm-fulfil')?.remove();
    const card = document.getElementById('share-card'); if (!card || !fulfilling) return;
    const n = document.createElement('div'); n.id = 'cm-fulfil'; n.className = 'cm-fulfil';
    n.innerHTML = `<b>Filling a request</b><span>“${esc(fulfilling.query)}” - when you publish, it is shared there and the teacher who asked is told.</span><button type="button" data-cancel-fill="1">Not now</button>`;
    card.prepend(n);
  }
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-cancel-fill]')) { fulfilling = null; document.getElementById('cm-fulfil')?.remove(); } });
  const origSuccess = showPublisherSuccess;
  window.showPublisherSuccess = showPublisherSuccess = function (post, link, visibility) {   // eslint-disable-line no-global-assign
    origSuccess(post, link, visibility);
    CM.dropPubs?.(); CM.dropSaved?.();
    if (fulfilling && post && post.serverId && visibility === 'community') {
      const f = fulfilling; fulfilling = null; document.getElementById('cm-fulfil')?.remove();
      call(`/api/community/requests/${f.id}/answers`, 'POST', { assignmentId: post.serverId }).then(({ r }) => { if (r && r.ok) toast('✓ Published and shared with the request - the teacher who asked is told'); });
    }
  };

  /* ══ A cover for everything ════════════════════════════════════════════
     Games, vocabularies and templates have no photo; "No image" made them look
     unfinished. Each type gets its own colours and mark, always the same one. */
  const COVER = {
    flashcards:    { a: '#6B42FD', b: '#9F8CE8', ink: '#fff', label: 'Flashcards',   art: '<rect x="14" y="26" width="46" height="32" rx="6" /><rect x="26" y="16" width="46" height="32" rx="6" /><path d="M38 32h22M38 40h14" />' },
    'memory-match': { a: '#3F9FFF', b: '#49F6F0', ink: '#24282C', label: 'Memory match', art: '<rect x="12" y="14" width="26" height="26" rx="6" /><rect x="46" y="14" width="26" height="26" rx="6" /><rect x="12" y="48" width="26" height="26" rx="6" /><rect x="46" y="48" width="26" height="26" rx="6" /><path d="M25 27l0 0M59 61l0 0" />' },
    quiz:          { a: '#FF8C3A', b: '#FFE44D', ink: '#24282C', label: 'Quiz',          art: '<circle cx="42" cy="42" r="28" /><path d="M33 34a9 9 0 1 1 13 8c-3 2-4 4-4 7M42 58v1" />' },
    'word-scramble': { a: '#CDF649', b: '#7FD96B', ink: '#24282C', label: 'Word scramble', art: '<rect x="10" y="30" width="20" height="26" rx="5" /><rect x="34" y="22" width="20" height="26" rx="5" /><rect x="58" y="34" width="20" height="26" rx="5" /><path d="M16 43h8M40 35h8M64 47h8" />' },
    'fill-blank':  { a: '#9F8CE8', b: '#6B42FD', ink: '#fff', label: 'Fill the blank',   art: '<path d="M10 28h70M10 44h26M50 44h30M10 60h50" /><path d="M38 47h10" />' },
    hangman:       { a: '#24282C', b: '#FF4E00', ink: '#fff', label: 'Hangman',       art: '<path d="M14 76h48M26 76V12h34v12" /><circle cx="60" cy="32" r="7" /><path d="M60 39v18M60 45l-9 7M60 45l9 7" />' },
    game:          { a: '#FF4E00', b: '#FFE44D', ink: '#24282C', label: 'Game',          art: '<rect x="8" y="26" width="76" height="40" rx="18" /><path d="M28 38v16M20 46h16M62 42h0M70 50h0" />' },
    quizkind:      { a: '#FF8C3A', b: '#FFE44D', ink: '#24282C', label: 'Quiz',          art: '<circle cx="42" cy="42" r="28" /><path d="M33 34a9 9 0 1 1 13 8c-3 2-4 4-4 7M42 58v1" />' },
    material:      { a: '#886BF3', b: '#CDF649', ink: '#24282C', label: 'Studio',        art: '<rect x="12" y="12" width="60" height="60" rx="10" /><path d="M24 30h36M24 42h36M24 54h22" />' },
    lesson:        { a: '#886BF3', b: '#CDF649', ink: '#24282C', label: 'Studio',        art: '<rect x="12" y="12" width="60" height="60" rx="10" /><path d="M24 30h36M24 42h36M24 54h22" />' },
    other:         { a: '#3F9FFF', b: '#CDF649', ink: '#24282C', label: 'Template',      art: '<rect x="12" y="14" width="26" height="60" rx="6" /><rect x="46" y="14" width="26" height="26" rx="6" /><rect x="46" y="48" width="26" height="26" rx="6" />' },
    words:         { a: '#49F6F0', b: '#3F9FFF', ink: '#24282C', label: 'Vocabulary',    art: '<path d="M14 66V22l26 8 26-8v44l-26-8z" /><path d="M40 30v36" />' },
  };
  const FALLBACK = ['#6B42FD', '#3F9FFF', '#FF8C3A', '#CDF649', '#FF4E00', '#49F6F0', '#9F8CE8'];
  function typedCover(type, title, level, extra) {
    const key = COVER[type] ? type : (type === 'quiz' ? 'quizkind' : /word|vocab|dictionary/i.test(type || '') ? 'words' : null);
    let c = key ? COVER[key] : null;
    if (!c) { // an unknown type still gets its own, stable colours
      const h = Array.from(String(type || title || 'x')).reduce((n, ch) => n + ch.charCodeAt(0), 0);
      c = { a: FALLBACK[h % FALLBACK.length], b: FALLBACK[(h + 3) % FALLBACK.length], ink: '#24282C', label: String(type || 'Material').replace(/[-_]/g, ' '), art: COVER.game.art };
    }
    return `<div class="cm-tcover" style="--a:${c.a};--b:${c.b};--ink:${c.ink}" aria-hidden="true">
      <svg viewBox="0 0 84 84" class="cm-tcover-art" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${c.art}</svg>
      <span class="cm-tcover-k">${esc(c.label)}</span>${level ? `<span class="cm-tcover-l">${esc(level)}</span>` : ''}${extra ? `<span class="cm-tcover-x">${esc(extra)}</span>` : ''}
    </div>`;
  }
  CM.typedCover = typedCover;
  // posts that are not boards and carry no image of their own
  const origCover = postCoverHtml;
  window.postCoverHtml = postCoverHtml = function (post) {   // eslint-disable-line no-global-assign
    if (post && post.kind && post.kind !== 'board' && !post.cover && !post.hasImage) return typedCover(post.kind === 'other' ? 'other' : post.kind, post.title, post.level);
    return origCover(post);
  };

  /* Games: the same tiles, now with a cover and Add to board */
  window.renderCommunityGames = renderCommunityGames = function () {   // eslint-disable-line no-global-assign
    const grid = document.getElementById('games-grid-comm');
    if (!_topicVariantsAdded && !window.TEACHEDOS_VOCAB) {
      ensureVocab().then(() => { expandWithTopicVariants(); renderCommunityGames(); }).catch(() => {});
    } else expandWithTopicVariants();
    const q = (document.getElementById('game-search')?.value || '').trim().toLowerCase();
    const custom = (function () { try { return JSON.parse(localStorage.getItem('teachedos_custom_games') || '[]'); } catch { return []; } })();
    const all = [...COMMUNITY_GAMES, ...custom.map(g => ({ id: g.id, icon: g.icon || 'Game', title: g.title, type: g.gameType, level: g.level || 'Mixed', topic: g.typeName || 'Custom', desc: g.title, tags: g.tags || ['custom'], src: g.gameSrc || 'games/flashcards.html', isCustom: true }))];
    const filtered = all.filter(g => {
      if (_commGamesLevel !== 'All' && g.level !== _commGamesLevel) return false;
      if (q && !g.title.toLowerCase().includes(q) && !(g.tags || []).join(' ').toLowerCase().includes(q) && !(g.topic || '').toLowerCase().includes(q)) return false;
      return true;
    });
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty">No games match your filter. Try a different level or search term.</div>';
      updateCommunityStats(); return;
    }
    grid.innerHTML = filtered.map(g => `
      <article class="game-tile-comm cm-gtile" onclick="addGameToBoard('${esc(g.src)}','${esc(g.title)}')">
        <div class="cm-gcover">${typedCover(g.type, g.title, g.level, g.icon && g.icon.length <= 3 ? g.icon : '')}</div>
        <div class="cm-gbody">
          <div class="cm-gtitle">${esc(g.title)}</div>
          <div class="cm-gdesc">${esc(g.desc)}</div>
          <div class="cm-gtags"><span class="tag" style="background:rgba(205,246,73,.18);color:var(--accent);font-weight:700;">${esc(g.level)}</span><span class="tag">${esc(g.topic)}</span>${g.isCustom ? '<span class="tag" style="background:rgba(205,246,73,.16);color:#5D614B;font-weight:700;">My game</span>' : ''}</div>
          <button class="mini-btn" style="margin-top:8px;" onclick="event.stopPropagation();addGameToBoard('${esc(g.src)}','${esc(g.title)}')">Add to board →</button>
        </div>
      </article>`).join('');
    updateCommunityStats();
  };

  window.openMyCollections = () => { colFilter = 'mine'; switchCommTab('collections'); };

  /* ══ start ═════════════════════════════════════════════════════════════ */
  if (new URLSearchParams(location.search).get('digest') === '1' && !location.hash) location.hash = '#publications';
  CM.ready();
})();
