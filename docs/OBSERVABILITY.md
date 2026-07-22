# Observability

## Что уже есть

- **Структурированные логи** (`src/lib/log.ts`) — JSON-строки в stdout/stderr для
  трёх типов событий: `translation` (успех/кеш/ошибка/rate-limit/квота, с
  латентностью), `import` (URL/YouTube/фото/CSV, успех/ошибка+причина),
  `subscription` (события Stripe-вебхука). На Vercel эти логи автоматически
  попадают в Runtime Logs — можно подключить Log Drain в любой агрегатор
  (Datadog, Better Stack, Axiom и т.п.) без изменений в коде.
- **Health-check перевода**: `GET /api/health/translate` — реально переводит
  тестовое слово через MyMemory, возвращает `{ok, latencyMs}` или `503` с
  ошибкой. Публичный (без авторизации) — так и должно быть для health-check,
  которые дёргают внешние uptime-мониторы.

## Что нужно подключить (требует твоего аккаунта — я не могу завести его сам)

### Error tracking (Sentry или аналог)
Не подключал реальный SDK — библиотека `@sentry/nextjs` требует `SENTRY_DSN`
из реального проекта в Sentry (создать самому: sentry.io → New Project →
Next.js). После этого:
1. `npm install @sentry/nextjs`
2. `npx @sentry/wizard@latest -i nextjs` — интерактивный мастер настроит
   `instrumentation.ts`, `sentry.client.config.ts`, оборачивание
   `next.config.ts` и т.д. автоматически под установленную версию SDK.
3. Добавить `Sentry.captureException(e)` в catch-блоках ключевых путей:
   `src/app/api/translate/route.ts` (после `log.translation({outcome: "error"})`),
   `src/app/api/webhooks/stripe/route.ts` (ошибки обработки событий),
   `src/app/(app)/library/actions.ts` / `youtube-actions.ts` (после
   `log.import({outcome: "error"})` — места уже размечены).

### Uptime-мониторинг
Внешний сервис (UptimeRobot, Better Stack, Checkly — у всех есть бесплatный
тариф) — настроить проверку каждые несколько минут:
- `GET https://<домен>/` — доступность приложения.
- `GET https://<домен>/api/health/translate` — доступность AI-провайдера
  перевода, алерт (email/Slack/Telegram — по каналу, который заведёшь в
  выбранном сервисе) при `503` дольше N минут подряд.

### Дашборд использования (P2-OBS-05)
Отдельная задача на будущее — агрегировать логи `log.translation`/`log.import`
в простой SQL-запрос по `translate_requests`/`auth_attempts` или в BI-тул,
когда появятся реальные пользователи и будет что агрегировать.
