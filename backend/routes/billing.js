const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// ── Stripe (optional — only active if STRIPE_SECRET_KEY is set) ──────────
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Add Stripe columns to users if not present
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`).catch(() => {});
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ`).catch(() => {});
pool.query(`CREATE TABLE IF NOT EXISTS iban_payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  plan TEXT NOT NULL,
  payer_name TEXT NOT NULL,
  tx_date DATE NOT NULL,
  tx_note TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
)`).catch(() => {});

// ── Plan definitions ─────────────────────────────────────────────────────
const PLANS = {
  free: {
    name: 'Free', price: 0, currency: 'usd',
    boards: 3, students_per_board: 5,
    analytics: false, admin: false, calls: false,
    stripe_price_id: null,
    features: [
      '3 lesson boards',
      '5 students per board',
      'Basic card types (sticky, lesson, vocab)',
      'Local autosave',
      'Google Meet / Zoom quick-start',
    ],
  },
  pro: {
    name: 'Teacher Pro', price: 9.90, currency: 'usd',
    boards: -1, students_per_board: 30,
    analytics: true, admin: false, calls: true,
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID || null,
    features: [
      'Unlimited boards',
      '30 students per board',
      'All card types incl. assignments & games',
      'Analytics export & gradebook',
      'Real-time collaboration (WebSockets)',
      'Live session broadcasting to students',
      'Version history (8 auto + 5 pinned)',
      'Priority support',
    ],
  },
  school: {
    name: 'School', price: 29, currency: 'usd',
    boards: -1, students_per_board: -1,
    analytics: true, admin: true, calls: true,
    stripe_price_id: process.env.STRIPE_SCHOOL_PRICE_ID || null,
    features: [
      'Everything in Pro',
      'Unlimited students per board',
      'Admin panel with school-wide analytics',
      'Custom branding & colors',
      'Bulk student import (CSV)',
      'Course builder with modules',
      'Dedicated support',
    ],
  },
};

// ── GET /api/billing/plans ───────────────────────────────────────────────
router.get('/plans', (req, res) => {
  // Strip internal stripe_price_id from public response
  const pub = {};
  Object.entries(PLANS).forEach(([k, v]) => { pub[k] = { ...v, stripe_price_id: undefined }; });
  res.json({ plans: pub });
});

