# LexReader — план Phase 2: перенос экранов в приложение

Дата: 2026-11-12 · статус: **план, к реализации не приступали** · опирается на [Foundation (Phase 1)](lexreader-foundation-implementation.md), [реестр 186 экранов](lexreader-ultimate-screen-registry.md) и [Ultimate Design System](lexreader-ultimate-design-system.md). Изменения Phase 1 и этот план **не закоммичены**.

## 1. Принятые решения (2026-11-12)

| # | Решение | Как учитывается в плане |
|---|---|---|
| 1 | Вторая вкладка — **«Учиться»** (`/learning-paths`) | `nav-items.ts` не меняется; таббары макетов приводятся к коду |
| 2 | Планшет — **боковая панель с `md` (768 px)** | Никаких нижних таббаров на планшете; планшетные макеты T-* строятся внутри существующего `app-shell` |
| 3 | Маскот — **Lex**; функциональность `ReadingCompanion` сохраняется | WP0: компонент `Lex`, `ReadingCompanion` — совместимая обёртка (см. §4) |
| 4 | Шрифт чтения — **Literata** | Проверено (кириллица полная, −72 % веса против Source Serif 4); внедрение — WP0/WP3 (см. §5) |
| 5 | Исходники Ultimate Design System — **в `design/ultimate/`, в git** | Аудит содержимого выполнен (§4, WP0.7): в git идёт ≈ 1.8 МБ, скриншоты, устаревшие генераторы, временные файлы и личные данные исключаются; перенос — отдельный шаг WP0.7 |
| 6 | Регистрация — **отдельный режим внутри `/login`**, без `/signup` | WP1: экран `Signup` реализуется как состояние `login-form.tsx` (переключатель «Войти / Создать аккаунт»); новых маршрутов нет, `onboarding/actions.ts`/`login/actions.ts` остаются |

Те же решения зафиксированы в [Foundation §10](lexreader-foundation-implementation.md); там же — результаты проверки Literata.

## 2. Объём Phase 2

Из 186 экранов реестра:

| Группа | Экранов | Что делаем |
|---|---|---|
| **К переносу** (статус «реально»/«частично», переработанные или новые) | **109** | вёрстка в приложении на кит Phase 1 + реальные данные |
| Ядро с сохранённой композицией (Сегодня, Занятие, Стрик, моменты) | 46 | уже перенесено программой «моменты» (этапы 0–8); Phase 2 — только сверка токенов/контраста (Phase 1 это закрыл) и проверка, что ничего не разошлось |
| **PLANNED** (ИИ-репетитор, друзья/группы/лента, магазин/сезон/гардероб, каталог/жанры, говорение, план недели, статья справки, …) | 31 | **не переносим** — нет backend; остаются в Artifact как проект; «не подменять реальные функции макетами» |

109 экранов распределены по 10 рабочим пакетам (WP1–WP10) + подготовительный WP0. Полный список — внутри пакетов (§6).

## 3. Правила (из Foundation, неизменные)

1. **Данные только настоящие.** Перед вёрсткой каждого экрана — «паспорт данных»: у каждой цифры/строки макета есть источник (таблица, RPC, server action). Нет источника → метрика заменяется честной или экран откладывается (прецедент: «минут за неделю» заменены на повторения в этапе 8 «моментов»).
2. **Не ломать существующее:** маршруты, Supabase, RLS, server actions, e2e остаются; экран переверстывается, логика — нет.
3. **Только токены и компоненты `src/components/ui`;** hex в компонентах запрещены (исключение — `#fff`/`#1a1a1a` на сплошной заливке). Белый текст — только на `--leaf`/`--danger`/`*-fill`.
4. **Один пакет — одна ветка — один PR, 4–16 экранов** (как в программе «моменты»); PR содержит скриншоты экран×тема×вьюпорт рядом с эталоном из Artifact.
5. **Definition of Done экрана:** `typecheck` + `lint` + `npm test` зелёные; существующие e2e пакета зелёные (в изолированной среде, §7); axe без нарушений в обеих темах; сверка со скриншотом Artifact на 390 / 834 / 1280 × light/dark; `prefers-reduced-motion`; клавиатура и фокус; мигрированные самодельные toggle/модалки → `Switch`/`Dialog`.
6. **Реальный статус в UI:** функции без backend не показываются как рабочие (метка `badge-ink` «Скоро» допустима только там, где продукт сознательно анонсирует).

## 4. WP0 — подготовка (без экранов)

