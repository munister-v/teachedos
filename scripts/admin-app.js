/* ════════════════════════════════════════════════════════════════
   admin-app.js - TeachEd Admin panel logic
   Extracted from the inline <script> block for HTTP/SW cacheability
   ════════════════════════════════════════════════════════════════ */
const API = (window.TEACHED_API_BASE || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:4000' : ((location.hostname === 'teached.tech' || location.hostname.endsWith('.teached.tech')) ? location.origin : 'https://teached.tech')));
let token = localStorage.getItem('teachedos_admin_token') || null;
let currentAdminUser = null;
let analyticsDays = 14;
let adminSearchTimer;
let timelineEvents = [];
let timelineFilter = '';
const pageMeta = {
  dashboard: ['Dashboard', 'System overview and key metrics'],
  monitor: ['Monitor', 'Service health and recorded activity'],
  incidents: ['Incidents', 'Response ownership and operational timeline'],
  users: ['Users', 'Manage all registered users'],
  boards: ['Boards', 'View and manage all user boards'],
  sessions: ['Active Sessions', 'Review live login activity'],
  security: ['Security', 'Auth log, suspended & locked accounts'],
  audit: ['System Audit', 'Operational signals and hygiene checks'],
  billing: ['Billing', 'Manual payments and tariff approvals'],
  packages: ['Package Control', 'Plans, limits and manual subscription grants'],
  settings: ['Settings', 'Production readiness and admin tools'],
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
  document.getElementById('sb-avatar').textContent = (currentAdminUser.name || 'TE')
    .trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'TE';
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

function syncSidebarA11y() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('mobile-nav-toggle');
  if (!sidebar || !toggle) return;
  const isMobile = window.matchMedia('(max-width: 980px)').matches;
  const isOpen = sidebar.classList.contains('open');
  toggle.setAttribute('aria-expanded', String(isMobile && isOpen));
  if (isMobile) sidebar.setAttribute('aria-hidden', String(!isOpen));
  else sidebar.removeAttribute('aria-hidden');
}

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.add('open');
  document.getElementById('sidebar-backdrop').classList.add('open');
  syncSidebarA11y();
  requestAnimationFrame(() => sidebar.focus());
}

function closeSidebar(restoreFocus = false) {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('open');
  syncSidebarA11y();
  if (restoreFocus) document.getElementById('mobile-nav-toggle')?.focus();
}

function toggleSidebar() {
  const open = document.getElementById('sidebar').classList.contains('open');
  if (open) closeSidebar(true);
  else openSidebar();
}

window.addEventListener('resize', syncSidebarA11y);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('sidebar')?.classList.contains('open')) {
    event.preventDefault();
    closeSidebar(true);
  }
});
syncSidebarA11y();

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  document.querySelector(`.sb-item[onclick="showPage('${name}')"]`).classList.add('active');
  updateMobileHeader(name);
  closeSidebar();

  if (name === 'dashboard') refreshStats();
  if (name === 'monitor')   loadMonitor();
  if (name === 'incidents') loadIncidents();
  if (name === 'users')     loadUsers();
  if (name === 'boards')    loadBoards();
  if (name === 'sessions')  loadSessions();
  if (name === 'security')  loadSecurityPage();
  if (name === 'audit')     loadAudit();
  if (name === 'billing')   { loadBillingSummary(); loadBillingPayments(); loadBillingMetrics(); }
  if (name === 'packages')  loadPackageControl();
  if (name === 'settings')  { loadSysInfo(); loadInvites(); loadProductionStatus(); }
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
  document.getElementById('confirm-icon').textContent  = '!';
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
    document.getElementById('stat-courses').textContent  = stats.courses ?? '-';
    document.getElementById('stat-cards').textContent    = stats.cards ?? '-';
    document.getElementById('stat-new-users').textContent = stats.newUsers7d ?? '-';
    document.getElementById('stat-storage').textContent  = fmtBytes(stats.storageBytes);
    document.getElementById('stat-health').textContent   = health?.ok ? 'Online' : 'Offline';
    document.getElementById('stat-invites').textContent  = system?.invites?.active ?? 0;
    document.getElementById('stat-payments').textContent = stats.pendingPayments ?? 0;

    // Security sidebar badge
    const secAlert = (stats.suspended || 0) + (stats.locked || 0);
    const secBadge = document.getElementById('sb-security-badge');
    if (secBadge) {
      secBadge.style.display = secAlert > 0 ? '' : 'none';
      secBadge.textContent = secAlert;
    }
    // Update security stats if page is visible
    if (document.getElementById('page-security')?.classList.contains('active')) {
      document.getElementById('sec-stat-suspended').textContent = stats.suspended ?? 0;
      document.getElementById('sec-stat-locked').textContent    = stats.locked ?? 0;
      document.getElementById('sec-stat-failed24h').textContent = stats.failedLogins24h ?? 0;
    }

    const rl = document.getElementById('roles-list');
    rl.innerHTML = stats.roles.map(r =>
      `<div class="role-pill">${r.role}: <strong>${r.count}</strong></div>`
    ).join('');

    renderSignals(system, health);
    window.renderPriorityQueue?.(stats, system, health);
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

// ── Monitor ────────────────────────────────────────────────────────────────
let monitorHours = 24;
let monitorRequestId = 0;

function setMonitorRange(hours) {
  monitorHours = hours === 168 ? 168 : 24;
  document.querySelectorAll('[data-monitor-hours]').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.monitorHours) === monitorHours);
  });
  loadMonitor(true);
}

async function loadMonitor(force = false) {
  const requestId = ++monitorRequestId;
  const stateTitle = document.getElementById('monitor-state-title');
  const stateDetail = document.getElementById('monitor-state-detail');
  if (!stateTitle || !stateDetail) return;
  if (force) {
    stateTitle.textContent = 'Refreshing monitored services';
    stateDetail.textContent = 'Recalculating the selected operational window.';
  }
  try {
    const data = await api('GET', `/api/admin/monitor?hours=${monitorHours}`);
    if (requestId !== monitorRequestId) return;
    renderMonitor(data);
  } catch (error) {
    if (requestId !== monitorRequestId) return;
    stateTitle.textContent = 'Monitor data is unavailable';
    stateDetail.textContent = error.message || 'The API did not return a monitoring snapshot.';
    document.getElementById('monitor-checked-at').textContent = 'Check failed';
  }
}

function renderMonitor(data) {
  const traffic = data?.traffic || {};
  const checks = data?.checks || [];
  const signals = data?.signals || [];
  const risks = signals.filter(signal => signal.tone === 'risk').length;
  const watches = signals.filter(signal => signal.tone === 'watch').length;
  const stateTitle = document.getElementById('monitor-state-title');
  const stateDetail = document.getElementById('monitor-state-detail');
  const checked = document.getElementById('monitor-checked-at');
  const rangeLabel = data.hours === 168 ? 'Last 7 days' : 'Last 24 hours';

  stateTitle.textContent = risks ? 'Reliability needs attention' : watches ? 'Platform is stable with items to review' : 'All monitored services are stable';
  stateDetail.textContent = risks
    ? `${risks} high-priority signal${risks === 1 ? '' : 's'} require review.`
    : watches
      ? `${watches} operational signal${watches === 1 ? '' : 's'} should be checked.`
      : 'No server-error or job-freshness warning in the selected window.';
  checked.textContent = data.checkedAt ? `Checked ${fmtRelative(data.checkedAt)}` : 'Just checked';

  document.getElementById('monitor-requests').textContent = fmtMonitorNumber(traffic.requests);
  document.getElementById('monitor-request-window').textContent = rangeLabel;
  document.getElementById('monitor-error-rate').textContent = `${Number(traffic.errorRate || 0).toFixed(2)}%`;
  document.getElementById('monitor-server-errors').textContent = `${traffic.serverErrors || 0} server / ${traffic.clientErrors || 0} client errors`;
  document.getElementById('monitor-p50').textContent = fmtMonitorMs(traffic.p50Ms);
  document.getElementById('monitor-p95').textContent = fmtMonitorMs(traffic.p95Ms);

  renderMonitorChecks(checks);
  renderMonitorHeatmap(data.heatmap || []);
  renderMonitorProductEvents(data.productEvents || []);
  renderMonitorSignals(signals);
  renderMonitorErrors(data.errors || []);

  const badge = document.getElementById('sb-monitor-badge');
  if (badge) {
    badge.style.display = risks ? '' : 'none';
    badge.textContent = risks;
  }
}

