/* Community: the teachers' feed (ТЗ «Удержание» §2.1) - the first tab. A card (any teacher ShareCard), a short
   text, or a question for colleagues; a lesson published to the library arrives here as a lesson card. «Тиць» is
   one tap; on a lesson «took to the board» and «taught it» are facts the library counts, never clicks. Tich is
   the official author. Moderation is after the fact: Report, three of them hide a post until a person looks.
   Built on window.CM from community-plus.js; loaded before community-social.js, which starts the page. */
(function () {
  const CM = window.CM; if (!CM) return;
  const $ = CM.$;
  const signedIn = () => !!token;
  const PHOTO = 'img/tich/tich-joy.webp';
  const ago = iso => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso || '')) / 60000)); if (m < 2) return 'just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago'; };
  const call = async (path, method, body) => { const r = await api(path, { method: method || 'GET', body }).catch(() => null); return { r, d: r ? await CM.json(r) : {} }; };
  const fmtApi = (path, opts = {}) => api(path, { method: opts.method || 'GET', body: opts.body });

  let mode = 'text', posts = [], before = null, more = false, loaded = false;
  const FORMS = {
    wordday: [
      { key: 'word', label: 'The word', max: 40, placeholder: 'serendipity' },
      { key: 'transcription', label: 'Transcription (optional)', max: 40, placeholder: '/ˌser.ənˈdɪp.ə.ti/' },
      { key: 'partOfSpeech', label: 'Part of speech (optional)', max: 16, placeholder: 'noun' },
      { key: 'definition', label: 'What it means', max: 120, placeholder: 'the luck of finding what you were not looking for' },
      { key: 'example', label: 'An example (optional)', max: 90, placeholder: 'Meeting her was pure serendipity.' },
    ],
  };

  function shell() {
    const root = $('tab-feed'); if (!root || root.dataset.ready) return root;
    root.dataset.ready = '1';
    root.innerHTML = '<div class="fd-head"><div class="fd-title">Teachers’ feed</div><div class="fd-sub">What colleagues share: a lesson that worked, a word, a question. Say Тиць to what helps.</div></div>' +
      '<section class="fd-comp"><textarea id="fd-text" maxlength="600" rows="2" placeholder="Share with colleagues…"></textarea>' +
      '<div class="fd-bar"><button type="button" class="fd-chip" data-q="lesson">＋ Lesson</button><button type="button" class="fd-chip" data-q="wordday">Word of the day</button><button type="button" class="fd-chip" data-q="question" id="fd-qbtn">Question</button><button type="button" class="fd-chip" data-q="pulse">Pulse</button>' +
      '<a class="fd-rules" href="community-rules.html" target="_blank" rel="noopener">Feed rules</a><button type="button" class="fd-post" id="fd-send">Post</button></div><div class="fd-msg" id="fd-msg"></div></section>' +
      '<div class="fd-list" id="fd-list"></div><button type="button" class="fd-more" id="fd-more" hidden>Older posts</button>';
    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    return root;
  }
  const msg = t => { const m = $('fd-msg'); if (m) m.textContent = t || ''; };

  async function cardSvg(c) {
    const S = window.TeachEdShare; if (!S || !c) return '';
    try { return S.render({ ...c, mode: 'brag' }, await S.photoFor(c.kind)); } catch (_) { return ''; }
  }
  const avatar = p => p.author.tich ? '<img class="fd-ava tich" src="' + PHOTO + '" alt="">' : '<span class="fd-ava">' + esc((p.author.name || '?').charAt(0).toUpperCase()) + '</span>';
  const tytsBtn = p => '<button type="button" class="fd-tyts' + (p.tyted ? ' on' : '') + '" data-tyts="' + esc(p.id) + '"' + (p.author.me ? ' disabled title="Your own post"' : '') + '>Тиць' + (p.tyts ? ' · ' + p.tyts : '') + '</button>';

  async function postHtml(p) {
    const svg = p.card ? await cardSvg(p.card) : '';
    const word = p.official === 'word_day' && p.payload && p.payload.word;
    const body = word
      ? '<div class="fd-word">' + esc(p.payload.word) + '</div><div class="fd-meaning">' + esc(p.payload.meaning || '') + (p.payload.example ? ' · “' + esc(p.payload.example) + '”' : '') + '</div>'
      : (p.text ? '<div class="fd-text">' + esc(p.text) + '</div>' : '');
    const facts = [];
    if (p.took) facts.push('<span class="fd-fact">Took to a board · ' + p.took + '</span>');
    if (p.taught) facts.push('<span class="fd-fact">Taught it · ' + p.taught + '</span>');
    const tag = p.kind === 'official' ? '<i class="fd-tag">TICH</i>' : p.kind === 'question' ? '<i class="fd-tag q">QUESTION</i>' : '';
    return '<article class="fd-item' + (p.kind === 'official' ? ' tich' : '') + '" data-id="' + esc(p.id) + '"><div class="fd-by">' + avatar(p) + '<div><b>' + esc(p.author.me ? 'You' : p.author.name) + '</b><span>' + ago(p.created_at) + '</span></div>' + tag + '</div>' +
      body + (svg ? '<div class="fd-card">' + svg + '</div>' : '') +
      '<div class="fd-foot">' + tytsBtn(p) + facts.join('') +
      (p.lesson_id ? '<button type="button" class="fd-open" data-lesson="' + esc(p.lesson_id) + '">See the lesson</button>' : '') +
      (p.kind === 'question' ? '<button type="button" class="fd-link" data-ans="' + esc(p.id) + '">' + (p.answers ? p.answers + (p.answers === 1 ? ' answer' : ' answers') : 'Answer') + '</button>' : '') +
      (p.author.me ? '<button type="button" class="fd-link" data-del="' + esc(p.id) + '">Delete</button>' : (p.kind !== 'official' ? '<button type="button" class="fd-link" data-report="' + esc(p.id) + '">Report</button>' : '')) +
      '</div><div class="fd-ans" data-ansbox="' + esc(p.id) + '" hidden></div></article>';
  }

  async function paint(append) {
    const list = $('fd-list'); if (!list) return;
    if (!append) list.innerHTML = '';
    const items = append ? posts.slice(-1 * (posts.length - list.children.length)) : posts;
    if (!posts.length) list.innerHTML = '<div class="fd-empty">Nothing here yet. Post a line, ask a question, or publish a lesson to Community - it lands here.</div>';
    for (const p of items) list.insertAdjacentHTML('beforeend', await postHtml(p));
    $('fd-more').hidden = !more;
  }

  async function load(moreFlag) {
    if (!signedIn()) { $('fd-list').innerHTML = '<div class="fd-empty">Sign in as a teacher to see the feed.</div>'; return; }
    const { r, d } = await call('/api/feed?limit=12' + (moreFlag && before ? '&before=' + encodeURIComponent(before) : ''));
    if (!r || !r.ok) { $('fd-list').innerHTML = '<div class="fd-empty">' + esc((d && d.error) || 'The feed could not load. Try again in a moment.') + '</div>'; return; }
    const fresh = d.posts.filter(p => !posts.some(x => x.id === p.id));
    posts = moreFlag ? posts.concat(fresh) : d.posts;
    if (d.posts.length) before = d.posts[d.posts.length - 1].created_at;
    more = d.more; loaded = true;
    await paint(false);
  }

  /* quick buttons: a card made in the share sheet goes to the feed from there */
  async function pickLesson() {
    const back = document.createElement('div'); back.className = 'fd-modal';
    back.innerHTML = '<div class="fd-box"><div style="display:flex;align-items:center"><b style="font-size:18px;flex:1">Which lesson?</b><button type="button" data-x style="border:0;background:rgba(11,16,38,.08);width:32px;height:32px;border-radius:50%;cursor:pointer">✕</button></div><div data-list style="margin-top:6px"><div class="fd-fact">Loading…</div></div></div>';
    document.body.appendChild(back);
    back.onclick = e => { if (e.target === back || e.target.closest('[data-x]')) back.remove(); };
    const { r, d } = await call('/api/library/mine/publications');
    const mine = r && r.ok ? (d.publications || []).filter(a => a.visibility === 'community' && ['lesson', 'board', 'game', 'quiz', 'other'].includes(a.kind || 'lesson')) : [];
    back.querySelector('[data-list]').innerHTML = mine.length ? mine.map(a => '<button type="button" class="fd-pick" data-id="' + esc(a.id) + '" data-kind="' + (a.kind === 'game' ? 'game' : 'lesson') + '">' + esc(a.title || 'Untitled') + '<small>' + esc(a.level || '') + '</small></button>').join('')
      : '<div class="fd-fact" style="margin-top:10px">Nothing published yet. Publish a lesson to Community and it lands in the feed by itself.</div>';
    back.querySelector('[data-list]').onclick = e => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      back.remove(); openCard(b.dataset.kind, { ref: b.dataset.id });
    };
  }
  function openCard(kind, extra) {
    if (!window.TeachEdShare) return msg('Sharing is not ready yet - reload the page.');
    window.TeachEdShare.open({ kind, api: fmtApi, surface: 'community-feed', feed: true, fields: FORMS[kind], onFeed: () => load(false), ...(extra || {}) });
  }

  async function send() {
    const t = $('fd-text'), text = t.value.trim();
    if (text.length < 3) return msg('Write a line first.');
    const b = $('fd-send'); b.disabled = true;
    const { r, d } = await call('/api/feed/posts', 'POST', { kind: mode, text });
    b.disabled = false;
    if (!r || !r.ok) return msg((d && d.error) || 'Could not post it.');
    t.value = ''; setMode('text'); msg(''); load(false);
  }
  function setMode(m) {
    mode = m;
    const q = $('fd-qbtn'); if (q) q.classList.toggle('on', m === 'question');
    const t = $('fd-text'); if (t) t.placeholder = m === 'question' ? 'Ask your colleagues…' : 'Share with colleagues…';
  }

  async function toggleAnswers(id) {
    const box = document.querySelector('[data-ansbox="' + id + '"]'); if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    const { r, d } = await call('/api/feed/posts/' + encodeURIComponent(id) + '/answers');
    if (!r || !r.ok) return;
    box.hidden = false;
    box.innerHTML = d.answers.map(a => '<p><b>' + esc(a.me ? 'You' : a.name) + '</b> ' + esc(a.text) + (a.me ? '' : ' <button type="button" class="fd-link" data-areport="' + esc(a.id) + '">Report</button>') + '</p>').join('') +
      '<form data-aform="' + esc(id) + '"><input type="text" maxlength="600" placeholder="Your answer…" aria-label="Your answer"><button type="submit">Answer</button></form>';
  }

  async function onClick(e) {
    const q = e.target.closest('[data-q]');
    if (q) { const k = q.dataset.q; if (k === 'question') return setMode(mode === 'question' ? 'text' : 'question'); if (k === 'lesson') return pickLesson(); return openCard(k); }
    if (e.target.closest('#fd-send')) return send();
    if (e.target.closest('#fd-more')) return load(true);
    const ty = e.target.closest('[data-tyts]');
    if (ty && !ty.disabled) {
      ty.disabled = true;
      const { r, d } = await call('/api/feed/posts/' + encodeURIComponent(ty.dataset.tyts) + '/tyts', 'POST');
      ty.disabled = false;
      if (r && r.ok) { ty.classList.toggle('on', d.tyted); ty.textContent = 'Тиць' + (d.tyts ? ' · ' + d.tyts : ''); }
      return;
    }
    const op = e.target.closest('[data-lesson]'); if (op) return CM.openById && CM.openById(op.dataset.lesson);
    const an = e.target.closest('[data-ans]'); if (an) return toggleAnswers(an.dataset.ans);
    const rp = e.target.closest('[data-report]');
    if (rp) { if (!confirm('Report this post? Three reports hide it until a person looks at it.')) return; const { r } = await call('/api/feed/posts/' + encodeURIComponent(rp.dataset.report) + '/report', 'POST'); rp.textContent = r && r.ok ? 'Reported' : 'Try again'; rp.disabled = true; return; }
    const ar = e.target.closest('[data-areport]');
    if (ar) { if (!confirm('Report this answer?')) return; const { r } = await call('/api/feed/answers/' + encodeURIComponent(ar.dataset.areport) + '/report', 'POST'); ar.textContent = r && r.ok ? 'Reported' : 'Try again'; ar.disabled = true; return; }
    const del = e.target.closest('[data-del]');
    if (del) { if (!confirm('Delete this post?')) return; const { r } = await call('/api/feed/posts/' + encodeURIComponent(del.dataset.del), 'DELETE'); if (r && r.ok) load(false); }
  }
  async function onSubmit(e) {
    const f = e.target.closest('[data-aform]'); if (!f) return;
    e.preventDefault();
    const input = f.querySelector('input'), text = input.value.trim(); if (text.length < 2) return;
    const id = f.dataset.aform; input.disabled = true;
    const { r, d } = await call('/api/feed/posts/' + encodeURIComponent(id) + '/answers', 'POST', { text });
    input.disabled = false;
    if (!r || !r.ok) { input.value = ''; input.placeholder = (d && d.error) || 'Could not send'; return; }
    const box = document.querySelector('[data-ansbox="' + id + '"]'); if (box) box.hidden = true;
    await load(false); toggleAnswers(id);
  }

  CM.extraTabs.set('feed', { mark: 'feed', noToolbar: true, show() { shell(); load(false); }, render() {} });

  // the tab button, first in the row; the page opens on it for a signed-in teacher
  const nav = document.querySelector('.cm-types');
  if (nav && !nav.querySelector('[data-tab="feed"]')) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cm-type comm-tab'; b.dataset.tab = 'feed'; b.textContent = 'Feed'; b.setAttribute('onclick', "switchCommTab('feed')");
    nav.prepend(b);
  }
  if (!$('tab-feed')) { const host = $('tab-all'); if (host) { const el = document.createElement('div'); el.id = 'tab-feed'; el.style.display = 'none'; host.before(el); } }
})();