| Задача | Содержание | Готово, когда |
|---|---|---|
| 0.1 Baseline | Прогнать полный CI-набор (`build` + основной `e2e`) на текущей ветке с Phase 1 **в изолированной среде** (§7) — зафиксировать зелёную точку отсчёта и список заведомо flaky | отчёт «до»: сколько тестов, какие падают и почему |
| 0.2 Зафиксировать Phase 1 | После вашего разрешения — коммит Phase 1 отдельной веткой/PR (`feat/foundation-phase1`) от `main`, чтобы Phase 2 стартовала от неё | PR открыт, CI зелёный |
| 0.3 Lex | `src/components/product/mascot/lex.tsx`: `mood` (`happy wink joy sad sleep think wow cool`), `size`, `tone` (`default`/`pale`/`ghost`), декоративный (`aria-hidden`). Тело/живот/бобы — из токенов (`--leaf`, `--leaf-tint`, `--ember`, `--sun`), лицо — `--leaf-edge`; пути лиц берутся из `design/ultimate/tools/build_ds.py`. `ReadingCompanion` остаётся с теми же props и поведением: `onMouseEnter`/`onClick` «возбуждают» на 800 мс (`mascot-excited`), `autoExcite`, `withHalo`, искры/burst, анимации `mascot.css` с `prefers-reduced-motion` — внутри него рисуется `<Lex mood="happy">`. 10 инлайн-копий SVG (`today/v7/icons.tsx`, `week-recap`, `review-due`, `rate-app`, `streak-30`, `welcome-back`, `notify-ask`, `splash-screen`, `goal-pick-client`, `first-text`) заменяются на `<Lex>` | секция «Lex» в `/dev/ui` (8 настроений × 2 тона × 2 темы), axe, e2e на hover/клик ReadingCompanion, визуальных расхождений в моментах нет |
| 0.4 Literata | `next/font/google` `Literata` в корневом `layout.tsx`: `variable: "--font-literata"`, `subsets: ["latin","cyrillic"]`, `style: ["normal","italic"]`, `weight: "variable"` без `opsz`, `display: "swap"`, `preload: false`; `--font-reading` → Literata; удалить загрузчик Source Serif 4 из `read/[textId]/page.tsx`; `lang="en"` на контейнер читаемого текста; минимум 16 px для тела, `line-height` 1.6–1.7 | читалка, `first-text`, splash и моменты набраны Literata; Network: ≤ 119 КБ шрифтов на странице чтения; Georgia-фолбэка в проде нет |
| 0.5 CI | Добавить в `ci.yml`: шаг `test:ui-kit` после `build` (на `next start`); для e2e — `E2E_BASE_URL` уже поддерживается | CI запускает ui-kit-набор |
| 0.6 Миграция остатков | Заменить самодельные toggle (≥ 7 файлов) на `Switch`, модальные слои моментов/Chest/Double-XP/Quit-confirm — на `ui/Dialog` (проверить ловушку фокуса), `savedToast` читалки — на `toast`; в тёмной теме заменить `--ember`/`--sky` под белым текстом на `*-fill` (Today-evening, Duel-won и др.) | `grep` не находит локальных toggle/модалок; axe по `/dev/screens` и `/dev/moments` чистый |
| 0.7 Дизайн-исходники → `design/ultimate/` | **ВЫПОЛНЕНО 2026-11-12, не закоммичено** (см. §4.1): исходники скопированы после аудита, сборка адаптирована, `dist/` идентичен прежнему (кроме замены email), аудит 186 экранов — 0 замечаний | в git остаётся только `git add design/ultimate` + `.gitignore` + `package.json` (по вашему разрешению) |

### 4.1. `design/ultimate/` (решение 5) — аудит и перенос (выполнено)

Проверено содержимое `.lex-work/` (5.4 МБ без скриншотов + 139 МБ скриншотов, 1 493 файла).

**Идёт в git (≈ 1.8 МБ):**

| Что | Откуда | Размер | Заметка |
|---|---|---|---|
| `src/` — 140 фрагментов экранов | `src-v9/` | 0.8 МБ | редактируемый источник |
| `core/` — 46 `*.dc.html` ядра | только в `screens-v9/` | 0.57 МБ | сохранённые экраны правились вручную, генератора у них нет — иначе потерялись бы |
| `ds/` — токены, компоненты, иконки | `ds/` + `screens-v8/design-system.css` | 0.04 МБ | палитра v8 (9 КБ) вендорится в `ds/palette-v8.css`: сборка `build_ds.py` читает её из `screens-v8/` |
| `tools/` — сборка, аудит, реестр, галерея, справочник, документы | `tools/` | 0.13 МБ | см. «Правки» |
| `specs/` + `BRIEF.md` — бриф и спецификации по пачкам | | 0.1 МБ | прослеживаемость «что и зачем в каждом экране» |
| `cats.json`, `registry.json`, `README.md` | | 0.08 МБ | реестр — данные, а не вывод генератора |

**Не идёт в git и почему:**

| Что | Размер | Причина |
|---|---|---|
| `shots/` (скриншоты, 1 493 файла) | 139 МБ | воспроизводятся `tools/audit.mjs`; решение: без скриншотов |
| `screens-v9/` (результат сборки) → `dist/` в `.gitignore` | 1.8 МБ | полностью генерируется из `src/` + `core/` + `ds/` — иначе 140 файлов дублируют `src/` |
| `screens-v8/`, `screens/` | 2.0 МБ | устаревшие версии; содержат экспериментальные палитры `design-system-coral/red/raspberry/vermillion.css`; история есть в версиях Artifact |
| `generate_expansion.py`, `generate_stage10.py`, `build_gallery(_v3).py`, `build_implementation_plan.py`, `build_map_doc.py`, `build_product_map.py`, `build_registry.py`, `build_status.py`, `build_validation_doc.py`, `rebuild.py` | 0.3 МБ | генераторы v7/v8, заменены v9-инструментами |
| `impl137.json`, `status137.json`, `expansion-manifest.json`, `stage10-manifest.json` | 0.15 МБ | старые данные; `registry.json` их заменяет |
| `navgraph.json`, `order.json`, `order-final.json`, `sheet.html` | 0.03 МБ | генерируемые/вспомогательные |
| `.artifact-publish-tmp/` (корень репозитория, 580 КБ) | | временная папка публикации Artifact |

**Проверка на секреты, личные данные и мусор:**

| Проверка | Результат |
|---|---|
| Ключи, токены, JWT, приватные ключи, пароли (`eyJ…`, `sk_`, `pk_`, `AKIA`, `ghp_`, `AIza`, `BEGIN`, `password=`) | **не найдено** |
| `.env`-файлы в наборе | нет |
| **Реалистичный личный email** в макетах Login, Signup, Reset-password, Account-settings (6 вхождений в `src/`) | **заменить** на `sergey@example.com` до коммита; маски `s•••@gmail.com` — обезличены, остаются |
| **Абсолютные пути** домашнего каталога разработчика | `tools/audit.mjs` (3), `tools/pageshot.mjs` (1), `BRIEF.md` (1) — **параметризовать** (относительные пути, `DESIGN_BASE`) |
| Временные файлы (`__pycache__`, `*.pyc`, `*.log`, `nohup.out`, `.DS_Store`, `*.orig`) | нет |
| Бинарные файлы и файлы > 150 КБ | нет (все файлы — текст UTF-8) |
| Дубликаты по содержимому (md5) внутри набора | нет; единственное дублирование — `screens-v9/` ↔ `src/`, снимается тем, что `dist/` не коммитится |
| `docs/product/*.md` (сгенерированные) | чистые: нет путей и персональных данных |

