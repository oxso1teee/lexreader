# Current UI Audit — before M3 Slice 1

Дата: 2026-08-02. Baseline commit: `74d57c1dd9fdeff3542dcfa42cf554eecbcc7276` (origin/main
на момент старта этой ветки). Ничего не изменено на момент этого аудита —
все находки получены чтением реального кода и живой браузерной проверкой
(local dev, Node 22, свежесозданный аккаунт `ui-audit-local@example.com`),
не предположениями.

## 1. App layout / shell

`src/app/(app)/layout.tsx` — единственный layout для всех авторизованных
страниц:

```tsx
<div className="flex min-h-screen flex-1 flex-col bg-background">
  <PostHogProvider userId={profile.id} />
  <header className="sticky top-0 ... justify-center ...">LexReader</header>
  <main className="flex flex-1 flex-col">{children}</main>
  <Nav />
</div>
```

**Находки:**
- Нет desktop-специфичной навигации вообще. `<Nav />` (`(app)/nav.tsx`) —
  единственная навигация, это горизонтальный bottom-bar с 5 пунктами,
  `position: sticky; bottom: 0` — рендерится ОДИНАКОВО на 360px и на
  1440px. На широких экранах это выглядит как растянутое мобильное
  приложение, а не desktop-продукт.
- Header — просто центрированный текст "LexReader", без структуры
  (Brand/Topbar/PageContent), одинаковый на каждой странице (что само по
  себе хорошо — единообразие есть), но не несёт функциональной нагрузки.
- Контент каждой страницы независимо оборачивается в
  `mx-auto w-full max-w-2xl` (672px) — узкая центрированная колонка.
  Подтверждено grep'ом (33 файла используют `max-w-` в `src/app`) и прямым
  чтением `home/page.tsx`, `library/page.tsx`, `brain/page.tsx`,
  `settings/page.tsx` — паттерн идентичен на всех четырёх.
- **1440px реально пустой**: контент не шире 672px, остальное —
  однотонный `bg-background` без структуры. Прямое визуальное
  подтверждение через `read_page` на 1440×900 — весь контент/навигация
  умещаются в одну узкую колонку, по бокам пусто.

## 2. Navigation (`(app)/nav.tsx`)

```tsx
const ITEMS = [
  { href: "/home", label: "Главная", Icon: HomeIcon },
  { href: "/library", label: "Читать/Слушать", Icon: LibraryIcon },
  { href: "/brain", label: "Мозг", Icon: BrainIcon },
  { href: "/progress", label: "Статистика", Icon: ProgressIcon },
  { href: "/settings", label: "Настройки", Icon: SettingsIcon },
];
```

- Активное состояние — `pathname.startsWith(item.href)`, подсвечивается
  цветом текста + точка под иконкой. **Нет `aria-current`** (подтверждено
  grep — 0 совпадений в файле) — screen reader не узнаёт активный пункт.
- Иконки — `src/components/nav-icons.tsx`, 5 самодельных inline SVG
  (`HomeIcon`/`LibraryIcon`/`BrainIcon`/`ProgressIcon`/`SettingsIcon`),
  единый stroke-style (`strokeWidth="2"`, `24×24` viewBox). **Нет
  установленной icon-библиотеки** (grep по `lucide-react`/`@radix-ui`/
  `framer-motion` — 0 совпадений во всём проекте) — эмодзи используются
  повсеместно для страничных иконок/эмпти-стейтов (`icon: string` пропсы
  в `EmptyState`/`ScreenHeader`), но НЕ для навигации, где уже есть
  контурные SVG.
- Каждая ссылка — `flex-1` внутри `<nav>`, `py-2.5` — итоговая высота тач-
  таргета навигации ≈ 44px (иконка 20px + паддинг), близко к минимуму, но
  не проверено явным measurement.

## 3. Home (`(app)/home/page.tsx` + `today-card.tsx` + `account-strip.tsx`)

Уже частично реализует "Today"-подобную функциональность:
- `ScreenHeader icon="🏠" title="Главная"` — заголовок страницы, но
  **title рендерится как `<span>`, не `<h1>`** (подтверждено чтением
  `screen-header.tsx` — там просто `<span className="text-xl font-bold">`
  без семантики заголовка). Ни на одной активной странице приложения нет
  `<h1>` вообще (grep по `<h1` в затронутых файлах — 0 совпадений).
