# M0 — Переменные окружения

Значения нигде не выводятся — только имена, тип и статус.

| Variable | Используется в | Server-only/Public | Обязательна | Dev | Preview | Production | Есть в `.env.local.example` | Риск |
|---|---|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | повсеместно | Public | да | ДА | ДА | ДА | ДА | низкий |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | повсеместно | Public | да | ДА | ДА | ДА | ДА | низкий (anon key публичный по конструкции) |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase/service.ts`, cron, webhook | Server-only | да | ДА | NEEDS VERIFICATION | ДА | ДА | высокий, если утечёт — обходит все RLS |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | push | Public | да (для push) | ДА | NEEDS VERIFICATION | ДА | ДА | низкий |
| `VAPID_PRIVATE_KEY` | `src/lib/push.ts` | Server-only | да (для push) | ДА | NEEDS VERIFICATION | ДА | ДА | средний |
| `VAPID_CONTACT_EMAIL` | `src/lib/push.ts` | Server-only | нет (есть дефолт в примере) | ДА | NEEDS VERIFICATION | ДА | ДА | низкий |
| `CRON_SECRET` | cron endpoint + GH Actions secret | Server-only | да | ДА (тестовый) | NEEDS VERIFICATION | ДА | ДА | средний — контролирует доступ к массовой push-рассылке |
| `HEALTH_CHECK_SECRET` | health endpoint | Server-only | да | ДА (тестовый) | NEEDS VERIFICATION | ДА | ДА | низкий |
| `STRIPE_SECRET_KEY` | `src/lib/stripe.ts` | Server-only | нет (гейтится `isStripeConfigured()`) | нет (не задан локально) | NEEDS VERIFICATION | **НЕТ — не задан в реальном проде** | ДА | высокий, если утечёт |
| `STRIPE_WEBHOOK_SECRET` | webhook route | Server-only | нет (та же логика) | нет | NEEDS VERIFICATION | **НЕТ** | ДА | средний |
| `STRIPE_PRICE_MONTHLY` | `src/lib/stripe.ts` | Server-only | нет | нет | NEEDS VERIFICATION | **НЕТ** | ДА | низкий |
| `STRIPE_PRICE_YEARLY` | `src/lib/stripe.ts` | Server-only | нет | нет | NEEDS VERIFICATION | **НЕТ** | ДА | низкий |
| `NEXT_PUBLIC_SITE_URL` | Stripe redirect URLs | Public | нет (дефолт localhost) | ДА | NEEDS VERIFICATION | ДА | ДА | низкий |
| `SCRAPERAPI_KEY` | YouTube-импорт | Server-only | нет (есть fallback) | нет | NEEDS VERIFICATION | NEEDS VERIFICATION | ДА | низкий |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog client+server | Public (ingestion-ключ, по конструкции PostHog это публичный write-only ключ) | нет (гейтится) | ДА (добавлен в этой сессии) | NEEDS VERIFICATION | ДА (добавлен в этой сессии) | ДА | низкий |
| `NEXT_PUBLIC_POSTHOG_HOST` | то же | Public | нет | ДА | NEEDS VERIFICATION | ДА | ДА | низкий |
| `MYMEMORY_CONTACT_EMAIL` | `src/lib/translate.ts` | Server-only | нет (опционально повышает лимит MyMemory) | NEEDS VERIFICATION | NEEDS VERIFICATION | NEEDS VERIFICATION | **НЕТ** | низкий — но пробел в документации |
| `VERCEL_ENV` | `pricing/page.tsx` (различение реального прода от dev-симуляции) | Server-only, авто от Vercel | нет | автоматически не задана локально | автоматически `preview` | автоматически `production` | **НЕТ (и не должна — задаётся платформой)** | нет риска, но стоило бы явно задокументировать в коде/доке для будущих разработчиков |
| `NODE_ENV` | стандартная Next.js | Server-only, авто | да | авто | авто | авто | не требуется | нет риска |

## Находки

- **BLOCKER (низкой критичности, но реальный пробел):** `MYMEMORY_CONTACT_EMAIL`
  используется в коде, но отсутствует в `.env.local.example` — новый
  разработчик не узнает о ней из шаблона.
- **RECOMMENDATION:** `VERCEL_ENV` стоит явно упомянуть комментарием в
  `.env.local.example` (даже без значения) — она критична для логики
  "честного пейволла" (`isRealProduction` в `pricing/page.tsx`), и её
  отсутствие в примере может ввести в заблуждение при чтении файла
  как "полного" списка переменных.
- **CONFIRMED:** реальные значения секретов нигде не запрашивались и
  не выводились в рамках этого аудита.
- **CONFIRMED:** в проде Stripe-переменные не заданы (`isStripeConfigured()`
  возвращает `false` — подтверждено живым поведением `/pricing` в
  предыдущих сессиях этого же проекта, не проверялось заново в этом
  проходе, чтобы не трогать production).
