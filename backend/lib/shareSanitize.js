'use strict';

const MAX_ITEMS = 100;
const text = (value, max = 1000) => String(value ?? '').slice(0, max);

function sanitizeQuestions(content) {
  if (!Array.isArray(content?.questions)) return null;
  return {
    questions: content.questions.slice(0, MAX_ITEMS).map((item) => {
      const opts = Array.isArray(item?.opts)
        ? item.opts.slice(0, 12).map((option) => text(option, 300))
        : [];
      const rawCorrect = Number(item?.correct);
      const correct = Number.isInteger(rawCorrect) && rawCorrect >= 0 && rawCorrect < opts.length
        ? rawCorrect
        : 0;
      return { q: text(item?.q, 1200), opts, correct };
    }).filter((item) => item.q && item.opts.length),
  };
}

function sanitizeGameContent(gameType, content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;

  if (gameType === 'speed-quiz') return sanitizeQuestions(content);

  if (gameType === 'fill-blank') {
    if (!Array.isArray(content.sentences)) return null;
    return { sentences: content.sentences.slice(0, MAX_ITEMS).map((item) => text(item, 2400)) };
  }

  if (gameType === 'true-false') {
    if (!Array.isArray(content.statements)) return null;
    return {
      statements: content.statements.slice(0, MAX_ITEMS).map((item) => ({
        text: text(item?.text, 1200),
        answer: item?.answer === true,
      })).filter((item) => item.text),
    };
  }

  if (gameType === 'memory-match' || gameType === 'flashcards') {
    if (!Array.isArray(content.pairs)) return null;
    return {
      pairs: content.pairs.slice(0, MAX_ITEMS).map((item) => ({
        a: text(item?.a, 500),
        b: text(item?.b, 1000),
      })).filter((item) => item.a || item.b),
    };
  }

  if (gameType === 'word-categories') {
    if (!Array.isArray(content.categories)) return null;
    return {
      categories: content.categories.slice(0, 30).map((item) => ({
        name: text(item?.name, 120),
        words: Array.isArray(item?.words)
          ? item.words.slice(0, MAX_ITEMS).map((word) => text(word, 300))
          : [],
      })).filter((item) => item.name),
    };
  }

  return null;
}

module.exports = { sanitizeGameContent };
