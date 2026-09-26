/* Picture Studio.

   A themed worksheet built around one big line drawing (the house, the car,
   the hospital…): every thing in the picture is a pinned word. The drawing
   and its words live in data/scenes/<id>.json, made by ops/scenes/make_*.py.
   The card only carries { scene, level, title }.

   Tasks on the right: Explore (word cards: IPA, voice, real videos, Vault),
   Find it, Name it, Label it, True or False (prepositions) and Talk & Write.
   A printable worksheet with its answer key comes from the same picture.

   TeachedScene.preview(el, out, onOpen)  - the card on the canvas
   TeachedScene.mount(el, { out, state, save, api, canSave, boardId, onSaved })
   TeachedScene.catalog                   - themes for the lesson wizard
*/
(function () {
  'use strict';
  if (window.TeachedScene) return;

  const CATALOG = [
    { id: 'house', title: 'The House', icon: '🏠', hint: 'Rooms, furniture, the garden and the garage.', ready: true },
    { id: 'car', title: 'The Car', icon: '🚗', hint: 'A car seen right through, the street and the petrol station.', ready: true },
    { id: 'hospital', title: 'The Hospital', icon: '🏥', hint: 'A&E to the helipad: the people, the rooms, what happens there.', ready: true },
    { id: 'kitchen', title: 'The Kitchen', icon: '🍳', hint: 'Machines, cupboards, cooking tools and a table laid for breakfast.', ready: true },
    { id: 'airport', title: 'The Airport', icon: '✈️', hint: 'Check-in, security, the gate, baggage reclaim and a plane at the jet bridge.', ready: true },
    { id: 'school', title: 'The School', icon: '🏫', hint: 'A classroom, the library, the canteen, the gym and the school bus.', ready: true },
    { id: 'supermarket', title: 'The Supermarket', icon: '🛒', hint: 'Fruit and veg, the bakery, the fridge and freezer, shelves and the checkout.', ready: true },
    { id: 'street', title: 'The High Street', icon: '🏪', hint: 'Shops with flats above, a café, a zebra crossing and a bus stop.', ready: true },
  ];
  const LEVELS = ['A1', 'A2', 'B1'];
  const rank = l => Math.max(0, LEVELS.indexOf(l));

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const shuffle = (arr, seed) => {
    const a = arr.slice();
    let x = seed || 7;
    for (let i = a.length - 1; i > 0; i--) { x = (x * 9301 + 49297) % 233280; const j = Math.floor(x / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const rseed = () => 1 + Math.floor(Math.random() * 9973);
  const norm = s => String(s || '').trim().toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ');

  /* ── data ── */
  const cache = new Map();
  function load(id) {
    if (!cache.has(id)) {
      cache.set(id, fetch(`/data/scenes/${encodeURIComponent(id)}.json?v=1008`).then(r => {
        if (!r.ok) throw new Error('scene ' + r.status);
        return r.json();
      }).catch(err => { cache.delete(id); throw err; }));
    }
    return cache.get(id);
  }

  /* the part of the drawing shown at first ("view"), and the zoom areas:
     rooms (which are words too) and zones (zoom only, e.g. "Inside the car") */
  const home = sc => { const v = sc.view || [0, 0, sc.w, sc.h]; return { x: v[0], y: v[1], w: v[2], h: v[3] }; };
  const viewBox = sc => { const h = home(sc); return `${h.x} ${h.y} ${h.w} ${h.h}`; };
  const areas = sc => sc.rooms.concat(sc.zones || []);
  const inside = (b, a) => b[0] >= a[0] - 1 && b[1] >= a[1] - 1 && b[0] + b[2] <= a[0] + a[2] + 1 && b[1] + b[3] <= a[1] + a[3] + 1;

  // Keep in step with PALETTE in ops/scenes/scene.py.
  const FILL = {
    paper: '#FFFEFA', wall: '#F3F0E6', wood: '#E9D8BA', glass: '#DDEBF1', tint: '#ECE8DC', lime: '#CDF649',
    ink: '#24282C', earth: '#DCCFB6', sage: '#E4EBDC', sky: '#E3ECF2', blush: '#F6E6DF', sand: '#F5ECD9',
    lav: '#EAE6F2', mint: '#E0F0E8', steel: '#DDE1E5', brick: '#DDA58F', grass: '#C9DFA9', leaf: '#C2DAA0',
    red: '#E48A70', sun: '#FFF1BF', sage2: '#C8D8BC', sky2: '#C8DDEA', blush2: '#F0CDBF', sand2: '#EBD9B4',
    lav2: '#D8CFEA', mint2: '#BFE2D1', asphalt: '#CFCBC3', shadow: 'rgba(36,40,44,.12)', skyg: 'url(#scsky)', glassa: 'rgba(196,222,236,.42)',
  };
  const SW = { main: 1.7, det: 1.1, hair: 0.6, soft: 0.8 };
  const DEFS = '<defs><linearGradient id="scsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCEAF3"/><stop offset="1" stop-color="#F7F4EC"/></linearGradient></defs>';
  const artCache = new Map();
  const drawnOnce = new Set();

  function artSvg(sc, animate) {
    const k = 0.32; // ms of the drawing script → ms on screen
    const body = sc.items.map(it => {
      const fill = it.f ? FILL[it.f] || 'none' : 'none';
      const stroke = it.s ? ` stroke="#24282C" stroke-width="${SW[it.s]}"${it.s === 'soft' ? ' stroke-opacity=".16"' : ''}` : '';
      if (!animate) return `<path d="${it.d}" fill="${fill}"${stroke}/>`;
      const delay = Math.round(it.t * k);
      if (it.s === 'main') return `<path class="sc-draw" pathLength="1" style="animation-delay:${delay}ms,${delay}ms" d="${it.d}" fill="${fill}"${stroke}/>`;
      return `<path class="sc-fade" style="animation-delay:${delay + 120}ms" d="${it.d}" fill="${fill}"${stroke}/>`;
    }).join('');
    return `${DEFS}<g stroke-linejoin="round" stroke-linecap="round">${body}</g>`;
  }
  /* the still drawing, made once per scene (word-card thumbnails, print) */
  function stillArt(sc) {
    if (!artCache.has(sc.id)) artCache.set(sc.id, artSvg(sc, false));
    return artCache.get(sc.id);
  }

  const CSS = `
.sc{--ink:#24282C;--muted:#6B6E60;--lime:#CDF649;--paper:#FBFAF6;--line:rgba(36,40,44,.12);--ok:#5b7a00;display:grid;grid-template-columns:minmax(0,1fr) 400px;height:100%;min-height:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif}
.sc-main{display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0;min-width:0}
.sc-bar{display:flex;align-items:center;gap:6px;padding:12px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.sc-rooms{display:flex;gap:4px;flex-wrap:wrap;flex:1;min-width:0}
.sc-chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 11px;font:600 12px/1 inherit;font-family:inherit;color:var(--ink);cursor:pointer;white-space:nowrap}
.sc-chip:hover{border-color:rgba(36,40,44,.35)}
.sc-chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.sc-tools{display:flex;gap:4px;align-items:center}
.sc-ib{border:0;background:#F2F1EB;border-radius:9px;min-width:32px;height:32px;padding:0 9px;font:650 13px inherit;font-family:inherit;color:var(--ink);cursor:pointer}
.sc-ib.on{background:var(--lime)}
.sc-seg{display:inline-flex;background:#F2F1EB;border-radius:10px;padding:3px}
.sc-seg button{border:0;background:transparent;border-radius:8px;padding:6px 9px;font:700 11px 'SF Mono',ui-monospace,Menlo,monospace;color:var(--muted);cursor:pointer}
.sc-seg button.on{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.sc-stage{position:relative;overflow:hidden;min-height:0;cursor:grab;user-select:none;-webkit-user-select:none;background:linear-gradient(#EEF3F6,#F8F6F0)}
.sc-stage.drag{cursor:grabbing}
.sc-stage.aim{cursor:crosshair}
.sc-stage svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.sc-draw{stroke-dasharray:1;stroke-dashoffset:1;fill-opacity:0;animation:scdraw .9s ease forwards,scfill .5s ease forwards}
@keyframes scdraw{to{stroke-dashoffset:0}}
@keyframes scfill{to{fill-opacity:1}}
.sc-fade{opacity:0;animation:scfade .6s ease forwards}
@keyframes scfade{to{opacity:1}}
.sc-layer{position:absolute;inset:0;pointer-events:none}
.sc-pin{position:absolute;pointer-events:auto;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;border:2.5px solid #fff;background:var(--lime);cursor:pointer;padding:0;display:grid;place-items:center;font:800 10px/1 'SF Mono',ui-monospace,monospace;color:var(--ink);box-shadow:0 0 0 1.5px var(--ink),0 3px 8px rgba(20,22,24,.28);transition:transform .18s cubic-bezier(.3,1.6,.5,1)}
.sc-pin[data-w]:hover::after{content:attr(data-w);position:absolute;left:50%;bottom:calc(100% + 9px);transform:translateX(-50%);background:var(--ink);color:#fff;font:650 11.5px/1 -apple-system,system-ui,sans-serif;padding:6px 8px;border-radius:7px;white-space:nowrap;pointer-events:none}
.sc-spot{position:absolute;pointer-events:none;border-radius:16px;box-shadow:0 0 0 4000px rgba(28,30,33,.34),inset 0 0 0 2.5px var(--lime);transition:left .35s ease,top .35s ease,width .35s ease,height .35s ease;animation:scfade .3s ease}
.sc-ripple{position:absolute;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:3px solid var(--lime);animation:scrip .6s ease-out forwards}
.sc-ripple.bad{border-color:#e2542b}
@keyframes scrip{to{transform:scale(4.5);opacity:0}}
.sc-thumb{height:150px;margin:-4px -4px 12px;border-radius:12px;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 1px var(--line)}
.sc-thumb svg{width:100%;height:100%;display:block}
.sc-x{margin-left:auto;border:0;background:#fff;border-radius:9px;width:30px;height:30px;cursor:pointer;color:var(--muted)}
.sc-pin:hover,.sc-pin.on{transform:translate(-50%,-50%) scale(1.45);z-index:3}
.sc-pin.on{background:var(--ink);color:var(--lime)}
.sc-pin.saved::after{content:'';position:absolute;right:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:var(--ink);border:1.5px solid #fff}
.sc-pin.num{width:22px;height:22px;background:#fff}
.sc-dot{position:absolute;pointer-events:none;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;background:var(--ink);box-shadow:0 0 0 2px #fff}
.sc-lead{position:absolute;pointer-events:none;width:1.5px;height:18px;margin-left:-.75px;background:var(--ink)}
.sc-pin.num.ok{background:var(--lime)}
.sc-pin.drop{transform:translate(-50%,-50%) scale(1.35);background:var(--lime)}
.sc-pin.pulse{width:24px;height:24px;animation:scpulse 1.2s ease infinite;background:var(--ink);color:var(--lime)}
@keyframes scpulse{0%{box-shadow:0 0 0 0 rgba(205,246,73,.9)}100%{box-shadow:0 0 0 16px rgba(205,246,73,0)}}
.sc-tag{position:absolute;pointer-events:auto;transform:translate(0,-50%);font:800 10.5px/1 -apple-system,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);background:rgba(251,250,246,.85);border:0;padding:4px 6px;border-radius:5px;cursor:pointer}
.sc-tag:hover,.sc-tag.on{background:var(--lime)}
.sc-lbl{position:absolute;pointer-events:none;transform:translate(12px,-50%);font:650 12px/1.1 -apple-system,system-ui,sans-serif;color:var(--ink);background:#fff;padding:4px 7px;border-radius:6px;box-shadow:0 1px 4px rgba(20,22,24,.18);white-space:nowrap}
.sc-lbl.placed{background:var(--lime);box-shadow:none}
.sc-hl{position:absolute;pointer-events:none;border:2.5px solid var(--ink);border-radius:10px;background:rgba(205,246,73,.28);transition:all .25s;animation:scfade .2s ease}
.sc-hl.bad{border-color:#e2542b;background:rgba(226,84,43,.14)}
.sc-side{border-left:1px solid var(--line);background:#fff;display:flex;flex-direction:column;min-height:0}
.sc-tabs{display:grid;grid-template-columns:repeat(6,1fr);gap:2px;padding:12px 10px 0}
.sc-tab{border:0;background:transparent;border-radius:10px;padding:8px 2px;font:650 11px inherit;font-family:inherit;color:var(--muted);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}
.sc-tab i{font-style:normal;font-size:17px}
.sc-tab.on{background:#F2F1EB;color:var(--ink)}
.sc-tab.done i::after{content:' ✓';font-size:10px;color:var(--ok)}
.sc-panel{flex:1;overflow:auto;padding:16px 20px 24px}
.sc-panel h3{margin:0;font:700 20px/1.2 inherit;font-family:inherit;letter-spacing:-.01em}
.sc-hint{margin:6px 0 14px;font-size:13px;color:var(--muted);line-height:1.45}
.sc-score{display:inline-block;margin-left:8px;font:700 12px 'SF Mono',ui-monospace,monospace;color:var(--ok)}
.sc-card{border-radius:16px;background:#F7F6F1;padding:16px 16px 14px;margin-bottom:16px}
.sc-term{display:flex;align-items:center;gap:10px}
.sc-term b{font:700 26px/1.1 'Iowan Old Style','Palatino Linotype',Georgia,serif}
.sc-say{border:0;background:var(--lime);width:34px;height:34px;border-radius:50%;cursor:pointer;font-size:15px;flex:none}
.sc-sub{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
.sc-ipa{font:500 15px 'Lucida Grande','Segoe UI','Lucida Sans Unicode','Arial Unicode MS',sans-serif;color:var(--ok)}
.sc-tagm{font:700 10px/1 'SF Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:6px;background:#fff;color:var(--muted)}
.sc-def{margin:10px 0 0;font-size:15px;line-height:1.45}
.sc-ex{margin:6px 0 0;font:italic 14px/1.5 Georgia,serif;color:var(--muted)}
.sc-ex mark{background:rgba(205,246,73,.7);font-style:normal}
.sc-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.sc-btn{border:0;border-radius:11px;padding:9px 12px;font:650 13px inherit;font-family:inherit;cursor:pointer;min-height:40px}
.sc-btn.lime{background:var(--lime);color:var(--ink)}
.sc-btn.dark{background:var(--ink);color:#fff}
.sc-btn.ghost{background:#F2F1EB;color:var(--ink)}
.sc-btn:disabled{opacity:.5;cursor:default}
.sc-group{margin:14px 0 6px;font:800 10px/1 'SF Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.sc-words{display:flex;flex-wrap:wrap;gap:6px}
.sc-w{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 10px;font:600 12.5px inherit;font-family:inherit;color:var(--ink);cursor:pointer}
.sc-w .lv{font:700 9px 'SF Mono',ui-monospace,monospace;color:var(--muted);margin-left:5px}
.sc-w.on{background:var(--ink);color:#fff}
.sc-w.saved{box-shadow:inset 0 -3px 0 var(--lime)}
.sc-w.used{opacity:.3;cursor:default}
.sc-w.sel{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.sc-w.bad{animation:scshake .3s}
@keyframes scshake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.sc-q{font:700 24px/1.25 'Iowan Old Style',Georgia,serif;margin:4px 0 12px;display:flex;align-items:center;gap:10px}
.sc-fb{min-height:22px;font-size:14px;margin-top:10px}
.sc-fb.ok{color:var(--ok);font-weight:650}
.sc-fb.bad{color:#b0461f}
.sc-input{width:100%;font:600 18px inherit;font-family:inherit;border:0;border-bottom:2px solid rgba(36,40,44,.35);background:#FBFAF6;padding:8px 10px;border-radius:6px 6px 0 0;outline:none;box-sizing:border-box}
.sc-input:focus{border-bottom-color:var(--ink)}
.sc-input.ok{border-bottom-color:#7da312;background:#EEF8D2}
.sc-input.bad{border-bottom-color:#e2542b;background:#FDECE6}
.sc-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.sc-tf{display:grid;gap:8px;counter-reset:tf}
.sc-tf li{list-style:none;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.sc-tf p{margin:0 0 8px;font:16px/1.45 Georgia,serif}
.sc-tf .sc-row{margin-top:0}
.sc-tf .sc-btn{min-height:32px;padding:6px 12px}
.sc-tf li.ok{background:#EEF8D2;border-color:#9bc21a}
.sc-tf li.bad{background:#FDECE6;border-color:#f0a58c}
.sc-tf .why{font-size:12.5px;color:var(--muted)}
.sc-frames{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.sc-frames button{border:1px dashed rgba(36,40,44,.3);background:#fff;border-radius:999px;padding:6px 10px;font:600 12px inherit;font-family:inherit;cursor:pointer}
.sc-prompts{display:grid;gap:6px;margin:6px 0 10px}
.sc-prompts button{text-align:left;border:1px solid var(--line);background:#fff;border-radius:12px;padding:10px 12px;font:15px/1.4 Georgia,serif;color:var(--ink);cursor:pointer}
.sc-prompts button.on{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink);background:#F7F6F1}
.sc-note{width:100%;min-height:130px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font:15px/1.5 inherit;font-family:inherit;resize:vertical;box-sizing:border-box}
.sc-muted{font-size:13px;color:var(--muted)}
.sc-loading{display:grid;place-items:center;height:100%;color:var(--muted);font-size:14px}
/* canvas preview */
.sc-prev{--ink:#24282C;--lime:#CDF649;--paper:#FBFAF6;position:relative;height:100%;border-radius:14px;overflow:hidden;background:linear-gradient(#DCEAF3,#F7F4EC);font-family:-apple-system,system-ui,sans-serif;color:#24282C}
.sc-prev svg{position:absolute;left:0;right:0;bottom:0;width:100%;height:74%}
.sc-prev-in{position:absolute;left:18px;top:18px;right:18px;padding:18px 22px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;background:rgba(255,254,250,.9);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:14px;box-shadow:0 6px 24px rgba(20,22,24,.12)}
.sc-kick{font:700 11px/1 'SF Mono',ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;display:flex;gap:8px;align-items:center}
.sc-kick span:first-child{background:#CDF649;padding:6px 9px;border-radius:6px}
.sc-kick span{color:#6B6E60}
.sc-prev h2{margin:10px 0 0;font:700 34px/1.05 'Iowan Old Style','Palatino Linotype',Georgia,serif;letter-spacing:-.02em}
.sc-prev p{margin:8px 0 0;font:16px/1.45 Georgia,serif;color:#6B6E60;max-width:520px}
.sc-prev .sc-btn{flex:none;margin-top:4px}
`;
  function css() {
    if (document.getElementById('sc-css')) return;
    const st = document.createElement('style');
    st.id = 'sc-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ── voice ── */
  let voice = null;
  function pickVoice() {
    if (!window.speechSynthesis) return null;
    const vs = speechSynthesis.getVoices();
    return vs.find(v => /en-GB/i.test(v.lang) && /Daniel|Serena|Kate|Google UK/i.test(v.name)) || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
  }
  function say(text) {
    if (!window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      voice = voice || pickVoice();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : 'en-GB';
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); };

  /* ── canvas card ── */
  function preview(el, out, onOpen) {
    css();
    const lvl = out.level || 'A2';
    el.innerHTML = `<div class="sc-prev"><div class="sc-loading">Drawing…</div></div>`;
    const box = el.firstElementChild;
    load(out.scene || 'house').then(sc => {
      const n = sc.parts.filter(p => rank(p.level) <= rank(lvl)).length + sc.rooms.filter(r => rank(r.level) <= rank(lvl)).length;
      box.innerHTML = `<svg viewBox="${viewBox(sc)}" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${stillArt(sc)}</svg>
        <div class="sc-prev-in"><div><div class="sc-kick"><span>${esc(sc.kicker || 'Picture Studio')}</span><span>${esc(lvl)} level · ${n} words · 6 tasks</span></div>
          <h2>${esc(out.title || sc.title)}</h2><p>${esc(sc.dek || '')}</p></div>
          <button type="button" class="sc-btn lime sc-open">Open the Picture Studio →</button></div>`;
      box.querySelector('.sc-open').addEventListener('click', ev => { ev.stopPropagation(); onOpen && onOpen(); });
    }).catch(() => { box.innerHTML = '<div class="sc-loading">The picture could not be loaded.</div>'; });
  }

  /* ── the studio ── */
  function mount(el, opts) {
    css();
    const out = opts.out || {};
    const st = Object.assign({ tab: 'explore', level: out.level || 'A2', room: 'all', labels: false, sel: null, saved: [],
      find: null, name: null, label: null, tf: {}, prompt: 0, note: '' }, opts.state || {});
    const save = () => { try { opts.save && opts.save(JSON.parse(JSON.stringify(st))); } catch (e) {} };
    let sc = null, dead = false;
    let vb = null, vbAnim = 0;
    const cleanup = [];

    el.innerHTML = `<div class="sc"><div class="sc-main"><div class="sc-bar"></div><div class="sc-stage"><div class="sc-loading">Drawing the picture…</div></div></div>
      <aside class="sc-side"><div class="sc-tabs" role="tablist">
        ${[['explore', '🔍', 'Explore'], ['find', '🎯', 'Find'], ['name', '✏️', 'Name'], ['label', '🏷️', 'Label'], ['tf', '⚖️', 'True?'], ['talk', '💬', 'Talk']].map(([k, i, l]) => `<button type="button" role="tab" class="sc-tab" data-tab="${k}"><i>${i}</i>${l}</button>`).join('')}
      </div><div class="sc-panel"></div></aside></div>`;
    const bar = el.querySelector('.sc-bar');
    const stage = el.querySelector('.sc-stage');
    const panel = el.querySelector('.sc-panel');

    load(out.scene || 'house').then(data => {
      if (dead) return;
      sc = data;
      build();
    }).catch(() => { stage.innerHTML = '<div class="sc-loading">The picture could not be loaded. Check your connection and open it again.</div>'; });

    /* what is on the picture at this level */
    const items = () => sc.parts.filter(p => rank(p.level) <= rank(st.level));
    const rooms = () => sc.rooms.filter(r => rank(r.level) <= rank(st.level));
    const all = () => items().concat(rooms());
    const byId = id => sc.parts.find(p => p.id === id) || sc.rooms.find(r => r.id === id);
    const isRoom = it => !!it.label;
    const at = it => isRoom(it) ? it.label : it.pin;

    let svg, layer, hl;
    function build() {
      const animate = !drawnOnce.has(sc.id);
      drawnOnce.add(sc.id);
      stage.innerHTML = `<svg viewBox="${viewBox(sc)}" preserveAspectRatio="xMidYMid meet">${artSvg(sc, animate)}</svg><div class="sc-layer"></div>`;
      svg = stage.querySelector('svg');
      layer = stage.querySelector('.sc-layer');
      vb = home(sc);
      if (st.room !== 'all') { const r = areas(sc).find(x => x.id === st.room); if (r) vb = fitBox(r.box); }
      applyVb();
      paintBar();
      paint();
      if (window.ResizeObserver) { const ro = new ResizeObserver(() => placeLayer()); ro.observe(stage); cleanup.push(() => ro.disconnect()); }
      bindStage();
    }

    /* ── view box: zoom to a room, wheel, drag ── */
    function fitBox(b) {
      const pad = 40;
      let x = b[0] - pad, y = b[1] - pad, w = b[2] + pad * 2, h = b[3] + pad * 2;
      const r = stage.clientWidth / Math.max(1, stage.clientHeight);
      if (w / h < r) { const nw = h * r; x -= (nw - w) / 2; w = nw; } else { const nh = w / r; y -= (nh - h) / 2; h = nh; }
      return { x, y, w, h };
    }
    function applyVb() {
      svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
      placeLayer();
    }
    function animateTo(target) {
      cancelAnimationFrame(vbAnim);
      const from = Object.assign({}, vb), t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / 380), e = 1 - Math.pow(1 - k, 3);
        vb = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
        applyVb();
        if (k < 1) vbAnim = requestAnimationFrame(step);
      };
      vbAnim = requestAnimationFrame(step);
    }
    function geom() {
      const W = stage.clientWidth, H = stage.clientHeight;
      const s = Math.min(W / vb.w, H / vb.h);
      return { s, ox: (W - vb.w * s) / 2, oy: (H - vb.h * s) / 2 };
    }
    const toPx = (x, y) => { const g = geom(); return [g.ox + (x - vb.x) * g.s, g.oy + (y - vb.y) * g.s]; };
    const toScene = (px, py) => { const g = geom(); return [vb.x + (px - g.ox) / g.s, vb.y + (py - g.oy) / g.s]; };
    function zoomBy(f, cx, cy) {
      const g = geom();
      cx = cx == null ? stage.clientWidth / 2 : cx; cy = cy == null ? stage.clientHeight / 2 : cy;
      const [sx, sy] = toScene(cx, cy);
      const w = Math.min(sc.w * 1.1, Math.max(sc.w / 6, vb.w / f)), h = w * vb.h / vb.w;
      vb = { x: sx - (cx - g.ox) / (stage.clientWidth - 2 * g.ox) * w, y: sy - (cy - g.oy) / (stage.clientHeight - 2 * g.oy) * h, w, h };
      applyVb();
    }
    function bindStage() {
      let down = null;
      stage.addEventListener('pointerdown', e => {
        if (e.target.closest('.sc-pin,.sc-tag')) return;
        down = { x: e.clientX, y: e.clientY, vb: Object.assign({}, vb), moved: false };
        stage.setPointerCapture(e.pointerId);
      });
      stage.addEventListener('pointermove', e => {
        if (!down) return;
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) < 5) return;
        down.moved = true;
        stage.classList.add('drag');
        const g = geom();
        vb = Object.assign({}, down.vb, { x: down.vb.x - dx / g.s, y: down.vb.y - dy / g.s });
        applyVb();
      });
      stage.addEventListener('pointerup', e => {
        stage.classList.remove('drag');
        if (!down) return;
        const moved = down.moved;
        down = null;
        if (moved) return;
        const r = stage.getBoundingClientRect();
        const [x, y] = toScene(e.clientX - r.left, e.clientY - r.top);
        onStageClick(x, y);
      });
      stage.addEventListener('wheel', e => {
        e.preventDefault(); e.stopPropagation();
        const r = stage.getBoundingClientRect();
        zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
    }
    /* the smallest thing on the picture under a point */
    function hit(x, y, pool) {
      let best = null, area = Infinity;
      (pool || all()).forEach(it => {
        const [bx, by, bw, bh] = it.box;
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh && bw * bh < area) { best = it; area = bw * bh; }
      });
      return best;
    }

    /* ── top bar ── */
    function paintBar() {
      bar.innerHTML = `<div class="sc-rooms"><button type="button" class="sc-chip${st.room === 'all' ? ' on' : ''}" data-room="all">Whole picture</button>
        ${areas(sc).map(r => { const t = r.chip || r.word; return `<button type="button" class="sc-chip${st.room === r.id ? ' on' : ''}" data-room="${r.id}">${esc(t[0].toUpperCase() + t.slice(1))}</button>`; }).join('')}</div>
        <div class="sc-tools">
          <span class="sc-seg" title="Which words are on the picture">${LEVELS.map(l => `<button type="button" data-level="${l}" class="${st.level === l ? 'on' : ''}">${l}</button>`).join('')}</span>
          <button type="button" class="sc-ib${st.labels ? ' on' : ''}" data-act="labels" title="Show the words on the picture">Aa</button>
          <button type="button" class="sc-ib" data-act="zin" title="Zoom in">＋</button>
          <button type="button" class="sc-ib" data-act="zout" title="Zoom out">－</button>
          <button type="button" class="sc-ib" data-act="print" title="Print a worksheet with an answer key">🖨</button>
        </div>`;
    }
    bar.addEventListener('click', e => {
      const room = e.target.closest('[data-room]');
      if (room) {
        st.room = room.dataset.room; save();
        const r = areas(sc).find(x => x.id === st.room);
        animateTo(r ? fitBox(r.box) : home(sc));
        bar.querySelectorAll('[data-room]').forEach(b => b.classList.toggle('on', b === room));
        return;
      }
      const lv = e.target.closest('[data-level]');
      if (lv) { st.level = lv.dataset.level; st.find = st.name = st.label = null; save(); paintBar(); paint(); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'labels') { st.labels = !st.labels; save(); paintBar(); placeLayer(); }
      if (act === 'zin') zoomBy(1.35);
      if (act === 'zout') zoomBy(1 / 1.35);
      if (act === 'print') printSheet();
    });

    /* ── pins and room tags over the picture ── */
    function placeLayer() {
      if (!layer || !sc) return;
      const mode = st.tab;
      let html = '';
      const pinned = mode === 'explore' || mode === 'tf' || mode === 'talk';
      const spotIt = mode === 'explore' && st.sel ? byId(st.sel) : null;
      if (spotIt && !isRoom(spotIt)) {
        const g = geom(), pad = 10, [bx, by, bw, bh] = spotIt.box;
        const [x, y] = toPx(bx, by);
        html += `<span class="sc-spot" style="left:${x - pad}px;top:${y - pad}px;width:${bw * g.s + pad * 2}px;height:${bh * g.s + pad * 2}px"></span>`;
      }
      if (pinned) {
        rooms().forEach(r => { const [x, y] = toPx(...r.label); html += `<button type="button" class="sc-tag${st.sel === r.id ? ' on' : ''}" data-id="${r.id}" style="left:${x}px;top:${y}px">${esc(r.word)}</button>`; });
        items().forEach(p => {
          const [x, y] = toPx(...p.pin);
          html += `<button type="button" class="sc-pin${st.sel === p.id ? ' on' : ''}${st.saved.includes(p.word) ? ' saved' : ''}" data-id="${p.id}"${st.labels || st.sel === p.id ? '' : ` data-w="${esc(p.word)}"`} style="left:${x}px;top:${y}px" aria-label="${esc(p.word)}"></button>`;
          if (st.labels || st.sel === p.id) html += `<span class="sc-lbl" style="left:${x}px;top:${y}px">${esc(p.word)}</span>`;
        });
      }
      if (mode === 'name' && st.name) {
        const it = byId(st.name.order[st.name.round]);
        if (it) { const [x, y] = toPx(...at(it)); html += `<span class="sc-pin pulse" style="left:${x}px;top:${y}px">?</span>`; }
        (st.name.got || []).forEach(id => { const g = byId(id); if (g && g !== it) { const [x, y] = toPx(...at(g)); html += `<span class="sc-lbl placed" style="left:${x - 14}px;top:${y}px;transform:translate(-50%,-50%)">${esc(g.word)}</span>`; } });
      }
      if (mode === 'label' && st.label) {
        st.label.set.forEach((id, i) => {
          const it = byId(id); if (!it) return;
          const [x, y] = toPx(...at(it));
          const ok = st.label.placed.includes(id);
          // the number sits beside the thing, joined to a dot on it, so it hides nothing
          html += `<span class="sc-dot" style="left:${x}px;top:${y}px"></span><span class="sc-lead" style="left:${x}px;top:${y - 18}px"></span>`;
          html += `<button type="button" class="sc-pin num${ok ? ' ok' : ''}" data-slot="${id}" style="left:${x}px;top:${y - 26}px">${i + 1}</button>`;
          if (ok) html += `<span class="sc-lbl placed" style="left:${x + 4}px;top:${y - 26}px">${esc(it.word)}</span>`;
        });
      }
      if (flash) {
        const [x, y] = toPx(flash.box[0], flash.box[1]);
        const g = geom();
        html += `<span class="sc-hl${flash.bad ? ' bad' : ''}" style="left:${x}px;top:${y}px;width:${flash.box[2] * g.s}px;height:${flash.box[3] * g.s}px"></span>`;
      }
      layer.innerHTML = html;
      stage.classList.toggle('aim', mode === 'find');
    }
    let flash = null, flashT = 0;
    function flashBox(box, bad, ms) {
      flash = { box, bad };
      placeLayer();
      clearTimeout(flashT);
      if (ms) flashT = setTimeout(() => { flash = null; placeLayer(); }, ms);
    }
    stage.addEventListener('click', e => {
      const pin = e.target.closest('.sc-pin[data-id],.sc-tag');
      if (pin) { e.stopPropagation(); select(pin.dataset.id, true); return; }
      const slot = e.target.closest('[data-slot]');
      if (slot) { e.stopPropagation(); labelDrop(slot.dataset.slot); }
    });
    stage.addEventListener('dragover', e => { const s = e.target.closest('[data-slot]'); if (s) { e.preventDefault(); s.classList.add('drop'); } });
    stage.addEventListener('dragleave', e => { const s = e.target.closest('[data-slot]'); if (s) s.classList.remove('drop'); });
    stage.addEventListener('drop', e => {
      const s = e.target.closest('[data-slot]');
      if (!s) return;
      e.preventDefault();
      labelPick = e.dataTransfer.getData('text/plain') || labelPick;
      labelDrop(s.dataset.slot);
    });

    function onStageClick(x, y) {
      if (st.tab === 'find') return findClick(x, y);
      if (st.tab === 'explore') { const it = hit(x, y, items()); if (it) select(it.id, false); else if (st.sel) { st.sel = null; save(); paint(); } }
    }

    /* zoomed into an area that does not hold this thing: back to the whole picture */
    function unzoomFor(it) {
      if (st.room === 'all') return;
      const a = areas(sc).find(x => x.id === st.room);
      if (a && inside(it.box, a.box)) return;
      st.room = 'all'; paintBar(); animateTo(home(sc));
    }

    /* ── Explore ── */
    function select(id, fromPin) {
      st.sel = id; save();
      if (st.tab !== 'explore') { st.tab = 'explore'; }
      paint();
      const it = byId(id);
      if (it && !fromPin) flashBox(it.box, false, 900);
      if (it) say(it.word);
    }
    function wordCard(it) {
      const saved = st.saved.includes(it.word);
      const ex = esc(it.ex || '').replace(new RegExp(`\\b(${esc(it.word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*)`, 'i'), '<mark>$1</mark>');
      const [bx, by, bw, bh] = it.box, pad = Math.max(bw, bh) * 0.18 + 8;
      const thumb = isRoom(it) ? '' : `<div class="sc-thumb"><svg viewBox="${bx - pad} ${by - pad} ${bw + pad * 2} ${bh + pad * 2}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${stillArt(sc)}</svg></div>`;
      return `<div class="sc-card">${thumb}
        <div class="sc-term"><b>${esc(it.word)}</b><button type="button" class="sc-say" data-say="${esc(it.word)}" aria-label="Say it">🔊</button><button type="button" class="sc-x" data-act="unsel" aria-label="Close">✕</button></div>
        <div class="sc-sub"><span class="sc-ipa">/${esc(it.ipa)}/</span><span class="sc-tagm">${esc(it.pos || 'noun')}</span><span class="sc-tagm">${esc(it.level)}</span>${it.us && it.us !== it.word ? `<span class="sc-tagm">US: ${esc(it.us)}</span>` : ''}</div>
        <p class="sc-def">${esc(it.def)}</p>
        ${it.ex ? `<p class="sc-ex">${ex} <button type="button" class="sc-say" style="width:26px;height:26px;font-size:12px;vertical-align:middle;background:#fff" data-say="${esc(it.ex)}" aria-label="Say the example">🔊</button></p>` : ''}
        <div class="sc-acts">
          <button type="button" class="sc-btn ${saved ? 'ghost' : 'lime'}" data-act="vault"${saved || !opts.canSave ? ' disabled' : ''}>${saved ? '✓ In your Vault' : opts.canSave ? '+ Save to my Vault' : 'Sign in to save'}</button>
          <button type="button" class="sc-btn dark" data-act="hear"${window.TeachedHear ? '' : ' disabled'}>▶ Real videos</button>
        </div></div>`;
    }
    function paintExplore() {
      const it = st.sel ? byId(st.sel) : null;
      const groups = {};
      items().forEach(p => (groups[p.room] = groups[p.room] || []).push(p));
      const roomName = id => (sc.groups || {})[id] || (id === 'outside' ? 'Outside' : ((sc.rooms.find(r => r.id === id) || {}).word || id));
      panel.innerHTML = `<h3>${esc(out.title || sc.title)}</h3>
        <p class="sc-hint">Tap anything in the picture - or a word below - to hear it and see what it means. Pick a part at the top to zoom in.</p>
        ${it ? wordCard(it) : `<div class="sc-card"><p class="sc-def" style="margin:0"><b>${items().length + rooms().length} words</b> at ${esc(st.level)} level. ${st.saved.length ? `You have saved ${st.saved.length}.` : 'Save the new ones to your Vault to practise them later.'}</p></div>`}
        <div class="sc-group">${esc(sc.roomsTitle || 'Rooms')}</div><div class="sc-words">${rooms().map(r => `<button type="button" class="sc-w${st.sel === r.id ? ' on' : ''}${st.saved.includes(r.word) ? ' saved' : ''}" data-pick="${r.id}">${esc(r.word)}<span class="lv">${r.level}</span></button>`).join('')}</div>
        ${Object.keys(groups).map(g => `<div class="sc-group">${esc(roomName(g))}</div><div class="sc-words">${groups[g].map(p => `<button type="button" class="sc-w${st.sel === p.id ? ' on' : ''}${st.saved.includes(p.word) ? ' saved' : ''}" data-pick="${p.id}">${esc(p.word)}<span class="lv">${p.level}</span></button>`).join('')}</div>`).join('')}`;
    }

    /* ── Find it ── */
    const ROUNDS = 10;
    function newFind() { st.find = { order: shuffle(all().map(i => i.id), rseed()).slice(0, ROUNDS), round: 0, score: 0, tries: 0 }; save(); }
    function paintFind() {
      if (!st.find) newFind();
      const f = st.find;
      if (f.round >= f.order.length) {
        panel.innerHTML = `<h3>Find it <span class="sc-score">${f.score}/${f.order.length}</span></h3>
          <p class="sc-hint">${f.score === f.order.length ? 'Every one first time - brilliant!' : 'Well done. Play again for new words.'}</p>
          <button type="button" class="sc-btn dark" data-act="find-again">Play again</button>`;
        return;
      }
      const it = byId(f.order[f.round]);
      panel.innerHTML = `<h3>Find it <span class="sc-score">${f.score}/${f.order.length}</span></h3>
        <p class="sc-hint">Listen and click it in the picture. You can zoom and drag the picture.</p>
        <div class="sc-q">Where’s the ${esc(it.word)}? <button type="button" class="sc-say" data-say="${esc(it.word)}" aria-label="Say it">🔊</button></div>
        <div class="sc-fb" id="sc-fb"></div>
        <div class="sc-row"><span class="sc-muted">Word ${f.round + 1} of ${f.order.length}</span><span style="flex:1"></span><button type="button" class="sc-btn ghost" data-act="find-skip">Show me</button></div>`;
    }
    function ripple(x, y, bad) {
      const [px, py] = toPx(x, y);
      const r = document.createElement('span');
      r.className = 'sc-ripple' + (bad ? ' bad' : '');
      r.style.left = px + 'px'; r.style.top = py + 'px';
      stage.appendChild(r);
      setTimeout(() => r.remove(), 650);
    }
    function findClick(x, y) {
      const f = st.find;
      if (!f || f.round >= f.order.length || f.lock) return;
      const target = byId(f.order[f.round]);
      const [bx, by, bw, bh] = target.box;
      ripple(x, y, !(x >= bx && x <= bx + bw && y >= by && y <= by + bh));
      const fb = panel.querySelector('#sc-fb');
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        if (!f.tries) f.score++;
        flashBox(target.box, false);
        fb.className = 'sc-fb ok'; fb.textContent = f.tries ? `Yes - that's the ${target.word}.` : `Yes! The ${target.word}.`;
        say(target.word);
        f.lock = true;
        setTimeout(() => { f.lock = false; f.round++; f.tries = 0; flash = null; save(); paint(); }, 1100);
        return;
      }
      f.tries++;
      const other = hit(x, y);
      fb.className = 'sc-fb bad';
      fb.textContent = other ? `No, that's the ${other.word}. Try again!` : 'Not there - try again!';
      if (other) flashBox(other.box, true, 900);
      if (f.tries >= 3) { fb.textContent = `Here it is - the ${target.word}.`; flashBox(target.box, false); f.lock = true; setTimeout(() => { f.lock = false; f.round++; f.tries = 0; flash = null; save(); paint(); }, 1600); }
      save(); paintTabs();
    }

    /* ── Name it ── */
    function newName() { st.name = { order: shuffle(all().map(i => i.id), rseed()).slice(0, ROUNDS), round: 0, score: 0, hint: 0, got: [], tried: false }; save(); }
    function paintName() {
      if (!st.name) newName();
      const n = st.name;
      if (n.round >= n.order.length) {
        panel.innerHTML = `<h3>Name it <span class="sc-score">${n.score}/${n.order.length}</span></h3>
          <p class="sc-hint">${n.score >= n.order.length - 1 ? 'Excellent spelling!' : 'Good work. The words you missed will come round again.'}</p>
          <button type="button" class="sc-btn dark" data-act="name-again">Play again</button>`;
        return;
      }
      const it = byId(n.order[n.round]);
      const hint = n.hint ? it.word.split('').map((c, i) => i < n.hint || c === ' ' ? c : '·').join('') : '';
      panel.innerHTML = `<h3>Name it <span class="sc-score">${n.score}/${n.order.length}</span></h3>
        <p class="sc-hint">What is the thing with the <b>?</b> in the picture? Type the word.</p>
        <input class="sc-input" id="sc-name" autocomplete="off" spellcheck="false" placeholder="${hint ? esc(hint) : 'Type the word…'}" aria-label="The word">
        <div class="sc-fb" id="sc-fb"></div>
        <div class="sc-row"><button type="button" class="sc-btn dark" data-act="name-check">Check</button><button type="button" class="sc-btn ghost" data-act="name-hint">Hint</button><span style="flex:1"></span><button type="button" class="sc-btn ghost" data-act="name-skip">Skip</button></div>
        <p class="sc-muted" style="margin-top:14px">Word ${n.round + 1} of ${n.order.length}${n.hint ? ' · with a hint, it counts half' : ''}</p>`;
      unzoomFor(it);
      setTimeout(() => panel.querySelector('#sc-name')?.focus(), 30);
    }
    function nameCheck() {
      const n = st.name;
      const it = byId(n.order[n.round]);
      const inp = panel.querySelector('#sc-name');
      const fb = panel.querySelector('#sc-fb');
      const val = norm(inp.value);
      const okWords = [it.word, it.us].filter(Boolean).map(norm);
      if (okWords.includes(val) || (it.word.endsWith('s') && norm(it.word).slice(0, -1) === val)) {
        n.score += n.hint ? 0.5 : 1; n.got.push(it.id);
        inp.className = 'sc-input ok'; fb.className = 'sc-fb ok'; fb.textContent = `Yes - ${it.word}!`;
        say(it.word);
        setTimeout(() => { n.round++; n.hint = 0; n.tried = false; save(); paint(); }, 900);
      } else {
        inp.className = 'sc-input bad'; fb.className = 'sc-fb bad';
        fb.textContent = n.tried ? `It's “${it.word}”.` : 'Not quite - try again, or take a hint.';
        if (n.tried) { inp.value = it.word; setTimeout(() => { n.round++; n.hint = 0; n.tried = false; save(); paint(); }, 1400); }
        n.tried = true;
      }
      save();
    }

    /* ── Label it ── */
    let labelPick = null;
    function newLabel() {
      const pool = shuffle(items().map(p => p.id), rseed());
      // spread the pins out: skip ones that sit too close to a chosen one
      const set = [];
      pool.forEach(id => {
        if (set.length >= 12) return;
        const p = byId(id);
        if (set.every(o => { const q = byId(o); return Math.hypot(q.pin[0] - p.pin[0], q.pin[1] - p.pin[1]) > 70; })) set.push(id);
      });
      st.label = { set, placed: [], misses: 0 };
      save();
    }
    function paintLabel() {
      if (!st.label) newLabel();
      const L = st.label;
      const bank = shuffle(L.set, 17);
      const done = L.placed.length === L.set.length;
      panel.innerHTML = `<h3>Label it <span class="sc-score">${L.placed.length}/${L.set.length}</span></h3>
        <p class="sc-hint">Drag each word to its number in the picture - or tap a word, then tap the number.</p>
        <div class="sc-words">${bank.map(id => { const it = byId(id); const used = L.placed.includes(id); return `<button type="button" class="sc-w${used ? ' used' : ''}${labelPick === id ? ' sel' : ''}" data-lbl="${id}" draggable="${used ? 'false' : 'true'}"${used ? ' disabled' : ''}>${esc(it.word)}</button>`; }).join('')}</div>
        <div class="sc-fb${done ? ' ok' : ''}" id="sc-fb">${done ? `All labelled${L.misses ? ` with ${L.misses} mistake${L.misses > 1 ? 's' : ''}` : ' - no mistakes!'}` : ''}</div>
        <div class="sc-row"><button type="button" class="sc-btn ${done ? 'dark' : 'ghost'}" data-act="label-new">New set of words</button></div>`;
      panel.querySelectorAll('[draggable="true"]').forEach(b => b.addEventListener('dragstart', e => { labelPick = b.dataset.lbl; e.dataTransfer.setData('text/plain', b.dataset.lbl); }));
    }
    function labelDrop(slotId) {
      const L = st.label;
      if (!L || !labelPick || L.placed.includes(slotId)) return;
      const fb = panel.querySelector('#sc-fb');
      if (labelPick === slotId) {
        L.placed.push(slotId);
        say(byId(slotId).word);
        labelPick = null;
        save(); paintLabel(); placeLayer(); paintTabs();
      } else {
        L.misses++;
        const chip = panel.querySelector(`[data-lbl="${labelPick}"]`);
        if (chip) { chip.classList.remove('bad'); void chip.offsetWidth; chip.classList.add('bad'); }
        if (fb) { fb.className = 'sc-fb bad'; fb.textContent = `Not number ${L.set.indexOf(slotId) + 1} - look again.`; }
        save();
      }
    }

    /* ── True or false ── */
    const tfList = () => (sc.truefalse || []).map((q, i) => Object.assign({ i }, q)).filter(q => rank(q.level) <= rank(st.level));
    function paintTf() {
      const list = tfList();
      const answered = list.filter(q => st.tf[q.i] != null);
      const right = answered.filter(q => st.tf[q.i] === q.a).length;
      panel.innerHTML = `<h3>True or false? ${answered.length ? `<span class="sc-score">${right}/${list.length}</span>` : ''}</h3>
        <p class="sc-hint">Look at the picture. Is it true? If it's false, say what is true: <i>“No, the bike is in the garage.”</i></p>
        <ol class="sc-tf">${list.map(q => {
          const a = st.tf[q.i];
          const cls = a == null ? '' : a === q.a ? ' ok' : ' bad';
          return `<li class="${cls.trim()}"><p>${esc(q.s)}</p><div class="sc-row">${a == null
            ? `<button type="button" class="sc-btn ghost" data-tf="${q.i}" data-v="1">True</button><button type="button" class="sc-btn ghost" data-tf="${q.i}" data-v="0">False</button><button type="button" class="sc-btn ghost" data-say="${esc(q.s)}" aria-label="Listen">🔊</button>`
            : `<span class="why">${a === q.a ? '✓ Right' : '✗ Not quite'} - it's ${q.a ? 'true' : 'false'}.${q.a ? '' : ' Correct it out loud!'}</span>`}</div></li>`;
        }).join('')}</ol>
        ${answered.length ? '<div class="sc-row"><button type="button" class="sc-btn ghost" data-act="tf-reset">Start again</button></div>' : ''}`;
    }

    /* ── Talk & write ── */
    let rec = null, recUrl = null;
    function paintTalk() {
      const prompts = (sc.prompts || {})[st.level] || [];
      panel.innerHTML = `<h3>Talk &amp; Write</h3>
        <p class="sc-hint">Choose a question. Talk about it with a partner, then write your answer. Use words from the picture.</p>
        <div class="sc-prompts">${prompts.map((p, i) => `<button type="button" class="${st.prompt === i ? 'on' : ''}" data-prompt="${i}">${esc(p)}</button>`).join('')}</div>
        <div class="sc-group">Sentence starters</div>
        <div class="sc-frames">${(sc.frames || []).map(f => `<button type="button" data-frame="${esc(f)}">${esc(f)}</button>`).join('')}</div>
        <textarea class="sc-note" id="sc-note" placeholder="Write here…">${esc(st.note)}</textarea>
        <div class="sc-row"><button type="button" class="sc-btn lime" data-act="rec">● Record my answer</button><span class="sc-muted" id="sc-rec-note" style="align-self:center"></span></div>
        <p class="sc-muted" style="margin-top:10px">${st.note.trim() ? `${st.note.trim().split(/\s+/).length} words · ${items().filter(p => new RegExp(`\\b${p.word}`, 'i').test(st.note)).length} picture words used` : ''}</p>`;
    }

    /* ── tabs ── */
    const done = {
      explore: () => st.saved.length >= 3,
      find: () => !!st.find && st.find.round >= st.find.order.length,
      name: () => !!st.name && st.name.round >= st.name.order.length,
      label: () => !!st.label && st.label.set.length > 0 && st.label.placed.length === st.label.set.length,
      tf: () => tfList().length > 0 && tfList().every(q => st.tf[q.i] != null),
      talk: () => st.note.trim().split(/\s+/).length >= 25,
    };
    function paintTabs() {
      el.querySelectorAll('.sc-tab').forEach(t => { t.classList.toggle('on', t.dataset.tab === st.tab); t.classList.toggle('done', !!(sc && done[t.dataset.tab]())); t.setAttribute('aria-selected', t.dataset.tab === st.tab); });
    }
    function paint() {
      if (!sc) return;
      flash = null;
      ({ explore: paintExplore, find: paintFind, name: paintName, label: paintLabel, tf: paintTf, talk: paintTalk }[st.tab] || paintExplore)();
      paintTabs();
      placeLayer();
    }
    el.querySelector('.sc-tabs').addEventListener('click', e => {
      const t = e.target.closest('[data-tab]');
      if (!t || !sc) return;
      st.tab = t.dataset.tab; save(); paint();
    });

    panel.addEventListener('click', async e => {
      const t = e.target;
      const s = t.closest('[data-say]');
      if (s) { say(s.dataset.say); return; }
      const pick = t.closest('[data-pick]');
      if (pick) {
        const it = byId(pick.dataset.pick);
        st.sel = it.id; save(); paint();
        unzoomFor(it);
        flashBox(it.box, false, 1000);
        say(it.word);
        return;
      }
      const lbl = t.closest('[data-lbl]');
      if (lbl && !lbl.disabled) { labelPick = labelPick === lbl.dataset.lbl ? null : lbl.dataset.lbl; panel.querySelectorAll('[data-lbl]').forEach(b => b.classList.toggle('sel', b.dataset.lbl === labelPick)); return; }
      const tf = t.closest('[data-tf]');
      if (tf) { st.tf[tf.dataset.tf] = tf.dataset.v === '1'; save(); paintTf(); paintTabs(); return; }
      const pr = t.closest('[data-prompt]');
      if (pr) { st.prompt = Number(pr.dataset.prompt); save(); panel.querySelectorAll('[data-prompt]').forEach(b => b.classList.toggle('on', b === pr)); return; }
      const fr = t.closest('[data-frame]');
      if (fr) {
        const ta = panel.querySelector('#sc-note');
        const ins = fr.dataset.frame.split('…')[0].trim() + ' ';
        const a = ta.selectionStart || ta.value.length;
        ta.value = ta.value.slice(0, a) + (a && !/\s$/.test(ta.value.slice(0, a)) ? ' ' : '') + ins + ta.value.slice(a);
        st.note = ta.value; save(); ta.focus();
        return;
      }
      const act = t.closest('[data-act]')?.dataset.act;
      if (!act) return;
      const it = st.sel ? byId(st.sel) : null;
      if (act === 'hear' && it && window.TeachedHear) window.TeachedHear.open(it.word);
      if (act === 'vault' && it) {
        const b = t.closest('[data-act]');
        b.disabled = true; b.textContent = 'Saving…';
        try {
          const res = await opts.api('/api/vault/save', { method: 'POST', body: { text: it.word, meaning: it.def, example: it.ex || '', boardId: opts.boardId, sourceTitle: out.title || sc.title } });
          if (!res.ok) throw new Error();
          opts.onSaved && opts.onSaved({ kind: 'word', word: it.word, translation: it.def, example: it.ex || '', source_title: out.title || sc.title });
          st.saved.push(it.word); save(); paint();
        } catch (err) { b.disabled = false; b.textContent = 'Could not save - try again'; }
      }
      if (act === 'unsel') { st.sel = null; save(); paint(); }
      if (act === 'find-again') { newFind(); paint(); }
      if (act === 'find-skip') {
        const f = st.find, target = byId(f.order[f.round]);
        f.tries = 3; flashBox(target.box, false); say(target.word);
        f.lock = true;
        setTimeout(() => { f.lock = false; f.round++; f.tries = 0; flash = null; save(); paint(); }, 1400);
      }
      if (act === 'name-check') nameCheck();
      if (act === 'name-hint') { const n = st.name; const w = byId(n.order[n.round]).word; n.hint = Math.min(w.length - 1, (n.hint || 0) + 1); save(); const inp = panel.querySelector('#sc-name'); inp.placeholder = w.split('').map((c, i) => i < n.hint || c === ' ' ? c : '·').join(''); inp.focus(); }
      if (act === 'name-skip') { const n = st.name; n.round++; n.hint = 0; n.tried = false; save(); paint(); }
      if (act === 'name-again') { newName(); paint(); }
      if (act === 'label-new') { newLabel(); labelPick = null; paint(); }
      if (act === 'tf-reset') { st.tf = {}; save(); paintTf(); paintTabs(); }
      if (act === 'rec') {
        const btn = t.closest('[data-act]'), note = panel.querySelector('#sc-rec-note');
        if (rec && rec.state === 'recording') { rec.stop(); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const chunks = [];
          rec = new MediaRecorder(stream);
          rec.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
          rec.onstop = () => {
            stream.getTracks().forEach(tr => tr.stop());
            if (recUrl) URL.revokeObjectURL(recUrl);
            recUrl = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
            btn.textContent = '● Record again';
            note.innerHTML = '<a href="#" data-act="play-rec">▶ Play it back</a>';
          };
          rec.start();
          btn.textContent = '■ Stop';
          note.textContent = 'Recording…';
        } catch (err) { note.textContent = 'Microphone access was not allowed.'; }
      }
      if (act === 'play-rec') { e.preventDefault(); recUrl && new Audio(recUrl).play(); }
    });
    panel.addEventListener('input', e => {
      if (e.target.id === 'sc-note') { st.note = e.target.value; clearTimeout(panel._t); panel._t = setTimeout(() => { save(); paintTabs(); }, 500); }
    });
    panel.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter' && e.target.id === 'sc-name') nameCheck();
    });
    el.addEventListener('mousedown', e => e.stopPropagation());
    el.addEventListener('wheel', e => e.stopPropagation(), { passive: true });

    /* ── printable worksheet + answer key ── */
    function printSheet() {
      const list = items().slice().sort((a, b) => (a.pin[1] - b.pin[1]) || (a.pin[0] - b.pin[0]));
      const pins = list.map((p, i) => `<g><circle cx="${p.pin[0]}" cy="${p.pin[1]}" r="11" fill="#fff" stroke="#24282C" stroke-width="2"/><text x="${p.pin[0]}" y="${p.pin[1] + 4}" text-anchor="middle" font-size="12" font-weight="800" font-family="Helvetica,Arial">${i + 1}</text></g>`).join('');
      const art = `<svg viewBox="${viewBox(sc)}" width="100%">${stillArt(sc)}${pins}</svg>`;
      const bank = shuffle(list.map(p => p.word), 3).join(' · ');
      const title = esc(out.title || sc.title);
      const lines = list.map((p, i) => `<li><b>${i + 1}.</b> <span></span></li>`).join('');
      const key = list.map((p, i) => `<li><b>${i + 1}.</b> ${esc(p.word)}</li>`).join('');
      const tf = tfList().map(q => `<li>${esc(q.s)} <span class="tfb">T / F</span></li>`).join('');
      const tfKey = tfList().map((q, i) => `${i + 1} ${q.a ? 'T' : 'F'}`).join(' · ');
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title} - worksheet</title><style>
        @page{size:A4 landscape;margin:12mm}body{font-family:Helvetica,Arial,sans-serif;color:#24282C;margin:0}
        .pg{page-break-after:always}.pg:last-child{page-break-after:auto}
        h1{font:700 24px Georgia,serif;margin:0 0 2px}.sub{font-size:12px;color:#6B6E60;margin-bottom:8px}
        .bank{border:1.5px dashed #999;border-radius:8px;padding:6px 10px;font-size:13px;line-height:1.6;margin:6px 0}
        ol{columns:4;list-style:none;padding:0;margin:8px 0 0;font-size:13px}ol li{padding:5px 0;break-inside:avoid}
        ol li span{display:inline-block;width:70%;border-bottom:1px solid #999}.tf{columns:2}.tfb{font-weight:700;margin-left:6px}
        .key li{padding:2px 0}
      </style></head><body>
        <div class="pg"><h1>${title}</h1><div class="sub">Name ____________________ · ${esc(st.level)} · Write the words next to the numbers.</div>${art}
          <div class="bank"><b>Word bank:</b> ${bank}</div><ol>${lines}</ol></div>
        <div class="pg"><h1>${title} - true or false?</h1><div class="sub">Look at the picture. Circle T or F. Correct the false sentences.</div><ol class="tf">${tf}</ol></div>
        <div class="pg"><h1>Answer key</h1><ol class="key">${key}</ol><p style="font-size:13px"><b>True or false:</b> ${tfKey}</p></div>
        <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
      w.document.close();
    }

    return {
      destroy() {
        dead = true;
        cancelAnimationFrame(vbAnim);
        clearTimeout(flashT);
        cleanup.forEach(f => f());
        try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
        try { rec && rec.state === 'recording' && rec.stop(); } catch (e) {}
      },
    };
  }

  window.TeachedScene = { preview, mount, load, catalog: CATALOG, levels: LEVELS };
})();
