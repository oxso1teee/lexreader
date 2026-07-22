# Деплой на Vercel + production Supabase

Пошаговая инструкция для перехода с локальной разработки на реальный публичный деплой.
Создание аккаунтов (Vercel, Supabase, Stripe) может сделать только сам владелец продукта —
агент не может и не должен заводить их от чужого имени.

## 1. Production Supabase проект

1. Зарегистрироваться на https://supabase.com, создать новый проект (регион — ближе к
   основной аудитории).
2. Прогнать все миграции из `supabase/migrations/` против нового проекта:
   ```
   npx supabase link --project-ref <ref-из-дашборда>
   npx supabase db push
   ```
3. Прогнать `supabase/seed.sql` вручную один раз (системные тексты библиотеки) —
   `psql "$(supabase db remote-url)" -f supabase/seed.sql` (или через SQL Editor в Studio).
4. Storage: бакет `word-photos` создаётся миграцией `0002_word_photos.sql` автоматически
   (включая лимиты из `0012_word_photos_upload_limits.sql`) — ничего вручную делать не
   нужно.
5. Auth → URL Configuration: задать Site URL = реальный домен продакшена, добавить в
   Additional Redirect URLs: `https://<домен>/auth/callback` (нужен для сброса пароля —
   см. `supabase/config.toml`, тот же паттерн, что уже настроен локально).
6. Скопировать из Settings → API: `Project URL`, `anon public key`, `service_role key`
   (последний — секрет, никогда не в клиентский код).

## 2. Переменные окружения на Vercel

Project → Settings → Environment Variables (Production):

| Переменная | Откуда |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (секрет) |
| `NEXT_PUBLIC_SITE_URL` | реальный домен, напр. `https://lexreader.app` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `node -e "console.log(require('web-push').generateVAPIDKeys())"` |
| `VAPID_CONTACT_EMAIL` | реальный email поддержки |
| `CRON_SECRET` | `openssl rand -hex 32` — Vercel Cron сам добавит этот заголовок, см. `vercel.json` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | см. `docs/BILLING_SUPPORT.md` |

## 3. Деплой

1. Подключить GitHub-репозиторий к новому Vercel-проекту (Import Project).
2. Framework Preset определится автоматически как Next.js — ничего менять не нужно.
3. Первый деплой запустится сам после подключения. `vercel.json` уже содержит cron-задачу
   для `/api/cron/push-reminders`.
4. После первого деплоя — прописать домен в Supabase Auth (шаг 1.5) и в Stripe webhook
   endpoint (`docs/BILLING_SUPPORT.md`), если ещё не сделано.

## 4. Проверено перед этим документом

- `npm run build` (production-сборка Next.js, Turbopack) — прошла чисто: компиляция,
  проверка типов и генерация всех статических/динамических страниц (28 маршрутов)
  без ошибок и предупреждений.
- Полный набор Playwright e2e (`npx playwright test`) прогнан против production-подобного
  дев-сервера дважды подряд — 8/8 проходят, 1 тест на реальный Stripe Checkout осознанно
  пропущен (нужен настоящий `STRIPE_SECRET_KEY`, см. `docs/BILLING_SUPPORT.md`).
- Нет захардкоженных `localhost`/`127.0.0.1` в коде приложения (только осознанные
  fallback-значения для локальной разработки, которые перекрываются переменными
  окружения в проде — `NEXT_PUBLIC_SITE_URL` и т.п.).

## 5. Что проверить руками сразу после первого деплоя

- [ ] Регистрация/вход реального аккаунта работает.
- [ ] Чтение текста → тап слова → перевод (реальный вызов MyMemory с домена Vercel).
- [ ] `/api/health/translate` отвечает `{"ok":true}`.
- [ ] Push-уведомление (тестовая кнопка в Настройках) реально приходит в браузере.
- [ ] Оплата в Stripe test mode проходит полный цикл (см. `docs/BILLING_SUPPORT.md`).
- [ ] `/terms`, `/privacy`, `/offline`, `/manifest.json` отдают 200.
