# LexReader — Phase 1: Foundation & Design System Integration

Дата: 2026-11-12 · ветка `feat/moments-stage8-core-screens` · статус: **реализовано, не закоммичено** · предшествует Phase 2 (перенос экранов).

Следующий этап: [lexreader-phase2-plan.md](lexreader-phase2-plan.md). Связанные документы: [lexreader-ultimate-design-system.md](lexreader-ultimate-design-system.md) (что проектировали), [lexreader-ultimate-screen-registry.md](lexreader-ultimate-screen-registry.md) (186 экранов), [lexreader-implementation-roadmap.md](lexreader-implementation-roadmap.md), [lexreader-implementation-readiness.md](lexreader-implementation-readiness.md).

## 1. Что было в проекте до изменений

Проверено по коду, а не по документам:

| Область | Состояние до Phase 1 |
|---|---|
| Стек | Next.js 16.3.3 (App Router, Turbopack), React 19.2, Tailwind v4 (CSS-first, `@theme inline`), Supabase SSR, lucide-react |
| Токены | `src/styles/tokens.css` — уже зрелая двухслойная система: примитивы `--leaf/--sky/--ember/--sun/--danger` (+ `-edge/-tint/-text`), семантика `--color-*`, поверхности `--surface*`, `--border*`, `--text-secondary`. Значения **светлой** палитры совпадали с макетами (`--leaf` = `--green-400` = `#2b820f`) |
| Тема | Уже централизована: `lexreader_theme` в localStorage → `theme-init-script.ts` (до гидрации) → `data-theme` на `<html>`; Tailwind `dark:` смотрит на атрибут. Логика переключателя была спрятана внутри `ThemeToggle` |
| UI-примитивы | `components/ui/`: только `Button` (+`ButtonLink`) и `Card` (+`CardLink`). Остальное — локальные копии в экранах (самодельные toggle в ≥ 7 файлах, модальные слои в 5 файлах, 2 локальных toast) |
| Состояния | `EmptyState`, `ErrorState`, `LoadingState` (форма «Сегодня»), `ProgressBar` существовали, но в разных папках; не было Offline и Not Found |
| Уведомления | Единой системы не было: reader держал собственный `savedToast`, Language Twin — inline-строку; «моменты» (праздники) — отдельная очередь `MomentProvider` |
| 404 | `not-found.tsx` отсутствовал — стандартная страница Next.js вне дизайн-системы |
| Диалоги | `language-twin/dialog.tsx` — реализация с ловушкой фокуса, оставленная как образец; остальные модальные слои (`moment-screen`, `chest-screen`, `double-xp-screen`, `quit-confirm`) на ловушку фокуса не проверялись |
| Тесты | `node --test` на `src/lib/**` (≈530 тестов) + Playwright `e2e/` (требует локальный Supabase). Тестов компонентов и тестов токенов не было |
| Расхождения с макетами | (а) `btn-sky`/`btn-ember`: белый текст на `#1cb0f6`/`#ff9500` ≈ 2.4:1/2.2:1 (в макетах заливки глубокие); (б) тёмная палитра тёплая/фиолетовая (`#14120f`/`#201d29`) против нейтральной в макетах; (в) `--sky-text`, `--ember-text` не проходили AA на своих подложках; (г) граница полей 18% — не проходит WCAG 1.4.11 |

**Что сохранено без переписывания:** маршруты, app-shell, `Button`/`Card` (расширены обратно-совместимо), `EmptyState`/`ErrorState`/`ProgressBar`, механизм темы, `MomentProvider`, всё бизнес-логика и Supabase.

## 2. Токены: одна система, а не две

**Решение:** словарь приложения (`--leaf`, `--sky`, `--surface`…) остаётся единственным. Токены макетов (`--paper-N`, `--ink-N`, `--green-N`, `--fill-*`, `--text-N`…) **в приложение не переносятся**; у каждого есть явный эквивалент или причина отсутствия. Таблица — в коде: [`src/lib/ui/token-map.ts`](../../src/lib/ui/token-map.ts) (65 записей), её читает тест.

