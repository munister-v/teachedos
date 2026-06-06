# TeachEd — Roadmap (июнь 2026)

## Статус инструментов (51 шт.)

| Категория | Нативно ✅ | Обобщённые cards ❌ |
|---|---|---|
| **Vocabulary (10)** | все 10 | — |
| **Grammar (11)** | все 11 | — |
| **Reading (7)** | abcd-text, open-questions, true-false, simplify-text, text-topic-vocab | three-titles, reading-bits |
| **Writing (6)** | — | link-words, creative-writing, sentence-translation, four-opinions, find-quotes, essay-topics |
| **Speaking (5)** | discussion | dialogue, warmup-listening, lead-in, interesting-facts, pros-cons |
| **Listening (4)** | audio-video-questions, listening-dictation | transcript-helper, summary-gapfill, choose-summary |
| **Utility (7)** | нет AI-генерации | — |

**Осталось нативно реализовать: 16 инструментов**

---

## Блок 1 — Reading (2 тула)

| Тул | Формат | Суть |
|---|---|---|
| `three-titles` | quiz → MCQ | 1 правильный заголовок + 2 правдоподобных дистрактора |
| `reading-bits` | quiz → open | Текст нарезан на куски, перемешан — вернуть правильный порядок |

Файлы: `backend/lib/aiEngine.js`, `backend/routes/ai.js`

---

## Блок 2 — Listening (3 тула)

| Тул | Формат | Суть |
|---|---|---|
| `summary-gapfill` | quiz → gap | Краткий summary с пропусками из транскрипта |
| `choose-summary` | quiz → MCQ | 3 варианта summary, 1 верный |
| `transcript-helper` | cards | Из транскрипта: лексика + задачи + вопросы |

---

## Блок 3 — Speaking (5 тулов)

| Тул | Формат | Суть |
|---|---|---|
| `dialogue` | cards | Диалог A/B + useful language + extension task |
| `lead-in` | cards | 3–4 quick warm-up активности перед темой |
| `interesting-facts` | cards | 5–6 фактов + discussion question на каждый |
| `pros-cons` | cards | Аргументы за / против (2 колонки) |
| `warmup-listening` | quiz → open | Вопросы-предсказания перед аудио/видео |

---

## Блок 4 — Writing (6 тулов)

| Тул | Формат | Суть |
|---|---|---|
| `link-words` | cards | Задача: соединить слова в предложение / текст |
| `creative-writing` | cards | Prompt + requirements + useful phrases |
| `sentence-translation` | quiz → gap | UA→EN предложения с ответом |
| `four-opinions` | cards | 4 мнения (agree / disagree / neutral / provocative) |
| `find-quotes` | cards | Реальные цитаты по теме + comprehension вопрос |
| `essay-topics` | cards | 5–6 essay prompts + тип эссе + structure hint |

---

## Производительность

- [ ] `board.html` 735 KB — lazy-load тяжёлых секций
- [ ] SW precache — проверить нет ли ещё мёртвых ассетов
- [ ] `teacher-tools.html` — рендер hover-preview на мобиле

---

## Авторизация / UX

- [ ] `student.html` — проверить logout (clearAuthState?)
- [ ] `gradebook.html`, `schedule.html` — редирект при 401 mid-session
- [ ] Истёкший токен на mid-session: inline-баннер вместо полного редиректа

---

## Бэкенд

- [ ] `/api/auth/logout` — инвалидировать сессию в БД (сейчас только клиент чистит)
- [ ] Rate limiting на `/api/auth/register` (сейчас только на login)

---

## Технический долг

- [ ] Resend API ключ `re_BJ13YB5G_...` — отозвать в resend.com, создать новый
- [ ] GitHub токен (засветился в чате) — отозвать в GitHub → Settings → Developer settings → Personal access tokens

---

## Порядок работы

```
Блок 1 — Reading (2 тула)    ~30 мин
Блок 2 — Listening (3 тула)  ~40 мин
Блок 3 — Speaking (5 тулов)  ~1 ч
Блок 4 — Writing (6 тулов)   ~1 ч
Аудит бэкенда                отдельная сессия
board.html оптимизация       отдельная сессия
```
