/* Speaking Tutor engine (ТЗ v1.0 §§1, 3, 4, 13, 15, 23, 26, 27): pure logic, no IO, no LLM calls.
   The question TEXTS come from the LLM layer (prompts.js) out of the plan this module returns. */
const C = require('./constants');

const ymd = iso => String(iso).slice(0, 10);
const addDays = (iso, n) => { const d = new Date(ymd(iso) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weightRank = e => (e.status === 'recurring' ? 0 : 1);

/* Priority of sources: program check (due today) > teacher task > recurring mistake > last lesson topic and
   passive words > starter bank. At most two program rounds per session; the rest of the chat stays about life. */
function buildSessionPlan(ctx, rounds = C.SESSION_ROUNDS) {
  const plan = [];
  const maxProgram = rounds <= 2 ? C.MAX_PROGRAM_ROUNDS_PER_RITUAL : C.MAX_PROGRAM_ROUNDS_PER_SESSION;
  for (const check of (ctx.dueProgramChecks || []).slice(0, maxProgram)) {
    plan.push({ source: 'program', construct: check.construct, targetWords: [],
      brief: `Ask about the student's real life so they must speak using ${check.construct}. Never name the grammar.` });
  }
  for (const task of (ctx.teacherTasks || []).filter(t => t.status === 'queued' || t.status === 'inProgress')) {
    if (plan.length >= rounds) break;
    plan.push({ source: 'teacherTask', construct: task.construct, targetWords: [], taskId: task.id,
      brief: `Teacher's task, woven in naturally, never announced as a check: ${task.instruction}` });
  }
  const recurring = [...(ctx.recurring || [])].filter(e => e.status === 'recurring')
    .sort((a, b) => (a.weight === 'blocking' ? 0 : 1) - (b.weight === 'blocking' ? 0 : 1) || weightRank(a) - weightRank(b) || b.occurrences - a.occurrences);
  for (const entry of recurring) {
    if (plan.length >= rounds) break;
    if (plan.some(p => p.construct === entry.construct)) continue;
    plan.push({ source: 'recurring', construct: entry.construct, targetWords: [],
      brief: `Ask a question that forces ${entry.construct} in the answer (the student's recurring mistake).` });
  }
  if (plan.length < rounds && (ctx.currentTopic || (ctx.passiveWords || []).length)) {
    plan.push({ source: 'lesson', construct: ctx.currentTopic && ctx.currentTopic.construct, targetWords: (ctx.passiveWords || []).slice(0, 2),
      brief: 'Ask about the last lesson topic and steer the answer so the target words are needed.' });
  }
  let i = 0;
  const bank = ctx.starterBank || [];
  while (plan.length < rounds && i < bank.length) {
    const item = bank[i++];
    if (plan.some(p => p.construct === item.construct)) continue;
    plan.push({ source: 'starter', construct: item.construct, targetWords: [], bankQuestion: item.question, brief: `Use this bank question: ${item.question}` });
  }
  // a student with a short history still gets a whole session: the bank repeats rather than runs dry
  let k = 0;
  while (plan.length < rounds && bank.length) { const item = bank[k++ % bank.length]; plan.push({ source: 'starter', construct: item.construct, targetWords: [], bankQuestion: item.question, brief: `Use this bank question: ${item.question}` }); }
  return plan.slice(0, rounds);
}

/* The morning ritual (§26): a hook from a real fact, a pair of words, one or two questions. */
function buildRitualPlan(ctx, yesterdayHook) {
  const facts = (ctx.facts || []).map(f => f.fact);
  const hookFact = facts.find(f => f !== yesterdayHook) || facts[0];
  const pairWords = [];
  if ((ctx.passiveWords || [])[0]) pairWords.push({ word: ctx.passiveWords[0], kind: 'activate' });
  const due = (ctx.duePhrases || [])[0];
  if (due) pairWords.push({ word: due.text, kind: 'phraseRepeat', phraseId: due.id });
  return { hookFact, pairWords, questions: buildSessionPlan(ctx, 2).slice(0, 2), countsAsDailyNorm: true };
}

/* Weight (§15): blocking = the meaning breaks; recurring = three times or more; a self-correction weighs less. */
function weightOf(entry, breaksMeaning) {
  if (breaksMeaning) return 'blocking';
  if (entry.occurrences >= 3 && entry.selfFixedCount < entry.occurrences / 2) return 'recurring';
  return 'cosmetic';
}

/* One upsert path for the mistake log: new (1) -> recurring (3+) -> fixed (two clean sessions in a row). */
function upsertMistake(log, hit) {
  const next = log.map(e => ({ ...e }));
  const existing = next.find(e => e.construct === hit.construct && e.status !== 'fixed');
  if (existing) {
    existing.occurrences += 1; existing.lastSeenAt = hit.now; existing.said = hit.said; existing.better = hit.better;
    if (hit.selfCorrected) existing.selfFixedCount += 1;
    existing.cleanSessionsStreak = 0;
    if (existing.occurrences >= 3) existing.status = 'recurring';
    existing.weight = hit.breaksMeaning ? 'blocking' : weightOf(existing, false);
    return next;
  }
  const e = { id: hit.newId, studentId: hit.studentId || '', source: hit.source || 'speaking', said: hit.said, better: hit.better, category: hit.category,
    construct: hit.construct, occurrences: 1, status: 'new', selfFixedCount: hit.selfCorrected ? 1 : 0, cleanSessionsStreak: 0, firstSeenAt: hit.now, lastSeenAt: hit.now };
  e.weight = hit.breaksMeaning ? 'blocking' : 'cosmetic';
  next.push(e);
  return next;
}

/* After a finished session: targeted constructs produced cleanly move toward Fixed. */
function applySessionOutcome(log, cleanConstructs) {
  return log.map(e => {
    if (!cleanConstructs.includes(e.construct) || e.status === 'fixed') return e;
    const streak = e.cleanSessionsStreak + 1;
    return { ...e, cleanSessionsStreak: streak, status: streak >= 2 ? 'fixed' : e.status };
  });
}

/* Phrase Bank (§13): +1 day, +3 days, +7 days; three correct repeats on different days = Mine. */
function scheduleNextReview(card, todayIso) {
  const step = Math.min(card.correctRepeatDays.length, C.PHRASE_INTERVALS_DAYS.length - 1);
  return { ...card, nextReviewOn: addDays(todayIso, C.PHRASE_INTERVALS_DAYS[step]) };
}
function recordPhraseRepeat(card, correct, todayIso) {
  if (!correct) return scheduleNextReview(card, todayIso);
  const day = ymd(todayIso);
  const days = card.correctRepeatDays.includes(day) ? card.correctRepeatDays : [...card.correctRepeatDays, day];
  const updated = { ...card, correctRepeatDays: days, status: days.length >= 3 ? 'mine' : 'learning' };
  return updated.status === 'mine' ? updated : scheduleNextReview(updated, todayIso);
}

/* Topic mastery (§27): holds / crumbling / unchecked / inProgress; "holds" only with correct use on two different days. */
function topicStatus(m, todayIso) {
  const day = iso => ymd(iso);
  const correctDays = new Set(m.correctUses.map(u => day(u.date)));
  const recentErrors = m.errorUses.filter(u => (Date.parse(todayIso) - Date.parse(u.date)) / 86400000 <= 7);
  const lastError = m.errorUses[m.errorUses.length - 1], lastCorrect = m.correctUses[m.correctUses.length - 1];
  if (recentErrors.length >= 2) return 'crumbling';
  if (lastError && lastCorrect && lastError.date > lastCorrect.date && recentErrors.length >= 1 && correctDays.size < 2) return 'crumbling';
  if (correctDays.size >= 2 && (!lastError || (lastCorrect && lastCorrect.date > lastError.date))) return 'holds';
  if (!m.correctUses.length && !m.errorUses.length) return 'unchecked';
  return 'inProgress';
}

/* Program checks are scheduled from the lesson date: +1 day and +4 days. */
const programCheckDates = lessonDateIso => [addDays(lessonDateIso, 1), addDays(lessonDateIso, 4)];

/* Fluency (§23), from transcripts and timings; never shown to the student as numbers. */
function fluencyFromRounds(weekOf, studentId, rounds) {
  const spoken = rounds.filter(r => r.transcript && r.studentAudioSec);
  const totalWords = spoken.reduce((s, r) => s + r.transcript.split(/\s+/).filter(Boolean).length, 0);
  const totalSec = spoken.reduce((s, r) => s + (r.studentAudioSec || 0), 0);
  const fillerCount = spoken.reduce((s, r) => s + r.transcript.toLowerCase().split(/[^a-z']+/).filter(w => C.FILLERS.includes(w)).length, 0);
  const minutes = Math.max(totalSec / 60, 0.01);
  return { studentId, weekOf, wordsPerMinute: Math.round(totalWords / minutes), avgAnswerWords: spoken.length ? Math.round(totalWords / spoken.length) : 0,
    fillersPerMinute: Math.round((fillerCount / minutes) * 10) / 10, speechMinutes: Math.round(totalSec / 6) / 10 };
}

/* The one error a round is about: blocking first (§15), then the target construction, then the first. */
function mainError(changed, targetConstruct) {
  const list = Array.isArray(changed) ? changed : [];
  return list.find(c => c.breaksMeaning) || list.find(c => targetConstruct && c.construct === targetConstruct) || list[0] || null;
}

module.exports = { buildSessionPlan, buildRitualPlan, weightOf, upsertMistake, applySessionOutcome, scheduleNextReview, recordPhraseRepeat,
  topicStatus, programCheckDates, fluencyFromRounds, mainError, addDays };
