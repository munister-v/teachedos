/* The Vocabulary checks (ТЗ §3.1, requirement T-V1: "a meaning is one part of speech" -
   no mixing the noun "book" with the verb "to book", no generic meaning with a thematic
   example "change"; E14 US1).

   First rules, then - if the rules found nothing - a second pass of the model over a
   checklist for the kind of material. Same contour as Grammar: a failing draft is
   generated again with the reasons in front of the model, and if it never passes the
   teacher gets "check me" with the reason in plain words.

   The rules are deliberately narrow and high-confidence: they only fire on a clear
   clash (a definition of a thing next to an example that plainly uses the word as an
   action, and the other way round). A word the detectors cannot place is left to the
   second reading, never guessed at. */
const { isClean } = require('../glossary');
const descriptors = require('../descriptorBank');

/* The tools whose output is "a word and what it means": a set of items, a set with
   translations, definition pairs. The other word tools (collocations, families, phrasal
   verbs ...) have their own shapes and are not judged by this module. */
const KIND_BY_TOOL = {
  'extract-vocab': 'items',
  'essential-vocab': 'items',
  'word-set-builder': 'wordset',
  'word-definition-match': 'pairs',
};

const squash = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const reason = (rule, say) => ({ rule, say });
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const applies = input => !!input && Object.prototype.hasOwnProperty.call(KIND_BY_TOOL, input.toolId);
const kindOf = input => (applies(input) ? KIND_BY_TOOL[input.toolId] : null);

/* ── what kind of word does a definition describe? ─────────────────────────────────── */
const VERB_DEF = /^to\s+[a-z]/i;
const THING_DEF = /^(?:a|an|the|someone|somebody|something|one of|a person|a place|people|things)\b/i;

function partKind(part) {
  const p = squash(part).replace(/^\((?:n|v|noun|verb)\.?\)\s*/i, '');
  if (VERB_DEF.test(p)) return 'action';
  if (THING_DEF.test(p)) return 'thing';
  return null;
}
/* "to reserve; a set of pages" holds two meanings of two kinds of word in one entry */
function definitionKinds(def) {
  const d = squash(def);
  const labelled = new Set();
  if (/\((?:v|verb)\.?\)/i.test(d)) labelled.add('action');
  if (/\((?:n|noun)\.?\)/i.test(d)) labelled.add('thing');
  const kinds = new Set(labelled);
  d.split(/\s*(?:;|\/|\bor\b)\s*/i).forEach(p => { const k = partKind(p); if (k) kinds.add(k); });
  return kinds;
}

