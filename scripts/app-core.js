(function () {
  const API_BASE = 'https://teachedos-api.onrender.com';
  const DEFAULT_TIME_ZONE = 'Europe/Kyiv';

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

  function createApiClient(getToken) {
    return function apiFetch(path, opts) {
      const options = opts || {};
      const headers = { ...(options.headers || {}) };
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      const token = typeof getToken === 'function' ? getToken() : getToken;
      if (token) headers.Authorization = `Bearer ${token}`;
      const body = options.body == null
        ? undefined
        : (typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      return fetch(API_BASE + path, {
        ...options,
        headers,
        body
      });
    };
  }

  window.TeachEdApp = {
    API_BASE,
    createApiClient,
    DEFAULT_TIME_ZONE,
    browserTimeZone,
    isValidTimeZone,
    safeTimeZone,
    formatZoneNow,
    timeZoneOffsetMinutes,
    describeTimeZoneDifference,
  };
})();
