/**
 * Email sending — multi-provider with automatic fallback:
 *
 * 1. RESEND_API_KEY set  → use Resend REST API (no npm, native fetch)
 * 2. GMAIL_APP_PASSWORD  → use Gmail SMTP via nodemailer
 * 3. Neither             → log to console (dev mode)
 *
 * Recommended env vars (add to /opt/teachedos/backend/.env):
 *   # Option A — Resend (resend.com)
 *   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxx
 *
 *   # Option B — Gmail SMTP
 *   GMAIL_USER=tilandiya@gmail.com
 *   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
 *
 *   # Common
 *   FROM_EMAIL=TeachEd <noreply@teached.tech>   # or your gmail for option B
 *   SITE_URL=https://teached.tech
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

async function sendEmail({ to, subject, html }) {
  // ── 1. Resend ──────────────────────────────────────────────────────────────
  if (process.env.RESEND_API_KEY) {
    const from = process.env.FROM_EMAIL || 'TeachEd <noreply@teached.tech>';
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from, to, subject, html }),
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
    const info = await getTransport().sendMail({ from, to, subject, html });
    console.log('[email] Sent via Gmail SMTP to', to, '— messageId:', info.messageId);
    return { ok: true, messageId: info.messageId };
  }

  // ── 3. Dev fallback ────────────────────────────────────────────────────────
  console.log('[email][DEV] No provider configured. Would send to:', to);
  console.log('[email][DEV] Subject:', subject);
  console.log('[email][DEV] Body:', html.replace(/<[^>]+>/g, '').slice(0, 400));
  return { ok: true, simulated: true };
}

// ── Email templates ───────────────────────────────────────────────────────────

function resetPasswordEmail(token) {
  const link = `${SITE}/reset-password.html?token=${encodeURIComponent(token)}`;
  return {
    subject: 'Reset your TeachEd password',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:20px;padding:36px 40px;box-shadow:0 4px 24px rgba(0,0,0,.07);">
        <tr><td>
          <div style="font-size:26px;font-weight:900;letter-spacing:-.04em;margin-bottom:24px;">TeachEd 🍋</div>
          <h2 style="font-size:20px;font-weight:800;margin:0 0 12px;">Reset your password</h2>
          <p style="color:#555;line-height:1.6;margin:0 0 28px;">
            We received a request to reset the password for your TeachEd account.<br>
            Click the button below — this link expires in <strong>1 hour</strong>.
          </p>
          <a href="${link}"
             style="display:inline-block;background:#C8E64A;color:#151515;font-weight:900;padding:14px 32px;border-radius:14px;text-decoration:none;font-size:15px;margin-bottom:28px;">
            Reset password →
          </a>
          <p style="color:#999;font-size:13px;line-height:1.6;margin:0 0 24px;">
            If you didn't request a password reset, you can safely ignore this email.<br>
            Your password will not change until you click the link above.
          </p>
          <hr style="border:0;border-top:1px solid #eee;margin:0 0 16px;">
          <p style="color:#bbb;font-size:12px;margin:0;">
            TeachEd · <a href="${SITE}" style="color:#bbb;">${SITE}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

module.exports = { sendEmail, resetPasswordEmail, SITE };
