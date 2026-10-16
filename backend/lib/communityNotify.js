/* Telling authors what happened to their work (ТЗ "Author notifications").

   Likes, saves and copies never ping anybody one by one - they wait for the
   weekly digest. Only what needs a person acts at once: a first "used in
   class", an answer to a request, a report or a moderation decision.

   in-app is always on; email is sent for things that need action (reports,
   decisions) and otherwise only when the teacher opted in. */
const pool = require('../db/pool');
const { layout, textVersion, sendEmailQuietly, emailConfigured, SITE, escHtml } = (() => {
  const e = require('./email');
  return { ...e, escHtml: v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
})();

const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const link = path => (/^https?:/i.test(path) ? path : `${SITE.replace(/\/$/, '')}/${String(path || '').replace(/^\//, '')}`);

async function prefsOf(userId) {
  const { rows } = await pool.query('SELECT digest, email_digest, email_requests FROM community_prefs WHERE user_id = $1', [userId]);
  return rows[0] || { digest: 'weekly', email_digest: false, email_requests: false };
}

/* Said already? `once` = { kind, key }. Returns true if this call is the first. */
async function firstTime(userId, kind, key) {
  const { rowCount } = await pool.query(
    'INSERT INTO community_notices (user_id, kind, key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, kind, clip(key, 80)]);
  return rowCount > 0;
}

/* One notice: the bell, and the mail when `email` says so.
   opts: { type, title, body, link, once, email: 'always' | 'digest' | 'requests' | false, mail: {subject, paragraphs, button} } */
async function tell(userId, opts) {
  try {
    if (opts.once && !(await firstTime(userId, opts.once.kind, opts.once.key))) return false;
    const { createNotification } = require('../routes/notifications');
    await createNotification(userId, opts.type || 'community', clip(opts.title, 250), opts.body || '', opts.link || 'community.html#publications');
    if (opts.email && opts.mail) {
      let send = opts.email === 'always';
      if (!send) {
        const p = await prefsOf(userId);
        send = (opts.email === 'digest' && p.email_digest) || (opts.email === 'requests' && p.email_requests);
      }
      if (send) {
        const { rows } = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
        const u = rows[0];
        if (u?.email) {
          const paragraphs = (opts.mail.paragraphs || []).map(escHtml);
          sendEmailQuietly({
            to: u.email,
            subject: opts.mail.subject || opts.title,
            html: layout({ preheader: opts.mail.preheader || clip(opts.body, 90), title: opts.title, paragraphs,
              button: opts.mail.button ? { href: link(opts.mail.button.href), label: opts.mail.button.label } : null,
              footnote: opts.mail.footnote || 'You get this because you share lessons in TeachEd Community.' }),
            text: textVersion({ title: opts.title, lines: opts.mail.paragraphs || [], link: opts.mail.button ? link(opts.mail.button.href) : '', linkLabel: opts.mail.button?.label, footnote: '' }),
          }, 'community');
        }
      }
    }
    return true;
  } catch (err) {
    console.error('[community] notify:', err.message);
    return false;
  }
}

module.exports = { tell, firstTime, prefsOf, link };
