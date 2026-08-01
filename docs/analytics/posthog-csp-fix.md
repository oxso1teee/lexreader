# PostHog CSP Production Hotfix

Статус: **исправлено и проверено локально, не задеплоено**. Draft PR открыт,
merge/deploy не выполнялись.

## Root cause

`next.config.ts` задаёт production Content-Security-Policy, но никогда не
получал обновление, когда PostHog подключили (Phase 0, 2 дня назад до этого
фикса). Ни `script-src`, ни `connect-src` не содержали доменов PostHog —
браузер молча блокировал:

- загрузку `posthog-js`'ного bootstrap-скрипта (`array.js`/`config.js` и
  лениво загружаемые расширения — `web-vitals.js`, `surveys.js`,
  `dead-clicks-autocapture.js`) — все со своего `-assets`-поддомена;
- все capture/flags-запросы (`/e/`, `/flags/`, `/decide/`) к основному хосту
  PostHog.

Результат: PostHog не получил **ни одного события** в production с момента
подключения — ни pageview, ни client-side exceptions. Найдено при проверке
шага "PostHog exceptions" в рамках FSRS Production Rollout Phase C (см.
`docs/learning/fsrs-production-shadow-rollout.md`) — не связано с FSRS.

## Реально заблокированные PostHog endpoints

Определены не догадкой, а разбором самой логики `posthog-js`
(`node_modules/posthog-js/dist/module.js`, `RequestRouter.region`/
`endpointFor`) и живой проверкой в браузере (production и локально):

- `region` вычисляется regex'ом по `api_host`: `eu`/`us` → облачный регион,
  иначе — `"custom"` (self-hosted).
- Для облачных регионов: `assets`-эндпоинт = `https://<region>-assets.i.posthog.com`,
  `api`-эндпоинт = `https://<region>.i.posthog.com` (совпадает с
  `NEXT_PUBLIC_POSTHOG_HOST`).
- Для custom/self-hosted host — оба типа эндпоинтов обслуживаются с ОДНОГО
  и того же адреса, отдельного `-assets`-поддомена SDK вообще не строит.

Production/local dev в этом проекте используют `NEXT_PUBLIC_POSTHOG_HOST=
https://eu.i.posthog.com` (EU Cloud, подтверждено в настройках проекта
PostHog: "Region: EU Cloud") — соответственно реально заблокированы были:

- `https://eu-assets.i.posthog.com` (script-src)
- `https://eu.i.posthog.com` (connect-src)

## CSP before/after

**До:**
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.youtube.com
connect-src 'self' <supabaseUrl> https://api.mymemory.translated.net https://cdn.jsdelivr.net
```

**После** (`next.config.ts`):
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.youtube.com <posthogAssetsHost>
connect-src 'self' <supabaseUrl> https://api.mymemory.translated.net https://cdn.jsdelivr.net <posthogApiHost>
```

`<posthogAssetsHost>`/`<posthogApiHost>` вычисляются на этапе сборки функцией
`getPostHogCspHosts()` (`src/lib/posthog-csp.ts`) из
`NEXT_PUBLIC_POSTHOG_HOST` — той же логикой, что использует сам SDK для
региона (см. выше), а не захардкожены построчно. Fallback-хост при
отсутствии переменной — `https://us.i.posthog.com`, тот же, что уже был в
`posthog-client.ts`/`posthog-server.ts` (иначе fallback-путь сам оказался бы
заблокирован).

## Почему изменение минимальное

- Добавлены ровно два источника, оба выведены из уже используемой
  переменной окружения, а не подобраны вручную.
- Никаких wildcard (`*`, `https:`) не добавлено ни в одну директиву.
- `unsafe-eval` не трогался — он уже присутствовал в `script-src` по
  отдельной, не связанной причине (`tesseract.js`/OCR, см. комментарий в
  `next.config.ts`), и PostHog в нём не нуждается.
- Другие директивы (`style-src`, `font-src`, `img-src`, `frame-src`,
  `default-src`) не расширялись.
- Self-hosted/custom PostHog instance (если когда-то сменят на такой)
  автоматически не потребует ДВУХ доменов — `getPostHogCspHosts()`
  правильно схлопывает assets/api в один и тот же host, как и сам SDK.

## Privacy constraints

Проверочное событие для локальной верификации — реальный, уже существующий
в коде `$pageview`-автозахват (`capture_pageview: true` в
`posthog-client.ts`, без изменений) и связанные с ним технические вызовы
SDK (`/flags/`, статические ресурсы) — не добавлялся отдельный синтетический
`posthog_csp_smoke_test`-эвент, поскольку `posthog-js`, подключённый как npm-
модуль (не inline-снippet), не выставляет глобальный `window.posthog` для
вызова из консоли без дополнительного кода — а добавлять отдельный
постоянный или временный код только ради одного тестового события было бы
несвязанным изменением сверх минимального CSP-хотфикса. Никакой текст
карточек, email реального пользователя или иной приватный контент в событиях
не участвовал — тестовый аккаунт для локальной проверки
(`csp-verify-local-20260802@example.com`) существует только в локальной
dev-БД.

## Локальная верификация (реальный, не синтетический тест)

Через `Browser`-инструмент, на `http://localhost:3000` (dev-сервер
перезапущен после правки `next.config.ts` — Next.js не подхватывает
изменения конфига на лету):

