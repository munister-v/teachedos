/* ═══════════════════════════════════════════════════════════════════════════
   TeachEd lesson covers - the banner on top of a Community lesson card.

   A cover is a small JSON design, not a picture: background (colour,
   gradient, pattern, one of our photos or the teacher's own), a big
   headline in one of five fonts, an optional sticker and the level badge.
   Being HTML + CSS it renders crisp at any size - card, preview, lesson page -
   and costs nothing to store. Only an uploaded photo is an image; it lives
   on the server and comes back through /api/library/:id/cover.

   A lesson with no saved cover still gets a designed one: auto() derives it
   from the title, level and skill, so old lessons are not grey boxes.

   window.TeachEdCover = { render, auto, normalize, editor, PALETTE, PHOTOS }
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* The client's brand sheet (18 colours + white). The server keeps the same
     whitelist, so a cover can never carry an off-brand or injected colour. */
  const PALETTE = ['#24282C', '#5D614B', '#A3A48D', '#CACCC6', '#F6F6EF', '#FFFFFF',
    '#CDF649', '#D3F36B', '#FFE44D', '#F3DF6B', '#F3A46B', '#FF8C3A', '#FF4E00',
    '#49F6F0', '#6BAFF3', '#3F9FFF', '#9F8CE8', '#886BF3', '#6B42FD'];
  const TEXT_COLORS = ['#FFFFFF', '#24282C', '#CDF649', '#FFE44D', '#49F6F0', '#F6F6EF'];
  const PATTERNS = [
    { key: 'dots', label: 'Dots' }, { key: 'grid', label: 'Grid' },
    { key: 'lines', label: 'Notebook' }, { key: 'stripes', label: 'Stripes' },
    { key: 'waves', label: 'Waves' }, { key: 'zigzag', label: 'Zigzag' },
    { key: 'circles', label: 'Circles' }, { key: 'confetti', label: 'Confetti' },
  ];
  const PHOTOS = ['lake', 'fjord', 'hills', 'carpathians', 'sunset', 'harbour', 'canals',
    'alley', 'river-night', 'frost', 'moss', 'laurel', 'fog'];
  const FONTS = [
    { key: 'display', label: 'Poster' }, { key: 'sans', label: 'Clean' },
    { key: 'serif', label: 'Classic' }, { key: 'hand', label: 'Handwritten' },
    { key: 'mono', label: 'Typewriter' },
  ];
  const GRADIENTS = [
    ['#6B42FD', '#FF4E00'], ['#3F9FFF', '#49F6F0'], ['#FF8C3A', '#FFE44D'],
    ['#24282C', '#6B42FD'], ['#CDF649', '#49F6F0'], ['#886BF3', '#F3A46B'],
    ['#FF4E00', '#FFE44D'], ['#24282C', '#5D614B'], ['#9F8CE8', '#6BAFF3'],
    ['#D3F36B', '#F3DF6B'],
  ];
  const STICKERS = ['', '💬', '📖', '✍️', '🎧', '🧩', '🔤', '🎯', '🌍', '🚀', '🎬', '🍕', '⚽', '🎵', '✈️', '🧠', '💡', '🌱', '🎉', '☕', '🏆', '❤️'];
  const SKILL_STICKER = { speaking: '💬', grammar: '🧩', vocabulary: '🔤', reading: '📖', writing: '✍️', listening: '🎧' };

  const STYLES = new Set(['color', 'gradient', 'pattern', 'photo', 'upload']);
  const PATTERN_KEYS = new Set(PATTERNS.map(p => p.key));
  const FONT_KEYS = new Set(FONTS.map(f => f.key));
  const PALETTE_SET = new Set(PALETTE);

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hex = (v, fallback) => { const h = String(v || '').toUpperCase(); return PALETTE_SET.has(h) ? h : fallback; };
  const clip = (s, n) => String(s ?? '').trim().slice(0, n);

  function luminance(h) {
    const n = parseInt(h.slice(1), 16);
    const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  }
  // Ink or white, whichever reads better on this background.
  const readableOn = bg => luminance(bg) > .38 ? '#24282C' : '#FFFFFF';

  function normalize(c) {
    if (!c || typeof c !== 'object') return null;
    const shade = Math.round(Number(c.shade));
    return {
      style: STYLES.has(c.style) ? c.style : 'color',
      bg: hex(c.bg, '#24282C'),
      bg2: hex(c.bg2, '#6B42FD'),
      pattern: PATTERN_KEYS.has(c.pattern) ? c.pattern : 'dots',
      photo: PHOTOS.includes(c.photo) ? c.photo : 'lake',
      font: FONT_KEYS.has(c.font) ? c.font : 'display',
      ink: hex(c.ink, '#FFFFFF'),
      accent: hex(c.accent, '#CDF649'),
      align: c.align === 'left' ? 'left' : 'center',
      title: clip(c.title, 70),
      sub: clip(c.sub, 90),
      sticker: clip(c.sticker, 8),
      badge: c.badge !== false,
      shade: Number.isFinite(shade) ? Math.max(0, Math.min(70, shade)) : 30,
    };
  }

  /* Designs an untouched lesson gets. Picked by a hash of the title, so a
     lesson keeps its look between visits and neighbours rarely match. */
  const AUTO_DESIGNS = [
    { style: 'gradient', bg: '#6B42FD', bg2: '#FF4E00', font: 'display', ink: '#FFFFFF' },
    { style: 'pattern', bg: '#24282C', pattern: 'grid', accent: '#CDF649', font: 'display', ink: '#CDF649' },
    { style: 'color', bg: '#CDF649', font: 'hand', ink: '#24282C' },
    { style: 'pattern', bg: '#3F9FFF', pattern: 'dots', accent: '#FFFFFF', font: 'sans', ink: '#FFFFFF' },
    { style: 'gradient', bg: '#FF8C3A', bg2: '#FFE44D', font: 'serif', ink: '#24282C' },
    { style: 'photo', photo: 'lake', font: 'display', ink: '#FFFFFF', shade: 38 },
    { style: 'pattern', bg: '#9F8CE8', pattern: 'waves', accent: '#FFFFFF', font: 'display', ink: '#24282C' },
    { style: 'gradient', bg: '#24282C', bg2: '#6B42FD', font: 'serif', ink: '#FFFFFF' },
    { style: 'pattern', bg: '#F6F6EF', pattern: 'lines', accent: '#6BAFF3', font: 'hand', ink: '#24282C' },
    { style: 'photo', photo: 'sunset', font: 'serif', ink: '#FFFFFF', shade: 34 },
    { style: 'pattern', bg: '#FF4E00', pattern: 'confetti', accent: '#FFE44D', font: 'display', ink: '#FFFFFF' },
    { style: 'gradient', bg: '#CDF649', bg2: '#49F6F0', font: 'sans', ink: '#24282C' },
    { style: 'photo', photo: 'hills', font: 'hand', ink: '#FFFFFF', shade: 36 },
    { style: 'pattern', bg: '#886BF3', pattern: 'circles', accent: '#CDF649', font: 'sans', ink: '#FFFFFF' },
  ];

  function hash(str) {
    let h = 2166136261;
    for (const ch of String(str || '')) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // "B1 Speaking: travel" → "Speaking: travel" - the badge already says B1.
  function stripLevel(title) {
    return String(title || '').replace(/^\s*(A1|A2|B1|B2|C1|C2)\b\s*[·:\-–—|]?\s*/i, '').trim() || String(title || '').trim();
  }

  function auto(info = {}) {
    const d = AUTO_DESIGNS[hash(info.title || info.id || '') % AUTO_DESIGNS.length];
    const skill = String(info.skill || '').toLowerCase();
    return normalize({
      ...d,
      title: '',
      sub: [info.skill, info.duration ? `${info.duration} min` : ''].filter(Boolean).join(' · '),
      sticker: SKILL_STICKER[skill] || '',
      badge: true,
      align: 'center',
    });
  }

  function fontSize(font, text) {
    const base = { display: 8.6, sans: 7, serif: 7.2, hand: 9.4, mono: 5.8 }[font] || 7;
    const n = String(text || '').length;
    // longer titles shrink sooner, so a cover shows the whole name (it used
    // to cut 'Names, Countries & Be…' at two lines)
    const k = n > 50 ? .5 : n > 38 ? .58 : n > 26 ? .68 : n > 16 ? .8 : 1;
    return (base * k).toFixed(2);
  }

  /* info: { title, level, skill, duration, imageUrl, kind } - the lesson the
     cover belongs to. cover: saved design, or null for the automatic one. */
  function render(cover, info = {}) {
    const c = normalize(cover) || auto(info);
    const title = c.title || stripLevel(info.title) || 'Your lesson title';
    const ink = c.ink;
    let bg = '';
    const cls = ['tcv-cover', `tcv-font-${c.font}`, `tcv-align-${c.align}`];
    if (c.style === 'color') bg = `background:${c.bg};`;
    else if (c.style === 'gradient') bg = `background:linear-gradient(135deg,${c.bg},${c.bg2});`;
    else if (c.style === 'pattern') { bg = `background:${c.bg};--tcv-accent:${c.accent};`; cls.push('tcv-pattern', `tcv-p-${c.pattern}`); }
    else {
      const url = c.style === 'upload' ? info.imageUrl : `img/covers/${c.photo}.webp`;
      bg = url
        ? `background:#24282C url('${esc(url)}') center/cover no-repeat;--tcv-shade:${(c.shade / 100).toFixed(2)};`
        : `background:linear-gradient(135deg,#24282C,#5D614B);--tcv-shade:0;`;
      cls.push('tcv-photo');
    }
    const level = String(info.level || '').trim();
    const badge = c.badge && level && level !== 'Mixed'
      ? `<span class="tcv-badge">${esc(level)}</span>` : '';
    const kind = info.kind ? `<span class="tcv-kind">${esc(info.kind)}</span>` : '';
    return `<div class="${cls.join(' ')}" style="${bg}--tcv-ink:${ink};" aria-hidden="true">
      ${badge}${kind}
      <div class="tcv-text">
        <div class="tcv-title" style="font-size:${fontSize(c.font, title)}cqw">${esc(title)}</div>
        ${c.sub ? `<div class="tcv-sub">${esc(c.sub)}</div>` : ''}
      </div>
      ${c.sticker ? `<span class="tcv-sticker">${esc(c.sticker)}</span>` : ''}
    </div>`;
  }

  /* ── Upload: any photo becomes a 1200×450 JPEG under ~300 KB ─────────── */
  function fileToCoverImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Choose an image file'));
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const W = 1200, H = 450;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        URL.revokeObjectURL(url);
        let q = .82, out = canvas.toDataURL('image/jpeg', q);
        while (out.length > 900000 && q > .45) { q -= .1; out = canvas.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be read')); };
      img.src = url;
    });
  }

  /* ── Editor ───────────────────────────────────────────────────────────
     editor(host, {
       value,            // saved cover or null (auto)
       image,            // current uploaded image (data: or URL) or ''
       info: () => ({title, level, skill, duration, kind}),
       onChange(cover, image)
     }) → { get(), getImage(), set(cover, image), refresh() } */
  function editor(host, opts = {}) {
    let cover = normalize(opts.value);
    let image = opts.image || '';
    /* Своё фото живёт в сетке вкладки Photo первой плиткой, как в выборе фона
       рабочего стола, поэтому у стиля 'upload' своей вкладки нет. */
    const tabFor = c => (c ? (c.style === 'upload' ? 'photo' : c.style) : 'auto');
    let tab = tabFor(cover);
    const info = () => (typeof opts.info === 'function' ? opts.info() : opts.info) || {};
    const current = () => cover || auto(info());
    const touch = patch => {
      cover = normalize({ ...current(), ...patch });
      paint();
      opts.onChange?.(cover, image);
    };

    const sw = (list, active, attr) => list.map(color => `<button type="button" class="lce-sw${color === active ? ' on' : ''}" data-${attr}="${color}" style="background:${color}" aria-label="${color}"></button>`).join('');

    function bgPanel(c) {
      if (tab === 'auto') return `<p class="lce-note">An automatic cover from the title, level and skill. Pick any style above to make it yours.</p>`;
      if (tab === 'color') return `<div class="lce-row"><span class="lce-lbl">Background</span><div class="lce-sws">${sw(PALETTE, c.style === 'color' ? c.bg : '', 'bg')}</div></div>`;
      if (tab === 'gradient') return `
        <div class="lce-grads">${GRADIENTS.map(([a, b]) => `<button type="button" class="lce-grad${c.style === 'gradient' && c.bg === a && c.bg2 === b ? ' on' : ''}" data-grad="${a},${b}" style="background:linear-gradient(135deg,${a},${b})" aria-label="Gradient"></button>`).join('')}</div>
        <div class="lce-row"><span class="lce-lbl">From</span><div class="lce-sws">${sw(PALETTE, c.bg, 'bg')}</div></div>
        <div class="lce-row"><span class="lce-lbl">To</span><div class="lce-sws">${sw(PALETTE, c.bg2, 'bg2')}</div></div>`;
      if (tab === 'pattern') return `
        <div class="lce-pats">${PATTERNS.map(p => `<button type="button" class="lce-pat tcv-pattern tcv-p-${p.key}${c.pattern === p.key ? ' on' : ''}" data-pattern="${p.key}" style="background:${c.bg};--tcv-accent:${c.accent}"><span>${p.label}</span></button>`).join('')}</div>
        <div class="lce-row"><span class="lce-lbl">Base</span><div class="lce-sws">${sw(PALETTE, c.bg, 'bg')}</div></div>
        <div class="lce-row"><span class="lce-lbl">Pattern</span><div class="lce-sws">${sw(PALETTE, c.accent, 'accent')}</div></div>`;
      const own = image
        ? `<button type="button" class="lce-photo lce-own${c.style === 'upload' ? ' on' : ''}" data-own style="background-image:url('${esc(image)}')" aria-label="Your photo"></button>`
        : `<label class="lce-photo lce-own lce-own-add" title="JPG, PNG or WebP - it is cropped to the cover for you"><input type="file" accept="image/*" hidden data-upload><span aria-hidden="true">+</span><small>Your photo</small></label>`;
      return `
        <div class="lce-photos">${own}${PHOTOS.map(p => `<button type="button" class="lce-photo${c.style === 'photo' && c.photo === p ? ' on' : ''}" data-photo="${p}" style="background-image:url('img/wallpapers/${p}-thumb.webp')" aria-label="${p}"></button>`).join('')}</div>
        ${image ? `<div class="lce-own-links"><label class="lce-link">Replace your photo<input type="file" accept="image/*" hidden data-upload></label><button type="button" class="lce-link" data-clear-upload>Remove</button></div>` : ''}
        ${shadeRow(c)}`;
    }
    const shadeRow = c => `<div class="lce-row"><span class="lce-lbl">Darken</span><input type="range" min="0" max="70" step="1" value="${c.shade}" data-shade class="lce-range"><span class="lce-val">${c.shade}%</span></div>`;

    function paint() {
      const c = current();
      const inf = info();
      host.innerHTML = `
        <div class="lce">
          <div class="lce-tabs" role="tablist">
            ${[['auto', 'Auto'], ['color', 'Colour'], ['gradient', 'Gradient'], ['pattern', 'Pattern'], ['photo', 'Photo']].map(([k, l]) => `<button type="button" role="tab" aria-selected="${tab === k}" class="lce-tab${tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('')}
            <button type="button" class="lce-shuffle" data-shuffle title="Surprise me">🎲</button>
          </div>
          <div class="lce-panel">${bgPanel(c)}</div>
          <div class="lce-sep"></div>
          <div class="lce-row lce-row-in"><span class="lce-lbl">Headline</span><input class="lce-input" data-title maxlength="70" placeholder="${esc(stripLevel(inf.title) || 'Uses the lesson title')}" value="${esc(cover ? cover.title : '')}"></div>
          <div class="lce-row lce-row-in"><span class="lce-lbl">Subline</span><input class="lce-input" data-sub maxlength="90" placeholder="e.g. Speaking · 45 min" value="${esc(c.sub)}"></div>
          <div class="lce-row"><span class="lce-lbl">Font</span><div class="lce-fonts">${FONTS.map(f => `<button type="button" class="lce-font tcv-font-${f.key}${c.font === f.key ? ' on' : ''}" data-font="${f.key}"><span class="lce-font-aa">Aa</span><small>${f.label}</small></button>`).join('')}</div></div>
          <div class="lce-row"><span class="lce-lbl">Text</span><div class="lce-sws">${sw(TEXT_COLORS, c.ink, 'ink')}</div>
            <div class="lce-align">
              <button type="button" class="${c.align === 'left' ? 'on' : ''}" data-align="left" aria-label="Align left"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 11h10M4 16h13"/></svg></button>
              <button type="button" class="${c.align === 'center' ? 'on' : ''}" data-align="center" aria-label="Align centre"><svg viewBox="0 0 24 24"><path d="M4 6h16M7 11h10M5.5 16h13"/></svg></button>
            </div>
          </div>
          <div class="lce-row"><span class="lce-lbl">Sticker</span><div class="lce-stickers">${STICKERS.map(s => `<button type="button" class="lce-stk${c.sticker === s ? ' on' : ''}" data-sticker="${esc(s)}">${s || '<span class="lce-none">none</span>'}</button>`).join('')}</div></div>
          ${inf.level ? `<label class="lce-check"><input type="checkbox" data-badge ${c.badge ? 'checked' : ''}> Show the level badge (${esc(inf.level)})</label>` : ''}
        </div>`;
    }

    host.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !host.contains(b)) return;
      const d = b.dataset;
      if (d.tab) {
        tab = d.tab;
        if (tab === 'auto') { cover = null; paint(); opts.onChange?.(null, image); return; }
        const c = current();
        const base = { style: tab };
        if (tab === 'color' && c.style !== 'color') { base.ink = readableOn(c.bg); }
        if (tab === 'photo' && c.style === 'upload') { paint(); return; }
        if (tab === 'photo') base.ink = '#FFFFFF';
        touch(base);
        return;
      }
      if (d.shuffle) {
        const pick = AUTO_DESIGNS[Math.floor(Math.random() * AUTO_DESIGNS.length)];
        const c = current();
        tab = pick.style;
        touch({ ...pick, title: c.title, sub: c.sub, sticker: STICKERS[1 + Math.floor(Math.random() * (STICKERS.length - 1))], badge: c.badge });
        return;
      }
      if (d.own !== undefined) { touch({ style: 'upload', ink: '#FFFFFF', shade: Math.max(current().shade, 25) }); return; }
      if (d.bg) { const style = tab === 'auto' || tab === 'photo' ? 'color' : tab; tab = style; touch({ style, bg: d.bg, ...(style === 'color' ? { ink: readableOn(d.bg) } : {}) }); return; }
      if (d.bg2) { tab = 'gradient'; touch({ style: 'gradient', bg2: d.bg2 }); return; }
      if (d.grad) { const [a, g] = d.grad.split(','); tab = 'gradient'; touch({ style: 'gradient', bg: a, bg2: g, ink: readableOn(a) }); return; }
      if (d.pattern) { tab = 'pattern'; touch({ style: 'pattern', pattern: d.pattern }); return; }
      if (d.accent) { tab = 'pattern'; touch({ style: 'pattern', accent: d.accent }); return; }
      if (d.photo) { tab = 'photo'; touch({ style: 'photo', photo: d.photo, ink: '#FFFFFF' }); return; }
      if (d.font) { touch({ font: d.font }); return; }
      if (d.ink) { touch({ ink: d.ink }); return; }
      if (d.align) { touch({ align: d.align }); return; }
      if (d.sticker !== undefined) { touch({ sticker: d.sticker }); return; }
      if (d.clearUpload !== undefined) {
        image = '';
        if (cover && cover.style === 'upload') cover = normalize({ ...cover, style: 'photo' });
        paint(); opts.onChange?.(cover, image);
      }
    });
    host.addEventListener('input', e => {
      const t = e.target;
      if (t.matches('[data-title]')) { cover = normalize({ ...current(), title: t.value }); opts.onChange?.(cover, image); }
      else if (t.matches('[data-sub]')) { cover = normalize({ ...current(), sub: t.value }); opts.onChange?.(cover, image); }
      else if (t.matches('[data-shade]')) {
        cover = normalize({ ...current(), shade: t.value });
        const v = host.querySelector('.lce-val'); if (v) v.textContent = `${cover.shade}%`;
        opts.onChange?.(cover, image);
      }
    });
    host.addEventListener('change', async e => {
      const t = e.target;
      if (t.matches('[data-badge]')) { touch({ badge: t.checked }); return; }
      if (t.matches('[data-upload]') && t.files && t.files[0]) {
        try {
          image = await fileToCoverImage(t.files[0]);
          tab = 'photo';
          touch({ style: 'upload', ink: '#FFFFFF', shade: Math.max(current().shade, 25) });
        } catch (err) { alert(err.message); }
      }
    });

    paint();
    return {
      get: () => cover,
      getImage: () => image,
      set(next, nextImage) { cover = normalize(next); if (nextImage !== undefined) image = nextImage || ''; tab = tabFor(cover); paint(); },
      refresh: paint,
    };
  }

  /* ── Modal: edit a saved cover ────────────────────────────────────────
     openModal({ heading, info, value, image, preview(cover, image) → html,
                 onSave(cover, image, imageChanged) → Promise })
     Used for a teacher's own boards on the desktop; Community keeps its
     own copy that previews the full lesson card. */
  function openModal(o) {
    document.querySelector('.tcv-modal')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'tcv-modal';
    wrap.innerHTML = `<div class="tcv-modal-card" role="dialog" aria-modal="true" aria-label="${esc(o.heading || 'Edit cover')}">
      <div class="tcv-modal-head"><b>${esc(o.heading || 'Edit cover')}</b><button type="button" class="tcv-modal-x" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="tcv-modal-prev"></div>
      <div class="tcv-modal-ed"></div>
      <div class="tcv-modal-foot"><button type="button" class="tcv-btn ghost" data-cancel>Cancel</button><button type="button" class="tcv-btn" data-save>Save cover</button></div>
    </div>`;
    document.body.appendChild(wrap);
    let image = o.image || '';
    let changed = false;
    const prev = wrap.querySelector('.tcv-modal-prev');
    const draw = (cover, img) => { prev.innerHTML = o.preview ? o.preview(cover, img) : render(cover, { ...o.info, imageUrl: img }); };
    const ed = editor(wrap.querySelector('.tcv-modal-ed'), {
      value: o.value, image, info: o.info,
      onChange: (cover, img) => { if (img !== image) { image = img; changed = true; } draw(cover, img); },
    });
    draw(o.value, image);
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    wrap.querySelector('.tcv-modal-x').onclick = close;
    wrap.querySelector('[data-cancel]').onclick = close;
    wrap.querySelector('[data-save]').onclick = async ev => {
      const btn = ev.currentTarget;
      btn.disabled = true; btn.textContent = 'Saving…';
      try { await o.onSave(ed.get(), image, changed); close(); }
      catch (err) { btn.disabled = false; btn.textContent = 'Save cover'; alert(err.message || 'Could not save the cover'); }
    };
    return { close };
  }

  window.TeachEdCover = { render, auto, normalize, editor, openModal, fileToCoverImage, stripLevel, PALETTE, PHOTOS };
})();
