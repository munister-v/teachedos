/* The Grammar checks (ТЗ §3.6 and its acceptance: T-G1 accuracy, T-G2 one coherent topic,
   T-G3 the rule card is there, T-G4 an answer key everywhere).

   First rules, then - if the rules found nothing - a second pass of the model over a
   checklist for the kind of material. Both speak plain teacher language; the model's own
   issues are filtered through the glossary so no platform term reaches the teacher. */
const { analyse, targetFor, FORMS, JARGON, sentences } = require('./forms');
const { isClean } = require('../glossary');
const descriptors = require('../descriptorBank');

const MIN_INSTANCES = 4;           // the prompt asks for six; detectors undercount, so four is the floor
const DRILL_TOOLS = new Set(['gap', 'gaps-abcd', 'gaps-brackets', 'two-options', 'error-correction', 'rewrite', 'word-order', 'tense-contrast']);

const squash = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const reason = (rule, say) => ({ rule, say });

function kindOf(input, out) {
  if (!input || input.lesson !== 'grammar') return null;
  if (input.parts && input.parts.form === true && out && Array.isArray(out.cards)) return 'story';
  const t = input.toolId;
  if (t === 'grammar-rules') return 'rules';
  if (t === 'abcd-text') return 'ccq';
  if (t === 'open-questions') return 'discovery';
  if (t === 'matching-halves') return 'halves';
  if (DRILL_TOOLS.has(t)) return 'drill';
  return null;
}
/* Does this request go through the contour at all? (story is only known from the input) */
const applies = input => !!input && input.lesson === 'grammar'
  && (input.parts && input.parts.form === true || input.toolId === 'grammar-rules' || input.toolId === 'abcd-text'
    || input.toolId === 'open-questions' || input.toolId === 'matching-halves' || DRILL_TOOLS.has(input.toolId));

const storyText = out => {
  const c = (out.cards || []).find(x => /reading|model|story|dialogue|text/i.test(x.title || '')) || (out.cards || [])[0];
  return c ? String(c.text || '') : '';
};

/* an answer key everywhere (T-G4) */
function answerRules(out) {
  const r = [];
  (out.questions || []).forEach((q, i) => {
    const n = i + 1;
    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length < 2) r.push(reason('key.options', `Question ${n} has no choices to pick from.`));
      else if (!q.options.map(squash).includes(squash(q.answer))) r.push(reason('key.answer', `Question ${n} has no marked answer among its choices.`));
    } else if ((q.type === 'gap-fill' || q.type === 'truefalse') && (q.answer === undefined || q.answer === null || squash(q.answer) === '')) {
      r.push(reason('key.answer', `Question ${n} has no answer in the key.`));
    }
  });
  return r.slice(0, 3);
}

function ruleCheck(input, out) {
  const kind = kindOf(input, out);
  const target = targetFor(input.topic);
  const reasons = [];
  if (kind === 'story') {
    const text = storyText(out);
    if (/\*\*/.test(text)) reasons.push(reason('story.marked', 'The text has the target forms highlighted, which gives away what students are supposed to find themselves.'));
    const a = target ? analyse(text, target) : null;
    if (a) {
      a.traps.slice(0, 3).forEach(t => reasons.push(reason('story.trap.' + t.id, t.say)));
      if (a.instances < MIN_INSTANCES) reasons.push(reason('story.instances', `The text uses ${a.form} only ${a.instances} time${a.instances === 1 ? '' : 's'}; students need to meet it again and again to notice it.`));
    }
  } else if (kind === 'rules') {
    const titles = (out.cards || []).map(c => String(c.title || '').toLowerCase());
    [['formula', 'a formula'], ['meaning', 'when to use it'], ['example', 'examples'], ['mistake', 'common mistakes']].forEach(([k, label]) => {
      if (!titles.some(t => t.includes(k))) reasons.push(reason('rules.part.' + k, `The rule card is missing ${label}.`));
    });
    if (target) {
      const ex = (out.cards || []).find(c => /example/i.test(c.title || ''));
      const a = ex ? analyse(ex.text, target) : null;
      if (a) a.traps.slice(0, 2).forEach(t => reasons.push(reason('rules.example.' + t.id, `In the examples: ${t.say}`)));
      const mist = (out.cards || []).find(c => /mistake/i.test(c.title || ''));
      if (mist) for (const line of String(mist.text || '').split('\n')) {
        const m = line.match(/→\s*(?:✅)?\s*(.+)$/);                // the corrected half must itself be right
        const b = m && analyse(m[1], target);
        if (b && b.traps.length) { reasons.push(reason('rules.mistake-right', `In common mistakes, the “right” version is itself wrong: ${b.traps[0].say}`)); break; }
      }
    }
  } else if (kind === 'ccq') {
    (out.questions || []).forEach((q, i) => {
      const t = [q.text, ...(q.options || [])].map(squash).join(' | ');
      if (JARGON.test(t)) reasons.push(reason('ccq.terms', `Question ${i + 1} uses grammar terms; a concept check should be in everyday words.`));
      const f = target && FORMS[target];
      if (f && (q.options || []).some(o => f.find(String(o)))) reasons.push(reason('ccq.target-in-option', `Question ${i + 1} puts the target form itself in a choice, which gives the answer away.`));
    });
  } else if (kind === 'discovery') {
    (out.questions || []).forEach((q, i) => {
      if (JARGON.test(String(q.text || ''))) reasons.push(reason('discovery.terms', `Question ${i + 1} names the grammar before students have worked it out.`));
    });
  } else if (kind === 'halves') {
    const pairs = ((out.questions || [])[0] || {}).pairs || [];
    if (pairs.length < 3) reasons.push(reason('halves.count', 'There are too few sentence halves to make a matching task.'));
    const rights = pairs.map(p => squash(p.right).toLowerCase());
    if (new Set(rights).size < rights.length) reasons.push(reason('halves.same-ending', 'Two beginnings share the same ending, so the pairs cannot be told apart.'));
    if (target) for (const p of pairs) {
      const a = analyse(`${p.left} ${p.right}`, target);
      if (a && a.traps.length) { reasons.push(reason('halves.trap', a.traps[0].say)); break; }
    }
  } else if (kind === 'drill') {
    if (target) for (const q of out.questions || []) {
      const a = analyse(String(q.answer || ''), target);
      if (a && a.traps.length && /error|rewrite|order/i.test(input.toolId)) { reasons.push(reason('drill.key-trap', `The answer key itself has a mistake: ${a.traps[0].say}`)); break; }
    }
  }
  if (kind && kind !== 'story' && kind !== 'rules') reasons.push(...answerRules(out));
  return reasons.slice(0, 6);
}

