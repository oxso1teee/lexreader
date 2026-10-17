# Промпты для ИИ-агента в VS Code: перенос экранов v7 в приложение

Отправлять по одному, по порядку. Следующий — только после того, как PR
предыдущего этапа смержен и всё проверено.

Эталон: `docs/moments/mockups/*.dc.html` (исходники 47 экранов),
`docs/moments/reference/*.png` (скриншоты 390×844), `docs/moments/ROADMAP.md`
(план и таблица статуса). Живой холст: https://claude.ai/artifact/PopPmjb8ks7FcXayR5RGCZ
(открывается только у владельца аккаунта; агенту давать файлы из репо).

---

## Промпт 0 — правила (один раз, первым)

```
Репозиторий LexReader: Next.js 16, React 19, Supabase, Capacitor. Задача — перенести в приложение ВСЕ экраны дизайна v7 один в один.

Эталон в репо:
- docs/moments/mockups/*.dc.html — исходники 47 экранов: разметка, CSS, все keyframes и задержки, тексты, размер 390×844
- docs/moments/reference/*.png — скриншот каждого экрана
- docs/moments/ROADMAP.md — этапы и таблица статуса всех экранов

Сначала убедись, что работаешь от ветки, где есть фундамент (PR #93 и #94 смержены в main, иначе ветка feat/moments-foundation):
- движок всплывающих экранов: src/lib/moments (очередь + тесты), src/components/product/moments (MomentProvider, MomentScreen, Confetti, useCountUp), src/styles/moments.css
- галереи /dev/moments и /dev/screens с тестовыми данными
- главный экран v7: src/components/product/today/v7, src/styles/today.css
Повторяй те же приёмы для новых экранов.

Правила для КАЖДОГО экрана:
1. Открой его .dc.html и .png. Повтори разметку, отступы, размеры и вес шрифтов, радиусы, цвета, анимации (keyframes, длительности, задержки, порядок появления) один в один. Ничего не упрощай и не «улучшай». Цвета — через токены src/styles/tokens.css (--leaf, --sun, --ember, --sky, --danger, их -edge/-tint/-text), чтобы работала тёмная тема.
2. Данные только настоящие из Supabase. Если механики нет — сначала миграция в supabase/migrations, логика в src/lib, unit-тесты (node --test, добавь файл в scripts.test:ui в package.json), потом экран. Никаких заглушек и выдуманных цифр.
3. Добавь экран в галерею (/dev/moments — всплывающие, /dev/screens — основные) с тестовыми данными как на макете. Сними Playwright-скриншот 390×844 и сравни с docs/moments/reference/<Имя>.png. Раскладка должна совпасть до пикселя (кроме места под статус-бар сверху).
4. prefers-reduced-motion — сразу финальное состояние; тёмная тема (data-theme="dark") читается; кнопки — <button>/<a>; у всплывающих фокус внутри, Esc закрывает; контраст текста 4.5:1.
5. Перед коммитом: npm run typecheck, npm run lint, npm test — всё зелёное. Отметь экран ✅ в таблице ROADMAP.md.
6. Один этап = одна ветка = один PR. В описание PR — картинки «макет слева, приложение справа» для каждого экрана.

Перед кодом прочитай AGENTS.md и нужные гайды Next.js в node_modules/next/dist/docs (это не тот Next.js, который ты знаешь).
Ответь, что прочитал ROADMAP.md и открыл папки mockups и reference, и жди следующий промпт.
```

---

## Промпт 1 — дневной XP, история дней, итог занятия

