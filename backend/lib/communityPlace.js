/* Putting a Community lesson onto a board (16.10.2026).
 *
 * The lesson arrives as one frame. A published single lesson already is one;
 * a whole Space is wrapped in a new frame named after it, so it lands as one
 * block the teacher can move or delete.
 *
 * Where (ТЗ, "Insert to Student"): the way the board reads. Its own flow
 * direction if it has one; else the direction of its last three frames if one
 * axis clearly wins; else to the right of the right-most frame - one default for
 * every board. The gap is kept and nothing is covered.
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

/* Which way the board reads. In this order, and never a guess that could put
   the lesson in the wrong place:
     1. the board's own flow direction, when it has one;
     2. the direction of the last three frames - one axis must clearly win;
     3. otherwise "right", the one default for every board. */
const DOMINANCE = 1.5;
function flowDirection(boardData, frames) {
  const own = String(boardData.flowDirection || boardData.flow || '').toLowerCase();
  if (own === 'horizontal' || own === 'right') return { dir: 'right', why: 'board' };
  if (own === 'vertical' || own === 'down') return { dir: 'down', why: 'board' };
  const last = frames.slice(-3);
  if (last.length >= 2) {
    const at = last.map(c => { const b = box(c); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; });
    let dx = 0, dy = 0;
    for (let i = 1; i < at.length; i++) { dx += Math.abs(at[i].x - at[i - 1].x); dy += Math.abs(at[i].y - at[i - 1].y); }
    if (dx >= dy * DOMINANCE && dx > 0) return { dir: 'right', why: 'recent' };
    if (dy >= dx * DOMINANCE && dy > 0) return { dir: 'down', why: 'recent' };
  }
  return { dir: 'right', why: 'default' };
}

/* Where the lesson frame goes: after the end of the flow, in its direction,
   keeping the gap and never on top of anything. Returns {x, y, dir, why}. */
function findSpot(boardData, size) {
  const existing = (boardData.cards || []).filter(c => c && !c.data?.parentFrame);
  if (!existing.length) return { x: 0, y: 0, dir: 'right', why: 'empty' };
  const frames = existing.filter(c => c.type === 'frame');
  const { dir, why } = flowDirection(boardData, frames);
  const pool = frames.length ? frames : existing;
  // the end of the flow: the right-most frame for "right", the lowest for "down"
  const end = box(pool.slice().sort((a, b) => dir === 'right'
    ? (box(b).x + box(b).w) - (box(a).x + box(a).w)
    : (box(b).y + box(b).h) - (box(a).y + box(a).h))[0]);
  const free = s => !existing.some(c => overlaps({ ...s, ...size }, box(c)));
  let spot = dir === 'right' ? { x: end.x + end.w + GAP, y: end.y } : { x: end.x, y: end.y + end.h + GAP };
  // something sits there: slide along the flow, past it, still with the gap
  for (let i = 0; i < 40 && !free(spot); i++) {
    const hit = existing.find(c => overlaps({ ...spot, ...size }, box(c)));
    const b = box(hit);
    spot = dir === 'right' ? { x: b.x + b.w + GAP, y: spot.y } : { x: spot.x, y: b.y + b.h + GAP };
  }
  if (!free(spot)) { const all = bounds(existing); spot = { x: all.x, y: all.y + all.h + GAP }; }
  return { ...spot, dir, why };
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
  return { data: board, frameId: r.map.get(frameId), spot, cardIds: r.cards.map(c => c.id), arrowIds: r.links.map(l => l.id), direction: spot.dir, directionWhy: spot.why };
}

/* A new board that is the lesson, laid out as the author made it. */
function lessonBoard(snapshot) {
  const cards = ((snapshot && snapshot.cards) || []).filter(c => c && typeof c === 'object');
  const r = remap(cards, snapshot, 0, 0, 1);
  return { cards: r.cards, arrows: r.links, pan: { x: 100, y: 60 }, scale: 1, nextId: r.cards.length + 10 };
}

module.exports = { placeLesson, lessonBoard, findSpot, flowDirection, asOneFrame };
