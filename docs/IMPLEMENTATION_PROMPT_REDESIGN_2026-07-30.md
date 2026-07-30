# LEXREADER — ПРОМТ НА РЕАЛИЗАЦИЮ РЕДИЗАЙНА (v2, автономный)

Статус: согласовано владельцем продукта на уровне направления (артефакт
"LexReader — редизайн v2, расширенная версия"). Это не абстрактное ТЗ —
конкретный список файлов, токенов и разметки, по которому редизайн можно
реализовать без дополнительных уточнений. Если какой-то экран не описан
здесь — не трогать его в этом заходе.

## 0. Как этим пользоваться

Документ разбит на 5 фаз (раздел 8), в том же порядке, что и в артефакте.
Каждая фаза самодостаточна: токены → компоненты → экраны, которые их
используют. Внутри фазы — сначала общие вещи (токены, иконки, компоненты),
потом экран за экраном с точными путями файлов, что создать/удалить/
переписать, и Definition of Done.

Референс "как должно выглядеть" — опубликованный артефакт **LexReader —
редизайн v2, расширенная версия** (раздел «Экраны», 8 телефонных макетов +
интерактивное сравнение до/после Главной). Если в тексте ниже сказано
«как в макете N» — это про соответствующий экран в артефакте. Артефакт —
источник визуального направления (цвет/тип/композиция), а не пиксель-пруф:
он выполнен на голом HTML/CSS вне React-дерева приложения, поэтому классы
и структуру нужно адаптировать под Tailwind v4 и текущие компоненты, а не
копировать разметку буквально.

Общее правило по стилю кода — из AGENTS.md/CLAUDE.md: комментарии — только
там, где неочевидна причина решения (как это уже сделано в существующем
коде: `// Найдено при повторном аудите: …`, `// P0-АУДИТ …`). Не добавлять
комментарии, объясняющие ЧТО делает код.

---

## 1. Дизайн-токены — `src/app/globals.css`

Сейчас в токенах 4 конкурирующих акцента (`--color-accent-green/orange/
purple/blue/red`) плюс `--color-caramel`/`--color-caramel-light`, которые
используются вперемешку и без правил. Меняем на одну акцентную пару +
одну «глубокую» поверхность + строго семантические состояния.

Новый `globals.css`:

```css
@import "tailwindcss";

:root {
  --background: #f1e9da;
  --foreground: #241a10;
  --card: #fffdf8;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);

  /* Единственный акцент бренда. Заменяет собой прежние
     --color-caramel/--color-caramel-light — используется для основного
     действия, прогресса, стрика. Больше НИГДЕ фиолетовый/зелёный/синий
     как "цвет бренда" не используются — см. раздел 1.1. */
  --color-accent: #b8471c;
  --color-accent-strong: #8f350f;
  --color-accent-soft: #f0d2b8;

  /* Глубокие поверхности: премиум-блок, лицевая сторона карточки в
     повторении, будущий "ночной" режим чтения. Заменяет indigo-card/navy-card. */
  --color-well: #172823;
  --color-well-2: #223a33;

  /* Нейтральная подложка для инсетов (треки прогресса, чипы, скелетоны) */
  --color-paper-sunken: #e8ddc8;

  /* Состояния — НЕ бренд-акцент. Используются только там, где реально
     нужна семантика "успех/трудно/ошибка" (SRS-оценки, бейджи "новое"),
     не как декоративный цвет карточки. */
  --color-success: #3f7d5c;
  --color-success-soft: #d9e9dd;
  --color-warning: #b8862f;
  --color-warning-soft: #f0e1c2;
  --color-danger: #b23a3a;
  --color-danger-soft: #f2dcdc;

  /* Алиасы на переходный период — Phase 1 переименовывает токены, но НЕ
     все файлы сразу (settings/pricing правятся в Phase 2). Не ссылаться
     на caramel в НОВОМ коде — только в файлах, которые ещё не
     мигрированы. Удалить эти два алиаса в конце Phase 2, когда исчезнут
     последние вхождения bg-caramel/text-caramel/bg-caramel-light. */
  --color-caramel: var(--color-accent);
  --color-caramel-light: var(--color-accent-strong);
  --color-beige: var(--background);

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #14100b;
    --foreground: #f1e9da;
    --card: #1f1911;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
}

/* без изменений — уже используется в review-session.tsx */
@keyframes flip-reveal {
  from { opacity: 0; transform: rotateX(-90deg); }
  to { opacity: 1; transform: rotateX(0deg); }
}
@media (prefers-reduced-motion: no-preference) {
  .flip-reveal {
    transform-origin: top center;
    animation: flip-reveal 0.35s ease-out;
  }
}

/* НОВОЕ — раздел 6. Короткий пульс на счётчике стрика при увеличении. */
@keyframes streak-pulse {
  0%, 100% { transform: scale(1); }
  35% { transform: scale(1.14); }
}
@media (prefers-reduced-motion: no-preference) {
  .streak-pulse { animation: streak-pulse 0.5s ease-out; }
}
```

### 1.1 Правила использования цвета (проверяется в код-ревью)

