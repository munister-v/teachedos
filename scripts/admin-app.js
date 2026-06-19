/* ════════════════════════════════════════════════════════════════
   admin-app.js — TeachEd Admin panel logic
   Extracted from the inline <script> block for HTTP/SW cacheability
   ════════════════════════════════════════════════════════════════ */
const API = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teachedos-api.onrender.com')));
let token = localStorage.getItem('teachedos_admin_token') || null;
let currentAdminUser = null;
let analyticsDays = 14;
let adminSearchTimer;
let timelineEvents = [];
let timelineFilter = '';
const pageMeta = {
  dashboard: ['Dashboard', 'System overview and key metrics'],
  users: ['Users', 'Manage all registered users'],
  boards: ['Boards', 'View and manage all user boards'],
  sessions: ['Active Sessions', 'Review live login activity'],
  audit: ['System Audit', 'Operational signals and hygiene checks'],
  billing: ['Billing', 'Manual payments and tariff approvals'],
  packages: ['Package Control', 'Plans, limits and manual subscription grants'],
  settings: ['Settings', 'System configuration and admin tools'],
  'api-tester': ['API Tester', 'Test and debug API endpoints'],
};

// ── Auth ─────────────────────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  const err   = document.getElementById('login-err');
  err.textContent = '';
  if (!email || !pass) { err.textContent = 'Enter email and password'; return; }

  try {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, password: pass })
    });
    const d = await r.json();
    if (!r.ok) { err.textContent = d.error || 'Login failed'; return; }
    if (d.user.role !== 'admin') {
      err.textContent = '⛔ This account does not have admin privileges';
      return;
    }
    token = d.token;
    localStorage.setItem('teachedos_admin_token', token);
    currentAdminUser = d.user;
    enterPanel();
  } catch(e) {
    err.textContent = 'Network error. Is the API running?';
  }
}

document.getElementById('l-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// Spotlight shortcut handled in main keyboard handler below

async function verifyToken() {
  if (!token) return false;
  try {
    const r = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return false;
    const d = await r.json();
    if (d.user.role !== 'admin') return false;
    currentAdminUser = d.user;
    return true;
  } catch { return false; }
}

function enterPanel() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('sb-avatar').textContent = currentAdminUser.avatar;
  document.getElementById('sb-name').textContent   = currentAdminUser.name;
  document.getElementById('sb-email').textContent  = currentAdminUser.email;
  document.getElementById('api-url-display').textContent = API;
  updateMobileHeader('dashboard');
  updateGrantPreview();
  refreshStats();
  loadSysInfo();
}

function doLogout() {
  if (token) {
    fetch(`${API}/api/auth/logout`, { method:'POST', headers:{ Authorization:`Bearer ${token}` } }).catch(()=>{});
  }
  token = null;
  ['teachedos_token','teachedos_admin_token','teachedos_role','teachedos_user',
   'teachedos_user_email','teachedos_board_id','teachedos_teacher_dashboard_cache_v1']
    .forEach(k => localStorage.removeItem(k));
  try { google.accounts.id.disableAutoSelect(); } catch {}
  location.href = 'index.html';
}

// ── API helper ────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${API}${path}`, opts);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

// ── Navigation ────────────────────────────────────────────────────────────
function updateMobileHeader(name) {
  const [title, sub] = pageMeta[name] || pageMeta.dashboard;
  document.getElementById('mobile-page-title').textContent = title;
  document.getElementById('mobile-page-sub').textContent = sub;
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-backdrop').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('open');
}

function toggleSidebar() {
  const open = document.getElementById('sidebar').classList.contains('open');
  if (open) closeSidebar();
  else openSidebar();
}

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  document.querySelector(`.sb-item[onclick="showPage('${name}')"]`).classList.add('active');
  updateMobileHeader(name);
  closeSidebar();

  if (name === 'dashboard') refreshStats();
  if (name === 'users')     loadUsers();
  if (name === 'boards')    loadBoards();
  if (name === 'sessions')  loadSessions();
  if (name === 'audit')     loadAudit();
  if (name === 'billing')   { loadBillingSummary(); loadBillingPayments(); }
  if (name === 'packages')  loadPackageControl();
  if (name === 'settings')  { loadSysInfo(); loadInvites(); }
  if (name === 'api-tester') initApiTester();
}

// ── Toast ─────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}

// ── Confirm ───────────────────────────────────────────────────────────────
function confirm(title, desc, icon, onOk, opts) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-desc').textContent  = desc;
  document.getElementById('confirm-icon').textContent  = icon || '⚠️';
  document.getElementById('modal-confirm').classList.add('open');
  const btn = document.getElementById('confirm-ok');
  btn.textContent = (opts && opts.label) || 'Delete';
  btn.style.background = (opts && opts.color) || 'var(--red)';
  btn.onclick = () => {
    document.getElementById('modal-confirm').classList.remove('open');
    onOk();
  };
}

function closeModal(e) {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
}

// ── Dashboard ─────────────────────────────────────────────────────────────
async function refreshStats() {
  try {
    const [stats, system, analytics, health] = await Promise.all([
      api('GET', '/api/admin/stats'),
      api('GET', '/api/admin/system'),
      api('GET', `/api/admin/analytics?days=${analyticsDays}`),
      fetch(`${API}/health`).then(r => r.json()).catch(() => null),
    ]);
    document.getElementById('stat-users').textContent    = stats.users;
    document.getElementById('stat-boards').textContent   = stats.boards;
    document.getElementById('stat-sessions').textContent = stats.sessions;
    document.getElementById('stat-courses').textContent  = stats.courses ?? '—';
    document.getElementById('stat-cards').textContent    = stats.cards ?? '—';
    document.getElementById('stat-new-users').textContent = stats.newUsers7d ?? '—';
    document.getElementById('stat-storage').textContent  = fmtBytes(stats.storageBytes);
    document.getElementById('stat-health').textContent   = health?.ok ? '✅ OK' : '❌ Down';
    document.getElementById('stat-invites').textContent  = system?.invites?.active ?? 0;
    document.getElementById('stat-payments').textContent = stats.pendingPayments ?? 0;

    const rl = document.getElementById('roles-list');
    rl.innerHTML = stats.roles.map(r =>
      `<div class="role-pill">${r.role}: <strong>${r.count}</strong></div>`
    ).join('');

    renderSignals(system, health);
    renderOps(system);
    renderRecentUsers(system.recentUsers || []);
    renderRecentBoards(system.recentBoards || []);
    renderAnalytics(analytics);
    setSignal(
      'payments',
      Number(stats.pendingPayments || 0) ? 'warn' : 'good',
      Number(stats.pendingPayments || 0) ? `${stats.pendingPayments} payment request(s) need review` : 'No manual payments waiting'
    );
    loadAdminBrief();
    loadTimeline();
    loadAIStatus();
    updateSidebarBadges(stats);
  } catch(e) {
    toast('Failed to load stats: ' + e.message, 'error');
  }
}

// ── AI engine status ───────────────────────────────────────────────────────
async function loadAIStatus() {
  const badge = document.getElementById('ai-engine-badge');
  try {
    const d = await api('GET', '/api/ai/status');
    const m = d.metrics || {};
    badge.textContent = d.llmEnabled ? '🟢 LLM active' : '🟡 Rule engine';
    badge.className = 'badge badge-' + (d.llmEnabled ? 'teacher' : 'student');
    document.getElementById('ai-model').textContent    = d.model || 'vps-fast-v1';
    document.getElementById('ai-llmok').textContent    = m.llmOk ?? 0;
    document.getElementById('ai-fallback').textContent = m.fallback ?? 0;
    document.getElementById('ai-cache').textContent    = m.cacheHits ?? 0;
    document.getElementById('ai-total').textContent    = m.total ?? 0;
    const chainEl = document.getElementById('ai-chain');
    if (chainEl) {
      const chain = (d.chain || []).join(' → ');
      const parts = [];
      if (chain) parts.push(`Fallback chain: ${chain} → rule engine`);
      if (d.ratePerMin) parts.push(`Limit: ${d.ratePerMin} req/min per user`);
      if (m.lastModel) parts.push(`Last served by: ${m.lastModel}`);
      chainEl.textContent = parts.join('  ·  ');
    }
    const errEl = document.getElementById('ai-lasterror');
    errEl.textContent = m.lastError ? `Last fallback reason: ${m.lastError}` : '';
    loadAIUsage();
  } catch(e) {
    badge.textContent = '⚠️ unavailable';
    badge.className = 'badge badge-student';
  }
}

async function loadAIUsage() {
  const root = document.getElementById('ai-usage-chart');
  if (!root) return;
  try {
    const d = await api('GET', '/api/ai/usage?days=14');
    const rows = d.rows || [];
    if (!rows.length) { root.innerHTML = '<div class="time-text" style="color:var(--muted)">No requests yet.</div>'; return; }
    const max = Math.max(1, ...rows.map(r => r.total));
    root.innerHTML = rows.map(r => {
      const h = Math.max(4, Math.round((r.total / max) * 56));
      const day = r.day.slice(5); // MM-DD
      const tip = `${r.day}: ${r.total} total · ${r.llm_ok} LLM · ${r.fallback} fallback · ${r.cache_hits} cache`;
      return `<div title="${tip}" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="width:100%;height:${h}px;background:var(--lime,#9ae600);border-radius:3px 3px 0 0;min-height:4px"></div>
        <div style="font-size:9px;color:var(--muted)">${day}</div>
      </div>`;
    }).join('');
  } catch(e) {
    root.innerHTML = `<div class="time-text" style="color:var(--muted)">Usage unavailable</div>`;
  }
}

