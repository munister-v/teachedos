/* The Free plan's AI allowance: a pool of credits, not a daily limit.

   One credit = one AI request. A free teacher gets FREE_START_CREDITS once,
   when they first use the assistant, and FREE_MONTHLY_TOPUP more at the start
   of any month in which they actually taught a lesson (a row in
   lesson_sessions). A sleeping account gets nothing and costs nothing.

   Above the pool sits a fuse for everybody on Free together: the month's AI
   spend of all free accounts cannot pass FREE_AI_MONTHLY_BUDGET_USD, however
   many sign up. When it is spent, free AI actions wait for next month (or Pro).
   Paid plans are not touched by any of this. */

const intEnv = (name, dflt) => {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
};
const numEnv = (name, dflt) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
};

const startCredits = () => intEnv('FREE_START_CREDITS', 30);
const monthlyTopup = () => intEnv('FREE_MONTHLY_TOPUP', 10);
const budgetCapUsd = () => numEnv('FREE_AI_MONTHLY_BUDGET_USD', 200);

const THIS_MONTH = `date_trunc('month', CURRENT_DATE)::date`;

/* Creates the pool on first use (the starting credits count as this month's
   grant, so the first top-up comes next month), then tops it up if this month
   has a real lesson and no top-up yet. */
async function ensurePool(db, userId) {
  await db.query(
    `INSERT INTO ai_credit_pool (user_id, balance, granted, last_topup_month)
     VALUES ($1, $2, $2, ${THIS_MONTH})
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, startCredits()],
  );
  const topup = monthlyTopup();
  if (topup > 0) {
    await db.query(
      `UPDATE ai_credit_pool
         SET balance = balance + $2, granted = granted + $2, last_topup_month = ${THIS_MONTH}
       WHERE user_id = $1 AND last_topup_month < ${THIS_MONTH}
         AND EXISTS (SELECT 1 FROM lesson_sessions ls
                     WHERE ls.teacher_id = $1
                       AND ls.started_at >= ${THIS_MONTH}
                       AND ls.started_at < (${THIS_MONTH} + interval '1 month'))`,
      [userId, topup],
    );
  }
}

/* -> { balance, granted } or null when the pool is empty */
async function takeCredit(db, userId) {
  await ensurePool(db, userId);
  const { rows } = await db.query(
    `UPDATE ai_credit_pool SET balance = balance - 1
     WHERE user_id = $1 AND balance > 0
     RETURNING balance, granted`,
    [userId],
  );
  return rows[0] || null;
}

async function refundCredit(db, userId) {
  await db.query(`UPDATE ai_credit_pool SET balance = balance + 1 WHERE user_id = $1`, [userId]);
}

/* Holds `usd` of the shared free budget. false = the fuse is blown. */
async function reserveBudget(db, usd) {
  const cap = budgetCapUsd();
  if (!(usd >= 0) || usd > cap) return false;
  const { rows } = await db.query(
    `INSERT INTO ai_free_budget (month, spent_usd) VALUES (${THIS_MONTH}, $1)
     ON CONFLICT (month) DO UPDATE SET spent_usd = ai_free_budget.spent_usd + EXCLUDED.spent_usd
       WHERE ai_free_budget.spent_usd + EXCLUDED.spent_usd <= $2
     RETURNING spent_usd`,
    [usd, cap],
  );
  return rows.length > 0;
}

/* The held estimate is replaced by the real cost (delta may be negative). */
async function adjustBudget(db, deltaUsd) {
  if (!deltaUsd) return;
  await db.query(
    `UPDATE ai_free_budget SET spent_usd = GREATEST(0, spent_usd + $1) WHERE month = ${THIS_MONTH}`,
    [deltaUsd],
  );
}

async function budgetState(db) {
  const { rows } = await db.query(`SELECT spent_usd FROM ai_free_budget WHERE month = ${THIS_MONTH}`);
  const cap = budgetCapUsd();
  const spent = Number(rows[0]?.spent_usd || 0);
  return { cap_usd: cap, spent_usd: Number(spent.toFixed(4)), exhausted: spent >= cap };
}

/* What the account page shows: how many credits are left, and what refills them. */
async function readPool(db, userId) {
  await ensurePool(db, userId);
  const { rows } = await db.query(
    `SELECT p.balance, p.granted, (p.last_topup_month < ${THIS_MONTH}) AS topup_open,
            (date_trunc('month', CURRENT_DATE) + interval '1 month')::date AS next_month,
            EXISTS (SELECT 1 FROM lesson_sessions ls
                    WHERE ls.teacher_id = p.user_id AND ls.started_at >= ${THIS_MONTH}) AS taught_this_month
     FROM ai_credit_pool p WHERE p.user_id = $1`,
    [userId],
  );
  const r = rows[0] || { balance: 0, granted: 0, topup_open: false, taught_this_month: false };
  return {
    balance: Number(r.balance), granted: Number(r.granted),
    used: Math.max(0, Number(r.granted) - Number(r.balance)),
    topup: monthlyTopup(),
    // true: teach a lesson this month and 10 more arrive on your next request
    topup_waiting_for_lesson: !!r.topup_open && !r.taught_this_month,
    next_month: r.next_month,
  };
}

module.exports = {
  startCredits, monthlyTopup, budgetCapUsd,
  ensurePool, takeCredit, refundCredit, reserveBudget, adjustBudget, budgetState, readPool,
};
