# FSRS Production Rollout — Phase B/C (shadow mode live)

Статус: **Phase B и Phase C выполнены**. Migration `0032_fsrs_state.sql`
применена к production, `FSRS_SCHEMA_READY=true` установлен,
`FSRS_ENABLED` остаётся не задан. Production работает в shadow-режиме:
legacy SM-2 авторитетен для `due_at`, FSRS считается и пишется на
каждом ревью параллельно, ничего не показывается пользователю.

Разбор двухфлаговой модели и почему это безопасно — `fsrs-schema-compatibility.md`.
Backup, созданный перед этой фазой, — `docs/operations/manual-production-backup.md`.

## Phase B — миграция

### Финальная проверка миграции перед применением

`supabase/migrations/0032_fsrs_state.sql` — аддитивная, без `drop`/`alter... type`/`not null` на существующих колонках:

```sql
alter table srs_state
  add column fsrs_stability numeric,
  add column fsrs_difficulty numeric,
  add column fsrs_state smallint,
  add column fsrs_lapses int not null default 0,
  add column fsrs_reps int not null default 0,
  add column fsrs_scheduled_days numeric not null default 0;

alter table review_log
  add column scheduler_type text not null default 'sm2' check (scheduler_type in ('sm2', 'fsrs')),
  add column previous_state_json jsonb,
  add column next_state_json jsonb;
```

Содержимое идентично между репозиторием и локальной БД разработки —
сверено перед применением.

### Проверка истории миграций production (без слепого повторного применения)

`supabase_migrations.schema_migrations` в production на момент проверки
содержал версии `0003`–`0012` (не `0032`) — это ожидаемо и не является
признаком проблемы: проект исторически не ведёт полный журнал через
таблицу CLI-бухгалтерии для каждой миграции (та же картина в локальной
dev-БД — там таблица тоже останавливается на `0007`, хотя миграции
применены гораздо более поздние). `--linked`-режим Supabase CLI
(`supabase migration list --linked`) недоступен в этом окружении
(`LegacyPlatformAuthRequiredError`, требует полной platform-авторизации)
— проверка сделана напрямую через `psql`/`information_schema`.

### Применение

Выполнено владельцем вручную через `psql` (Session Pooler,
`aws-0-eu-central-1.pooler.supabase.com:5432`, пароль вводился
интерактивно в его собственном терминале через `read -s`, никогда не
передавался ассистенту) — единственный доступный путь, поскольку
Bash-инструмент ассистента не имеет интерактивного канала для ввода
пароля, а `vercel env pull`/`supabase db push --linked` заблокированы
(см. ниже).

Один SQL-скрипт объединял BEFORE-проверку, саму миграцию (обёрнутую в
`BEGIN`/`COMMIT`, `\set ON_ERROR_STOP on`) и AFTER-проверку — так что
результат перепроверяем сразу, без отдельного шага. Полный вывод:
`/home/sergey/Backups/lexreader/apply-0032-output-20260801-225236.log`
(прочитан и разобран ассистентом напрямую, не только со слов
владельца).

### Row counts (до/после — не должны были измениться и не изменились)

| Таблица | До | После |
|---|---|---|
| `srs_state` | 979 | 979 |
| `review_log` | 36 | 36 |
| `flashcards` | 979 | 979 |

### Колонки (до/после)

- До: 0 колонок `fsrs_%` на `srs_state`; 0 из
  `scheduler_type`/`previous_state_json`/`next_state_json` на `review_log`.
- После: все 6 (`fsrs_difficulty`, `fsrs_lapses`, `fsrs_reps`,
  `fsrs_scheduled_days`, `fsrs_stability`, `fsrs_state`) на `srs_state`;
  все 3 на `review_log`.

### RLS / индексы / триггеры (до/после — идентичны)

| Проверка | До | После |
|---|---|---|
| RLS policies (`srs_state`, `review_log`) | `review_log: owner full access`, `srs_state: owner full access` | без изменений |
| Индексы | `review_log_pkey`, `srs_state_due_at_idx`, `srs_state_pkey` | без изменений |
| Триггеры на этих двух таблицах | 0 | без изменений |

