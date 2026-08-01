# M0 — Карта маршрутов

Источник истины: вывод `npm run build` (Next.js 16.2.10, Turbopack) —
это единственный способ получить точный список реально
скомпилированных маршрутов, а не догадываться по файлам. Всего
**33 маршрута приложения** (без учёта служебных `_not-found`,
`opengraph-image`, которые не являются полноценными страницами).

CONFIRMED: у корня приложения есть свой middleware-эквивалент —
`src/proxy.ts`, экспортирующий функцию `proxy` (не `middleware`, как в
привычном Next.js — подтверждено предупреждением из `AGENTS.md`: «Это
НЕ тот Next.js, который ты знаешь»). В выводе билда он показан как
`ƒ Proxy (Middleware)`. Матчер: все пути, кроме `_next/static`,
`_next/image`, `favicon.ico` и статичных картинок. Он только обновляет
cookie сессии Supabase — не делает redirect-based защиту маршрутов;
защита выполняется через `requireProfile()` внутри layout/page.

CONFIRMED: `loading.tsx` **отсутствует по всему проекту** (0 файлов).
Единственные error-границы — `src/app/error.tsx` (корень),
`src/app/(app)/error.tsx` (группа приложения), `src/app/global-error.tsx`
(перехват ошибок самого root layout). Per-route `error.tsx`/`loading.tsx`
нет нигде.

## Public

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | server | нет | Показывает `LandingPage` неавторизованным, иначе редиректит на `/home` или `/onboarding` | точка входа | НЕТ | группа-level | н/д | косвенно (auth.spec) |
| `/changelog` | `src/app/changelog/page.tsx` | server (статика) | нет | Статичный список изменений | ссылка из Settings | НЕТ | root-level | н/д | НЕТ |
| `/offline` | `src/app/offline/page.tsx` | — | нет | PWA offline fallback | service worker | НЕТ | root-level | н/д | НЕТ |

## Legal

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/privacy` | `src/app/privacy/page.tsx` | server (статика) | нет | Политика конфиденциальности | футер/онбординг | НЕТ | root-level | н/д | НЕТ |
| `/terms` | `src/app/terms/page.tsx` | server (статика) | нет | Условия использования | футер/онбординг | НЕТ | root-level | н/д | НЕТ |

## Authentication

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/login` | `src/app/login/page.tsx` + `login-form.tsx` | client-форма/server-экшен | нет | Вход по email/паролю | `/`, ссылка с онбординга | НЕТ | root-level | н/д | ДА (auth.spec: верный/неверный пароль, несуществующий email) |
| `/auth/callback` | `src/app/auth/callback/route.ts` | route handler | нет | Обмен OAuth/magic-link кода на сессию | письмо/редирект Supabase | н/д | try/catch внутри | н/д | ДА (auth.spec, password reset confirmation) |
| `/reset-password` | `src/app/reset-password/page.tsx` + `reset-request-form.tsx` | client-форма | нет | Запрос ссылки на сброс пароля | `/login` | НЕТ | root-level | н/д | ДА (auth.spec) |
| `/reset-password/confirm` | `src/app/reset-password/confirm/page.tsx` + `set-password-form.tsx` | client-форма | по токену из письма | Установка нового пароля | ссылка из письма | НЕТ | root-level | н/д | ДА (auth.spec, полный цикл) |

## Onboarding

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/onboarding` | `src/app/onboarding/page.tsx` + `onboarding-wizard.tsx` | client-мастер | нет (создаёт аккаунт) | Регистрация + создание `profiles` | `/` | НЕТ | root-level | н/д | ДА (onboarding-first-win.spec — полный цикл) |
| `/onboarding/first-win` | `src/app/(app)/onboarding/first-win/page.tsx` | server + client flow | да, но редиректит на `/home` если `completed_first_win=true` | Первый управляемый цикл: текст→слово→карточка | редирект после регистрации | НЕТ | группа-level | явный редирект вместо empty | ДА |

## Application (ядро, группа `(app)`)

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/home` | `src/app/(app)/home/page.tsx` | server | да | Главная приборная панель | нижняя навигация | НЕТ | группа-level | н/д (всегда есть контент) | косвенно (все e2e логинятся через неё) |
| `/notebook` | `src/app/(app)/notebook/page.tsx` + `notebook-client.tsx` | server+client | да | Слова из чтения (объединено с Мозгом) | карточка на `/brain` | НЕТ | группа-level | ДА (`notebook/empty-state.tsx`) | ДА (brain-notebook.spec) |
| `/paywall` | `src/app/(app)/paywall/page.tsx` | server | да | Экран лимита бесплатного тарифа | редирект при превышении лимита | НЕТ | группа-level | н/д | НЕТ прямого, косвенно payment.spec |

## Library

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/library` | `src/app/(app)/library/page.tsx` + `library-shelf.tsx` | server+client | да | Мои тексты / каталог, обложки | нижняя навигация | НЕТ | группа-level | ДА (`EmptyState`) | ДА (reading.spec переходит через неё) |
| `/library/new` | `src/app/(app)/library/new/page.tsx` + `add-text-tabs.tsx` | server+client | да | Импорт: текст/URL/YouTube/PDF/фото | кнопка на `/library` | НЕТ | группа-level | н/д (форма) | частично (test:import — только парсер CSV/JSON, не UI) |
| `/library/collections/[id]` | `src/app/(app)/library/collections/[id]/page.tsx` | server | да | Многочастный текст (сборник) | карточка коллекции | НЕТ | группа-level | NEEDS VERIFICATION | НЕТ |

## Reader

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/read/[textId]` | `src/app/read/[textId]/page.tsx` + `reader.tsx` | server+client | да | Читалка: tap-to-translate, фразы, настройки чтения | `/library` | НЕТ | root-level (вне группы `(app)` — свой layout) | н/д | ДА (reading.spec — основной путь) |
| `/watch/[textId]` | `src/app/watch/[textId]/page.tsx` + `watch-player.tsx` | server+client | да | YouTube Watch Mode с синхронными субтитрами | `/library` (видео-источники) | НЕТ | root-level | н/д | НЕТ прямого e2e |

