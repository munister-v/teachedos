/* Parental consent for minors (Lesson Builder 2.0 E5 T-PR1).

   The teacher marks a student as a minor and records the parent or guardian who agreed.
   Until then nothing the child wrote goes to the outside language model: the work still
   reaches the teacher, who reads it without the AI's pre-marking. An adult student, or a
   student the teacher never added to the journal, is not affected. */

/* May this student's work be sent to the model? db is the pool or a transaction client. */
async function aiAllowed(db, studentId, teacherId) {
  if (!studentId || !teacherId) return true;
  const { rows } = await db.query(
    `SELECT 1 FROM student_journal
      WHERE student_id = $1 AND teacher_id = $2 AND minor = TRUE AND consent_at IS NULL LIMIT 1`,
    [studentId, teacherId]);
  return rows.length === 0;
}

const CONSENT_MESSAGE = 'This student is marked as a minor and a parent or guardian has not agreed yet. Record their consent on the student card to use the AI check.';

module.exports = { aiAllowed, CONSENT_MESSAGE };
