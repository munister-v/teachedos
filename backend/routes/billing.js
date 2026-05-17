const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const {
  PLAN_CATALOG,
  normalizePlanKey,
  normalizeCycleKey,
  computePlanQuote,
  buildPublicPlans,
  derivePlanState,
  usageSnapshot,
  paymentStatusMeta,
  ensureBillingSchema,
} = require('../lib/billing');

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

ensureBillingSchema(pool).catch(err => console.error('[billing] schema:', err.message));

const STRIPE_PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID || null,
  school: process.env.STRIPE_SCHOOL_PRICE_ID || null,
};

function planFromStripePrice(priceId) {
  if (priceId && priceId === STRIPE_PRICE_IDS.pro) return 'pro';
  if (priceId && priceId === STRIPE_PRICE_IDS.school) return 'school';
  return 'free';
}

async function loadUsageCounts(userId) {
  const [boardRes, studentRes, coursesRes, storageRes] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM boards WHERE user_id=$1', [userId]),
    pool.query(
      `SELECT COALESCE(MAX(student_count), 0)::int AS max_count,
              COALESCE(SUM(student_count), 0)::int AS total_count
       FROM (
         SELECT b.id, COUNT(DISTINCT bc.user_id)::int AS student_count
         FROM boards b
         LEFT JOIN board_collaborators bc ON bc.board_id = b.id
         WHERE b.user_id = $1
         GROUP BY b.id
       ) t`,
      [userId]
    ),
    pool.query('SELECT COUNT(*)::int AS count FROM courses WHERE user_id=$1', [userId]).catch(() => ({ rows: [{ count: 0 }] })),
    pool.query('SELECT COALESCE(SUM(pg_column_size(data)), 0)::bigint AS bytes FROM boards WHERE user_id=$1', [userId]),
  ]);

  return {
    boards_count: Number(boardRes.rows[0]?.count || 0),
    students_total: Number(studentRes.rows[0]?.total_count || 0),
    max_students_on_board: Number(studentRes.rows[0]?.max_count || 0),
    courses_count: Number(coursesRes.rows[0]?.count || 0),
    storage_bytes: Number(storageRes.rows[0]?.bytes || 0),
  };
}

