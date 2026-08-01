# M0 — Внешние API/AI и PostHog

## Внешние провайдеры — CONFIRMED, только два, ни одного LLM

| Провайдер | Файл | Назначение | Env var | Таймаут/ретраи | Приватность | Стоимость | Fallback |
|---|---|---|---|---|---|---|---|
| MyMemory (translated.net) | `src/lib/translate.ts` | Перевод слова/фразы в контексте | нет ключа (`MYMEMORY_CONTACT_EMAIL` опционально повышает лимит) | до 3 попыток по 8с при сбоях (комментарий в `starter-deck-actions.ts`) | Отправляется переводимое слово/фраза + контекстное предложение — задокументировано в `/privacy` явно | Бесплатно, лимит ~5000 слов/день анонимно | Архитектурно заменяем на DeepL/LibreTranslate — сигнатура `translate()` для этого и рассчитана, реально не подключено |
| ScraperAPI | `src/app/(app)/library/youtube-actions.ts` | Прокси-фетч страницы YouTube в обход антибот-блокировки облачных IP | `SCRAPERAPI_KEY` (опционально) | NEEDS VERIFICATION | URL видео передаётся третьей стороне | Платный (есть free tier), опционален | Без ключа — прямой fetch, тот же риск блокировки, что и раньше |

**Важный вывод для файлов 03–06 из новой спецификации:** ни одного
LLM-провайдера (OpenAI/Anthropic/Gemini/OpenRouter) в кодовой базе
нет — ни ключей, ни вызовов, ни абстракции провайдера. Всё, что
специфицировано в файлах 03 (Language Twin/FSRS — там, где нужна
генерация), 04 (Voice), 05 (расширенный импорт с AI-обработкой), 06
(AI Architecture целиком) **требует построения AI-слоя с нуля**,
включая выбор и подключение первого реального LLM-провайдера.

## PostHog — CONFIRMED

Клиент: `src/lib/posthog-client.ts` (`track`, `identify`, ленивая
инициализация по `NEXT_PUBLIC_POSTHOG_KEY`). Сервер:
`src/lib/posthog-server.ts` (`captureServerEvent`,
`captureServerException` — короткоживущий клиент на вызов, подходит
для serverless).

### Полный список событий (найдено в коде)

| Событие | Где | Свойства | PII-риск |
|---|---|---|---|
| `signup_completed` | `first-win-flow.tsx`, при монтировании | нет | нет |
| `onboarding_completed` | `first-win-flow.tsx`, шаг `done` | нет | нет |
| `word_saved` | `reader.tsx`, только при `seenCount === 1` | нет (само слово НЕ передаётся) | нет |
| `review_completed` | `review-session.tsx`, последняя карточка | `count` (число) | нет |
| `paywall_viewed` | `pricing-view-tracker.tsx` | `reason` (строка из фиксированного набора причин редиректа) | нет |
| `subscription_started` | Stripe webhook → `captureServerEvent` | `plan` | нет |

### captureException-вызовы (не события, а ошибки)

`src/app/api/translate/route.ts`, `src/app/api/webhooks/stripe/route.ts`,
`src/app/(app)/library/actions.ts`, `src/app/(app)/library/youtube-actions.ts`
— передают `Error` объект + метаданные (`sourceLang`/`targetLang`,
`stripeEventType`, `kind`/`reason`). Проверено построчно: ни в одном
месте не передаётся email, текст источника, транскрипт, текст фразы,
URL аудио, API-токен, тело Stripe-платежа или текст приватного
фидбека — только служебные категориальные метки и распознанные
объекты ошибок.

### Не найдено

`feature flags`, `session replay`, `identify()` с произвольными user
properties сверх `userId` — не используются. Второго analytics SDK
нет (Sentry заменён на PostHog Error Tracking в этой же сессии,
проверено — `@sentry/*` отсутствует в `package.json`).

## Health-check

`src/app/api/health/translate/route.ts` — реально дёргает MyMemory на
тестовое слово, возвращает `{ok, latencyMs}` или `503`. Требует
`Authorization: Bearer HEALTH_CHECK_SECRET`.
