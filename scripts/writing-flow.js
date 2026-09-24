/* ═══════════════════════════════════════════════════════════════════════════
   WRITING LESSON FLOW - the pre-writing blocks as tools, not flip cards.

   A writing lesson used to land on the board as decks of "tap to reveal"
   cards: four opinions, pros and cons, phrases, a plan, criteria - each one
   text under a lid. Nothing the student did there reached the text they
   then had to write. Here every block is something the student works with,
   and every block leads to the Writing Studio (the two-column workspace in
   worksheet-play.js):

     ideas     - four-opinions, pros-cons: write your own view first, then
                 compare with the model; a good idea goes into the draft.
     phrases   - extract-vocab, link-words, collocations: a cheat sheet in
                 panels; Copy, or Insert straight into the draft.
     plan      - essay-outline: the structure as a checklist to tick off.
     criteria  - rubric-maker: success criteria to check the draft against.

   The role is stamped on the card when a writing lesson is placed
   (placeBoardLessonStageSet → out._wfRole). The board passes context in
   d._wfCtx: { next:{label}, hasStudio } so a block can hand the student on.
   Messages to the board: iw-state (answers), iw-insert (text into the
   studio's draft), iw-copy (clipboard fallback), iw-goto (next block).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const WF_ROLE_BY_TOOL = {
    'four-opinions': 'ideas', 'pros-cons': 'ideas',
    'extract-vocab': 'phrases', 'link-words': 'phrases', 'collocations': 'phrases', 'essential-vocab': 'phrases',
    'essay-outline': 'plan', 'rubric-maker': 'criteria',
    'creative-writing': 'studio', 'email-reply': 'studio',
  };

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const md = s => esc(s).replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>').replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');
  const lines = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
  const stripBullet = s => s.replace(/^(\d+[.)]|[-•*☐✓]|[a-z][.)])\s*/i, '');
  // "phrase - note" / "phrase — note" / "phrase: note"
  const pair = l => {
    const m = stripBullet(l).match(/^(.{2,60}?)\s+[-–—]\s+(.+)$/) || stripBullet(l).match(/^([^:]{2,40}):\s+(.+)$/);
    return m ? { phrase: m[1].trim(), note: m[2].trim() } : null;
  };

  /* Phrases of a card set, for the studio's "From this lesson" panel. */
  function wfPhrasesOf(d) {
    const out = [];
    (Array.isArray(d.items) ? d.items : []).forEach(it => { if (it && it.word) out.push({ phrase: String(it.word), note: String(it.definition || '') }); });
    (Array.isArray(d.cards) ? d.cards : []).forEach(c => lines(c && c.text).forEach(l => { const p = pair(l); if (p) out.push(p); }));
    return out.slice(0, 40);
  }

  function roleFor(toolId) { return WF_ROLE_BY_TOOL[String(toolId || '')] || ''; }

  /* First guess at the card size; the markup reports its real height. */
  function playSize(d) {
    const cards = Array.isArray(d.cards) ? d.cards : [];
    const items = Array.isArray(d.items) ? d.items : [];
    if (d._wfRole === 'ideas') return { w: 760, h: Math.min(1100, 170 + Math.ceil(cards.length / 2) * 250) };
    if (d._wfRole === 'phrases') return { w: 640, h: Math.min(1100, 160 + (items.length || cards.reduce((n, c) => n + lines(c.text).length, 0)) * 44) };
    return { w: 620, h: Math.min(1000, 170 + cards.reduce((n, c) => n + 60 + lines(c.text).length * 20, 0)) };
  }

  const CSS = `
*{box-sizing:border-box;margin:0}
body{background:#F6F6EF;color:#24282C;font:14.5px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;padding:16px 18px 18px}
.wf-intro{display:flex;align-items:flex-start;gap:10px;margin:0 0 14px;padding:12px 14px;border-radius:14px;background:#fff;border:1px solid rgba(36,40,44,.1);font-size:14px;color:#5D614B}
.wf-intro b{color:#24282C}
.wf-intro .wf-ic{flex-shrink:0;width:30px;height:30px;border-radius:10px;background:#CDF649;display:flex;align-items:center;justify-content:center;font-size:15px}
.wf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.wf-box{background:#fff;border:1px solid rgba(36,40,44,.1);border-radius:16px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:9px;transition:border-color .15s}
.wf-box.is-done{border-color:#24282C}
.wf-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.wf-tag{display:inline-flex;align-items:center;gap:6px;font:800 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#24282C}
.wf-tag i{width:8px;height:8px;border-radius:50%;background:var(--dot,#CDF649)}
.wf-state{font-size:12px;color:#5D614B}
textarea.wf-in{width:100%;min-height:78px;resize:vertical;padding:10px 12px;border:1px solid rgba(36,40,44,.22);border-radius:12px;background:#fff;font:14.5px/1.45 inherit;font-family:inherit;color:#24282C;outline:none}
textarea.wf-in:focus{border-color:#24282C;box-shadow:0 0 0 3px rgba(205,246,73,.5)}
.wf-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wf-btn{height:36px;padding:0 14px;border-radius:10px;border:1px solid #24282C;background:#CDF649;color:#24282C;font:700 13px inherit;font-family:inherit;cursor:pointer}
.wf-btn.ghost{background:#fff;border-color:rgba(36,40,44,.2)}
.wf-btn:hover{filter:brightness(.96)}
.wf-model{border-left:3px solid #6B42FD;background:#F6F6EF;border-radius:0 12px 12px 0;padding:10px 12px;font-size:14px;color:#24282C;animation:wfIn .2s ease}
.wf-model[hidden]{display:none}
.wf-model-lbl{display:block;margin-bottom:4px;font:800 10.5px ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B42FD}
.wf-model ol,.wf-model ul{padding-left:18px}
.wf-model li{margin:2px 0}
@keyframes wfIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
.wf-mini{height:28px;padding:0 10px;border-radius:8px;border:1px solid rgba(36,40,44,.2);background:#fff;color:#24282C;font:650 12px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}
.wf-mini:hover{border-color:#24282C}
.wf-mini.ok{background:#CDF649;border-color:#24282C}
details.wf-panel{background:#fff;border:1px solid rgba(36,40,44,.1);border-radius:16px;margin:0 0 10px;overflow:hidden}
details.wf-panel>summary{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;list-style:none;font-weight:750;font-size:15px}
details.wf-panel>summary::-webkit-details-marker{display:none}
details.wf-panel>summary::after{content:'';margin-left:auto;width:7px;height:7px;border-right:2px solid #24282C;border-bottom:2px solid #24282C;transform:rotate(45deg);transition:transform .15s}
details.wf-panel[open]>summary::after{transform:rotate(-135deg)}
.wf-count{font:700 11px ui-monospace,Menlo,monospace;color:#5D614B;background:#F6F6EF;border-radius:999px;padding:3px 8px}
.wf-list{border-top:1px solid rgba(36,40,44,.08)}
.wf-ph{display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border-bottom:1px solid rgba(36,40,44,.06)}
.wf-ph:last-child{border-bottom:0}
.wf-ph:hover{background:#FBFBF7}
.wf-ph-main{flex:1;min-width:0}
.wf-ph-main b{display:block;font-size:15px}
.wf-ph-main span{display:block;font-size:13px;color:#5D614B}
.wf-ph-main em{display:block;font-size:13px;color:#24282C;opacity:.8;margin-top:2px}
.wf-ph-acts{display:flex;gap:6px;flex-shrink:0;padding-top:2px}
.wf-note{padding:10px 14px 14px;border-top:1px solid rgba(36,40,44,.08);font-size:14px;white-space:pre-wrap}
.wf-prog{display:flex;align-items:center;gap:10px;margin:0 0 12px}
.wf-bar{flex:1;height:8px;border-radius:999px;background:#fff;border:1px solid rgba(36,40,44,.1);overflow:hidden}
.wf-bar i{display:block;height:100%;width:0;background:#CDF649;transition:width .25s}
.wf-prog b{font-size:13px;white-space:nowrap}
.wf-check{display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid rgba(36,40,44,.1);border-radius:14px;padding:12px 14px;margin:0 0 8px;cursor:pointer;transition:border-color .15s,background .15s}
.wf-check:hover{border-color:rgba(36,40,44,.3)}
.wf-check input{position:absolute;opacity:0;pointer-events:none}
.wf-box-ic{flex-shrink:0;width:22px;height:22px;border-radius:7px;border:2px solid rgba(36,40,44,.35);display:flex;align-items:center;justify-content:center;margin-top:1px;transition:all .15s}
.wf-check.is-on{border-color:#24282C;background:#FBFDF0}
.wf-check.is-on .wf-box-ic{background:#CDF649;border-color:#24282C}
.wf-check.is-on .wf-box-ic::after{content:'✓';font:900 13px/1 system-ui;color:#24282C}
.wf-check-main{flex:1;min-width:0}
.wf-check-main b{display:block;font-size:15px;margin-bottom:2px}
.wf-check-main p{font-size:13.5px;color:#5D614B;margin:1px 0}
.wf-check-main .lvl{display:grid;grid-template-columns:92px 1fr;gap:2px 8px;margin-top:4px;font-size:13px}
.wf-check-main .lvl dt{font-weight:700;color:#24282C}
.wf-check-main .lvl dd{margin:0;color:#5D614B}
.wf-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;padding-top:12px;border-top:1px solid rgba(36,40,44,.1)}
.wf-foot span{font-size:13px;color:#5D614B}
.wf-next{height:42px;padding:0 18px;border-radius:12px;border:1px solid #24282C;background:#24282C;color:#fff;font:700 14px inherit;font-family:inherit;cursor:pointer}
.wf-next:hover{background:#000}
.wf-toast{position:fixed;left:50%;bottom:14px;transform:translate(-50%,20px);opacity:0;background:#24282C;color:#fff;font-size:13px;font-weight:600;padding:8px 14px;border-radius:10px;transition:all .2s;pointer-events:none}
.wf-toast.on{opacity:1;transform:translate(-50%,0)}
`;

  /* Высота по самому содержимому (body), а не по документу: высота
     документа не бывает меньше окна, и карточка могла только расти -
     под блоком оставалась пустота от первой прикидки. */
  const WF_HEIGHT = `
var _wfH=0;
function wfReportHeight(){ try{ var h=Math.ceil(document.body.getBoundingClientRect().height); if(Math.abs(h-_wfH)<4) return; _wfH=h; if(window.__IW_CARD__) parent.postMessage({type:'iw-height',cardId:window.__IW_CARD__,height:h},'*'); }catch(e){} }
window.addEventListener('load',wfReportHeight);
document.addEventListener('DOMContentLoaded',wfReportHeight);
if(window.ResizeObserver) new ResizeObserver(wfReportHeight).observe(document.body);`;

  const SCRIPT_COMMON = `
function wfPost(m){ if(window.__IW_CARD__) parent.postMessage(Object.assign({cardId:window.__IW_CARD__},m),'*'); }
var _wfT=null;
function wfToast(t){ var el=document.getElementById('wf-toast'); if(!el) return; el.textContent=t; el.classList.add('on'); clearTimeout(_wfT); _wfT=setTimeout(function(){ el.classList.remove('on'); },1600); }
function wfCopy(text,btn){
  var ok=false;
  try{ var ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); ok=document.execCommand('copy'); ta.remove(); }catch(e){}
  if(!ok) wfPost({type:'iw-copy',text:text});
  if(btn){ btn.textContent='Copied'; btn.classList.add('ok'); setTimeout(function(){ btn.textContent='Copy'; btn.classList.remove('ok'); },1400); }
}
function wfInsert(text,btn){
  wfPost({type:'iw-insert',text:text});
  if(btn){ var t=btn.textContent; btn.textContent='Added ✓'; btn.classList.add('ok'); setTimeout(function(){ btn.textContent=t; btn.classList.remove('ok'); },1400); }
}
function wfNext(){ wfPost({type:'iw-goto',dir:'next'}); }
var _wfST=null;
function wfSave(state){ clearTimeout(_wfST); _wfST=setTimeout(function(){ wfPost({type:'iw-state',state:state}); },300); }
`;

  function footHtml(d, note) {
    const next = d._wfCtx && d._wfCtx.next;
    return `<div class="wf-foot"><span id="wf-foot-note">${esc(note || '')}</span>${next ? `<button class="wf-next" type="button" onclick="wfNext()">${esc(next.label)} →</button>` : ''}</div>`;
  }

  /* ── Ideas: your view first, then the model ─────────────────────────── */
  function ideasHtml(d) {
    const cards = (Array.isArray(d.cards) ? d.cards : []).filter(c => c && (c.title || c.text));
    const dots = ['#CDF649', '#9F8CE8', '#6BAFF3', '#F3A46B', '#49F6F0', '#FFE44D'];
    const body = cards.map((c, i) => {
      const ls = lines(c.text);
      const numbered = ls.length > 1 && ls.every(l => /^(\d+[.)]|[-•*])\s/.test(l));
      const model = numbered ? `<ul>${ls.map(l => `<li>${md(stripBullet(l))}</li>`).join('')}</ul>` : ls.map(l => `<p>${md(l)}</p>`).join('');
      return `<section class="wf-box" data-i="${i}" style="--dot:${dots[i % dots.length]}">
        <div class="wf-head"><span class="wf-tag"><i></i>${md(c.title || `Idea ${i + 1}`)}</span><span class="wf-state" data-state="${i}"></span></div>
        <textarea class="wf-in" data-i="${i}" placeholder="${/pros|cons|argument/i.test(c.title || '') ? 'Your arguments - one per line…' : 'What do you think? Write your view…'}"></textarea>
        <div class="wf-row">
          <button class="wf-btn" type="button" data-reveal="${i}">Compare with the model</button>
        </div>
        <div class="wf-model" data-model="${i}" hidden>
          <span class="wf-model-lbl">Model</span>${model}
          <div class="wf-row" style="margin-top:8px"><button class="wf-mini" type="button" data-use="${i}">＋ Use my idea in the draft</button></div>
        </div>
      </section>`;
    }).join('');
    const content = `<div class="wf-intro"><span class="wf-ic">💡</span><span><b>Get your ideas first.</b> Write what you think in each box, then compare with the model. Anything good goes straight into your draft.</span></div>
      <div class="wf-grid">${body}</div>${footHtml(d, '')}`;
    const script = `
var WF_N=${cards.length};
function wfState(){ return { texts:[].map.call(document.querySelectorAll('textarea.wf-in'),function(t){return t.value;}),
  open:[].map.call(document.querySelectorAll('.wf-model'),function(m){return !m.hidden;}) }; }
function wfSync(){
  var done=0;
  document.querySelectorAll('.wf-box').forEach(function(b){
    var i=b.getAttribute('data-i'); var t=b.querySelector('textarea').value.trim(); var open=!b.querySelector('.wf-model').hidden;
    b.classList.toggle('is-done', !!t);
    if(t) done++;
    var btn=b.querySelector('[data-reveal]');
    btn.textContent = open ? 'Hide the model' : (t ? 'Compare with the model' : 'Show the model');
    btn.classList.toggle('ghost', !t && !open);
    b.querySelector('[data-state]').textContent = t ? '✓ written' : '';
  });
  var n=document.getElementById('wf-foot-note'); if(n) n.textContent = done+' of '+WF_N+' written';
}
document.addEventListener('click',function(e){
  var r=e.target.closest('[data-reveal]'); if(r){ var m=document.querySelector('[data-model="'+r.getAttribute('data-reveal')+'"]'); m.hidden=!m.hidden; wfSync(); wfSave(wfState()); return; }
  var u=e.target.closest('[data-use]'); if(u){ var t=document.querySelector('textarea[data-i="'+u.getAttribute('data-use')+'"]').value.trim(); if(!t){ wfToast('Write your idea in the box first'); return; } wfInsert(t,u); }
});
document.addEventListener('input',function(e){ if(e.target.matches('textarea.wf-in')){ wfSync(); wfSave(wfState()); } });
document.addEventListener('DOMContentLoaded',function(){
  var s=window.__IW_STATE__;
  if(s){ (s.texts||[]).forEach(function(v,i){ var t=document.querySelector('textarea[data-i="'+i+'"]'); if(t) t.value=v||''; });
         (s.open||[]).forEach(function(v,i){ var m=document.querySelector('[data-model="'+i+'"]'); if(m) m.hidden=!v; }); }
  wfSync();
});`;
    return { content, script };
  }

  /* ── Phrases: a cheat sheet with Copy / Insert ──────────────────────── */
  function phrasesHtml(d) {
    const groups = [];
    const items = Array.isArray(d.items) ? d.items : [];
    if (items.length) groups.push({ title: d.title || 'Useful phrases', rows: items.filter(it => it && it.word).map(it => ({ phrase: it.word, note: it.definition || '', ex: it.example || '' })) });
    const notes = [];
    (Array.isArray(d.cards) ? d.cards : []).forEach(c => {
      const ls = lines(c && c.text);
      const rows = ls.map(pair).filter(Boolean);
      if (rows.length >= Math.max(2, Math.ceil(ls.length * 0.5))) groups.push({ title: c.title || 'Phrases', rows });
      else if (ls.length) notes.push(c);
    });
    let k = 0;
    const row = r => {
      const i = k++;
      return `<div class="wf-ph">
        <div class="wf-ph-main"><b>${md(r.phrase)}</b>${r.note ? `<span>${md(r.note)}</span>` : ''}${r.ex ? `<em>“${md(r.ex)}”</em>` : ''}</div>
        <div class="wf-ph-acts">
          <button class="wf-mini" type="button" data-copy="${esc(r.phrase)}">Copy</button>
          <button class="wf-mini" type="button" data-ins="${esc(r.phrase)}">＋ Insert</button>
        </div>
      </div>`;
    };
    const content = `<div class="wf-intro"><span class="wf-ic">🔤</span><span><b>Your cheat sheet for writing.</b> Press <b>＋ Insert</b> to drop a phrase into your draft in the Writing Studio, or <b>Copy</b> it.</span></div>
      ${groups.map((g, gi) => `<details class="wf-panel" ${gi < 2 ? 'open' : ''}><summary>${md(g.title)}<span class="wf-count">${g.rows.length}</span></summary><div class="wf-list">${g.rows.map(row).join('')}</div></details>`).join('')}
      ${notes.map(c => `<details class="wf-panel"><summary>${md(c.title || 'Note')}</summary><div class="wf-note">${md(c.text || '')}</div></details>`).join('')}
      ${footHtml(d, `${k} phrases`)}`;
    const script = `
document.addEventListener('click',function(e){
  var c=e.target.closest('[data-copy]'); if(c){ wfCopy(c.getAttribute('data-copy'),c); return; }
  var i=e.target.closest('[data-ins]'); if(i){ wfInsert(i.getAttribute('data-ins'),i); }
});`;
    return { content, script };
  }

  /* ── Genre guide: what this kind of text must do, and its phrases ───── */
  function guideHtml(d) {
    const g = d._wfGuide || {};
    let k = 0;
    const groups = Object.entries(g.phrases || {});
    const content = `<div class="wf-intro"><span class="wf-ic">🧭</span><span><b>${esc(g.label || 'Genre guide')}</b> · ${esc(g.registerLabel || '')}. ${esc(g.tone || '')}</span></div>
      <details class="wf-panel" open><summary>What your text must do<span class="wf-count">${(g.requirements || []).length}</span></summary>
        <div class="wf-list">${(g.requirements || []).map((r, i) => `<div class="wf-ph"><div class="wf-ph-main"><b>${i + 1}. ${md(r)}</b></div></div>`).join('')}</div></details>
      ${groups.map(([name, list]) => `<details class="wf-panel" open><summary>${esc(name)}<span class="wf-count">${list.length}</span></summary><div class="wf-list">${list.map(ph => {
        k++;
        const clean = String(ph).replace(/\s*\((?:no name|name known)\)\s*$/i, '');
        return `<div class="wf-ph"><div class="wf-ph-main"><b>${md(ph)}</b></div><div class="wf-ph-acts">
          <button class="wf-mini" type="button" data-copy="${esc(clean)}">Copy</button>
          <button class="wf-mini" type="button" data-ins="${esc(clean.replace(/…$/, ''))}">＋ Insert</button></div></div>`;
      }).join('')}</div></details>`).join('')}
      ${footHtml(d, `${k} phrases for this genre`)}`;
    const script = `
document.addEventListener('click',function(e){
  var c=e.target.closest('[data-copy]'); if(c){ wfCopy(c.getAttribute('data-copy'),c); return; }
  var i=e.target.closest('[data-ins]'); if(i){ wfInsert(i.getAttribute('data-ins'),i); }
});`;
    return { content, script };
  }

  /* ── Plan / criteria: tick it off as you go ─────────────────────────── */
  function checklistHtml(d) {
    const criteria = d._wfRole === 'criteria';
    const all = (Array.isArray(d.cards) ? d.cards : []).filter(c => c && (c.title || c.text));
    const intro = all.filter(c => /how to use|instruction|note|about/i.test(c.title || ''));
    const steps = all.filter(c => !intro.includes(c));
    const stepHtml = (c, i) => {
      const ls = lines(c.text);
      const lv = ls.map(l => l.match(/^(excellent|good|needs work|developing|strong|weak|basic|advanced)\s*:\s*(.+)$/i)).filter(Boolean);
      const bodyHtml = criteria && lv.length >= 2
        ? `<dl class="lvl">${lv.map(m => `<dt>${esc(m[1])}</dt><dd>${md(m[2])}</dd>`).join('')}</dl>`
        : ls.map(l => `<p>${md(stripBullet(l))}</p>`).join('');
      return `<label class="wf-check" data-i="${i}"><input type="checkbox" data-i="${i}"><span class="wf-box-ic"></span>
        <span class="wf-check-main"><b>${md(c.title || `Step ${i + 1}`)}</b>${bodyHtml}</span></label>`;
    };
    const lead = criteria
      ? `<b>Check your draft against these.</b> Tick each one when your text really does it.`
      : `<b>Follow the plan.</b> Tick each part off as you write it.`;
    const content = `<div class="wf-intro"><span class="wf-ic">${criteria ? '✅' : '🧭'}</span><span>${lead}${intro.map(c => ` ${md(c.text || '')}`).join('')}</span></div>
      <div class="wf-prog"><div class="wf-bar"><i id="wf-bar"></i></div><b id="wf-prog-t">0 / ${steps.length}</b></div>
      ${steps.map(stepHtml).join('')}
      ${footHtml(d, '')}`;
    const script = `
var WF_N=${steps.length};
function wfSync(){
  var n=0; document.querySelectorAll('.wf-check').forEach(function(l){ var on=l.querySelector('input').checked; l.classList.toggle('is-on',on); if(on) n++; });
  document.getElementById('wf-bar').style.width=(WF_N? Math.round(n/WF_N*100):0)+'%';
  document.getElementById('wf-prog-t').textContent=n+' / '+WF_N;
  var f=document.getElementById('wf-foot-note'); if(f) f.textContent = n===WF_N && WF_N ? 'All done - nice work' : '';
}
document.addEventListener('change',function(e){ if(e.target.matches('.wf-check input')){ wfSync(); wfSave({checked:[].map.call(document.querySelectorAll('.wf-check input'),function(c){return c.checked;})}); } });
document.addEventListener('DOMContentLoaded',function(){
  var s=window.__IW_STATE__; if(s&&s.checked) s.checked.forEach(function(v,i){ var c=document.querySelector('.wf-check input[data-i="'+i+'"]'); if(c) c.checked=!!v; });
  wfSync();
});`;
    return { content, script };
  }

  function buildHtml(d, cardId, ownerView, cardW, heightReporter) {
    const part = d._wfRole === 'ideas' ? ideasHtml(d)
      : d._wfRole === 'phrases' ? phrasesHtml(d)
      : d._wfRole === 'guide' ? guideHtml(d)
      : checklistHtml(d);
    return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
${part.content}
<div class="wf-toast" id="wf-toast"></div>
<script>window.__IW_CARD__=${JSON.stringify(cardId || '')};window.__IW_STATE__=${JSON.stringify(d._state || null)};<\/script>
<script>${SCRIPT_COMMON}${part.script}${WF_HEIGHT}<\/script>
</body></html>`;
  }

  window.TeachEdWritingFlow = { roleFor, playSize, buildHtml, phrasesOf: wfPhrasesOf, ROLE_BY_TOOL: WF_ROLE_BY_TOOL };
})();