async function loadLatestPendingPayment(userId) {
  const { rows } = await pool.query(
    `SELECT id, plan, payer_name, tx_date, tx_note, status, amount, currency, invoice_no,
            billing_cycle, months, company_name, contact_email, package_snapshot, created_at
     FROM iban_payments
     WHERE user_id=$1 AND status='pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function loadRecentPayments(userId, limit = 8) {
  const { rows } = await pool.query(
    `SELECT id, plan, payer_name, tx_date, tx_note, status, amount, currency, invoice_no,
            admin_note, reviewed_at, billing_cycle, months, company_name, contact_email,
            package_snapshot, created_at
     FROM iban_payments
     WHERE user_id=$1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map(row => ({
    ...row,
    status_meta: paymentStatusMeta(row.status),
  }));
}

async function activatePlanForUser({
  userId,
  plan,
  cycle,
  months,
  source,
  client = pool,
  startsAt = null,
}) {
  const safePlan = normalizePlanKey(plan);
  const safeCycle = normalizeCycleKey(cycle);
  const safeMonths = Math.max(1, parseInt(months, 10) || 1);
  const startExpr = startsAt ? 'GREATEST(COALESCE(plan_expires_at, $5::timestamptz), $5::timestamptz)' : 'GREATEST(COALESCE(plan_expires_at, NOW()), NOW())';
  const params = startsAt
    ? [safePlan, safeCycle, safeMonths, source || 'manual', startsAt, userId]
    : [safePlan, safeCycle, safeMonths, source || 'manual', userId];
  const userIdPlaceholder = startsAt ? '$6' : '$5';

  await client.query(
    `UPDATE users
     SET plan=$1,
         plan_status='active',
         billing_cycle=$2,
         plan_started_at=COALESCE(plan_started_at, NOW()),
         plan_expires_at=${startExpr} + ($3::int * INTERVAL '1 month'),
         plan_source=$4
     WHERE id=${userIdPlaceholder}`,
    params
  );
}

router.get('/plans', (_req, res) => {
  res.json({
    plans: buildPublicPlans(),
    stripe_active: !!stripe,
    stripe_supported_cycles: ['monthly'],
  });
});

router.get('/usage', requireAuth, async (req, res) => {
  try {
    const state = derivePlanState(req.user);
    const counts = await loadUsageCounts(req.user.id);
    const usage = usageSnapshot(state.plan, counts);
    const planDef = PLAN_CATALOG[state.plan];
    res.json({
      current: state,
      counts,
      usage,
      limits: {
        boards: planDef.limits.boards,
        students_per_board: planDef.limits.studentsPerBoard,
        courses: planDef.limits.courses,
        storage_mb: planDef.limits.storageMb,
        history_snapshots: planDef.limits.historySnapshots,
        analytics: planDef.flags.analytics,
        admin: planDef.flags.adminPanel,
        realtime: planDef.flags.realtime,
        exports: planDef.flags.exports,
        custom_branding: planDef.flags.customBranding,
      },
      stripe_active: !!stripe,
    });
  } catch (err) {
    console.error('[billing] usage:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/overview', requireAuth, async (req, res) => {
  try {
    await ensureBillingSchema(pool);
    const state = derivePlanState(req.user);
    const [counts, pendingPayment, payments] = await Promise.all([
      loadUsageCounts(req.user.id),
      loadLatestPendingPayment(req.user.id),
      loadRecentPayments(req.user.id, 8),
    ]);
    const usage = usageSnapshot(state.plan, counts);
    const planDef = PLAN_CATALOG[state.plan];
    res.json({
      current: {
        ...state,
        name: planDef.name,
        badge: planDef.badge,
        features: planDef.features,
        flags: planDef.flags,
        limits: planDef.limits,
      },
      usage,
      counts,
      pending_payment: pendingPayment ? {
        ...pendingPayment,
        status_meta: paymentStatusMeta(pendingPayment.status),
      } : null,
      payments,
      plans: buildPublicPlans(),
      can_request_manual_payment: !pendingPayment,
      stripe_active: !!stripe,
    });
  } catch (err) {
    console.error('[billing] overview:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/checkout', requireAuth, async (req, res) => {
  const plan = normalizePlanKey(req.body?.plan);
  const cycle = normalizeCycleKey(req.body?.cycle);
  if (!['pro', 'school'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  if (cycle !== 'monthly') {
    return res.status(400).json({ error: 'Stripe checkout currently supports monthly billing only. Use invoice request for quarterly or yearly billing.' });
  }

  if (!stripe || !STRIPE_PRICE_IDS[plan]) {
    try {
      await pool.query(
        `UPDATE users
         SET plan=$1, plan_status='active', billing_cycle='monthly', plan_started_at=NOW(),
             plan_expires_at=NOW() + INTERVAL '1 month', plan_source='dev'
         WHERE id=$2`,
        [plan, req.user.id]
      );
      return res.json({ ok: true, plan, cycle, dev_mode: true });
    } catch (err) {
      console.error('[billing] checkout-dev:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  try {
    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      await pool.query('UPDATE users SET stripe_customer_id=$1 WHERE id=$2', [customerId, req.user.id]);
    }

    const origin = process.env.FRONTEND_URL || 'https://munister.com.ua/teachedos';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_IDS[plan], quantity: 1 }],
      success_url: `${origin}/billing-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/profile.html#plans`,
      metadata: { userId: req.user.id, plan, cycle },
      subscription_data: { metadata: { userId: req.user.id, plan, cycle } },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] checkout:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/portal', requireAuth, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });
  const customerId = req.user.stripe_customer_id;
  if (!customerId) return res.status(400).json({ error: 'No subscription found' });
  try {
    const origin = process.env.FRONTEND_URL || 'https://munister.com.ua/teachedos';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/profile.html#plans`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] portal:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/upgrade', requireAuth, async (req, res) => {
  const plan = normalizePlanKey(req.body?.plan);
  const cycle = normalizeCycleKey(req.body?.cycle);
  if (!['free', 'pro', 'school'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  try {
    if (plan === 'free') {
      await pool.query(
        `UPDATE users
         SET plan='free', plan_status='free', billing_cycle='monthly',
             plan_started_at=NULL, plan_expires_at=NULL, plan_source='admin'
         WHERE id=$1`,
        [req.user.id]
      );
    } else {
      await activatePlanForUser({
        userId: req.user.id,
        plan,
        cycle,
        months: computePlanQuote(plan, cycle).months,
        source: 'admin',
      });
    }
    res.json({ ok: true, plan, cycle });
  } catch (err) {
    console.error('[billing] upgrade:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/iban-activate', requireAuth, async (req, res) => {
  const plan = normalizePlanKey(req.body?.plan);
  const billingCycle = normalizeCycleKey(req.body?.billing_cycle);
  const payerName = String(req.body?.payer_name || '').trim();
  const txDate = req.body?.tx_date;
  const txNote = String(req.body?.tx_note || '').trim();
  const companyName = String(req.body?.company_name || '').trim();
  const contactEmail = String(req.body?.contact_email || req.user.email || '').trim().toLowerCase();

  if (!['pro', 'school'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  if (!payerName || !txDate) {
    return res.status(400).json({ error: 'Payer name and payment date are required' });
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return res.status(400).json({ error: 'Contact email is invalid' });
  }

  try {
    await ensureBillingSchema(pool);
    const pending = await loadLatestPendingPayment(req.user.id);
    if (pending) {
      return res.status(409).json({
        error: 'You already have a pending payment request. Please wait for admin review before sending a new one.',
        payment: pending,
      });
    }

    const quote = computePlanQuote(plan, billingCycle);
    const invoiceNo = `TD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const packageSnapshot = {
      plan,
      plan_name: PLAN_CATALOG[plan].name,
      cycle: billingCycle,
      quote,
      limits: PLAN_CATALOG[plan].limits,
      flags: PLAN_CATALOG[plan].flags,
    };

    const { rows } = await pool.query(
      `INSERT INTO iban_payments (
         user_id, plan, payer_name, tx_date, tx_note, status, amount, currency, invoice_no,
         billing_cycle, months, company_name, contact_email, package_snapshot, created_at
       )
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW())
       RETURNING id, plan, payer_name, tx_date, tx_note, status, amount, currency, invoice_no,
                 billing_cycle, months, company_name, contact_email, package_snapshot, created_at`,
      [
        req.user.id,
        plan,
        payerName.slice(0, 255),
        txDate,
        txNote || null,
        quote.total,
        quote.currency,
        invoiceNo,
        billingCycle,
        quote.months,
        companyName || null,
        contactEmail || null,
        JSON.stringify(packageSnapshot),
      ]
    );

    res.status(202).json({ ok: true, payment: rows[0] });
  } catch (err) {
    console.error('[billing] iban-activate:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/payments', requireAuth, async (req, res) => {
  try {
    await ensureBillingSchema(pool);
    const payments = await loadRecentPayments(req.user.id, 20);
    res.json({ payments });
  } catch (err) {
    console.error('[billing] payments:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

async function handleWebhook(req, res) {
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook] signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const obj = event.data.object;

  if (event.type === 'checkout.session.completed') {
    const userId = obj.metadata?.userId;
    const plan = normalizePlanKey(obj.metadata?.plan);
    const cycle = normalizeCycleKey(obj.metadata?.cycle);
    if (userId && plan !== 'free') {
      await pool.query(
        `UPDATE users
         SET plan=$1, plan_status='active', billing_cycle=$2, plan_started_at=COALESCE(plan_started_at, NOW()),
             plan_source='stripe', stripe_subscription_id=$3
         WHERE id=$4`,
        [plan, cycle, obj.subscription || null, userId]
      ).catch(e => console.error('[webhook] checkout update:', e.message));
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const userId = obj.metadata?.userId;
    if (userId) {
      const status = obj.status;
      const priceId = obj.items?.data?.[0]?.price?.id;
      const plan = planFromStripePrice(priceId);
      const expiresAt = obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null;
      if (status === 'active' || status === 'trialing') {
        await pool.query(
          `UPDATE users
           SET plan=$1, plan_status='active', billing_cycle='monthly', plan_source='stripe',
               stripe_subscription_id=$2, plan_started_at=COALESCE(plan_started_at, NOW()), plan_expires_at=$3
           WHERE id=$4`,
          [plan, obj.id || null, expiresAt, userId]
        ).catch(() => {});
      } else if (status === 'past_due') {
        await pool.query(
          `UPDATE users
           SET plan_status='grace', billing_cycle='monthly', plan_source='stripe', plan_expires_at=$1
           WHERE id=$2`,
          [expiresAt, userId]
        ).catch(() => {});
      } else if (['canceled', 'unpaid', 'incomplete_expired'].includes(status)) {
        await pool.query(
          `UPDATE users
           SET plan='free', plan_status='free', billing_cycle='monthly',
               plan_started_at=NULL, plan_expires_at=NULL, plan_source='stripe', stripe_subscription_id=NULL
           WHERE id=$1`,
          [userId]
        ).catch(() => {});
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const userId = obj.metadata?.userId;
    if (userId) {
      await pool.query(
        `UPDATE users
         SET plan='free', plan_status='free', billing_cycle='monthly',
             plan_started_at=NULL, plan_expires_at=NULL, plan_source='stripe', stripe_subscription_id=NULL
         WHERE id=$1`,
        [userId]
      ).catch(() => {});
    }
  }

  res.json({ received: true });
}

module.exports = router;
module.exports.handleWebhook = handleWebhook;
