#!/usr/bin/env node
/**
 * Safe production configuration audit.
 *
 * Prints only boolean readiness flags and never prints secret values. Run on
 * the VPS, where the real backend .env is available:
 *
 *   node ops/check-prod-config.mjs /opt/teachedos/backend/.env
 *
 * The script intentionally treats optional providers as warnings: TeachEd
 * remains usable with local AI/image fallbacks, while email and billing need
 * explicit provider credentials before those flows can be called production-
 * ready.
 */
import fs from 'node:fs';
import path from 'node:path';

const envPath = process.argv[2] || '/opt/teachedos/backend/.env';
const jsonOutput = process.argv.includes('--json');

function parseEnv(source) {
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function present(values, ...keys) {
  return keys.some((key) => typeof values[key] === 'string' && values[key].trim().length > 0);
}

function strongSecret(values, key, minLength = 32) {
  return typeof values[key] === 'string' && values[key].trim().length >= minLength;
}

let values;
try {
  values = parseEnv(fs.readFileSync(path.resolve(envPath), 'utf8'));
} catch (error) {
  const result = {
    ok: false,
    envFile: path.resolve(envPath),
    error: 'env_file_unreadable',
    message: error.code === 'ENOENT' ? 'Environment file was not found.' : 'Environment file could not be read.'
  };
  if (jsonOutput) console.log(JSON.stringify(result, null, 2));
  else console.error(`${result.message} (${result.envFile})`);
  process.exitCode = 1;
  process.exit();
}

const checks = [
  { key: 'database', label: 'Database', ready: present(values, 'DATABASE_URL'), required: true },
  { key: 'jwt', label: 'JWT sessions (32+ chars)', ready: strongSecret(values, 'JWT_SECRET'), required: true },
  { key: 'origins', label: 'Allowed origins', ready: present(values, 'ALLOWED_ORIGINS'), required: true },
  { key: 'site', label: 'Site URLs', ready: present(values, 'SITE_URL') && present(values, 'FRONTEND_URL'), required: true },
  { key: 'ai', label: 'AI provider', ready: present(values, 'AI_API_KEY', 'AI_API_KEY_2'), required: false },
  { key: 'stripe', label: 'Stripe billing', ready: present(values, 'STRIPE_SECRET_KEY'), required: false },
  { key: 'email', label: 'Transactional email', ready: present(values, 'RESEND_API_KEY') || (present(values, 'GMAIL_USER') && present(values, 'GMAIL_APP_PASSWORD')), required: false },
  { key: 'imageSearch', label: 'Image search', ready: present(values, 'UNSPLASH_ACCESS_KEY', 'PIXABAY_API_KEY'), required: false },
  { key: 'google', label: 'Google sign-in override', ready: present(values, 'GOOGLE_CLIENT_ID'), required: false }
];

const result = {
  ok: checks.filter((check) => check.required).every((check) => check.ready),
  envFile: path.resolve(envPath),
  checks: Object.fromEntries(checks.map(({ key, ready, required }) => [key, { ready, required }]))
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Production config: ${result.ok ? 'OK' : 'BLOCKED'}`);
  for (const check of checks) {
    const state = check.ready ? 'ready' : (check.required ? 'MISSING' : 'optional / fallback');
    console.log(`${state.padEnd(19)} ${check.label}`);
  }
}

process.exitCode = result.ok ? 0 : 1;