function renderSignals(system, health) {
  const expiredSessions = Number(system?.expiredSessions || 0);
  const activeInvites = Number(system?.invites?.active || 0);
  const expiredInvites = Number(system?.invites?.expired || 0);

  setSignal('api', health?.ok ? 'good' : 'bad', health?.ok ? 'Backend is responding normally' : 'Backend is unreachable');
  setSignal(
    'sessions',
    expiredSessions === 0 ? 'good' : expiredSessions < 10 ? 'warn' : 'bad',
    expiredSessions === 0 ? 'No expired sessions pending cleanup' : `${expiredSessions} expired session(s) waiting for purge`
  );
  setSignal(
    'invites',
    expiredInvites > 0 ? 'warn' : activeInvites > 0 ? 'good' : 'bad',
    expiredInvites > 0 ? `${expiredInvites} invite(s) expired without activation` : activeInvites > 0 ? `${activeInvites} active invite(s) in circulation` : 'No active invite links right now'
  );
}

function setSignal(key, tone, text) {
  const dot = document.getElementById(`signal-${key}`);
  const label = document.getElementById(`signal-${key}-text`);
  if (!dot || !label) return;
  dot.className = `signal-dot ${tone}`;
  label.textContent = text;
}

function renderOps(system) {
  const invites = system?.invites || {};
  const expiredSessions = Number(system?.expiredSessions || 0);
  const usedInvites = Number(invites.used || 0);
  const expiredInvites = Number(invites.expired || 0);
  const revokedInvites = Number(invites.revoked || 0);
  const activeInvites = Number(invites.active || 0);

  document.getElementById('ops-expired-sessions').textContent = expiredSessions;
  document.getElementById('ops-used-invites').textContent = usedInvites;
  document.getElementById('ops-expired-invites').textContent = expiredInvites;
  document.getElementById('ops-revoked-invites').textContent = revokedInvites;

  const healthPill = document.getElementById('ops-health-pill');
  const overallTone = expiredSessions > 10 || expiredInvites > 5 ? 'bad' : expiredSessions > 0 || expiredInvites > 0 ? 'warn' : 'good';
  healthPill.className = `ops-pill ${overallTone}`;
  healthPill.textContent = overallTone === 'good' ? 'Stable' : overallTone === 'warn' ? 'Watchlist' : 'Needs attention';

  const actions = [];
  if (expiredSessions > 0) {
    actions.push({
      title: 'Clean up expired sessions',
      copy: `${expiredSessions} expired session(s) are still stored. Run purge from Settings to keep auth state tidy.`,
      tone: expiredSessions > 10 ? 'bad' : 'warn',
    });
  }
  if (expiredInvites > 0) {
    actions.push({
      title: 'Refresh onboarding links',
      copy: `${expiredInvites} invite(s) expired before use. Re-issue them so onboarding does not stall.`,
      tone: 'warn',
    });
  }
  if (activeInvites === 0) {
    actions.push({
      title: 'Prime your onboarding pipeline',
      copy: 'There are no active invite links. Create one if a new teacher or student is waiting to join.',
      tone: 'good',
    });
  }
  if (usedInvites > 0) {
    actions.push({
      title: 'Onboarding is converting',
      copy: `${usedInvites} invite(s) have already been accepted. This is a good moment to review early activity in the analytics cards below.`,
      tone: 'good',
    });
  }
  if (!actions.length) {
    actions.push({
      title: 'Platform is quiet and healthy',
      copy: 'No urgent admin actions are waiting. You can use this window to review growth trends or prepare the next invite wave.',
      tone: 'good',
    });
  }

  document.getElementById('ops-actions').innerHTML = actions.map(action => `
    <div class="ops-action">
      <div>
        <div class="ops-action-title">${action.title}</div>
        <div class="ops-action-copy">${action.copy}</div>
      </div>
      <div class="ops-pill ${action.tone}">${action.tone === 'good' ? 'OK' : action.tone === 'warn' ? 'Watch' : 'Fix'}</div>
    </div>
  `).join('');
}

function setAnalyticsRange(days) {
  if (analyticsDays === days) return;
  analyticsDays = days;
  syncAnalyticsRangeUi();
  document.getElementById('analytics-title').textContent = `📈 ${days}-Day Analytics`;
  renderAnalyticsLoading();
  refreshStats();
}

function syncAnalyticsRangeUi() {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.days) === analyticsDays);
  });
}

function renderAnalyticsLoading() {
  ['chart-signups-bars', 'chart-boards-bars', 'chart-sessions-bars'].forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  ['chart-signups-total', 'chart-boards-total', 'chart-sessions-total'].forEach(id => {
    document.getElementById(id).textContent = '…';
  });
  ['chart-signups-start', 'chart-boards-start', 'chart-sessions-start'].forEach(id => {
    document.getElementById(id).textContent = 'Loading';
  });
  document.getElementById('leaderboard-list').innerHTML = `
    <div class="leader-item">
      <div class="leader-copy">
        <div class="leader-rank">…</div>
        <div>
          <div class="leader-name">Loading…</div>
          <div class="leader-email">Refreshing analytics for the selected period</div>
        </div>
      </div>
    </div>
  `;
}

function renderRecentUsers(users) {
  const root = document.getElementById('recent-users-list');
  if (!users.length) {
    root.innerHTML = `<div class="activity-item"><div><div class="activity-title">No new users yet</div><div class="activity-sub">Fresh registrations will appear here</div></div></div>`;
    return;
  }
  root.innerHTML = users.map(user => `
    <div class="activity-item">
      <div>
        <div class="activity-title">${esc(user.name)} <span class="badge badge-${user.role}">${user.role}</span></div>
        <div class="activity-sub">${esc(user.email)}</div>
      </div>
      <div class="activity-meta">${fmtDate(user.created_at)}</div>
    </div>
  `).join('');
}

function renderRecentBoards(boards) {
  const root = document.getElementById('recent-boards-list');
  if (!boards.length) {
    root.innerHTML = `<div class="activity-item"><div><div class="activity-title">No board changes yet</div><div class="activity-sub">Board updates will appear here</div></div></div>`;
    return;
  }
  root.innerHTML = boards.map(board => `
    <div class="activity-item">
      <div>
        <div class="activity-title">${esc(board.name)}</div>
        <div class="activity-sub">Owner: ${esc(board.owner_name || 'Unknown')}</div>
      </div>
      <div class="activity-meta">${fmtDate(board.updated_at)}</div>
    </div>
  `).join('');
}

function renderAnalytics(analytics) {
  renderSpark(
    analytics?.signups || [],
    'chart-signups-bars',
    'chart-signups-total',
    'chart-signups-start',
    '',
    analytics?.totals?.signups ?? 0
  );
  renderSpark(
    analytics?.boardUpdates || [],
    'chart-boards-bars',
    'chart-boards-total',
    'chart-boards-start',
    'green',
    analytics?.totals?.boardUpdates ?? 0
  );
  renderSpark(
    analytics?.sessionStarts || [],
    'chart-sessions-bars',
    'chart-sessions-total',
    'chart-sessions-start',
    'orange',
    analytics?.totals?.sessionStarts ?? 0
  );

  const leaders = document.getElementById('leaderboard-list');
  const rows = analytics?.topBoardOwners || [];
  if (!rows.length) {
    leaders.innerHTML = `<div class="leader-item"><div class="leader-copy"><div class="leader-rank">-</div><div><div class="leader-name">No activity yet</div><div class="leader-email">Once teachers update boards, they will appear here</div></div></div></div>`;
    return;
  }
  leaders.innerHTML = rows.map((row, idx) => `
    <div class="leader-item">
      <div class="leader-copy">
        <div class="leader-rank">${idx + 1}</div>
        <div>
          <div class="leader-name">${esc(row.name || 'Unknown')}</div>
          <div class="leader-email">${esc(row.email || '—')}</div>
        </div>
      </div>
      <div class="leader-metric">${row.boards} updates</div>
    </div>
  `).join('');
}

function renderSpark(points, barsId, totalId, startId, tone, total) {
  const bars = document.getElementById(barsId);
  const totalEl = document.getElementById(totalId);
  const startEl = document.getElementById(startId);
  totalEl.textContent = total;
  if (!points.length) {
    bars.innerHTML = '';
    startEl.textContent = 'No data';
    return;
  }
  const max = Math.max(...points.map(p => p.count), 1);
  bars.innerHTML = points.map(point => {
    const height = Math.max(10, Math.round((point.count / max) * 72));
    return `<div class="sparkbar ${tone}" style="height:${height}px" title="${esc(point.day)}: ${point.count}"></div>`;
  }).join('');
  startEl.textContent = shortDay(points[0].day);
}

// ── Admin Brief ───────────────────────────────────────────────────────────
async function loadAdminBrief() {
  try {
    const brief = await api('GET', '/api/admin/brief');
    renderAdminBrief(brief);
  } catch (e) {
    const root = document.getElementById('admin-brief');
    root.querySelector('.brief-sub').textContent = `Brief unavailable: ${e.message}`;
  }
}

function renderAdminBrief(brief) {
  const root = document.getElementById('admin-brief');
  root.querySelector('.brief-score').style.setProperty('--score', brief.score || 0);
  root.querySelector('.brief-score-num').textContent = brief.score ?? '—';
  root.querySelector('.brief-sub').textContent =
    brief.tone === 'good' ? 'Platform looks healthy. Keep momentum and review routine operations.' :
    brief.tone === 'watch' ? 'A few operational items need attention before they pile up.' :
    'Platform needs admin attention. Start with the recommended actions below.';
  root.querySelector('.brief-highlights').innerHTML = (brief.highlights || []).map(text =>
    `<div class="brief-highlight">${esc(text)}</div>`
  ).join('');
  root.querySelector('.brief-actions').innerHTML = (brief.actions || []).map(action =>
    `<button class="brief-action ${escAttr(action.tone || 'good')}" onclick="${escAttr(action.action || '')}">${esc(action.label)}</button>`
  ).join('');
}

// ── Timeline ──────────────────────────────────────────────────────────────
async function loadTimeline() {
  try {
    const d = await api('GET', '/api/admin/timeline');
    timelineEvents = d.events || [];
    renderTimeline();
  } catch (e) {
    document.getElementById('timeline-list').innerHTML =
      `<div class="activity-item"><div><div class="activity-title">Timeline failed</div><div class="activity-sub">${esc(e.message)}</div></div></div>`;
  }
}

