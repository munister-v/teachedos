const FOCUS_OPTIONS = [
  "Main Idea",
  "Detailed Comprehension",
  "Vocabulary in Context",
  "Inference / Implication",
  "Grammar in Context",
  "Exam Style"
];

const STOPWORDS = new Set([
  "the", "and", "that", "with", "from", "this", "have", "were", "they", "their", "there",
  "about", "would", "could", "should", "because", "which", "while", "where", "when",
  "what", "your", "into", "been", "than", "them", "then", "also", "only", "some",
  "many", "more", "most", "such", "very", "much", "over", "after", "before", "during",
  "between", "through", "other", "these", "those", "each", "just", "like", "will",
  "students", "student", "teacher", "teachers", "lesson", "lessons", "language", "english"
]);

const focusGrid = document.getElementById("focus-grid");
const questionsEl = document.getElementById("questions");
const emptyStateEl = document.getElementById("empty-state");
const quizMetaEl = document.getElementById("quiz-meta");
const copyBtn = document.getElementById("copy-btn");

let activeQuiz = null;
let selectedFocus = ["Detailed Comprehension", "Vocabulary in Context"];

function renderFocusOptions() {
  focusGrid.innerHTML = FOCUS_OPTIONS.map((label) => {
    const active = selectedFocus.includes(label) ? " active" : "";
    return '<button class="focus-chip' + active + '" data-focus="' + label + '" type="button">' + label + "</button>";
  }).join("");
}

function normaliseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
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

function chooseKeyword(sentence, globalPool) {
  const keywords = extractKeywords(sentence);
  if (keywords.length) return keywords[0];
  return globalPool[0] || "answer";
}

function createDistractors(correctWord, globalPool) {
  const fallback = ["practice", "context", "support", "detail", "speaker", "classroom", "meaning"];
  const source = shuffle(globalPool.concat(fallback))
    .filter((word) => word.toLowerCase() !== correctWord.toLowerCase());

  const unique = [];
  source.forEach((word) => {
    if (unique.length >= 3) return;
    if (!unique.some((item) => item.toLowerCase() === word.toLowerCase())) {
      unique.push(word);
    }
  });
  return unique;
}

