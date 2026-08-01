# M0 — Текущее состояние LexReader (2026-08-01)

Обзорный документ. Детали по каждой области — в соседних файлах
этого каталога.

## Проект

- Путь: `/home/sergey/Документы/projects/English_teacher_AI`
- CONFIRMED: репозиторий `github.com/oxso1teee/lexreader`, ветка
  `main`, синхронизирована с `origin/main`, HEAD `5e3e07e`.
- CONFIRMED: package manager — **npm** (`package-lock.json`, нет
  pnpm/yarn/bun lockfile'ов). Node `v22.23.1`, npm `10.9.8` локально;
  CI (`.github/workflows/ci.yml`) закреплён на Node `20` —
  **RECOMMENDATION**: расхождение мажорных версий Node между локальной
  машиной и CI стоит явно унифицировать или задокументировать как
  осознанный выбор, чтобы не словить разницу в поведении.
- Скрипты `package.json`: `dev`, `build`, `start`, `lint`,
  `typecheck`, `test:import`, `test:extension`, `test:e2e`.
- CONFIRMED: проектные инструкции — `CLAUDE.md` (`@AGENTS.md`),
  `AGENTS.md` (предупреждение "это не тот Next.js, который ты знаешь"
  + правила graphify), `README.md`, `browser-extension/README.md`.
  `CONTRIBUTING.md` не найден.
- CONFIRMED: Next.js 16.2.10 в этом проекте использует **`src/proxy.ts`**
  вместо привычного `middleware.ts` — подтверждено и наличием файла, и
  выводом `next build` (`ƒ Proxy (Middleware)`).

## Масштаб кодовой базы

- `src/app`: 124 файла (33 реальных маршрута — см. `route-map.md`).
- `src/components`: 4 файла (общие переиспользуемые: EmptyState,
  ScreenHeader, MicButton, NavIcons).
- `src/lib`: 35 файлов.
- `supabase/migrations`: 30 файлов, 20 уникальных таблиц, 100% с RLS.
- `browser-extension`: 6 файлов (Manifest V3, минимальные permissions).
- `.github/workflows`: 2 (`ci.yml`, `push-reminders.yml`).
- Тесты: 2 unit-файла (10 тестов) + 5 e2e-файлов (11 тестов, 1 skip).

## Результаты проверок (Шаг 19) — ничего не исправлялось

| Команда | Exit code | Статус | Длительность | Причина (если не 0) |
|---|---|---|---|---|
| `npm ci` | 0 | Passed | 23.4с | — |
| `npm run typecheck` | 0 | Passed | 4.4с | — |
| `npm run lint` | 0 | Passed | 14.8с | — |
| `npm run test:import` | 0 | Passed | 0.6с (6 тестов) | — |
| `npm run test:extension` | 0 | Passed | 0.7с (4 теста) | — |
| `npm run build` | 0 | Passed | 33.0с | — |
| `npx playwright test --project=chromium` | 0 | Passed | 47.9с (10 passed, 1 skipped) | Skip — намеренный, требует `STRIPE_SECRET_KEY` |

Локальный Supabase (Docker) уже был поднят и здоров на момент аудита
— e2e запускался против него, отдельный `supabase start` не
требовался.

## Что уже реализовано и НЕ должно создаваться повторно

(Полный список — в `learning-srs-map.md`, `ai-analytics-map.md`,
`notifications-map.md`; здесь — сводка по трекам новой спецификации)

| Трек новой спецификации | Статус в текущем коде |
|---|---|
| 01 SaaS Foundation (billing/entitlements/usage ledger) | Stripe checkout+webhook+customer portal — ДА. Entitlements как отдельная сущность, usage ledger — НЕТ, сейчас простые лимиты в коде + DB-триггеры (`0019_free_tier_db_backstop.sql`) |
| 02 Product/UI (~70 страниц) | 33 реальных маршрута сейчас, дизайн-система/токены — частично (общие компоненты есть, формального токен-набора/Storybook нет) |
| 03 Learning Core/Language Twin/FSRS | SRS-система ЕСТЬ (SM-2-подобная, не FSRS), фразы как контент карточек ЕСТЬ, Language Twin/Phrase Skill Graph — НЕТ |
| 04 Realtime Voice/Pronunciation | НЕТ ничего — ни LiveKit, ни любого голосового AI |
| 05 Content Import (books/YouTube/audio/video) | URL/YouTube/PDF/OCR-фото — ДА (без AI-обработки контента сверх перевода слов). Аудио/видео-файлы, книги (EPUB) — НЕТ |
| 06 AI Architecture/Prompts/Evals | НЕТ ни одного LLM-провайдера в коде вообще (только MyMemory-перевод) |
| 07 Analytics/Notifications/Support/Retention | PostHog (аналитика+ошибки) ДА, push+cron ДА, достижения/стрик/квест ДА. Support-виджет, in-app changelog/roadmap-доски — частично (`/changelog` статичный есть, roadmap-доски нет) |
| 08 Security/Testing/Deployment/Release | RLS 100%, CI с typecheck/lint/build/e2e ДА, SSRF-guard ДА, upload-валидация ДА, admin-панель НЕТ, security-сканеры (Semgrep/Trivy/Gitleaks) НЕТ в CI |

## Главный вывод M0

Текущий LexReader — работающее, протестированное, задеплоенное
приложение с реальными пользователями, не пустой каркас. Основные
существующие системы (auth, RLS, Stripe, SRS, импорт, PostHog, push,
browser extension) — в рабочем состоянии, без критических
регрессий на момент этого прохода. Полная спецификация из 10 новых
файлов описывает объём работы, сопоставимый с постройкой нового
крупного продукта поверх этого фундамента — большая часть треков
04/06 (голос, AI-архитектура) не существует вообще, а трек 02 (~70
страниц) на порядок больше текущих 33 маршрутов.

Полный список блокеров и первая рекомендуемая задача — в
`release-blockers.md`.