function renderMonitorChecks(checks) {
  const root = document.getElementById('monitor-check-grid');
  if (!root) return;
  root.innerHTML = checks.map(check => `
    <article class="monitor-check is-${escAttr(check.tone || 'watch')}">
      <span class="monitor-check-dot" aria-hidden="true"></span>
      <div><strong>${esc(check.label)}</strong><small>${esc(check.detail)}</small></div>
    </article>
  `).join('') || '<div class="monitor-placeholder">No service checks returned.</div>';
}

function renderMonitorHeatmap(rows) {
  const root = document.getElementById('monitor-heatmap');
  if (!root) return;
  const entries = new Map((rows || []).map(row => [`${row.weekday}-${row.hour}`, row]));
  const max = Math.max(1, ...(rows || []).map(row => Number(row.count || 0)));
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const headers = Array.from({ length: 24 }, (_, hour) => `<span class="monitor-heatmap-hour">${hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}</span>`).join('');
  const body = days.map((day, index) => {
    const weekday = index + 1;
    const cells = Array.from({ length: 24 }, (_, hour) => {
      const row = entries.get(`${weekday}-${hour}`);
      const count = Number(row?.count || 0);
      const level = count ? Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) : 0;
      const title = `${day} ${String(hour).padStart(2, '0')}:00: ${count} recorded activity signal${count === 1 ? '' : 's'}`;
      const bucket = row?.bucket ? ` data-bucket="${escAttr(row.bucket)}"` : '';
      return `<button type="button" class="monitor-heatmap-cell level-${level}"${bucket} title="${escAttr(title)}" ${row?.bucket ? `onclick="openMonitorSlice('${escAttr(row.bucket)}')"` : 'disabled'} aria-label="${escAttr(title)}"></button>`;
    }).join('');
    return `<span class="monitor-heatmap-day">${day}</span>${cells}`;
  }).join('');
  root.innerHTML = `<span></span>${headers}${body}`;
}

function renderMonitorProductEvents(rows) {
  const root = document.getElementById('monitor-product-events');
  if (!root) return;
  if (!rows.length) {
    root.innerHTML = '<div class="monitor-empty">No measured product action yet. Events will appear as people create, update, share and complete work.</div>';
    return;
  }
  const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0) || 1;
  root.innerHTML = rows.slice(0, 8).map(row => {
    const count = Number(row.count || 0);
    return `<div class="monitor-event-row">
      <div><strong>${esc(monitorEventLabel(row.event_type))}</strong><span>${esc(row.event_type)}</span></div>
      <div class="monitor-event-count"><b>${fmtMonitorNumber(count)}</b><i style="--event-width:${Math.max(6, Math.round((count / total) * 100))}%"></i></div>
    </div>`;
  }).join('');
}

function renderMonitorSignals(signals) {
  const root = document.getElementById('monitor-signal-list');
  if (!root) return;
  window.monitorSignals = signals;
  root.innerHTML = signals.map((signal, index) => `
    <article class="monitor-signal is-${escAttr(signal.tone || 'watch')}">
      <span aria-hidden="true"></span>
      <div><strong>${esc(signal.title)}</strong><small>${esc(signal.detail)}</small><button type="button" class="monitor-signal-action" onclick="openIncidentFromSignal(${index})">Open response record</button></div>
    </article>
  `).join('') || '<div class="monitor-empty">No reliability signals in this window.</div>';
}

function openIncidentFromSignal(index) {
  const signal = Array.isArray(window.monitorSignals) ? window.monitorSignals[index] : null;
  if (!signal) return;
  showPage('incidents');
  toggleIncidentCreate(true);
  document.getElementById('incident-title').value = signal.title || '';
  document.getElementById('incident-scope').value = 'Platform monitoring';
  document.getElementById('incident-description').value = signal.detail || '';
}

function renderMonitorErrors(rows) {
  const root = document.getElementById('monitor-error-list');
  if (!root) return;
  if (!rows.length) {
    root.innerHTML = '<div class="monitor-empty">No server errors or provider fallbacks were recorded in this window.</div>';
    return;
  }
  root.innerHTML = rows.map(row => `
    <article class="monitor-error-row">
      <div><strong>${esc(monitorEventLabel(row.event_type))}</strong><small>${esc(row.route || row.outcome || 'Technical event')}</small></div>
      <div><b>${fmtMonitorNumber(row.count)}</b><span>${fmtRelative(row.last_seen)}</span></div>
    </article>
  `).join('');
}

async function openMonitorSlice(bucket) {
  const title = document.getElementById('monitor-slice-title');
  const meta = document.getElementById('monitor-slice-meta');
  const root = document.getElementById('monitor-slice-list');
  const panel = document.getElementById('monitor-slice');
  if (!title || !root) return;
  title.textContent = 'Loading selected hour';
  meta.textContent = bucket;
  root.textContent = 'Retrieving the selected operational activity.';
  panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  try {
    const data = await api('GET', `/api/admin/monitor/events?start=${encodeURIComponent(bucket)}`);
    const events = data.events || [];
    title.textContent = `Activity at ${fmtMonitorHour(bucket)}`;
    meta.textContent = `${events.length} recorded event${events.length === 1 ? '' : 's'} shown`;
    root.innerHTML = events.length ? events.map(event => `
      <div class="monitor-slice-row">
        <span class="monitor-slice-time">${fmtRelative(event.created_at)}</span>
        <strong>${esc(monitorEventLabel(event.event_type))}</strong>
        <span>${esc(event.metadata?.route || event.metadata?.operation || event.outcome || 'recorded')}</span>
        <em>${event.duration_ms ? `${event.duration_ms} ms` : ''}</em>
      </div>
    `).join('') : '<div class="monitor-empty">No raw event remains for the latest matching hour. The heatmap still reflects activity across the selected time window.</div>';
  } catch (error) {
    title.textContent = 'Could not load this hour';
    root.textContent = error.message || 'The activity slice is unavailable.';
  }
}

function monitorEventLabel(type) {
  const labels = {
    'account.created': 'Account created', 'login.ok': 'Password sign-in', 'google.login': 'Google sign-in', 'google.signup': 'Google sign-up',
    'board.created': 'Board created', 'board.updated': 'Board updated', 'board.renamed': 'Board renamed',
    'board.deleted': 'Board deleted', 'share.created': 'Share link created', 'share.viewed': 'Shared material opened',
    'lesson.progress_submitted': 'Lesson progress submitted', 'request.completed': 'API request',
    'system.housekeeping': 'Housekeeping run',
  };
  return labels[type] || String(type || 'Recorded event').replace(/[._]/g, ' ');
}

function fmtMonitorNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

function fmtMonitorMs(value) {
  const ms = Number(value || 0);
  return ms ? `${Math.round(ms)} ms` : 'No data';
}