function setTimelineFilter(type, el) {
  timelineFilter = type;
  document.querySelectorAll('#timeline-filters .filter-chip').forEach(chip => chip.classList.remove('active'));
  if (el) el.classList.add('active');
  renderTimeline();
}

function renderTimeline() {
  const root = document.getElementById('timeline-list');
  const visible = timelineFilter ? timelineEvents.filter(event => event.type === timelineFilter) : timelineEvents;
  if (!visible.length) {
    root.innerHTML = `<div class="activity-item"><div><div class="activity-title">No timeline events</div><div class="activity-sub">Try another filter or refresh later.</div></div></div>`;
    return;
  }
  root.innerHTML = visible.slice(0, 18).map(event => `
    <div class="timeline-item">
      <div class="timeline-icon">${timelineIcon(event.type)}</div>
      <div>
        <div class="timeline-title">${esc(event.title || 'Untitled')}</div>
        <div class="timeline-detail">${esc(event.detail || '')}${event.actor ? ` · ${esc(event.actor)}` : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        ${event.type === 'board' && event.ref_id ? `<button class="btn-sm btn-edit" onclick="openBoard('${escAttr(event.ref_id)}')">Open</button>` : ''}
        <div class="timeline-time">${fmtRelative(event.at)}</div>
      </div>
    </div>
  `).join('');
}

function timelineIcon(type) {
  return { user:'👤', board:'📋', session:'🔑', invite:'📩' }[type] || '•';
}

// ── Admin Spotlight ───────────────────────────────────────────────────────
function debounceAdminSearch() {
  clearTimeout(adminSearchTimer);
  adminSearchTimer = setTimeout(loadAdminSearch, 260);
}

async function loadAdminSearch() {
  const input = document.getElementById('admin-spotlight-input');
  const root = document.getElementById('admin-spotlight-results');
  const q = input?.value.trim() || '';
  if (q.length < 2) {
    root.innerHTML = spotlightPlaceholder();
    return;
  }
  root.innerHTML = spotlightLoading(q);
  try {
    const d = await api('GET', `/api/admin/search?q=${encodeURIComponent(q)}`);
    root.innerHTML = [
      renderSpotlightGroup('Users', d.users || [], item => ({
        title: `${item.avatar || ''} ${item.name}`,
        meta: `${item.email} · ${item.role} · ${item.boards_count || 0} board(s)`,
        action: `<button class="spotlight-action" onclick="spotlightOpenUser('${escAttr(item.email)}','${escAttr(item.role)}')">Open</button>`,
      })),
      renderSpotlightGroup('Boards', d.boards || [], item => ({
        title: item.name,
        meta: `${item.owner_name} · ${item.cards_count || 0} card(s) · ${fmtDate(item.updated_at)}`,
        action: `<button class="spotlight-action" onclick="openBoard('${escAttr(item.id)}')">Open</button>`,
      })),
      renderSpotlightGroup('Invites', d.invites || [], item => ({
        title: item.email,
        meta: `${item.role} · ${inviteState(item).label} · ${fmtDate(item.expires_at)}`,
        action: `<button class="spotlight-action" onclick="copyInviteLink('${escAttr(item.token || '')}')">Copy</button>`,
      })),
    ].join('');
  } catch (e) {
    root.innerHTML = `<div class="spotlight-group"><div class="spotlight-group-title">Search</div><div class="spotlight-empty">Search failed: ${esc(e.message)}</div></div>`;
  }
}

function spotlightPlaceholder() {
  return ['Users', 'Boards', 'Invites'].map((title, idx) => `
    <div class="spotlight-group">
      <div class="spotlight-group-title">${title}</div>
      <div class="spotlight-empty">${idx === 0 ? 'Type at least 2 characters.' : 'Results appear here.'}</div>
    </div>
  `).join('');
}

function spotlightLoading(q) {
  return ['Users', 'Boards', 'Invites'].map(title => `
    <div class="spotlight-group">
      <div class="spotlight-group-title">${title}</div>
      <div class="spotlight-empty">Searching for "${esc(q)}"…</div>
    </div>
  `).join('');
}

function renderSpotlightGroup(title, items, mapper) {
  const body = items.length ? items.map(item => {
    const row = mapper(item);
    return `<div class="spotlight-result">
      <div>
        <div class="spotlight-main">${esc(row.title)}</div>
        <div class="spotlight-meta">${esc(row.meta)}</div>
      </div>
      ${row.action || ''}
    </div>`;
  }).join('') : '<div class="spotlight-empty">No matches.</div>';
  return `<div class="spotlight-group"><div class="spotlight-group-title">${title}</div>${body}</div>`;
}

function spotlightOpenUser(email, role) {
  showPage('users');
  document.getElementById('users-search').value = email;
  setUsersRoleFilter(role || '');
}

// ── Audit ─────────────────────────────────────────────────────────────────
async function loadAudit() {
  try {
    const d = await api('GET', '/api/admin/audit');
    renderAuditWarnings(d.warnings || []);
    renderAuditList('audit-stale', 'audit-stale-count', d.staleBoards || [], item => ({
      title: item.name,
      sub: `${item.owner_name} · ${item.owner_email} · updated ${fmtDate(item.updated_at)}`,
    }));
    renderAuditList('audit-empty', 'audit-empty-count', d.emptyBoards || [], item => ({
      title: item.name,
      sub: `${item.owner_name} · ${item.owner_email} · updated ${fmtDate(item.updated_at)}`,
    }));
    renderAuditList('audit-noboards', 'audit-noboards-count', d.usersNoBoards || [], item => ({
      title: item.name,
      sub: `${item.email} · ${item.role} · joined ${fmtDate(item.created_at)}`,
    }));
    renderAuditList('audit-admins', 'audit-admins-count', d.admins || [], item => ({
      title: item.name,
      sub: `${item.email} · admin since ${fmtDate(item.created_at)}`,
    }));
    renderAuditList('audit-expiring', 'audit-expiring-count', d.expiringSessions || [], item => ({
      title: item.user_name,
      sub: `${item.user_email} · expires ${fmtDate(item.expires_at)}`,
    }));
    renderAuditList('audit-recent', 'audit-recent-count', d.recentUsers || [], item => ({
      title: item.name,
      sub: `${item.email} · ${item.role} · joined ${fmtDate(item.created_at)}`,
    }));
    loadAdminAuditLog();
  } catch(e) {
    document.getElementById('audit-warnings').innerHTML = `<div class="audit-warning medium">Audit failed: ${esc(e.message)}</div>`;
  }
}

async function loadAdminAuditLog() {
  const tbody = document.getElementById('admin-auditlog-tbody');
  if (!tbody) return;
  try {
    const d = await api('GET', '/api/admin/audit-log?limit=50');
    if (!d.entries || !d.entries.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No admin actions recorded yet.</td></tr>';
      return;
    }
    tbody.innerHTML = d.entries.map(e => `<tr>
      <td class="time-text">${fmtDate(e.created_at)}</td>
      <td>${esc(e.admin_email || '—')}</td>
      <td><span class="badge badge-teacher">${esc(e.action)}</span></td>
      <td>${esc(e.target_label || '—')}</td>
      <td style="color:var(--muted);font-size:13px">${esc(e.detail || '')}</td>
      <td class="time-text">${esc(e.ip || '')}</td>
    </tr>`).join('');
  } catch(e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Error: ${esc(e.message)}</td></tr>`;
  }
}

function renderAuditWarnings(warnings) {
  const el = document.getElementById('audit-warnings');
  if (!warnings.length) {
    el.innerHTML = '<div class="audit-warning">No audit warnings right now. System looks clean.</div>';
    return;
  }
  el.innerHTML = warnings.map(w =>
    `<div class="audit-warning ${w.level === 'medium' ? 'medium' : ''}">⚠️ <span>${esc(w.text)}</span></div>`
  ).join('');
}

function renderAuditList(listId, countId, items, mapper) {
  document.getElementById(countId).textContent = items.length;
  const el = document.getElementById(listId);
  if (!items.length) {
    el.innerHTML = '<div class="empty-note">Nothing to review.</div>';
    return;
  }
  el.innerHTML = items.map(item => {
    const row = mapper(item);
    return `<div class="audit-item">
      <div class="audit-main">${esc(row.title)}</div>
      <div class="audit-sub">${esc(row.sub)}</div>
    </div>`;
  }).join('');
}

// ── Users ─────────────────────────────────────────────────────────────────
let usersOffset = 0, usersTotal = 0, usersLimit = 20, usersRoleFilter = '';
let usersSearchTimer;

function debounceUsersSearch() {
  clearTimeout(usersSearchTimer);
  usersSearchTimer = setTimeout(() => { usersOffset = 0; loadUsers(); }, 350);
}

function usersPage(dir) {
  usersOffset = Math.max(0, Math.min(usersTotal - usersLimit, usersOffset + dir * usersLimit));
  loadUsers();
}

function setUsersRoleFilter(role, el) {
  usersRoleFilter = role;
  usersOffset = 0;
  document.querySelectorAll('#users-role-filters .filter-chip').forEach(chip => chip.classList.remove('active'));
  const target = el || [...document.querySelectorAll('#users-role-filters .filter-chip')]
    .find(chip => chip.getAttribute('onclick')?.includes(`'${role}'`) || (!role && chip.textContent.trim() === 'All'));
  if (target) target.classList.add('active');
  loadUsers();
}

async function loadUsers() {
  const search = document.getElementById('users-search').value;
  const tbody  = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="9">Loading…</td></tr>';
  try {
    const d = await api('GET', `/api/admin/users?search=${encodeURIComponent(search)}&role=${encodeURIComponent(usersRoleFilter)}&limit=${usersLimit}&offset=${usersOffset}`);
    usersTotal = d.total;
    document.getElementById('users-page-info').textContent =
      `${usersOffset+1}–${Math.min(usersOffset+usersLimit, usersTotal)} of ${usersTotal}`;
    document.getElementById('users-prev').disabled = usersOffset === 0;
    document.getElementById('users-next').disabled = usersOffset + usersLimit >= usersTotal;
    const saEl = document.getElementById('bulk-select-all');
    if (saEl) saEl.checked = false;

    if (!d.users.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No users found</td></tr>';
      return;
    }
    tbody.innerHTML = d.users.map(u => {
      const qU = JSON.stringify(u).replace(/"/g,'&quot;');
      const isSelected = selectedUserIds.has(u.id);
      return `<tr>
        <td><input type="checkbox" class="row-check" data-id="${u.id}" onchange="toggleRowCheck(this)" ${isSelected?'checked':''} style="accent-color:var(--lime);cursor:pointer"></td>
        <td class="avatar-cell" data-label="Avatar" style="cursor:pointer" onclick="openUserDrawer(${qU})">${u.avatar}</td>
        <td data-label="Name" style="cursor:pointer" onclick="openUserDrawer(${qU})"><strong>${esc(u.name)}</strong></td>
        <td data-label="Email" style="color:var(--muted);font-size:13px">${esc(u.email)}</td>
        <td data-label="Role"><span class="badge badge-${u.role}">${u.role}</span></td>
        <td data-label="Plan">
          <span class="badge badge-${u.plan==='school'?'admin':u.plan==='pro'?'teacher':'student'}">${u.plan||'free'}</span>
          <div class="time-text">${esc(u.plan_status||'free')} · ${esc(u.billing_cycle||'monthly')}</div>
          ${u.plan_expires_at?`<div class="time-text">until ${fmtDate(u.plan_expires_at)}</div>`:''}
        </td>
        <td data-label="Boards" style="text-align:center">${u.boards_count}</td>
        <td data-label="Joined" class="time-text">${fmtDate(u.created_at)}</td>
        <td data-label="Actions">
          <div class="action-group">
            <button class="btn-sm btn-edit" onclick="openUserDrawer(${qU})">👤 View</button>
            <button class="btn-sm btn-edit" onclick="openEditUser(${qU})">✏️ Edit</button>
            <button class="btn-sm btn-orange" onclick="kickUser('${u.id}','${esc(u.name)}')">🔑 Kick</button>
            <button class="btn-sm btn-danger" onclick="deleteUser('${u.id}','${esc(u.name)}')">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">Error: ${e.message}</td></tr>`;
  }
}

