/* TeachEd memory from checked work (ТЗ «Память TeachEd» §8.2 and §5, 18.10.2026).

   When the teacher returns a piece of writing, the corrections they kept (never the
   automatic check alone) feed the student's dossier:
   - common_mistakes: one pattern per topic ("Past simple"), count = the number of
     different pieces of work it appeared in, the latest examples;
   - weak_spot_tags: "grammar:past_simple" with its source (the submission), for
     Prepare, generation and Analytics. A tag the teacher removed (deleted_tag_keys)
     never comes back, from the same work or any other device.

   The topic is read from the correction's own words by plain rules below, so a
   teacher can see why a tag exists. A grammar correction no rule recognises gets no
   tag - a wrong tag is worse than a missing one. The teacher's free text
   (weak_spots) is never touched. */
const { mergeTags } = require('../routes/memory')._test;

const AREA = { grammar: 'grammar', vocabulary: 'vocab', spelling: 'spelling', punctuation: 'punctuation', style: 'style' };
// [topic key, label, test]; the first match wins, so the specific ones go first
const TOPICS = [
  ['present_perfect', 'Present perfect', /present perfect/],
  ['past_perfect', 'Past perfect', /past perfect/],
  ['past_continuous', 'Past continuous', /past continuous|past progressive/],
  ['past_simple', 'Past simple', /past simple|simple past|irregular (verb|past)|past tense|past form/],
  ['present_continuous', 'Present continuous', /present continuous|present progressive/],
  ['subject_verb_agreement', 'Subject-verb agreement', /third person|3rd person|he\/she\/it|subject[- ]verb agreement|verb agreement/],
  ['future_forms', 'Future forms', /future|going to|will vs|will \//],
  ['conditionals', 'Conditionals', /conditional/],
  ['passive', 'Passive voice', /passive/],
  ['modals', 'Modal verbs', /modal/],
  ['gerund_infinitive', 'Gerund or infinitive', /gerund|infinitive|-ing form/],
  ['articles', 'Articles', /\barticles?\b|definite|indefinite|\b(a|an|the)\b (is needed|before|is missing)/],
  ['prepositions', 'Prepositions', /preposition/],
  ['word_order', 'Word order', /word order/],
  ['plurals', 'Plurals', /plural/],
  ['countable', 'Countable and uncountable', /uncountable|countable/],
  ['comparatives', 'Comparatives and superlatives', /comparative|superlative/],
  ['relative_clauses', 'Relative clauses', /relative (clause|pronoun)/],
  ['pronouns', 'Pronouns', /pronoun/],
  ['collocations', 'Collocations', /collocation/, 'vocab'],
  ['word_form', 'Word form', /word form|adjective form|adverb form|noun form/, 'vocab'],
];
const DEFAULTS = { vocabulary: ['word_choice', 'Word choice'], spelling: ['general', 'Spelling'], punctuation: ['general', 'Punctuation'], style: ['register', 'Style and register'] };

function classify(c) {
  const type = AREA[c.type] ? c.type : 'grammar';
  const text = `${c.why || ''} ${c.type || ''}`.toLowerCase();
  for (const [key, label, re, area] of TOPICS) if (re.test(text)) return { tag: `${area || AREA[type]}:${key}`, label };
  if (DEFAULTS[type]) { const [key, label] = DEFAULTS[type]; return { tag: `${AREA[type]}:${key}`, label }; }
  return null;
}

/* What one returned piece of work adds: patterns and tags, both keyed by its id. */
function fromCorrections(corrections, sourceId, at = new Date()) {
  const byTag = new Map();
  for (const c of corrections || []) {
    const k = classify(c);
    if (!k) continue;
    const was = byTag.get(k.tag) || { tag: k.tag, label: k.label, examples: [] };
    if (c.original && c.suggestion) was.examples.push(`${c.original} → ${c.suggestion}`);
    byTag.set(k.tag, was);
  }
  const when = at.toISOString();
  return {
    patterns: [...byTag.values()].map(t => ({ pattern: t.label, tag: t.tag, examples: t.examples.slice(0, 5), first_seen: when, last_seen: when, count: 1, source_ids: [String(sourceId)] })),
    tags: [...byTag.values()].map(t => ({ tag: t.tag, source: 'writing', source_id: String(sourceId), created_at: when })),
  };
}

/* one piece of work counts once per pattern, however often it is returned */
function addPatterns(existing, fresh, max = 200) {
  const out = (existing || []).map(m => ({ ...m }));
  for (const p of fresh) {
    const m = out.find(x => String(x.pattern).toLowerCase() === p.pattern.toLowerCase());
    if (!m) { out.push(p); continue; }
    const src = new Set(m.source_ids || []);
    const fresher = !src.has(p.source_ids[0]);
    p.source_ids.forEach(id => src.add(id));
    m.source_ids = [...src].slice(-50);
    if (fresher) m.count = (Number(m.count) || 0) + 1;
    m.tag = m.tag || p.tag;
    m.first_seen = m.first_seen && m.first_seen < p.first_seen ? m.first_seen : p.first_seen;
    m.last_seen = !m.last_seen || m.last_seen < p.last_seen ? p.last_seen : m.last_seen;
    m.examples = [...new Set([...p.examples, ...(m.examples || [])])].slice(0, 5);
  }
  // the most recent patterns stay when there are too many
  return out.sort((a, b) => String(b.last_seen || '').localeCompare(String(a.last_seen || ''))).slice(0, max);
}

/* Writes into the teacher's dossiers of this student (one per journal row of theirs
   that is linked to the student's account). No journal row = no dossier = nothing. */
async function recordReturnedWork(db, { teacherId, studentUserId, sourceId, corrections }) {
  const { patterns, tags } = fromCorrections(corrections, sourceId);
  if (!patterns.length) return 0;
  const { rows: journals } = await db.query('SELECT id FROM student_journal WHERE teacher_id = $1 AND student_id = $2', [teacherId, studentUserId]);
  for (const j of journals) {
    await db.query('INSERT INTO student_dossier (journal_id, teacher_id) VALUES ($1, $2) ON CONFLICT (journal_id) DO NOTHING', [j.id, teacherId]);
    await db.query('DELETE FROM memory_revocations WHERE teacher_id = $1 AND journal_id = $2', [teacherId, j.id]);
    const { rows: [d] } = await db.query(
      'SELECT common_mistakes, weak_spot_tags, deleted_tag_keys FROM student_dossier WHERE journal_id = $1 AND teacher_id = $2 AND archived_at IS NULL', [j.id, teacherId]);
    if (!d) continue;
    const nextTags = mergeTags(d.weak_spot_tags, tags, d.deleted_tag_keys).slice(-300);
    await db.query(
      `UPDATE student_dossier SET common_mistakes = $2, weak_spot_tags = $3, mistakes_updated_at = NOW(), tags_updated_at = NOW(),
              version = version + 1, updated_at = NOW() WHERE journal_id = $1`,
      [j.id, JSON.stringify(addPatterns(d.common_mistakes, patterns)), JSON.stringify(nextTags)]);
  }
  return journals.length;
}

module.exports = { classify, fromCorrections, addPatterns, recordReturnedWork };
