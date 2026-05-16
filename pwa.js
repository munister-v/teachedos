(function () {
  const storageKey = 'teachedos_pwa_prompt_hidden';
  const iosHintKey = 'teachedos_ios_pwa_hint_hidden';
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isSafari = /safari/i.test(window.navigator.userAgent) && !/chrome|crios|fxios|edgios/i.test(window.navigator.userAgent);
  let installEvent = null;
  let statusTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    body.pwa-standalone{
      min-height:100vh;
      padding-top:calc(env(safe-area-inset-top, 0px) + 0px);
      padding-bottom:calc(env(safe-area-inset-bottom, 0px) + 0px);
    }
    .teachedos-install{
      position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9998;
      background:rgba(28,28,30,.94);color:#fff;border-radius:18px;padding:14px 16px;
      box-shadow:0 16px 48px rgba(0,0,0,.24);display:flex;gap:12px;align-items:flex-start;
      transform:translateY(130%);opacity:0;pointer-events:none;transition:transform .2s ease,opacity .2s ease;
      font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Helvetica Neue',Arial,sans-serif;
    }
    .teachedos-install.show{transform:translateY(0);opacity:1;pointer-events:auto}
    .teachedos-install-copy{flex:1;min-width:0}
    .teachedos-install-title{font-size:14px;font-weight:900;line-height:1.25}
    .teachedos-install-sub{font-size:12px;line-height:1.55;color:rgba(255,255,255,.76);margin-top:4px}
    .teachedos-install-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .teachedos-install button{
      border:none;border-radius:999px;padding:9px 12px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;
    }
    .teachedos-install .primary{background:#e85d75;color:#fff}
    .teachedos-install .secondary{background:rgba(255,255,255,.12);color:#fff}
    .teachedos-install-close{
      width:30px;height:30px;border-radius:999px;background:rgba(255,255,255,.08);color:#fff;flex-shrink:0;
      display:flex;align-items:center;justify-content:center
    }
    @media (min-width: 981px){
      .teachedos-install{max-width:420px;left:auto;right:20px}
    }
    .teachedos-status{
      position:fixed;left:16px;right:16px;top:calc(14px + env(safe-area-inset-top,0px));z-index:9997;
      display:flex;align-items:flex-start;gap:12px;padding:13px 14px;border-radius:16px;
      box-shadow:0 14px 36px rgba(0,0,0,.16);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Helvetica Neue',Arial,sans-serif;
      transform:translateY(-140%);opacity:0;pointer-events:none;transition:transform .2s ease,opacity .2s ease;
      backdrop-filter:blur(18px) saturate(1.6);
    }
    .teachedos-status.show{transform:translateY(0);opacity:1;pointer-events:auto}
    .teachedos-status.offline{background:rgba(28,28,30,.94);color:#fff}
    .teachedos-status.online{background:rgba(22,163,74,.94);color:#fff}
    .teachedos-status.update{background:rgba(200,230,50,.96);color:#fff}
    .teachedos-status-copy{flex:1;min-width:0}
    .teachedos-status-title{font-size:13px;font-weight:900;line-height:1.25}
    .teachedos-status-sub{font-size:11px;line-height:1.5;opacity:.84;margin-top:3px}
    .teachedos-status-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .teachedos-status-btn{
      border:none;border-radius:999px;padding:8px 11px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;
      background:rgba(255,255,255,.14);color:inherit;
    }
    .teachedos-status-btn.primary{background:#fff;color:#1C1C1E}
    .teachedos-status-close{
      width:28px;height:28px;border:none;border-radius:999px;background:rgba(255,255,255,.12);color:inherit;cursor:pointer;flex-shrink:0;
    }
    body.pwa-offline::after{
      content:'';position:fixed;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#e85d75,#9f8ce8);z-index:9996;
    }
  `;
  document.head.appendChild(style);

  if (isStandalone) {
    document.body.classList.add('pwa-standalone');
    return;
  }

  function createBanner(title, sub, primaryLabel, onPrimary, dismissKey) {
    if ((dismissKey && localStorage.getItem(dismissKey) === '1')) return null;

    const banner = document.createElement('div');
    banner.className = 'teachedos-install';
    banner.innerHTML = `
      <div class="teachedos-install-copy">
        <div class="teachedos-install-title">${title}</div>
        <div class="teachedos-install-sub">${sub}</div>
        <div class="teachedos-install-actions">
          ${primaryLabel ? `<button class="primary" type="button">${primaryLabel}</button>` : ''}
          <button class="secondary" type="button">Not now</button>
        </div>
      </div>
      <button class="teachedos-install-close" type="button" aria-label="Close">×</button>
    `;

    const close = () => {
      banner.classList.remove('show');
      if (dismissKey) localStorage.setItem(dismissKey, '1');
      setTimeout(() => banner.remove(), 220);
    };

    const primary = banner.querySelector('.primary');
    const secondary = banner.querySelector('.secondary');
    const closeBtn = banner.querySelector('.teachedos-install-close');
    if (primary && onPrimary) primary.addEventListener('click', onPrimary);
    secondary.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('show'));
    return banner;
  }

  let statusBanner = null;
  function ensureStatusBanner() {
    if (statusBanner) return statusBanner;
    statusBanner = document.createElement('div');
    statusBanner.className = 'teachedos-status';
    statusBanner.innerHTML = `
      <div class="teachedos-status-copy">
        <div class="teachedos-status-title"></div>
        <div class="teachedos-status-sub"></div>
        <div class="teachedos-status-actions"></div>
      </div>
      <button class="teachedos-status-close" type="button" aria-label="Close">×</button>
    `;
    statusBanner.querySelector('.teachedos-status-close').addEventListener('click', () => {
      statusBanner.classList.remove('show');
    });
    document.body.appendChild(statusBanner);
    return statusBanner;
  }

  function showStatus(kind, title, sub, actions, options) {
    const opts = options || {};
    const banner = ensureStatusBanner();
    banner.className = `teachedos-status ${kind}`;
    banner.querySelector('.teachedos-status-title').textContent = title;
    banner.querySelector('.teachedos-status-sub').textContent = sub || '';
    const actionsWrap = banner.querySelector('.teachedos-status-actions');
    actionsWrap.innerHTML = '';
    (actions || []).forEach(action => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `teachedos-status-btn${action.primary ? ' primary' : ''}`;
      btn.textContent = action.label;
      btn.addEventListener('click', action.onClick);
      actionsWrap.appendChild(btn);
    });
    requestAnimationFrame(() => banner.classList.add('show'));
    clearTimeout(statusTimer);
    if (opts.autoHideMs) {
      statusTimer = setTimeout(() => banner.classList.remove('show'), opts.autoHideMs);
    }
  }

  function setOfflineState(isOffline) {
    document.body.classList.toggle('pwa-offline', isOffline);
    if (isOffline) {
      showStatus(
        'offline',
        'You are offline',
        'TeachEd will keep working with saved data where available. New changes may wait until you reconnect.',
        [{ label: 'Dismiss', onClick: () => ensureStatusBanner().classList.remove('show') }],
        {}
      );
    } else {
      showStatus(
        'online',
        'Back online',
        'Live data and syncing are available again.',
        [],
        { autoHideMs: 2200 }
      );
    }
  }

  function wireServiceWorkerStatus() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return;
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showStatus(
              'update',
              'Update ready',
              'A fresher version of TeachEd is ready. Reload when you want the newest changes.',
              [
                { label: 'Reload now', primary: true, onClick: () => location.reload() },
                { label: 'Later', onClick: () => ensureStatusBanner().classList.remove('show') }
              ],
              {}
            );
          }
        });
      });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      showStatus(
        'update',
        'TeachEd updated',
        'Reloading into the newest version now.',
        [],
        {}
      );
    });
  }

  function showIosHint() {
    if (!isIos || !isSafari) return;
    createBanner(
      'Install TeachEd on your home screen',
      'In Safari, tap Share and then "Add to Home Screen" to launch TeachEd like an app with its own icon.',
      '',
      null,
      iosHintKey
    );
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvent = e;
    if (localStorage.getItem(storageKey) === '1') return;
    createBanner(
      'Install TeachEd',
      'Add TeachEd to your home screen for faster launch, a cleaner full-screen shell, and better mobile feel.',
      'Install',
      async () => {
        if (!installEvent) return;
        installEvent.prompt();
        const result = await installEvent.userChoice.catch(() => null);
        if (result?.outcome === 'accepted') localStorage.setItem(storageKey, '1');
      },
      storageKey
    );
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem(storageKey, '1');
  });

  window.TeachedosPWA = {
    isStandalone,
    isIos,
    isSafari,
    canPromptInstall: () => Boolean(installEvent),
    promptInstall: async () => {
      if (installEvent) {
        installEvent.prompt();
        return installEvent.userChoice.catch(() => null);
      }
      showIosHint();
      return null;
    },
    showIosHint,
    showStatus,
  };

  window.addEventListener('load', () => {
    if (!installEvent) showIosHint();
    wireServiceWorkerStatus();
    if (!navigator.onLine) setOfflineState(true);
  });

  window.addEventListener('offline', () => setOfflineState(true));
  window.addEventListener('online', () => setOfflineState(false));
})();
