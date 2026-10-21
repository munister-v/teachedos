/* Launch in waves, not to the whole internet at once.

   A cap on teacher accounts. While there is room, sign-up works as before; at
   the cap a new teacher lands on the waitlist (their email is kept) and the
   admin opens the next wave - 200-300 more places - from the admin API.
   The cap lives in app_flags ('signup_teacher_cap'); SIGNUP_TEACHER_CAP in the
   environment is the fallback. No cap at all = open sign-up. Students and
   people invited to a board or a school never wait. */

const FLAG = 'signup_teacher_cap';

async function readCap(db) {
  const { rows } = await db.query(`SELECT value FROM app_flags WHERE key = $1`, [FLAG]);
  const raw = rows[0] ? rows[0].value : process.env.SIGNUP_TEACHER_CAP;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function countTeachers(db) {
  const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'teacher'`);
  return rows[0].n;
}

/* -> { open, cap, teachers } */
async function signupState(db) {
  const [cap, teachers] = await Promise.all([readCap(db), countTeachers(db)]);
  return { open: cap == null || teachers < cap, cap, teachers };
}

async function setCap(db, cap) {
  if (cap == null) { await db.query(`DELETE FROM app_flags WHERE key = $1`, [FLAG]); return; }
  await db.query(
    `INSERT INTO app_flags (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [FLAG, String(cap)]);
}

async function joinWaitlist(db, email) {
  await db.query(
    `INSERT INTO signup_waitlist (email) VALUES (lower($1)) ON CONFLICT (email) DO NOTHING`, [email]);
}

const WAITLIST_MESSAGE = 'Teached is opening in small waves, and this one is full. You are on the waiting list - we will write to this address when your place opens.';

module.exports = { signupState, setCap, joinWaitlist, readCap, countTeachers, WAITLIST_MESSAGE };