## Brain/Review

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/brain` | `src/app/(app)/brain/page.tsx` + `brain-control-panel.tsx` | server+client | да | Список колод, due-очередь, стартовые колоды | нижняя навигация | НЕТ | группа-level | ДА | ДА (brain-notebook.spec) |
| `/brain/[deckId]` | `src/app/(app)/brain/[deckId]/page.tsx` | server | да | Карточки внутри колоды | карточка колоды | НЕТ | группа-level | ДА | ДА (brain-notebook.spec) |
| `/brain/[deckId]/review` | `src/app/(app)/brain/[deckId]/review/page.tsx` + `review-session.tsx` | server+client | да | Сессия повторения (4 режима + FSRS-предшественник SM-2) | кнопка «Учить» | НЕТ | группа-level | ДА (SessionComplete при пустой due-очереди) | НЕТ прямого e2e (только ручная проверка в этой сессии) |
| `/brain/settings` | `src/app/(app)/brain/settings/page.tsx` + `settings-form.tsx` | server+client | да | Study Settings (learning/relearning steps, лимиты) | `/brain` | НЕТ | группа-level | н/д | НЕТ |

## Progress

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/progress` | `src/app/(app)/progress/page.tsx` (+7 подкомпонентов) | server+client | да | Статистика: heatmap, достижения, личные рекорды, hardest words | нижняя навигация | НЕТ | группа-level | NEEDS VERIFICATION (для нового аккаунта без данных) | НЕТ |

## Settings

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/settings` | `src/app/(app)/settings/page.tsx` + `settings-client.tsx` | server+client | да | Профиль, haptics, feedback-форма, удаление аккаунта, экспорт данных | нижняя навигация | НЕТ | группа-level | н/д | НЕТ прямого (auth.spec не доходит до Settings) |

## Pricing/Billing

| URL | Файл | Компонент | Вход | Назначение | Ведёт откуда | loading | error | empty | тест |
|---|---|---|---|---|---|---|---|---|---|
| `/pricing` | `src/app/(app)/pricing/page.tsx` + `pricing-faq.tsx` | server+client | да | Тарифы, FAQ, честный статус доступности Stripe | `PremiumCard` на `/home`, `/paywall` | НЕТ | группа-level | н/д | ДА (payment.spec — dev fallback; реальный checkout skip без ключей) |

## API

| Маршрут | Файл | Auth | Назначение | Тест |
|---|---|---|---|---|
| `POST /api/translate` | `src/app/api/translate/route.ts` | требует сессию | Перевод слова/фразы через MyMemory, rate-limit, кэш | ДА (косвенно через reading.spec) |
| `GET /api/health/translate` | `src/app/api/health/translate/route.ts` | `Authorization: Bearer HEALTH_CHECK_SECRET` | Health-check для аптайм-монитора | НЕТ |
| `POST /api/webhooks/stripe` | `src/app/api/webhooks/stripe/route.ts` | Stripe signature | Источник истины статуса подписки | НЕТ прямого (payment.spec не шлёт настоящие вебхуки) |
| `GET /api/export/data` | `src/app/api/export/data/route.ts` | требует сессию | Полный экспорт данных пользователя (JSON) | НЕТ |
| `GET /api/export/vocabulary` | `src/app/api/export/vocabulary/route.ts` | требует сессию | Экспорт словаря (CSV) | НЕТ |
| `GET /api/share-card` | `src/app/api/share-card/route.tsx` | требует сессию | Генерация PNG-карточки прогресса (`next/og`) | НЕТ |

## Cron/Internal

| Маршрут | Файл | Auth | Назначение | Тест |
|---|---|---|---|---|
| `GET /api/cron/push-reminders` | `src/app/api/cron/push-reminders/route.ts` | `Authorization: Bearer CRON_SECRET` | Отправка push-напоминаний по расписанию (дёргается GitHub Actions hourly, не Vercel Cron — см. `notifications-map.md`) | НЕТ |

## Admin

Не найдено ни одного маршрута `/admin/*`. Совпадает с ожиданием — файлы
01/02 предполагают админку как часть непостроенного будущего слоя.

## Мёртвые/недосягаемые маршруты, дубликаты, редиректы

- CONFIRMED: дублирующих маршрутов нет.
- CONFIRMED: `/` — не мёртвый, это единственная точка входа с логикой
  ветвления (redirect на `/home`/`/onboarding` для авторизованных).
- NEEDS VERIFICATION: `/library/collections/[id]` — не нашёл прямой
  UI-ссылки на этот маршрут при быстром просмотре `library-shelf.tsx`/
  `text-card.tsx`; вероятно ведёт `collection-card.tsx`, но не
  прослежено до конца в рамках этого прохода.
- CONFIRMED: старых `redirect()`-заглушек или legacy-путей не найдено.