Главные соответствия:

| Роль | Макет | Приложение |
|---|---|---|
| Фон / карточка / утопленное / плавающее | `--paper-50` / `--paper-0` / `--paper-100` / `--surface-raised` | `--background` / `--surface` / `--surface-muted` (=`--surface-sunken`) / `--surface-elevated` |
| Текст | `--ink-900` / `--ink-600` / `--ink-400` | `--foreground` / `--text-secondary` / `--text-tertiary` (новый) |
| Главное действие, успех | `--green-400` / `-600` / `-700` / `-100` / `-500` | `--leaf` / `--leaf-edge` / `--leaf-deep` / `--leaf-tint` / `--leaf-text` |
| Память, SRS, инфо | `--blue-500` (заливка) / `--blue-400` / `--blue-600` | `--sky-fill` (новый) / `--sky` / `--sky-text` |
| Стрик, срочное | `--orange-600` (заливка) / `--gold-500` | `--ember-fill` (новый) / `--ember` |
| XP, награды, Plus | `--gold-400` / `--gold-700` | `--sun` / `--sun-text` |
| Ошибка | `--red-400` / `--red-text` | `--danger` / `--danger-text` |
| ИИ / planned | `--fill-ink`, `--purple-500` (удалён) | `--ink-fill`, `--ink-fill-text` (новые) |
| Рамки | `--stroke` / `--stroke-soft` | `--border-strong` / `--border`; контролы — `--border-input` (новый) |
| Форма | `--r-sm/md/lg/2xl` | `--radius-control/btn/card/sheet` (12/16/20/28 px) |

**Добавлено в `tokens.css`** (всё остальное уже было): `--sky-fill`, `--ember-fill`, `--ink-fill` (+`-edge`) — заливки под **белый** текст, глубокие в обеих темах; `--text-tertiary`, `--text-disabled`, `--surface-sunken`; `--border-input`; `--shadow-float/-sheet`, `--scrim`; `--radius-*`; `--ease-*`, `--dur-*`; `--z-nav/-sheet/-modal/-toast`; `--container-reading/-content`. Tailwind-алиасы в `@theme inline`: `bg-sky-fill`, `bg-ember-fill`, `bg-ink-fill`, `text-text-tertiary`, `rounded-control/-btn/-card/-sheet`, `shadow-float/-sheet`.

**Не заводилось намеренно:** шкала отступов — это стандартная шкала Tailwind (`p-1` = 4 px, `p-4` = 16 px); радиусы `rounded-*` Tailwind не переопределены (их используют сотни существующих классов), роль задаётся новыми утилитами; `--paper-200` (холст вокруг рамки устройства) — в приложении холста нет.

**Исправленные значения** (тест нашёл их и не пропускал): `--sky-text` светлый `#0c7c9c → #0b7391` (4.26 → 4.81:1 на фоне); `--ember-text` светлый `#c2410c → #b23a08` (4.33 → >4.5:1 на `--ember-tint`); тёмный `--focus-ring` `#2563eb → #60a5fa` (3.3 → 6.7:1 на карточке); `btn-sky`/`btn-ember` теперь на `--sky-fill`/`--ember-fill`.

### Контрастность проверяется автоматически

[`src/lib/ui/tokens.test.ts`](../../src/lib/ui/tokens.test.ts) читает `tokens.css` и `globals.css`, разрешает `var()`-алиасы для светлой и тёмной темы и считает WCAG-контраст: текст на всех поверхностях (≥ 4.5), цветной текст на подложках, белый на заливках (кнопки, бейджи, аватары), `#1a1a1a` на `--sun`, границы контролов и фокус (≥ 3:1, WCAG 1.4.11), строгий порядок яркости поверхностей тёмной темы, существование каждого токена из таблицы соответствия и наличие тёмного значения у «темизируемых». Смена цвета, ломающая AA, роняет `npm test`.

