# FSRS Schema Compatibility Hotfix

Статус: код готов, протестирован локально (включая реальную pre-0032
схему), **не задеплоен в production, migration 0032 не применена,
оба флага выключены**. Draft PR, не смёржен.

## Root cause

`feature/fsrs-migration` (PR #1) было спроектировано так, чтобы
"безопасно" деплоиться отдельно от применения `migration 0032` — сперва
код с `FSRS_ENABLED=false`, потом миграция. Но сам дизайн "считать FSRS
в тени на каждом ревью независимо от флага" означал, что
`reviewWord()`/страница ревью **безусловно** обращались к колонкам,
которых миграция ещё не создала:

- `srs_state`: `fsrs_stability`, `fsrs_difficulty`, `fsrs_state`,
  `fsrs_lapses`, `fsrs_reps`, `fsrs_scheduled_days`;
- `review_log`: `scheduler_type`, `previous_state_json`,
  `next_state_json`.

PostgREST (REST-слой Supabase, через который работает
`@supabase/supabase-js`) отклоняет **весь** запрос при обращении к
несуществующей колонке (`42703 undefined_column`), а не игнорирует её.
Первый деплой PR #1 в production (без применённой миграции) сломал бы
и загрузку страницы ревью, и сохранение оценки для реальных
пользователей — инцидент пойман до массового ущерба и деплой
немедленно откачен (см. `fsrs-production-rollout-phase-1.md`).

Точечный fix (`fix/fsrs-column-fallback`, error-driven —
`isMissingFsrsColumnsError` перехватывал 42703 и откатывался на
легаси-select) устранил симптом, но не убирал саму попытку обратиться
к несуществующим колонкам — эта фаза (`fix/fsrs-schema-compatibility`)
заменяет его на модель, которая **решает заранее**, не полагаясь на
перехват ошибки как единственную защиту.

## Модель двух флагов

`src/lib/fsrs-flags.ts` — единственное место, где комбинируются оба
флага:

```ts
export interface FsrsFlags {
  schemaReady: boolean;   // FSRS_SCHEMA_READY === "true"
  enabled: boolean;       // schemaReady && FSRS_ENABLED === "true"
  shadowEnabled: boolean; // === schemaReady
}
```

| `FSRS_SCHEMA_READY` | `FSRS_ENABLED` | `schemaReady` | `enabled` | `shadowEnabled` | Поведение |
|---|---|---|---|---|---|
| не задан/false | не задан/false | false | false | false | Только легаси-колонки, только SM-2. Работает против БД без migration 0032. |
| не задан/false | **true** | false | **false** | false | Опасная конфигурация автоматически обезврежена: `enabled` всё равно `false`, легаси остаётся авторитетным. В лог — диагностическое предупреждение без приватных данных. |
| true | не задан/false | true | false | true | Shadow mode: FSRS считается и пишется, `due_at` остаётся legacy. |
| true | true | true | true | true | FSRS полностью авторитетен. |

Правило `enabled = schemaReady && FSRS_ENABLED === "true"` закрывает
именно тот случай, который привёл к инциденту: включить `FSRS_ENABLED`
раньше миграции больше физически не может привести к обращению к
несуществующим колонкам, потому что `shadowEnabled` (который решает,
включать ли `fsrs_*`-поля в запрос) зависит только от `schemaReady`.

## Все обращения к FSRS-колонкам и их защита

`grep -RIn -E "fsrs_|scheduler_type|previous_state_json|next_state_json" src`
(исключая `node_modules`/`.next`) — все обращения, кроме docstring-
комментариев в `src/lib/fsrs.ts`, находятся ровно в двух файлах:

### `src/app/(app)/brain/[deckId]/review/page.tsx`

Два запроса (карточки на повторение + новые карточки) строятся через
`buildQueries<Select extends string>(select)` — общий фильтр, разный
select. Выбор select **до** отправки запроса:

```ts
const primaryQueries = flags.shadowEnabled
  ? buildQueries(FSRS_SELECT)
  : buildQueries(LEGACY_SELECT);
```

(два отдельных литеральных вызова — не тернарник внутри одного,
иначе Supabase-js не может разобрать строку `select()` на этапе
компиляции типов). При `flags.shadowEnabled=false` `FSRS_SELECT`
вообще не строится в реальный запрос. 42703-fallback
(`isMissingFsrsColumnsError`) остаётся как defense in depth — на
случай, если `FSRS_SCHEMA_READY=true` выставлен раньше, чем миграция
реально применена.

### `src/app/(app)/brain/[deckId]/review/actions.ts` (`reviewWord`)

Тот же принцип для одиночного `select()`:

```ts
const [{ data: fetched, error: fetchError }, params, settings] = await Promise.all([
  flags.shadowEnabled ? fetchSrsState(FSRS_SELECT) : fetchSrsState(LEGACY_SELECT),
  ...
]);
```

`usedFsrsColumns` (изначально равен `flags.shadowEnabled`, может
понизиться до `false` при 42703-fallback) управляет:

- вычисляется ли `computeFsrsShadowSafe(...)` вообще (если
  `usedFsrsColumns=false` — `fsrsResult=null`, `fsrs_*`-поля в
  `current` даже не читаются);
- включаются ли `fsrs_*`-поля в `.update()` (`...(fsrsResult ? {...} : {})`);
- включаются ли `scheduler_type`/`previous_state_json`/
  `next_state_json` в `.insert()` в `review_log`
  (`...(usedFsrsColumns ? {...} : {})`).

`flags.enabled` (не `usedFsrsColumns`) решает, авторитетен ли FSRS для
`due_at` — эти два флага в реализации разделены намеренно: можно в
теории представить состояние "усвоенные fsrs-поля есть, но FSRS не
авторитетен" (Phase C, шэдоу), но не наоборот.

### `review-mode-switcher.tsx` / `review-session.tsx`

Проверены, **изменений не потребовалось**: оба компонента принимают
готовый `fsrsEnabled: boolean` пропом (из `page.tsx`, теперь это
`flags.enabled`) и не содержат ни одного упоминания
`fsrs_*`/`scheduler_type`/`*_state_json`. Клиентский предпросмотр
интервала вызывает `reviewFsrsCard(card.fsrsState, ...)` только когда
`fsrsEnabled=true` — а `flags.enabled=true` по построению подразумевает
`flags.schemaReady=true`, так что этот путь никогда не исполняется
против БД без миграции.

## Проверка против pre-0032 схемы (обязательное требование, не пропущено)

Выполнено **дважды** в этой фазе (Phase A и после восстановления схемы
— Phase C/D), способом "временно откатить только локальную test
database" (полноценная отдельная БД не поднималась — не было
необходимости, метод ниже даёт эквивалентную проверку):

