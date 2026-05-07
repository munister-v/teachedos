const THEMES = [
  {
    id: "science",
    name: "Наукові терміни",
    pairs: [
      { id: "s1", term: "Photosynthesis", definition: "процес, у якому рослини перетворюють світло на енергію" },
      { id: "s2", term: "Mitochondria", definition: "частина клітини, що виробляє енергію" },
      { id: "s3", term: "Gravity", definition: "сила, що притягує тіла з масою" },
      { id: "s4", term: "Velocity", definition: "швидкість із зазначеним напрямком" },
      { id: "s5", term: "Atom", definition: "найменша одиниця хімічного елемента" },
      { id: "s6", term: "Osmosis", definition: "рух води крізь напівпроникну мембрану" },
      { id: "s7", term: "Pi (π)", definition: "відношення довжини кола до його діаметра" },
      { id: "s8", term: "Haiku", definition: "японський вірш із сімнадцяти складів" }
    ]
  },
  {
    id: "geo",
    name: "Країни та столиці",
    pairs: [
      { id: "g1", term: "France", definition: "Paris" },
      { id: "g2", term: "Japan", definition: "Tokyo" },
      { id: "g3", term: "Brazil", definition: "Brasilia" },
      { id: "g4", term: "Australia", definition: "Canberra" },
      { id: "g5", term: "Egypt", definition: "Cairo" },
      { id: "g6", term: "Canada", definition: "Ottawa" },
      { id: "g7", term: "Italy", definition: "Rome" },
      { id: "g8", term: "Germany", definition: "Berlin" }
    ]
  },
  {
    id: "coding",
    name: "Основи програмування",
    pairs: [
      { id: "c1", term: "Variable", definition: "контейнер для збереження значень" },
      { id: "c2", term: "Loop", definition: "повторення одного й того самого блоку коду" },
      { id: "c3", term: "Function", definition: "блок коду, який виконує окреме завдання" },
      { id: "c4", term: "Array", definition: "структура, що містить кілька значень" },
      { id: "c5", term: "Boolean", definition: "тип даних із двома значеннями: true або false" },
      { id: "c6", term: "API", definition: "набір правил для взаємодії між програмами" },
      { id: "c7", term: "Bug", definition: "помилка або дефект у програмі" },
      { id: "c8", term: "Git", definition: "розподілена система контролю версій" }
    ]
  }
];

const DEFAULT_LIVES = 5;

let state = {
  themeId: THEMES[0].id,
  cards: [],
  selectedIds: [],
  lives: DEFAULT_LIVES,
  matches: 0,
  elapsed: 0,
  timerId: null,
  startedAt: 0,
  locked: false,
  status: "ready"
};

const themeSelect = document.getElementById("theme-select");
const cardsEl = document.getElementById("cards");
const timeEl = document.getElementById("time");
const matchesEl = document.getElementById("matches");
const livesEl = document.getElementById("lives");
const hintEl = document.getElementById("hint");
const modalEl = document.getElementById("result-modal");

