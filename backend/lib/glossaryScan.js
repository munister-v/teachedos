/* Scans the repository's interface copy against the glossary (lib/glossary.js).

   What is read:
     frontend  the pages and scripts a teacher or student opens - root *.html,
               games/**, scripts/*.js, js/*.js - except the staff pages (admin*)
     backend   what the server says to people: routes/ and the mail/notification libs
   Comments are removed first: a comment may name the old string to explain a rename.
   For `textOnly` rules a JS file is read through its string literals and an HTML page
   through its visible text and attributes, so a function called `descriptorFor` is not
   a finding. */
const fs = require('fs');
const path = require('path');
const { lintText } = require('./glossary');

const SKIP_DIRS = new Set(['node_modules', '.git', 'ng', 'tests', 'img', 'fonts', 'icons', 'epris-seleznev', 'data']);
const STAFF = /^(admin|admin-gate)/;

function stripJsComments(src) {
  let out = '', i = 0, str = null;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (str) {
      out += c;
      if (c === '\\') { out += n || ''; i += 2; continue; }
      if (c === str) str = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { str = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; } i += 2; continue; }
    out += c; i++;
  }
  return out;
}

/* A word that is part of a name (guardrail-badge, descriptor_for, x.descriptor, descriptor()) is
   code, not something a person reads. Only used for the text-only rules. */
function inName(text, f) {
  const prev = text[f.index - 1] || '', next = text[f.index + f.match.length] || '';
  return /[-_./#@$\w]/.test(prev) || /[-_(\w]/.test(next);
}

/* the text of an HTML page that a person can read (tags, comments, styles and scripts removed) */
function htmlVisible(src) {
  const scripts = [];
  const noScripts = src.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (all, code) => { scripts.push(code); return ' '; })
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const text = [];
  noScripts.replace(/>([^<]+)</g, (all, t) => { text.push(t); return all; });
  noScripts.replace(/\b(?:title|placeholder|aria-label|alt|data-tip|data-title)="([^"]*)"/gi, (all, t) => { text.push(t); return all; });
  return { text: text.join('\n'), scripts };
}

const lineOf = (src, index) => src.slice(0, Math.max(0, index)).split('\n').length;

function scanFile(file, target) {
  const raw = fs.readFileSync(file, 'utf8');
  const found = [];
  const seen = new Set();
  const report = (f, hay, where) => {
    // phrase rules read everything; text-only rules skip names and identifiers
    const rule = require('./glossary').RULES.find(r => r.id === f.rule);
    if (rule && rule.textOnly && inName(hay, f)) return;
    if (rule && rule.allowIn && rule.allowIn.includes(path.basename(file))) return;
    // the first place this text appears in the file, for a line number a person can open
    const at = raw.indexOf(f.match);
    const key = f.rule + ':' + f.match + ':' + at + where;
    if (seen.has(key)) return; seen.add(key);
    found.push({ file, line: lineOf(raw, at < 0 ? 0 : at), rule: f.rule, match: f.match, say: f.say });
  };
  if (file.endsWith('.html')) {
    const noComments = raw.replace(/<!--[\s\S]*?-->/g, '');
    const noScript = noComments.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ');
    for (const f of lintText(noScript, { target, visible: false })) report(f, noScript, 'p');
    const { text, scripts } = htmlVisible(raw);
    for (const f of lintText(text, { target, visible: true })) report(f, text, 't');
    for (const code of scripts) { const c = stripJsComments(code); for (const f of lintText(c, { target, visible: true })) report(f, c, 's'); }
  } else {
    const code = stripJsComments(raw);
    for (const f of lintText(code, { target, visible: true })) report(f, code, 'j');
  }
  return found;
}

function walk(dir, test, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, test, out); else if (test(f)) out.push(f);
  }
  return out;
}

function scanRepo(root) {
  const rel = f => path.relative(root, f);
  const front = [
    ...fs.readdirSync(root).filter(n => n.endsWith('.html') && !STAFF.test(n)).map(n => path.join(root, n)),
    ...walk(path.join(root, 'games'), f => f.endsWith('.html')),
    ...walk(path.join(root, 'scripts'), f => f.endsWith('.js') && !STAFF.test(path.basename(f))),
    ...walk(path.join(root, 'js'), f => f.endsWith('.js')),
  ];
  const back = walk(path.join(root, 'backend', 'routes'), f => f.endsWith('.js'))
    .concat(['email.js', 'notify.js', 'communityNotify.js', 'onboardingContent.js'].map(n => path.join(root, 'backend', 'lib', n)).filter(fs.existsSync));
  const findings = [];
  for (const f of front) for (const x of scanFile(f, 'frontend')) findings.push({ ...x, file: rel(f) });
  for (const f of back) for (const x of scanFile(f, 'backend')) findings.push({ ...x, file: rel(f) });
  return findings;
}

module.exports = { scanRepo, scanFile, stripJsComments };
