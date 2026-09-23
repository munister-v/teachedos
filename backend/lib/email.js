/**
 * Email sending - multi-provider with automatic fallback:
 *
 * 1. RESEND_API_KEY set  → use Resend REST API (no npm, native fetch)
 * 2. GMAIL_APP_PASSWORD  → use Gmail SMTP via nodemailer
 * 3. Neither             → log to console (dev mode)
 *
 * Env (in /opt/teachedos/backend/.env):
 *   RESEND_API_KEY=re_…                      # production uses Resend, teached.tech is verified there
 *   FROM_EMAIL=TeachEd <noreply@teached.tech>
 *   SITE_URL=https://teached.tech
 *   REPLY_TO=…                               # optional: where replies to system mail go
 *
 * Every message is sent as HTML *and* plain text: mail with no text part is
 * scored as more likely spam, and some readers show only the text.
 */

const SITE = process.env.SITE_URL || 'https://teached.tech';

// ── Nodemailer transport (lazy-init, only when GMAIL_APP_PASSWORD is set) ──
let _transport = null;
function getTransport() {
  if (_transport) return _transport;
  const nodemailer = require('nodemailer');
  _transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER         || 'tilandiya@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return _transport;
}

async function sendEmail({ to, subject, html, text }) {
  const replyTo = process.env.REPLY_TO || undefined;
  // ── 1. Resend ──────────────────────────────────────────────────────────────
  if (process.env.RESEND_API_KEY) {
    const from = process.env.FROM_EMAIL || 'TeachEd <noreply@teached.tech>';
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from, to, subject, html, ...(text ? { text } : {}), ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Resend error');
    console.log('[email] Sent via Resend to', to);
    return data;
  }

  // ── 2. Gmail SMTP ──────────────────────────────────────────────────────────
  if (process.env.GMAIL_APP_PASSWORD) {
    const from = process.env.FROM_EMAIL
      || `TeachEd <${process.env.GMAIL_USER || 'tilandiya@gmail.com'}>`;
    const info = await getTransport().sendMail({ from, to, subject, html, text, replyTo });
    console.log('[email] Sent via Gmail SMTP to', to, '- messageId:', info.messageId);
    return { ok: true, messageId: info.messageId };
  }

  // ── 3. Dev fallback ────────────────────────────────────────────────────────
  console.log('[email][DEV] No provider configured. Would send to:', to);
  console.log('[email][DEV] Subject:', subject);
  console.log('[email][DEV] Body:', (text || html.replace(/<[^>]+>/g, '')).slice(0, 400));
  return { ok: true, simulated: true };
}

/** fire-and-forget: a notice that fails to send must never fail the request */
function sendEmailQuietly(message, label = 'email') {
  return sendEmail(message).catch(err => console.error(`[${label}] send failed:`, err.message));
}

/** true when a real provider is set; otherwise sendEmail only logs */
const emailConfigured = () => !!(process.env.RESEND_API_KEY || process.env.GMAIL_APP_PASSWORD);

// ── Layout ───────────────────────────────────────────────────────────────────

const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* One frame for every message, in the TeachEd palette: ink #24282C on paper
   #F6F6EF, the lime #CDF649 for the one action. Table layout and inline
   styles because that is what mail clients still render reliably. */
