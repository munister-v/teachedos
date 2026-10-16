/* Community review (admin.html): the review team's queue.
   A case holds a snapshot of the publication as it was reported; the author
   editing it meanwhile never changes what is being judged. Moderators see the
   category and the comment of each report - never who reported (the server does
   not send it). Decisions: No violation / Needs changes / Remove. */
let _crFilter = 'open', _crCases = [], _crOpen = null;
const crEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CR_LABEL = { misleading: 'Incorrect or misleading', copyright: 'Copyright or plagiarism', inappropriate: 'Inappropriate for learners', personal_data: 'Personal data', harmful_link: 'Harmful link or file', spam: 'Spam or duplicate', other: 'Other', mistakes: 'Incorrect or misleading', broken: 'Incorrect or misleading' };
const crAgo = iso => { if (!iso) return ''; const h = (Date.now() - Date.parse(iso)) / 36e5; return h < 1 ? 'just now' : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} d ago`; };

async function loadCommunityQueue() {
  try {
    const [ov, q] = await Promise.all([api('GET', '/api/community/admin/overview'), api('GET', `/api/community/admin/queue?status=${_crFilter}`)]);
    const o = ov.overview;
    document.getElementById('cr-open').textContent = o.open_cases;
    document.getElementById('cr-crit').textContent = o.critical;
    document.getElementById('cr-appeals').textContent = o.appeals;
    document.getElementById('cr-oldest').textContent = o.oldest_hours == null ? '-' : o.oldest_hours < 48 ? `${Math.round(o.oldest_hours)} h` : `${Math.round(o.oldest_hours / 24)} d`;
    const badge = document.getElementById('sb-community-badge');
    if (badge) { const n = o.open_cases + o.appeals; badge.textContent = n; badge.style.display = n ? '' : 'none'; }
    _crCases = q.cases;
    renderCrList();
  } catch (e) { document.getElementById('cr-list').innerHTML = `<div class="monitor-placeholder">${crEsc(e.message)}</div>`; }
}
function crFilter(f) {
  _crFilter = f; _crOpen = null;
  document.querySelectorAll('[data-cr]').forEach(b => b.classList.toggle('active', b.dataset.cr === f));
  document.getElementById('cr-detail').innerHTML = '<div class="monitor-placeholder">Select a case to see what was reported.</div>';
  loadCommunityQueue();
}
function renderCrList() {
  const box = document.getElementById('cr-list');
  box.innerHTML = _crCases.length ? _crCases.map(c => `<button type="button" class="cr-item${_crOpen === c.id ? ' on' : ''}" onclick="crOpenCase('${c.id}')">
      <b>${crEsc(c.title || 'Removed lesson')}</b>
      <small>${c.risk_level === 'critical' ? '<span class="cr-tag crit">Critical</span>' : ''}${c.resubmitted_at ? '<span class="cr-tag new">New version</span>' : ''}${c.appeal_status === 'pending' ? '<span class="cr-tag warn">Appeal</span>' : ''}${c.reports} report${c.reports === 1 ? '' : 's'} (${c.counted} counted) · ${crEsc(c.moderation_state || '')} · opened ${crAgo(c.opened_at)}</small>
      <small>by ${crEsc(c.author_name || '')}${c.decision ? ' · decided: ' + crEsc(c.decision.replace('_', ' ')) : ''}</small></button>`).join('')
    : '<div class="monitor-placeholder">Nothing waiting. 🎉</div>';
}
async function crOpenCase(id) {
  _crOpen = id; renderCrList();
  const box = document.getElementById('cr-detail'); box.innerHTML = '<div class="monitor-placeholder">Loading…</div>';
  try {
    const d = await api('GET', `/api/community/admin/cases/${id}`);
    const c = d.case, snap = c.snapshot || {}, cards = (snap.snapshot && snap.snapshot.cards) || [];
    const row = _crCases.find(x => x.id === id) || {};
    box.innerHTML = `<h3>${crEsc(snap.title || 'Lesson')}</h3>
      <div class="page-sub" style="margin:0">by ${crEsc(snap.author_name || '')} · version ${c.version_no} at the time of the report${row.current_version && row.current_version !== c.version_no ? ` (the author has since published version ${row.current_version})` : ''} · ${c.risk_level === 'critical' ? '<b>critical</b>' : 'normal risk'}</div>
      ${snap.description ? `<p>${crEsc(snap.description)}</p>` : ''}
      <h4>Reports (${d.reports.length}) - categories and comments only</h4>
      ${d.reports.map(r => `<div class="cr-rep${r.counts ? '' : ' dim'}"><b>${crEsc(CR_LABEL[r.category] || r.category)}</b>${r.severity === 'critical' ? ' <span class="cr-tag crit">serious</span>' : ''}${r.counts ? '' : ' <span class="cr-tag warn">does not count (new or low-trust account)</span>'}${r.note ? `<br>${crEsc(r.note)}` : ''}</div>`).join('') || '<div class="monitor-placeholder">No reports.</div>'}
      <h4>What was reported (snapshot, ${cards.length} cards)</h4>
      <div class="cr-snap">${cards.filter(x => x.type !== 'frame').slice(0, 60).map(x => `<span><small>${crEsc(x.type)}</small> ${crEsc(String((x.data && (x.data.text || x.data.title || x.data.question || x.data.url)) || '').slice(0, 160))}</span>`).join('') || 'Empty snapshot.'}</div>
      ${d.versions.length > 1 ? `<h4>Versions</h4><div class="page-sub" style="margin:0">${d.versions.map(v => `v${v.version_no} · ${crAgo(v.created_at)}`).join(' &nbsp; ')}</div>` : ''}
      ${d.history.length ? `<h4>Earlier cases on this lesson</h4>${d.history.map(h => `<div class="cr-rep">${crEsc(h.decision || h.status)} · ${crAgo(h.decided_at || h.opened_at)} ${h.decision_note ? '- ' + crEsc(h.decision_note) : ''}</div>`).join('')}` : ''}
      ${d.appeal ? `<h4>Appeal from the author (${crEsc(d.appeal.status)})</h4><div class="cr-rep">${crEsc(d.appeal.message)}${d.appeal.evidence ? `<br><small>Proof: ${crEsc(d.appeal.evidence)}</small>` : ''}</div>` : ''}
      ${c.status === 'resolved' && !(d.appeal && d.appeal.status === 'pending') ? `<h4>Decision</h4><div class="cr-rep"><b>${crEsc((c.decision || '').replace('_', ' '))}</b>${c.decision_note ? '<br>' + crEsc(c.decision_note) : ''}</div>` : ''}
      ${d.appeal && d.appeal.status === 'pending' ? `<div class="cr-form"><textarea id="cr-note" placeholder="Note to the author (optional)"></textarea><div class="cr-actions"><button class="btn-sm btn-green" onclick="crAppeal('${d.appeal.id}','overturned')">Overturn - restore it</button><button class="btn-sm btn-edit" onclick="crAppeal('${d.appeal.id}','upheld')">Decision stands</button></div></div>`
        : c.status !== 'resolved' ? `<div class="cr-form">
          <textarea id="cr-note" placeholder="What is wrong, in plain words - the author reads this (required for Needs changes and Remove)"></textarea>
          <input id="cr-req" placeholder="What to change to restore it (optional)">
          <label style="font-size:12.5px"><input type="checkbox" id="cr-restrict"> On Remove: restrict this author from publishing (repeat violations)</label>
          <div class="cr-actions">
            <button class="btn-sm btn-green" onclick="crDecide('${c.id}','no_violation')">No violation - restore</button>
            <button class="btn-sm btn-orange" onclick="crDecide('${c.id}','needs_changes')">Needs changes</button>
            <button class="btn-sm btn-edit" style="background:#FFD9D9;color:#9B1C1C" onclick="crDecide('${c.id}','remove')">Remove</button></div></div>` : ''}`;
  } catch (e) { box.innerHTML = `<div class="monitor-placeholder">${crEsc(e.message)}</div>`; }
}
async function crDecide(id, decision) {
  try {
    await api('POST', `/api/community/admin/cases/${id}/decide`, { decision, note: document.getElementById('cr-note').value, required_changes: document.getElementById('cr-req').value, restrict_author: document.getElementById('cr-restrict').checked });
    toast('Decision saved - the author is told'); _crOpen = null;
    document.getElementById('cr-detail').innerHTML = '<div class="monitor-placeholder">Saved.</div>'; loadCommunityQueue();
  } catch (e) { toast(e.message, 'error'); }
}
async function crAppeal(id, outcome) {
  try {
    await api('POST', `/api/community/admin/appeals/${id}/resolve`, { outcome, note: document.getElementById('cr-note').value });
    toast('Appeal decided - the author is told'); _crOpen = null;
    document.getElementById('cr-detail').innerHTML = '<div class="monitor-placeholder">Saved.</div>'; loadCommunityQueue();
  } catch (e) { toast(e.message, 'error'); }
}
async function crTeam(on) {
  const id = document.getElementById('cr-team-id').value.trim();
  try { await api('POST', `/api/community/admin/team/${encodeURIComponent(id)}`, { on }); toast(on ? 'Marked as TeachEd Team' : 'Removed from TeachEd Team'); } catch (e) { toast(e.message, 'error'); }
}
async function crEditorial(on) {
  const id = document.getElementById('cr-ed-id').value.trim(), kind = document.getElementById('cr-ed-kind').value;
  try { await api('POST', `/api/community/admin/editorial/${kind}/${encodeURIComponent(id)}`, { on }); toast(on ? "Marked as Editor's pick" : "Removed from Editor's picks"); } catch (e) { toast(e.message, 'error'); }
}