## 3. Темизация

Одна цепочка, без второго механизма:

```
localStorage["lexreader_theme"] = light | dark | system
        │  (до гидрации)        src/app/theme-init-script.ts → <html data-theme="light|dark">
        ▼
:root { … }                       светлые токены
:root[data-theme="dark"] { … }    переопределения (tokens.css, globals.css)
@custom-variant dark (&:where([data-theme="dark"], …))   Tailwind dark: смотрит на атрибут
        ▲
useTheme() / setTheme()           src/lib/ui/use-theme.ts — ЕДИНСТВЕННАЯ точка записи на клиенте;
                                  следит за сменой темы ОС в режиме «system», слушает событие storage (другая вкладка)
```

- `ThemeToggle` переведён на `useTheme()` (поведение и разметка прежние).
- **Тёмная тема — отдельная система, не инверсия:** нейтральная лестница `#131316 → #1c1c20 → #23232a → #26262d` (вместо прежней тёплой/фиолетовой), свои тени и подложка, светлые `-text`-оттенки, отдельные глубокие `-fill`.
- `viewport.themeColor` теперь два значения по `prefers-color-scheme` (раньше один устаревший зелёный `#4fce23`, из-за чего в тёмной теме статус-бар светился зелёным).

## 4. UI-библиотека `src/components/ui`

Импорт: `import { Button, Card, Input, toast } from "@/components/ui"` (барrel `index.ts`; прежние прямые импорты `@/components/ui/button` работают).

| Компонент | Статус | Заметки по a11y и поведению |
|---|---|---|
| `Button`, `ButtonLink` | **расширен** | + `loading` (aria-busy, клики блокируются, подпись не прыгает), `block`, вариант `ink`; `sky`/`ember` переведены на `-fill` |
| `Card`, `CardLink` | **расширен** | + `tone` (leaf/sky/sun/ember/danger/sunken), `dashed` |
| `IconButton`, `IconButtonLink` | новый | `label` обязателен (= aria-label), зона нажатия 44 px (`size="sm"` расширяет `::after`) |
| `Input`, `Textarea`, `Select` | новый | label↔id, hint/error↔`aria-describedby`, `aria-invalid`, граница 3:1 |
| `Checkbox`, `Radio`, `RadioGroup` | новый | нативные input; строка ≥ 44 px; `fieldset`+`legend` |
| `Switch` | новый | `role="switch"`, Space/Enter; трек 48×28 в зоне 60×44; скрытый input для `<form>` |
| `Badge` | новый | тона по смыслу + `ink` («Скоро»), `plus`, `count` |
| `Avatar` | новый | инициалы из имени или email (`avatarInitials`), цвет детерминирован, кольцо «я» |
| `Tooltip` | новый | hover **и** фокус, Escape, hoverable (WCAG 1.4.13), `aria-describedby` |
| `Dialog`, `Drawer` | новый (обобщение `language-twin/dialog`) | портал, `aria-modal`, ловушка Tab, возврат фокуса, Escape, клик по подложке, блок прокрутки; mobile — нижний шит, `sm+`/`md+` — окно/правая панель |
| `DropdownMenu` | новый | `menu`/`menuitem`, ↑↓ Home End, typeahead, Escape → фокус на триггер, клик снаружи |
| `Tabs`, `TabPanel` | новый | roving tabindex, ←→ Home End, disabled пропускаются, варианты `segmented`/`underline` |
| `Progress`, `ProgressRing` | новый | `progressbar` + имя, тона; `product/progress-bar.tsx` остаётся для старых экранов |
| `Skeleton`, `SkeletonText`, `Spinner` | новый | `aria-hidden`; смысл несёт `role="status"` контейнера |
| `Alert` | новый | 5 тонов (+ ИИ); `live="assertive/polite"` только по запросу |
| `Toaster` + `toast` | новый | см. §5 |
| `EmptyState`, `ErrorState` | **переиспользованы** (re-export) | `ErrorState` получил необязательный `icon` |
| `LoadingState` | новый универсальный | `product/loading-state.tsx` (форма «Сегодня») остаётся |
| `OfflineState`, `NotFoundState` | новый | поверх `ErrorState` |

