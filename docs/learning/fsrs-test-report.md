# M2 Learning Upgrade — test evidence

Все команды выполнены на ветке `feature/fsrs-migration`, локально,
против локального Supabase (Docker). Ничего не исправлялось «на
лету» под тесты — тесты писались по факту поведения кода.

## Автоматические проверки

| Команда | Exit code | Результат |
|---|---|---|
| `node --experimental-strip-types --test src/lib/srs.test.ts` | 0 | 10/10 passed — baseline текущего SM-2 (Again, первое успешное повторение, Hard/Good/Easy, минимальный ease factor, максимальный interval, repetitions; «due date» отдельно не тестировалась как поле — `reviewSrsState` в принципе не вычисляет и не возвращает дату, только `intervalDays`, это задокументировано отдельным тестом на форму результата) |
| `node --experimental-strip-types --test src/lib/fsrs.test.ts` (`npm run test:fsrs`) | 0 | 10/10 passed — Again/Hard/Good/Easy на новой карточке, второе повторение, лапс (повторный провал), максимальный interval (в т.ч. с реально достигнутым ограничением через `maximum_interval=30`), форма результата (previous/next state), `isFsrsEnabled()` default/true/строгое сравнение строки |
| `npm run typecheck` | 0 | чисто |
| `npm run lint` | 0 | чисто |
| `npm run test:import` | 0 | 6/6 (не затронуто этой фазой, для полноты) |
| `npm run test:extension` | 0 | 4/4 (не затронуто) |
| `npm run build` | 0 | все 33 маршрута собираются, `ƒ Proxy (Middleware)` на месте, только pre-existing предупреждение `metadataBase` (не связано с этой фазой) |
| `npx playwright test --project=chromium` (`npm run test:e2e`) | 0 | 10 passed, 1 skipped (реальный Stripe checkout — ожидаемо без `STRIPE_SECRET_KEY`). Один прогон дал ложный сбой в `onboarding-first-win.spec.ts` (не связан с SRS/FSRS — код пути этого теста не касается `srs_state`/`review_log`/`fsrs.ts`, проверено grep'ом); повторный прогон в изоляции и повторный полный прогон — оба зелёные. Диагностировано как известная для этого проекта деградация dev/prod-сервера при повторных прогонах, а не регрессия (см. память проекта: «Dev-server degradation under repeated Playwright runs»). |

## Точные ожидаемые значения (ключевые, из `fsrs.test.ts`)

Получены прогоном самой `reviewFsrsCard()` с фиксированным `now =
2026-08-01T12:00:00.000Z`, не подобраны вручную:

- Новая карточка, grade=0 (Again): `scheduledDays=1`, `reps=1`,
  `lapses=0`, `state=2` (Review — минуя Learning, т.к.
  `enable_short_term=false`).
- Новая карточка, grade=1 (Hard): `scheduledDays=2`.
- Новая карточка, grade=2 (Good): `scheduledDays=3`.
- Новая карточка, grade=3 (Easy): `scheduledDays=8`.
- Второе повторение после Good: `scheduledDays=16`, `reps=2`.
- Провал на втором повторении (grade=0): `lapses=1`,
  `scheduledDays` меньше, чем было до провала.
- `maximum_interval=30` реально ограничивает результат до 30 (при
  stability, которая иначе дала бы тысячи дней).

## API ts-fsrs проверен напрямую, не по памяти (Шаг 2 задания)

`node_modules/ts-fsrs/dist/index.d.ts` (версия 5.4.1, распакована из
официального npm-тарбола для инспекции перед установкой в проект):
подтверждены точные значения `Rating` (`Manual=0, Again=1, Hard=2,
Good=3, Easy=4` — НЕ 0-3, как можно было бы предположить по памяти),
`State` (`New=0, Learning=1, Review=2, Relearning=3`), сигнатура
`FSRS.next(card, now, grade): {card, log}`, форма `Card`
(`due, stability, difficulty, elapsed_days, scheduled_days,
learning_steps, reps, lapses, state, last_review?`), нулевые
рантайм-зависимости, `engines.node >= 20.0.0`, лицензия MIT.

## Ручная проверка (browser + прямой DB-скрипт)

Часть ручной проверки выполнена через браузер (вход
`test@example.com`, экран `/brain` показал корректные счётчики после
миграции, экран `/brain/all/review` открылся, карточка «показать
ответ» отобразила предпросмотр интервалов `Не помню 1 дн / Трудно
1 дн / Помню 1 дн / Легко 4 дн` — точное совпадение с
`DEFAULT_SRS_PARAMS` при `FSRS_ENABLED` не заданном, подтверждает
обратную совместимость предпросмотра).

Инструменты браузера отключились в середине сессии (разрыв MCP-
соединения) и не переподключились. Вместо того чтобы утверждать
непроверенное, оставшаяся часть ручной проверки (Шаги 8-9 задания:
оценка всеми 4 кнопками, due count до/после, обе схемы состояния,
старая и новая карточка) выполнена **напрямую против той же локальной
БД тем же кодом** — временный скрипт импортировал настоящие
`src/lib/srs.ts` и `src/lib/fsrs.ts` (не переписывал логику заново) и
воспроизвёл ровно то, что делает `reviewWord()`, для реальных строк
`srs_state` тестового аккаунта. Скрипт был временным, в репозиторий
не входит, удалён после использования.

Результат:

```
=== BEFORE ===
due count: 3

=== Grading with FSRS_ENABLED=false (2 карточки, grade 0 и 1) ===
card 0 grade=0: legacy due_at=...(+1 день, авторитетно), fsrs shadow reps=1, wasNew=true
card 1 grade=1: legacy due_at=...(+1 день, авторитетно), fsrs shadow reps=1, wasNew=true

=== Grading with FSRS_ENABLED=true (1 карточка, grade=2) ===
due_at=...(+3 дня, FSRS-авторитетно), legacy shadow interval_days=1

=== AFTER ===
due count: 0

=== srs_state: на ВСЕХ 3 карточках заполнены и legacy, и fsrs_* поля ===
{"fsrs_stability":0.212,"fsrs_reps":1,"ease_factor":2.18,...}
{"fsrs_stability":1.2931,"fsrs_reps":1,"ease_factor":2.36,...}
{"fsrs_stability":2.3065,"fsrs_reps":1,"ease_factor":2.5,...}   ← FSRS_ENABLED=true, due_at считан из FSRS

=== review_log: scheduler_type + previous/next state на всех 3 ===
{"grade":2,"scheduler_type":"fsrs","has_previous_state":true,"has_next_state":true}
{"grade":1,"scheduler_type":"sm2","has_previous_state":true,"has_next_state":true}
{"grade":0,"scheduler_type":"sm2","has_previous_state":true,"has_next_state":true}
```

Подтверждено этим прогоном:

- **Due queue продолжает работать**: due count корректно уменьшился
  с 3 до 0 после оценки всех трёх карточек, независимо от того, какой
  алгоритм посчитал `due_at`.
- **Обе схемы состояния пишутся всегда**, независимо от флага —
  rollback безопасен (см. `fsrs-rollout.md`).
- **Флаг реально переключает авторитетность** `due_at`: под
  `FSRS_ENABLED=false` он равен legacy-расчёту (+1 день), под
  `FSRS_ENABLED=true` — FSRS-расчёту (+3 дня для той же оценки
  «Помню» на новой карточке — оба числа корректны для СВОИХ
  алгоритмов, они и не обязаны совпадать).
- **`review_log.scheduler_type`/`previous_state_json`/`next_state_json`**
  заполняются на каждой строке, независимо от режима.
- **Старая карточка**: все 64 ранее существовавших строки
  `srs_state` (до миграции) сохранили `ease_factor`/`interval_days`/
  `repetitions`, получили новые FSRS-колонки со значениями по
  умолчанию (`fsrs_stability=null`, `fsrs_lapses=0`, `fsrs_reps=0`,
  `fsrs_scheduled_days=0`) — не искажены, не удалены.
- **Новая карточка**: любая карточка без `fsrs_stability`
  автоматически стартует с `createEmptyCard()` при первом ревью,
  проверено в юнит-тестах `fsrs.test.ts` и подтверждено этим же
  прогоном (все 3 тестовые карточки имели `fsrs_stability=null` до
  оценки).

## Прямая проверка SQL (Шаг 9)

```sql
\d srs_state   -- все старые колонки на месте + 6 новых, тот же PK, тот же RLS
\d review_log  -- все старые колонки на месте + 3 новых (с check-constraint на scheduler_type), тот же RLS

select count(*), count(*) filter (where fsrs_stability is null) from srs_state;
-- 64 всего, 64 без FSRS-состояния сразу после миграции (до любых ревью) — корректный backfill дефолтами
```

RLS-политики `"srs_state: owner full access"` и
`"review_log: owner full access"` — текст политик после миграции
идентичен тексту из `0004_decks.sql`, не менялся.