let editingUserId = null;
let editingUserEmail = '';
function openEditUser(u) {
  editingUserId = u.id;
  editingUserEmail = u.email || '';
  document.getElementById('modal-user-title').textContent = `Edit: ${u.name}`;
  document.getElementById('mu-name').value   = u.name;
  document.getElementById('mu-email').value  = u.email;
  document.getElementById('mu-role').value   = u.role;
  document.getElementById('mu-plan').value   = u.plan || 'free';
  document.getElementById('mu-plan-status').value = u.plan_status || (u.plan === 'free' ? 'free' : 'active');
  document.getElementById('mu-billing-cycle').value = u.billing_cycle || 'monthly';
  document.getElementById('mu-plan-expires').value = u.plan_expires_at ? new Date(u.plan_expires_at).toISOString().slice(0, 10) : '';
  document.getElementById('mu-avatar').value = u.avatar;
  document.getElementById('mu-pass').value   = '';
  document.getElementById('modal-user').classList.add('open');
}

function closeUserModal() {
  document.getElementById('modal-user').classList.remove('open');
}

async function saveUser() {
  const body = {
    name:   document.getElementById('mu-name').value.trim(),
    role:   document.getElementById('mu-role').value,
    plan:   document.getElementById('mu-plan').value,
    plan_status: document.getElementById('mu-plan-status').value,
    billing_cycle: document.getElementById('mu-billing-cycle').value,
    plan_expires_at: document.getElementById('mu-plan-expires').value || null,
    avatar: document.getElementById('mu-avatar').value.trim(),
  };
  const pass = document.getElementById('mu-pass').value;
  if (pass) { if (pass.length < 8) { toast('Password min 8 chars','error'); return; } body.password = pass; }
  const newEmail = document.getElementById('mu-email').value.trim().toLowerCase();
  if (newEmail && newEmail !== editingUserEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { toast('Invalid email','error'); return; }
    body.email = newEmail;
  }
  try {
    await api('PATCH', `/api/admin/users/${editingUserId}`, body);
    closeUserModal();
    toast('User updated ✅', 'success');
    loadUsers();
  } catch(e) { toast(e.message, 'error'); }
}

function openAddUser() { document.getElementById('modal-add-user').classList.add('open'); }

