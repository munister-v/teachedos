/* Community, the teacher's way (16.10.2026).
 *
 * Left: the teacher's own - Saved items (bookmarks and copies) and My
 * publications (likes, copies, status, updates). Above the feed: one row of
 * tabs (All, Spaces & Lessons, Studios & Templates, Vocabularies, Games) and
 * one search with Language, Level, Age and Skill; the feed follows as you type.
 *
 * A card: ❤️ likes, 📥 copies, 🔖 bookmark, ⋯ (link, report) and Copy ▾ -
 * Save to My Boards (a new board of your own) or Insert to Student… (one
 * frame on the student's board, next to where you stopped). A click anywhere
 * else on the card opens a preview of the board; "Use this lesson" there.
 *
 * Copies are the copier's own (backend/routes/library.js): the author
 * deleting or editing the original never reaches them; when the author
 * publishes an update, older copies say "Updated version available".
 *
 * Loaded after community.html's own script; replaces a few of its functions.
 */
(function () {
  const $ = id => document.getElementById(id);
  const signedIn = () => !!token;
  const json = r => r.json().catch(() => ({}));
  const KIND_LABEL = { board: 'Lesson', lesson: 'Studio', quiz: 'Quiz', game: 'Game', material: 'Studio', other: 'Template' };
  const ICON = {
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    copies: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17"/></svg>',
    mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
    caret: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>',
  };

  /* ── data: every server item carries likes, bookmark, copies, version ── */
  const origToPost = assignmentToCommunityPost;
  window.assignmentToCommunityPost = assignmentToCommunityPost = function (a, dataOverride) {   // eslint-disable-line no-global-assign
    const p = origToPost(a, dataOverride);
    return Object.assign(p, {
      kind: a.kind || 'board',
      likeCount: Number(a.like_count) || 0, liked: !!a.liked, saved: !!a.saved, reported: !!a.reported,
      authorId: a.author_id || null, contentUpdatedAt: a.content_updated_at || null, myCopyAt: a.my_copy_at || null,
      // library items (studios, quizzes, games) are not boards: no snapshot to preview
      isSpace: a.kind && a.kind !== 'board' ? false : p.isSpace,
    });
  };
  const libraryPosts = () => (_communityLibrary || []).filter(a => a.kind !== 'board').map(a => assignmentToCommunityPost(a));
  const allPosts = () => [...getCommunityPosts(), ...libraryPosts()];
  const postById = id => allPosts().find(p => String(p.id) === String(id)) || (_extraPosts.get(String(id)) || null);
  const _extraPosts = new Map();   // bookmarks shown in Saved that the feed does not list

  /* ── filters: one search and four refinements for every tab ── */
  const val = id => ($(id) && $(id).value) || '';
  function matches(p) {
    const q = val('board-search').trim().toLowerCase();
    const hay = [p.title, p.desc, p.author, p.level, p.skill, p.language, p.audience, ...(p.tags || [])].join(' ').toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (val('board-level') && p.level !== val('board-level')) return false;
    if (val('board-language') && (p.language || '') !== val('board-language')) return false;
    if (val('board-age') && (p.audience || '') !== val('board-age')) return false;
    if (val('board-skill') && (p.skill || '') !== val('board-skill')) return false;
    return true;
  }
  function sorted(list) {
    const sort = val('board-sort') || 'newest';
    const byDate = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    if (sort === 'popular') return list.sort((a, b) => (b.cloneCount - a.cloneCount) || (b.likeCount - a.likeCount) || byDate(a, b));
    if (sort === 'trending') return list.sort((a, b) => (trendScore(b) + b.likeCount * 0.3) - (trendScore(a) + a.likeCount * 0.3) || byDate(a, b));
    return list.sort(byDate);
  }
  const anyFilter = () => ['board-search', 'board-level', 'board-language', 'board-age', 'board-skill'].some(id => val(id).trim());
  function paintFilterState() {
    document.querySelectorAll('#cm-toolbar .cm-pill select').forEach(sel => sel.closest('.cm-pill').classList.toggle('is-set', sel.id !== 'board-sort' && !!sel.value));
    const clear = $('board-clear'); if (clear) clear.hidden = !anyFilter();
  }

  let currentTab = 'all';
  let searchTimer = null;
  window.cmSearch = function () { clearTimeout(searchTimer); searchTimer = setTimeout(renderTab, 120); };
  function renderTab() {
    paintFilterState();
    if (currentTab === 'all') renderAll();
    else if (currentTab === 'boards') renderCommunity();
    else if (currentTab === 'studios') renderCommunityLibrary();
    else if (currentTab === 'games') { $('game-search').value = val('board-search'); renderCommunityGames(); }
    else if (currentTab === 'worksheets') { $('ws-search').value = val('board-search'); renderWorksheets(); }
    else if (currentTab === 'saved') renderSaved();
    else if (currentTab === 'publications') renderPublications();
  }
  window.clearCommunityFilters = clearCommunityFilters = function () {   // eslint-disable-line no-global-assign
    ['board-search', 'board-level', 'board-language', 'board-age', 'board-skill'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    renderTab();
  };

  // one load at a time: the page start and a tab can both ask for it
  const origLoadLibrary = loadLibrary;
  let libLoading = null;
  window.loadLibrary = loadLibrary = function () {   // eslint-disable-line no-global-assign
    if (!libLoading) libLoading = Promise.resolve(origLoadLibrary()).finally(() => { libLoading = null; });
    return libLoading;
  };

  const TABS = ['all', 'boards', 'studios', 'worksheets', 'games', 'saved', 'publications'];
  window.switchCommTab = switchCommTab = function (tab) {   // eslint-disable-line no-global-assign
    if (tab === 'library') tab = 'studios';
    if (!TABS.includes(tab)) tab = 'all';
    currentTab = tab;
    document.querySelectorAll('.comm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    TABS.forEach(t => { const el = $('tab-' + t); if (el) el.style.display = t === tab ? '' : 'none'; });
    // My space has its own lists; the search row is for the catalog
    const tb = $('cm-toolbar'); if (tb) tb.hidden = tab === 'saved' || tab === 'publications';
    document.querySelectorAll('#cm-toolbar .cm-pill:not(.is-sort)').forEach(p => { p.hidden = tab === 'games' || tab === 'worksheets'; });
    if (tab === 'studios' && !_libraryLoaded) loadLibrary();   // All gets it from the page start (loadBoards)
    if (tab === 'saved') loadSaved();
    if (tab === 'publications') loadPublications();
    try { history.replaceState(null, '', location.pathname + location.search + (tab === 'all' ? '' : '#' + tab)); } catch (_) {}
    renderTab();
  };

  /* ── the card ── */
  const updated = p => p.myCopyAt && p.contentUpdatedAt && Date.parse(p.contentUpdatedAt) > Date.parse(p.myCopyAt);
  const kindBadge = p => p.kind && p.kind !== 'board' ? (KIND_LABEL[p.kind] || 'Template') : (p.isSpace ? 'Space' : 'Lesson');
  window.communityCardHtml = communityCardHtml = function (p, opts = {}) {   // eslint-disable-line no-global-assign
    const id = JSON.stringify(String(p.id)).replace(/"/g, '&quot;');
    const facts = [p.level && p.level !== 'Mixed' ? p.level : (p.level || ''), p.audience || p.skill || ''].filter(Boolean);
    const server = !!p.serverId;
    const canCopy = p.allowCopy !== false;
    const preview = opts.preview;
    return `<article class="cm-card${p.isMine ? ' is-mine' : ''}" data-post="${esc(String(p.id))}">
      <div class="cm-cover">${postCoverHtml(p)}
        <span class="cm-badges"><span class="cm-badge kind-${esc(kindBadge(p).toLowerCase())}">${esc(kindBadge(p))}</span>${updated(p) ? '<span class="cm-badge upd" title="The author published a new version after you copied it">Updated</span>' : ''}${p.isMine ? '<span class="cm-badge mine">🌐 Yours</span>' : ''}</span>
      </div>
      ${p.isMine && !preview ? `<button class="cm-edit-cover" type="button" data-cm="cover">✎ Edit cover</button>` : ''}
      <div class="cm-body">
        <div class="cm-by">
          <span class="cm-ava" aria-hidden="true">${authorAvatarHtml(p)}</span>
          <span class="cm-author">${esc(p.author || 'Teacher')}</span>
          <time class="cm-date">${esc(shortDate(p.createdAt))}</time>
        </div>
        <h3 class="cm-title">${esc(p.title)}</h3>
        <div class="cm-facts">${langFlag(p.language)}${facts.map(f => `<span>${esc(f)}</span>`).join('<i aria-hidden="true">•</i>')}</div>
        ${preview ? '' : `<div class="cm-foot">
          <span class="cm-social">
            <button type="button" class="cm-ic cm-like${p.liked ? ' on' : ''}" data-cm="like" ${server ? '' : 'disabled'} aria-pressed="${p.liked}" title="${p.liked ? 'Unlike' : 'Like'}">${ICON.heart}<b>${p.likeCount || 0}</b></button>
            <span class="cm-ic cm-copies" title="${p.cloneCount || 0} teachers copied it">${ICON.copies}<b>${p.cloneCount || 0}</b></span>
          </span>
          <span class="cm-acts">
            <button type="button" class="cm-ic cm-mark${p.saved ? ' on' : ''}" data-cm="mark" ${server ? '' : 'disabled'} aria-pressed="${p.saved}" title="${p.saved ? 'Saved in My library' : 'Save to My library'}">${ICON.mark}</button>
            <button type="button" class="cm-ic cm-more" data-cm="more" title="More" aria-label="More">${ICON.more}</button>
            ${canCopy ? `<button type="button" class="cm-copy" data-cm="copy" aria-haspopup="menu">Copy ${ICON.caret}</button>` : `<button type="button" class="cm-copy is-view" data-cm="open">View</button>`}
          </span>
        </div>`}
      </div>
    </article>`;
  };

  /* ── tabs ── */
  function emptyHtml(what) {
    return `<div class="cm-empty"><b>Nothing here matches.</b><span>${what}</span>${anyFilter() ? '<button class="btn ghost" type="button" onclick="clearCommunityFilters()">Clear filters</button>' : ''}</div>`;
  }
  function renderAll() {
    const grid = $('all-grid'); if (!grid) return;
    const list = sorted(allPosts().filter(matches));
    setText('all-count', list.length ? `${list.length} ${list.length === 1 ? 'material' : 'materials'} from teachers${anyFilter() ? ' match' : ''}` : '');
    grid.innerHTML = list.length ? list.map(p => communityCardHtml(p)).join('') : emptyHtml('Try another level or language - or share the first one.');
    updateCommunityStats();
  }
  window.renderCommunity = renderCommunity = function () {   // eslint-disable-line no-global-assign
    const grid = $('community-grid'); if (!grid) return;
    const list = sorted(getCommunityPosts().filter(matches));
    setText('community-count', list.length ? `${list.length} ${list.length === 1 ? 'lesson' : 'lessons and spaces'}${anyFilter() ? ' match' : ''}` : '');
    grid.innerHTML = list.length ? list.map(p => communityCardHtml(p)).join('') : emptyHtml('Try another level or language - or share the first one.');
    updateCommunityStats();
    if (currentTab === 'all') renderAll();
  };
  window.renderCommunityLibrary = renderCommunityLibrary = function () {   // eslint-disable-line no-global-assign
    const grid = $('community-library-grid'); if (!grid) return;
    const list = sorted(libraryPosts().filter(matches));
    setText('studios-count', list.length ? `${list.length} ${list.length === 1 ? 'template' : 'templates and exercises'}` : '');
    grid.innerHTML = list.length ? list.map(p => communityCardHtml(p)).join('') : emptyHtml('Exercises, quizzes and studio templates teachers share appear here.');
    updateCommunityStats();
    if (currentTab === 'all') renderAll();
  };
  /* "Not published yet" in My publications: my library items still private. */
  window.renderMyLibrary = renderMyLibrary = function () {   // eslint-disable-line no-global-assign
    const grid = $('my-library-grid'); if (!grid) return;
    const drafts = (_myLibrary || []).filter(a => a.visibility === 'private' && !a.cloned_from);
    grid.innerHTML = drafts.length ? drafts.map(a => libCardHtml(a, { actions:
      `<button class="lib-btn primary" type="button" onclick='publishItem(${JSON.stringify(a.id)})'>Publish</button>` +
      `<button class="lib-icon" type="button" title="Delete" aria-label="Delete ${esc(a.title)}" onclick='deleteItem(${JSON.stringify(a.id)})'>${LIB_ICON_TRASH}</button>` })).join('')
      : '<div class="empty">Everything you saved from a tool is published - or nothing is saved yet.</div>';
  };
  const origStats = updateCommunityStats;
  window.updateCommunityStats = updateCommunityStats = function () {   // eslint-disable-line no-global-assign
    origStats();
    setText('stat-library', libraryPosts().length || '');
  };

  /* ── card actions ── */
  async function needSignIn() { if (signedIn()) return false; toast('Sign in to do this'); return true; }
  async function like(p, btn) {
    if (await needSignIn()) return;
    const on = !p.liked;
    paintLike(p.serverId, on, (p.likeCount || 0) + (on ? 1 : -1));
    const r = await api(`/api/library/${encodeURIComponent(p.serverId)}/like`, { method: 'POST', body: { on } }).catch(() => null);
    const d = r ? await json(r) : {};
    if (!r || !r.ok) { paintLike(p.serverId, !on, p.likeCount); return toast(d.error || 'Could not save'); }
    paintLike(p.serverId, d.liked, d.like_count);
  }
  function setField(serverId, patch) {
    _serverCommunityLessons.forEach(p => { if (p.serverId === serverId) Object.assign(p, patch); });
    (_communityLibrary || []).forEach(a => { if (a.id === serverId) Object.assign(a, { like_count: patch.likeCount ?? a.like_count, liked: patch.liked ?? a.liked, saved: patch.saved ?? a.saved }); });
    _extraPosts.forEach(p => { if (p.serverId === serverId) Object.assign(p, patch); });
  }
  function paintLike(serverId, liked, n) {
    setField(serverId, { liked, likeCount: n });
    document.querySelectorAll('.cm-card').forEach(c => {
      const p = postById(c.dataset.post); if (!p || p.serverId !== serverId) return;
      const b = c.querySelector('.cm-like'); if (!b) return;
      b.classList.toggle('on', liked); b.setAttribute('aria-pressed', liked); b.querySelector('b').textContent = Math.max(0, n);
    });
    document.querySelectorAll(`[data-pv-like="${serverId}"]`).forEach(b => { b.classList.toggle('on', liked); b.querySelector('b').textContent = Math.max(0, n); });
  }
  async function mark(p) {
    if (await needSignIn()) return;
    const on = !p.saved;
    const r = await api(`/api/library/${encodeURIComponent(p.serverId)}/bookmark`, { method: 'POST', body: { on } }).catch(() => null);
    if (!r || !r.ok) return toast('Could not save');
    setField(p.serverId, { saved: on });
    document.querySelectorAll('.cm-card').forEach(c => {
      const q = postById(c.dataset.post); if (!q || q.serverId !== p.serverId) return;
      const b = c.querySelector('.cm-mark'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
    });
    document.querySelectorAll(`[data-pv-mark="${p.serverId}"]`).forEach(b => b.classList.toggle('on', on));
    toast(on ? '🔖 Saved to My library - find it under Saved items' : 'Removed from Saved items');
    savedCache = null; countMine();
  }

  /* Save to My Boards: the server makes a new board of the teacher's own. */
  async function toBoard(p, btn) {
    if (await needSignIn()) return;
    if (!p.serverId) return copyCommunityPost(p.id, btn);   // a lesson kept on this device only
    if (p.kind && p.kind !== 'board') return cloneItem(p.serverId);
    busy(btn, 'Copying…');
    const r = await api(`/api/library/${encodeURIComponent(p.serverId)}/to-board`, { method: 'POST', body: {} }).catch(() => null);
    const d = r ? await json(r) : {};
    busy(btn, null);
    if (!r || !r.ok) return toast(d.error || 'Could not copy');
    p.cloneCount = (p.cloneCount || 0) + (p.isMine ? 0 : 1); p.myCopyAt = new Date().toISOString();
    setField(p.serverId, { cloneCount: p.cloneCount, myCopyAt: p.myCopyAt });
    savedCache = null; countMine();
    closePop(); closePreview();
    toastLink(`✓ "${d.board.name}" is on your boards`, `board.html?id=${encodeURIComponent(d.board.id)}`, 'Open board');
    renderTab();
  }
  /* Insert to Student: one frame on the student's own board. */
  async function insertTo(p, student, btn) {
    busy(btn, 'Adding…');
    const r = await api(`/api/library/${encodeURIComponent(p.serverId)}/insert`, { method: 'POST', body: student.pending ? { journalId: student.journal_id } : { studentId: student.id } }).catch(() => null);
    const d = r ? await json(r) : {};
    busy(btn, null);
    if (!r || !r.ok) return toast(d.error || 'Could not add it');
    p.cloneCount = (p.cloneCount || 0) + (p.isMine ? 0 : 1); p.myCopyAt = new Date().toISOString();
    setField(p.serverId, { cloneCount: p.cloneCount, myCopyAt: p.myCopyAt });
    savedCache = null; countMine();
    closePop(); closePreview();
    const first = String(student.name || 'the student').split(' ')[0];
    toastLink(`✓ Added to ${first}'s board "${d.board.name}" as a new frame`, `board.html?id=${encodeURIComponent(d.board.id)}`, 'Open board');
    renderTab();
  }
  function busy(btn, label) {
    if (!btn) return;
    if (label) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.textContent = label; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }
  function toastLink(text, href, label) {
    const t = $('toast');
    if (!t) return toast(text);
    toast(text);
    setTimeout(() => {
      if (!t.textContent.startsWith(text.slice(0, 12))) return;
      t.innerHTML = `${esc(text)} <a href="${esc(href)}" style="color:#CDF649;font-weight:800;margin-left:8px">${esc(label)} →</a>`;
    }, 0);
  }

  /* ── popovers: Copy menu, ⋯ menu, student picker ── */
  let pop = null;
  function closePop() { pop?.remove(); pop = null; }
  function openPop(anchor, html, wire) {
    closePop();
    pop = document.createElement('div');
    pop.className = 'cm-pop';
    pop.setAttribute('role', 'menu');
    pop.innerHTML = html;
    document.body.appendChild(pop);
    pop._anchor = anchor;
    placePop();
    wire && wire(pop);
    return pop;
  }
  // again when its content grows (the student list arrives later)
  function placePop() {
    if (!pop) return;
    const r = pop._anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.right - w)) + 'px';
    pop.style.top = (r.bottom + 6 + h > innerHeight - 12 ? Math.max(12, r.top - h - 6) : r.bottom + 6) + 'px';
  }
  document.addEventListener('mousedown', e => { if (pop && !pop.contains(e.target) && !e.target.closest('[data-cm="copy"],[data-cm="more"],[data-pv="insert"]')) closePop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (pop) closePop(); else closePreview(); } });
  addEventListener('scroll', () => closePop(), { passive: true });

  function copyMenu(p, anchor) {
    const board = !p.kind || p.kind === 'board';
    openPop(anchor, `
      <button type="button" class="cm-pop-item" data-a="board"><span>📁</span><span><b>${board ? 'Save to My Boards' : 'Save to My library'}</b><small>${board ? 'A new board of your own - edit it as you like' : 'A copy in your library, ready for a board'}</small></span></button>
      ${board && p.serverId ? `<button type="button" class="cm-pop-item" data-a="student"><span>🎯</span><span><b>Insert to Student…</b><small>A new frame on the student's board, next to where you stopped</small></span></button>` : ''}`,
    m => m.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'board') toBoard(p, anchor);
      if (a === 'student') studentPicker(p, anchor);
    }));
  }
  function moreMenu(p, anchor) {
    openPop(anchor, `
      <button type="button" class="cm-pop-item" data-a="link"><span>🔗</span><span><b>Copy link</b></span></button>
      <button type="button" class="cm-pop-item" data-a="open"><span>↗</span><span><b>Open lesson page</b></span></button>
      ${p.serverId && !p.isMine ? `<button type="button" class="cm-pop-item warn" data-a="report" ${p.reported ? 'disabled' : ''}><span>⚑</span><span><b>${p.reported ? 'Reported - thank you' : 'Report a problem'}</b><small>${p.reported ? '' : 'Mistakes, broken parts, not for class'}</small></span></button>` : ''}`,
    m => m.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'link') { closePop(); shareCommunityPost(p.id); }
      if (a === 'open') { closePop(); location.href = buildLessonUrl(p); }
      if (a === 'report') reportDialog(p, anchor);
    }));
  }

  let roster = null;
  async function loadRoster() {
    if (roster) return roster;
    const r = await api('/api/members/roster').catch(() => null);
    roster = r && r.ok ? ((await json(r)).students || []) : [];
    return roster;
  }
  async function studentPicker(p, anchor) {
    if (await needSignIn()) return;
    const m = openPop(anchor, '<div class="cm-pick-h">Insert to whose board?</div><input class="cm-pick-q" type="search" placeholder="Find a student…" aria-label="Find a student"><div class="cm-pick-list"><div class="cm-pick-empty">Loading…</div></div>');
    m.classList.add('is-picker');
    placePop();
    const list = await loadRoster();
    if (pop !== m) return;
    const paint = () => {
      const q = m.querySelector('.cm-pick-q').value.trim().toLowerCase();
      const rows = list.filter(s => !q || (s.name || '').toLowerCase().includes(q))
        .sort((a, b) => (!!a.pending - !!b.pending) || String(a.name).localeCompare(String(b.name)));
      m.querySelector('.cm-pick-list').innerHTML = rows.length ? rows.map(s => `<button type="button" class="cm-pick" data-sid="${esc(String(s.id))}" ${s.pending ? 'disabled title="Not on any of your boards yet"' : ''}>
          <span class="cm-pick-ava">${/^https?:/.test(s.avatar || '') ? '' : esc(s.avatar || getAuthorInitials(s.name))}</span>
          <span class="cm-pick-name">${esc(s.name || 'Student')}<small>${s.pending ? 'not on a board yet' : s.home_board_id ? 'their own board' : `${s.boardCount || 1} board${s.boardCount === 1 ? '' : 's'}`}</small></span></button>`).join('')
        : `<div class="cm-pick-empty">${list.length ? 'Nobody matches.' : 'No students yet - add them on your desktop.'}</div>`;
    };
    paint();
    placePop();
    m.querySelector('.cm-pick-q').addEventListener('input', paint);
    m.querySelector('.cm-pick-q').focus();
    m.addEventListener('click', e => {
      const b = e.target.closest('[data-sid]'); if (!b || b.disabled) return;
      const s = list.find(x => String(x.id) === b.dataset.sid);
      if (s) insertTo(p, s, b);
    });
  }

  function reportDialog(p, anchor) {
    const reasons = [['mistakes', 'Mistakes in the content'], ['broken', 'Something does not work'], ['inappropriate', 'Not suitable for class'], ['copyright', 'Someone else\'s work'], ['spam', 'Spam or an advert'], ['other', 'Something else']];
    const m = openPop(anchor, `<div class="cm-pick-h">What is wrong with it?</div>
      <div class="cm-reasons">${reasons.map(([k, t], i) => `<label><input type="radio" name="cm-reason" value="${k}" ${i ? '' : 'checked'}> ${t}</label>`).join('')}</div>
      <textarea class="cm-report-note" maxlength="500" placeholder="A few words for the author (optional)"></textarea>
      <div class="cm-report-row"><button type="button" class="cm-btn" data-a="cancel">Cancel</button><button type="button" class="cm-btn main" data-a="send">Send report</button></div>
      <p class="cm-report-fine">The author is told. A lesson three teachers report is hidden until they fix it.</p>`);
    m.classList.add('is-picker');
    placePop();
    m.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'cancel') return closePop();
      if (a !== 'send') return;
      if (await needSignIn()) return;
      const reason = m.querySelector('input[name="cm-reason"]:checked')?.value || 'other';
      const r = await api(`/api/library/${encodeURIComponent(p.serverId)}/report`, { method: 'POST', body: { reason, note: m.querySelector('.cm-report-note').value } }).catch(() => null);
      const d = r ? await json(r) : {};
      if (!r || !r.ok) return toast(d.error || 'Could not send');
      setField(p.serverId, { reported: true });
      closePop();
      toast(d.hidden ? 'Thank you - it is hidden until the author fixes it' : 'Thank you - the author will see it');
      if (d.hidden) { _serverCommunityLessons = _serverCommunityLessons.filter(x => x.serverId !== p.serverId); _communityLibrary = (_communityLibrary || []).filter(a2 => a2.id !== p.serverId); renderTab(); }
    });
  }

  /* ── quick preview ── */
  let pv = null;
  function closePreview() { if (!pv) return; pv.remove(); pv = null; document.body.classList.remove('cm-pv-open'); }
  function openPreview(p) {
    closePreview(); closePop();
    const board = (!p.kind || p.kind === 'board') && (p.serverId || p.snapshot);
    const src = board ? (() => { const u = new URL(buildLessonUrl(p)); u.searchParams.set('embed', '1'); return u.href; })() : '';
    const canCopy = p.allowCopy !== false;
    pv = document.createElement('div');
    pv.className = 'cm-pv';
    pv.innerHTML = `<div class="cm-pv-card" role="dialog" aria-modal="true" aria-label="${esc(p.title)}">
      <div class="cm-pv-head">
        <div class="cm-pv-h"><span class="cm-badge kind-${esc(kindBadge(p).toLowerCase())}">${esc(kindBadge(p))}</span>${p.level ? `<span class="cm-badge lvl">${esc(p.level)}</span>` : ''}
          <b>${esc(p.title)}</b><small>by ${esc(p.author || 'Teacher')}${p.cloneCount ? ` · ${p.cloneCount} ${p.cloneCount === 1 ? 'copy' : 'copies'}` : ''}${updated(p) ? ' · <em>updated since your copy</em>' : ''}</small></div>
        <button type="button" class="cm-pv-x" data-pv="close" aria-label="Close">✕</button>
      </div>
      <div class="cm-pv-body">${board
        ? `<iframe src="${esc(src)}" title="Preview of ${esc(p.title)}" loading="eager"></iframe>`
        : `<div class="cm-pv-info"><div class="cm-pv-cover">${postCoverHtml(p)}</div>${p.desc ? `<p>${esc(p.desc)}</p>` : ''}${(p.tags || []).length ? `<div class="lib-tags">${p.tags.map(t => `<span class="lib-tag">${esc(t)}</span>`).join('')}</div>` : ''}</div>`}</div>
      <div class="cm-pv-foot">
        ${p.serverId ? `<button type="button" class="cm-ic cm-like${p.liked ? ' on' : ''}" data-pv="like" data-pv-like="${esc(p.serverId)}">${ICON.heart}<b>${p.likeCount || 0}</b></button>
        <button type="button" class="cm-ic cm-mark${p.saved ? ' on' : ''}" data-pv="mark" data-pv-mark="${esc(p.serverId)}" title="Save to My library">${ICON.mark}</button>` : ''}
        <span class="cm-pv-space"></span>
        ${canCopy && board && p.serverId ? '<button type="button" class="cm-btn" data-pv="insert">🎯 Insert to Student…</button>' : ''}
        ${canCopy ? `<button type="button" class="cm-btn main big" data-pv="use">${board ? 'Use this lesson' : 'Save to My library'}</button>` : '<span class="cm-pv-note">The author keeps this one view-only</span>'}
      </div></div>`;
    document.body.appendChild(pv);
    document.body.classList.add('cm-pv-open');
    pv.addEventListener('click', e => {
      if (e.target === pv) return closePreview();
      const a = e.target.closest('[data-pv]')?.dataset.pv;
      const btn = e.target.closest('[data-pv]');
      if (a === 'close') closePreview();
      if (a === 'like') like(p, btn);
      if (a === 'mark') mark(p);
      if (a === 'use') toBoard(p, btn);
      if (a === 'insert') studentPicker(p, btn);
    });
  }

  /* one click handler for every card */
  document.addEventListener('click', e => {
    const card = e.target.closest && e.target.closest('.cm-card[data-post]');
    if (!card || card.closest('.pub-card, .cm-modal-prev')) return;
    const p = postById(card.dataset.post);
    if (!p) return;
    const act = e.target.closest('[data-cm]');
    const a = act?.dataset.cm;
    if (a) e.preventDefault();
    if (a === 'like') return like(p, act);
    if (a === 'mark') return mark(p);
    if (a === 'more') return moreMenu(p, act);
    if (a === 'copy') return copyMenu(p, act);
    if (a === 'cover') return openCoverEditor(p.id);
    if (a === 'open') return void (location.href = buildLessonUrl(p));
    if (e.target.closest('a,button,input,select,textarea')) return;
    openPreview(p);
  });

  /* ── My space: Saved items ── */
  let savedCache = null;
  async function loadSaved() {
    if (!signedIn()) { $('saved-grid').innerHTML = '<div class="cm-empty"><b>Sign in to keep what you like.</b><span>Bookmarks and copies follow your account.</span></div>'; $('copies-list').innerHTML = ''; return; }
    if (!savedCache) {
      $('saved-grid').innerHTML = '<div class="skeleton-card"></div>';
      const r = await api('/api/library/mine/saved').catch(() => null);
      savedCache = r && r.ok ? await json(r) : { bookmarks: [], copies: [] };
    }
    renderSaved();
  }
  function renderSaved() {
    if (!savedCache) return;
    const marks = (savedCache.bookmarks || []).map(a => {
      const p = assignmentToCommunityPost({ ...a, saved: true, published_at: a.saved_at });
      _extraPosts.set(String(p.id), p);
      return postById(p.id) || p;
    });
    $('saved-grid').innerHTML = marks.length ? marks.map(p => communityCardHtml(p)).join('')
      : '<div class="cm-empty"><b>No bookmarks yet.</b><span>Tap 🔖 on any card to keep it here for your next lesson.</span></div>';
    const copies = savedCache.copies || [];
    $('copies-list').innerHTML = copies.length ? copies.map(c => `<div class="cm-row" data-copy="${esc(c.id)}">
        <div class="cm-row-main">
          <input class="cm-row-title" value="${esc(c.title)}" aria-label="Name of this copy" data-rename="${esc(c.id)}">
          <div class="cm-row-sub">${c.author_name ? `by ${esc(c.author_name)} · ` : ''}${c.target === 'student' ? `on the board "${esc(c.board_name || 'deleted')}"` : c.target === 'library' ? 'in your library' : 'your own board'} · ${esc(shortDate(c.created_at))}
            ${c.update_available ? '<span class="cm-badge upd">Updated version available</span>' : ''}${!c.source_live && c.assignment_id !== undefined ? '<span class="cm-badge gone">Original removed - your copy stays</span>' : ''}</div>
        </div>
        <div class="cm-row-acts">
          ${c.update_available && c.assignment_id ? `<button type="button" class="cm-btn" data-get="${esc(c.assignment_id)}">Get the new version</button>` : ''}
          ${c.target === 'library' ? '' : c.board_exists ? `<a class="cm-btn main" href="board.html?id=${encodeURIComponent(c.board_id)}">Open</a>` : '<span class="cm-row-gone">Board deleted</span>'}
        </div></div>`).join('')
      : '<div class="cm-empty"><b>No copies yet.</b><span>Copy ▾ on a card puts it on your boards or a student\'s board.</span></div>';
  }
  document.addEventListener('change', async e => {
    const id = e.target?.dataset?.rename; if (!id) return;
    const title = e.target.value.trim(); if (!title) return;
    const r = await api(`/api/library/mine/copies/${encodeURIComponent(id)}`, { method: 'PATCH', body: { title } }).catch(() => null);
    toast(r && r.ok ? 'Renamed' : 'Could not rename');
    const c = (savedCache?.copies || []).find(x => x.id === id); if (c && r && r.ok) c.title = title;
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-get]'); if (!b) return;
    busy(b, 'Copying…');
    const r = await api(`/api/library/${encodeURIComponent(b.dataset.get)}/to-board`, { method: 'POST', body: {} }).catch(() => null);
    const d = r ? await json(r) : {};
    busy(b, null);
    if (!r || !r.ok) return toast(d.error || 'Could not copy');
    savedCache = null; await loadSaved();
    toastLink(`✓ The new version is a new board: "${d.board.name}" - your old copy is untouched`, `board.html?id=${encodeURIComponent(d.board.id)}`, 'Open');
  });

  /* ── My space: My publications ── */
  let pubsCache = null;
  async function loadPublications() {
    if (!signedIn()) { $('pubs-list').innerHTML = '<div class="cm-empty"><b>Sign in to see what you shared.</b></div>'; return; }
    $('pubs-list').innerHTML = '<div class="skeleton-card"></div>';
    const r = await api('/api/library/mine/publications').catch(() => null);
    pubsCache = r && r.ok ? (await json(r)).publications || [] : [];
    renderPublications();
    if (!_libraryLoaded) loadLibrary(); else renderMyLibrary();
  }
  function pubStatus(a) {
    if (a.hidden_at) return `<span class="cm-badge warn">Hidden · ${a.report_count} reports - publish an update to bring it back</span>`;
    if (a.visibility === 'community') return '<span class="cm-badge ok">🌐 Public</span>';
    if (a.visibility === 'unlisted') return '<span class="cm-badge">🔗 Link only</span>';
    return '<span class="cm-badge gone">Unpublished</span>';
  }
  function renderPublications() {
    const box = $('pubs-list'); if (!box || !pubsCache) return;
    box.innerHTML = pubsCache.length ? pubsCache.map(a => `<div class="cm-row">
        <div class="cm-row-main">
          <div class="cm-row-name">${esc(a.title)} <span class="cm-badge kind-${a.kind === 'board' ? (a.source_frame_id ? 'lesson' : 'space') : 'studio'}">${a.kind === 'board' ? (a.source_frame_id ? 'Lesson' : 'Space') : esc(KIND_LABEL[a.kind] || 'Template')}</span></div>
          <div class="cm-row-sub">${pubStatus(a)}<span class="cm-row-stat">${ICON.heart}${a.like_count}</span><span class="cm-row-stat">${ICON.copies}${a.clone_count}</span>
            ${a.content_updated_at ? `<span>updated ${esc(shortDate(a.content_updated_at))}</span>` : a.published_at ? `<span>shared ${esc(shortDate(a.published_at))}</span>` : ''}${a.report_count && !a.hidden_at ? `<span class="cm-row-warn">⚑ ${a.report_count} report${a.report_count === 1 ? '' : 's'}</span>` : ''}</div>
        </div>
        <div class="cm-row-acts">
          <a class="cm-btn" href="lesson-view.html?id=${encodeURIComponent(a.id)}">View</a>
          ${a.kind === 'board' && a.source_board_id ? `<button type="button" class="cm-btn" data-upd="${esc(a.id)}" title="Copies already made keep their version">Publish update</button>` : ''}
          ${a.visibility === 'private' ? `<button type="button" class="cm-btn main" data-pub="${esc(a.id)}">Publish again</button>` : `<button type="button" class="cm-btn" data-unpub="${esc(a.id)}">Unpublish</button>`}
        </div></div>`).join('')
      : '<div class="cm-empty"><b>You have not shared anything yet.</b><span>Share a lesson from any board - other teachers can copy it in a click.</span><button class="btn lime" type="button" onclick="focusCommunityPublisher()">＋ Share a lesson</button></div>';
  }
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-upd],[data-pub],[data-unpub]'); if (!t) return;
    const id = t.dataset.upd || t.dataset.pub || t.dataset.unpub;
    const a = (pubsCache || []).find(x => x.id === id);
    if (t.dataset.unpub) {
      if (!confirm('Unpublish it? It leaves the catalog; teachers who copied it keep their copies.')) return;
      const r = await api(`/api/library/${encodeURIComponent(id)}/unpublish`, { method: 'POST' }).catch(() => null);
      toast(r && r.ok ? 'Unpublished - copies stay with those who made them' : 'Could not update');
    } else if (t.dataset.pub) {
      const r = await api(`/api/library/${encodeURIComponent(id)}/publish`, { method: 'POST' }).catch(() => null);
      toast(r && r.ok ? '🌐 Back in Community' : 'Could not publish');
    } else if (a) {
      busy(t, 'Publishing…');
      try {
        const br = await api('/api/boards/' + encodeURIComponent(a.source_board_id));
        const bd = await json(br);
        if (!br.ok) throw new Error(bd.error || 'The source board is gone');
        const data = bd.board?.data || {};
        const all = Array.isArray(data.cards) ? data.cards : [];
        const cards = a.source_frame_id ? getFrameDescendants(all, a.source_frame_id) : all;
        if (!cards || !cards.length) throw new Error('The lesson frame is no longer on that board');
        const ids = new Set(cards.map(c => c.id));
        const links = (Array.isArray(data.links) ? data.links : (data.arrows || [])).filter(l => {
          const f = l.fromCard || l.from, to = l.toCard || l.to; return (!f || ids.has(f)) && (!to || ids.has(to));
        });
        const r = await api(`/api/library/${encodeURIComponent(id)}/update`, { method: 'POST', body: { data: { snapshot: { name: a.title, cards, links } } } });
        const d = await json(r);
        if (!r.ok) throw new Error(d.error || 'Could not publish the update');
        toast('✓ Update published - teachers who copied it see "Updated version available"');
      } catch (err) { toast(err.message || 'Could not publish the update'); }
      busy(t, null);
    }
    loadPublications();
    loadCommunityLessons().then(() => renderTab());
  });

  window.cloneItem = cloneItem = async function (id) {   // eslint-disable-line no-global-assign
    if (await needSignIn()) return;
    const r = await api('/api/library/' + encodeURIComponent(id) + '/clone', { method: 'POST' }).catch(() => null);
    const d = r ? await json(r) : {};
    if (!r || !r.ok) return toast(d.error || 'Could not save');
    savedCache = null; countMine(); closePop(); closePreview();
    toast('✓ Saved to your library - it is under Saved items › My copies');
    loadLibrary();
  };

  async function countMine() {
    if (!signedIn()) return;
    try {
      if (!savedCache) { const r = await api('/api/library/mine/saved'); if (r.ok) savedCache = await json(r); }
      setText('stat-saved', ((savedCache?.bookmarks || []).length + (savedCache?.copies || []).length) || '');
      if (!pubsCache) { const r = await api('/api/library/mine/publications'); if (r.ok) pubsCache = (await json(r)).publications || []; }
      setText('stat-publications', (pubsCache || []).filter(a => a.visibility !== 'private').length || '');
    } catch (_) {}
  }

  /* start: the tab from the address (#saved, ?tab=games) or All */
  const want = (location.hash || '').slice(1) || new URLSearchParams(location.search).get('tab') || 'all';
  switchCommTab(want);
  countMine();
  addEventListener('hashchange', () => { const t = location.hash.slice(1); if (t && t !== currentTab) switchCommTab(t); });
})();
