/* Student cabinet → The Vault: how many saved words are due, a Review button
   (scripts/vault-review.js) on top of the Tasks and Vocabulary tabs. */
(function () {
  'use strict';
  if (!window.TeachedVault) return;
  const api = (path, opts) => (typeof apiFetch === 'function' ? apiFetch(path, opts) : Promise.reject(new Error('no api')));
  const CSS = `
.vc{display:flex;align-items:center;gap:16px;padding:16px 18px;margin:0 0 16px;border-radius:18px;background:#24282C;color:#fff;font-family:inherit}
.vc-ic{width:46px;height:46px;border-radius:14px;background:#CDF649;display:grid;place-items:center;font-size:22px;flex-shrink:0}
.vc-tx b{display:block;font-size:16px}
.vc-tx span{display:block;font-size:12.5px;color:rgba(255,255,255,.62);margin-top:3px}
.vc-stats{display:flex;gap:14px;margin-left:auto;font-size:11px;color:rgba(255,255,255,.55);text-align:center}
.vc-stats b{display:block;font-size:18px;color:#fff}
.vc-btn{border:0;border-radius:12px;padding:11px 16px;background:#CDF649;color:#24282C;font:700 13px inherit;font-family:inherit;cursor:pointer;min-height:44px;white-space:nowrap}
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
      <button type="button" class="vc-btn"${s.due ? '' : ' disabled'}>${s.due ? 'Review now' : 'Nothing due'}</button>`;
    ['assignments-notif', 'vocab-list'].forEach(id => {
      const anchor = document.getElementById(id);
      if (!anchor) return;
      const box = document.createElement('div');
      box.className = 'vc';
      box.innerHTML = html;
      anchor.parentNode.insertBefore(box, anchor);
      box.querySelector('.vc-btn').addEventListener('click', () => window.TeachedVault.open({ api, limit: 20, onDone: () => { paint(); if (typeof loadVocab === 'function') loadVocab(); } }));
    });
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
