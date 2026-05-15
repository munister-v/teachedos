(function () {
  const storageKey = 'teachedos_pwa_prompt_hidden';
  const iosHintKey = 'teachedos_ios_pwa_hint_hidden';
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isSafari = /safari/i.test(window.navigator.userAgent) && !/chrome|crios|fxios|edgios/i.test(window.navigator.userAgent);
  let installEvent = null;

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
      font-family:Nunito,ui-sans-serif,sans-serif;
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

  window.addEventListener('load', () => {
    if (!installEvent) showIosHint();
  });
})();
