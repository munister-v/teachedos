/* Profile → School (18.10.2026): the organisation behind TeachEd memory hand-overs.

   Everyone: invitations to me (accept / decline), my school and its teachers.
   No school: create one (you become its admin).
   A teacher: leave the school.
   The admin: rename, invite by email, cancel an invitation, remove a teacher,
   hand a teacher's students' memory to a colleague (student names only - the admin
   never reads a dossier), delete the school.
   Uses profile-app.js's apiFetch. */
(function () {
  'use strict';
  const root = () => document.getElementById('school-root');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  let state = null;

  async function api(method, path, body) {
    const r = await apiFetch('/api/schools' + path, { method, body });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data.error && data.error.message) || 'Something went wrong');
    return data;
  }
  function say(msg, bad) {
    const el = document.getElementById('school-msg');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('bad', !!bad);
  }
  async function act(btn, fn, okMsg) {
    if (btn) btn.disabled = true;
    try { await fn(); await load(); say(okMsg || ''); }
    catch (e) { say(e.message, true); if (btn) btn.disabled = false; }
  }

  async function load() {
    const box = root();
    if (!box) return;
    try { state = await api('GET', '/mine'); } catch (e) { box.innerHTML = `<p class="sch-note">${esc(e.message)}</p>`; return; }
    render();
  }

  function render() {
    const box = root();
    const { school, invitations } = state;
    const inv = (invitations || []).map(i => `<div class="sch-card sch-invite">
        <div><b>${esc(i.school_name)}</b><span class="sch-sub">${esc(i.from_name || 'A teacher')} invited you · ${esc(day(i.created_at))}</span></div>
        <div class="sch-row"><button type="button" class="sch-btn lime" data-go="accept" data-id="${esc(i.id)}">Join</button><button type="button" class="sch-btn" data-go="decline" data-id="${esc(i.id)}">Decline</button></div>
      </div>`).join('');
    let body = '';
    if (!school) {
      body = `<div class="sch-card">
        <h3>Create a school</h3>
        <p class="sch-note">For a team of teachers: you invite colleagues by email, and a student's TeachEd memory can be handed over only within the school. You become its admin. A teacher is in one school.</p>
        <form class="sch-row" data-form="create"><input class="sch-input" name="name" maxlength="120" placeholder="School name" aria-label="School name" required><button type="submit" class="sch-btn lime">Create</button></form>
      </div>`;
    } else {
      const admin = school.role === 'admin';
      const members = school.members.map(m => `<li class="sch-member">
          <div><b>${esc(m.name || m.email)}</b><span class="sch-sub">${esc(m.email)} · ${m.role === 'admin' ? 'Admin' : 'Teacher'}</span></div>
          ${admin && m.role !== 'admin' ? `<div class="sch-row"><button type="button" class="sch-btn" data-go="handover" data-id="${esc(m.id)}">Hand over students…</button><button type="button" class="sch-btn" data-go="remove" data-id="${esc(m.id)}" data-name="${esc(m.name || m.email)}">Remove</button></div>` : ''}
        </li><li class="sch-ho" id="sch-ho-${esc(m.id)}" hidden></li>`).join('');
      body = `<div class="sch-card">
        <div class="sch-head"><h3>${esc(school.name)}</h3><span class="sch-pill">${admin ? 'Admin' : 'Teacher'}</span></div>
        ${admin ? `<form class="sch-row" data-form="rename"><input class="sch-input" name="name" maxlength="120" value="${esc(school.name)}" aria-label="School name"><button type="submit" class="sch-btn">Rename</button></form>` : ''}
        <p class="sch-note">Within the school a student's TeachEd memory can be handed to another teacher of it, and only to them.${admin ? ' As the admin you can hand over for a teacher who is leaving; you never see what is inside.' : ''}</p>
        <h4>Teachers · ${school.members.length}</h4>
        <ul class="sch-list">${members}</ul>
        ${admin ? `<h4>Invite a teacher</h4>
          <form class="sch-row" data-form="invite"><input class="sch-input" type="email" name="email" placeholder="colleague@school.com" aria-label="Teacher's email" required><button type="submit" class="sch-btn lime">Invite</button></form>
          ${(school.invites || []).length ? `<ul class="sch-list">${school.invites.map(i => `<li class="sch-member"><div><b>${esc(i.email)}</b><span class="sch-sub">Invited ${esc(day(i.created_at))} · waiting</span></div><button type="button" class="sch-btn" data-go="cancel" data-id="${esc(i.id)}">Cancel</button></li>`).join('')}</ul>` : ''}
          <div class="sch-danger"><button type="button" class="sch-btn danger" data-go="delete">Delete the school</button></div>`
        : `<div class="sch-danger"><button type="button" class="sch-btn" data-go="leave">Leave the school</button></div>`}
      </div>`;
    }
    box.innerHTML = `${inv ? `<h4>Invitations</h4>${inv}` : ''}${body}<p class="sch-msg" id="school-msg" role="status" aria-live="polite"></p>`;
  }

  async function openHandover(id) {
    const slot = document.getElementById('sch-ho-' + id);
    if (!slot) return;
    if (!slot.hidden) { slot.hidden = true; slot.innerHTML = ''; return; }
    slot.hidden = false;
    slot.innerHTML = '<p class="sch-note">Loading…</p>';
    try {
      const d = await api('GET', `/members/${encodeURIComponent(id)}/dossiers`);
      const others = state.school.members.filter(m => m.id !== id);
      if (!d.dossiers.length) { slot.innerHTML = `<p class="sch-note">${esc(d.teacher.name || 'This teacher')} has no TeachEd memory of students yet.</p>`; return; }
      slot.innerHTML = `<form class="sch-ho-form" data-form="handover" data-id="${esc(id)}">
        <p class="sch-note">Students whose memory ${esc(d.teacher.name || 'this teacher')} keeps. You see the names only.</p>
        <div class="sch-checks">${d.dossiers.map(x => `<label><input type="checkbox" name="ids" value="${esc(x.id)}" checked> ${esc(x.student_name)}${x.archived ? ' <span class="sch-sub">archived</span>' : ''}</label>`).join('')}</div>
        <div class="sch-row"><select class="sch-input" name="to" aria-label="Hand to" required><option value="">Hand to…</option>${others.map(m => `<option value="${esc(m.id)}">${esc(m.name || m.email)}</option>`).join('')}</select>
        <button type="submit" class="sch-btn lime">Hand over</button></div></form>`;
    } catch (e) { slot.innerHTML = `<p class="sch-note bad">${esc(e.message)}</p>`; }
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('#school-root [data-go]');
    if (!b) return;
    const id = b.dataset.id;
    const go = b.dataset.go;
    if (go === 'accept') act(b, () => api('POST', `/invites/${encodeURIComponent(id)}/accept`), 'You joined the school.');
    else if (go === 'decline') act(b, () => api('POST', `/invites/${encodeURIComponent(id)}/decline`));
    else if (go === 'cancel') act(b, () => api('DELETE', `/invites/${encodeURIComponent(id)}`));
    else if (go === 'remove') { if (confirm(`Remove ${b.dataset.name} from the school? Their students' memory stays with them.`)) act(b, () => api('DELETE', `/members/${encodeURIComponent(id)}`)); }
    else if (go === 'leave') { if (confirm('Leave the school? Your students and their memory stay with you.')) act(b, () => api('POST', '/leave')); }
    else if (go === 'delete') { if (confirm(`Delete ${state.school.name}? Every teacher keeps their students and memory; the school and its invitations go.`)) act(b, () => api('DELETE', '/')); }
    else if (go === 'handover') openHandover(id);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('#school-root form[data-form]');
    if (!f) return;
    e.preventDefault();
    const btn = f.querySelector('button[type="submit"]');
    const kind = f.dataset.form;
    if (kind === 'create') act(btn, () => api('POST', '/', { name: f.name.value }), 'School created. Invite your colleagues.');
    else if (kind === 'rename') act(btn, () => api('PATCH', '/', { name: f.name.value }), 'Renamed.');
    else if (kind === 'invite') act(btn, () => api('POST', '/invites', { email: f.email.value }), 'Invitation sent. They accept it in their profile.');
    else if (kind === 'handover') {
      const ids = [...f.querySelectorAll('input[name="ids"]:checked')].map(x => x.value);
      const to = f.to.value;
      const toName = f.to.selectedOptions[0] ? f.to.selectedOptions[0].textContent : '';
      if (!ids.length || !to) { say('Choose the students and the teacher', true); return; }
      if (!confirm(`Hand ${ids.length} student${ids.length === 1 ? '' : 's'}' TeachEd memory to ${toName}? The current teacher will no longer see it.`)) return;
      act(btn, () => api('POST', `/members/${encodeURIComponent(f.dataset.id)}/handover`, { to_teacher_id: to, ids }), `Handed over to ${toName}.`);
    }
  });

  window.loadSchoolTab = load;
})();
