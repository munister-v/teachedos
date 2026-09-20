const THEMES = window.TEACHEDOS_GAME_DATA.matchThemes;

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    '<option value="' + escapeHtml(theme.id) + '">' + escapeHtml(theme.name) + "</option>"
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

/* Свой список идёт раундами по CUSTOM_ROUND пар через весь список: срез до
   восьми оставлял слова учителя за бортом. Следующий раунд начинается только
   после выигранного; проигранный переигрывается тем же набором. */
const CUSTOM_ROUND = 8;
let customAll = null, customDeck = [], customRound = 0, customWon = false;
function customRoundsTotal() { return Math.max(1, Math.ceil(customDeck.length / CUSTOM_ROUND)); }
function loadCustomRound() {
  if (!customAll || state.themeId !== "custom") return;
  if (!customDeck.length || (customWon && customRound + 1 >= customRoundsTotal())) {
    customDeck = shuffle(customAll); customRound = 0;
  } else if (customWon) customRound += 1;
  customWon = false;
  const theme = THEMES.find((t) => t.id === "custom");
  if (theme) theme.pairs = customDeck.slice(customRound * CUSTOM_ROUND, (customRound + 1) * CUSTOM_ROUND);
}

function resetGame() {
  loadCustomRound();
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
      '<button class="card ' + escapeHtml(card.status) + '" data-id="' + escapeHtml(card.id) + '" type="button">' +
        '<span class="card-type">' + escapeHtml(card.label) + '</span>' +
        '<span class="card-text">' + escapeHtml(card.text) + "</span>" +
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
    if (customAll && state.themeId === "custom") customWon = true;
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
  if (isWin && customAll && state.themeId === "custom") {
    const more = customRound + 1 < customRoundsTotal();
    document.getElementById("result-title").textContent = more
      ? "Round " + (customRound + 1) + " of " + customRoundsTotal() + " done"
      : "All " + customDeck.length + " pairs matched!";
    const again = document.getElementById("play-again-btn");
    if (again) again.textContent = more ? "Next " + Math.min(CUSTOM_ROUND, customDeck.length - (customRound + 1) * CUSTOM_ROUND) + " pairs" : "Play again";
  }
  modalEl.classList.add("open");
  modalEl.setAttribute("aria-hidden", "false");
  try { window.parent.postMessage({ type: "game-finished", score: state.matches, max: getTheme().pairs.length, time: state.elapsed, game: "Match up", status: "done" }, "*"); } catch (e) {}
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

// ── Custom content + board integration (Wordwall-style: one word list) ──────
function applyCustomContent(content, title) {
  const pairs = ((content && content.pairs) || [])
    .map((p, i) => ({ id: "c" + i, term: String(p.a || p.term || p.word || "").trim(), definition: String(p.b || p.definition || p.d || "").trim() }))
    .filter((p) => p.term && p.definition);
  if (pairs.length < 2) return;
  customAll = pairs; customDeck = []; customRound = 0; customWon = false;
  const theme = { id: "custom", name: title || "Custom set", pairs: pairs.slice(0, CUSTOM_ROUND) };
  const idx = THEMES.findIndex((t) => t.id === "custom");
  if (idx >= 0) THEMES[idx] = theme; else THEMES.push(theme);
  state.themeId = "custom";
  fillThemeOptions();
  themeSelect.value = "custom";
  if (title) { document.title = title + " · Match up"; const h = document.querySelector("h1"); if (h) h.textContent = title; }
  resetGame();
}
window.addEventListener("message", (e) => {
  if (e.data && e.data.type === "teachedos-custom-game-content") applyCustomContent(e.data.content, e.data.title);
});
try { window.parent.postMessage({ type: "game-ready" }, "*"); } catch (e) {}
