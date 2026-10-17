/* TeachEd memory for the generators and the board assistant (ТЗ «Память TeachEd» §5).

   The client sends only the board's id; the server reads the rest. What the model
   gets is a short private brief: the teacher's style, and - when the board belongs
   to this teacher and has exactly one student - that student's dossier (their own
   words, goals, interests, the mistakes that keep coming back). Contact details are
   removed first. A minor whose parent has not agreed to AI use: their dossier stays
   out, the teacher's style still goes in (it is about the teacher).

   The brief never goes into the material itself: callers pass it as its own field
   (input.memory), which only the model's prompt reads - the offline templates print
   input.extra, not this. */
const { redactPII } = require('./pii');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cut = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

async function memoryContext(db, teacherId, boardId) {
  const parts = [];
  const { rows: [m] } = await db.query('SELECT style FROM teacher_memory WHERE teacher_id = $1', [teacherId]);
  const style = (m && m.style) || {};
  const styleLine = [cut(style.memory, 400), style.tone ? `tone: ${cut(style.tone, 30)}` : '', style.goal ? `usual goal: ${cut(style.goal, 30)}` : ''].filter(Boolean).join('; ');
  if (styleLine) parts.push(`Teacher's style: ${styleLine}.`);

  if (UUID.test(String(boardId || ''))) {
    // the board is this teacher's, and it has one student: whose lesson this is
    const { rows: students } = await db.query(
      `SELECT bc.user_id FROM boards b
         JOIN board_collaborators bc ON bc.board_id = b.id
         JOIN users u ON u.id = bc.user_id AND u.role = 'student'
        WHERE b.id = $1 AND b.user_id = $2`, [boardId, teacherId]);
    if (students.length === 1) {
      const { rows: [d] } = await db.query(
        `SELECT d.interests, d.goals, d.notes, d.weak_spots, d.common_mistakes, j.minor, j.consent_at, j.level
           FROM student_journal j JOIN student_dossier d ON d.journal_id = j.id AND d.teacher_id = j.teacher_id AND d.archived_at IS NULL
          WHERE j.teacher_id = $1 AND j.student_id = $2
          ORDER BY d.updated_at DESC LIMIT 1`, [teacherId, students[0].user_id]);
      if (d && !(d.minor && !d.consent_at)) {
        const top = (Array.isArray(d.common_mistakes) ? d.common_mistakes : [])
          .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0)).slice(0, 5)
          .map(x => `${cut(x.pattern, 40)}${Number(x.count) > 1 ? ` (x${Number(x.count)})` : ''}`);
        const line = [
          d.level ? `level ${cut(d.level, 8)}` : '',
          d.interests ? `interests: ${cut(d.interests, 200)}` : '',
          d.goals ? `goals: ${cut(d.goals, 200)}` : '',
          d.notes ? `teacher's notes: ${cut(d.notes, 400)}` : '',
          d.weak_spots ? `weak spots: ${cut(d.weak_spots, 250)}` : '',
          top.length ? `mistakes that keep coming back: ${top.join(', ')}` : '',
        ].filter(Boolean).join('; ');
        if (line) parts.push(`The student of this lesson: ${line}.`);
      }
    }
  }
  return redactPII(parts.join(' ')).text.slice(0, 1600);
}

/* never let the brief break a generation: no memory is better than no lesson */
async function memoryContextSafe(db, teacherId, boardId) {
  try { return await memoryContext(db, teacherId, boardId); } catch (e) { console.error('[memory/context]', e.message); return ''; }
}

module.exports = { memoryContext, memoryContextSafe };
