# FSRS Release Review

Контрольная проверка ветки `feature/fsrs-migration` перед push и открытием
draft PR. Ничего в production не менялось (см. "Production prerequisites"
в конце).

## Commit range

```
e311331 docs: document FSRS rollout and rollback
50d5699 refactor: route review scheduling through FSRS
934b2b1 feat: add ts-fsrs scheduling adapter
80ac651 feat: add additive FSRS state migration
bba782b test: add baseline coverage for SRS scheduling
6d7586a docs: add M0 current repository audit
```
плюс два новых коммита этого этапа (fix + docs, см. "Шаг 12" ниже).
Базовый коммит: `merge-base origin/main HEAD` = `5e3e07e` (совпадает с
`origin/main`/`main` на момент проверки).

## File scope

`git diff --name-status origin/main...HEAD` — 28 файлов + 2 новых из этой
проверки (`src/lib/fsrs.test.ts` дополнен, `docs/learning/fsrs-release-review.md`,
`docs/learning/fsrs-study-settings-gap.md`). Все укладываются в ожидаемые
категории: M0-аудит (унаследован из `audit/m0-current-state`, на которой
базируется эта ветка), FSRS-миграция, адаптер, тесты, интеграция ревью,
`.env.local.example`, `package.json`/`package-lock.json`, FSRS-документация.
Посторонних файлов (`AGENTS.md`, `.codex/`, `.gitattributes`, `graphify-out/`,
HTML-артефакты) в diff нет — подтверждено `git diff --name-status` до push.

## Package version

`ts-fsrs@5.4.1`, MIT, `engines.node >= 20.0.0`, 0 рантайм-зависимостей.

## Migration review

`supabase/migrations/0032_fsrs_state.sql`:

- Только `alter table ... add column` — additive, без `drop`/`rename`.
- Старые поля (`ease_factor`, `interval_days`, `repetitions`, `due_at`,
  `last_reviewed_at`, `first_reviewed_at`) не тронуты.
- Безопасные default: `fsrs_lapses`/`fsrs_reps`/`fsrs_scheduled_days` — `0`,
  `scheduler_type` — `'sm2'` (корректно для всей истории до этой фазы),
  `fsrs_stability`/`fsrs_difficulty`/`fsrs_state` — nullable (нет данных до
  первого ревью под новой схемой), `previous_state_json`/`next_state_json`
  — nullable.
- RLS не меняется — новые колонки принадлежат тем же таблицам,
  существующие политики `"srs_state: owner full access"` /
  `"review_log: owner full access"` (из `0004_decks.sql`) применяются к
  строкам целиком.
- Номер `0032` не конфликтует — следующий файл после `0031_feedback.sql`.
- `alter table add column` без `if not exists` — тот же стиль, что и во
  всех предыдущих миграциях проекта (например, `0016_srs_first_reviewed_at.sql`);
  идемпотентность обеспечивается инфраструктурой Supabase CLI
  (`supabase_migrations.schema_migrations`), а не SQL-guard'ами — не новый
  риск, а существующий по всему проекту паттерн.
- Применено только локально, проверено напрямую SQL (см. `fsrs-test-report.md`):
  64 существующие строки `srs_state` сохранены, `fsrs_stability` у всех
  `null` сразу после миграции.

## Feature flag review

`grep -RIn FSRS_ENABLED .` (исключая `node_modules`/`.next`) показывает
единственное место чтения — `process.env.FSRS_ENABLED === "true"` в
`isFsrsEnabled()` (`src/lib/fsrs.ts`), вызывается только из серверного кода
(`reviewWord` в `actions.ts`, `page.tsx`). Клиентские компоненты получают
уже вычисленное булево как проп только для косметического выбора формулы
предпросмотра интервала — реальное сохранение оценки не принимает флаг
параметром снаружи, каждый раз читает `process.env` заново на сервере.
Отсутствие переменной / любое значение, кроме точной строки `"true"`
→ `false` → SM-2 авторитетен. Задокументировано в `.env.local.example`.
Реальное production-значение нигде не закоммичено (`.env.local`
в `.gitignore`, только `.env.local.example` в git).

## Shadow mode behavior

Факты, установленные проверкой:

1. FSRS считается на КАЖДОМ ревью, независимо от `FSRS_ENABLED`.
2. FSRS-поля `srs_state` сохраняются на каждом ревью, независимо от флага
   (пока shadow-расчёт не падает — см. следующий раздел).
3. `review_log.scheduler_type` записывается всегда — `"fsrs"`, только если
   FSRS одновременно (а) включён флагом и (б) shadow-расчёт для этой
   карточки прошёл успешно; иначе `"sm2"`.
4. `due_at` определяет тот алгоритм, который сейчас реально авторитетен
   (`fsrsAuthoritative = fsrsEnabled && fsrsResult !== null`).
5. **Да, до этой проверки shadow-расчёт МОГ сломать legacy-ревью** — см.
   ниже, это и есть критическая находка Шага 5.
6. После исправления — да, есть безопасная обработка ошибки (try/catch +
   `null`-результат, без утечки приватных данных в лог).

## Fallback behavior (критическая находка и исправление)

