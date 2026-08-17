(function () {
  const PREF_KEY = "tt.readingBlock.prefs";
  const TOOLS = [
    ["gist-detail", "Gist + detail"],
    ["abcd-text", "Multiple choice"],
    ["true-false", "True / False"],
    ["open-questions", "Open questions"],
    ["vocab-in-context", "Vocabulary in context"],
    ["match-headings", "Match headings"],
    ["summary-task", "Summary task"],
    ["tf-not-given", "True / False / Not Given"],
  ];
  const TOOL_LABELS = Object.fromEntries(TOOLS);
  let running = false;
  let aborter = null;
  let failedTools = [];
  let lastSource = { key: "", text: "", title: "", generated: null };

  function $(id) { return document.getElementById(id); }
  function val(id) { return String($(id)?.value || "").trim(); }
  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  function hasAuth() {
    return (typeof authToken !== "undefined" && authToken) || window.authToken;
  }
  function checkedTools() {
    return [...document.querySelectorAll(".rb-tool-cb:checked")].map(input => input.value);
  }
  function formState() {
    return {
      topic: val("rb-topic") || "Reading lesson",
      level: $("rb-level")?.value || "B1",
      genre: $("rb-genre")?.value || "",
      length: $("rb-length")?.value || "",
      source: val("rb-source"),
      vocab: val("rb-vocab"),
      includeText: $("rb-include-text")?.checked !== false,
      tools: checkedTools(),
    };
  }
  function savePrefs() {
    try {
      const state = formState();
      localStorage.setItem(PREF_KEY, JSON.stringify({
        level: state.level,
        genre: state.genre,
        length: state.length,
        includeText: state.includeText,
        tools: state.tools,
      }));
    } catch (_) {}
  }
  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || "null") || {}; } catch (_) { return {}; }
  }
  function setStatus(html) {
    const el = $("rb-status");
    if (el) el.innerHTML = html || "";
  }
  function setProgress(value, hidden) {
    const box = $("rb-progress");
    const fill = $("rb-progress-fill");
    if (!box || !fill) return;
    box.style.display = hidden ? "none" : "block";
    fill.style.width = `${Math.max(0, Math.min(100, value || 0))}%`;
  }
  function syncButtons() {
    const run = $("rb-run");
    const cancel = $("rb-cancel");
    if (run) {
      run.disabled = running || !checkedTools().length;
      run.textContent = running ? "Building..." : "Build reading block";
    }
    if (cancel) cancel.textContent = running ? "Stop" : "Close";
  }
  function renderChips(tools, state) {
    const box = $("rb-chips");
    if (!box) return;
    box.style.display = "flex";
    box.innerHTML = tools.map(id => {
      const status = state[id] || "pending";
      const icon = status === "done" ? "OK" : status === "fail" ? "!" : status === "running" ? "..." : "-";
      return `<span class="rb-chip ${status}"><span>${icon}</span>${esc(TOOL_LABELS[id] || id)}</span>`;
    }).join("");
  }
  function ensureModal() {
    if ($("reading-block-modal")) return;
    const modal = document.createElement("div");
    modal.id = "reading-block-modal";
    modal.className = "rb-modal";
    modal.style.display = "none";
    modal.innerHTML = `
      <div class="rb-card">
        <div class="rb-head">
          <div>
            <div class="rb-title">Reading Block</div>
            <div class="rb-sub">Paste a text or generate one, then build a complete reading lesson on the board.</div>
          </div>
          <button class="rb-close" type="button" onclick="closeReadingBlock()" aria-label="Close">x</button>
        </div>
        <div class="rb-grid">
          <div>
            <label class="rb-label" for="rb-topic">Topic / title</label>
            <input id="rb-topic" type="text" placeholder="Urban gardens, remote work, travel problems...">
          </div>
          <div>
            <label class="rb-label" for="rb-level">Level</label>
            <select id="rb-level"><option>A1</option><option>A2</option><option selected>B1</option><option>B2</option><option>C1</option><option>C2</option></select>
          </div>
        </div>
        <div class="rb-grid">
          <div>
            <label class="rb-label" for="rb-genre">Genre</label>
            <select id="rb-genre"><option value="">Auto</option><option value="article">Article</option><option value="story">Story</option><option value="email">Email / letter</option><option value="report">Report</option><option value="blog">Blog post</option><option value="dialogue">Dialogue</option><option value="review">Review</option></select>
          </div>
          <div>
            <label class="rb-label" for="rb-length">Length</label>
            <select id="rb-length"><option value="">Auto</option><option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option></select>
          </div>
        </div>
        <label class="rb-label" for="rb-source">Source text</label>
        <textarea id="rb-source" placeholder="Paste the reading text here. Leave empty and TeachEd will write a leveled text from the topic."></textarea>
        <label class="rb-label" for="rb-vocab">Target vocabulary</label>
        <textarea id="rb-vocab" placeholder="Optional: one word or phrase per line."></textarea>
        <label class="rb-toggle"><input id="rb-include-text" type="checkbox" checked> Add the reading text card to the board block</label>
        <div class="rb-tools-head">
          <span>Tasks to build</span>
          <span><button class="rb-mini" type="button" onclick="readingSelectAll(true)">All</button><button class="rb-mini" type="button" onclick="readingSelectAll(false)">Clear</button></span>
        </div>
        <div class="rb-tools">
          ${TOOLS.map(([id, label], index) => `<label class="rb-tool"><input type="checkbox" class="rb-tool-cb" value="${id}" ${index < 5 ? "checked" : ""}> ${label}</label>`).join("")}
        </div>
        <div class="rb-progress" id="rb-progress" style="display:none"><div id="rb-progress-fill"></div></div>
        <div class="rb-chips" id="rb-chips" style="display:none"></div>
        <div id="rb-status" class="rb-status"></div>
        <div class="rb-actions">
          <button id="rb-cancel" class="tbuilder-btn ghost" type="button" onclick="closeReadingBlock()">Close</button>
          <button id="rb-run" class="tbuilder-btn blue" type="button" onclick="runReadingBlock()">Build reading block</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", event => { if (event.target === modal) window.closeReadingBlock(); });
    modal.querySelectorAll("input, textarea, select").forEach(el => {
      el.addEventListener("change", () => { savePrefs(); syncButtons(); });
      el.addEventListener("input", syncButtons);
    });
  }
  function applyPrefs() {
    const prefs = loadPrefs();
    if (prefs.level && $("rb-level")) $("rb-level").value = prefs.level;
    if (prefs.genre && $("rb-genre")) $("rb-genre").value = prefs.genre;
    if (prefs.length && $("rb-length")) $("rb-length").value = prefs.length;
    if ($("rb-include-text")) $("rb-include-text").checked = prefs.includeText !== false;
    if (Array.isArray(prefs.tools) && prefs.tools.length) {
      document.querySelectorAll(".rb-tool-cb").forEach(input => { input.checked = prefs.tools.includes(input.value); });
    }
  }
  function installSidebarCta() {
    const content = $("sb-content");
    if (!content || content.querySelector(".reading-block-cta")) return;
    const hasTools = content.querySelector(".tool-skill-row") || content.textContent.includes("Reading");
    if (!hasTools) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reading-block-cta";
    btn.onclick = () => window.openReadingBlock();
    btn.innerHTML = '<span class="rb-cta-mark">READ</span><strong>Reading block</strong><small>Text, tasks, key, board layout</small>';
    content.prepend(btn);
  }
  function observeSidebar() {
    const content = $("sb-content");
    if (!content || content.dataset.rbObserved) return;
    content.dataset.rbObserved = "1";
    new MutationObserver(() => installSidebarCta()).observe(content, { childList: true, subtree: true });
    installSidebarCta();
  }
  async function requestTool(toolId, state, sourceText) {
    const extra = [
      "Reading block builder.",
      "Base every task strictly on the source text.",
      "Avoid generic textbook questions; ask about concrete ideas, references and language in the text.",
      state.genre ? `Genre: ${state.genre}.` : "",
      state.length ? `Original target length: ${state.length}.` : "",
    ].filter(Boolean).join(" ");
    return window.requestServerTeacherTool({
      tool: { id: toolId },
      level: state.level,
      count: toolId === "summary-task" ? 4 : toolId === "match-headings" ? 6 : 8,
      topic: state.topic,
      genre: state.genre,
      length: state.length,
      source: sourceText,
      vocab: state.vocab,
      extra,
    }, 45000, aborter?.signal);
  }
  function extractReadingText(generated, fallbackTopic) {
    const card = (generated?.cards || []).find(item => /reading|text/i.test(item.title || "")) || generated?.cards?.[0];
    const raw = String(card?.text || "").trim();
    if (!raw) return { title: fallbackTopic, text: "" };
    const lines = raw.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const title = lines.length > 1 && lines[0].length < 90 ? lines[0] : fallbackTopic;
    const text = (lines.length > 1 && lines[0].length < 90 ? lines.slice(1) : lines).join("\n\n");
    return { title, text };
  }
  async function prepareSource(state) {
    const key = JSON.stringify({ topic: state.topic, level: state.level, genre: state.genre, length: state.length, source: state.source, vocab: state.vocab });
    if (lastSource.key === key && lastSource.text) return lastSource;
    if (state.source) {
      lastSource = { key, text: state.source, title: state.topic, generated: null };
      return lastSource;
    }
    const toolId = state.vocab ? "text-topic-vocab" : "generate-text";
    const generated = await requestTool(toolId, state, "");
    const extracted = extractReadingText(generated, state.topic);
    if (!extracted.text) throw new Error("Could not generate a reading text. Add a source text and try again.");
    lastSource = { key, text: extracted.text, title: extracted.title || state.topic, generated };
    const sourceEl = $("rb-source");
    if (sourceEl && !sourceEl.value.trim()) sourceEl.value = extracted.text;
    return lastSource;
  }
  function worksheetHeight(out) {
    if (typeof window._ttEstWorksheetHeight === "function") return window._ttEstWorksheetHeight(out);
    if (Array.isArray(out?.cards)) return 330 + out.cards.reduce((sum, card) => sum + Math.ceil(String(card.text || "").length / 48) * 16 + 54, 0);
    if (Array.isArray(out?.questions)) return 280 + out.questions.length * 58;
    if (Array.isArray(out?.items)) return 280 + out.items.length * 48;
    return 360;
  }
  function answerKey(outputs) {
    const lines = [];
    outputs.forEach(out => {
      lines.push(out.title || out.kind || "Reading task");
      if (Array.isArray(out.questions)) {
        out.questions.forEach((q, i) => lines.push(`${i + 1}. ${q.answer || "Open answer - check against the text"}`));
      } else if (Array.isArray(out.cards)) {
        out.cards.slice(0, 4).forEach(card => lines.push(`${card.title}: ${String(card.text || "").slice(0, 160)}`));
      }
      lines.push("");
    });
    return lines.join("\n").trim() || "Check answers against the reading text.";
  }
  function placeOnBoard(outputs, source, state) {
    const cards = outputs.filter(Boolean);
    const includeText = state.includeText && source.text;
    const cardW = 430;
    const gap = 24;
    const textH = includeText ? Math.min(780, Math.max(420, 210 + Math.ceil(source.text.length / 70) * 22)) : 0;
    const slots = [
      ...(includeText ? [{ type: "text", h: textH }] : []),
      { type: "flow", h: 270 },
      ...cards.map(out => ({ type: "worksheet", out, h: worksheetHeight(out) })),
    ];
    const cols = Math.min(3, Math.max(2, slots.length >= 3 ? 3 : 2));
    const rows = Math.ceil(slots.length / cols);
    const rowH = Array.from({ length: rows }, (_, row) => Math.max(260, ...slots.slice(row * cols, row * cols + cols).map(slot => slot.h)));
    const frameW = 44 + cols * cardW + (cols - 1) * gap;
    const frameH = 76 + rowH.reduce((a, b) => a + b, 0) + (rowH.length - 1) * gap + 226;
    const center = window.getBoardViewportCenter?.() || { x: 360, y: 260 };
    const free = window.findFreePlacement?.(center.x, center.y, frameW, frameH) || center;
    const x0 = Math.round(free.x - frameW / 2);
    const y0 = Math.round(free.y - frameH / 2);
    window.snapshot?.();
    try { if (typeof _suppressSnapshot !== "undefined") _suppressSnapshot++; } catch (_) {}
    let frame;
    try {
      frame = window.addCard("frame", x0, y0, { title: `Reading block · ${source.title || state.topic}`, bg: "#ffffff", border: "rgba(66,98,255,.34)", childIds: [] }, frameW, frameH);
      slots.forEach((slot, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = x0 + 22 + col * (cardW + gap);
        const y = y0 + 58 + rowH.slice(0, row).reduce((sum, h) => sum + h + gap, 0);
        let card = null;
        if (slot.type === "text") {
          const body = [
            source.title || state.topic,
            "",
            source.text,
          ].join("\n");
          card = window.addCard("text", x, y, window.defaultTextData({ text: body, bgColor: "#F8FAFC", textColor: "#111827", fontSize: 15 }), cardW, slot.h);
        } else if (slot.type === "flow") {
          const words = source.text.split(/\s+/).filter(Boolean).length;
          const flow = [
            `Text: ${source.title || state.topic}`,
            `Level: ${state.level}`,
            `Length: ${words} words`,
            state.genre ? `Genre: ${state.genre}` : "",
            "",
            "1. Before reading: predict from the title and 3 key words.",
            "2. First read: one-minute gist. No dictionaries.",
            "3. Second read: complete detail and language tasks.",
            "4. Text evidence: underline proof for every answer.",
            "5. After reading: discuss, summarise, or write a response.",
          ].filter(Boolean).join("\n");
          card = window.addCard("text", x, y, window.defaultTextData({ text: `Reading lesson flow\n\n${flow}`, bgColor: "#EEF2FF", textColor: "#172554", fontSize: 14 }), cardW, slot.h);
        } else {
          const out = slot.out;
          card = window.addCard("worksheet", x, y, {
            title: out.title,
            kind: out.kind,
            cat: out.cat || "reading",
            level: out.level || state.level,
            boardKind: out.boardKind || "quiz",
            questions: out.questions || [],
            items: out.items,
            cards: out.cards,
          }, cardW, slot.h);
        }
        frame && card && window.setCardParentFrame?.(card, frame);
      });
      const keyY = y0 + 58 + rowH.reduce((a, b) => a + b, 0) + (rowH.length - 1) * gap + 28;
      const key = window.addCard("text", x0 + 22, keyY, window.defaultTextData({ text: `Teacher key\n\n${answerKey(cards)}`, bgColor: "#F0FDFA", textColor: "#0F3B42", fontSize: 14 }), frameW - 44, 176);
      frame && key && window.setCardParentFrame?.(key, frame);
      window.renumberFrames?.();
      window._sendCardToBack?.(frame);
      frame?.id && (window.clearSelection?.(), window.selectCard?.(frame.id), setTimeout(() => { try { window.zoomToCard?.(frame.id, true); } catch (_) {} }, 80));
    } finally {
      try { if (typeof _suppressSnapshot !== "undefined") _suppressSnapshot = Math.max(0, _suppressSnapshot - 1); } catch (_) {}
    }
    window.scheduleSave?.();
    window.saveLocal?.();
  }

  window.openReadingBlock = function () {
    ensureModal();
    applyPrefs();
    failedTools = [];
    setStatus("");
    setProgress(0, true);
    const chips = $("rb-chips");
    if (chips) chips.style.display = "none";
    const modal = $("reading-block-modal");
    modal.style.display = "flex";
    requestAnimationFrame(() => modal.classList.add("open"));
    setTimeout(() => $("rb-topic")?.focus(), 50);
    syncButtons();
  };
  window.closeReadingBlock = function () {
    if (running) {
      aborter?.abort();
      running = false;
      setStatus("Stopped. Nothing new was placed.");
      syncButtons();
      return;
    }
    const modal = $("reading-block-modal");
    if (modal) {
      modal.classList.remove("open");
      setTimeout(() => { modal.style.display = "none"; }, 160);
    }
  };
  window.readingSelectAll = function (checked) {
    ensureModal();
    document.querySelectorAll(".rb-tool-cb").forEach(input => { input.checked = checked; });
    savePrefs();
    syncButtons();
  };
  window.runReadingBlock = async function () {
    ensureModal();
    if (running) return;
    const state = formState();
    if (!state.tools.length) return setStatus("Pick at least one reading task.");
    if (!hasAuth()) return setStatus("Sign in to build a reading block with AI.");
    savePrefs();
    running = true;
    aborter = new AbortController();
    failedTools = [];
    syncButtons();
    setProgress(4, false);
    try {
      setStatus(state.source ? "Preparing source text..." : "Writing a leveled reading text...");
      const source = await prepareSource(state);
      setStatus("Building reading tasks...");
      const chipState = {};
      state.tools.forEach(id => { chipState[id] = "pending"; });
      renderChips(state.tools, chipState);
      const outputs = new Array(state.tools.length).fill(null);
      let cursor = 0;
      let done = 0;
      async function worker() {
        while (cursor < state.tools.length && !aborter.signal.aborted) {
          const index = cursor++;
          const tool = state.tools[index];
          chipState[tool] = "running";
          renderChips(state.tools, chipState);
          try {
            const out = await requestTool(tool, state, source.text);
            if (!out || (!out.questions?.length && !out.items?.length && !out.cards?.length)) throw new Error("empty task");
            outputs[index] = out;
            chipState[tool] = "done";
          } catch (err) {
            if (aborter.signal.aborted) break;
            failedTools.push(tool);
            chipState[tool] = "fail";
          }
          done++;
          setProgress(12 + Math.round((done / state.tools.length) * 84), false);
          renderChips(state.tools, chipState);
        }
      }
      await Promise.all(Array.from({ length: Math.min(2, state.tools.length) }, worker));
      if (aborter.signal.aborted) return setStatus("Stopped. Nothing new was placed.");
      const good = outputs.filter(Boolean);
      if (!good.length) return setStatus("The AI engine was busy. Try fewer tasks or paste a shorter text.");
      setProgress(100, false);
      placeOnBoard(good, source, state);
      if (failedTools.length) {
        const failed = failedTools.map(id => TOOL_LABELS[id] || id).join(", ");
        setStatus(`Placed ${good.length}/${state.tools.length}. Failed: ${esc(failed)}. <button type="button" class="rb-retry" onclick="retryReadingFailed()">Retry failed</button>`);
        window.toast?.(`Reading block: ${good.length}/${state.tools.length} tasks placed`);
      } else {
        setStatus("Reading block placed on the board.");
        window.toast?.(`Reading block ready: ${good.length} tasks`);
        setTimeout(() => window.closeReadingBlock(), 450);
      }
    } catch (err) {
      if (!aborter?.signal.aborted) setStatus(`${esc(err.message || "Could not build the reading block")}. Try a shorter text or fewer tasks.`);
    } finally {
      running = false;
      aborter = null;
      syncButtons();
    }
  };
  window.retryReadingFailed = function () {
    if (running || !failedTools.length) return;
    document.querySelectorAll(".rb-tool-cb").forEach(input => { input.checked = failedTools.includes(input.value); });
    window.runReadingBlock();
  };

  function boot() {
    ensureModal();
    observeSidebar();
    const interval = setInterval(installSidebarCta, 1200);
    setTimeout(() => clearInterval(interval), 12000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
