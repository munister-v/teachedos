(function(){
  const phoneMq = window.matchMedia ? window.matchMedia("(max-width: 860px)") : null;
  const isPhone = () => (phoneMq ? phoneMq.matches : window.innerWidth <= 860);
  const submenuIds = ["board","edit","view","prefs","a11y"].map(k => "cascade-sub-" + k);
  let activeCardId = null;
  let cardTouch = null;

  function closeLooseMenus(except){
    ["user-menu","more-menu","ctx-menu"].forEach(id => {
      if (id === except) return;
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }

  function closeMobileSubmenus(){
    submenuIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("mobile-cascade-sub-open");
      el.style.display = "none";
    });
    document.querySelectorAll("#board-menu .cascade-item.is-open").forEach(el => el.classList.remove("is-open"));
  }

  function syncBackdrop(){
    const open = ["user-menu","more-menu","ctx-menu","board-menu"].some(id => {
      const el = document.getElementById(id);
      return el && el.style.display && el.style.display !== "none";
    }) || !!document.querySelector(".mobile-cascade-sub-open");
    document.body.classList.toggle("mobile-sheet-open", open);
  }

  function isInteractiveTarget(target){
    return !!(target && target.closest && target.closest(
      "button,a,input,textarea,select,[contenteditable='true']," +
      ".text-format-toolbar,.layer-popover,.resize-handle,.anchor-dot," +
      ".card-close,.sticky-close,.text-close,.color-dot,.ws-btn," +
      ".generated-panel-actionbar,.generated-panel-btn,#mobile-card-actions"
    ));
  }

  function ensureCardActions(){
    let bar = document.getElementById("mobile-card-actions");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "mobile-card-actions";
    bar.className = "mobile-card-actions";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = [
      '<button type="button" data-mobile-card-action="focus"><span>Focus</span></button>',
      '<button type="button" data-mobile-card-action="edit"><span>Edit</span></button>',
      '<button type="button" data-mobile-card-action="duplicate"><span>Duplicate</span></button>',
      '<button type="button" class="danger" data-mobile-card-action="delete"><span>Delete</span></button>'
    ].join("");
    document.body.appendChild(bar);
    bar.addEventListener("click", event => {
      const button = event.target.closest("[data-mobile-card-action]");
      if (!button || !activeCardId) return;
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.mobileCardAction;
      try {
        if (action === "focus" && typeof window.zoomToCard === "function") {
          window.zoomToCard(activeCardId, true);
        } else if (action === "edit" && typeof window.openCardEditor === "function") {
          window.openCardEditor(activeCardId);
        } else if (action === "duplicate" && typeof window.duplicateSelected === "function") {
          window.duplicateSelected();
        } else if (action === "delete" && typeof window.deleteSelected === "function") {
          if (window.confirm("Delete selected card?")) {
            window.deleteSelected();
            hideCardActions();
          }
        }
      } catch {}
    });
    return bar;
  }

  function showCardActions(cardId){
    if (!isPhone() || !cardId) return;
    activeCardId = cardId;
    const bar = ensureCardActions();
    bar.classList.add("open");
    bar.setAttribute("aria-hidden", "false");
    document.body.classList.add("mobile-card-actions-open");
  }

  function hideCardActions(){
    activeCardId = null;
    const bar = document.getElementById("mobile-card-actions");
    if (bar) {
      bar.classList.remove("open");
      bar.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("mobile-card-actions-open");
  }

  function selectCardForPhone(card){
    if (!card || !card.dataset || !card.dataset.id) return;
    try {
      if (typeof window.clearSelection === "function") window.clearSelection();
      if (typeof window.selectCard === "function") window.selectCard(card.dataset.id);
      if (navigator.vibrate) navigator.vibrate(6);
    } catch {}
    showCardActions(card.dataset.id);
  }

  function mobileBoardCenter(){
    try {
      if (typeof window.getBoardViewportCenter === "function") return window.getBoardViewportCenter();
    } catch {}
    return { x: 260, y: 220 };
  }

  function finishMobileAdd(card, edit){
    if (!card || !card.id) return;
    try {
      if (typeof window.clearSelection === "function") window.clearSelection();
      if (typeof window.selectCard === "function") window.selectCard(card.id);
      if (typeof window.zoomToCard === "function") setTimeout(() => window.zoomToCard(card.id, true), 80);
      if (edit && typeof window.openCardEditor === "function") setTimeout(() => window.openCardEditor(card.id), 280);
      if (typeof window.scheduleSave === "function") window.scheduleSave();
      if (typeof window.saveLocal === "function") window.saveLocal();
    } catch {}
    showCardActions(card.id);
  }

  function addMobileCard(type){
    const center = mobileBoardCenter();
    const add = window.addCard;
    if (typeof add !== "function") return false;
    try {
      if (type === "frame" && typeof window.quickAddFrame === "function") {
        window.quickAddFrame();
        return true;
      }
      let card = null;
      if (type === "sticky") {
        card = add("sticky", center.x - 110, center.y - 90, { text: "", color: "#fff7c2" });
      } else if (type === "text") {
        card = add("text", center.x - 110, center.y - 44, { text: "Label", fontSize: 18, textColor: "#111111", bgColor: "transparent" }, 220, 88);
      } else if (type === "shape") {
        card = add("shape", center.x - 100, center.y - 80, { shape: "rect", fill: "#ffffff", stroke: "#1C1C1E", sw: 2, text: "" }, 200, 160);
      } else if (type === "sticker") {
        card = add("sticker", center.x - 48, center.y - 48, { glyph: "😊" }, 96, 96);
      } else if (type === "comment") {
        card = add("sticky", center.x - 110, center.y - 90, { text: "", color: "#fff3b0", isComment: true });
      }
      if (card) {
        finishMobileAdd(card, type !== "sticker");
        return true;
      }
    } catch {}
    return false;
  }

  function installMobileAddOverrides(){
    const sheet = document.getElementById("mq-add-sheet");
    if (!sheet || sheet.dataset.mobileAddPatched === "1") return;
    sheet.dataset.mobileAddPatched = "1";

    const originalOpenMobileAddSheet = window.openMobileAddSheet;
    const originalMqAdd = window._mqAdd;
    window.openMobileAddSheet = function(){
      if (!isPhone()) {
        return typeof originalOpenMobileAddSheet === "function" ? originalOpenMobileAddSheet() : undefined;
      }
      hideCardActions();
      sheet.classList.add("open");
      sheet.setAttribute("aria-hidden", "false");
      document.body.classList.add("mq-sheet-open");
    };

    window._mqAdd = function(type){
      if (!isPhone()) return typeof originalMqAdd === "function" ? originalMqAdd(type) : undefined;
      if (typeof window.closeMobileAddSheet === "function") window.closeMobileAddSheet();
      setTimeout(() => {
        if (["sticky","text","shape","frame","sticker","comment"].includes(type)) {
          if (!addMobileCard(type) && typeof originalMqAdd === "function") originalMqAdd(type);
        } else if (type === "lessons" && typeof window.toggleSidebar === "function") {
          window.toggleSidebar();
        } else if (type === "connect") {
          try { window.toast && window.toast("Connect cards on a computer"); } catch {}
        }
      }, 160);
    };
  }

  const originalCloseBoardMenu = window.closeBoardMenu;
  window.closeBoardMenu = function(){
    closeMobileSubmenus();
    const menu = document.getElementById("board-menu");
    if (menu) {
      menu.classList.remove("mobile-cascade-menu-open");
      menu.style.display = "none";
      menu.style.left = "";
      menu.style.right = "";
      menu.style.top = "";
    }
    if (!isPhone() && typeof originalCloseBoardMenu === "function") {
      try { originalCloseBoardMenu(); } catch {}
    }
    syncBackdrop();
  };

  const originalToggleBoardMenu = window.toggleBoardMenu;
  window.toggleBoardMenu = function(event){
    if (!isPhone()) return typeof originalToggleBoardMenu === "function" ? originalToggleBoardMenu(event) : undefined;
    event && event.stopPropagation && event.stopPropagation();
    const menu = document.getElementById("board-menu");
    if (!menu) return;
    const open = menu.style.display && menu.style.display !== "none";
    if (open) {
      window.closeBoardMenu();
      return;
    }
    closeLooseMenus("board-menu");
    closeMobileSubmenus();
    menu.classList.add("mobile-cascade-menu-open");
    menu.style.display = "block";
    menu.style.left = "";
    menu.style.right = "";
    menu.style.top = "";
    menu.querySelectorAll(".cascade-item[data-sub]").forEach(item => {
      item.onclick = function(e){
        e.stopPropagation();
        const sub = document.getElementById("cascade-sub-" + item.dataset.sub);
        if (!sub) return;
        const already = sub.classList.contains("mobile-cascade-sub-open");
        closeMobileSubmenus();
        if (already) return;
        item.classList.add("is-open");
        sub.classList.add("mobile-cascade-sub-open");
        sub.style.display = "block";
      };
    });
    syncBackdrop();
  };

  const originalShowUserMenu = window.showUserMenu;
  window.showUserMenu = function(){
    if (!isPhone()) return typeof originalShowUserMenu === "function" ? originalShowUserMenu() : undefined;
    closeMobileSubmenus();
    const boardMenu = document.getElementById("board-menu");
    if (boardMenu) boardMenu.style.display = "none";
    closeLooseMenus("user-menu");
    const menu = document.getElementById("user-menu");
    if (!menu) return;
    menu.style.display = (!menu.style.display || menu.style.display === "none") ? "block" : "none";
    syncBackdrop();
  };

  installMobileAddOverrides();

  document.addEventListener("click", event => {
    if (!isPhone()) return;
    if (event.target.closest("#board-menu, .cascade-sub, #tb-hamburger, #btn-board-menu, #user-menu, #auth-chip, #more-menu, #btn-more, #mq-more")) return;
    window.closeBoardMenu();
    syncBackdrop();
  }, true);

  document.addEventListener("touchstart", event => {
    if (!isPhone() || event.touches.length !== 1) return;
    const card = event.target.closest && event.target.closest(".board-card");
    if (!card || isInteractiveTarget(event.target)) return;
    const touch = event.touches[0];
    cardTouch = { card, x: touch.clientX, y: touch.clientY, moved: false };
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });

  document.addEventListener("touchmove", event => {
    if (!cardTouch || !event.touches.length) return;
    const touch = event.touches[0];
    if (Math.hypot(touch.clientX - cardTouch.x, touch.clientY - cardTouch.y) > 10) {
      cardTouch.moved = true;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true, passive: false });

  document.addEventListener("touchend", event => {
    if (!cardTouch) return;
    const next = cardTouch;
    cardTouch = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!next.moved) selectCardForPhone(next.card);
  }, { capture: true, passive: false });

  document.addEventListener("click", event => {
    if (!isPhone()) return;
    const card = event.target.closest && event.target.closest(".board-card");
    if (card && !isInteractiveTarget(event.target)) {
      event.preventDefault();
      event.stopPropagation();
      selectCardForPhone(card);
      return;
    }
    if (!event.target.closest("#mobile-card-actions,#card-editor,.board-card")) {
      hideCardActions();
    }
  }, true);

  window.addEventListener("resize", () => {
    if (!isPhone()) {
      document.body.classList.remove("mobile-sheet-open");
      document.getElementById("board-menu")?.classList.remove("mobile-cascade-menu-open");
      closeMobileSubmenus();
      hideCardActions();
    }
  });
})();
