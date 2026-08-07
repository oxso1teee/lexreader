# Manual Production Database Backup (before migration 0032)

> **Обновлено после Phase B** (2026-08-01, см.
> `fsrs-production-shadow-rollout.md`): migration `0032_fsrs_state.sql`
> успешно применена к production. Восстановление из этого backup **не
> потребовалось** — миграция чисто аддитивная, применилась без ошибок.
> Backup-файл сохраняется без изменений как защитная сеть на случай
> будущих операций, а не потому что он был использован.

Statuses: **создан, проверен, восстановимость подтверждена тестовым
restore**. Выполнено вручную через `pg_dump`, поскольку текущий
Supabase-план проекта (Free) не предоставляет Scheduled Backups/PITR
(подтверждено в `docs/learning/fsrs-production-rollout-phase-1.md`).

## Дата и метод

- Дата создания: **2026-08-01, 21:48 MSK**.
- Метод: `pg_dump` (официальный клиент PostgreSQL, вариант `--format=custom`),
  напрямую с локальной машины через **Session Pooler** production-проекта
  Supabase (порт `5432`, не Transaction Pooler на `6543` — тот не гарантированно
  совместим с сессионными операциями `pg_dump`).
- Пароль базы данных вводился владельцем интерактивно в его собственном
  терминале (`read -s` + `export PGPASSWORD`, затем `unset PGPASSWORD`
  сразу после) — ни разу не передавался через чат/файлы/логи/историю
  команд ассистента.
- `pg_dump --no-owner --no-privileges --verbose`, exit code `0`.

Два файла-предшественника из более ранних неудачных попыток
(`lexreader-production-before-0032-20260801-213001.dump`,
`...-213912.dump`) имеют нулевой размер и **не являются валидным
backup** — не используются, оставлены как есть для истории попытки, не
удалялись автоматически.

## Путь к backup

```
/home/sergey/Backups/lexreader/lexreader-production-before-0032-20260801-214649.dump
```

Каталог вне Git-репозитория, права `700` (только владелец). Файл
backup **не должен коммититься в Git** — не добавлен и не будет
добавлен ни в один коммит этого или любого другого репозитория.

## Размер

`396K` (404 590 байт).

## SHA-256 checksum

```
70ac25974fb983a0b5cf80a765d1c6bf95549bda9056c45d2bcff3b43949e9f2  lexreader-production-before-0032-20260801-214649.dump
```

Сохранён рядом: `lexreader-production-before-0032-20260801-214649.dump.sha256`.
Проверка (`sha256sum -c`) — **успешна** сразу после создания.

## Тип файла

`file` подтверждает: `PostgreSQL custom database dump - v1.16-0`.

## Результат `pg_restore --list`

Полный TOC (496 entries) содержит:

| Категория | Количество |
|---|---|
| TABLE (структура) | 105 |
| TABLE DATA (данные) | 53 (включая все ключевые таблицы) |
| INDEX | 82–84 |
| CONSTRAINT / FK | 67 + 47 |
| FUNCTION | 34 (всего по всем схемам) |
| TRIGGER | 8–14 |
| POLICY (RLS) | 27 (всего по всем схемам) |
| SCHEMA | 9 (`auth`, `extensions`, `graphql`, `graphql_public`, `pgbouncer`, `realtime`, `storage`, `supabase_migrations`, `vault`) |
| EXTENSION | 4 (`pg_stat_statements`, `pgcrypto`, `supabase_vault`, `uuid-ossp`) |
| EVENT TRIGGER | 6 |
| PUBLICATION | 1 (`supabase_realtime`) |

Ключевые таблицы приложения подтверждены в TOC явно (и структура, и
data-секция для каждой): `profiles`, `flashcards`, `srs_state`,
`review_log`, `subscriptions`, `decks`, `vocabulary_items`.

RLS-политики на ключевых таблицах подтверждены в TOC: `decks: owner
full access`, `flashcards: owner full access`, `profiles: owner full
access`, `review_log: owner full access`, `srs_state: owner full
access`, `subscriptions: owner read only`, `vocabulary_items: owner
full access`.

## Test restore (не поверх production)

