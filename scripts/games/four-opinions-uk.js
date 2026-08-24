const FOUR_OPINIONS_TOOL_ID = "four-opinions";
const DRAFT_STORE = "teachedos_teacher_tools_drafts";

function normaliseInput(value) {
  return value.trim().replace(/\s+/g, " ");
}

function readDrafts() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_STORE) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveHandoffDraft(fields) {
  const drafts = readDrafts();
  drafts[FOUR_OPINIONS_TOOL_ID] = {
    updatedAt: new Date().toISOString(),
    fields
  };
  localStorage.setItem(DRAFT_STORE, JSON.stringify(drafts));
}

function setFormError(message, field) {
  const error = document.getElementById("form-error");
  error.textContent = message;
  error.hidden = false;
  field.setAttribute("aria-invalid", "true");
  field.focus();
}

function clearFormError() {
  document.getElementById("form-error").hidden = true;
  document.querySelectorAll("[aria-invalid='true']").forEach((field) => {
    field.removeAttribute("aria-invalid");
  });
}

document.getElementById("opinions-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const topicField = document.getElementById("topic");
  const contextField = document.getElementById("context");
  const topic = normaliseInput(topicField.value);
  const context = normaliseInput(contextField.value);

  clearFormError();
  if (!topic) {
    setFormError("Додайте конкретну тему або питання для обговорення.", topicField);
    return;
  }
  if (!context) {
    setFormError("Опишіть клас або потрібний кут дискусії, щоб думки не були шаблонними.", contextField);
    return;
  }

  saveHandoffDraft({
    level: document.getElementById("level").value,
    count: "4",
    topic,
    vocab: "Lesson context: " + context + "\nResponse length: " + document.getElementById("length").value
  });
  window.location.assign("../teacher-tools.html?tool=" + FOUR_OPINIONS_TOOL_ID);
});

document.querySelectorAll("#topic, #context").forEach((field) => {
  field.addEventListener("input", clearFormError);
});
