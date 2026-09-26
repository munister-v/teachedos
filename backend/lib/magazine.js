// Magazine Reading Studio: a real news article → a graded magazine long read
// with its own vocabulary and workout.
//
// One model call does the writing (retell at the level, headline, standfirst,
// pull quotes, the words worth teaching, a discussion prompt). Everything
// that can be checked or computed is done here in code instead: a word the
// model lists must really occur in the text, a pull quote must be a sentence
// of the story, and the gap-fill / matching tasks are built from the text's
// own sentences, so no task can ask about something the reader never saw.

const ai = require('./aiEngine');

const LEVEL_WORDS = { A1: 220, A2: 300, B1: 420, B2: 520, C1: 620, C2: 700 };

const clean = (v, max = 600) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sentencesOf(paragraphs) {
  return paragraphs.flatMap(p => (p.match(/[^.!?]+[.!?]+["”’)]*/g) || [p]).map(s => s.trim()).filter(Boolean));
}

function findIn(text, term) {
  const re = new RegExp(`(^|[^\\p{L}])(${escRe(term).replace(/\s+/g, '\\s+')})(?=[^\\p{L}]|$)`, 'iu');
  return re.test(text);
}

function normalise(raw, { level, source, url, published, topicTitle }) {
  const paragraphs = (Array.isArray(raw.paragraphs) ? raw.paragraphs : String(raw.text || '').split(/\n{2,}/))
    .map(p => clean(p, 1400)).filter(p => p.length > 30).slice(0, 9);
  if (paragraphs.length < 2) throw new Error('The article came back empty');
  const full = paragraphs.join('\n\n');
  const sentences = sentencesOf(paragraphs);

  const seen = new Set();
  const vocab = (Array.isArray(raw.vocab) ? raw.vocab : []).map(v => ({
    term: clean(v.term || v.word, 60),
    pos: clean(v.pos, 20).toLowerCase(),
    ipa: clean(v.ipa, 60).replace(/^\/|\/$/g, ''),
    definition: clean(v.definition || v.meaning, 220),
    kind: clean(v.kind || v.type, 20).toLowerCase(),
  })).filter(v => {
    const k = v.term.toLowerCase();
    if (!v.term || !v.definition || seen.has(k) || !findIn(full, v.term)) return false;
    seen.add(k);
    return true;
  }).slice(0, 12).map(v => {
    // The example is the article's own sentence with the term in it.
    const example = sentences.find(s => findIn(s, v.term)) || '';
    return { ...v, example };
  });
  if (vocab.length < 4) throw new Error('Too few words could be checked against the text');

  // Pull quotes must be real sentences of the story (the model's wording, not the source's).
  const pullQuotes = (Array.isArray(raw.pullQuotes) ? raw.pullQuotes : [])
    .map(q => clean(typeof q === 'string' ? q : q.text, 220).replace(/^["“]|["”]$/g, ''))
    .filter(q => q.length > 20 && full.includes(q.replace(/[.!?]$/, '')))
    .slice(0, 2);

  // Gap-fill: one sentence of the article per word, the word blanked out.
  const fillBlanks = vocab.filter(v => v.example).slice(0, 8).map(v => {
    const re = new RegExp(`(^|[^\\p{L}])(${escRe(v.term).replace(/\s+/g, '\\s+')})(?=[^\\p{L}]|$)`, 'iu');
    const m = v.example.match(re);
    return m ? { sentence: v.example.replace(re, `$1_____`), answer: m[2], term: v.term } : null;
  }).filter(Boolean);

  const words = full.split(/\s+/).length;
  const d = raw.discussion || {};
  return {
    kind: 'magazine',
    headline: clean(raw.headline || raw.title, 140),
    dek: clean(raw.dek || raw.standfirst, 260),
    category: clean(raw.category || topicTitle || 'News', 30),
    imageQuery: clean(raw.imageQuery, 60),
    level,
    readMinutes: Math.max(1, Math.round(words / 170)),
    words,
    paragraphs,
    pullQuotes,
    vocab,
    fillBlanks,
    discussion: {
      statement: clean(d.statement, 220),
      questions: (Array.isArray(d.questions) ? d.questions : []).map(q => clean(q, 220)).filter(Boolean).slice(0, 3),
    },
    source: { name: clean(source, 60), url: clean(url, 400), published: clean(published, 40) },
  };
}

async function buildMagazine({ title, text, source, url, published, level = 'B1', topicTitle = '' }) {
  if (!ai.enabled()) throw new Error('AI is not configured');
  const L = LEVEL_WORDS[level] ? level : 'B1';
  const prompt = [
    `You are the editor of a digital magazine for English learners. Turn this real news article into a magazine long read for ${L} (CEFR) readers.`,
    `Rules for the story:`,
    `- About ${LEVEL_WORDS[L]} words in 4-7 paragraphs. Grammar and vocabulary must fit ${L}; rewrite, do not copy long source sentences.`,
    `- Stay TRUE to the source: the same facts, people, places, numbers and dates. Do not invent facts, quotes or opinions. You may drop minor details.`,
    `- Write it like a good magazine: an engaging first paragraph (a scene, a question or a striking fact), then what happened, why it matters, what comes next.`,
    `- "headline": a strong magazine headline, max 9 words. "dek": a one- or two-sentence standfirst under it.`,
    `- "pullQuotes": 1-2 striking sentences copied EXACTLY from your own paragraphs.`,
    `- "vocab": 8-10 items worth teaching at ${L}: mainly collocations and phrases (e.g. "raise concerns", "a turning point"), some single words, at most two idioms. Each "term" must appear EXACTLY in your paragraphs. Give "pos" (noun, verb, adjective, phrase, idiom…), "ipa" (British, without slashes; for phrases the whole phrase) and "definition" = a short ${L}-level meaning AS USED IN THIS ARTICLE. "kind" is "collocation", "phrase", "idiom" or "word".`,
    `- "discussion": an "Agree or disagree?" "statement" that follows from the story and 2-3 open "questions" for a class discussion.`,
    `- "category": one word like Science, Technology, Health, World, Environment, Culture, Business, Space. "imageQuery": 2-4 plain English words for a stock photo that fits the story (no names of people).`,
    `Source (${clean(source, 60) || 'news'}${published ? `, ${clean(published, 30)}` : ''}): "${clean(title, 200)}"`,
    `"""${String(text || '').slice(0, 12000)}"""`,
    `Return JSON only: {"headline":"","dek":"","category":"","imageQuery":"","paragraphs":["",""],"pullQuotes":[""],"vocab":[{"term":"","pos":"","ipa":"","definition":"","kind":""}],"discussion":{"statement":"","questions":[""]}}`,
  ].join('\n');
  const raw = await ai.rawGenerate(prompt);
  return normalise(raw || {}, { level: L, source, url, published, topicTitle });
}

module.exports = { buildMagazine, normalise, sentencesOf };
