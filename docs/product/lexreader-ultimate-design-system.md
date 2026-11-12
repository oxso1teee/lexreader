# LexReader — Ultimate Design System

Дата: 2026-11-12 · Artifact: [LexReader — Ultimate Design System](https://claude.ai/code/artifact/4c6ee007-9b1f-4b28-b7dd-87395937c892) (тот же URL, что у прежней 137-экранной библиотеки — обновлён на месте) · полный реестр: [lexreader-ultimate-screen-registry.md](lexreader-ultimate-screen-registry.md)

Этот документ — итог «Ultimate»-прохода: что было найдено, что изменилось в системе, какие экраны переработаны и добавлены, как теперь устроены навигация, темы, адаптив и состояния, и что по-прежнему остаётся концептом. Числа ниже сгенерированы скриптами из реальных файлов (`design/ultimate/tools/build_docs.py`), а не вписаны вручную.

## 1. Итог в цифрах

| | Было | Стало |
|---|---|---|
| Экранов | 137 | **186** |
| Разделов | 23 | **19** |
| Новых экранов | — | **49** |
| Переработано существующих (новая вёрстка на ките) | — | **91** |
| Сохранено с исправлениями (контраст, токены, ссылки) | — | **46** |
| Статусы | 69 / 46 / 22 (прежний аудит) | Реально **108** · Частично **47** · PLANNED **31** |
| Форм-факторы | только mobile 390×844 | mobile + tablet 834×1112 + desktop 1280×800 |

Ни один исходный экран не удалён: все 137 есть в новой библиотеке (переработанные — под тем же именем файла).

## 2. Результаты финального аудита

### Как проверялось

Не «на глаз», а скриптом + глазами:

- `tools/audit.mjs` (Playwright, Chromium) открывает **каждый** экран в **светлой и тёмной** теме при реальном размере кадра и проверяет: текст, вылезающий за кадр (clipped); контраст каждого текстового узла против фактического фона с учётом прозрачности (WCAG AA: 4.5:1, крупный текст 3:1); текст мельче 11px; зоны нажатия меньше 40px; горизонтальную прокрутку; JS-ошибки и 404 ресурсов; ссылки `#` и ссылки на несуществующие экраны; захардкоженные hex-цвета.
- `tools/linkcheck.py` строит граф переходов между всеми экранами.
- Каждый лист скриншотов (светлая + тёмная) просмотрен глазами — авторами экранов и при финальной сборке.

### Что было найдено в исходных 137 экранах (до работы)

- **Тёмная тема была сломана частично:** 85 экранов не проходили контраст в dark. Причина системная: акцентные шаги `--green-400/--blue-500/--orange-600` в тёмной теме «подсвечиваются» ярче, и белый текст на них становился нечитаемым (2.3–2.9:1) — на главных кнопках, hero-карточках, полноцветных праздничных экранах.
- **Светлая тема:** 102 экрана с хотя бы одним провалом контраста (подписи `rgba(ink,.4–.55)`, белый текст с opacity на цветных фонах, оранжевый текст на светло-оранжевом).
- **Шрифты не грузились:** Unbounded/Onest были объявлены, но не подключены — все 137 экранов рендерились системным шрифтом.
- **92 экрана с «случайными» hex-цветами** в разметке; фиолетовый ИИ-акцент вне палитры.
- **Навигация:** 10 экранов с `href="#"`; вкладка «Практика» вела в упражнение, а не в раздел; корневые Progress/Profile не вели ни в один из 89 экранов Stage 9–10 — эти разделы были фактически недостижимы.
- **Качество Stage 9–10 (89 экранов):** большинство — «шапка + 3 строки + пустая нижняя половина», эмодзи вместо иконок, без состояний, разный стиль шапок/кнопок/карточек; ИИ-функции изображены как работающие.
- **Пробелы в сценариях:** не было 404, истёкшей сессии, magic-link, лимита Free, успеха/ошибки оплаты, отмены подписки, удаления аккаунта, пустой библиотеки, первого дня, «всё повторено», итога сессии повторения, поражения и создания дуэли, видеоплеера, импорта текста/YouTube, перевода фразы, настроек читалки, desktop/tablet.

### Финальная проверка (после работы)

Аудит 186 экранов, светлая + тёмная тема:

| Проверка | Экранов с проблемой |
|---|---|
| Текст за пределами кадра | 0 |
| Контраст < AA, светлая | 0 |
| Контраст < AA, тёмная | 0 |
| Текст < 11px | 0 |
| Зона нажатия < 40px | 0 |
| JS-ошибки / 404 | 0 |
| Горизонтальная прокрутка | 0 |

Граф навигации: 687 переходов; битых ссылок: 0; экранов со ссылками `#`: 0.

## 3. Изменения дизайн-системы

Система живёт в двух файлах, общих для всех экранов: `design-system.css` (токены) и новый `lex-ui.css` (компоненты + иконки + маскот). Живой справочник — страница `system.html` в Artifact.

**Токены (добавлено к утверждённой палитре v8; сама палитра не менялась):**

- **Лестница поверхностей** `--surface-canvas / -app / -card / -sunken / -raised / -overlay` — в тёмной теме это 6 разных уровней, а не одна «серая карточка».
- **Заливки под текст** `--fill-leaf / -sky / -ember / -red / -sun / -ink / -teal` (+ `-edge` для нижней грани). Главный фикс тёмной темы: в отличие от акцентных шагов 400/500, эти заливки остаются глубокими в обеих темах, поэтому белый текст на кнопках и hero всегда ≥ 4.5:1.
- **Text-safe акценты** `--green-text / --blue-text / --gold-text / --orange-text / --red-text` — для цветного текста на светлых тинтах; в тёмной теме заменяются светлыми оттенками.
- **Лестница текста** `--text-1 / -2 / -3 / -disabled` (все, кроме disabled, ≥ 4.5:1 на app/card в обеих темах).
- **Шкалы:** spacing 4pt (`--sp-1…12`), радиусы `--r-xs…2xl/full`, типографика (`--fs-*`, шрифт чтения `--font-read` = Literata), обводки (`--stroke`, `--stroke-soft`, `--edge`), тени только у оверлеев (`--shadow-1…3`, свои значения для dark), `--scrim`, motion (`--ease-*`, `--dur-*`), z-слои.
- **Шрифты** подключены реально (Google Fonts): Unbounded — заголовки и числа; Onest — интерфейс; Literata — английский текст для чтения (новое: читалка, карточки, примеры).
- **Фиолетовый удалён** из продукта. ИИ/PLANNED получили собственный язык: тёмно-зелёная «ink»-заливка + жёлтая искра.

**Компоненты (`lex-ui.css`):** каркас экрана (`.app` flex-колонка, `.pagehead / .hdr / .lessonbar`, прокручиваемый `.body`, закреплённый `.dock`, `.tabbar`, desktop `.side/.main`); кнопки (`b-leaf/sky/ember/sun/red/ink/ghost/white`, `.sm`, disabled, loading, `.link2`, `.iconbtn`, `.fab`); поверхности (`.card` + тинты/press/dash, `.hero`, `.list/.row`, `.stat`, `.sw`-плашки, `.cover`-обложки, `.avatar`); метки (`.chip`, `.seg`, `.badge` + `soon/plus`, `.count`, `.pill`, `.cefr`, `.dots`); формы (`.field` + focus/err/ok/area/disabled, `.hint`, `.toggle` с зоной нажатия 60×44, `.radio`, `.check`, `.opt` + on/ok/bad, `.tile`); прогресс (`.bar`, `.steps`, `.spin`, `.skel`); оверлеи и обратная связь (`.sheet`, `.modal`, `.scrim`, `.toast`, `.banner` info/ok/warn/err/ai, `.feedback` ok/bad, `.empty`, `.bubble`, `.say`); метка `.planned-tag`.

**Иконки:** 128 иконок одного стиля (stroke 2, 24px) как CSS-маски `<i class="ic ic-book">` — цвет берут из `currentColor` и одинаково работают в обеих темах. Эмодзи в интерфейсе запрещены и удалены.

**Маскот Lex:** 8 настроений (`happy wink joy sad sleep think wow cool`) + `pale` для цветного фона и `ghost`, 5 размеров — одной строкой `<i class="lex joy s88">`.

**Правила:** цвет = смысл (зелёный — главное и прогресс, синий — память/SRS, оранжево-красный — стрик и срочность, жёлтый — награды и Plus, красный — ошибки и опасные действия, ink — ИИ/PLANNED); «плоско, но пухло» (рамка 2px, нижняя грань 4px у нажимаемого, тени только у оверлеев); одна первичная кнопка на экран.

## 4. Экраны

### Переработанные (91)

Полностью пересобраны на ките (новая композиция, состояния, иконки, честный статус); прежнее содержание сохранено и расширено:

`Onboarding-why`, `Interests-pick`, `Placement-question`, `Signup`, `Login`, `Reset-password`, `Reset-password-confirm`, `Catalog`, `Genre`, `Text-detail`, `Search-results`, `Collections`, `Favorites`, `Reading-goal`, `Import-hub`, `Import-processing`, `Grammar-hub`, `Grammar-lesson`, `Match-pairs`, `Fill-blank`, `Listening-exercise`, `Writing-exercise`, `Speaking-exercise`, `Curriculum`, `Unit-overview`, `Level-map`, `Study-plan`, `Course-pick`, `Mission-detail`, `Mission-history`, `Brain-home`, `Deck-detail`, `Deck-import`, `Flashcard-review`, `Flashcard-mc`, `Flashcard-type`, `Hard-words`, `Word-detail`, `Words-learned`, `Twin-home`, `Twin-diagnostic`, `Twin-correction`, `Twin-patterns`, `Twin-evidence`, `Twin-timeline`, `Twin-recommendations`, `Twin-settings`, `AI-tutor-chat`, `AI-explain`, `AI-writing-check`, `AI-writing-result`, `AI-speaking`, `AI-pronunciation`, `AI-generate`, `AI-recommend`, `Achievements-gallery`, `Milestones`, `Quest-board`, `League-table`, `Season-pass`, `Shop`, `Mascot-closet`, `Challenge-weekly`, `Friends-list`, `Add-friends`, `Friend-profile`, `Friend-invite-share`, `Friend-invite-accept`, `Activity-feed`, `Groups-hub`, `Group-detail`, `Duel-live`, `Share-card`, `Progress`, `Stats-detail`, `Skill-breakdown`, `Learning-history`, `Weekly-report`, `Time-spent`, `Profile`, `Account-settings`, `Notification-settings`, `Data-privacy`, `Extension-connect`, `Help-support`, `Pricing-plans`, `Paywall-offer`, `Subscription`, `Loading-state`, `Empty-state`, `Error-state`

### Новые (49)

`Magic-link-sent`, `Today-new`, `Today-done`, `Library-empty`, `Collection-detail`, `Reading-history`, `Import-text`, `Import-youtube`, `Reader-phrase`, `Reader-settings`, `Watch`, `Skill-check`, `Card-edit`, `Flashcard-answer`, `Review-modes`, `Review-done`, `Brain-caught-up`, `Brain-stats`, `Brain-settings`, `Twin-empty`, `Twin-pattern-detail`, `AI-hub`, `AI-speaking-result`, `Achievement-detail`, `Goal-edit`, `League-result`, `Duel-create`, `Duel-lost`, `Profile-edit`, `Help-article`, `Whats-new`, `Delete-account`, `Limit-reached`, `Purchase-success`, `Payment-failed`, `Cancel-subscription`, `Not-found`, `Session-expired`, `D-Today`, `D-Library`, `D-Reader`, `D-Watch`, `D-Practice`, `D-Lesson`, `D-Progress`, `D-Settings`, `T-Today`, `T-Library`, `T-Reader`

### Сохранённые с исправлениями (46)

Это утверждённое ядро (Сегодня, Занятие, Стрик, Награды, Друзья и соревнование, Онбординг, Система). Композиция у этих экранов сильная и узнаваемая, поэтому они не перерисовывались, а исправлялись точечно: подключены реальные шрифты; белый текст на цветных фонах переведён на `--fill-*` (тёмная тема); акцентный текст — на `--*-text`; прозрачность подписей поднята до AA; кнопки «Позже/Не сейчас» получили зону 44px; вкладка «Практика» ведёт в раздел «Практика»; карточки Main/Today-evening/Library ведут в новые разделы; эмодзи в Library заменены иконками; фиолетовый удалён.

`Splash`, `Goal-pick`, `Placement-result`, `First-text`, `Main`, `Today-evening`, `Welcome-back`, `Week-recap`, `Library`, `Reader`, `Chapter-done`, `Lesson-start`, `Lesson-choice`, `Lesson-build`, `Lesson-listen`, `Combo`, `Halfway`, `Mistakes`, `Quit-confirm`, `Result`, `Perfect`, `Goal-done`, `Unit-done`, `Review-due`, `Word-mastered`, `Twin-insight`, `Streak-up`, `Streak-30`, `Streak-calendar`, `Streak-commit`, `Freeze-used`, `Earn-back`, `Perfect-week`, `Level-up`, `Achievement`, `Daily-quests`, `Chest`, `Double-XP`, `Weekly-rank`, `Overtaken`, `Friend-streak`, `Duel-invite`, `Duel-won`, `Offline`, `Notify-ask`, `Rate-app`

### Распределение по разделам

| Раздел | Экранов | Новых | Переработано |
|---|---|---|---|
| Онбординг и вход | 12 | 1 | 7 |
| Сегодня | 6 | 2 | 0 |
| Библиотека и контент | 15 | 5 | 9 |
| Чтение и видео | 5 | 3 | 0 |
| Занятие | 11 | 0 | 0 |
| Упражнения и грамматика | 7 | 0 | 7 |
| Учебная программа | 9 | 1 | 7 |
| Мозг · словарь и SRS | 18 | 7 | 9 |
| Мой английский · Language Twin | 11 | 2 | 8 |
| ИИ-репетитор · PLANNED | 10 | 2 | 8 |
| Стрик | 7 | 0 | 0 |
| Награды и задания | 10 | 2 | 3 |
| Лиги и экономика | 8 | 1 | 5 |
| Друзья и дуэли | 15 | 2 | 10 |
| Прогресс и аналитика | 6 | 0 | 6 |
| Профиль и настройки | 10 | 4 | 6 |
| Подписка | 7 | 4 | 3 |
| Система и состояния | 8 | 2 | 3 |
| Desktop и Tablet | 11 | 11 | 0 |

## 5. Изменения навигации

- **Основная навигация — 5 вкладок, как в коде** (`nav-items.ts`): Сегодня (`/home`) · Библиотека · Практика (`/brain`) · Прогресс · Профиль. Вкладка «Практика» теперь ведёт в раздел `Brain-home`, а не в отдельное упражнение. В реальном приложении вторая вкладка — «Учиться» (`/learning-paths`); макеты сохраняют «Библиотеку» как вкладку, а учебный путь доступен из Профиля и Главной. Это расхождение нужно решить продуктово (см. ограничения).
- **Хабы перестроены.** Progress ведёт в Words-learned, Reading-history, Stats-detail, Time-spent, Learning-history, League-table, Twin-home, Level-map, Skill-breakdown, Achievements-gallery, Milestones, Weekly-report. Profile — в Profile-edit, Account-settings, Twin-home, Achievements-gallery, Friends-list, AI-hub, Pricing-plans, Goal-edit, Curriculum, Notification-settings, Subscription, Extension-connect, Data-privacy, Help-support, Whats-new. Brain-home — в колоды, режимы, статистику, настройки, трудные слова, грамматику, миссии.
- **Глубина не больше 3 уровней** от вкладки до любого экрана; у каждого вложенного экрана есть «назад» на логичного родителя, у упражнений — «закрыть» с подтверждением выхода.
- **Экраны без входящих ссылок** — моменты и состояния, которые вызывает логика приложения (праздники, итоги, предупреждения, шаги онбординга, desktop-варианты): `Placement-result`, `Reset-password-confirm`, `Today-evening`, `Today-new`, `Today-done`, `Welcome-back`, `Week-recap`, `Library-empty`, `Reader-phrase`, `Combo`, `Perfect`, `Writing-exercise`, `Unit-done`, `Brain-caught-up`, `Review-due`, `Word-mastered`, `Twin-empty`, `Twin-insight`, `AI-writing-result`, `Streak-30`, `Earn-back`, `Perfect-week`, `Achievement`, `Overtaken`, `League-result`, `Friend-invite-accept`, `Duel-live`, `Duel-lost`, `Loading-state`, `Empty-state`, `Error-state`, `Offline`, `Not-found`, `Session-expired`, `Rate-app`.
- **Экраны без исходящих ссылок:** —.

## 6. Light / Dark

- Обе темы — из одних токенов; тёмная — отдельная система, не инверсия: 6 уровней поверхностей, свои тени, свои text-safe акценты, глубокие заливки под белый текст, затемнение подложки 62%.
- Каждый экран проверен в обеих темах скриптом контраста и глазами (листы `build/shots/*/view-*.png`, `build/shots/final/`; в git не хранятся, пересоздаются `tools/audit.mjs`).
- Полноцветные праздничные экраны (стрик, уровень, «без ошибок», дуэль) держат брендовый цвет в обеих темах — белый текст на них проверен отдельно.
- Иллюстрации: маскот и обложки — фиксированные брендовые цвета, читаются на обоих фонах; иконки — маски `currentColor`.

## 7. Адаптивность

- **Mobile (390×844)** — основной форм-фактор: закреплённый dock с главным действием у большого пальца, таббар внизу, прокручивается только контент, все цели ≥ 44px.
- **Tablet (834×1112)** — отдельные композиции: T-Today, T-Library, T-Reader (двухколоночные сетки, шит слова с содержимым в 2 колонки).
- **Desktop (1280×800)** — отдельные композиции, не растянутый телефон: сайдбар как `DesktopSidebar` в коде, правые панели, таблицы, подсказки клавиатуры (D-Today, D-Library, D-Reader, D-Watch, D-Practice, D-Lesson, D-Progress, D-Settings).
- Галерея и `system.html` адаптивны (проверено на 390px — без горизонтальной прокрутки).

## 8. Состояния

Состояния показаны в подходящем формате — где отдельным экраном, где внутри экрана:

- **Loading:** Loading-state (скелетон реальной библиотеки), Import-processing (шаги), Duel-create (ожидание соперника), спиннеры в кнопках.
- **Empty:** Empty-state, Library-empty, Brain-caught-up, Twin-empty, Today-new.
- **Error:** Error-state, Payment-failed, Not-found, Session-expired, Login (ошибка поля), Import-youtube (ошибка URL), Offline.
- **Success / Completed:** Result, Perfect, Review-done, Skill-check, Purchase-success, Today-done, League-result, Duel-won/Duel-lost, все моменты-праздники.
- **Disabled:** Delete-account, Writing-exercise, AI-writing-check, Magic-link-sent (таймер повтора), Rate-app.
- **Locked:** Curriculum, Unit-overview, Level-map, Achievements-gallery, Limit-reached, Deck-import (генерация).
- **Offline:** Offline.
- **First-time:** Splash, онбординг, Today-new, Library-empty, Twin-empty.
- **In-progress:** Halfway, Duel-live, Import-processing, Mission-history, Quest-board.

## 9. Продуктовые улучшения

- **Мозг/SRS стал полноценным разделом:** колоды, режимы, оборот карточки с интервалами FSRS, итог сессии, «всё повторено», статистика памяти и настройки. Раньше это были 8 разрозненных экранов без сценария.
- **Чтение и видео:** перевод фразы, настройки текста, видео с интерактивными субтитрами, три вида импорта с честным лимитом Free, история чтения, коллекции с детальной страницей.
- **«Мой английский»** везде подчёркивает принцип: оценка по правилам, без ИИ, тексты не уходят наружу. Добавлены экран паттерна ошибки и пустое состояние.
- **Монетизация без тёмных паттернов:** лимит Free, сравнение тарифов, успех и ошибка оплаты, отмена подписки с понятными последствиями.
- **Жизненный цикл аккаунта:** magic-link, сброс пароля, редактирование профиля, удаление аккаунта с подтверждением, экспорт данных.
- **Дуэли:** создание и ожидание, живой раунд, бережный экран поражения.
- **ИИ-репетитор** спроектирован целиком (хаб, чат, разборы, письмо, речь, произношение, генерация, рекомендации) — но честно как PLANNED.

## 10. Реальные и запланированные функции

**Реально в коде** (маршруты `src/app`, 57 миграций Supabase): чтение текстов и YouTube-видео с субтитрами (локальный Whisper), перевод слов (MyMemory), словарь и SRS «Мозг» (FSRS), учебные пути и проверки навыков, миссии, стрик и заморозки, XP/уровни/достижения, дневные задания и сундук, двойной опыт, недельный рейтинг, дуэли 1-на-1 по ссылке (Realtime), общий стрик с одним другом по ссылке, «Мой английский» (Language Twin, правила), Stripe-подписка и лимиты Free (триггеры в БД), push-напоминания, браузерное расширение (токены), экспорт данных, changelog, offline.

**PLANNED (31 экранов):** `Onboarding-why`, `Interests-pick`, `Catalog`, `Genre`, `Favorites`, `Reading-goal`, `Speaking-exercise`, `Study-plan`, `Course-pick`, `AI-hub`, `AI-tutor-chat`, `AI-explain`, `AI-writing-check`, `AI-writing-result`, `AI-speaking`, `AI-speaking-result`, `AI-pronunciation`, `AI-generate`, `AI-recommend`, `Season-pass`, `Shop`, `Mascot-closet`, `Challenge-weekly`, `Friends-list`, `Add-friends`, `Friend-profile`, `Activity-feed`, `Groups-hub`, `Group-detail`, `Help-article`, `Not-found`

**Частично (47 экранов):** `Signup`, `Text-detail`, `Search-results`, `Reading-history`, `Reader-settings`, `Grammar-hub`, `Grammar-lesson`, `Match-pairs`, `Fill-blank`, `Listening-exercise`, `Writing-exercise`, `Curriculum`, `Unit-overview`, `Level-map`, `Brain-home`, `Deck-detail`, `Deck-import`, `Flashcard-review`, `Flashcard-mc`, `Flashcard-type`, `Review-modes`, `Hard-words`, `Word-detail`, `Words-learned`, `Brain-stats`, `Achievements-gallery`, `Achievement-detail`, `Milestones`, `Quest-board`, `Weekly-rank`, `Overtaken`, `League-table`, `Friend-streak`, `Duel-invite`, `Duel-won`, `Stats-detail`, `Skill-breakdown`, `Learning-history`, `Weekly-report`, `Time-spent`, `Profile`, `Profile-edit`, `Notification-settings`, `Help-support`, `Loading-state`, `Empty-state`, `Error-state`

## 11. Backend-зависимости

| Функция | Что нужно |
|---|---|
| ИИ-репетитор (все `AI-*`) | LLM-провайдер (ключей в проекте нет), API-слой, таблицы `ai_conversations/ai_messages`, модерация, дневные лимиты Free/Plus, бюджет |
| Говорение и произношение | STT-провайдер (распознавания речи сейчас нет вообще) |
| Друзья, поиск, профиль друга, лента | таблица `friendships`, поисковый RPC с приватностью, RLS уровня duels/friend_streaks |
| Группы и командное испытание | таблицы групп и участников, агрегаты XP |
| Магазин, гардероб, сезонный пропуск | валюта (ledger), инвентарь косметики, прогресс сезона |
| Каталог и жанры, избранные тексты | колонки жанра/тегов у `texts`, модель избранного для текстов (сейчас только для слов) |
| Онбординг «зачем/интересы», выбор направления, план недели | новые поля профиля; несколько учебных путей |
| Цель чтения | отдельная цель в профиле (сейчас только дневная цель XP) |
| Статья помощи | контент справки |
| 404 | `not-found.tsx` (в коде отсутствует) |

## 12. Известные ограничения

- **Макеты — статичный HTML.** Переходы между экранами работают как ссылки, но формы и переключатели не выполняют логику (кроме переключения темы).
- **Токены макетов ≠ токены кода.** В приложении — `--leaf/--sky/--ember` (Tailwind v4), в макетах — `--paper/--ink/--green/--fill-*`. Перед вёрсткой нужно одно централизованное сопоставление.
- **Вторая вкладка:** в коде «Учиться» → `/learning-paths`, в макетах «Библиотека». Нужно продуктовое решение.
- **Живое приложение не прокликано:** локальный стек Supabase этого проекта в прошлых проходах не поднимался, поэтому реальность функций подтверждена по исходникам и миграциям, а не кликами. Макеты проверены в браузере (Chromium) — обе темы, все размеры.
- **Утверждённое ядро сохранено намеренно:** 46 исходных экранов исправлены, но не перерисованы на ките; их стили локальны в каждом файле. При переносе в код их стоит собрать на тех же компонентах.
- Данные в макетах — вымышленный, но согласованный «мир продукта» (Сергей, B1, стрик 12, 842 слова, The Last Lighthouse).

## 13. Где что лежит

- `design/ultimate/src/*.html` — исходники переработанных и новых экранов (фрагменты), `design/ultimate/core/*.dc.html` — 46 экранов ядра, правятся вручную; `tools/build_screens.py` собирает всё в `dist/*.dc.html`.
- `design/ultimate/dist/` (генерируется, в git не хранится) — опубликованная библиотека: `index.html` (галерея), `system.html` (справочник), `design-system.css`, `lex-ui.css`, `theme.js`, все `*.dc.html`.
- `design/ultimate/ds/` — исходники кита (`tokens-v9.css`, `ui-core.css`); `tools/build_ds.py` собирает CSS, иконки и маскота.
- `design/ultimate/tools/audit.mjs`, `view.py`, `linkcheck.py` — проверки; `build_gallery.py`, `build_system_page.py`, `build_docs.py` — галерея, справочник, документация (реестр — данные `registry.json`).
- `design/ultimate/BRIEF.md`, `design/ultimate/specs/` — бриф и спецификации, по которым делались экраны.
