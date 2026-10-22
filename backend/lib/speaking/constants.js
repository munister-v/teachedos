/* Speaking Tutor (ТЗ v1.0): the limits that make a session impossible to turn into an open cost. */
module.exports = {
  SESSION_ROUNDS: 5,              // a full session; a ritual has 1-2 rounds
  MAX_ANSWER_SEC: 90,             // §6/§8: hard cap on one answer
  MAX_REPEATS_PER_PHRASE: 2,      // §25: Tich asks to repeat at most twice
  MAX_PROGRAM_ROUNDS_PER_SESSION: 2,   // methodologist's condition: program checks never dominate
  MAX_PROGRAM_ROUNDS_PER_RITUAL: 1,
  XP_PER_SESSION: 20,
  XP_PER_RITUAL: 10,              // the morning ritual is a mini session: it counts as the day's norm and pays less             // text sessions pay half (§2)
  DAILY_AUDIO_CAP_MIN: 30,        // finance's condition: assessed audio per student per day, whatever the client does
  FREE_SESSIONS_PER_WEEK: 2,      // §7: Free teacher plan - free sessions per student per week
  PHRASE_INTERVALS_DAYS: [1, 3, 7],
  FILLERS: ['um', 'uh', 'erm', 'like', 'you know'],
  AUDIO_RETENTION_MONTHS: 12,     // §28
  LEVELS: ['A1', 'A2', 'B1', 'B2', 'C1'],
};