**До исправления**: `reviewFsrsCard()` вызывался в `actions.ts`
безусловно, без try/catch. Любое исключение внутри (повреждённая форма
строки БД, будущая крайняя ситуация в `ts-fsrs`) обрывало всю функцию
`reviewWord()` ДО записи `srs_state`/`review_log` — то есть ломало и
legacy SM-2 повторение тоже, даже при `FSRS_ENABLED=false`. Это прямо
нарушало критическое требование задания.

**Исправление** (`src/lib/fsrs.ts`): добавлена обёртка
`computeFsrsShadowSafe()` — вызывает `reviewFsrsCard()` в try/catch,
при ошибке логирует `console.error("[fsrs] shadow calculation failed...", error.message)`
(только текст ошибки, без содержимого строки `srs_state`/карточки/id
пользователя) и возвращает `null`. `actions.ts` теперь:

- использует `computeFsrsShadowSafe` вместо прямого вызова;
- `dueAt = fsrsAuthoritative ? fsrsResult.dueAt : legacyDueAt` — при
  `fsrsResult === null` откат на legacy происходит независимо от значения
  флага (более консервативно, чем буквально требовало задание: если FSRS
  падает, доверять его результату нельзя, даже когда флаг включён);
- FSRS-поля в `.update()` добавляются только когда `fsrsResult` не `null`
  — при сбое существующие значения в БД просто не трогаются;
  `review_log` пишет `previous_state_json`/`next_state_json` как `null`,
  `scheduler_type: "sm2"`.
- легаси SM-2 расчёт (`legacyNext`, `legacyDueAt`) не зависит от FSRS и
  вычисляется раньше — сбой FSRS никак не мешает ему завершиться.

Тест: `src/lib/fsrs.test.ts` → `computeFsrsShadowSafe(): не бросает
исключение и возвращает null, если reviewFsrsCard упал` — передаёт
заведомо невалидный `row` (`null as any`, имитация повреждённой формы
данных), проверяет отсутствие исключения, `null`-результат, факт
логирования и отсутствие строки `"srs_state"` в залогированном тексте.
Плюс тест на happy-path (`computeFsrsShadowSafe` при валидных данных даёт
тот же результат, что прямой вызов `reviewFsrsCard`).

## Транзакционность (Шаг 6)

`reviewWord()` делает: (1) `srs_state.update()`, (2) `review_log.insert()`,
(3) `touchStreak()`, (4) `checkAndAwardAchievements()`, (5) `addXp()`,
(6) `revalidatePath()` — шесть последовательных операций, не обёрнутых в
транзакцию/RPC. Проверено по `git show 50d5699` (диф коммита FSRS-рефакторинга):
**эта неатомарность существовала и ДО FSRS** — до миграции было ровно два
последовательных вызова (`update` на `srs_state`, затем `insert` в
`review_log`) с тем же риском частичной записи при сбое сети/БД между
ними. FSRS не добавил новую точку частичной записи — только больше полей
в те же два уже существовавших вызова, по той же схеме.

**Вывод**: не исправлено в этой ветке (буквально по инструкции задания —
не смешивать transaction-рефакторинг с этим PR, раз FSRS не ухудшил
ситуацию). Follow-up предложение (не заведено как реальный GitHub Issue —
только зафиксировано здесь как рекомендация): обернуть `srs_state.update`
+ `review_log.insert` в одну Postgres-функцию (`rpc`), вызываемую одной
сетевой операцией — снижает, хотя и не убирает полностью (сама функция
может успеть частично при отключении соединения посреди выполнения без
транзакционного `BEGIN`/`COMMIT` в самой функции — нужно проверить, что
тело RPC обёрнуто в неявную транзакцию Postgres, что верно по умолчанию
для функций, но стоит явно перепроверить при реализации), окно между
двумя записями.

## Test results (Шаг 9)

| Команда | Exit code | Результат |
|---|---|---|
| `npm run typecheck` | 0 | чисто |
| `npm run lint` | 0 | чисто |
| `npm run test:import` | 0 | 6/6 passed |
| `npm run test:extension` | 0 | 4/4 passed |
| `npm run test:srs` | 0 | 10/10 passed |
| `npm run test:fsrs` | 0 | 12/12 passed (10 из M2-фазы + 2 новых: happy-path и fallback для `computeFsrsShadowSafe`) |
| `npm run build` | 0 | все 32 маршрута, `ƒ Proxy (Middleware)` на месте, только pre-existing предупреждение `metadataBase` |
| `npm run test:e2e` | 0 | 10 passed, 1 skipped (реальный Stripe checkout — ожидаемо без `STRIPE_SECRET_KEY`), 0 failed. Флакинес на этом прогоне НЕ проявился (в отличие от прогона в фазе M2, где `onboarding-first-win.spec.ts` один раз дал ложный сбой и был перепроверен) — в этот раз все 11 тестов (10 + 1 skip) прошли с первого раза, без необходимости повтора |

## Browser verification (Шаг 10)

Инструменты браузера были доступны и использованы полностью в этой
проверке (в отличие от фазы M2, где произошёл разрыв MCP-соединения).
Пройдено вживую, с реальным логином `test@example.com`, оба значения
флага:

