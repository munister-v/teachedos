/* ═══════════════════════════════════════════════════════════════════════
   TeachEd — Custom Word Sets
   Lets a teacher build their own vocabulary set (own words, or AI-assisted
   via /api/ai/teacher-tool) and play it in any games/*.html that supports
   ?set=<id> the same way it supports ?topic=<id>.

   Storage: localStorage key "teachedos_customsets" — { [id]: SetRecord }
   SetRecord: { id, name, icon, color, words:[{en,uk,ru,ex,img}], createdAt }
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  const KEY = 'teachedos_customsets';

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return {};
    }
  }
  function saveAll(all) {
    localStorage.setItem(KEY, JSON.stringify(all));
  }

  function list() {
    return Object.values(loadAll()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function get(id) {
    const all = loadAll();
    return all[id] || null;
  }

  function save(set) {
    const all = loadAll();
    const id = set.id || ('set-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const rec = {
      id,
      name: set.name || 'My word set',
      icon: set.icon || '📚',
      color: set.color || '#C8E632',
      words: (set.words || []).map(w => ({
        en: String(w.en || '').trim(),
        uk: String(w.uk || '').trim(),
        ru: String(w.ru || '').trim(),
        ex: String(w.ex || '').trim(),
        img: String(w.img || '').trim(),
      })).filter(w => w.en),
      createdAt: set.createdAt || Date.now(),
    };
    all[id] = rec;
    saveAll(all);
    return rec;
  }

  function remove(id) {
    const all = loadAll();
    delete all[id];
    saveAll(all);
  }

  window.TEACHEDOS_CUSTOM = { list, get, save, remove };
})();
