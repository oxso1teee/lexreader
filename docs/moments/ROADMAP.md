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

### Этап 1. Итог занятия и XP (логика есть) — [ ]
Perfect, Goal-done, Level-up, Achievement (4 текущих достижения из
`achievements.ts`), Word-mastered (FSRS: карточка ушла в «знаю»).
Цепляется к `brain/[deckId]/review` и `session-complete.tsx`.

### Этап 2. Стрик (логика есть частично) — [ ]
Streak-up, Streak-30 (рубежи 7/14/30/50/100), Freeze-used (уже тратится в
`touchStreak` — надо вернуть событие), Perfect-week, Streak-calendar
(страница: нужна история дней — таблица `activity_days`).
Новое: Earn-back — восстановление серии за 3 дня подряд (миграция:
`streak_repair_until`, `streak_before_break`).

### Этап 3. Внутри занятия — [ ]
Lesson-start, Combo, Halfway, Mistakes, Quit-confirm, Result. Сначала
поверх текущего повторения карточек. Собранное занятие из макетов
(Lesson-choice / Lesson-build / Lesson-listen: выбор перевода, собрать
фразу, на слух) — отдельный движок упражнений, этап 8.

### Этап 4. Чтение и слова — [ ]
Chapter-done (чтение `read/[textId]`), Review-due (FSRS: сколько карточек
падает ниже порога), Twin-insight («Мой английский», данные уже есть).

### Этап 5. Задания дня и награды (новая механика) — [ ]
Daily-quests (3 задания дня — отдельно от недельных миссий; миграция
`daily_quests`), Chest (награда за 3 задания: XP, заморозка, ×2),
Double-XP (миграция `xp_boost_until`, множитель в `addXp`).

### Этап 6. Друзья и соревнование — [ ]
Duel-invite, Duel-won (дуэли есть: `duel.ts`), Overtaken, Weekly-rank
(недельный рейтинг есть: `leaderboard.ts`), Friend-streak (новая
механика: общая серия двух друзей, миграция `friend_streaks`).

### Этап 7. Первый запуск и система — [ ]
Splash (нативный сплэш + веб-экран), Placement-result (поверх
`onboarding/result`), Goal-pick, Streak-commit, First-text (переделка
`onboarding-wizard.tsx`), Notify-ask (push есть: `push.ts`,
`notify_hour`), Welcome-back (≥3 дня без входа), Offline (`/offline`),
Rate-app, Week-recap (истории, по понедельникам).

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
| Main | 🟡 | `/home` — старая раскладка |
| Today-evening | ❌ | вечернее состояние `/home` |
| Path | 🟡 | `/learning-paths` — список, не карта |
| Reader | 🟡 | `/read/[textId]` — без тоста «слово сохранено» из макета |
| Progress | 🟡 | `/progress` — старая раскладка |
| Result | 🟡 | `review/session-complete.tsx` — другой вид |
| Lesson-choice | 🟡 | `review/multiple-choice-mode.tsx` — другой вид |
| Lesson-build | ❌ | режима «собери фразу» нет |
| Lesson-listen | ❌ | режима «на слух» нет |
| Placement-result | 🟡 | `/onboarding/result` — другой вид |
| Goal-pick | 🟡 | шаг `onboarding-wizard.tsx`, цель в словах |
| Streak-commit | ❌ | |
| First-text | ❌ | |
| Splash | 🟡 | нативный сплэш Capacitor, веб-заставки нет |
| Offline | 🟡 | `/offline` — другой вид |
| Weekly-rank | 🟡 | `/leaderboard` — страница, не момент итогов |
| Duel-invite | 🟡 | `/duel` — страница, не всплывающее окно |
| Duel-won | 🟡 | `duel-room.tsx` — без экрана победы |
| Twin-insight | 🟡 | `/language-twin` — страница, не момент |
| Achievement | 🟡 | `progress/achievements-shelf.tsx` — полка, без экрана получения |
| Notify-ask | 🟡 | время напоминания в настройках, без экрана-просьбы |
| Lesson-start, Combo, Halfway, Mistakes, Quit-confirm, Perfect | ❌ | этап 3 |
| Unit-done, Level-up, Word-mastered, Chapter-done, Review-due | ❌ | этапы 1 и 4 |
| Streak-30, Perfect-week, Freeze-used, Earn-back, Streak-calendar, Friend-streak | ❌ | этап 2 (Friend-streak — этап 6) |
| Daily-quests, Chest, Double-XP | ❌ | этап 5, новая механика |
| Overtaken, Welcome-back, Rate-app, Week-recap | ❌ | этапы 6–7 |

Итого: ✅ 2 · 🟡 19 · ❌ 26.

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