**`FSRS_ENABLED=false` (сборка с этим значением по умолчанию, переменная
не задана):**
1. Открыт `/brain/all/review` — сессия из 3 карточек.
2. Предпросмотр интервалов на кнопках: `Не помню 1 дн / Трудно 1 дн /
   Помню 1 дн / Легко 4 дн` — точное совпадение с `DEFAULT_SRS_PARAMS`
   (legacy-формула).
3. Оценена карточка 1 (`Помню`) → переход на карточку 2/3, счётчик ✅1.
4. Пройдены все 3 карточки (❌1 🟠0 ✅1 ⭐1) → экран "Сессия завершена",
   "Повторено слов: 3", "🏆 Новый личный рекорд сессии!", "Стрик: 11".
5. `/brain` → "🎉 Всё повторено!" (due count корректно обнулился).
6. `/progress` → "лучшая сессия ✅ 3", "карточек повторено в день 11",
   "лучший стрик 🔥 11" — статистика учла сессию корректно.

**`FSRS_ENABLED=true` (пересобрано и перезапущено с этим значением,
3 карточки принудительно возвращены в очередь через SQL — `due_at = now()
- 1h`, только для сдвига очереди, не для подмены алгоритма):**
1. Предпросмотр интервалов на первой карточке: `1 дн / 2 дн / 3 дн / 4 дн`
   — другой паттерн, чем у legacy (не `1/1/1/4`), что ожидаемо: карточка
   уже несла накопленное shadow-состояние FSRS с более раннего ревью (не
   `createEmptyCard()` с нуля) — прямое живое подтверждение дизайна
   "не стартовать историю заново при включении флага" из `fsrs-rollout.md`.
2. Пройдены все 3 карточки (grade 2, 0, 3 соответственно) → "Сессия
   завершена", "Повторено слов: 3", "Стрик: 11".
3. Прямая проверка в БД по всем трём id: все три строки
   `review_log.scheduler_type = "fsrs"`, `due_at` в `srs_state` в точности
   совпадает с тем, что показывал предпросмотр (например, карточка с
   предпросмотром "Легко → 4 дн" получила `due_at` через 4 дня от момента
   ревью).

**Не проверено вживую в браузере в этой фазе**: реальный screenshot
(инструмент скриншота в этой сессии таймаутит — `computer{action:
"screenshot"}` дважды не ответил за 30с; не переиспользована информация
из старого скриншота, которого и не было — честно фиксирую отсутствие
визуального пруфа, вся проверка опирается на `get_page_text`/`read_page`
и прямые SQL-запросы, что для полноты не заменяет визуальный осмотр
CSS/вёрстки, но полностью покрывает функциональное поведение). Ручная
проверка live-БД оператором перед production activation всё равно
рекомендуется отдельно, независимо от этого отчёта.

## Study Settings gap

Новый документ [`docs/learning/fsrs-study-settings-gap.md`](fsrs-study-settings-gap.md):
`new_cards_per_day`/`max_reviews_per_day`/`study_direction`/`show_timer`/
`autoplay_audio` работают при любом значении флага; `starting_ease`/
`easy_bonus`/`interval_modifier`/`graduating_interval_days`/
`easy_interval_days` — только при `FSRS_ENABLED=false`, инертны при
`true` (не имеют аналога в модели FSRS); `max_interval_days` — единственное
поле с прямым переносом в `generatorParameters.maximum_interval`. Экран
`/brain/settings` не менялся — не блокирует shadow rollout (пользователь
не видит расписание FSRS, пока флаг выключен), но рекомендуется решить
до **полного** включения `FSRS_ENABLED=true` для всех пользователей
(не для этой ветки — отдельное решение).

## Production prerequisites (что требует отдельного подтверждения)

1. Применение `supabase/migrations/0032_fsrs_state.sql` к продакшен-БД —
   не выполнялось.
2. Установка `FSRS_ENABLED=true` в переменных окружения Vercel (production)
   — не выполнялось.
3. Решение по неактивным при FSRS полям Study Settings (см. выше) — не
   принято, не блокирует merge/shadow rollout, блокирует только полный
   rollout флага на всех пользователей.

## No-go conditions (что должно остановить эту ветку, если бы обнаружилось)

- Любой `drop`/переименование в миграции — не обнаружено.
- Падение shadow-расчёта, ломающее legacy-ревью при `FSRS_ENABLED=false`
  — обнаружено и исправлено в этой же проверке (см. "Fallback behavior").
- Клиентский флаг как единственная защита — не обнаружено, флаг
  server-only.
- Регрессия в существующих тестах/сборке/e2e — не обнаружено, все
  зелёные.
- Посторонние файлы в scope ветки — не обнаружено.

Ни одно из условий не сработало после исправления фолбэка — ветка готова
к push и открытию draft PR.

## Rollback

Без изменений относительно `fsrs-rollout.md`: `FSRS_ENABLED=false` (или
удаление переменной) — мгновенный откат, данные FSRS не теряются и не
мешают SM-2, миграция не требует отдельного отката (additive).