**Что сделано при переносе:**
1. `src-v9` → `src/` (140); 46 экранов ядра → `core/`; результат сборки → `dist/` (в `.gitignore`, как и `build/`); `build_screens.py` копирует `core/*.dc.html`, `build_ds.py` копирует `ds/theme.js`.
2. `screens-v8/design-system.css` → `ds/palette-v8.css`.
3. `build_registry_v9.py` и зависимость от `status137.json`/`impl137.json` не перенесены: `registry.json` — данные; `build_docs.py`, `build_gallery.py` читают его же. Добавлен оркестратор `tools/build_all.py`.
4. `audit.mjs`, `pageshot.mjs`, `view.py`, `linkcheck.py`, `sheets.py`: относительные пути, `DESIGN_BASE` (по умолчанию `http://127.0.0.1:8742`), Playwright из корневого `node_modules`; отчёты — в `build/`.
5. Email реалистичный личный адрес → `sergey@example.com` (4 макета: Login, Signup, Reset-password, Account-settings); абсолютные пути убраны из `audit.mjs`, `pageshot.mjs`, `BRIEF.md`; ссылки на `.lex-work` в брифах, шаблоне документов и футере галереи заменены на `design/ultimate`.
6. `README.md` (структура, команды, правила, публикация); в `.gitignore`: `/design/ultimate/dist/`, `/design/ultimate/build/`, `/.lex-work/`, `/.artifact-publish-tmp/`; в `package.json`: `design:build`, `design:serve`.

**Проверка результата:**

| Проверка | Результат |
|---|---|
| `npm run design:build` | 186 экранов, 191 файл в `dist/` |
| `diff -rq dist/ .lex-work/screens-v9/` | отличаются **5 файлов из 191**: 4 макета (замена email, по 1 строке) и `index.html` (подпись футера); `lex-ui.css`, `design-system.css`, `system.html`, `theme.js` и 182 экрана — **байт-в-байт** |
| `audit.mjs` по 186 экранам × 2 темы | 0 за пределами кадра, 0 контраста (light/dark), 0 мелкого текста, 0 малых зон нажатия, 0 битых ссылок (27 экранов с зашитыми hex — как до переноса: иллюстрации ядра) |
| `linkcheck.py` | 0 потерянных, 0 битых, 0 тупиков, 687 переходов |
| Поиск секретов/путей/мусора в `design/ultimate/` | ключей и токенов нет; домашнего каталога, `.lex-work`, `src-v9`, `screens-v8` — нет; личных email — нет |
| Размер | 1.8 МБ (было 5.4 МБ без скриншотов + 139 МБ скриншотов) |

## 5. Шрифт чтения: параметры внедрения Literata

Сводка проверки — [Foundation §10](lexreader-foundation-implementation.md). Коротко: полная кириллица (включая `Ёё «»№₽`), normal+italic, `wght` 200–900; 119 КБ (`wght`) против 426 КБ у Source Serif 4; уверенное чтение от 16 px; на ≤ 14 px пробелы тесные — подписи остаются на Onest. Курсив кириллицы использует `locl` → `lang="ru"` на странице (стоит) и `lang="en"` на английском тексте.

## 6. Рабочие пакеты (WP1–WP10)

Порядок — по зависимостям и ценности; WP1–WP4 после WP0 независимы по файлам и могут идти параллельно в двух ветках (общие файлы — `nav-items.ts`, `messages/ru.json`, `globals.css` — править только в WP0).

### WP1. Вход и онбординг — 6 экр., размер S

Формы — первая проверка `Input`/`Button loading`/`Alert` на реальных server actions (`login/actions.ts`, `onboarding/actions.ts`). **Решено:** `Signup` — режим внутри `login-form.tsx` (без `/signup`).

**Код-якоря:** `src/app/login/*`, `src/app/reset-password/*`, `src/app/onboarding/*`, `src/components/product/onboarding/*`

**Тесты:** e2e: `auth.spec`, `onboarding-orphan-recovery.spec`, `placement-privacy.spec` — остаются зелёными; новые ui-kit-сценарии на формы (ошибка поля, loading кнопки)

<details><summary>Экраны (6)</summary>

| Экран | Статус | Что в макете | Маршрут по реестру |
|---|---|---|---|
| `Placement-question` | реально | Тест уровня (переработан) | `встроено в /onboarding/placement` |
| `Signup` | частично | Регистрация (переработан) | `нет отдельного /signup — не найден в структуре маршрутов` |
| `Login` | реально | Вход (переработан) | `/login` |
| `Magic-link-sent` | реально | Письмо со ссылкой отправлено (новый) | `/login (magic-link)` |
| `Reset-password` | реально | Восстановление пароля (переработан) | `/reset-password, /reset-password/confirm` |
| `Reset-password-confirm` | реально | Новый пароль (переработан) | `/reset-password, /reset-password/confirm` |

</details>

### WP2. Сегодня и системные состояния — 6 экр., размер S

`Today-new`/`Today-done` — состояния существующего `/home` (ветка в `decidePrimaryAction`), не новые маршруты. Состояния Loading/Empty/Error/Offline/404 — через `ui/states` (404 уже есть).

**Код-якоря:** `src/app/(app)/home/*`, `src/components/product/today/*`, `src/app/offline/page.tsx`, `src/app/error.tsx`, `src/app/(app)/error.tsx`

**Тесты:** e2e: `unified-shell-today.spec`, `today-crash-regression.spec`; `/dev/screens` — снимки обеих тем

<details><summary>Экраны (6)</summary>

