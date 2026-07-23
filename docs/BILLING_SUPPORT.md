# Биллинг: настройка, возвраты, чарджбэки

## Как активировать реальную оплату

Код полностью готов (`src/lib/stripe.ts`, `src/app/(app)/pricing/actions.ts`,
`src/app/api/webhooks/stripe/route.ts`), но не активен без реального Stripe-аккаунта —
его может завести только владелец продукта, агент не может создавать аккаунты от чужого имени.

1. Зарегистрировать аккаунт на https://dashboard.stripe.com (тестовый режим включён по умолчанию).
2. Dashboard → Product catalog → создать продукт "LexReader Premium" с двумя recurring Price:
   месячный и годовой (суммы — как на `/pricing`, сейчас 449₽/мес и 4490₽/год).
3. Dashboard → Developers → API keys → скопировать Secret key.
4. Dashboard → Developers → Webhooks → добавить endpoint `https://<домен>/api/webhooks/stripe`,
   подписать на события: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
   `customer.subscription.deleted`. Скопировать Signing secret.
5. Задать переменные окружения (Vercel → Project → Settings → Environment Variables):
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` — ID цен из шага 2 (`price_...`)
   - `NEXT_PUBLIC_SITE_URL` — реальный домен продакшена
6. Dashboard → Settings → Billing → Customer portal — включить (нужен для кнопки
   «Управление подпиской»).
7. Проверить в тестовом режиме Stripe (тестовые карты `4242 4242 4242 4242`) весь цикл: оплата →
   `/library` → активный план на `/pricing` → отмена через портал → доступ пропадает по окончании
   оплаченного периода.

Пока `STRIPE_SECRET_KEY` не задан, `/pricing` автоматически показывает локальную тестовую кнопку
(`simulateSubscribe`) вместо реального Stripe Checkout — это не баг, а намеренный fallback для
разработки без реального аккаунта (см. `isStripeConfigured()` в `src/lib/stripe.ts`). Сама функция
теперь не работает вовсе, если `isStripeConfigured()` вернёт true (P0-АУДИТ 2.2), так что после
активации реальной оплаты она автоматически перестаёт быть достижимой.

**Важно перед реальным запуском**: если кто-то успел воспользоваться `simulateSubscribe` во время
беты (бесплатный тестовый Premium), после подключения настоящего Stripe эти строки в
`subscriptions` останутся активными до истечения своего `current_period_end` (30/365 дней от
момента активации), никак не помеченные как "ненастоящие", кроме отсутствия `stripe_customer_id`.
Разовая проверка перед запуском для реальных пользователей:
```sql
select owner_id, plan, current_period_end from subscriptions
where status = 'active' and stripe_customer_id is null;
```
Реши: оставить (бесплатный подарок первым тестерам) или обнулить вручную (`update subscriptions
set status = 'canceled' where stripe_customer_id is null`).

## Промокоды

Не реализована собственная логика промокодов — вместо этого Stripe Checkout создаётся с
`allow_promotion_codes: true`. Промокоды заводятся в Stripe Dashboard → Product catalog →
Coupons/Promotion codes, привязываются к конкретным Price. Это осознанно исключает класс багов
вида «два похожих, но разных промокода на соседних тарифах» — Stripe сам не даст создать
неоднозначную конфигурацию.

## Возвраты (refunds)

- Разовый возврат: Stripe Dashboard → Payments → найти платёж → Refund. Полный или частичный.
- Программно (для будущей admin-панели): `stripe.refunds.create({ payment_intent })`.
- После возврата подписки Stripe сам не отменяет доступ автоматически, если возврат частичный —
  для полного возврата с отменой подписки дополнительно вызвать
  `stripe.subscriptions.cancel(subscriptionId)` (или отменить вручную в Dashboard), что сгенерирует
  `customer.subscription.deleted` и наш вебхук сам переведёт `subscriptions.status` в `canceled`.

## Чарджбэки (disputes)

- Stripe уведомляет вебхуком `charge.dispute.created` (сейчас не обрабатывается — если объём
  чарджбэков станет заметным, добавить обработчик, который отмечает подписку `status: 'disputed'`
  и/или уведомляет команду).
- Общий процесс: Dashboard → Disputes → предоставить доказательство (переписка, лог активности
  аккаунта, IP/user-agent на момент оплаты) до дедлайна, который указывает Stripe (обычно 7–21 день
  в зависимости от платёжной системы).
- Рекомендация: прежде чем оспаривать чарджбэк, связаться с пользователем напрямую — часто дешевле
  и быстрее договориться, чем проходить полный dispute-процесс.

## Grace period при неудачном списании

`invoice.payment_failed` переводит подписку в `status: 'past_due'`, но доступ не отключается сразу —
`getPlan()` (`src/lib/subscription.ts`) даёт ещё `PAYMENT_GRACE_PERIOD_DAYS` (3 дня, считая от
последнего известного `current_period_end`) на обновление способа оплаты, прежде чем понижать до
бесплатного тарифа. UI на `/pricing` явно показывает пользователю, что последнее списание не
прошло.

## Что не проверено в этой сессии

Нет доступа к реальному Stripe-аккаунту — проверено офлайн: подпись вебхука (`constructEvent`)
корректно принимает валидные и отклоняет поддельные/отсутствующие подписи (см. историю сессии).
Не проверено: реальный Checkout (создание сессии, редирект, оплата тестовой картой), реальный
Customer Portal, реальная обработка `checkout.session.completed`/`invoice.paid` с настоящими
объектами Subscription/Invoice от Stripe. Сделать это — первый шаг сразу после того, как заведён
тестовый Stripe-аккаунт.