```
Этап 1 из docs/moments/ROADMAP.md.

Механика (миграция + src/lib + тесты):
- Таблица activity_days (user_id, day date, xp int, minutes int, lessons int, freeze_used bool, goal_met bool), RLS как у остальных таблиц пользователя.
- Цель дня в XP: profiles.daily_xp_goal (20/50/80/120 = 5/10/15/20 минут), по умолчанию 50. daily_word_goal не удалять.
- addXp (src/lib/xp-actions.ts) пишет XP и в activity_days за сегодня (UTC) и возвращает, что изменилось: цель выполнена впервые сегодня, новый уровень.
- Уровень — число из profiles.xp, чистая функция levelForXp + тесты; звания из src/lib/ranks.ts остаются подписью.
- Серверные действия повторения (src/app/(app)/brain/[deckId]/review/actions.ts) и чтения (src/app/read/[textId]/actions.ts) возвращают moments: Moment[]. Решает чистая функция collectMoments(before, after) с тестами.

Экраны (типы в src/lib/moments/types.ts, компоненты в src/components/product/moments/screens):
- Goal-done (уже свёрстан) — показывать по-настоящему после занятия, данные недели из activity_days.
- Streak-up (уже свёрстан) — при росте серии, неделя из activity_days.
- Perfect — занятие без ошибок.
- Level-up — новый уровень.
- Achievement — получено достижение из src/lib/achievements.ts.
- Word-mastered — карточка FSRS перешла в «знаю».
- Result — переделать src/app/(app)/brain/[deckId]/review/session-complete.tsx по Result.dc.html.
Порядок показа после занятия: Result → Perfect → Goal-done → Streak-up → Level-up/Achievement (очередь уже это умеет, задай приоритеты в MOMENT_PRIORITY).
Главный экран: плитка цели переходит со слов на XP (как на Main.png).
```

---

## Промпт 2 — стрик

```
Этап 2 из docs/moments/ROADMAP.md. Экраны: Streak-30, Perfect-week, Freeze-used, Earn-back, Streak-calendar, Today-evening.

- Streak-30: рубежи 7/14/30/50/100/365, награда за рубеж (+1 заморозка), экран с дождём конфетти как в макете.
- Freeze-used: touchStreak (src/lib/streak.ts) уже тратит заморозку — пусть возвращает событие, экран показывается при следующем входе.
- Perfect-week: 7 дней из 7 без заморозок, +20 XP один раз за неделю.
- Earn-back: миграция streak_repair_until, streak_before_break; серия прервалась → 3 дня подряд, и она возвращается. Экран при первом входе после обрыва. Тесты на все переходы.
- Streak-calendar: новая страница /streak (из чипа стрика на главной), месяц из activity_days, рекорд, заморозки, полоса до следующего рубежа.
- Today-evening: вечернее состояние главного экрана, когда сегодня ещё не занимался и серия под угрозой (после 18:00 по времени пользователя).
```

---

## Промпт 3 — внутри занятия

```
Этап 3 из docs/moments/ROADMAP.md. Экраны: Lesson-start, Combo, Halfway, Mistakes, Quit-confirm, Lesson-choice.

Встраивать в src/app/(app)/brain/[deckId]/review/review-session.tsx:
- Lesson-start — экран загрузки перед сессией: что внутри (новые, повтор, количество), шаги подготовки, кнопка «Поехали» после загрузки.
- Combo — 5 верных подряд: баннер, полоса прогресса становится оранжевой, +5 XP.
- Halfway — середина сессии.
- Mistakes — в конце повтор карточек с ошибками.
- Quit-confirm — нижняя шторка при закрытии сессии: прогресс-кольцо, что пропадёт.
- Lesson-choice — переверстать multiple-choice-mode.tsx по Lesson-choice.dc.html: прогресс, вопрос, варианты с номерами, баннер ответа снизу (верно/неверно) со звуком и вибрацией (src/lib/native.ts).
```

---

## Промпт 4 — чтение и «Мой английский»

