# TeachEd — Roadmap (июнь 2026)

> Прод: https://teached.tech · Репо: https://github.com/munister-v/teachedos  
> Авто-деплой из `main` каждые 2 мин. Достаточно пушить — через минуту на проде.

---

## Архитектура генерации (справка)

- `backend/lib/aiEngine.js` — `shapeSpec(input)` формирует промпт и JSON-схему для каждого тула
- `backend/routes/ai.js` — `boardKindFor(toolId)` маршрутизирует в `makeVocab / makeMatching / makeQuiz / makeCards`, потом `assembleFromLLM` собирает envelope
- Фронтенд рендерит примитивы: `vocab`, `matching`, `quiz` (mcq / truefalse / gap-fill / open / match), `cards`
- Цепочка провайдеров: **Groq** llama-3.3-70b → **OpenRouter** gpt-oss-120b:free → **локальные шаблоны** (generateLocal)
- Новый тул = ветка в `shapeSpec` + запись в `boardKindFor` + при необходимости правка `matchText` / `makeQuiz`

---

## Статус инструментов (51 шт.)

| Категория | Нативно ✅ | Обобщённые cards ❌ (нужна доработка) |
|---|---|---|
| **Vocabulary (10)** | все 10 | — |
| **Grammar (11)** | все 11 | — |
| **Reading (7)** | abcd-text, open-questions, true-false, simplify-text, text-topic-vocab | **three-titles**, **reading-bits** |
| **Writing (6)** | — | **link-words**, **creative-writing**, **sentence-translation**, **four-opinions**, **find-quotes**, **essay-topics** |
| **Speaking (5)** | discussion | **dialogue**, **warmup-listening**, **lead-in**, **interesting-facts**, **pros-cons** |
| **Listening (4)** | audio-video-questions, listening-dictation | **transcript-helper**, **summary-gapfill**, **choose-summary** |
| **Utility (7)** | нет AI-генерации | — |

**Осталось нативно реализовать: 16 инструментов**

---

## Блок 1 — Reading (2 тула)

### `three-titles`
- **Что делает:** даёт текст → генерирует 1 правильный заголовок + 2 правдоподобных дистрактора
- **Формат вывода:** `quiz → MCQ` (3 варианта, 1 верный)
- **Промпт:** из source-текста извлечь главную мысль, назвать правильный заголовок, придумать 2 похожих но неточных
- **boardKindFor:** добавить в `quiz`-список
- **Файлы:** `aiEngine.js` (ветка в shapeSpec), `ai.js` (boardKindFor)

### `reading-bits`
- **Что делает:** текст нарезается на 4–6 кусков, перемешивается — студент восстанавливает порядок
- **Формат вывода:** `quiz → open` (каждый кусок = вопрос с номером правильной позиции как ответом)
- **Промпт:** разбить текст на логические абзацы, пронумеровать в правильном порядке, вернуть в перемешанном виде
- **Файлы:** `aiEngine.js`, `ai.js`

---

## Блок 2 — Listening (3 тула)

### `summary-gapfill`
- **Что делает:** из транскрипта генерирует краткий summary с пропусками ключевых слов
- **Формат вывода:** `quiz → gap-fill` (студент заполняет пропуски)
- **Промпт:** написать 5–7 предложений summary, убрать 6–8 ключевых слов, вернуть текст с `___` и answer key
- **Важно:** добавить в `boardKindFor` → `quiz` и в `isGap` список в `makeQuiz`
- **Файлы:** `aiEngine.js`, `ai.js`

### `choose-summary`
- **Что делает:** 3 варианта краткого изложения, студент выбирает точный
- **Формат вывода:** `quiz → MCQ` (1 вопрос, 3 варианта)
- **Промпт:** написать 1 точный summary + 2 неточных (один слишком общий, один с неверной деталью)
- **Файлы:** `aiEngine.js`, `ai.js`

### `transcript-helper`
- **Что делает:** из транскрипта / заметок создаёт учебные задачи
- **Формат вывода:** `cards` (набор карточек: ключевая лексика, задание перед просмотром, задание после, discussion)
- **Промпт:** 4 типа карточек — Pre-listening vocab / While-listening task / Post-listening questions / Speaking follow-up
- **Файлы:** `aiEngine.js`

---

## Блок 3 — Speaking (5 тулов)

### `dialogue`
- **Что делает:** генерирует ролевой диалог по теме с лексикой уровня
- **Формат вывода:** `cards` (Speaker A / Speaker B / Useful language / Extension task)
- **Промпт:** 8–12 реплик, естественный разговорный язык, target vocab жирным, extension = вопрос для обсуждения
- **Файлы:** `aiEngine.js` (уже есть заготовка в шаблонах ai.js → перенести в shapeSpec)

### `lead-in`
- **Что делает:** 3–4 quick warm-up активности для введения темы (5–7 мин урока)
- **Формат вывода:** `cards` (каждая карточка = одна активность с инструкцией)
- **Промпт:** разнообразие форматов — brainstorm / picture description / quick poll / personal connection
- **Файлы:** `aiEngine.js`

### `interesting-facts`
- **Что делает:** 5–6 любопытных фактов по теме, каждый с вопросом для дискуссии
- **Формат вывода:** `cards` (fact + discussion question)
- **Промпт:** реальные или правдоподобные факты уровня B1–C1, surprising hook в каждом, вопрос открытый
- **Файлы:** `aiEngine.js`

### `pros-cons`
- **Что делает:** список аргументов за и против для дебейта / writing
- **Формат вывода:** `cards` (Pros / Cons — по 4–6 аргументов, отдельные карточки)
- **Промпт:** 5 pros + 5 cons, каждый = 1 предложение, уровень языка соответствует CEFR
- **Файлы:** `aiEngine.js`

