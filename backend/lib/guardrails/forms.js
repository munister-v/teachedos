/* Grammar-form detectors: what a form looks like in a sentence, and the traps a
   generated text must not fall into while teaching it (ТЗ §3.6, T-G1).

   They are rules, not a parser, and say so: each one finds the clear instances and the
   clear mistakes. A topic with no detector gets no rule-based verdict - the model check
   still runs, and the badge says it was only checked that way. Messages are written for
   a teacher, in plain words. */

const IRREGULAR_PP = new Set(('been begun broken brought built bought caught chosen come cost cut done drawn driven eaten fallen felt found flown forgotten forgiven gone given got gotten grown had heard hidden held hurt kept known left lent let lost made met paid put read ridden rung run said seen sold sent set shown shut sung sat slept spoken spent stood taken taught told thought thrown understood woken worn won written become led meant swum sunk torn dug fed fought hung lain laid lit quit sought spun struck stuck swept wept wound').split(' '));
const IRREGULAR_PAST = new Set(('went saw ate took came made gave had got did said told thought knew found left felt kept lost met paid ran sat spoke stood wrote bought brought built caught chose drove fell flew forgot grew heard held hurt meant put read rode sang sold sent set shut slept spent swam threw understood woke wore won').split(' '));
const isPP = w => { w = String(w || '').toLowerCase(); return IRREGULAR_PP.has(w) || (w.length > 3 && w.endsWith('ed')); };
const isPast = w => { w = String(w || '').toLowerCase(); return IRREGULAR_PAST.has(w) || (w.length > 3 && w.endsWith('ed')); };

const DAYS = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december';
/* a time that is over: it cannot be used with the present perfect */
const FINISHED_TIME = new RegExp(`\\b(?:yesterday|last (?:night|week|month|year|weekend|summer|winter|spring|autumn|${DAYS})|\\d+ (?:minutes?|hours?|days?|weeks?|months?|years?) ago|a (?:week|month|year|while|moment) ago|\\bago\\b|in (?:1\\d{3}|20\\d{2})|on (?:${DAYS})|the other day|when (?:i|he|she|we|they|you) (?:was|were|got|lived|came|saw)|at \\d{1,2}(?::\\d{2})?\\s?(?:am|pm)|in (?:${MONTHS}))\\b`, 'i');

const PERFECT_RE = /\b(?:have|has|'ve|haven't|hasn't)\s+(?:(?:not|never|already|just|ever|yet|even|always|recently|finally|really)\s+)*([a-z']+)/gi;
const PERFECT_S_RE = /\b(?:he|she|it|who|that|there|everyone|nobody|someone)'s\s+(?:(?:never|already|just|ever|yet)\s+)*(been|gone|done|seen|had|got|taken|made|given|come|become|eaten|lost|found|heard|read|won)\b/gi;

function perfectInstances(s) {
  let n = 0, m;
  const re = new RegExp(PERFECT_RE.source, 'gi');
  while ((m = re.exec(s))) if (isPP(m[1])) n++;
  n += (s.match(new RegExp(PERFECT_S_RE.source, 'gi')) || []).length;
  return n;
}
const quote = s => '“' + String(s).replace(/\s+/g, ' ').trim().slice(0, 70) + '”';

