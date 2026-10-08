/* Кабинет ученика: онбординг «ДНК-профиль» и вкладка «For you».

   - При первом входе ученик отвечает на три вопроса (зачем учит, что
     интересно, какой уровень) - учитель получает готовое досье.
   - Вкладка «For you»: 3 свежие статьи по его интересам (GET /api/student/feed).
     Показываем заголовок и анонс издания со ссылкой на оригинал; полный текст
     чужих статей внутри платформы не воспроизводим.
   - Слова анонса кликабельны: значение уровня ученика, озвучка, пример и
     «в мой словарь» одним нажатием (Vault, повторение по интервалам).
   - «Explain a phrase»: ученик вставляет выражение из статьи. Слово ищется в
     словаре, у фразы значение пишет сам ученик - и она тоже уходит в словарь.

   Работает только на student.html (после init). */
(function () {
  'use strict';
  if (window.__studentFeed) return;
  window.__studentFeed = true;

  let api = null, dna = null, catalog = null, level = 'B1', feedLoaded = false, audio = null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const json = async r => { try { return await r.json(); } catch { return null; } };

  function css() {
    if (document.getElementById('sf-css')) return;
    const st = document.createElement('style');
    st.id = 'sf-css';
    st.textContent = `
.tabs .tab{white-space:nowrap}
#sf-fab{position:fixed;right:0;top:46%;z-index:4500;display:flex;align-items:center;gap:8px;border:0;border-radius:18px 0 0 18px;padding:14px 16px 14px 14px;background:#CDF649;color:#24282C;font:800 13px -apple-system,BlinkMacSystemFont,'SF Pro Text',Arial,sans-serif;cursor:pointer;box-shadow:-8px 10px 30px -10px rgba(36,40,44,.45);transition:transform .18s,padding .18s}
#sf-fab:hover{transform:translateX(-4px)}
#sf-fab .sf-fab-ic{font-size:18px}
#sf-fab .sf-fab-new{position:absolute;left:-5px;top:-5px;width:13px;height:13px;border-radius:50%;background:#FF4E00;border:2px solid #fff}
#sf-fab.is-open{opacity:0;pointer-events:none}
#sf-scrim{position:fixed;inset:0;z-index:4600;background:rgba(36,40,44,.35);opacity:0;transition:opacity .2s}
#sf-scrim.open{opacity:1}
#sf-drawer{position:fixed;top:0;right:0;bottom:0;z-index:4700;width:min(560px,100vw);background:#FBFAF6;box-shadow:-30px 0 80px rgba(0,0,0,.3);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s cubic-bezier(.2,.8,.2,1)}
#sf-drawer.open{transform:none}
.sf-d-head{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid rgba(36,40,44,.1);font-size:16px}
.sf-d-x{margin-left:auto;width:36px;height:36px;border:0;border-radius:11px;background:#EFEEE7;cursor:pointer;font-size:15px}
#sf-drawer .sf-pane{flex:1;overflow:auto;padding:16px 20px 24px}
@media (max-width:820px){#sf-fab{top:auto;bottom:86px;border-radius:18px 0 0 18px}#sf-fab .sf-fab-t{display:none}#sf-fab{padding:12px}}

.sf-ov{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;background:rgba(36,40,44,.5);padding:16px}
.sf-card{width:min(560px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:22px;padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.35);font-family:inherit;color:#24282C}
.sf-card h2{font-size:22px;letter-spacing:-.02em;margin-bottom:4px}
.sf-card p.sf-sub{font-size:13.5px;color:#5D614B;margin-bottom:16px;line-height:1.45}
.sf-q{font:800 11px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#5D614B;margin:16px 0 8px}
.sf-chips{display:flex;flex-wrap:wrap;gap:7px}
.sf-chip{border:1.5px solid rgba(36,40,44,.16);background:#fff;border-radius:999px;padding:8px 13px;font:650 13.5px inherit;cursor:pointer;color:#24282C;font-family:inherit}
.sf-chip:hover{border-color:#24282C}
.sf-chip.on{background:#24282C;border-color:#24282C;color:#fff}
.sf-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:20px}
.sf-btn{border:0;border-radius:12px;padding:12px 20px;background:#CDF649;font:800 14px inherit;font-family:inherit;color:#24282C;cursor:pointer}
.sf-btn:disabled{opacity:.45;cursor:default}
.sf-link{border:0;background:transparent;color:#5D614B;font:600 13px inherit;font-family:inherit;text-decoration:underline;cursor:pointer}
.sf-err{color:#c0392b;font-size:13px;margin-top:8px;min-height:16px}
.sf-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.sf-head h3{font-size:18px;letter-spacing:-.01em}
.sf-head span{font-size:12.5px;color:#5D614B}
.sf-art{background:#fff;border:1px solid rgba(93,97,75,.16);border-radius:16px;padding:16px 18px;margin-bottom:12px}
.sf-art .sf-tag{display:inline-block;font:800 10px ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;background:#EFEAFF;color:#4B2FC4;border-radius:999px;padding:3px 9px}
.sf-art h4{font-size:17px;line-height:1.3;margin:8px 0 4px;letter-spacing:-.01em}
.sf-art small{color:#7A7E68;font-size:12px}
.sf-art .sf-sum{margin:8px 0 10px;font-size:15px;line-height:1.6}
.sf-w{cursor:pointer;border-radius:4px}
.sf-w:hover{background:#E6FAA6}
.sf-art a.sf-open{font:700 13px inherit;font-family:inherit;color:#24282C}
.sf-ask{display:flex;gap:8px;margin:4px 0 16px}
.sf-ask input{flex:1;min-width:0;height:42px;border:1.5px solid rgba(36,40,44,.2);border-radius:12px;padding:0 12px;font:500 14px inherit;font-family:inherit}
.sf-pop{position:fixed;z-index:5100;width:min(320px,calc(100vw - 24px));background:#24282C;color:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 20px 50px rgba(0,0,0,.4);font-size:13.5px;line-height:1.5}
.sf-pop b{font-size:17px;display:block}
.sf-pop .sf-ipa{font:600 12.5px ui-monospace,Menlo,monospace;color:#CACCC6}
.sf-pop em{display:block;color:#CACCC6;margin-top:4px}
.sf-pop .sf-row{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.sf-pop button{border:0;border-radius:10px;padding:8px 12px;font:700 12.5px inherit;font-family:inherit;cursor:pointer;background:rgba(255,255,255,.14);color:#fff}
.sf-pop button.main{background:#CDF649;color:#24282C}
.sf-pop input{width:100%;box-sizing:border-box;margin-top:8px;height:36px;border-radius:9px;border:0;padding:0 10px;font:500 13px inherit;font-family:inherit}
.sf-empty{padding:26px;text-align:center;color:#5D614B;background:#fff;border:1px dashed rgba(93,97,75,.3);border-radius:16px}
`;
    document.head.appendChild(st);
  }

  /* ── Онбординг ─────────────────────────────────────────────────────── */
  function onboarding() {
    css();
    const state = { goal: (dna && dna.goal) || '', interests: new Set((dna && dna.interests) || []), level: (dna && dna.level) || '' };
    const ov = document.createElement('div');
    ov.className = 'sf-ov';
    const draw = () => {
      ov.innerHTML = `<div class="sf-card" role="dialog" aria-modal="true" aria-label="Tell us about you">
        <h2>Let's make it yours 👋</h2>
        <p class="sf-sub">Three quick questions. Your teacher sees the answers, and your daily reading is picked from them.</p>
        <div class="sf-q">Why are you learning English?</div>
        <div class="sf-chips">${catalog.goals.map(g => `<button type="button" class="sf-chip${state.goal === g.key ? ' on' : ''}" data-goal="${esc(g.key)}">${esc(g.label)}</button>`).join('')}</div>
        <div class="sf-q">What are you into? <span style="text-transform:none;letter-spacing:0;font-weight:600">(pick a few)</span></div>
        <div class="sf-chips">${catalog.interests.map(i => `<button type="button" class="sf-chip${state.interests.has(i.key) ? ' on' : ''}" data-int="${esc(i.key)}">${esc(i.emoji)} ${esc(i.label)}</button>`).join('')}</div>
        <div class="sf-q">Your level (a guess is fine)</div>
        <div class="sf-chips">${catalog.levels.map(l => `<button type="button" class="sf-chip${state.level === l ? ' on' : ''}" data-lvl="${l}">${l}</button>`).join('')}<button type="button" class="sf-chip${state.level === '' ? ' on' : ''}" data-lvl="">Not sure</button></div>
        <div class="sf-err" id="sf-err"></div>
        <div class="sf-actions"><button type="button" class="sf-link" data-skip>Later</button><button type="button" class="sf-btn" data-save${state.interests.size ? '' : ' disabled'}>Done</button></div>
      </div>`;
    };
    draw();
    ov.addEventListener('click', async e => {
      const g = e.target.closest('[data-goal]'), i = e.target.closest('[data-int]'), l = e.target.closest('[data-lvl]');
      if (g) { state.goal = g.dataset.goal; draw(); }
      else if (i) { const k = i.dataset.int; if (state.interests.has(k)) state.interests.delete(k); else if (state.interests.size < 8) state.interests.add(k); draw(); }
      else if (l) { state.level = l.dataset.lvl; draw(); }
      else if (e.target.closest('[data-skip]')) { try { sessionStorage.setItem('sf_skip', '1'); } catch {} ov.remove(); }
      else if (e.target.closest('[data-save]')) {
        const btn = e.target.closest('[data-save]'); btn.disabled = true;
        try {
          const r = await api('/api/student/dna', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: state.goal, interests: [...state.interests], level: state.level }) });
          if (!r.ok) throw new Error(((await json(r)) || {}).error || 'Could not save');
          dna = { goal: state.goal, interests: [...state.interests], level: state.level };
          level = dna.level || 'B1';
          ov.remove(); feedLoaded = false; loadFeed();
        } catch (err) { btn.disabled = false; ov.querySelector('#sf-err').textContent = err.message; }
      }
    });
    document.body.appendChild(ov);
  }

  /* ── Боковая кнопка «For you» ─────────────────────────────────────────────
     Не вкладка в ряду: яркая кнопка у правого края открывает панель со
     статьями и «Explain a phrase» поверх страницы. Ничего не перекрывает,
     пока не нажали, и ряд вкладок остаётся коротким. */
  function mountTab() {
    if (document.getElementById('sf-fab')) return;
    const fab = document.createElement('button');
    fab.type = 'button'; fab.id = 'sf-fab';
    fab.setAttribute('aria-haspopup', 'dialog');
    fab.innerHTML = '<span class="sf-fab-ic">✨</span><span class="sf-fab-t">For you</span>';
    let seen = false;
    try { seen = localStorage.getItem('te_feed_seen') === new Date().toLocaleDateString('en-CA'); } catch (_) {}
    if (!seen) fab.insertAdjacentHTML('beforeend', '<i class="sf-fab-new" aria-hidden="true"></i>');
    const drawer = document.createElement('aside');
    drawer.id = 'sf-drawer'; drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-label', 'For you'); drawer.hidden = true;
    drawer.innerHTML = '<div class="sf-d-head"><b>✨ For you today</b><button type="button" class="sf-d-x" aria-label="Close">✕</button></div><div class="sf-pane" id="pane-feed"><div id="sf-body"><div class="sf-empty">Loading your reading…</div></div></div>';
    const scrim = document.createElement('div');
    scrim.id = 'sf-scrim'; scrim.hidden = true;
    document.body.append(scrim, drawer, fab);
    const open = () => {
      drawer.hidden = false; scrim.hidden = false;
      requestAnimationFrame(() => { drawer.classList.add('open'); scrim.classList.add('open'); });
      fab.classList.add('is-open');
      fab.querySelector('.sf-fab-new')?.remove();
      try { localStorage.setItem('te_feed_seen', new Date().toLocaleDateString('en-CA')); } catch (_) {}
      loadFeed();
    };
    const close = () => {
      drawer.classList.remove('open'); scrim.classList.remove('open'); fab.classList.remove('is-open');
      setTimeout(() => { drawer.hidden = true; scrim.hidden = true; }, 220);
    };
    fab.addEventListener('click', () => (drawer.hidden ? open() : close()));
    scrim.addEventListener('click', close);
    drawer.querySelector('.sf-d-x').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !drawer.hidden) close(); });
    const pane = drawer.querySelector('#pane-feed');
    pane.addEventListener('click', onPane);
    pane.addEventListener('submit', e => { e.preventDefault(); const v = pane.querySelector('.sf-ask input').value.trim(); if (v) { const r = pane.querySelector('.sf-ask').getBoundingClientRect(); explain(v, r.left + 20, r.bottom + 6); } });
    window.openForYou = open;
  }

  function wrapWords(text) {
    return esc(text).replace(/([A-Za-z][A-Za-z'’-]{2,})/g, '<span class="sf-w">$1</span>');
  }

  async function loadFeed() {
    if (feedLoaded) return;
    const body = document.getElementById('sf-body');
    if (!body) return;
    feedLoaded = true;
    try {
      const r = await api('/api/student/feed');
      const d = await json(r);
      if (!r.ok || !d) throw new Error((d && d.error) || 'The feed could not be loaded');
      const items = d.items || [];
      body.innerHTML = `
        <div class="sf-head"><h3>${d.personal ? 'Picked for you today' : 'Today’s reading'}</h3><span>${d.personal && d.interests.length ? esc(d.interests.join(' · ')) + ' · ' : ''}<button type="button" class="sf-link" data-edit>${d.personal ? 'Change interests' : 'Tell us what you like'}</button></span></div>
        <form class="sf-ask"><input type="text" maxlength="80" placeholder="Explain a phrase from an article, e.g. “it turns out”" aria-label="Explain a phrase"><button type="submit" class="sf-btn">Explain</button></form>
        ${items.length ? items.map(a => `<article class="sf-art">
            ${a.interest ? `<span class="sf-tag">${esc(a.interest)}</span>` : ''}
            <h4>${esc(a.title)}</h4>
            <small>${esc(a.source)}</small>
            ${a.summary ? `<p class="sf-sum">${wrapWords(a.summary)}</p>` : ''}
            <a class="sf-open" href="${esc(a.url)}" target="_blank" rel="noopener">Read the full article ↗</a>
          </article>`).join('') : '<div class="sf-empty">No fresh articles right now - try again in a little while.</div>'}
        <p style="font-size:12px;color:#7A7E68;margin-top:6px">Tap any word in the summaries to see what it means and save it to your dictionary.</p>`;
    } catch (err) {
      feedLoaded = false;
      body.innerHTML = `<div class="sf-empty">${esc(err.message)}<br><button type="button" class="sf-link" data-retry>Try again</button></div>`;
    }
  }

  function onPane(e) {
    if (e.target.closest('[data-edit]')) { onboarding(); return; }
    if (e.target.closest('[data-retry]')) { loadFeed(); return; }
    const w = e.target.closest('.sf-w');
    if (w) { const r = w.getBoundingClientRect(); explain(w.textContent, r.left, r.bottom + 6, w.closest('.sf-art')?.querySelector('h4')?.textContent || ''); }
  }

  /* ── Значение слова / фразы ──────────────────────────────────────── */
  async function explain(text, x, y, source) {
    closePop();
    const t = String(text).replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!t) return;
    const multi = /\s/.test(t);
    const pop = document.createElement('div');
    pop.className = 'sf-pop';
    pop.id = 'sf-pop';
    pop.style.left = Math.max(12, Math.min(x, window.innerWidth - 332)) + 'px';
    pop.style.top = Math.min(y, window.innerHeight - 220) + 'px';
    pop.innerHTML = `<b>${esc(t)}</b><span class="sf-ipa"></span><div class="sf-mean">${multi ? 'Phrases are not in the dictionary - write what it means in your own words:' : 'Looking it up…'}</div>`;
    document.body.appendChild(pop);
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    let meaning = '', example = '', ipa = '', snd = '';
    if (!multi) {
      try {
        const r = await api('/api/dictionary/define?w=' + encodeURIComponent(t.replace(/[’]/g, "'")) + '&level=' + encodeURIComponent(level));
        const d = await json(r);
        if (d && d.definition && !d.partial) { meaning = d.definition; example = d.example || ''; ipa = d.ipaUK || d.ipa || ''; snd = d.audioUK || d.audio || ''; }
      } catch {}
    }
    if (!document.getElementById('sf-pop')) return;
    pop.querySelector('.sf-ipa').textContent = ipa ? ' /' + ipa.replace(/^\/|\/$/g, '') + '/' : '';
    pop.querySelector('.sf-mean').innerHTML = multi ? '<input type="text" maxlength="200" placeholder="what it means (optional)" aria-label="Meaning">'
      : meaning ? esc(meaning) + (example ? `<em>“${esc(example)}”</em>` : '') : 'No entry found - you can still save it.';
    pop.insertAdjacentHTML('beforeend', `<div class="sf-row">${snd || !multi ? '<button type="button" data-say>🔊 Listen</button>' : ''}<button type="button" class="main" data-save>+ Word Bank</button></div>`);
    pop.querySelector('[data-say]')?.addEventListener('click', () => {
      try { audio && audio.pause(); } catch {}
      if (snd) { audio = new Audio(snd); audio.play().catch(() => speak(t)); } else speak(t);
    });
    pop.querySelector('[data-save]').addEventListener('click', async ev => {
      ev.target.disabled = true;
      const own = pop.querySelector('input');
      try {
        const r = await api('/api/vault/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t, meaning: own ? own.value.trim() : meaning, example, sourceTitle: source || 'Daily reading' }) });
        ev.target.textContent = r.ok ? '✓ Saved' : 'Could not save';
        if (r.ok && typeof loadVocab === 'function') loadVocab();
      } catch { ev.target.textContent = 'Could not save'; }
    });
  }
  function speak(t) { try { const u = new SpeechSynthesisUtterance(t); u.lang = 'en-GB'; speechSynthesis.speak(u); } catch {} }
  function outside(e) { if (!e.target.closest('#sf-pop')) closePop(); }
  function closePop() { document.getElementById('sf-pop')?.remove(); document.removeEventListener('mousedown', outside, true); }

  window.StudentFeed = {
    async init(apiClient) {
      api = apiClient;
      css();
      mountTab();
      try {
        const r = await api('/api/student/dna');
        const d = await json(r);
        if (!r.ok || !d) return;
        dna = d.dna; catalog = { goals: d.goals, interests: d.interests, levels: d.levels };
        level = (dna && dna.level) || 'B1';
        let skipped = false; try { skipped = sessionStorage.getItem('sf_skip') === '1'; } catch {}
        if (!dna && !skipped) onboarding();
        if (dna) loadFeed();
      } catch {}
    },
  };
})();
