/* ════════════════════════════════════════════════════════════════
   profile-app.js - TeachEd Profile page logic
   Extracted from the inline <script> block for HTTP/SW cacheability
   (loads after app-core.js, same as before)
   ════════════════════════════════════════════════════════════════ */
const PROFILE_CACHE_KEY = 'teachedos_profile_cache_v1';
let token = localStorage.getItem('teachedos_token');
let me = null;
let selectedAvatar = null;
let billingOverview = null;
let billingPlans = null;
const {
  createApiClient,
  DEFAULT_TIME_ZONE,
  browserTimeZone,
  isValidTimeZone,
  planHasFeature,
  userPlan,
  upgradeMessage
} = window.TeachEdApp;
const apiFetch = createApiClient(() => token);
const TIME_ZONE_OPTIONS = [
  'Europe/Kyiv','Europe/Warsaw','Europe/Berlin','Europe/Madrid','Europe/Paris','Europe/London',
  'Europe/Rome','Europe/Prague','Europe/Vilnius','Europe/Helsinki','Europe/Istanbul',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Toronto',
  'America/Sao_Paulo','Asia/Dubai','Asia/Tbilisi','Asia/Almaty','Asia/Bangkok','Asia/Tokyo',
  'Asia/Seoul','Asia/Singapore','Australia/Sydney'
];

const AVATARS = ['🧑‍🏫','👩‍🏫','👨‍🏫','🦸','🦸‍♀️','🎓','📚','✏️','🌟','💡','🎨','🎭','🌸','🦊','🐧','🦉','🐸','🐱','🐶','🦄'];

// ── Helpers ──────────────────────────────────────────────────
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let toastTimer;
function toast(msg, dur = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), dur);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setDisplay(id, value) {
  const el = document.getElementById(id);
  if (el) el.style.display = value;
}

function readProfileCache() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeProfileCache(patch) {
  try {
    const current = readProfileCache() || {};
    const next = { ...current, ...patch, cachedAt: new Date().toISOString() };
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(next));
  } catch {}
}

function updateMobileProfileSummary(options = {}) {
  const eyebrow = document.getElementById('mobile-profile-eyebrow');
  const title = document.getElementById('mobile-profile-title');
  const copy = document.getElementById('mobile-profile-copy');
  if (!eyebrow || !title || !copy) return;
  const firstName = me?.name ? me.name.split(' ')[0] : 'Teacher';
  eyebrow.textContent = `${me?.avatar || '🧑‍🏫'} ${firstName}'s profile`;
  title.textContent = options.offline
    ? 'Offline profile snapshot ready'
    : `${firstName}, your workspace settings are ready`;
  const boardCount = Array.isArray(boardsCache) ? boardsCache.length : 0;
  const sharedCount = Array.isArray(sharedBoardsCache) ? sharedBoardsCache.length : 0;
  copy.textContent = options.offline
    ? `Offline mode: showing your last saved account view with ${boardCount} boards and ${sharedCount} shared board${sharedCount === 1 ? '' : 's'}.`
    : `Manage ${boardCount} board${boardCount === 1 ? '' : 's'}, review ${sharedCount} shared board${sharedCount === 1 ? '' : 's'}, and keep your account details current from this phone view.`;
}

function effectiveTimeZoneLabel() {
  if (!me) return DEFAULT_TIME_ZONE;
  if (me.timezone_mode === 'manual') return me.timezone || DEFAULT_TIME_ZONE;
  return me.timezone || browserTimeZone() || DEFAULT_TIME_ZONE;
}

function describeTimeZone(timeZone) {
  const zone = timeZone || DEFAULT_TIME_ZONE;
  const local = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: zone });
  return `${zone} · ${local}`;
}

function renderTimeZoneOptions() {
  const list = document.getElementById('timezone-options');
  if (!list) return;
  // Use full IANA list from the browser (all modern browsers support this)
  let zones;
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = TIME_ZONE_OPTIONS;
  }
  list.innerHTML = zones.map(zone => `<option value="${zone}"></option>`).join('');
}

