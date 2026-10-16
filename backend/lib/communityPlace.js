/* Putting a Community lesson onto a board (16.10.2026).
 *
 * The lesson arrives as one frame. A published single lesson already is one;
 * a whole Space is wrapped in a new frame named after it, so it lands as one
 * block the teacher can move or delete.
 *
 * Where: next to where the teacher stopped. The frame nearest the middle of
 * the last saved view is the anchor; the lesson goes to its right, else below
 * it, else under everything on the board - never on top of other cards.
 *
 * Every card gets a new id (with parentFrame, childIds and arrows remapped):
 * the copy is the teacher's own and shares nothing with the original.
 */
const GAP = 120;
const PAD = 60;
const HEADER = 70;

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const box = c => ({ x: num(c.x), y: num(c.y), w: Math.max(1, num(c.w, 200)), h: Math.max(1, num(c.h, 120)) });
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function bounds(cards) {
  if (!cards.length) return null;
  const bs = cards.map(box);
  const x = Math.min(...bs.map(b => b.x)), y = Math.min(...bs.map(b => b.y));
  return { x, y, w: Math.max(...bs.map(b => b.x + b.w)) - x, h: Math.max(...bs.map(b => b.y + b.h)) - y };
}
const newId = () => 'cm' + Math.random().toString(36).slice(2, 10);

/* The lesson as one frame: [{...cards}], frameId. */
function asOneFrame(srcCards, title) {
  const cards = srcCards.filter(c => c && typeof c === 'object').map(c => ({ ...c, data: { ...(c.data || {}) } }));
  const ids = new Set(cards.map(c => c.id));
  const roots = cards.filter(c => !(c.data.parentFrame && ids.has(c.data.parentFrame)));
  if (roots.length === 1 && roots[0].type === 'frame') return { cards, frameId: roots[0].id };
  const b = bounds(cards) || { x: 0, y: 0, w: 600, h: 400 };
  const frame = {
    id: newId(), type: 'frame', x: b.x - PAD, y: b.y - PAD - HEADER, w: b.w + PAD * 2, h: b.h + PAD * 2 + HEADER, z: 0,
    data: { title: String(title || 'Community lesson').slice(0, 120), bg: '#ffffff', border: '#886BF3', childIds: roots.map(c => c.id) },
  };
  roots.forEach(c => { c.data.parentFrame = frame.id; });
  return { cards: [frame, ...cards], frameId: frame.id };
}

/* Where the lesson frame goes on this board. */
function findSpot(boardData, size) {
  const existing = (boardData.cards || []).filter(c => c && !c.data?.parentFrame);
  if (!existing.length) return { x: 0, y: 0 };
  const frames = existing.filter(c => c.type === 'frame');
  const scale = num(boardData.scale, 1) || 1;
  const pan = boardData.pan || {};
  // the middle of the last view, in board coordinates (a laptop-sized screen)
  const view = { x: (720 - num(pan.x, 100)) / scale, y: (420 - num(pan.y, 60)) / scale };
  const pool = frames.length ? frames : existing;
  const centre = c => { const b = box(c); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; };
  const anchor = box(pool.slice().sort((a, b) => {
    const ca = centre(a), cb = centre(b);
    return Math.hypot(ca.x - view.x, ca.y - view.y) - Math.hypot(cb.x - view.x, cb.y - view.y);
  })[0]);
  const free = s => !existing.some(c => overlaps({ ...s, ...size }, box(c)));
  const right = { x: anchor.x + anchor.w + GAP, y: anchor.y };
  if (free(right)) return right;
  const below = { x: anchor.x, y: anchor.y + anchor.h + GAP };
  if (free(below)) return below;
  const all = bounds(existing);
  return { x: all.x, y: all.y + all.h + GAP };
}

/* New ids for every card and arrow, moved by (dx, dy), stacked from z. */
function remap(cards, snapshot, dx, dy, z) {
  const map = new Map(cards.map(c => [c.id, newId()]));
  const out = cards.map((c, i) => {
    const data = { ...(c.data || {}) };
    if (data.parentFrame) data.parentFrame = map.get(data.parentFrame) || data.parentFrame;
    if (Array.isArray(data.childIds)) data.childIds = data.childIds.map(id => map.get(id) || id);
    return { ...c, id: map.get(c.id), x: num(c.x) + dx, y: num(c.y) + dy, z: z + i, data };
  });
  const links = ((snapshot && (snapshot.links || snapshot.arrows)) || []).map(a => {
    const from = a.fromCard || a.from, to = a.toCard || a.to;
    // an end on a card must be one of the copied cards; a free end (point) moves with them
    if ((from && !map.has(from)) || (to && !map.has(to)) || (!from && !a.fromPoint) || (!to && !a.toPoint)) return null;
    const { from: _f, to: _t, ...rest } = a;
    const pt = p => (p && typeof p === 'object' ? { ...p, x: num(p.x) + dx, y: num(p.y) + dy } : p);
    return { ...rest, id: newId(), ...(from ? { fromCard: map.get(from) } : { fromPoint: pt(a.fromPoint) }), ...(to ? { toCard: map.get(to) } : { toPoint: pt(a.toPoint) }) };
  }).filter(Boolean);
  return { cards: out, links, map };
}

/* Returns { data, frameId, spot } - the board with the lesson added. */
function placeLesson(boardData, snapshot, title) {
  const board = { ...(boardData || {}), cards: [...((boardData && boardData.cards) || [])], arrows: [...((boardData && boardData.arrows) || [])] };
  const { cards, frameId } = asOneFrame((snapshot && snapshot.cards) || [], title);
  const fb = box(cards.find(c => c.id === frameId));
  const spot = findSpot(board, { w: fb.w, h: fb.h });
  const zTop = Math.max(0, ...board.cards.map(c => num(c.z)));
  const r = remap(cards, snapshot, spot.x - fb.x, spot.y - fb.y, zTop + 1);
  board.cards.push(...r.cards);
  board.arrows.push(...r.links);
  return { data: board, frameId: r.map.get(frameId), spot };
}

/* A new board that is the lesson, laid out as the author made it. */
function lessonBoard(snapshot) {
  const cards = ((snapshot && snapshot.cards) || []).filter(c => c && typeof c === 'object');
  const r = remap(cards, snapshot, 0, 0, 1);
  return { cards: r.cards, arrows: r.links, pan: { x: 100, y: 60 }, scale: 1, nextId: r.cards.length + 10 };
}

module.exports = { placeLesson, lessonBoard, findSpot, asOneFrame };