| Токен | Где можно использовать |
|---|---|
| `accent` / `accent-strong` | Основная кнопка/CTA, активный пункт навигации, прогресс-бары и кольца, бейдж «к повторению», стрик-пилюля, подчёркивание слова в читалке |
| `well` / `well-2` | Фон пейволла, лицевая сторона карточки в повторении (`flip-card`), премиум-бейдж |
| `success` / `success-soft` | Только: оценка «Хорошо/Легко» в SRS, бейдж «новое», галочки подтверждения (toast, чек-лист фич пейволла) |
| `warning` / `warning-soft` | Только: оценка «Трудно» в SRS, некритичные предупреждения (past_due по подписке) |
| `danger` / `danger-soft` | Только: оценка «Не помню», удаление, ошибки форм |
| `paper-sunken` | Треки прогресс-баров, фон чипов/сегмент-контролов, скелетоны |

Если в код-ревью встречается новый `bg-purple-*`, `bg-blue-*`, `bg-green-*`
и т.п. вне таблицы выше — это регресс, возвращаем к токенам.

---

## 2. Иконки вместо эмодзи — `src/components/icons.tsx` (новый файл)

Эмодзи-иконки (`🏠📖🧠📊⚙️`) заменяются на набор простых line-иконок
24×24, `stroke="currentColor"`, `strokeWidth={1.75}`, `strokeLinecap="round"`,
`strokeLinejoin="round"`, без заливки. Один файл, один компонент на иконку,
без внешних иконных библиотек (без новых зависимостей).

```tsx
// src/components/icons.tsx
import type { SVGProps } from "react";

function base(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconHome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.5V19a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-8.5" />
    </svg>
  );
}

export function IconBook(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5c2-1 5-1 7 .5v13c-2-1.5-5-1.5-7-.5Z" />
      <path d="M20 5.5c-2-1-5-1-7 .5v13c2-1.5 5-1.5 7-.5Z" />
    </svg>
  );
}

// Мозг → колоды: стопка карточек точнее сообщает содержимое раздела,
// чем буквальный "мозг" (см. артефакт v2, экран "Мозг · колоды", callout 1).
export function IconCards(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="9" width="14" height="10" rx="2" opacity="0.5" />
      <rect x="6" y="5" width="14" height="10" rx="2" />
    </svg>
  );
}

export function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 19V10M12 19V5M19 19v-6" />
    </svg>
  );
}

export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h13M21 17h-1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="7" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M5 13l4 4 10-10" />
    </svg>
  );
}

export function IconFlame(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3c1 3-3 4-3 8a3 3 0 0 0 6 0c0-1.2-.6-2-1-3 1.5.5 3 2.3 3 4.5A5.5 5.5 0 0 1 6 12.5C6 8 12 6 12 3Z" />
    </svg>
  );
}
```

Иконки для остального (крестик закрытия, стрелка назад, лупа, плюс,
динамик TTS) уже реализованы инлайновым SVG в `reader.tsx` — их стиль
(`viewBox 0 0 24 24`, `strokeWidth 1.8`) уже совпадает с новым набором,
не трогаем.

Definition of Done раздела 2: ни один эмодзи не используется как замена
функциональной иконки (навигация, кнопки действий). Эмодзи остаются
только там, где это содержимое, а не иконка интерфейса: флаги языков
(`🇪🇸`), стрик (можно оставить `🔥` как контент — так же решено в
артефакте v2, раздел «Айдентика», — либо заменить на `IconFlame`, на
усмотрение при вёрстке, не критично).

---

## 3. Общие компоненты (собираются один раз, переиспользуются везде)

### 3.1 `src/components/badge.tsx` (новый)

```tsx
const VARIANTS = {
  due: "bg-accent-soft text-accent-strong",
  new: "bg-success-soft text-success",
  premium: "bg-well text-[var(--well-fg,#eee6d6)]",
} as const;

export default function Badge({
  variant,
  children,
}: {
  variant: keyof typeof VARIANTS;
  children: React.ReactNode;
}) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}
```

Добавить `--well-fg` в токены (`#eee6d6`) рядом с `--color-well` в
разделе 1, если решите использовать CSS-переменную напрямую вместо
хардкода — на усмотрение реализующего, оба варианта допустимы.

### 3.2 `src/components/toast.tsx` (новый, если нигде ещё нет системы тостов)

Проверить `grep -r "toast" src/` перед созданием — если в кодовой базе
уже есть паттерн уведомлений, использовать его. Если нет — простой
клиентский компонент с `IconCheck`, текстом, авто-скрытием через 2.5с,
`role="status"`, `aria-live="polite"`. Используется минимум в:
читалке (после сохранения слова), пейволле (после оформления).

### 3.3 Кольцо прогресса — вынести из `daily-goal-ring.tsx`

`src/app/(app)/home/daily-goal-ring.tsx` уже реализует SVG-кольцо
правильно (радиус, `strokeDasharray`/`strokeDashoffset`, transition).
Вынести общую часть в `src/components/progress-ring.tsx`:

