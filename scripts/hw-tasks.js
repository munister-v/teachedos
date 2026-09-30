/* Домашние задания-«действия»: голосовой cliffhanger и письмо с разбором.

   Карточка домашки несёт data._hwTask:
     { kind: 'voice', teaser, challenge, phrases[] }   - ученик записывает 30-45 секунд
     { kind: 'write', prompt, phrases[], level }       - ученик пишет и сразу видит разбор

   Ученик:
     voice - запись в браузере (MediaRecorder), прослушивание, «Send to my teacher»:
             аудио уходит в POST /api/boards/:id/recordings (тот же приёмник, что у
             Speaking Studio), а в попытку домашки кладётся ссылка на запись.
     write - текст + «Check my writing»: POST /api/ai/homework-feedback возвращает
             похвалу (цитаты из его текста), правки и какие целевые фразы уже
             использованы. Потом «Send to my teacher» с текстом и разбором.

   Учитель видит присланное в Homework (workHtml, см. homework.html).

   HwTasks.render(host, card, ctx) - ctx: { api, assignmentId, boardId, attempt, save(payload), toast } */
(function () {
  'use strict';
  if (window.HwTasks) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function css() {
    if (document.getElementById('hwt-css')) return;
    const st = document.createElement('style');
    st.id = 'hwt-css';
    st.textContent = `
.hwt{max-width:640px;margin:0 auto;padding:18px;font-family:inherit;color:#24282C;display:flex;flex-direction:column;gap:14px}
.hwt-teaser{background:#24282C;color:#fff;border-radius:18px;padding:18px 20px;font-size:16px;line-height:1.6}
.hwt-teaser small{display:block;font:800 10.5px ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#CDF649;margin-bottom:8px}
.hwt-q{font-size:17px;font-weight:750;letter-spacing:-.01em}
.hwt-chips{display:flex;flex-wrap:wrap;gap:6px}
.hwt-chip{border-radius:999px;padding:5px 12px;font:650 13px inherit;font-family:inherit;background:#EFEAFF;color:#4B2FC4}
.hwt-chip.used{background:#CDF649;color:#24282C}
.hwt-chip.used::before{content:'✓ '}
.hwt-rec{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.hwt-btn{border:0;border-radius:12px;padding:12px 18px;font:800 14px inherit;font-family:inherit;cursor:pointer;background:#CDF649;color:#24282C}
.hwt-btn.dark{background:#24282C;color:#fff}
.hwt-btn.ghost{background:#fff;color:#24282C;border:1.5px solid rgba(36,40,44,.2)}
.hwt-btn:disabled{opacity:.5;cursor:default}
.hwt-time{font:800 22px ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.hwt-dot{width:12px;height:12px;border-radius:50%;background:#e5543a;animation:hwt-p 1s infinite}
@keyframes hwt-p{50%{opacity:.25}}
.hwt-msg{font-size:13px;font-weight:650;min-height:18px}
.hwt-msg.err{color:#c0392b}.hwt-msg.ok{color:#2e7d32}
.hwt textarea{width:100%;box-sizing:border-box;min-height:150px;border:1.5px solid rgba(36,40,44,.2);border-radius:14px;padding:12px 14px;font:500 16px/1.6 inherit;font-family:inherit;resize:vertical}
.hwt textarea:focus{outline:none;border-color:#8FB125;box-shadow:0 0 0 3px rgba(205,246,73,.4)}
.hwt-count{font-size:12px;color:#5D614B}
.hwt-fb{background:#fff;border:1px solid rgba(93,97,75,.18);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:10px}
.hwt-fb .sum{font-size:15px;font-weight:650}
.hwt-fb .txt{font-size:16px;line-height:1.75;white-space:pre-wrap}
.hwt-fb mark.g{background:#CDF649;border-radius:4px;padding:0 2px}
.hwt-fb mark.y{background:#FFE1B0;border-radius:4px;padding:0 2px}
.hwt-li{font-size:14px;line-height:1.5}
.hwt-li b{background:#CDF649;border-radius:4px;padding:0 4px}
.hwt-li s{color:#8A5200}
.hwt-done{font-weight:800;color:#2e7d32}
`;
    document.head.appendChild(st);
  }

  const wordsIn = t => String(t || '').split(/\s+/).filter(Boolean).length;
  const usedPhrases = (text, phrases) => phrases.filter(p => p && new RegExp('\\b' + String(p).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i').test(text));

  /* ── голос ─────────────────────────────────────────────────────── */
  function renderVoice(host, card, ctx) {
    const task = card.data._hwTask;
    const sent = ctx.attempt && ctx.attempt.data && ctx.attempt.data.task === 'voice' ? ctx.attempt.data : null;
    const phrases = Array.isArray(task.phrases) ? task.phrases : [];
    host.innerHTML = `<div class="hwt">
      ${task.teaser ? `<div class="hwt-teaser"><small>The teaser</small>${esc(task.teaser).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="hwt-q">${esc(task.challenge || 'What do you think happened next? Record 30-45 seconds.')}</div>
      ${phrases.length ? `<div><div class="hwt-count" style="margin-bottom:6px">Use at least two of these:</div><div class="hwt-chips">${phrases.map(p => `<span class="hwt-chip">${esc(p)}</span>`).join('')}</div></div>` : ''}
      <div class="hwt-rec"><button type="button" class="hwt-btn" data-rec>● Record</button><span class="hwt-time" data-time>0:00</span><span data-live></span></div>
      <div data-play></div>
      <div class="hwt-msg" data-msg>${sent ? '<span class="hwt-done">✓ Sent to your teacher</span>' : ''}</div>
    </div>`;
    const $ = s => host.querySelector(s);
    let rec = null, stream = null, chunks = [], clip = null, mime = '', t0 = 0, timer = 0;
    const msg = (t, cls) => { const m = $('[data-msg]'); m.textContent = t; m.className = 'hwt-msg ' + (cls || ''); };
    const fmt = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const stop = () => { try { rec && rec.state !== 'inactive' && rec.stop(); } catch (_) {} };
    async function start() {
      msg('');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (_) { msg('The microphone is blocked - allow it in the browser and try again.', 'err'); return; }
      chunks = []; clip = null;
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      mime = rec.mimeType || type || 'audio/webm';
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        clearInterval(timer);
        stream.getTracks().forEach(t => t.stop());
        $('[data-live]').innerHTML = '';
        $('[data-rec]').textContent = '● Record again';
        clip = new Blob(chunks, { type: mime });
        if (!clip.size) return;
        const url = URL.createObjectURL(clip);
        $('[data-play]').innerHTML = `<audio controls src="${url}" style="width:100%"></audio><div style="margin-top:10px"><button type="button" class="hwt-btn dark" data-send>Send to my teacher</button></div>`;
        $('[data-send]').addEventListener('click', send);
      };
      t0 = Date.now();
      rec.start();
      $('[data-rec]').textContent = '■ Stop';
      $('[data-live]').innerHTML = '<span class="hwt-dot"></span>';
      timer = setInterval(() => {
        const ms = Date.now() - t0;
        $('[data-time]').textContent = fmt(ms);
        if (ms >= 60000) stop();     // потолок: минута
      }, 250);
    }
    $('[data-rec]').addEventListener('click', () => { if (rec && rec.state === 'recording') stop(); else start(); });
    async function send() {
      const btn = $('[data-send]');
      if (!clip) return;
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(clip); });
        const ms = Date.now() - t0;
        const d = await ctx.api(`/api/boards/${ctx.boardId}/recordings`, { method: 'POST', body: { cardId: card.id, promptIdx: 0, prompt: String(task.challenge || '').slice(0, 600), mime, durationMs: ms, audio: b64 } });
        await ctx.save({ score: 1, max_score: 1, status: 'done', data: { task: 'voice', recordingId: d.recording && d.recording.id, durationMs: ms, at: new Date().toISOString() } });
        btn.remove();
        msg('✓ Sent to your teacher', 'ok');
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Send to my teacher';
        msg(e.message || 'Could not send - try again.', 'err');
      }
    }
  }

  /* ── письмо с разбором ─────────────────────────────────────────── */
  function highlight(text, fb) {
    const marks = [];
    (fb.praise || []).forEach(x => marks.push({ q: x.quote, cls: 'g', tip: x.comment }));
    (fb.fixes || []).forEach(x => marks.push({ q: x.quote, cls: 'y', tip: x.suggestion + (x.why ? ' - ' + x.why : '') }));
    const ranges = [];
    const lower = text.toLowerCase();
    marks.forEach(m => { const i = lower.indexOf(String(m.q).toLowerCase()); if (i >= 0) ranges.push({ i, j: i + m.q.length, cls: m.cls, tip: m.tip }); });
    ranges.sort((a, b) => a.i - b.i);
    let out = '', at = 0;
    ranges.forEach(r => { if (r.i < at) return; out += esc(text.slice(at, r.i)) + `<mark class="${r.cls}" title="${esc(r.tip)}">${esc(text.slice(r.i, r.j))}</mark>`; at = r.j; });
    return out + esc(text.slice(at));
  }
  function feedbackHtml(text, fb) {
    return `<div class="hwt-fb">
      ${fb.summary ? `<div class="sum">${esc(fb.summary)}</div>` : ''}
      <div class="txt">${highlight(text, fb)}</div>
      ${(fb.praise || []).map(x => `<div class="hwt-li">👏 <b>${esc(x.quote)}</b> - ${esc(x.comment)}</div>`).join('')}
      ${(fb.fixes || []).map(x => `<div class="hwt-li">✏️ <s>${esc(x.quote)}</s> → <b>${esc(x.suggestion)}</b>${x.why ? ` <span style="color:#5D614B">(${esc(x.why)})</span>` : ''}</div>`).join('')}
      ${(fb.missing || []).length ? `<div class="hwt-li" style="color:#5D614B">Not used yet: ${fb.missing.map(esc).join(', ')}</div>` : ''}
    </div>`;
  }
  function renderWrite(host, card, ctx) {
    const task = card.data._hwTask;
    const phrases = Array.isArray(task.phrases) ? task.phrases : [];
    const prev = ctx.attempt && ctx.attempt.data && ctx.attempt.data.task === 'write' ? ctx.attempt.data : null;
    host.innerHTML = `<div class="hwt">
      <div class="hwt-q">${esc(task.prompt || 'Write a short text.').replace(/\n/g, '<br>')}</div>
      ${phrases.length ? `<div class="hwt-chips" data-chips>${phrases.map(p => `<span class="hwt-chip" data-p="${esc(p)}">${esc(p)}</span>`).join('')}</div>` : ''}
      <textarea data-text maxlength="1500" placeholder="Write here…">${prev ? esc(prev.text) : ''}</textarea>
      <div class="hwt-count" data-count></div>
      <div class="hwt-rec"><button type="button" class="hwt-btn" data-check>✨ Check my writing</button><button type="button" class="hwt-btn dark" data-send>Send to my teacher</button></div>
      <div class="hwt-msg" data-msg>${prev ? '<span class="hwt-done">✓ Sent to your teacher</span>' : ''}</div>
      <div data-fb>${prev && prev.feedback ? feedbackHtml(prev.text, prev.feedback) : ''}</div>
    </div>`;
    const $ = s => host.querySelector(s);
    let fb = prev && prev.feedback || null;
    const msg = (t, cls) => { const m = $('[data-msg]'); m.textContent = t; m.className = 'hwt-msg ' + (cls || ''); };
    const sync = () => {
      const t = $('[data-text]').value;
      $('[data-count]').textContent = `${wordsIn(t)} words`;
      const used = usedPhrases(t, phrases);
      host.querySelectorAll('[data-p]').forEach(c => c.classList.toggle('used', used.includes(c.dataset.p)));
    };
    $('[data-text]').addEventListener('input', sync); sync();
    $('[data-check]').addEventListener('click', async ev => {
      const t = $('[data-text]').value.trim();
      if (wordsIn(t) < 8) { msg('Write a little more first - at least a couple of sentences.', 'err'); return; }
      ev.target.disabled = true; ev.target.textContent = 'Reading…'; msg('');
      try {
        fb = await ctx.api('/api/ai/homework-feedback', { method: 'POST', body: { assignmentId: ctx.assignmentId, cardId: card.id, text: t } });
        $('[data-fb]').innerHTML = feedbackHtml(t, fb);
        msg(fb.checksLeft != null ? `You can check again - ${fb.checksLeft} left.` : '', '');
      } catch (e) { msg(e.message || 'The check did not work - you can still send it.', 'err'); }
      finally { ev.target.disabled = false; ev.target.textContent = '✨ Check again'; }
    });
    $('[data-send]').addEventListener('click', async ev => {
      const t = $('[data-text]').value.trim();
      if (wordsIn(t) < 8) { msg('Write a little more first.', 'err'); return; }
      ev.target.disabled = true; ev.target.textContent = 'Sending…';
      try {
        await ctx.save({ score: 1, max_score: 1, status: 'done', data: { task: 'write', text: t, feedback: fb, used: usedPhrases(t, phrases), at: new Date().toISOString() } });
        msg('✓ Sent to your teacher', 'ok');
      } catch (e) { msg(e.message || 'Could not send - try again.', 'err'); }
      finally { ev.target.disabled = false; ev.target.textContent = 'Send again'; }
    });
  }

  window.HwTasks = {
    supports: card => !!(card && card.data && card.data._hwTask && (card.data._hwTask.kind === 'voice' || card.data._hwTask.kind === 'write')),
    render(host, card, ctx) {
      css();
      host.innerHTML = '';
      if (card.data._hwTask.kind === 'voice') renderVoice(host, card, ctx); else renderWrite(host, card, ctx);
    },
    feedbackHtml: (text, fb) => { css(); return feedbackHtml(text, fb || {}); },
  };
})();
