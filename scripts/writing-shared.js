/* Writing hand-ins — pieces shared by the teacher's review (homework.html)
   and the student's cabinet (student.html): the text with corrections
   marked in place, criterion bands, the checklist. */
(function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* Find every correction's fragment in the text (first free occurrence,
     exact case first) and wrap it. Overlaps are skipped rather than nested:
     a mark inside a mark is unreadable. */
  function markedText(text, corrections, opts) {
    const src = String(text || '');
    const ranges = [];
    (corrections || []).forEach((c, i) => {
      const needle = String(c && c.original || '').trim();
      if (!needle || needle.length < 2) return;
      let at = src.indexOf(needle);
      if (at < 0) at = src.toLowerCase().indexOf(needle.toLowerCase());
      while (at >= 0 && ranges.some(r => at < r.end && at + needle.length > r.start)) {
        at = src.indexOf(needle, at + 1);
      }
      if (at >= 0) ranges.push({ start: at, end: at + needle.length, i });
    });
    ranges.sort((a, b) => a.start - b.start);
    let html = '';
    let pos = 0;
    const show = !(opts && opts.plain);
    ranges.forEach(r => {
      html += esc(src.slice(pos, r.start));
      const c = corrections[r.i];
      const frag = esc(src.slice(r.start, r.end));
      html += show
        ? `<mark class="wr-mark wr-t-${esc(c.type || 'grammar')}" data-ci="${r.i}" tabindex="0" title="${esc(c.suggestion)}${c.why ? ' — ' + esc(c.why) : ''}">${frag}<span class="wr-fix">${esc(c.suggestion)}</span></mark>`
        : frag;
      pos = r.end;
    });
    html += esc(src.slice(pos));
    return html.split(/\n{2,}|\n/).map(p => p.trim() ? `<p>${p}</p>` : '').join('');
  }

  const BAND_WORDS = ['Not attempted', 'Very limited', 'Limited', 'Adequate', 'Good', 'Fully meets the level'];

  function bandsHtml(scores) {
    return `<div class="wr-bands">${(scores || []).map(s => `
      <div class="wr-band">
        <div class="wr-band-top"><span>${esc(s.name || s.key)}</span><b>${Number(s.band) || 0}/5</b></div>
        <div class="wr-band-bar"><i style="width:${Math.max(0, Math.min(5, Number(s.band) || 0)) * 20}%"></i></div>
        ${s.comment ? `<p>${esc(s.comment)}</p>` : ''}
      </div>`).join('')}</div>`;
  }

  function checklistHtml(list) {
    if (!list || !list.length) return '';
    const icon = { yes: '✓', partly: '◐', no: '✕' };
    return `<ul class="wr-checklist">${list.map(c => `
      <li class="wr-met-${esc(c.met)}"><span class="wr-met-ic" aria-label="${esc(c.met)}">${icon[c.met] || '◐'}</span>
        <span><b>${esc(c.item)}</b>${c.note ? `<small>${esc(c.note)}</small>` : ''}</span></li>`).join('')}</ul>`;
  }

  function correctionsHtml(list) {
    if (!list || !list.length) return '';
    return `<ol class="wr-corrections">${list.map((c, i) => `
      <li data-ci="${i}"><span class="wr-orig">${esc(c.original)}</span><span class="wr-arrow">→</span><span class="wr-sugg">${esc(c.suggestion)}</span>
        ${c.why ? `<small>${esc(c.why)}${c.type ? ` · ${esc(c.type)}` : ''}</small>` : ''}</li>`).join('')}</ol>`;
  }

  function when(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  const CSS = `
.wr-text{font:17px/1.75 Georgia,'Times New Roman',serif;color:var(--text,#161616)}
.wr-text p{margin:0 0 14px}
.wr-mark{background:rgba(255,196,0,.22);border-bottom:2px solid #e0a800;border-radius:3px;padding:0 1px;cursor:help;position:relative}
.wr-mark.wr-t-spelling{border-color:#d9534f;background:rgba(217,83,79,.12)}
.wr-mark.wr-t-vocabulary{border-color:#3b82f6;background:rgba(59,130,246,.12)}
.wr-mark.wr-t-style{border-color:#8b5cf6;background:rgba(139,92,246,.1)}
.wr-mark.wr-t-punctuation{border-color:#10b981;background:rgba(16,185,129,.12)}
.wr-fix{display:none}
.wr-show-fixes .wr-fix{display:inline;margin-left:4px;padding:0 5px;border-radius:4px;background:#1f7a3a;color:#fff;font:600 12px/1.6 system-ui,sans-serif}
.wr-mark.is-active{outline:2px solid #161616;outline-offset:2px}
.wr-bands{display:grid;gap:12px}
.wr-band-top{display:flex;justify-content:space-between;font:600 13px/1.3 system-ui,sans-serif}
.wr-band-bar{height:6px;border-radius:6px;background:rgba(0,0,0,.08);margin:6px 0 4px;overflow:hidden}
.wr-band-bar i{display:block;height:100%;background:#9bd11a;border-radius:6px}
.wr-band p{margin:4px 0 0;font:13px/1.45 system-ui,sans-serif;color:var(--text-2,#555)}
.wr-checklist{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.wr-checklist li{display:flex;gap:10px;align-items:flex-start;font:13px/1.4 system-ui,sans-serif}
.wr-checklist small{display:block;color:var(--text-2,#666);margin-top:2px}
.wr-met-ic{flex:0 0 22px;height:22px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:12px}
.wr-met-yes .wr-met-ic{background:#dff5c9;color:#2f6b00}
.wr-met-partly .wr-met-ic{background:#fff1c2;color:#8a6200}
.wr-met-no .wr-met-ic{background:#fde0de;color:#a52a22}
.wr-corrections{margin:0;padding-left:20px;display:grid;gap:8px;font:13px/1.45 system-ui,sans-serif}
.wr-corrections li{cursor:pointer}
.wr-corrections li:hover .wr-orig{background:rgba(255,196,0,.3)}
.wr-orig{text-decoration:line-through;text-decoration-color:#d9534f;color:var(--text-2,#666)}
.wr-arrow{margin:0 6px;color:var(--text-3,#999)}
.wr-sugg{font-weight:600;color:#1f7a3a}
.wr-corrections small{display:block;color:var(--text-3,#888)}
`;
  function injectCss() {
    if (document.getElementById('wr-shared-css')) return;
    const st = document.createElement('style');
    st.id = 'wr-shared-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* Hovering a correction in the list lights up its fragment in the text. */
  function linkCorrections(root) {
    root.addEventListener('mouseover', e => {
      const li = e.target.closest('.wr-corrections li');
      root.querySelectorAll('.wr-mark.is-active').forEach(m => m.classList.remove('is-active'));
      if (li) root.querySelector(`.wr-mark[data-ci="${li.dataset.ci}"]`)?.classList.add('is-active');
    });
    root.addEventListener('click', e => {
      const li = e.target.closest('.wr-corrections li');
      if (li) root.querySelector(`.wr-mark[data-ci="${li.dataset.ci}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  window.TeachedWriting = { esc, markedText, bandsHtml, checklistHtml, correctionsHtml, when, injectCss, linkCorrections, BAND_WORDS };
})();
