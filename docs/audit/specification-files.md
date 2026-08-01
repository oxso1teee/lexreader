# M0 — Спецификационные файлы

Источник: `/home/sergey/Загрузки/english _apppp/` (обратите внимание на
пробел в имени папки — всегда в кавычках).

## Таблица файлов

| № | Имя | Путь | Размер | Строк | Статус чтения |
|---|---|---|---|---|---|
| 01 | LEXREADER_SAAS_FOUNDATION_FULL.md | `01_LEXREADER_SAAS_FOUNDATION_FULL.md` | 39 788 B | 1 993 | CONFIRMED — валидный UTF-8, структура просмотрена |
| 02 | LEXREADER_PRODUCT_UI_ALL_PAGES_FULL.md | `02_LEXREADER_PRODUCT_UI_ALL_PAGES_FULL.md` | 54 531 B | 3 907 | CONFIRMED — валидный UTF-8, структура просмотрена |
| 03 | LEXREADER_LEARNING_CORE_LANGUAGE_TWIN_FSRS_FULL.md | `03_LEXREADER_LEARNING_CORE_LANGUAGE_TWIN_FSRS_FULL.md` | 56 013 B | 3 684 | CONFIRMED — валидный UTF-8, структура просмотрена |
| 04 | LEXREADER_REALTIME_VOICE_PRONUNCIATION_FULL.md | `04_LEXREADER_REALTIME_VOICE_PRONUNCIATION_FULL.md` | 58 499 B | 3 846 | CONFIRMED — валидный UTF-8, структура просмотрена |
| 05 | LEXREADER_CONTENT_IMPORT_BOOKS_YOUTUBE_AUDIO_VIDEO_FULL.md | `05_LEXREADER_CONTENT_IMPORT_BOOKS_YOUTUBE_AUDIO_VIDEO_FULL.md` | 59 971 B | 3 997 | CONFIRMED — валидный UTF-8, структура просмотрена |
| 06 | LEXREADER_AI_ARCHITECTURE_PROMPTS_EVALS_FULL.md | `06_LEXREADER_AI_ARCHITECTURE_PROMPTS_EVALS_FULL.md` | 50 310 B | 3 304 | CONFIRMED — валидный UTF-8, структура просмотрена |
| 07 | LEXREADER_ANALYTICS_NOTIFICATIONS_SUPPORT_RETENTION_FULL.md | `07_LEXREADER_ANALYTICS_NOTIFICATIONS_SUPPORT_RETENTION_FULL.md` | 61 850 B | 4 346 | CONFIRMED — валидный UTF-8, структура просмотрена |
| 08 | LEXREADER_SECURITY_TESTING_DEPLOYMENT_PUBLIC_RELEASE_FULL.md | `08_LEXREADER_SECURITY_TESTING_DEPLOYMENT_PUBLIC_RELEASE_FULL.md` | 59 486 B | 4 439 | CONFIRMED — валидный UTF-8, структура просмотрена |
| 09 | LEXREADER_MASTER_EXECUTION_PLAN_FULL.md | `09_LEXREADER_MASTER_EXECUTION_PLAN_FULL.md` | 93 794 B | 5 198 | CONFIRMED — прочитан полностью |
| 10 | LEXREADER_REAL_REPOSITORY_AUDIT_AND_FIRST_ISSUES_FULL.md | `10_LEXREADER_REAL_REPOSITORY_AUDIT_AND_FIRST_ISSUES_FULL.md` | 62 206 B | 3 135 | CONFIRMED — прочитан полностью |

**Итого:** 10 из 10 файлов присутствуют, ровно с теми именами, что
указаны в задании. Дубликатов нет (проверено по md5 — все 10 хэшей
уникальны). Посторонних файлов в папке нет. Все читаются как
`text/plain; charset=utf-8` без ошибок кодировки.

Файлы не редактировались.

## Структура файлов 01–08 (просмотр, не полное чтение)

Каждый файл этой серии организован как самостоятельный вертикальный
трек новой платформы («SaaS Foundation», «Product/UI», «Learning
Core / Language Twin / FSRS», «Realtime Voice», «Content Import»,
«AI Architecture», «Analytics/Notifications/Support», «Security/
Testing/Deployment»). Общий паттерн, подтверждённый файлом 09
(Master Execution Plan) и файлом 10 (Repository Audit): все восемь
треков рассчитаны на выполнение ПОСЛЕ прохождения ворот M0–M2,
описанных в файле 09. Ни один из файлов 01–08 не содержит
самостоятельной оговорки «можно начинать без аудита» — наоборот, файл
10 явно построен как предшествующий шаг («реальный аудит репозитория
и первые issue»), а файл 09 — как оркестратор порядка исполнения
остальных восьми.

## Действия, запрещённые до прохождения ворот

Согласно файлу 09 (Master Execution Plan) и явным инструкциям текущей
команды пользователя: **не выполнять master-промпты файлов 01–08** до
завершения M0 (текущий аудит) и последующих ворот M1/M2 (не
исследовались подробно в этом проходе — вне рамок текущей команды,
которая ограничена только M0).

## Что из файлов 01–08 уже частично существует в текущем проекте

Предварительно, по итогам аудита реального кода (см. остальные файлы
этого каталога):

- Трек 03 (Learning Core / FSRS) — SRS-система уже существует
  (`src/lib/srs.ts`, `srs_state`, `review_log`), но использует
  собственный SM-2-подобный алгоритм, не `ts-fsrs`. См.
  `learning-srs-map.md`.
- Трек 07 (Analytics/Notifications) — PostHog product analytics и
  error tracking, push-уведомления через Vercel/GitHub Actions cron
  уже реализованы. См. `ai-analytics-map.md`, `notifications-map.md`.
- Трек 08 (Security/Testing/Deployment) — RLS на 100% таблиц, CI с
  typecheck/lint/build/E2E, security-хардненинг (rate limits,
  upload validation) — уже частично сделаны в истории проекта
  (P0-АУДИТ серии коммитов). См. `release-blockers.md`.
- Треки 01 (SaaS Foundation — billing/entitlements/usage ledger), 02
  (полная карта ~70 страниц), 04 (голосовой AI), 05 (расширенный
  импорт книг/аудио/видео), 06 (AI-архитектура/промпты/evals) — **не
  существуют** в текущем коде ни в каком виде, кроме простого
  MyMemory-перевода без LLM. Это подтверждает то же наблюдение, что
  было сделано по трём более ранним планирующим документам
  пользователя (`docs/FLUENCY_OS_VISION_ALL3_2026-07-31.html`):
  большая часть объёма — не существующая инфраструктура, которую
  предстоит строить с нуля.
