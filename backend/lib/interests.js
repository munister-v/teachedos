/* Каталог «ДНК-профиля» ученика: цели и интересы, из которых собирается
   лента новостей. Ключи хранятся в базе, подписи и слова для поиска живут
   здесь - список можно менять без миграции. */
const GOALS = [
  { key: 'work',    label: 'Career & work',                 emoji: '💼' },
  { key: 'travel',  label: 'Travel & life abroad',          emoji: '✈️' },
  { key: 'fluency', label: 'Fluency & speaking confidence', emoji: '🗣' },
  { key: 'exams',   label: 'Exams & education',             emoji: '📚' },
];
// Older answers stay valid (the profile still shows them), they are just not offered any more.
const LEGACY_GOALS = ['series', 'move', 'fun'];
// Minutes a day between lessons, asked at onboarding.
const DAILY = [1, 5, 15];

// q - слова, по которым ищутся свежие статьи в лентах (newsFeeds.search).
const INTERESTS = [
  { key: 'tech',       label: 'IT & gadgets',   emoji: '💻', q: ['technology', 'software', 'AI', 'app', 'robot'] },
  { key: 'business',   label: 'Business',       emoji: '📈', q: ['business', 'company', 'economy', 'startup', 'market'] },
  { key: 'marketing',  label: 'Marketing',      emoji: '📣', q: ['marketing', 'brand', 'advert', 'social media', 'consumer'] },
  { key: 'pop',        label: 'Pop culture',    emoji: '🎤', q: ['film', 'music', 'celebrity', 'star', 'festival'] },
  { key: 'series',     label: 'Series & TV',    emoji: '📺', q: ['series', 'TV', 'streaming', 'show', 'season'] },
  { key: 'gaming',     label: 'Gaming',         emoji: '🎮', q: ['game', 'gaming', 'esports', 'console'] },
  { key: 'sport',      label: 'Sport',          emoji: '⚽', q: ['football', 'sport', 'match', 'olympic', 'tennis'] },
  { key: 'crime',      label: 'True crime',     emoji: '🕵️', q: ['police', 'court', 'trial', 'investigation', 'murder'] },
  { key: 'science',    label: 'Science & space', emoji: '🔬', q: ['scientists', 'space', 'research', 'study', 'planet'] },
  { key: 'health',     label: 'Health & sleep', emoji: '🧘', q: ['health', 'sleep', 'diet', 'mental', 'exercise'] },
  { key: 'travel',     label: 'Travel',         emoji: '✈️', q: ['travel', 'tourists', 'holiday', 'city', 'flight'] },
  { key: 'food',       label: 'Food',           emoji: '🍜', q: ['food', 'restaurant', 'coffee', 'recipe', 'chef'] },
  { key: 'environment', label: 'Nature & climate', emoji: '🌍', q: ['climate', 'environment', 'wildlife', 'energy', 'ocean'] },
  { key: 'fashion',    label: 'Fashion & style', emoji: '👗', q: ['fashion', 'style', 'design', 'clothes'] },
  { key: 'psychology', label: 'Psychology',     emoji: '🧠', q: ['psychology', 'mind', 'behaviour', 'habits', 'relationships'] },
  { key: 'lifestyle',  label: 'Lifestyle',      emoji: '🍷', q: ['lifestyle', 'wellbeing', 'home', 'wine', 'weekend'] },
];

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const goalKeys = new Set([...GOALS.map(g => g.key), ...LEGACY_GOALS]);
const interestByKey = new Map(INTERESTS.map(i => [i.key, i]));

function clean(body) {
  const b = body || {};
  const goal = goalKeys.has(b.goal) ? b.goal : null;
  const interests = [...new Set((Array.isArray(b.interests) ? b.interests : []).map(String).filter(k => interestByKey.has(k)))].slice(0, 8);
  const level = LEVELS.includes(b.level) ? b.level : null;
  const daily_minutes = DAILY.includes(Number(b.daily_minutes)) ? Number(b.daily_minutes) : null;
  return { goal, interests, level, daily_minutes };
}

module.exports = { GOALS, INTERESTS, LEVELS, DAILY, interestByKey, clean };
