/* American or British English - one choice for every studio.

   The user's students want "American life", while the drawings and the
   dictionary were British-first: Picture Studio spoke en-GB and showed
   "fridge" with "US: refrigerator" as a footnote, and the word popups played
   the UK recording. This keeps a single preference (default: American) that
   the studios read when they choose a word variant, a voice or a recording.

   TeachedAccent.get()            'us' | 'uk'
   TeachedAccent.set(a)           saves it and fires 'teached-accent' on window
   TeachedAccent.lang()           'en-US' | 'en-GB'
   TeachedAccent.speak(text)      browser voice in that accent
   TeachedAccent.play(entry)      dictionary recording in that accent
                                  (entry.audioUS / audioUK / audio), else speak
   TeachedAccent.pick(uk, us)     the word to show: us variant in US mode
   TeachedAccent.ipa(entry)       ipaUS / ipaUK / ipa, in that order of need
   TeachedAccent.toggleHtml(cls)  a 🇺🇸 / 🇬🇧 segmented switch; clicks on
                                  [data-accent] anywhere are handled here */
(function () {
  'use strict';
  if (window.TeachedAccent) return;

  const KEY = 'teached_accent';
  const read = () => { try { return localStorage.getItem(KEY) === 'uk' ? 'uk' : 'us'; } catch (e) { return 'us'; } };
  let cur = read();
  let voices = [];
  let audio = null;

  const US_NAMES = /Samantha|Саманта|Alex|Allison|Ava|Aaron|Nicky|Google US English|Microsoft (Aria|Jenny|Guy|Zira|David)/i;
  const UK_NAMES = /Daniel|Даніель|Даниэль|Serena|Kate|Arthur|Martha|Google UK English|Microsoft (Libby|Ryan|Sonia|George|Hazel)/i;

  function loadVoices() { try { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (e) { voices = []; } }
  if (window.speechSynthesis) { loadVoices(); try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) {} }

  /* Voice names are localized ("Саманта", "Даніель" on a Ukrainian Mac) and
     some browsers report voiceURI as that same name, so the good voices are
     listed in both spellings. Next best are Apple's plain voices (Reed, Flo,
     Sandy, Shelley, Eddy); the novelty ones (Bubbles, Zarvox, whispering...)
     come in every language and are only a last resort. */
  const PLAIN = /^(Reed|Flo|Sandy|Shelley|Eddy)\b/i;
  function voice(a) {
    if (!voices.length) loadVoices();
    const tag = a === 'uk' ? /en[-_]GB/i : /en[-_]US/i;
    const names = a === 'uk' ? UK_NAMES : US_NAMES;
    const id = v => `${v.name} ${v.voiceURI || ''}`;
    const pool = voices.filter(v => tag.test(v.lang));
    return pool.find(v => names.test(id(v))) || pool.find(v => PLAIN.test(v.name)) || pool[0] || null;
  }

  function speak(text, opts) {
    if (!window.speechSynthesis || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      const v = voice(cur);
      if (v) u.voice = v;
      u.lang = cur === 'uk' ? 'en-GB' : 'en-US';
      u.rate = (opts && opts.rate) || 0.92;
      if (opts && opts.onend) { u.onend = opts.onend; u.onerror = opts.onend; }
      speechSynthesis.speak(u);
    } catch (e) { opts && opts.onend && opts.onend(); }
  }

  function play(entry, text, onend) {
    const e = entry || {};
    const src = cur === 'uk' ? (e.audioUK || e.audio) : (e.audioUS || (e.audioUK ? null : e.audio));
    if (audio) { try { audio.pause(); } catch (x) {} audio = null; }
    if (src) {
      audio = new Audio(src);
      if (onend) { audio.addEventListener('ended', onend); audio.addEventListener('error', onend); }
      audio.play().catch(() => speak(text || e.word, { onend }));
      return;
    }
    speak(text || e.word, { onend });
  }

  const ipa = e => (e ? (cur === 'uk' ? (e.ipaUK || e.ipa) : (e.ipaUS || null)) : null);
  const pick = (uk, us) => (cur === 'us' && us ? us : uk);

  function set(a) {
    const next = a === 'uk' ? 'uk' : 'us';
    if (next === cur) return;
    cur = next;
    try { localStorage.setItem(KEY, cur); } catch (e) {}
    document.querySelectorAll('[data-accent]').forEach(b => b.classList.toggle('on', b.dataset.accent === cur));
    try { window.dispatchEvent(new CustomEvent('teached-accent', { detail: cur })); } catch (e) {}
  }

  function toggleHtml(cls) {
    return `<span class="${cls || ''} ta-seg" role="group" aria-label="Accent">`
      + `<button type="button" data-accent="us" class="${cur === 'us' ? 'on' : ''}" title="American English">🇺🇸 US</button>`
      + `<button type="button" data-accent="uk" class="${cur === 'uk' ? 'on' : ''}" title="British English">🇬🇧 UK</button></span>`;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-accent]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    set(b.dataset.accent);
  }, true);

  if (!document.getElementById('ta-css')) {
    const st = document.createElement('style');
    st.id = 'ta-css';
    st.textContent = `.ta-seg{display:inline-flex;background:#F2F1EB;border-radius:10px;padding:3px;gap:2px;vertical-align:middle}
.ta-seg button{border:0;background:transparent;border-radius:8px;padding:6px 9px;font:650 11.5px/1 inherit;font-family:inherit;color:#5D614B;cursor:pointer;white-space:nowrap}
.ta-seg button.on{background:#fff;color:#24282C;box-shadow:0 1px 3px rgba(36,40,44,.12)}`;
    (document.head || document.documentElement).appendChild(st);
  }

  window.TeachedAccent = { get: () => cur, set, lang: () => (cur === 'uk' ? 'en-GB' : 'en-US'), speak, play, pick, ipa, toggleHtml, voice: () => voice(cur) };
})();
