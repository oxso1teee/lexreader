# M0 — Авторизация и Stripe

## Полный путь авторизации

| Шаг | Файл | Заметки |
|---|---|---|
| Регистрация | `src/app/onboarding/actions.ts` (`completeOnboarding`) | `supabase.auth.signUp()` + rate-limit по email+IP (`src/lib/auth-rate-limit.ts`) |
| Подтверждение email | Через письмо Supabase Auth → `src/app/auth/callback/route.ts` | Стандартный Supabase flow, не кастомизирован сверх дефолта |
| Создание profile | `src/app/onboarding/actions.ts`, сразу после `signUp` | Не в триггере БД — в коде приложения; если `signUp` прошёл, а insert в `profiles` упал, аккаунт создаётся без профиля (см. BLOCKER ниже) |
| Онбординг | `src/app/onboarding/onboarding-wizard.tsx` → `src/app/(app)/onboarding/first-win/*` | Двухэтапный: базовые поля, потом управляемый первый цикл |
| Login | `src/app/login/actions.ts` + `login-form.tsx` | Rate-limit по email+IP, одинаковое сообщение об ошибке для неверного пароля и несуществующего email (анти-энумерация, подтверждено e2e) |
| Session refresh | `src/proxy.ts` | Единственное место обновления cookie сессии — вызывается на каждом запросе, кроме статики |
| Logout | Внутри `settings-client.tsx`/аналог (`supabase.auth.signOut()`) | NEEDS VERIFICATION — не открывал сам файл клиентского выхода отдельно в этом проходе, но `deleteAccount` вызывает `signOut()` явно |
| Password reset | `src/app/reset-password/*` | Полный цикл: запрос → письмо → `/reset-password/confirm` → новый пароль → логин; e2e проходит запрос **настоящего** письма (через локальный Inbucket) |
| Account deletion | `src/app/(app)/settings/delete-account-actions.ts` | Требует ввести слово «УДАЛИТЬ»; отменяет активную Stripe-подписку → `serviceClient.auth.admin.deleteUser()` → каскадные FK чистят остальные таблицы |
| Account export | `src/app/api/export/data/route.ts` (полный JSON), `src/app/api/export/vocabulary/route.ts` (CSV словаря) | Экспорт не включает Stripe customer/subscription ID и, естественно, номера карт (их никогда не было в БД — оплата целиком на стороне Stripe) |
| OAuth | Не найдено | Только email+пароль, OAuth-провайдеров нет |
| Active sessions | Не найдено отдельного UI | Supabase Auth сам управляет множественными сессиями, но в Settings нет экрана "активные устройства/выйти везде" |

BLOCKER (NEEDS VERIFICATION, не проверялось построчно в этом проходе):
если `supabase.auth.signUp()` в `completeOnboarding` успешен, но
последующий `insert` в `profiles` падает — по текущему коду
пользователь остаётся с рабочим auth-аккаунтом без строки в
`profiles`. `requireProfile()` в этом случае редиректит на
`/onboarding` бесконечно (`getProfile()` вернёт null, `signUp` уже
не сработает повторно на тот же email без ошибки "уже
зарегистрирован"). Это уже могло быть учтено где-то в коде (не
исключено, что обработка есть, просто не найдена в рамках беглого
чтения) — помечаю как NEEDS VERIFICATION, не как подтверждённый баг.

## Middleware / защита маршрутов

CONFIRMED: нет отдельного `middleware.ts`/`proxy.ts`-уровня защиты по
паттерну пути. Защита реализована на уровне `src/app/(app)/layout.tsx`,
который вызывает `requireProfile()` (редиректит на `/onboarding`, если
профиля нет) для всех страниц внутри группы `(app)`. `proxy.ts`
занимается только обновлением cookie сессии, не авторизацией.

## Stripe

| Проверка | Статус | Детали |
|---|---|---|
| Signature verification | CONFIRMED | `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)` — сырое тело, не распарсенный JSON |
| Raw webhook body | CONFIRMED | `await request.text()`, не `request.json()` — корректно для проверки подписи |
| Duplicate event protection | **BLOCKER (P1)** — не найдено | Нет таблицы обработанных `event.id`, нет проверки идемпотентности. Stripe официально может доставить одно событие больше одного раза; сейчас повторная доставка `checkout.session.completed` просто повторно выполнит `upsert` (не катастрофично благодаря `upsert`/`update`, но `captureServerEvent(..., "subscription_started", ...)` в PostHog задвоится) |
| Stripe customer mapping | CONFIRMED | `stripe_customer_id`/`stripe_subscription_id` в `subscriptions`, обновляются из вебхука |
| Transaction boundaries | NEEDS VERIFICATION | Обновления `subscriptions` — одиночные `upsert`/`update`, не обёрнуты в БД-транзакцию с чем-либо ещё; для текущей схемы (одна таблица на изменение) это, вероятно, не проблема, но не проверялось на предмет гонок при параллельных вебхуках по одному customer |
| Server-side source of truth | CONFIRMED | Явный комментарий в коде: "ТОЛЬКО эти вебхуки, никогда не доверять client-side редиректу" |
| Обработка неизвестных событий | CONFIRMED | `switch` без `default` — неизвестный `event.type` просто falls through, возвращается `{received: true}` (корректное поведение для Stripe — не должны 4xx/5xx-ить на события, которые не подписаны намеренно) |
| Поведение при ошибке БД | CONFIRMED (исправлено в этой сессии) | `processStripeEvent` обёрнут в `try/catch`; при исключении — `captureServerException` + возврат `500`, чтобы Stripe **повторил** доставку, а не посчитал успешной при неконсистентном состоянии БД |
| Production safeguards | CONFIRMED | `isStripeConfigured()` гейтит weekhook и checkout; в реальном проде при не настроенном Stripe pricing показывает честное "оплата недоступна", а не тестовую кнопку (фикс из этой же сессии, коммит `be0f2e8`) |
| Trial | CONFIRMED | `trial_period_days: 3` в `checkout.sessions.create`, `mapStripeStatus()` трактует `trialing` как `active` |
| Customer Portal | CONFIRMED | `billing-portal-button.tsx` — отдельная кнопка для управления подпиской |
| Cancellation | CONFIRMED | Через Customer Portal (реальный Stripe) либо `cancelSimulatedSubscription` (dev-режим) |
| Payment failure | CONFIRMED | `invoice.payment_failed` → `status: "past_due"`, UI показывает предупреждение с датой доступа |
| Refund support | NEEDS VERIFICATION | Нет отдельного UI/логики на стороне LexReader — вероятно, обрабатывается вручную через Stripe Dashboard, что нормально для текущего масштаба |
| Development simulation | CONFIRMED | `simulateSubscribe`/`cancelSimulatedSubscription` в `pricing/actions.ts`, гейтится `!isStripeConfigured() && !isRealProduction` — в реальном проде без ключей показывается "недоступно", не тестовая кнопка |

**Текущий статус прод-Stripe: CONFIRMED неактивен.** `isStripeConfigured()`
возвращает `false` в реальной продакшен-среде — ключи не заданы в
Vercel. Оплата физически недоступна ни одному пользователю прямо
сейчас. Это не баг этой сессии, а существующее состояние.