function createQuestion(sentence, index, focusLabel, globalPool) {
  const keyword = chooseKeyword(sentence, globalPool);
  const blankSentence = sentence.replace(new RegExp("\\b" + keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"), "_____");
  const distractors = createDistractors(keyword, globalPool);
  const options = shuffle([keyword].concat(distractors)).slice(0, 4);
  const correctAnswerIndex = options.findIndex((option) => option.toLowerCase() === keyword.toLowerCase());

  return {
    id: "q-" + (index + 1),
    questionStem: "Choose the word that best completes the sentence.",
    prompt: blankSentence,
    options,
    correctAnswerIndex,
    explanation: 'The missing word is "' + keyword + '" because it appears in the original sentence and preserves the exact meaning of the text.',
    questionType: focusLabel
  };
}

function buildQuiz(text, level, count, instructions) {
  const sentences = extractSentences(text);
  if (!sentences.length) {
    throw new Error("Потрібно щонайменше 1-2 повні речення англійською мовою.");
  }

  const globalPool = Array.from(new Set(
    sentences.flatMap((sentence) => extractKeywords(sentence))
  ));

  const questionTotal = Math.min(Number(count), sentences.length);
  const focusSequence = selectedFocus.length ? selectedFocus : ["Detailed Comprehension"];
  const questions = [];

  for (let i = 0; i < questionTotal; i += 1) {
    const sentence = sentences[i % sentences.length];
    const focusLabel = focusSequence[i % focusSequence.length];
    questions.push(createQuestion(sentence, i, focusLabel, globalPool));
  }

  return {
    title: "Multiple-Choice Questions for Your Text",
    level,
    instructions,
    questions
  };
}

function formatQuizForCopy(quiz) {
  const letters = ["A", "B", "C", "D"];
  const instructionLine = quiz.instructions
    ? "\nTeacher note: " + quiz.instructions + "\n"
    : "\n";

  return [
    "Title: " + quiz.title,
    "Level: " + quiz.level,
    "Number of questions: " + quiz.questions.length,
    instructionLine.trim(),
    "Instructions for students:",
    "Choose the correct answer (A, B, C, or D). There is only one correct answer for each question.",
    "",
    quiz.questions.map((question, index) => {
      return [
        index + 1 + ". " + question.questionStem,
        question.prompt,
        "",
        question.options.map((option, optionIndex) => letters[optionIndex] + ". " + option).join("\n"),
        "",
        "Question type: " + question.questionType,
        "Correct answer: " + letters[question.correctAnswerIndex],
        "Explanation: " + question.explanation
      ].join("\n");
    }).join("\n\n")
  ].filter(Boolean).join("\n");
}

function renderQuiz(quiz) {
  const letters = ["A", "B", "C", "D"];
  quizMetaEl.textContent = quiz.level + " · " + quiz.questions.length + " запитань · локальна генерація";
  emptyStateEl.hidden = true;
  questionsEl.hidden = false;
  copyBtn.disabled = false;

  questionsEl.innerHTML = quiz.questions.map((question, index) => {
    return (
      '<article class="question-card" data-question-id="' + question.id + '">' +
        '<div class="question-head">' +
          '<div class="question-title">' +
            '<span class="number">' + (index + 1) + "</span>" +
            '<div><strong style="display:block;margin-bottom:6px;">' + question.questionStem + "</strong>" +
            '<div style="color: var(--muted); line-height: 1.65;">' + question.prompt + "</div></div>" +
          "</div>" +
          '<span class="type-badge">' + question.questionType + "</span>" +
        "</div>" +
        '<div class="options">' +
          question.options.map((option, optionIndex) => {
            return '<button class="option-btn" type="button" data-option-index="' + optionIndex + '">' +
              '<strong style="min-width:22px;color:var(--accent);">' + letters[optionIndex] + ".</strong>" +
              '<span>' + option + "</span>" +
            "</button>";
          }).join("") +
        "</div>" +
        '<div class="explanation" hidden><strong style="display:block;margin-bottom:6px;color:var(--text);">Explanation</strong>' + question.explanation + "</div>" +
      "</article>"
    );
  }).join("");
}

function handleQuestionClick(event) {
  const optionButton = event.target.closest(".option-btn");
  if (!optionButton) return;

  const card = event.target.closest(".question-card");
  const questionId = card.dataset.questionId;
  const question = activeQuiz.questions.find((item) => item.id === questionId);
  if (!question) return;

  const choice = Number(optionButton.dataset.optionIndex);
  const buttons = card.querySelectorAll(".option-btn");
  buttons.forEach((button, index) => {
    button.disabled = true;
    if (index === question.correctAnswerIndex) {
      button.classList.add("correct");
    } else if (index === choice) {
      button.classList.add("wrong");
    } else {
      button.classList.add("neutral");
    }
  });

  const explanation = card.querySelector(".explanation");
  explanation.hidden = false;
}

focusGrid.addEventListener("click", (event) => {
  const chip = event.target.closest(".focus-chip");
  if (!chip) return;
  const focus = chip.dataset.focus;
  if (selectedFocus.includes(focus)) {
    if (selectedFocus.length > 1) {
      selectedFocus = selectedFocus.filter((item) => item !== focus);
    }
  } else {
    selectedFocus = selectedFocus.concat(focus);
  }
  renderFocusOptions();
});

document.getElementById("quiz-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const text = document.getElementById("source-text").value.trim();
  const level = document.getElementById("level").value;
  const count = document.getElementById("count").value;
  const instructions = document.getElementById("instructions").value.trim();

  try {
    activeQuiz = buildQuiz(text, level, count, instructions);
    renderQuiz(activeQuiz);
  } catch (error) {
    activeQuiz = null;
    questionsEl.hidden = true;
    questionsEl.innerHTML = "";
    emptyStateEl.hidden = false;
    emptyStateEl.textContent = error.message;
    quizMetaEl.textContent = "Генерація не виконана.";
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

renderFocusOptions();
