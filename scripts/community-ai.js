/* ════════════════════════════════════════════════════════════════
   community-ai.js — AI Community-Post generator + rich-text editor
   Self-contained: injects a generator panel into the share card, calls
   POST /api/community-ai/post (free OpenRouter model on the server), lets the
   teacher edit the post (incl. a rich-text description editor), then drops it
   into the localStorage feed via window.writePosts/renderCommunity.
   Also exposes window.ttSanitize() used by renderCommunity to safely render
   rich descriptions (allowlist — prevents XSS from shared posts).
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Allowlist HTML sanitizer (used on save AND on feed render) ─────────────
  var ALLOWED = { B: [], I: [], STRONG: [], EM: [], U: [], UL: [], OL: [], LI: [], H3: [], P: [], BR: [], A: ['href'] };
  function ttSanitize(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 8) { n.remove(); return; }            // comments
        if (n.nodeType !== 1) return;                            // keep text
        var tag = n.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE') { n.remove(); return; }
        if (!ALLOWED[tag]) {                                     // unwrap unknown tag, keep text
          walk(n);
          while (n.firstChild) node.insertBefore(n.firstChild, n);
          n.remove();
          return;
        }
        Array.prototype.slice.call(n.attributes).forEach(function (a) {
          if (ALLOWED[tag].indexOf(a.name.toLowerCase()) === -1) n.removeAttribute(a.name);
        });
        if (tag === 'A') {
          var href = n.getAttribute('href') || '';
          if (!/^(https?:|mailto:)/i.test(href)) n.removeAttribute('href');
          n.setAttribute('rel', 'noopener noreferrer');
          n.setAttribute('target', '_blank');
        }
        walk(n);
      });
    })(tpl.content);
    return tpl.innerHTML;
  }
  window.ttSanitize = ttSanitize;

  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Own API client so we never depend on community.html's lexical scope.
  var api = (window.TeachEdApp && window.TeachEdApp.createApiClient)
    ? window.TeachEdApp.createApiClient(function () { return localStorage.getItem('teachedos_token') || ''; })
    : function (p, o) { return fetch(p, o); };

  var STYLE = [
    '.cai{margin:14px 0;padding:16px;border:1.5px dashed var(--lime,#CDF24F);border-radius:16px;background:rgba(205,242,79,.06)}',
    '.cai-h{font:800 13px var(--font);display:flex;align-items:center;gap:8px;margin-bottom:10px}',
    '.cai-modes{display:flex;gap:6px;margin-bottom:10px}',
    '.cai-mode{flex:1;padding:7px;border:1.5px solid var(--border,#ddd);border-radius:10px;background:#fff;font:800 12px var(--font);cursor:pointer;color:var(--text2,#555)}',
    '.cai-mode.on{background:var(--lime,#CDF24F);border-color:var(--lime,#CDF24F);color:#0E0E10}',
    '.cai-row{display:grid;grid-template-columns:1fr 96px;gap:8px}',
    '.cai textarea,.cai input,.cai select{width:100%;border:1.5px solid var(--border,#ddd);border-radius:11px;padding:9px 11px;font:600 13px var(--font);outline:none;background:#fff;color:var(--text,#111)}',
    '.cai textarea{min-height:70px;resize:vertical}',
    '.cai-gen{width:100%;margin-top:9px;padding:11px;border:0;border-radius:11px;background:#0E0E10;color:#fff;font:800 13px var(--font);cursor:pointer}',
    '.cai-gen:disabled{opacity:.55;cursor:default}',
    '.cai-out{margin-top:12px;display:none}',
    '.cai-rt-bar{display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap}',
    '.cai-rt-bar button{border:1px solid var(--border,#ddd);background:#fff;border-radius:8px;min-width:30px;height:28px;font:800 12px var(--font);cursor:pointer;color:var(--text,#111)}',
    '.cai-rt{min-height:64px;border:1.5px solid var(--border,#ddd);border-radius:11px;padding:9px 11px;font:600 13px var(--font);background:#fff;color:var(--text,#111);outline:none}',
    '.cai-rt:focus{border-color:var(--lime,#CDF24F)}',
    '.cai-rt h3{font-size:15px;margin:4px 0;font-weight:900}',
    '.cai-prev{margin-top:10px;padding:10px;border:1px solid var(--border,#eee);border-radius:11px;background:#fff}',
    '.cai-prev-cards{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}',
    '.cai-prev-card{font:600 11px var(--font);padding:7px 9px;border-radius:9px;color:#1a1a1a;line-height:1.3}',
    '.cai-actions{display:flex;gap:8px;margin-top:10px}',
    '.cai-actions .btn{flex:1}',
    '.cai-note{font:600 11px var(--font);color:var(--text3,#888);margin-top:7px}'
  ].join('');

  var current = null; // last generated post

  function inject() {
    var card = document.querySelector('.share-card');
    if (!card || document.getElementById('cai')) return;
    var st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);

    var el = document.createElement('div');
    el.className = 'cai'; el.id = 'cai';
    el.innerHTML =
      '<div class="cai-h">✨ Generate a post with AI <span style="font:700 10px var(--mono,monospace);color:var(--text3,#888)">free model</span></div>' +
      '<div class="cai-modes">' +
        '<button type="button" class="cai-mode on" data-mode="topic">By topic + level</button>' +
        '<button type="button" class="cai-mode" data-mode="source">From URL / text</button>' +
      '</div>' +
      '<div id="cai-topic-fields">' +
        '<div class="cai-row">' +
          '<input id="cai-topic" placeholder="Topic, e.g. Past Simple irregular verbs">' +
          '<select id="cai-level"><option>A1</option><option>A2</option><option selected>B1</option><option>B2</option><option>C1</option></select>' +
        '</div>' +
      '</div>' +
      '<div id="cai-source-fields" style="display:none">' +
        '<input id="cai-url" placeholder="Paste a public URL (article / channel post) — optional" style="margin-bottom:8px">' +
        '<textarea id="cai-source" placeholder="…or paste the source text here"></textarea>' +
      '</div>' +
      '<button type="button" class="cai-gen" id="cai-gen">✨ Generate post</button>' +
      '<div class="cai-note" id="cai-status"></div>' +
      '<div class="cai-out" id="cai-out">' +
        '<div class="field"><div class="label">Title</div><input id="cai-r-title"></div>' +
        '<div class="field"><div class="label">Description (rich text)</div>' +
          '<div class="cai-rt-bar">' +
            '<button type="button" data-cmd="bold"><b>B</b></button>' +
            '<button type="button" data-cmd="italic"><i>I</i></button>' +
            '<button type="button" data-cmd="insertUnorderedList">• List</button>' +
            '<button type="button" data-cmd="h3">H3</button>' +
            '<button type="button" data-emoji="✅">✅</button>' +
            '<button type="button" data-emoji="📌">📌</button>' +
            '<button type="button" data-emoji="💬">💬</button>' +
          '</div>' +
          '<div class="cai-rt" id="cai-r-desc" contenteditable="true"></div>' +
        '</div>' +
        '<div class="cai-row" style="grid-template-columns:96px 1fr">' +
          '<div class="field"><div class="label">Level</div><input id="cai-r-level"></div>' +
          '<div class="field"><div class="label">Tags</div><input id="cai-r-tags" placeholder="grammar, A2"></div>' +
        '</div>' +
        '<div class="cai-prev" id="cai-prev"></div>' +
        '<div class="cai-actions">' +
          '<button type="button" class="btn lime" id="cai-add">＋ Add to community feed</button>' +
          '<button type="button" class="btn ghost" id="cai-regen">↻ Regenerate</button>' +
        '</div>' +
      '</div>';
    card.insertBefore(el, card.firstChild);
    wire();
  }

  function wire() {
    var mode = 'topic';
    document.querySelectorAll('.cai-mode').forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.mode;
        document.querySelectorAll('.cai-mode').forEach(function (x) { x.classList.toggle('on', x === b); });
        document.getElementById('cai-topic-fields').style.display = mode === 'topic' ? '' : 'none';
        document.getElementById('cai-source-fields').style.display = mode === 'source' ? '' : 'none';
      });
    });

    // Rich-text toolbar
    document.querySelectorAll('.cai-rt-bar button').forEach(function (b) {
      b.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep selection
      b.addEventListener('click', function () {
        var ed = document.getElementById('cai-r-desc');
        ed.focus();
        if (b.dataset.emoji) { document.execCommand('insertText', false, b.dataset.emoji); return; }
        if (b.dataset.cmd === 'h3') { document.execCommand('formatBlock', false, 'h3'); return; }
        document.execCommand(b.dataset.cmd, false, null);
      });
    });

    document.getElementById('cai-gen').addEventListener('click', function () { run(mode); });
    document.getElementById('cai-regen').addEventListener('click', function () { run(mode); });
    document.getElementById('cai-add').addEventListener('click', addToFeed);
  }

  function setStatus(msg) { document.getElementById('cai-status').textContent = msg || ''; }

  function run(mode) {
    if (!localStorage.getItem('teachedos_token')) { setStatus('Sign in to generate posts.'); return; }
    var btn = document.getElementById('cai-gen');
    var body = { mode: mode, level: (document.getElementById('cai-level') || {}).value || 'B1' };
    if (mode === 'topic') {
      body.topic = (document.getElementById('cai-topic').value || '').trim();
      if (!body.topic) { setStatus('Enter a topic first.'); return; }
    } else {
      body.url = (document.getElementById('cai-url').value || '').trim();
      body.source = (document.getElementById('cai-source').value || '').trim();
      if (!body.url && !body.source) { setStatus('Paste a URL or some source text.'); return; }
    }
    btn.disabled = true; setStatus('✨ Generating with the free AI model… (a few seconds)');
    api('/api/community-ai/post', { method: 'POST', body: body })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d || !res.d.post) throw new Error((res.d && res.d.error) || 'Generation failed');
        current = res.d.post;
        fill(current);
        setStatus('Done · ' + (current.engine || 'AI') + '. Edit if needed, then add to the feed.');
      })
      .catch(function (e) { setStatus('⚠ ' + (e.message || 'Could not generate — try again')); })
      .finally(function () { btn.disabled = false; });
  }

  function fill(post) {
    document.getElementById('cai-out').style.display = 'block';
    document.getElementById('cai-r-title').value = post.title || '';
    document.getElementById('cai-r-level').value = post.level || 'B1';
    document.getElementById('cai-r-tags').value = (post.tags || []).join(', ');
    // seed the rich editor from the plain desc (sanitized)
    document.getElementById('cai-r-desc').innerHTML = ttSanitize(post.descHtml || esc(post.desc || ''));
    renderPreview(post);
  }

  function renderPreview(post) {
    var cards = (post.snapshot && post.snapshot.cards) || [];
    document.getElementById('cai-prev').innerHTML =
      '<div style="font:800 12px var(--font)">📋 ' + esc(post.title || '') + ' · ' + cards.length + ' cards</div>' +
      '<div class="cai-prev-cards">' + cards.map(function (c) {
        return '<div class="cai-prev-card" style="background:' + esc((c.data && c.data.color) || '#f3f3f3') + '">' +
          esc(((c.data && c.data.text) || '').slice(0, 90)) + '</div>';
      }).join('') + '</div>';
  }

  function addToFeed() {
    if (!current) return;
    var descHtml = ttSanitize(document.getElementById('cai-r-desc').innerHTML);
    var tmp = document.createElement('div'); tmp.innerHTML = descHtml;
    var post = {
      id: 'ai-' + Date.now(),
      title: (document.getElementById('cai-r-title').value || current.title || 'Untitled lesson').trim(),
      level: (document.getElementById('cai-r-level').value || current.level || 'B1').trim(),
      desc: (tmp.textContent || '').trim().slice(0, 400),
      descHtml: descHtml,
      tags: (document.getElementById('cai-r-tags').value || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 4),
      author: 'You (AI draft)',
      snapshot: current.snapshot,
    };
    try {
      var posts = (window.readPosts ? window.readPosts() : []);
      posts.unshift(post);
      if (window.writePosts) window.writePosts(posts);
      if (window.renderCommunity) window.renderCommunity();
      setStatus('✅ Added to the community feed below.');
      document.getElementById('cai-out').style.display = 'none';
      current = null;
      var grid = document.getElementById('community-grid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { setStatus('⚠ Could not save: ' + e.message); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
