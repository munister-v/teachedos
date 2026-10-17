/* Book Page Importer (Lesson Builder 2.0 E18): a coursebook page, once its text is read,
   becomes a map of parts - a reading text, a vocabulary box, a grammar box, exercises -
   and each part knows which studio it belongs to.

   The model only decides where the parts begin and what kind they are. The words stay the
   book's: a part whose text cannot be found on the page is dropped, never trusted, so the
   map can't smuggle in invented material. When there is no model (or it answers badly) a
   plain reading of the page's own headings and numbering gives a usable map instead. */
const KINDS = {
  reading:    { studio: 'reading',   label: 'Reading text' },
  vocabulary: { studio: 'vocab',     label: 'Vocabulary' },
  grammar:    { studio: 'grammar',   label: 'Grammar' },
  exercise:   { studio: 'practice',  label: 'Exercise' },
  listening:  { studio: 'listening', label: 'Listening' },
  speaking:   { studio: 'speaking',  label: 'Speaking' },
  writing:    { studio: 'writing',   label: 'Writing' },
};
const MAX_PARTS = 12;

const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/* Share of a part's words that occur on the page, in order-free terms: enough to catch a
   made-up part, loose enough to survive the reader's small slips in the OCR. */
function groundedShare(partText, pageText) {
  const words = norm(partText).split(' ').filter(w => w.length > 2);
  if (!words.length) return 0;
  const pool = new Set(norm(pageText).split(' '));
  return words.filter(w => pool.has(w)).length / words.length;
}

function makePart(i, kind, title, text) {
  const k = KINDS[kind] ? kind : 'exercise';
  return {
    id: `p${i + 1}`,
    kind: k,
    studio: KINDS[k].studio,
    title: String(title || KINDS[k].label).replace(/\s+/g, ' ').trim().slice(0, 80) || KINDS[k].label,
    text: String(text || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000),
  };
}

function normalizeMap(raw, pageText) {
  const list = Array.isArray(raw && raw.parts) ? raw.parts : [];
  const parts = [];
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const text = String(p.text || '').trim();
    if (text.length < 12) continue;
    if (groundedShare(text, pageText) < 0.8) continue;
    parts.push(makePart(parts.length, String(p.kind || '').toLowerCase(), p.title, text));
    if (parts.length >= MAX_PARTS) break;
  }
  return { title: String((raw && raw.title) || '').slice(0, 100), parts };
}

const HEAD_KIND = [
  [/^(vocab|word\s*(list|bank|box)|key words|new words)/i, 'vocabulary'],
  [/^(grammar|language focus|look!|remember|rule)/i, 'grammar'],
  [/^(listen|audio|track\s*\d)/i, 'listening'],
  [/^(speak|discuss|talk|role[\s-]?play|work in pairs)/i, 'speaking'],
  [/^(writ|compose|email|essay)/i, 'writing'],
  [/^(read|text|article|story)/i, 'reading'],
];

/* No model: split on headings ("Vocabulary", "Grammar", "Listening 2") and on numbered
   exercises ("3 ", "3. ", "Exercise 3"); a long run of prose with no heading is the reading. */
function heuristicMap(pageText) {
  const lines = String(pageText || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let cur = null;
  const isHead = l => {
    const t = l.trim();
    if (!t || t.length > 60) return null;
    if (/^(?:exercise\s+)?\d{1,2}[.)]?\s+\S/i.test(t) && t.length <= 60 && !/[.!?]$/.test(t)) return { kind: 'exercise', title: t };
    for (const [re, kind] of HEAD_KIND) if (re.test(t)) return { kind, title: t };
    return null;
  };
  for (const line of lines) {
    const h = isHead(line);
    if (h) { cur = { ...h, body: [] }; blocks.push(cur); continue; }
    if (!cur) { cur = { kind: null, title: '', body: [] }; blocks.push(cur); }
    cur.body.push(line);
  }
  const parts = [];
  for (const b of blocks) {
    const text = b.body.join('\n').trim();
    if (text.length < 12 && !b.title) continue;
    const prose = text.split(/\s+/).length >= 60;
    const kind = b.kind || (prose ? 'reading' : 'exercise');
    parts.push(makePart(parts.length, kind, b.title, text || b.title));
    if (parts.length >= MAX_PARTS) break;
  }
  return { title: '', parts };
}

function buildPrompt(pageText, level) {
  return `You split one coursebook page into its parts for an ESL teacher. Return ONLY JSON: {"title":"...","parts":[{"kind":"reading|vocabulary|grammar|exercise|listening|speaking|writing","title":"...","text":"..."}]}
Rules: copy each part's text from the page word for word - never rewrite, translate, shorten or add anything. Keep a vocabulary box, a grammar box and a reading text each as one part. Each numbered exercise is its own part. Skip page numbers, headers and footers. At most ${MAX_PARTS} parts, in page order. Learner level: ${level}.

Page:
${pageText}`;
}

module.exports = { KINDS, MAX_PARTS, groundedShare, normalizeMap, heuristicMap, buildPrompt };
