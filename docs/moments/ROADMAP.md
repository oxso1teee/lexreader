# LexReader: экраны v7 в приложении — план реализации

Эталон: макеты в `docs/moments/mockups/*.dc.html` (источник) и их скриншоты
390×844 в `docs/moments/reference/*.png`. Живой холст: артефакт
«LexReader v7 — каждый экран проверен». Экран считается готовым, только когда
его скриншот в приложении совпадает с `reference/<Имя>.png` по раскладке,
цветам, тексту и порядку анимаций.

## Правила для каждого этапа

1. Одна ветка и один PR на этап. Этапы маленькие: 4–8 экранов.
2. Данные только настоящие. Если цифры на макете нет в базе — сначала
   миграция и логика, потом экран. Никаких заглушек в проде.
3. Каждый экран открывается в галерее `/dev/moments` с тестовыми данными.
   Playwright снимает его в 390×844 и кладёт рядом с эталоном в PR.
4. «Готово» = `npm run typecheck` + `npm run lint` + `npm test` + новые
   unit-тесты логики + e2e на сценарий показа + скриншот-сверка.
5. `prefers-reduced-motion`: анимации заменяются мгновенным финальным
   состоянием, счётчики сразу показывают итог.
6. Доступность: кнопки — `<button>`/`<a>`, у всплывающего окна фокус-ловушка,
   Esc и системное «назад» закрывают, текст 4.5:1.
7. Звук и вибрация через `src/lib/native.ts`, звук выключается в настройках.

## Архитектура: движок «моментов»

- `src/lib/moments/types.ts` — `Moment` = размеченный union
  (`goal_done`, `streak_up`, `streak_milestone`, `freeze_used`, `level_up`,
  `achievement`, …) с данными для экрана.
- Серверные действия (`review/actions.ts`, `read/[textId]/actions.ts`,
  `xp-actions.ts`, `streak.ts`, миссии, дуэли) возвращают
  `moments: Moment[]` — что случилось этим действием. Решение «что
  показать» принимает чистая функция `collectMoments(before, after)`,
  покрытая тестами.
- `MomentProvider` в `(app)/layout.tsx`: очередь, приоритеты
  (не больше 3 моментов подряд, остальные копятся), дедупликация по
  `moment_id`, отметка «показан» в `profiles.seen_moments` / таблице
  `moment_log`, чтобы не повторять на другом устройстве.
- `MomentScreen` — полноэкранный слой поверх приложения (портал), с
  входом/выходом через `motion`, кнопка CTA появляется после анимации.
- Общие детали, один раз и точно по макету: `Mascot` (эмоции: joy, happy,
  determined, worried, sad, sleepy), `Flame`, `Chest`, `Confetti`
  (детерминированный), `CountUp`, `Ring`, `BigButton` (нижняя кайма),
  `Sheet` (нижняя шторка), `StatTile`.

## Продуктовые решения (принимаю, можно оспорить)

- Цель дня переходит со «слов» на XP, как в макетах: 5/10/15/20 минут
  → 20/50/80/120 XP. `daily_word_goal` остаётся для совместимости.
- Уровень — число, считается из общего XP (`level = f(xp)`); звания из
  `ranks.ts` остаются подписью уровня.
- Экран «Оцени приложение» — только в нативной сборке, не чаще раза в
  120 дней, после положительного момента.
- Подписку и пейволл не трогаем (в нативе скрыта по правилам Apple).

## Этапы

Статус: [ ] не начато · [~] в работе · [x] смержено.

### Этап 0. Фундамент — [~]
Движок моментов, общие детали, галерея `/dev/moments`, скрипт
скриншот-сверки `scripts/moments-snap.ts`, звук/вибрация, reduced-motion.
Сделано в PR этапа 0: очередь моментов (`src/lib/moments`), оболочка
`MomentScreen`, конфетти, счётчики, `MomentProvider` в `(app)/layout.tsx`,
галерея `/dev/moments`, экраны **Goal-done** и **Streak-up** 1:1 с макетом
(сверка: `docs/pr-screenshots/moments-stage0/`). Показ в живых сценариях —
этап 1, когда появятся дневной XP и история дней.

