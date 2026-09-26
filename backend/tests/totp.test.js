const test = require('node:test');
const assert = require('node:assert');
const { codeAt, verify, base32Encode, base32Decode, backupCodes, hashBackup } = require('../lib/totp');

// RFC 6238 appendix B, SHA-1 seed "12345678901234567890"
const SEED = base32Encode(Buffer.from('12345678901234567890'));

test('RFC 6238 vectors (6 digits)', () => {
  assert.strictEqual(codeAt(SEED, Math.floor(59 / 30)), '287082');
  assert.strictEqual(codeAt(SEED, Math.floor(1111111109 / 30)), '081804');
  assert.strictEqual(codeAt(SEED, Math.floor(1234567890 / 30)), '005924');
  assert.strictEqual(codeAt(SEED, Math.floor(2000000000 / 30)), '279037');
});

test('verify accepts ±1 step and rejects others', () => {
  const now = 1234567890 * 1000;
  const step = Math.floor(now / 30000);
  assert.ok(verify(SEED, codeAt(SEED, step), now));
  assert.ok(verify(SEED, codeAt(SEED, step - 1), now));
  assert.ok(verify(SEED, codeAt(SEED, step + 1), now));
  assert.ok(!verify(SEED, codeAt(SEED, step + 3), now));
  assert.ok(!verify(SEED, 'abcdef', now));
});

test('base32 round trip and backup codes', () => {
  const buf = Buffer.from('hello world!');
  assert.deepStrictEqual(base32Decode(base32Encode(buf)), buf);
  const codes = backupCodes();
  assert.strictEqual(codes.length, 8);
  assert.match(codes[0], /^[0-9a-f]{5}-[0-9a-f]{5}$/);
  assert.strictEqual(hashBackup(codes[0].toUpperCase()), hashBackup(codes[0].replace('-', '')));
});
