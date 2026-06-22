(function () {
  const API_BASE = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech')));
  const DEFAULT_TIME_ZONE = 'Europe/Kyiv';
  const PLAN_CATALOG = {
    free: {
      key: 'free',
      name: 'Free',
      limits: { boards: 3, studentsPerBoard: 5, courses: 1, storageMb: 75, historySnapshots: 2 },
      flags: { analytics: false, adminPanel: false, realtime: false, exports: false, customBranding: false, bulkInvite: false }
    },
    pro: {
      key: 'pro',
      name: 'Teacher Pro',
      limits: { boards: -1, studentsPerBoard: 30, courses: 20, storageMb: 1500, historySnapshots: 13 },
      flags: { analytics: true, adminPanel: false, realtime: true, exports: true, customBranding: false, bulkInvite: false }
    },
    school: {
      key: 'school',
      name: 'School',
      limits: { boards: -1, studentsPerBoard: -1, courses: -1, storageMb: 6000, historySnapshots: 40 },
      flags: { analytics: true, adminPanel: true, realtime: true, exports: true, customBranding: true, bulkInvite: true }
    }
  };

  function normalizePlanKey(plan) {
    return PLAN_CATALOG[plan] ? plan : 'free';
  }

  function planDefinition(plan) {
    return PLAN_CATALOG[normalizePlanKey(plan)];
  }

  function planLimit(plan, key) {
    return planDefinition(plan).limits[key];
  }

  function planHasFeature(plan, key) {
    return !!planDefinition(plan).flags[key];
  }

  function isPlanAccessActive(user) {
    const plan = normalizePlanKey(user?.plan);
    if (plan === 'free') return false;
    const status = user?.plan_status || 'active';
    if (!['active', 'grace'].includes(status)) return false;
    if (!user?.plan_expires_at) return true;
    const expiresAt = new Date(user.plan_expires_at).getTime();
    return Number.isNaN(expiresAt) || expiresAt > Date.now();
  }

  function effectiveUserPlan(user) {
    const plan = normalizePlanKey(user?.plan);
    if (plan === 'free') return 'free';
    return isPlanAccessActive(user) ? plan : 'free';
  }

  function userPlan(user) {
    return effectiveUserPlan(user);
  }

  function upgradeMessage(featureKey) {
    const messages = {
      analytics: 'Analytics are available on Teacher Pro or School.',
      exports: 'Exports are available on Teacher Pro or School.',
      realtime: 'Live collaboration is available on Teacher Pro or School.',
      bulkInvite: 'Bulk invite is available on the School package.',
      adminPanel: 'Admin-wide controls are available on the School package.',
      customBranding: 'Custom branding is available on the School package.',
    };
    return messages[featureKey] || 'This feature is not available on your current package.';
  }

  function browserTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
    } catch {
      return DEFAULT_TIME_ZONE;
    }
  }

  function isValidTimeZone(zone) {
    try {
      Intl.DateTimeFormat('en-GB', { timeZone: zone || DEFAULT_TIME_ZONE }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }

  function safeTimeZone(zone) {
    return isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
  }

  function formatZoneNow(zone, options) {
    return new Date().toLocaleString([], {
      timeZone: safeTimeZone(zone),
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      ...(options || {})
    });
  }

  function timeZoneOffsetMinutes(date, zone) {
    const label = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimeZone(zone),
      timeZoneName: 'shortOffset',
      hour: '2-digit'
    }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value || 'GMT';
    const match = label.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * ((Number(match[2]) || 0) * 60 + (Number(match[3]) || 0));
  }

  function describeTimeZoneDifference(baseZone, otherZone, date, options) {
    const diff = timeZoneOffsetMinutes(date || new Date(), otherZone) - timeZoneOffsetMinutes(date || new Date(), baseZone);
    if (!diff) return options?.sameLabel || 'Same local time';
    const hours = Math.abs(diff) / 60;
    const pretty = Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
    const ahead = options?.aheadSuffix || 'ahead';
    const behind = options?.behindSuffix || 'behind';
    return diff > 0 ? `${pretty} ${ahead}` : `${pretty} ${behind}`;
  }

  // Mid-session 401 handler — show a banner once, redirect after 4 s.
  // Pages can suppress the auto-redirect by setting window.__teachedNoRedirectOn401.
  var _sessionExpiredShown = false;
  function _handleSessionExpired() {
    if (_sessionExpiredShown) return;
    _sessionExpiredShown = true;
    window.dispatchEvent(new CustomEvent('teached:session-expired'));
    // Inject a non-intrusive top banner.
    var el = document.createElement('div');
    el.id = 'teached-session-banner';
    el.setAttribute('style', [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:999999',
      'background:#dc2626', 'color:#fff', 'padding:12px 20px',
      'text-align:center', 'font:14px/1.4 system-ui,sans-serif',
      'box-shadow:0 2px 8px rgba(0,0,0,.25)'
    ].join(';'));
    el.innerHTML = 'Your session has expired. ' +
      '<a href="/index.html" style="color:#fff;font-weight:700;text-decoration:underline">Sign in again →</a>';
    if (document.body) document.body.prepend(el);
    else document.addEventListener('DOMContentLoaded', function() { document.body.prepend(el); });
    if (!window.__teachedNoRedirectOn401) {
      setTimeout(function() { window.location.href = '/index.html'; }, 4000);
    }
  }

  function createApiClient(getToken) {
    // Paths where 401 is expected and should NOT trigger the banner.
    var AUTH_PATHS = ['/api/auth/login', '/api/auth/me', '/api/auth/google', '/api/auth/register'];
    return function apiFetch(path, opts) {
      var options = opts || {};
      var headers = Object.assign({}, options.headers || {});
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      var token = typeof getToken === 'function' ? getToken() : getToken;
      if (token) headers.Authorization = 'Bearer ' + token;
      var body = options.body == null
        ? undefined
        : (typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      return fetch(API_BASE + path, Object.assign({}, options, { headers: headers, body: body }))
        .then(function(resp) {
          if (resp.status === 401 && AUTH_PATHS.indexOf(path) === -1) {
            _handleSessionExpired();
          }
          return resp;
        });
    };
  }

  window.TeachEdApp = {
    API_BASE,
    PLAN_CATALOG,
    createApiClient,
    DEFAULT_TIME_ZONE,
    browserTimeZone,
    isValidTimeZone,
    safeTimeZone,
    formatZoneNow,
    timeZoneOffsetMinutes,
    describeTimeZoneDifference,
    normalizePlanKey,
    planDefinition,
    planLimit,
    planHasFeature,
    isPlanAccessActive,
    effectiveUserPlan,
    userPlan,
    upgradeMessage,
  };
})();