| Экран | Статус | Что в макете | Маршрут по реестру |
|---|---|---|---|
| `Today-new` | реально | Сегодня — первый день (новый) | `/home (first-time)` |
| `Today-done` | реально | Сегодня — цель выполнена (новый) | `/home (completed)` |
| `Loading-state` | частично | Загрузка (переработан) | `кросс-функциональный паттерн` |
| `Empty-state` | частично | Пустая колода (переработан) | `кросс-функциональный паттерн` |
| `Error-state` | частично | Ошибка импорта (переработан) | `кросс-функциональный паттерн` |
| `Session-expired` | реально | Сессия истекла (новый) | `/login` |

</details>

### WP3. Библиотека, импорт, чтение, видео — 13 экр., размер L

Перекладка на Literata (§7), `lang="en"` на тексте. Каталог/жанры/избранное текстов — PLANNED (нет колонок в БД) и в этот пакет не входят. Источник данных «Reading-history» — `reading_sessions`/`text_progress`; проверить покрытие до вёрстки.

**Код-якоря:** `src/app/(app)/library/*`, `src/app/read/[textId]/*`, `src/app/watch/[textId]/*`, `src/styles/reader.css`

**Тесты:** e2e: `library.spec`, `reading.spec`, `add-material.spec`, `youtube-import.spec`, `pdf-import.spec`, `reader-library-a11y.spec`, `reader-practice-bridge.spec`

<details><summary>Экраны (13)</summary>

| Экран | Статус | Что в макете | Маршрут по реестру |
|---|---|---|---|
| `Library-empty` | реально | Библиотека — пусто (новый) | `/library (empty)` |
| `Text-detail` | частично | Материал — Treasure Island (переработан) | `/library (встроено)` |
| `Search-results` | частично | Поиск — результаты (переработан) | `/library (встроено)` |
| `Collections` | реально | Мои коллекции (переработан) | `/library/collections, /library/new` |
| `Collection-detail` | реально | Коллекция (новый) | `/library/collections/[id]` |
| `Reading-history` | частично | История чтения (новый) | `/library` |
| `Import-hub` | реально | Добавить материал (переработан) | `/library/collections, /library/new` |
| `Import-text` | реально | Вставить текст (новый) | `/library/new` |
| `Import-youtube` | реально | Импорт видео с YouTube (новый) | `/library/new (YouTube)` |
| `Import-processing` | реально | Импорт обрабатывается (переработан) | `api/youtube-import/[id]/status` |
| `Reader-phrase` | реально | Перевод фразы (новый) | `/read/[textId]` |
| `Reader-settings` | частично | Вид текста (новый) | `/read/[textId] (sheet)` |
| `Watch` | реально | Видео с субтитрами (новый) | `/watch/[textId]` |

</details>

### WP4. Мозг: колоды, повторение, словарь — 16 экр., размер L

Самый большой раздел. Режимы повторения уже есть (`review-mode-switcher.tsx`, 5+2 режимов) — переверстываются, не переписываются; FSRS и `reviewWord()` не трогаем. `Words-learned` ≈ существующий `/brain/vocabulary` (в реестре помечен «нет» — устарело, сверить).

**Код-якоря:** `src/app/(app)/brain/*`, `src/app/(app)/brain/[deckId]/review/*`, `src/app/(app)/brain/vocabulary/*`, `src/lib/{fsrs,srs,brain-stats}.ts`

**Тесты:** e2e: `brain-notebook.spec`, `brain-undo-rename.spec`, `review-session-persistence.spec`, `practice-brain-a11y.spec`, `practice-modes-feedback.spec`, `vocabulary-privacy.spec`

<details><summary>Экраны (16)</summary>

