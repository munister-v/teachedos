/* "Used in class": a material is verified when it really reached a student
   during a lesson that ran (ТЗ "Used in class").

   A lesson is a live board with the teacher and at least one student on it
   together. A published material counts when
     - it stayed in the teacher's view for the material's threshold (60 s for a
       lesson; configurable per kind - a game is a round, not a minute), or
     - a student acted on the board while it was in view.
   One publication counts once per lesson. A preview, the author's own
   material and a lesson with nobody else in it never count.

   This is the pure part - it is fed what the WebSocket sees and says when a
   material qualifies. routes/ws.js stores it. */

const SHOWN_SECONDS = { board: 60, lesson: 60, quiz: 45, game: 30, material: 60, other: 60 };
const VIEW = { w: 1280, h: 720 };          // a laptop screen: the client does not send its size
const MAX_STEP_MS = 20000;                 // a stalled timer must not credit a minute at once
const IN_VIEW = 0.35;                      // how much of the smaller of (material, screen) must be visible

const shownSeconds = kind => SHOWN_SECONDS[kind] || SHOWN_SECONDS.other;

function inView(rect, vp) {
  if (!vp || !rect) return false;
  const scale = Number(vp.scale) > 0 ? Number(vp.scale) : 1;
  const vx = -(Number(vp.pan?.x) || 0) / scale, vy = -(Number(vp.pan?.y) || 0) / scale;
  const vw = VIEW.w / scale, vh = VIEW.h / scale;
  const ix = Math.max(0, Math.min(rect.x + rect.w, vx + vw) - Math.max(rect.x, vx));
  const iy = Math.max(0, Math.min(rect.y + rect.h, vy + vh) - Math.max(rect.y, vy));
  const smaller = Math.min(rect.w * rect.h, vw * vh);
  return smaller > 0 && (ix * iy) / smaller >= IN_VIEW;
}

class LessonTracker {
  constructor() {
    this.groups = new Map();      // key -> { key, rect, kind, assignmentId, ... }
    this.seconds = new Map();     // key -> seconds in view
    this.done = new Set();        // already qualified in this lesson
    this.queue = [];
    this.students = new Set();
    this.teacher = true;          // a lesson needs the teacher there too
    this.vp = null;
    this.last = 0;
  }
  setGroups(groups) {
    this.groups = new Map(groups.map(g => [g.key, g]));
  }
  get live() { return this.teacher && this.students.size > 0; }
  /* who is on the board right now (the whole picture, from the room) */
  presence(teacherHere, studentIds, now) {
    this.tick(now);
    this.teacher = !!teacherHere;
    this.students = new Set([...studentIds].map(String));
    this.last = now;
  }
  studentJoined(id, now) { this.tick(now); this.students.add(String(id)); this.last = now; }
  studentLeft(id, now) { this.tick(now); this.students.delete(String(id)); this.last = now; }
  viewport(vp, now) { this.tick(now); this.vp = vp; this.last = now; }
  tick(now) {
    const dt = this.last ? Math.min(Math.max(0, now - this.last), MAX_STEP_MS) : 0;
    this.last = now;
    if (!this.live || !this.vp || !dt) return;
    for (const g of this.groups.values()) {
      if (this.done.has(g.key) || !inView(g.rect, this.vp)) continue;
      const s = (this.seconds.get(g.key) || 0) + dt / 1000;
      this.seconds.set(g.key, s);
      if (s >= shownSeconds(g.kind)) this.qualify(g, 'shown');
    }
  }
  /* a student did something on the board (pen, note, sticker, selection) */
  studentAction(now) {
    this.tick(now);
    if (!this.live || !this.vp) return;
    for (const g of this.groups.values()) {
      if (!this.done.has(g.key) && inView(g.rect, this.vp)) this.qualify(g, 'student_action');
    }
  }
  qualify(g, evidence) {
    this.done.add(g.key);
    this.queue.push({ ...g, evidence, seconds: Math.round(this.seconds.get(g.key) || 0), students: this.students.size });
  }
  drain() { const q = this.queue; this.queue = []; return q; }
}

module.exports = { LessonTracker, inView, shownSeconds, SHOWN_SECONDS, VIEW };
