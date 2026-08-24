const STOPWORDS = new Set(window.TEACHEDOS_GAME_DATA.quizStopwords);

const questionsEl = document.getElementById("questions");
const emptyStateEl = document.getElementById("empty-state");
const quizMetaEl = document.getElementById("quiz-meta");
const copyBtn = document.getElementById("copy-btn");

let activeQuiz = null;

function normaliseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractSentences(text) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normaliseWhitespace(sentence))
    .filter((sentence) => sentence.split(/\s+/).length >= 6);
}

function extractKeywords(sentence) {
  const words = (sentence.match(/[A-Za-z][A-Za-z'-]{3,}/g) || [])
    .map((word) => word.replace(/['’-]+$/g, ""))
    .filter((word) => !STOPWORDS.has(word.toLowerCase()));

  const seen = new Set();
  return words.filter((word) => {
    const key = word.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createQuestion(sentence, index, globalPool) {
  const keyword = extractKeywords(sentence)[0];
  if (!keyword) return null;

  const distractors = shuffle(globalPool)
    .filter((word) => word.toLowerCase() !== keyword.toLowerCase())
    .slice(0, 3);
  if (distractors.length < 3) return null;

  const blankSentence = sentence.replace(
    new RegExp("\\b" + keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"),
    "_____"
  );
  const options = shuffle([keyword].concat(distractors));

  return {
    id: "q-" + (index + 1),
    questionStem: "Complete the sentence with a word from this text.",
    prompt: blankSentence,
    options,
    correctAnswerIndex: options.findIndex((option) => option.toLowerCase() === keyword.toLowerCase()),
    explanation: 'The missing word is "' + keyword + '". Every option comes from the text you provided.',
    questionType: "Source cloze"
  };
}

function buildQuiz(text, level, count) {
  const sentences = extractSentences(text);
  if (!sentences.length) {
    throw new Error("Вставте щонайменше одне повне англомовне речення з шістьма або більше словами.");
  }

  const globalPool = Array.from(new Map(
    sentences.flatMap((sentence) => extractKeywords(sentence)).map((word) => [word.toLowerCase(), word])
  ).values());
  if (globalPool.length < 4) {
    throw new Error("У тексті потрібно щонайменше чотири змістовні англійські слова, щоб зібрати чесні варіанти відповіді.");
  }

  const questionTotal = Math.min(Number(count), sentences.length);
  const questions = sentences
    .slice(0, questionTotal)
    .map((sentence, index) => createQuestion(sentence, index, globalPool))
    .filter(Boolean);

  if (!questions.length) {
    throw new Error("Додайте речення зі змістовними англійськими словами. Усі варіанти відповіді мають походити лише з вашого тексту.");
  }

  return {
    title: "Source Cloze Quiz",
    level,
    questions
  };
}

function formatQuizForCopy(quiz) {
  const letters = ["A", "B", "C", "D"];
  return [
    "Title: " + quiz.title,
    "Level: " + quiz.level,
    "Number of questions: " + quiz.questions.length,
    "",
    "Instructions for students:",
    "Complete each sentence with one word from the source text. There is one correct answer.",
    "",
    quiz.questions.map((question, index) => [
      index + 1 + ". " + question.questionStem,
      question.prompt,
      "",
      question.options.map((option, optionIndex) => letters[optionIndex] + ". " + option).join("\n"),
      "",
      "Correct answer: " + letters[question.correctAnswerIndex],
      "Explanation: " + question.explanation
    ].join("\n")).join("\n\n")
  ].join("\n");
}

function renderQuiz(quiz) {
  const letters = ["A", "B", "C", "D"];
  quizMetaEl.textContent = quiz.level + " · " + quiz.questions.length + " завдань · локальне перетворення тексту";
  emptyStateEl.hidden = true;
  questionsEl.hidden = false;
  copyBtn.disabled = false;

  questionsEl.innerHTML = quiz.questions.map((question, index) => (
    '<article class="question-card" data-question-id="' + escapeHtml(question.id) + '">' +
      '<div class="question-head">' +
        '<div class="question-title">' +
          '<span class="number">' + (index + 1) + "</span>" +
          '<div><strong style="display:block;margin-bottom:6px;">' + escapeHtml(question.questionStem) + "</strong>" +
          '<div style="color: var(--muted); line-height: 1.65;">' + escapeHtml(question.prompt) + "</div></div>" +
        "</div>" +
        '<span class="type-badge">' + escapeHtml(question.questionType) + "</span>" +
      "</div>" +
      '<div class="options">' +
        question.options.map((option, optionIndex) => (
          '<button class="option-btn" type="button" data-option-index="' + optionIndex + '">' +
            '<strong style="min-width:22px;color:var(--accent);">' + letters[optionIndex] + ".</strong>" +
            '<span>' + escapeHtml(option) + "</span>" +
          "</button>"
        )).join("") +
      "</div>" +
      '<div class="explanation" hidden><strong style="display:block;margin-bottom:6px;color:var(--text);">Explanation</strong>' + escapeHtml(question.explanation) + "</div>" +
    "</article>"
  )).join("");
}

function handleQuestionClick(event) {
  const optionButton = event.target.closest(".option-btn");
  if (!optionButton || !activeQuiz) return;

  const card = event.target.closest(".question-card");
  const question = activeQuiz.questions.find((item) => item.id === card.dataset.questionId);
  if (!question) return;

  const choice = Number(optionButton.dataset.optionIndex);
  const buttons = card.querySelectorAll(".option-btn");
  buttons.forEach((button, index) => {
    button.disabled = true;
    if (index === question.correctAnswerIndex) button.classList.add("correct");
    else if (index === choice) button.classList.add("wrong");
    else button.classList.add("neutral");
  });

  card.querySelector(".explanation").hidden = false;
}

document.getElementById("quiz-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const text = document.getElementById("source-text").value.trim();
  const level = document.getElementById("level").value;
  const count = document.getElementById("count").value;

  try {
    activeQuiz = buildQuiz(text, level, count);
    renderQuiz(activeQuiz);
  } catch (error) {
    activeQuiz = null;
    questionsEl.hidden = true;
    questionsEl.innerHTML = "";
    emptyStateEl.hidden = false;
    emptyStateEl.textContent = error.message;
    quizMetaEl.textContent = "Перетворення не виконано.";
    copyBtn.disabled = true;
  }
});

questionsEl.addEventListener("click", handleQuestionClick);

copyBtn.addEventListener("click", () => {
  if (!activeQuiz) return;
  navigator.clipboard.writeText(formatQuizForCopy(activeQuiz));
  copyBtn.textContent = "Скопійовано";
  window.setTimeout(() => {
    copyBtn.textContent = "Скопіювати текст";
  }, 1600);
});
