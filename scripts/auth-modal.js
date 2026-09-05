/* ════════════════════════════════════════════════════════════════════════
   TeachEd shared auth modal (sign in / register / forgot password)

   Used to be two nearly-identical ~350-line copies - one inline in
   landing.html, one in scripts/board-app.js - that had already drifted once
   (the height-animation "jitter" fix landed in board-app.js a day before it
   was ported to landing.html by hand). One copy now: this file owns the
   modal's markup, validation, Google Sign-In wiring and the Sign in <->
   Register height animation. Each host page only supplies what's actually
   page-specific - what happens after a successful sign-in, and a couple of
   small cosmetic knobs - via window.TEACHED_AUTH_CONFIG, set in a small
   inline <script> BEFORE this file loads.

   TEACHED_AUTH_CONFIG shape (all fields optional):
     onSuccess(data)       - called with the {token,user,isNewUser} response
                              after a successful login/register/Google
                              sign-in. Default: store token/role/email and
                              redirect to index.html (student.html for
                              students).
     subtitle()            - returns the string for the sign-in subtitle.
                              Default: 'Sign in to your workspace'.
     overlayClass          - extra class(es) on the overlay element, for a
                              page's own entrance-animation tuning (e.g.
                              board.html's 'board-auth-overlay').
     cardClass             - same, on the card element (e.g. 'board-auth-card').
     focusTrap             - keep Tab inside the dialog while open (board.html
                              wants this because tabbing past the modal walks
                              into board cards behind it; landing.html does
                              not need it). Default: false.
     closeOnBackdropClick  - Default: true.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  const cfg = window.TEACHED_AUTH_CONFIG || {};

  const API = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:4000'
    : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech')));

  let mode = 'login'; // 'login' | 'register' | 'forgot'
  let role = 'teacher';
  let gsiInit = false, gsiClientId = null;
  let navigating = false;
  let returnFocus = null;

  const $ = id => document.getElementById(id);

  const EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_CLOSED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2"/><path d="M6.1 6.1A18.4 18.4 0 0 0 1 12s4 8 11 8a10 10 0 0 0 5.9-2.1"/></svg>';

  /* ── Build & inject the modal once ─────────────────────────────────── */
  function ensureModal() {
    if ($('auth-overlay')) return;
    const overlayClass = ['auth-overlay', cfg.overlayClass].filter(Boolean).join(' ');
    const cardClass = ['auth-card', cfg.cardClass].filter(Boolean).join(' ');
    const wrap = document.createElement('div');
    wrap.innerHTML = `
<div id="auth-overlay" class="${overlayClass}">
  <div id="auth-modal" class="${cardClass}" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <!-- Титульная полоса как у окон рабочего стола: вход перестал быть
         «ещё одной карточкой по центру» и читается как окно TeachEd. -->
    <div class="auth-titlebar">
      <img class="auth-tb-logo" src="logo-sm.png" alt="" width="20" height="20" aria-hidden="true">
      <span class="auth-tb-name">TeachEd</span>
      <button type="button" class="auth-close" aria-label="Close sign-in" onclick="closeAuthModal()">×</button>
    </div>
    <div class="auth-body">
    <div class="auth-head">
      <img class="auth-logo" src="logo-sm.png" alt="TeachEd" width="48" height="48">
      <div id="auth-title" class="auth-title">Sign in to your workspace</div>
      <div id="auth-subtitle" class="auth-sub">Lessons, boards and games in one place</div>
    </div>
    <div id="auth-err" class="auth-err" role="alert" aria-live="assertive"></div>
    <div id="auth-google-area" class="auth-google-area">
      <div class="auth-google-btn" id="auth-google-btn"></div>
      <div class="auth-or"><span class="auth-or-line"></span><span>OR</span><span class="auth-or-line"></span></div>
    </div>
    <div id="auth-role-row" class="auth-role-row" style="display:none;">
      <div class="auth-role-lbl">I am a…</div>
      <div class="auth-role-grid">
        <button type="button" class="auth-role auth-role-btn active sel" data-role="teacher" onclick="selectAuthRole('teacher')" aria-pressed="true">
          <div class="auth-role-ic">🧑‍🏫</div><div class="auth-role-name">Teacher</div><div class="auth-role-desc">Create &amp; manage</div>
        </button>
        <button type="button" class="auth-role auth-role-btn" data-role="student" onclick="selectAuthRole('student')" aria-pressed="false">
          <div class="auth-role-ic">🎓</div><div class="auth-role-name">Student</div><div class="auth-role-desc">Learn &amp; progress</div>
        </button>
      </div>
    </div>
    <div id="auth-fields"></div>
    <button id="auth-submit" class="auth-btn" type="submit" form="auth-form" aria-describedby="auth-security-note">
      <span class="auth-btn-spinner"></span><span class="auth-btn-lbl">Sign in</span>
    </button>
    <p class="auth-security-note" id="auth-security-note">Protected sign-in · you can end active sessions from your profile.</p>
    <div class="auth-toggle">
      <span id="auth-toggle-text">Don't have an account?</span>
      <button type="button" onclick="toggleAuthMode()" id="auth-toggle-link">Register</button>
    </div>
    </div>
  </div>
</div>`;
    document.body.appendChild(wrap.firstElementChild);

    if (cfg.closeOnBackdropClick !== false) {
      $('auth-overlay').addEventListener('mousedown', e => { if (e.target === e.currentTarget) closeAuthModal(); });
    }
  }

  /* ── Focus trap (opt-in; board.html wants it, landing.html doesn't) ── */
  function authKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeAuthModal(); return; }
    if (!cfg.focusTrap || e.key !== 'Tab') return;
    const ov = $('auth-overlay');
    const f = [...ov.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function markOnboardingPending(user) {
    try {
      const email = user?.email || 'anon';
      localStorage.setItem('teachedos_onboarding_pending', '1');
      localStorage.setItem('teachedos_onboarding_pending_' + email, '1');
    } catch {}
  }

  function defaultOnSuccess(d) {
    localStorage.setItem('teachedos_token', d.token);
    localStorage.setItem('teachedos_role', d.user.role);
    if (d.user.email) localStorage.setItem('teachedos_user_email', d.user.email);
    if (d.isNewUser) markOnboardingPending(d.user);
    navigating = true;
    const btn = $('auth-submit');
    const lbl = btn?.querySelector('.auth-btn-lbl');
    $('auth-overlay')?.classList.add('is-success');
    if (btn) { btn.classList.remove('loading'); btn.classList.add('success'); btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    if (lbl) lbl.textContent = 'Opening workspace…';
    setTimeout(() => { location.href = afterLoginTarget(d.user.role); }, 300);
  }

  /* Куда возвращаться после входа. Кнопка «Sign in» с любой страницы
     (scripts/signin-entry.js) кладёт сюда адрес, с которого ушли: ученик,
     открывший ссылку на урок, после логина должен попасть на урок, а не на
     дашборд, где этой ссылки уже не найти.
     Разрешаем только свои относительные пути - иначе значение из
     sessionStorage превращается в открытый редирект на чужой домен. */
  function afterLoginTarget(role) {
    var fallback = role === 'student' ? 'student.html' : 'index.html';
    var back;
    try {
      back = sessionStorage.getItem('teachedos_return_to');
      sessionStorage.removeItem('teachedos_return_to');
    } catch (e) { return fallback; }
    if (!back) return fallback;
    // «/path», но не «//host» и не «/\host»
    if (!/^\/[^/\\]/.test(back)) return fallback;
    if (/^\/(index|student|landing)\.html/.test(back)) return fallback;
    return back;
  }

  async function handleSuccess(d) {
    if (mode === 'register') d.isNewUser = true;
    if (typeof cfg.onSuccess === 'function') {
      await cfg.onSuccess(d);
    } else {
      defaultOnSuccess(d);
    }
  }

  function clearAuthMessage() {
    const err = $('auth-err');
    if (!err) return;
    err.style.display = 'none';
    err.style.color = '';
    err.style.background = '';
    err.style.borderColor = '';
  }

  window.openAuthModal = function (m = 'login') {
    ensureModal();
    // Already signed in and no custom success handler needing this modal's
    // context (a pending import etc.) - go straight to the app.
    const tok = localStorage.getItem('teachedos_token');
    if (tok && !cfg.onSuccess) { location.href = localStorage.getItem('teachedos_role') === 'student' ? 'student.html' : 'index.html'; return; }
    mode = (m === 'register' || m === 'forgot') ? m : 'login';
    clearAuthMessage();
    const ov = $('auth-overlay');
    if (!ov.classList.contains('open')) returnFocus = document.activeElement;
    renderFields();
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', authKeydown, true);
    setTimeout(() => document.querySelector('.auth-inp')?.focus(), 50);
    if (mode === 'login') setupGoogle();
    if (typeof cfg.subtitle === 'function') {
      const sub = $('auth-subtitle');
      if (sub) sub.textContent = cfg.subtitle();
    }
  };
  // Back-compat name used by a couple of older call sites.
  window.openAuth = window.openAuthModal;

  window.closeAuthModal = function () {
    if (navigating) return;
    $('auth-overlay')?.classList.remove('open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', authKeydown, true);
    try { returnFocus?.focus?.(); } catch {}
    returnFocus = null;
  };
  window.closeAuth = window.closeAuthModal;

  window.toggleAuthMode = function () {
    mode = (mode === 'login') ? 'register' : 'login';
    clearAuthMessage();
    renderFields();
    if (mode === 'login') setupGoogle();
  };

  window.selectAuthRole = function (r) {
    role = r;
    document.querySelectorAll('.auth-role-btn').forEach(b => {
      const active = b.dataset.role === r;
      b.classList.toggle('active', active);
      b.classList.toggle('sel', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };
  window.selectRole = window.selectAuthRole; // landing.html's old name

  window.togglePassVis = function () {
    const inp = $('af-pass');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    const eye = inp.parentElement?.querySelector('.auth-eye');
    if (eye) {
      const visible = inp.type === 'text';
      eye.innerHTML = visible ? EYE_CLOSED : EYE_OPEN;
      eye.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
      eye.setAttribute('aria-pressed', visible ? 'true' : 'false');
    }
  };

  function passwordHint(value) {
    const help = $('auth-password-help');
    if (!help) return;
    const len = String(value || '').length;
    help.classList.toggle('ready', len >= 10);
    help.classList.toggle('needs-input', len > 0 && len < 10);
    help.textContent = len >= 10
      ? 'Length looks good. A memorable multi-word passphrase is best.'
      : `Use at least 10 characters${len ? ` · ${10 - len} more needed` : ''}.`;
  }

  /* ── Sign in <-> Register swaps the Google block and role picker with
     nothing in between, so the card used to just snap to a different
     height on every toggle - the reported "jitter". Measure before/after
     and glide between them. Skipped on first open (nothing to jump from
     yet). ── */
  function renderFields() {
    const card = $('auth-modal');
    const wasOpen = card && $('auth-overlay')?.classList.contains('open');
    const fromHeight = wasOpen ? card.getBoundingClientRect().height : null;
    renderFieldsInner();
    if (wasOpen && fromHeight != null) {
      const toHeight = card.getBoundingClientRect().height;
      if (Math.abs(toHeight - fromHeight) > 1) {
        card.style.height = fromHeight + 'px';
        card.style.overflow = 'hidden';
        card.offsetHeight; // force layout so the start height registers before the target is applied
        card.style.transition = 'height .26s cubic-bezier(.22,.61,.36,1)';
        card.style.height = toHeight + 'px';
        const done = () => {
          card.style.transition = '';
          card.style.height = '';
          card.style.overflow = '';
          card.removeEventListener('transitionend', done);
        };
        card.addEventListener('transitionend', done);
      }
    }
  }

  function renderFieldsInner() {
    const isLogin = mode === 'login';
    const isForgot = mode === 'forgot';
    const title = $('auth-title');
    if (title) title.textContent = isForgot ? 'Reset your password' : (isLogin ? 'Sign in to your workspace' : 'Create your account');
    $('auth-subtitle').textContent = isForgot
      ? 'We will email you a link to set a new one'
      : (typeof cfg.subtitle === 'function' ? cfg.subtitle()
        : (isLogin ? 'Lessons, boards and games in one place' : 'Free while you are getting started'));
    const btn = $('auth-submit');
    const lbl = btn.querySelector('.auth-btn-lbl');
    if (lbl) lbl.textContent = isForgot ? 'Send reset link' : (isLogin ? 'Sign in' : 'Create account');
    btn.classList.remove('loading', 'success'); btn.disabled = false; btn.setAttribute('aria-busy', 'false');
    $('auth-toggle-text').textContent = isForgot ? 'Remember your password?' : (isLogin ? "Don't have an account?" : 'Already have an account?');
    const toggleLink = $('auth-toggle-link');
    toggleLink.textContent = isForgot ? 'Sign in' : (isLogin ? 'Register' : 'Sign in');
    toggleLink.onclick = isForgot ? () => { mode = 'login'; renderFields(); setupGoogle(); } : window.toggleAuthMode;
    $('auth-role-row').style.display = (!isLogin && !isForgot) ? 'block' : 'none';
    const googleArea = $('auth-google-area');
    if (googleArea) googleArea.style.display = isLogin ? 'block' : 'none';
    const securityNote = $('auth-security-note');
    if (securityNote) securityNote.textContent = isForgot
      ? 'For privacy, we only confirm that a reset message may have been sent.'
      : (isLogin ? 'Protected sign-in · you can end active sessions from your profile.' : 'Use 10 or more characters. You can manage active sessions after sign-in.');

    const f = $('auth-fields');
    if (isForgot) {
      f.innerHTML = `<div class="auth-field-wrap"><label class="auth-field-label" for="af-email">Email address</label><input class="auth-inp" id="af-email" name="email" type="email" maxlength="254" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="you@example.com" autocomplete="email"></div>`;
    } else {
      f.innerHTML = (!isLogin ? `<div class="auth-field-wrap"><label class="auth-field-label" for="af-name">Your name</label><input class="auth-inp" id="af-name" name="name" type="text" maxlength="120" placeholder="Your full name" autocomplete="name"></div>` : '') +
        `<div class="auth-field-wrap"><label class="auth-field-label" for="af-email">Email address</label><input class="auth-inp" id="af-email" name="email" type="email" maxlength="254" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" placeholder="you@example.com" autocomplete="email"></div>
         <div class="auth-field-wrap auth-password-field"><label class="auth-field-label" for="af-pass">Password</label><div class="auth-pass-wrap">
           <input class="auth-inp" id="af-pass" name="password" type="password" maxlength="72" enterkeyhint="${isLogin ? 'go' : 'done'}" placeholder="${isLogin ? 'Your password' : '10 or more characters'}" autocomplete="${isLogin ? 'current' : 'new'}-password">
           <button type="button" class="auth-eye" onclick="togglePassVis()" aria-label="Show password" aria-pressed="false">${EYE_OPEN}</button>
         </div>${!isLogin ? '<p class="auth-password-help" id="auth-password-help">Use at least 10 characters.</p>' : ''}</div>
         ${isLogin ? `<div class="auth-forgot"><button type="button" onclick="openAuthModal('forgot')">Forgot password?</button></div>` : ''}`;
    }
    /* A real <form>: password managers and mobile autofill key off form
       structure and a submit button, not a set of inputs in a div. */
    const form = document.createElement('form');
    form.id = 'auth-form';
    form.noValidate = true;
    form.addEventListener('submit', e => { e.preventDefault(); submitAuth(); });
    while (f.firstChild) form.appendChild(f.firstChild);
    f.appendChild(form);
    f.querySelectorAll('.auth-inp').forEach(i => {
      i.addEventListener('keydown', e => { if (e.key === 'Enter' && i.id !== 'af-email') { e.preventDefault(); submitAuth(); } });
    });
    $('af-pass')?.addEventListener('input', e => passwordHint(e.target.value));
    if (!isLogin && !isForgot) $('af-name')?.focus(); else $('af-email')?.focus();
  }

  window.submitAuth = async function () {
    const email = $('af-email')?.value.trim();
    const pass = $('af-pass')?.value;
    const name = $('af-name')?.value?.trim();
    const err = $('auth-err');
    const btn = $('auth-submit');
    err.style.color = '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      err.textContent = 'Please enter a valid email address.'; err.style.display = 'block'; $('af-email')?.focus(); return;
    }
    if (mode === 'forgot') return submitForgot(email, err, btn);
    if (!pass) { err.textContent = 'Please enter your password.'; err.style.display = 'block'; $('af-pass')?.focus(); return; }
    if (mode === 'register' && pass.length < 10) { err.textContent = 'Password must be at least 10 characters.'; err.style.display = 'block'; $('af-pass')?.focus(); return; }
    if (pass.length > 72) { err.textContent = 'Password is too long. Use 72 characters or fewer.'; err.style.display = 'block'; $('af-pass')?.focus(); return; }
    if (mode === 'register' && !name) { err.textContent = 'Please enter your name.'; err.style.display = 'block'; $('af-name')?.focus(); return; }
    if (mode === 'register' && name.length > 120) { err.textContent = 'Your name is too long. Use 120 characters or fewer.'; err.style.display = 'block'; $('af-name')?.focus(); return; }

    err.style.display = 'none';
    btn.classList.add('loading'); btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    const lbl = btn.querySelector('.auth-btn-lbl');
    if (lbl) lbl.textContent = mode === 'login' ? 'Signing in…' : 'Creating account…';
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password: pass } : { email, password: pass, name, role };
      const r = await fetch(API + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Something went wrong');
      await handleSuccess(d);
    } catch (e) {
      err.textContent = e.message; err.style.display = 'block';
      btn.classList.remove('loading'); btn.disabled = false; btn.setAttribute('aria-busy', 'false');
      if (lbl) lbl.textContent = mode === 'login' ? 'Sign in' : 'Create account';
    }
  };

  async function submitForgot(email, err, btn) {
    err.style.display = 'none';
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    const lbl = btn.querySelector('.auth-btn-lbl');
    if (lbl) lbl.textContent = 'Sending…';
    let sent = false;
    try {
      await fetch(API + '/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      err.style.background = 'rgba(240,255,245,.97)'; err.style.borderColor = 'rgba(22,163,74,.24)'; err.style.color = '#166534';
      err.textContent = '✓ If that email is registered, a reset link is on its way.';
      err.style.display = 'block';
      if (lbl) lbl.textContent = 'Check your inbox';
      $('auth-fields').innerHTML = '';
      sent = true;
    } catch {
      err.style.color = '#c62828';
      err.textContent = 'Something went wrong. Please try again.';
      err.style.display = 'block';
    } finally {
      btn.removeAttribute('aria-busy');
      btn.disabled = sent;
      if (!sent && lbl) lbl.textContent = 'Send reset link';
    }
  }

  /* ── Google Identity Services ── */
  function loadGsi() {
    return new Promise((res, rej) => {
      if (window.google?.accounts?.id) return res();
      const ex = document.getElementById('teached-gsi-script');
      if (ex) { ex.addEventListener('load', res, { once: true }); ex.addEventListener('error', rej, { once: true }); return; }
      const s = document.createElement('script');
      s.id = 'teached-gsi-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  async function initGsi() {
    if (gsiInit) return true;
    try {
      const cfgResp = await (await fetch(API + '/api/auth/config')).json();
      if (!cfgResp.googleClientId) return false;
      gsiClientId = cfgResp.googleClientId;
      await loadGsi();
      google.accounts.id.initialize({ client_id: gsiClientId, callback: onGoogle, auto_select: false, cancel_on_tap_outside: true, context: 'signin', itp_support: true });
      gsiInit = true; return true;
    } catch (e) { console.warn('[auth-modal] gsi init failed', e); return false; }
  }
  async function setupGoogle() {
    // renderFields() уже открыла область синхронно (googleArea.style.display
    // = 'block' для входа), не дожидаясь этой функции - иначе кнопка Google
    // моргала бы пустым местом при каждом открытии формы. Но это значит, что
    // до сюда область всегда раскрыта, и на любом пути отказа её нужно
    // закрыть явно, а не молча выйти. Раньше `if (!ok) return` делал именно
    // это: initGsi проваливался (нет сети до accounts.google.com,
    // заблокирован скрипт, не поднялась /api/auth/config) - и в окне
    // навсегда оставалась пустая полоса с одиноким разделителем «OR» над
    // пустым местом высотой в кнопку. На телефоне, где под формой каждый
    // пиксель на счету, это ещё и отодвигало поля вниз без всякой причины.
    const ok = await initGsi();
    const area = $('auth-google-area');
    if (!ok) { if (area) area.style.display = 'none'; return; }
    const wrap = $('auth-google-btn');
    if (!area || !wrap) return;
    // Показываем блок только когда кнопка Google действительно отрисовалась.
    // Раньше область раскрывалась до вызова renderButton, и если GSI не
    // поднялся (нет сети, заблокирован скрипт), в окне оставалась пустая
    // полоса с одиноким разделителем «OR».
    wrap.innerHTML = '';
    requestAnimationFrame(() => {
      try {
        const width = Math.min(336, Math.max(240, ($('auth-modal')?.clientWidth || 400) - 60));
        google.accounts.id.renderButton(wrap, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width, logo_alignment: 'center', locale: 'en' });
      } catch (e) { console.warn('[auth-modal] gsi renderButton', e); area.style.display = 'none'; return; }
      area.style.display = wrap.childElementCount ? 'block' : 'none';
    });
  }
  async function onGoogle(resp) {
    const err = $('auth-err'); if (err) { err.style.display = 'none'; err.style.color = ''; }
    try { google.accounts.id.cancel(); } catch (_) {}
    const btn = $('auth-submit');
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    try {
      const r = await fetch(API + '/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: resp.credential, role }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Google sign-in failed');
      await handleSuccess(d);
    } catch (e) {
      if (err) { err.textContent = e.message; err.style.display = 'block'; }
    } finally {
      if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
    }
  }

  /* Клавиатура на телефоне ужимает visualViewport, а не сам документ: карточка
     входа занимает весь экран (@media 540px в auth.css), «Sign in» лежит на
     фиксированной высоте от начала формы, и ничто не подводило активное поле
     или саму кнопку под сузившийся видимый прямоугольник. На узком экране
     кнопка уходит ниже клавиатуры целиком - добраться до неё можно было,
     только вручную закрыв клавиатуру. Оверлей уже прокручиваемый
     (overflow-y:auto), не хватало только команды на прокрутку.

     Слушатель один на всё приложение (модалка переживает несколько открытий
     за сеанс), сработавший input проверяется на месте по .auth-inp внутри
     #auth-overlay, поэтому лишней работы на остальных полях страницы нет.

     Прокрутка - мгновенная, не smooth. Сначала стояло
     scrollTo({top,behavior:'smooth'}) (а до него - el.scrollIntoView с тем
     же behavior); оба замерены и оба ненадёжны здесь: на сильно суженном
     экране один проход анимации останавливался на трети заданного пути
     (64px из нужных ~230), кнопка оставалась ниже кадра, и лишь второй такой
     же вызов дотягивал до места - похоже на неровность Chromium со
     smooth-прокруткой внутри вложенного скролл-контейнера при недавнем
     изменении метрик вьюпорта, а это ровно наш случай (клавиатура). Прямое
     присвоение scrollTop бьёт точно в цель одним прыжком - без плавности,
     зато без риска, что кнопка так и останется скрытой. */
  function scrollFocusedAuthFieldIntoView() {
    const el = document.activeElement;
    if (!el || !el.classList || !el.classList.contains('auth-inp')) return;
    const overlay = document.getElementById('auth-overlay');
    if (!overlay || !overlay.contains(el)) return;
    const overlayRect = overlay.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elCenter = (elRect.top + elRect.bottom) / 2 - overlayRect.top;
    const delta = elCenter - overlayRect.height / 2;
    const maxScroll = Math.max(0, overlay.scrollHeight - overlay.clientHeight);
    const target = Math.min(Math.max(0, overlay.scrollTop + delta), maxScroll);
    overlay.scrollTop = target;
  }
  document.addEventListener('focusin', e => {
    if (!e.target.classList || !e.target.classList.contains('auth-inp')) return;
    // Клавиатура анимированно выезжает ~250-300мс; scrollIntoView раньше
    // целится в высоту ДО её появления и промахивается.
    setTimeout(scrollFocusedAuthFieldIntoView, 320);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scrollFocusedAuthFieldIntoView);
  }
})();
