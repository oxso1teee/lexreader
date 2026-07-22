-- Реальная интеграция со Stripe (раздел P0-PAY release-readiness промта) —
-- нужны идентификаторы Stripe, чтобы вебхуки могли найти нужного
-- пользователя и чтобы можно было редиректить в Stripe Customer Portal.

alter table subscriptions
  add column stripe_customer_id text,
  add column stripe_subscription_id text;

create unique index subscriptions_stripe_customer_idx
  on subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;
