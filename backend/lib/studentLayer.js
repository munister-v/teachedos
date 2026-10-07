/* A student's own layer on a board: pen strokes, short text notes and emoji
   stickers, in board coordinates. The shared board stays read-only for
   students; this is what they add on top of it. Kept per student, shown to
   the board owner, never merged into the board JSON the teacher saves. */
const MAX_STROKES = 400;
const MAX_POINTS = 2000;
const MAX_NOTES = 200;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const num = v => (Number.isFinite(+v) ? Math.round(+v * 10) / 10 : 0);
const clamp = v => Math.max(-100000, Math.min(100000, num(v)));

function sanitizeLayer(raw) {
  const out = { strokes: [], notes: [] };
  if (!raw || typeof raw !== 'object') return out;
  (Array.isArray(raw.strokes) ? raw.strokes : []).slice(0, MAX_STROKES).forEach(s => {
    if (!s || !Array.isArray(s.p)) return;
    const p = s.p.slice(0, MAX_POINTS).filter(q => Array.isArray(q)).map(q => [clamp(q[0]), clamp(q[1])]);
    if (!p.length) return;
    out.strokes.push({
      id: String(s.id || '').slice(0, 24),
      c: COLOR.test(s.c) ? s.c : '#24282C',
      w: Math.max(1, Math.min(24, num(s.w) || 3)),
      p,
    });
  });
  (Array.isArray(raw.notes) ? raw.notes : []).slice(0, MAX_NOTES).forEach(n => {
    if (!n || typeof n !== 'object') return;
    const kind = n.kind === 'sticker' ? 'sticker' : 'text';
    const item = { id: String(n.id || '').slice(0, 24), kind, x: clamp(n.x), y: clamp(n.y) };
    if (kind === 'sticker') item.glyph = String(n.glyph || '').slice(0, 8);
    else item.text = String(n.text || '').slice(0, 500);
    if (kind === 'sticker' ? item.glyph : item.text.trim()) out.notes.push(item);
  });
  return out;
}

module.exports = { sanitizeLayer };
