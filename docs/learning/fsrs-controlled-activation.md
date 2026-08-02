# FSRS Controlled Activation — Phase D preparation (account-level rollout)

Статус: **код смёржен и задеплоен (PR #9, merge SHA `fd150ec5c1dca997c8a1797c978156f9a8559448`); `FSRS_ENABLED_USER_IDS` УСТАНОВЛЕН в production для одного тестового аккаунта.**
Полный отчёт активации, browser/PostHog/DB-verification —
`docs/learning/fsrs-test-account-activation.md`. Ниже — исходный документ
подготовки фазы (архитектура, decision matrix, тесты), актуален без
изменений.

## Зачем нужен этот шаг

К моменту этой фазы production уже в shadow-режиме (`FSRS_SCHEMA_READY=true`,
`FSRS_ENABLED` не задан) — FSRS считается и пишется на каждом ревью, но
`due_at` остаётся legacy для всех. Прежде чем включать FSRS глобально
(`FSRS_ENABLED=true`, отдельная будущая фаза), нужен способ сделать FSRS
авторитетным **только для одного аккаунта** — проверить реальный
пользовательский опыт (интервалы, `scheduler_type`, UI) без риска для
остальных пользователей.

## Аудит текущей архитектуры (Шаг 1)

- **`FSRS_SCHEMA_READY`** читается в `isFsrsSchemaReady()`
  (`src/lib/fsrs.ts`) — `process.env.FSRS_SCHEMA_READY === "true"`.
- **`FSRS_ENABLED`** читается в `isFsrsEnabled()` (`src/lib/fsrs.ts`) —
  `process.env.FSRS_ENABLED === "true"`.
- Оба — **server-side only** (не `NEXT_PUBLIC_*`), читаются только внутри
  `getFsrsFlags()` (`src/lib/fsrs-flags.ts`), которая, в свою очередь,
  вызывается только из серверного кода:
  - `src/app/(app)/brain/[deckId]/review/actions.ts` (`reviewWord`,
    server action) — единственное место, где решается реальный `due_at` и
    `review_log.scheduler_type`, который сохраняется в БД.
  - `src/app/(app)/brain/[deckId]/review/page.tsx` (server component) —
    вычисляет флаги один раз при рендере, передаёт вниз только
    `flags.enabled` как проп `fsrsEnabled` в `<ReviewModeSwitcher>` — клиент
    использует это исключительно для косметического предпросмотра
    интервала на кнопках оценки, не для сохранения.
- **Клиентские компоненты** (`review-session.tsx`,
  `review-mode-switcher.tsx`) уже НЕ читают `process.env` напрямую и не
  видели raw-флаги — только вычисленный `boolean`. Добавлять allowlist
  безопасно можно было полностью на стороне `getFsrsFlags()`, не трогая ни
  один клиентский компонент.
- **PostHog feature flags** — не используются нигде в проекте для FSRS
  (только product analytics/error tracking, см.
  `docs/analytics/posthog-csp-fix.md`). Internal rollout helper до этой
  фазы не существовал — `getFsrsFlags()` был двухфлаговым (`schemaReady`/
  `enabled`), без понятия "конкретный пользователь".

**Вывод**: авторитетность scheduler'а уже 100% server-authoritative
(server action + server component, клиент ничего не выбирает и не может
подделать). Добавление allowlist'а — расширение той же серверной функции,
не новая архитектура.

## Выбранный rollout mechanism (Шаг 2)

**Server-side env allowlist по user id** — `FSRS_ENABLED_USER_IDS`
(comma-separated список `auth.uid()`, НЕ email). Выбран по порядку
предпочтения из задания:

1. ~~PostHog server-side feature flag~~ — не выбран: PostHog feature flags
   в проекте до сих пор не настраивались и не тестировались ни разу (сам
   PostHog заработал в production только что, см.
   `docs/analytics/posthog-production-verification.md`) — заводить
   FSRS-авторитетность на "надёжно настроенный" внешний флаг, которого
   пока не существует, было бы риском отдельно от FSRS.
2. ~~Database rollout table~~ — не выбран: избыточно для одного тестового
   аккаунта; добавил бы новую таблицу/миграцию ради временного
   rollout-механизма, который сам предполагается заменить глобальным
   `FSRS_ENABLED=true` позже.
3. **Env allowlist — выбран.** Минимальное изменение (одна новая
   переменная, один новый экспорт, два изменённых call site), полностью
   согласуется с уже существующей двухфлаговой моделью
   (`FSRS_SCHEMA_READY`/`FSRS_ENABLED`), не требует новых зависимостей или
   миграций.

Почему `auth.uid()`, а не email: `auth.uid()` — стабильный opaque UUID,
уже доступен и в `reviewWord()` (`user.id` из `supabase.auth.getUser()`), и
в `page.tsx` (`profile.id` из `requireProfile()`), не меняется при смене
email пользователем, не является сам по себе читаемым PII. Реальный email
тестового аккаунта нигде не попадает ни в код, ни в env — только в этот
документ (что нормально, документ не публичный секрет).

### Почему это server-authoritative, а не client-only флаг

`FSRS_ENABLED_USER_IDS` — не `NEXT_PUBLIC_*`, физически не включается в
client bundle (Next.js инлайнит в клиентский код только переменные с этим
префиксом на этапе сборки). `getFsrsFlags(userId)` вызывается только из
`reviewWord()`/`page.tsx` (server-side), и наружу отдаёт только итоговый
`flags.enabled: boolean` — не сам список, не `userId`. Даже если бы кто-то
подделал клиентский проп `fsrsEnabled` через devtools, реальное сохранение
оценки всё равно идёт через `reviewWord`, которая заново вызывает
`getFsrsFlags(user.id)` на сервере с настоящим `auth.uid()` текущей сессии
(из cookie/JWT, не из клиентского запроса).

## Decision matrix (Шаг 3)

| `FSRS_SCHEMA_READY` | `FSRS_ENABLED` | userId в `FSRS_ENABLED_USER_IDS` | `flags.enabled` | Итог |
|---|---|---|---|---|
| `false`/не задан | любое | любое | `false` | Legacy only — fsrs_*-колонки вообще не запрашиваются/не пишутся |
| `true` | `false`/не задан | нет | `false` | Legacy authoritative + FSRS shadow write (текущее production-состояние для всех, кроме allowlist'а) |
| `true` | `false`/не задан | **да** | **`true`** | **FSRS authoritative только для этого аккаунта** — цель этой фазы |
| `true` | `true` | любое | `true` | Глобальный FSRS для всех — отдельная будущая фаза, НЕ активируется этим PR |

Формула (`src/lib/fsrs-flags.ts`, `getFsrsFlags`):
```ts
enabled = schemaReady && (rawEnabled || allowlisted)
```
`allowlisted = isFsrsEnabledForUser(userId)` (`src/lib/fsrs.ts`) —
`false`, если `userId` не передан, `FSRS_ENABLED_USER_IDS` не задан, или
`userId` не входит в список после trim/фильтрации пустых элементов.

Для allowlisted-пользователя (когда он активирован — см. "Активация
тестового аккаунта" ниже):
- `due_at` = `fsrsResult.dueAt` (расчёт FSRS, не legacy) —
  `actions.ts`: `dueAt = fsrsAuthoritative ? new Date(fsrsResult.dueAt) : legacyDueAt`.
- `review_log.scheduler_type = "fsrs"` —
  `scheduler_type: fsrsAuthoritative ? "fsrs" : "sm2"`.
- `previous_state_json`/`next_state_json` продолжают записываться (уже
  писались в shadow-режиме, здесь без изменений).
- Legacy-поля (`ease_factor`/`interval_days`/`repetitions`) **продолжают
  обновляться** тем же SM-2, как и раньше — `reviewWord()` уже считает оба
  алгоритма на каждом ревью независимо от того, какой авторитетен (это
  свойство сохранено с самого начала FSRS-миграции, не менялось в этой
  фазе) — именно поэтому откат на legacy для этого аккаунта не потеряет
  историю: SM-2 не "замораживался" на момент активации FSRS.
- Откат — удаление `userId` из `FSRS_ENABLED_USER_IDS` (или переменной
  целиком) мгновенно возвращает `flags.enabled=false` для этого аккаунта
  при следующем ревью — ничего в БД откатывать не нужно.

## Изменённые файлы

- `src/lib/fsrs.ts` — новая функция `isFsrsEnabledForUser(userId)`.
- `src/lib/fsrs-flags.ts` — `getFsrsFlags()` теперь принимает опциональный
  `userId` и учитывает allowlist в формуле `enabled`.
- `src/app/(app)/brain/[deckId]/review/actions.ts` — `getFsrsFlags()` →
  `getFsrsFlags(user.id)`.
- `src/app/(app)/brain/[deckId]/review/page.tsx` — `getFsrsFlags()` →
  `getFsrsFlags(profile.id)`.
- `.env.local.example` — задокументирована `FSRS_ENABLED_USER_IDS`.
- `src/lib/fsrs.test.ts` / `src/lib/fsrs-flags.test.ts` — новые тесты (см.
  ниже).

## Тесты (Шаг 4)

`src/lib/fsrs.test.ts` (`isFsrsEnabledForUser`): переменная не задана;
userId в списке; userId не в списке; `userId=undefined` всегда `false`
даже при непустом списке; пробелы вокруг элементов; дубликаты; полностью
"мусорный" список (только запятые/пробелы, пустая строка) не включает
никого; точное сравнение — частичное совпадение id не засчитывается.

`src/lib/fsrs-flags.test.ts` (`getFsrsFlags`, 10 пунктов задания):

1. `FSRS_SCHEMA_READY` не задана → legacy, даже если userId в allowlist'е.
2. Schema ready, allowlist пуст → legacy authoritative + shadow.
3. Schema ready, userId в allowlist'е → FSRS authoritative для этого
   пользователя.
4. Глобальный `FSRS_ENABLED=true` → FSRS authoritative для всех.
5. "Мусорный" allowlist (только запятые/пробелы) не включает никого.
6. Пробелы и дубликаты в allowlist'е обрабатываются безопасно.
7. Возвращаемая форма `getFsrsFlags()` — ровно `{schemaReady, enabled,
   shadowEnabled}`, без утечки allowlist/userId наружу (проверяет "клиент
   не получает allowlist" на уровне формы объекта, который и передаётся
   клиенту как есть).
8. `scheduler_type` корректный — гарантируется построением в `actions.ts`
   из уже протестированного `flags.enabled` (`fsrsAuthoritative ? "fsrs" :
   "sm2"`), не тестируется отдельно юнит-тестом (тот же принцип, что и до
   этой фазы — `actions.ts` не покрыт unit-тестами напрямую, требует
   Supabase/Next server mocking, которого в проекте нет).
9. `due_at` отличается по FSRS там, где ожидается — та же логика: следует
   из `fsrsAuthoritative`, построенного на протестированном
   `flags.enabled`.
10. Rollback на legacy — удаление из allowlist'а немедленно возвращает
    `enabled=false`, `schemaReady`/`shadowEnabled` не затрагиваются
    (история FSRS не теряется).

Дополнительно: другой пользователь (не в allowlist'е, при непустом
allowlist'е) остаётся на legacy+shadow — явная проверка изоляции между
аккаунтами.

## Полный check suite

`npm ci` / `typecheck` / `lint` / `test:import` / `test:extension` /
`test:srs` / `test:fsrs` (42 теста, включая 17 новых) / `test:csp` /
`build` — все прошли (exit 0). `test:e2e` — тот же известный, ранее уже
задокументированный паттерн (см. `docs/analytics/posthog-csp-fix.md`):
CI-падение `e2e` из-за Node 20 vs требование Node 22+ для
`@supabase/realtime-js` (`global-setup.ts`) — не связано с этим PR,
воспроизводится на каждом push в `main`. Локально (Node 22) —
периодические `toHaveURL`-таймауты в 1-2 из 11 тестов, тот же
pre-existing flake, что и раньше, не регрессия этого PR.

## Активация тестового аккаунта

**Выполнено** — полный отчёт со всеми результатами verification в
`docs/learning/fsrs-test-account-activation.md`. Процедура ниже сохранена
как справочная (описывает шаги, которые были выполнены):

1. Владелец устанавливает в Vercel production:
   `FSRS_ENABLED_USER_IDS=eee0e646-56c4-470b-b60f-aea90212ca86`
   (UUID тестового аккаунта `claude-hotfix-smoketest-20260801@example.com`,
   уже известен из предыдущих фаз verification).
2. Redeploy (env-переменные не подхватываются уже собранными деплоями —
   тот же паттерн, что и для `FSRS_SCHEMA_READY`, см.
   `docs/learning/fsrs-production-shadow-rollout.md`).
3. **Browser smoke** под тестовым аккаунтом: интервал-предпросмотр на
   кнопках оценки должен показать FSRS-формулу (не `1/1/1/4 дн`, как в
   shadow-режиме), а реальные FSRS-интервалы.
4. **DB verification** (read-only, тот же паттерн, что и в
   `fsrs-production-shadow-rollout.md`): для нового ревью этого аккаунта —
   `review_log.scheduler_type='fsrs'`, `srs_state.due_at` совпадает с
   `fsrs_scheduled_days`, а не с legacy `interval_days`.
5. **PostHog** — проверить error tracking на новые исключения после
   активации (теперь реально работает, см.
   `docs/analytics/posthog-production-verification.md`).
6. Убедиться, что **другие аккаунты** не затронуты (не в allowlist'е →
   `flags.enabled` для них всё ещё `false`).

## Rollback

Удалить `userId` из `FSRS_ENABLED_USER_IDS` (или удалить переменную
целиком) → redeploy. `flags.enabled` для этого аккаунта возвращается в
`false` при следующем вызове `getFsrsFlags()` — мгновенно, без изменений в
БД. Накопленная FSRS-история (`fsrs_*`-поля, `previous_state_json`/
`next_state_json`) не удаляется — можно активировать снова позже без
потери прогресса.

## Критерии для глобальной активации (`FSRS_ENABLED=true`)

Не решается этим документом — только перечисление того, что разумно
проверить перед этим решением:

1. Тестовый аккаунт отработал в FSRS-режиме достаточное время без ошибок
   (PostHog error tracking + ручные DB-проверки).
2. Сравнение shadow-накопленной FSRS-истории (`review_log.next_state_json`
   по всем пользователям, не только тестовому) с тем, что реально
   предложил бы SM-2 — нет ли системных аномалий (слишком короткие/длинные
   интервалы).
3. Отдельное явное решение владельца — не автоматическое следствие
   успешного account-level теста.

## Что не делалось (по ограничениям задачи)

`FSRS_ENABLED_USER_IDS` не устанавливался нигде — ни в production Vercel,
ни в `.env.local`. `FSRS_ENABLED=true` не включался ни глобально, ни для
кого-либо. Production не деплоился. Language Twin/Missions/Voice не
начинались. Несвязанного рефакторинга не производилось.