```sql
alter table srs_state
  drop column fsrs_stability, drop column fsrs_difficulty,
  drop column fsrs_state, drop column fsrs_lapses,
  drop column fsrs_reps, drop column fsrs_scheduled_days;
alter table review_log
  drop column scheduler_type, drop column previous_state_json,
  drop column next_state_json;
```

Затем пересборка (`npm run build`) и запуск (`npm run start -- -p
3000`) с `FSRS_SCHEMA_READY`/`FSRS_ENABLED` не заданными (Phase A по
умолчанию). После проверки — восстановление тем же `0032_fsrs_state.sql`
(идемпотентно ровно как обычная миграция, эта же команда применялась и
изначально).

**Результат** (полный transcript — см. "Browser verification" ниже):
логин, `/brain` (показал корректный due count), review-страница,
раскрытие карточки, legacy-предпросмотр интервала, сохранение оценки,
переход к следующей карточке, завершение сессии, due count после,
`/progress` — всё сработало без единой ошибки в консоли и без 500 от
сервера. Прямая проверка в БД подтвердила: `ease_factor`/
`interval_days`/`repetitions`/`due_at`/`last_reviewed_at` записаны
корректными legacy-значениями, `review_log` получил чистую строку без
FSRS-полей (которых физически не существовало в схеме на тот момент).

Это не гипотетическая совместимость "по коду должно работать" — это
реально исполненный сценарий на реальной (временно упрощённой) схеме.

## Тесты

`src/lib/fsrs-flags.test.ts` (новый файл, 6 тестов) — все 4 сценария из
задания плюс проверка диагностического логирования:

1. Оба флага отсутствуют → `{schemaReady: false, enabled: false, shadowEnabled: false}`.
2. `FSRS_ENABLED=true`, `FSRS_SCHEMA_READY` отсутствует → `enabled: false` (опасная конфигурация обезврежена).
3. `FSRS_SCHEMA_READY=true`, `FSRS_ENABLED=false` → `{schemaReady: true, enabled: false, shadowEnabled: true}` (shadow mode).
4. Оба `true` → `{schemaReady: true, enabled: true, shadowEnabled: true}`.
5. Небезопасная конфигурация логируется без приватных данных (`console.warn`, текст не содержит `flashcard`/`srs_state`).
6. Безопасные конфигурации не логируют предупреждение.

`src/lib/fsrs.test.ts` (дополнен, +7 тестов):

