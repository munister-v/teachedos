/* Text from a picture: what the reader (tesseract) gives back is the page as
   characters - arrows, bullets, page numbers, words broken by a line end or by a
   stray space, ten blank lines. A teacher needs the text and its words. This
   turns the raw read into both, and says which words the reader was not sure of
   instead of dropping them (founder's requirement 21.10.2026, OCR addendum §2).

   cleanOcr(raw, readerWords?) -> { text, words, doubtful }
     raw          the reader's text
     readerWords  optional [{ text, confidence }] from the reader: words under
                  CONF_MIN that survive cleaning are returned in `doubtful`
   Pure: runs in the browser (window.TeachedOcrClean) and in Node tests. */
(function (root) {
  'use strict';

  const CONF_MIN = 60;
  // Real short words; any other 1-2 letter lowercase piece is a fragment of its neighbour.
  const SHORT = new Set(('a i an am as at be by do go he if in is it me my no of oh ok on or so to up us we ' +
    'ah eh hi ha ma pa yo id tv uk us eu pm am vs').split(' '));
  // Layout marks the reader turns into characters: arrows, bullets, boxes, ticks, pilcrows.
  const MARKS = /[←-⇿➔-➿■-◿•‣⁃∙·✓-✘¶§★☆☛☞➢►▶⬅-⬇⮕|¦_~^`]/g;

  const letters = s => (String(s).match(/[A-Za-zÀ-ÿ]/g) || []).length;

  function isNoiseLine(line) {
    const t = line.replace(/\u0001/g, '').trim();
    if (!t) return false;                                         // blank lines are paragraph breaks, handled later
    if (/^(?:page\s*)?\d{1,4}(?:\s*(?:\/|of)\s*\d{1,4})?$/i.test(t)) return true;   // page numbers, "12 / 140"
    if (/^(?:www\.|https?:\/\/|©|\(c\)\s)/i.test(t) && t.split(/\s+/).length <= 6) return true;  // footers, watermarks
    const n = letters(t);
    if (n < 2) return true;                                       // a lone mark, a digit, a dash
    if (n / t.replace(/\s/g, '').length < 0.45 && t.length < 40) return true;   // mostly symbols
    return false;
  }

  // "Th e" -> "The", "hous e" -> "house": a piece that is not a word joins its neighbour.
  function mendSplitWords(line) {
    const tok = line.split(/ +/);
    const out = [];
    for (let i = 0; i < tok.length; i++) {
      const t = tok[i];
      const prev = out[out.length - 1];
      const bare = t.replace(/[.,;:!?)"'’]+$/, '');
      if (prev && /^[a-z]{1,2}$/.test(bare) && !SHORT.has(bare) && /[A-Za-z]$/.test(prev)) { out[out.length - 1] = prev + t; continue; }
      out.push(t);
    }
    return out.join(' ');
  }

  function cleanText(raw) {
    let s = String(raw == null ? '' : raw)
      .replace(/\r\n?/g, '\n')
      .replace(/[  -​  　\t]/g, ' ')    // odd spaces
      .replace(/[ﬁ]/g, 'fi').replace(/[ﬂ]/g, 'fl')        // ligatures
      .replace(/[“”„]/g, '"').replace(/[‘’‚]/g, "'")
      // a table row ("| go | went |") is a line of its own, cells separated by a dash
      .replace(/^.*\|.*\|.*$/gm, row => '\u0001' + row.split('|').map(c => c.trim()).filter(Boolean).join(' – '))
      // a line that began with a bullet or an arrow is a list item: it keeps its own line
      .replace(/^[ ]*(?:[\u2022\u25A0-\u25FF\u2190-\u21FF\u2794-\u27BF*\-–]\s*)+(?=[A-Za-zÀ-ÿ0-9])/gm, '\u0001')
      // a bullet or an arrow between items on one line separates them the same way
      .replace(/([A-Za-zÀ-ÿ0-9.,)])[ ]{2,}[\u2022\u25A0-\u25FF\u2190-\u21FF\u2794-\u27BF]+\s*(?=[A-Za-zÀ-ÿ0-9])/g, '$1\n\u0001')
      .replace(MARKS, ' ');
    // a word broken at the line end: "impor-\ntant" -> "important"
    s = s.replace(/([A-Za-z])[-­]\s*\n\s*([a-z])/g, '$1$2');
    const lines = s.split('\n').map(l => l.replace(/ {2,}/g, ' ').trim().replace(/^\u0001\s*/, '\u0001'))
      .map(l => l.replace(/^[-–—*•.>o]\s+(?=\S)/, ''))              // list markers the reader kept
      .filter(l => !isNoiseLine(l))
      .map(mendSplitWords);
    // Lines of one paragraph join; a blank line, a heading or a finished sentence before a
    // capital keeps the break.
    const paras = [];
    let cur = '';
    lines.forEach(l => {
      if (!l) { if (cur) { paras.push(cur); cur = ''; } return; }
      if (l.startsWith('\u0001')) { if (cur) paras.push(cur); paras.push(l); cur = ''; return; }
      if (!cur) { cur = l; return; }
      const next = l;
      const ended = /[.!?:"')\]]$/.test(cur);
      const heading = cur.split(' ').length <= 6 && !/[.,;:!?]$/.test(cur) && /^[A-Z0-9]/.test(next);
      if ((ended && /^[A-Z0-9"'(]/.test(next)) || heading) { paras.push(cur); cur = next; }
      else cur += ' ' + next;
    });
    if (cur) paras.push(cur);
    // list items stay together as lines of one block
    const blocks = [];
    paras.forEach(p => { if (p.startsWith('\u0001') && blocks.length && blocks[blocks.length - 1].startsWith('\u0001')) blocks[blocks.length - 1] += '\n' + p; else blocks.push(p); });
    return blocks.map(p => p.replace(/\u0001/g, '').replace(/ {2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim()).filter(Boolean).join('\n\n');
  }

  function wordList(text) {
    const seen = new Set(), out = [];
    (String(text).match(/[A-Za-zÀ-ÿ]+(?:['’-][A-Za-zÀ-ÿ]+)*/g) || []).forEach(w => {
      if (w.length < 2 && !/^[aI]$/.test(w)) return;
      const k = w.toLowerCase();
      if (w.length < 2 || seen.has(k)) return;
      seen.add(k); out.push(w);
    });
    return out;
  }

  function cleanOcr(raw, readerWords) {
    const text = cleanText(raw);
    const words = wordList(text);
    const present = new Set(words.map(w => w.toLowerCase()));
    const doubtful = [];
    const seen = new Set();
    (Array.isArray(readerWords) ? readerWords : []).forEach(w => {
      const t = String(w && w.text || '').replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, '');
      const k = t.toLowerCase();
      if (!t || seen.has(k) || !(Number(w.confidence) < CONF_MIN) || !present.has(k)) return;
      seen.add(k); doubtful.push(t);
    });
    return { text, words, doubtful };
  }

  const api = { cleanOcr, cleanText, wordList };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TeachedOcrClean = api;
})(typeof window !== 'undefined' ? window : globalThis);