| Экран | Статус | Что в макете | Маршрут по реестру |
|---|---|---|---|
| `Brain-home` | частично | Практика (переработан) | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` |
| `Deck-detail` | частично | Колода — Путешествия (переработан) | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` |
| `Deck-import` | частично | Новая колода (переработан) | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` |
| `Card-edit` | реально | Карточка (новый) | `/brain/[deckId]` |
| `Flashcard-review` | частично | Карточка — вопрос (переработан) | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` |
| `Flashcard-answer` | реально | Карточка — ответ (новый) | `/brain/[deckId]/review` |
| `Flashcard-mc` | частично | Карточка — выбор перевода (переработан) | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` |
| `Flashcard-type` | частично | Карточка — напиши слово (переработан) | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` |
| `Review-modes` | частично | Режимы тренировки (новый) | `/brain/[deckId]/review` |
| `Review-done` | реально | Повторение завершено (новый) | `/brain/[deckId]/review` |
| `Brain-caught-up` | реально | Всё повторено (новый) | `/brain` |
| `Hard-words` | частично | Трудные слова (переработан) | `/brain (расширение)` |
| `Word-detail` | частично | Слово — reluctant (переработан) | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` |
| `Words-learned` | частично | Мой словарь (переработан) | `нет — всё сейчас агрегируется в одной /progress` |
| `Brain-stats` | частично | Статистика памяти (новый) | `/brain (stats)` |
| `Brain-settings` | реально | Настройки повторения (новый) | `/brain/settings` |

</details>

### WP5. Упражнения и учебная программа — 12 экр., размер M

Упражнения живут внутри миссий (`mission-screen.tsx`) — отдельных маршрутов нет, поэтому Match-pairs/Fill-blank/Listening/Writing переверстываются как режимы миссии; `Grammar-hub`/`Grammar-lesson`/`Level-map` требуют **нового маршрута и новых запросов** (уровни CEFR из `placement`/`learning-paths`) — до вёрстки подтвердить источник данных. Speaking и Study-plan — PLANNED, не входят.

**Код-якоря:** `src/app/(app)/learning-paths/*`, `src/app/(app)/missions/*`, `src/components/product/{learning-paths,missions}/*`, `src/lib/{lesson-exercises,placement,learning-paths}/*`

**Тесты:** e2e: `learning-paths-privacy.spec`, `missions-privacy.spec`, `placement-privacy.spec`

<details><summary>Экраны (12)</summary>

| Экран | Статус | Что в макете | Маршрут по реестру |
|---|---|---|---|
| `Grammar-hub` | частично | Грамматика (переработан) | `нет отдельного — контент сейчас только внутри миссий` |
| `Grammar-lesson` | частично | Урок грамматики (переработан) | `нет отдельного — контент сейчас только внутри миссий` |
| `Match-pairs` | частично | Соедини пары (переработан) | `вероятно внутри mission-screen.tsx` |
| `Fill-blank` | частично | Заполни пропуск (переработан) | `вероятно внутри mission-screen.tsx` |
| `Listening-exercise` | частично | Диктант на слух (переработан) | `вероятно внутри mission-screen.tsx` |
| `Writing-exercise` | частично | Письмо по правилам (переработан) | `пересекается с Twin-correction` |
| `Curriculum` | частично | Программа (переработан) | `/learning-paths, /learning-paths/[pathSlug]` |
| `Unit-overview` | частично | Раздел 3 (переработан) | `/learning-paths, /learning-paths/[pathSlug]` |
| `Level-map` | частично | Карта уровней (переработан) | `нет — профиль хранит текущий уровень, не историю по всем уровням` |
| `Skill-check` | реально | Проверка навыка (новый) | `/learning-paths/…/check` |
| `Mission-detail` | реально | Миссия дня (переработан) | `/missions/history, /missions/[missionId]` |
| `Mission-history` | реально | История миссий (переработан) | `/missions/history, /missions/[missionId]` |

</details>

### WP6. Мой английский (Language Twin) — 10 экр., размер M

Все 7 маршрутов уже есть; нужны 2 состояния (`Twin-empty`, `Twin-pattern-detail`). Принцип «по правилам, без ИИ» — в копирайте каждого экрана. Dialog-обёртка уже на `ui/Dialog`.

**Код-якоря:** `src/app/(app)/language-twin/*`, `src/components/product/language-twin/*`, `src/lib/language-twin/*`

**Тесты:** e2e: `language-twin-privacy.spec`

<details><summary>Экраны (10)</summary>

| Экран | Статус | Что в макете | Маршрут по реестру |
|---|---|---|---|
| `Twin-home` | реально | Мой английский (переработан) | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` |
| `Twin-empty` | реально | Мой английский — мало данных (новый) | `/language-twin (empty)` |
| `Twin-diagnostic` | реально | Диагностика — вопрос (переработан) | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` |
| `Twin-correction` | реально | Проверка текста (переработан) | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` |
| `Twin-patterns` | реально | Паттерны ошибок (переработан) | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` |
| `Twin-pattern-detail` | реально | Паттерн ошибки (новый) | `/language-twin/patterns` |
| `Twin-evidence` | реально | Основания оценки (переработан) | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` |
| `Twin-timeline` | реально | История роста (переработан) | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` |
| `Twin-recommendations` | реально | Рекомендации (переработан) | `/language-twin/recommendations` |
| `Twin-settings` | реально | Настройки «Мой английский» (переработан) | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` |

</details>

### WP7. Прогресс, награды, аналитика, рейтинг — 13 экр., размер L

Почти все экраны требуют **новых маршрутов** под `/progress/*` и `/quests`. **Риск данных:** «минуты за неделю» — не настоящая метрика (`activity_days.minutes` не заполняется, см. ROADMAP этап 8) → `Time-spent` либо откладывается, либо сначала вводится реальный учёт времени (миграция). `Skill-breakdown` — 5 реальных навыков, говорение — «нет данных». Каждая цифра макета получает источник до вёрстки.

**Код-якоря:** `src/app/(app)/progress/*`, `src/app/(app)/quests/*`, `src/app/(app)/leaderboard/*`, `src/lib/{achievements,daily-quests,leaderboard,progress-insight}.ts`

**Тесты:** e2e: `unified-shell-progress-settings.spec`, `leaderboard-privacy.spec`; unit на новые агрегаты

<details><summary>Экраны (13)</summary>

| Экран | Статус | Что в макете | Маршрут по реестру |
|---|---|---|---|
| `Progress` | реально | Прогресс (переработан) | `/progress` |
| `Stats-detail` | частично | Статистика (переработан) | `нет — всё сейчас агрегируется в одной /progress` |
| `Skill-breakdown` | частично | Навыки (переработан) | `нет — всё сейчас агрегируется в одной /progress` |
| `Learning-history` | частично | История занятий (переработан) | `нет — всё сейчас агрегируется в одной /progress` |
| `Weekly-report` | частично | Отчёт недели (переработан) | `нет — всё сейчас агрегируется в одной /progress` |
| `Time-spent` | частично | Время обучения (переработан) | `нет — всё сейчас агрегируется в одной /progress` |
| `Achievements-gallery` | частично | Достижения (переработан) | `нет отдельной страницы — только карточки внутри /progress` |
| `Achievement-detail` | частично | Достижение — детали (новый) | `/progress (sheet)` |
| `Milestones` | частично | Вехи (переработан) | `нет отдельной страницы — только карточки внутри /progress` |
| `Quest-board` | частично | Задания (переработан) | `нет /quests-обзора — только /quests/chest и /quests/double-xp` |
| `Goal-edit` | реально | Цель дня (новый) | `/settings` |
| `League-table` | частично | Лига недели (переработан) | `/leaderboard` |
| `League-result` | реально | Итог недели в лиге (новый) | `/leaderboard` |

</details>

### WP8. Дуэли и общий стрик — 6 экр., размер M

Только реальное: дуэль по ссылке, общий стрик с одним другом, share-card. Список друзей, поиск, профиль друга, лента, группы — PLANNED (нет таблиц), не входят. Realtime-подписка `duel-room.tsx` остаётся.

**Код-якоря:** `src/app/(app)/duel/*`, `src/app/(app)/friends/*`, `src/lib/{duel,friend-streaks}.ts`, `src/app/api/share-card`

**Тесты:** e2e: `duel-privacy.spec`; приватность RLS-тесты не менять

<details><summary>Экраны (6)</summary>

| Экран | Статус | Что в макете | Маршрут по реестру |
|---|---|---|---|
| `Friend-invite-share` | реально | Пригласить в общий стрик (переработан) | `/friends/invite, /friends/[token]` |
| `Friend-invite-accept` | реально | Приглашение в общий стрик (переработан) | `/friends/invite, /friends/[token]` |
| `Duel-create` | реально | Создать дуэль (новый) | `/duel` |
| `Duel-live` | реально | Дуэль — раунд (переработан) | `/duel/[id]` |
| `Duel-lost` | реально | Поражение в дуэли (новый) | `/duel/[id]` |
| `Share-card` | реально | Карточка для шаринга (переработан) | `api/share-card, api/language-twin/share-card (только API)` |

</details>

### WP9. Профиль, настройки, подписка — 16 экр., размер M

`Profile-edit`: профиль хранит только email — имя/аватар требуют решения (§8, вопрос 5). `Delete-account`, `Data-privacy` — на реальных `delete-account-actions.ts` и `api/export/*`. Подписка: Stripe checkout/portal, лимиты Free из триггеров БД; `Cancel-subscription` — экран-подготовка перед Stripe Portal. `Help-*` — нужен контент справки (нет).

**Код-якоря:** `src/app/(app)/settings/*`, `src/app/(app)/{pricing,paywall}/*`, `src/lib/{subscription*,extension-tokens}.ts`, `src/app/api/webhooks/stripe`

**Тесты:** e2e: `payment.spec`, `account-delete-export.spec`, `extension-translate-and-save.spec`

<details><summary>Экраны (16)</summary>

| Экран | Статус | Что в макете | Маршрут по реестру |
|---|---|---|---|
| `Profile` | частично | Профиль (переработан) | `/settings` |
| `Profile-edit` | частично | Редактировать профиль (новый) | `/settings` |
| `Account-settings` | реально | Аккаунт (переработан) | `/settings, /privacy, api/export/*` |
| `Notification-settings` | частично | Уведомления (переработан) | `/settings (push-часть)` |
| `Data-privacy` | реально | Данные и приватность (переработан) | `/settings, /privacy, api/export/*` |
| `Extension-connect` | реально | Расширение браузера (переработан) | `/settings (секция расширения)` |
| `Help-support` | частично | Помощь (переработан) | `нет /help маршрута` |
| `Whats-new` | реально | Что нового (новый) | `/changelog` |
| `Delete-account` | реально | Удалить аккаунт (новый) | `/settings` |
| `Pricing-plans` | реально | Тарифы (переработан) | `/settings (план), /paywall, /pricing` |
| `Paywall-offer` | реально | Предложение Plus (переработан) | `/settings (план), /paywall, /pricing` |
| `Limit-reached` | реально | Лимит Free (новый) | `/library (trigger)` |
| `Subscription` | реально | Подписка (переработан) | `/settings (план), /paywall, /pricing` |
| `Purchase-success` | реально | Plus оформлен (новый) | `/pricing → Stripe` |
| `Payment-failed` | реально | Оплата не прошла (новый) | `/pricing → Stripe` |
| `Cancel-subscription` | реально | Отмена подписки (новый) | `Stripe Portal` |

</details>

### WP10. Адаптив: планшет и desktop — 11 экр., размер M

Не отдельные маршруты: 8 desktop + 3 tablet композиций — адаптивные раскладки уже перенесённых экранов (сайдбар с `md` остаётся, таббара на планшете нет). Выполняется внутри WP2–WP9 для каждого экрана; здесь — финальная сверка на 390 / 834 / 1280.

**Код-якоря:** `src/styles/layout.css`, `src/components/product/app-shell/*`

**Тесты:** ui-kit/Playwright: 3 вьюпорта × обе темы на каждый перенесённый экран, axe

<details><summary>Экраны (11)</summary>

| Экран | Статус | Что в макете | Маршрут по реестру |
|---|---|---|---|
| `D-Today` | реально | Desktop · Сегодня (новый) | `/home` |
| `D-Library` | реально | Desktop · Библиотека (новый) | `/library` |
| `D-Reader` | реально | Desktop · Читалка (новый) | `/read/[textId]` |
| `D-Watch` | реально | Desktop · Видео (новый) | `/watch/[textId]` |
| `D-Practice` | реально | Desktop · Практика (новый) | `/brain` |
| `D-Lesson` | реально | Desktop · Упражнение (новый) | `/learning-paths/…` |
| `D-Progress` | реально | Desktop · Прогресс (новый) | `/progress` |
| `D-Settings` | реально | Desktop · Настройки (новый) | `/settings` |
| `T-Today` | реально | Tablet · Сегодня (новый) | `/home` |
| `T-Library` | реально | Tablet · Библиотека (новый) | `/library` |
| `T-Reader` | реально | Tablet · Читалка (новый) | `/read/[textId]` |

</details>

## 7. Окончательный план запуска основного E2E

**Статус: подготовлено и проверено «всухую», НЕ запускалось.** Supabase не стартовал, Playwright-набор не гонялся, коммитов нет. Выполнены только чтение, `bash -n`, `preflight`, `prepare` во временный каталог и `DRY=1 up`.

### 7.1. Предпроверка (2026-11-12, ~21:00)

| Что | Факт |
|---|---|
| **Контейнеры** | 27 всего, 26 запущено (где есть healthcheck — healthy), 1 остановлен: `supabase_edge_runtime_ai-automation-platform` (Exited 2 недели назад, **чужой**, не трогаем). Проекты: `ai-automation-platform` (Supabase, 12 контейнеров), `twenty` ×2 (6), `n8n` (3), `shelflife` (3), `postmill` (2), `freellmapi` (1, **порт :3001**). Контейнеров `English_teacher_AI` — **ноль** |
| **Память хоста** | 7.9 ГБ; занято 5.4; **доступно ≈ 2.5 ГБ** (в основном кэш); **swap 4/4 ГБ занят на 99 %**; давление памяти (PSI) ≈ 0; OOM-kill за 3 дня — 0. Основные потребители вне Docker: `claude-desktop` ≈ 1.4 ГБ, `chrome` ≈ 1.0 ГБ, node-процессы ≈ 0.9 ГБ |
| **Память Docker** | все 26 контейнеров вместе ≈ 1.7 ГБ (крупнейшие: `twenty-server` 308 МБ, `twenty-nastya-server` 281, `n8n` 233, logflare 151, studio 145). **Измеренный простой Supabase-сервисов** на чужом стеке: db 70, auth 32, rest 12, realtime 58, storage 24, kong 17, mailpit 18 МБ ≈ **230 МБ** — облегчённый стек, приложение (~0.2 ГБ) и Chromium (~0.5 ГБ) вместе ≈ **1 ГБ** при доступных 2.5 ГБ. *Моя прежняя оценка «стек может не поместиться» была завышена; реальный риск — полный swap и запас всего в ~1.5 ГБ* |
| **Порты** | нужны: 54321 (API), 54322 (Postgres — `psql` в двух тестах), 54324 (Mailpit — `auth.spec`), 3200 (приложение) — **все свободны**. Заняты: 3001 (чужой контейнер), 3900/3901 (twenty), **55321–55327** (чужой Supabase — с нашими не пересекается) |
| **Конфигурация проекта** | `project_id = English_teacher_AI`, Postgres 17, API 54321 / DB 54322 / Studio 54323 / Mailpit 54324 / analytics 54327 / pooler 54329 (выкл.), `site_url = http://127.0.0.1:3000`, подтверждение почты выключено |
| **Следы прежних запусков** | сеть `supabase_network_English_teacher_AI` и тома `supabase_db_English_teacher_AI` (**293 МБ, создан 2026-09-08 — ваши локальные данные разработки**), `supabase_storage_…`, `supabase_edge_runtime_…`. Контейнеров нет |
| **Образы** | для облегчённого стека (postgres 17.11.0.006, gotrue 2.197/2.193, postgrest 16.5, realtime 2.154, storage 1.84, kong 2.8.1, mailpit 1.31) есть локально — скачивать нечего |
| **Закреплённые версии** | `supabase/.temp/postgres-version = 17.6.1.147` — этого образа **нет** локально → запуск из каталога репозитория потянул бы тяжёлый pull. **Гипотеза (не проверена):** именно это сорвало два прошлых запуска (150 и 280 с, «ноль контейнеров»). Изолированная копия `.temp` не содержит |
| **Инструменты** | Docker 29.1.3 (вы в группе `docker`), `supabase` CLI 3.1.0, `psql`, Chromium для Playwright, cgroup v2 + `systemd-run --user` |
| **Ключи** | `SUPABASE_SERVICE_ROLE_KEY` в `.env.local` совпадает (по хэшу) с demo-ключом из `ci.yml` |

### 7.2. Что изолировано и чем

| Риск | Защита |
|---|---|
| `db reset` / `stop --no-backup` в репозитории стёрли бы ваш том с данными | отдельный `project_id = English_teacher_AI_e2e` и своя копия каталога `supabase/` в `~/.cache/lexreader-e2e/supabase-workdir` → свои тома, сеть и имена контейнеров (`supabase_*_English_teacher_AI_e2e`). Данные разработки не затрагиваются |
| Чужие стеки и контейнеры | CLI оперирует только своим `project_id`; **снимок** всех чужих контейнеров (имя + состояние) пишется в `preflight` и **сверяется в `down`** — любое отличие печатается красным |
| Порты чужих проектов | наши порты свободны (проверка в `preflight`); :3001 и :3000 не используются |
| Нехватка памяти | отказ при `MemAvailable < 1200 МБ` или PSI `full avg10 > 5`; **лимиты на наши контейнеры** (`docker update --memory X --memory-swap X`: db 640 МБ, realtime 320, auth/storage/kong 192, rest 128, mailpit 96 — без swap, он полон); наблюдатель убивает **только** `playwright test`, если `MemAvailable < 300 МБ` |
| Тяжёлый pull | `.temp` исключён; `supabase start` под `timeout 900`; образы проверены заранее |
| Письмо сброса пароля (`auth.spec`) вернёт на :3000 | в копии конфига `site_url` и `additional_redirect_urls` = `:3200` |
| Боевые ключи/внешние сервисы в тестах | приложение собирается с `.env.local` из блока `env:` `ci.yml` (demo-ключи, **без** PostHog, YouTube-воркера, Vercel, ScraperAPI); Stripe-тест пропускается сам (`STRIPE_SECRET_KEY` не задан) |
| Рабочий `.next` и dev на :3000 | сборка в `~/.cache/lexreader-isolated-build`, порт 3200, только loopback |
| Studio/analytics/edge-runtime (лишние ~300 МБ) | выключены в копии конфигурации |

### 7.3. Порядок (скрипт `scripts/e2e-isolated.sh`)

| Шаг | Команда | Что происходит | Критерий успеха | Остановка при |
|---|---|---|---|---|
| A | `scripts/e2e-isolated.sh preflight` | **только чтение:** Docker, память/swap/PSI, диск, порты, образы, ключи, снимок чужих контейнеров | `ИТОГ: можно запускать` (замечание про swap ожидаемо) | любой `✗` |
| B | `scripts/e2e-isolated.sh up` | `preflight` → копия конфигурации с правками → `supabase start` (7 сервисов, миграции 0001–0057 + seed на **пустом** томе) → лимиты памяти → изолированная сборка и запуск приложения на :3200 | `docker ps` — 7 контейнеров `…_English_teacher_AI_e2e` healthy; `curl :3200/login` → 200; Mailpit :54324 отвечает | неожиданный pull образов (Ctrl+C, затем `down`); сбой миграции; `MemAvailable` < 500 МБ |
| C | `scripts/e2e-isolated.sh test` (или `test e2e/auth.spec.ts` для пробы) | Playwright, 1 воркер, 109 сценариев / 32 файла против :3200 | отчёт Playwright; падения классифицируются (§7.4) | срабатывание наблюдателя памяти |
| D | `scripts/e2e-isolated.sh down` | остановка приложения → `supabase stop --no-backup` **своего** стека → сверка снимка чужих контейнеров → проверка, что dev-том на месте | `✓ чужие контейнеры: имена и состояния не изменились`, `dev-том … (должен быть 1)` → `1` | любое отличие в сверке |

Рекомендуемая проба перед полным прогоном: `up` → `test e2e/auth.spec.ts` → `down` (6 сценариев, проверяет Mailpit, redirect-allow-list, psql, Realtime-путь входа), затем полный набор.

### 7.4. Чего ждать от прогона (до его запуска)

- **Известные нестабильные:** `library.spec.ts` — миниатюра YouTube (в песочнице `i.ytimg.com` резолвится в приватный адрес — окружение, не код); `youtube-import.spec.ts` и `reader-library-a11y.spec.ts` ходят во внешнюю сеть / воркер — в изолированном окружении `YOUTUBE_WORKER_URL` не задан; ожидаемо падение или skip. Эти падения фиксируем как «окружение», остальное — регрессии.
- **Пропускается сам:** `payment.spec` (реальный Stripe, нужен `STRIPE_SECRET_KEY`).
- **Время (оценка, не измерение):** `up` 2–6 мин при локальных образах (+30–60 с сборка); полный набор — десятки минут (109 сценариев, `workers: 1`).
- Результат нужен как **baseline до Phase 2** (WP0.1): сколько зелёных, какие красные и почему.

### 7.5. Откат и уборка

```bash
scripts/e2e-isolated.sh down                  # приложение + свой стек + свои тома
scripts/isolated-build.sh --clean             # копия сборки ~/.cache/lexreader-isolated-build
# (опционально) rm -rf ~/.cache/lexreader-e2e # снимок и копия конфигурации; удаляйте вручную
```

После `down` остаются только каталоги в `~/.cache` (десятки МБ). Ваш dev-стек `English_teacher_AI` (том 293 МБ), чужие стеки, порты :3000/:3001 и рабочий `.next` не затрагиваются ни при каком шаге.

### 7.6. Чего скрипт не делает намеренно

- Не использует `supabase stop --all`, `docker stop|rm|prune`, `pkill -f next`, `killall node`.
- Не запускает `supabase db reset` в каталоге репозитория и не читает `supabase/.temp`.
- Не меняет `supabase/config.toml` и миграции в репозитории — правки только в копии.
- Не подключается к удалённому проекту Supabase (в `supabase/.temp/linked-project.json` есть привязка к облачному проекту — копия её не содержит, `start`/`stop` её не используют).

## 8. Вопросы к решению

**Решены (2026-11-12):** где хранить исходники макетов → `design/ultimate/` в git (§4.1); регистрация → режим внутри `/login`.

**Открыты (3):**

| # | Вопрос | Моя рекомендация |
|---|---|---|
| 3 | **Аналитика прогресса** (Stats-detail, Skill-breakdown, Learning-history, Weekly-report, Time-spent, Words-learned): новые маршруты под `/progress/*`? Для Time-spent нужен реальный учёт времени (`activity_days.minutes` сейчас не заполняется) | Маршруты — да; `Time-spent` отложить до введения учёта минут (миграция + запись), остальные — на существующих данных |
| 4 | **Справка** (`Help-support`, `Help-article`, `Whats-new`): откуда контент? `/changelog` уже есть | `Whats-new` = `/changelog`; справку — статичным MDX в репозитории, когда будет текст |
| 5 | **Имя и аватар профиля** (`Profile-edit`): `profiles` хранит только email | Не менять схему в Phase 2; экран — только в части реальных настроек (рейтинг, цель, тема); имя/аватар — после отдельного решения по схеме |

Порядок пакетов (WP0 → WP1/WP2 → WP3 → WP4 → WP5 → WP6 → WP7 → WP8 → WP9 → WP10) остаётся предложением — если не возражаете, принимаю как есть.

## 9. Риски

| Риск | Смягчение |
|---|---|
| Основной e2e не гонялся с Phase 1 — возможны скрытые регрессии (тёмные поверхности, `btn-sky/ember`, границы полей) | WP0.1: baseline до начала WP1 |
| Масштаб: 109 экранов, часть требует новых маршрутов и запросов | пакеты по 4–16 экранов, «паспорт данных» до вёрстки, PLANNED не трогаем |
| Макеты показывают метрики, которых нет в БД | правило 1: честная замена или отложить экран |
| Параллельные ветки конфликтуют в общих файлах | общие файлы — только в WP0; ветки WP1–WP4 не пересекаются по директориям |
| Тёмная тема меняет вид старых экранов | скриншот-сверка обеих тем в каждом PR |
| Скачивание образов Supabase и нехватка памяти | облегчённый стек, предпроверка `free -m`, отдельный терминал |

## 10. Что делать первым (после вашего «да»)

1. WP0.1 — baseline основного E2E по §7 (**нужно ваше явное «запускай»**: поднимается изолированный стек Supabase).
2. WP0.2 — коммит Phase 1 (по вашему разрешению).
3. WP0.7 — перенос исходников в `design/ultimate/` (§4.1), затем WP0.3–0.6 — Lex, Literata, CI, миграция остатков.
4. WP1 и WP2 — первые экраны.