1. `curl -sI http://localhost:3000/home` — заголовок `Content-Security-
   Policy` содержит `https://eu-assets.i.posthog.com` в `script-src` и
   `https://eu.i.posthog.com` в `connect-src` (совпадает с локальным
   `NEXT_PUBLIC_POSTHOG_HOST` в `.env.local`, тем же, что и в production).
2. Пройден полный цикл: лендинг → онбординг → создание аккаунта → авторизо-
   ванное приложение (`PostHogProvider` монтируется только внутри `(app)`-
   layout).
3. `performance.getEntriesByType('resource')` на авторизованной странице
   показал РЕАЛЬНЫЕ завершившиеся сетевые запросы (не заблокированные CSP):
   - `https://eu-assets.i.posthog.com/array/<token>/config.js`
   - `https://eu-assets.i.posthog.com/static/web-vitals.js`
   - `https://eu-assets.i.posthog.com/static/surveys.js`
   - `https://eu-assets.i.posthog.com/static/dead-clicks-autocapture.js`
   - `https://eu.i.posthog.com/flags/?v=2&compression=base64`
   - **`https://eu.i.posthog.com/e/`** — реальный capture-запрос (обычный
     `$pageview` от `capture_pageview: true`)
4. Консоль браузера — 0 сообщений о нарушении CSP (`Refused to load/connect
   to...`) за весь цикл, только HMR/Fast Refresh/React DevTools.
5. Обычные страницы (лендинг, онбординг, /brain, /library, /read/[id])
   продолжают открываться и работать — без визуальных регрессий.

Отдельно (до прохождения полного цикла) — прямой тест через `fetch()`/
`<script>` из консоли страницы: `fetch('https://eu.i.posthog.com/decide/...')`
вернул реальный HTTP-статус (не `TypeError: Failed to fetch`, как было бы
при CSP-блокировке), `<script src="https://eu-assets.i.posthog.com/.../
config.js">` — `onload` сработал.

## Известная, не связанная с этим фиксом нестабильность e2e-тестов

При полном прогоне `npm run test:e2e` intermittently падают 1-2 теста из
`brain-notebook.spec.ts`/`reading.spec.ts`/`payment.spec.ts` — во всех
случаях с одной и той же сигнатурой: `expect(page).toHaveURL(...)` не
успевает за 5000ms после клика, вызывающего навигацию. **Проверено, что это
не связано с этим CSP-хотфиксом**: тот же `reading.spec.ts` падает с той же
ошибкой на **немодифицированном `main`** (3 запуска подряд против
неизменённого кода дали 1 падение из 3) — воспроизведено через `git stash`
CSP-изменений, чистый рестарт dev-сервера, повторный прогон. Похоже на
таймаут первой компиляции страницы Turbopack/`next dev` под нагрузкой на
этой машине (лог сборки отдельно предупреждает: "Slow filesystem detected"),
не на регрессию от этого изменения. Не маскируется и не выдаётся за
"исправлено этим PR" — существовавшая до него нестабильность.

## Production verification plan (не выполнено, требует отдельного deploy)

1. Смёржить и задеплоить этот PR (отдельное решение, не автоматически).
2. `vercel env ls production` — подтвердить `NEXT_PUBLIC_POSTHOG_HOST`/
   `_KEY` не менялись (этот фикс их не трогает, только CSP).
3. Открыть `https://lexreader.vercel.app` в браузере, повторить п.3-4 из
   локальной верификации выше (Resource Timing API + консоль без CSP-ошибок).
4. Проверить `eu.posthog.com/project/237442/activity/explore` — в течение
   нескольких минут должны появиться реальные события вместо "This project
   has no events yet".
5. `error_tracking`-раздел PostHog — использовать как реальный сигнал об
   ошибках только ПОСЛЕ подтверждения п.4 (до этого он не отражал
   production-состояние вообще, см. `fsrs-production-shadow-rollout.md`).

## Rollback

Если после деплоя обнаружатся проблемы — откат тривиален и безопасен:
`git revert` этого коммита (или отдельный PR, убирающий добавленные два
источника из `csp`) — CSP снова блокирует PostHog (возврат к текущему,
"тихо сломанному", но не хуже, состоянию), никаких данных/схемы/флагов это
не касается. Supabase, FSRS-флаги, Stripe — не затронуты этим изменением
вообще.

## Изменённые файлы

- `next.config.ts` — CSP `script-src`/`connect-src` дополнены двумя
  вычисляемыми PostHog-хостами.
- `src/lib/posthog-csp.ts` (новый) — `getPostHogCspHosts()`, тестируемая
  чистая функция вывода хостов из `NEXT_PUBLIC_POSTHOG_HOST`.
- `src/lib/posthog-csp.test.ts` (новый) — юнит-тесты функции (default/eu/us/
  custom-host/trailing-slash/no-wildcards).
- `next.config.test.ts` (новый) — интеграционные тесты реального
  `headers()`-вывода `next.config.ts` (домены присутствуют, wildcard'ов нет,
  остальные security-заголовки и CSP-директивы не пострадали).
- `package.json` — новый скрипт `test:csp`.

## Не менялось (по ограничениям задачи)

`FSRS_SCHEMA_READY`/`FSRS_ENABLED` не трогались. Migration 0032 не менялась.
Review scheduling (`src/lib/fsrs*.ts`, `review/actions.ts`, `review/page.tsx`)
не менялся. Stripe-код не менялся. Language Twin/Missions/Voice не
начинались. Несвязанного рефакторинга не производилось.
