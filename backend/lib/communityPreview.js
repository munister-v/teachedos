/* One preview, with a budget (ТЗ "Paid preview").

   A free material is previewed in full - the same interactive sandbox as always.
   A paid one shows its value without giving the source away:
     sample  the author's 3-5 chosen frames (or three spread across the lesson),
             everything else is only a locked line in the table of contents
     timed   the same budget plus a time limit the client enforces (a game: one
             round / about a minute with demo data)
   Nothing the budget removes ever leaves the server: the cards, their answers
   and their assets are cut here, not hidden on the page.

   Configured by the material - `access_type`, `preview_mode`, `preview_item_ids`
   (assignments) - so paid sales can arrive later without rewriting the preview. */

const MAX_SAMPLE_FRAMES = 5;
const DEFAULT_SAMPLE_FRAMES = 3;
const SAMPLE_SHARE = 0.2;                 // "up to 20% of the material" when there are no frames
const TIMED_SECONDS = 60;

const children = (cards, frame) => {
  const ids = new Set((frame.data && frame.data.childIds) || []);
  return cards.filter(c => c !== frame && (ids.has(c.id) || (c.data && c.data.parentFrame === frame.id)));
};

/* Which frames are free to see: the author's pick, else spread across the lesson. */
function pickFrames(frames, itemIds) {
  const chosen = frames.filter(f => itemIds.includes(f.id)).slice(0, MAX_SAMPLE_FRAMES);
  if (chosen.length) return chosen;
  if (frames.length <= DEFAULT_SAMPLE_FRAMES) return frames.slice(0, Math.max(1, Math.ceil(frames.length / 2)));
  const last = frames.length - 1;
  return [...new Set([0, Math.round(last / 2), last])].map(i => frames[i]);
}

/* snapshot: { cards, links }. Returns the visible snapshot and the table of
   contents ("What's included") with what is locked. */
function budgetSnapshot(snapshot, { mode = 'sample', itemIds = [] } = {}) {
  const cards = Array.isArray(snapshot?.cards) ? snapshot.cards.filter(c => c && typeof c === 'object') : [];
  const links = Array.isArray(snapshot?.links) ? snapshot.links : (snapshot?.arrows || []);
  const frames = cards.filter(c => c.type === 'frame');
  const keep = new Set();
  const toc = [];

  if (frames.length) {
    const open = pickFrames(frames, itemIds);
    const openIds = new Set(open.map(f => f.id));
    frames.forEach(f => {
      const isOpen = openIds.has(f.id);
      toc.push({ id: f.id, title: String(f.data?.title || 'Part').slice(0, 120), locked: !isOpen, items: children(cards, f).length });
      if (isOpen) { keep.add(f.id); children(cards, f).forEach(c => keep.add(c.id)); }
    });
    // locked frames stay as outlines so the board still reads as a whole
  } else {
    const n = Math.max(DEFAULT_SAMPLE_FRAMES, Math.ceil(cards.length * SAMPLE_SHARE));
    cards.slice(0, n).forEach(c => keep.add(c.id));
    toc.push({ id: 'all', title: `${cards.length} activities`, locked: cards.length > n, items: cards.length });
  }

  const shown = cards.filter(c => keep.has(c.id));
  const outlines = frames.filter(f => !keep.has(f.id)).map(f => ({
    id: f.id, type: 'frame', x: f.x, y: f.y, w: f.w, h: f.h, z: f.z || 0,
    data: { title: String(f.data?.title || '').slice(0, 120), locked: true, bg: '#EEF0E8', border: '#A3A48D', childIds: [] },
  }));
  const ids = new Set([...shown.map(c => c.id), ...outlines.map(c => c.id)]);
  return {
    snapshot: { name: snapshot?.name || '', cards: [...shown, ...outlines],
      links: links.filter(l => { const f = l.fromCard || l.from, t = l.toCard || l.to; return (!f || ids.has(f)) && (!t || ids.has(t)); }) },
    toc,
    totalItems: cards.length,
    shownItems: shown.length,
    seconds: mode === 'timed' ? TIMED_SECONDS : null,
  };
}

/* May this viewer see the whole thing? The author, an admin, anyone with an
   active entitlement, and everybody for a free material. */
function fullAccess({ access_type }, { isOwner = false, isAdmin = false, entitled = false } = {}) {
  return access_type !== 'paid' || isOwner || isAdmin || entitled;
}

/* What an interface must switch off in a budgeted preview. */
const PAID_PREVIEW_RULES = Object.freeze({ copy: false, insert: false, export: false, edit: false, watermark: 'Preview', countsAsUse: false });
const FREE_PREVIEW_RULES = Object.freeze({ copy: true, insert: true, export: true, edit: false, watermark: null, countsAsUse: false });

module.exports = { budgetSnapshot, fullAccess, pickFrames, PAID_PREVIEW_RULES, FREE_PREVIEW_RULES, TIMED_SECONDS };