- `AccountStrip` — компактная строка "бренд + план + счётчик слов/текстов
  + флаг/язык (ссылка на /settings)".
- `TodayCard` — уже есть кольцо дневной цели, streak/due/new-слова строка,
  "Продолжить чтение" (если есть `continueReading`), кнопка "Начать
  повторение" (если `dueCount > 0`). **Это уже частично тот же primary-
  action journey**, который просит slice 1 — но: (a) это ОДНА карточка
  с несколькими CTA одновременно (кольцо + due + continue + review-кнопка),
  а не единственный primary CTA; (b) нет "Coming Soon"/disabled entry
  points для будущих функций; (c) нет empty/all-done/failed-generation
  состояний, кроме implicit (просто не рендерит блок, если данных нет).
- `SecondaryTips` — `WelcomeCard` (для новых), `PremiumCard` (если free),
  один `InfoCard` tip. Работает, но конкурирует с TodayCard за внимание,
  не имеет чёткой иерархии "главное/второстепенное".
- Данные уже реальные (не заглушки): `dueCount` через `getDueCount()`
  (`src/lib/brain-stats.ts`), `continueReading` через `text_progress`
  запрос — реальный SQL, не моки.

## 4. Library / Brain / Progress / Settings

Все четыре следуют идентичному паттерну (`mx-auto max-w-2xl` + `ScreenHeader`
+ контент), при этом каждая страница делает свои независимые Supabase-
запросы напрямую в `page.tsx` (server component), без общего
DTO/adapter-слоя — компоненты (`TextCard`, `CollectionCard`,
`DeckList`, и т.д.) получают уже нормализованные пропсы, не сырые ORM-
объекты (это фактически уже соответствует "Component API rule" из
спецификации, просто без явного разделения на `ui`/`product` папки).

`Library` дополнительно имеет fixed-position "+" кнопку
(`bottom-20 right-5`) поверх bottom nav — работает, но захардкожен
конкретный `bottom-20`, завязанный на текущую высоту nav; при любом
изменении высоты nav эта кнопка может наехать на неё или оторваться.

`Settings` — тонкая обёртка (31 строка), почти вся логика в
`SettingsClient` (не читан подробно в этом аудите — вне scope slice 1,
маршрут не редизайнится).

## 5. Design tokens (`src/app/globals.css`)

Tailwind v4 (`@import "tailwindcss"`, без `tailwind.config.*` — токены
через `@theme inline` в CSS). Текущий набор:

```css
--color-background, --color-foreground, --color-card,
--color-caramel, --color-caramel-light, --color-beige,
--color-indigo-card, --color-navy-card,
--color-accent-green, --color-accent-orange, --color-accent-purple,
--color-accent-blue, --color-accent-red
```

**Находки:**
- Только 3 по-настоящему семантические роли (`background`/`foreground`/
  `card`) — нет `border`/`surface-muted`/`primary`/`success`/`warning`/
  `danger`/`focus-ring` как именованных токенов. `border`/secondary text
  реализованы ad hoc через opacity-модификаторы прямо в разметке
  (`border-black/10 dark:border-white/10`, `text-black/50 dark:text-white/50`
  — паттерн встречается в десятках файлов, включая `empty-state.tsx`,
  `screen-header.tsx`, `today-card.tsx`).
- **Dark mode существует и работает**, но исключительно через
  `@media (prefers-color-scheme: dark)` — системный, не переключаемый
  вручную. Нет `next-themes`, нет `data-theme` атрибута, нет toggle UI
  нигде в коде (grep подтверждил — 0 совпадений).
- Никакой отдельной spacing/radius/shadow шкалы — используются сырые
  Tailwind-утилиты (`rounded-2xl`, `rounded-xl`, `shadow-sm`) без
  централизованных ролей.
- `viewport` в корневом `layout.tsx` не задаёт `viewportFit: "cover"` —
  `env(safe-area-inset-*)` сейчас не активен на iOS (подтверждено чтением
  `src/app/layout.tsx` — только `themeColor` в `viewport`).

## 6. Зависимости, релевантные UI (package.json)

