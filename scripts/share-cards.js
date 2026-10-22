/* Share cards (ТЗ «Шеринг-карточки» FINAL 1.0), vanilla port of the package's share-cards.ts,
   ShareCard.tsx, ShareSheet.tsx and rasterize.ts.

   window.TeachEdShare.open({ kind, ref?, title?, words?, surface, api }) asks the server for the card
   (the server builds its data from the type's white list), shows the sheet: preview, Invite / Just brag
   where the type has an action, Share (PNG + link) and Copy link, the honest privacy line.
   window.TeachEdShare.render(card, photoDataUrl) gives the SVG string - the recipient's page uses it too.

   One grammar for every card, SVG 1080×1350: header (TeachEd + the type's kicker) · a bright photo of
   Тіч · the body by type · footer (owner left, "Тіч. Тиць." and teached.tech right). The photo is always
   there (brand). Photos are same-origin and drawn as data URLs, so the canvas never gets tainted. */
(function () {
  'use strict';
  const W = 1080, H = 1350;
  const G = '#24282C', CREAM = '#FBF7EC', LIME = '#D5F568', TURQ = '#57B8B2', PINK = '#F2A7BB', PINK_SOFT = '#F8DBDB', BLUE = '#3E5FA3', SAND = '#E9DCC3';
  const F = 'Manrope, -apple-system, Segoe UI, Arial, sans-serif';

  /* the photo pool of each type: the first frame is the default (img/tich/, the public pack) */
  const P = n => 'img/tich/tich-' + n + '.webp';
  const POOL = {
    week: [P('joy'), P('joy')], streak: [P('joy')], words: [P('joy')], duel: [P('basketball'), P('brand')], levelup: [P('joy'), P('brand')],
    wordset: [P('joy')], costreak: [P('joy')], duelinvite: [P('basketball')], comeback: [P('joy')], perfectweek: [P('brand'), P('joy')],
    wordmarathon: [P('joy')], lesson: [P('hoodie'), P('joy')], pulse: [P('joy')], game: [P('basketball')], milestone: [P('brand'), P('joy')],
    authorweek: [P('brand'), P('hoodie')], anniversary: [P('brand'), P('robe')], parentreport: [P('robe'), P('joy')], welcome: [P('joy')],
    together: [P('joy')], wordday: [P('joy')], gratitude: [P('robe'), P('joy')],
  };
  const KICKER = {
    week: 'STUDENT WIN', streak: 'STUDENT WIN', words: 'STUDENT WIN', duel: 'STUDENT WIN', levelup: 'LEVEL UP', wordset: 'WORD SET',
    costreak: 'TOGETHER', duelinvite: 'DUEL INVITE', comeback: 'COMEBACK', perfectweek: 'PERFECT WEEK', wordmarathon: 'WORD MARATHON',
    lesson: 'MY LESSON', pulse: 'CLASS PULSE', game: 'MY GAME', milestone: 'MILESTONE', parentreport: 'PROGRESS REPORT', welcome: 'WELCOME',
    together: 'TOGETHER', wordday: 'WORD OF THE DAY', gratitude: 'THANK YOU', authorweek: 'AUTHOR OF THE WEEK', anniversary: 'ANNIVERSARY',
  };
  const ACTION = { wordset: 'Add to my Word Bank →', duelinvite: 'Accept the duel →', costreak: 'Start our streak →', lesson: 'Take it to your board →', game: 'Play it →', welcome: 'Open my hub →' };
  const inviteAction = card => (card.mode === 'invite' && card.code && ACTION[card.kind]) || null;
  const shortUrl = card => card.code ? 'teached.tech/c.html?c=' + card.code : '';
  const fullUrl = card => card.code ? location.origin + '/c.html?c=' + card.code : '';
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const txt = (x, y, size, weight, fill, body, extra) => '<text x="' + x + '" y="' + y + '" font-family="' + F + '" font-weight="' + weight + '" font-size="' + size + '" fill="' + fill + '"' + (extra || '') + '>' + body + '</text>';
  const wrap = (t, max) => { const out = []; let cur = ''; String(t).split(' ').forEach(w => { if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) out.push(cur); return out.slice(0, 4); };
  const fit = (t, max) => { t = String(t || ''); return t.length > max ? t.slice(0, max - 1) + '…' : t; };

  function header(card, dark) {
    const ink = dark ? CREAM : G;
    return txt(64, 96, 40, 800, ink, 'TeachEd') + txt(1016, 96, 30, 700, ink, esc(KICKER[card.kind] || ''), ' text-anchor="end" opacity="0.6"');
  }
  function footer(card, dark) {
    const s = card.snapshot, ink = dark ? CREAM : G;
    const name = card.kind === 'together' ? s.teacherName + ' + ' + s.studentName : card.audience === 'student' ? s.studentName : s.teacherName;
    const sub = card.kind === 'together' ? 'teacher and student · TeachEd' : card.audience === 'student'
      ? [s.levelLabel, s.teacherName ? 'learning with ' + s.teacherName : 'learning English'].filter(Boolean).join(' · ') : s.teacherTagline;
    return '<line x1="64" y1="1176" x2="1016" y2="1176" stroke="' + ink + '" stroke-opacity="0.25" stroke-width="2"/>' +
      txt(64, 1242, 38, 800, ink, esc(name)) + txt(64, 1292, 29, 600, ink, esc(sub || ''), ' opacity="0.7"') +
      txt(1016, 1242, 34, 800, ink, 'Тіч. Тиць.', ' text-anchor="end"') + txt(1016, 1292, 28, 600, ink, 'teached.tech', ' text-anchor="end" opacity="0.7"');
  }
  function photo(src, y, h, id) {
    return '<clipPath id="' + id + '"><rect x="64" y="' + y + '" width="952" height="' + h + '" rx="36"/></clipPath>' +
      (src ? '<image href="' + src + '" x="64" y="' + y + '" width="952" height="' + h + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + id + ')"/>'
        : '<rect x="64" y="' + y + '" width="952" height="' + h + '" rx="36" fill="#7FD9CF"/>');
  }
  const band = (t, url, y) => '<rect x="64" y="' + y + '" width="952" height="132" rx="28" fill="' + G + '"/>' +
    txt(540, y + 58, 40, 800, LIME, esc(t), ' text-anchor="middle"') + txt(540, y + 100, 27, 600, CREAM, esc(url), ' text-anchor="middle" opacity="0.85"');
  const grad = (id, a, b) => '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>';
  const svg = (body, label) => '<svg class="tsc-card" xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label || '') + '">' + body + '</svg>';

  let uidN = 0;
  function render(card, src) {
    const s = card.snapshot || {}, uid = 'sc' + (++uidN), url = shortUrl(card), action = inviteAction(card);
    if (card.kind === 'wordset') {
      return svg('<rect width="' + W + '" height="' + H + '" fill="' + TURQ + '"/>' + header(card, true) + photo(src, 140, 320, uid) +
        txt(64, 580, 80, 800, CREAM, esc(fit(s.setTitle, 22))) + txt(64, 636, 34, 700, CREAM, esc(s.totalWords + ' words · ' + (s.setDescription || '')), ' opacity="0.9"') +
        (s.previewWords || []).slice(0, 5).map((w, i) => '<rect x="' + (64 + i * 196) + '" y="676" width="180" height="60" rx="30" fill="' + CREAM + '"/>' + txt(154 + i * 196, 718, w.length > 9 ? 22 : 28, 700, G, esc(fit(w, 12)), ' text-anchor="middle"')).join('') +
        (action ? band(action, url, 790) : '') + txt(64, 1010, 34, 700, CREAM, 'Shared by ' + esc(s.studentName)) + footer(card, true), s.setTitle);
    }
    if (card.kind === 'lesson' || card.kind === 'game') {
      const lines = wrap(s.title || '', 22);
      return svg('<rect width="' + W + '" height="' + H + '" fill="' + CREAM + '"/>' + header(card) + photo(src, 140, 430, uid) +
        lines.slice(0, 2).map((l, i) => txt(64, 716 + i * 84, 76, 800, G, esc(l))).join('') +
        '<rect x="64" y="' + (742 + (Math.min(lines.length, 2) - 1) * 84) + '" width="520" height="15" fill="' + LIME + '"/>' +
        (s.chips || []).map((c, i) => '<rect x="' + (64 + i * 216) + '" y="' + (792 + (Math.min(lines.length, 2) - 1) * 84) + '" width="200" height="56" rx="28" fill="#EFEAD8"/>' + txt(164 + i * 216, 830 + (Math.min(lines.length, 2) - 1) * 84, 27, 700, G, esc(fit(c, 12)), ' text-anchor="middle"')).join('') +
        txt(64, 960, 33, 600, G, esc(fit(s.details, 52)), ' opacity="0.75"') +
        txt(64, 1050, 42, 800, G, card.mode === 'invite' && action ? esc(action) : 'Taken by ' + (s.usedByCount || 0) + ' colleague' + (s.usedByCount === 1 ? '' : 's')) +
        txt(64, 1100, 29, 600, G, esc(url), ' opacity="0.7"') + footer(card), s.title);
    }
    if (card.kind === 'pulse') {
      const xp = String(s.weekXp).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return svg('<rect width="' + W + '" height="' + H + '" fill="' + G + '"/>' + header(card, true) + photo(src, 140, 380, uid) +
        txt(64, 640, 56, 800, CREAM, 'My class this week') +
        txt(64, 812, xp.length > 6 ? 130 : 165, 800, LIME, esc(xp) + '<tspan font-size="64" dx="14">XP</tspan>') +
        txt(64, 878, 34, 700, CREAM, 'earned together by ' + s.studentsCount + ' students', ' opacity="0.85"') +
        (s.homeworkOnTimePct == null ? txt(64, 1004, 34, 700, CREAM, 'no homework handed in this week', ' opacity="0.85"') : txt(64, 1010, 72, 800, CREAM, s.homeworkOnTimePct + '%<tspan font-size="30" dx="16" opacity="0.85">homework on time</tspan>')) +
        txt(64, 1096, 72, 800, CREAM, s.duelsPlayed + '<tspan font-size="30" dx="16" opacity="0.85">duels played · aggregates only, no names</tspan>') + footer(card, true), 'Class pulse');
    }
    if (card.kind === 'parentreport') {
      return svg('<rect width="' + W + '" height="' + H + '" fill="' + PINK_SOFT + '"/>' + header(card) + photo(src, 140, 360, uid) +
        txt(64, 610, 64, 800, G, esc(s.studentName + ' · ' + s.periodLabel)) +
        (s.rows || []).slice(0, 4).map((r, i) => txt(64, 716 + i * 96, 54, 800, G, esc(r.value)) + txt(400, 716 + i * 96, 34, 600, G, esc(r.label), ' opacity="0.7"')).join('') +
        (s.note ? wrap('“' + s.note + '”', 44).slice(0, 3).map((l, i) => txt(64, 1040 + i * 44, 34, 600, G, esc(l), ' font-style="italic" opacity="0.85"')).join('') : '') + footer(card), 'Progress report');
    }
    if (card.kind === 'welcome') {
      const gid = uid + 'g';
      return svg(grad(gid, TURQ, LIME) + '<rect width="' + W + '" height="' + H + '" fill="url(#' + gid + ')"/>' + header(card) + photo(src, 140, 470, uid) +
        txt(64, 740, 66, 800, G, esc(s.studentName ? s.studentName + ', welcome' : 'Welcome')) + txt(64, 818, 66, 800, G, 'to my board!') +
        txt(64, 892, 35, 700, G, 'Your hub is ready: words, duels and our lessons live there', ' opacity="0.8"') +
        (action ? band(action, url, 950) : '') + footer(card), 'Welcome');
    }
    if (card.kind === 'milestone' || card.kind === 'authorweek' || card.kind === 'anniversary') {
      const big = String(s.bigValue);
      return svg('<rect width="' + W + '" height="' + H + '" fill="' + LIME + '"/>' + header(card) + photo(src, 140, 430, uid) +
        txt(64, 830, big.length > 4 ? 150 : 200, 800, G, esc(big)) + txt(64, 920, 52, 800, G, esc(fit(s.label, 34))) +
        txt(64, 990, 34, 700, G, esc(fit((s.facts || []).join(' · '), 56)), ' opacity="0.8"') + footer(card), s.label);
    }
    if (card.kind === 'together') {
      const gid = uid + 'g';
      return svg(grad(gid, TURQ, PINK) + '<rect width="' + W + '" height="' + H + '" fill="url(#' + gid + ')"/>' + header(card) + photo(src, 140, 470, uid) +
        txt(64, 740, 62, 800, G, 'Lesson complete —') + txt(64, 818, 62, 800, G, 'together') +
        txt(64, 940, s.lessonTitle.length > 18 ? 56 : 76, 800, G, esc(fit(s.lessonTitle, 28))) +
        txt(64, 1010, 35, 700, G, esc((s.facts || []).join(' · ')), ' opacity="0.8"') + footer(card), 'Lesson complete together');
    }
    if (card.kind === 'wordday') {
      return svg('<rect width="' + W + '" height="' + H + '" fill="' + SAND + '"/>' + header(card) + photo(src, 140, 300, uid) +
        txt(64, 620, s.word.length > 12 ? 76 : 104, 800, G, esc(s.word)) +
        txt(64, 682, 36, 600, G, esc([s.transcription, s.partOfSpeech].filter(Boolean).join(' · ')), ' opacity="0.65"') +
        '<rect x="64" y="716" width="420" height="14" fill="' + LIME + '"/>' +
        (s.definition || []).map((l, i) => txt(64, 806 + i * 58, 44, 700, G, esc(l))).join('') +
        (s.example ? txt(64, 1010, 34, 600, G, '“' + esc(s.example) + '”', ' opacity="0.8"') : '') +
        txt(64, 1096, 29, 600, G, 'Word № ' + s.collectionNo + ' in my collection · ' + esc(url), ' opacity="0.7"') + footer(card), s.word);
    }
    if (card.kind === 'gratitude') {
      const lines = wrap('“' + s.quote + '”', 24);
      return svg('<rect width="' + W + '" height="' + H + '" fill="' + PINK_SOFT + '"/>' + header(card) + photo(src, 140, 380, uid) +
        lines.map((l, i) => txt(64, 640 + i * 72, 54, 800, G, esc(l))).join('') +
        txt(64, 640 + lines.length * 72 + 30, 36, 700, G, '— ' + esc(s.quoteAuthor), ' opacity="0.75"') +
        txt(64, 960, 32, 600, G, 'Published with permission.', ' opacity="0.7"') + txt(64, 1010, 32, 600, G, 'Thank you for trusting me with your English.', ' opacity="0.7"') + footer(card), 'Thank you');
    }
    // student stat cards: week / streak / words / duel / levelup / costreak / duelinvite / comeback / perfectweek / wordmarathon
    const dark = card.kind === 'comeback', ink = dark ? CREAM : G, gid = uid + 'g';
    return svg(grad(gid, dark ? BLUE : TURQ, card.kind === 'costreak' ? PINK : dark ? TURQ : LIME) +
      '<rect width="' + W + '" height="' + H + '" fill="url(#' + gid + ')"/>' + header(card, dark) + photo(src, 140, 470, uid) +
      txt(64, 730, 58, 800, ink, esc(s.headline)) +
      txt(64, 905, String(s.bigValue).length > 9 ? 96 : 165, 800, ink, esc(s.bigValue) + (s.unit ? '<tspan font-size="70" dx="14">' + esc(s.unit) + '</tspan>' : '')) +
      txt(64, 982, 35, 700, ink, esc((s.facts || []).join(' · ')), ' opacity="0.8"') +
      (s.partnerName && !action && (card.kind === 'costreak' || card.kind === 'duelinvite') ? txt(64, 1040, 35, 700, ink, card.kind === 'costreak' ? 'Together with ' + esc(s.partnerName) : 'Challenge sent to ' + esc(s.partnerName)) : '') +
      (action ? band(action, url, 1010) : '') + footer(card, dark), (s.headline || '') + ': ' + (s.bigValue || '') + ' ' + (s.unit || ''));
  }

  /* photos as data URLs (an <image> by URL would taint the canvas inside an SVG image) */
  const photoCache = {};
  function photoFor(kind) {
    const src = (POOL[kind] || POOL.week)[0];
    if (photoCache[src]) return photoCache[src];
    photoCache[src] = fetch(src).then(r => (r.ok ? r.blob() : Promise.reject(new Error('photo'))))
      .then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(''); fr.readAsDataURL(b); }))
      .catch(() => '');
    return photoCache[src];
  }

  function toPng(svgText) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        c.getContext('2d').drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url);
        c.toBlob(b => (b ? res(b) : rej(new Error('png'))), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('svg')); };
      img.src = url;
    });
  }
  /* system share with the file; else text + link; else download. Returns the channel for the metrics. */
  async function sharePng(blob, name, text, url) {
    const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
    if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, url }); return 'native-file'; }
    if (navigator.share) { await navigator.share({ text, url }); return 'native-text'; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return 'download';
  }

  const BASE = () => (window.TEACHED_API_BASE || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:4000' : ''));
  function event(name, data) {
    try { fetch(BASE() + '/api/cards/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: name, ...data }), keepalive: true }).catch(() => {}); } catch (_) {}
  }
  /* the message that goes with the picture - built from the card itself */
  function messageFor(card) {
    const s = card.snapshot;
    if (card.kind === 'week') return 'My week in English: ' + s.bigValue + ' XP on TeachEd';
    if (card.kind === 'duel') return 'Won a duel on TeachEd: ' + s.bigValue;
    if (card.kind === 'wordset') return s.setTitle + ' - ' + s.totalWords + ' words. Add them to your Word Bank';
    if (card.kind === 'lesson' || card.kind === 'game') return s.title + (card.kind === 'game' ? ' - play it' : ' - take it to your board');
    if (card.kind === 'words') return 'A whole word set mastered on TeachEd: ' + s.bigValue + ' words';
    if (card.kind === 'costreak') return 'Duel me on TeachEd - let us start a shared streak';
    if (card.kind === 'duelinvite') return 'I challenge you to a duel on TeachEd: ' + s.bigValue;
    if (card.kind === 'comeback') return 'I am back on TeachEd after ' + s.bigValue + ' days';
    if (card.kind === 'perfectweek') return 'A perfect week on TeachEd: 7 of 7';
    if (card.kind === 'wordmarathon') return s.bigValue + ' words in my Word Bank on TeachEd';
    if (card.kind === 'anniversary' || card.kind === 'milestone') return s.bigValue + ' ' + s.label;
    if (card.kind === 'authorweek') return s.bigValue + ' colleagues took my lessons this week on TeachEd';
    if (card.kind === 'together') return 'Lesson complete - together on TeachEd';
    if (card.kind === 'wordday') return 'Word of the day: ' + s.word;
    if (card.kind === 'gratitude') return '“' + s.quote + '”';
    if (card.kind === 'streak') return s.bigValue + ' days in a row on TeachEd';
    if (card.kind === 'levelup') return 'New level on TeachEd: ' + s.bigValue;
    if (card.kind === 'pulse') return 'My class this week: ' + s.weekXp + ' XP on TeachEd';
    if (card.kind === 'welcome') return 'Welcome to my board on TeachEd';
    if (card.kind === 'parentreport') return s.studentName + ' · ' + s.periodLabel;
    return 'TeachEd';
  }

  function ensureStyle() {
    if (document.getElementById('shsStyle')) return;
    const st = document.createElement('style'); st.id = 'shsStyle';
    st.textContent = '.shs-backdrop{position:fixed;inset:0;z-index:9700;background:rgba(11,16,38,.45);display:flex;align-items:flex-end;justify-content:center}' +
      '.shs-sheet{background:#F6F6EF;color:#0B1026;width:min(480px,100%);max-height:92vh;overflow:auto;border-radius:24px 24px 0 0;padding:18px 18px 24px;font-family:Manrope,sans-serif;box-sizing:border-box}' +
      '@media(min-width:700px){.shs-backdrop{align-items:center}.shs-sheet{border-radius:24px}}' +
      '.shs-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.shs-title{font-weight:800;font-size:19px}' +
      '.shs-sheet .shs-close{background:none;border:none;font-size:16px;cursor:pointer;color:#0B1026;padding:6px}' +
      '.shs-sheet .shs-btn{background:#fff;border:1.5px solid rgba(11,16,38,.14);border-radius:999px;padding:12px 16px;font:700 15px Manrope,sans-serif;color:#0B1026;cursor:pointer}' +
      '.shs-sheet .shs-btn-primary{background:linear-gradient(180deg,#DFFB8A,#D3F26A);border-color:transparent}.shs-sheet .shs-btn:disabled{opacity:.55;cursor:wait}' +
      '.shs-preview{border-radius:18px;overflow:hidden;background:#E9E7DC;min-height:120px}.shs-preview svg{width:100%;height:auto;display:block}' +
      '.shs-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.shs-note{font-size:12.5px;line-height:1.5;color:#8A8672;margin:12px 0 0}' +
      '.shs-modes{display:flex;gap:6px;margin-bottom:12px}.shs-sheet .shs-mode{background:#fff;border:1.5px solid rgba(11,16,38,.14);border-radius:999px;padding:8px 14px;font:700 13.5px Manrope,sans-serif;color:#0B1026;cursor:pointer}' +
      '.shs-sheet .shs-mode.on{background:#0B1026;color:#F5F5EF;border-color:transparent}.shs-err{font:700 14px Manrope,sans-serif;padding:24px;text-align:center}';
    document.head.appendChild(st);
  }

  const NOTE = card => card.audience === 'student' ? 'Only game data on the card: XP, streak, words, duels. Lessons and teacher notes never appear.'
    : card.kind === 'pulse' ? 'Class aggregates only. No student names on the card.'
    : card.kind === 'parentreport' ? 'Private send: this report has no public page.'
    : 'Your name leads the card. TeachEd is the workshop where it was made.';

  /* opts: { kind, ref, title, words, description, surface, api (the page's API client), onShared } */
  async function open(opts) {
    ensureStyle();
    const back = document.createElement('div'); back.className = 'shs-backdrop'; back.setAttribute('role', 'dialog'); back.setAttribute('aria-modal', 'true');
    back.innerHTML = '<div class="shs-sheet"><div class="shs-head"><span class="shs-title">Share</span><button class="shs-close" aria-label="Close">✕</button></div><div class="shs-body"><div class="shs-preview"></div></div></div>';
    document.body.appendChild(back);
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.querySelector('.shs-close').onclick = close; back.onclick = e => { if (e.target === back) close(); };
    let card, note = '';
    let fields = null;
    const defs = opts.fields || (opts.askNote ? [{ key: 'note', label: 'A short line for the parent (optional)', max: 140, area: true, placeholder: 'Strong month - speaking is braver every week.' }] : null);
    if (defs) {
      // one step first: the person fills in what the card needs, then the card is made
      fields = await new Promise(res => {
        back.querySelector('.shs-body').innerHTML = defs.map(d => d.check
          ? '<label style="display:flex;gap:10px;align-items:flex-start;margin:12px 0;font:700 14px Manrope,sans-serif"><input type="checkbox" data-k="' + esc(d.key) + '" style="margin-top:3px"><span>' + esc(d.label) + '</span></label>'
          : '<p class="shs-note" style="margin:12px 0 6px;color:#0B1026;font-weight:700">' + esc(d.label) + '</p>' + (d.area ? '<textarea rows="3"' : '<input type="text"') + ' data-k="' + esc(d.key) + '" maxlength="' + (d.max || 120) + '" placeholder="' + esc(d.placeholder || '') + '" style="width:100%;box-sizing:border-box;border-radius:14px;border:1.5px solid rgba(11,16,38,.14);padding:12px;font:600 15px Manrope,sans-serif">' + (d.area ? '</textarea>' : '')).join('') +
          '<div class="shs-actions"><button class="shs-btn shs-btn-primary" id="shsMake">Make the card</button></div>';
        back.querySelector('#shsMake').onclick = () => {
          const out = {};
          back.querySelectorAll('[data-k]').forEach(el => { out[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
          res(out);
        };
      });
      note = fields.note || '';
      back.querySelector('.shs-body').innerHTML = '<div class="shs-preview"></div>';
    }
    try {
      const r = await opts.api('/api/cards', { method: 'POST', body: { kind: opts.kind, ref: opts.ref, title: opts.title, words: opts.words, description: opts.description, note, fields } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not make the card');
      card = d;
    } catch (err) { back.querySelector('.shs-body').innerHTML = '<div class="shs-err">' + esc(err.message) + '</div>'; return; }
    event('sheet_shown', { surface: opts.surface, kind: card.kind });
    const src = await photoFor(card.kind);
    let mode = card.mode;
    const isPrivate = !!card.private;
    const hasInvite = !!ACTION[card.kind] && !isPrivate;
    const body = back.querySelector('.shs-body');
    const draw = () => {
      const eff = { ...card, mode };
      body.innerHTML = (hasInvite ? '<div class="shs-modes" role="tablist"><button class="shs-mode' + (mode === 'invite' ? ' on' : '') + '" data-m="invite">Invite</button><button class="shs-mode' + (mode === 'brag' ? ' on' : '') + '" data-m="brag">Just brag</button></div>' : '') +
        '<div class="shs-preview">' + render(eff, src) + '</div><div class="shs-actions"><button class="shs-btn shs-btn-primary" data-a="share">' + (isPrivate ? 'Send to parent' : 'Share') + '</button>' + (isPrivate ? '' : '<button class="shs-btn" data-a="copy">Copy link</button>') + '</div>' +
        '<p class="shs-note">' + esc(NOTE(card)) + '</p><p class="shs-note" data-msg></p>';
      body.querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { mode = b.dataset.m; draw(); }; });
      const msg = t => { body.querySelector('[data-msg]').textContent = t; };
      body.querySelector('[data-a="share"]').onclick = async e => {
        const b = e.currentTarget; b.disabled = true;
        try {
          const blob = await toPng(render(eff, src));
          const ch = await sharePng(blob, 'teached-' + card.kind + '-' + (card.code || 'private') + '.png', messageFor(eff), fullUrl(eff));
          event('shared', { mode, channel: ch, kind: card.kind });
          msg(ch === 'download' ? (isPrivate ? 'Picture saved - send it to the parent yourself.' : 'Picture saved - send it with the link: ' + fullUrl(eff)) : 'Shared.');
          if (opts.onShared) opts.onShared(ch, mode);
        } catch (err) { if (err && err.name !== 'AbortError') msg('The picture could not be made here - Copy link still works.'); }
        b.disabled = false;
      };
      const copyBtn = body.querySelector('[data-a="copy"]');
      if (copyBtn) copyBtn.onclick = async e => {
        const b = e.currentTarget, u = fullUrl(eff);
        try { await navigator.clipboard.writeText(u); b.textContent = 'Copied ✓'; setTimeout(() => { b.textContent = 'Copy link'; }, 2000); }
        catch (_) { window.prompt('Copy this link:', u); }
        event('shared', { mode, channel: 'copy-link', kind: card.kind });
        if (opts.onShared) opts.onShared('copy-link', mode);
      };
    };
    draw();
  }

  /* the person's own cards, each one can be taken down: the page stops working, a picture already saved stays with whoever got it */
  async function manage(opts) {
    ensureStyle();
    const back = document.createElement('div'); back.className = 'shs-backdrop';
    back.innerHTML = '<div class="shs-sheet"><div class="shs-head"><span class="shs-title">My shared cards</span><button class="shs-close" aria-label="Close">✕</button></div><div class="shs-body">Loading…</div></div>';
    document.body.appendChild(back);
    const close = () => back.remove(); back.querySelector('.shs-close').onclick = close; back.onclick = e => { if (e.target === back) close(); };
    const body = back.querySelector('.shs-body');
    const load = async () => {
      const r = await opts.api('/api/cards/mine'); const d = await r.json().catch(() => ({}));
      const live = ((d && d.cards) || []).filter(c => !c.revoked_at);
      body.innerHTML = live.length ? live.map(c => '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(11,16,38,.08)"><div style="flex:1;min-width:0"><b>' + esc(c.headline || c.set_title || c.title || KICKER[c.kind] || c.kind) + '</b><div style="font-size:12.5px;opacity:.6">' + esc(KICKER[c.kind] || c.kind) + ' · ' + new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · opened ' + c.views + '×</div></div><button class="shs-btn" data-rm="' + esc(c.code) + '">Remove</button></div>').join('') +
        '<p class="shs-note">Removing stops the page. A picture someone already saved stays with them.</p>' : '<p class="shs-note">No cards shared yet.</p>';
      body.querySelectorAll('[data-rm]').forEach(b => { b.onclick = async () => { if (!confirm('Remove this card’s page? The link stops working.')) return; await opts.api('/api/cards/' + encodeURIComponent(b.dataset.rm), { method: 'DELETE' }); load(); }; });
    };
    load();
  }

  window.TeachEdShare = { manage, open, render, photoFor, toPng, event, inviteAction, KICKER, POOL, ACTION };
})();