/* ── how does an example use the headword? ─────────────────────────────────────────── */
const FORM_END = '(?:s|es|ed|d|ing)?';
const ARTICLE_BEFORE = /\b(?:a|an|the|my|your|his|her|our|their|this|that|these|those|some|any|every|each|another)\s+(?:[a-z-]+\s+)?$/i;
const ACTION_BEFORE = /\b(?:I|you|we|they|can|could|will|would|shall|should|must|may|might|don't|doesn't|didn't|won't|cannot|do|did|(?:want|need|like|love|hope|plan|try|tries|decide|going|have|has|had|able|ready|how|why|where|what|used|learn|forgot|forget|remember|let's)(?:s|d|ed|ned)?\s+to)\s+(?:(?:often|always|usually|never|really|just|also|still|not)\s+)?$/i;

function useOf(word, example) {
  const w = squash(word).toLowerCase();
  if (!w || /\s/.test(w) || !/^[a-z-]+$/.test(w)) return null;       // single plain words only
  const ex = squash(example);
  const m = new RegExp(`\\b${esc(w)}${FORM_END}\\b`, 'i').exec(ex);
  if (!m) return null;
  const before = ex.slice(0, m.index);
  if (ACTION_BEFORE.test(before)) return { kind: 'action', at: ex.slice(Math.max(0, m.index - 14), m.index + m[0].length + 10) };
  if (ARTICLE_BEFORE.test(before)) return { kind: 'thing', at: ex.slice(Math.max(0, m.index - 14), m.index + m[0].length + 10) };
  return null;
}

const SAY = { action: 'an action', thing: 'a thing' };

/* ── rules ─────────────────────────────────────────────────────────────────────────── */
function entryReasons(word, definition, example) {
  const out = [];
  const w = squash(word);
  const def = squash(definition);
  if (!w || !def) return out;
  const kinds = definitionKinds(def);
  if (kinds.has('action') && kinds.has('thing')) {
    out.push(reason('vocab.mixed-meanings', `“${w}” has two different meanings in one entry (“${def.slice(0, 60)}”). Give it one meaning.`));
    return out;
  }
  if (/^[a-z-]+$/i.test(w) && new RegExp(`\\b${esc(w)}\\b`, 'i').test(def)) {
    out.push(reason('vocab.circular', `The meaning of “${w}” uses the word itself, so it explains nothing.`));
  }
  const defKind = kinds.size === 1 ? [...kinds][0] : null;
  const use = defKind ? useOf(w, example) : null;
  if (use && use.kind !== defKind) {
    out.push(reason('vocab.other-use', `“${w}” is explained as ${SAY[defKind]}, but its example uses it as ${SAY[use.kind]} (“…${use.at.trim()}…”).`));
  }
  return out;
}

function rows(kind, out) {
  if (kind === 'items') return (out.items || []).map(x => ({ word: x.word, definition: x.definition, example: x.example }));
  if (kind === 'wordset') return (out.words || []).map(x => ({ word: x.en, example: x.ex, uk: x.uk, ru: x.ru }));
  if (kind === 'pairs') return (((out.questions || [])[0] || {}).pairs || []).map(p => ({ word: p.left, definition: p.right }));
  return [];
}

function ruleCheck(input, out) {
  const kind = kindOf(input);
  if (!kind) return [];
  const list = rows(kind, out);
  const reasons = [];
  if (kind === 'pairs') {
    const defs = list.map(r => squash(r.definition).toLowerCase());
    if (new Set(defs).size < defs.length) reasons.push(reason('vocab.same-definition', 'Two words have the same definition, so the pairs cannot be told apart.'));
  }
  if (kind === 'wordset') {
    const bare = list.filter(r => !squash(r.uk) && !squash(r.ru));
    if (bare.length) reasons.push(reason('vocab.no-translation', `“${squash(bare[0].word)}” has no translation.`));
  }
  for (const r of list) {
    reasons.push(...entryReasons(r.word, r.definition, r.example));
    if (reasons.length >= 5) break;
  }
  return reasons.slice(0, 5);
}

/* ── the second pass: the model reads its own work against a checklist ─────────────── */
const CHECKLIST = {
  items: [
    'For each word, is the definition ONE meaning of ONE kind of word (not a thing and an action mixed together)?',
    'Does each example use the word in exactly the meaning its definition gives?',
    'Is every definition correct, and simple enough for the level?',
    'Is every example natural, correct English?',
  ],
  wordset: [
    'For each word, is the example in exactly ONE meaning, and the same meaning as the translations?',
    'Are the Ukrainian and Russian translations correct for that meaning?',
    'Is every example natural, correct English at the level?',
  ],
  pairs: [
    'Does each definition fit its own word and NO other word in the list? Name any definition that fits two.',
    'Is every definition correct and simple enough for the level?',
  ],
};

function judgePrompt(kind, input, out) {
  const brief = descriptors.brief(input.level, 'vocabulary');
  return `You check teaching material for an English teacher. Be strict and concrete.
Topic: "${input.topic || 'general'}". Learner level: ${input.level}. ${brief}
Material (${kind}):
${JSON.stringify(rows(kind, out)).slice(0, 7000)}

Answer each question yourself before deciding:
${CHECKLIST[kind].map((q, i) => `${i + 1}. ${q}`).join('\n')}

Return ONLY JSON: {"ok":true|false,"issues":["one short plain sentence per real problem, quoting the word involved"]}
"ok" is false only for a real problem: a wrong meaning, a mixed meaning, an example that shows another meaning, a wrong translation, an ambiguous pair. Style preferences are not problems. Write issues for a teacher: everyday words, no jargon about the checking itself.`;
}

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

async function checkVocabulary({ input, out, judge }) {
  const kind = kindOf(input);
  if (!kind) return { ok: true, reasons: [], unverified: false, kind: null };
  const reasons = ruleCheck(input, out);
  if (reasons.length) return { ok: false, reasons, unverified: false, kind };
  if (!judge) return { ok: true, reasons: [], unverified: false, rulesOnly: true, kind };
  const j = await judgeCheck(kind, input, out, judge);
  return { ok: j.reasons.length === 0, reasons: j.reasons, unverified: j.unverified, kind };
}

module.exports = { applies, kindOf, ruleCheck, checkVocabulary, judgePrompt, definitionKinds, useOf, KIND_BY_TOOL };
