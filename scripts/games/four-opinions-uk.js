const PERSONAS = [
  { id: "A", name: "Alex", label: "Підтримує", color: "var(--positive)", bg: "rgba(20,155,113,0.12)" },
  { id: "B", name: "Bianca", label: "Критикує", color: "var(--negative)", bg: "rgba(217,94,94,0.12)" },
  { id: "C", name: "Chris", label: "Змішана позиція", color: "var(--balanced)", bg: "rgba(154,111,241,0.12)" },
  { id: "D", name: "Dana", label: "Практичний погляд", color: "var(--practical)", bg: "rgba(59,130,246,0.12)" }
];

let activeOpinions = [];

function normaliseTopic(topic) {
  return topic.trim().replace(/\s+/g, " ");
}

function getLengthConfig(length) {
  if (length === "short") return { extra: "", tail: "" };
  if (length === "long") {
    return {
      extra: " It can affect motivation, classroom atmosphere, and how confident students feel when they speak.",
      tail: " In my view, the best classroom tasks give students a reason to explain and react, not just repeat one line."
    };
  }
  return {
    extra: " It changes how students take part in the lesson.",
    tail: ""
  };
}

function levelPhrase(level, personaIndex, topic) {
  const plainTopic = topic.endsWith("?") ? topic.slice(0, -1) : topic;

  const library = {
    A1: [
      "I think " + plainTopic + " is a good idea. It helps students and makes lessons easier.",
      "I do not like " + plainTopic + ". It can be stressful and not every student needs it.",
      "I can see good and bad sides. It may help some people, but it may also cause problems.",
      "For me, the main point is simple: teachers need clear rules and students need a fair system."
    ],
    A2: [
      "I think " + plainTopic + " is useful because it can make lessons more focused and more organised.",
      "I am not convinced about " + plainTopic + " because it may create pressure and reduce natural interest.",
      "There are advantages and disadvantages. It may work in one school, but not in another.",
      "In practice, success depends on the rules, the teacher, and the age of the students."
    ],
    B1: [
      "I support " + plainTopic + " because it can improve concentration and give the class a clearer structure.",
      "I disagree with " + plainTopic + " because students also need trust, choice, and a realistic learning environment.",
      "I have mixed feelings about " + plainTopic + " because the idea sounds helpful, but the results may depend on context.",
      "From a practical point of view, " + plainTopic + " only works when expectations are clear for everyone."
    ],
    B2: [
      "On the whole, I support " + plainTopic + " because it can raise academic focus and reduce unnecessary distractions.",
      "I remain critical of " + plainTopic + " because it may ignore individual needs and oversimplify a complex issue.",
      "My view is balanced: " + plainTopic + " could be effective, yet it may also produce side effects if applied too rigidly.",
      "What matters most is implementation. Even a sensible idea like " + plainTopic + " can fail without thoughtful planning."
    ],
    C1: [
      "Broadly speaking, I am in favour of " + plainTopic + " because it can reinforce purpose, clarity, and sustained attention in the classroom.",
      "I am sceptical about " + plainTopic + " since it risks treating a nuanced educational question as if one rule could solve everything.",
      "My position is ambivalent: " + plainTopic + " has merit, although its impact depends heavily on context, age group, and classroom culture.",
      "From a pragmatic perspective, the debate is less about principle and more about whether the policy is implemented intelligently."
    ]
  };

  return library[level][personaIndex];
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
