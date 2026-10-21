/* Каталог «ДНК-профиля» ученика: цели и интересы, из которых собирается
   лента новостей. Ключи хранятся в базе, подписи и слова для поиска живут
   здесь - список можно менять без миграции. Картинки (линейные иконки) рисует
   клиент по ключу (scripts/student-onboarding.js), эмодзи в каталоге нет. */
const GOALS = [
  { key: 'work',    label: 'Career & work' },
  { key: 'travel',  label: 'Travel & life abroad' },
  { key: 'fluency', label: 'Fluency & speaking confidence' },
  { key: 'exams',   label: 'Exams & education' },
];
// Older answers stay valid (the profile still shows them), they are just not offered any more.
const LEGACY_GOALS = ['series', 'move', 'fun'];
// Minutes a day between lessons, asked at onboarding.
const DAILY = [1, 5, 15];

// q - слова, по которым ищутся свежие статьи в лентах (newsFeeds.search).
const INTERESTS = [
  { key: 'tech',       label: 'IT & gadgets', q: ['technology', 'software', 'AI', 'app', 'robot'] },
  { key: 'business',   label: 'Business', q: ['business', 'company', 'economy', 'startup', 'market'] },
  { key: 'marketing',  label: 'Marketing', q: ['marketing', 'brand', 'advert', 'social media', 'consumer'] },
  { key: 'pop',        label: 'Pop culture', q: ['film', 'music', 'celebrity', 'star', 'festival'] },
  { key: 'series',     label: 'Series & TV', q: ['series', 'TV', 'streaming', 'show', 'season'] },
  { key: 'gaming',     label: 'Gaming', q: ['game', 'gaming', 'esports', 'console'] },
  { key: 'sport',      label: 'Sport', q: ['football', 'sport', 'match', 'olympic', 'tennis'] },
  { key: 'crime',      label: 'True crime', q: ['police', 'court', 'trial', 'investigation', 'murder'] },
  { key: 'science',    label: 'Science & space', q: ['scientists', 'space', 'research', 'study', 'planet'] },
  { key: 'health',     label: 'Health & sleep', q: ['health', 'sleep', 'diet', 'mental', 'exercise'] },
  { key: 'travel',     label: 'Travel', q: ['travel', 'tourists', 'holiday', 'city', 'flight'] },
  { key: 'food',       label: 'Food', q: ['food', 'restaurant', 'coffee', 'recipe', 'chef'] },
  { key: 'environment', label: 'Nature & climate', q: ['climate', 'environment', 'wildlife', 'energy', 'ocean'] },
  { key: 'fashion',    label: 'Fashion & style', q: ['fashion', 'style', 'design', 'clothes'] },
  { key: 'psychology', label: 'Psychology', q: ['psychology', 'mind', 'behaviour', 'habits', 'relationships'] },
  { key: 'lifestyle',  label: 'Lifestyle', q: ['lifestyle', 'wellbeing', 'home', 'wine', 'weekend'] },
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
