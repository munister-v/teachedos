const MODULES = {
  "text-vocab": {
    title: "Create a Text on Any Topic",
    eyebrow: "Reading + Vocabulary · local generator",
    desc: "Створює короткий текст на тему з урахуванням вашої лексики та рівня. Функціонально близько до Twee-модуля для швидкої підготовки reading materials.",
    pill: "CEFR-aligned",
    accent: "#5f7bff",
    meta: "Reading · Vocabulary · A1–C1",
    copyLabel: "Скопіювати текст",
    fields: [
      { type: "textarea", id: "topic", label: "Тема або brief", placeholder: "Напр.: how friendships change after moving to a new city" },
      { type: "textarea", id: "vocabulary", label: "Цільова лексика", placeholder: "supportive, neighbourhood, adjust, routine, lonely" },
      { type: "row", fields: [
        { type: "select", id: "level", label: "Рівень", options: ["A1", "A2", "B1", "B2", "C1"], value: "B1" },
        { type: "select", id: "length", label: "Довжина", options: ["Short", "Medium", "Long"], value: "Medium" }
      ] }
    ]
  },
  "open-questions": {
    title: "Create Open Questions",
    eyebrow: "Reading · comprehension builder",
    desc: "Створює відкриті питання до тексту, щоб перевірити розуміння змісту, деталей і висновків.",
    pill: "Question bank",
    accent: "#4d91ff",
    meta: "Reading · Open-ended · A1–C2",
    copyLabel: "Скопіювати питання",
    fields: [
      { type: "textarea", id: "text", label: "Текст", placeholder: "Вставте текст англійською..." },
      { type: "row", fields: [
        { type: "select", id: "level", label: "Рівень", options: ["A1", "A2", "B1", "B2", "C1", "C2"], value: "B1" },
        { type: "select", id: "count", label: "Кількість", options: ["4", "5", "6", "8"], value: "5" }
      ] }
    ]
  },
  "true-false": {
    title: "Create True/False Statements",
    eyebrow: "Reading · fast check module",
    desc: "Будує true/false твердження для швидкої перевірки розуміння тексту. Частина тверджень навмисно модифікується для перевірки деталей.",
    pill: "Fast assessment",
    accent: "#4fb58b",
    meta: "Reading · T/F · A1–C2",
    copyLabel: "Скопіювати вправу",
    fields: [
      { type: "textarea", id: "text", label: "Текст", placeholder: "Вставте текст англійською..." },
      { type: "row", fields: [
        { type: "select", id: "count", label: "Кількість тверджень", options: ["4", "5", "6", "8"], value: "5" },
        { type: "select", id: "mix", label: "Баланс", options: ["Mixed", "Mostly True", "Mostly False"], value: "Mixed" }
      ] }
    ]
  },
  "discussion-questions": {
    title: "Find Discussion Questions",
    eyebrow: "Speaking · warm-up bank",
    desc: "Генерує набір discussion questions на тему для warm-up, pair work, circles або freer speaking.",
    pill: "Speaking warm-up",
    accent: "#9a67f6",
    meta: "Speaking · Discussion · A1–C2",
    copyLabel: "Скопіювати питання",
    fields: [
      { type: "textarea", id: "topic", label: "Тема", placeholder: "Напр.: social media and attention span" },
      { type: "row", fields: [
        { type: "select", id: "level", label: "Рівень", options: ["A1", "A2", "B1", "B2", "C1", "C2"], value: "B1" },
        { type: "select", id: "count", label: "Кількість", options: ["4", "5", "6", "8"], value: "6" }
      ] },
      { type: "text", id: "context", label: "Контекст уроку", placeholder: "warm-up, debate, pair work, exam speaking..." }
    ]
  },
  "sentence-list": {
    title: "Create a List of Sentences",
    eyebrow: "Vocabulary · sentence builder",
    desc: "Створює приклади речень із цільовою лексикою, щоб потім використати їх у gap-fill, discussion або vocabulary review.",
    pill: "Vocabulary set",
    accent: "#f08d54",
    meta: "Vocabulary · Sentence bank · A1–C2",
    copyLabel: "Скопіювати речення",
    fields: [
      { type: "textarea", id: "vocabulary", label: "Список слів", placeholder: "achieve, deadline, reliable, replace, improve" },
      { type: "row", fields: [
        { type: "select", id: "level", label: "Рівень", options: ["A1", "A2", "B1", "B2", "C1"], value: "B1" },
        { type: "select", id: "tone", label: "Контекст", options: ["General", "School", "Work", "Travel"], value: "General" }
      ] }
    ]
  },
  "fill-gap": {
    title: "Fill in the Gap",
    eyebrow: "Vocabulary + Grammar · gap maker",
    desc: "Перетворює текст на gap-fill вправу: ховає ключові слова, формує word bank і робить матеріал зручним для друку або цифрової перевірки.",
    pill: "Gap generator",
    accent: "#dc6a79",
    meta: "Vocabulary · Grammar · A1–C2",
    copyLabel: "Скопіювати вправу",
    fields: [
      { type: "textarea", id: "text", label: "Текст", placeholder: "Вставте текст англійською..." },
      { type: "textarea", id: "keywords", label: "Які слова приховати", placeholder: "Опційно: comma-separated words. Якщо порожньо, модуль вибере сам." },
      { type: "row", fields: [
        { type: "select", id: "mode", label: "Фокус", options: ["Vocabulary", "Grammar", "Mixed"], value: "Vocabulary" },
        { type: "select", id: "count", label: "Кількість прогалин", options: ["4", "5", "6", "8", "10"], value: "6" }
      ] }
    ]
  },
  "cefr-checker": {
    title: "CEFR Level Checker",
    eyebrow: "Utility · rough analyzer",
    desc: "Дає швидку локальну оцінку рівня тексту за CEFR на основі довжини речень, лексичної щільності та ускладнення словника.",
    pill: "Quick estimate",
    accent: "#7f8a98",
    meta: "Utility · CEFR · rough local estimate",
    copyLabel: "Скопіювати аналіз",
    fields: [
      { type: "textarea", id: "text", label: "Текст для аналізу", placeholder: "Вставте текст англійською..." }
    ]
  }
};