**Не создавалось:** `Dropdown` как отдельный от `DropdownMenu`; `Select` без нативного `<select>` (на mobile системный пикер лучше любой самодельной разметки).

Стили — `src/styles/ui.css` (`@layer components`, поэтому Tailwind-утилиты на экземпляре побеждают базу) и расширенный `button.css`.

## 5. Уведомления, ошибки, состояния

**Toast** — `import { toast } from "@/lib/ui/toast"`, вызывается откуда угодно на клиенте; `<Toaster />` смонтирован один раз в `app/layout.tsx`.

```ts
toast.success("Слово добавлено");            toast.error("Не удалось сохранить", { description: "…" });
toast.warning(…); toast.info(…);             toast.loading("Сохраняем…")  // sticky; завершить update/success с тем же id
toast.success("Колода удалена", { action: { label: "Отменить", onClick } });
toast.promise(p, { loading: "…", success: "…" });      // loading → success/error на месте
toast.fromResult(result, { success: "Профиль пересчитан" });   // проектная форма { ok, error? } от server actions
toast.fromError(err);                                  // Error → человеческий текст
```

- Чистая логика — `src/lib/ui/toast-store.ts` (дедупликация по id, лимит 4 видимых, sticky переживают обычные, смена тона берёт длительность нового тона); таймеры и пауза при hover/focus — в `<Toaster>`.
- Длительность по тону: success 3.5 с, info 4.5, warning 6.5, error 8, loading — до завершения. Ошибки и предупреждения — `role="alert"`, остальные — `role="status"`.
- Позиция: mobile — по центру над нижней навигацией (`5.5rem + safe-area`), `md+` — справа внизу.

**Ошибки** — `src/lib/ui/errors.ts`: `getErrorMessage()` показывает уже человекочитаемый текст server action как есть, сетевые сбои (Failed to fetch / Load failed / NetworkError) превращает в «Нет соединения…», **любой другой Error заменяет нейтральным текстом** — SQL/stack/имена провайдеров не утекают к пользователю.

**Offline** — `useOnlineStatus()` + `ConnectivityWatcher` внутри `Toaster`: постоянный toast «Нет соединения» (нельзя закрыть вручную, один id), при возврате сети заменяется на «Снова онлайн». Дополняет существующую страницу `/offline` и service worker.

**Not Found** — новый `src/app/not-found.tsx` на `NotFoundState`.

**Мигрировано на единую систему:** inline-статус Language Twin («Профиль пересчитан»/ошибка) → `toast.fromResult`. **Не тронуто:** `savedToast` читалки (+XP за слово привязан к её состоянию — Phase 2), «моменты» (праздничная очередь — другая задача, чем уведомления).

## 6. Адаптивность

Правила — `src/styles/layout.css` (брейкпоинты Tailwind не менялись — на них стоят app-shell и e2e):

| | Ширина | Поведение |
|---|---|---|
| mobile | < 768 | нижняя навигация, одна колонка, шиты снизу, toast над таббаром, поля 16 px |
| tablet | 768–1023 | боковая навигация (`md:`), 1–2 колонки, поля 24 px |
| desktop | ≥ 1024 | до 3 колонок, диалог по центру, Drawer — правая панель |

Утилиты: `.page-reading` (формы, настройки, читалка) / `.page-content` / `.page-wide` — ширина контента по роли; `.cards-grid` (колонки определяет ширина контейнера: `--cards-min`); `.split-main-aside` (стопкой → 2:1 на desktop); `.action-dock` (закреплённая панель главного действия).

