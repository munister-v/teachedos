/* Meet Ukraine studio extras (TZ §5.8, §5.9, v20): every studio page gets
   - "Words for homework": a signed-in student saves the scene's words to their
     Word Bank (/api/journal/vocab), where spaced repetition lives; a teacher or a
     guest gets the list copied (UA — EN) to paste into a homework;
   - "Share scene": the scene as a 1650x930 PNG with the series caption, through
     Web Share or a download;
   - the v20 hand-inked wobble on the tappable objects.
   Reads the page's global DATA (word data) and NAV (series position). */
(function () {
  'use strict';
  var words = typeof DATA === 'object' && DATA ? Object.keys(DATA).map(function (k) { return DATA[k]; }) : [];
  var svg = document.querySelector('.stage svg');
  var tb = document.querySelector('.toolbar');
  var slug = (location.pathname.split('/').pop() || '').replace(/\.html$/, '') || 'scene';
  var title = ((document.querySelector('h1') || {}).textContent || slug).split('·')[0].trim();
  var host = location.hostname;
  var API = window.TEACHED_API_BASE || (host === 'localhost' || host === '127.0.0.1' ? 'http://localhost:4000'
    : host === 'teached.tech' || /\.teached\.tech$/.test(host) ? location.origin : 'https://teached.tech');
  var token = null;
  try { token = localStorage.getItem('teachedos_token'); } catch (e) {}

  function toast(m) {
    var t = document.getElementById('ambtoast');
    if (!t) { t = document.createElement('div'); t.id = 'ambtoast'; document.body.appendChild(t); }
    t.textContent = m; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3600);
  }
  function api(path, opt) {
    opt = opt || {};
    return fetch(API + path, {
      method: opt.method || 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: opt.body ? JSON.stringify(opt.body) : undefined
    });
  }
  function copy(text, done) {
    var fallback = function () {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove(); done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  function copyList() {
    copy(words.map(function (w) { return w.ua + ' — ' + w.en; }).join('\n'), function () {
      toast('📚 ' + words.length + ' words copied! Paste them into your student’s homework 💛');
    });
  }

  var busy = false;
  function homework() {
    if (!words.length || busy) return;
    if (!token) return copyList();
    busy = true;
    api('/api/auth/me').then(function (r) { return r.ok ? r.json() : null; }).then(function (me) {
      if (!me || !me.user || me.user.role !== 'student') { busy = false; return copyList(); }
      toast('📚 Saving ' + words.length + ' words…');
      return Promise.all(words.map(function (w) {
        return api('/api/journal/vocab', { method: 'POST', body: { word: w.ua, translation: w.en, example: w.tr || '' } })
          .then(function (r) { return r.ok; }, function () { return false; });
      })).then(function (res) {
        busy = false;
        var ok = res.filter(Boolean).length;
        if (ok) toast('📚 ' + ok + ' words are in your Word Bank — TeachEd repeats them with spaced repetition 💛');
        else copyList();
      });
    }).catch(function () { busy = false; copyList(); });
  }

  function share() {
    if (!svg) return;
    toast('📸 Making a picture of the scene…');
    var clone = svg.cloneNode(true);
    clone.setAttribute('width', '1650'); clone.setAttribute('height', '930');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Page CSS does not travel with the picture, so each element takes its computed look
    // (night, labels, glows as they are on screen); hidden parts and hint marks are left out.
    var src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*'), gone = [];
    for (var i = 0; i < src.length; i++) {
      var cs = getComputedStyle(src[i]);
      if (cs.display === 'none' || cs.visibility === 'hidden' || src[i].matches('.dot, .ring, .halo, .v8heart')) { gone.push(dst[i]); continue; }
      ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'paint-order']
        .forEach(function (k) { dst[i].style.setProperty(k, cs.getPropertyValue(k)); });
    }
    gone.forEach(function (e) { e.remove(); });
    var url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
    var img = new Image();
    img.onerror = function () { URL.revokeObjectURL(url); toast('Hmm, the picture did not work here — a screenshot works too 📸'); };
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = 1650; cv.height = 930;
      var cx = cv.getContext('2d'); cx.fillStyle = '#fff8ec'; cx.fillRect(0, 0, 1650, 930); cx.drawImage(img, 0, 0, 1650, 930);
      URL.revokeObjectURL(url);
      cv.toBlob(function (blob) {
        if (!blob) return img.onerror();
        var file = new File([blob], 'meet-ukraine-' + slug + '.png', { type: 'image/png' });
        var text = '🇺🇦 Meet Ukraine — ' + title + ' · ' + words.length + ' Ukrainian words to tap, hear and learn · a Picture Studio series by TeachEd 💛💙';
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], text: text }).then(function () { toast('📤 Shared!'); }, function () {});
          return;
        }
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        copy(text, function () { toast('🖼️ Picture saved! The caption is copied — paste it with the picture 💛'); });
      }, 'image/png');
    };
    img.src = url;
  }

  if (tb) {
    var bHw = document.createElement('button'); bHw.className = 'b-hw'; bHw.textContent = '📚 Words for homework';
    bHw.addEventListener('click', homework);
    var bSh = document.createElement('button'); bSh.className = 'b-share'; bSh.textContent = '📤 Share scene';
    bSh.addEventListener('click', share);
    tb.appendChild(bHw); tb.appendChild(bSh);
  }

  // v20 illustration audit: extra hand-inked wobble on the tappable objects.
  if (svg) {
    var NS = 'http://www.w3.org/2000/svg', defs = svg.querySelector('defs'), ids = [];
    if (defs) {
      [[2.6, 11], [3.2, 23], [2.8, 37]].forEach(function (sp, i) {
        var id = 'sketch-' + i, f = document.createElementNS(NS, 'filter');
        f.setAttribute('id', id); f.setAttribute('x', '-20%'); f.setAttribute('y', '-20%'); f.setAttribute('width', '140%'); f.setAttribute('height', '140%');
        var t = document.createElementNS(NS, 'feTurbulence');
        t.setAttribute('type', 'fractalNoise'); t.setAttribute('baseFrequency', '0.02 0.028'); t.setAttribute('numOctaves', '2'); t.setAttribute('seed', String(sp[1])); t.setAttribute('result', 'n');
        var d = document.createElementNS(NS, 'feDisplacementMap');
        d.setAttribute('in', 'SourceGraphic'); d.setAttribute('in2', 'n'); d.setAttribute('scale', String(sp[0]));
        f.appendChild(t); f.appendChild(d); defs.appendChild(f); ids.push(id);
      });
      Array.prototype.forEach.call(svg.querySelectorAll('.hotspot'), function (g, i) {
        if (!g.getAttribute('filter')) g.setAttribute('filter', 'url(#' + ids[i % 3] + ')');
      });
    }
  }
})();