async function createUser() {
  const name  = document.getElementById('au-name').value.trim();
  const email = document.getElementById('au-email').value.trim();
  const pass  = document.getElementById('au-pass').value;
  const role  = document.getElementById('au-role').value;
  if (!name||!email||!pass) { toast('All fields required','error'); return; }
  if (pass.length < 8) { toast('Password min 8 chars','error'); return; }
  try {
    await api('POST', '/api/admin/users', { name, email, password: pass, role });
    document.getElementById('modal-add-user').classList.remove('open');
    toast('User created ✅', 'success');
    ['au-name','au-email','au-pass'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('au-role').value = 'teacher';
    loadUsers();
    refreshStats();
  } catch(e) { toast(e.message, 'error'); }
}

function deleteUser(id, name) {
  confirm(`Delete "${name}"?`, 'All boards and sessions will be permanently deleted.', '🗑️', async () => {
    try {
      await api('DELETE', `/api/admin/users/${id}`);
      toast('User deleted', 'success');
      loadUsers();
      refreshStats();
    } catch(e) { toast(e.message, 'error'); }
  });
}

function kickUser(userId, name) {
  confirm(`Kick "${name}"?`, 'All active sessions for this user will be revoked.', '🔑', async () => {
    try {
      await api('DELETE', `/api/admin/sessions/user/${userId}`);
      toast('Sessions revoked ✅', 'success');
    } catch(e) { toast(e.message, 'error'); }
  });
}

// ── Package Control ──────────────────────────────────────────────────────
const PLAN_CATALOG = {
  free: {
    label: 'Free',
    price: '$0',
    defaultStatus: 'free',
    defaultCycle: 'monthly',
    limits: ['3 boards', '5 students', '50 MB storage', 'basic exports'],
  },
  pro: {
    label: 'Teacher Pro',
    price: '$19/mo',
    defaultStatus: 'active',
    defaultCycle: 'monthly',
    limits: ['unlimited boards', '80 students', '2 GB storage', 'ready lessons'],
  },
  school: {
    label: 'School',
    price: '$79/mo',
    defaultStatus: 'active',
    defaultCycle: 'monthly',
    limits: ['10 teachers', '500 students', '20 GB storage', 'full admin tools'],
  },
};

function applyUserPlanPreset(plan, months = 1) {
  if (plan === 'trial') {
    document.getElementById('mu-plan').value = 'pro';
    document.getElementById('mu-plan-status').value = 'grace';
    document.getElementById('mu-billing-cycle').value = 'monthly';
    document.getElementById('mu-plan-expires').value = dateInputAfterDays(14);
    toast('14-day trial preset applied', 'success');
    return;
  }
  const config = PLAN_CATALOG[plan] || PLAN_CATALOG.free;
  document.getElementById('mu-plan').value = plan;
  document.getElementById('mu-plan-status').value = config.defaultStatus;
  document.getElementById('mu-billing-cycle').value = months >= 12 ? 'yearly' : months >= 3 ? 'quarterly' : config.defaultCycle;
  document.getElementById('mu-plan-expires').value = months > 0 ? dateInputAfterMonths(months) : '';
  toast(`${config.label} preset applied`, 'success');
}

function fillGrantPlan(plan, status, cycle, months) {
  document.getElementById('grant-plan').value = plan;
  document.getElementById('grant-status').value = status;
  document.getElementById('grant-cycle').value = cycle;
  document.getElementById('grant-months').value = months;
  showPage('packages');
  updateGrantPreview();
  setTimeout(() => document.getElementById('grant-email')?.focus(), 80);
}

function grantPayloadFromForm() {
  const plan = document.getElementById('grant-plan').value;
  const status = document.getElementById('grant-status').value;
  const billing_cycle = document.getElementById('grant-cycle').value;
  const months = Math.max(0, Math.min(24, Number(document.getElementById('grant-months').value || 0)));
  const plan_expires_at = months > 0 ? dateInputAfterMonths(months) : null;
  return { plan, plan_status: status, billing_cycle, plan_expires_at, months };
}

function updateGrantPreview() {
  const el = document.getElementById('grant-preview');
  if (!el) return;
  const payload = grantPayloadFromForm();
  const config = PLAN_CATALOG[payload.plan] || PLAN_CATALOG.free;
  el.innerHTML = `
    <strong>${config.label}</strong> · ${esc(config.price)} · ${billingCycleLabel(payload.billing_cycle)}<br>
    Status: <strong>${esc(payload.plan_status)}</strong>${payload.plan_expires_at ? ` · expires <strong>${fmtDate(payload.plan_expires_at)}</strong>` : ' · no expiration date'}<br>
    Unlocks: ${config.limits.map(esc).join(', ')}
  `;
}

async function grantSubscription() {
  const email = document.getElementById('grant-email').value.trim();
  if (!email) { toast('Enter user email', 'error'); return; }
  const payload = grantPayloadFromForm();
  confirm(
    `Apply ${PLAN_CATALOG[payload.plan]?.label || payload.plan} to ${email}?`,
    payload.plan_expires_at ? `Subscription will expire on ${fmtDate(payload.plan_expires_at)}.` : 'This plan will be applied without an expiration date.',
    '📦',
    async () => {
      try {
        const id = await userIdByEmail(email);
        await api('PATCH', `/api/admin/users/${id}`, {
          plan: payload.plan,
          plan_status: payload.plan_status,
          billing_cycle: payload.billing_cycle,
          plan_expires_at: payload.plan_expires_at,
        });
        toast('Subscription updated ✅', 'success');
        loadPackageControl();
        refreshStats();
        if (document.getElementById('page-users').classList.contains('active')) loadUsers();
      } catch (e) {
        toast(e.message, 'error');
      }
    }
  );
}

async function copyGrantInvoice() {
  const email = document.getElementById('grant-email').value.trim() || '[client email]';
  const payload = grantPayloadFromForm();
  const config = PLAN_CATALOG[payload.plan] || PLAN_CATALOG.free;
  const invoiceText = [
    `TeachEd invoice / manual confirmation`,
    `Client: ${email}`,
    `Plan: ${config.label}`,
    `Cycle: ${billingCycleLabel(payload.billing_cycle)}`,
    `Status after confirmation: ${payload.plan_status}`,
    `Period: ${payload.months || 'no fixed period'} month(s)`,
    `Expires: ${payload.plan_expires_at ? fmtDate(payload.plan_expires_at) : 'no expiration'}`,
    `Limits: ${config.limits.join(', ')}`,
    `Admin note: activate after bank transfer confirmation.`,
  ].join('\n');
  try {
    await navigator.clipboard.writeText(invoiceText);
    toast('Invoice text copied', 'success');
  } catch {
    toast(invoiceText, '');
  }
}

async function loadPackageControl() {
  updateGrantPreview();
  try {
    const d = await api('GET', '/api/admin/billing/summary');
    document.getElementById('pkg-pro-users').textContent = d.plans?.pro ?? 0;
    document.getElementById('pkg-school-users').textContent = d.plans?.school ?? 0;
    document.getElementById('pkg-pending').textContent = d.statuses?.pending ?? 0;
    document.getElementById('pkg-approved').textContent = `$${Number(d.approved30d || 0).toFixed(2)}`;
    const rows = d.expiringSoon || [];
    const root = document.getElementById('pkg-expiring-list');
    if (!rows.length) {
      root.innerHTML = `<div class="activity-item"><div><div class="activity-title">No expirations soon</div><div class="activity-sub">Paid access looks stable for the next 7 days.</div></div></div>`;
      return;
    }
    root.innerHTML = rows.map(user => `
      <div class="activity-item">
        <div>
          <div class="activity-title">${esc(user.name)} <span class="badge badge-${user.plan === 'school' ? 'admin' : 'teacher'}">${esc(user.plan)}</span></div>
          <div class="activity-sub">${esc(user.email)} · ${esc(user.plan_status || 'active')} · ${esc(user.billing_cycle || 'monthly')}</div>
        </div>
        <div class="activity-meta">${fmtDate(user.plan_expires_at)}</div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('pkg-expiring-list').innerHTML =
      `<div class="activity-item"><div><div class="activity-title">Package summary unavailable</div><div class="activity-sub">${esc(e.message)}</div></div></div>`;
  }
}

async function copyLimitPolicy() {
  const lines = [
    'TeachEd package limits',
    'Free: 3 boards, 5 students, 50 MB storage, basic exports, community view only',
    'Teacher Pro: unlimited boards, 80 students, 2 GB storage, ready lessons, community publishing',
    'School: 10 teachers, 500 students, 20 GB storage, full admin tools, team publishing',
  ];
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    toast('Limit policy copied', 'success');
  } catch {
    toast(lines.join(' · '), '');
  }
}

function dateInputAfterMonths(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + Number(months || 0));
  return d.toISOString().slice(0, 10);
}

function dateInputAfterDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

// ── Billing ──────────────────────────────────────────────────────────────
async function loadBillingSummary() {
  try {
    const d = await api('GET', '/api/admin/billing/summary');
    document.getElementById('bill-pending').textContent = d.statuses?.pending ?? 0;
    document.getElementById('bill-approved-30d').textContent = `$${Number(d.approved30d || 0).toFixed(2)}`;
    document.getElementById('bill-pro-users').textContent = d.plans?.pro ?? 0;
    document.getElementById('bill-school-users').textContent = d.plans?.school ?? 0;
    const root = document.getElementById('billing-expiring-list');
    const rows = d.expiringSoon || [];
    if (!rows.length) {
      root.innerHTML = `<div class="activity-item"><div><div class="activity-title">No paid plans expiring soon</div><div class="activity-sub">The next 7 days look clear.</div></div></div>`;
      return;
    }
    root.innerHTML = rows.map(user => `
      <div class="activity-item">
        <div>
          <div class="activity-title">${esc(user.name)} <span class="badge badge-${user.plan === 'school' ? 'admin' : 'teacher'}">${esc(user.plan)}</span></div>
          <div class="activity-sub">${esc(user.email)} · ${esc(user.plan_status || 'active')} · ${esc(user.billing_cycle || 'monthly')}</div>
        </div>
        <div class="activity-meta">${fmtDate(user.plan_expires_at)}</div>
      </div>
    `).join('');
  } catch(e) {
    document.getElementById('billing-expiring-list').innerHTML =
      `<div class="activity-item"><div><div class="activity-title">Billing summary unavailable</div><div class="activity-sub">${esc(e.message)}</div></div></div>`;
  }
}

async function loadBillingPayments() {
  const tbody = document.getElementById('billing-tbody');
  if (!tbody) return;
  const status = document.getElementById('billing-status-filter')?.value || '';
  tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Loading…</td></tr>';
  try {
    const d = await api('GET', `/api/admin/billing/payments?status=${encodeURIComponent(status)}`);
    if (!d.payments.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No payment requests found</td></tr>';
      return;
    }
    tbody.innerHTML = d.payments.map(p => {
      const pending = p.status === 'pending';
      const amount = `${Number(p.amount || 0).toFixed(2)} ${(p.currency || 'usd').toUpperCase()}`;
      const note = p.tx_note ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">${esc(p.tx_note)}</div>` : '';
      const adminNote = p.admin_note ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">Admin: ${esc(p.admin_note)}</div>` : '';
      const currentState = `${esc(p.current_plan || 'free')} · ${esc(p.current_plan_status || 'free')} · ${esc(p.current_billing_cycle || 'monthly')}`;
      return `
        <tr>
          <td data-label="Invoice"><strong>${esc(p.invoice_no || '#' + p.id)}</strong><div class="time-text">${fmtDate(p.created_at)}</div></td>
          <td data-label="User"><strong>${esc(p.user_name || 'Unknown')}</strong><div style="font-size:12px;color:var(--muted)">${esc(p.user_email || '')}</div>${p.contact_email ? `<div class="time-text">Billing: ${esc(p.contact_email)}</div>` : ''}</td>
          <td data-label="Plan"><span class="badge badge-${p.plan === 'school' ? 'admin' : 'teacher'}">${esc(p.plan)}</span><div class="time-text">Current: ${currentState}</div>${p.current_plan_expires_at ? `<div class="time-text">Expires: ${fmtDate(p.current_plan_expires_at)}</div>` : ''}</td>
          <td data-label="Amount"><strong>${amount}</strong><div class="time-text">${esc(p.payer_name || '')}</div><div class="time-text">${Number(p.months || 1)} month(s)</div></td>
          <td data-label="Billing">${billingCycleLabel(p.billing_cycle || 'monthly')} · ${fmtDate(p.tx_date)}${p.company_name ? `<div class="time-text">${esc(p.company_name)}</div>` : ''}${note}${adminNote}</td>
          <td data-label="Status"><span class="badge badge-${p.status === 'approved' ? 'admin' : p.status === 'rejected' ? 'student' : 'teacher'}">${esc(p.status)}</span></td>
          <td data-label="Actions">
            ${pending ? `<div class="action-group">
              <button class="btn-sm btn-green" onclick="approvePayment(${p.id}, '${escAttr(p.user_name || 'user')}', '${escAttr(p.plan)}', ${Number(p.months || 1)}, '${escAttr(p.billing_cycle || 'monthly')}', '${escAttr(p.invoice_no || '')}')">Approve</button>
              <button class="btn-sm btn-danger" onclick="rejectPayment(${p.id}, '${escAttr(p.user_name || 'user')}')">Reject</button>
            </div>` : `<span class="time-text">${p.reviewed_by_name ? 'By ' + esc(p.reviewed_by_name) : 'Reviewed'}</span>`}
          </td>
        </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Error: ${esc(e.message)}</td></tr>`;
  }
}

function approvePayment(id, name, plan, defaultMonths = 1, cycle = 'monthly', invoiceNo = '') {
  const monthsRaw = prompt(`Approve ${plan} for ${name}. Months to activate:`, String(defaultMonths || 1));
  if (monthsRaw === null) return;
  const months = Math.max(1, Math.min(24, parseInt(monthsRaw, 10) || 1));
  const note = prompt('Admin note (optional):', 'Bank transfer confirmed');
  const invoiceLabel = invoiceNo ? `Invoice ${invoiceNo}` : `Payment #${id}`;
  confirm(`Approve ${invoiceLabel}?`, `This will activate ${plan} on ${cycle} billing for ${months} month(s).`, '💳', async () => {
    try {
      await api('POST', `/api/admin/billing/payments/${id}/approve`, { months, note: note || '' });
      toast('Payment approved and plan activated', 'success');
      loadBillingSummary();
      loadBillingPayments();
      refreshStats();
    } catch(e) { toast(e.message, 'error'); }
  }, {label: 'Approve', color: '#007B55'});
}

function copyAdminCard() {
  const num = document.getElementById('admin-card-number')?.textContent;
  navigator.clipboard?.writeText(num?.replace(/\s/g,'')||'').then(() => toast('Card number copied', 'success'));
}

function rejectPayment(id, name) {
  const note = prompt(`Why reject payment request for ${name}?`, 'Payment not found');
  if (note === null) return;
  confirm(`Reject payment #${id}?`, 'The user plan will not be changed.', '⚠️', async () => {
    try {
      await api('POST', `/api/admin/billing/payments/${id}/reject`, { note });
      toast('Payment rejected', 'success');
      loadBillingSummary();
      loadBillingPayments();
      refreshStats();
    } catch(e) { toast(e.message, 'error'); }
  });
}

// ── Boards ────────────────────────────────────────────────────────────────
let boardsOffset = 0, boardsTotal = 0, boardsLimit = 20;
let boardsSearchTimer;

function debounceBoardsSearch() {
  clearTimeout(boardsSearchTimer);
  boardsSearchTimer = setTimeout(() => { boardsOffset = 0; loadBoards(); }, 350);
}

function boardsPage(dir) {
  boardsOffset = Math.max(0, Math.min(boardsTotal - boardsLimit, boardsOffset + dir * boardsLimit));
  loadBoards();
}

async function loadBoards() {
  const search = document.getElementById('boards-search').value;
  const tbody  = document.getElementById('boards-tbody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Loading…</td></tr>';
  try {
    const d = await api('GET', `/api/admin/boards?search=${encodeURIComponent(search)}&limit=${boardsLimit}&offset=${boardsOffset}`);
    boardsTotal = d.total;
    document.getElementById('boards-page-info').textContent =
      `${boardsOffset+1}–${Math.min(boardsOffset+boardsLimit,boardsTotal)} of ${boardsTotal}`;
    document.getElementById('boards-prev').disabled = boardsOffset === 0;
    document.getElementById('boards-next').disabled = boardsOffset + boardsLimit >= boardsTotal;

    if (!d.boards.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No boards found</td></tr>';
      return;
    }
    tbody.innerHTML = d.boards.map(b => `
      <tr>
        <td data-label="Board"><strong>${esc(b.name)}</strong></td>
        <td data-label="Owner">
          <div style="font-size:13px;font-weight:700">${esc(b.owner_name)}</div>
          <div class="ip-text">${esc(b.owner_email)}</div>
        </td>
        <td data-label="Cards" style="text-align:center">${b.cards_count ?? '—'}</td>
        <td data-label="Size" class="ip-text">${fmtBytes(b.data_bytes)}</td>
        <td data-label="Updated" class="time-text">${fmtDate(b.updated_at)}</td>
        <td data-label="Created" class="time-text">${fmtDate(b.created_at)}</td>
        <td data-label="Actions">
          <div class="action-group">
            <button class="btn-sm btn-edit" onclick="openBoard('${b.id}')">↗ Open</button>
            <button class="btn-sm btn-danger" onclick="deleteBoard('${b.id}','${esc(b.name)}')">🗑 Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">Error: ${e.message}</td></tr>`;
  }
}

function openBoard(id) {
  window.open(`board.html?id=${encodeURIComponent(id)}`, '_blank', 'noopener');
}

function deleteBoard(id, name) {
  confirm(`Delete board "${name}"?`, 'This will permanently delete the board and all its data.', '📋', async () => {
    try {
      await api('DELETE', `/api/admin/boards/${id}`);
      toast('Board deleted', 'success');
      loadBoards();
      refreshStats();
    } catch(e) { toast(e.message, 'error'); }
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────
async function loadSessions() {
  const tbody = document.getElementById('sessions-tbody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Loading…</td></tr>';
  try {
    const d = await api('GET', '/api/admin/sessions');
    if (!d.sessions.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No active sessions</td></tr>';
      return;
    }
    tbody.innerHTML = d.sessions.map(s => `
      <tr>
        <td data-label="User">
          <div style="font-weight:700">${s.user_avatar} ${esc(s.user_name)}</div>
          <div class="ip-text">${esc(s.user_email)}</div>
        </td>
        <td data-label="Device" style="font-size:12px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(uaIcon(s.user_agent))} ${esc(s.user_agent||'Unknown')}
        </td>
        <td data-label="IP" class="ip-text">${esc(s.ip||'—')}</td>
        <td data-label="Started" class="time-text">${fmtDate(s.created_at)}</td>
        <td data-label="Expires" class="time-text">${fmtDate(s.expires_at)}</td>
        <td data-label="Action">
          <button class="btn-sm btn-danger" onclick="revokeSession('${s.id}')">Revoke</button>
        </td>
      </tr>
    `).join('');
  } catch(e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Error: ${e.message}</td></tr>`;
  }
}

async function revokeSession(id) {
  try {
    await api('DELETE', `/api/admin/sessions/${id}`);
    toast('Session revoked', 'success');
    loadSessions();
  } catch(e) { toast(e.message,'error'); }
}

function revokeAllSessions() {
  confirm('Revoke ALL sessions?', 'This will log out every user (including you).', '🔑', async () => {
    try {
      // revoke all by listing and deleting each
      const d = await api('GET', '/api/admin/sessions');
      await Promise.all(d.sessions.map(s => api('DELETE', `/api/admin/sessions/${s.id}`)));
      toast(`Revoked ${d.sessions.length} sessions`, 'success');
      loadSessions();
      refreshStats();
    } catch(e) { toast(e.message,'error'); }
  });
}

// ── Settings ──────────────────────────────────────────────────────────────
async function promoteUser() {
  const email = document.getElementById('promote-email').value.trim();
  if (!email) { toast('Enter email','error'); return; }
  try {
    await api('PATCH', `/api/admin/users/${await userIdByEmail(email)}`, { role: 'admin' });
    toast(`${email} promoted to admin ✅`, 'success');
    document.getElementById('promote-email').value = '';
  } catch(e) { toast(e.message,'error'); }
}

async function demoteUser() {
  const email = document.getElementById('demote-email').value.trim();
  if (!email) { toast('Enter email','error'); return; }
  try {
    await api('PATCH', `/api/admin/users/${await userIdByEmail(email)}`, { role: 'teacher' });
    toast(`${email} demoted to teacher`, 'success');
    document.getElementById('demote-email').value = '';
  } catch(e) { toast(e.message,'error'); }
}

async function userIdByEmail(email) {
  const d = await api('GET', `/api/admin/users?search=${encodeURIComponent(email)}&limit=5`);
  const u = d.users.find(u => u.email === email.toLowerCase());
  if (!u) throw new Error('User not found');
  return u.id;
}

async function changeMyPassword() {
  const p1 = document.getElementById('new-pass').value;
  const p2 = document.getElementById('new-pass2').value;
  if (!p1 || !p2) { toast('Fill both fields','error'); return; }
  if (p1 !== p2) { toast('Passwords do not match','error'); return; }
  if (p1.length < 8) { toast('Min 8 characters','error'); return; }
  try {
    await api('PATCH', `/api/admin/users/${currentAdminUser.id}`, { password: p1 });
    toast('Password updated ✅', 'success');
    document.getElementById('new-pass').value = '';
    document.getElementById('new-pass2').value = '';
  } catch(e) { toast(e.message,'error'); }
}

async function purgeExpiredSessions() {
  try {
    const d = await api('DELETE', '/api/admin/sessions-expired');
    toast(`Purged ${d.deleted || 0} expired sessions`, 'success');
    loadSysInfo();
    refreshStats();
  } catch(e) {
    toast(e.message, 'error');
  }
}

async function loadSysInfo() {
  try {
    const [h, system] = await Promise.all([
      fetch(`${API}/health`).then(r=>r.json()).catch(()=>null),
      api('GET', '/api/admin/system'),
    ]);
    document.getElementById('sys-info').innerHTML = `
      <div>🟢 API: <strong>${h?.ok ? 'Online' : 'Offline'}</strong></div>
      <div>🕐 Server time: <strong>${system?.serverTime ? fmtDate(system.serverTime) : '—'}</strong></div>
      <div>⏱ Uptime: <strong>${fmtDuration(system?.uptimeSec)}</strong></div>
      <div>🧠 Node: <strong>${esc(system?.nodeVersion || '—')}</strong></div>
      <div>🧹 Expired sessions: <strong>${system?.expiredSessions ?? '—'}</strong></div>
      <div>🌐 Endpoint: <strong>${API}</strong></div>
      <div>👤 Admin: <strong>${currentAdminUser?.name || '—'}</strong></div>
    `;
  } catch(e) {
    document.getElementById('sys-info').textContent = 'Could not load system info';
  }
}

async function createInvite() {
  const email = document.getElementById('invite-email').value.trim();
  const role = document.getElementById('invite-role').value;
  const expiresInDays = Number(document.getElementById('invite-expiry').value || 7);
  const note = document.getElementById('invite-note').value.trim();
  if (!email) { toast('Enter invite email', 'error'); return; }
  try {
    const d = await api('POST', '/api/admin/invites', { email, role, expiresInDays, note });
    const inviteUrl = buildInviteUrl(d.invite.token);
    await navigator.clipboard.writeText(inviteUrl).catch(() => {});
    toast('Invite created and copied ✅', 'success');
    document.getElementById('invite-email').value = '';
    document.getElementById('invite-note').value = '';
    document.getElementById('invite-role').value = 'teacher';
    document.getElementById('invite-expiry').value = '7';
    loadInvites();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function loadInvites() {
  const root = document.getElementById('invite-list');
  if (!root) return;
  root.innerHTML = `<div class="invite-item"><div class="invite-email">Loading…</div><div class="invite-meta">Fetching recent invite links</div></div>`;
  try {
    const d = await api('GET', '/api/admin/invites');
    if (!d.invites.length) {
      root.innerHTML = `<div class="invite-item"><div class="invite-email">No invites yet</div><div class="invite-meta">Create your first onboarding link on the left</div></div>`;
      return;
    }
    root.innerHTML = d.invites.map(invite => `
      <div class="invite-item">
        <div class="invite-row">
          <div>
            <div class="invite-email">${esc(invite.email)}</div>
            <div class="invite-meta">
              Role: <strong>${esc(invite.role)}</strong><br>
              Expires: <strong>${fmtDate(invite.expires_at)}</strong><br>
              ${invite.note ? `Note: ${esc(invite.note)}<br>` : ''}
              ${invite.accepted_user_name ? `Accepted by: ${esc(invite.accepted_user_name)}<br>` : ''}
              Created by: ${esc(invite.created_by_name || currentAdminUser?.name || 'Admin')}
            </div>
          </div>
          <div class="invite-status ${inviteState(invite).tone}">${inviteState(invite).label}</div>
        </div>
        <div class="invite-actions">
          <button class="btn-sm btn-edit" type="button" onclick="copyInviteLink('${invite.token}')">Copy Link</button>
          ${inviteState(invite).tone === 'active' ? `<button class="btn-sm btn-danger" type="button" onclick="revokeInvite('${invite.id}','${esc(invite.email)}')">Revoke</button>` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {
    root.innerHTML = `<div class="invite-item"><div class="invite-email">Error</div><div class="invite-meta">${esc(e.message)}</div></div>`;
  }
}

async function exportAdminData(type) {
  try {
    const d = await api('GET', `/api/admin/export/${encodeURIComponent(type)}`);
    const rows = d.rows || [];
    if (!rows.length) { toast(`No ${type} data to export`, ''); return; }
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teached-${type}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`${type} CSV exported`, 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] || {});
  const lines = [headers.join(',')];
  rows.forEach(row => {
    lines.push(headers.map(key => csvCell(row[key])).join(','));
  });
  return lines.join('\n');
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/"/g, '""');
  return /[",\n\r]/.test(text) ? `"${text}"` : text;
}

function buildInviteUrl(tokenValue) {
  return new URL(`invite.html?token=${encodeURIComponent(tokenValue)}`, window.location.href).toString();
}

async function copyInviteLink(tokenValue) {
  const link = buildInviteUrl(tokenValue);
  try {
    await navigator.clipboard.writeText(link);
    toast('Invite link copied', 'success');
  } catch {
    toast(link, '');
  }
}

function revokeInvite(id, email) {
  confirm(`Revoke invite for "${email}"?`, 'The invite link will stop working immediately.', '📩', async () => {
    try {
      await api('DELETE', `/api/admin/invites/${id}`);
      toast('Invite revoked', 'success');
      loadInvites();
    } catch (e) {
      toast(e.message, 'error');
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s){ return esc(s).replace(/'/g,'&#39;'); }

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ' ' +
         d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}

function billingCycleLabel(cycle) {
  return ({ monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }[cycle] || 'Monthly');
}

function fmtBytes(n) {
  if (!n) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
  return (n/1048576).toFixed(1) + ' MB';
}

function fmtDuration(sec) {
  if (typeof sec !== 'number' || Number.isNaN(sec)) return '—';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function fmtRelative(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(diff / 60000));
  if (min < 1) return 'now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

function inviteState(invite) {
  if (invite.revoked_at) return { tone: 'revoked', label: 'Revoked' };
  if (invite.accepted_at) return { tone: 'used', label: 'Used' };
  if (new Date(invite.expires_at).getTime() <= Date.now()) return { tone: 'expired', label: 'Expired' };
  return { tone: 'active', label: 'Active' };
}

function shortDay(day) {
  if (!day) return '—';
  const d = new Date(`${day}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
}

function uaIcon(ua='') {
  if (/mobile|android|iphone/i.test(ua)) return '📱';
  if (/chrome/i.test(ua)) return '🌐';
  if (/firefox/i.test(ua)) return '🦊';
  if (/safari/i.test(ua)) return '🧭';
  return '💻';
}

// ── API Tester ─────────────────────────────────────────────────────────────
const AT_QUICK = [
  { label: 'GET /me', method: 'GET', path: '/api/auth/me' },
  { label: 'GET /users', method: 'GET', path: '/api/admin/users' },
  { label: 'GET /boards', method: 'GET', path: '/api/admin/boards' },
  { label: 'GET /billing', method: 'GET', path: '/api/admin/billing/summary' },
  { label: 'GET /payments', method: 'GET', path: '/api/admin/billing/payments' },
  { label: 'GET /packages', method: 'GET', path: '/api/admin/packages' },
  { label: 'GET /stats', method: 'GET', path: '/api/admin/stats' },
  { label: 'GET /sessions', method: 'GET', path: '/api/admin/sessions' },
  { label: 'GET /audit', method: 'GET', path: '/api/admin/audit?limit=20' },
  { label: 'POST login', method: 'POST', path: '/api/auth/login', body: '{"email":"test@test.com","password":"password"}' },
];

let atHistory = [];

function initApiTester() {
  // Fill auth header
  const authEl = document.getElementById('at-auth-header');
  if (authEl && token) authEl.value = `Bearer ${token}`;

  // Render quick buttons
  const btns = document.getElementById('at-quick-btns');
  if (btns) {
    btns.innerHTML = AT_QUICK.map((q, i) =>
      `<button onclick="loadQuickEndpoint(${i})" style="padding:5px 10px;background:rgba(28,28,30,.06);border:1.5px solid rgba(94,94,74,.18);border-radius:8px;font-family:monospace;font-size:11px;font-weight:700;cursor:pointer;color:var(--text2)">${esc(q.label)}</button>`
    ).join('');
  }
}

function loadQuickEndpoint(i) {
  const q = AT_QUICK[i];
  if (!q) return;
  document.getElementById('at-method').value = q.method;
  document.getElementById('at-url').value = q.path;
  if (q.body) document.getElementById('at-body').value = q.body;
}

async function runApiTest() {
  const method = document.getElementById('at-method').value;
  const path = document.getElementById('at-url').value.trim();
  const authHeader = document.getElementById('at-auth-header').value.trim();
  const bodyText = document.getElementById('at-body').value.trim();
  const respEl = document.getElementById('at-response');
  const statusBadge = document.getElementById('at-status-badge');
  const timingEl = document.getElementById('at-timing');
  const timeMsEl = document.getElementById('at-time-ms');

  if (!path) { respEl.textContent = 'Enter an endpoint path'; return; }

  respEl.textContent = '⏳ Sending request…';
  statusBadge.style.display = 'none';
  timingEl.style.display = 'none';

  const url = path.startsWith('http') ? path : (API + path);
  const headers = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  const opts = { method, headers };
  if (bodyText && !['GET','DELETE'].includes(method)) {
    try { JSON.parse(bodyText); opts.body = bodyText; }
    catch { respEl.textContent = '❌ Invalid JSON in body'; return; }
  }

  const t0 = performance.now();
  try {
    const r = await fetch(url, opts);
    const elapsed = Math.round(performance.now() - t0);
    let data;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('json')) { data = await r.json(); }
    else { data = await r.text(); }

    const status = r.status;
    const ok = r.ok;

    // Status badge
    statusBadge.style.display = 'inline-block';
    statusBadge.style.background = ok ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)';
    statusBadge.style.color = ok ? 'var(--green)' : 'var(--red)';
    statusBadge.textContent = `${status} ${r.statusText}`;

    timingEl.style.display = 'block';
    timeMsEl.textContent = `${elapsed}ms`;

    const formatted = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    respEl.textContent = formatted;

    // Add to history
    atHistory.unshift({ method, path, status, elapsed, time: new Date().toLocaleTimeString() });
    if (atHistory.length > 20) atHistory.pop();
    renderApiHistory();

  } catch(e) {
    respEl.textContent = `❌ Network error: ${e.message}`;
    statusBadge.style.display = 'inline-block';
    statusBadge.style.background = 'rgba(239,68,68,.12)';
    statusBadge.style.color = 'var(--red)';
    statusBadge.textContent = 'Network Error';
  }
}

function clearApiTest() {
  document.getElementById('at-method').value = 'GET';
  document.getElementById('at-url').value = '';
  document.getElementById('at-body').value = '';
  document.getElementById('at-response').textContent = '// Hit "Send Request" to see the response here';
  document.getElementById('at-status-badge').style.display = 'none';
  document.getElementById('at-timing').style.display = 'none';
}

function copyApiResponse() {
  const text = document.getElementById('at-response').textContent;
  navigator.clipboard?.writeText(text).then(() => toast('Copied to clipboard', 'success'));
}

function formatApiResponse() {
  const el = document.getElementById('at-response');
  try {
    const parsed = JSON.parse(el.textContent);
    el.textContent = JSON.stringify(parsed, null, 2);
  } catch { /* not JSON */ }
}

function renderApiHistory() {
  const el = document.getElementById('at-history');
  if (!el) return;
  if (!atHistory.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">No requests yet</div>';
    return;
  }
  el.innerHTML = atHistory.map((h, i) => `
    <div onclick="replayApiHistoryItem(${i})" style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fff;border:1.5px solid var(--border);border-radius:10px;cursor:pointer;transition:.15s" onmouseover="this.style.borderColor='var(--accent2)'" onmouseout="this.style.borderColor='var(--border)'">
      <span style="font-family:monospace;font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px;background:${h.status<300?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)'};color:${h.status<300?'var(--green)':'var(--red)'}">${h.method}</span>
      <span style="font-family:monospace;font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.path)}</span>
      <span style="font-size:11px;color:var(--muted)">${h.status} · ${h.elapsed}ms · ${h.time}</span>
    </div>`).join('');
}

function replayApiHistoryItem(i) {
  const h = atHistory[i];
  if (!h) return;
  document.getElementById('at-method').value = h.method;
  document.getElementById('at-url').value = h.path;
}

function clearApiHistory() {
  atHistory = [];
  renderApiHistory();
}

// ── User Detail Drawer ────────────────────────────────────────────────────
let drawerUser = null;

async function openUserDrawer(u) {
  drawerUser = u;
  document.getElementById('drawer-avatar').textContent = u.avatar || '🧑';
  document.getElementById('drawer-name').textContent = u.name;
  document.getElementById('drawer-email').textContent = u.email;
  document.getElementById('drawer-boards-n').textContent = u.boards_count ?? '—';
  document.getElementById('drawer-plan').textContent = u.plan || 'free';
  const joined = u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'}) : '—';
  document.getElementById('drawer-joined').textContent = joined;
  document.getElementById('drawer-badges').innerHTML = `
    <span class="badge badge-${u.role}">${u.role}</span>
    <span class="badge badge-${u.plan==='school'?'admin':u.plan==='pro'?'teacher':'student'}">${u.plan||'free'}</span>
    ${u.plan_status && u.plan_status!=='free' ? `<span class="badge" style="background:rgba(200,230,50,.18);color:#5a6b00">${u.plan_status}</span>` : ''}
  `;
  document.getElementById('drawer-plan-detail').innerHTML = `
    Plan: <strong>${u.plan||'free'}</strong> · Status: <strong>${u.plan_status||'free'}</strong><br>
    Cycle: <strong>${u.billing_cycle||'monthly'}</strong>${u.plan_expires_at ? ` · Expires: <strong>${fmtDate(u.plan_expires_at)}</strong>` : ' · No expiry'}
  `;
  document.getElementById('drawer-boards-list').innerHTML = '<div style="color:var(--muted);font-size:13px">Loading boards…</div>';
  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('user-drawer').classList.add('open');

  try {
    const d = await api('GET', `/api/admin/boards?search=${encodeURIComponent(u.email)}&limit=20`);
    const boards = d.boards || [];
    document.getElementById('drawer-boards-n').textContent = boards.length || u.boards_count || 0;
    if (!boards.length) {
      document.getElementById('drawer-boards-list').innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">No boards yet</div>';
      return;
    }
    document.getElementById('drawer-boards-list').innerHTML = boards.map(b => `
      <div class="drawer-board-item">
        <div style="flex:1;min-width:0">
          <div class="drawer-board-name">${esc(b.name)}</div>
          <div class="drawer-board-meta">${b.cards_count||0} cards · ${fmtBytes(b.data_bytes)} · updated ${fmtRelative(b.updated_at)}</div>
        </div>
        <button class="btn-sm btn-edit" onclick="openBoard('${escAttr(b.id)}')" style="flex-shrink:0">Open</button>
      </div>
    `).join('');
  } catch(e) {
    document.getElementById('drawer-boards-list').innerHTML = `<div style="color:var(--red);font-size:13px">Failed to load boards: ${esc(e.message)}</div>`;
  }
}

function closeUserDrawer() {
  document.getElementById('user-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
  drawerUser = null;
}

function drawerEdit() {
  if (!drawerUser) return;
  closeUserDrawer();
  openEditUser(drawerUser);
}

function drawerKick() {
  if (!drawerUser) return;
  kickUser(drawerUser.id, drawerUser.name);
}

function drawerDelete() {
  if (!drawerUser) return;
  closeUserDrawer();
  deleteUser(drawerUser.id, drawerUser.name);
}

// ── Bulk Actions ──────────────────────────────────────────────────────────
let selectedUserIds = new Set();
let selectedUserObjects = new Map();

function toggleSelectAll(checked) {
  const checkboxes = document.querySelectorAll('#users-tbody .row-check');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    const id = cb.dataset.id;
    if (checked) {
      selectedUserIds.add(id);
      if (cb.dataset.obj) { try { selectedUserObjects.set(id, JSON.parse(decodeURIComponent(cb.dataset.obj))); } catch {} }
    } else {
      selectedUserIds.delete(id);
      selectedUserObjects.delete(id);
    }
  });
  updateBulkBar();
}

function toggleRowCheck(cb) {
  const id = cb.dataset.id;
  if (cb.checked) {
    selectedUserIds.add(id);
    if (cb.dataset.obj) { try { selectedUserObjects.set(id, JSON.parse(decodeURIComponent(cb.dataset.obj))); } catch {} }
  } else {
    selectedUserIds.delete(id);
    selectedUserObjects.delete(id);
  }
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const count = selectedUserIds.size;
  if (count > 0) {
    bar.classList.add('show');
    document.getElementById('bulk-count').textContent = `${count} selected`;
  } else {
    bar.classList.remove('show');
    document.getElementById('bulk-select-all').checked = false;
  }
}

function clearBulk() {
  selectedUserIds.clear();
  selectedUserObjects.clear();
  document.querySelectorAll('#users-tbody .row-check').forEach(cb => cb.checked = false);
  document.getElementById('bulk-select-all').checked = false;
  updateBulkBar();
}

function bulkDelete() {
  if (!selectedUserIds.size) return;
  const ids = [...selectedUserIds];
  confirm(`Delete ${ids.length} users?`, 'All their boards and sessions will be permanently deleted.', '🗑️', async () => {
    let ok = 0, fail = 0;
    for (const id of ids) {
      try { await api('DELETE', `/api/admin/users/${id}`); ok++; }
      catch { fail++; }
    }
    toast(`Deleted ${ok} user(s)${fail ? `, ${fail} failed` : ''}`, ok ? 'success' : 'error');
    clearBulk();
    loadUsers();
    refreshStats();
  });
}

function bulkKick() {
  if (!selectedUserIds.size) return;
  const ids = [...selectedUserIds];
  confirm(`Kick ${ids.length} users?`, 'All their active sessions will be revoked.', '🔑', async () => {
    let ok = 0;
    for (const id of ids) {
      try { await api('DELETE', `/api/admin/sessions/user/${id}`); ok++; } catch {}
    }
    toast(`Kicked ${ok} user(s)`, 'success');
    clearBulk();
  });
}

async function bulkGrantPlan(plan, months) {
  if (!selectedUserIds.size) return;
  const ids = [...selectedUserIds];
  const config = PLAN_CATALOG[plan] || PLAN_CATALOG.free;
  const plan_expires_at = months > 0 ? dateInputAfterMonths(months) : null;
  confirm(`Apply ${config.label} to ${ids.length} users?`, plan_expires_at ? `Expires ${fmtDate(plan_expires_at)}` : 'No expiry', '📦', async () => {
    let ok = 0;
    for (const id of ids) {
      try {
        await api('PATCH', `/api/admin/users/${id}`, {
          plan, plan_status: config.defaultStatus,
          billing_cycle: months >= 12 ? 'yearly' : config.defaultCycle,
          plan_expires_at
        });
        ok++;
      } catch {}
    }
    toast(`Updated ${ok} user(s)`, 'success');
    clearBulk();
    loadUsers();
  });
}


// ── Auto-refresh countdown ─────────────────────────────────────────────────
let autoRefreshInterval = null;
let refreshCountdown = 60;

function startAutoRefresh() {
  clearInterval(autoRefreshInterval);
  refreshCountdown = 60;
  updateRefreshLabel();
  autoRefreshInterval = setInterval(() => {
    refreshCountdown--;
    if (refreshCountdown <= 0) {
      refreshCountdown = 60;
      if (document.getElementById('page-dashboard').classList.contains('active')) {
        manualRefresh();
      }
    }
    updateRefreshLabel();
  }, 1000);
}

function updateRefreshLabel() {
  const label = document.getElementById('refresh-label');
  if (label) label.textContent = `Auto-refresh in ${refreshCountdown}s`;
}

function manualRefresh() {
  const ring = document.getElementById('refresh-ring');
  if (ring) ring.classList.add('spinning');
  refreshStats().finally(() => {
    refreshCountdown = 60;
    updateRefreshLabel();
    if (ring) setTimeout(() => ring.classList.remove('spinning'), 600);
  });
}

// ── Session auto-refresh ───────────────────────────────────────────────────
let sessionsArInterval = null;

function toggleSessionsAutoRefresh(on) {
  clearInterval(sessionsArInterval);
  if (on) {
    sessionsArInterval = setInterval(() => {
      if (document.getElementById('page-sessions').classList.contains('active')) loadSessions();
    }, 30000);
    toast('Sessions auto-refresh on (30s)', '');
  }
}

// ── Sidebar notification badges ────────────────────────────────────────────
function updateSidebarBadges(stats) {
  const pending = Number(stats?.pendingPayments || 0);
  const sessions = Number(stats?.sessions || 0);

  const billingBadge = document.getElementById('sb-billing-badge');
  if (billingBadge) {
    if (pending > 0) { billingBadge.textContent = pending; billingBadge.style.display = ''; }
    else billingBadge.style.display = 'none';
  }
  const sessionsBadge = document.getElementById('sb-sessions-badge');
  if (sessionsBadge) {
    if (sessions > 5) { sessionsBadge.textContent = sessions; sessionsBadge.style.display = ''; }
    else sessionsBadge.style.display = 'none';
  }
}


// ── Keyboard shortcuts ─────────────────────────────────────────────────────
function openShortcuts() {
  document.getElementById('shortcuts-modal').classList.add('open');
}
function closeShortcuts(e) {
  if (!e || e.target === document.getElementById('shortcuts-modal')) {
    document.getElementById('shortcuts-modal').classList.remove('open');
  }
}
function closeShortcutsBtn() {
  document.getElementById('shortcuts-modal').classList.remove('open');
}

let gKeyPending = false;
let gKeyTimer = null;

document.addEventListener('keydown', e => {
  // Don't fire if typing in an input
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.metaKey || e.ctrlKey) {
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); exportAdminData('users'); }
    return;
  }

  if (e.key === 'Escape') {
    closeUserDrawer();
    closeShortcutsBtn();
    clearBulk();
    return;
  }

  if (e.key === '/') {
    e.preventDefault();
    showPage('dashboard');
    setTimeout(() => document.getElementById('admin-spotlight-input')?.focus(), 40);
    return;
  }

  if (e.key === '?') {
    e.preventDefault();
    openShortcuts();
    return;
  }

  if (e.key === 'R') {
    e.preventDefault();
    manualRefresh();
    return;
  }

  if (e.key === 'N' && document.getElementById('page-users').classList.contains('active')) {
    e.preventDefault();
    openAddUser();
    return;
  }

  // g + key combos
  if (e.key === 'g') {
    gKeyPending = true;
    clearTimeout(gKeyTimer);
    gKeyTimer = setTimeout(() => { gKeyPending = false; }, 1500);
    return;
  }

  if (gKeyPending) {
    gKeyPending = false;
    clearTimeout(gKeyTimer);
    const pageMap = { d:'dashboard', u:'users', b:'boards', s:'sessions', a:'audit', i:'billing', p:'packages', ',':'settings', t:'api-tester' };
    const target = pageMap[e.key];
    if (target) { e.preventDefault(); showPage(target); }
  }
});

// ── Init ──────────────────────────────────────────────────────────────────
(async () => {
  syncAnalyticsRangeUi();
  if (await verifyToken()) {
    enterPanel();
    startAutoRefresh(); // auto-refresh every 60s on dashboard
  }
})();
