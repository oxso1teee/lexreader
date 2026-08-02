# FSRS Test Account Activation (Phase D — executed)

Статус: **выполнено**. FSRS authoritative включён **только для одного
тестового аккаунта** через `FSRS_ENABLED_USER_IDS`. Глобальный
`FSRS_ENABLED` не устанавливался и остаётся отсутствующим — ни для кого,
кроме этого одного аккаунта, поведение не изменилось.

## PR / merge / deployments

- PR: [github.com/oxso1teee/lexreader/pull/9](https://github.com/oxso1teee/lexreader/pull/9)
  (`feat: add account-level FSRS rollout`), смёржен squash в `main`.
- Merge SHA: `fd150ec5c1dca997c8a1797c978156f9a8559448`.
- Production deployment **до** активации allowlist'а: `dpl_4XSKBhzeofzfkfYmLvbn6uDBmaFb`
  (source = merge SHA, alias обновлён, status Ready) — smoke-тест на этом
  деплое подтвердил: `FSRS_ENABLED_USER_IDS` ещё не установлен → legacy
  preview (`1/1/1/4 дн`), ревью сохраняется, 0 ошибок консоли.
- Production deployment **после** установки `FSRS_ENABLED_USER_IDS` (redeploy
  того же билда, т.к. Vercel не подхватывает env-переменные без
  redeploy): `dpl_B1Eq4HNBTKUoDBxNkNYRxQWfZPsg` (alias обновлён, status
  Ready).

## Env state (production)

| Переменная | Значение |
|---|---|
| `FSRS_SCHEMA_READY` | `true` (без изменений) |
| `FSRS_ENABLED` | отсутствует (без изменений — **не включался**) |
| `FSRS_ENABLED_USER_IDS` | ровно один UUID тестового аккаунта |

Тестовый аккаунт (замаскированно): `eee0e646-...-aea90212ca86`
(`claude-hotfix-smoketest-20260801@example.com`) — полный UUID не
публикуется в PR/этом документе за пределами уже известного из предыдущих
фаз verification значения; сам email — тестовый адрес `@example.com`, не
реальный пользователь.

## Browser smoke (тестовый аккаунт, новая уникальная карточка)

Карточка: `fsrs-authoritative-test-20260802081900` /
`fsrs-authoritative-translation-20260802081900` (создана заново для этой
проверки, не переиспользует карточки прошлых фаз).

1. Brain (`/brain/[deckId]`) открылся, карточка создана.
2. Review (`/brain/[deckId]/review`) открылся, показал `1/1` для новой
   карточки.
3. Ответ раскрыт (`Показать ответ`).
4. **Interval preview показал FSRS-формулу**: `Не помню 1 дн / Трудно 2 дн /
   Помню 3 дн / Легко 8 дн` — не легаси-паттерн (`1/1/1/4 дн`, как было на
   этом же аккаунте ДО активации allowlist'а на карточке
   `pre-allowlist-check-word` минутами ранее). Это первое видимое
   доказательство, что `flags.enabled=true` для этого аккаунта.
5. Оценка "Помню" (grade=2) выбрана и сохранена.
6. Сессия завершилась ("Сессия завершена", Повторено слов: 1) без ошибок.
7. Консоль браузера — 0 сообщений об ошибках за весь цикл.

Другие аккаунты не создавались и не проверялись в рамках этого smoke —
allowlist затрагивает ровно один существующий тестовый аккаунт.

## PostHog

- Explore Events (`Last hour`): реальное событие `review_completed`
  (distinct_id = тестовый аккаунт, URL =
  `.../brain/[deckId]/review`) — появилось спустя ~2 минуты после
  сохранения оценки.
- Error Tracking: **0 захваченных исключений** — до и после активации
  allowlist'а.

## DB verification (read-only, независимо прочитано)

Скрипт: `/home/sergey/Backups/lexreader/verify-fsrs-authoritative.sql`
(`BEGIN; SET TRANSACTION READ ONLY;`, scoped по email тестового аккаунта
И по `front like 'fsrs-authoritative-test-%'` — ни данные других
пользователей, ни другие карточки этого аккаунта не читались).

Лог: `verify-fsrs-authoritative-output-20260802-082810.log`, прочитан и
разобран напрямую (не только по пересказу владельца). Результат для
карточки `fsrs-authoritative-test-20260802081900`:

| Поле | Значение | Комментарий |
|---|---|---|
| `scheduler_type` | `fsrs` | не `sm2` — FSRS авторитетен для этого ревью |
| `due_at` | `2026-08-05 05:22:40.075+00` | ровно `reviewed_at` (`2026-08-02 05:22:40`) **+3 дня** |
| `fsrs_scheduled_days` | `3` | совпадает с `due_at − reviewed_at` — due_at посчитан ИМЕННО по FSRS, не по legacy `interval_days=1` (что дало бы due_at на день раньше) |
| `ease_factor` / `interval_days` / `repetitions` | `2.5` / `1` / `1` | legacy-поля продолжают обновляться параллельно (dual-write, как и в shadow-режиме) — не заморожены |
| `fsrs_stability` / `fsrs_difficulty` / `fsrs_state` / `fsrs_lapses` / `fsrs_reps` | `2.3065` / `2.11810397` / `2` / `0` / `1` | shadow-поля заполнены как и раньше |
| `previous_state_json` / `next_state_json` | оба `true` (присутствуют) | содержимое не выводилось, только факт наличия |

Read-only транзакция завершена `COMMIT`, `psql` exit code `0`, ошибок нет.

## Rollback readiness

Не потребовался — активация прошла чисто. Процедура (см.
`docs/learning/fsrs-controlled-activation.md`, раздел Rollback) не
менялась: удалить UUID из `FSRS_ENABLED_USER_IDS` (или удалить переменную
целиком) → redeploy → `flags.enabled` для этого аккаунта мгновенно
возвращается в `false`, накопленная FSRS-история не теряется.

## Затронутые аккаунты

Ровно один — тестовый (`eee0e646-...`). Другие пользователи не
добавлялись в `FSRS_ENABLED_USER_IDS`, глобальный `FSRS_ENABLED` не
включался — поведение всех остальных аккаунтов (legacy authoritative +
FSRS shadow write) не изменилось этим шагом.

## Что дальше (не выполняется этим документом)

Критерии для более широкого/глобального rollout остаются перечисленными в
`docs/learning/fsrs-controlled-activation.md` ("Критерии для глобальной
активации") — отдельное явное решение владельца, требует накопления
достаточной истории на этом (и, возможно, дополнительных) тестовых
аккаунтах перед `FSRS_ENABLED=true`.
