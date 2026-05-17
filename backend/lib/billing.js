const PLAN_CATALOG = {
  free: {
    key: 'free',
    name: 'Free',
    badge: 'Starter',
    priceMonthly: 0,
    currency: 'usd',
    limits: {
      boards: 3,
      studentsPerBoard: 5,
      courses: 1,
      storageMb: 75,
      historySnapshots: 2,
    },
    flags: {
      analytics: false,
      adminPanel: false,
      realtime: false,
      exports: false,
      customBranding: false,
    },
    features: [
      '3 lesson boards',
      '5 students per board',
      '1 course workspace',
      'Local autosave',
      'Basic board toolkit',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Teacher Pro',
    badge: 'Most popular',
    priceMonthly: 9.9,
    currency: 'usd',
    limits: {
      boards: -1,
      studentsPerBoard: 30,
      courses: 20,
      storageMb: 1500,
      historySnapshots: 13,
    },
    flags: {
      analytics: true,
      adminPanel: false,
      realtime: true,
      exports: true,
      customBranding: false,
    },
    features: [
      'Unlimited boards',
      '30 students per board',
      'Analytics export & gradebook',
      'Real-time collaboration',
      'Assignments, games, and live sessions',
    ],
  },
  school: {
    key: 'school',
    name: 'School',
    badge: 'Team',
    priceMonthly: 29,
    currency: 'usd',
    limits: {
      boards: -1,
      studentsPerBoard: -1,
      courses: -1,
      storageMb: 6000,
      historySnapshots: 40,
    },
    flags: {
      analytics: true,
      adminPanel: true,
      realtime: true,
      exports: true,
      customBranding: true,
    },
    features: [
      'Everything in Pro',
      'Unlimited students',
      'Admin-wide control',
      'Bulk onboarding',
      'Custom branding',
    ],
  },
};

const BILLING_CYCLES = {
  monthly: { key: 'monthly', label: 'Monthly', months: 1, discount: 0 },
  quarterly: { key: 'quarterly', label: 'Quarterly', months: 3, discount: 0.08 },
  yearly: { key: 'yearly', label: 'Yearly', months: 12, discount: 0.18 },
};

const PLAN_STATUS_META = {
  free: { label: 'Free tier', tone: 'muted' },
  active: { label: 'Active', tone: 'good' },
  pending: { label: 'Pending review', tone: 'warn' },
  grace: { label: 'Grace period', tone: 'warn' },
  expired: { label: 'Expired', tone: 'bad' },
  canceled: { label: 'Canceled', tone: 'bad' },
  rejected: { label: 'Rejected', tone: 'bad' },
};

function normalizePlanKey(value) {
  return PLAN_CATALOG[value] ? value : 'free';
}

function getPlanDefinition(planKey) {
  return PLAN_CATALOG[normalizePlanKey(planKey)];
}

function getPlanLimit(planKey, limitKey) {
  return getPlanDefinition(planKey)?.limits?.[limitKey];
}

function planHasFeature(planKey, flagKey) {
  return !!getPlanDefinition(planKey)?.flags?.[flagKey];
}

function normalizeCycleKey(value) {
  return BILLING_CYCLES[value] ? value : 'monthly';
}

function monthsForCycle(value) {
  return BILLING_CYCLES[normalizeCycleKey(value)].months;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function computePlanQuote(planKey, cycleKey) {
  const plan = PLAN_CATALOG[normalizePlanKey(planKey)];
  const cycle = BILLING_CYCLES[normalizeCycleKey(cycleKey)];
  const subtotal = roundMoney(plan.priceMonthly * cycle.months);
  const total = roundMoney(subtotal * (1 - cycle.discount));
  const savings = roundMoney(subtotal - total);
  return {
    plan: plan.key,
    cycle: cycle.key,
    cycle_label: cycle.label,
    months: cycle.months,
    subtotal,
    total,
    savings,
    currency: plan.currency,
    monthly_equivalent: cycle.months ? roundMoney(total / cycle.months) : total,
  };
}

function formatLimit(limit) {
  return limit === -1 ? 'Unlimited' : limit;
}

function buildPublicPlans() {
  const plans = {};
  Object.values(PLAN_CATALOG).forEach(plan => {
    plans[plan.key] = {
      key: plan.key,
      name: plan.name,
      badge: plan.badge,
      currency: plan.currency,
      limits: {
        boards: plan.limits.boards,
        students_per_board: plan.limits.studentsPerBoard,
        courses: plan.limits.courses,
        storage_mb: plan.limits.storageMb,
        history_snapshots: plan.limits.historySnapshots,
      },
      flags: {
        analytics: plan.flags.analytics,
        admin: plan.flags.adminPanel,
        realtime: plan.flags.realtime,
        exports: plan.flags.exports,
        custom_branding: plan.flags.customBranding,
      },
      features: [...plan.features],
      cycles: Object.values(BILLING_CYCLES).map(cycle => ({
        key: cycle.key,
        label: cycle.label,
        months: cycle.months,
        discount: cycle.discount,
        ...computePlanQuote(plan.key, cycle.key),
      })),
    };
  });
  return plans;
}

function usageRow(used, limit) {
  const safeUsed = Number(used) || 0;
  if (limit === -1) {
    return { used: safeUsed, limit: -1, remaining: null, unlimited: true };
  }
  return {
    used: safeUsed,
    limit,
    remaining: Math.max(limit - safeUsed, 0),
    unlimited: false,
  };
}

function derivePlanState(user) {
  const plan = normalizePlanKey(user?.plan);
  const cycle = normalizeCycleKey(user?.billing_cycle);
  const status = user?.plan_status || (plan === 'free' ? 'free' : 'active');
  return {
    plan,
    cycle,
    status,
    plan_started_at: user?.plan_started_at || null,
    plan_expires_at: user?.plan_expires_at || null,
    plan_source: user?.plan_source || (plan === 'free' ? 'free' : 'manual'),
    status_meta: PLAN_STATUS_META[status] || PLAN_STATUS_META.free,
  };
}

function usageSnapshot(planKey, counts) {
  const plan = PLAN_CATALOG[normalizePlanKey(planKey)];
  return {
    boards: usageRow(counts?.boards_count, plan.limits.boards),
    students_total: Number(counts?.students_total) || 0,
    students_per_board: usageRow(counts?.max_students_on_board, plan.limits.studentsPerBoard),
    courses: usageRow(counts?.courses_count, plan.limits.courses),
    storage_mb: usageRow(roundMoney((Number(counts?.storage_bytes) || 0) / 1024 / 1024), plan.limits.storageMb),
  };
}

function paymentStatusMeta(status) {
  return PLAN_STATUS_META[status] || { label: status, tone: 'muted' };
}

async function ensureBillingSchema(pool) {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'free'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_status VARCHAR(24) DEFAULT 'free'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(24) DEFAULT 'monthly'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_source VARCHAR(24) DEFAULT 'free'`);

  const existing = await pool.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_name='iban_payments' AND column_name='user_id'
     LIMIT 1`
  );
  if (existing.rows.length && existing.rows[0].data_type !== 'uuid') {
    await pool.query(`ALTER TABLE iban_payments RENAME TO iban_payments_legacy_${Date.now()}`);
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS iban_payments (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    plan TEXT NOT NULL,
    payer_name TEXT NOT NULL,
    tx_date DATE NOT NULL,
    tx_note TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2)`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'usd'`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS invoice_no TEXT`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS admin_note TEXT`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id)`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS months INTEGER DEFAULT 1`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS company_name TEXT`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS contact_email TEXT`);
  await pool.query(`ALTER TABLE iban_payments ADD COLUMN IF NOT EXISTS package_snapshot JSONB DEFAULT '{}'::jsonb`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_iban_payments_invoice_no ON iban_payments(invoice_no) WHERE invoice_no IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_iban_payments_status ON iban_payments(status, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_iban_payments_user_status ON iban_payments(user_id, status, created_at DESC)`);
}

module.exports = {
  PLAN_CATALOG,
  BILLING_CYCLES,
  PLAN_STATUS_META,
  normalizePlanKey,
  getPlanDefinition,
  getPlanLimit,
  planHasFeature,
  normalizeCycleKey,
  monthsForCycle,
  computePlanQuote,
  buildPublicPlans,
  derivePlanState,
  usageSnapshot,
  paymentStatusMeta,
  ensureBillingSchema,
  formatLimit,
};
