/* Кабинет ученика: онбординг «ДНК-профиль» и вкладка «For you».

   - При первом входе ученик отвечает на три вопроса (зачем учит, что
     интересно, какой уровень) - учитель получает готовое досье.
   - «For you»: не лента статей, а пять коротких карточек на день, как сторис:
     фраза дня с вопросом на 10 секунд, мини-опрос по интересам с готовой
     фразой для ответа, «угадай выражение», один заголовок дня и финиш.
     Статьи (GET /api/student/feed) остались одной карточкой и списком в конце:
     заголовок и анонс издания со ссылкой на оригинал; полный текст чужих
     статей внутри платформы не воспроизводим.
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
#sf-fab{position:fixed;right:22px;bottom:22px;z-index:4500;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px 12px 14px;background:#CDF649;color:#24282C;font:800 13px -apple-system,BlinkMacSystemFont,'SF Pro Text',Arial,sans-serif;cursor:pointer;box-shadow:0 12px 30px -10px rgba(36,40,44,.5);transition:transform .18s}
#sf-fab:hover{transform:translateY(-2px)}
#sf-fab:focus-visible{outline:2px solid #24282C;outline-offset:3px}
#sf-fab .sf-fab-ic{font-size:18px}
#sf-fab .sf-fab-new{position:absolute;right:2px;top:-3px;width:13px;height:13px;border-radius:50%;background:#FF4E00;border:2px solid #fff}
#sf-fab.is-open{opacity:0;pointer-events:none}
#sf-scrim{position:fixed;inset:0;z-index:4600;background:rgba(36,40,44,.35);opacity:0;transition:opacity .2s}
#sf-scrim.open{opacity:1}
#sf-drawer{position:fixed;top:0;right:0;bottom:0;z-index:4700;width:min(460px,100vw);background:#FBFAF6;box-shadow:-30px 0 80px rgba(0,0,0,.3);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s cubic-bezier(.2,.8,.2,1)}
#sf-drawer.open{transform:none}
.sf-d-head{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid rgba(36,40,44,.1);font-size:16px}
.sf-d-x{margin-left:auto;width:36px;height:36px;border:0;border-radius:11px;background:#EFEEE7;cursor:pointer;font-size:15px}
#sf-drawer .sf-pane{flex:1;overflow:auto;padding:16px 20px 24px}
@media (max-width:820px){#sf-fab{right:14px;bottom:86px;padding:12px}#sf-fab .sf-fab-t{display:none}}

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
.sf-bars{display:flex;gap:5px;margin:0 0 14px}
.sf-bars i{flex:1;height:4px;border-radius:999px;background:rgba(36,40,44,.14)}
.sf-bars i.on{background:#24282C}
.sf-story{border-radius:24px;padding:22px 20px 20px;min-height:340px;display:flex;flex-direction:column;gap:10px;background:#fff;color:#24282C;box-shadow:0 0 0 1px rgba(36,40,44,.08)}
.sf-story.ink{background:#24282C;color:#fff;box-shadow:none}
.sf-story.lime{background:linear-gradient(160deg,#DBFB6C,#CDF649);box-shadow:none}
.sf-kick{font:800 10.5px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;opacity:.7}
.sf-big{font-size:30px;line-height:1.12;font-weight:800;letter-spacing:-.03em;overflow-wrap:anywhere}
.sf-story h4{font-size:21px;line-height:1.25;letter-spacing:-.02em;margin:0}
.sf-ask-q{font-size:15px;font-weight:650;line-height:1.4;margin-top:4px}
.sf-opts{display:grid;gap:8px;margin-top:6px}
.sf-opt{text-align:left;border:0;border-radius:14px;padding:13px 15px;font:650 14.5px/1.35 inherit;font-family:inherit;cursor:pointer;background:rgba(36,40,44,.07);color:inherit;transition:transform .12s,background .15s}
.sf-story.ink .sf-opt{background:rgba(255,255,255,.12)}
.sf-story.lime .sf-opt{background:rgba(255,255,255,.6)}
.sf-opt:hover:not(:disabled){transform:translateY(-1px)}
.sf-opt:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.sf-opt:disabled{cursor:default}
.sf-opt.ok{background:#CDF649 !important;color:#24282C}
.sf-story.lime .sf-opt.ok{background:#24282C !important;color:#CDF649}
.sf-opt.bad{background:rgba(255,90,31,.22) !important}
.sf-opt.dim{opacity:.5}
.sf-after{margin-top:6px;font-size:14px;line-height:1.5}
.sf-after b{font-size:15px}
.sf-after em{display:block;margin-top:4px;opacity:.85}
.sf-mini{align-self:flex-start;border:0;border-radius:11px;padding:9px 14px;font:750 13px inherit;font-family:inherit;cursor:pointer;background:#CDF649;color:#24282C;text-decoration:none;display:inline-block}
.sf-story.lime .sf-mini{background:#24282C;color:#CDF649}
.sf-mini.ghost{background:rgba(127,127,127,.18);color:inherit}
.sf-mini:disabled{opacity:.6;cursor:default}
.sf-row2{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.sf-nav{display:flex;align-items:center;gap:10px;margin-top:14px}
.sf-nav .sf-btn{margin-left:auto}
.sf-more{margin-top:16px;display:grid;gap:8px}
.sf-more a{display:block;background:#fff;border-radius:14px;padding:11px 14px;color:#24282C;text-decoration:none;font-size:13.5px;font-weight:650;line-height:1.35;box-shadow:0 0 0 1px rgba(36,40,44,.08)}
.sf-more a small{display:block;font-weight:500;color:#7A7E68;margin-top:2px}
.sf-more a:hover{background:#F6F6EF}
@media (prefers-reduced-motion:no-preference){
.sf-story{animation:sf-in .28s cubic-bezier(.2,.8,.2,1)}
@keyframes sf-in{from{opacity:0;transform:translateX(18px)}}
.sf-opt.ok{animation:sf-pop .35s cubic-bezier(.2,1.6,.4,1)}
@keyframes sf-pop{50%{transform:scale(1.04)}}
.sf-opt.bad{animation:sf-shake .3s}
@keyframes sf-shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
}
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
    drawer.innerHTML = '<div class="sf-d-head"><b>✨ For you today</b><button type="button" class="sf-d-x" aria-label="Close">✕</button></div><div class="sf-pane" id="pane-feed"><div id="sf-body"><div class="sf-empty">Getting today’s cards…</div></div></div>';
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

  /* ── Карточки дня ─────────────────────────────────────────────────────
     Пять карточек, одна на экране, полоски сверху как в сторис. Набор зависит
     только от даты и интересов ученика, так что в течение дня он один и тот же.
     Опросы без «правильного» ответа: любой выбор открывает готовую фразу,
     которой это можно сказать по-английски. */
  const POLLS = [
    { tag: 'travel', q: 'Your flight is delayed by six hours. What do you do?', opts: [
      ['Find food and wait it out', "I'd grab something to eat and wait it out."],
      ['Ask for a different flight', "I'd ask them to put me on another flight."],
      ['Leave the airport and explore', "I'd head into town and make the most of it."]] },
    { tag: 'travel', q: 'A weekend trip. Which one?', opts: [
      ['A big city with museums', "I'm more of a city person."],
      ['Mountains, no signal', "I'd rather switch off in the mountains."],
      ['The sea, doing nothing', 'I just want to lie on a beach and do nothing.']] },
    { tag: 'series', q: 'Your friend spoils the ending of your favourite series. You…', opts: [
      ['Laugh it off', "It's fine, no big deal."],
      ['Stop talking to them for a day', "I'm giving them the silent treatment."],
      ['Spoil something back', "Two can play at that game."]] },
    { tag: 'series', q: 'How do you watch a new season?', opts: [
      ['All of it in one night', 'I binge the whole thing in one go.'],
      ['One episode a day', 'I like to pace myself.'],
      ['I wait for reviews first', "I'll wait and see what people say."]] },
    { tag: 'pop', q: 'Your favourite artist announces a concert. Tickets cost a fortune.', opts: [
      ['Buy them anyway', "I'm going, no matter what it costs."],
      ['Watch the videos later', "I'll catch the highlights online."],
      ['Wait for the price to drop', "I'll hold off and hope they get cheaper."]] },
    { tag: 'crime', q: 'You hear a strange noise downstairs at 3 a.m.', opts: [
      ['Go and check', "I'd go and see what's going on."],
      ['Pretend I heard nothing', "I'd stay put and hope it goes away."],
      ['Call someone', "I'd call someone straight away."]] },
    { tag: 'tech', q: 'Your phone dies for a whole day. How do you feel?', opts: [
      ['Honestly, relieved', "It's a relief, to be honest."],
      ['Lost', "I feel completely lost without it."],
      ['Fine until I need a map', "I'm fine until I have to find my way."]] },
    { tag: 'gaming', q: 'You are stuck on the same level for an hour.', opts: [
      ['Keep going until I win', "I'm not giving up until I beat it."],
      ['Look up a guide', "I'll just look it up."],
      ['Rage quit', "I'm done. I'm out."]] },
    { tag: 'sport', q: 'It is raining and you planned a run.', opts: [
      ['Go anyway', "A bit of rain won't stop me."],
      ['Work out at home', "I'll do something at home instead."],
      ['Call it a rest day', "I'm taking the day off."]] },
    { tag: 'food', q: 'The waiter brings the wrong dish. You…', opts: [
      ['Eat it. It looks good', "It's fine, I'll just have this."],
      ['Politely send it back', "Sorry, I think this isn't what I ordered."],
      ['Say nothing and never return', "I wouldn't make a fuss."]] },
    { tag: 'health', q: 'It is midnight and you are not sleepy.', opts: [
      ['Scroll my phone', "I end up scrolling for hours."],
      ['Read something boring', "I read until I nod off."],
      ['Get up and do things', "I might as well get something done."]] },
    { tag: 'work', q: 'A meeting could have been an email. You…', opts: [
      ['Say it out loud', "With respect, this could have been an email."],
      ['Quietly answer other emails', "I'd multitask and get on with my work."],
      ['Enjoy the break', "I'd take it as a breather."]] },
    { tag: 'business', q: 'You get two job offers on the same day.', opts: [
      ['Take the better salary', "I'd go for the one that pays more."],
      ['Take the better team', "I'd pick the people over the money."],
      ['Ask both for more', "I'd use one offer to negotiate the other."]] },
    { tag: 'science', q: 'A free ticket to Mars, one way.', opts: [
      ['Yes. When do we leave?', "Sign me up."],
      ['No way', "Not in a million years."],
      ['Only with good Wi-Fi', "Only if I can stay in touch."]] },
    { tag: 'fashion', q: 'You arrive and someone wears the same outfit.', opts: [
      ['Take a photo together', "We should get a photo. Great minds think alike."],
      ['Avoid them all evening', "I'd steer clear of them."],
      ['Compliment their taste', "You've got great taste, obviously."]] },
    { tag: 'environment', q: 'One small green habit you could keep?', opts: [
      ['Carry my own bottle', "I always bring my own bottle."],
      ['Walk short distances', "I'd rather walk if it's close."],
      ['Buy less stuff', "I'm trying to cut down on what I buy."]] },
    { tag: '', q: 'Someone gives you a compliment. You say…', opts: [
      ['Thanks!', "Thanks, that's really kind of you."],
      ['"Oh, this old thing?"', "Oh, this? I've had it for ages."],
      ['A compliment back', "Thanks! I love yours too."]] },
    { tag: '', q: 'A friend is twenty minutes late. Again.', opts: [
      ['I say nothing', "No worries, I just got here myself."],
      ['I make a joke', "Fashionably late, as always."],
      ['I tell them honestly', "To be honest, it's starting to bother me."]] },
    { tag: '', q: 'Monday morning. Your mood?', opts: [
      ['Ready for it', "I'm up for it."],
      ['Not before coffee', "Don't talk to me before my coffee."],
      ['Is it Friday yet?', "Is it Friday yet?"]] },
  ];

  let deck = [], at = 0, feed = null;
  /* Today's answers survive closing the panel: the deck is the same all day,
     so coming back should show where you stopped, not five blank cards. */
  const DECK_KEY = 'te_feed_deck';
  function saveDeck() {
    try { localStorage.setItem(DECK_KEY, JSON.stringify({ day: dayNo(), at, cards: deck.map(c => ({ answer: c.answer ?? null, added: !!c.added })) })); } catch (_) {}
  }
  function restoreDeck() {
    try {
      const d = JSON.parse(localStorage.getItem(DECK_KEY) || 'null');
      if (!d || d.day !== dayNo() || !Array.isArray(d.cards) || d.cards.length !== deck.length) return;
      d.cards.forEach((c, i) => { if (deck[i].type !== 'done') { deck[i].answer = c.answer; deck[i].added = c.added; } });
      at = Math.max(0, Math.min(deck.length - 1, Number(d.at) || 0));
    } catch (_) {}
  }
  const dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60e3) / 864e5);

  function quizCard(chunks, i, day, reverse) {
    const n = chunks.length;
    const right = chunks[i % n];
    const picks = [right, chunks[(i + 5) % n], chunks[(i + 13) % n]];
    const pos = day % 3;                       // where the right answer sits today
    const order = [1, 2]; order.splice(pos, 0, 0);
    return {
      type: 'quiz', reverse, phrase: right[0], meaning: right[1], example: right[2],
      opts: order.map(k => (reverse ? picks[k][0] : picks[k][1])), right: pos, answer: null,
    };
  }

  function buildDeck() {
    const day = dayNo();
    const chunks = (window.studentEngage && window.studentEngage.chunks) || [];
    const mine = new Set((dna && dna.interests) || []);
    const pool = POLLS.filter(p => mine.has(p.tag));
    const polls = pool.length ? pool : POLLS.filter(p => !p.tag);
    const cards = [];
    if (chunks.length > 14) cards.push(quizCard(chunks, day + 3, day, false));   // not today's phrase: its meaning is on the home page
    cards.push({ type: 'poll', ...polls[day % polls.length], answer: null });
    if (chunks.length > 14) cards.push(quizCard(chunks, day + 17, day + 1, true));
    const art = feed && feed.items && feed.items[0];
    if (art) cards.push({ type: 'news', art, answer: null });
    cards.push({ type: 'done' });
    return cards;
  }

  function cardHtml(c) {
    if (c.type === 'quiz') {
      const done = c.answer != null;
      return `<div class="sf-story ink">
        <div class="sf-kick">${c.reverse ? 'Guess the phrase' : 'Phrase hack · 10 seconds'}</div>
        ${c.reverse ? `<div class="sf-ask-q">Which one means:</div><h4>“${esc(c.meaning)}”</h4>`
          : `<div class="sf-big">${esc(c.phrase)}</div><div class="sf-ask-q">What does it mean?</div>`}
        <div class="sf-opts">${c.opts.map((o, i) => `<button type="button" class="sf-opt${done ? (i === c.right ? ' ok' : i === c.answer ? ' bad' : ' dim') : ''}" data-opt="${i}"${done ? ' disabled' : ''}>${esc(o)}</button>`).join('')}</div>
        ${done ? `<div class="sf-after" aria-live="polite"><b>${c.answer === c.right ? 'Yes! 🎉' : 'Not quite.'}</b> <b>${esc(c.phrase)}</b> = ${esc(c.meaning)}<em>“${esc(c.example)}”</em>
          <div class="sf-row2"><button type="button" class="sf-mini" data-add${c.added ? ' disabled' : ''}>${c.added ? '✓ In your words' : '+ Add to my words'}</button><button type="button" class="sf-mini ghost" data-say="${esc(c.example)}">🔊 Listen</button></div></div>` : ''}
      </div>`;
    }
    if (c.type === 'poll') {
      const done = c.answer != null;
      return `<div class="sf-story lime">
        <div class="sf-kick">Quick poll · no wrong answer</div>
        <h4>${esc(c.q)}</h4>
        <div class="sf-opts">${c.opts.map((o, i) => `<button type="button" class="sf-opt${done ? (i === c.answer ? ' ok' : ' dim') : ''}" data-opt="${i}"${done ? ' disabled' : ''}>${esc(o[0])}</button>`).join('')}</div>
        ${done ? `<div class="sf-after" aria-live="polite">Say it like this:<br><b>“${esc(c.opts[c.answer][1])}”</b>
          <div class="sf-row2"><button type="button" class="sf-mini" data-say="${esc(c.opts[c.answer][1])}">🔊 Listen</button></div></div>` : ''}
      </div>`;
    }
    if (c.type === 'news') {
      const a = c.art, sum = String(a.summary || '');
      const short = sum.length > 190 ? sum.slice(0, 190).replace(/\s+\S*$/, '') + '…' : sum;
      return `<div class="sf-story">
        <div class="sf-kick">Headline of the day${a.interest ? ' · ' + esc(a.interest) : ''}</div>
        <h4>${esc(a.title)}</h4>
        ${short ? `<p class="sf-sum" style="margin:0;font-size:15px;line-height:1.55">${wrapWords(short)}</p><small style="color:#7A7E68">${esc(a.source)} · tap a word to see what it means</small>` : `<small style="color:#7A7E68">${esc(a.source)}</small>`}
        <div class="sf-ask-q">Would you read this?</div>
        <div class="sf-row2" style="margin-top:0"><button type="button" class="sf-opt${c.answer === 0 ? ' ok' : c.answer === 1 ? ' dim' : ''}" data-opt="0">👍 I would</button><button type="button" class="sf-opt${c.answer === 1 ? ' ok' : c.answer === 0 ? ' dim' : ''}" data-opt="1">👎 Not for me</button></div>
        ${c.answer === 0 ? `<a class="sf-mini" href="${esc(a.url)}" target="_blank" rel="noopener">Read it ↗</a>` : c.answer === 1 ? '<div class="sf-after">Fair enough. Tomorrow brings a new one.</div>' : ''}
      </div>`;
    }
    const quizzes = deck.filter(x => x.type === 'quiz'), got = quizzes.filter(x => x.answer === x.right).length;
    const rest = ((feed && feed.items) || []).slice(1);
    return `<div class="sf-story">
        <div class="sf-kick">That's today</div>
        <div class="sf-big">Done ✨</div>
        <div class="sf-after">${quizzes.length ? `${got} of ${quizzes.length} phrases right. ` : ''}New cards tomorrow.</div>
        <div class="sf-ask-q">Saw a phrase you did not get?</div>
        <form class="sf-ask" style="margin:0"><input type="text" maxlength="80" placeholder="e.g. “it turns out”" aria-label="Explain a phrase"><button type="submit" class="sf-btn">Explain</button></form>
        <button type="button" class="sf-link" data-edit style="align-self:flex-start;margin-top:auto">${dna ? 'Change my interests' : 'Tell us what you like'}</button>
      </div>
      ${rest.length ? `<div class="sf-more"><div class="sf-kick" style="color:#5D614B">Want to read? Two more headlines</div>${rest.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}<small>${esc(a.source)} ↗</small></a>`).join('')}</div>` : ''}`;
  }

  function draw() {
    const body = document.getElementById('sf-body');
    if (!body || !deck.length) return;
    const c = deck[at], last = at === deck.length - 1;
    const waiting = (c.type === 'quiz' || c.type === 'poll') && c.answer == null;
    body.innerHTML = `<div class="sf-bars" role="img" aria-label="Card ${at + 1} of ${deck.length}">${deck.map((_, i) => `<i class="${i <= at ? 'on' : ''}"></i>`).join('')}</div>
      ${cardHtml(c)}
      <div class="sf-nav">${at ? '<button type="button" class="sf-link" data-prev>← Back</button>' : ''}${last ? '' : `<button type="button" class="sf-btn" data-next>${waiting ? 'Skip' : 'Next →'}</button>`}</div>`;
  }

  async function loadFeed() {
    if (feedLoaded) return;
    const body = document.getElementById('sf-body');
    if (!body) return;
    feedLoaded = true;
    feed = null;
    // The cards do not depend on the news: if the feed is down, the day still has its deck.
    try { const r = await api('/api/student/feed'); const d = await json(r); if (r.ok && d) feed = d; } catch {}
    deck = buildDeck(); at = 0;
    restoreDeck();
    draw();
  }

  async function addPhrase(c, btn) {
    btn.disabled = true;
    try {
      const r = await api('/api/journal/vocab', { method: 'POST', body: { word: c.phrase, translation: c.meaning, example: c.example } });
      if (!r.ok) throw new Error('failed');
      c.added = true; btn.textContent = '✓ In your words'; saveDeck();
      if (typeof window.loadVocab === 'function') window.loadVocab();
    } catch { btn.disabled = false; btn.textContent = 'Could not add. Try again'; }
  }

  function onPane(e) {
    if (e.target.closest('[data-edit]')) { onboarding(); return; }
    const c = deck[at];
    const opt = e.target.closest('[data-opt]');
    if (opt && c) { c.answer = +opt.dataset.opt; saveDeck(); draw(); document.querySelector('#sf-body [data-next], #sf-body .sf-mini')?.focus({ preventScroll: true }); return; }
    if (e.target.closest('[data-next]')) { at = Math.min(deck.length - 1, at + 1); saveDeck(); draw(); return; }
    if (e.target.closest('[data-prev]')) { at = Math.max(0, at - 1); saveDeck(); draw(); return; }
    const say = e.target.closest('[data-say]');
    if (say) { speak(say.dataset.say); return; }
    const add = e.target.closest('[data-add]');
    if (add && c) { addPhrase(c, add); return; }
    const w = e.target.closest('.sf-w');
    if (w) { const r = w.getBoundingClientRect(); explain(w.textContent, r.left, r.bottom + 6, w.closest('.sf-story')?.querySelector('h4')?.textContent || ''); }
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
