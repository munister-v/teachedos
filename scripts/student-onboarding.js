/* Student onboarding: the first minute in the cabinet.

   1. Express profile - three one-tap questions, one per screen: why English,
      what is interesting, how many minutes a day.
   2. Level - the one the teacher already set in their Journal ("Your teacher
      set your level to B2"), or a self-assessment by situations, not letters.
   3. A 30-second tour - the page dims and three things light up in turn: the
      next lesson, the Word Bank, the streak.
   4. The first win - "Light up your first day": five starter phrases picked
      by the interests go into the Word Bank and the 1-minute Daily Sprint
      starts right away. Back on the page the streak shows Day 1.

   Plus, for a student with no teacher yet, a banner in place of the empty
   "next lesson": paste the teacher's invite link.

   window.StudentOnboarding.start(ctx) - ctx: { api, dna, catalog, onSaved }.
   Used by student-feed.js (first visit, and "edit profile"). */
(function () {
  'use strict';
  if (window.StudentOnboarding) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const json = async r => { try { return await r.json(); } catch { return null; } };
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LEVEL_SITUATIONS = [
    { level: 'A2', dot: '🟢', title: 'A1–A2', text: 'I can explain simple things, but speaking is hard.' },
    { level: 'B1', dot: '🟡', title: 'B1–B2', text: 'I get the main idea, but mix up words and grammar when I speak.' },
    { level: 'C1', dot: '🔵', title: 'C1–C2', text: 'I speak freely and want to polish small mistakes and grow my vocabulary.' },
  ];
  const DAILY = [
    { m: 1, emoji: '⚡', title: '1 minute a day', text: 'One Smart Sprint' },
    { m: 5, emoji: '☕', title: '5 minutes a day', text: 'A sprint and a few new words' },
    { m: 15, emoji: '🎯', title: '15 minutes a day', text: 'Sprint, reading and practice' },
  ];

  function css() {
    if (document.getElementById('so-css')) return;
    const st = document.createElement('style');
    st.id = 'so-css';
    st.textContent = `
.so-ov{position:fixed;inset:0;z-index:5200;display:grid;place-items:center;padding:16px;background:rgba(24,26,30,.42);-webkit-backdrop-filter:blur(14px) saturate(1.2);backdrop-filter:blur(14px) saturate(1.2);font-family:var(--font,inherit)}
.so-card{position:relative;width:min(560px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:rgba(255,255,255,.94);border:1px solid rgba(255,255,255,.8);border-radius:28px;padding:26px 26px 22px;box-shadow:0 40px 100px -30px rgba(0,0,0,.5);color:#24282C}
.so-steps{display:flex;gap:6px;margin-bottom:18px}
.so-steps i{flex:1;height:4px;border-radius:4px;background:rgba(36,40,44,.1)}
.so-steps i.on{background:#24282C}
.so-kick{font:700 11px ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#7A7E68;margin-bottom:6px}
.so-card h2{font-size:24px;line-height:1.15;letter-spacing:-.025em;margin:0 0 6px}
.so-sub{font-size:14px;line-height:1.45;color:#5D614B;margin:0 0 18px}
.so-plates{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.so-plates.one{grid-template-columns:1fr}
.so-plate{display:flex;align-items:center;gap:12px;min-height:64px;padding:12px 14px;border:1.5px solid rgba(36,40,44,.12);border-radius:18px;background:#fff;color:#24282C;font:inherit;text-align:left;cursor:pointer;transition:border-color .15s,background .15s,transform .12s}
.so-plate:hover{border-color:rgba(36,40,44,.4)}
.so-plate:active{transform:scale(.98)}
.so-plate.on{border-color:#24282C;background:#F4F9DD;box-shadow:inset 0 0 0 1px #24282C}
.so-plate .e{font-size:24px;flex:none;width:30px;text-align:center}
.so-plate b{display:block;font-size:14.5px;font-weight:650}
.so-plate small{display:block;font-size:12.5px;color:#5D614B;margin-top:2px;line-height:1.35}
.so-chips{display:flex;flex-wrap:wrap;gap:8px}
.so-chip{border:1.5px solid rgba(36,40,44,.14);background:#fff;border-radius:999px;padding:9px 14px;font:600 14px inherit;font-family:inherit;color:#24282C;cursor:pointer}
.so-chip.on{background:#24282C;border-color:#24282C;color:#fff}
.so-teacher{display:flex;gap:12px;align-items:center;padding:16px;border-radius:18px;background:#F4F9DD;border:1px solid rgba(160,200,40,.4);margin-bottom:12px}
.so-teacher b{font-size:28px;letter-spacing:-.02em}
.so-nav{display:flex;align-items:center;gap:10px;margin-top:22px}
.so-back{border:0;background:transparent;color:#5D614B;font:600 14px inherit;font-family:inherit;cursor:pointer;padding:10px 4px}
.so-skip{border:0;background:transparent;color:#7A7E68;font:500 13px inherit;font-family:inherit;text-decoration:underline;cursor:pointer;padding:10px 4px}
.so-next{margin-left:auto;height:48px;padding:0 24px;border:0;border-radius:14px;background:#24282C;color:#fff;font:650 15px inherit;font-family:inherit;cursor:pointer}
.so-next:disabled{opacity:.35;cursor:default}
.so-next.lime{background:#CDF649;color:#24282C;box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 10px 24px -12px rgba(140,180,20,.8)}
.so-err{color:#B3261E;font-size:13px;margin-top:10px;min-height:16px}
/* tour */
.so-tour{position:fixed;inset:0;z-index:5200;pointer-events:none}
.so-hole{position:fixed;border-radius:22px;box-shadow:0 0 0 9999px rgba(18,20,24,.58);outline:2px solid #CDF649;outline-offset:4px;transition:all .45s cubic-bezier(.2,.8,.2,1);pointer-events:none}
.so-tip{position:fixed;width:min(320px,calc(100vw - 32px));background:#fff;color:#24282C;border-radius:20px;padding:16px 18px;box-shadow:0 24px 60px -20px rgba(0,0,0,.5);pointer-events:auto;transition:top .45s cubic-bezier(.2,.8,.2,1),left .45s cubic-bezier(.2,.8,.2,1)}
.so-tip b{display:block;font-size:16px;margin-bottom:4px}
.so-tip p{margin:0;font-size:13.5px;line-height:1.45;color:#5D614B}
.so-tip-nav{display:flex;align-items:center;gap:8px;margin-top:12px}
.so-tip-nav span{font-size:12px;color:#7A7E68}
.so-tip-nav button{margin-left:auto;height:38px;padding:0 16px;border:0;border-radius:12px;background:#24282C;color:#fff;font:650 13.5px inherit;font-family:inherit;cursor:pointer}
/* first win */
.so-win{text-align:center}
.so-win .so-flame{font-size:56px;line-height:1;margin:6px 0 10px;filter:drop-shadow(0 8px 24px rgba(205,246,73,.6))}
.so-win .so-next{margin:0 auto;display:inline-flex;align-items:center;gap:8px}
.so-win .so-skip{display:block;margin:8px auto 0}
/* the Day 1 flash on the streak */
@keyframes so-day1{0%{box-shadow:0 0 0 0 rgba(200,255,46,.0)}30%{box-shadow:0 0 0 6px rgba(200,255,46,.9),0 0 40px 10px rgba(200,255,46,.6)}100%{box-shadow:0 0 0 0 rgba(200,255,46,0)}}
.so-day1{animation:so-day1 1.6s ease-out 2;border-radius:18px}
/* no teacher yet */
.so-noteacher{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:0 0 14px;padding:16px 18px;border-radius:20px;background:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.8);box-shadow:0 14px 34px -22px rgba(0,0,0,.4);color:#24282C}
.so-noteacher .t{flex:1 1 240px}
.so-noteacher b{display:block;font-size:15px}
.so-noteacher span{font-size:13px;color:#5D614B}
.so-noteacher form{display:flex;gap:8px;flex:1 1 320px}
.so-noteacher input{flex:1;min-width:0;height:42px;border:1px solid rgba(36,40,44,.14);border-radius:12px;padding:0 12px;font:500 14px inherit;font-family:inherit;background:#F4F5F0}
.so-noteacher button{height:42px;padding:0 16px;border:0;border-radius:12px;background:#24282C;color:#fff;font:650 14px inherit;font-family:inherit;cursor:pointer}
@media (max-width:560px){
  .so-card{padding:22px 18px 18px;border-radius:24px}
  .so-plates{grid-template-columns:1fr}
  .so-card h2{font-size:21px}
}
${REDUCED ? '.so-hole,.so-tip{transition:none}.so-day1{animation:none}' : ''}`;
    document.head.appendChild(st);
  }

  /* ── 1–2: profile and level ───────────────────────────────────────── */
  function wizard(ctx) {
    return new Promise(resolve => {
      const cat = ctx.catalog || {};
      const dna = ctx.dna || {};
      const teacherLevel = ctx.teacherLevel || null;
      const st = {
        goal: dna.goal || '',
        interests: new Set(dna.interests || []),
        daily: dna.daily_minutes || null,
        level: dna.level || teacherLevel || '',
        changeLevel: !teacherLevel,
      };
      const STEPS = ['goal', 'interests', 'daily', 'level'];
      let i = 0;
      const ov = document.createElement('div');
      ov.className = 'so-ov';
      const close = val => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
      const onKey = e => { if (e.key === 'Escape') close(null); };

      const ok = () => ({ goal: !!st.goal, interests: st.interests.size > 0, daily: !!st.daily, level: true })[STEPS[i]];
      const body = () => {
        const k = STEPS[i];
        if (k === 'goal') return `
          <div class="so-kick">Step 1 of 4 · about you</div>
          <h2>Why do you want English?</h2>
          <p class="so-sub">Pick one. Your teacher sees it, and your daily phrases follow it.</p>
          <div class="so-plates">${(cat.goals || []).map(g => `<button type="button" class="so-plate${st.goal === g.key ? ' on' : ''}" data-goal="${esc(g.key)}"><span class="e">${esc(g.emoji || '')}</span><span><b>${esc(g.label)}</b></span></button>`).join('')}</div>`;
        if (k === 'interests') return `
          <div class="so-kick">Step 2 of 4 · interests</div>
          <h2>What are you into?</h2>
          <p class="so-sub">Pick a few. Your Phrase of the Day and cards come from these.</p>
          <div class="so-chips">${(cat.interests || []).map(t => `<button type="button" class="so-chip${st.interests.has(t.key) ? ' on' : ''}" data-int="${esc(t.key)}">${esc(t.emoji)} ${esc(t.label)}</button>`).join('')}</div>`;
        if (k === 'daily') return `
          <div class="so-kick">Step 3 of 4 · your pace</div>
          <h2>How much time between lessons?</h2>
          <p class="so-sub">Small and regular beats long and rare. You can change it anytime.</p>
          <div class="so-plates one">${DAILY.map(d => `<button type="button" class="so-plate${st.daily === d.m ? ' on' : ''}" data-daily="${d.m}"><span class="e">${d.emoji}</span><span><b>${d.title}</b><small>${d.text}</small></span></button>`).join('')}</div>`;
        // level
        if (teacherLevel && !st.changeLevel) return `
          <div class="so-kick">Step 4 of 4 · your level</div>
          <h2>Your level is set</h2>
          <div class="so-teacher"><b>${esc(teacherLevel)}</b><span>Your teacher set your level to ${esc(teacherLevel)}. You can adjust it anytime.</span></div>
          <button type="button" class="so-skip" data-change-level>It doesn't feel right - choose myself</button>`;
        return `
          <div class="so-kick">Step 4 of 4 · your level</div>
          <h2>Which sounds like you?</h2>
          <p class="so-sub">No test - just pick the situation that fits best.</p>
          <div class="so-plates one">${LEVEL_SITUATIONS.map(l => `<button type="button" class="so-plate${st.level === l.level ? ' on' : ''}" data-lvl="${l.level}"><span class="e">${l.dot}</span><span><b>${l.title}</b><small>${esc(l.text)}</small></span></button>`).join('')}
          <button type="button" class="so-plate${st.level === '' ? ' on' : ''}" data-lvl=""><span class="e">🤔</span><span><b>Not sure</b><small>My teacher will decide after the first lesson.</small></span></button></div>`;
      };
      const draw = () => {
        const last = i === STEPS.length - 1;
        ov.innerHTML = `<div class="so-card" role="dialog" aria-modal="true" aria-label="Set up your learning">
          <div class="so-steps">${STEPS.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
          ${body()}
          <div class="so-err" id="so-err"></div>
          <div class="so-nav">
            ${i ? '<button type="button" class="so-back" data-back>← Back</button>' : '<button type="button" class="so-skip" data-later>Later</button>'}
            <button type="button" class="so-next${last ? ' lime' : ''}" data-next${ok() ? '' : ' disabled'}>${last ? 'Done' : 'Next'}</button>
          </div></div>`;
        const first = ov.querySelector('.so-plate.on, .so-chip.on, .so-plate, .so-chip');
        if (first && document.activeElement === document.body) first.focus({ preventScroll: true });
      };
      ov.addEventListener('click', async e => {
        const t = e.target;
        const g = t.closest('[data-goal]'), n = t.closest('[data-int]'), d = t.closest('[data-daily]'), l = t.closest('[data-lvl]');
        if (g) { st.goal = g.dataset.goal; draw(); if (!REDUCED) setTimeout(() => { if (STEPS[i] === 'goal') { i++; draw(); } }, 260); return; }
        if (n) { const k = n.dataset.int; st.interests.has(k) ? st.interests.delete(k) : (st.interests.size < 8 && st.interests.add(k)); draw(); return; }
        if (d) { st.daily = Number(d.dataset.daily); draw(); if (!REDUCED) setTimeout(() => { if (STEPS[i] === 'daily') { i++; draw(); } }, 260); return; }
        if (l) { st.level = l.dataset.lvl; draw(); return; }
        if (t.closest('[data-change-level]')) { st.changeLevel = true; draw(); return; }
        if (t.closest('[data-back]')) { i = Math.max(0, i - 1); draw(); return; }
        if (t.closest('[data-later]')) { try { sessionStorage.setItem('sf_skip', '1'); } catch {} close(null); return; }
        if (t.closest('[data-next]')) {
          if (i < STEPS.length - 1) { i++; draw(); return; }
          const btn = t.closest('[data-next]'); btn.disabled = true;
          const out = { goal: st.goal, interests: [...st.interests], level: st.level, daily_minutes: st.daily };
          try {
            const r = await ctx.api('/api/student/dna', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) });
            if (!r.ok) throw new Error(((await json(r)) || {}).error || 'Could not save');
            close(out);
          } catch (err) { btn.disabled = false; ov.querySelector('#so-err').textContent = err.message; }
        }
      });
      document.addEventListener('keydown', onKey);
      draw();
      document.body.appendChild(ov);
    });
  }

  /* ── 3: the 30-second tour ─────────────────────────────────────────── */
  function tour() {
    return new Promise(resolve => {
      const stops = [
        { el: () => document.getElementById('te-next'), title: 'Your next lesson', text: 'Your next lesson is always here, with the button that takes you onto the interactive board.' },
        { el: () => document.getElementById('te-words'), title: 'Your Word Bank', text: 'Every new word from your lessons and homework lands here, ready to practise.' },
        { el: () => document.getElementById('te-streak'), title: 'Your streak', text: 'Do a 1-minute sprint every day to keep the fire of your streak burning.' },
      ].filter(s => { const e = s.el(); return e && e.getClientRects().length; });
      if (!stops.length) { resolve(); return; }
      const wrap = document.createElement('div');
      wrap.className = 'so-tour';
      wrap.innerHTML = '<div class="so-hole"></div><div class="so-tip" role="dialog" aria-live="polite"></div>';
      document.body.appendChild(wrap);
      const hole = wrap.querySelector('.so-hole'), tip = wrap.querySelector('.so-tip');
      let k = 0;
      const finish = () => { window.removeEventListener('resize', place); document.removeEventListener('keydown', onKey); wrap.remove(); resolve(); };
      const onKey = e => { if (e.key === 'Escape') finish(); else if (e.key === 'Enter' || e.key === 'ArrowRight') next(); };
      const next = () => { if (++k >= stops.length) finish(); else show(); };
      function place() {
        const el = stops[k].el(); if (!el) return;
        const r = el.getBoundingClientRect();
        Object.assign(hole.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
        const below = r.bottom + 16 + tip.offsetHeight < window.innerHeight;
        const top = below ? r.bottom + 16 : Math.max(12, r.top - tip.offsetHeight - 16);
        const left = Math.min(Math.max(12, r.left), window.innerWidth - tip.offsetWidth - 12);
        Object.assign(tip.style, { top: top + 'px', left: left + 'px' });
      }
      function show() {
        const s = stops[k];
        const el = s.el();
        el.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
        tip.innerHTML = `<b>${esc(s.title)}</b><p>${esc(s.text)}</p><div class="so-tip-nav"><span>${k + 1} / ${stops.length}</span><button type="button">${k === stops.length - 1 ? 'Got it' : 'Next'}</button></div>`;
        tip.querySelector('button').addEventListener('click', next);
        tip.querySelector('button').focus({ preventScroll: true });
        setTimeout(place, REDUCED ? 0 : 350);
        place();
      }
      window.addEventListener('resize', place);
      document.addEventListener('keydown', onKey);
      show();
    });
  }

  /* ── 4: the first win ──────────────────────────────────────────────── */
  function firstWin(ctx) {
    const ov = document.createElement('div');
    ov.className = 'so-ov';
    ov.innerHTML = `<div class="so-card so-win" role="dialog" aria-modal="true" aria-label="Your first day">
      <div class="so-flame" aria-hidden="true">🔥</div>
      <h2>Let's light up your first day!</h2>
      <p class="so-sub">We picked five easy phrases from your interests. One timed minute - and your streak starts today.</p>
      <button type="button" class="so-next lime" data-go>⚡ Start my first 1-min Sprint</button>
      <div class="so-err" id="so-err"></div>
      <button type="button" class="so-skip" data-later>Maybe later</button></div>`;
    const close = () => ov.remove();
    ov.addEventListener('click', async e => {
      if (e.target.closest('[data-later]')) { close(); return; }
      const go = e.target.closest('[data-go]');
      if (!go) return;
      go.disabled = true;
      try {
        const r = await ctx.api('/api/student/starter-words', { method: 'POST' });
        if (!r.ok) throw new Error('Could not prepare your phrases');
      } catch (err) { go.disabled = false; ov.querySelector('#so-err').textContent = err.message; return; }
      close();
      if (window.TeachedVault && typeof window.TeachedVault.sprint === 'function') {
        window.TeachedVault.sprint({
          api: ctx.api,
          onDone: ({ finished } = {}) => {
            if (typeof window.loadProgress === 'function') window.loadProgress();
            if (window.studentEngage && typeof window.studentEngage.vault === 'function') window.studentEngage.vault();
            if (finished) setTimeout(day1, 600);
          },
        });
      }
    });
    document.body.appendChild(ov);
    ov.querySelector('[data-go]').focus();
  }
  function day1() {
    const s = document.getElementById('te-streak');
    if (!s) return;
    s.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
    s.classList.remove('so-day1'); void s.offsetWidth; s.classList.add('so-day1');
    setTimeout(() => s.classList.remove('so-day1'), 3400);
  }

  /* ── no teacher yet ────────────────────────────────────────────────── */
  function noTeacherBanner() {
    if (document.getElementById('so-noteacher')) return;
    const host = document.getElementById('te-today') || document.querySelector('.welcome');
    if (!host) return;
    css();
    const el = document.createElement('div');
    el.id = 'so-noteacher';
    el.className = 'so-noteacher';
    el.innerHTML = `<div class="t"><b>Connect your teacher</b><span>Paste the invite link your teacher sent you - your lessons and board will appear here.</span></div>
      <form><input type="url" inputmode="url" placeholder="teached.tech/join.html?t=…" aria-label="Teacher's invite link"><button type="submit">Connect</button></form>`;
    el.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const v = el.querySelector('input').value.trim();
      let u = null;
      try { u = new URL(/^https?:\/\//.test(v) ? v : 'https://' + v); } catch {}
      if (!u || !/(^|\.)teached\.tech$|^localhost$/.test(u.hostname) || !/join|invite/.test(u.pathname)) {
        el.querySelector('input').setCustomValidity('Paste the whole invite link from your teacher');
        el.querySelector('input').reportValidity();
        setTimeout(() => el.querySelector('input').setCustomValidity(''), 2500);
        return;
      }
      location.href = u.pathname.replace(/^\//, '') + u.search;
    });
    host.parentNode.insertBefore(el, host);
  }

  async function start(ctx) {
    css();
    const out = await wizard(ctx);
    if (!out) return null;
    if (ctx.onSaved) ctx.onSaved(out);
    if (ctx.edit) return out;                 // editing the profile later: no tour again
    await tour();
    firstWin(ctx);
    return out;
  }

  window.StudentOnboarding = { start, noTeacherBanner };
})();