## 7. Основа для переноса 186 экранов

- **Где что:** UI-примитивы без бизнес-логики — `src/components/ui/`; составные продуктовые блоки — `src/components/product/<модуль>/` (как сейчас); экраны — `src/app/(app)/<маршрут>/` (Server Component страницы + `*-client.tsx` для интерактива — прежнее правило); чистая логика — `src/lib/<область>/` с `*.test.ts` рядом.
- **Именование:** файлы `kebab-case.tsx`; один компонент — один файл; client-компоненты помечены `"use client"` только когда нужен state/эффект/браузерный API; CSS-классы роли — `kebab-case` с префиксом семейства (`btn-*`, `badge-*`, `card-tone-*`).
- **Правила данных:** экран получает реальные данные из серверных запросов (`requireProfile()` → Supabase RLS → `revalidatePath`) — фикстуры допустимы **только** в `/dev/*`. Результат действий — `{ ok, error? }` → `toast.fromResult`.
- **Цвет:** только токены; белый текст — только на `*-fill`/`--leaf`/`--danger`; цветной текст — только `*-text`; hex в компонентах запрещён (исключение — `#fff` и `#1a1a1a` на сплошной заливке).
- **Справочник:** `/dev/ui` (закрыт на проде, как `/dev/screens`) — все компоненты во всех состояниях; при добавлении компонента добавляется секция сюда и тест.
- Сопоставление «экран макета → маршрут» — в `lexreader-137-screen-implementation-map.md` и реестре (186).

## 8. Тесты и проверки

| Проверка | Результат |
|---|---|
| `npm run typecheck` | чисто |
| `npx eslint src e2e-ui` | 0 ошибок (4 прежних предупреждения в `youtube-ingestion/service.test.ts`) |
| `npm test` (весь node-набор, в CI) | **557 из 557** (+27 новых) |
| `npm run test:ui-kit` (Playwright, `/dev/ui`, без Supabase) | **35 из 35** на dev-сервере (~1 мин) и **35 из 35 на production-сборке** (27 с, 4 воркера) |
| `next build` в изолированной копии (`scripts/isolated-build.sh`) | успешно: «Compiled successfully», 59 статических страниц, `/dev/ui` — динамическая |

Новые unit-тесты (`src/lib/ui/`): `toast-store` (8), `errors` (4), `ui-helpers` (2), `tokens` (13: контраст в обеих темах, порядок поверхностей, таблица соответствия).

Playwright `e2e-ui/ui-kit.spec.ts` — 35 сценариев: **рендер и состояния** (все секции, Button loading/disabled, IconButton name, тона Card/Badge, Avatar, Progress, loading/empty/error/offline/404); **props и поля** (label/hint/error ↔ описание, aria-invalid); **клавиатура** (Switch Space/Enter, Checkbox, RadioGroup ↓, Tabs ←→/Home/End/disabled, Dropdown ↑↓/Home/End/typeahead/Escape/outside, Dialog Tab-ловушка/Escape/возврат фокуса/блок прокрутки/подложка, Tooltip hover/focus/Escape); **toast** (роли, автозакрытие, пауза при hover, action, close, promise, fromResult, лимит 4, офлайн→онлайн); **темы** (переключение, сохранение, перезагрузка, «system» следует ОС, лестница поверхностей различается); **a11y** (axe WCAG 2.1 AA — справочник и «диалог+меню+toast», по обеим темам: 0 нарушений); **адаптив** (390/834/1280 без горизонтальной прокрутки, `cards-grid` 1→3+ колонки, цели нажатия ≥ 44 px, Dialog/Drawer: шит ↔ центр ↔ правая панель, позиция toast, своя 404).

Проверка регрессий: экраны `/dev/screens` (Today, Today-evening, Lesson-choice, Duel-won, Splash, Offline, Quit-confirm) сняты в светлой и тёмной теме и просмотрены — ломающих изменений нет.