Уже установлено: `next@16.2.10`, `react@19.2.4`, `tailwindcss@^4`,
`posthog-js`/`posthog-node`. **Не установлено**: `lucide-react`,
`@radix-ui/*`, `shadcn`, `storybook`, `next-intl`/`react-intl`,
`framer-motion`/`motion`, `recharts`, `@tanstack/react-query`,
`react-hook-form`, `zod`, `cmdk`, `sonner`. Нет React Testing
Library/Vitest — только `node:test` (для чистой логики) и Playwright (e2e).

## 7. Analytics

`src/lib/posthog-client.ts` экспортирует простой `track(event, props)` —
уже используется в проекте (см. `docs/analytics/posthog-csp-fix.md`,
`docs/analytics/posthog-production-verification.md` — PostHog реально
работает в production с 2026-08-02). Нет типизированного event-реестра —
вызовы `track()` разбросаны по компонентам как строковые литералы.

## 8. Итог: reuse / replace / keep as-is (для slice 1)

**Переиспользуем без изменений:**
- `EmptyState` (`src/components/empty-state.tsx`) — уже соответствует
  требуемой структуре (icon/title/body/action).
- `nav-icons.tsx` — 5 готовых SVG-иконок, ровно те же 5 разделов, что и в
  новой IA.
- `getDueCount()`, `text_progress`-запрос из `home/page.tsx` — реальные
  источники данных для Today primary CTA.
- Токены `background`/`foreground`/`card`/`caramel*` — не переименовываем,
  расширяем.

**Заменяем (только в новых компонентах slice 1):**
- Bottom-only navigation → `AppShell` с раздельными `DesktopSidebar`
  (md+) и `MobileBottomNav` (переиспользует текущую вёрстку `nav.tsx`,
  добавляет `aria-current`).
- `TodayCard`+`AccountStrip`+`SecondaryTips` на `/home` → новый Today:
  header/greeting + один primary CTA + Today Plan + Continue Learning +
  Review + Progress Snapshot + Coming Soon.
- Заголовок страницы как `<span>` → семантический `<h1>` в новом Today
  (ScreenHeader на других страницах не трогаем — вне scope).

**Оставляем как есть (вне scope этой ветки):**
- Library/Brain/Progress/Settings — сами страницы и их внутренние
  компоненты не редизайниваются, только продолжают работать внутри нового
  AppShell (уже проверено — их `max-w-2xl` контент корректно центруется
  в любом родительском контейнере).
- `SettingsClient`, `library-shelf`, `deck-list` и другая внутренняя
  логика существующих страниц.
- Одно-флаговая (`prefers-color-scheme`) модель тёмной темы — не вводим
  toggle.

## 9. Риски

| Риск | Митигация |
|---|---|
| Изменение layout ломает существующие e2e (уже известный pre-existing flake, см. `docs/analytics/posthog-csp-fix.md`) | Прогнать полный e2e до и после, сравнить набор упавших тестов |
| Новый `<h1>` на Today конфликтует с чем-то, ожидающим `<span>` | Grep использований `ScreenHeader`/заголовка Home перед изменением — не найдено внешних зависимостей от DOM-структуры |
| Fixed "+" кнопка в Library наезжает при изменении высоты shell | Не меняем высоту/структуру mobile bottom nav — только оборачиваем в AppShell, DOM-высота nav не меняется |
| `viewportFit: cover` меняет padding на существующих страницах с fixed-элементами (Library "+") | Добавить `env(safe-area-inset-bottom)` только к новому MobileBottomNav, не к global body padding |

## 10. Rollback

Вся работа — новая ветка `feature/unified-ui-shell-today`, PR остаётся
Draft, ничего не мержится и не деплоится в рамках этой фазы. Откат —
просто не мержить PR; ни одна существующая страница/route/API не
удаляется и не переименовывается.

## 11. Screenshots

Pixel-скриншоты через браузерный инструмент не получены в момент аудита
(инструмент `computer{action:"screenshot"}` таймаутил трижды подряд —
транзиентная проблема окружения, не связана с продуктом). Baseline
задокументирован текстовой/структурной выгрузкой реального DOM
(`read_page` accessibility tree на 1440×900, авторизованная сессия) —
см. слепок landmarks/nav/heading-структуры в разделах 1-3 выше, снятый
именно так, а не придуманный. Скриншоты будут повторно запрошены на шаге
browser verification (после реализации), когда инструмент, ожидаемо,
восстановится.
