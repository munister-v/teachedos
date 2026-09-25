// Writing hand-ins: AI pre-check and feedback drafts.
//
// The teacher stays the one who grades. The AI only prepares the review:
// a band per criterion with a reason, which of the lesson's own checklist
// points the text meets, a few concrete corrections quoted from the text,
// and a suggested grade that is plain arithmetic over the bands (a model
// is bad at adding numbers and good at reading, so it only does the reading).

const ai = require('./aiEngine');

/* The four analytic criteria used in Cambridge / IELTS style marking. The
   lesson's success criteria (Writing Studio requirements, rubric cards) are
   checked on top of these as a yes/partly/no checklist. */
const CRITERIA = [
  { key: 'task', name: 'Task achievement', hint: 'answers the prompt, covers every point, right genre, register and length' },
  { key: 'organisation', name: 'Organisation', hint: 'paragraphing, logical order, linking words, cohesion' },
  { key: 'vocabulary', name: 'Vocabulary', hint: 'range and accuracy of words and collocations for the level, spelling' },
  { key: 'grammar', name: 'Grammar', hint: 'range and accuracy of structures for the level, punctuation' },
];

const clampBand = n => Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
const str = (v, max = 600) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

/** Suggested grade 0..100 from bands (0..5) — mean band as a percentage. */
function gradeFromScores(scores) {
  const bands = (Array.isArray(scores) ? scores : []).map(s => Number(s && s.band)).filter(n => Number.isFinite(n));
  if (!bands.length) return null;
  return Math.round((bands.reduce((a, b) => a + b, 0) / bands.length) / 5 * 100);
}

function normaliseCheck(raw, checklist) {
  const byKey = new Map((Array.isArray(raw && raw.scores) ? raw.scores : []).map(s => [String(s.key || s.criterion || '').toLowerCase(), s]));
  const scores = CRITERIA.map(c => {
    const s = byKey.get(c.key) || byKey.get(c.name.toLowerCase()) || {};
    return { key: c.key, name: c.name, band: clampBand(s.band), comment: str(s.comment, 400) };
  });
  const checks = (Array.isArray(raw && raw.checklist) ? raw.checklist : []);
  const list = checklist.map((item, i) => {
    const c = checks[i] || checks.find(x => str(x.item).toLowerCase() === item.toLowerCase()) || {};
    const met = ['yes', 'partly', 'no'].includes(String(c.met).toLowerCase()) ? String(c.met).toLowerCase() : (c.met === true ? 'yes' : c.met === false ? 'no' : 'partly');
    return { item, met, note: str(c.note, 240) };
  });
  const corrections = (Array.isArray(raw && raw.corrections) ? raw.corrections : [])
    .map(c => ({ original: str(c.original, 200), suggestion: str(c.suggestion, 200), why: str(c.why, 200), type: str(c.type, 20).toLowerCase() }))
    .filter(c => c.original && c.suggestion && c.original !== c.suggestion)
    .slice(0, 12);
  return {
    scores,
    checklist: list,
    strengths: (Array.isArray(raw && raw.strengths) ? raw.strengths : []).map(s => str(s, 240)).filter(Boolean).slice(0, 4),
    improvements: (Array.isArray(raw && raw.improvements) ? raw.improvements : []).map(s => str(s, 240)).filter(Boolean).slice(0, 4),
    corrections,
    summary: str(raw && raw.summary, 500),
    suggestedGrade: gradeFromScores(scores),
    checkedAt: new Date().toISOString(),
    model: ai.getLastModel ? ai.getLastModel() : '',
  };
}

async function preCheck(sub) {
  if (!ai.enabled()) throw new Error('AI is not configured');
  const checklist = (Array.isArray(sub.criteria) ? sub.criteria : []).map(c => str(c, 200)).filter(Boolean).slice(0, 12);
  const prompt = [
    `You are an experienced English teacher pre-marking a student's writing for their teacher.`,
    `Level: ${sub.level || 'B1'} (CEFR). Judge against what is expected at THIS level, not native-speaker standard.`,
    sub.genre ? `Genre / register: ${sub.genre}.` : '',
    `Task set by the teacher:\n"""${str(sub.prompt, 1500) || str(sub.title, 200) || 'Free writing'}"""`,
    sub.target_words ? `Target length: about ${sub.target_words} words. The student wrote ${sub.words} words.` : '',
    `Student's text:\n"""${String(sub.text || '').slice(0, 9000)}"""`,
    `Score each criterion with a band 0-5 (5 = fully meets the level, 3 = adequate, 1 = very limited, 0 = not attempted) and one sentence explaining the band, quoting the text where useful:`,
    CRITERIA.map(c => `- ${c.key}: ${c.name} — ${c.hint}`).join('\n'),
    checklist.length ? `Then check these success criteria from the lesson, in this order, each as "yes" / "partly" / "no" with a short note:\n${checklist.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : '',
    `List up to 8 concrete corrections: "original" must be copied exactly from the student's text (a short fragment), "suggestion" is the corrected fragment, "why" a short reason, "type" one of grammar | vocabulary | spelling | punctuation | style. Prefer the errors that matter most for the level.`,
    `Give 2-3 strengths and 2-3 improvements addressed to the teacher, specific to this text, and a two-sentence summary.`,
    `Return JSON only: {"scores":[{"key":"task","band":0,"comment":""}],"checklist":[{"item":"","met":"yes","note":""}],"corrections":[{"original":"","suggestion":"","why":"","type":"grammar"}],"strengths":[""],"improvements":[""],"summary":""}`,
  ].filter(Boolean).join('\n\n');
  const raw = await ai.rawGenerate(prompt);
  return normaliseCheck(raw || {}, checklist);
}

/** A feedback message to the student, written from the review the teacher kept. */
async function draftFeedback(sub, { scores, notes, tone } = {}) {
  if (!ai.enabled()) throw new Error('AI is not configured');
  const check = sub.ai_check || {};
  const useScores = Array.isArray(scores) && scores.length ? scores : (check.scores || []);
  const prompt = [
    `Write feedback from a teacher to a student about their writing. Level ${sub.level || 'B1'}. Use simple, clear English the student can read at this level.`,
    `Tone: ${tone === 'brief' ? 'brief and direct, 60-90 words' : 'warm and encouraging, specific, 110-170 words'}. Address the student as "you". No greeting line with a name, no sign-off.`,
    `Structure: what worked well (2 points, quote their words), what to improve next time (2-3 points, each with a short example of how), one concrete goal for the next draft.`,
    `Task: ${str(sub.prompt, 600) || str(sub.title, 200)}`,
    `Criterion bands the teacher confirmed (0-5): ${useScores.map(s => `${s.name || s.key}: ${s.band}${s.comment ? ` (${str(s.comment, 160)})` : ''}`).join('; ')}`,
    check.corrections && check.corrections.length ? `Key corrections: ${check.corrections.slice(0, 5).map(c => `"${c.original}" → "${c.suggestion}"`).join('; ')}` : '',
    notes ? `The teacher's own notes — follow them, they override everything else:\n${str(notes, 1200)}` : '',
    `Student's text:\n"""${String(sub.text || '').slice(0, 6000)}"""`,
    `Return JSON only: {"feedback":"..."}`,
  ].filter(Boolean).join('\n\n');
  const raw = await ai.rawGenerate(prompt);
  return String((raw && raw.feedback) || '').trim();
}

module.exports = { CRITERIA, preCheck, draftFeedback, gradeFromScores, normaliseCheck };