```
Этап 4 из docs/moments/ROADMAP.md. Экраны: Reader, Chapter-done, Review-due, Twin-insight, Unit-done.

- Reader — переверстать читалку src/app/read/[textId] по Reader.dc.html: тап по слову, всплывающая карточка перевода, тост «слово сохранено».
- Chapter-done — дочитана глава/текст: статистика (слов прочитано, новых, понимание) и слова главы.
- Review-due — по FSRS считать, сколько карточек падает ниже 70% удержания; нижняя шторка с кривой памяти.
- Twin-insight — недельное обновление «Моего английского» (данные src/lib/language-twin): полосы навыков от прошлой отметки к новой, фокус недели.
- Unit-done — пройден раздел пути (src/lib/learning-paths).
```

---

## Промпт 5 — задания дня, сундук, двойной опыт

```
Этап 5 из docs/moments/ROADMAP.md. Экраны: Daily-quests, Chest, Double-XP.

- Миграция daily_quests: 3 задания на день (читать N минут, повторить N слов, N верных подряд), генерация в полночь по времени пользователя, прогресс из activity_days и сессий. Отдельно от недельных миссий. Тесты.
- Chest: награда за 3 выполненных задания: XP, +1 заморозка, ×2 на 15 минут. Открытие по нажатию: тряска, вспышка, монеты, счётчик — как в Chest.dc.html и reference/Chest--open.png.
- Double-XP: миграция profiles.xp_boost_until, множитель в addXp, живой таймер-кольцо на экране и чип на главной, пока буст активен.
```

---

## Промпт 6 — друзья и соревнование

```
Этап 6 из docs/moments/ROADMAP.md. Экраны: Duel-invite, Duel-won, Overtaken, Weekly-rank, Friend-streak.

- Дуэли уже есть (src/lib/duel.ts, /duel): Duel-invite — всплывающее приглашение с живым таймером, Duel-won — экран победы со столбиками счёта и короной.
- Недельный рейтинг уже есть (src/lib/leaderboard.ts): Overtaken — когда друг обошёл, Weekly-rank — итоги недели с пьедесталом в понедельник.
- Friend-streak: миграция friend_streaks (два пользователя, общая серия), экран, плюс карточка друга с кнопкой «Напомнить» в Streak-up (push через src/lib/push.ts).
```

---

## Промпт 7 — первый запуск и система

```
Этап 7 из docs/moments/ROADMAP.md. Экраны: Splash, Placement-result, Goal-pick, Streak-commit, First-text, Notify-ask, Welcome-back, Offline, Rate-app, Week-recap.

- Переделать онбординг (src/app/onboarding) по порядку: Splash → тест уровня → Placement-result → Goal-pick (цель в минутах = XP) → Streak-commit → First-text → читалка.
- Notify-ask: после первого занятия, выбор времени (profiles.preferred_notify_hour), запрос разрешения push.
- Welcome-back: 3+ дня без входа — мягкий старт.
- Offline: переделать src/app/offline по Offline.dc.html, кнопка «Проверить снова».
- Rate-app: только в нативной сборке, не чаще раза в 120 дней, после положительного момента; 4–5 звёзд — нативный запрос оценки, 1–3 — форма отзыва (feedback уже есть).
- Week-recap: истории по понедельникам, 4 слайда, автопереключение 5 с.
```

---

## Промпт 8 — основные экраны и собранное занятие

```
Этап 8 из docs/moments/ROADMAP.md. Экраны: Path, Progress, Lesson-build, Lesson-listen.

- Path — карта пути вместо списка в src/app/(app)/learning-paths по Path.dc.html: извилистая тропа, пройденные/текущий/закрытые узлы.
- Progress — переверстать src/app/(app)/progress по Progress.dc.html.
- Lesson-build («собери фразу из слов») и Lesson-listen («на слух», speechSynthesis/озвучка) — новые режимы упражнений из слов пользователя, рядом с существующими в brain/[deckId]/review. Генерация заданий — чистые функции с тестами.
- Нижняя вкладка «Учиться» ведёт на карту пути.
После этапа все 47 строк таблицы в ROADMAP.md должны быть ✅.
```