function updateTimeZonePreview() {
  const isAuto = document.getElementById('set-tz-auto')?.checked;
  const input = document.getElementById('set-timezone');
  const rawZone = (isAuto ? browserTimeZone() : input?.value || '').trim();
  const zone = isValidTimeZone(rawZone) ? rawZone : DEFAULT_TIME_ZONE;
  const current = document.getElementById('tz-current-label');
  const preview = document.getElementById('tz-preview-time');
  const detected = document.getElementById('tz-detected-label');
  if (detected) detected.textContent = browserTimeZone();
  if (current) current.textContent = zone;
  if (preview) {
    preview.textContent = new Date().toLocaleString([], {
      timeZone: zone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

function toggleTimeZoneMode(isAuto) {
  const input = document.getElementById('set-timezone');
  if (!input) return;
  input.disabled = !!isAuto;
  if (isAuto) input.value = browserTimeZone();
  updateTimeZonePreview();
}

function initTimeZoneSettings() {
  renderTimeZoneOptions();
  const autoToggle = document.getElementById('set-tz-auto');
  const input = document.getElementById('set-timezone');
  if (!autoToggle || !input || !me) return;
  const isAuto = me.timezone_mode !== 'manual';
  autoToggle.checked = isAuto;
  input.value = isAuto ? browserTimeZone() : (me.timezone || browserTimeZone() || DEFAULT_TIME_ZONE);
  toggleTimeZoneMode(isAuto);
}

async function syncAutoTimeZone(options = {}) {
  if (!me || me.timezone_mode === 'manual') return;
  const detected = browserTimeZone();
  if (!detected || me.timezone === detected) return;
  try {
    const r = await apiFetch('/api/auth/me', { method: 'PATCH', body: { timezone: detected, timezone_mode: 'auto' } });
    if (!r.ok) return;
    const { user } = await r.json();
    me = { ...me, ...user };
    writeProfileCache({ me });
    renderOverview();
    if (!options.silent) toast('Time zone updated from this device');
  } catch {}
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.st-item').forEach(i => i.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  document.querySelector(`.st-item[data-tab="${name}"]`)?.classList.add('active');
  if (name === 'boards') loadBoards();
  if (name === 'shared') loadSharedBoards();
  if (name === 'settings') initSettings();
}

function openPlansSection() {
  switchTab('settings');
  const target = location.hash === '#billing' ? 'iban-payment-section' : 'plan-card';
  setTimeout(() => {
    const el = document.getElementById(target) || document.getElementById('plan-card');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (location.hash === '#billing') {
      selectPlan('pro');
      document.getElementById('iban-payment-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 80);
}

// ── Auth & Init ───────────────────────────────────────────────
async function init() {
  if (!token) {
    window.location.href = 'index.html';
    return;
  }
  const cached = readProfileCache();
  try {
    const r = await apiFetch('/api/auth/me');
    if (!r.ok && !cached?.me) {
      if (r.status === 401 || r.status === 403) {
        ['teachedos_token','teachedos_role','teachedos_user','teachedos_user_email',
         'teachedos_teacher_dashboard_cache_v1'].forEach(k => localStorage.removeItem(k));
        try { google?.accounts?.id?.disableAutoSelect(); } catch {}
      }
      window.location.href = 'index.html'; return;
    }
    if (r.ok) {
      const { user } = await r.json();
      me = user;
      await syncAutoTimeZone({ silent: true });
      writeProfileCache({ me });
    } else {
      me = cached.me;
    }
    selectedAvatar = me.avatar;
    renderOverview();
    // Preload boards & shared lists so tabs don't sit on "Loading..."
    loadBoards().catch(() => {});
    loadSharedBoards().catch(() => {});
    setDisplay('page-loading', 'none');
    if (me.role === 'admin') setDisplay('nb-admin-link', '');
    setText('nb-user-info', me.name.split(' ')[0]);
    setDisplay('nb-user-info', '');
    updateMobileProfileSummary({ offline: !r.ok });
    if (location.hash === '#plans' || location.hash === '#billing') openPlansSection();
  } catch (e) {
    if (cached?.me) {
      me = cached.me;
      selectedAvatar = me.avatar;
      renderOverview(true);
      loadBoards(true).catch(() => {});
      loadSharedBoards(true).catch(() => {});
      setDisplay('page-loading', 'none');
      setText('nb-user-info', me.name.split(' ')[0]);
      setDisplay('nb-user-info', '');
      updateMobileProfileSummary({ offline: true });
      if (location.hash === '#plans' || location.hash === '#billing') openPlansSection();
      toast('Offline mode enabled');
      return;
    }
    window.location.href = 'index.html';
  }
}

async function renderOverview(forceOffline = false) {
  document.getElementById('profile-avatar-big').textContent = me.avatar || '🧑‍🏫';
  document.getElementById('profile-name-big').textContent = me.name;
  document.getElementById('profile-email-big').textContent = me.email;
  document.getElementById('profile-timezone-big').textContent = `🕒 ${describeTimeZone(effectiveTimeZoneLabel())}`;
  document.getElementById('profile-role-badge').textContent = (me.role === 'admin' ? '🛡 Admin' : '🎓 Teacher');

  const planBadges = { free:'', pro:'🚀 Pro', school:'🏫 School' };
  const planBadge = planBadges[me.plan];
  // Remove any existing plan badge first to prevent duplicates (function may be called
  // twice: once from cache, once from API response).
  const existingPlanBadge = document.getElementById('profile-plan-badge');
  if (existingPlanBadge) existingPlanBadge.remove();
  if (planBadge) {
    const el = document.getElementById('profile-role-badge');
    el.insertAdjacentHTML('afterend', `<span id="profile-plan-badge" style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;background:linear-gradient(135deg,rgba(200,230,50,.28),rgba(200,230,50,.14));border:1px solid rgba(200,230,50,.4);font-size:12px;font-weight:650;color:#5a6b00;">${planBadge}</span>`);
  }

  if (me.created_at) {
    const since = new Date(me.created_at);
    document.getElementById('stat-since').textContent =
      isNaN(since) ? '-' : since.toLocaleDateString('en', { month: 'short', year: 'numeric' });
  } else {
    document.getElementById('stat-since').textContent = '-';
  }

  // Load boards for stats
  try {
    const r = await apiFetch('/api/boards');
    const { boards } = await r.json();
    writeProfileCache({ boards });
    document.getElementById('stat-boards').textContent = boards.length;
    const totalCards = boards.reduce((a, b) => a + (parseInt(b.card_count) || 0), 0);
    document.getElementById('stat-cards').textContent = totalCards;

    // Recent boards
    const recentBoards = boards.slice(0, 5);
    const rbl = document.getElementById('recent-boards-list');
    if (!recentBoards.length) {
      rbl.innerHTML = '<div style="color:var(--text-3);font-size:14px;">No boards yet. <a href="board.html" style="color:var(--accent);">Create one!</a></div>';
    } else {
      rbl.innerHTML = recentBoards.map(b => `
        <a class="recent-board-item" href="board.html?id=${esc(b.id)}">
          <div class="rbi-icon">📌</div>
          <div>
            <div class="rbi-name">${esc(b.name)}</div>
            <div class="rbi-meta">${b.card_count || 0} cards · ${new Date(b.updated_at).toLocaleDateString()}</div>
          </div>
        </a>`).join('');
    }
  } catch {
    const cached = readProfileCache();
    const cachedBoards = cached?.boards || [];
    document.getElementById('stat-boards').textContent = cachedBoards.length;
    document.getElementById('stat-cards').textContent = cachedBoards.reduce((a, b) => a + (parseInt(b.card_count) || 0), 0);
    const rbl = document.getElementById('recent-boards-list');
    if (!cachedBoards.length) {
      rbl.innerHTML = `<div style="color:var(--text-3);font-size:14px;">${forceOffline ? 'Offline mode: no saved boards yet.' : 'No boards yet. <a href="board.html" style="color:var(--accent);">Create one!</a>'}</div>`;
    } else {
      rbl.innerHTML = cachedBoards.slice(0, 5).map(b => `
        <a class="recent-board-item" href="board.html?id=${esc(b.id)}">
          <div class="rbi-icon">📌</div>
          <div>
            <div class="rbi-name">${esc(b.name)}</div>
            <div class="rbi-meta">${b.card_count || 0} cards · Saved snapshot</div>
          </div>
        </a>`).join('');
    }
  }

  // Sessions count
  try {
    const rs = await apiFetch('/api/auth/sessions');
    if (rs.ok) {
      const d = await rs.json();
      document.getElementById('stat-sessions').textContent = d.sessions?.length || 1;
    } else {
      document.getElementById('stat-sessions').textContent = '1';
    }
  } catch {
    document.getElementById('stat-sessions').textContent = '1';
  }
  updateMobileProfileSummary({ offline: forceOffline });
}

// ── My Boards ─────────────────────────────────────────────────
let boardsCache = [];
let sharedBoardsCache = [];
async function loadBoards(forceOffline = false) {
  const grid = document.getElementById('boards-grid');
  grid.innerHTML = '<div style="color:var(--text-3);font-size:14px;grid-column:1/-1;">Loading…</div>';
  try {
    if (forceOffline) throw new Error('offline');
    const r = await apiFetch('/api/boards');
    const { boards } = await r.json();
    boardsCache = boards;
    writeProfileCache({ boards });
    renderBoardsGrid(boards);
  } catch {
    const cachedBoards = readProfileCache()?.boards || [];
    boardsCache = cachedBoards;
    if (cachedBoards.length) renderBoardsGrid(cachedBoards);
    else grid.innerHTML = '<div style="color:#e55;grid-column:1/-1;">Failed to load boards</div>';
  }
  updateMobileProfileSummary({ offline: forceOffline });
}

function renderBoardsGrid(boards) {
  const grid = document.getElementById('boards-grid');
  if (!boards.length) {
    grid.innerHTML = '<div style="color:var(--text-3);font-size:14px;grid-column:1/-1;">No boards yet. Click "New Board" to create one.</div>';
    return;
  }
  grid.innerHTML = boards.map(b => `
    <div class="board-card" id="bc-${esc(b.id)}">
      <div class="bc-thumb">📌</div>
      <div class="bc-body">
        <div class="bc-name-wrap">
          <div class="bc-name" id="bc-name-${esc(b.id)}" onclick="startBoardRename('${esc(b.id)}')" title="Click to rename">${esc(b.name)}</div>
        </div>
        <div class="bc-meta">${b.card_count || 0} cards · Updated ${new Date(b.updated_at).toLocaleDateString()}</div>
      </div>
      <div class="bc-actions">
        <button class="bc-btn primary" onclick="window.location.href='board.html?id=${esc(b.id)}'">Open</button>
        <button class="bc-btn" onclick="startBoardRename('${esc(b.id)}')">Rename</button>
        <button class="bc-btn danger" onclick="deleteBoard('${esc(b.id)}','${esc(b.name)}')">Delete</button>
      </div>
    </div>`).join('');
}

function startBoardRename(id) {
  const el = document.getElementById('bc-name-' + id);
  const oldName = el.textContent;
  const inp = document.createElement('input');
  inp.value = oldName;
  inp.style.cssText = 'font-size:14px;font-weight:650;border:1.5px solid var(--accent);border-radius:6px;padding:2px 7px;outline:none;width:100%;font-family:var(--font);';
  el.replaceWith(inp);
  inp.focus(); inp.select();
  async function save() {
    const newName = inp.value.trim() || oldName;
    const span = document.createElement('div');
    span.id = 'bc-name-' + id;
    span.className = 'bc-name';
    span.title = 'Click to rename';
    span.textContent = newName;
    span.onclick = () => startBoardRename(id);
    inp.replaceWith(span);
    if (newName !== oldName) {
      try {
        await apiFetch('/api/boards/' + id + '/name', { method: 'PATCH', body: { name: newName } });
        toast('Renamed to: ' + newName);
      } catch { toast('Rename failed'); }
    }
  }
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = oldName; inp.blur(); } });
}

async function deleteBoard(id, name) {
  if (!confirm(`Delete board "${name}"? This cannot be undone.`)) return;
  try {
    const r = await apiFetch('/api/boards/' + id, { method: 'DELETE' });
    if (!r.ok) { toast('Delete failed'); return; }
    toast('Board deleted');
    loadBoards();
  } catch { toast('Delete failed'); }
}

function createNewBoard() {
  document.getElementById('tpl-name').value = '';
  const modal = document.getElementById('tpl-modal');
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('tpl-name').focus(), 100);
}

function closeTplModal() {
  document.getElementById('tpl-modal').style.display = 'none';
}

async function confirmNewBoard() {
  const name = document.getElementById('tpl-name').value.trim() || 'New Board';
  try {
    const r = await apiFetch('/api/boards', { method: 'POST', body: { name } });
    if (!r.ok) { toast('Failed to create board'); return; }
    const { board } = await r.json();
    closeTplModal();
    window.location.href = 'board.html?id=' + board.id;
  } catch { toast('Failed to create board'); }
}

// ── Shared Boards ─────────────────────────────────────────────
async function loadSharedBoards(forceOffline = false) {
  const wrap = document.getElementById('shared-boards-list');
  wrap.innerHTML = '<div style="color:var(--text-3);font-size:14px;text-align:center;padding:40px;">Loading…</div>';
  try {
    if (forceOffline) throw new Error('offline');
    const r = await apiFetch('/api/members/my/boards');
    const { boards } = await r.json();
    sharedBoardsCache = boards;
    writeProfileCache({ sharedBoards: boards });
    if (!boards.length) {
      wrap.innerHTML = '<div style="color:var(--text-3);font-size:14px;text-align:center;padding:40px;">No shared boards yet.<br>Ask your teacher to invite you to a board.</div>';
      return;
    }
    wrap.innerHTML = boards.map(b => `
      <a href="board.html?id=${esc(b.id)}" style="background:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 2px 12px rgba(5,5,23,.07);display:flex;align-items:center;gap:14px;cursor:pointer;text-decoration:none;">
        <div style="font-size:28px;width:52px;height:52px;border-radius:14px;background:#F5F0E8;display:flex;align-items:center;justify-content:center;flex-shrink:0;">📌</div>
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:650;color:var(--text);">${esc(b.name)}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:3px;">${b.owner_avatar} ${esc(b.owner_name)} · Updated ${new Date(b.updated_at).toLocaleDateString()}</div>
        </div>
        <span style="font-size:10px;font-weight:650;padding:3px 10px;border-radius:20px;background:rgba(99,102,241,.1);color:#6366f1;">${b.role}</span>
      </a>`).join('');
  } catch {
    const cachedBoards = readProfileCache()?.sharedBoards || [];
    sharedBoardsCache = cachedBoards;
    if (!cachedBoards.length) {
      wrap.innerHTML = `<div style="color:${forceOffline ? 'var(--text-3)' : '#e55'};text-align:center;padding:20px;">${forceOffline ? 'Offline mode: no saved shared boards yet.' : 'Failed to load shared boards'}</div>`;
      return;
    }
    wrap.innerHTML = cachedBoards.map(b => `
      <a href="board.html?id=${esc(b.id)}" style="background:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 2px 12px rgba(5,5,23,.07);display:flex;align-items:center;gap:14px;cursor:pointer;text-decoration:none;">
        <div style="font-size:28px;width:52px;height:52px;border-radius:14px;background:#F5F0E8;display:flex;align-items:center;justify-content:center;flex-shrink:0;">📌</div>
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:650;color:var(--text);">${esc(b.name)}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:3px;">${b.owner_avatar || '👩‍🏫'} ${esc(b.owner_name || 'Teacher')} · Saved snapshot</div>
        </div>
        <span style="font-size:10px;font-weight:650;padding:3px 10px;border-radius:20px;background:rgba(99,102,241,.1);color:#6366f1;">${b.role || 'viewer'}</span>
      </a>`).join('');
  }
  updateMobileProfileSummary({ offline: forceOffline });
}

// ── Settings ──────────────────────────────────────────────────
function initSettings() {
  document.getElementById('set-name').value = me.name;
  document.getElementById('set-email').value = me.email || '';
  renderEmojiGrid();
  initTimeZoneSettings();
  initMeetingRooms();
  initPlanCard().catch(() => {});
}

// Pre-populate meeting URL inputs
function initMeetingRooms() {
  if (me.meeting_url) document.getElementById('set-meet-url').value = me.meeting_url;
  if (me.zoom_url) document.getElementById('set-zoom-url').value = me.zoom_url;
}

function billingToneStyle(tone) {
  if (tone === 'good') return { color: '#166534', border: 'rgba(34,197,94,.2)', bg: 'rgba(34,197,94,.08)' };
  if (tone === 'warn') return { color: '#b45309', border: 'rgba(249,115,22,.22)', bg: 'rgba(249,115,22,.08)' };
  if (tone === 'bad') return { color: '#b91c1c', border: 'rgba(239,68,68,.22)', bg: 'rgba(239,68,68,.08)' };
  return { color: 'var(--text-2)', border: 'var(--border)', bg: 'rgba(28,28,30,.03)' };
}

function billingCycleLabel(cycle) {
  return ({ monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }[cycle] || 'Monthly');
}

function formatMoney(amount, currency = 'usd') {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: String(currency || 'USD').toUpperCase(),
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${String(currency || 'usd').toUpperCase()}`;
  }
}

function formatBillingDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderBillingUsage(usage) {
  const root = document.getElementById('plan-usage-summary');
  if (!root) return;
  const items = [
    {
      label: 'Boards',
      entry: usage?.boards,
      formatter: entry => entry.unlimited ? 'Unlimited' : `${entry.used}/${entry.limit}`,
      detail: entry => entry.unlimited ? `${entry.used} active` : `${entry.remaining} left`
    },
    {
      label: 'Students / board',
      entry: usage?.students_per_board,
      formatter: entry => entry.unlimited ? 'Unlimited' : `${entry.used}/${entry.limit}`,
      detail: entry => entry.unlimited ? 'No cap' : `${entry.remaining} left`
    },
    {
      label: 'Courses',
      entry: usage?.courses,
      formatter: entry => entry.unlimited ? 'Unlimited' : `${entry.used}/${entry.limit}`,
      detail: entry => entry.unlimited ? 'No cap' : `${entry.remaining} left`
    },
    {
      label: 'Storage',
      entry: usage?.storage_mb,
      formatter: entry => entry.unlimited ? `${entry.used} MB` : `${entry.used} / ${entry.limit} MB`,
      detail: entry => entry.unlimited ? 'Tracked locally' : `${entry.remaining} MB left`
    }
  ];
  root.innerHTML = `
    <div style="font-size:11px;font-weight:650;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;">Usage & limits</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
      ${items.map(item => {
        const entry = item.entry || { used: 0, limit: 0, remaining: 0, unlimited: false };
        return `
          <div style="padding:12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.55);">
            <div style="font-size:11px;font-weight:650;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;">${item.label}</div>
            <div style="font-size:16px;font-weight:700;color:var(--text);margin-top:4px;">${item.formatter(entry)}</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${item.detail(entry)}</div>
          </div>`;
      }).join('')}
    </div>`;
}

function renderBillingFeatures(features = [], flags = {}) {
  const root = document.getElementById('plan-features-list');
  if (!root) return;
  const flagFeatures = [
    flags.analytics ? 'Analytics enabled' : null,
    flags.realtime ? 'Realtime collaboration' : null,
    flags.exports ? 'Exports included' : null,
    flags.adminPanel ? 'Admin controls' : null,
    flags.customBranding ? 'Custom branding' : null
  ].filter(Boolean);
  const chips = [...features, ...flagFeatures].slice(0, 8);
  root.innerHTML = chips.map(feature => `
    <div style="padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:rgba(255,255,255,.55);font-size:12px;font-weight:600;color:var(--text-2);">
      ✓ ${esc(feature)}
    </div>
  `).join('');
}

function renderPlanStatusBanner(current, pendingPayment) {
  const root = document.getElementById('plan-status-banner');
  if (!root) return;
  const tone = billingToneStyle(current?.status_meta?.tone);
  const billedPlan = current?.billing_plan || current?.plan || 'free';
  let message = '';
  if (pendingPayment) {
    message = `Invoice ${esc(pendingPayment.invoice_no || '#' + pendingPayment.id)} is waiting for admin review. Package: ${esc(PLAN_NAMES[pendingPayment.plan] || pendingPayment.plan)} · ${billingCycleLabel(pendingPayment.billing_cycle)} · ${formatMoney(pendingPayment.amount, pendingPayment.currency)}.`;
  } else if ((current?.status || 'free') === 'free') {
    message = 'You are on the free tier. Upgrade to unlock more boards, more students, analytics, and stronger admin controls.';
  } else if ((current?.plan || 'free') === 'free') {
    message = `${esc(current?.status_meta?.label || 'Plan inactive')}: ${esc(PLAN_NAMES[billedPlan] || billedPlan)} access is not active, so Free limits are applied.`;
  } else {
    const expires = current?.plan_expires_at ? ` Access runs until ${formatBillingDate(current.plan_expires_at)}.` : '';
    const source = current?.plan_source ? ` Source: ${esc(current.plan_source)}.` : '';
    message = `${esc(current?.status_meta?.label || 'Plan active')} on ${esc(PLAN_NAMES[current.plan] || current.plan)} with ${billingCycleLabel(current.cycle)} billing.${expires}${source}`;
  }
  root.style.display = 'block';
  root.style.color = tone.color;
  root.style.borderColor = tone.border;
  root.style.background = tone.bg;
  root.innerHTML = `<strong style="font-size:12px;">${esc(current?.status_meta?.label || 'Billing')}</strong><div style="margin-top:4px;">${message}</div>`;
}

function updatePlanOptionPrices() {
  ['pro', 'school'].forEach(plan => {
    const priceEl = document.getElementById(`plan-price-${plan}`);
    if (!priceEl) return;
    const cycle = document.getElementById('billing-cycle-select')?.value || 'monthly';
    const quote = billingPlans?.[plan]?.cycles?.find(item => item.key === cycle);
    if (!quote) {
      priceEl.textContent = PLAN_PRICES[plan] || '';
      return;
    }
    const monthlyEquivalent = quote.monthly_equivalent ? `${formatMoney(quote.monthly_equivalent, quote.currency)}/mo` : '';
    const savings = quote.savings > 0 ? ` · save ${formatMoney(quote.savings, quote.currency)}` : '';
    priceEl.textContent = cycle === 'monthly'
      ? monthlyEquivalent
      : `${formatMoney(quote.total, quote.currency)}${savings}`;
  });
}

function renderPlanCardFromOverview(overview) {
  const current = overview?.current || {};
  const plan = current.plan || me?.plan || 'free';
  const billedPlan = current.billing_plan || plan;
  const planIcons = { free: '⭐', pro: '🚀', school: '🏫' };
  const planName = current.name || PLAN_NAMES[plan] || 'Free';
  const badge = current.badge ? ` · ${current.badge}` : '';
  const expiry = current.plan_expires_at ? ` · active until ${formatBillingDate(current.plan_expires_at)}` : '';
  document.getElementById('plan-icon').textContent = planIcons[plan] || '⭐';
  document.getElementById('plan-name-display').textContent = planName;
  document.getElementById('plan-desc-display').textContent = plan === billedPlan
    ? `${billingCycleLabel(current.cycle || 'monthly')} billing${badge}${expiry}`
    : `${PLAN_NAMES[billedPlan] || billedPlan} inactive · Free limits applied`;
  renderPlanStatusBanner(current, overview?.pending_payment || null);
  renderBillingUsage(overview?.usage || {});
  renderBillingFeatures(current.features || [], current.flags || {});
  updatePlanOptionPrices();

  const submitBtn = document.getElementById('iban-submit-btn');
  if (submitBtn) {
    const locked = !!overview?.pending_payment;
    submitBtn.disabled = locked;
    submitBtn.style.opacity = locked ? '.65' : '1';
    submitBtn.style.cursor = locked ? 'not-allowed' : 'pointer';
    submitBtn.textContent = locked ? 'Pending review in progress' : 'Send for Admin Review →';
  }

  const emailInput = document.getElementById('iban-contact-email');
  if (emailInput && !emailInput.value) emailInput.value = me?.email || '';
}

async function initPlanCard() {
  const fallbackOverview = {
    current: {
      plan: me?.plan || 'free',
      billing_plan: me?.plan || 'free',
      cycle: me?.billing_cycle || 'monthly',
      status: me?.plan_status || (me?.plan === 'free' ? 'free' : 'active'),
      status_meta: { label: me?.plan_status || 'free', tone: me?.plan === 'free' ? 'muted' : 'good' },
      plan_expires_at: me?.plan_expires_at || null,
      plan_source: me?.plan_source || null,
      name: PLAN_NAMES[me?.plan || 'free'] || 'Free',
      badge: me?.plan === 'school' ? 'Team' : me?.plan === 'pro' ? 'Most popular' : 'Starter',
      features: [],
      flags: {}
    },
    usage: {},
    pending_payment: null
  };
  renderPlanCardFromOverview(fallbackOverview);
  try {
    const response = await apiFetch('/api/billing/overview');
    if (!response.ok) throw new Error('billing-overview-failed');
    billingOverview = await response.json();
    billingPlans = billingOverview.plans || {};
    me = {
      ...me,
      plan: billingOverview.current?.plan || me.plan,
      plan_status: billingOverview.current?.status || me.plan_status,
      billing_cycle: billingOverview.current?.cycle || me.billing_cycle,
      plan_started_at: billingOverview.current?.plan_started_at || me.plan_started_at,
      plan_expires_at: billingOverview.current?.plan_expires_at || me.plan_expires_at,
      plan_source: billingOverview.current?.plan_source || me.plan_source
    };
    writeProfileCache({ me, billingOverview });
    renderPlanCardFromOverview(billingOverview);
  } catch {
    const cachedOverview = readProfileCache()?.billingOverview || null;
    if (cachedOverview) {
      billingOverview = cachedOverview;
      billingPlans = cachedOverview.plans || {};
      renderPlanCardFromOverview(cachedOverview);
    }
  }
}

async function loadBillingRequests() {
  const root = document.getElementById('billing-requests');
  if (!root) return;
  let payments = billingOverview?.payments || null;
  if (!payments) {
    const r = await apiFetch('/api/billing/payments');
    if (!r.ok) return;
    const payload = await r.json();
    payments = payload.payments || [];
  }
  if (!payments?.length) {
    root.innerHTML = '<div style="font-size:12px;color:var(--text-3);">No manual payment requests yet.</div>';
    return;
  }
  root.innerHTML = `
    <div style="font-size:12px;font-weight:650;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Payment Requests</div>
    <div style="display:grid;gap:8px;">
      ${payments.slice(0, 8).map(p => {
        const amount = formatMoney(p.amount, p.currency);
        const tone = billingToneStyle(p.status_meta?.tone);
        return `<div style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg-2);">
          <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;">
            <strong style="font-size:12px;color:var(--text);">${p.invoice_no || '#' + p.id}</strong>
            <span style="font-size:11px;font-weight:700;color:${tone.color};text-transform:uppercase;">${esc(p.status_meta?.label || p.status)}</span>
          </div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px;">${PLAN_NAMES[p.plan] || p.plan} · ${billingCycleLabel(p.billing_cycle)} · ${amount}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px;">Created ${formatBillingDate(p.created_at)} · ${p.months || 1} month(s)</div>
          ${p.company_name ? `<div style="font-size:11px;color:var(--text-3);margin-top:4px;">Company: ${esc(p.company_name)}</div>` : ''}
          ${p.admin_note ? `<div style="font-size:11px;color:var(--text-3);margin-top:4px;">Admin note: ${esc(p.admin_note)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

async function saveMeetingRooms() {
  const meeting_url = document.getElementById('set-meet-url').value.trim();
  const zoom_url = document.getElementById('set-zoom-url').value.trim();
  try {
    const r = await apiFetch('/api/auth/me', { method: 'PATCH', body: { meeting_url: meeting_url || null, zoom_url: zoom_url || null } });
    if (!r.ok) { const d = await r.json(); toast(d.error || 'Failed'); return; }
    const { user } = await r.json();
    me = { ...me, ...user };
    try { localStorage.setItem('teachedos_user', JSON.stringify(me)); } catch {}
    toast('Meeting rooms saved ✓');
  } catch { toast('Failed to save'); }
}

async function saveTimeZoneSettings() {
  const isAuto = document.getElementById('set-tz-auto')?.checked;
  const candidate = (isAuto ? browserTimeZone() : document.getElementById('set-timezone')?.value || '').trim();
  if (!isValidTimeZone(candidate)) {
    toast('Use a valid IANA time zone, for example Europe/Kyiv');
    return;
  }
  try {
    const r = await apiFetch('/api/auth/me', {
      method: 'PATCH',
      body: { timezone: candidate, timezone_mode: isAuto ? 'auto' : 'manual' }
    });
    if (!r.ok) { const d = await r.json(); toast(d.error || 'Failed'); return; }
    const { user } = await r.json();
    me = { ...me, ...user };
    writeProfileCache({ me });
    renderOverview();
    initTimeZoneSettings();
    toast(isAuto ? 'Automatic time zone saved' : 'Time zone saved');
  } catch {
    toast('Failed to save time zone');
  }
}

function toggleManagePanel() {
  const panel = document.getElementById('manage-sub-panel');
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  if (!open) return;

  const current = billingOverview?.current || {
    plan: me?.plan || 'free',
    status: me?.plan_status || (me?.plan === 'free' ? 'free' : 'active'),
    cycle: me?.billing_cycle || 'monthly',
    plan_expires_at: me?.plan_expires_at || null
  };
  const quote = billingPlans?.[current.plan]?.cycles?.find(item => item.key === (current.cycle || 'monthly'));
  const expires = current.plan_expires_at ? new Date(current.plan_expires_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : null;
  const daysLeft = expires && current.plan_expires_at ? Math.ceil((new Date(current.plan_expires_at) - Date.now()) / 86400000) : null;
  const expiryColor = daysLeft != null && daysLeft < 14 ? '#ef4444' : 'var(--text-2)';

  const row = (label, value, color='var(--text)') =>
    `<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;">
       <span style="color:var(--text-3);font-weight:600;">${label}</span>
       <span style="font-weight:600;color:${color};">${value}</span>
     </div>`;

  document.getElementById('manage-plan-summary').innerHTML = [
    row('Plan', PLAN_NAMES[current.plan] || current.plan),
    row('Status', current.status_meta?.label || current.status || 'Free tier', billingToneStyle(current.status_meta?.tone).color),
    row('Cycle', billingCycleLabel(current.cycle || 'monthly')),
    row('Price', quote ? formatMoney(quote.total, quote.currency) : (current.plan === 'free' ? '$0' : '-')),
    expires ? row('Active until', expires + (daysLeft != null ? ` (${daysLeft}d left)` : ''), expiryColor) : '',
    billingOverview?.pending_payment ? row('Pending invoice', billingOverview.pending_payment.invoice_no || `#${billingOverview.pending_payment.id}`, '#b45309') : '',
  ].join('');

  loadBillingRequests().catch(() => {});
}

async function openBillingPortal() { toggleManagePanel(); }

function renderEmojiGrid() {
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = AVATARS.map(e => `
    <div class="emoji-opt ${e === selectedAvatar ? 'selected' : ''}" onclick="selectAvatar('${e}')" title="${e}">${e}</div>
  `).join('');
}

function selectAvatar(emoji) {
  selectedAvatar = emoji;
  renderEmojiGrid();
}

async function saveName() {
  const name = document.getElementById('set-name').value.trim();
  if (!name) { toast('Name cannot be empty'); return; }
  try {
    const r = await apiFetch('/api/users/me', { method: 'PATCH', body: { name } });
    if (!r.ok) { const d = await r.json(); toast(d.error || 'Failed'); return; }
    const { user } = await r.json();
    me = { ...me, ...user };
    document.getElementById('profile-name-big').textContent = me.name;
    document.getElementById('nb-user-info').textContent = me.name.split(' ')[0];
    toast('Name updated!');
  } catch { toast('Failed to save name'); }
}

async function saveEmail() {
  const email = document.getElementById('set-email').value.trim();
  if (!email) { toast('Email cannot be empty'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Invalid email address'); return; }
  try {
    const r = await apiFetch('/api/users/me', { method: 'PATCH', body: { email } });
    if (!r.ok) { const d = await r.json(); toast(d.error || 'Failed'); return; }
    const { user } = await r.json();
    me = { ...me, ...user };
    document.getElementById('profile-email-big').textContent = me.email;
    toast('Email updated!');
  } catch { toast('Failed to save email'); }
}

async function saveAvatar() {
  if (!selectedAvatar) return;
  try {
    const r = await apiFetch('/api/users/me', { method: 'PATCH', body: { avatar: selectedAvatar } });
    if (!r.ok) { const d = await r.json(); toast(d.error || 'Failed'); return; }
    const { user } = await r.json();
    me = { ...me, ...user };
    document.getElementById('profile-avatar-big').textContent = me.avatar;
    toast('Avatar updated!');
  } catch { toast('Failed to save avatar'); }
}

/* ── Bulk Import ── */
function openBulkImport() {
  if (!planHasFeature(userPlan(me), 'bulkInvite')) {
    toast(upgradeMessage('bulkInvite'));
    openPlansSection();
    return;
  }
  const sel = document.getElementById('bulk-board-select');
  if (sel && boardsCache.length) {
    sel.innerHTML = boardsCache.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }
  document.getElementById('bulk-emails-input').value = '';
  document.getElementById('bulk-result').style.display = 'none';
  document.getElementById('bulk-import-modal').style.display = 'flex';
}
function closeBulkImport() {
  document.getElementById('bulk-import-modal').style.display = 'none';
}
async function submitBulkImport() {
  if (!planHasFeature(userPlan(me), 'bulkInvite')) {
    toast(upgradeMessage('bulkInvite'));
    openPlansSection();
    return;
  }
  const boardId = document.getElementById('bulk-board-select').value;
  const raw = document.getElementById('bulk-emails-input').value;
  if (!boardId || !raw.trim()) { toast('Select a board and enter emails'); return; }
  const emails = raw.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
  if (!emails.length) { toast('No valid emails found'); return; }
  const resultEl = document.getElementById('bulk-result');
  resultEl.style.display = 'none';
  try {
    const r = await apiFetch(`/api/members/${boardId}/bulk-invite`, {
      method: 'POST', body: { emails, role: 'student' }
    });
    const d = await r.json();
    let msg = '';
    if (d.added?.length)    msg += `✅ Added: ${d.added.map(x=>x.name||x.email).join(', ')}\n`;
    if (d.notFound?.length) msg += `⚠️ Not found: ${d.notFound.join(', ')}\n`;
    if (d.alreadyMember?.length) msg += `ℹ️ Already members: ${d.alreadyMember.join(', ')}`;
    resultEl.textContent = msg || 'Done';
    resultEl.style.background = d.added?.length ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)';
    resultEl.style.border = d.added?.length ? '1px solid rgba(34,197,94,.3)' : '1px solid rgba(245,158,11,.3)';
    resultEl.style.color = d.added?.length ? '#15803d' : '#92400e';
    resultEl.style.display = 'block';
    resultEl.style.whiteSpace = 'pre-line';
    if (d.limitReached) {
      toast(`Student limit reached: ${d.limitReached.limit} on ${d.limitReached.plan}.`);
    } else if (d.added?.length) {
      toast(`✅ ${d.added.length} student(s) invited!`);
    }
  } catch(e) { toast('Error: ' + e.message); }
}

async function savePassword() {
  const current = document.getElementById('set-pass-current').value;
  const next = document.getElementById('set-pass-new').value;
  const confirm = document.getElementById('set-pass-confirm').value;
  if (!current || !next) { toast('Fill in all fields'); return; }
  if (next !== confirm) { toast('Passwords do not match'); return; }
  if (next.length < 10) { toast('Password must be at least 10 characters'); return; }
  try {
    const r = await apiFetch('/api/users/me/password', { method: 'PATCH', body: { current, next } });
    if (!r.ok) { const d = await r.json(); toast(d.error || 'Failed'); return; }
    document.getElementById('set-pass-current').value = '';
    document.getElementById('set-pass-new').value = '';
    document.getElementById('set-pass-confirm').value = '';
    toast('Password changed!');
  } catch { toast('Failed to change password'); }
}

async function deleteAllBoards() {
  if (!confirm('Delete ALL your boards? This cannot be undone.')) return;
  if (!confirm('Are you absolutely sure? All board data will be lost.')) return;
  try {
    const r = await apiFetch('/api/boards');
    const { boards } = await r.json();
    await Promise.all(boards.map(b => apiFetch('/api/boards/' + b.id, { method: 'DELETE' })));
    toast('All boards deleted');
    loadBoards();
  } catch { toast('Failed to delete boards'); }
}

// ── Logout ────────────────────────────────────────────────────
async function doLogout() {
  try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch {}
  clearAuthState();
  window.location.href = 'index.html';
}

function clearAuthState() {
  const keys = [
    'teachedos_token',
    'teachedos_role',
    'teachedos_user',
    'teachedos_user_email',
    'teachedos_board_id',
    'teachedos_teacher_dashboard_cache_v1',
  ];
  keys.forEach(k => localStorage.removeItem(k));
  // Revoke Google One Tap auto-select so it doesn't re-sign in immediately
  try { google.accounts.id.disableAutoSelect(); } catch {}
}

// ── Subscription / IBAN payment ──────────────────────────────
let _selectedPlan = null;
const PLAN_PRICES = { pro: '$9.90/mo', school: '$29/mo' };
const PLAN_NAMES  = { free: 'Free', pro: 'Teacher Pro', school: 'School' };

function updateSelectedPlanPrice() {
  updatePlanOptionPrices();
  if (!_selectedPlan) return;
  const cycle = document.getElementById('billing-cycle-select')?.value || 'monthly';
  const quote = billingPlans?.[_selectedPlan]?.cycles?.find(item => item.key === cycle);
  document.getElementById('iban-plan-name').textContent = PLAN_NAMES[_selectedPlan] || _selectedPlan;
  document.getElementById('iban-plan-price').textContent = quote ? formatMoney(quote.total, quote.currency) : (PLAN_PRICES[_selectedPlan] || '');
  document.getElementById('iban-plan-cycle').textContent = quote
    ? `${billingCycleLabel(quote.cycle)} · ${quote.months} month(s)${quote.savings > 0 ? ` · save ${formatMoney(quote.savings, quote.currency)}` : ''}`
    : billingCycleLabel(cycle);
}

function selectPlan(plan) {
  _selectedPlan = plan;
  document.querySelectorAll('.plan-option').forEach(el => {
    el.classList.toggle('is-selected', el.id === 'plan-opt-' + plan);
  });
  document.getElementById('iban-payment-section').style.display = 'block';
  updateSelectedPlanPrice();
}

function copyIBAN() {
  navigator.clipboard.writeText('UA623052990262056400990700807').then(() => toast('IBAN copied!')).catch(() => {
    const el = document.getElementById('iban-display');
    const range = document.createRange(); range.selectNodeContents(el);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    toast('Select & copy manually');
  });
}

async function submitIBANPayment() {
  if (!_selectedPlan) { toast('Select a plan first'); return; }
  const payerName = document.getElementById('iban-payer-name').value.trim();
  const txDate = document.getElementById('iban-tx-date').value;
  const txNote = document.getElementById('iban-tx-note').value.trim();
  const contactEmail = document.getElementById('iban-contact-email').value.trim();
  const companyName = document.getElementById('iban-company-name').value.trim();
  const billingCycle = document.getElementById('billing-cycle-select')?.value || 'monthly';
  if (!payerName) { toast('Enter your full name'); return; }
  if (!txDate) { toast('Enter payment date'); return; }
  if (billingOverview?.pending_payment) { toast('Wait until the current invoice is reviewed'); return; }
  try {
    const r = await apiFetch('/api/billing/iban-activate', {
      method: 'POST',
      body: {
        plan: _selectedPlan,
        billing_cycle: billingCycle,
        payer_name: payerName,
        tx_date: txDate,
        tx_note: txNote,
        contact_email: contactEmail || null,
        company_name: companyName || null
      }
    });
    if (r.ok) {
      const d = await r.json();
      const invoiceNo = d.payment?.invoice_no ? ` Invoice ${d.payment.invoice_no}.` : '';
      toast('Payment request sent for admin review.' + invoiceNo);
      document.getElementById('iban-payment-section').style.display = 'none';
      ['iban-company-name', 'iban-payer-name', 'iban-tx-date', 'iban-tx-note'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
      });
      await initPlanCard();
      loadBillingRequests().catch(() => {});
    } else {
      const d = await r.json().catch(() => ({}));
      toast(d.error || 'Payment request sent. We will verify and activate soon.');
    }
  } catch {
    toast('Could not send request. Please try again.');
  }
}

// ── Start ─────────────────────────────────────────────────────
init();
