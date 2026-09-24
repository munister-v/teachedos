/* Shared cover design whitelist - Community lessons (routes/library.js)
   and a teacher's own boards (routes/boards.js) use the same editor. */
const clip = (s, n) => String(s ?? '').trim().slice(0, n);

/* ── Обложка урока в Community ────────────────────────────────────────────
   Учитель собирает обложку сам: фон (цвет, градиент, узор, фото или свой
   снимок), крупный заголовок, шрифт, наклейка, значок уровня. Здесь только
   белый список - в базу не доезжает ни чужой CSS, ни URL, ни цвет вне
   листа бренда. Свой снимок лежит в колонке image (data:-URL) и отдаётся
   отдельным маршрутом /:id/cover, чтобы лента не тащила мегабайты. */
const COVER_COLORS = new Set(['#24282C', '#CDF649', '#F6F6EF', '#CACCC6', '#FFFFFF',
  '#FFE44D', '#FF8C3A', '#FF4E00', '#3F9FFF', '#49F6F0', '#6B42FD', '#9F8CE8', '#D3F36B',
  '#F3DF6B', '#F3A46B', '#6BAFF3', '#886BF3', '#5D614B', '#A3A48D']);
const COVER_STYLES = new Set(['color', 'gradient', 'pattern', 'photo', 'upload']);
const COVER_PATTERNS = new Set(['dots', 'grid', 'lines', 'waves', 'confetti', 'stripes', 'circles', 'zigzag']);
const COVER_PHOTOS = new Set(['alley', 'canals', 'carpathians', 'fjord', 'fog', 'frost', 'harbour',
  'hills', 'lake', 'laurel', 'moss', 'river-night', 'sunset']);
const COVER_FONTS = new Set(['sans', 'display', 'serif', 'hand', 'mono']);
const coverColor = (v, fallback) => {
  const hex = String(v || '').toUpperCase();
  return COVER_COLORS.has(hex) ? hex : fallback;
};
function cleanCover(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const style = COVER_STYLES.has(raw.style) ? raw.style : 'color';
  const shade = Math.round(Number(raw.shade));
  return {
    style,
    bg: coverColor(raw.bg, '#24282C'),
    bg2: coverColor(raw.bg2, '#6B42FD'),
    pattern: COVER_PATTERNS.has(raw.pattern) ? raw.pattern : 'dots',
    photo: COVER_PHOTOS.has(raw.photo) ? raw.photo : 'lake',
    font: COVER_FONTS.has(raw.font) ? raw.font : 'display',
    ink: coverColor(raw.ink, '#FFFFFF'),
    accent: coverColor(raw.accent, '#CDF649'),
    align: raw.align === 'left' ? 'left' : 'center',
    title: clip(raw.title, 70),
    sub: clip(raw.sub, 90),
    sticker: clip(raw.sticker, 8),
    badge: raw.badge !== false,
    shade: Number.isFinite(shade) ? Math.max(0, Math.min(70, shade)) : 30,
  };
}
const COVER_IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const COVER_IMAGE_MAX = 1_500_000;
function cleanCoverImage(v) {
  const s = String(v || '');
  return s.length <= COVER_IMAGE_MAX && COVER_IMAGE_RE.test(s) ? s : null;
}

module.exports = { cleanCover, cleanCoverImage };
