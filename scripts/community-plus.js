/* Community, the teacher's way (16.10.2026).
 *
 * Left: the teacher's own - Saved items (bookmarks and copies) and My
 * publications (numbers, status, updates, appeals). Above the feed: one row of
 * tabs and one search with Language, Level, Age and Skill; the feed follows as
 * you type.
 *
 * A card shows only honest numbers: unique teachers who copied it, "Used in N
 * classes" (a lesson that really ran), a rating once five teachers answered, "New"
 * for 14 days - and nothing at all when a number is zero.
 * Use ▾ -> Save to My Boards (named "Title (by Author)", renamable first) or
 * Insert to Student…: Student → Board → Confirm, never a silent guess, with Undo.
 * A click anywhere else on the card opens a sandbox preview (it counts as nothing).
 *
 * Copies are the copier's own (backend/routes/library.js): the author
 * deleting or editing the original never reaches them.
 *
 * Loaded after community.html's own script; replaces a few of its functions.
 * community-social.js adds requests, collections, author pages and recommendations
 * on top of the `window.CM` object exported at the end.
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
  const CM = window.CM = { $, json, ICON, KIND_LABEL, extraTabs: new Map() };
  const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const myId = () => { try { return (JSON.parse(localStorage.getItem('teachedos_user') || 'null') || {}).id || null; } catch { return null; } };
  CM.myId = myId;

  /* analytics: names and properties are an allow-list on the server; never a
     student's name or a board's title */
  function track(event, publicationId, props) {
    try { api('/api/community/events', { method: 'POST', body: { event, publication_id: publicationId || undefined, props: props || {} } }).catch(() => {}); } catch (_) {}
  }
  CM.track = track;

  /* ── data: every server item carries stats, bookmark, status, attribution ── */
  const ZERO = { copies: 0, likes: 0, saves: 0, used: 0, rating: null, remixes: 0, isNew: false };
  const origToPost = assignmentToCommunityPost;
  window.assignmentToCommunityPost = assignmentToCommunityPost = function (a, dataOverride) {   // eslint-disable-line no-global-assign
    const p = origToPost(a, dataOverride);
    const st = a.stats || ZERO;
    return Object.assign(p, {
      kind: a.kind || 'board',
      stats: st,
      cloneCount: st.copies, likeCount: st.likes, liked: !!a.liked, saved: !!a.saved, reported: !!a.reported,
      authorId: a.author_id || null, contentUpdatedAt: a.content_updated_at || null, myCopyAt: a.my_copy_at || null,
      // a copy is "outdated" when the author published a new version after it
      copyOld: !!a.my_copy_old,
      isTeam: !!a.author_team, editorial: !!a.editorial, rank: Number(a.rank) || 0,
      moderationState: a.moderation_state || 'published', allowRemix: a.allow_remix !== false,
      accessType: a.access_type || 'free', previewMode: a.preview_mode || 'full',
      remixOf: a.remix_of || a.remix_of_title ? { id: a.remix_of || null, title: a.remix_of_title || '', author: a.remix_of_author || '', authorId: a.remix_of_author_id || null } : null,
      // library items (studios, quizzes, games) are not boards: no snapshot to preview
      isSpace: a.kind && a.kind !== 'board' ? false : p.isSpace,
    });
  };
  /* a lesson kept only on this device has no server numbers: it gets honest zeros */
  const origGetPosts = getCommunityPosts;
  window.getCommunityPosts = getCommunityPosts = function () {   // eslint-disable-line no-global-assign
    return origGetPosts().map(p => { if (!p.stats) { p.stats = { ...ZERO }; p.rank = p.rank || 0; p.likeCount = p.likeCount || 0; } return p; });
  };
  const libraryPosts = () => (_communityLibrary || []).filter(a => a.kind !== 'board').map(a => assignmentToCommunityPost(a));
  const allPosts = () => [...getCommunityPosts(), ...libraryPosts()];
  const _extraPosts = new Map();   // cards shown outside the feed: saved, collections, author pages, answers
  const postById = id => allPosts().find(p => String(p.id) === String(id)) || (_extraPosts.get(String(id)) || null);
  CM.toPost = a => { const p = assignmentToCommunityPost(a); _extraPosts.set(String(p.id), p); return postById(p.id) || p; };
  CM.postById = postById; CM.allPosts = allPosts;

  /* ── filters: one search and four refinements for every tab ── */
  const val = id => ($(id) && $(id).value) || '';
  function matches(p) {
    const q = val('board-search').trim().toLowerCase();
    const hay = [p.title, p.desc, p.author, p.level, p.skill, p.language, p.audience, ...(p.tags || [])].join(' ').toLowerCase();
    // every word must be somewhere in it: "B2 job interview" finds "Job Interview Role-plays" (B2)
    if (q && !q.split(/\s+/).every(t => hay.includes(t))) return false;
    if (val('board-level') && p.level !== val('board-level')) return false;
    if (val('board-language') && (p.language || '') !== val('board-language')) return false;
    if (val('board-age') && (p.audience || '') !== val('board-age')) return false;
    if (val('board-skill') && (p.skill || '') !== val('board-skill')) return false;
    return true;
  }
  function sorted(list) {
    const sort = val('board-sort') || 'recommended';
    const byDate = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    if (sort === 'recommended') return list.sort((a, b) => (b.rank - a.rank) || byDate(a, b));
    if (sort === 'used') return list.sort((a, b) => (b.stats.used - a.stats.used) || (b.stats.copies - a.stats.copies) || byDate(a, b));
    if (sort === 'popular') return list.sort((a, b) => (b.stats.copies - a.stats.copies) || (b.stats.saves - a.stats.saves) || byDate(a, b));
    return list.sort(byDate);
  }
  const anyFilter = () => ['board-search', 'board-level', 'board-language', 'board-age', 'board-skill'].some(id => val(id).trim());
  CM.val = val; CM.matches = matches; CM.sorted = sorted; CM.anyFilter = anyFilter;
  function paintFilterState() {
    document.querySelectorAll('#cm-toolbar .cm-pill select').forEach(sel => sel.closest('.cm-pill').classList.toggle('is-set', sel.id !== 'board-sort' && !!sel.value));
    const clear = $('board-clear'); if (clear) clear.hidden = !anyFilter();
  }

  /* ── tabs ── */
  let currentTab = 'all';
  let searchTimer = null, lastSearch = '';
  window.cmSearch = function () { clearTimeout(searchTimer); searchTimer = setTimeout(() => { renderTab(); const q = val('board-search').trim(); if (q.length >= 3 && q !== lastSearch) { lastSearch = q; track('search_submitted', null, { tab: currentTab, has_filters: anyFilter() }); } }, 160); };
  function renderTab() {
    paintFilterState();
    if (currentTab === 'all') renderAll();
    else if (currentTab === 'boards') renderCommunity();
    else if (currentTab === 'studios') renderCommunityLibrary();
    else if (currentTab === 'games') { $('game-search').value = val('board-search'); renderCommunityGames(); }
    else if (currentTab === 'worksheets') { $('ws-search').value = val('board-search'); renderWorksheets(); }
    else if (currentTab === 'saved') renderSaved();
    else if (currentTab === 'publications') renderPublications();
    else if (CM.extraTabs.has(currentTab)) CM.extraTabs.get(currentTab).render?.();
  }
  window.clearCommunityFilters = clearCommunityFilters = function () {   // eslint-disable-line no-global-assign
    ['board-search', 'board-level', 'board-language', 'board-age', 'board-skill'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    renderTab();
  };
  CM.renderTab = renderTab; CM.currentTab = () => currentTab;

  // one load at a time: the page start and a tab can both ask for it
  const origLoadLibrary = loadLibrary;
  let libLoading = null;
  window.loadLibrary = loadLibrary = function () {   // eslint-disable-line no-global-assign
    if (!libLoading) libLoading = Promise.resolve(origLoadLibrary()).finally(() => { libLoading = null; });
    return libLoading;
  };

  const TABS = ['all', 'boards', 'studios', 'worksheets', 'games', 'saved', 'publications'];
  /* tab names may carry a target: #author=<id>, #collection=<id> */
  const parseTab = raw => { const [t, id] = String(raw || '').split('='); return { tab: t || 'all', id: id || '' }; };
  window.switchCommTab = switchCommTab = function (raw) {   // eslint-disable-line no-global-assign
    let { tab, id } = parseTab(raw);
    if (tab === 'library') tab = 'studios';
    if (!TABS.includes(tab) && !CM.extraTabs.has(tab)) tab = 'all';
    currentTab = tab;
    closeSnack(); closePop();
    // the type row highlights the nearest tab for a page that has none of its own
    const mark = CM.extraTabs.get(tab)?.mark || tab;
    document.querySelectorAll('.comm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === mark));
    [...TABS, ...CM.extraTabs.keys()].forEach(t => { const el = $('tab-' + t); if (el) el.style.display = t === tab ? '' : 'none'; });
    // My space and the author/collection pages have their own lists; the search row is for the catalog
    const own = tab === 'saved' || tab === 'publications' || CM.extraTabs.get(tab)?.noToolbar;
    const tb = $('cm-toolbar'); if (tb) tb.hidden = !!own;
    document.querySelectorAll('#cm-toolbar .cm-pill:not(.is-sort)').forEach(p => { p.hidden = tab === 'games' || tab === 'worksheets' || !!CM.extraTabs.get(tab)?.searchOnly; });
    if (tab === 'studios' && !_libraryLoaded) loadLibrary();   // All gets it from the page start (loadBoards)
    if (tab === 'saved') loadSaved();
    if (tab === 'publications') loadPublications();
    CM.extraTabs.get(tab)?.show?.(id);
    try { history.replaceState(null, '', location.pathname + location.search + (tab === 'all' ? '' : '#' + tab + (id ? '=' + id : ''))); } catch (_) {}
    renderTab();
  };

  /* ── the card ── */
  const updated = p => p.copyOld || !!(p.myCopyAt && p.contentUpdatedAt && Date.parse(p.contentUpdatedAt) > Date.parse(p.myCopyAt));
  const kindBadge = p => p.kind && p.kind !== 'board' ? (KIND_LABEL[p.kind] || 'Template') : (p.isSpace ? 'Space' : 'Lesson');
  const paid = p => p.accessType === 'paid' && !p.isMine;
  CM.kindBadge = kindBadge; CM.paid = paid;

  /* The line of numbers: only what is not zero, never a fake figure. */
  function metricsHtml(p, opts = {}) {
    const s = p.stats || ZERO, parts = [];
    if (s.used) parts.push(`<span class="cm-m cm-m-used" title="Lessons in which a teacher really used it with a student">Used in ${pl(s.used, 'class', 'classes')}</span>`);
    if (s.rating) parts.push(`<span class="cm-m cm-m-rate" title="Share of teachers who said it worked well in class">${s.rating.pct}% worked well (${s.rating.n} ratings)</span>`);
    if (s.copies) parts.push(`<span class="cm-m" title="Teachers who made their own copy">${pl(s.copies, 'copy', 'copies')}</span>`);
    if (s.saves) parts.push(`<span class="cm-m">${pl(s.saves, 'save', 'saves')}</span>`);
    if (s.remixes && !opts.noRemix) parts.push(`<span class="cm-m cm-m-remix" title="Teachers who adapted it and shared their version">${pl(s.remixes, 'remix', 'remixes')}</span>`);
    return parts.length ? `<div class="cm-metrics">${parts.join('<i aria-hidden="true">·</i>')}</div>` : '';
  }
  CM.metricsHtml = metricsHtml;

  function remixLine(p) {
    if (!p.remixOf) return '';
    const o = p.remixOf;
    const who = o.author ? ` by ${esc(o.author)}` : '';
    return `<div class="cm-remix" title="Adapted from another teacher's lesson">↪ Remixed from ${o.id ? `<a href="#" data-cm="remix-source" data-rid="${esc(o.id)}">${esc(o.title || 'a lesson')}</a>` : esc(o.title || 'a lesson')}${who}</div>`;
  }

  window.communityCardHtml = communityCardHtml = function (p, opts = {}) {   // eslint-disable-line no-global-assign
    const facts = [p.level && p.level !== 'Mixed' ? p.level : (p.level || ''), p.audience || p.skill || ''].filter(Boolean);
    const server = !!p.serverId;
    const canCopy = p.allowCopy !== false && !paid(p);
    const preview = opts.preview;
    const s = p.stats || ZERO;
    const state = p.isMine && p.moderationState && p.moderationState !== 'published';
    const rec = opts.rec;   // inside a recommendation section: Not relevant / Show fewer
    return `<article class="cm-card${p.isMine ? ' is-mine' : ''}" data-post="${esc(String(p.id))}"${rec ? ` data-rec="${esc(rec)}"` : ''}>
      <div class="cm-cover">${postCoverHtml(p)}
        <span class="cm-badges"><span class="cm-badge kind-${esc(kindBadge(p).toLowerCase())}">${esc(kindBadge(p))}</span>${s.isNew ? '<span class="cm-badge is-new">New</span>' : ''}${p.editorial ? '<span class="cm-badge editor" title="Chosen by the TeachEd team">★ Editor\'s pick</span>' : ''}${updated(p) ? '<span class="cm-badge upd" title="The author published a new version after you copied it">Updated</span>' : ''}${paid(p) ? '<span class="cm-badge paid">Paid</span>' : ''}${state ? '<span class="cm-badge warn">Review pending</span>' : ''}${p.isMine && !state ? '<span class="cm-badge mine">🌐 Yours</span>' : ''}</span>
      </div>
      ${p.isMine && !preview ? `<button class="cm-edit-cover" type="button" data-cm="cover">✎ Edit cover</button>` : ''}
      <div class="cm-body">
        <div class="cm-by">
          <span class="cm-ava" aria-hidden="true">${authorAvatarHtml(p)}</span>
          <button type="button" class="cm-author" data-cm="author" title="${p.isTeam ? 'TeachEd Team - official materials' : 'See this teacher\'s page'}">${esc(p.author || 'Teacher')}${p.isTeam ? ' <span class="cm-team" aria-label="TeachEd Team">✓</span>' : ''}</button>
          <time class="cm-date">${esc(shortDate(p.createdAt))}</time>
        </div>
        <h3 class="cm-title">${esc(p.title)}</h3>
        ${remixLine(p)}
        <div class="cm-facts">${langFlag(p.language)}${facts.map(f => `<span>${esc(f)}</span>`).join('<i aria-hidden="true">•</i>')}</div>
        ${preview ? '' : metricsHtml(p)}
        ${preview ? '' : `<div class="cm-foot">
          <span class="cm-social">
            <button type="button" class="cm-ic cm-like${p.liked ? ' on' : ''}" data-cm="like" ${server ? '' : 'disabled'} aria-pressed="${p.liked}" title="${p.liked ? 'Unlike' : 'Like'}">${ICON.heart}${s.likes ? `<b>${s.likes}</b>` : '<b></b>'}</button>
          </span>
          <span class="cm-acts">
            <button type="button" class="cm-ic cm-mark${p.saved ? ' on' : ''}" data-cm="mark" ${server ? '' : 'disabled'} aria-pressed="${p.saved}" title="${p.saved ? 'Saved in My library' : 'Save to My library'}">${ICON.mark}</button>
            <button type="button" class="cm-ic cm-more" data-cm="more" title="More" aria-label="More">${ICON.more}</button>
            ${canCopy ? `<button type="button" class="cm-copy" data-cm="copy" aria-haspopup="menu">Use ${ICON.caret}</button>` : `<button type="button" class="cm-copy is-view" data-cm="open">${paid(p) ? 'Preview' : 'View'}</button>`}
          </span>
        </div>`}
      </div>
    </article>`;
  };

  /* ── tabs: what each list says when it is empty ── */
  function emptyHtml(what) {
    return `<div class="cm-empty"><b>Nothing here matches.</b><span>${what}</span>${anyFilter() ? '<button class="btn ghost" type="button" onclick="clearCommunityFilters()">Clear filters</button>' : ''}</div>`;
  }
  /* A weak search is the moment a need is clearest: offer to turn it into a request. */
  function weakSearchHtml(count) {
    const q = val('board-search').trim();
    if (!q || q.length < 3 || count > 2) return '';
    return `<div class="cm-ask">
      <div><b>Couldn't find the right resource?</b><span>Ask the Community. We'll prefill your request from this search${val('board-level') || val('board-skill') || val('board-language') ? ' and your filters' : ''}.</span></div>
      <div class="cm-ask-act"><button class="cm-btn main" type="button" data-cm-ask="1">Post a request</button><button class="cm-btn" type="button" onclick="clearCommunityFilters()">Adjust filters</button></div>
    </div>`;
  }
  CM.weakSearchHtml = weakSearchHtml;
  function paintGrid(grid, list, emptyText, countEl, noun) {
    setText(countEl, list.length ? `${list.length} ${noun[list.length === 1 ? 0 : 1]}${anyFilter() ? ' match' : ''}` : '');
    grid.innerHTML = list.length ? list.map(p => communityCardHtml(p)).join('') : emptyHtml(emptyText);
    // the ask sits under the grid, outside it, so it spans the width
    let ask = grid.nextElementSibling && grid.nextElementSibling.classList.contains('cm-ask-slot') ? grid.nextElementSibling : null;
    if (!ask) { ask = document.createElement('div'); ask.className = 'cm-ask-slot'; grid.after(ask); }
    ask.innerHTML = weakSearchHtml(list.length);
  }
  function renderAll() {
    const grid = $('all-grid'); if (!grid) return;
    const list = sorted(allPosts().filter(matches));
    paintGrid(grid, list, 'Try another level or language - or share the first one.', 'all-count', ['material from teachers', 'materials from teachers']);
    CM.afterAll?.(list);
    updateCommunityStats();
  }
  window.renderCommunity = renderCommunity = function () {   // eslint-disable-line no-global-assign
    const grid = $('community-grid'); if (!grid) return;
    paintGrid(grid, sorted(getCommunityPosts().filter(matches)), 'Try another level or language - or share the first one.', 'community-count', ['lesson', 'lessons and spaces']);
    updateCommunityStats();
    if (currentTab === 'all') renderAll();
  };
  window.renderCommunityLibrary = renderCommunityLibrary = function () {   // eslint-disable-line no-global-assign
    const grid = $('community-library-grid'); if (!grid) return;
    paintGrid(grid, sorted(libraryPosts().filter(matches)), 'Exercises, quizzes and studio templates teachers share appear here.', 'studios-count', ['template', 'templates and exercises']);
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
  CM.needSignIn = needSignIn;
  async function like(p, btn) {
    if (await needSignIn()) return;
    const on = !p.liked;
    const r = await api(`/api/library/${encodeURIComponent(p.serverId)}/like`, { method: 'POST', body: { on } }).catch(() => null);
    const d = r ? await json(r) : {};
    if (!r || !r.ok) return toast(d.error || 'Could not save');
    paintLike(p.serverId, d.liked, d.like_count);
  }
  function setField(serverId, patch) {
    const apply = p => { if (p.serverId !== serverId) return; const { stats, ...rest } = patch; Object.assign(p, rest); if (stats) p.stats = { ...p.stats, ...stats }; };
    _serverCommunityLessons.forEach(apply);
    _extraPosts.forEach(apply);
    (_communityLibrary || []).forEach(a => { if (a.id === serverId) { if (patch.liked !== undefined) a.liked = patch.liked; if (patch.saved !== undefined) a.saved = patch.saved; if (patch.reported !== undefined) a.reported = patch.reported; if (patch.stats) a.stats = { ...(a.stats || ZERO), ...patch.stats }; } });
  }
  CM.setField = setField;
  function paintLike(serverId, liked, n) {
    setField(serverId, { liked, likeCount: n, stats: { likes: n } });
    document.querySelectorAll('.cm-card').forEach(c => {
      const p = postById(c.dataset.post); if (!p || p.serverId !== serverId) return;
      const b = c.querySelector('.cm-like'); if (!b) return;
      b.classList.toggle('on', liked); b.setAttribute('aria-pressed', liked); b.querySelector('b').textContent = n > 0 ? n : '';
    });
    document.querySelectorAll(`[data-pv-like="${serverId}"]`).forEach(b => { b.classList.toggle('on', liked); b.querySelector('b').textContent = n > 0 ? n : ''; });
  }
  async function mark(p) {
    if (await needSignIn()) return;
    const on = !p.saved;
    const r = await api(`/api/library/${encodeURIComponent(p.serverId)}/bookmark`, { method: 'POST', body: { on, surface: currentTab } }).catch(() => null);
    const d = r ? await json(r) : {};
    if (!r || !r.ok) return toast('Could not save');
    setField(p.serverId, { saved: on, stats: { saves: d.save_count } });
    document.querySelectorAll('.cm-card').forEach(c => {
      const q = postById(c.dataset.post); if (!q || q.serverId !== p.serverId) return;
      const b = c.querySelector('.cm-mark'); if (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }
    });
    document.querySelectorAll(`[data-pv-mark="${p.serverId}"]`).forEach(b => b.classList.toggle('on', on));
    toast(on ? '🔖 Saved to My library - find it under Saved items' : 'Removed from Saved items');
    savedCache = null; countMine();
    renderTab();
  }

  /* ── the bar at the bottom that offers Undo ── */
  let snackEl = null, snackTimer = null;
  function closeSnack() { clearTimeout(snackTimer); snackEl?.remove(); snackEl = null; }
  function snack(text, actions, ms) {
    closeSnack();
    snackEl = document.createElement('div');
    snackEl.className = 'cm-snack'; snackEl.setAttribute('role', 'status');
    snackEl.innerHTML = `<span>${esc(text)}</span>${(actions || []).map((a, i) => a.href ? `<a class="cm-snack-b" href="${esc(a.href)}">${esc(a.label)}</a>` : `<button type="button" class="cm-snack-b" data-i="${i}">${esc(a.label)}</button>`).join('')}<button type="button" class="cm-snack-x" aria-label="Close">✕</button>`;
    document.body.appendChild(snackEl);
    snackEl.addEventListener('click', e => {
      if (e.target.closest('.cm-snack-x')) return closeSnack();
      const b = e.target.closest('[data-i]'); if (b) actions[+b.dataset.i].onClick?.(b);
    });
    snackTimer = setTimeout(closeSnack, ms || 12000);
  }
  CM.snack = snack; CM.closeSnack = closeSnack;

  async function undoCopy(copyId, label) {
    const r = await api(`/api/library/mine/copies/${encodeURIComponent(copyId)}/undo`, { method: 'POST' }).catch(() => null);
    const d = r ? await json(r) : {};
    closeSnack();
    toast(r && r.ok ? `↩ Undone - ${label} is gone` : (d.error || 'Could not undo'));
    if (r && r.ok) { savedCache = null; countMine(); await Promise.allSettled([loadCommunityLessons()]); renderTab(); }
  }

  /* Save to My Boards: the server makes a new board of the teacher's own. */
  async function toBoard(p, btn, title) {
    if (await needSignIn()) return;
    if (!p.serverId) return copyCommunityPost(p.id, btn);   // a lesson kept on this device only
    if (p.kind && p.kind !== 'board') return cloneItem(p.serverId);
    busy(btn, 'Copying…');
    const r = await api(`/api/library/${encodeURIComponent(p.serverId)}/to-board`, { method: 'POST', body: { title: title || undefined, surface: currentTab } }).catch(() => null);
    const d = r ? await json(r) : {};
    busy(btn, null);
    if (!r || !r.ok) return toast(d.error || 'Could not copy');
    const mine = p.isMine ? 0 : 1;
    p.myCopyAt = new Date().toISOString();
    setField(p.serverId, { myCopyAt: p.myCopyAt, stats: { copies: Math.max(p.stats.copies, 0) + (p.myCopied ? 0 : mine) } });
    p.myCopied = true;
    savedCache = null; countMine();
    closePop(); closePreview();
    snack(`✓ "${d.board.name}" is on your boards`, [{ label: 'Open board', href: `board.html?id=${encodeURIComponent(d.board.id)}` }, { label: 'Undo', onClick: () => undoCopy(d.copy_id, 'the new board') }]);
    renderTab();
  }
  function busy(btn, label) {
    if (!btn) return;
    if (label) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.textContent = label; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }
  CM.busy = busy;
  function toastLink(text, href, label) { snack(text, [{ label, href }]); }
  CM.toastLink = toastLink;

  /* ── popovers: Use menu, ⋯ menu ── */
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
  // again when its content grows (the list arrives later)
  function placePop() {
    if (!pop) return;
    const r = pop._anchor.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.right - w)) + 'px';
    pop.style.top = (r.bottom + 6 + h > innerHeight - 12 ? Math.max(12, r.top - h - 6) : r.bottom + 6) + 'px';
  }
  CM.openPop = openPop; CM.closePop = closePop; CM.placePop = placePop; CM.pop = () => pop;
  document.addEventListener('mousedown', e => { if (pop && !pop.contains(e.target) && !e.target.closest('[data-cm="copy"],[data-cm="more"],[data-pv="insert"],[data-pv="use"],[data-pv="more"]')) closePop(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (dlg) closeDlg(); else if (pop) closePop(); else closePreview(); } });
  addEventListener('scroll', () => closePop(), { passive: true });

  function useMenu(p, anchor) {
    const board = !p.kind || p.kind === 'board';
    openPop(anchor, `
      <button type="button" class="cm-pop-item" data-a="board"><span>📁</span><span><b>${board ? 'Save to My Boards' : 'Save to My library'}</b><small>${board ? 'A new board of your own - edit it as you like' : 'A copy in your library, ready for a board'}</small></span></button>
      ${board && p.serverId ? `<button type="button" class="cm-pop-item" data-a="student"><span>🎯</span><span><b>Insert to Student…</b><small>One frame on a student's board - you choose the student and the board</small></span></button>` : ''}`,
    m => m.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'board') saveNamePrompt(p, anchor);
      if (a === 'student') openInsertFlow(p);
    }));
  }
  /* "Title (by Author)" - the name a copy gets; the teacher may change it before it is made */
  const defaultName = p => { const t = String(p.title || 'Community lesson'); return p.author && !t.includes(`(by ${p.author})`) ? `${t} (by ${p.author})` : t; };
  CM.defaultName = defaultName;
  function saveNamePrompt(p, anchor) {
    if (p.kind && p.kind !== 'board') { closePop(); return toBoard(p, anchor); }
    const m = openPop(anchor, `<div class="cm-pick-h">Name your copy</div>
      <input class="cm-pick-q" type="text" maxlength="200" value="${esc(defaultName(p))}" aria-label="Name of your copy">
      <div class="cm-report-row"><button type="button" class="cm-btn" data-a="cancel">Cancel</button><button type="button" class="cm-btn main" data-a="save">Save to My Boards</button></div>
      <p class="cm-report-fine">It becomes a board of your own. If the author changes or removes the original, your copy stays as it is.</p>`);
    m.classList.add('is-picker'); placePop();
    const inp = m.querySelector('input'); inp.focus(); inp.select();
    const go = btn => { const t = inp.value.trim(); if (!t) return inp.focus(); toBoard(p, btn, t); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(m.querySelector('[data-a="save"]')); });
    m.addEventListener('click', e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'cancel') closePop(); if (a === 'save') go(e.target.closest('[data-a]')); });
  }

  function moreMenu(p, anchor) {
    const rec = anchor.closest('.cm-card')?.dataset.rec;
    openPop(anchor, `
      <button type="button" class="cm-pop-item" data-a="link"><span>🔗</span><span><b>Copy link</b></span></button>
      <button type="button" class="cm-pop-item" data-a="open"><span>↗</span><span><b>Open lesson page</b></span></button>
      ${p.serverId && signedIn() ? `<button type="button" class="cm-pop-item" data-a="collect"><span>🗂</span><span><b>Add to collection…</b><small>Group the best ones, e.g. "B1 Survival Kit"</small></span></button>` : ''}
      ${p.stats.remixes || p.remixOf ? `<button type="button" class="cm-pop-item" data-a="remixes"><span>🌱</span><span><b>Remixes</b><small>${p.stats.remixes ? `${pl(p.stats.copies, 'copy', 'copies')} → ${pl(p.stats.remixes, 'teacher', 'teachers')} adapted it` : 'Where this one came from'}</small></span></button>` : ''}
      ${rec ? `<button type="button" class="cm-pop-item" data-a="notrel"><span>🚫</span><span><b>Not relevant</b><small>Hide this one from your suggestions</small></span></button>
      <button type="button" class="cm-pop-item" data-a="fewer"><span>➖</span><span><b>Show fewer like this</b><small>Fewer ${esc((KIND_LABEL[p.kind] || 'lesson').toLowerCase())}s${p.skill ? ' for ' + esc(p.skill.toLowerCase()) : ''}</small></span></button>` : ''}
      ${p.serverId && !p.isMine ? `<button type="button" class="cm-pop-item warn" data-a="report" ${p.reported ? 'disabled' : ''}><span>⚑</span><span><b>${p.reported ? 'Reported - thank you' : 'Report'}</b><small>${p.reported ? '' : 'A mistake, copyright, spam, not for class…'}</small></span></button>` : ''}`,
    m => m.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'link') { closePop(); shareCommunityPost(p.id); }
      if (a === 'open') { closePop(); location.href = buildLessonUrl(p); }
      if (a === 'collect') CM.collectMenu?.(p, anchor);
      if (a === 'remixes') CM.remixMenu?.(p, anchor);
      if (a === 'notrel' || a === 'fewer') { closePop(); CM.steer?.(p, a === 'notrel' ? 'not_relevant' : 'fewer_like_this', anchor.closest('.cm-card').dataset.rec); }
      if (a === 'report') reportDialog(p);
    }));
  }

  /* ── dialogs (Insert to Student, Report, Appeal): one frame for all ── */
  let dlg = null, dlgOnClose = null;
  function closeDlg() { dlg?.remove(); dlg = null; document.body.classList.remove('cm-dlg-open'); const f = dlgOnClose; dlgOnClose = null; f && f(); }
  function openDlg(html, { wide, onClose } = {}) {
    dlg?.remove(); closePop(); closeSnack();
    dlg = document.createElement('div'); dlg.className = 'cm-dlg';
    dlg.innerHTML = `<div class="cm-dlg-card${wide ? ' is-wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(dlg); document.body.classList.add('cm-dlg-open');
    dlgOnClose = onClose || null;
    dlg.addEventListener('mousedown', e => { if (e.target === dlg) closeDlg(); });
    return dlg.querySelector('.cm-dlg-card');
  }
  CM.openDlg = openDlg; CM.closeDlg = closeDlg; CM.dlgEl = () => dlg;

  /* ── Insert to Student: Student → Board → Confirm ─────────────────────── */
  let roster = null;
  async function loadRoster() {
    if (roster) return roster;
    const r = await api('/api/members/roster').catch(() => null);
    roster = r && r.ok ? ((await json(r)).students || []) : [];
    return roster;
  }
  const recentKey = 'cm_recent_students';
  const recentIds = () => { try { return JSON.parse(localStorage.getItem(recentKey) || '[]'); } catch { return []; } };
  const rememberStudent = s => { try { const ids = [String(s.id || s.journal_id), ...recentIds().filter(x => x !== String(s.id || s.journal_id))].slice(0, 5); localStorage.setItem(recentKey, JSON.stringify(ids)); } catch (_) {} };
  const ago = iso => { const t = Date.parse(iso || ''); if (!t) return ''; const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); };
  const KIND_BOARD = { individual: 'Individual', group: 'Group', personal: 'Personal board' };

  async function openInsertFlow(p) {
    if (await needSignIn()) return;
    if (!p.serverId) return;
    track('insert_started', p.serverId, { content_type: p.kind, source_surface: currentTab });
    const flow = { p, student: null, boards: [], boardId: null, title: defaultName(p), step: 'student', error: '' };
    const card = openDlg('<div class="cm-dlg-body"></div>', { wide: false });
    const body = card.querySelector('.cm-dlg-body');
    const steps = ['student', 'board', 'confirm'];
    const crumbs = () => `<ol class="cm-crumbs">${['Student', 'Board', 'Confirm'].map((t, i) => `<li class="${steps.indexOf(flow.step) === i ? 'on' : steps.indexOf(flow.step) > i ? 'done' : ''}">${t}</li>`).join('')}</ol>`;
    const head = (t, sub) => `<div class="cm-dlg-h"><div><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div><button type="button" class="cm-pv-x" data-d="close" aria-label="Close">✕</button></div>${crumbs()}`;
    const err = () => flow.error ? `<div class="cm-dlg-err" role="alert">${esc(flow.error)}</div>` : '';

    async function stepStudent() {
      flow.step = 'student';
      body.innerHTML = `${head('Insert to Student', `“${esc(p.title)}” becomes one frame on the student's board.`)}
        <input class="cm-pick-q" type="search" placeholder="Find a student…" aria-label="Find a student">
        <div class="cm-pick-list"><div class="cm-pick-empty">Loading…</div></div>`;
      const list = await loadRoster();
      if (dlg === null) return;
      const q = body.querySelector('.cm-pick-q');
      const recent = recentIds();
      const paint = () => {
        const term = q.value.trim().toLowerCase();
        const rows = list.filter(s => !term || (s.name || '').toLowerCase().includes(term))
          .sort((a, b) => (recent.indexOf(String(b.id || b.journal_id)) >= 0) - (recent.indexOf(String(a.id || a.journal_id)) >= 0) || (!!a.pending - !!b.pending) || String(a.name).localeCompare(String(b.name)));
        const row = s => `<button type="button" class="cm-pick" data-sid="${esc(String(s.id || ''))}" data-jid="${esc(String(s.journal_id || ''))}">
          <span class="cm-pick-ava">${/^https?:/.test(s.avatar || '') ? '' : esc(s.avatar || getAuthorInitials(s.name))}</span>
          <span class="cm-pick-name">${esc(s.name || 'Student')}<small>${s.pending ? 'has not joined yet' : s.home_board_id ? 'their own board' : `${s.boardCount || 1} board${s.boardCount === 1 ? '' : 's'}`}</small></span></button>`;
        const rec = !term ? rows.filter(s => recent.includes(String(s.id || s.journal_id))) : [];
        body.querySelector('.cm-pick-list').innerHTML = rows.length
          ? (rec.length ? `<div class="cm-pick-sub">Recent</div>${rec.map(row).join('')}<div class="cm-pick-sub">All students</div>` : '') + rows.map(row).join('')
          : `<div class="cm-pick-empty">${list.length ? 'Nobody matches.' : 'No students yet - add them on your desktop.'}</div>`;
      };
      paint(); q.addEventListener('input', paint); q.focus();
    }

    async function stepBoard(student) {
      flow.student = student; flow.step = 'board'; flow.error = '';
      body.innerHTML = `${head(`${esc(String(student.name || 'Student').split(' ')[0])}'s board`, 'Choose where the frame goes.')}<div class="cm-pick-empty">Loading…</div>`;
      const qs = student.id && !student.pending ? `studentId=${encodeURIComponent(student.id)}` : `journalId=${encodeURIComponent(student.journal_id || '')}`;
      const r = await api(`/api/library/mine/student-boards?${qs}`).catch(() => null);
      const d = r ? await json(r) : {};
      if (dlg === null) return;
      flow.boards = (r && r.ok ? d.boards : []) || [];
      flow.joined = r && r.ok ? d.joined !== false : false;
      flow.studentId = d.student?.id || student.id || null;
      if (flow.boards.length === 1) { flow.boardId = flow.boards[0].id; return stepConfirm(); }
      paintBoards();
    }
    function paintBoards() {
      const name = esc(String(flow.student.name || 'Student').split(' ')[0]);
      flow.step = 'board';
      if (!flow.boards.length) {
        body.innerHTML = `${head(`${name}'s board`, '')}${err()}
          <div class="cm-pick-empty">${flow.joined ? `${name} is not on a board of yours yet. Create one, and this lesson goes straight onto it.` : `${name} has not joined TeachEd yet - send the invite first (Students on your desktop), then add materials.`}</div>
          <div class="cm-report-row"><button type="button" class="cm-btn" data-d="back">Back</button>${flow.joined ? '<button type="button" class="cm-btn main" data-d="create">Create board for student</button>' : ''}</div>`;
        return;
      }
      body.innerHTML = `${head(`${name}'s boards`, 'Pick the board for this lesson - there is more than one.')}${err()}
        <div class="cm-boards" role="radiogroup">${flow.boards.map(b => `<button type="button" class="cm-board${flow.boardId === b.id ? ' on' : ''}" role="radio" aria-checked="${flow.boardId === b.id}" data-bid="${esc(b.id)}">
          <span class="cm-board-main"><b>${esc(b.name)}</b><small>${KIND_BOARD[b.kind] || 'Board'} · active ${esc(ago(b.updated_at))}</small></span>
          ${b.last_opened ? '<span class="cm-badge upd">Last opened</span>' : ''}</button>`).join('')}</div>
        <div class="cm-report-row"><button type="button" class="cm-btn" data-d="back">Back</button><button type="button" class="cm-btn main" data-d="next" ${flow.boardId ? '' : 'disabled'}>Continue</button></div>`;
    }
    function stepConfirm() {
      flow.step = 'confirm';
      const b = flow.boards.find(x => x.id === flow.boardId) || { name: 'Board' };
      const first = esc(String(flow.student.name || 'Student').split(' ')[0]);
      body.innerHTML = `${head('Confirm', '')}${err()}
        <div class="cm-confirm">
          <div class="cm-confirm-row"><span>Student</span><b>${esc(flow.student.name || 'Student')}</b></div>
          <div class="cm-confirm-row"><span>Board</span><b>Board: ${esc(b.name)}</b></div>
          <div class="cm-confirm-row"><span>Frame name</span><input class="cm-pick-q" type="text" maxlength="200" value="${esc(flow.title)}" aria-label="Name of the new frame"></div>
        </div>
        <p class="cm-report-fine">It is added as a new frame after the end of ${first}'s board, in the direction the board reads, with the usual spacing. Nothing existing is covered. You can undo it right after.</p>
        <div class="cm-report-row"><button type="button" class="cm-btn" data-d="back">Back</button><button type="button" class="cm-btn main" data-d="go">Insert</button></div>`;
    }
    async function go(btn) {
      flow.title = body.querySelector('.cm-confirm input')?.value.trim() || defaultName(p);
      busy(btn, 'Adding…');
      const s = flow.student;
      const r = await api(`/api/library/${encodeURIComponent(p.serverId)}/insert`, { method: 'POST', body: { ...(s.pending || !s.id ? { journalId: s.journal_id } : { studentId: s.id }), boardId: flow.boardId, title: flow.title } }).catch(() => null);
      const d = r ? await json(r) : {};
      busy(btn, null);
      if (!r || !r.ok) {
        flow.error = d.code === 'board_unavailable' ? 'That board is no longer available for this student - nothing was added. Choose another one.' : (d.error || 'Could not add it - nothing was changed.');
        if (d.code === 'board_unavailable' || d.code === 'choose_board') { flow.boardId = null; return stepBoard(s); }
        return stepConfirm();
      }
      rememberStudent(s);
      const first = String(s.name || 'the student').split(' ')[0];
      p.myCopyAt = new Date().toISOString();
      if (!p.isMine && !p.myCopied) { p.myCopied = true; setField(p.serverId, { myCopyAt: p.myCopyAt, stats: { copies: (p.stats.copies || 0) + 1 } }); }
      savedCache = null; countMine();
      closeDlg(); closePreview();
      snack(`✓ Added to ${d.board?.name || first + '\'s board'}`, [{ label: 'Open board', href: `board.html?id=${encodeURIComponent(d.board.id)}` }, { label: 'Undo', onClick: () => undoCopy(d.copy_id, 'the frame') }]);
      renderTab();
    }
    async function createBoard(btn) {
      busy(btn, 'Creating…');
      const s = flow.student;
      const r = await api('/api/library/mine/student-board', { method: 'POST', body: s.id && !s.pending ? { studentId: s.id } : { journalId: s.journal_id } }).catch(() => null);
      const d = r ? await json(r) : {};
      busy(btn, null);
      if (!r || !r.ok) { flow.error = d.error || 'Could not create the board'; return paintBoards(); }
      flow.boards = [d.board]; flow.boardId = d.board.id; flow.error = '';
      stepConfirm();                                          // back in the same flow, the lesson still waiting
    }
    body.addEventListener('click', e => {
      const t = e.target.closest('[data-d],[data-sid],[data-bid]'); if (!t) return;
      if (t.dataset.d === 'close') return closeDlg();
      if (t.dataset.d === 'back') return flow.step === 'confirm' && flow.boards.length > 1 ? paintBoards() : stepStudent();
      if (t.dataset.d === 'next') return flow.boardId && stepConfirm();
      if (t.dataset.d === 'go') return go(t);
      if (t.dataset.d === 'create') return createBoard(t);
      if (t.dataset.bid) { flow.boardId = t.dataset.bid; return paintBoards(); }
      if (t.dataset.sid !== undefined) {
        const s = roster.find(x => String(x.id || '') === t.dataset.sid && String(x.journal_id || '') === t.dataset.jid) || roster.find(x => String(x.id || '') === t.dataset.sid);
        if (s) { flow.error = ''; stepBoard(s); }
      }
    });
    stepStudent();
  }
  CM.openInsertFlow = openInsertFlow;

  /* ── Report: a reason is required; one voice per teacher ── */
  const REASONS = [
    ['misleading', 'Incorrect or misleading', 'A mistake in the content or answers'],
    ['inappropriate', 'Inappropriate for learners', 'Not suitable for the class'],
    ['copyright', 'Copyright or plagiarism', 'Someone else\'s work without credit'],
    ['personal_data', 'Personal data', 'Names, contacts or photos of real people'],
    ['harmful_link', 'Harmful link or file', 'A link or file that could hurt'],
    ['spam', 'Spam or duplicate', 'An advert, or the same thing posted again'],
    ['other', 'Other', 'Tell us in a comment'],
  ];
  function reportDialog(p) {
    if (!p.serverId) return;
    closePop();
    const card = openDlg(`<div class="cm-dlg-h"><div><b>Report this ${esc(kindBadge(p).toLowerCase())}</b><small>“${esc(p.title)}”</small></div><button type="button" class="cm-pv-x" data-d="close" aria-label="Close">✕</button></div>
      <div class="cm-reasons-l" role="radiogroup" aria-label="What is wrong">${REASONS.map(([k, t, s]) => `<label class="cm-reason"><input type="radio" name="cm-reason" value="${k}"><span><b>${t}</b><small>${s}</small></span></label>`).join('')}</div>
      <label class="cm-reason cm-crit" hidden><input type="checkbox" id="cm-critical"><span><b>This is serious</b><small>It puts a child at risk, is sexually explicit, or threatens someone. It is hidden at once until a person has looked.</small></span></label>
      <textarea class="cm-report-note" maxlength="500" placeholder="A few words for our team (optional)" aria-label="Comment"></textarea>
      <div class="cm-dlg-err" role="alert" hidden></div>
      <div class="cm-report-row"><button type="button" class="cm-btn" data-d="close">Cancel</button><button type="button" class="cm-btn main" data-d="send" disabled>Send report</button></div>
      <p class="cm-report-fine">One report per teacher. We do not tell the author who reported. Teachers who already copied this keep their copies.</p>`);
    const send = card.querySelector('[data-d="send"]'), crit = card.querySelector('.cm-crit'), errEl = card.querySelector('.cm-dlg-err');
    card.addEventListener('change', e => {
      if (e.target.name !== 'cm-reason') return;
      send.disabled = false;
      crit.hidden = e.target.value !== 'inappropriate';
      if (crit.hidden) card.querySelector('#cm-critical').checked = false;
    });
    card.addEventListener('click', async e => {
      const d = e.target.closest('[data-d]')?.dataset.d;
      if (d === 'close') return closeDlg();
      if (d !== 'send') return;
      if (await needSignIn()) return;
      const reason = card.querySelector('input[name="cm-reason"]:checked')?.value;
      if (!reason) { errEl.hidden = false; errEl.textContent = 'Choose what is wrong - a reason is required.'; return; }
      busy(send, 'Sending…');
      const r = await api(`/api/library/${encodeURIComponent(p.serverId)}/report`, { method: 'POST', body: { reason, critical: card.querySelector('#cm-critical').checked, note: card.querySelector('.cm-report-note').value } }).catch(() => null);
      const dd = r ? await json(r) : {};
      busy(send, null);
      if (!r || !r.ok) { errEl.hidden = false; errEl.textContent = dd.error || 'Could not send'; return; }
      setField(p.serverId, { reported: true });
      closeDlg();
      toast(dd.already ? `You reported this before - ${String(dd.status?.label || 'it was reviewed').toLowerCase()}.` : 'Thanks. We\'ll review this report.');
      document.querySelectorAll('.cm-card').forEach(c => { if (postById(c.dataset.post)?.serverId === p.serverId) c.classList.add('is-reported'); });
      if (dd.state === 'hidden') { _serverCommunityLessons = _serverCommunityLessons.filter(x => x.serverId !== p.serverId); _communityLibrary = (_communityLibrary || []).filter(a2 => a2.id !== p.serverId); renderTab(); }
    });
  }
  CM.reportDialog = reportDialog;

  /* ── quick preview: a sandbox. It opens, it is never a copy and never a use ── */
  let pv = null, pvStart = 0, pvPost = null;
  function closePreview() {
    if (!pv) return;
    if (pvPost && Date.now() - pvStart > 8000) track('preview_completed', pvPost.serverId, { content_type: pvPost.kind, preview_access: paid(pvPost) ? 'paid' : 'free', preview_mode: pvPost.previewMode });
    pv.remove(); pv = null; pvPost = null; document.body.classList.remove('cm-pv-open');
  }
  function openPreview(p) {
    closePreview(); closePop(); closeSnack();
    const board = (!p.kind || p.kind === 'board') && (p.serverId || p.snapshot);
    const src = board ? (() => { const u = new URL(buildLessonUrl(p)); u.searchParams.set('embed', '1'); return u.href; })() : '';
    const locked = paid(p);
    const canCopy = p.allowCopy !== false && !locked;
    pv = document.createElement('div');
    pv.className = 'cm-pv';
    pvPost = p; pvStart = Date.now();
    if (p.serverId) track('preview_started', p.serverId, { content_type: p.kind, preview_access: locked ? 'paid' : 'free', preview_mode: p.previewMode, source_surface: currentTab });
    const s = p.stats || ZERO;
    pv.innerHTML = `<div class="cm-pv-card" role="dialog" aria-modal="true" aria-label="${esc(p.title)}">
      <div class="cm-pv-head">
        <div class="cm-pv-h"><span class="cm-badge kind-${esc(kindBadge(p).toLowerCase())}">${esc(kindBadge(p))}</span>${p.level ? `<span class="cm-badge lvl">${esc(p.level)}</span>` : ''}${s.isNew ? '<span class="cm-badge is-new">New</span>' : ''}${locked ? '<span class="cm-badge paid">Paid - preview</span>' : ''}
          <b>${esc(p.title)}</b><small><button type="button" class="cm-author cm-author-link" data-pv="author">${esc(p.author || 'Teacher')}${p.isTeam ? ' ✓' : ''}</button>${updated(p) ? ' · <em>updated since your copy</em>' : ''}</small>
          ${remixLine(p)}${metricsHtml(p, { noRemix: true })}</div>
        <button type="button" class="cm-pv-x" data-pv="close" aria-label="Close">✕</button>
      </div>
      <div class="cm-pv-body">${board
        ? `<iframe src="${esc(src)}" title="Preview of ${esc(p.title)}" loading="eager"></iframe>`
        : `<div class="cm-pv-info"><div class="cm-pv-cover">${postCoverHtml(p)}</div>${p.desc ? `<p>${esc(p.desc)}</p>` : ''}${(p.tags || []).length ? `<div class="lib-tags">${p.tags.map(t => `<span class="lib-tag">${esc(t)}</span>`).join('')}</div>` : ''}</div>`}</div>
      <div class="cm-pv-foot">
        ${p.serverId ? `<button type="button" class="cm-ic cm-like${p.liked ? ' on' : ''}" data-pv="like" data-pv-like="${esc(p.serverId)}">${ICON.heart}<b>${s.likes || ''}</b></button>
        <button type="button" class="cm-ic cm-mark${p.saved ? ' on' : ''}" data-pv="mark" data-pv-mark="${esc(p.serverId)}" title="Save to My library">${ICON.mark}</button>
        <button type="button" class="cm-ic cm-more" data-pv="more" title="More" aria-label="More">${ICON.more}</button>` : ''}
        <span class="cm-pv-space"></span>
        ${locked ? '<span class="cm-pv-note">This is a paid resource - the preview shows a part of it.</span><button type="button" class="cm-btn main big" data-pv="buy" disabled title="Purchases are coming soon">Get this resource</button>'
          : `${canCopy && board && p.serverId ? '<button type="button" class="cm-btn" data-pv="insert">🎯 Insert to Student…</button>' : ''}
        ${canCopy ? `<button type="button" class="cm-btn main big" data-pv="use">${board ? 'Use this lesson' : 'Save to My library'}</button>` : '<span class="cm-pv-note">The author keeps this one view-only</span>'}`}
      </div></div>`;
    document.body.appendChild(pv);
    document.body.classList.add('cm-pv-open');
    pv.addEventListener('click', e => {
      if (e.target === pv) return closePreview();
      const btn = e.target.closest('[data-pv]');
      const a = btn?.dataset.pv;
      if (e.target.closest('[data-cm="remix-source"]')) { e.preventDefault(); return CM.openById?.(e.target.closest('[data-cm="remix-source"]').dataset.rid); }
      if (a === 'close') closePreview();
      if (a === 'like') like(p, btn);
      if (a === 'mark') mark(p);
      if (a === 'use') saveNamePrompt(p, btn);
      if (a === 'insert') { closePreview(); openInsertFlow(p); }
      if (a === 'more') moreMenu(p, btn);
      if (a === 'author') { closePreview(); if (p.authorId) switchCommTab('author=' + p.authorId); }
    });
  }
  CM.openPreview = openPreview; CM.closePreview = closePreview;
  /* open a lesson by its server id, from a remix line or a request answer */
  CM.openById = async id => {
    let p = postById('server-' + id);
    if (!p) {
      const r = await api('/api/library/' + encodeURIComponent(id)).catch(() => null);
      if (!r || !r.ok) return toast(r && r.status === 410 ? 'That one is temporarily unavailable' : 'That one is no longer available');
      const d = await json(r);
      p = CM.toPost({ ...d.assignment, author_name: d.assignment.author_name, stats: d.assignment.stats, card_count: undefined, is_mine: d.assignment.is_owner });
    }
    openPreview(p);
  };

  /* one click handler for every card */
  document.addEventListener('click', e => {
    const ask = e.target.closest && e.target.closest('[data-cm-ask]');
    if (ask) return void CM.requestDialog?.({ query: val('board-search').trim() });
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
    if (a === 'copy') return useMenu(p, act);
    if (a === 'cover') return openCoverEditor(p.id);
    if (a === 'open') return paid(p) || p.kind === 'board' ? openPreview(p) : void (location.href = buildLessonUrl(p));
    if (a === 'author') return void (p.authorId && switchCommTab('author=' + p.authorId));
    if (a === 'remix-source') return CM.openById(act.dataset.rid);
    if (e.target.closest('a,button,input,select,textarea')) return;
    openPreview(p);
  });

  /* ── My space: Saved items ── */
  let savedCache = null;
  CM.dropSaved = () => { savedCache = null; };
  async function loadSaved() {
    if (!signedIn()) { $('saved-grid').innerHTML = '<div class="cm-empty"><b>Sign in to keep what you like.</b><span>Bookmarks and copies follow your account.</span></div>'; $('copies-list').innerHTML = ''; return; }
    if (!savedCache) {
      $('saved-grid').innerHTML = '<div class="skeleton-card"></div>';
      const [r, r2] = await Promise.all([api('/api/library/mine/saved').catch(() => null), api('/api/library/mine/reports').catch(() => null)]);
      savedCache = r && r.ok ? await json(r) : { bookmarks: [], copies: [] };
      savedCache.reports = r2 && r2.ok ? (await json(r2)).reports || [] : [];
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
    $('copies-list').innerHTML = (copies.length ? copies.map(c => `<div class="cm-row" data-copy="${esc(c.id)}">
        <div class="cm-row-main">
          <input class="cm-row-title" value="${esc(c.title)}" aria-label="Name of this copy" data-rename="${esc(c.id)}">
          <div class="cm-row-sub">${c.author_name ? `by ${esc(c.author_name)} · ` : ''}${c.target === 'student' ? `on the board "${esc(c.board_name || 'deleted')}"` : c.target === 'library' ? 'in your library' : 'your own board'} · ${esc(shortDate(c.created_at))}
            ${c.update_available ? '<span class="cm-badge upd">Updated version available</span>' : ''}${!c.source_live && c.assignment_id !== undefined ? '<span class="cm-badge gone">Original not available - your copy stays</span>' : ''}</div>
          ${c.source_critical ? '<div class="cm-warn-row">⚠ The original of this copy was pulled for a safety reason. Your copy was not changed - look it over before you use it with students.</div>' : ''}
        </div>
        <div class="cm-row-acts">
          ${c.update_available && c.assignment_id ? `<button type="button" class="cm-btn" data-get="${esc(c.assignment_id)}">Get the new version</button>` : ''}
          ${c.target === 'library' ? '' : c.board_exists ? `<a class="cm-btn main" href="board.html?id=${encodeURIComponent(c.board_id)}">Open</a>` : '<span class="cm-row-gone">Board deleted</span>'}
        </div></div>`).join('')
      : '<div class="cm-empty"><b>No copies yet.</b><span>Use ▾ on a card puts it on your boards or a student\'s board.</span></div>')
      + ((savedCache.reports || []).length ? `<div class="cm-sub-h">Reports you sent</div>${savedCache.reports.map(r => `<div class="cm-row cm-row-slim"><div class="cm-row-main"><div class="cm-row-name">${esc(r.title)}</div><div class="cm-row-sub">${esc(r.category)} · ${esc(shortDate(r.created_at))}</div></div><span class="cm-badge ${r.status.key === 'action_taken' ? 'ok' : r.status.key === 'no_violation' ? 'gone' : ''}">${esc(r.status.label)}</span></div>`).join('')}` : '');
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
    CM.loadAuthorTools?.();
    if (!_libraryLoaded) loadLibrary(); else renderMyLibrary();
  }
  CM.dropPubs = () => { pubsCache = null; };
  const fmtDay = iso => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  function pubStatus(a) {
    const s = a.status || { key: 'published', label: 'Published', tone: 'ok' };
    if (a.visibility === 'private') return '<span class="cm-badge gone">Unpublished</span>';
    if (a.visibility === 'unlisted' && s.key === 'published') return '<span class="cm-badge">🔗 Link only</span>';
    return `<span class="cm-badge ${s.tone === 'ok' ? 'ok' : s.tone === 'bad' ? 'bad' : 'warn'}">${s.key === 'published' ? '🌐 ' : ''}${esc(s.label)}</span>`;
  }
  function pubNumbers(a) {
    const s = a.stats || ZERO, out = [];
    out.push(`<span class="cm-row-stat" title="Lessons in which a teacher really used it">${s.used ? `Used in ${pl(s.used, 'class', 'classes')}` : 'Not used in a class yet'}</span>`);
    if (s.rating) out.push(`<span class="cm-row-stat">${s.rating.pct}% worked well (${s.rating.n})</span>`);
    if (s.copies) out.push(`<span class="cm-row-stat" title="Unique teachers">${ICON.copies}${pl(s.copies, 'copy', 'copies')}${s.remixes ? ` → ${pl(s.remixes, 'teacher', 'teachers')} adapted` : ''}</span>`);
    else if (s.remixes) out.push(`<span class="cm-row-stat">${pl(s.remixes, 'remix', 'remixes')}</span>`);
    if (s.saves) out.push(`<span class="cm-row-stat">${ICON.mark}${s.saves}</span>`);
    if (s.likes) out.push(`<span class="cm-row-stat">${ICON.heart}${s.likes}</span>`);
    return out.join('');
  }
  function modPanel(a) {
    const m = a.moderation, st = a.status?.key;
    if (!m || st === 'published') return '';
    const cats = (m.categories || []).map(c => `${esc(c.label)}${c.n > 1 ? ` ×${c.n}` : ''}`).join(', ');
    const edit = a.source_board_id ? `<a class="cm-btn" href="board.html?id=${encodeURIComponent(a.source_board_id)}">Edit the board</a><button type="button" class="cm-btn main" data-upd="${esc(a.id)}">Edit &amp; republish</button>` : '';
    const appeal = m.can_appeal ? `<button type="button" class="cm-btn" data-appeal="${esc(a.id)}">Appeal decision</button>` : m.appeal_status === 'pending' ? '<span class="cm-badge">Appeal sent - we will look again</span>' : m.appeal_status === 'upheld' ? '<span class="cm-badge gone">Appeal reviewed - decision stands</span>' : '';
    let text = '';
    if (st === 'review_pending') text = `Several teachers reported it${cats ? ` (${cats})` : ''}. It stays in search and by link, but it is out of recommendations until it is reviewed. Status: <b>Review pending</b>.`;
    else if (st === 'under_review') text = `It is hidden from the catalog until our team decides${cats ? ` (reported: ${cats})` : ''}. Teachers who already copied it keep their copies. Status: <b>Under review</b>.${m.decided_at ? '' : ''}`;
    else if (st === 'needs_changes') text = `<b>Needs changes.</b> ${esc(m.note || '')}${m.required_changes ? `<br><b>To restore it:</b> ${esc(m.required_changes)}` : ''}${m.appeal_until && m.can_appeal ? `<br><small>You can appeal until ${esc(fmtDay(m.appeal_until))}.</small>` : ''}`;
    else if (st === 'removed') text = `<b>Removed from Community.</b> ${esc(m.note || '')}${m.appeal_until && m.can_appeal ? `<br><small>You can appeal until ${esc(fmtDay(m.appeal_until))}.</small>` : ''} Teachers who copied it keep their copies.`;
    return `<div class="cm-mod cm-mod-${esc(st)}"><p>${text}</p><div class="cm-row-acts">${st === 'removed' ? '' : edit}${appeal}</div></div>`;
  }
  function renderPublications() {
    const box = $('pubs-list'); if (!box || !pubsCache) return;
    box.innerHTML = pubsCache.length ? pubsCache.map(a => `<div class="cm-row cm-pub${a.status?.key && a.status.key !== 'published' ? ' is-flagged' : ''}">
        <div class="cm-row-main">
          <div class="cm-row-name">${esc(a.title)} <span class="cm-badge kind-${a.kind === 'board' ? (a.source_frame_id ? 'lesson' : 'space') : 'studio'}">${a.kind === 'board' ? (a.source_frame_id ? 'Lesson' : 'Space') : esc(KIND_LABEL[a.kind] || 'Template')}</span>${a.stats?.isNew ? '<span class="cm-badge is-new">New</span>' : ''}</div>
          <div class="cm-row-sub">${pubStatus(a)}${pubNumbers(a)}
            ${a.content_updated_at ? `<span>updated ${esc(shortDate(a.content_updated_at))}</span>` : a.published_at ? `<span>shared ${esc(shortDate(a.published_at))}</span>` : ''}</div>
          ${a.remix_of_title ? `<div class="cm-remix">↪ Remixed from ${esc(a.remix_of_title)}${a.remix_of_author ? ' by ' + esc(a.remix_of_author) : ''}</div>` : ''}
          ${a.kind === 'board' && a.visibility !== 'private' ? `<label class="cm-remix-toggle"><input type="checkbox" data-allow-remix="${esc(a.id)}" ${a.allow_remix !== false ? 'checked' : ''}> Allow others to publish remixes <small>(personal copies are always fine)</small></label>` : ''}
          ${modPanel(a)}
        </div>
        <div class="cm-row-acts">
          <a class="cm-btn" href="lesson-view.html?id=${encodeURIComponent(a.id)}">View</a>
          ${a.kind === 'board' && a.source_board_id && a.status?.key === 'published' ? `<button type="button" class="cm-btn" data-upd="${esc(a.id)}" title="Copies already made keep their version">Publish update</button>` : ''}
          ${a.visibility === 'private' ? `<button type="button" class="cm-btn main" data-pub="${esc(a.id)}">Publish again</button>` : a.status?.key === 'removed' ? '' : `<button type="button" class="cm-btn" data-unpub="${esc(a.id)}">Unpublish</button>`}
        </div></div>`).join('')
      : '<div class="cm-empty"><b>You have not shared anything yet.</b><span>Share a lesson from any board - other teachers can copy it in a click.</span><button class="btn lime" type="button" onclick="focusCommunityPublisher()">＋ Share a lesson</button></div>';
  }
  document.addEventListener('change', async e => {
    const id = e.target?.dataset?.allowRemix; if (!id) return;
    const r = await api(`/api/library/${encodeURIComponent(id)}`, { method: 'PATCH', body: { allowRemix: e.target.checked } }).catch(() => null);
    toast(r && r.ok ? (e.target.checked ? 'Others may publish remixes of it' : 'Remixes switched off - personal copies still work') : 'Could not save');
    const a = (pubsCache || []).find(x => x.id === id); if (a && r && r.ok) a.allow_remix = e.target.checked;
  });
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-upd],[data-pub],[data-unpub],[data-appeal]'); if (!t) return;
    const id = t.dataset.upd || t.dataset.pub || t.dataset.unpub || t.dataset.appeal;
    const a = (pubsCache || []).find(x => x.id === id);
    if (t.dataset.appeal) return appealDialog(a);
    if (t.dataset.unpub) {
      if (!confirm('Unpublish it? It leaves the catalog; teachers who copied it keep their copies.')) return;
      const r = await api(`/api/library/${encodeURIComponent(id)}/unpublish`, { method: 'POST' }).catch(() => null);
      toast(r && r.ok ? 'Unpublished - copies stay with those who made them' : 'Could not update');
    } else if (t.dataset.pub) {
      const r = await api(`/api/library/${encodeURIComponent(id)}/publish`, { method: 'POST' }).catch(() => null);
      const d = r ? await json(r) : {};
      toast(r && r.ok ? '🌐 Back in Community' : (d.error || 'Could not publish'));
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
        toast(d.resubmitted ? '✓ Sent back for review - it stays hidden until the team has looked' : '✓ Update published - teachers who copied it see "Updated version available"');
      } catch (err) { toast(err.message || 'Could not publish the update'); }
      busy(t, null);
    }
    loadPublications();
    loadCommunityLessons().then(() => renderTab());
  });

  function appealDialog(a) {
    if (!a) return;
    const card = openDlg(`<div class="cm-dlg-h"><div><b>Appeal the decision</b><small>“${esc(a.title)}” - another person looks at it again</small></div><button type="button" class="cm-pv-x" data-d="close" aria-label="Close">✕</button></div>
      <label class="cm-fld"><span>Why should the decision change?</span><textarea class="cm-report-note" id="cm-ap-msg" maxlength="2000" placeholder="For example: the answer key is correct (see the textbook, p. 4)"></textarea></label>
      <label class="cm-fld"><span>Proof (optional)</span><textarea class="cm-report-note" id="cm-ap-ev" maxlength="1000" placeholder="A link, or how you can show you have the rights to this material"></textarea></label>
      <div class="cm-dlg-err" role="alert" hidden></div>
      <div class="cm-report-row"><button type="button" class="cm-btn" data-d="close">Cancel</button><button type="button" class="cm-btn main" data-d="send">Send appeal</button></div>
      <p class="cm-report-fine">One appeal per decision. Until it is decided, the status stays as it is.</p>`);
    card.addEventListener('click', async e => {
      const d = e.target.closest('[data-d]')?.dataset.d;
      if (d === 'close') return closeDlg();
      if (d !== 'send') return;
      const msg = card.querySelector('#cm-ap-msg').value.trim(), errEl = card.querySelector('.cm-dlg-err');
      if (msg.length < 10) { errEl.hidden = false; errEl.textContent = 'Tell us, in a few words, why the decision should change.'; return; }
      busy(e.target, 'Sending…');
      const r = await api('/api/community/appeals', { method: 'POST', body: { assignmentId: a.id, message: msg, evidence: card.querySelector('#cm-ap-ev').value } }).catch(() => null);
      const dd = r ? await json(r) : {};
      busy(e.target, null);
      if (!r || !r.ok) { errEl.hidden = false; errEl.textContent = dd.error || 'Could not send'; return; }
      closeDlg(); toast('Appeal sent - a person will look at it again'); loadPublications();
    });
  }

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
      if (!savedCache) { const r = await api('/api/library/mine/saved'); if (r.ok) savedCache = { ...(await json(r)), reports: [] }; }
      setText('stat-saved', ((savedCache?.bookmarks || []).length + (savedCache?.copies || []).length) || '');
      if (!pubsCache) { const r = await api('/api/library/mine/publications'); if (r.ok) pubsCache = (await json(r)).publications || []; }
      setText('stat-publications', (pubsCache || []).filter(a => a.visibility !== 'private').length || '');
    } catch (_) {}
  }

  /* start: the tab from the address (#saved, #author=…, ?tab=games) or All */
  CM.start = () => {
    const raw = (location.hash || '').slice(1) || new URLSearchParams(location.search).get('tab') || 'all';
    switchCommTab(raw);
    countMine();
    track('community_viewed', null, { tab: parseTab(raw).tab });
  };
  addEventListener('hashchange', () => { const raw = location.hash.slice(1); const { tab, id } = parseTab(raw); if (raw && (tab !== currentTab || id)) switchCommTab(raw); });
  /* community-social.js (loaded next) registers its tabs, then calls CM.start() */
  CM.ready = () => { if (!CM._started) { CM._started = true; CM.start(); } };
  setTimeout(() => CM.ready(), 1500);   // community-social.js normally calls it first
})();
