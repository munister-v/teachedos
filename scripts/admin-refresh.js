(function () {
  const leadingEmoji = /^[\p{Extended_Pictographic}\uFE0F\u200D\u2190-\u21FF\s]+/u;

  function cleanOperationalLabels(root) {
    root.querySelectorAll('.table-header-title,.setting-title,.audit-card-title,.ops-title').forEach((element) => {
      if (element.children.length) return;
      element.textContent = element.textContent.replace(leadingEmoji, '').trim();
    });
  }

  function improveAdminShell() {
    cleanOperationalLabels(document);

    document.querySelectorAll('.sb-item').forEach((item) => {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          item.click();
        }
      });
    });

    const login = document.getElementById('login-screen');
    if (login) {
      login.setAttribute('aria-label', 'TeachEd administrator sign in');
      const tokenPresent = Boolean(localStorage.getItem('teachedos_admin_token'));
      if (tokenPresent) {
        document.documentElement.classList.add('admin-token-present');
        window.setTimeout(() => {
          if (!login.classList.contains('hidden')) {
            document.documentElement.classList.remove('admin-token-present');
          }
        }, 1800);
      }
      new MutationObserver(() => {
        if (login.classList.contains('hidden')) {
          document.documentElement.classList.add('admin-token-present');
        }
      }).observe(login, { attributes: true, attributeFilter: ['class'] });
    }
    const loginError = document.getElementById('login-err');
    if (loginError) loginError.setAttribute('role', 'alert');

    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) cleanOperationalLabels(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', improveAdminShell, { once: true });
  } else {
    improveAdminShell();
  }
})();