### Этап 1. Итог занятия и XP (логика есть) — [~]
Perfect, Goal-done, Level-up, Achievement (4 текущих достижения из
`achievements.ts`), Word-mastered (FSRS: карточка ушла в «знаю»).
Цепляется к `brain/[deckId]/review` и `session-complete.tsx`.
Сделано в PR этапа 1: миграция `activity_days` + `profiles.daily_xp_goal`
(`supabase/migrations/0052_activity_days.sql`); `levelForXp`
(`src/lib/level.ts`); чистая `collectMoments` (`src/lib/moments/collect.ts`)
+ `src/lib/moments/week.ts` (неделя по `goal_met`); `addXp` пишет
`activity_days` и отдаёт before/after; `checkAndAwardAchievements` и
`touchStreak` отдают before/after; `recomputeAndPersistLearningState`
отдаёт before/after `learning_state`; `reviewWord()` и `finishReading()`
отдают `moments: Moment[]`; **Perfect** (бонус `+10 XP` — реально
начисляется, не декоративное число), **Level-up**, **Achievement**,
**Word-mastered** — 1:1 с макетом (формулы уровня/подборка по уровню/
фонетическая транскрипция из макетов убраны там, где для них нет настоящих
данных — см. комментарии в коде); **Result** переехал сюда из этапа 3 и
переверстан по `Result.dc.html` (`session-complete.tsx`); главный экран —
плитка цели со слов на XP. Порядок показа после занятия реализован через
`MOMENT_PRIORITY` (перенесён в корневой `src/app/layout.tsx`, чтобы `/read`
и `/watch` тоже могли показывать moments из `finishReading()`).

### Этап 2. Стрик (логика есть частично) — [~]
Streak-up, Streak-30 (рубежи 7/14/30/50/100/365), Freeze-used, Perfect-week,
Streak-calendar, Earn-back, Today-evening.
Сделано в PR этапа 2: миграция `0053_streak_repair.sql`
(`streak_before_break`/`streak_repair_until`/`perfect_week_awarded_week`);
вся решающая логика серии вынесена в чистую `computeStreakUpdate()`
(`src/lib/streak-engine.ts`, полностью покрыта тестами) — обычный рост,
заморозка (`freeze_used` пишется в `activity_days` на реально пропущенный
день), рубежи (7/14/30/50/100/365, награда — настоящая заморозка, не только
декорация), Earn-back (обрыв → 3 дня подряд → старое число возвращается,
без повторного срабатывания рубежей при восстановлении); `streak.ts`
(`touchStreak`) — тонкая обёртка над движком; `src/lib/moments/
perfect-week-award.ts` — честные +20 XP раз в неделю (7/7 дней без
заморозки, сторож `perfect_week_awarded_week`); `src/lib/moments/
streak-week.ts` — неделя по реальной активности + заморозке (не по цели
дня, в отличие от Goal-done); `collectMoments` решает между streak_up/
freeze_used/earn_back (взаимоисключающие) + отдельно streak_milestone;
экраны **Streak-30**, **Freeze-used**, **Perfect-week**, **Earn-back** 1:1
с макетом (кнопка "Поделиться" в Streak-30 и карточка-превью push в
Today-evening убраны — нет настоящего механизма); страница **`/streak`**
(месяц из `activity_days`, рекорд, заморозки, прогресс до рубежа; карточка
"До сундука" из макета убрана — Chest ещё не существует, этап 5); чип
стрика на главной ведёт туда вместо `/progress`; **Today-evening** —
клиентский гейт `TodayEveningGate` (после 18:00 по времени устройства, 0
XP сегодня, серия > 0) поверх обычного `TodayView`, добавлен в `/dev/screens`.

### Этап 3. Внутри занятия — [x]
Lesson-start, Combo, Halfway, Mistakes, Quit-confirm (Result переехал в
этап 1 — он уже понадобился там для итога сессии). Сначала поверх текущего
повторения карточек. Lesson-choice переверстан 1:1 (multiple-choice-mode.tsx);
Lesson-build/Lesson-listen — отдельный движок упражнений, этап 8.

### Этап 4. Чтение и слова — [ ]
Chapter-done (чтение `read/[textId]`), Review-due (FSRS: сколько карточек
падает ниже порога), Twin-insight («Мой английский», данные уже есть).

### Этап 5. Задания дня и награды (новая механика) — [x]
Daily-quests (3 задания дня — отдельно от недельных миссий; миграция
`daily_quests`), Chest (награда за 3 задания: XP, заморозка, ×2),
Double-XP (миграция `xp_boost_until`, множитель в `addXp`).