```tsx
export default function ProgressRing({
  size = 44,
  strokeWidth = 5,
  ratio, // 0..1
  color = "var(--color-accent)",
  trackColor = "var(--color-paper-sunken)",
}: {
  size?: number;
  strokeWidth?: number;
  ratio: number;
  color?: string;
  trackColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, ratio)));
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={c} cy={c} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={c} cy={c} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`} className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}
```

Используется в: `daily-goal-ring.tsx` (переписать на использование этого
компонента вместо дублирования SVG), новых карточках колод в `/brain`
(раздел 5.7), опционально в бейдже прогресса чтения.

---

## 4. Экран за экраном

### 4.1 Нижняя навигация — `src/app/(app)/nav.tsx`

Полностью переписать. Emoji → иконки из `@/components/icons`, активный
пункт — `text-accent-strong` + точка снизу тем же токеном (уже есть эта
логика, просто цвет меняется с `text-caramel`/`bg-caramel` на
`text-accent-strong`/`bg-accent`).

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconBook, IconCards, IconChart, IconSettings } from "@/components/icons";

const ITEMS = [
  { href: "/home", label: "Главная", Icon: IconHome },
  { href: "/library", label: "Читать/Слушать", Icon: IconBook },
  { href: "/brain", label: "Мозг", Icon: IconCards },
  { href: "/progress", label: "Статистика", Icon: IconChart },
  { href: "/settings", label: "Настройки", Icon: IconSettings },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-black/10 bg-card/95 backdrop-blur dark:border-white/10">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-center text-xs font-medium transition-colors ${
              active
                ? "text-accent-strong"
                : "text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="leading-none">{label}</span>
            <span
              className={`mt-0.5 h-1 w-1 rounded-full transition-opacity ${
                active ? "bg-accent opacity-100" : "opacity-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
```

DoD: нижняя навигация визуально совпадает с блоком «Нижняя навигация
крупным планом → Предлагаю» в артефакте v2.

### 4.2 Главная — `src/app/(app)/home/`

Референс: экран «Главная» (02/08) и интерактивное сравнение до/после в
артефакте v2. Сейчас 8 независимых блоков (см. `page.tsx`, прочитан
целиком при подготовке этого промта) — сводим к: 1 карточка «сегодня» +
1 карточка «продолжить чтение» + 1 тонкая полоска апсейла (только free).

**Перед удалением любого файла — обязательно `grep -rn "ComponentName"
src/` чтобы убедиться, что он не используется вне `/home`.** По текущему
состоянию кодовой базы (проверено при подготовке промта) все
перечисленные компоненты используются только в `home/page.tsx`.

Удалить/поглотить:
- `account-summary-card.tsx` → логика переносится в новый `today-card.tsx`
- `language-banner.tsx` → строка внутри `today-card.tsx`
- `welcome-card.tsx` → **удалить полностью**, не переносить. Приветствие
  для новых пользователей — не отдельный экран внимания, а короткая
  фраза в приветствии `today-card.tsx` (например, замена "С возвращением"
  на "Добро пожаловать" в первые 7 дней — та же функция `isNewAccount`,
  но без отдельного визуального блока)
- `stat-row.tsx` → полоса статистики внутри `today-card.tsx`
- `premium-card.tsx` → заменить на новый `upsell-strip.tsx` (тонкая
  полоска, не отдельная тёмная карточка)
- `info-card.tsx` — **проверить usage** (`grep -rn "InfoCard" src/`).
  Если используется только в `home/page.tsx` — убрать со Главной. Сам
  компонент можно оставить в дереве (используется как паттерн), просто
  не рендерить на Главной. Совет дня по продукту логичнее живёт в
  пустом состоянии читалки/библиотеки, но перенос его туда — вне
  рамок этого промта (не делать в этой фазе).

Оставить и переработать:
- `daily-goal-ring.tsx` — переиспользовать `ProgressRing` (раздел 3.3)
- `continue-reading-card.tsx` — тот же контент, новые токены (`bg-card`
  уже ок, прогресс-бар `bg-caramel`→`bg-accent`)

Новый `src/app/(app)/home/today-card.tsx`:

```tsx
import Link from "next/link";
import ProgressRing from "@/components/progress-ring";
import { LANGUAGES } from "@/lib/languages";

const FLAGS: Record<string, string> = {
  en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹", pt: "🇵🇹",
  ru: "🇷🇺", zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", tr: "🇹🇷", pl: "🇵🇱",
  nl: "🇳🇱", sv: "🇸🇪", ar: "🇸🇦",
};

function isNewAccount(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() <= 7 * 86_400_000;
}

export default function TodayCard({
  createdAt,
  targetLanguage,
  wordCount,
  textCount,
  dueCount,
  newWordsToday,
  dailyGoal,
  streak,
}: {
  createdAt: string;
  targetLanguage: string;
  wordCount: number;
  textCount: number;
  dueCount: number;
  newWordsToday: number;
  dailyGoal: number;
  streak: number;
}) {
  const langName = LANGUAGES.find((l) => l.code === targetLanguage)?.name ?? targetLanguage;
  const flag = FLAGS[targetLanguage] ?? "🌐";
  const greeting = isNewAccount(createdAt) ? "Добро пожаловать" : "С возвращением";
  const ratio = dailyGoal > 0 ? newWordsToday / dailyGoal : 0;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-strong">
          {langName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-black/40 dark:text-white/40">{greeting}</p>
          <p className="truncate text-sm font-bold">{langName}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-sm font-bold tabular-nums text-accent-strong">
          🔥 {streak}
        </span>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-black/60 dark:text-white/60">
        <span>{flag}</span> Учишь {langName.toLowerCase()} ·{" "}
        <Link href="/settings" className="underline underline-offset-2">
          сменить
        </Link>
      </p>

      <hr className="my-3 border-black/10 dark:border-white/10" />

      <div className="flex items-center gap-4">
        <ProgressRing ratio={ratio} />
        <div>
          <p className="text-sm font-bold tabular-nums">{newWordsToday} / {dailyGoal} слов</p>
          <p className="text-xs text-black/40 dark:text-white/40">дневная цель</p>
        </div>
      </div>

      <hr className="my-3 border-black/10 dark:border-white/10" />

      <div className="flex">
        {[
          { n: wordCount, l: "слов" },
          { n: textCount, l: "текстов" },
          { n: dueCount, l: "к повтору" },
        ].map((s, i) => (
          <div
            key={s.l}
            className={`flex-1 px-1 text-center ${i > 0 ? "border-l border-black/10 dark:border-white/10" : ""}`}
          >
            <p className="font-mono text-lg font-bold tabular-nums">{s.n}</p>
            <p className="text-[10px] uppercase tracking-wide text-black/40 dark:text-white/40">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Новый `src/app/(app)/home/upsell-strip.tsx`:

```tsx
import Link from "next/link";

export default function UpsellStrip() {
  return (
    <Link
      href="/pricing"
      className="flex items-center gap-2 rounded-2xl border border-dashed border-accent/45 px-4 py-3 text-sm text-black/60 dark:text-white/60"
    >
      <span>Открой Premium — слушать и следить, импорт без лимитов</span>
      <span className="ml-auto font-bold text-accent-strong">→</span>
    </Link>
  );
}
```

`home/page.tsx` — data-fetching не меняется (все запросы уже есть),
меняется только JSX-сборка:

```tsx
return (
  <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-4">
    <TodayCard
      createdAt={profile.created_at}
      targetLanguage={profile.target_language}
      wordCount={wordCount ?? 0}
      textCount={textCount ?? 0}
      dueCount={dueCount}
      newWordsToday={newWordsToday ?? 0}
      dailyGoal={profile.daily_word_goal}
      streak={profile.streak_current}
    />

    {continueText && (
      <ContinueReadingCard
        textId={continueText.id}
        title={continueText.title}
        percentRead={continuing!.percent_read}
      />
    )}

    {plan === "free" && <UpsellStrip />}
  </div>
);
```

DoD: Главная — максимум 3 блока по вертикали (карточка «сегодня» +
опционально «продолжить чтение» + опционально полоска апсейла), один
акцентный цвет на весь экран, ни одного отдельного тёмного/цветного
promo-блока при каждом визите.

### 4.3 Онбординг — `src/app/onboarding/onboarding-wizard.tsx`

Референс: экран «Онбординг» (01/08) в артефакте — точки прогресса
сверху уже есть (`STEP_COUNT`, `i <= step`), просто перекрасить с
`bg-black`/`bg-white` на `bg-accent`. Изменения:

1. Прогресс-точки: `i <= step ? "bg-black dark:bg-white"` → `i <= step
   ? "bg-accent" : "bg-black/10 dark:bg-white/15"` (убрать зависимость
   от тёмной темы через dark:, токен `accent` уже даёт нужный контраст
   в обеих темах).
2. Все кнопки выбора (`LanguagePicker`, `LEVELS`, `DAILY_GOALS`) —
   активное состояние `border-black bg-black text-white dark:border-white
   dark:bg-white dark:text-black` → `border-accent bg-accent-soft
   text-accent-strong` (см. `.ob-chip.on` в артефакте — залитый бордер +
   мягкий фон, не инверсия ч/б).
3. Кнопка «Далее»/сабмит: `bg-black … dark:bg-white` → `bg-accent
   text-white` (без dark:-инверсии — accent уже подобран для обеих тем).
4. Шаг 0 (приветственный экран) — добавить одно предложение,
   тематически перекликающееся с новым акцентом (не обязательно менять
   текст, только цвет ссылки "Уже есть аккаунт?").

Это чисто косметическая правка внутри существующего файла — структура
шагов, `useActionState`, серверный экшен `completeOnboarding` не
трогаются.

DoD: онбординг использует те же токены `accent`/`accent-soft`, что и
остальное приложение — с первого экрана видно, что это тот же продукт,
что и Главная/читалка.

### 4.4 Пейволл / тарифы — `src/app/(app)/pricing/page.tsx`, `src/app/(app)/paywall/page.tsx`

Референс: экран «Пейволл» (08/08) в артефакте. Текущая `/pricing` —
рабочая, но визуально не связана с остальным приложением: `border-2
border-caramel`, отдельный жёлтый alert-блок для беты, две конкурирующие
карточки-тарифа с разным оформлением.

`/paywall` — редирект-заглушка (`redirect("/pricing")`), не трогаем.

Правки в `pricing/page.tsx` (сохранить весь серверный код — запросы,
`getPlan`, `isStripeConfigured`, экшены `simulateSubscribe`/
`cancelSimulatedSubscription`, `CheckoutButton`/`BillingPortalButton` —
меняется только разметка):

1. Убрать раздельные "border-2 border-caramel" карточки-конкуренты.
   Вместо двух отдельно оформленных блоков — **один блок** с
   переключателем план/год внутри (как `.pw-plans` в артефакте: список
   строк-радио, а не две карточки). Годовой план — предвыбран
   (`defaultChecked` эквивалент через локальный `useState` в клиентском
   подкомпоненте, раз нужен интерактивный выбор — вынести переключатель
   тарифа в новый клиентский компонент `plan-picker.tsx`, серверная
   страница передаёт оба `CheckoutButton`/`form action` варианта, а
   `plan-picker` управляет тем, какой из них показан).
2. Список функций (`FEATURES`) — заменить `✓` (текстовый символ,
   `text-emerald-600`) на `IconCheck` в кружке `bg-success-soft
   text-success` (см. `.pw-feat .ck2` в артефакте) — попутно решает то,
   что зелёная галочка сейчас единственное на странице использование
   emerald-палитры, не входящей в токены.
3. Бета-уведомление (жёлтый alert) — оставить функционально, но
   перекрасить с `border-amber-500 bg-amber-50` на `border-warning
   bg-warning-soft text-[...]` (тот же семантический смысл — временное
   предупреждение, — но из палитры токенов, не из сырого tailwind-amber).
4. Кнопки CTA — `border-2 border-caramel`/`bg-caramel` → `bg-well
   text-white` (см. `.pw-cta` в артефакте: тёмная «глубокая»
   поверхность вместо акцентного цвета — тарифная кнопка не должна
   визуально спорить с обычными primary-кнопками остального приложения).
5. Badge "Популярный" — `bg-caramel` → `bg-accent`.
6. Активная подписка (верхний блок при `plan !== "free"`) — без
   изменений в логике, только `text-amber-600`→`text-warning` при
   `past_due`.

DoD: пейволл ощущается как один продуманный экран с ясной ценой, а не
две конкурирующие карточки + баннер поверх Главной (последнее уже
устранено в разделе 4.2 через `UpsellStrip`).

### 4.5 Библиотека — `src/app/(app)/library/`

Референс: экран «Библиотека» (03/08). Изменения точечные, вся
серверная логика (`page.tsx`: коллекции, "текст дня", системные тексты)
не трогается.

1. `text-cover-card.tsx` (системные тексты, сетка обложек) — уже почти
   соответствует направлению (градиентные обложки, `levelTag` бейдж).
   Правка: `hover:scale-[1.02]` оставить, добавить снизу мини-прогресс,
   если есть данные (сейчас `TextCoverCard` не принимает `percentRead` —
   не расширять пропсами в этой фазе, не критично).
2. `text-card.tsx` (свои тексты, список) — сейчас список строк с
   бордером. По артефакту "свои тексты" тоже могли бы стать сеткой
   обложек, **но это требует генерации обложки для пользовательских
   текстов** (`coverGradient(title)` уже есть и используется в
   `CollectionCard`/featured-блоке — можно переиспользовать). Если
   решаете делать сетку — превратить `TextCard` в карточку-обложку по
   образцу `TextCoverCard`, сохранив кнопку удаления и `📺 Смотреть`
   как оверлей-иконки поверх карточки, а не отдельные строки сбоку.
   Если объём работы кажется большим для этой фазы — минимально:
   заменить `✕` (для удаления) и `📺` эмодзи на `IconCheck`-стиль SVG
   (лупа/крестик/плей — по аналогии с `reader.tsx`, где уже есть
   инлайновые SVG для похожих действий) и перекрасить прогресс-бар
   `bg-emerald-500`→`bg-accent` (сейчас единственное расхождение — тут
   зелёный использован как акцент, а не как состояние, что нарушает
   таблицу из раздела 1.1).
3. Кнопка добавления текста (`Link href="/library/new"`, `+`,
   `bg-black … dark:bg-white`) → `bg-accent text-white` (см. `.fab` в
   артефакте — акцентный цвет, не чёрно-белая инверсия).
4. "Текст дня" (`featured`) — уже использует `coverGradient`, не трогать
   цвет генерации, но бейдж `bg-white/25` оставить (это оверлей на
   произвольном градиенте, не токен).

DoD: обложки/карточки библиотеки используют один акцент для
интерактивных элементов (кнопка добавления, активные состояния),
градиентные обложки текстов остаются разнообразными (это генерируемый
контент, не бренд-цвет — не путать с правилом раздела 1.1).

### 4.6 Читалка — `src/app/read/[textId]/reader.tsx`

Референс: экран «Читалка» (04/08) — главное решение макета: перевод
всплывает нижним листом с закруглением сверху, а не поповером с резкой
границей. Текущая реализация уже фактически нижний лист (`fixed
inset-x-0 bottom-16 … border-t`), так что структурных изменений мало —
в основном цвет и один новый визуальный акцент на выбранном слове.

1. Стиль выбранного/сохранённого слова в тексте (сейчас `style={{
   backgroundColor: selected ? "#a67c5266" : levelColor ? `${levelColor}33`
   : undefined }}`, хардкод HEX) — оставить как есть **для уровней слова**
   (это уже осознанная система `WORD_LEVELS` с 5 своими цветами,
   отдельная от токенов раздела 1 — не смешивать), но заменить
   хардкод `"#a67c5266"` (цвет выделения при протягивании фразы) на
   `var(--color-accent)` с алгоритмической прозрачностью, чтобы при
   смене акцента в токенах (маловероятно, но) не остался мёртвый hex.
2. Кнопка "Далее →" (`bg-caramel hover:bg-caramel-light`) → `bg-accent
   hover:bg-accent-strong`.
3. Ссылка "← Библиотека" (`text-caramel`) → `text-accent-strong`.
4. Прогресс-бар страницы (`bg-caramel`) → `bg-accent`.
5. Кнопка "Знаю это слово ⭐" (`backgroundColor: popup.level === 4 ?
   WORD_LEVELS[4].color : "#a67c52"`) — второй хардкод-цвет, заменить
   `"#a67c52"` на `var(--color-accent)`.
6. Три "Premium ⭐"-кнопки в поповере (`💬 В контексте ⭐`, `📖
   Подробно ⭐`, `✏️ Грамматика ⭐`) — оставить эмодзи здесь (это
   контентные ярлыки фич, не навигационные иконки — правило раздела 2
   не требует их менять), но проверить, что они визуально не спорят с
   новым `Badge` компонентом; если требуется бейдж "Premium" — взять
   `<Badge variant="premium">`.
7. Панель статистики слов (5 колонок: Всего/Новые/Учу/Знакомые/Знаю,
   `text-accent-orange`/`text-accent-green`) — это тоже `WORD_LEVELS`-
   палитра по смыслу, не токены раздела 1. Не трогать без явного
   решения — уровни слова являются самостоятельной 5-цветной шкалой,
   описанной в `lib/types.ts`, конфликта с правилом "один акцент" нет,
   так как это не бренд-цвет, а обучающая метрика (как тепловая карта
   активности в `/progress`).

DoD: все хардкод-hex вида `#a67c52*` заменены на CSS-переменные;
структура нижнего листа перевода не меняется (уже соответствует
макету), меняется только палитра интерактивных элементов.

### 4.7 Мозг (колоды) — `src/app/(app)/brain/`

Референс: экран «Мозг · колоды» (05/08). Ключевое изменение: у карточки
колоды появляется кольцо прогресса (доля новых/выученных карточек),
сейчас — просто счётчик "📚 N карт." текстом.

1. `deck-card.tsx` — переписать: `border-l-4 border-caramel` (левая
   цветная плашка — тот самый паттерн, которого явно советует избегать
   `artifact-design` skill, "accent bar/rail on rounded cards") →
   обычная карточка без левой плашки + `ProgressRing` слева от текста.
   Соотношение "к повтору"/"новых" в кольце — если у колоды нет due-
   данных на уровне карточки (сейчас `DeckList`/`BrainPage` считают
   только общий `cardCount`, due — только агрегированно на всё приложение
   через `getDueCount`), для realистичного кольца по колоде потребуется
   дополнительный запрос **по колодам**, а не только общий `dueCount`.
   Это расширение серверного запроса — см. пункт ниже про `brain/page.tsx`.
   Если это выходит за рамки фазы — временный вариант: кольцо показывает
   долю `cardCount` от условного "полного" размера колоды (декоративно),
   но **не выдавать это за реальный SRS-прогресс** — тогда честнее
   оставить текстовый счётчик до реализации per-deck due-count.
   Рекомендация: реализовать per-deck due count (несложно — тот же
   запрос, что в `lib/brain-stats.ts`, с `group by deck_id` вместо
   агрегата), это и есть настоящее наполнение макета, не косметика.
2. Бейдж "Главная" (`bg-beige text-caramel`) → `<Badge variant="due">`
   не подходит по смыслу (это не due-бейдж) — оставить отдельный класс,
   просто сменить токены: `bg-accent-soft text-accent-strong`.
3. Кнопка удаления (`text-red-500`) — уже семантически верна (danger),
   можно оставить как есть или привести к `text-danger` для
   консистентности с токенами.
4. `brain/page.tsx` — карточка "Карточек к повторению: N" / "Начать
   повторение" (`bg-card`, `bg-caramel`) → кнопка `bg-accent`. Блок
   "🎉 Всё повторено!" может остаться с эмодзи (это контент/тон, не
   навигационная иконка).
5. Кнопка "⚙️ Настройки" (`border-black/20`) — заменить эмодзи на
   `<IconSettings className="h-4 w-4" />` инлайн перед текстом.
6. Заголовок "🧠 Мозг" (`text-2xl font-bold`) — эмодзи в заголовке
   страницы можно оставить (это не навигация), но для консистентности с
   нижней навигацией (где 🧠 заменён на `IconCards`) лучше тоже заменить
   на маленькую `IconCards` перед текстом.

DoD: карточка колоды показывает кольцо прогресса, а не только число;
левая цветная плашка убрана со всех карточек колод.

### 4.8 Повторение — `src/app/(app)/brain/[deckId]/review/review-session.tsx`

Референс: экран «Повторение» (06/08). Главная правка — палитра кнопок
оценки SM-2 сейчас "радуга" (`bg-red-600`, `bg-orange-500`,
`bg-emerald-600`, `bg-emerald-700` — два разных зелёных оттенка для
"Помню"/"Легко", что уже само по себе нелогично, это два разных состояния
одним цветом).

```tsx
const GRADES: { value: 0 | 1 | 2 | 3; label: string; className: string }[] = [
  { value: 0, label: "Не помню", className: "bg-danger hover:opacity-90" },
  { value: 1, label: "Трудно", className: "bg-warning hover:opacity-90" },
  { value: 2, label: "Помню", className: "bg-success hover:opacity-90" },
  { value: 3, label: "Легко", className: "bg-accent hover:bg-accent-strong" },
];
```

("Легко" получает акцентный цвet, а не второй зелёный — визуально
отделяет "хорошо справился" от "уверенно знаю", как в артефакте
`.rate-row .easy` — `accent-soft`/`accent-strong`.)

Дополнительно:
1. Флеш-заливка при ответе (`flash === "good" ? "bg-emerald-500/15" :
   "bg-red-500/15"`) — оставить как есть, это чисто состояние успеха/
   неудачи ответа, укладывается в семантику success/danger, можно
   заменить на `bg-success/15`/`bg-danger/15` для консистентности, не
   обязательно.
2. Кнопка "Показать ответ" (`bg-black … dark:bg-white`) → `bg-accent
   text-white`.
3. Прогресс-бар "рекорд сессии" (`bg-caramel`) → `bg-accent`.
4. `flip-reveal` класс на блоке ответа уже используется — **ничего не
   менять**, это уже реализованный микро-анимационный приём из раздела
   6 макета, он уже в проде.
5. Итоговый счётчик сессии (`❌ 🟠 ✅ ⭐` эмодзи внизу) — контентные
   иконки-счётчики, можно оставить, при желании заменить на 4 цветные
   точки токенов (danger/warning/success/accent) без эмодзи для
   визуальной чистоты — не обязательно в этой фазе.
6. `session-complete.tsx` — не читан в рамках подготовки этого промта,
   проверить самостоятельно на использование `bg-caramel`/hardcoded
   emerald/purple и привести к тем же токенам по аналогии.

DoD: 4 кнопки оценки — 4 разных, осмысленно выбранных цвета (не два
зелёных); карточка ответа продолжает использовать существующий
`flip-reveal`.

### 4.9 Статистика — `src/app/(app)/progress/`

Референс: экран «Статистика» (07/08). Текущая `activity-heatmap.tsx`
уже концептуально верна (тепловая карта 91 день, 7×13, по клику —
детали) — макет v2 просто использует другую палитру интенсивности.

1. `activity-heatmap.tsx` — `levelClass()` сейчас на `emerald-300/500/700`
   (зелёная шкала, независимая от токенов) → перевести на акцентную
   шкалу продукта:
   ```ts
   function levelClass(count: number): string {
     if (count === 0) return "bg-paper-sunken dark:bg-white/10";
     if (count <= 2) return "bg-accent-soft";
     if (count <= 5) return "bg-accent/55";
     return "bg-accent";
   }
   ```
   (эквивалент `.heatmap i.l1/l2/l3` в артефакте — активность красится
   в цвет бренда, не в нейтральный "успех".)
2. `stat-card.tsx` — сейчас принимает `color` из палитры `neutral/orange/
   green/purple/blue/red`, то есть **прямой источник "четырёх акцентов"**
   антипаттерна с Главной, только на другом экране. Переписать: убрать
   параметр `color` совсем (все карточки статистики — нейтральный
   `text-foreground` для числа), или свести к двум состояниям:
   `neutral` (по умолчанию, обычные счётчики) и `accent` (только для
   счётчика, который прямо сейчас релевантен выбранному периоду — на
   усмотрение при вёрстке, не обязательно). Обновить все 6 вызовов
   `<StatCard color="…">` в `progress/page.tsx` под новую сигнатуру.
3. `line-chart.tsx` — не читан подробно в рамках подготовки промта,
   вызывается с `color="#a67c52"` и `color="#2563eb"` (хардкод hex) —
   заменить на `"var(--color-accent)"` и **второй график тоже на accent**
   (не на синий) с другой визуальной меткой (например, штриховая линия
   или другой маркер точки), т.к. два разных цвета для двух графиков на
   одном экране — тот же антипаттерн "конкурирующих акцентов". Если
   нужно визуально различать два графика — различать формой/паттерном
   линии, не хардкод-цветом вне токенов.
4. Заголовок "📊 Статистика" — как и в разделе 4.7, заменить на
   `IconChart` + текст для консистентности с навигацией (не обязательно,
   но рекомендуется).

DoD: ни одного `text-accent-orange/green/purple/blue/red` (устаревшие
токены) или хардкод-hex на экране статистики — вся палитра через
`accent`/`success`/`warning`/`danger`/`paper-sunken`.

### 4.10 Настройки — `src/app/(app)/settings/`

Не входил в артефакт как отдельный макет (сознательно не в фокусе v2 —
см. раздел «Что добавить», категория "Мелочи"), поэтому здесь —
минимальная косметика, не переработка структуры:

1. Все `bg-black … dark:bg-white`/`text-black underline dark:text-white`
   кнопки-CTA (`ProfileForm` submit, "Включить напоминания") → `bg-accent
   text-white` (единообразие с остальным приложением).
2. Активные состояния выбора (уровень, цель в день — тот же паттерн, что
   в онбординге) → тот же `border-accent bg-accent-soft text-accent-strong`,
   что и в разделе 4.3 (буквально те же данные `LEVELS`/`DAILY_GOALS`,
   разумно вынести общий стиль кнопки-чипа в `src/components/choice-chip.tsx`,
   переиспользовать и в онбординге, и в настройках — избавляет от
   дублирования классов между двумя местами, которые сейчас независимо
   копируют одну и ту же разметку).
3. "Удалить аккаунт"/деструктивные состояния — уже `text-red-600`/
   `border-red-200`, привести к `text-danger`/`border-danger` при
   желании, не обязательно (уже корректная семантика).

DoD: настройки визуально не выделяются как "другое приложение" — тот же
акцент на интерактивных элементах, но раздел не подвергается
структурной переработке в этой фазе.

---

## 5. Микроанимации (раздел «Микроанимации» артефакта v2)

| Момент | Где | Реализация |
|---|---|---|
| Тап по слову | `reader.tsx`, выбор слова | Уже есть `hover:bg-yellow-100`; можно усилить `transition-colors duration-150` при выборе — не критично, базовое поведение уже соответствует духу макета |
| Стрик продлён | `today-card.tsx`, стрик-пилюля | Класс `.streak-pulse` (раздел 1, keyframes уже в `globals.css`). Логика показа: клиентский wrapper вокруг пилюли, сравнивает `streak` с значением в `localStorage.lexreader_last_streak`; если больше — добавляет класс `streak-pulse` на маунт и обновляет значение в `localStorage`. Не блокирует SSR — `today-card.tsx` остаётся серверным, обёртка — маленький `"use client"` компонент `streak-pill.tsx` |
| Переворот карточки | `review-session.tsx` | Уже реализовано (`flip-reveal`), не трогать |
| Дневная цель выполнена | `ProgressRing` + `today-card.tsx` | Когда `newWordsToday >= dailyGoal`, показать `IconCheck` в кружке `bg-success-soft text-success`, `absolute`, поверх кольца, с `animate-in fade-in` (Tailwind v4 — проверить, есть ли утилита `animate-in` в проекте; если нет, простой CSS `@keyframes fade-in-scale` по аналогии с `streak-pulse`) |

Все анимации — только при `prefers-reduced-motion: no-preference`
(паттерн уже есть в `globals.css` для `flip-reveal`, копировать тот же
guard).

---

## 6. Тёмная тема — что проверить руками

Токены в разделе 1 уже определены для обеих тем через `@media
(prefers-color-scheme: dark)`. После правок пройти руками (или
Playwright-скриншотами через `npm run test:e2e`, если есть подходящий
сценарий) следующие экраны в тёмной теме:
- Главная (`today-card.tsx` — контраст `accent-soft` фона аватара на
  тёмном `--card`)
- Пейволл (`well`/`well-2` — эти токены и так тёмные, проверить, что
  они не сливаются с тёмным фоном приложения — при необходимости
  скорректировать `--color-well`/`--color-well-2` под тёмную тему
  отдельно, т.к. сейчас в разделе 1 они заданы одним значением на обе
  темы)
- Тепловая карта активности — `bg-accent-soft` на тёмном фоне может
  быть недостаточно контрастна против `bg-accent`, проверить 3 уровня
  интенсивности визуально различимы

---

## 7. Порядок реализации — 5 фаз

Порядок обязателен: каждая фаза опирается на токены/компоненты
предыдущей. Не начинать фазу N+1, пока фаза N не прошла `npm run
typecheck && npm run lint` и ручную проверку в браузере (light + dark).

### Фаза 1 — Основа + Главная + навигация
- Раздел 1 (токены globals.css)
- Раздел 2 (иконки)
- Раздел 3 (Badge, ProgressRing, опционально Toast)
- Раздел 4.1 (nav.tsx)
- Раздел 4.2 (Главная — TodayCard, UpsellStrip, удаление старых карточек)

DoD фазы: `/home` и нижняя навигация выглядят как в артефакте v2 (экран
«Главная», интерактивное сравнение «До/после»); typecheck/lint зелёные;
ни один другой экран ещё не тронут (это ожидаемо — они используют
alias-токены `--color-caramel` и продолжают выглядеть по-старому до
своей фазы).

### Фаза 2 — Онбординг + Пейволл
- Раздел 4.3 (онбординг)
- Раздел 4.4 (пейволл/пейволл-редирект)
- В конце фазы: убрать alias `--color-caramel`/`--color-caramel-light`
  из `globals.css`, если весь `grep -rn "caramel" src/` пуст (иначе
  оставить alias до фазы, где домоются оставшиеся файлы — библиотека/
  читалка/мозг/статистика/настройки, все они пока в фазах 3-4)

### Фаза 3 — Библиотека + Читалка
- Раздел 4.5 (библиотека)
- Раздел 4.6 (читалка)

### Фаза 4 — Мозг + Статистика
- Раздел 4.7 (колоды)
- Раздел 4.8 (повторение)
- Раздел 4.9 (статистика)

### Фаза 5 — Полировка
- Раздел 4.10 (настройки)
- Раздел 5 (микроанимации — стрик-пульс, галочка дневной цели)
- Раздел 6 (тёмная тема — ручной проход по всем экранам)
- Финальный `grep -rn "caramel\|bg-purple\|bg-blue-\|bg-green-\|text-accent-orange\|text-accent-purple\|text-accent-blue\|text-accent-red" src/` —
  должен быть пуст (кроме преднамеренных исключений из раздела 1.1,
  таблица, и `WORD_LEVELS`/тегов уровня слова, которые не токены раздела 1)

---

## 8. Границы задачи — что НЕ трогаем в этом заходе

- Схему БД, серверные экшены, RLS — редизайн только про UI/CSS/разметку,
  ни один `actions.ts` не меняет сигнатуру или бизнес-логику (кроме
  добавления per-deck due-count запроса в разделе 4.7, если решено его
  реализовывать — это чтение, не меняет запись)
- `browser-extension/`, `supabase/migrations/`, `e2e/` — вне рамок
- Функциональные пробелы из `lexreader-audit-and-roadmap.md` (не
  перепутать два документа — тот про баги и функциональность, этот
  про визуальный редизайн; не смешивать работу над ними в одном PR)
- `WORD_LEVELS`-палитра (5 цветов уровня знания слова) — самостоятельная
  система, не часть токенов раздела 1, не унифицировать с ней

## 9. Чек-лист перед PR (на каждую фазу)

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] Ручной проход экранов фазы в браузере, light + dark, на мобильной
      ширине (что и есть основной viewport приложения — bottom nav)
- [ ] `grep -rn "caramel"` в файлах фазы — только там, где явно
      разрешено alias'ом (см. раздел 7, конец фазы 2)
- [ ] Ни одного нового хардкод-hex цвета вне `WORD_LEVELS`/градиентов
      обложек текстов (`coverGradient`) — все интерактивные цвета через
      токены раздела 1
- [ ] Скриншот до/после приложен к PR (можно тем же приёмом, что в
      артефакте — реальный скриншот экрана, не макет)