const query = new URLSearchParams(window.location.search);
const activeModuleId = query.get("module") || "open-questions";
const activeModule = MODULES[activeModuleId] || MODULES["open-questions"];
const outputEl = document.getElementById("studio-output");
const emptyEl = document.getElementById("studio-empty");
const metaEl = document.getElementById("studio-meta");
const copyBtn = document.getElementById("studio-copy");
const formEl = document.getElementById("studio-form");

let lastCopyText = "";

function slugWords(input) {
  return input
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tokenizeSentences(text) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.split(/\s+/).length >= 5);
}

function extractWords(text) {
  return Array.from(new Set((text.match(/[A-Za-z][A-Za-z'-]{2,}/g) || []).map((item) => item.toLowerCase())));
}

function sample(list, count) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function setTheme(color) {
  document.body.style.setProperty("--accent", color);
  document.body.style.setProperty("--accent-2", `color-mix(in srgb, ${color} 14%, white 86%)`);
  document.body.style.setProperty("--border", `color-mix(in srgb, ${color} 22%, transparent 78%)`);
  document.body.style.setProperty("--shadow", `0 24px 48px color-mix(in srgb, ${color} 12%, transparent 88%)`);
}

function renderField(field) {
  if (field.type === "row") {
    return `<div class="module-row">${field.fields.map(renderField).join("")}</div>`;
  }

  if (field.type === "textarea") {
    return `
      <div>
        <label class="module-label" for="${field.id}">${field.label}</label>
        <textarea class="module-field textarea" id="${field.id}" placeholder="${field.placeholder || ""}"></textarea>
      </div>
    `;
  }

  if (field.type === "text") {
    return `
      <div>
        <label class="module-label" for="${field.id}">${field.label}</label>
        <input class="module-field" id="${field.id}" type="text" placeholder="${field.placeholder || ""}">
      </div>
    `;
  }

  if (field.type === "select") {
    return `
      <div>
        <label class="module-label" for="${field.id}">${field.label}</label>
        <select class="module-select" id="${field.id}">
          ${field.options.map(option => `<option${option === field.value ? " selected" : ""}>${option}</option>`).join("")}
        </select>
      </div>
    `;
  }

  return "";
}

function initModuleChrome() {
  document.getElementById("studio-eyebrow").textContent = activeModule.eyebrow;
  document.getElementById("studio-title").textContent = activeModule.title;
  document.getElementById("studio-desc").textContent = activeModule.desc;
  document.getElementById("studio-pill").textContent = activeModule.pill;
  setTheme(activeModule.accent);
}

function renderForm() {
  formEl.innerHTML = `
    <div class="module-stack">
      ${activeModule.fields.map(renderField).join("")}
      <div class="module-actions">
        <button class="module-button" type="submit">Згенерувати</button>
      </div>
      <div class="module-help">Локальний режим: усе працює у статичному проєкті без зовнішнього API. Це адаптація під GitHub Pages і TeachedOS.</div>
    </div>
  `;
}

function showResult(meta, html, copyText) {
  metaEl.textContent = meta;
  outputEl.hidden = false;
  emptyEl.hidden = true;
  outputEl.innerHTML = html;
  copyBtn.disabled = false;
  copyBtn.textContent = activeModule.copyLabel;
  lastCopyText = copyText;
}

function levelIntro(level, topic) {
  const cleanTopic = topic.replace(/[.?!]+$/, "");
  const bank = {
    A1: `This text is about ${cleanTopic}. The ideas are simple and clear.`,
    A2: `The topic is ${cleanTopic}. The text gives practical examples and easy explanations.`,
    B1: `The text explores ${cleanTopic} and shows how it affects everyday situations.`,
    B2: `This text examines ${cleanTopic} from several angles and highlights real-life implications.`,
    C1: `The passage analyzes ${cleanTopic} with a more reflective tone and layered examples.`
  };
  return bank[level] || bank.B1;
}

function generateTextWithVocab(values) {
  const topic = values.topic.trim() || "modern learning habits";
  const words = slugWords(values.vocabulary);
  const level = values.level;
  const length = values.length;
  const paragraphs = {
    Short: 1,
    Medium: 2,
    Long: 3
  }[length] || 2;

  const pieces = [levelIntro(level, topic)];
  const sentenceBank = [
    `In class, students often connect ${topic} with their own experience and notice small changes over time.`,
    `A teacher can use the topic to build reading, vocabulary, and discussion tasks in one lesson.`,
    `The most useful part is that learners can describe causes, examples, and personal reactions in clear English.`,
    `When the material feels relevant, students usually participate more actively and remember the target language better.`
  ];

  words.forEach((word, index) => {
    pieces.push(`One key idea is ${word}, which can be introduced naturally through a short example or a classroom scenario.`);
    if (index % 2 === 1) {
      pieces.push(sentenceBank[index % sentenceBank.length]);
    }
  });

  while (pieces.length < paragraphs * 3) {
    pieces.push(sentenceBank[pieces.length % sentenceBank.length]);
  }

  const text = pieces.slice(0, paragraphs * 3).join(" ");
  const html = `
    <div class="module-card">
      <h3>Generated text</h3>
      <p>${text}</p>
      ${words.length ? `<div class="module-tags">${words.map(word => `<span class="module-chip active">${word}</span>`).join("")}</div>` : ""}
    </div>
  `;
  return {
    meta: `${level} · ${paragraphs} paragraph block · ${words.length || 0} target words`,
    html,
    copyText: text
  };
}

function generateOpenQuestions(values) {
  const sentences = tokenizeSentences(values.text);
  const count = Math.min(Number(values.count || 5), Math.max(1, sentences.length));
  const starters = ["Why", "How", "What", "Which detail", "In what way", "What does the text suggest about"];
  const questions = sentences.slice(0, count).map((sentence, index) => {
    const chunk = sentence.replace(/[.?!]+$/, "");
    return `${starters[index % starters.length]} ${chunk.charAt(0).toLowerCase() + chunk.slice(1)}?`;
  });
  const html = `
    <div class="module-card">
      <h3>Open questions</h3>
      <ol>${questions.map(item => `<li>${item}</li>`).join("")}</ol>
    </div>
  `;
  return {
    meta: `${values.level} · ${questions.length} open questions`,
    html,
    copyText: questions.map((item, index) => `${index + 1}. ${item}`).join("\n")
  };
}

function mutateStatement(sentence, pool) {
  const words = sentence.match(/[A-Za-z][A-Za-z'-]{3,}/g) || [];
  if (!words.length || !pool.length) return sentence;
  const target = words[0];
  const replacement = pool.find(item => item.toLowerCase() !== target.toLowerCase()) || target;
  return sentence.replace(new RegExp(`\\b${target}\\b`), replacement);
}

function generateTrueFalse(values) {
  const sentences = tokenizeSentences(values.text);
  const count = Math.min(Number(values.count || 5), Math.max(1, sentences.length));
  const balance = values.mix;
  const pool = extractWords(values.text);
  const rows = sentences.slice(0, count).map((sentence, index) => {
    const shouldBeFalse = balance === "Mostly False"
      ? index % 3 !== 0
      : balance === "Mostly True"
        ? index % 4 === 0
        : index % 2 === 1;
    return {
      text: shouldBeFalse ? mutateStatement(sentence, pool) : sentence,
      answer: shouldBeFalse ? "False" : "True"
    };
  });
  const html = `
    <div class="module-card">
      <h3>True / False exercise</h3>
      <ol>${rows.map(item => `<li>${item.text}</li>`).join("")}</ol>
    </div>
    <div class="module-card">
      <h4>Answer key</h4>
      <ol>${rows.map(item => `<li>${item.answer}</li>`).join("")}</ol>
    </div>
  `;
  return {
    meta: `${rows.length} statements · ${values.mix}`,
    html,
    copyText: [
      "True / False statements:",
      ...rows.map((item, index) => `${index + 1}. ${item.text}`),
      "",
      "Answer key:",
      ...rows.map((item, index) => `${index + 1}. ${item.answer}`)
    ].join("\n")
  };
}

function generateDiscussion(values) {
  const topic = values.topic.trim() || "everyday habits";
  const context = values.context.trim();
  const count = Number(values.count || 6);
  const templates = [
    `What comes to your mind when you think about ${topic}?`,
    `How does ${topic} affect people in everyday life?`,
    `What are the advantages of ${topic}?`,
    `What problems can ${topic} create?`,
    `How do different generations usually react to ${topic}?`,
    `What personal experience do you have with ${topic}?`,
    `Should schools talk more about ${topic}? Why or why not?`,
    `How could ${topic} change in the future?`
  ];
  const questions = templates.slice(0, count).map(item => context ? `${item} (${context})` : item);
  const html = `
    <div class="module-card">
      <h3>Discussion questions</h3>
      <ol>${questions.map(item => `<li>${item}</li>`).join("")}</ol>
    </div>
  `;
  return {
    meta: `${values.level} · ${questions.length} discussion prompts`,
    html,
    copyText: questions.map((item, index) => `${index + 1}. ${item}`).join("\n")
  };
}

function generateSentenceList(values) {
  const words = slugWords(values.vocabulary);
  const tone = values.tone.toLowerCase();
  const questions = words.map((word, index) => {
    const contexts = {
      general: `People often use the word "${word}" when they describe change, plans, or everyday situations.`,
      school: `In school, a student might use "${word}" while talking about a project, lesson, or teacher feedback.`,
      work: `At work, "${word}" can appear in a sentence about deadlines, teamwork, or solving a problem.`,
      travel: `While travelling, "${word}" may be useful when discussing directions, plans, or unexpected situations.`
    };
    return `${index + 1}. ${contexts[tone] || contexts.general}`;
  });
  const html = `
    <div class="module-card">
      <h3>Sentence list</h3>
      <ol>${questions.map(item => `<li>${item.replace(/^\d+\.\s*/, "")}</li>`).join("")}</ol>
    </div>
  `;
  return {
    meta: `${values.level} · ${words.length} target words · ${values.tone}`,
    html,
    copyText: questions.join("\n")
  };
}

function generateGapFill(values) {
  const text = values.text.trim();
  const sentences = tokenizeSentences(text);
  const explicit = slugWords(values.keywords);
  const pool = explicit.length ? explicit : extractWords(text).filter(word => word.length >= 5);
  const selected = sample(pool, Math.min(Number(values.count || 6), pool.length || 0));
  let gappedText = text;
  selected.forEach((word, index) => {
    const gap = `(${index + 1}) ________`;
    gappedText = gappedText.replace(new RegExp(`\\b${word}\\b`, "i"), gap);
  });
  const html = `
    <div class="module-card">
      <h3>Gap-fill text</h3>
      <p>${gappedText}</p>
    </div>
    <div class="module-card">
      <h4>Word bank</h4>
      <div class="module-tags">${selected.map(word => `<span class="module-chip active">${word}</span>`).join("")}</div>
    </div>
  `;
  return {
    meta: `${values.mode} · ${selected.length} gaps · ${sentences.length} source sentences`,
    html,
    copyText: [
      "Gap-fill text:",
      gappedText,
      "",
      "Word bank:",
      selected.join(", ")
    ].join("\n")
  };
}

function generateCefr(values) {
  const text = values.text.trim();
  const words = extractWords(text);
  const sentences = tokenizeSentences(text);
  const avgSentence = sentences.length ? text.split(/\s+/).length / sentences.length : 0;
  const longWords = words.filter(word => word.length >= 8).length;
  const variety = words.length;
  const score = avgSentence + longWords * 0.4 + variety * 0.05;
  let level = "A1";
  if (score > 15) level = "A2";
  if (score > 20) level = "B1";
  if (score > 26) level = "B2";
  if (score > 34) level = "C1";
  if (score > 44) level = "C2";
  const html = `
    <div class="module-card">
      <div class="module-score">Estimated CEFR: ${level}</div>
      <div class="module-kpi">
        <div class="module-kpi-card"><div class="module-label">Sentences</div><strong>${sentences.length}</strong></div>
        <div class="module-kpi-card"><div class="module-label">Avg words / sentence</div><strong>${avgSentence.toFixed(1)}</strong></div>
        <div class="module-kpi-card"><div class="module-label">Long words</div><strong>${longWords}</strong></div>
      </div>
    </div>
    <div class="module-card">
      <h4>Why this level?</h4>
      <ul>
        <li>Локальна оцінка дивиться на довжину речень, насиченість словника і кількість довгих слів.</li>
        <li>Це орієнтир для teacher workflow, а не офіційна сертифікаційна перевірка.</li>
        <li>Найкраще використовувати разом із власною педагогічною оцінкою тексту.</li>
      </ul>
    </div>
  `;
  return {
    meta: `${level} · ${words.length} unique words · rough estimate`,
    html,
    copyText: `Estimated CEFR: ${level}\nSentences: ${sentences.length}\nAvg words / sentence: ${avgSentence.toFixed(1)}\nLong words: ${longWords}\nUnique words: ${words.length}`
  };
}

function readValues() {
  const values = {};
  activeModule.fields.forEach((field) => {
    if (field.type === "row") {
      field.fields.forEach((subField) => {
        values[subField.id] = document.getElementById(subField.id).value;
      });
      return;
    }
    values[field.id] = document.getElementById(field.id).value;
  });
  return values;
}

function generateModule(values) {
  if (activeModuleId === "text-vocab") return generateTextWithVocab(values);
  if (activeModuleId === "open-questions") return generateOpenQuestions(values);
  if (activeModuleId === "true-false") return generateTrueFalse(values);
  if (activeModuleId === "discussion-questions") return generateDiscussion(values);
  if (activeModuleId === "sentence-list") return generateSentenceList(values);
  if (activeModuleId === "fill-gap") return generateGapFill(values);
  if (activeModuleId === "cefr-checker") return generateCefr(values);
  return {
    meta: "Unknown module",
    html: `<div class="module-card"><p>Модуль ще не підключений.</p></div>`,
    copyText: ""
  };
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = readValues();
  const result = generateModule(values);
  showResult(result.meta, result.html, result.copyText);
});

copyBtn.addEventListener("click", () => {
  if (!lastCopyText) return;
  navigator.clipboard.writeText(lastCopyText);
  copyBtn.textContent = "Скопійовано";
  window.setTimeout(() => {
    copyBtn.textContent = activeModule.copyLabel;
  }, 1400);
});

initModuleChrome();
renderForm();
