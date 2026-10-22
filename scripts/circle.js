/* The students' circle in the hub (ТЗ «Удержание» §2.2): the teaser «From your class» on Today and the full
   stream inside Challenges. Only the class and confirmed friends; one reaction, «Тиць»; a duel in one tap;
   no comments. window.Circle { mountTeaser, mountStream }. */
(function () {
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const token = () => { try { return localStorage.getItem('teachedos_token'); } catch (_) { return null; } };
  let api = null;
  const call = (path, opts) => {
    if (!api) api = window.TeachEdApp.createApiClient(() => token());
    return api('/api/circle' + path, opts).then(r => r.json().catch(() => ({})).then(d => ({ ok: r.ok, status: r.status, d })));
  };
  const PHOTO = 'img/tich/tich-joy.webp';
  const KIND = { week: 'a week', duel: 'a duel', wordset: 'a word set', streak: 'a streak', levelup: 'a new level', words: 'words', comeback: 'a comeback', perfectweek: 'a perfect week', wordmarathon: 'a word marathon', anniversary: 'an anniversary', wordday: 'a word of the day' };

  const ago = iso => {
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 2) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago';
  };
  const ini = n => String(n || '?').trim().charAt(0).toUpperCase();
  const AVA = ['#E9F5C4', '#D5F6F2', '#F6D8D8', '#FCEBD3'];

  async function cardSvg(c) {
    const S = window.TeachEdShare; if (!S || !c) return '';
    try { return S.render({ ...c, mode: 'brag' }, await S.photoFor(c.kind)); } catch (_) { return ''; }
  }
  const who = p => p.author.tich ? 'Tich' : p.author.teacher ? p.author.name + ' · your teacher' : p.author.me ? 'You' : p.author.name;
  const avatar = p => p.author.tich ? '<img class="cr-ava cr-tich" src="' + PHOTO + '" alt="">'
    : '<span class="cr-ava" style="background:' + AVA[p.author.name.length % 4] + '">' + esc(ini(p.author.name)) + '</span>';
  const tytsBtn = p => '<button class="cr-tyts' + (p.tyted ? ' on' : '') + '" data-tyts="' + esc(p.id) + '"' + (p.author.me ? ' disabled title="Your own post"' : '') + '>Тиць' + (p.tyts ? ' · ' + p.tyts : '') + '</button>';

  async function postHtml(p, opts) {
    const svg = p.card ? await cardSvg(p.card) : '';
    return '<article class="cr-post" data-id="' + esc(p.id) + '"><header>' + avatar(p) + '<div class="cr-by"><b>' + esc(who(p)) + '</b><span>' + ago(p.created_at) + '</span></div>' +
      (p.author.teacher ? '<i class="cr-tag">CLASS</i>' : p.author.tich ? '<i class="cr-tag tich">TICH</i>' : '') + '</header>' +
      (p.text ? '<p class="cr-text' + (p.author.tich ? ' tich' : '') + '">' + esc(p.text) + '</p>' : '') +
      (svg ? '<div class="cr-card">' + svg + '</div>' : '') +
      '<footer>' + tytsBtn(p) + (p.can_duel && opts && opts.onDuel ? '<button class="cr-duel" data-duel="' + esc(p.author.id) + '">Challenge to a duel</button>' : '') + '</footer></article>';
  }

  /* «Тиць» - one tap, toggled; the count comes back from the server */
  function wireTyts(root) {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-tyts]'); if (!b || b.disabled) return;
      b.disabled = true;
      call('/posts/' + encodeURIComponent(b.dataset.tyts) + '/tyts', { method: 'POST' }).then(r => {
        b.disabled = false;
        if (!r.ok) return;
        b.classList.toggle('on', r.d.tyted);
        b.textContent = 'Тиць' + (r.d.tyts ? ' · ' + r.d.tyts : '');
      });
    });
  }

  /* ── Today: one or two fresh lines, after the learning blocks ─────────────── */
  async function mountTeaser(el, opts) {
    if (!el) return;
    const r = await call('/teaser');
    if (!r.ok || !r.d.posts.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = '';
    const line = p => {
      const what = p.author.tich ? esc(p.text) : p.author.teacher ? '<b>' + esc(p.author.name) + '</b> to the class: ' + esc(p.text.length > 90 ? p.text.slice(0, 88) + '…' : p.text)
        : '<b>' + esc(p.author.name) + '</b> shared ' + (p.card ? KIND[p.card.kind] || 'a card' : 'a card');
      return '<div class="cr-line" data-id="' + esc(p.id) + '">' + avatar(p) + '<span class="cr-lt">' + what + '<small>' + ago(p.created_at) + '</small></span>' + tytsBtn(p) + '</div>';
    };
    el.innerHTML = '<div class="cr-kick"><span>FROM YOUR CLASS</span><a href="#" data-all>See all</a></div>' + r.d.posts.map(line).join('');
    el.querySelector('[data-all]').onclick = e => { e.preventDefault(); if (opts && opts.onOpen) opts.onOpen(); };
    if (!el.__wired) { el.__wired = true; wireTyts(el); }
  }

  /* ── Challenges: the whole stream ───────────────────────────────────────────── */
  async function mountStream(el, opts) {
    if (!el) return;
    el.innerHTML = '<div class="ptitle">YOUR CIRCLE</div><div class="cr-sub">Your class and your friends. Nobody else sees this — and nobody can comment.</div><div class="cr-list"><div class="dnote">Loading…</div></div><div class="cr-foot"></div>';
    const list = el.querySelector('.cr-list'), foot = el.querySelector('.cr-foot');
    let before = null;
    const load = async more => {
      const r = await call('/feed?surface=challenges&limit=12' + (before ? '&before=' + encodeURIComponent(before) : ''));
      if (!r.ok) { list.innerHTML = '<div class="dnote">The circle could not load. Try again in a moment.</div>'; return; }
      const posts = r.d.posts;
      if (!more) list.innerHTML = '';
      if (!posts.length && !more) list.innerHTML = '<div class="cr-empty"><img src="' + PHOTO + '" alt=""><div><b>Quiet in here, for now.</b><span>Win a duel or share a card from your progress — your classmates and friends will see it here. Say Тиць to the first post that appears.</span></div></div>';
      for (const p of posts) list.insertAdjacentHTML('beforeend', await postHtml(p, opts));
      if (posts.length) before = posts[posts.length - 1].created_at;
      const btn = foot.querySelector('[data-more]');
      if (btn) btn.remove();
      if (r.d.more) foot.insertAdjacentHTML('afterbegin', '<button class="cr-more" data-more>Older posts</button>');
    };
    await load(false);
    foot.insertAdjacentHTML('beforeend', '<label class="cr-set"><input type="checkbox" data-vis checked> Show me in the circle</label>');
    call('/settings').then(r => { const c = foot.querySelector('[data-vis]'); if (r.ok && c) c.checked = r.d.visible; });
    foot.onclick = e => { if (e.target.closest('[data-more]')) load(true); };
    foot.querySelector('[data-vis]').onchange = e => { const c = e.target; call('/settings', { method: 'PUT', body: JSON.stringify({ visible: c.checked }) }).then(r => { if (!r.ok) c.checked = !c.checked; }); };
    if (!el.__wired) {
      el.__wired = true; wireTyts(el);
      el.addEventListener('click', e => { const b = e.target.closest('[data-duel]'); if (b && opts && opts.onDuel) opts.onDuel(b.dataset.duel); });
    }
  }

  window.Circle = { mountTeaser, mountStream };
})();
