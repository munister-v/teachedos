/* Is this material fit for a class? (Lesson Builder 2.0 E5 US3, T-PR3)

   Incoming content - a news story, a pasted text, a transcript - is read for topics a teacher
   may not want in front of a class (graphic violence, sexual content, drugs, self-harm,
   hate speech). It never blocks and never rewrites: a flag is a calm note on the draft's
   quality signal, and the teacher decides - use it, change the story, or leave it off the
   board. Plain word lists, deliberately cautious: a miss is better than a wrong accusation,
   and the teacher is the judge of what a given class can take. */
const CATEGORIES = [
  { id: 'violence', say: 'graphic violence', re: /\b(murder(?:ed|s|er)?|massacre|stabb(?:ed|ing)|shot dead|beheaded|torture[ds]?|corpse|bloodshed|gunman|killed \d+)\b/i },
  { id: 'sexual', say: 'sexual content', re: /\b(rape[ds]?|sexual assault|porn\w*|explicit sex|molest\w*|sex trafficking)\b/i },
  { id: 'self-harm', say: 'self-harm or suicide', re: /\b(suicid\w*|self[- ]harm\w*|kill (?:himself|herself|themselves|myself))\b/i },
  { id: 'drugs', say: 'drug use', re: /\b(cocaine|heroin|methamphetamine|overdos\w+|fentanyl|drug (?:dealer|cartel|trafficking))\b/i },
  { id: 'hate', say: 'hate speech', re: /\b(genocide|ethnic cleansing|white supremac\w*|nazi propaganda)\b/i },
];

/* Returns [] when nothing is found, otherwise one entry per category. */
function screen(...texts) {
  const text = texts.filter(Boolean).join('\n').slice(0, 60000);
  if (!text) return [];
  return CATEGORIES.filter(c => c.re.test(text)).map(c => ({ id: c.id, say: c.say }));
}

/* the plain sentence a teacher reads */
function note(found) {
  if (!found.length) return '';
  const list = found.map(f => f.say).join(', ');
  return `This material touches on ${list}. Read it through and decide whether it suits your class before you add it.`;
}

/* put it on the quality signal the card already shows (no new screen, nothing blocked) */
function decorate(out, found) {
  if (!out || !found.length) return out;
  const q = out.quality || { level: 'green', kept: 0, asked: 0, dropped: [], notes: [] };
  q.level = q.level === 'red' ? 'red' : 'amber';
  q.sensitive = found.map(f => f.id);
  q.notes = [note(found), ...(q.notes || []).filter(n => n !== note(found))].slice(0, 4);
  out.quality = q;
  return out;
}

module.exports = { screen, note, decorate, CATEGORIES };
