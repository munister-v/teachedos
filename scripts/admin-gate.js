(function () {
  const form = document.getElementById('admin-gate-form');
  const email = document.getElementById('admin-gate-email');
  const password = document.getElementById('admin-gate-password');
  const submit = document.getElementById('admin-gate-submit');
  const error = document.getElementById('admin-gate-error');
  const toggle = document.getElementById('admin-gate-toggle');

  toggle.addEventListener('click', () => {
    const revealed = password.type === 'text';
    password.type = revealed ? 'password' : 'text';
    toggle.textContent = revealed ? 'Show' : 'Hide';
    toggle.setAttribute('aria-label', revealed ? 'Show password' : 'Hide password');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const emailValue = email.value.trim();
    const passwordValue = password.value;
    if (!emailValue || !passwordValue) {
      error.textContent = 'Enter your administrator email and password.';
      (!emailValue ? email : password).focus();
      return;
    }
    error.textContent = '';
    submit.disabled = true;
    submit.textContent = 'Signing in';
    try {
      const response = await fetch('/api/auth/admin-gate/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue, password: passwordValue }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.token) throw new Error(payload.error || 'Unable to sign in.');
      localStorage.setItem('teachedos_admin_token', payload.token);
      localStorage.setItem('teachedos_role', 'admin');
      localStorage.setItem('teachedos_user_email', payload.user?.email || emailValue);
      location.replace(location.pathname.replace(/access\/?$/, ''));
    } catch (err) {
      error.textContent = err.message || 'Unable to sign in.';
      submit.disabled = false;
      submit.textContent = 'Continue';
    }
  });

  email.focus();
}());
