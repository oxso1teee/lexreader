# LexReader — Ultimate Screen Registry

Дата: 2026-11-12 · Artifact: [LexReader — Ultimate Design System](https://claude.ai/code/artifact/4c6ee007-9b1f-4b28-b7dd-87395937c892) · экранов: **186** · разделов: **19**

Источник каждого экрана: `design/ultimate/src/<Name>.html` (переработанные и новые; собираются `tools/build_screens.py`) либо `design/ultimate/core/<Name>.dc.html` (сохранённые исходные с исправлениями токенов/контраста). Статус функциональности сверен с кодом (маршруты `src/app`, миграции Supabase) — см. «Реальные и запланированные функции» в `lexreader-ultimate-design-system.md`.

**Статусы:** «Реально» — сценарий работает в коде; «Частично» — данные/логика есть, экрана 1:1 или части действия нет; «PLANNED» — концепт, backend отсутствует (на экране метка «Planned · концепт»).

Итого: Реально 108 · Частично 47 · PLANNED 31. Новых 49, переработано 91, сохранено с исправлениями 46.

## Онбординг и вход (12)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 001 | `Splash` | Запуск | Запуск | `/onboarding/{goal,placement,first-text,result}` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 002 | `Onboarding-why` | Зачем английский | Онбординг: мотивация | `нет — поля интересов/мотивации не найдены в онбординге` | PLANNED | переработан | light + dark | default | 390×844 |
| 003 | `Interests-pick` | Интересы | Онбординг: интересы | `нет — поля интересов/мотивации не найдены в онбординге` | PLANNED | переработан | light + dark | default | 390×844 |
| 004 | `Goal-pick` | Цель дня | Цель дня | `/onboarding/{goal,placement,first-text,result}` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 005 | `Placement-question` | Тест уровня | Тест на уровень: вопрос | `встроено в /onboarding/placement` | Реально | переработан | light + dark | default | 390×844 |
| 006 | `Placement-result` | Твой уровень | Твой уровень | `/onboarding/{goal,placement,first-text,result}` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 007 | `First-text` | Первый текст | Первый текст | `/onboarding/{goal,placement,first-text,result}` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 008 | `Signup` | Регистрация | Регистрация | `нет отдельного /signup — не найден в структуре маршрутов` | Частично | переработан | light + dark | default | 390×844 |
| 009 | `Login` | Вход | Вход в аккаунт | `/login` | Реально | переработан | light + dark | default | 390×844 |
| 010 | `Magic-link-sent` | Письмо со ссылкой отправлено | Подтверждение входа по magic-link | `/login (magic-link)` | Реально | новый | light + dark | success, disabled (таймер повтора) | 390×844 |
| 011 | `Reset-password` | Восстановление пароля | Запрос сброса пароля | `/reset-password, /reset-password/confirm` | Реально | переработан | light + dark | default | 390×844 |
| 012 | `Reset-password-confirm` | Новый пароль | Задать новый пароль | `/reset-password, /reset-password/confirm` | Реально | переработан | light + dark | default | 390×844 |

## Сегодня (6)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 013 | `Main` | Сегодня | Сегодня | `/home` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 014 | `Today-evening` | Сегодня вечером | Сегодня вечером | `/home` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 015 | `Today-new` | Сегодня — первый день | Главная нового пользователя с чек-листом первых шагов | `/home (first-time)` | Реально | новый | light + dark | first-time, empty | 390×844 |
| 016 | `Today-done` | Сегодня — цель выполнена | Главная после выполнения цели дня | `/home (completed)` | Реально | новый | light + dark | completed | 390×844 |
| 017 | `Welcome-back` | С возвращением | С возвращением | `системные, без отдельного маршрута` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 018 | `Week-recap` | Итоги недели | Итоги недели | `системные, без отдельного маршрута` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |

## Библиотека и контент (15)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 019 | `Library` | Библиотека | Библиотека | `/library` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 020 | `Library-empty` | Библиотека — пусто | Пустая библиотека с тремя способами начать | `/library (empty)` | Реально | новый | light + dark | empty, first-time | 390×844 |
| 021 | `Catalog` | Каталог материалов | Каталог материалов | `нет — требует новых полей на texts/profiles` | PLANNED | переработан | light + dark | default | 390×844 |
| 022 | `Genre` | Тема — Путешествия | Жанр: путешествия | `нет — требует новых полей на texts/profiles` | PLANNED | переработан | light + dark | default | 390×844 |
| 023 | `Text-detail` | Материал — Treasure Island | Страница текста | `/library (встроено)` | Частично | переработан | light + dark | default | 390×844 |
| 024 | `Search-results` | Поиск — результаты | Поиск по библиотеке | `/library (встроено)` | Частично | переработан | light + dark | default | 390×844 |
| 025 | `Collections` | Мои коллекции | Коллекции пользователя | `/library/collections, /library/new` | Реально | переработан | light + dark | default | 390×844 |
| 026 | `Collection-detail` | Коллекция | Материалы одной коллекции | `/library/collections/[id]` | Реально | новый | light + dark | default | 390×844 |
| 027 | `Favorites` | Избранное | Избранное | `нет — требует новых полей на texts/profiles` | PLANNED | переработан | light + dark | default | 390×844 |
| 028 | `Reading-history` | История чтения | Что и сколько читал | `/library` | Частично | новый | light + dark | default | 390×844 |
| 029 | `Reading-goal` | Цель чтения | Цель чтения | `нет — требует новых полей на texts/profiles` | PLANNED | переработан | light + dark | default | 390×844 |
| 030 | `Import-hub` | Добавить материал | Добавить материал | `/library/collections, /library/new` | Реально | переработан | light + dark | default | 390×844 |
| 031 | `Import-text` | Вставить текст | Импорт собственного текста | `/library/new` | Реально | новый | light + dark | default, focus, filled | 390×844 |
| 032 | `Import-youtube` | Импорт видео с YouTube | Импорт видео по ссылке с проверкой субтитров | `/library/new (YouTube)` | Реально | новый | light + dark | filled, success-preview, error-hint | 390×844 |
| 033 | `Import-processing` | Импорт обрабатывается | Статус обработки импорта | `api/youtube-import/[id]/status` | Реально | переработан | light + dark | default | 390×844 |

## Чтение и видео (5)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 034 | `Reader` | Читалка | Читалка | `/read/[textId]` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 035 | `Reader-phrase` | Перевод фразы | Выделение и перевод фразы в читалке | `/read/[textId]` | Реально | новый | light + dark | selected | 390×844 |
| 036 | `Reader-settings` | Вид текста | Настройки шрифта и темы читалки | `/read/[textId] (sheet)` | Частично | новый | light + dark | default | 390×844 |
| 037 | `Watch` | Видео с субтитрами | Просмотр видео с интерактивными субтитрами | `/watch/[textId]` | Реально | новый | light + dark | playing, word-selected | 390×844 |
| 038 | `Chapter-done` | Глава прочитана | Глава прочитана | `/progress, /quests/{chest,double-xp} (встроенные моменты)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |

## Занятие (11)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 039 | `Lesson-start` | Старт занятия | Старт занятия | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |
| 040 | `Lesson-choice` | Выбор ответа | Выбор ответа | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |
| 041 | `Lesson-build` | Собрать фразу | Собрать фразу | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |
| 042 | `Lesson-listen` | На слух | На слух | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |
| 043 | `Combo` | 5 верных подряд | 5 верных подряд | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |
| 044 | `Halfway` | Половина пути | Половина пути | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |
| 045 | `Mistakes` | Повтор ошибок | Повтор ошибок | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |
| 046 | `Quit-confirm` | Точно выйти? | Точно выйти? | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |
| 047 | `Result` | Итог занятия | Итог занятия | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |
| 048 | `Perfect` | Без ошибок | Без ошибок | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |
| 049 | `Goal-done` | Цель дня выполнена | Цель дня выполнена | `/missions/[missionId] (вероятный реальный экран)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default, selected, success, error | 390×844 |

## Упражнения и грамматика (7)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 050 | `Grammar-hub` | Грамматика | Грамматика: список тем | `нет отдельного — контент сейчас только внутри миссий` | Частично | переработан | light + dark | default | 390×844 |
| 051 | `Grammar-lesson` | Урок грамматики | Грамматический урок | `нет отдельного — контент сейчас только внутри миссий` | Частично | переработан | light + dark | default | 390×844 |
| 052 | `Match-pairs` | Соедини пары | Собери пары | `вероятно внутри mission-screen.tsx` | Частично | переработан | light + dark | default | 390×844 |
| 053 | `Fill-blank` | Заполни пропуск | Заполни пропуск | `вероятно внутри mission-screen.tsx` | Частично | переработан | light + dark | default | 390×844 |
| 054 | `Listening-exercise` | Диктант на слух | Аудирование: диктант | `вероятно внутри mission-screen.tsx` | Частично | переработан | light + dark | default | 390×844 |
| 055 | `Writing-exercise` | Письмо по правилам | Письменное упражнение | `пересекается с Twin-correction` | Частично | переработан | light + dark | default | 390×844 |
| 056 | `Speaking-exercise` | Повтори фразу | Говорение: повтори фразу | `нет — распознавания речи в коде не найдено` | PLANNED | переработан | light + dark | default | 390×844 |

## Учебная программа (9)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 057 | `Curriculum` | Программа | Программа курса (юниты) | `/learning-paths, /learning-paths/[pathSlug]` | Частично | переработан | light + dark | default | 390×844 |
| 058 | `Unit-overview` | Раздел 3 | Обзор раздела | `/learning-paths, /learning-paths/[pathSlug]` | Частично | переработан | light + dark | default | 390×844 |
| 059 | `Level-map` | Карта уровней | Уровни CEFR | `нет — профиль хранит текущий уровень, не историю по всем уровням` | Частично | переработан | light + dark | default | 390×844 |
| 060 | `Study-plan` | План недели | Персональный учебный план | `/learning-paths (рекомендация)` | PLANNED | переработан | light + dark | default | 390×844 |
| 061 | `Course-pick` | Выбор направления | Выбор направления обучения | `нет — мультивыбор направления не найден в онбординге` | PLANNED | переработан | light + dark | default | 390×844 |
| 062 | `Skill-check` | Проверка навыка | Результат проверки навыка пути | `/learning-paths/…/check` | Реально | новый | light + dark | completed | 390×844 |
| 063 | `Unit-done` | Раздел пройден | Раздел пройден | `/progress, /quests/{chest,double-xp} (встроенные моменты)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 064 | `Mission-detail` | Миссия дня | Брифинг перед миссией | `/missions/history, /missions/[missionId]` | Реально | переработан | light + dark | default | 390×844 |
| 065 | `Mission-history` | История миссий | История миссий | `/missions/history, /missions/[missionId]` | Реально | переработан | light + dark | default | 390×844 |

## Мозг · словарь и SRS (18)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 066 | `Brain-home` | Практика | Мозг: колоды | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` | Частично | переработан | light + dark | default | 390×844 |
| 067 | `Deck-detail` | Колода — Путешествия | Мозг: состав колоды | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` | Частично | переработан | light + dark | default | 390×844 |
| 068 | `Deck-import` | Новая колода | Мозг: импорт колоды | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` | Частично | переработан | light + dark | default | 390×844 |
| 069 | `Card-edit` | Карточка | Создание и редактирование карточки | `/brain/[deckId]` | Реально | новый | light + dark | focus, default | 390×844 |
| 070 | `Flashcard-review` | Карточка — вопрос | Мозг: классическая карточка | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` | Частично | переработан | light + dark | default | 390×844 |
| 071 | `Flashcard-answer` | Карточка — ответ | Оборот карточки с оценкой FSRS | `/brain/[deckId]/review` | Реально | новый | light + dark | default | 390×844 |
| 072 | `Flashcard-mc` | Карточка — выбор перевода | Мозг: карточка-выбор | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` | Частично | переработан | light + dark | default | 390×844 |
| 073 | `Flashcard-type` | Карточка — напиши слово | Мозг: карточка-ввод | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` | Частично | переработан | light + dark | default | 390×844 |
| 074 | `Review-modes` | Режимы тренировки | Выбор режима повторения | `/brain/[deckId]/review` | Частично | новый | light + dark | selected | 390×844 |
| 075 | `Review-done` | Повторение завершено | Итог сессии SRS | `/brain/[deckId]/review` | Реально | новый | light + dark | completed | 390×844 |
| 076 | `Brain-caught-up` | Всё повторено | Нет карточек на сегодня | `/brain` | Реально | новый | light + dark | empty, completed | 390×844 |
| 077 | `Review-due` | Слова ускользают | Слова ускользают | `/progress, /quests/{chest,double-xp} (встроенные моменты)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 078 | `Hard-words` | Трудные слова | Мозг: сложные слова | `/brain (расширение)` | Частично | переработан | light + dark | default | 390×844 |
| 079 | `Word-detail` | Слово — reluctant | Мозг: карточка слова | `/brain, /brain/[deckId], /brain/[deckId]/review, /brain/vocabulary` | Частично | переработан | light + dark | default | 390×844 |
| 080 | `Word-mastered` | Слово выучено | Слово выучено | `/progress, /quests/{chest,double-xp} (встроенные моменты)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |
| 081 | `Words-learned` | Мой словарь | Все изученные слова | `нет — всё сейчас агрегируется в одной /progress` | Частично | переработан | light + dark | default | 390×844 |
| 082 | `Brain-stats` | Статистика памяти | Графики повторений, удержание, прогноз | `/brain (stats)` | Частично | новый | light + dark | default | 390×844 |
| 083 | `Brain-settings` | Настройки повторения | Лимиты карточек, удержание FSRS, экспорт | `/brain/settings` | Реально | новый | light + dark | default | 390×844 |

## Мой английский · Language Twin (11)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 084 | `Twin-home` | Мой английский | Мой английский — обзор | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` | Реально | переработан | light + dark | default | 390×844 |
| 085 | `Twin-empty` | Мой английский — мало данных | Первое открытие Language Twin | `/language-twin (empty)` | Реально | новый | light + dark | empty, in-progress | 390×844 |
| 086 | `Twin-diagnostic` | Диагностика — вопрос | Диагностика Language Twin | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` | Реально | переработан | light + dark | default | 390×844 |
| 087 | `Twin-correction` | Проверка текста | Проверка текста по правилам | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` | Реально | переработан | light + dark | default | 390×844 |
| 088 | `Twin-patterns` | Паттерны ошибок | Обнаруженные паттерны ошибок | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` | Реально | переработан | light + dark | default | 390×844 |
| 089 | `Twin-pattern-detail` | Паттерн ошибки | Детали одного паттерна ошибок | `/language-twin/patterns` | Реально | новый | light + dark | default | 390×844 |
| 090 | `Twin-evidence` | Основания оценки | Основания оценки | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` | Реально | переработан | light + dark | default | 390×844 |
| 091 | `Twin-timeline` | История роста | Таймлайн роста | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` | Реально | переработан | light + dark | default | 390×844 |
| 092 | `Twin-recommendations` | Рекомендации | Рекомендации Language Twin | `/language-twin/recommendations` | Реально | переработан | light + dark | default | 390×844 |
| 093 | `Twin-settings` | Настройки «Мой английский» | Настройки Language Twin | `/language-twin[/{correction,diagnostic,evidence,patterns,settings,timeline}]` | Реально | переработан | light + dark | default | 390×844 |
| 094 | `Twin-insight` | Английский обновился | Английский обновился | `/progress, /quests/{chest,double-xp} (встроенные моменты)` | Реально | сохранён (контраст/токены исправлены) | light + dark | default | 390×844 |

## ИИ-репетитор · PLANNED (10)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 095 | `AI-hub` | ИИ-репетитор | Вход в будущий ИИ-репетитор | `— (нет маршрута)` | PLANNED | новый | light + dark | default, limit-info | 390×844 |
| 096 | `AI-tutor-chat` | ИИ-репетитор — чат | ИИ-репетитор: чат | `нет — ИИ-backend отсутствует полностью (0 совпадений по grep провайдеров)` | PLANNED | переработан | light + dark | default | 390×844 |
| 097 | `AI-explain` | ИИ — разбор ошибки | ИИ: разбор ошибки | `нет — ИИ-backend отсутствует полностью (0 совпадений по grep провайдеров)` | PLANNED | переработан | light + dark | default | 390×844 |
| 098 | `AI-writing-check` | ИИ — проверка письма | ИИ: проверка письма | `нет — ИИ-backend отсутствует полностью (0 совпадений по grep провайдеров)` | PLANNED | переработан | light + dark | default | 390×844 |
| 099 | `AI-writing-result` | ИИ — результат проверки письма | ИИ: результат письма | `нет — ИИ-backend отсутствует полностью (0 совпадений по grep провайдеров)` | PLANNED | переработан | light + dark | default | 390×844 |
| 100 | `AI-speaking` | ИИ — разговорная практика | ИИ: разговорная практика | `нет — ИИ-backend отсутствует полностью (0 совпадений по grep провайдеров)` | PLANNED | переработан | light + dark | default | 390×844 |
| 101 | `AI-speaking-result` | Итог разговора с ИИ | Результат разговорной практики | `—` | PLANNED | новый | light + dark | completed | 390×844 |
| 102 | `AI-pronunciation` | ИИ — произношение | ИИ: анализ произношения | `нет — ИИ-backend отсутствует полностью (0 совпадений по grep провайдеров)` | PLANNED | переработан | light + dark | default | 390×844 |
| 103 | `AI-generate` | ИИ — генератор упражнений | ИИ: генерация упражнений | `нет — ИИ-backend отсутствует полностью (0 совпадений по grep провайдеров)` | PLANNED | переработан | light + dark | default | 390×844 |
| 104 | `AI-recommend` | ИИ — рекомендации | ИИ: персональные рекомендации | `нет — ИИ-backend отсутствует полностью (0 совпадений по grep провайдеров)` | PLANNED | переработан | light + dark | default | 390×844 |

## Стрик (7)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 105 | `Streak-up` | Стрик продлён | Стрик продлён | `/streak` | Реально | сохранён (контраст/токены исправлены) | light + dark | success / in-progress | 390×844 |
| 106 | `Streak-30` | 30 дней подряд | 30 дней подряд | `/streak` | Реально | сохранён (контраст/токены исправлены) | light + dark | success / in-progress | 390×844 |
| 107 | `Streak-calendar` | Календарь стрика | Календарь стрика | `/streak` | Реально | сохранён (контраст/токены исправлены) | light + dark | success / in-progress | 390×844 |
| 108 | `Streak-commit` | Обещание стрика | Обещание стрика | `/streak` | Реально | сохранён (контраст/токены исправлены) | light + dark | success / in-progress | 390×844 |
| 109 | `Freeze-used` | Заморозка спасла стрик | Заморозка спасла стрик | `/streak` | Реально | сохранён (контраст/токены исправлены) | light + dark | success / in-progress | 390×844 |
| 110 | `Earn-back` | Вернуть стрик | Вернуть стрик | `/streak` | Реально | сохранён (контраст/токены исправлены) | light + dark | success / in-progress | 390×844 |
| 111 | `Perfect-week` | Идеальная неделя | Идеальная неделя | `/streak` | Реально | сохранён (контраст/токены исправлены) | light + dark | success / in-progress | 390×844 |

## Награды и задания (10)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 112 | `Level-up` | Новый уровень | Новый уровень | `/progress, /quests/{chest,double-xp} (встроенные моменты)` | Реально | сохранён (контраст/токены исправлены) | light + dark | success, in-progress, locked | 390×844 |
| 113 | `Achievement` | Новое достижение | Новое достижение | `/progress, /quests/{chest,double-xp} (встроенные моменты)` | Реально | сохранён (контраст/токены исправлены) | light + dark | success, in-progress, locked | 390×844 |
| 114 | `Achievements-gallery` | Достижения | Галерея достижений | `нет отдельной страницы — только карточки внутри /progress` | Частично | переработан | light + dark | success, in-progress, locked | 390×844 |
| 115 | `Achievement-detail` | Достижение — детали | Шит с прогрессом достижения | `/progress (sheet)` | Частично | новый | light + dark | default | 390×844 |
| 116 | `Milestones` | Вехи | Вехи аккаунта | `нет отдельной страницы — только карточки внутри /progress` | Частично | переработан | light + dark | success, in-progress, locked | 390×844 |
| 117 | `Daily-quests` | Задания дня | Задания дня | `/progress, /quests/{chest,double-xp} (встроенные моменты)` | Реально | сохранён (контраст/токены исправлены) | light + dark | success, in-progress, locked | 390×844 |
| 118 | `Quest-board` | Задания | Доска заданий | `нет /quests-обзора — только /quests/chest и /quests/double-xp` | Частично | переработан | light + dark | success, in-progress, locked | 390×844 |
| 119 | `Chest` | Сундук | Сундук | `/progress, /quests/{chest,double-xp} (встроенные моменты)` | Реально | сохранён (контраст/токены исправлены) | light + dark | success, in-progress, locked | 390×844 |
| 120 | `Double-XP` | Двойной опыт | Двойной опыт | `/progress, /quests/{chest,double-xp} (встроенные моменты)` | Реально | сохранён (контраст/токены исправлены) | light + dark | success, in-progress, locked | 390×844 |
| 121 | `Goal-edit` | Цель дня | Изменение дневной цели XP | `/settings` | Реально | новый | light + dark | selected | 390×844 |

## Лиги и экономика (8)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 122 | `Weekly-rank` | Итоги рейтинга | Итоги рейтинга | `/duel/[id], /leaderboard, /friends/[token] (встроенные моменты)` | Частично | сохранён (контраст/токены исправлены) | light + dark | in-progress, locked | 390×844 |
| 123 | `Overtaken` | Тебя обогнали | Тебя обогнали | `/duel/[id], /leaderboard, /friends/[token] (встроенные моменты)` | Частично | сохранён (контраст/токены исправлены) | light + dark | in-progress, locked | 390×844 |
| 124 | `League-table` | Лига недели | Таблица лиги | `/leaderboard` | Частично | переработан | light + dark | in-progress, locked | 390×844 |
| 125 | `League-result` | Итог недели в лиге | Результат недели без повышения | `/leaderboard` | Реально | новый | light + dark | completed | 390×844 |
| 126 | `Season-pass` | Сезонный пропуск | Сезонный боевой пропуск | `нет — экономики монет/косметики нет в схеме` | PLANNED | переработан | light + dark | in-progress, locked | 390×844 |
| 127 | `Shop` | Магазин | Магазин | `нет — экономики монет/косметики нет в схеме` | PLANNED | переработан | light + dark | in-progress, locked | 390×844 |
| 128 | `Mascot-closet` | Гардероб Lex | Гардероб маскота | `нет — экономики монет/косметики нет в схеме` | PLANNED | переработан | light + dark | in-progress, locked | 390×844 |
| 129 | `Challenge-weekly` | Командное испытание | Испытание недели (команда) | `нет — командных/клубных целей в схеме нет` | PLANNED | переработан | light + dark | in-progress, locked | 390×844 |

## Друзья и дуэли (15)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 130 | `Friends-list` | Друзья | Список друзей | `нет — generic friends/groups не существуют ПО ДИЗАЙНУ (явный комментарий в 0055: «отдельной generic-таблицы friends не делаем»)` | PLANNED | переработан | light + dark | default, loading | 390×844 |
| 131 | `Add-friends` | Найти друзей | Найти друзей | `нет — generic friends/groups не существуют ПО ДИЗАЙНУ (явный комментарий в 0055: «отдельной generic-таблицы friends не делаем»)` | PLANNED | переработан | light + dark | default, loading | 390×844 |
| 132 | `Friend-profile` | Профиль друга | Профиль друга | `нет — generic friends/groups не существуют ПО ДИЗАЙНУ (явный комментарий в 0055: «отдельной generic-таблицы friends не делаем»)` | PLANNED | переработан | light + dark | default, loading | 390×844 |
| 133 | `Friend-invite-share` | Пригласить в общий стрик | Пригласить на общий стрик | `/friends/invite, /friends/[token]` | Реально | переработан | light + dark | default, loading | 390×844 |
| 134 | `Friend-invite-accept` | Приглашение в общий стрик | Принять приглашение в стрик | `/friends/invite, /friends/[token]` | Реально | переработан | light + dark | default, loading | 390×844 |
| 135 | `Friend-streak` | Общая серия с другом | Общая серия с другом | `/duel/[id], /leaderboard, /friends/[token] (встроенные моменты)` | Частично | сохранён (контраст/токены исправлены) | light + dark | default, loading | 390×844 |
| 136 | `Activity-feed` | Лента друзей | Лента активности друзей | `нет — generic friends/groups не существуют ПО ДИЗАЙНУ (явный комментарий в 0055: «отдельной generic-таблицы friends не делаем»)` | PLANNED | переработан | light + dark | default, loading | 390×844 |
| 137 | `Groups-hub` | Группы | Учебные группы | `нет — generic friends/groups не существуют ПО ДИЗАЙНУ (явный комментарий в 0055: «отдельной generic-таблицы friends не делаем»)` | PLANNED | переработан | light + dark | default, loading | 390×844 |
| 138 | `Group-detail` | Клуб B1 | Страница группы | `нет — generic friends/groups не существуют ПО ДИЗАЙНУ (явный комментарий в 0055: «отдельной generic-таблицы friends не делаем»)` | PLANNED | переработан | light + dark | default, loading | 390×844 |
| 139 | `Duel-create` | Создать дуэль | Создание дуэли и ожидание соперника | `/duel` | Реально | новый | light + dark | loading (ожидание) | 390×844 |
| 140 | `Duel-invite` | Вызов на дуэль | Вызов на дуэль | `/duel/[id], /leaderboard, /friends/[token] (встроенные моменты)` | Частично | сохранён (контраст/токены исправлены) | light + dark | default, loading | 390×844 |
| 141 | `Duel-live` | Дуэль — раунд | Дуэль: раунд в реальном времени | `/duel/[id]` | Реально | переработан | light + dark | default, loading | 390×844 |
| 142 | `Duel-won` | Победа в дуэли | Победа в дуэли | `/duel/[id], /leaderboard, /friends/[token] (встроенные моменты)` | Частично | сохранён (контраст/токены исправлены) | light + dark | default, loading | 390×844 |
| 143 | `Duel-lost` | Поражение в дуэли | Итог проигранной дуэли | `/duel/[id]` | Реально | новый | light + dark | completed | 390×844 |
| 144 | `Share-card` | Карточка для шаринга | Карточка для публикации | `api/share-card, api/language-twin/share-card (только API)` | Реально | переработан | light + dark | default, loading | 390×844 |

## Прогресс и аналитика (6)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 145 | `Progress` | Прогресс | Прогресс | `/progress` | Реально | переработан | light + dark | default | 390×844 |
| 146 | `Stats-detail` | Статистика | Подробная статистика | `нет — всё сейчас агрегируется в одной /progress` | Частично | переработан | light + dark | default | 390×844 |
| 147 | `Skill-breakdown` | Навыки | Сильные и слабые стороны | `нет — всё сейчас агрегируется в одной /progress` | Частично | переработан | light + dark | default | 390×844 |
| 148 | `Learning-history` | История занятий | История занятий | `нет — всё сейчас агрегируется в одной /progress` | Частично | переработан | light + dark | default | 390×844 |
| 149 | `Weekly-report` | Отчёт недели | Персональный отчёт недели | `нет — всё сейчас агрегируется в одной /progress` | Частично | переработан | light + dark | default | 390×844 |
| 150 | `Time-spent` | Время обучения | Время обучения | `нет — всё сейчас агрегируется в одной /progress` | Частично | переработан | light + dark | default | 390×844 |

## Профиль и настройки (10)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 151 | `Profile` | Профиль | Профиль / Настройки | `/settings` | Частично | переработан | light + dark | default | 390×844 |
| 152 | `Profile-edit` | Редактировать профиль | Имя, аватар, видимость в рейтинге | `/settings` | Частично | новый | light + dark | focus | 390×844 |
| 153 | `Account-settings` | Аккаунт | Настройки аккаунта | `/settings, /privacy, api/export/*` | Реально | переработан | light + dark | default | 390×844 |
| 154 | `Notification-settings` | Уведомления | Настройки уведомлений | `/settings (push-часть)` | Частично | переработан | light + dark | default | 390×844 |
| 155 | `Data-privacy` | Данные и приватность | Данные и приватность | `/settings, /privacy, api/export/*` | Реально | переработан | light + dark | default | 390×844 |
| 156 | `Extension-connect` | Расширение браузера | Токены браузерного расширения | `/settings (секция расширения)` | Реально | переработан | light + dark | default | 390×844 |
| 157 | `Help-support` | Помощь | Помощь и поддержка | `нет /help маршрута` | Частично | переработан | light + dark | default | 390×844 |
| 158 | `Help-article` | Статья помощи | Ответ на частый вопрос | `— (контент нет)` | PLANNED | новый | light + dark | default | 390×844 |
| 159 | `Whats-new` | Что нового | Журнал изменений | `/changelog` | Реально | новый | light + dark | default | 390×844 |
| 160 | `Delete-account` | Удалить аккаунт | Подтверждение удаления | `/settings` | Реально | новый | light + dark | disabled (до ввода подтверждения) | 390×844 |

## Подписка (7)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 161 | `Pricing-plans` | Тарифы | Сравнение тарифов | `/settings (план), /paywall, /pricing` | Реально | переработан | light + dark | default | 390×844 |
| 162 | `Paywall-offer` | Предложение Plus | Предложение подписки Plus | `/settings (план), /paywall, /pricing` | Реально | переработан | light + dark | default | 390×844 |
| 163 | `Limit-reached` | Лимит Free | Упор в лимит бесплатного тарифа | `/library (trigger)` | Реально | новый | light + dark | locked | 390×844 |
| 164 | `Subscription` | Подписка | Управление подпиской | `/settings (план), /paywall, /pricing` | Реально | переработан | light + dark | default | 390×844 |
| 165 | `Purchase-success` | Plus оформлен | Успешная оплата | `/pricing → Stripe` | Реально | новый | light + dark | success | 390×844 |
| 166 | `Payment-failed` | Оплата не прошла | Ошибка оплаты | `/pricing → Stripe` | Реально | новый | light + dark | error | 390×844 |
| 167 | `Cancel-subscription` | Отмена подписки | Честная отмена Plus | `Stripe Portal` | Реально | новый | light + dark | default | 390×844 |

## Система и состояния (8)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 168 | `Loading-state` | Загрузка | Образец состояния загрузки | `кросс-функциональный паттерн` | Частично | переработан | light + dark | loading / empty / error / offline | 390×844 |
| 169 | `Empty-state` | Пустая колода | Образец пустого состояния | `кросс-функциональный паттерн` | Частично | переработан | light + dark | loading / empty / error / offline | 390×844 |
| 170 | `Error-state` | Ошибка импорта | Образец состояния ошибки | `кросс-функциональный паттерн` | Частично | переработан | light + dark | loading / empty / error / offline | 390×844 |
| 171 | `Offline` | Нет интернета | Нет интернета | `системные, без отдельного маршрута` | Реально | сохранён (контраст/токены исправлены) | light + dark | loading / empty / error / offline | 390×844 |
| 172 | `Not-found` | Страница не найдена | 404 | `— (not-found.tsx нет)` | PLANNED | новый | light + dark | error | 390×844 |
| 173 | `Session-expired` | Сессия истекла | Повторный вход | `/login` | Реально | новый | light + dark | error, modal | 390×844 |
| 174 | `Notify-ask` | Включить напоминания | Включить напоминания | `системные, без отдельного маршрута` | Реально | сохранён (контраст/токены исправлены) | light + dark | loading / empty / error / offline | 390×844 |
| 175 | `Rate-app` | Оцени приложение | Оцени приложение | `системные, без отдельного маршрута` | Реально | сохранён (контраст/токены исправлены) | light + dark | loading / empty / error / offline | 390×844 |

## Desktop и Tablet (11)

| ID | Экран | Название | Назначение | Маршрут | Статус | Работа | Темы | Состояния | Размер |
|---|---|---|---|---|---|---|---|---|---|
| 176 | `D-Today` | Desktop · Сегодня | Главная на широком экране | `/home` | Реально | новый | light + dark | default | 1280×800 |
| 177 | `D-Library` | Desktop · Библиотека | Библиотека с сеткой обложек | `/library` | Реально | новый | light + dark | default | 1280×800 |
| 178 | `D-Reader` | Desktop · Читалка | Читалка с панелью слова | `/read/[textId]` | Реально | новый | light + dark | word-selected | 1280×800 |
| 179 | `D-Watch` | Desktop · Видео | Видео + расшифровка | `/watch/[textId]` | Реально | новый | light + dark | playing | 1280×800 |
| 180 | `D-Practice` | Desktop · Практика | Мозг: колоды и повторение | `/brain` | Реально | новый | light + dark | default | 1280×800 |
| 181 | `D-Lesson` | Desktop · Упражнение | Задание с клавиатурными подсказками | `/learning-paths/…` | Реально | новый | light + dark | selected | 1280×800 |
| 182 | `D-Progress` | Desktop · Прогресс | Аналитика на широком экране | `/progress` | Реально | новый | light + dark | default | 1280×800 |
| 183 | `D-Settings` | Desktop · Настройки | Двухпанельные настройки | `/settings` | Реально | новый | light + dark | default | 1280×800 |
| 184 | `T-Today` | Tablet · Сегодня | Главная на планшете | `/home` | Реально | новый | light + dark | default | 834×1112 |
| 185 | `T-Library` | Tablet · Библиотека | Библиотека на планшете | `/library` | Реально | новый | light + dark | default | 834×1112 |
| 186 | `T-Reader` | Tablet · Читалка | Читалка на планшете | `/read/[textId]` | Реально | новый | light + dark | word-selected | 834×1112 |
