// Time-based one-time passwords (RFC 6238, the codes authenticator apps
// show): 6 digits, 30-second steps, HMAC-SHA1. Built on node:crypto so the
// backend needs no extra dependency.
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function codeAt(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1] & 15;
  const n = ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(n % 1e6).padStart(6, '0');
}

// Accepts the previous, current and next step (clock drift of ±30 s).
function verify(secret, code, now = Date.now()) {
  const c = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(c) || !secret) return false;
  const step = Math.floor(now / 30000);
  for (const d of [-1, 0, 1]) {
    const expected = codeAt(secret, step + d);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return true;
  }
  return false;
}

function otpauthUrl(secret, account, issuer = 'TeachEd') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// Backup codes: shown once, stored as SHA-256 hashes, each works once.
function backupCodes(n = 8) {
  return Array.from({ length: n }, () => {
    const raw = crypto.randomBytes(5).toString('hex');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}
const hashBackup = (code) => crypto.createHash('sha256').update(String(code || '').toLowerCase().replace(/[^a-f0-9]/g, '')).digest('hex');

module.exports = { generateSecret, verify, codeAt, otpauthUrl, backupCodes, hashBackup, base32Encode, base32Decode };