const FORMS = {
  'present-perfect': {
    name: 'Present Perfect',
    find: s => perfectInstances(s),
    traps: [
      { id: 'finished-time', test: s => perfectInstances(s) > 0 && FINISHED_TIME.test(s),
        say: s => `${quote(s)} pairs the Present Perfect with a time that is over, which would teach the wrong rule.` },
    ],
  },
  'first-conditional': {
    name: 'first conditional',
    find: s => (/\bif\b[^,.!?]*,\s*[^.!?]*\b(?:will|won't|'ll)\b/i.test(s) || /\b(?:will|won't|'ll)\b[^.!?]*\bif\b/i.test(s)) ? 1 : 0,
    traps: [
      { id: 'will-after-if', test: s => /\bif\s+(?:[\w']+\s+){0,4}?(?:will|won't)\b/i.test(s),
        say: s => `${quote(s)} puts “will” right after “if”, which is the mistake this lesson is meant to prevent.` },
      { id: 'would-in-first', test: s => /\bif\s+(?:[\w']+\s+){0,4}?would\b/i.test(s),
        say: s => `${quote(s)} puts “would” in the “if” part.` },
    ],
  },
  'second-conditional': {
    name: 'second conditional',
    find: s => (/\bif\b/i.test(s) && /\bwould\b/i.test(s) && !/\bwould have\b/i.test(s)) ? 1 : 0,
    traps: [
      { id: 'would-after-if', test: s => /\bif\s+(?:[\w']+\s+){0,4}?would\b/i.test(s),
        say: s => `${quote(s)} puts “would” right after “if”, which is the mistake this lesson is meant to prevent.` },
      { id: 'will-in-second', test: s => /\bif\s+(?:[\w']+\s+){0,4}?will\b/i.test(s),
        say: s => `${quote(s)} uses the first-conditional pattern in a second-conditional lesson.` },
    ],
  },
  'third-conditional': {
    name: 'third conditional',
    find: s => (/\bif\b[^.!?]*\bhad\b/i.test(s) && /\bwould have\b/i.test(s)) ? 1 : 0,
    traps: [
      { id: 'would-have-after-if', test: s => /\bif\s+(?:[\w']+\s+){0,4}?would have\b/i.test(s),
        say: s => `${quote(s)} puts “would have” right after “if”.` },
      { id: 'would-had', test: s => /\bwould had\b/i.test(s), say: s => `${quote(s)} has “would had”.` },
    ],
  },
  'used-to': {
    name: '“used to”',
    find: s => (s.match(/\bused to\b/gi) || []).length,
    traps: [
      { id: 'did-used-to', test: s => /\b(?:did|didn't|did not)\s+(?:[\w']+\s+){0,2}used to\b/i.test(s),
        say: s => `${quote(s)} has “did … used to”; with “did” it is “use to”.` },
      { id: 'used-to-ing', test: s => /\b(?:i|you|we|they|he|she|it)\s+used to\s+\w+ing\b/i.test(s),
        say: s => `${quote(s)} has “used to” followed by an -ing form.` },
    ],
  },
  'present-continuous': {
    name: 'Present Continuous',
    find: s => (s.match(/\b(?:am|is|are|'m|'s|'re)\s+(?:not\s+)?\w+ing\b/gi) || []).length,
    traps: [
      { id: 'stative-ing', test: s => /\b(?:am|is|are|'m|'s|'re)\s+(?:not\s+)?(?:knowing|wanting|liking|loving|hating|needing|believing|understanding|belonging|owning|preferring|seeming)\b/i.test(s),
        say: s => `${quote(s)} uses a verb that does not take the continuous form.` },
    ],
  },
  'past-simple': {
    name: 'Past Simple',
    find: s => (s.split(/\s+/).filter(isPast).length ? 1 : 0),
    traps: [
      { id: 'did-past', test: s => /\bdid(?:n't| not)?\s+(?:\w+ed|went|saw|ate|took|came|made|gave|had|got)\b/i.test(s),
        say: s => `${quote(s)} has “did” followed by a past form.` },
    ],
  },
};

/* The topic is the NAME of the form (Grammar lesson), e.g. "Present Perfect vs Past Simple".
   More than one form in a topic means a contrast: the first is the target to count. */
const TOPIC_MAP = [
  ['present-perfect', /present perfect(?!\s*(?:continuous|progressive))|\bpresent-perfect\b/i],
  ['third-conditional', /third conditional|conditional\s*(?:3|iii)|type\s*3|unreal past/i],
  ['second-conditional', /second conditional|conditional\s*(?:2|ii)\b|type\s*2|unreal present/i],
  ['first-conditional', /first conditional|conditional\s*(?:1|i)\b|type\s*1|real conditional/i],
  ['used-to', /\bused to\b/i],
  ['present-continuous', /present continuous|present progressive/i],
  ['past-simple', /past simple|simple past/i],
];
function formsFor(topic) {
  const t = String(topic || '');
  return TOPIC_MAP.filter(([, re]) => re.test(t)).map(([k]) => k);
}
/* the form the lesson is ABOUT: the first one named. */
const targetFor = topic => formsFor(topic)[0] || null;

const sentences = text => String(text || '').replace(/\*\*/g, '').split(/(?<=[.!?…])\s+|\n+/).map(s => s.trim()).filter(Boolean);

/* Instances of the form and the traps a text falls into, with the sentence that does. */
function analyse(text, formKey) {
  const f = FORMS[formKey];
  if (!f) return null;
  const out = { form: f.name, instances: 0, traps: [] };
  for (const s of sentences(text)) {
    out.instances += f.find(s) ? 1 : 0;
    for (const t of f.traps) if (t.test(s)) out.traps.push({ id: t.id, say: t.say(s) });
  }
  return out;
}

/* grammar words a learner must not meet before the rule is shown (tasks may say verb, tense, word) */
const JARGON = /\b(?:past participle|present perfect|past perfect|first conditional|second conditional|third conditional|conditional|auxiliary|subjunctive|clause|gerund|infinitive|participle|passive voice|modal verb|present continuous|progressive|inversion)\b/i;

module.exports = { FORMS, formsFor, targetFor, analyse, sentences, isPP, FINISHED_TIME, JARGON };
