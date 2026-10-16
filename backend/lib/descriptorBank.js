/* The descriptor bank (Lesson Builder 2.0 ТЗ §10.1, E1 US1): machine-readable
   "can do" statements by level x mode x skill - the one source generation and
   checking both lean on, so "B1" is a checkable claim and not a feeling.

   The teacher never sees this word or any of these terms (Principle 0); it surfaces
   only as calmer, better-aimed material and as plain "check me" notes.

   Versioned: a changed bank means material should be re-calibrated. Every check logs
   the stamp (version + a hash of the content) it ran against.

   Honest about status: a statement is 'draft' until a methodologist approves it, and
   coverage reports how much of the level x mode x skill grid is filled and how much
   of it is actually approved. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BANK_FILE = path.join(__dirname, '..', 'data', 'descriptors', 'bank.json');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const MODES = ['reception', 'production', 'interaction', 'mediation'];
const SKILLS = ['vocabulary', 'listening', 'reading', 'speaking', 'writing', 'grammar', 'news', 'picture'];
const STATUSES = ['draft', 'approved'];
const ID_RE = /^[A-Z]{3}-(A1|A2|B1|B2|C1|C2)-(REC|PRO|INT|MED)(-\d+)?$/;

/* Errors in a bank (empty list = a bank that can be used). */
function validate(bank) {
  const errors = [];
  if (!bank || typeof bank !== 'object') return ['not a bank'];
  if (!/^\d+\.\d+\.\d+$/.test(String(bank.version || ''))) errors.push('version must look like 1.2.3');
  if (!Array.isArray(bank.descriptors) || !bank.descriptors.length) return [...errors, 'no descriptors'];
  const ids = new Set();
  for (const d of bank.descriptors) {
    const where = `descriptor ${d && d.id}`;
    if (!d || !ID_RE.test(String(d.id || ''))) { errors.push(`${where}: id must look like GRM-B1-PRO`); continue; }
    if (ids.has(d.id)) errors.push(`${where}: duplicate id`);
    ids.add(d.id);
    if (!LEVELS.includes(d.level)) errors.push(`${where}: unknown level ${d.level}`);
    if (!MODES.includes(d.mode)) errors.push(`${where}: unknown mode ${d.mode}`);
    if (!SKILLS.includes(d.skill)) errors.push(`${where}: unknown skill ${d.skill}`);
    if (!STATUSES.includes(d.status)) errors.push(`${where}: status must be draft or approved`);
    const t = String(d.text || '');
    if (t.length < 20 || t.length > 260) errors.push(`${where}: text must be 20-260 characters`);
    if (d.level && !String(d.id).includes(`-${d.level}-`)) errors.push(`${where}: id does not match its level`);
  }
  return errors;
}

let cached = null;
function load(file = BANK_FILE) {
  if (cached && cached.file === file) return cached.bank;
  const bank = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = validate(bank);
  if (errors.length) throw new Error('descriptor bank is invalid: ' + errors.slice(0, 3).join('; '));
  cached = { file, bank };
  return bank;
}
const reset = () => { cached = null; };

/* version + a short hash of the statements: changes when anything calibrated against changes */
function stamp(bank = load()) {
  const h = crypto.createHash('sha1').update(JSON.stringify(bank.descriptors.map(d => [d.id, d.text, d.status]))).digest('hex').slice(0, 8);
  return `${bank.version}+${h}`;
}

const cell = (level, skill, mode, bank = load()) =>
  bank.descriptors.filter(d => d.level === level && d.skill === skill && (!mode || d.mode === mode));

/* The statements for a level and skill, one per mode, in a fixed order. */
function forLevel(level, skill, bank = load()) {
  return MODES.map(m => cell(level, skill, m, bank)[0]).filter(Boolean);
}

/* A short brief to put in front of a model: what this level can do with the skill. */
function brief(level, skill, bank = load(), modes = ['reception', 'production']) {
  const rows = modes.map(m => cell(level, skill, m, bank)[0]).filter(Boolean);
  return rows.length ? `At ${level}, a learner: ${rows.map(d => d.text.replace(/^Can /, 'can ').replace(/\.$/, '')).join('; ')}.` : '';
}

/* How much of the level x mode x skill grid is filled, and how much is approved. */
function coverage(bank = load()) {
  const perSkill = {};
  for (const s of SKILLS) {
    const filled = LEVELS.flatMap(l => MODES.map(m => [l, m])).filter(([l, m]) => cell(l, s, m, bank).length).length;
    const approved = LEVELS.flatMap(l => MODES.map(m => [l, m])).filter(([l, m]) => cell(l, s, m, bank).some(d => d.status === 'approved')).length;
    perSkill[s] = { filled, approved, of: LEVELS.length * MODES.length };
  }
  const total = SKILLS.length * LEVELS.length * MODES.length;
  const filled = Object.values(perSkill).reduce((n, v) => n + v.filled, 0);
  const approved = Object.values(perSkill).reduce((n, v) => n + v.approved, 0);
  return { version: bank.version, stamp: stamp(bank), total, filled, approved, perSkill,
    gaps: SKILLS.filter(s => perSkill[s].filled < perSkill[s].of) };
}

module.exports = { load, reset, validate, stamp, cell, forLevel, brief, coverage, LEVELS, MODES, SKILLS };
