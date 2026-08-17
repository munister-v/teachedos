(function () {
  const LANGS = [
    ["", "Auto / English"],
    ["en", "English"],
    ["uk", "Ukrainian"],
    ["ru", "Russian"],
    ["de", "German"],
    ["pl", "Polish"],
    ["es", "Spanish"],
    ["fr", "French"],
  ];
  const EXTRA_TOOLS = [
    ["choose-summary", "Choose the best summary"],
    ["summary-gapfill", "Summary gap-fill"],
    ["audio-video-questions", "Audio/video questions"],
    ["listening-dictation", "Dictation gaps"],
  ];
  const TOOL_LABELS = {
    "lesson-pack": "Lesson plan",
    "gist-detail": "Gist + detail",
    "extract-vocab": "Key vocabulary",
    gap: "Gap-fill",
    "true-false": "True / False",
    "open-questions": "Discussion",
    "choose-summary": "Choose summary",
    "summary-gapfill": "Summary gap-fill",
    "audio-video-questions": "A/V questions",
    "listening-dictation": "Dictation gaps",
  };
  const PREF_KEY = "tt.ytLesson.upgradePrefs";
  let running = false;
  let aborter = null;
  let lastFetch = { key: "", transcript: "", title: "", meta: null };
  let failedTools = [];

  function $(id) { return document.getElementById(id); }
  function text(value) { return String(value || "").trim(); }
  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  function setStatus(html) {
    const el = $("yt-lesson-status");
    if (el) el.innerHTML = html || "";
  }
  function setProgress(value, hidden) {
    const box = $("yt-progress");
    const fill = $("yt-progress-fill");
    if (!box || !fill) return;
    box.style.display = hidden ? "none" : "block";
    fill.style.width = `${Math.max(0, Math.min(100, value || 0))}%`;
  }
  function syncButtons() {
    const run = $("yt-lesson-run");
    const cancel = $("yt-lesson-cancel");
    if (run) {
      run.disabled = running || !validUrl(text($("yt-lesson-url")?.value)) || !checkedTools().length;
      run.textContent = running ? "Building..." : "Build lesson";
    }
    if (cancel) cancel.textContent = running ? "Stop" : "Close";
  }
  function validUrl(value) {
    return /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.test(value) || /^[\w-]{11}$/.test(value);
  }
  function parseSeconds(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return null;
    if (/^\d+(\.\d+)?$/.test(raw)) return Math.max(0, Math.round(Number(raw)));
    const parts = raw.split(":").map(Number);
    if (parts.length > 1 && parts.every(Number.isFinite)) return Math.max(0, Math.round(parts.reduce((a, b) => a * 60 + b, 0)));
    let total = 0;
    const h = raw.match(/(\d+(?:\.\d+)?)h/);
    const m = raw.match(/(\d+(?:\.\d+)?)m/);
    const s = raw.match(/(\d+(?:\.\d+)?)s/);
    if (h) total += Number(h[1]) * 3600;
    if (m) total += Number(m[1]) * 60;
    if (s) total += Number(s[1]);
    return total ? Math.max(0, Math.round(total)) : null;
  }
  function checkedTools() {
    return [...document.querySelectorAll(".yt-tool-cb:checked")].map(input => input.value);
  }
  function ytInfo(url, start, end) {
    if (typeof window.llVideoInfo === "function") return window.llVideoInfo(url, start, end);
    const match = String(url || "").match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/) || String(url || "").match(/^([\w-]{11})$/);
    if (!match) return null;
    const id = match[1];
    const startSec = parseSeconds(start);
    const endSec = parseSeconds(end);
    const params = new URLSearchParams();
    if (startSec != null) params.set("start", String(startSec));
    if (endSec != null) params.set("end", String(endSec));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return {
      provider: "youtube",
      id,
      url,
      embedUrl: `https://www.youtube.com/embed/${id}${suffix}`,
      thumb: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      label: "YouTube",
      start: startSec,
      end: endSec,
    };
  }
  function formState() {
    const url = text($("yt-lesson-url")?.value);
    return {
      url,
      level: $("yt-lesson-level")?.value || "B1",
      lang: $("yt-lesson-lang")?.value || "",
      start: text($("yt-lesson-start")?.value),
      end: text($("yt-lesson-end")?.value),
      includeVideo: $("yt-lesson-include-video")?.checked !== false,
      tools: checkedTools(),
    };
  }
  function fetchKey(state) {
    return [state.url, state.lang, state.start, state.end].join("|");
  }
  function savePrefs() {
    try {
      const state = formState();
      localStorage.setItem(PREF_KEY, JSON.stringify({
        level: state.level,
        lang: state.lang,
        includeVideo: state.includeVideo,
        tools: state.tools,
      }));
    } catch (_) {}
  }
  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || "null") || {}; } catch (_) { return {}; }
  }
  function ensureControls() {
    const modal = $("yt-lesson-modal");
    const url = $("yt-lesson-url");
    if (!modal || !url) return;

    if (!$("yt-lesson-lang")) {
      const row = document.createElement("div");
      row.className = "yt-advanced-grid";
      row.innerHTML = `
        <div><label class="yt-modal-label" for="yt-lesson-lang">Transcript language</label><select id="yt-lesson-lang">${LANGS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>
        <div><label class="yt-modal-label" for="yt-lesson-start">Start</label><input id="yt-lesson-start" type="text" placeholder="0:45"></div>
        <div><label class="yt-modal-label" for="yt-lesson-end">End</label><input id="yt-lesson-end" type="text" placeholder="3:10"></div>
      `;
      $("yt-url-hint")?.insertAdjacentElement("afterend", row);
    }

    if (!$("yt-lesson-preview")) {
      const preview = document.createElement("div");
      preview.id = "yt-lesson-preview";
      preview.className = "yt-lesson-preview";
      preview.innerHTML = '<div class="yt-preview-empty">Paste a YouTube link to preview the source card.</div>';
      const controls = document.querySelector(".yt-advanced-grid") || $("yt-url-hint");
      controls?.insertAdjacentElement("afterend", preview);
    }

    if (!$("yt-lesson-include-video")) {
      const media = document.createElement("label");
      media.className = "yt-media-toggle";
      media.innerHTML = '<input id="yt-lesson-include-video" type="checkbox" checked> Add the video card to the board block';
      $("yt-lesson-preview")?.insertAdjacentElement("afterend", media);
    }

    const tools = document.querySelector(".yt-modal-tools");
    if (tools && !tools.dataset.upgraded) {
      EXTRA_TOOLS.forEach(([id, label]) => {
        if (tools.querySelector(`input[value="${id}"]`)) return;
        const item = document.createElement("label");
        item.className = "yt-tool";
        item.innerHTML = `<input type="checkbox" class="yt-tool-cb" value="${id}" onchange="_ytSyncRunBtn()"> ${label}`;
        tools.appendChild(item);
      });
      tools.dataset.upgraded = "1";
    }

    ["yt-lesson-url", "yt-lesson-lang", "yt-lesson-start", "yt-lesson-end", "yt-lesson-include-video"].forEach(id => {
      const el = $(id);
      if (el && !el.dataset.ytUpgradeBound) {
        el.dataset.ytUpgradeBound = "1";
        el.addEventListener("input", () => { renderPreview(); syncUrlHint(); syncButtons(); });
        el.addEventListener("change", () => { renderPreview(); savePrefs(); });
      }
    });
    document.querySelectorAll(".yt-tool-cb").forEach(input => {
      if (!input.dataset.ytUpgradeBound) {
        input.dataset.ytUpgradeBound = "1";
        input.addEventListener("change", () => { savePrefs(); syncButtons(); });
      }
    });
  }
  function applyPrefs() {
    const prefs = loadPrefs();
    if (prefs.level && $("yt-lesson-level")) $("yt-lesson-level").value = prefs.level;
    if (prefs.lang && $("yt-lesson-lang")) $("yt-lesson-lang").value = prefs.lang;
    if ($("yt-lesson-include-video")) $("yt-lesson-include-video").checked = prefs.includeVideo !== false;
    if (Array.isArray(prefs.tools) && prefs.tools.length) {
      document.querySelectorAll(".yt-tool-cb").forEach(input => { input.checked = prefs.tools.includes(input.value); });
    }
  }
  function renderPreview() {
    const box = $("yt-lesson-preview");
    if (!box) return;
    const state = formState();
    const info = ytInfo(state.url, state.start, state.end);
    if (!info) {
      box.innerHTML = '<div class="yt-preview-empty">Paste a YouTube link to preview the source card.</div>';
      return;
    }
    const timing = [state.start ? `starts ${escapeHtml(state.start)}` : "", state.end ? `ends ${escapeHtml(state.end)}` : ""].filter(Boolean).join(" · ");
    box.innerHTML = `
      <div class="yt-preview-thumb">${info.thumb ? `<img src="${info.thumb}" alt="">` : ""}</div>
      <div class="yt-preview-copy">
        <strong>${escapeHtml(info.label)} source</strong>
        <span>${escapeHtml(state.lang || "auto language")}${timing ? ` · ${timing}` : ""}</span>
      </div>
    `;
  }
  function syncUrlHint() {
    const hint = $("yt-url-hint");
    if (!hint) return;
    const url = text($("yt-lesson-url")?.value);
    if (!url) {
      hint.textContent = "";
      hint.className = "yt-url-hint";
    } else if (validUrl(url)) {
      hint.textContent = "Valid YouTube link";
      hint.className = "yt-url-hint ok";
    } else {
      hint.textContent = "Paste a YouTube watch, shorts, live or share link";
      hint.className = "yt-url-hint bad";
    }
  }
  function renderChips(tools, state) {
    const box = $("yt-prog-list");
    if (!box) return;
    box.style.display = "flex";
    box.innerHTML = tools.map(id => {
      const status = state[id] || "pending";
      const icon = status === "done" ? "OK" : status === "fail" ? "!" : status === "running" ? "..." : "-";
      return `<span class="yt-chip ${status}"><span class="yt-chip-ic">${icon}</span>${escapeHtml(TOOL_LABELS[id] || id)}</span>`;
    }).join("");
  }
  async function fetchTranscript(state) {
    const key = fetchKey(state);
    if (lastFetch.key === key && lastFetch.transcript) return lastFetch;
    const params = new URLSearchParams({ url: state.url });
    if (state.lang) params.set("lang", state.lang);
    if (state.start) params.set("start", state.start);
    if (state.end) params.set("end", state.end);
    const res = await window.apiFetch(`/api/ai/youtube-transcript?${params.toString()}`, { signal: aborter?.signal });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.transcript) throw new Error(data?.error || "No transcript available");
    lastFetch = {
      key,
      transcript: data.transcript,
      title: data.title || "Video lesson",
      meta: data,
    };
    return lastFetch;
  }
  async function buildTool(toolId, state, source) {
    const label = TOOL_LABELS[toolId] || toolId;
    const sourceRange = [state.start ? `start ${state.start}` : "", state.end ? `end ${state.end}` : ""].filter(Boolean).join(", ");
    const extra = [
      "YouTube lesson builder.",
      `Create a classroom-ready ${label} from the transcript only.`,
      state.lang ? `Transcript language/request: ${state.lang}.` : "",
      sourceRange ? `Use the selected video fragment: ${sourceRange}.` : "",
      "Avoid generic questions; refer to concrete ideas, phrases and details from the transcript.",
    ].filter(Boolean).join(" ");
    const count = toolId === "lesson-pack" ? 6 : toolId === "extract-vocab" ? 10 : 8;
    return window.requestServerTeacherTool({
      tool: { id: toolId },
      level: state.level,
      count,
      topic: source.title || "Video lesson",
      source: source.transcript,
      extra,
    }, 45000, aborter?.signal);
  }
  function worksheetHeight(out) {
    if (typeof window._ttEstWorksheetHeight === "function") return window._ttEstWorksheetHeight(out);
    if (Array.isArray(out?.cards)) return 360 + Math.min(4, out.cards.length) * 42;
    if (Array.isArray(out?.questions)) return 330 + Math.min(8, out.questions.length) * 24;
    return 360;
  }
  function answerKey(outputs) {
    if (typeof window.llAnswerKey === "function") return window.llAnswerKey(outputs);
    const lines = [];
    outputs.forEach(out => {
      lines.push(out.title || out.kind || "Task");
      (out.questions || []).forEach((q, i) => lines.push(`${i + 1}. ${q.answer || "See student response"}`));
      lines.push("");
    });
    return lines.join("\n").trim() || "Open tasks: check student answers against the transcript.";
  }
  function placeOnBoard(outputs, source, state) {
    const video = ytInfo(state.url, state.start, state.end);
    const includeVideo = state.includeVideo && video?.embedUrl;
    const cards = outputs.filter(Boolean);
    const cardW = 420;
    const gap = 24;
    const cols = Math.min(3, Math.max(2, cards.length + (includeVideo ? 2 : 1) >= 3 ? 3 : 2));
    const slots = [
      ...(includeVideo ? [{ type: "video", h: 300 }] : []),
      { type: "flow", h: 260 },
      ...cards.map(out => ({ type: "worksheet", out, h: worksheetHeight(out) })),
    ];
    const rows = Math.ceil(slots.length / cols);
    const rowH = Array.from({ length: rows }, (_, row) => Math.max(260, ...slots.slice(row * cols, row * cols + cols).map(slot => slot.h)));
    const frameW = 44 + cols * cardW + (cols - 1) * gap;
    const frameH = 76 + rowH.reduce((a, b) => a + b, 0) + (rowH.length - 1) * gap + 230;
    const center = window.getBoardViewportCenter?.() || { x: 360, y: 260 };
    const free = window.findFreePlacement?.(center.x, center.y, frameW, frameH) || center;
    const x0 = Math.round(free.x - frameW / 2);
    const y0 = Math.round(free.y - frameH / 2);
    window.snapshot?.();
    try { if (typeof _suppressSnapshot !== "undefined") _suppressSnapshot++; } catch (_) {}
    let frame;
    try {
      const title = source.title && source.title.length > 64 ? `${source.title.slice(0, 61).trim()}...` : (source.title || "YouTube lesson");
      frame = window.addCard("frame", x0, y0, { title: `YouTube lesson · ${title}`, bg: "#ffffff", border: "rgba(66,98,255,.32)", childIds: [] }, frameW, frameH);
      slots.forEach((slot, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = x0 + 22 + col * (cardW + gap);
        const y = y0 + 58 + rowH.slice(0, row).reduce((a, b) => a + b + gap, 0);
        let card = null;
        if (slot.type === "video") {
          card = window.addCard("video", x, y, {
            title: source.title || "YouTube video",
            url: state.url,
            embedUrl: video.embedUrl,
            provider: video.provider,
            videoId: video.id,
            thumb: video.thumb,
            start: video.start,
            end: video.end,
            showMedia: true,
          }, cardW, slot.h);
        } else if (slot.type === "flow") {
          const range = [source.meta?.start != null ? `${source.meta.start}s` : "", source.meta?.end != null ? `${source.meta.end}s` : ""].filter(Boolean).join(" - ");
          const flow = [
            `Source: ${source.title || "YouTube video"}`,
            `Level: ${state.level}`,
            `Transcript: ${source.meta?.transcriptLanguage || state.lang || "auto"}${source.meta?.translated ? " (translated)" : ""}`,
            range ? `Fragment: ${range}` : "",
            `Transcript length: ${source.transcript.length.toLocaleString()} characters`,
            "",
            "1. Before: predict topic and pre-teach key phrases.",
            "2. First watch: gist only.",
            "3. Second watch: complete the generated tasks.",
            "4. Transcript check: underline useful language.",
            "5. After: retell, react, or role-play.",
          ].filter(Boolean).join("\n");
          card = window.addCard("text", x, y, window.defaultTextData({ text: `Lesson flow\n\n${flow}`, bgColor: "#EEF2FF", textColor: "#172554", fontSize: 14 }), cardW, slot.h);
        } else {
          const out = slot.out;
          card = window.addCard("worksheet", x, y, {
            title: out.title,
            kind: out.kind,
            cat: out.cat || "listening",
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
      const key = window.addCard("text", x0 + 22, keyY, window.defaultTextData({ text: `Teacher key\n\n${answerKey(cards)}`, bgColor: "#F8FAFC", textColor: "#111827", fontSize: 14 }), frameW - 44, 180);
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

  const oldOpen = window.openYtLesson;
  window.openYtLesson = function () {
    oldOpen?.();
    ensureControls();
    applyPrefs();
    renderPreview();
    syncUrlHint();
    syncButtons();
  };
  window.closeYtLesson = function () {
    if (running) {
      aborter?.abort();
      running = false;
      setStatus("Stopped. Nothing new was placed.");
      syncButtons();
      return;
    }
    const modal = $("yt-lesson-modal");
    if (modal) {
      modal.classList.remove("open");
      setTimeout(() => { modal.style.display = "none"; }, 160);
    }
  };
  window._ytSyncUrlState = function () {
    ensureControls();
    syncUrlHint();
    renderPreview();
    syncButtons();
  };
  window.ytSelectAllTools = function (checked) {
    ensureControls();
    document.querySelectorAll(".yt-tool-cb").forEach(input => { input.checked = checked; });
    savePrefs();
    syncButtons();
  };
  window.runYtLesson = async function () {
    ensureControls();
    const state = formState();
    if (running) return;
    if (!validUrl(state.url)) return setStatus("Paste a valid YouTube link first.");
    if (!state.tools.length) return setStatus("Pick at least one exercise.");
    const hasAuth = (typeof authToken !== "undefined" && authToken) || window.authToken;
    if (!hasAuth) return setStatus("Sign in to build a lesson with AI.");
    savePrefs();
    running = true;
    aborter = new AbortController();
    failedTools = [];
    syncButtons();
    setProgress(4, false);
    try {
      setStatus("Fetching transcript...");
      const source = await fetchTranscript(state);
      const meta = [
        `${source.transcript.length.toLocaleString()} chars`,
        source.meta?.segments?.length ? `${source.meta.segments.length} timed segments` : "",
        source.meta?.transcriptLanguage ? `${source.meta.transcriptLanguage}${source.meta.translated ? " translated" : ""}` : "",
      ].filter(Boolean).join(", ");
      setStatus(`Transcript ready (${escapeHtml(meta)}). Building tasks...`);
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
            const out = await buildTool(tool, state, source);
            if (!out || (!out.questions?.length && !out.items?.length && !out.cards?.length)) throw new Error("empty task");
            outputs[index] = out;
            chipState[tool] = "done";
          } catch (err) {
            if (aborter.signal.aborted) break;
            failedTools.push(tool);
            chipState[tool] = "fail";
          }
          done++;
          setProgress(10 + Math.round((done / state.tools.length) * 84), false);
          renderChips(state.tools, chipState);
        }
      }
      await Promise.all(Array.from({ length: Math.min(2, state.tools.length) }, worker));
      if (aborter.signal.aborted) return setStatus("Stopped. Nothing new was placed.");
      const good = outputs.filter(Boolean);
      if (!good.length) return setStatus("The AI engine was busy. No exercises came back. Try fewer tools or retry in a moment.");
      setProgress(100, false);
      placeOnBoard(good, source, state);
      if (failedTools.length) {
        const failed = failedTools.map(id => TOOL_LABELS[id] || id).join(", ");
        setStatus(`Placed ${good.length}/${state.tools.length}. Failed: ${escapeHtml(failed)}. <button type="button" class="yt-retry-btn" onclick="_ytRetryFailed()">Retry failed</button>`);
        window.toast?.(`YouTube lesson: ${good.length}/${state.tools.length} tasks placed`);
      } else {
        setStatus("Lesson block placed on the board.");
        window.toast?.(`YouTube lesson ready: ${good.length} tasks`);
        setTimeout(() => window.closeYtLesson(), 450);
      }
    } catch (err) {
      if (!aborter?.signal.aborted) setStatus(`${escapeHtml(err.message || "Could not build the lesson")}. Try another video or a shorter fragment.`);
    } finally {
      running = false;
      aborter = null;
      syncButtons();
    }
  };
  window._ytRetryFailed = function () {
    if (running || !failedTools.length) return;
    document.querySelectorAll(".yt-tool-cb").forEach(input => { input.checked = failedTools.includes(input.value); });
    window.runYtLesson();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureControls);
  } else {
    ensureControls();
  }
})();