### `warmup-listening`
- **Что делает:** вопросы-предсказания перед прослушиванием аудио/видео
- **Формат вывода:** `quiz → open` (3–5 вопросов типа "What do you think the recording is about?")
- **Промпт:** prediction / prior knowledge / personal connection questions по теме
- **Файлы:** `aiEngine.js`, `ai.js` (добавить в `isOpen` список)

---

## Блок 4 — Writing (6 тулов)

### `link-words`
- **Что делает:** задание соединить набор слов в осмысленные предложения / абзац
- **Формат вывода:** `cards` (инструкция + список слов + model answer + tips)
- **Промпт:** дать 5–7 слов, написать task + model answer + 2–3 writing tips
- **Файлы:** `aiEngine.js`

### `creative-writing`
- **Что делает:** writing prompt с требованиями и useful phrases
- **Формат вывода:** `cards` (Prompt / Requirements / Useful phrases / Model opener)
- **Промпт:** интересный сценарий по теме, 3 требования (use vocab / length / structure), 5–6 полезных фраз
- **Файлы:** `aiEngine.js`

### `sentence-translation`
- **Что делает:** украинские предложения с target vocabulary для перевода на английский
- **Формат вывода:** `quiz → gap-fill` (UA предложение = вопрос, EN перевод = ответ)
- **Промпт:** 6–8 предложений, target слово выделено, перевод естественный для уровня
- **Файлы:** `aiEngine.js`, `ai.js`

### `four-opinions`
- **Что делает:** 4 contrasting мнения по теме для response writing / дебейта
- **Формат вывода:** `cards` (agree strongly / agree partly / disagree / provoke)
- **Промпт:** 4 разных угла зрения, язык разнообразный (одно категоричное, одно с нюансом, одно спорное, одно неожиданное)
- **Файлы:** `aiEngine.js`

### `find-quotes`
- **Что делает:** подбирает цитаты по теме + вопрос для обсуждения к каждой
- **Формат вывода:** `cards` (Quote / Author / Discussion question)
- **Промпт:** 5–6 цитат (реальных или правдоподобных), разные точки зрения, вопрос открытый
- **Файлы:** `aiEngine.js`

### `essay-topics`
- **Что делает:** essay prompts с типом эссе и structure hint
- **Формат вывода:** `cards` (Prompt / Essay type / Structure / Key vocabulary)
- **Промпт:** 5–6 промптов разных типов (argumentative / discursive / opinion / problem-solution), structure в 3 пунктах
- **Файлы:** `aiEngine.js`

---

## Производительность

- [ ] **`board.html` 735 KB** — самый тяжёлый файл. Варианты: code-split по game-типам, lazy-load секций через `import()`, отдельные бандлы для board-viewer vs board-editor
- [ ] **SW precache** — проверить нет ли ещё мёртвых ассетов (шрифты, старые иконки)
- [ ] **`teacher-tools.html`** — hover-preview рендерится на каждый mouseover, нет debounce; на мобиле не нужен вовсе
- [ ] **First Contentful Paint** — `html{opacity:0}` убрали, но `styles/harmony.css` + `styles/unify.css` грузятся синхронно; можно `media="print" onload` trick для некритичных

---

## Авторизация / UX

- [ ] **`student.html`** — проверить есть ли `clearAuthState()` при logout (сейчас может чистить только токен)
- [ ] **`gradebook.html`, `schedule.html`, `journal.html`** — при 401 mid-session показывают пустой экран; нужен inline toast "Session expired" + редирект
- [ ] **Истёкший токен mid-session** — перехватить в `createApiClient` (app-core.js): если 401 — показать баннер, не ломать текущую страницу
- [ ] **Onboarding** — `teachedos_onboarded` никогда не сбрасывается; при смене аккаунта новый пользователь не увидит туториал

---

## Бэкенд

- [ ] **`/api/auth/logout`** — убедиться что запись в `sessions` таблице инвалидируется; сейчас только клиент чистит localStorage
- [ ] **Rate limiting на `/api/auth/register`** — сейчас только на `/login`; спам-регистрации возможны
- [ ] **`/api/ai/generate` timeout** — Groq иногда отвечает >15 сек; нужен AbortController с 12 сек таймаутом перед переходом к fallback-провайдеру
- [ ] **OpenRouter fallback** — `gpt-oss-120b:free` иногда 429 upstream; стоит добавить третий провайдер или retry с другой моделью

---

## Технический долг

- [ ] **Resend API ключ** — засветился в чате, отозвать на resend.com → API Keys, создать новый, обновить `.env` на сервере
- [ ] **GitHub токен** — засветился в чате, отозвать: GitHub → Settings → Developer settings → Personal access tokens
- [ ] **`render.yaml`** в репо устарел (Render не используется) — удалить чтобы не путал
- [ ] **`scripts/vocab-loader.js`** и **`scripts/vocabulary.js`** в SW precache — проверить реально ли используются

---

## Примерный порядок работы

| Блок | Инструменты | Оценка |
|---|---|---|
| Reading | three-titles, reading-bits | ~30 мин |
| Listening | summary-gapfill, choose-summary, transcript-helper | ~40 мин |
| Speaking | dialogue, lead-in, interesting-facts, pros-cons, warmup-listening | ~1 ч |
| Writing | link-words, creative-writing, sentence-translation, four-opinions, find-quotes, essay-topics | ~1 ч |
| Аудит бэкенда | logout DB, rate limit, timeout | отдельная сессия |
| board.html оптимизация | code-split / lazy-load | отдельная сессия |
| Mid-session 401 | app-core.js interceptor | ~20 мин |
