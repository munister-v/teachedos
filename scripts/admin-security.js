(function () {
  const statsPath = '/api/admin/security/overview';

  function currentToken() {
    return localStorage.getItem('teachedos_admin_token');
  }

  async function refreshSecurityBaseline() {
    const sessions = document.getElementById('sec-baseline-sessions');
    const admins = document.getElementById('sec-baseline-admins');
    const failures = document.getElementById('sec-baseline-failures');
    if (!sessions || !admins || !failures || !currentToken()) return;

    try {
      const response = await fetch(statsPath, {
        headers: { Authorization: `Bearer ${currentToken()}` },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Security status unavailable');
      const stats = await response.json();
      const active = Number(stats.activeAdminSessions || 0);
      const activeAdmins = Number(stats.activeAdmins || 0);
      const failed = Number(stats.failedLogins24h || 0);
      sessions.textContent = `${active} live`;
      admins.textContent = `${activeAdmins} active administrator${activeAdmins === 1 ? '' : 's'}; inactive accounts are excluded.`;
      failures.textContent = failed ? `${failed} failed in 24h` : 'No failed logins today';
    } catch {
      sessions.textContent = 'Unavailable';
      admins.textContent = 'Refresh to retry';
      failures.textContent = 'Refresh to retry';
    }
  }

  function enhanceSecurityPage() {
    const original = window.loadSecurityPage;
    if (typeof original === 'function' && !original.__securityBaselineWrapped) {
      const wrapped = function (...args) {
        const result = original.apply(this, args);
        refreshSecurityBaseline();
        return result;
      };
      wrapped.__securityBaselineWrapped = true;
      window.loadSecurityPage = wrapped;
    }
  }

  function enhanceGateAuth() {
    const originalLogin = window.doLogin;
    const originalLogout = window.doLogout;
    if (typeof originalLogin === 'function' && !originalLogin.__controlGateWrapped) {
      const gateLogin = async function () {
        const email = document.getElementById('l-email')?.value.trim() || '';
        const password = document.getElementById('l-pass')?.value || '';
        const error = document.getElementById('login-err');
        const submit = document.querySelector('#login-screen .btn-primary');
        if (!email || !password) {
          if (error) error.textContent = 'Enter your administrator email and password.';
          return;
        }
        if (error) error.textContent = '';
        if (submit) {
          submit.disabled = true;
          submit.textContent = 'Signing in';
        }
        try {
          const response = await fetch('/api/auth/admin-gate/login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.token) throw new Error(payload.error || 'Unable to sign in.');
          localStorage.setItem('teachedos_admin_token', payload.token);
          localStorage.setItem('teachedos_role', 'admin');
          localStorage.setItem('teachedos_user_email', payload.user?.email || email);
          location.replace(location.pathname);
        } catch (err) {
          if (error) error.textContent = err.message || 'Unable to sign in.';
          if (submit) {
            submit.disabled = false;
            submit.textContent = 'Continue';
          }
        }
      };
      gateLogin.__controlGateWrapped = true;
      window.doLogin = gateLogin;
    }
    if (typeof originalLogout === 'function' && !originalLogout.__controlGateWrapped) {
      const gateLogout = async function () {
        await fetch('/api/auth/admin-gate/logout', {
          method: 'POST',
          credentials: 'same-origin',
        }).catch(() => {});
        return originalLogout();
      };
      gateLogout.__controlGateWrapped = true;
      window.doLogout = gateLogout;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      enhanceSecurityPage();
      enhanceGateAuth();
    }, { once: true });
  } else {
    enhanceSecurityPage();
    enhanceGateAuth();
  }
}());