- `isFsrsSchemaReady()` — точное сравнение строки `"true"`.
- `selectWithFsrsSchemaFallback()` (переиспользуемый примитив,
  используется только в тестах — реальные call site'ы в `actions.ts`/
  `page.tsx` используют явное ветвление напрямую из-за конфликта
  между generic-выводом типов и разбором строки `select()` у
  Supabase-js, см. комментарии в коде): `schemaReady=false` не
  вызывает FSRS-запрос вообще; `schemaReady=true` с успешным FSRS-
  запросом не вызывает легаси; `schemaReady=true` с 42703 откатывается
  на легаси; `schemaReady=true` с ДРУГОЙ ошибкой не маскирует её
  откатом.

Существующие SRS/FSRS тесты (`srs.test.ts`, оригинальные тесты
`fsrs.test.ts` из фаз M2/Release Review) не удалялись и не менялись.

## Результаты всех проверок

| Команда | Результат |
|---|---|
| `npm ci` | чисто |
| `npm run typecheck` | чисто |
| `npm run lint` | чисто |
| `npm run test:import` | 6/6 |
| `npm run test:extension` | 4/4 |
| `npm run test:srs` | 10/10 |
| `npm run test:fsrs` (теперь включает `fsrs.test.ts` + `fsrs-flags.test.ts`) | 25/25 |
| `npm run build` | все 32 маршрута, чисто |
| `npm run test:e2e` | 10 passed, 1 skipped (Stripe), 0 failed, без флакинеса на этом прогоне |

## Browser verification

Выполнено полностью, живьём, с реальным логином `test@example.com`,
против трёх состояний схемы/флагов:

**Phase A** (pre-0032 схема, оба флага не заданы): login → `/brain`
(due count корректен) → review-страница → раскрытие карточки → legacy-
предпросмотр интервала → оценка сохранена → следующая карточка →
завершение сессии ("Повторено слов: 2") → `/brain` ("Всё повторено!")
→ `/progress` (статистика обновилась, счётчики корректны). Ни одной
ошибки в консоли.

**Phase C** (миграция восстановлена, `FSRS_SCHEMA_READY=true`,
`FSRS_ENABLED` не задан): предпросмотр интервала — **легаси**-значения
(подтверждает `enabled=false`, несмотря на `schemaReady=true`). После
оценки — прямая проверка БД: `due_at` соответствует legacy-расчёту,
`fsrs_stability`/`fsrs_reps` заполнены (shadow-запись работает),
`review_log.scheduler_type='sm2'`.

**Phase D** (`FSRS_SCHEMA_READY=true`, `FSRS_ENABLED=true`):
предпросмотр интервала — **FSRS**-значения (`1/2/3/4 дн`, другой
паттерн, чем legacy). После оценки — `due_at` в БД совпадает день-в-
день с тем, что показывал предпросмотр (+3 дня для "Помню"),
`review_log.scheduler_type='fsrs'`.

Локальный `.env.local` возвращён в состояние без обоих флагов
(Phase A/безопасное значение по умолчанию) после проверки.

## Изменённые файлы

- `src/lib/fsrs.ts` — добавлены `isFsrsSchemaReady()`,
  `selectWithFsrsSchemaFallback()`.
- `src/lib/fsrs-flags.ts` (новый) — `getFsrsFlags()`.
- `src/lib/fsrs-flags.test.ts` (новый).
- `src/lib/fsrs.test.ts` — дополнен.
- `src/app/(app)/brain/[deckId]/review/actions.ts` — `reviewWord()`
  использует `getFsrsFlags()`, select/update/insert решают по
  `flags.shadowEnabled`/`usedFsrsColumns` до отправки запроса.
- `src/app/(app)/brain/[deckId]/review/page.tsx` — аналогично, плюс
  `flags.enabled` вместо прямого `isFsrsEnabled()`.
- `review-mode-switcher.tsx` / `review-session.tsx` — проверены, без
  изменений (см. выше).
- `.env.local.example` — задокументирован `FSRS_SCHEMA_READY`.
- `package.json` — `test:fsrs` теперь запускает оба тестовых файла.

## Rollout (обновление `fsrs-rollout.md`)

- **Phase A** (готово этой веткой, не задеплоено): оба флага
  отсутствуют — код уже безопасен против БД без migration 0032.
- **Phase B** (не выполнено): ручной backup + применение `0032` —
  заблокировано отсутствием backup/PITR, отдельное решение владельца.
- **Phase C** (не выполнено): `FSRS_SCHEMA_READY=true` в production —
  shadow-наблюдение.
- **Phase D** (не выполнено): `FSRS_ENABLED=true` в production —
  отдельное явное решение после наблюдения.

## Production

**Не тронуто в этой фазе**: production alias не менялся, ничего не
задеплоено, migration 0032 не применялась к production, ни один из
флагов не включался в Vercel. Language Twin не начинался.
