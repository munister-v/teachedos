/* Starter phrases for a new student's first Daily Sprint.

   The sprint needs words with a meaning and an example, and a student who
   has just signed up has none: the onboarding ended on "Not enough words
   yet". Five easy, useful phrases picked by the student's interests (then
   their goal) give the first sprint something to work with. Plain English
   meanings, so they suit any native language. */
const BY_TAG = {
  work: [
    ['touch base', 'to talk briefly to check how things are', "Let's touch base on Friday about the project."],
    ['a tight deadline', 'very little time to finish something', "We're on a tight deadline, so let's start now."],
    ['to follow up', 'to contact someone again about something', "I'll follow up with an email tomorrow."],
  ],
  business: [
    ['a win-win', 'a result that is good for everyone', 'The new deal is a win-win for both companies.'],
    ['to cut costs', 'to spend less money', 'They cut costs by working from home.'],
  ],
  tech: [
    ['to back up', 'to make a copy of files in case they are lost', 'Always back up your photos to the cloud.'],
    ['user-friendly', 'easy to use', 'The new app is really user-friendly.'],
  ],
  travel: [
    ['to check in', 'to show your ticket or booking when you arrive', 'We need to check in two hours before the flight.'],
    ['off the beaten track', 'away from the places most tourists go', 'We found a café off the beaten track.'],
    ['jet lag', 'feeling tired after a long flight across time zones', 'I had terrible jet lag after flying to Tokyo.'],
  ],
  fluency: [
    ['to be honest', 'used before saying what you really think', "To be honest, I didn't like the ending."],
    ['it depends', 'the answer changes with the situation', "It depends on the weather, really."],
    ['let me think', 'used to get a moment before answering', 'Hmm, let me think. Maybe next week?'],
  ],
  exams: [
    ['on the other hand', 'used to give the opposite point', 'It is cheap. On the other hand, it is slow.'],
    ['to sum up', 'used to start a short summary', 'To sum up, both options have pros and cons.'],
  ],
  pop: [
    ['to go viral', 'to spread very fast online', 'Her video went viral overnight.'],
    ['a must-see', 'something you should definitely see', 'This film is a must-see this year.'],
  ],
  series: [
    ['to binge-watch', 'to watch many episodes one after another', 'I binge-watched the whole season this weekend.'],
    ['a plot twist', 'a sudden surprising change in a story', 'Nobody saw that plot twist coming.'],
  ],
  psychology: [
    ['to overthink', 'to think about something too much', 'Try not to overthink it - just ask her.'],
    ['a comfort zone', 'a situation where you feel safe and relaxed', 'Speaking English pushes me out of my comfort zone.'],
  ],
  lifestyle: [
    ['to unwind', 'to relax after work or stress', 'I unwind with a book and a cup of tea.'],
    ['me time', 'time you spend on yourself', 'Sunday morning is my me time.'],
  ],
  health: [
    ['to get some rest', 'to sleep or relax to feel better', "You look tired - get some rest tonight."],
  ],
  food: [
    ['to grab a bite', 'to eat something quickly', "Let's grab a bite before the meeting."],
  ],
  sport: [
    ['to keep fit', 'to stay healthy by doing exercise', 'I go running to keep fit.'],
  ],
  gaming: [
    ['to level up', 'to get better or reach the next stage', 'My English levelled up after the trip.'],
  ],
};
const DEFAULTS = ['to be honest', 'it depends', 'to unwind', 'a must-see', 'to follow up', 'let me think'];
const ALL = new Map(Object.values(BY_TAG).flat().map(p => [p[0], p]));

function pick(interests = [], goal = null, n = 5) {
  const out = [];
  const add = p => { if (p && !out.some(x => x[0] === p[0])) out.push(p); };
  const tags = [...interests, goal].filter(Boolean);
  // one from each tag first, so several interests all show up, then the rest
  for (let round = 0; round < 3 && out.length < n; round++) {
    for (const t of tags) { if (out.length >= n) break; add((BY_TAG[t] || [])[round]); }
  }
  for (const w of DEFAULTS) { if (out.length >= n) break; add(ALL.get(w)); }
  return out.slice(0, n).map(([word, meaning, example]) => ({ word, meaning, example }));
}

module.exports = { pick };
