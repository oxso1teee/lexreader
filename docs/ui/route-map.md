# Route Map — before / after Slice 1

Ни один существующий route не удаляется, не переименовывается и не
редиректится в этой ветке. "After" описывает только, к какому пункту
новой навигации привязан существующий route — сами URL не меняются.

## Public / auth

| Route | Purpose | Slice 1 change |
|---|---|---|
| `/` | Marketing landing | нет |
| `/login` | Вход | нет |
| `/onboarding` | Онбординг (язык/цель/аккаунт) | нет |
| `/onboarding/first-win` | Первое чтение сразу после регистрации | нет |
| `/reset-password`, `/reset-password/confirm` | Восстановление пароля | нет |
| `/privacy`, `/terms`, `/changelog` | Правовые/информационные | нет |
| `/offline` | PWA offline fallback | нет |

## App (`(app)` route group, требует авторизации)

| Route | Текущее назначение | Пункт новой навигации | Slice 1 change |
|---|---|---|---|
| `/home` | Главная / лента | **Сегодня** (1-й пункт) | **Редизайн** — новый Today внутри того же route, без переименования URL |
| `/library` | Библиотека текстов | **Учиться** (2-й пункт) | нет изменений страницы, только новый label в nav |
| `/library/new` | Импорт материала | доступен из Library | нет |
| `/library/collections/[id]` | Коллекция текстов | доступен из Library | нет |
| `/brain` | Колоды/карточки (SM-2 + FSRS shadow/allowlist) | **Практика** (3-й пункт) | нет изменений страницы, только новый label в nav |
| `/brain/[deckId]` | Карточки колоды | доступен из Практики | нет |
| `/brain/[deckId]/review` | Review-сессия | доступен из Практики / Today "Повторить" CTA | нет (FSRS-логика не трогается) |
| `/brain/settings` | Настройки SRS | доступен из Практики | нет |
| `/progress` | Статистика | **Прогресс** (4-й пункт) | нет изменений страницы, только новый label в nav |
| `/settings` | Настройки аккаунта | **Профиль** (5-й пункт) | нет изменений страницы, только новый label в nav |
| `/notebook` | Лёгкая практика (Тетрадь) | доступен через Практику/Библиотеку (как и сейчас) | нет |
| `/paywall`, `/pricing` | Оплата | доступны из Today "Premium"-карточки (как и сейчас) | нет |
| `/read/[textId]` | Читалка | доступен из Library/Today "Продолжить чтение" | нет |
| `/watch/[textId]` | YouTube Watch Mode | доступен из Library | нет |

## Navigation label changes (не route changes)

| Route | Старый label (`nav.tsx`) | Новый label |
|---|---|---|
| `/home` | Главная | Сегодня |
| `/library` | Читать/Слушать | Учиться |
| `/brain` | Мозг | Практика |
| `/progress` | Статистика | Прогресс |
| `/settings` | Настройки | Профиль |

Это labeling, явно запрошенный заданием ("Рекомендуемая navigation:
Сегодня / Учиться / Практика / Прогресс / Профиль"), не смена
информационной архитектуры целевых страниц — каждый route продолжает
делать то же самое, что и раньше.

## Отложено (не создаётся в slice 1)

Полная целевая карта из `02_LEXREADER_PRODUCT_UI_ALL_PAGES_FULL.md`
(`/app/today`, `/app/missions`, `/app/session/[id]`, `/app/practice/*`,
`/app/review`, `/app/phrases`, `/app/errors`, `/app/progress/skills` и
т.д.) — это карта ЦЕЛЕВОГО состояния продукта на много milestone'ов
вперёд (M3-M9 execution plan), не задача этой ветки. Slice 1 явно
ограничен: переиспользовать существующие routes (`/home`, `/library`,
`/brain`, `/progress`, `/settings`), не создавать новые несуществующие
`/app/*` routes без реального контента за ними — это прямо запрещено
инструкцией ("Не создавай неработающие routes").

Missions/AI Conversation/Language Twin — только disabled/coming-soon
карточки внутри Today, без собственных routes в этой фазе.
