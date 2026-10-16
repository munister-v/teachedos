/* Lessons that run on a board, seen from the WebSocket (see lib/verifiedUse.js
   for the rules and lib/communityLessons.js for the storage).

   A board room becomes a lesson when the teacher and at least one student are in
   it together. From then on the teacher's viewport and the students' actions
   feed a tracker; a Community material that qualifies is recorded once. The
   lesson ends five minutes after it stopped being live, or when the room empties. */
const { LessonTracker } = require('./verifiedUse');
const lessons = require('./communityLessons');

const TICK_MS = 15000;
const IDLE_END_MS = 5 * 60000;
const REGROUP_MS = 2 * 60000;          // the teacher may add materials during a lesson
const rooms = new Map();               // boardId -> { tracker, sessionId, timer, groupsAt, idleSince, teacherId, starting }

const fin = n => Number.isFinite(+n) ? +n : 0;

function snapshotPresence(room, ownerId) {
  let teacher = false; const students = new Set();
  for (const c of room || []) {
    if (c.readyState !== 1 || !c.userId) continue;
    if (String(c.userId) === String(ownerId)) teacher = true; else students.add(String(c.userId));
  }
  return { teacher, students };
}

async function regroup(boardId, L) {
  try {
    L.tracker.setGroups(await lessons.boardGroups(boardId)); L.groupsAt = Date.now();
    if (!L.tracker.vp) L.tracker.vp = await lessons.boardView(boardId);   // until the teacher moves, it is where they left it
  } catch (e) { /* the lesson goes on without it */ }
}

async function flush(boardId, L) {
  const now = Date.now();
  L.tracker.tick(now);
  if (L.sessionId) {
    for (const g of L.tracker.drain()) {
      try { await lessons.recordUse(L.sessionId, boardId, L.teacherId, g); } catch (e) { console.error('[lesson] record use:', e.message); }
    }
    lessons.touchSession(L.sessionId, [...L.tracker.students], false).catch(() => {});
  }
  if (Date.now() - L.groupsAt > REGROUP_MS) await regroup(boardId, L);
}

function end(boardId, L) {
  clearInterval(L.timer);
  rooms.delete(boardId);
  if (L.sessionId) lessons.touchSession(L.sessionId, [...L.tracker.students], true).catch(() => {});
}

/* call on every join and leave, with the room's sockets */
async function presence(boardId, room, ownerId) {
  const now = Date.now();
  const { teacher, students } = snapshotPresence(room, ownerId);
  let L = rooms.get(boardId);
  if (!L) {
    if (!teacher || !students.size) return;            // not a lesson (yet)
    L = { tracker: new LessonTracker(), sessionId: null, timer: null, groupsAt: 0, idleSince: 0, teacherId: ownerId, starting: true };
    rooms.set(boardId, L);
    try {
      L.sessionId = await lessons.startSession(boardId, ownerId);
      await regroup(boardId, L);
    } catch (e) { console.error('[lesson] start:', e.message); }
    L.starting = false;
    L.timer = setInterval(() => {
      const live = L.tracker.live;
      if (live) L.idleSince = 0; else if (!L.idleSince) L.idleSince = Date.now();
      if (L.idleSince && Date.now() - L.idleSince > IDLE_END_MS) return end(boardId, L);
      flush(boardId, L).catch(() => {});
    }, TICK_MS);
    if (L.timer.unref) L.timer.unref();
  }
  // who is here NOW, not what it was before the awaits above: a join that raced this one must not be undone
  const here = snapshotPresence(room, ownerId);
  L.tracker.presence(here.teacher, here.students, Date.now());
  if (!room || !room.size) end(boardId, L);
}

/* the teacher moved or zoomed */
function viewport(boardId, msg) {
  const L = rooms.get(boardId);
  if (!L || !msg || !msg.pan) return;
  L.tracker.viewport({ pan: { x: fin(msg.pan.x), y: fin(msg.pan.y) }, scale: fin(msg.scale) || 1 }, Date.now());
}

/* a student drew, wrote or selected something */
function studentAction(boardId) {
  const L = rooms.get(boardId);
  if (L) { L.tracker.studentAction(Date.now()); flush(boardId, L).catch(() => {}); }
}

module.exports = { presence, viewport, studentAction, _rooms: rooms };