/* ── the second pass: the model reads its own work against a checklist ─────────────── */
const CHECKLIST = {
  story: [
    'Is every sentence correct, natural English?',
    'Does any sentence use the target grammar wrongly, or teach a wrong rule about it?',
    'Is the target grammar the natural choice for what the text says, used again and again?',
    'Is the other language simple enough that attention goes to the grammar?',
  ],
  rules: [
    'Is the formula correct, including the negative and the question?',
    'Are all the examples correct English that really use the target grammar?',
    'In "Common mistakes", is every "wrong" really wrong and every "right" really right?',
    'Does the "Not for" line name a genuine confusion?',
  ],
  ccq: [
    'Is each question built on a correct sentence?',
    'Is the marked answer really the right one about the MEANING?',
    'Could a student answer without understanding the grammar (does a choice give it away)?',
  ],
  discovery: [
    'Does each question let students notice the form for themselves without stating the rule?',
    'Are the questions answerable from the text?',
  ],
  halves: [
    'For each beginning, is exactly ONE ending grammatically possible? List any beginning that fits two endings.',
    'Is every joined sentence correct English?',
  ],
  drill: [
    'Is every key answer correct, and the only correct one for its sentence?',
    'Does each item practise the target grammar, not something else?',
    'Are all the sentences correct English apart from the deliberate mistakes?',
  ],
};

function material(kind, out) {
  if (kind === 'story' || kind === 'rules') return (out.cards || []).map(c => `## ${c.title}\n${c.text}`).join('\n\n');
  return JSON.stringify((out.questions || []).map(q => ({ text: q.text, options: q.options, answer: q.answer, pairs: q.pairs })), null, 0).slice(0, 6000);
}

function judgePrompt(kind, input, out) {
  const brief = descriptors.brief(input.level, 'grammar');
  return `You check teaching material for an English teacher. Be strict and concrete.
Target grammar: "${input.topic}". Learner level: ${input.level}. ${brief}
Material (${kind}):
${material(kind, out).slice(0, 7000)}

Answer each question yourself before deciding:
${CHECKLIST[kind].map((q, i) => `${i + 1}. ${q}`).join('\n')}

Return ONLY JSON: {"ok":true|false,"issues":["one short plain sentence per real problem, quoting the words involved"]}
"ok" is false only for a real problem: a wrong sentence, a wrong rule, a wrong key, an ambiguous pair. Style preferences are not problems. Write issues for a teacher: everyday words, no jargon about the checking itself.`;
}

/* judge(prompt) -> parsed JSON; may throw. Returns { reasons, unverified } */
async function judgeCheck(kind, input, out, judge) {
  try {
    const verdict = await judge(judgePrompt(kind, input, out));
    if (!verdict || typeof verdict.ok !== 'boolean') return { reasons: [], unverified: true };
    if (verdict.ok) return { reasons: [], unverified: false };
    const issues = (Array.isArray(verdict.issues) ? verdict.issues : []).map(squash).filter(Boolean).slice(0, 3);
    return { reasons: (issues.length ? issues : ['The second reading found a problem in this material.'])
      .map(s => reason('judge', isClean(s, { visible: true }) ? s.slice(0, 220) : 'The second reading found a problem in this material.')), unverified: false };
  } catch (err) {
    return { reasons: [], unverified: true };
  }
}

async function checkGrammar({ input, out, judge }) {
  const kind = kindOf(input, out);
  if (!kind) return { ok: true, reasons: [], unverified: false, kind: null };
  const reasons = ruleCheck(input, out);
  if (reasons.length) return { ok: false, reasons, unverified: false, kind };
  if (!judge) return { ok: true, reasons: [], unverified: false, rulesOnly: true, kind };   // switched off on purpose, and logged as such
  const j = await judgeCheck(kind, input, out, judge);
  return { ok: j.reasons.length === 0, reasons: j.reasons, unverified: j.unverified, kind };
}

module.exports = { applies, kindOf, ruleCheck, checkGrammar, judgePrompt, MIN_INSTANCES };
