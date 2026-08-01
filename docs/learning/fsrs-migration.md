# M2 Learning Upgrade — миграция SRS с SM-2 на ts-fsrs

Статус: реализовано на ветке `feature/fsrs-migration`, локально
проверено, **в production не применялось**. Требует отдельного
подтверждения перед прод-миграцией (см. `fsrs-rollout.md`).

## Старый алгоритм

`src/lib/srs.ts` — самописный SM-2-подобный планировщик, не удалён,
не изменён. Состояние: `{easeFactor, intervalDays, repetitions}`.
4-балльная шкала (0=не помню, 1=трудно, 2=помню, 3=легко). Параметры
настраиваются на пользователя через `srs_settings`
(`easy_bonus`, `interval_modifier`, `max_interval_days`,
`graduating_interval_days`, `easy_interval_days`, `starting_ease`).
Хранится в `srs_state.ease_factor` / `interval_days` / `repetitions` /
`due_at` / `last_reviewed_at`.

## Новый алгоритм

`src/lib/fsrs.ts` — адаптер поверх библиотеки `ts-fsrs@5.4.1` (MIT,
0 рантайм-зависимостей, `engines.node >= 20.0.0`, у нас v22.23.1).
Состояние: полноценный FSRS `Card` — `stability`, `difficulty`,
`state` (New/Learning/Review/Relearning), `reps`, `lapses`,
`scheduled_days`, `due`, `last_review`. UI-оценки 0-3 маппятся на
`ts-fsrs` `Rating` так:

```
UI 0 «Не помню» → Rating.Again (=1)
UI 1 «Трудно»   → Rating.Hard  (=2)
UI 2 «Помню»    → Rating.Good  (=3)
UI 3 «Легко»    → Rating.Easy  (=4)
```

**Важно:** в установленной версии (5.4.1) `Rating` начинается с
`Manual=0`, поэтому реальные значения — 1..4, не 0..3, как можно было
бы предположить по памяти о более старых версиях API. Значения
проверены напрямую в `node_modules/ts-fsrs/dist/index.d.ts` перед
использованием (Шаг 2 задания), не взяты из документации плана.

Параметры: `generatorParameters({ maximum_interval, enable_fuzz: true,
enable_short_term: false })`. `enable_short_term: false` отключает
внутридневные learning/relearning-шаги — сопоставимо со старым
алгоритмом, который тоже считает только целыми днями (см. комментарий
в `srs.ts`: «полноценные Anki-style learning steps не реализованы»).
Из `srs_settings` в FSRS переносится только `max_interval_days` —
единственный параметр с прямым смысловым эквивалентом
(`generatorParameters.maximum_interval`). Остальные SM-2-специфичные
настройки (`easy_bonus`, `interval_modifier`, `graduating_interval_days`,
`easy_interval_days`, `starting_ease`, `learning_steps_minutes`,
`relearning_steps_minutes`) не имеют аналога в модели FSRS и **не
влияют на расчёт**, когда `FSRS_ENABLED=true` — они остаются
действующими только для legacy-алгоритма (`FSRS_ENABLED=false`).
Экран Study Settings не менялся в этой фазе, эти поля в нём
продолжают отображаться и сохраняться, просто становятся неактивными
для планирования при включённом флаге.

## Миграция БД

`supabase/migrations/0032_fsrs_state.sql` — строго additive.

Новые колонки `srs_state`: `fsrs_stability numeric`,
`fsrs_difficulty numeric`, `fsrs_state smallint`,
`fsrs_lapses int not null default 0`, `fsrs_reps int not null default 0`,
`fsrs_scheduled_days numeric not null default 0`.

Новые колонки `review_log`: `scheduler_type text not null default 'sm2'
check (in ('sm2','fsrs'))`, `previous_state_json jsonb`,
`next_state_json jsonb`.

Не удалено и не переименовано: `ease_factor`, `interval_days`,
`repetitions`, `due_at`, `last_reviewed_at`, `first_reviewed_at`,
никакие таблицы. RLS не менялась (проверено — политики применяются к
строкам целиком, новые колонки автоматически под теми же политиками).

`due_at`/`last_reviewed_at` — общие для обоих алгоритмов колонки:
`due_at` — единственный источник для due-очереди
(`getDueCount`/`/brain/[deckId]/review`), какой бы алгоритм его ни
посчитал.

## Совместимость (compatibility)

- **Обе схемы состояния считаются на каждом ревью, независимо от
  флага.** `reviewWord` (`src/app/(app)/brain/[deckId]/review/actions.ts`)
  вызывает и `reviewSrsState()`, и `reviewFsrsCard()` при каждой
  оценке, пишет результаты обоих в одну строку `srs_state`. Только
  `due_at` берётся из того алгоритма, который сейчас авторитетен
  (`FSRS_ENABLED`).
- Существующие карточки (у которых `fsrs_stability is null`)
  автоматически стартуют с `createEmptyCard()` при первом ревью под
  любым режимом — не требуют отдельного бэкфилла бизнес-логики,
  только структурного (колонки с безопасными дефолтами добавлены
  миграцией).
- `first_reviewed_at`-логика (различение «новая карточка» / «на
  повторение», используемая `new_cards_per_day` лимитом) не
  изменилась — не привязана ни к одному из алгоритмов.
- Все 4 режима повторения (`review-session.tsx`, `multiple-choice-mode.tsx`,
  `type-word-mode.tsx`, `match-pairs-mode.tsx`) вызывают один и тот же
  `reviewWord()` — изменение затронуло все 4 одинаково, без
  дублирования логики по режимам.
- Предпросмотр интервала на кнопках оценки (`review-session.tsx`)
  переключается на тот же `reviewFsrsCard()`, что и реальное
  сохранение — не отдельная копия формулы (см. `fsrs-rollout.md`,
  раздел про Шаг 6).

## Что НЕ входит в эту фазу

Language Twin, Missions, Voice, AI Platform, редизайн UI, Stripe,
замена PostHog, миграция auth, content service, мобильное приложение —
ничего из этого не затронуто, как и требовалось.