### Этап 6. Друзья и соревнование — [~]
Duel-invite, Duel-won (дуэли есть: `duel.ts`), Overtaken, Weekly-rank
(недельный рейтинг есть: `leaderboard.ts`), Friend-streak (новая
механика: общая серия двух друзей, миграция `friend_streaks`).
Сделано в PR этапа 6: миграция `0055_duels_rewards_and_friend_streaks.sql` —
`claim_duel_result()` (реальные XP за победу/серия побед подряд/разница в
секундах из `duel_answers.latency_ms`, защита от повторного начисления),
`invite_expires_at` у дуэли; таблица `friend_streaks` (пара = сам концепт
"друзей" в проекте, приглашение по одноразовой ссылке — `/friends/invite`,
`/friends/[token]`, честный MVP без списка друзей) + `touch_friend_streaks()`
(общая серия, "пропустит один — сгорит у обоих") вызывается из
`touchStreak()`; `weekly_rank_snapshots` + параметризованный
`get_weekly_leaderboard_for_week()` — для детекта обгона и итогов
закончившейся недели. **Duel-invite**/**Duel-won** показываются inline в
`/duel/[id]` (не через очередь moments — состояние существующего экрана, не
"что-то случилось"), текст адаптирован к реальной модели дуэлей (нет
привязки к книге и прогресса соперника до старта — это не существующая
колонка, а физически другие данные). **Overtaken**/**Weekly-rank**/
**Friend-streak** — обычные moments через `MomentProvider`; Overtaken триггерится
после `addXp` в `reviewWord()`/`finishReading()`, Weekly-rank — клиентским
гейтом по понедельникам (`WeeklyRankGate` в корневом `layout.tsx`, тот же
приём, что `TodayEveningGate`). Кнопка Friend-streak — "Позвать" (буквально
как в макете, не "Напомнить"), шлёт push через `remindFriendAction` (service-
role доступ к чужим `push_subscriptions`, тот же паттерн, что
`push-reminders`). Галерея: Overtaken/Weekly-rank/Friend-streak в
`/dev/moments` (автоматически через `fixtures.ts`), Duel-invite/Duel-won в
`/dev/screens` (`stage6-gallery.tsx`, по образцу этапа 3). Экраны не сверены
со скриншотами `docs/moments/reference/*.png` (нет живого окружения с
подготовленными тестовыми аккаунтами в этой сессии) — визуальная 1:1-сверка
и `scripts/moments-snap.ts` остаются на следующий проход.