function layout({ preheader = '', title, paragraphs = [], button = null, after = [], footnote = '' }) {
  const p = (html) => `<p style="color:#4a4e52;line-height:1.6;margin:0 0 16px;font-size:15px;">${html}</p>`;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F6F6EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#24282C;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escHtml(preheader)}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6EF;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #CACCC6;border-radius:20px;">
        <tr><td style="padding:34px 38px 30px;">
          <div style="font-size:22px;font-weight:900;letter-spacing:-.03em;margin:0 0 26px;color:#24282C;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#CDF649;border:2px solid #24282C;margin-right:8px;vertical-align:middle;"></span>TeachEd
          </div>
          <h1 style="font-size:21px;line-height:1.3;font-weight:800;margin:0 0 14px;color:#24282C;">${escHtml(title)}</h1>
          ${paragraphs.map(p).join('')}
          ${button ? `<a href="${escHtml(button.href)}" style="display:inline-block;background:#CDF649;color:#24282C;font-weight:800;padding:14px 28px;border-radius:14px;border:1.5px solid #24282C;text-decoration:none;font-size:15px;margin:6px 0 24px;">${escHtml(button.label)} →</a>` : ''}
          ${after.map(h => `<p style="color:#7a7d80;font-size:13px;line-height:1.6;margin:0 0 14px;">${h}</p>`).join('')}
          <hr style="border:0;border-top:1px solid #e6e7e2;margin:8px 0 14px;">
          <p style="color:#a3a48d;font-size:12px;line-height:1.5;margin:0;">
            ${footnote ? `${footnote}<br>` : ''}TeachEd · <a href="${SITE}" style="color:#a3a48d;">teached.tech</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** the same message as plain text */
function textVersion({ title, lines = [], link = '', linkLabel = '', footnote = '' }) {
  return [title, '', ...lines, ...(link ? ['', `${linkLabel || 'Open'}: ${link}`] : []), '', footnote, `TeachEd · ${SITE}`]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n').trim();
}

// ── Templates ────────────────────────────────────────────────────────────────

function resetPasswordEmail(token) {
  const link = `${SITE}/reset-password.html?token=${encodeURIComponent(token)}`;
  const title = 'Reset your password';
  const lines = [
    'We received a request to reset the password for your TeachEd account.',
    'The link works for 1 hour and only once.',
  ];
  const note = "If you didn't ask for this, ignore this email - your password stays the same until the link is used.";
  return {
    subject: 'Reset your TeachEd password',
    html: layout({
      preheader: 'Your password reset link - valid for 1 hour.',
      title,
      paragraphs: lines.map(escHtml),
      button: { href: link, label: 'Set a new password' },
      after: [escHtml(note), `If the button doesn't open, copy this address:<br><a href="${link}" style="color:#7a7d80;word-break:break-all;">${link}</a>`],
    }),
    text: textVersion({ title, lines: [...lines, '', note], link, linkLabel: 'Set a new password' }),
  };
}

/* A teacher added a student who has no account yet. The link opens
   invite.html, where the student picks a name and password; the board is
   attached on sign-up (and on any later sign-up with the same email). */
function studentInviteEmail({ token, teacherName, boardTitle }) {
  const link = `${SITE}/invite.html?token=${encodeURIComponent(token)}`;
  const who = teacherName || 'Your teacher';
  const title = "You're invited to class";
  const line1 = `${who} added you${boardTitle ? ` to “${boardTitle}”` : ''} on TeachEd - lessons, homework and games in one place.`;
  const line2 = 'Create your account to join. It takes a minute and is free for students.';
  return {
    link,
    subject: `${who} invited you to TeachEd`,
    html: layout({
      preheader: `${who} invited you to class on TeachEd.`,
      title,
      paragraphs: [escHtml(line1), escHtml(line2)],
      button: { href: link, label: 'Join the class' },
      after: [`The link works for 30 days. If the button doesn't open, copy this address:<br><a href="${link}" style="color:#7a7d80;word-break:break-all;">${link}</a>`],
    }),
    text: textVersion({ title, lines: [line1, line2, '', 'The link works for 30 days.'], link, linkLabel: 'Join the class' }),
  };
}

/* An account invite made in the admin panel (usually a teacher). */
function accountInviteEmail({ token, role, note, days }) {
  const link = `${SITE}/invite.html?token=${encodeURIComponent(token)}`;
  const as = role === 'student' ? 'a student' : role === 'admin' ? 'an administrator' : 'a teacher';
  const title = 'Your TeachEd account is ready to set up';
  const line1 = `You've been invited to join TeachEd as ${as}.`;
  const line2 = 'Choose your name and password - your email is already reserved.';
  return {
    link,
    subject: 'Your invitation to TeachEd',
    html: layout({
      preheader: `You've been invited to TeachEd as ${as}.`,
      title,
      paragraphs: [escHtml(line1), ...(note ? [`<em>${escHtml(note)}</em>`] : []), escHtml(line2)],
      button: { href: link, label: 'Activate my account' },
      after: [`The link works for ${days} day${days === 1 ? '' : 's'}.`],
    }),
    text: textVersion({ title, lines: [line1, ...(note ? [note] : []), line2, '', `The link works for ${days} days.`], link, linkLabel: 'Activate my account' }),
  };
}

/* Sent after a reset or a change: if it wasn't them, this is how they find out. */
function passwordChangedEmail({ how = 'changed' }) {
  const title = 'Your password was changed';
  const line1 = `The password for your TeachEd account was just ${how === 'reset' ? 'reset with a link sent to this address' : 'changed from your profile'}.`;
  const line2 = how === 'reset'
    ? 'For safety you were signed out on every device - sign in again with the new password.'
    : 'Every other device was signed out; this one stays signed in.';
  // replies to noreply go nowhere, so the notice asks only for what works
  const warn = "If this wasn't you, reset your password right away - the button below sends a new link to this address.";
  const link = `${SITE}/board.html?forgot=1`;
  return {
    subject: 'Your TeachEd password was changed',
    html: layout({
      preheader: 'Security notice for your TeachEd account.',
      title,
      paragraphs: [escHtml(line1), escHtml(line2), `<strong>${escHtml(warn)}</strong>`],
      button: { href: link, label: 'Reset my password' },
    }),
    text: textVersion({ title, lines: [line1, line2, '', warn], link, linkLabel: 'Reset my password' }),
  };
}

/* One short welcome after sign-up: what to do first, by role. */
function welcomeEmail({ name, role }) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  const teacher = role !== 'student';
  const title = `Welcome to TeachEd, ${first}`;
  const lines = teacher
    ? [
        'Your workspace is ready. Three things worth doing first:',
        '1. Build a lesson - pick a skill (reading, listening, vocabulary…) and the tasks land on a board.',
        '2. Add your students - by email; anyone without an account gets an invitation.',
        '3. Plan your week in Schedule - with your regular Zoom or Meet link filled in for every class.',
      ]
    : [
        'Your account is ready.',
        'Your teacher’s boards, homework and upcoming classes are all on your dashboard.',
      ];
  const link = teacher ? `${SITE}/board.html` : `${SITE}/student.html`;
  const label = teacher ? 'Open my workspace' : 'Open my dashboard';
  return {
    subject: 'Welcome to TeachEd',
    html: layout({
      preheader: teacher ? 'Your workspace is ready - here is where to start.' : 'Your student account is ready.',
      title,
      paragraphs: lines.map(escHtml),
      button: { href: link, label },
    }),
    text: textVersion({ title, lines, link, linkLabel: label }),
  };
}

module.exports = {
  sendEmail, sendEmailQuietly, emailConfigured, SITE,
  resetPasswordEmail, studentInviteEmail, accountInviteEmail, passwordChangedEmail, welcomeEmail,
};
