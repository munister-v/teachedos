/* "Confirm your email" reminder for password accounts that have not yet
   clicked the link from the welcome email. A small pill at the bottom of the
   screen with "Send again"; hidden for the rest of the tab once dismissed,
   and never shown again once the address is confirmed. */
(function () {
  'use strict';
  if (window.__teachedVerifyBanner) return;
  window.__teachedVerifyBanner = true;
  const API = window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000'
    : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech'));
  const get = (store, k) => { try { return window[store].getItem(k); } catch (_) { return null; } };
  const set = (store, k, v) => { try { window[store].setItem(k, v); } catch (_) {} };
  const token = get('localStorage', 'teachedos_token');
  if (!token || get('localStorage', 'teachedos_email_verified') === '1' || get('sessionStorage', 'teachedos_verify_later') === '1') return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CSS = `
.vb{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9000;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:10px 10px 10px 16px;border-radius:16px;background:#24282C;color:#fff;box-shadow:0 18px 50px -12px rgba(0,0,0,.45);font:500 13px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;animation:vbIn .25s ease}
@keyframes vbIn{from{opacity:0;transform:translate(-50%,10px)}}
.vb-dot{width:8px;height:8px;border-radius:50%;background:#CDF649;flex:none;box-shadow:0 0 0 4px rgba(205,246,73,.18)}
.vb-t b{font-weight:650}.vb-t span{color:rgba(255,255,255,.66)}
.vb button{border:0;cursor:pointer;font:650 12.5px inherit;font-family:inherit;border-radius:10px;padding:8px 12px;white-space:nowrap}
.vb-send{background:#CDF649;color:#24282C}.vb-send:disabled{opacity:.6;cursor:default}
.vb-x{background:rgba(255,255,255,.1);color:#fff;width:32px;padding:8px 0!important}
`;
  function show(user) {
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    const bar = document.createElement('div');
    bar.className = 'vb';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<i class="vb-dot" aria-hidden="true"></i><div class="vb-t"><b>Confirm your email.</b> <span>We sent a link to ${esc(user.email)}.</span></div>
      <button type="button" class="vb-send">Send again</button><button type="button" class="vb-x" aria-label="Remind me later">✕</button>`;
    document.body.appendChild(bar);
    const send = bar.querySelector('.vb-send');
    send.addEventListener('click', async () => {
      send.disabled = true; send.textContent = 'Sending…';
      try {
        const r = await fetch(API + '/api/auth/verify-email/resend', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Could not send');
        if (d.already) { set('localStorage', 'teachedos_email_verified', '1'); bar.remove(); return; }
        send.textContent = 'Sent ✓ check your inbox';
      } catch (e) {
        send.textContent = e.message.length < 60 ? e.message : 'Try again later';
        setTimeout(() => { send.disabled = false; send.textContent = 'Send again'; }, 4000);
      }
    });
    bar.querySelector('.vb-x').addEventListener('click', () => { set('sessionStorage', 'teachedos_verify_later', '1'); bar.remove(); });
  }

  function run() {
    fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const u = d && d.user;
        if (!u) return;
        if (u.email_verified_at) { set('localStorage', 'teachedos_email_verified', '1'); return; }
        show(u);
      })
      .catch(() => {});
  }
  // after the page has settled - it is a reminder, not a gate
  if (document.readyState === 'complete') setTimeout(run, 1200);
  else window.addEventListener('load', () => setTimeout(run, 1200));
})();