function shuffle(list) {
  const clone = [...list];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function getTheme() {
  return THEMES.find((theme) => theme.id === state.themeId) || THEMES[0];
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return minutes + ":" + seconds;
}

function fillThemeOptions() {
  themeSelect.innerHTML = THEMES.map((theme) => (
    '<option value="' + theme.id + '">' + theme.name + "</option>"
  )).join("");
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startTimer() {
  if (state.timerId) return;
  state.status = "playing";
  state.startedAt = Date.now() - state.elapsed * 1000;
  state.timerId = window.setInterval(() => {
    state.elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
    timeEl.textContent = formatTime(state.elapsed);
  }, 1000);
}

function buildCards() {
  const theme = getTheme();
  const cards = [];
  theme.pairs.forEach((pair) => {
    cards.push({
      id: pair.id + "-term",
      pairId: pair.id,
      type: "term",
      label: "Термін",
      text: pair.term,
      status: "idle"
    });
    cards.push({
      id: pair.id + "-definition",
      pairId: pair.id,
      type: "definition",
      label: "Визначення",
      text: pair.definition,
      status: "idle"
    });
  });
  return shuffle(cards);
}

function resetGame() {
  stopTimer();
  state.cards = buildCards();
  state.selectedIds = [];
  state.lives = DEFAULT_LIVES;
  state.matches = 0;
  state.elapsed = 0;
  state.startedAt = 0;
  state.locked = false;
  state.status = "ready";
  timeEl.textContent = "00:00";
  renderStats();
  renderCards();
  closeModal();
  hintEl.textContent = "Натисніть на картку, щоб почати гру.";
}

function renderStats() {
  const totalPairs = getTheme().pairs.length;
  matchesEl.textContent = state.matches + " / " + totalPairs;
  livesEl.textContent = String(state.lives);
}

function renderCards() {
  cardsEl.innerHTML = state.cards.map((card) => {
    return (
      '<button class="card ' + card.status + '" data-id="' + card.id + '" type="button">' +
        '<span class="card-type">' + card.label + '</span>' +
        '<span class="card-text">' + card.text + "</span>" +
      "</button>"
    );
  }).join("");
}

function updateCardStatus(cardIds, nextStatus) {
  state.cards = state.cards.map((card) => {
    return cardIds.includes(card.id) ? { ...card, status: nextStatus } : card;
  });
  renderCards();
}

function checkEndState() {
  const totalPairs = getTheme().pairs.length;
  if (state.matches === totalPairs) {
    stopTimer();
    state.status = "won";
    showResult(true);
    return;
  }
  if (state.lives === 0) {
    stopTimer();
    state.status = "lost";
    showResult(false);
  }
}

function showResult(isWin) {
  document.getElementById("result-icon").textContent = isWin ? "🎉" : "💔";
  document.getElementById("result-title").textContent = isWin ? "Усі пари знайдено!" : "Життя закінчилися";
  document.getElementById("result-text").textContent = isWin
    ? "Ви впоралися за " + state.elapsed + " с та зберегли " + state.lives + " житт. Сильний результат."
    : "Спроба завершена, але прогрес збережено. Перезапустіть гру та спробуйте іншу стратегію.";
  document.getElementById("modal-time").textContent = state.elapsed + " с";
  document.getElementById("modal-pairs").textContent = state.matches + " / " + getTheme().pairs.length;
  modalEl.classList.add("open");
  modalEl.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modalEl.classList.remove("open");
  modalEl.setAttribute("aria-hidden", "true");
}

function handleCardClick(cardId) {
  if (state.locked || state.status === "won" || state.status === "lost") return;
  const card = state.cards.find((item) => item.id === cardId);
  if (!card || card.status !== "idle") return;

  if (state.status === "ready") {
    startTimer();
    hintEl.textContent = "Знайдіть відповідність між терміном і поясненням.";
  }

  card.status = "selected";
  state.selectedIds.push(cardId);
  renderCards();

  if (state.selectedIds.length < 2) return;

  const [firstId, secondId] = state.selectedIds;
  const first = state.cards.find((item) => item.id === firstId);
  const second = state.cards.find((item) => item.id === secondId);
  state.selectedIds = [];

  if (!first || !second) return;

  state.locked = true;
  const isMatch = first.pairId === second.pairId && first.type !== second.type;

  window.setTimeout(() => {
    if (isMatch) {
      updateCardStatus([first.id, second.id], "matched");
      state.matches += 1;
      hintEl.textContent = "Є збіг. Продовжуйте!";
    } else {
      updateCardStatus([first.id, second.id], "wrong");
      state.lives = Math.max(0, state.lives - 1);
      hintEl.textContent = "Не збіглося. Спробуйте іншу пару.";
      window.setTimeout(() => {
        updateCardStatus([first.id, second.id], "idle");
        state.locked = false;
      }, 800);
    }
    renderStats();
    if (isMatch) state.locked = false;
    checkEndState();
  }, 380);
}

fillThemeOptions();
themeSelect.addEventListener("change", (event) => {
  state.themeId = event.target.value;
  resetGame();
});

document.getElementById("restart-btn").addEventListener("click", resetGame);
document.getElementById("play-again-btn").addEventListener("click", resetGame);
cardsEl.addEventListener("click", (event) => {
  const button = event.target.closest(".card");
  if (!button) return;
  handleCardClick(button.dataset.id);
});

resetGame();