Результат применения: `BEGIN` → `ALTER TABLE` → `ALTER TABLE` → `COMMIT`,
без ошибок, exit code `0`.

## Phase C — shadow mode

### Vercel production env

- `FSRS_SCHEMA_READY=true` — добавлен (`vercel env add`, значение введено
  ассистентом напрямую, это не секрет и не требует пароля владельца).
- `FSRS_ENABLED` — подтверждённо отсутствует (`vercel env ls production`
  до и после совпадают, кроме добавленной строки `FSRS_SCHEMA_READY`).

### Production deployment

Env-переменные не подхватываются уже собранными деплоями — потребовался
явный redeploy (без нового кода, `main` не менялся):

```
vercel redeploy dpl_D9AhKTk5mHFkB2h3o7TM7KMFpfWK --target production
```

- Источник: та же сборка, что уже была в production (commit `8573cb2`,
  `fix: make FSRS rollout compatible with the legacy database schema`,
  PR [#4](https://github.com/oxso1teee/lexreader/pull/4)).
- Новый deployment: `dpl_Caoj6FZExsuHTiZRgrfxnzb7hZt4`, статус **Ready**,
  автоматически заалиашен на `lexreader.vercel.app` (в этот раз без
  ручного `vercel promote` — предыдущий `vercel rollback` из фазы
  инцидента больше не "прикалывал" alias).

### Production shadow-mode smoke test

Тестовый аккаунт: `claude-hotfix-smoketest-20260801@example.com`
(тот же, что использовался в предыдущей фазе Schema Compatibility
Hotfix — публичная регистрация, без реальных платежей и без данных
реальных пользователей).

1. Добавлена новая карточка `shadow-rollout-word` /
   `shadow-rollout-translation` в «Основная колода».
2. Открыта сессия повторения — карточка показана (`1 / 1`).
3. Предпросмотр интервалов на кнопках оценки показывал **legacy**
   значения (`Не помню 1 дн`, `Трудно 1 дн`, `Помню 1 дн`, `Легко
   4 дн`) — подтверждает, что `flags.enabled=false` дошёл до клиента
   правильно, несмотря на `FSRS_SCHEMA_READY=true`.
4. Оценка «Помню» — сессия завершилась штатно («Сессия завершена,
   Повторено слов: 1»), без ошибок в UI.
5. Проверены `/brain` («Всё повторено!», 2 карточки всего) и
   `/progress` (2 ответа дано, 2 карточки создано) — согласовано между
   собой, без аномалий.
6. Консоль браузера — 0 ошибок за всю сессию. Все сетевые запросы,
   попавшие в лог, вернули `200`.

### Прямая read-only проверка БД (не только UI)

Выполнено владельцем через `psql` в read-only транзакции
(`BEGIN; SET TRANSACTION READ ONLY; ... COMMIT;`), скрипт и лог сохранены
постоянно:
`/home/sergey/Backups/lexreader/verify-shadow-mode.sql`,
`/home/sergey/Backups/lexreader/verify-shadow-mode-output-20260801-234132.log`.

Первая попытка упала на `column rl.created_at does not exist` —
`review_log` никогда не имел `created_at`, только `reviewed_at` (видно
и в `supabase/migrations/0004_decks.sql`, и подтверждено вживую через
`information_schema.columns` в том же скрипте перед использованием
колонки). Ничего не было изменено или потеряно — ошибка обнаружена ДО
записи, транзакция откатилась сама, скрипт был исправлен и перезапущен.

Результат (`srs_state`, тестовый аккаунт):

| front | due_at | interval_days | repetitions | fsrs_stability | fsrs_difficulty | fsrs_state | fsrs_reps | fsrs_scheduled_days |
|---|---|---|---|---|---|---|---|---|
| `shadow-rollout-word` | 2026-08-02 20:26 (+1 день от ревью — legacy-формула) | 1 | 1 | 2.3065 | 2.11810397 | 2 | 1 | 3 |
| `smoke-test-word` (ревью было ДО этой фазы) | 2026-08-02 17:38 | 1 | 1 | *(пусто)* | *(пусто)* | *(пусто)* | 0 | 0 |

`smoke-test-word` не имеет FSRS-полей — это ожидаемо и важно: карточка
была оценена ДО применения миграции/установки флага, shadow-запись не
могла произойти задним числом. Никакого бэкфилла нет — флаг решает
только для ревью, которые происходят ПОСЛЕ его установки.

Результат (`review_log`, тестовый аккаунт):

| front | grade | scheduler_type | previous_state_json | next_state_json |
|---|---|---|---|---|
| `shadow-rollout-word` | 2 | `sm2` | есть | есть |
| `smoke-test-word` | 2 | `sm2` | нет | нет |

Все 5 проверок, требуемых для этой фазы, подтверждены напрямую в БД:
`due_at` рассчитан legacy-планировщиком; `scheduler_type = 'sm2'`;
`fsrs_*`-поля заполнились; `previous_state_json`/`next_state_json`
записались; legacy-колонки (`ease_factor`/`interval_days`/`repetitions`)
продолжают обновляться как раньше.

## Мониторинг ошибок

- **Консоль браузера / сетевые запросы** — 0 ошибок, все ответы `200`
  за время smoke test.
- **PostgREST** — прямых логов production Vercel получить не удалось:
  `vercel inspect --logs` заблокирован тем же classifier'ом Claude
  Code auto mode, что ранее блокировал `vercel env pull` — попытки
  обойти не предпринимались. Функциональное доказательство отсутствия
  PostgREST-ошибок: ревью прошло от начала до конца с корректным
  результатом в БД (при `42703 undefined_column`, как в исходном
  инциденте, вся операция не прошла бы вообще).
- **PostHog — важная находка, не относящаяся к FSRS**: при попытке
  проверить exceptions обнаружено, что PostHog **не получил ни одного
  события в production вообще** с момента подключения (Phase 0, 2 дня
  назад). Причина подтверждена напрямую: `next.config.ts` задаёт
  production CSP (`script-src`, `connect-src`), в которую домены
  PostHog (`*.i.posthog.com`, `*-assets.i.posthog.com`) никогда не были
  добавлены — браузер молча блокирует и загрузку скрипта, и все
  capture-запросы. Проверено вживую: тег `<script>` с правильным
  project token присутствует в DOM, но `fetch()` к
  `eu.i.posthog.com/decide/` из контекста страницы падает с `Failed to
  fetch`, и ни одного запроса к доменам PostHog не зафиксировано за всю
  тестовую сессию. Это **не связано с FSRS rollout** и существовало ДО
  этой фазы — вынесено в отдельную задачу (не исправлялось в рамках
  этой фазы, чтобы не смешивать несвязанные изменения). До исправления
  PostHog нельзя использовать как сигнал об ошибках ни для этого, ни
  для любого другого production-мониторинга.

## Rollback readiness

Не потребовался — миграция и flag-переключение прошли без ошибок. Процедура
на случай необходимости не изменилась, см. `fsrs-rollout.md` → раздел
Rollback: откат `FSRS_SCHEMA_READY` в `false`/удаление переменной
(с явным redeploy) мгновенно возвращает review к тому же поведению,
что было в Phase A — fsrs_*-колонки перестают запрашиваться и
писаться. Сама миграция аддитивная, откатывать в БД нечего.

## Предварительные условия для Phase D

Phase D (`FSRS_ENABLED=true`) — **отдельное решение владельца**, не
начато и не запрошено в этой фазе. Перед ним разумно:

1. Дать shadow-режиму поработать на реальных ревью какое-то время,
   чтобы накопить `fsrs_*`/`review_log.next_state_json`-историю для
   сравнения с тем, что предложил бы SM-2.
2. Отдельно решить судьбу CSP/PostHog (см. выше) — иначе Phase D
   тоже останется без работающего error-tracking сигнала.
3. Явное подтверждение владельца, как и во всех предыдущих фазах.

## Что не делалось (в рамках ограничений задачи)

`FSRS_ENABLED=true` не устанавливался. Легаси SRS не удалялся и не
менялся. Study Settings не менялись. Backup-файл не удалялся. Language
Twin/Missions/Voice/AI Platform не начинались. Несвязанного рефакторинга
не производилось — обнаруженная проблема CSP/PostHog вынесена в
отдельную задачу, а не исправлена здесь.