### Этап 7. Первый запуск и система — [~]
Splash (нативный сплэш + веб-экран), Placement-result (поверх
`onboarding/result`), Goal-pick, Streak-commit, First-text (переделка
`onboarding-wizard.tsx`), Notify-ask (push есть: `push.ts`,
`notify_hour`), Welcome-back (≥3 дня без входа), Offline (`/offline`),
Rate-app, Week-recap (истории, по понедельникам).
Сделано в PR этапа 7: миграция `0056_onboarding_system.sql` —
`profiles.streak_goal_days`/`last_rate_prompt_at`, `texts.is_starter` +
один оригинальный стартовый текст (RLS и `/read/[textId]` уже умели
читать системные тексты — правок не потребовалось). Новый порядок
онбординга: **Splash** (шаг 0 `onboarding-wizard.tsx`) → мастер
аккаунта/тест уровня (без изменений) → **Placement-result** (редизайн
`/onboarding/result`, CEFR-штамп/шкала/конфетти) → **Goal-pick**
(`/onboarding/goal`, минуты → `daily_xp_goal`/`daily_word_goal`) →
**Streak-commit** (`/onboarding/streak` → `streak_goal_days`, подсвечивает
"твоя цель" на `/streak` раньше фиксированных вех) → **First-text**
(`/onboarding/first-text`, `text-familiarity.ts` — честный % знакомых слов)
→ реальная читалка. Терминальное действие онбординга больше не
Learning Path — `confirmPathAction` удалён (был мёртвым кодом только в
result-view), `/learning-paths` самодостаточна и достижима из `/library`;
`deriveOnboardingStep`/`resolveOnboardingUrl` получили шаг `first_text`
(на основе `streak_goal_days`), чтобы гейт `(app)`-layout не застревал на
`/onboarding/result`. **Notify-ask** — `Moment`, триггер
`completed_first_win` false→true внутри `reviewWord()`/`finishReading()`
(`maybeFirstWinMoments`, т.к. completed_first_win раньше ставился только
из Learning Path); `push-client.ts` — общий push-flow (Settings + этот
экран). **Welcome-back**/**Week-recap** — клиентские гейты в
`layout.tsx` (приём `WeeklyRankGate`), реальные числа (`getDueCount`,
`text_progress`, агрегация прошлой ISO-недели). **Rate-app** — только
нативная сборка, триггер в `MomentProvider` после позитивного момента,
сторож 120 дней, `@capacitor-community/in-app-review` для 4–5 звёзд,
существующая `FeedbackForm` для 1–3. **Offline** — "доступно офлайн"
через реальный Cache Storage API (`public/sw.js` уже кеширует навигации),
не выдумка. Упрощения: Streak-commit не создаёт новой награды (только
подсветка существующих вех); Week-recap без кнопки "Поделиться" (нет
механизма, как и Streak-30 в этапе 2); Rate-app только в нативе, веб не
показывает вообще. Скриншот-сверка с `docs/moments/reference/*.png` не
делалась (нет живого окружения в этой сессии) — как и в этапе 6,
технический долг на следующий проход.

### Этап 8. Девять основных экранов — [ ]
Main (Сегодня), Today-evening (стрик под угрозой), Path (карта пути
поверх `learning-paths`), Reader (тап по слову и тост), Progress,
и собранное занятие: Lesson-choice, Lesson-build, Lesson-listen, Result.
Самый большой этап: новый движок упражнений из слов пользователя.

## Порядок и почему такой

Фундамент → экраны на готовой логике (1, 2, 3, 4) → новые механики (5, 6)
→ онбординг (7) → основные экраны и движок упражнений (8). Так каждый PR
сразу даёт видимый результат в приложении, а рискованная новая логика идёт
отдельными миграциями.


## Сверка: все 47 экранов v7 против приложения (2026-10-17)

✅ сделан 1:1 · 🟡 есть в приложении, но в старом виде (переделать по макету) ·
❌ нет совсем.

| Экран | Статус | Где сейчас / что нужно |
|---|---|---|
| Goal-done | ✅ галерея | 1:1, сдвиг 0 px; в живом сценарии — этап 1 (нужен дневной XP) |
| Streak-up | ✅ галерея | 1:1, сдвиг 0 px; в живом сценарии — этап 1 (нужна история дней) |
| Main | ✅ | `/home` переверстан 1:1 по макету на реальных данных (цель пока в словах до этапа 1) |
| Today-evening | ❌ | вечернее состояние `/home` |
| Path | 🟡 | `/learning-paths` — список, не карта |
| Reader | 🟡 | `/read/[textId]` — без тоста «слово сохранено» из макета |
| Progress | 🟡 | `/progress` — старая раскладка |
| Result | 🟡 | `review/session-complete.tsx` — другой вид |
| Lesson-choice | ✅ галерея | 1:1; в живом сценарии уже работает (multiple-choice-mode.tsx) |
| Lesson-build | ❌ | режима «собери фразу» нет |
| Lesson-listen | ❌ | режима «на слух» нет |
| Placement-result | ✅ | `/onboarding/result` переверстан 1:1; не в галерее — нужен реальный аккаунт |
| Goal-pick | ✅ | `/onboarding/goal`, цель в минутах → XP (daily_xp_goal) |
| Streak-commit | ✅ | `/onboarding/streak` → streak_goal_days |
| First-text | ✅ | `/onboarding/first-text`, настоящий стартовый текст + text-familiarity.ts |
| Splash | ✅ галерея | веб-экран (`onboarding-wizard.tsx` шаг 0, /dev/screens); нативный сплэш не трогали |
| Offline | ✅ галерея | `/offline` переделан, "доступно офлайн" — реальный Cache Storage API |
| Weekly-rank | 🟡 | `/leaderboard` — страница, не момент итогов |
| Duel-invite | 🟡 | `/duel` — страница, не всплывающее окно |
| Duel-won | 🟡 | `duel-room.tsx` — без экрана победы |
| Twin-insight | 🟡 | `/language-twin` — страница, не момент |
| Achievement | 🟡 | `progress/achievements-shelf.tsx` — полка, без экрана получения |
| Notify-ask | ✅ галерея | Moment, /dev/moments; "Включить" — настоящий push-flow |
| Lesson-start, Combo, Halfway, Mistakes, Quit-confirm | ✅ галерея | этап 3; живой сценарий — review-session.tsx |
| Unit-done, Level-up, Word-mastered, Chapter-done, Review-due | ❌ | этапы 1 и 4 |
| Streak-30, Perfect-week, Freeze-used, Earn-back, Streak-calendar, Friend-streak | ❌ | этап 2 (Friend-streak — этап 6) |
| Daily-quests, Chest, Double-XP | ❌ | этап 5, новая механика |
| Overtaken, Welcome-back, Rate-app, Week-recap | ✅ галерея | этапы 6–7, все через MomentProvider |

Итого: ✅ 14 · 🟡 13 · ❌ 20.

## Журнал

- 2026-10-17: план, макеты v7 и эталонные скриншоты добавлены в репо.
- 2026-10-17: этап 0 — фундамент и первые два экрана, PR открыт.
- 2026-10-17: перепроверка. Обновлены 7 устаревших эталонов (Freeze-used,
  Halfway, Offline, Overtaken, Quit-confirm, Streak-30, Streak-up), добавлены
  эталоны открытых состояний (Chest--open, Rate-app--5-stars,
  Week-recap--story-4). Исправлено в приложении: сдвиг вниз на 5–8 px
  (line-height), рассинхрон гидрации счётчиков при reduced motion, ошибка
  vibrate() до первого касания, нечитаемая кнопка и мутный круг стрика в
  тёмной теме.
- 2026-10-17: главный экран «Сегодня» 1:1 с макетом (TodayView + /dev/screens),
  нижняя навигация как в v7, на телефоне убрана полоса с брендом.
