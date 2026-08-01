# FSRS Production Rollout — Phase 1

> **Обновлено в FSRS Schema Compatibility Hotfix** (2026-08-01): причина
> инцидента ниже (раздел "Known limitations", пункт 1) устранена —
> см. `fsrs-schema-compatibility.md` за полным разбором фикса. Сам
> инцидент и его временное решение (откат деплоя) оставлены ниже без
> изменений — это исторический факт этой фазы, а не то, что нужно
> переписывать задним числом.

Статус: **остановлено, production код откачен**. PR смёржен, но
деплой немедленно вызвал вероятный сбой сохранения ревью для реальных
пользователей (схема БД и код разошлись), поэтому деплой был откачен
до предыдущего рабочего коммита в рамках этой же фазы. Миграция `0032`
к production не применялась. `FSRS_ENABLED` не включался.

## PR

[github.com/oxso1teee/lexreader/pull/1](https://github.com/oxso1teee/lexreader/pull/1)
— переведён из Draft в Ready for Review, смёржен (squash merge).

## Merge SHA

`f116aaa7e8f653e3f511660896783aeb3ba53a0a` — squash-merge в `main`,
заголовок `feat: migrate review scheduling to FSRS behind a server
flag`. Ветка `feature/fsrs-migration` не удалена.

## Инцидент и откат

1. После merge Vercel автоматически задеплоил `f116aaa` в production
   (`dpl_9S7prjtP3SsV2WvRx8GbSRtFauAN`, подтверждено через GitHub commit
   status `Vercel: success` на этот SHA).
2. При проверке production prerequisites обнаружено: backup/PITR для
   production Supabase **отсутствуют** (см. ниже) — миграцию `0032`
   решено не применять до отдельного решения по бэкапам.
3. **Найден риск**: задеплоенный код `reviewWord()`
   (`src/app/(app)/brain/[deckId]/review/actions.ts`) безусловно читал
   и писал колонки `fsrs_stability`, `fsrs_difficulty`, `fsrs_state`,
   `fsrs_lapses`, `fsrs_reps`, `fsrs_scheduled_days`
   (`srs_state`) и `scheduler_type`, `previous_state_json`,
   `next_state_json` (`review_log`) — которых в production схеме ещё
   не было, поскольку миграция не применялась. PostgREST (на который
   опирается Supabase JS client) отклоняет запросы к несуществующим
   колонкам — то есть реальное сохранение оценки в production было,
   вероятно, полностью сломано для всех пользователей с момента этого
   деплоя.
4. **Принято решение немедленно откатить деплой**, не дожидаясь
   миграции (по явному указанию: "не применяй migration 0032 без
   backup/PITR", "откатывай production deployment").
5. Выполнено: `vercel rollback https://lexreader-c3h6fuwyg-meeeee4.vercel.app`
   — production alias `lexreader.vercel.app` переключён обратно на
   `dpl_6TJL1goUGP2tdbsLVvvvMTf3whXe`, соответствующий коммиту
   `5e3e07e608ba14d668d07a6387f29169ce2e2713` (последний коммит `main`
   ДО этого merge).
6. **Позже, отдельным hotfix'ем** (`fix/fsrs-column-fallback`,
   commit `bf4b4ad`, см. "Known limitations" ниже): смёржен и
   задеплоен код с error-driven fallback (`isMissingFsrsColumnsError`),
   после чего **ещё раз, отдельным** hotfix'ем
   (`fix/fsrs-schema-compatibility`, эта же фаза документа) — полная
   двухфлаговая модель (`FSRS_SCHEMA_READY`/`FSRS_ENABLED`), см.
   `fsrs-schema-compatibility.md`. На момент последнего обновления этого
   документа production code задеплоен, но **`FSRS_SCHEMA_READY` и
   `FSRS_ENABLED` не включены** — миграция 0032 всё ещё не применена к
   production (тот же блокер — backup/PITR).

## Production deployment SHA (на момент инцидента и отката)

`5e3e07e608ba14d668d07a6387f29169ce2e2713` — подтверждено: `vercel
inspect https://lexreader.vercel.app` показывал `dpl_6TJL1goUGP2tdbsLVvvvMTf3whXe`
сразу после отката. Актуальный SHA production на момент публикации
этого обновления документа — вне scope этого файла, см. текущий
`vercel ls`/`git log origin/main` для точного состояния.

## Backup/PITR confirmation

**Отсутствуют.** Проверено напрямую в Supabase Dashboard (Database →
Backups → Scheduled backups, авторизованная сессия владельца, только
чтение, project `lexreader`):

> "Free Plan does not include project backups. Upgrade to the Pro Plan
> for up to 7 days of scheduled backups."

Организация на тарифе **Free**. Point-in-time recovery — платная
функция уровня Pro и выше, при отсутствии даже базовых бэкапов на Free
однозначно тоже недоступна. Это подтверждённое отсутствие защитной
сети, а не "не удалось проверить".

## Migration status

**Не применена.** `supabase/migrations/0032_fsrs_state.sql` остаётся
только в репозитории и в локальной БД разработки.

## Row counts / schema / RLS verification

Не применимо — миграция не выполнялась, состояние production БД не
менялось на всём протяжении этой фазы.

## PostHog / error tracking

Проверено (`eu.posthog.com`, проект lexreader, раздел Error Tracking,
только чтение) в окне между деплоем и откатом: "You haven't captured
any exceptions" — заметных исключений через этот канал не
зафиксировано. Оговорка: раздел показывает как не до конца
настроенный exception autocapture, поэтому отсутствие записей здесь не
является исчерпывающим доказательством отсутствия реальных ошибок —
основной сигнал об инциденте пришёл из статического анализа кода
(колонки, которых нет в схеме), а не из error tracking.

## Known limitations

1. ~~**Причина инцидента**: аддитивная миграция и код, который на неё
   опирается, применялись раздельно, а сам код безусловно (независимо
   от `FSRS_ENABLED`) обращался к колонкам новой миграции для shadow-
   вычислений.~~ **Устранено.** Сначала — точечный error-driven fix
   (`fix/fsrs-column-fallback`, `isMissingFsrsColumnsError`), затем —
   полная двухфлаговая модель `FSRS_SCHEMA_READY`/`FSRS_ENABLED`
   (`fix/fsrs-schema-compatibility`), которая решает ДО отправки
   запроса, какие колонки вообще упоминать, вместо того чтобы
   полагаться только на перехват ошибки постфактум. См.
   `fsrs-schema-compatibility.md`.
2. Backup/PITR отсутствуют на текущем тарифе Supabase (Free) — блокирует
   любую будущую попытку применить `0032`. **Не устранено**, требует
   отдельного решения владельца (апгрейд плана или ручной снимок).
3. CI e2e-проверка red по несвязанной причине (Node 20 vs требование
   Node 22+ для `@supabase/realtime-js`) — не относится к этому
   инциденту, отдельный follow-up. **Не устранено**.
4. Study Settings gap — без изменений, см.
   `docs/learning/fsrs-study-settings-gap.md`, не относится к текущему
   инциденту.

## Rollback (выполнен на момент инцидента)

```
vercel rollback https://lexreader-c3h6fuwyg-meeeee4.vercel.app
```
Production `lexreader.vercel.app` → `dpl_6TJL1goUGP2tdbsLVvvvMTf3whXe`
(commit `5e3e07e`). Production Supabase не менялся — откатывать в БД
нечего.

## Безопасный план повторного rollout (обновлён)

1. **Backup/PITR сначала** — апгрейд Supabase-проекта на Pro-план (даёт
   scheduled backups + опцию PITR) ИЛИ ручной `pg_dump`-снимок
   production БД как временная мера. Отдельное решение владельца,
   **не выполнено**.
2. ~~Устранить причину инцидента в коде~~ — **выполнено**
   (`fix/fsrs-schema-compatibility`, двухфлаговая модель).
3. Применить `0032_fsrs_state.sql` к production сразу после (1).
4. Установить `FSRS_SCHEMA_READY=true` в production сразу после (3), в
   одном контролируемом окне — код к этому моменту уже безопасен и
   деплоится отдельно от применения миграции (Phase A/B/C/D, см.
   `fsrs-schema-compatibility.md`).
5. Провести production smoke test (логин, review session, все 4
   кнопки, due count, statistics) — с заранее заведённым безопасным
   тестовым аккаунтом в production.
6. Понаблюдать за shadow-данными некоторое время (`FSRS_SCHEMA_READY=true`,
   `FSRS_ENABLED` остаётся `false`).
7. Только после этого — отдельная, явно запрошенная Phase 2 (решение
   о `FSRS_ENABLED=true`).

`FSRS_ENABLED`/`FSRS_SCHEMA_READY` остаются `false`/не заданы на всём
протяжении этой фазы. FSRS не включался ни на одном этапе. Language
Twin не начинался.