// ── GET /api/billing/usage ───────────────────────────────────────────────
router.get('/usage', requireAuth, async (req, res) => {
  try {
    const plan = req.user.plan || 'free';
    const limits = PLANS[plan] || PLANS.free;

    const [boardRes, studentRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM boards WHERE user_id=$1', [req.user.id]),
      pool.query(
        `SELECT COUNT(DISTINCT bc.user_id) AS count
         FROM board_collaborators bc
         JOIN boards b ON b.id=bc.board_id WHERE b.user_id=$1`,
        [req.user.id]
      ),
    ]);

    res.json({
      plan,
      boards_count:    parseInt(boardRes.rows[0].count, 10),
      students_total:  parseInt(studentRes.rows[0].count, 10),
      limits: {
        boards:             limits.boards,
        students_per_board: limits.students_per_board,
        analytics:          limits.analytics,
        admin:              limits.admin,
        calls:              limits.calls,
      },
      stripe_active: !!stripe,
    });
  } catch (err) {
    console.error('[billing] usage:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/billing/checkout ───────────────────────────────────────────
// Creates a Stripe Checkout session and returns the URL.
// Falls back to direct plan update if Stripe is not configured (dev mode).
router.post('/checkout', requireAuth, async (req, res) => {
  const { plan } = req.body;
  if (!['pro', 'school'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const planDef = PLANS[plan];

  // Dev mode — no Stripe configured
  if (!stripe || !planDef.stripe_price_id) {
    await pool.query('UPDATE users SET plan=$1 WHERE id=$2', [plan, req.user.id]);
    return res.json({ ok: true, plan, dev_mode: true });
  }

  try {
    // Get or create Stripe customer
    let customerId = req.user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name:  req.user.name,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      await pool.query('UPDATE users SET stripe_customer_id=$1 WHERE id=$2', [customerId, req.user.id]);
    }

    const origin = process.env.FRONTEND_URL || 'https://munister.com.ua/teachedos';

    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       'subscription',
      line_items: [{ price: planDef.stripe_price_id, quantity: 1 }],
      success_url: `${origin}/billing-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/index.html`,
      metadata: { userId: req.user.id, plan },
      subscription_data: { metadata: { userId: req.user.id, plan } },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] checkout:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/billing/portal ─────────────────────────────────────────────
// Opens Stripe customer portal for managing subscription.
router.post('/portal', requireAuth, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });
  const customerId = req.user.stripe_customer_id;
  if (!customerId) return res.status(400).json({ error: 'No subscription found' });
  try {
    const origin = process.env.FRONTEND_URL || 'https://munister.com.ua/teachedos';
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${origin}/index.html`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[billing] portal:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/billing/upgrade ─────────────────────────────────────────────
// Direct upgrade (dev/admin only — no payment). Kept for admin use.
router.post('/upgrade', requireAuth, async (req, res) => {
  const { plan } = req.body;
  if (!['free', 'pro', 'school'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  try {
    await pool.query('UPDATE users SET plan=$1 WHERE id=$2', [plan, req.user.id]);
    res.json({ ok: true, plan });
  } catch (err) {
    console.error('[billing] upgrade:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/billing/iban-activate ───────────────────────────────────────
// Activate subscription via IBAN bank transfer.
// Stores payment info and upgrades the plan immediately.
router.post('/iban-activate', requireAuth, async (req, res) => {
  const { plan, payer_name, tx_date, tx_note } = req.body;
  if (!['pro', 'school'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  if (!payer_name || !tx_date) {
    return res.status(400).json({ error: 'Payer name and payment date are required' });
  }
  try {
    // Log the IBAN payment for audit
    await pool.query(
      `INSERT INTO iban_payments (user_id, plan, payer_name, tx_date, tx_note, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       ON CONFLICT DO NOTHING`,
      [req.user.id, plan, payer_name, tx_date, tx_note || null]
    ).catch(() => {});
    // Activate the plan immediately (trust-based for IBAN)
    await pool.query('UPDATE users SET plan=$1 WHERE id=$2', [plan, req.user.id]);
    res.json({ ok: true, plan });
  } catch (err) {
    console.error('[billing] iban-activate:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/billing/webhook (raw body — registered in server.js) ────────
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
    const plan   = obj.metadata?.plan;
    if (userId && plan) {
      await pool.query(
        'UPDATE users SET plan=$1, stripe_subscription_id=$2 WHERE id=$3',
        [plan, obj.subscription, userId]
      ).catch(e => console.error('[webhook] DB update:', e.message));
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const userId = obj.metadata?.userId;
    if (!userId) return res.json({ received: true });
    const status = obj.status; // active, past_due, canceled, etc.
    if (status === 'active') {
      // Map Stripe price to plan
      const priceId = obj.items?.data[0]?.price?.id;
      let plan = 'free';
      if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = 'pro';
      else if (priceId === process.env.STRIPE_SCHOOL_PRICE_ID) plan = 'school';
      await pool.query('UPDATE users SET plan=$1 WHERE id=$2', [plan, userId]).catch(() => {});
    } else if (['canceled', 'unpaid', 'past_due'].includes(status)) {
      await pool.query("UPDATE users SET plan='free' WHERE id=$1", [userId]).catch(() => {});
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const userId = obj.metadata?.userId;
    if (userId) {
      await pool.query(
        "UPDATE users SET plan='free', stripe_subscription_id=NULL WHERE id=$1",
        [userId]
      ).catch(() => {});
    }
  }

  res.json({ received: true });
}

module.exports = router;
module.exports.handleWebhook = handleWebhook;