function fmtMonitorHour(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv', weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

// ── Incident response ─────────────────────────────────────────────────────
let incidentFilter = 'active';
let incidentOwners = [];
let selectedIncidentId = null;
let incidentRequestId = 0;

function incidentSeverityLabel(value) {
  return ({ s1: 'S1 critical', s2: 'S2 major', s3: 'S3 moderate', s4: 'S4 minor' }[value] || 'S3 moderate');
}

function incidentStatusLabel(value) {
  return ({ open: 'Open', acknowledged: 'Acknowledged', mitigating: 'Mitigating', resolved: 'Resolved' }[value] || 'Open');
}

function incidentOwnerOptions(selected) {
  const options = ['<option value="">Unassigned</option>'];
  incidentOwners.forEach(owner => {
    options.push(`<option value="${escAttr(owner.id)}" ${owner.id === selected ? 'selected' : ''}>${esc(owner.name || owner.email || 'Administrator')}</option>`);
  });
  return options.join('');
}

async function loadIncidentOwners() {
  if (incidentOwners.length) return incidentOwners;
  const data = await api('GET', '/api/admin/incidents/owners');
  incidentOwners = Array.isArray(data.owners) ? data.owners : [];
  const field = document.getElementById('incident-owner');
  if (field) field.innerHTML = incidentOwnerOptions(currentAdminUser?.id || '');
  return incidentOwners;
}

function setIncidentFilter(status) {
  incidentFilter = ['active', 'open', 'mitigating', 'resolved', 'all'].includes(status) ? status : 'active';
  document.querySelectorAll('[data-incident-status]').forEach(button => {
    button.classList.toggle('active', button.dataset.incidentStatus === incidentFilter);
  });
  selectedIncidentId = null;
  loadIncidents(true);
}

async function loadIncidents(force = false) {
  const requestId = ++incidentRequestId;
  try {
    const [data] = await Promise.all([
      api('GET', `/api/admin/incidents?status=${encodeURIComponent(incidentFilter)}`),
      loadIncidentOwners(),
    ]);
    if (requestId !== incidentRequestId) return;
    renderIncidents(data);
    const incidents = data.incidents || [];
    if (selectedIncidentId && incidents.some(incident => incident.id === selectedIncidentId)) {
      loadIncident(selectedIncidentId, true);
    } else if (incidents.length) {
      selectedIncidentId = incidents[0].id;
      renderIncidents(data);
      loadIncident(selectedIncidentId, true);
    } else {
      selectedIncidentId = null;
      document.getElementById('incident-detail').innerHTML = '<div class="incident-detail-empty"><div class="control-kicker">Incident record</div><strong>No incidents in this view</strong><span>Open an incident only when a person needs to own and document a real response.</span></div>';
    }
  } catch (error) {
    if (requestId !== incidentRequestId) return;
    document.getElementById('incident-list').innerHTML = `<div class="monitor-empty">${esc(error.message || 'Could not load incidents.')}</div>`;
    document.getElementById('incident-list-count').textContent = 'Unavailable';
  }
}

function renderIncidents(data) {
  const incidents = data.incidents || [];
  const summary = data.summary || {};
  document.getElementById('incident-summary-active').textContent = summary.active || 0;
  document.getElementById('incident-summary-s1').textContent = summary.s1 || 0;
  document.getElementById('incident-summary-s2').textContent = summary.s2 || 0;
  const responded = incidents.filter(incident => ['acknowledged', 'mitigating'].includes(incident.status)).length;
  document.getElementById('incident-summary-response').textContent = responded;
  document.getElementById('incident-summary-response-copy').textContent = responded ? 'Acknowledged or mitigating' : 'No active response yet';
  document.getElementById('incident-list-count').textContent = `${incidents.length} shown`;
  const badge = document.getElementById('sb-incidents-badge');
  if (badge) {
    badge.style.display = Number(summary.active || 0) ? '' : 'none';
    badge.textContent = Number(summary.active || 0);
  }
  const root = document.getElementById('incident-list');
  if (!incidents.length) {
    root.innerHTML = '<div class="incident-empty-list">No incidents match this view.</div>';
    return;
  }
  root.innerHTML = incidents.map(incident => `
    <button type="button" class="incident-row is-${escAttr(incident.severity)} ${incident.id === selectedIncidentId ? 'selected' : ''}" onclick="openIncident('${escAttr(incident.id)}')">
      <span class="incident-row-severity">${esc(incident.severity.toUpperCase())}</span>
      <span class="incident-row-copy"><strong>${esc(incident.title)}</strong><small>${esc(incident.affected_scope || 'Scope not set')} · ${esc(incident.owner_name || 'Unassigned')}</small></span>
      <span class="incident-row-meta"><em>${esc(incidentStatusLabel(incident.status))}</em><small>${fmtRelative(incident.updated_at)}</small></span>
    </button>
  `).join('');
}

async function openIncident(id) {
  selectedIncidentId = id;
  document.querySelectorAll('.incident-row').forEach(row => row.classList.toggle('selected', row.getAttribute('onclick')?.includes(id)));
  await loadIncident(id, false);
}

async function loadIncident(id, background = false) {
  const root = document.getElementById('incident-detail');
  if (!background) root.innerHTML = '<div class="incident-detail-empty"><div class="control-kicker">Incident record</div><strong>Loading incident</strong><span>Retrieving the latest response timeline.</span></div>';
  try {
    const data = await api('GET', `/api/admin/incidents/${encodeURIComponent(id)}`);
    if (selectedIncidentId !== id) return;
    renderIncidentDetail(data.incident, data.updates || []);
  } catch (error) {
    if (selectedIncidentId !== id) return;
    root.innerHTML = `<div class="incident-detail-empty"><strong>Could not load this incident</strong><span>${esc(error.message || 'Try refreshing the incident queue.')}</span></div>`;
  }
}

function renderIncidentDetail(incident, updates) {
  const root = document.getElementById('incident-detail');
  const quickActions = [];
  if (incident.status === 'open') quickActions.push(`<button type="button" class="btn-sm btn-edit" onclick="advanceIncident('${escAttr(incident.id)}', 'acknowledged')">Acknowledge and take ownership</button>`);
  if (incident.status === 'acknowledged') quickActions.push(`<button type="button" class="btn-sm btn-edit" onclick="advanceIncident('${escAttr(incident.id)}', 'mitigating')">Start mitigation</button>`);
  if (['open', 'acknowledged', 'mitigating'].includes(incident.status)) quickActions.push(`<button type="button" class="btn-sm incident-resolve" onclick="advanceIncident('${escAttr(incident.id)}', 'resolved')">Resolve incident</button>`);
  root.innerHTML = `
    <div class="incident-detail-head">
      <div><div class="control-kicker">${esc(incidentSeverityLabel(incident.severity))} · ${esc(incidentStatusLabel(incident.status))}</div><h2>${esc(incident.title)}</h2><p>${esc(incident.summary || 'No summary was recorded.')}</p></div>
      <span class="incident-updated">Updated ${fmtRelative(incident.updated_at)}</span>
    </div>
    <div class="incident-detail-fields">
      <label>Status<select id="incident-detail-status"><option value="open" ${incident.status === 'open' ? 'selected' : ''}>Open</option><option value="acknowledged" ${incident.status === 'acknowledged' ? 'selected' : ''}>Acknowledged</option><option value="mitigating" ${incident.status === 'mitigating' ? 'selected' : ''}>Mitigating</option><option value="resolved" ${incident.status === 'resolved' ? 'selected' : ''}>Resolved</option></select></label>
      <label>Severity<select id="incident-detail-severity"><option value="s1" ${incident.severity === 's1' ? 'selected' : ''}>S1 · Critical</option><option value="s2" ${incident.severity === 's2' ? 'selected' : ''}>S2 · Major</option><option value="s3" ${incident.severity === 's3' ? 'selected' : ''}>S3 · Moderate</option><option value="s4" ${incident.severity === 's4' ? 'selected' : ''}>S4 · Minor</option></select></label>
      <label>Owner<select id="incident-detail-owner">${incidentOwnerOptions(incident.owner_id || '')}</select></label>
      <label>Affected area<input id="incident-detail-scope" maxlength="160" value="${escAttr(incident.affected_scope || '')}" placeholder="Affected system or journey"/></label>
    </div>
    <div class="incident-detail-actions"><div class="incident-quick-actions">${quickActions.join('')}</div><div class="incident-detail-save"><span id="incident-detail-feedback" aria-live="polite"></span><button type="button" class="btn-primary" onclick="saveIncident('${escAttr(incident.id)}')">Save response state</button></div></div>
    <div class="incident-timeline">
      <div class="incident-section-head"><div><div class="control-kicker">Timeline</div><h2>Response log</h2></div><span>${updates.length} entries</span></div>
      <div class="incident-update-compose"><textarea id="incident-note" maxlength="4000" rows="3" placeholder="Record what changed, what was checked, or what happens next."></textarea><button type="button" class="btn-sm btn-edit" onclick="addIncidentUpdate('${escAttr(incident.id)}')">Add update</button></div>
      <div class="incident-timeline-list">${updates.map(renderIncidentUpdate).join('') || '<div class="incident-empty-list">The response timeline is empty.</div>'}</div>
    </div>
  `;
}

function renderIncidentUpdate(update) {
  const author = update.author_name || 'Control center';
  let title = 'Update added';
  let body = update.body || '';
  if (update.kind === 'created') title = 'Incident opened';
  if (update.kind === 'status') {
    title = `Status changed to ${incidentStatusLabel(update.to_status)}`;
    body = update.from_status ? `Previous status: ${incidentStatusLabel(update.from_status)}` : '';
  }
  if (update.kind === 'assignment') title = 'Ownership updated';
  return `<article class="incident-timeline-row is-${escAttr(update.kind || 'note')}"><span></span><div><strong>${esc(title)}</strong><small>${esc(author)} · ${fmtDate(update.created_at)}</small>${body ? `<p>${esc(body)}</p>` : ''}</div></article>`;
}

function toggleIncidentCreate(force) {
  const panel = document.getElementById('incident-create');
  const willOpen = force === undefined ? panel.hidden : Boolean(force);
  panel.hidden = !willOpen;
  if (willOpen) {
    loadIncidentOwners().catch(() => {});
    document.getElementById('incident-title')?.focus();
  }
}

async function createIncident() {
  const error = document.getElementById('incident-create-error');
  error.textContent = '';
  const body = {
    title: document.getElementById('incident-title').value,
    severity: document.getElementById('incident-severity').value,
    affectedScope: document.getElementById('incident-scope').value,
    ownerId: document.getElementById('incident-owner').value,
    summary: document.getElementById('incident-description').value,
  };
  try {
    const data = await api('POST', '/api/admin/incidents', body);
    ['incident-title', 'incident-scope', 'incident-description'].forEach(id => { document.getElementById(id).value = ''; });
    incidentFilter = 'active';
    document.querySelectorAll('[data-incident-status]').forEach(button => button.classList.toggle('active', button.dataset.incidentStatus === 'active'));
    selectedIncidentId = data.incident.id;
    toggleIncidentCreate(false);
    toast('Incident opened', 'success');
    loadIncidents(true);
  } catch (e) {
    error.textContent = e.message || 'Could not create incident';
  }
}

async function saveIncident(id) {
  const feedback = document.getElementById('incident-detail-feedback');
  feedback.textContent = 'Saving…';
  try {
    await api('PATCH', `/api/admin/incidents/${encodeURIComponent(id)}`, {
      status: document.getElementById('incident-detail-status').value,
      severity: document.getElementById('incident-detail-severity').value,
      ownerId: document.getElementById('incident-detail-owner').value,
      affectedScope: document.getElementById('incident-detail-scope').value,
    });
    feedback.textContent = 'Saved';
    toast('Incident response state saved', 'success');
    loadIncidents(true);
  } catch (e) {
    feedback.textContent = e.message || 'Could not save';
  }
}

async function advanceIncident(id, status) {
  const feedback = document.getElementById('incident-detail-feedback');
  if (feedback) feedback.textContent = 'Updating...';
  try {
    await api('PATCH', `/api/admin/incidents/${encodeURIComponent(id)}`, { status });
    toast(status === 'resolved' ? 'Incident resolved' : `Incident marked ${incidentStatusLabel(status).toLowerCase()}`, 'success');
    await loadIncidents(true);
  } catch (error) {
    if (feedback) feedback.textContent = error.message || 'Could not update incident';
  }
}

async function addIncidentUpdate(id) {
  const field = document.getElementById('incident-note');
  const body = field.value.trim();
  if (!body) { field.focus(); return; }
  try {
    await api('POST', `/api/admin/incidents/${encodeURIComponent(id)}/updates`, { body });
    field.value = '';
    toast('Timeline update added', 'success');
    loadIncidents(true);
  } catch (e) {
    toast(e.message || 'Could not add the update', 'error');
  }
}

// ── AI engine status ───────────────────────────────────────────────────────
async function loadAIStatus() {
  const badge = document.getElementById('ai-engine-badge');
  try {
    const d = await api('GET', '/api/ai/status');
    const m = d.metrics || {};
    badge.textContent = d.llmEnabled ? 'LLM active' : 'Rule engine';
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
    errEl.textContent = m.lastError ? `Last unavailable reason: ${m.lastError}` : '';
    loadAIUsage();
    loadAIAllowances();
  } catch(e) {
    badge.textContent = 'Unavailable';
    badge.className = 'badge badge-student';
  }
}

async function loadAIAllowances() {
  const el = document.getElementById('ai-allowance-summary');
  if (!el) return;
  try {
    const data = await api('GET', '/api/ai/admin/allowances');
    const plans = data.plans || [];
    if (!plans.length) { el.textContent = 'Monthly allowances: no paid AI usage yet.'; return; }
    const reserved = plans.reduce((sum, row) => sum + Number(row.reserved_usd || 0), 0);
    const actual = plans.reduce((sum, row) => sum + Number(row.actual_usd || 0), 0);
    const requests = plans.reduce((sum, row) => sum + Number(row.requests || 0), 0);
    el.textContent = `Monthly allowances: ${requests} requests · $${actual.toFixed(3)} actual · $${reserved.toFixed(3)} reserved`;
  } catch (_) {
    el.textContent = 'Monthly allowance summary unavailable.';
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
          <div class="leader-email">${esc(row.email || '-')}</div>
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
  root.querySelector('.brief-score-num').textContent = brief.score ?? '-';
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
  return { user:'U', board:'B', session:'S', invite:'I' }[type] || '·';
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
      <td>${esc(e.admin_email || '-')}</td>
      <td><span class="badge badge-teacher">${esc(e.action)}</span></td>
      <td>${esc(e.target_label || '-')}</td>
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
    `<div class="audit-warning ${w.level === 'medium' ? 'medium' : ''}"><span>${esc(w.text)}</span></div>`
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
const _userCache = {};
function _openCachedUser(id, mode) {
  const u = _userCache[id];
  if (!u) return;
  if (mode === 'edit') openEditUser(u);
  else openUserDrawer(u);
}
let usersSearchTimer;
let usersAccessFilter = '';

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

function setUsersAccessFilter(access, el) {
  usersAccessFilter = access;
  usersOffset = 0;
  document.querySelectorAll('#users-access-filters .filter-chip').forEach(chip => chip.classList.remove('active'));
  (el || [...document.querySelectorAll('#users-access-filters .filter-chip')]
    .find(chip => chip.getAttribute('onclick')?.includes(`'${access}'`)))?.classList.add('active');
  loadUsers();
}

function resetPeopleFilters(search = '') {
  usersRoleFilter = '';
  usersAccessFilter = '';
  usersOffset = 0;
  document.querySelectorAll('#users-role-filters .filter-chip, #users-access-filters .filter-chip').forEach(chip => chip.classList.remove('active'));
  document.querySelector('#users-role-filters .filter-chip')?.classList.add('active');
  document.querySelector('#users-access-filters .filter-chip')?.classList.add('active');
  const input = document.getElementById('users-search');
  if (input) input.value = search;
  loadUsers();
}

function personInitials(user) {
  const source = String(user?.name || user?.email || 'U').trim();
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';
}

async function loadUsers() {
  const search = document.getElementById('users-search').value;
  const tbody  = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="9"><div class="skel skel-line" style="width:180px"></div></td></tr>';
  try {
    const d = await api('GET', `/api/admin/users?search=${encodeURIComponent(search)}&role=${encodeURIComponent(usersRoleFilter)}&access=${encodeURIComponent(usersAccessFilter)}&limit=${usersLimit}&offset=${usersOffset}`);
    usersTotal = d.total;
    document.getElementById('users-page-info').textContent = usersTotal
      ? `${usersOffset+1}-${Math.min(usersOffset+usersLimit, usersTotal)} of ${usersTotal}`
      : 'No results';
    document.getElementById('users-prev').disabled = usersOffset === 0;
    document.getElementById('users-next').disabled = usersOffset + usersLimit >= usersTotal;
    const saEl = document.getElementById('bulk-select-all');
    if (saEl) saEl.checked = false;

    if (!d.users.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="10"><div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">No users found</div><div class="empty-state-sub">Try adjusting your search or filter</div></div></td></tr>';
      return;
    }
    // Cache user objects by ID so we don't need JSON in HTML attributes
    d.users.forEach(u => { _userCache[u.id] = u; });
    tbody.innerHTML = d.users.map(u => {
      const isSelected = selectedUserIds.has(u.id);
      const statusBadge = u.is_suspended
        ? '<span class="badge" style="background:#dc2626;color:#fff;font-size:10px">SUSPENDED</span>'
        : u.locked_at
          ? '<span class="badge" style="background:#ea580c;color:#fff;font-size:10px">LOCKED</span>'
          : '';
      return `<tr${u.is_suspended ? ' style="opacity:.65"' : ''}>
        <td><input type="checkbox" class="row-check" data-id="${u.id}" onchange="toggleRowCheck(this)" ${isSelected?'checked':''} style="accent-color:var(--lime);cursor:pointer"></td>
        <td class="avatar-cell" data-label="Person" style="cursor:pointer" onclick="_openCachedUser('${u.id}','drawer')"><span class="person-mark">${personInitials(u)}</span></td>
        <td data-label="Name" style="cursor:pointer" onclick="_openCachedUser('${u.id}','drawer')"><strong>${esc(u.name)}</strong>${statusBadge ? '<br>' + statusBadge : ''}</td>
        <td data-label="Email" style="color:var(--muted);font-size:13px">${esc(u.email)}</td>
        <td data-label="Role"><span class="badge badge-${u.role}">${u.role}</span></td>
        <td data-label="Plan">
          <span class="badge badge-${u.plan==='school'?'admin':u.plan==='pro'?'teacher':'student'}">${u.plan||'free'}</span>
          <div class="time-text">${esc(u.plan_status||'free')} · ${esc(u.billing_cycle||'monthly')}</div>
          ${u.plan_expires_at?`<div class="time-text">until ${fmtDate(u.plan_expires_at)}</div>`:''}
        </td>
        <td data-label="Boards" style="text-align:center">${u.boards_count}</td>
        <td data-label="Last Login" class="time-text">${u.last_login_at ? fmtRelative(u.last_login_at) : '-'}</td>
        <td data-label="Joined" class="time-text">${fmtDate(u.created_at)}</td>
        <td data-label="Actions">
          <div class="action-group">
            <button class="btn-sm btn-edit" onclick="_openCachedUser('${u.id}','drawer')">View</button>
            <button class="btn-sm btn-edit" onclick="_openCachedUser('${u.id}','edit')">Edit</button>
            <button class="btn-sm btn-orange" onclick="kickUser('${u.id}','${esc(u.name)}')">End session</button>
            ${u.locked_at ? `<button class="btn-sm" style="background:#ea580c;color:#fff;border:none;border-radius:6px;padding:5px 8px;font-size:11px;cursor:pointer" onclick="unlockUser('${u.id}','${esc(u.name)}')">Unlock</button>` : ''}
            <button class="btn-sm btn-danger" onclick="deleteUser('${u.id}','${esc(u.name)}')">Delete</button>
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
  const planEl = document.getElementById('mu-plan');
  planEl.value = u.plan || 'free';
  planEl.dataset.original = u.plan || 'free';
  document.getElementById('mu-plan-status').value = u.plan_status || (u.plan === 'free' ? 'free' : 'active');
  document.getElementById('mu-billing-cycle').value = u.billing_cycle || 'monthly';
  document.getElementById('mu-plan-expires').value = u.plan_expires_at ? new Date(u.plan_expires_at).toISOString().slice(0, 10) : '';
  document.getElementById('mu-avatar').value = u.avatar;
  document.getElementById('mu-pass').value   = '';
  document.getElementById('modal-user').classList.add('open');
  loadUserHistory(u.id);
}

async function loadUserHistory(userId) {
  const el = document.getElementById('mu-history');
  if (!el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--muted)">Loading history…</div>';
  try {
    const d = await api('GET', `/api/admin/users/${userId}/history`);
    const items = [];
    (d.payments || []).forEach(p => {
      items.push({ t: new Date(p.created_at), html: `<span class="history-status">${esc(p.status || 'record')}</span> <strong>${esc(p.invoice_no || '#'+p.id)}</strong> · ${esc(p.plan)} · ${Number(p.amount||0).toFixed(2)} ${esc(p.currency||'usd')}${p.admin_note ? ' · '+esc(p.admin_note) : ''}` });
    });
    (d.audit || []).forEach(a => {
      items.push({ t: new Date(a.created_at), html: `<span class="history-status">change</span> <strong>${esc(a.action)}</strong> · ${esc(a.detail || '')} ${a.admin_email ? '· by '+esc(a.admin_email) : ''}` });
    });
    items.sort((a,b) => b.t - a.t);
    if (!items.length) { el.innerHTML = '<div style="font-size:12px;color:var(--muted)">No plan changes or payments recorded yet.</div>'; return; }
    el.innerHTML = items.slice(0, 15).map(i => `<div style="font-size:11.5px;line-height:1.6;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.05)">${i.html} <span style="color:var(--muted);font-size:10px;float:right">${fmtDate(i.t)}</span></div>`).join('');
  } catch (e) {
    el.innerHTML = `<div style="font-size:12px;color:#991b1b">${esc(e.message)}</div>`;
  }
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
  if (pass) { if (pass.length < 10) { toast('Password min 10 chars','error'); return; } body.password = pass; }
  const newEmail = document.getElementById('mu-email').value.trim().toLowerCase();
  if (newEmail && newEmail !== editingUserEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { toast('Invalid email','error'); return; }
    body.email = newEmail;
  }
  // Warn on downgrade from paid plan to free
  const currentPlan = document.getElementById('mu-plan').dataset.original || '';
  if (currentPlan && currentPlan !== 'free' && body.plan === 'free') {
    const ok = await new Promise(r => confirm('Downgrade to Free?', 'User will lose Pro/School features immediately. This cannot be undone without a new payment.', '⚠️', () => r(true), { label: 'Downgrade', color: '#dc2626' }));
    if (!ok) return;
  }
  try {
    await api('PATCH', `/api/admin/users/${editingUserId}`, body);
    closeUserModal();
    toast('User updated', 'success');
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
  if (pass.length < 10) { toast('Password min 10 chars','error'); return; }
  try {
    await api('POST', '/api/admin/users', { name, email, password: pass, role });
    document.getElementById('modal-add-user').classList.remove('open');
    toast('User created', 'success');
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
  }, { label: 'Delete user', color: '#dc2626' });
}

function kickUser(userId, name) {
  confirm(`Kick "${name}"?`, 'All active sessions for this user will be revoked.', '🔑', async () => {
    try {
      await api('DELETE', `/api/admin/sessions/user/${userId}`);
      toast('Sessions revoked', 'success');
    } catch(e) { toast(e.message, 'error'); }
  }, { label: 'Revoke sessions', color: '#f97316' });
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
  if (payload.plan !== 'free' && payload.months <= 0) { toast('Set months (1-24) for a paid plan', 'error'); return; }
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
        toast('Subscription updated', 'success');
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
    const urgencyBadge = u => {
      if (u.urgency === 'overdue') return '<span style="font:700 9px var(--mono);padding:2px 7px;border-radius:999px;background:#fee2e2;color:#991b1b;margin-left:6px">OVERDUE</span>';
      if (u.urgency === 'grace')   return '<span style="font:700 9px var(--mono);padding:2px 7px;border-radius:999px;background:#fef3c7;color:#92400e;margin-left:6px">GRACE</span>';
      return '<span style="font:700 9px var(--mono);padding:2px 7px;border-radius:999px;background:#dbeafe;color:#1e40af;margin-left:6px">EXPIRING</span>';
    };
    root.innerHTML = rows.map(user => `
      <div class="activity-item">
        <div>
          <div class="activity-title">${esc(user.name)} <span class="badge badge-${user.plan === 'school' ? 'admin' : 'teacher'}">${esc(user.plan)}</span>${urgencyBadge(user)}</div>
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

async function loadBillingMetrics() {
  try {
    const d = await api('GET', '/api/admin/billing/metrics');
    const totalRev = Number(d.totalRevenue || 0);
    document.getElementById('bill-total-rev').textContent = '$' + totalRev.toFixed(0);
    const conv = d.conversion || {};
    const pct = conv.total ? Math.round((conv.paid / conv.total) * 100) : 0;
    document.getElementById('bill-conversion').textContent = pct + '%';
    document.getElementById('bill-conversion').title = `${conv.paid} paid / ${conv.total} total`;
    document.getElementById('bill-churn').textContent = d.churned90d || 0;
    const months = d.monthlyRevenue || [];
    const lastMonth = months.length ? Number(months[0].revenue || 0) : 0;
    document.getElementById('bill-last-month').textContent = '$' + lastMonth.toFixed(0);
  } catch {
    document.getElementById('bill-total-rev').textContent = '-';
  }
}

async function loadBillingPayments() {
  const tbody = document.getElementById('billing-tbody');
  if (!tbody) return;
  const status = document.getElementById('billing-status-filter')?.value || '';
  tbody.innerHTML = '<tr class="empty-row"><td colspan="8"><div class="skel skel-line" style="width:180px"></div></td></tr>';
  try {
    const d = await api('GET', `/api/admin/billing/payments?status=${encodeURIComponent(status)}`);
    if (!d.payments.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7"><div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-title">No payment requests</div><div class="empty-state-sub">Payment requests will appear here when users submit bank transfers</div></div></td></tr>';
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
          <td data-label="Status"><span class="badge" style="background:${p.status==='approved'?'#dcfce7':p.status==='rejected'?'#fee2e2':p.status==='pending'?'#fef3c7':'#f3f4f6'};color:${p.status==='approved'?'#166534':p.status==='rejected'?'#991b1b':p.status==='pending'?'#92400e':'#374151'};font-weight:650">${esc(p.status.toUpperCase())}</span>${p.reviewed_at ? `<div class="time-text">${fmtDate(p.reviewed_at)}</div>` : ''}</td>
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

const ADMIN_PAYMENT_CARD = '5375 4141 1234 5678';
let _cardRevealed = false;

function toggleAdminCard() {
  _cardRevealed = !_cardRevealed;
  const el = document.getElementById('admin-card-number');
  const btn = document.getElementById('admin-card-toggle');
  if (_cardRevealed) {
    el.textContent = ADMIN_PAYMENT_CARD;
    btn.textContent = '🙈 Hide';
    setTimeout(() => { if (_cardRevealed) { _cardRevealed = false; el.textContent = '•••• •••• •••• ••••'; btn.textContent = '👁 Show'; } }, 15000);
  } else {
    el.textContent = '•••• •••• •••• ••••';
    btn.textContent = '👁 Show';
  }
}

function copyAdminCard() {
  navigator.clipboard?.writeText(ADMIN_PAYMENT_CARD.replace(/\s/g,'')).then(() => toast('Card number copied', 'success'));
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
let boardsHealthFilter = '';
let boardsSearchTimer;

function debounceBoardsSearch() {
  clearTimeout(boardsSearchTimer);
  boardsSearchTimer = setTimeout(() => { boardsOffset = 0; loadBoards(); }, 350);
}

function boardsPage(dir) {
  boardsOffset = Math.max(0, Math.min(boardsTotal - boardsLimit, boardsOffset + dir * boardsLimit));
  loadBoards();
}

function setBoardsHealthFilter(health, el) {
  boardsHealthFilter = health;
  boardsOffset = 0;
  document.querySelectorAll('#boards-health-filters .filter-chip').forEach(chip => chip.classList.remove('active'));
  (el || [...document.querySelectorAll('#boards-health-filters .filter-chip')]
    .find(chip => chip.getAttribute('onclick')?.includes(`'${health}'`)))?.classList.add('active');
  loadBoards();
}

async function loadBoards() {
  const search = document.getElementById('boards-search').value;
  const owner = document.getElementById('boards-owner-filter')?.value || '';
  const tbody  = document.getElementById('boards-tbody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="7"><div class="skel skel-line" style="width:180px"></div></td></tr>';
  try {
    const d = await api('GET', `/api/admin/boards?search=${encodeURIComponent(search)}&owner=${encodeURIComponent(owner)}&health=${encodeURIComponent(boardsHealthFilter)}&limit=${boardsLimit}&offset=${boardsOffset}`);
    boardsTotal = d.total;
    document.getElementById('boards-page-info').textContent = boardsTotal
      ? `${boardsOffset+1}-${Math.min(boardsOffset+boardsLimit,boardsTotal)} of ${boardsTotal}`
      : 'No results';
    document.getElementById('boards-prev').disabled = boardsOffset === 0;
    document.getElementById('boards-next').disabled = boardsOffset + boardsLimit >= boardsTotal;

    if (!d.boards.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8"><div class="empty-state"><div class="empty-state-title">No boards found</div><div class="empty-state-sub">Try adjusting your search</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = d.boards.map(b => `
      <tr>
        <td data-label="Board"><strong>${esc(b.name)}</strong></td>
        <td data-label="Owner">
          <div style="font-size:13px;font-weight:600">${esc(b.owner_name)}</div>
          <div class="ip-text">${esc(b.owner_email)}</div>
        </td>
        <td data-label="Health"><span class="board-health ${boardHealthClass(b)}">${boardHealthLabel(b)}</span></td>
        <td data-label="Cards" style="text-align:center">${b.cards_count ?? '-'}</td>
        <td data-label="Size" class="ip-text">${fmtBytes(b.data_bytes)}</td>
        <td data-label="Updated" class="time-text">${fmtDate(b.updated_at)}</td>
        <td data-label="Created" class="time-text">${fmtDate(b.created_at)}</td>
        <td data-label="Actions">
          <div class="action-group">
            <button class="btn-sm btn-edit" onclick="openBoardReview('${b.id}')">Review</button>
            <button class="btn-sm btn-edit" onclick="openBoard('${b.id}')">Open</button>
            <button class="btn-sm btn-danger" onclick="deleteBoard('${b.id}','${esc(b.name)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
    // Populate owner filter (dedupe)
    const ownerSel = document.getElementById('boards-owner-filter');
    if (ownerSel && ownerSel.options.length <= 1) {
      const seen = new Set();
      d.boards.forEach(b => {
        if (b.owner_email && !seen.has(b.owner_email)) {
          seen.add(b.owner_email);
          const o = document.createElement('option');
          o.value = b.owner_email;
          o.textContent = b.owner_name || b.owner_email;
          ownerSel.appendChild(o);
        }
      });
    }
  } catch(e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Error: ${e.message}</td></tr>`;
  }
}

function boardHealthClass(board) {
  if (board.health === 'empty' || Number(board.cards_count || 0) === 0) return 'is-risk';
  if (board.health === 'stale') return 'is-watch';
  return 'is-healthy';
}

function boardHealthLabel(board) {
  if (board.health === 'empty' || Number(board.cards_count || 0) === 0) return 'Empty';
  if (board.health === 'stale') return 'Needs review';
  return 'Healthy';
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
  }, { label: 'Delete board', color: '#dc2626' });
}

// ── Sessions ──────────────────────────────────────────────────────────────
async function loadSessions() {
  const tbody = document.getElementById('sessions-tbody');
  tbody.innerHTML = '<tr class="empty-row"><td colspan="6"><div class="skel skel-line" style="width:180px"></div></td></tr>';
  try {
    const d = await api('GET', '/api/admin/sessions');
    if (!d.sessions.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🔑</div><div class="empty-state-title">No active sessions</div><div class="empty-state-sub">All sessions have expired or been revoked</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = d.sessions.map(s => `
      <tr>
        <td data-label="User">
          <div style="font-weight:600">${s.user_avatar} ${esc(s.user_name)}</div>
          <div class="ip-text">${esc(s.user_email)}</div>
        </td>
        <td data-label="Device" style="font-size:12px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(uaIcon(s.user_agent))} ${esc(s.user_agent||'Unknown')}
        </td>
        <td data-label="IP" class="ip-text">${esc(s.ip||'-')}</td>
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

function filterSessions() {
  const q = (document.getElementById('sessions-search')?.value || '').toLowerCase();
  const rows = document.querySelectorAll('#sessions-tbody tr:not(.empty-row)');
  rows.forEach(r => {
    const text = r.textContent.toLowerCase();
    r.style.display = !q || text.includes(q) ? '' : 'none';
  });
}

function revokeAllSessions() {
  confirm('Revoke ALL sessions?', 'This will log out every user (including you). You will need to log in again.', '🔑', async () => {
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
let productionStatusSnapshot = null;

function productionCheckClass(check) {
  return check.ready ? 'good' : (check.required ? 'bad' : 'warn');
}

function productionCheckIcon(check) {
  return check.ready ? '✓' : (check.required ? '!' : '↩');
}

function productionCheckState(check) {
  if (check.ready) return check.mode ? `Ready · ${check.mode}` : 'Ready';
  return check.required ? 'Action needed · required' : `Fallback · ${check.mode || 'optional'}`;
}

function productionReportText(data = productionStatusSnapshot) {
  if (!data) return 'Production status is not loaded.';
  const lines = [
    `TeachEd production: ${data.ok ? 'OK' : 'BLOCKED'}`,
    ...Object.values(data.checks || {}).map(check => `${check.label}: ${check.ready ? 'ready' : (check.required ? 'missing' : 'fallback')}`),
    `Environment: ${data.environment || '-'}`,
    `Node: ${data.nodeVersion || '-'}`,
    `Release: ${data.release?.version || '-'} / ${data.release?.deployedSha || '-'}`,
    `Checked: ${data.checkedAt || '-'}`,
  ];
  return lines.join('\n');
}

async function copyProductionReport() {
  const report = productionReportText();
  try {
    await navigator.clipboard.writeText(report);
    toast('Production report copied', 'success');
  } catch {
    toast('Clipboard unavailable - select the status manually', 'error');
  }
}

function renderProductionStatus(data) {
  productionStatusSnapshot = data;
  const summary = document.getElementById('production-summary');
  const checksRoot = document.getElementById('production-checks');
  const meta = document.getElementById('production-meta');
  if (!summary || !checksRoot || !meta) return;

  const checks = Object.values(data.checks || {});
  const requiredMissing = checks.filter(check => check.required && !check.ready).length;
  const optionalFallbacks = checks.filter(check => !check.required && !check.ready).length;
  const tone = requiredMissing ? 'is-bad' : optionalFallbacks ? 'is-warn' : 'is-good';
  const icon = requiredMissing ? '!' : optionalFallbacks ? '↩' : '✓';
  const title = requiredMissing ? 'Production is blocked' : optionalFallbacks ? 'Production is healthy with fallbacks' : 'Production is fully configured';
  const sub = requiredMissing
    ? `${requiredMissing} required setting${requiredMissing === 1 ? '' : 's'} missing. Resolve before calling the release ready.`
    : optionalFallbacks
      ? `${optionalFallbacks} optional integration${optionalFallbacks === 1 ? '' : 's'} use an intentional fallback mode.`
      : 'Required runtime and optional provider integrations are ready.';
  summary.className = `production-summary ${tone}`;
  summary.innerHTML = `<div class="production-summary-icon">${icon}</div><div><div class="production-summary-title">${esc(title)}</div><div class="production-summary-sub">${esc(sub)}</div></div>`;

  checksRoot.innerHTML = checks.map(check => `
    <div class="production-check ${productionCheckClass(check)}">
      <div class="production-check-icon" aria-hidden="true">${productionCheckIcon(check)}</div>
      <div><div class="production-check-label">${esc(check.label)}</div><div class="production-check-state">${esc(productionCheckState(check))}</div></div>
    </div>`).join('');

  const release = data.release || {};
  const releaseBits = [
    `Environment <strong>${esc(data.environment || '-')}</strong>`,
    `Node <strong>${esc(data.nodeVersion || '-')}</strong>`,
    `Version <strong>${esc(release.version || '-')}</strong>`,
    `SHA <strong>${esc(release.deployedSha || 'not available')}</strong>`,
    `Checked <strong>${esc(data.checkedAt ? fmtDate(data.checkedAt) : '-')}</strong>`,
  ];
  meta.innerHTML = releaseBits.join(' &nbsp;·&nbsp; ');
}

async function loadProductionStatus() {
  const summary = document.getElementById('production-summary');
  if (!summary) return;
  summary.className = 'production-summary';
  summary.innerHTML = '<div class="production-summary-icon">…</div><div><div class="production-summary-title">Checking production configuration</div><div class="production-summary-sub">Only readiness flags are loaded.</div></div>';
  try {
    const data = await api('GET', '/api/admin/production-status');
    renderProductionStatus(data);
  } catch (e) {
    summary.className = 'production-summary is-bad';
    summary.innerHTML = `<div class="production-summary-icon">!</div><div><div class="production-summary-title">Could not load production status</div><div class="production-summary-sub">${esc(e.message || 'Admin API request failed')} · Retry the check.</div></div>`;
    const checksRoot = document.getElementById('production-checks');
    if (checksRoot) checksRoot.innerHTML = '<div class="production-check bad"><div class="production-check-icon">!</div><div><div class="production-check-label">Admin API unavailable</div><div class="production-check-state">No configuration values were exposed.</div></div></div>';
  }
}

async function promoteUser() {
  const email = document.getElementById('promote-email').value.trim();
  if (!email) { toast('Enter email','error'); return; }
  try {
    await api('PATCH', `/api/admin/users/${await userIdByEmail(email)}`, { role: 'admin' });
    toast(`${email} promoted to admin`, 'success');
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
  if (p1.length < 10) { toast('Min 10 characters','error'); return; }
  try {
    await api('PATCH', `/api/admin/users/${currentAdminUser.id}`, { password: p1 });
    toast('Password updated', 'success');
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
      <div>API: <strong>${h?.ok ? 'Online' : 'Offline'}</strong></div>
      <div>Server time: <strong>${system?.serverTime ? fmtDate(system.serverTime) : '-'}</strong></div>
      <div>Uptime: <strong>${fmtDuration(system?.uptimeSec)}</strong></div>
      <div>Node: <strong>${esc(system?.nodeVersion || '-')}</strong></div>
      <div>Expired sessions: <strong>${system?.expiredSessions ?? '-'}</strong></div>
      <div>Endpoint: <strong>${API}</strong></div>
      <div>Administrator: <strong>${currentAdminUser?.name || '-'}</strong></div>
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
    toast('Invite created and copied', 'success');
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
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ' ' +
         d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}

function billingCycleLabel(cycle) {
  return ({ monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }[cycle] || 'Monthly');
}

function fmtBytes(n) {
  if (!n) return '-';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
  return (n/1048576).toFixed(1) + ' MB';
}

function fmtDuration(sec) {
  if (typeof sec !== 'number' || Number.isNaN(sec)) return '-';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function fmtRelative(iso) {
  if (!iso) return '-';
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
  if (!day) return '-';
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
      `<button onclick="loadQuickEndpoint(${i})" style="padding:5px 10px;background:rgba(28,28,30,.06);border:1.5px solid rgba(94,94,74,.18);border-radius:8px;font-family:monospace;font-size:11px;font-weight:600;cursor:pointer;color:var(--text2)">${esc(q.label)}</button>`
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
      <span style="font-family:monospace;font-size:11px;font-weight:650;padding:2px 7px;border-radius:6px;background:${h.status<300?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)'};color:${h.status<300?'var(--green)':'var(--red)'}">${h.method}</span>
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
  document.getElementById('drawer-avatar').textContent = personInitials(u);
  document.getElementById('drawer-name').textContent = u.name;
  document.getElementById('drawer-email').textContent = u.email;
  document.getElementById('drawer-boards-n').textContent = u.boards_count ?? '-';
  document.getElementById('drawer-plan').textContent = u.plan || 'free';
  const joined = u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'}) : '-';
  document.getElementById('drawer-joined').textContent = joined;
  document.getElementById('drawer-badges').innerHTML = `
    <span class="badge badge-${u.role}">${u.role}</span>
    <span class="badge badge-${u.plan==='school'?'admin':u.plan==='pro'?'teacher':'student'}">${u.plan||'free'}</span>
    ${u.plan_status && u.plan_status!=='free' ? `<span class="badge" style="background:rgba(200,230,50,.18);color:#5a6b00">${u.plan_status}</span>` : ''}
    ${u.is_suspended ? '<span class="badge" style="background:#dc2626;color:#fff">SUSPENDED</span>' : ''}
    ${u.locked_at ? '<span class="badge" style="background:#ea580c;color:#fff">LOCKED</span>' : ''}
  `;
  // Suspend button label
  const suspBtn = document.getElementById('drawer-suspend-btn');
  if (suspBtn) {
    suspBtn.textContent = u.is_suspended ? 'Restore access' : 'Suspend';
    suspBtn.style.background = u.is_suspended ? 'var(--green)' : 'var(--orange)';
  }
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

  // Load auth events for this user
  loadUserAuthEventsDrawer(u.id);
}

async function loadUserAuthEventsDrawer(userId) {
  const el = document.getElementById('drawer-auth-events');
  if (!el) return;
  try {
    const d = await api('GET', `/api/admin/users/${userId}/auth-events`);
    if (!d.events?.length) { el.innerHTML = '<div style="color:var(--muted)">No auth events recorded yet.</div>'; return; }
    el.innerHTML = d.events.slice(0, 12).map(e => `
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(0,0,0,.06);font-size:11.5px">
        <span class="auth-event-mark">${authEventMark(e.event)}</span>
        <span style="font-weight:600;min-width:100px">${esc(e.event)}</span>
        <span style="color:var(--muted);flex:1">${esc(e.ip || '-')}</span>
        ${e.detail ? `<span style="color:var(--muted)">${esc(e.detail)}</span>` : ''}
        <span style="color:var(--muted);white-space:nowrap">${fmtRelative(e.created_at)}</span>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = `<div style="color:var(--red);font-size:12px">${esc(e.message)}</div>`;
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

async function drawerToggleSuspend() {
  if (!drawerUser) return;
  if (drawerUser.is_suspended) {
    await unsuspendUser(drawerUser.id, drawerUser.name);
  } else {
    const reason = window.prompt(`Reason for suspending ${drawerUser.name}:`, 'Suspended by admin');
    if (reason === null) return;
    await suspendUser(drawerUser.id, drawerUser.name, reason || 'Suspended by admin');
  }
  closeUserDrawer();
  loadUsers();
}

async function suspendUser(id, name, reason) {
  try {
    await api('POST', `/api/admin/users/${id}/suspend`, { reason });
    toast(`${name} suspended`, 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function unsuspendUser(id, name) {
  try {
    await api('POST', `/api/admin/users/${id}/unsuspend`);
    toast(`${name} unsuspended`, 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function unlockUser(id, name) {
  try {
    await api('POST', `/api/admin/users/${id}/unlock`);
    toast(`${name} unlocked`, 'success');
    loadUsers();
    loadSecurityPage();
  } catch(e) { toast(e.message, 'error'); }
}

// ── Security Page ─────────────────────────────────────────────────────────
let secOffset = 0;
const secLimit = 50;
let secTotal = 0;
let secSearchTimer;

async function loadSecurityPage() {
  // Load stats first
  try {
    const stats = await api('GET', '/api/admin/stats');
    document.getElementById('sec-stat-suspended').textContent = stats.suspended ?? 0;
    document.getElementById('sec-stat-locked').textContent    = stats.locked ?? 0;
    document.getElementById('sec-stat-failed24h').textContent = stats.failedLogins24h ?? 0;
  } catch {}
  loadAuthEvents();
  loadSuspendedUsers();
  loadLockedAccounts();
}

function debounceSecSearch() {
  clearTimeout(secSearchTimer);
  secSearchTimer = setTimeout(() => { secOffset = 0; loadAuthEvents(); }, 350);
}

function secPage(dir) {
  secOffset = Math.max(0, secOffset + dir * secLimit);
  loadAuthEvents();
}

async function loadAuthEvents() {
  const search = document.getElementById('sec-search')?.value || '';
  const event  = document.getElementById('sec-event-filter')?.value || '';
  const tbody  = document.getElementById('sec-events-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr class="empty-row"><td colspan="6"><div class="skel skel-line" style="width:200px"></div></td></tr>';
  try {
    const d = await api('GET', `/api/admin/auth-events?search=${encodeURIComponent(search)}&event=${encodeURIComponent(event)}&limit=${secLimit}&offset=${secOffset}`);
    secTotal = d.total || 0;
    const info = document.getElementById('sec-page-info');
    if (info) info.textContent = secTotal ? `${secOffset+1}-${Math.min(secOffset+secLimit,secTotal)} of ${secTotal}` : 'No results';
    const prev = document.getElementById('sec-prev'); if (prev) prev.disabled = secOffset === 0;
    const next = document.getElementById('sec-next'); if (next) next.disabled = secOffset + secLimit >= secTotal;
    if (!d.events?.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="6"><div class="empty-note">No auth events found.</div></td></tr>'; return; }
    tbody.innerHTML = d.events.map(e => `<tr>
      <td class="time-text">${fmtRelative(e.created_at)}</td>
      <td><span style="font-weight:600"><span class="auth-event-mark">${authEventMark(e.event)}</span> ${esc(e.event)}</span></td>
      <td style="font-size:12px">${esc(e.user_name || e.email || '-')}<br><span style="color:var(--muted);font-size:11px">${esc(e.email||'')}</span></td>
      <td style="font-size:12px;font-family:monospace">${esc(e.ip||'-')}</td>
      <td style="font-size:12px;color:var(--muted)">${esc(e.detail||'-')}</td>
      <td style="font-size:11px;color:var(--muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(e.user_agent||'')}">${esc((e.user_agent||'').slice(0,40)||'-')}</td>
    </tr>`).join('');
  } catch(e) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Error: ${esc(e.message)}</td></tr>`;
  }
}

function authEventMark(event) {
  return { 'login.ok': 'OK', 'login.fail': '!', 'login.blocked': 'X', logout: 'OUT', 'password.reset': 'PW', 'google.login': 'G', 'google.signup': 'G' }[event] || '·';
}

async function loadSuspendedUsers() {
  const el = document.getElementById('sec-suspended-list');
  if (!el) return;
  try {
    const d = await api('GET', '/api/admin/users?access=suspended&limit=100&offset=0&search=');
    const suspended = d.users || [];
    if (!suspended.length) { el.innerHTML = '<div class="empty-note" style="padding:12px;font-size:13px;color:var(--muted)">No suspended accounts.</div>'; return; }
    el.innerHTML = suspended.map(u => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="person-mark">${personInitials(u)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px">${esc(u.name)}</div>
          <div style="font-size:12px;color:var(--muted)">${esc(u.email)}</div>
          ${u.suspended_reason ? `<div style="font-size:11px;color:#dc2626">${esc(u.suspended_reason)}</div>` : ''}
        </div>
        <button class="btn-sm btn-green" onclick="unsuspendUser('${u.id}','${esc(u.name)}').then(loadSecurityPage).then(loadUsers)">Restore access</button>
      </div>`).join('');
  } catch(e) { el.innerHTML = `<div style="color:var(--red);font-size:13px;padding:12px">${esc(e.message)}</div>`; }
}

async function loadLockedAccounts() {
  const el = document.getElementById('sec-locked-list');
  if (!el) return;
  try {
    const d = await api('GET', '/api/admin/users?access=locked&limit=100&offset=0&search=');
    const locked = d.users || [];
    if (!locked.length) { el.innerHTML = '<div class="empty-note" style="padding:12px;font-size:13px;color:var(--muted)">No locked accounts.</div>'; return; }
    el.innerHTML = locked.map(u => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div class="person-mark">${personInitials(u)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px">${esc(u.name)}</div>
          <div style="font-size:12px;color:var(--muted)">${esc(u.email)}</div>
          <div style="font-size:11px;color:#ea580c">${u.failed_login_count||0} failed attempts · locked ${fmtRelative(u.locked_at)}</div>
        </div>
        <button class="btn-sm btn-orange" onclick="unlockUser('${u.id}','${esc(u.name)}')">Unlock</button>
      </div>`).join('');
  } catch(e) { el.innerHTML = `<div style="color:var(--red);font-size:13px;padding:12px">${esc(e.message)}</div>`; }
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
  }, { label: `Delete ${ids.length} users`, color: '#dc2626' });
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
  }, { label: `Kick ${ids.length} users`, color: '#f97316' });
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
