const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { sendEmailQuietly, passwordChangedEmail } = require('../lib/email');

/* ── Фон рабочего стола ────────────────────────────────────────────────
   Свой фон учителя живёт файлом в data/wallpapers (вне backend/: деплой
   синхронизирует backend с --delete и стёр бы картинки). Имя файла
   случайное и отдаётся без токена: CSS-фон не умеет слать заголовок
   Authorization, а угадать 24 hex-символа нельзя. Картинку сжимает
   браузер (до 2560px JPEG), сюда приходит уже готовый файл. */
const WALL_DIR = process.env.WALLPAPER_DIR
  || path.join(__dirname, '..', '..', 'data', 'wallpapers');
const WALL_FILE_RE = /^[0-9a-f]{24}\.(jpg|png|webp)$/;
// Ключи совпадают с WALL_PRESETS в scripts/desktop-extras.js.
const WALL_PRESETS = new Set([
  'plain', 'mist', 'dawn', 'meadow', 'lavender', 'dusk', 'graphite',
  'dots', 'paper', 'lime-dots', 'stripes', 'night-grid',
  'carpathians', 'fjord', 'lake', 'laurel', 'fog', 'hills', 'moss', 'alley', 'frost', 'sunset', 'harbour', 'canals', 'river-night',
]);
const WALL_MAX_BYTES = 4 * 1024 * 1024;

function removeWallFile(value) {
  const m = /^custom:(.+)$/.exec(String(value || ''));
  if (!m || !WALL_FILE_RE.test(m[1])) return;
  fs.promises.unlink(path.join(WALL_DIR, m[1])).catch(() => {});
}

// Картинку отдаём ДО requireAuth - см. выше.
/* Адрес без расширения (/wallpaper/<24 hex>) - основной. С расширением
   .jpg/.webp запрос на проде не доходит сюда: nginx ловит картинки своим
   правилом статики и отвечает 404 с диска, а фон стола оставался серым. */
router.get('/wallpaper/:file', (req, res) => {
  let file = String(req.params.file || '');
  if (/^[0-9a-f]{24}$/.test(file)) {
    const ext = ['jpg', 'webp', 'png'].find(e => fs.existsSync(path.join(WALL_DIR, `${file}.${e}`)));
    if (!ext) return res.status(404).end();
    file = `${file}.${ext}`;
  }
  if (!WALL_FILE_RE.test(file)) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(path.join(WALL_DIR, file), err => { if (err && !res.headersSent) res.status(404).end(); });
});

function passwordProblem(password) {
  if (typeof password !== 'string') return 'Password is required';
  const value = password;
  if (value.length < 10) return 'Password must be at least 10 characters';
  if (Buffer.byteLength(value, 'utf8') > 72) return 'Password is too long. Use 72 bytes or fewer';
  return null;
}

router.use(requireAuth);

router.get('/me/desktop', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT desktop_wallpaper FROM users WHERE id=$1', [req.user.id]);
    res.json({ wallpaper: rows[0]?.desktop_wallpaper || null });
  } catch (err) {
    console.error('[users/desktop]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Готовый фон из набора (или null - вернуть стандартный).
router.put('/me/desktop', async (req, res) => {
  const key = req.body?.wallpaper == null ? null : String(req.body.wallpaper);
  const value = key && WALL_PRESETS.has(key.replace(/^preset:/, '')) ? `preset:${key.replace(/^preset:/, '')}` : null;
  if (key && !value && !/^custom:/.test(key)) return res.status(400).json({ error: 'Unknown wallpaper' });
  try {
    const { rows } = await pool.query('SELECT desktop_wallpaper FROM users WHERE id=$1', [req.user.id]);
    const prev = rows[0]?.desktop_wallpaper || null;
    // «custom:» можно только вернуть свой же загруженный, а не чужой файл.
    const next = value || (key && key === prev ? prev : null);
    await pool.query('UPDATE users SET desktop_wallpaper=$2 WHERE id=$1', [req.user.id, next]);
    // Ушли со своего фона на готовый - файл больше никому не нужен.
    if (prev !== next) removeWallFile(prev);
    res.json({ wallpaper: next });
  } catch (err) {
    console.error('[users/desktop put]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/me/wallpaper', async (req, res) => {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.image || ''));
  if (!m) return res.status(400).json({ error: 'Send a JPG, PNG or WebP image' });
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > WALL_MAX_BYTES) return res.status(413).json({ error: 'The image is too large (4 MB max)' });
  // Сверяем подпись файла, а не только заявленный тип.
  const sig = buf.subarray(0, 12);
  const isJpg = sig[0] === 0xFF && sig[1] === 0xD8;
  const isPng = sig[0] === 0x89 && sig.toString('latin1', 1, 4) === 'PNG';
  const isWebp = sig.toString('latin1', 0, 4) === 'RIFF' && sig.toString('latin1', 8, 12) === 'WEBP';
  const ext = isJpg ? 'jpg' : isPng ? 'png' : isWebp ? 'webp' : null;
  if (!ext) return res.status(400).json({ error: 'That file is not an image' });
  try {
    await fs.promises.mkdir(WALL_DIR, { recursive: true });
    const file = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
    await fs.promises.writeFile(path.join(WALL_DIR, file), buf);
    const { rows } = await pool.query('SELECT desktop_wallpaper FROM users WHERE id=$1', [req.user.id]);
    await pool.query('UPDATE users SET desktop_wallpaper=$2 WHERE id=$1', [req.user.id, `custom:${file}`]);
    removeWallFile(rows[0]?.desktop_wallpaper);
    res.json({ wallpaper: `custom:${file}` });
  } catch (err) {
    console.error('[users/wallpaper]', err.message);
    res.status(500).json({ error: 'The image could not be saved' });
  }
});

// GET /api/users/me - full profile
router.get('/me', (req, res) => res.json({ user: req.user }));

// PATCH /api/users/me - update name / avatar / email
router.patch('/me', async (req, res) => {
  const { name, avatar, email } = req.body;
  const sets   = [];
  const params = [req.user.id];

  if (name)   { params.push(name.trim().slice(0, 255)); sets.push(`name = $${params.length}`); }
  if (avatar) { params.push(avatar);                    sets.push(`avatar = $${params.length}`); }
  if (email) {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ error: 'Invalid email' });
    // Check uniqueness
    const { rows: ex } = await pool.query('SELECT id FROM users WHERE email=$1 AND id<>$2', [e, req.user.id]);
    if (ex.length) return res.status(409).json({ error: 'Email already in use' });
    params.push(e); sets.push(`email = $${params.length}`);
  }

  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $1
     RETURNING id, email, name, role, avatar, timezone, timezone_mode, plan, plan_status, billing_cycle, plan_started_at, plan_expires_at, plan_source, meeting_url, zoom_url`,
    params
  );
  res.json({ user: rows[0] });
});

// PATCH /api/users/me/password
router.patch('/me/password', async (req, res) => {
  const { current, next: nextPwd } = req.body;
  if (typeof current !== 'string' || typeof nextPwd !== 'string' || !current || !nextPwd) {
    return res.status(400).json({ error: 'current and next password required' });
  }
  const passwordError = passwordProblem(nextPwd);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const ok = await bcrypt.compare(current, rows[0].password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(nextPwd, 12);
  await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, hash]);
  // Keep the browser where the change was verified, but end every other
  // device immediately so a previously copied session cannot persist.
  await pool.query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [req.user.id, req.authSessionId]);
  res.json({ ok: true });
  sendEmailQuietly({ to: req.user.email, ...passwordChangedEmail({ how: 'changed' }) }, 'users/password-changed');
});

module.exports = router;
