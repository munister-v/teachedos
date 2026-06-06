/**
 * Email sending via Resend API (https://resend.com).
 * Uses native fetch (Node 22+), no npm dependency.
 *
 * Set RESEND_API_KEY in .env.
 * Optionally set FROM_EMAIL (default: "TeachEd <noreply@teached.tech>").
 *
 * If RESEND_API_KEY is absent, the email is only printed to console —
 * useful for local development without an account.
 */

const FROM = process.env.FROM_EMAIL || 'TeachEd <noreply@teached.tech>';
const SITE = process.env.SITE_URL   || 'https://teached.tech';

async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log('[email][DEV] Would send to:', to);
    console.log('[email][DEV] Subject:', subject);
    console.log('[email][DEV] Body (truncated):', html.replace(/<[^>]+>/g, '').slice(0, 300));
    return { ok: true, simulated: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: FROM, to, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Email send failed');
  return data;
}

function resetPasswordEmail(token) {
  const link = `${SITE}/reset-password.html?token=${token}`;
  return {
    subject: 'Reset your TeachEd password',
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:20px;padding:36px 40px;box-shadow:0 4px 24px rgba(0,0,0,.07);">
        <tr><td>
          <div style="font-size:28px;font-weight:900;letter-spacing:-.04em;margin-bottom:6px;">TeachEd 🍋</div>
          <h2 style="font-size:20px;font-weight:800;margin:24px 0 8px;">Reset your password</h2>
          <p style="color:#555;line-height:1.6;margin:0 0 24px;">
            We received a request to reset the password for your TeachEd account.
            Click the button below — this link expires in <strong>1 hour</strong>.
          </p>
          <a href="${link}"
             style="display:inline-block;background:#C8E64A;color:#151515;font-weight:900;padding:14px 28px;border-radius:14px;text-decoration:none;font-size:15px;margin-bottom:24px;">
            Reset password
          </a>
          <p style="color:#888;font-size:13px;line-height:1.5;">
            If you didn't request this, you can safely ignore this email.<br>
            This link will expire in 1 hour.
          </p>
          <hr style="border:0;border-top:1px solid #eee;margin:24px 0;">
          <p style="color:#aaa;font-size:12px;">
            TeachEd · <a href="${SITE}" style="color:#aaa;">${SITE}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim(),
  };
}

module.exports = { sendEmail, resetPasswordEmail, SITE };
