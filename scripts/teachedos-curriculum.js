window.initCurriculumApp = function initCurriculumApp(api) {
  const data = (window.TEACHEDOS_DATA && window.TEACHEDOS_DATA.curriculum) || [];
  let activeSidebar = 'all';
  let activeTab = 'all';
  let searchTerm = '';

  const grid = document.getElementById('curr-grid');
  const searchInput = document.getElementById('curr-search-input');

  function matchesSidebar(item) {
    if (activeSidebar === 'all') return true;
    if (activeSidebar === 'ru' || activeSidebar === 'ua' || activeSidebar === 'pl') {
      return item.langs.includes(activeSidebar);
    }
    if (activeSidebar === 'inprogress') {
      return item.progress > 0 && item.progress < 100;
    }
    if (activeSidebar === 'done') {
      return item.progress >= 100;
    }
    return item.category === activeSidebar;
  }

  function matchesTab(item) {
    if (activeTab === 'all') return true;
    return item.category === activeTab;
  }

  function matchesSearch(item) {
    if (!searchTerm) return true;
    const haystack = [item.title, item.desc, item.track, item.level, item.duration]
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchTerm);
  }

  function getLevelClass(level) {
    const key = String(level).toLowerCase();
    if (key.startsWith('a1')) return 'a1';
    if (key.startsWith('a2')) return 'a2';
    if (key.startsWith('b1')) return 'b1';
    if (key.startsWith('b2')) return 'b2';
    if (key.startsWith('c1')) return 'c1';
    return 'b1';
  }

  function actionLabel(item) {
    if (item.kind === 'game') return 'Open module →';
    return 'Open section →';
  }

  function render() {
    const visible = data.filter(item => matchesSidebar(item) && matchesTab(item) && matchesSearch(item));
    grid.innerHTML = visible.map(item => `
      <div class="lesson-card" onclick="curriculumOpen('${item.id}')">
        <div class="lc-lang">${item.track}</div>
        <div class="lc-title">${item.title}</div>
        <div class="lc-desc">${item.desc}</div>
        <div class="lc-meta">
          <span class="lc-level ${getLevelClass(item.level)}">${item.level}</span>
          <span class="lc-dur">${item.duration}</span>
          <span class="lc-dur" style="margin-left:auto;color:var(--accent);font-weight:700;">${actionLabel(item)}</span>
        </div>
        <div class="lc-prog"><div class="lc-prog-fill" style="width:${item.progress}%"></div></div>
      </div>
    `).join('');
  }

  function openItem(id) {
    const item = data.find(entry => entry.id === id);
    if (!item) return;
    const action = item.action || {};

    if (action.type === 'note') {
      api.openNote(action.noteId);
      return;
    }
    if (action.type === 'tool') {
      api.openTool(action.target);
      return;
    }
    if (action.type === 'game') {
      api.openGame(action.target);
      return;
    }
    if (action.type === 'template') {
      api.createCurriculumNote(item);
      return;
    }
    if (action.type === 'window') {
      api.openApp(action.target);
    }
  }

  window.curriculumOpen = openItem;
  window.setTab = function setTab(el, type) {
    document.querySelectorAll('.curr-tab').forEach(tab => tab.classList.remove('active'));
    if (el) el.classList.add('active');
    activeTab = type;
    render();
  };

  window.currFilter = function currFilter(type, el) {
    document.querySelectorAll('#win-curriculum .sb-item').forEach(item => item.classList.remove('active'));
    if (el) el.classList.add('active');
    activeSidebar = type;
    render();
  };

  searchInput.addEventListener('input', (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    render();
  });

  render();
};
