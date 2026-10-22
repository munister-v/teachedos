/* The LLM layer of the Speaking Tutor: the platform's own AI contour (lib/aiEngine.js), one JSON answer per call.
   Tests and the offline mode swap it with setLlm(). Nothing here grades a student. */
const prompts = require('./prompts');

let impl = null;
const real = () => require('../aiEngine');
const setLlm = fn => { impl = fn; };
const available = () => !!impl || (() => { try { return real().enabled(); } catch (_) { return false; } })();

async function callJson(call) {
  const text = prompts.join(call);
  const out = impl ? await impl(text, call) : await real().rawGenerate(text);
  if (!out || typeof out !== 'object') throw new Error('Empty answer from the model');
  return out;
}
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const words = t => String(t || '').split(/\s+/).filter(Boolean).length;

const FALLBACK_QUESTIONS = ['Tell me about your day so far. What was the best part?', 'What are you looking forward to this week?'];

/* a question for the plan; on any failure the bank's own question stands in, so a round never stalls */
async function makeQuestion(plan, ctx, recent) {
  try {
    const r = await callJson(prompts.questionPrompt({ level: ctx.level, brief: plan.brief, targetWords: plan.targetWords || [],
      facts: (ctx.facts || []).slice(0, 3).map(f => f.fact), recentQuestions: recent }));
    const q = clip(r.question, 280);
    if (q && !/\btest\b/i.test(q) && !recent.includes(q)) return { question: q, generated: true };
  } catch (_) { /* fall through to the bank */ }
  return { question: plan.bankQuestion || FALLBACK_QUESTIONS[recent.length % FALLBACK_QUESTIONS.length], generated: false };
}

/* the turn: reaction + the one better version + what changed; the meaning must not drift (length guard) */
async function analyseAnswer(args) {
  const r = await callJson(prompts.answerPrompt(args));
  const transcript = clip(args.transcript, 1500);
  let better = clip(r.betterVersion, 1500) || transcript;
  if (words(better) > words(transcript) * 1.6 + 6) better = transcript;       // it added facts: not allowed (§6)
  const changed = (Array.isArray(r.changedFragments) ? r.changedFragments : []).slice(0, 3).map(c => ({
    said: clip(c.said, 200), better: clip(c.better, 200), construct: clip(c.construct, 80).toLowerCase() || 'general',
    category: ['grammar', 'wordChoice', 'wordOrder', 'pronunciation', 'missingWord'].includes(c.category) ? c.category : 'grammar',
    breaksMeaning: c.breaksMeaning === true,
  })).filter(c => c.said && c.better && c.said !== c.better);
  const same = better.trim().toLowerCase() === transcript.trim().toLowerCase();
  return { reaction: clip(r.reaction, 160), betterVersion: better, changed: same ? [] : changed, hint: changed.length ? clip(r.hint, 120) : '',
    usedTargetWords: (Array.isArray(r.usedTargetWords) ? r.usedTargetWords : []).map(w => clip(w, 40).toLowerCase()).slice(0, 5) };
}

async function extractFacts(transcript, known, blocked) {
  try {
    const r = await callJson(prompts.factExtractionPrompt({ transcript, knownFacts: known, blockedFacts: blocked }));
    const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const skip = new Set([...known, ...blocked].map(norm));
    return (Array.isArray(r.newFacts) ? r.newFacts : []).map(f => clip(f, 120)).filter(f => f && !skip.has(norm(f))).slice(0, 4);
  } catch (_) { return []; }
}

async function makeGreeting(args) {
  try { const r = await callJson(prompts.greetingPrompt(args)); const g = clip(r.greeting, 240); if (g) return g; } catch (_) { /* generic below */ }
  return args.hook ? `Morning! How is it going with this: ${args.hook}?` : 'Morning! What is on your plate today?';
}

module.exports = { setLlm, available, callJson, makeQuestion, analyseAnswer, extractFacts, makeGreeting };