Выполнен `pg_restore` в **отдельную, временную** базу данных
(`backup_verify_test`) на локальном Postgres-инстансе (Docker,
`supabase_db_English_teacher_AI`, порт `54322` — тот же контейнер, что
используется для локальной разработки, но отдельная, специально
созданная для теста БД внутри него; существующая локальная
dev-БД `postgres` не затрагивалась).

Результат: **1 non-fatal ошибка**, все остальные ~500 операций
восстановления прошли успешно:

```
pg_restore: ошибка: could not execute query: ERROR:  permission denied for table secrets
```

Это — известная, ожидаемая особенность восстановления Supabase-дампа
в другой инстанс: относится к `vault.secrets` (инфраструктурная
таблица Supabase Vault для шифрованных секретов), не к таблицам
приложения. Проект не использует Vault для собственных данных — эта
ошибка не влияет ни на одну из таблиц LexReader.

Проверено после restore (только агрегатные счётчики, без вывода
содержимого строк):

| Проверка | Результат |
|---|---|
| Таблиц в `public` | 20 |
| `profiles` | 10 строк |
| `flashcards` | 979 строк |
| `srs_state` | 979 строк |
| `review_log` | 36 строк |
| `subscriptions` | 2 строки |
| `decks` | 14 строк |
| `vocabulary_items` | 44 строки |
| RLS (`rowsecurity`) включён на всех 7 ключевых таблицах | ✅ |
| RLS policies в `public` | 23 |
| Индексы на `flashcards`/`review_log`/`srs_state` | 4 / 1 / 2 |
| Триггеры в `public` (пример: `flashcards_free_limit`, `decks_free_limit`) | присутствуют |
| Функции в `public` | 5 |

Временная база `backup_verify_test` **удалена** сразу после проверки
(`DROP DATABASE`, подтверждено отсутствие в `pg_database`).

## Ограничения текущего Supabase-плана

Проект на тарифе **Free** — не включает Scheduled Backups и
Point-in-Time Recovery (подтверждено в Supabase Dashboard, Database →
Backups: "Free Plan does not include project backups. Upgrade to the
Pro Plan for up to 7 days of scheduled backups."). Этот ручной
`pg_dump` — единственная существующая защитная сеть до апгрейда плана
или следующего ручного backup.

## Процедура восстановления (если понадобится)

**Не выполнять без явного отдельного решения владельца.** В случае
необходимости:

```bash
PGPASSWORD='<пароль вводится вручную>' /usr/lib/postgresql/17/bin/pg_restore \
  --host="<production host>" \
  --port="<production port>" \
  --username="<production username>" \
  --dbname="<production database>" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --verbose \
  /home/sergey/Backups/lexreader/lexreader-production-before-0032-20260801-214649.dump
```

`--clean --if-exists` нужны только для полного восстановления поверх
уже существующей БД (пересоздание объектов) — использовать с крайней
осторожностью, отдельно подтверждая с владельцем, поскольку это
затронет реальные данные production. Восстановление в НОВЫЙ, пустой
Supabase-проект (без `--clean`) безопаснее для проверки/миграции.

## Запрет на коммит backup-файла

`/home/sergey/Backups/lexreader/*.dump` и `*.dump.sha256`
**никогда не должны попадать в Git** — каталог находится вне
репозитория, ни один коммит его не затрагивал и не должен затрагивать.
Этот документ описывает backup, но не содержит и не ссылается на
пароль, полную connection string, service role key, access token или
данные пользователей.

## Готовность к migration 0032

**Backup создан и проверен — предварительное условие для Phase B
(применение migration 0032) выполнено.**

## Migration 0032 — результат (Phase B, 2026-08-01)

Применена владельцем вручную через `psql` (тот же Session Pooler,
пароль вводился интерактивно в его терминале, не передавался
ассистенту). Полный transcript до/после — в
`fsrs-production-shadow-rollout.md`. Кратко: `BEGIN` / `ALTER TABLE` ×2
/ `COMMIT`, exit code `0`, без ошибок; количество строк в
`srs_state`/`review_log`/`flashcards` не изменилось; RLS-политики,
индексы и триггеры на этих двух таблицах — идентичны до и после.
Восстановление из этого backup не потребовалось.
