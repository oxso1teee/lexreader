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
  ошибкой. Требует заголовок `Authorization: Bearer <HEALTH_CHECK_SECRET>` —
  P0-АУДИТ 3.5: изначально был полностью открыт и мог использоваться для
  незаметного расхода общей дневной квоты MyMemory. Сгенерировать секрет:
  `openssl rand -hex 32`, задать `HEALTH_CHECK_SECRET` в переменных окружения
  Vercel и в настройках uptime-монитора (см. ниже).

## Продуктовая аналитика + error tracking (PostHog)

Подключено (2026-07-31). `NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_HOST`
заданы в Vercel и в `.env.local`.

**2026-08-01: не работало в проде до этой даты.** CSP (`next.config.ts`) не
пропускала ни скрипт posthog-js, ни его сетевые запросы — `script-src`/
`connect-src` не знали про хост из `NEXT_PUBLIC_POSTHOG_HOST` (EU-регион:
`eu.i.posthog.com`) и про его assets-CDN (`eu-assets.i.posthog.com`, куда
posthog-js грузит скрипт и откуда же фетчит remote-config). Итог: 0 событий
и 0 пойманных исключений в проекте с момента подключения. Теперь
`next.config.ts` выводит оба хоста из `NEXT_PUBLIC_POSTHOG_HOST` (та же
region-логика, что в самом posthog-js) и добавляет их в CSP.

- `src/lib/posthog-client.ts` + `src/app/posthog-provider.tsx` — клиентская
  часть, монтируется в `(app)/layout.tsx`, идентифицирует пользователя по
  `profile.id`.
- `src/lib/posthog-server.ts` — серверная часть (`posthog-node`): клиент
  создаётся на вызов и сразу `shutdown()` (serverless-функции могут
  заморозиться раньше фонового флаша).
- Продуктовые события (`captureServerEvent`/`track`): `signup_completed`,
  `onboarding_completed` (first-win flow), `word_saved` (только новые слова,
  `seenCount === 1`), `review_completed` (последняя карточка сессии),
  `paywall_viewed` (`/pricing`), `subscription_started` (Stripe-вебхук
  `checkout.session.completed`).
- Error tracking (`captureServerException`) — изначально планировался
  Sentry, но `sentry.io` стабильно отдаёт 403 при регистрации из нашей сети
  (воспроизведено дважды, в двух разных браузерах/сетях — похоже на
  IP-репутационную блокировку Cloudflare, а не проблему конкретной машины).
  PostHog уже подключён и имеет собственный продукт Error Tracking, поэтому
  используем `client.captureException()` вместо отдельного SDK:
  `src/app/api/translate/route.ts` (реальное исключение в catch-блоке
  перевода), `src/app/api/webhooks/stripe/route.ts` (весь свитч обработки
  событий обёрнут в try/catch — при ошибке возвращаем 500, чтобы Stripe
  повторил доставку), `src/app/(app)/library/actions.ts` /
  `youtube-actions.ts` (только `insert_failed`/`segments_insert_failed` —
  ошибки нашей собственной записи в БД; остальные `log.import` ветки вида
  "битая ссылка"/"нет субтитров" — это ожидаемое поведение при плохом
  пользовательском вводе, не баг, и уже видно в структурированных логах).

Если позже всё-таки захочется завести Sentry отдельно (например, с другой
сети) — старая инструкция: `npx @sentry/wizard@latest -i nextjs`, добавить
`Sentry.captureException(e)` в тех же местах.

### Uptime-мониторинг
Внешний сервис (UptimeRobot, Better Stack, Checkly — у всех есть бесплatный
тариф) — настроить проверку каждые несколько минут:
- `GET https://<домен>/` — доступность приложения.
- `GET https://<домен>/api/health/translate` с заголовком
  `Authorization: Bearer <HEALTH_CHECK_SECRET>` — доступность AI-провайдера
  перевода, алерт (email/Slack/Telegram — по каналу, который заведёшь в
  выбранном сервисе) при `503`/`401` дольше N минут подряд.

### Дашборд использования (P2-OBS-05)
Отдельная задача на будущее — агрегировать логи `log.translation`/`log.import`
в простой SQL-запрос по `translate_requests`/`auth_attempts` или в BI-тул,
когда появятся реальные пользователи и будет что агрегировать.
