/* Appendix A of the ТЗ: the platform's own starter bank. Each question forces one construction; the
   construction is for the system and is never shown to the student. A1 uses the A2 list and B2-C2 the
   B1 list until the bank is extended with the same table (the ТЗ names that as a separate delivery). */
const A2 = [
  ['What did you do yesterday evening?', 'past simple, regular verbs'],
  ['What is your best friend like?', 'present simple, adjectives of character'],
  ['What are you going to do this weekend?', 'going to for plans'],
  ['Tell me about your last holiday. Where did you go?', 'past simple, irregular verbs'],
  ['What do you usually have for breakfast? And today?', 'usually vs today, present simple/continuous'],
  ['Which is better, summer or winter? Why?', 'comparatives'],
  ['What were you doing at 8 o\'clock last night?', 'past continuous'],
  ['Tell me about your home. Which room do you like most?', 'there is / there are'],
  ['What can you cook? What can\'t you cook at all?', 'can / can\'t'],
  ['If the weather is good tomorrow, what will you do?', 'first conditional'],
];
const B1 = [
  ['Tell me about something you have done this year for the first time.', 'present perfect with ever / this year'],
  ['What were you doing when your phone last rang?', 'past continuous + past simple interruption'],
  ['If you could live in any city, where would you live?', 'second conditional'],
  ['Tell me about a film you have seen recently. What happens in it?', 'present perfect + narrative present'],
  ['What is the most useful app on your phone? What is it used for?', 'passive voice'],
  ['Tell me about a person you used to spend a lot of time with.', 'used to'],
  ['What advice would you give to someone who wants to learn English?', 'should / ought to, advice structures'],
  ['Describe a journey that went wrong. What happened first, and then?', 'past simple sequence, linkers'],
  ['What do you think your life will be like in five years?', 'will / might for predictions'],
  ['Tell me about something you are looking forward to.', 'phrasal verbs, look forward to + -ing'],
];
const pack = rows => rows.map(([question, construct]) => ({ question, construct }));
const BANK = { A1: pack(A2), A2: pack(A2), B1: pack(B1), B2: pack(B1), C1: pack(B1) };

/* the control question of the first session and of the monthly "then and now" (§14): always the same */
const CONTROL_QUESTION = { A1: A2[0][0], A2: A2[0][0], B1: B1[0][0], B2: B1[0][0], C1: B1[0][0] };

const bankFor = level => BANK[String(level || 'B1').toUpperCase().slice(0, 2)] || BANK.B1;
const controlFor = level => CONTROL_QUESTION[String(level || 'B1').toUpperCase().slice(0, 2)] || CONTROL_QUESTION.B1;

module.exports = { bankFor, controlFor, BANK };
