/* The product's one language (Lesson Builder 2.0 ТЗ §7, principle P6, epic E8).

   Approved meanings (15.10.2026):
     Board / Space   the teacher's own space; the two words are synonyms (teachers call it both)
     Frame           ONE lesson on the board
     Course          a whole course on the board (several frames)
     Studio          a lesson-building studio (there are 8); Studio is not a Frame
     Task            one separate activity (words / grammar); may live alone, e.g. in the first-aid kit
     Picture studio  the picture-worksheet studio: its own content type, not a synonym of Task
     Lesson path     the structure of a lesson, the steps inside a frame
     Activity card   the card of one separate activity
     Lesson          a session - a class that was started
   Renamings: "Build a lesson" (in the tool list) -> "Lesson Builder";
              "Submit Final Draft" -> "Submit to teacher"; "Students" stays.

   Principle 0 (invisible rigour): the teacher never meets guardrail, descriptor,
   calibration, mediation or can-do in the interface - only teacher language.

   This is the machine form of those rules: a linter for interface copy and for
   what the platform says about generated material. Rules are deliberately few
   and high-confidence; the ones that need a human reading (is "Space" being used
   as a publication state?) are left to review rather than guessed at. */

const TERMS = {
  board:           'The teacher\'s own space. "Space" is a synonym.',
  frame:           'One lesson on the board. Not a studio.',
  course:          'A whole course on the board: several frames.',
  studio:          'A lesson-building studio (there are eight). Not a frame.',
  task:            'One separate activity. May live on its own. Not a studio.',
  'picture studio': 'The picture-worksheet studio - its own type of content.',
  'lesson path':   'The structure of a lesson: the steps inside a frame.',
  'activity card': 'The card of one separate activity.',
  lesson:          'A session - a class that has been started.',
};

/* targets: where the rule applies. 'frontend' = what the browser shows (pages, scripts),
   'backend' = what the server says (notifications, emails, messages).
   textOnly: match inside string literals / visible text only, not in code identifiers. */
const RULES = [
  { id: 'tool-name', targets: ['frontend', 'backend'],
    banned: /\bBuild a lesson\b(?!\s+(?:pack|path)\b)/,
    say: 'Lesson Builder', why: 'The tool is called Lesson Builder.' },
  { id: 'submit-draft', targets: ['frontend', 'backend'],
    banned: /\bSubmit Final Draft\b/i,
    say: 'Submit to teacher', why: 'What the student does is hand the work to the teacher.' },
  { id: 'studio-is-not-frame', targets: ['frontend', 'backend'],
    banned: /\bstudio\s+frame\b|\bframe\s+studio\b|\btask\s+studio\b/i,
    say: 'frame (one lesson) or studio (the builder) - not both', why: 'Studio is not a Frame, and a Task is not a Studio.' },
  { id: 'invisible-rigour', targets: ['frontend'], textOnly: true,
    banned: /\b(guardrails?|descriptors?|can-do|calibrat\w+|mediation)\b/i,
    say: 'plain teacher language', why: 'Principle 0: the strictness is inside the platform; the teacher sees none of its terms.' },
];

const forTarget = target => RULES.filter(r => r.targets.includes(target));

/* findings in one piece of text. target: 'frontend' | 'backend'; textOnly rules are
   skipped unless `visible` says this text is something a person reads. */
function lintText(text, { target = 'frontend', visible = true } = {}) {
  const out = [];
  const s = String(text == null ? '' : text);
  for (const r of forTarget(target)) {
    if (r.textOnly && !visible) continue;
    const re = new RegExp(r.banned.source, r.banned.flags.includes('g') ? r.banned.flags : r.banned.flags + 'g');
    let m;
    while ((m = re.exec(s))) {
      out.push({ rule: r.id, match: m[0], index: m.index, say: r.say, why: r.why });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  return out;
}

/* Does an interface or generated line break the language? Used on the platform's own
   messages (the "check me" reasons) before they reach a teacher. */
const isClean = (text, opts) => lintText(text, opts).length === 0;

module.exports = { TERMS, RULES, lintText, isClean };
