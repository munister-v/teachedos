/* Board invites for people who have no account yet.

   A teacher adds a student by email; if nobody has registered with it, an
   invite row remembers the board. Whichever way that person then signs up -
   the invite link, the normal form, Google - every pending board invite for
   the address seats them on its board. */

async function attachBoardInvites(db, user) {
  if (!user?.id || !user?.email) return 0;
  const { rows } = await db.query(
    `UPDATE invites SET accepted_at = NOW(), accepted_user_id = $1
      WHERE LOWER(email) = LOWER($2) AND board_id IS NOT NULL
        AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
      RETURNING board_id, board_role`,
    [user.id, user.email]
  );
  for (const r of rows) {
    await db.query(
      `INSERT INTO board_collaborators (board_id, user_id, role)
       VALUES ($1, $2, $3) ON CONFLICT (board_id, user_id) DO NOTHING`,
      [r.board_id, user.id, r.board_role || 'student']
    );
  }
  return rows.length;
}

module.exports = { attachBoardInvites };