## 9. Известные ограничения и честные оговорки

1. **Не запускалось:** основной Playwright-набор `e2e/` — ему нужен локальный Supabase этого проекта; на машине он не запущен, а свободной памяти ~2.3 из 7.9 ГБ при трёх чужих Docker-стеках (см. «Phase 2 — безопасный build и E2E»). `npm run build` **запущен и проходит** — в изолированной копии, не в рабочем дереве. Перед PR: CI-цепочка (`build` + `e2e`).
2. **Видимые изменения у существующих экранов** (намеренные, из таблицы §2): тёмная тема стала нейтральной (карточки `#1c1c20` вместо фиолетового `#201d29`); `btn-sky`/`btn-ember` — глубже; граница полей, чекбоксов — темнее; `--sky-text`/`--ember-text` в светлой теме чуть темнее.
3. **Баг, найденный и оставленный:** в тёмной теме hero «Стрик под угрозой» (Today-evening) и ряд других мест заливаются базовым `--ember`/`--sky` под белый текст — контраст ниже AA. Существовал до Phase 1; исправляется при переносе экрана заменой на `--ember-fill`/`--sky-fill`.
4. **Pre-existing:** `Lesson-choice` в `/dev/screens` даёт hydration-ошибку (воспроизводится на коде до моих изменений).
5. **Не мигрировано:** самодельные toggle (≥ 7 файлов — используйте `Switch` при переносе соответствующих экранов), модальные слои моментов/Chest/Double-XP/Quit-confirm (не проверялись на ловушку фокуса, переносятся на `ui/Dialog` в Phase 2), `savedToast` читалки, ручные кнопки в `error.tsx`.
6. **Маскот Lex** из макетов не реализован; решение принято — см. §10, реализация в Phase 2 (WP0).
7. **Шрифт чтения:** решение принято (Literata) и проверено — см. §10; внедрение в Phase 2 (WP0/WP3).
8. CI не запускает `test:ui-kit`; шаг описан в плане Phase 2 (WP0).

## 10. Решения для Phase 2 (приняты 2026-11-12)

| # | Вопрос | Решение | Следствия |
|---|---|---|---|
| 1 | Вторая вкладка навигации | **Остаётся «Учиться»** (`/learning-paths`), `nav-items.ts` не меняется | Таббары макетов с вкладкой «Библиотека» приводятся к коду: «Библиотека» достижима из «Сегодня», «Учиться» и поиска |
| 2 | Навигация на планшете | **Боковая панель с брейкпоинта `md` (768 px)** остаётся | Планшетные макеты T-* строятся без нижнего таббара; `app-shell` и e2e не меняются |
| 3 | Маскот | **Lex из Ultimate Design System**; функциональность `ReadingCompanion`, не связанная только с картинкой, сохраняется | `ReadingCompanion` — это уже тот же персонаж (тот же SVG-силуэт 128×150), у макетов к нему добавлены лицо и 8 настроений. План: один компонент `Lex` (настроение + размер + тон), `ReadingCompanion` остаётся как совместимая обёртка с теми же props и поведением (hover/клик «возбуждает» на 800 мс, `autoExcite`, ореол, искры, `aria-hidden`, `prefers-reduced-motion`); 10 инлайн-копий SVG заменяются на `<Lex>` |
| 4 | Шрифт чтения | **Literata** из новых макетов; перед внедрением проверено | см. ниже |
| 5 | Исходники макетов | **`design/ultimate/` в git**; скриншоты, временные файлы, секреты и дубликаты исключаются | аудит и шаги переноса — в плане Phase 2 §4.1 |
| 6 | Регистрация | **режим внутри `/login`**, без `/signup` | экран `Signup` = состояние `login-form.tsx` |

