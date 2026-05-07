const PERSONAS = window.TEACHEDOS_GAME_DATA.opinionPersonas;
const LENGTH_CONFIGS = window.TEACHEDOS_GAME_DATA.opinionLengthConfigs;
const LEVEL_LIBRARY = window.TEACHEDOS_GAME_DATA.opinionLevelLibrary;

let activeOpinions = [];

function normaliseTopic(topic) {
  return topic.trim().replace(/\s+/g, " ");
}

function getLengthConfig(length) {
  return LENGTH_CONFIGS[length] || LENGTH_CONFIGS.medium;
}

function levelPhrase(level, personaIndex, topic) {
  const plainTopic = topic.endsWith("?") ? topic.slice(0, -1) : topic;
  const phrases = LEVEL_LIBRARY[level] || LEVEL_LIBRARY.B1;
  return phrases[personaIndex].replaceAll("TOPIC", plainTopic);
}

function buildOpinion(persona, level, length, topic, personaIndex) {
  const base = levelPhrase(level, personaIndex, topic);
  const lengthConfig = getLengthConfig(length);
  let text = base + lengthConfig.extra;

  if (personaIndex === 1 && length !== "short") {
    text += " Students may follow the rule, but they might not become more engaged.";
  }
  if (personaIndex === 2 && length === "long") {
    text += " A flexible approach is often more realistic than a strict yes-or-no policy.";
  }
  if (personaIndex === 3) {
    text += " Good instructions, timing, and follow-up tasks matter more than slogans.";
  }

  if (lengthConfig.tail) {
    text += lengthConfig.tail;
  }

  return {
    persona,
    text
  };
}

function generateOpinions(topic, level, length) {
  return PERSONAS.map((persona, index) => buildOpinion(persona, level, length, topic, index));
}

function renderOpinions(opinions, level) {
  const opinionsEl = document.getElementById("opinions");
  const emptyEl = document.getElementById("opinions-empty");
  const metaEl = document.getElementById("results-meta");
  const copyAllBtn = document.getElementById("copy-all-btn");

  activeOpinions = opinions;
  emptyEl.hidden = true;
  opinionsEl.hidden = false;
  copyAllBtn.disabled = false;
  metaEl.textContent = level + " · " + opinions.length + " точки зору · English output";

  opinionsEl.innerHTML = opinions.map((item) => {
    const persona = item.persona;
    return (
      '<article class="opinion-card">' +
        '<div class="opinion-head">' +
          '<div class="persona">' +
            '<span class="avatar" style="background:' + persona.color + ';">' + persona.id + "</span>" +
            '<div><strong style="display:block;">' + persona.id + " " + persona.name + '</strong><span class="tag" style="background:' + persona.bg + ";color:" + persona.color + ';">' + persona.label + "</span></div>" +
          "</div>" +
          '<button class="copy-btn copy-one-btn" type="button" data-copy-text="' + item.text.replace(/"/g, "&quot;") + '">Copy</button>' +
        "</div>" +
        '<div class="opinion-text">' + item.text + "</div>" +
      "</article>"
    );
  }).join("");
}

function formatAllOpinions() {
  return activeOpinions.map((item) => {
    return item.persona.id + " " + item.persona.name + "\n" + item.text;
  }).join("\n\n");
}

document.getElementById("opinions-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const topic = normaliseTopic(document.getElementById("topic").value);
  const level = document.getElementById("level").value;
  const length = document.getElementById("length").value;

  if (!topic) return;
  renderOpinions(generateOpinions(topic, level, length), level);
});

document.getElementById("opinions").addEventListener("click", (event) => {
  const button = event.target.closest(".copy-one-btn");
  if (!button) return;
  navigator.clipboard.writeText(button.dataset.copyText);
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.textContent = "Copy";
  }, 1400);
});

document.getElementById("copy-all-btn").addEventListener("click", () => {
  navigator.clipboard.writeText(formatAllOpinions());
  const button = document.getElementById("copy-all-btn");
  button.textContent = "Скопійовано";
  window.setTimeout(() => {
    button.textContent = "Скопіювати все";
  }, 1400);
});
