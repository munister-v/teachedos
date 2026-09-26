/* Student cabinet → The Vault: how many saved words are due, a Review button
   (scripts/vault-review.js) on top of the Tasks and Vocabulary tabs. */
(function () {
  'use strict';
  if (!window.TeachedVault) return;
  const api = (path, opts) => (typeof apiFetch === 'function' ? apiFetch(path, opts) : Promise.reject(new Error('no api')));
  const CSS = `
.vc{position:relative;display:flex;align-items:center;gap:16px;padding:16px 18px;margin:0 0 16px;border-radius:18px;background:#24282C;color:#fff;font-family:inherit}
.vc-ic{width:46px;height:46px;border-radius:14px;background:#CDF649;display:grid;place-items:center;font-size:22px;flex-shrink:0}
.vc-tx b{display:block;font-size:16px}
.vc-tx span{display:block;font-size:12.5px;color:rgba(255,255,255,.62);margin-top:3px}
.vc-stats{display:flex;gap:14px;margin-left:auto;font-size:11px;color:rgba(255,255,255,.55);text-align:center}
.vc-stats b{display:block;font-size:18px;color:#fff}
.vc-btn{border:0;border-radius:12px;padding:11px 16px;background:#CDF649;color:#24282C;font:700 13px inherit;font-family:inherit;cursor:pointer;min-height:44px;white-space:nowrap}
.vc-rem{border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;border-radius:12px;padding:10px 12px;font:650 12.5px inherit;font-family:inherit;cursor:pointer;min-height:44px;white-space:nowrap}
.vc-rem:hover{background:rgba(255,255,255,.08)}
.vc-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:50;width:320px;background:#fff;color:#24282C;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.25),0 0 0 1px rgba(36,40,44,.1);padding:18px}
.vc-pop h4{margin:0 0 4px;font-size:16px}
.vc-pop p{margin:0 0 14px;font-size:12.5px;color:#5D614B;line-height:1.45}
.vc-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid rgba(36,40,44,.08);font-size:14px}
.vc-row small{display:block;font-size:11.5px;color:#8A8D7A;margin-top:2px}
.vc-sw{position:relative;width:44px;height:26px;flex-shrink:0}
.vc-sw input{opacity:0;width:0;height:0}
.vc-sw i{position:absolute;inset:0;border-radius:13px;background:#DAD9D1;transition:.2s;cursor:pointer}
.vc-sw i::after{content:'';position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:.2s}
.vc-sw input:checked+i{background:#24282C}
.vc-sw input:checked+i::after{transform:translateX(18px);background:#CDF649}
.vc-pop select{border:1px solid rgba(36,40,44,.18);border-radius:10px;padding:8px 10px;font:600 13px inherit;font-family:inherit;background:#fff}
.vc-save{width:100%;margin-top:12px;border:0;border-radius:12px;padding:11px;background:#CDF649;color:#24282C;font:700 13px inherit;font-family:inherit;cursor:pointer}
.vc-note{margin-top:8px;font-size:12px;color:#5D614B;min-height:16px}
.vc-btn:disabled{background:rgba(255,255,255,.12);color:rgba(255,255,255,.6);cursor:default}
`;
  function when(iso) {
    if (!iso) return '';
    const ms = Date.parse(iso) - Date.now();
    if (ms < 3600000) return `in ${Math.max(1, Math.round(ms / 60000))} min`;
    if (ms < 86400000) return `in ${Math.round(ms / 3600000)} h`;
    return `in ${Math.round(ms / 86400000)} d`;
  }
  async function paint() {
    const s = await window.TeachedVault.summary(api);
    document.querySelectorAll('.vc').forEach(e => e.remove());
    if (!s || !s.total) return;
    const html = `<div class="vc-ic">🔁</div>
      <div class="vc-tx"><b>The Vault${s.due ? ` · ${s.due} word${s.due === 1 ? '' : 's'} to review` : ''}</b>
        <span>${s.due ? 'Words you saved come back just before you forget them. A few minutes a day is enough.' : `All caught up. Next review ${when(s.next_due)}.`}</span></div>
      <div class="vc-stats"><div><b>${s.total}</b>saved</div><div><b>${s.mastered}</b>mastered</div></div>
      <button type="button" class="vc-rem" aria-haspopup="dialog">🔔 Reminders</button>
      <button type="button" class="vc-btn"${s.due ? '' : ' disabled'}>${s.due ? 'Review now' : 'Nothing due'}</button>`;
    ['assignments-notif', 'vocab-list'].forEach(id => {
      const anchor = document.getElementById(id);
      if (!anchor) return;
      const box = document.createElement('div');
      box.className = 'vc';
      box.innerHTML = html;
      anchor.parentNode.insertBefore(box, anchor);
      box.querySelector('.vc-rem').addEventListener('click', ev => { ev.stopPropagation(); toggleReminders(box); });
      box.querySelector('.vc-btn').addEventListener('click', () => window.TeachedVault.open({ api, limit: 20, onDone: () => { paint(); if (typeof loadVocab === 'function') loadVocab(); } }));
    });
  }
  /* Reminders: once a day at the chosen hour (their own time zone), only
     when something is due - a push to this device and/or an email. */
  async function toggleReminders(box) {
    const old = box.querySelector('.vc-pop');
    if (old) { old.remove(); return; }
    document.querySelectorAll('.vc-pop').forEach(p => p.remove());
    let r = {};
    try { const res = await api('/api/vault/reminders'); r = await res.json(); } catch (e) {}
    const pushOk = 'serviceWorker' in navigator && 'PushManager' in window;
    const denied = typeof Notification !== 'undefined' && Notification.permission === 'denied';
    const hours = [7, 8, 9, 12, 15, 17, 18, 19, 20, 21];
    const pop = document.createElement('div');
    pop.className = 'vc-pop';
    pop.setAttribute('role', 'dialog');
    pop.innerHTML = `<h4>Review reminders</h4>
      <p>Once a day, only when words are due. ${r.timezone ? `Your time zone: ${r.timezone}.` : ''}</p>
      <div class="vc-row"><span>Push on this device<small>${!pushOk ? 'Not supported in this browser' : denied ? 'Blocked in browser settings' : r.subscribed ? 'This account gets pushes' : 'Asks your browser once'}</small></span>
        <label class="vc-sw"><input type="checkbox" id="vc-push"${r.push !== false ? ' checked' : ''}${!pushOk || denied ? ' disabled' : ''}><i></i></label></div>
      <div class="vc-row"><span>Email<small>A short list of the words - one click to review</small></span>
        <label class="vc-sw"><input type="checkbox" id="vc-email"${r.email !== false ? ' checked' : ''}><i></i></label></div>
      <div class="vc-row"><span>Time</span><select id="vc-hour">${hours.map(h => `<option value="${h}"${Number(r.hour ?? 18) === h ? ' selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select></div>
      <button type="button" class="vc-save">Save</button><div class="vc-note" id="vc-note"></div>`;
    box.appendChild(pop);
    pop.addEventListener('click', e => e.stopPropagation());
    pop.querySelector('.vc-save').addEventListener('click', async () => {
      const note = pop.querySelector('#vc-note');
      const push = pop.querySelector('#vc-push').checked;
      note.textContent = 'Saving…';
      try {
        if (push && pushOk && !r.subscribed && typeof subscribePush === 'function') await subscribePush();
        await api('/api/vault/reminders', { method: 'PUT', body: { push, email: pop.querySelector('#vc-email').checked, hour: Number(pop.querySelector('#vc-hour').value) } });
        note.textContent = '✓ Saved';
        setTimeout(() => pop.remove(), 900);
      } catch (e) { note.textContent = 'Could not save - try again.'; }
    });
    setTimeout(() => document.addEventListener('click', function off() { pop.remove(); document.removeEventListener('click', off); }), 0);
  }

  function start() {
    if (!localStorage.getItem('teachedos_token')) return;
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    paint();
    if (/[#&]vault\b/.test(location.hash)) setTimeout(() => window.TeachedVault.open({ api, limit: 20, onDone: paint }), 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