**Проверка Literata** (2026-11-12): файлы Google Fonts разобраны `fontTools`, затем отрисованы в Chromium при 13/14/16/18/20/24 px, русский + английский, обычный/курсив/жирный (светлая тема просмотрена; тёмная использует те же глифы, контраст цвета покрыт тестом токенов).

- **Кириллица:** полная — `А–Я`, `а–я`, `Ёё`, `«»`, `—`, `–`, `…`, `№`, `“”„`, `‘’`, `₽` присутствуют в начертаниях normal 400, normal 700, italic 400 (пропусков нет). `next/font` объявляет подмножества `cyrillic`, `cyrillic-ext`, `latin`, `latin-ext`. Есть `locl`: локализованные формы курсива кириллицы включаются при `lang="ru"` (корневой `<html lang="ru">` уже стоит); для английского текста читалки добавить `lang="en"` на контейнер текста.
- **Начертания:** variable-шрифт, оси `wght 200–900` и `opsz 7–72`, normal + italic; нужны 400/500/600/700 + курсив.
- **Читаемость:** Literata шире и плотнее по цвету, чем текущий Source Serif 4; уверенно читается от 16 px. На 13–14 px пробелы между словами тесные → не использовать для подписей и UI (там остаётся Onest), для тела читалки — не меньше 16 px (по умолчанию 18–20), `line-height` 1.6–1.7, `word-spacing: .02em` при ≤ 16 px — по желанию.
- **Вес загрузки (latin + cyrillic, normal + italic):** Source Serif 4 с `opsz` — 426 КБ (сейчас в читалке); Literata только `wght` — **119 КБ (−72 %)**; Literata `wght`+`opsz` — 265 КБ (−38 %). Рекомендация: **`wght` без `opsz`** — для тела ≥ 16 px оптический размер почти не меняет картинку.
- **Где подключать:** сейчас шрифт грузится только в `read/[textId]/page.tsx`, из-за чего `first-text`, splash и «моменты», которые просят `var(--font-reading, Georgia)`, получают Georgia. План: загрузчик в корневой `layout.tsx` с `preload: false` (файл скачивается только если текст им реально набран), переменная `--font-reading` указывает на Literata, из читалки загрузчик Source Serif 4 удаляется.

## 11. Файлы

**Новые:** `src/components/ui/{index,icon-button,field,choice,badge,avatar,tooltip,dialog,dropdown-menu,tabs,progress,skeleton,alert,toast,states}.ts(x)`, `src/lib/ui/{cx,toast-store,toast,errors,avatar-color,token-map,use-theme,use-online-status}.ts` + 4 `*.test.ts`, `src/styles/{ui,layout}.css`, `src/app/not-found.tsx`, `src/app/dev/ui/{page,gallery}.tsx`, `e2e-ui/ui-kit.spec.ts`, `playwright.ui.config.ts`.

**Изменены:** `src/styles/{tokens,button}.css`, `src/app/globals.css` (импорты, тёмные `--background/--card/--foreground`), `src/app/layout.tsx` (`<Toaster/>`, `themeColor`), `src/components/ui/{button,card}.tsx` (обратно-совместимо), `src/components/product/error-state.tsx` (`icon`), `src/components/product/language-twin/dialog.tsx` (тонкая обёртка над `ui/Dialog`), `src/app/(app)/settings/theme-toggle.tsx` (`useTheme`), `src/app/(app)/language-twin/settings/settings-form.tsx` (`toast.fromResult`), `package.json` (`test:ui-kit`, 4 теста в `test:ui`).

**После согласования решений добавлено:** `scripts/isolated-build.sh` (изолированная сборка/запуск/остановка, см. план Phase 2), `E2E_BASE_URL` в `playwright.config.ts`, `await connection()` в `src/app/dev/ui/page.tsx` (страница пререндерилась на сборке, и проверка окружения «запекалась» — на prod-сборке `/dev/ui` всегда был 404).

**Не затронуто:** маршруты, Supabase, миграции, API, бизнес-логика, существующие компоненты (ни один не удалён).
